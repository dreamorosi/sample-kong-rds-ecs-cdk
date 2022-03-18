# Sample CDK app with RDS and Kong in ECS

In this stack we demonstrate how to create a PostgreSQL RDS database and a [Kong](https://konghq.com/) service in ECS with EC2 capacity. For the purpose of this demonstration we will only apply the migrations to the database using Kong itself.
Other components like the Kong API Gateway and the Kong Admin UI can be created in the future by extending this stack using something like the `ApplicationLoadBalancedEc2Service ` construct from `aws-cdk-lib/aws-ecs-patterns` (https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs_patterns.ApplicationLoadBalancedEc2Service.html).

More info about the ECS constructs used in this sample can be found [here](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs-readme.html).

To run the sample you need to have the CDK CLI installed in your system and valid credentials for the AWS account you are using.

## Useful commands

 * `npm install`     install dependencies for the project
 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
