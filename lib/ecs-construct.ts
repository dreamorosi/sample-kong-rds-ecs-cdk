import {
  StackProps,
} from "aws-cdk-lib";
import { Construct } from 'constructs';
import {
  IVpc,
  InstanceType,
  SecurityGroup,
  SubnetType,
} from "aws-cdk-lib/aws-ec2";
import {
  Cluster,
  Ec2TaskDefinition,
  ContainerImage,
  AwsLogDriver,
  Ec2Service,
  MachineImageType,
  NetworkMode,
  EcsOptimizedImage,
  AsgCapacityProvider
} from 'aws-cdk-lib/aws-ecs';
import { AutoScalingGroup } from 'aws-cdk-lib/aws-autoscaling';

interface ContainerConstructProps extends StackProps {
  vpc: IVpc;
  pgConfig: {
    PGHOST: string;
    PGHOSTADDR: string;
    PGPORT: string;
    PGDATABASE: string;
    PGUSER: string;
    PGPASSWORD: string;
  }
  securityGroup: SecurityGroup;
}

class ContainerConstruct extends Construct {

  constructor(scope: Construct, id: string, props: ContainerConstructProps) {
    super(scope, id);

    const { vpc, pgConfig, securityGroup } = props;

    // We create an ECS cluster in the VPC to run the container(s)
    const cluster = new Cluster(this, 'Cluster', {
      vpc,
      clusterName: 'kong-cluster',
    });

    /**
     * We create an auto scaling group to provide EC2 capacity to the cluster,
     * we specify the min and max capacity to be 1 and 1 respectively (since this is a test)
     * we pass also the SecurityGroup (the one that we allowed to access the database)
     * we specify the VPC subnet in which the cluster will be deployed (same as the RDS instance)
     * 
     * Note: the subnet is private but has a NAT gateway to the internet, this allows the ECS
     * task to get the image from a public repository, but since the RDS instance is not public
     * traffic will stay inside the VPC.
     */ 
    const autoScalingGroup = new AutoScalingGroup(this, 'ASG', {
      vpc,
      instanceType: new InstanceType('t2.micro'),
      machineImage: EcsOptimizedImage.amazonLinux2(),
      minCapacity: 1,
      maxCapacity: 1,
      securityGroup,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_NAT
      }
    });
    
    // We assign this auto scaling group to the cluster as a capacity provider
    const capacityProvider = new AsgCapacityProvider(this, 'AsgCapacityProvider', {
      autoScalingGroup,
      machineImageType: MachineImageType.AMAZON_LINUX_2,
    });
    cluster.addAsgCapacityProvider(capacityProvider);

    // Task definition for the Kong services, we specify network mode to bridge
    const taskDefinition = new Ec2TaskDefinition(this, 'TaskDef', {
      networkMode: NetworkMode.BRIDGE,
    });

    // Add one container for the Kong migration service
    taskDefinition.addContainer('DefaultContainer', {
      image: ContainerImage.fromRegistry("public.ecr.aws/bitnami/kong"),
      memoryLimitMiB: 512,
      logging: new AwsLogDriver({
        streamPrefix: "kong",
      }),
      environment: {
        KONG_DATABASE: 'postgres',
        KONG_PG_HOST: pgConfig.PGHOST,
        KONG_PG_DATABASE: pgConfig.PGDATABASE,
        KONG_PG_USER: pgConfig.PGUSER,
        KONG_PG_PASSWORD: pgConfig.PGPASSWORD,
        KONG_PG_PORT: pgConfig.PGPORT,
      },
      command: ['kong', 'migrations', 'bootstrap']
    });

    /**
     * Instantiate an Amazon ECS Service with Kong bootstrap specifying the
     * cluster and task definition from earlier and the capacity provider from above.
     * 
     * Note: in this case we are running it as a service, so after the DB migration
     * is done, the service will be automatically re-started. To stop it we need to
     * set the desired count to 0 & deploy again.
     * 
     * An alternative would be to run the task using the AWS CLI directy and as a task
     * so that once it's finished it will be automatically removed from the cluster.
     */
    new Ec2Service(this, 'EC2KongService', {
      cluster,
      taskDefinition: taskDefinition,
      capacityProviderStrategies: [
        {
          capacityProvider: capacityProvider.capacityProviderName,
          weight: 1,
        },
      ],
      desiredCount: 1
    });

  }
}

export {
  ContainerConstruct,
  ContainerConstructProps,
}
