import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  Vpc,
  SubnetType,
  FlowLogTrafficType,
  FlowLogDestination,
  Port,
  SecurityGroup,
} from "aws-cdk-lib/aws-ec2";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { DatabaseConstruct } from "./database-construct";
import { ContainerConstruct } from './ecs-construct';

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new Vpc(this, "MainVpc", {
      cidr: "10.0.0.0/16",
      maxAzs: 2,
      subnetConfiguration: [
        {
          subnetType: SubnetType.PUBLIC,
          cidrMask: 24,
          name: "Public",
        },
        {
          subnetType: SubnetType.PRIVATE_WITH_NAT,
          cidrMask: 24,
          name: "Private",
        },
      ],
    });
    
    // Create log group for flow logs
    const flowLog = new LogGroup(this, "VPCFlowLog", {
      retention: RetentionDays.ONE_MONTH,
    });
    
    // Enabling flow logs for the VPC (optional)
    vpc.addFlowLog("FlowLogs", {
      trafficType: FlowLogTrafficType.ALL,
      destination: FlowLogDestination.toCloudWatchLogs(flowLog),
    });

    // Security Group for the RDS Instance
    const rdsSecurityGroup = new SecurityGroup(this, "DBSecurityGroup", {
      vpc: vpc,
      allowAllOutbound: true,
    });

    // Security Group for the ECS Cluster
    const ecsSecurityGroup = new SecurityGroup(this, "ECSSecurityGroup", {
      vpc: vpc,
      allowAllOutbound: true,
    });
    // Allow ingress to the RDS Security Group from the ECS Cluster on port 5432
    rdsSecurityGroup.addIngressRule(ecsSecurityGroup, Port.tcp(5432));

    /**
     * Create the RDS Instance (see file database-construct.ts)
     * 
     * We pass in the VPC and the RDS Security Group as a parameters
     * to the DatabaseConstruct so that we can use them when
     * creating the RDS Instance.
     */
    const database = new DatabaseConstruct(this, "Database", {
      vpc: vpc,
      securityGroup: rdsSecurityGroup,
    });

    /**
     * Create the ECS Cluster (see file ecs-construct.ts)
     * 
     * We pass in: the VPC, the ECS Security Group, and the PosgreSQL configs
     * as a parameters to the ECSConstruct so that we can use them when
     * creating the ECS Cluster.
     */
    new ContainerConstruct(this, "Container", {
      vpc: vpc,
      securityGroup: ecsSecurityGroup,
      pgConfig: database.pgConfig
    })
  }
}
