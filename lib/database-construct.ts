import {
  CfnOutput,
  StackProps,
  RemovalPolicy,
} from "aws-cdk-lib";
import { Construct } from 'constructs';
import {
  IVpc,
  InstanceType,
  SubnetType,
  SecurityGroup,
} from "aws-cdk-lib/aws-ec2";
import {
  DatabaseInstance,
  DatabaseInstanceEngine,
  PostgresEngineVersion,
} from "aws-cdk-lib/aws-rds";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";

interface DatabaseConstructProps extends StackProps {
  vpc: IVpc;
  securityGroup: SecurityGroup;
}

class DatabaseConstruct extends Construct {
  securityGroup: SecurityGroup;
  dbUserSecret: Secret;
  dbPassSecret: Secret;
  dbInstance: DatabaseInstance;
  pgConfig: {
    PGHOST: string;
    PGHOSTADDR: string;
    PGPORT: string;
    PGDATABASE: string;
    PGUSER: string;
    PGPASSWORD: string;
  }

  constructor(scope: Construct, id: string, props: DatabaseConstructProps) {
    super(scope, id);

    const { securityGroup: rdsSecurityGroup } = props;

    this.securityGroup = rdsSecurityGroup;

    const databaseName = 'kong';

    // We create secrets to store the database user and password, then we output the names
    const dbUser = new Secret(this, "DBUser", {
      removalPolicy: RemovalPolicy.DESTROY,
      description: "Database user for Kong",
      generateSecretString: {
        excludePunctuation: true,
        excludeUppercase: true,
        excludeNumbers: true,
        passwordLength: 20,
      },
    });
    new CfnOutput(this, "dbUserSecretName", {
      value: dbUser.secretName,
      description: "Database User Secret Name",
    });
    this.dbUserSecret = dbUser;

    const dbPass = new Secret(this, "DBPass", {
      removalPolicy: RemovalPolicy.DESTROY,
      description: "Database password for Kong",
      generateSecretString: {
        excludeCharacters: "/ @ \"  '",
        passwordLength: 20,
      },
    });
    new CfnOutput(this, "dbPassSecretName", {
      value: dbPass.secretName,
      description: "Database Password Secret Name",
    });
    this.dbPassSecret = dbPass;

    /**
     * We create a RDS instance for the database, we pass the 
     * credentials and the security group. In networking we
     * specify the subnet in which the database will be deployed
     * which is a private one and the VPC from before.
     * 
     * Note 1: the database is not accessible from the internet.
     * 
     * Note 2: the fact that this private subnet also has a NAT
     * gateway is irrelevant in this case, I'm just reusing the
     * same private subnet for the database and the ECS cluster;
     * in any case NAT gateways are used only for outbound traffic.
     */
    const instance = new DatabaseInstance(this, "DBInstance", {
      engine: DatabaseInstanceEngine.postgres({
        version: PostgresEngineVersion.VER_13_3,
      }),
      instanceType: new InstanceType("t4g.medium"),
      credentials: {
        username: dbUser.secretValue.toString(),
        password: dbPass.secretValue,
      },
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_NAT,
      },
      publiclyAccessible: false,
      iamAuthentication: true,
      securityGroups: [rdsSecurityGroup],
      multiAz: true,
      autoMinorVersionUpgrade: true,
      allocatedStorage: 20,
      databaseName: databaseName,
    });

    new CfnOutput(this, "DBInstanceEndpoint", {
      value: instance.instanceEndpoint.hostname,
      description: "Database endpoint",
    });
    new CfnOutput(this, "DBInstancePort", {
      value: instance.dbInstanceEndpointPort.toString(),
      description: "Database port",
    });
    this.dbInstance = instance;

    // This is an object that contains the database connection
    // as you can see, we use the endpoint address and not the
    // IP address.
    this.pgConfig = {
      PGHOST: instance.dbInstanceEndpointAddress.toString(),
      PGHOSTADDR: instance.dbInstanceEndpointAddress.toString(),
      PGPORT: instance.dbInstanceEndpointPort.toString(),
      PGDATABASE: databaseName,
      PGUSER: dbUser.secretValue.toString(),
      PGPASSWORD: dbPass.secretValue.toString(),
    }

  };
};

export { DatabaseConstruct, DatabaseConstructProps };
