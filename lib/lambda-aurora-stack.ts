import {
  Duration,
  Stack,
  StackProps,
  aws_iam as iam,
  aws_ec2 as ec2,
  aws_logs as logs,
  aws_secretsmanager as secretsmanager,
  aws_rds as rds,
  aws_lambda as lambda,
  aws_lambda_nodejs as nodejs,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as fs from "fs";

export class LambdaAuroraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // DB Name
    const DB_CLUSTER_NAME = "prd-db-cluster";
    const DB_INSTANCE_NAME = "prd-db-instance";

    // Characters to exclude in passwords set for DB
    const EXCLUDE_CHARACTERS = ":@/\" '";

    // VPC
    const vpc = new ec2.Vpc(this, "Vpc", {
      cidr: "10.10.0.0/24",
      enableDnsHostnames: true,
      enableDnsSupport: true,
      natGateways: 1,
      maxAzs: 2,
      subnetConfiguration: [
        { name: "Public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 28 },
        {
          name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
          cidrMask: 28,
        },
        {
          name: "Isolated",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 28,
        },
      ],
    });

    // Security Group
    // Security Group for DB Client
    const dbClientSg = new ec2.SecurityGroup(this, "DbClientSg", {
      vpc,
      securityGroupName: "prd-db-client-sg",
      description: "",
      allowAllOutbound: true,
    });

    // Security Group for Lambda Functions that rotate secret
    const rotateSecretsLambdaFunctionSg = new ec2.SecurityGroup(
      this,
      "RotateSecretsLambdaFunctionSg",
      {
        vpc,
        securityGroupName: "prd-rotate-secrets-lambda-sg",
        description: "",
        allowAllOutbound: true,
      }
    );

    // Security Group for RDS Proxy
    // Allow access from DB clients
    const rdsProxySg = new ec2.SecurityGroup(this, "RdsProxySg", {
      vpc,
      securityGroupName: "prd-rds-proxy-sg",
      description: "",
      allowAllOutbound: true,
    });
    rdsProxySg.addIngressRule(
      ec2.Peer.securityGroupId(dbClientSg.securityGroupId),
      ec2.Port.tcp(5432),
      "Allow RDS Proxy access from DB Client"
    );

    // Security Group for DB
    // Allow access from DB clients, Lambda Functions that rotate the secret and RDS Proxy
    const dbSg = new ec2.SecurityGroup(this, "DbSg", {
      vpc,
      securityGroupName: "prd-db-sg",
      description: "",
      allowAllOutbound: true,
    });
    dbSg.addIngressRule(
      ec2.Peer.securityGroupId(rotateSecretsLambdaFunctionSg.securityGroupId),
      ec2.Port.tcp(5432),
      "Allow DB access from Lambda Functions that rotate Secrets"
    );
    dbSg.addIngressRule(
      ec2.Peer.securityGroupId(dbClientSg.securityGroupId),
      ec2.Port.tcp(5432),
      "Allow DB access from DB Client"
    );
    dbSg.addIngressRule(
      ec2.Peer.securityGroupId(rdsProxySg.securityGroupId),
      ec2.Port.tcp(5432),
      "Allow DB access from RDS Proxy"
    );

    // DB Admin User Secret
    const dbAdminSecret = new secretsmanager.Secret(this, "DbAdminSecret", {
      secretName: `${DB_CLUSTER_NAME}/AdminLoginInfo`,
      generateSecretString: {
        excludeCharacters: EXCLUDE_CHARACTERS,
        generateStringKey: "password",
        passwordLength: 32,
        requireEachIncludedType: true,
        secretStringTemplate: '{"username": "postgresAdmin"}',
      },
    });

    // DB Cluster Parameter Group
    const dbClusterParameterGroup = new rds.ParameterGroup(
      this,
      "DbClusterParameterGroup",
      {
        engine: rds.DatabaseClusterEngine.auroraPostgres({
          version: rds.AuroraPostgresEngineVersion.VER_13_4,
        }),
        description: "aurora-postgresql13",
        parameters: {
          "pgaudit.log": "all",
          "pgaudit.role": "rds_pgaudit",
          shared_preload_libraries: "pgaudit",
          timezone: "Asia/Tokyo",
        },
      }
    );

    // DB Parameter Group
    const dbParameterGroup = new rds.ParameterGroup(this, "DbParameterGroup", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_13_4,
      }),
      description: "aurora-postgresql13",
    });

    // Subnet Group
    const subnetGroup = new rds.SubnetGroup(this, "SubnetGroup", {
      description: "description",
      vpc,
      subnetGroupName: "SubnetGroup",
      vpcSubnets: vpc.selectSubnets({
        onePerAz: true,
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }),
    });

    // DB Cluster
    const dbCluster = new rds.DatabaseCluster(this, "DbCluster", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_13_4,
      }),
      instanceProps: {
        vpc,
        allowMajorVersionUpgrade: false,
        autoMinorVersionUpgrade: true,
        deleteAutomatedBackups: false,
        enablePerformanceInsights: true,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.BURSTABLE3,
          ec2.InstanceSize.MEDIUM
        ),
        parameterGroup: dbParameterGroup,
        performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT,
        publiclyAccessible: false,
        securityGroups: [dbSg],
      },
      backup: {
        retention: Duration.days(7),
        preferredWindow: "16:00-16:30",
      },
      cloudwatchLogsExports: ["postgresql"],
      cloudwatchLogsRetention: logs.RetentionDays.ONE_YEAR,
      clusterIdentifier: DB_CLUSTER_NAME,
      copyTagsToSnapshot: true,
      credentials: rds.Credentials.fromSecret(dbAdminSecret),
      defaultDatabaseName: "testDB",
      deletionProtection: false,
      iamAuthentication: false,
      instanceIdentifierBase: DB_INSTANCE_NAME,
      instances: 1,
      monitoringInterval: Duration.minutes(1),
      parameterGroup: dbClusterParameterGroup,
      preferredMaintenanceWindow: "Sat:17:00-Sat:17:30",
      storageEncrypted: true,
      subnetGroup,
    });

    // Rotate DB Admin user secret
    new secretsmanager.SecretRotation(this, "DbAdminSecretRotation", {
      application:
        secretsmanager.SecretRotationApplication.POSTGRES_ROTATION_SINGLE_USER,
      secret: dbAdminSecret,
      target: dbCluster,
      vpc,
      automaticallyAfter: Duration.days(3),
      excludeCharacters: EXCLUDE_CHARACTERS,
      securityGroup: rotateSecretsLambdaFunctionSg,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
      }),
    });

    // RDS Proxy
    const rdsProxy = new rds.DatabaseProxy(this, "RdsProxy", {
      proxyTarget: rds.ProxyTarget.fromCluster(dbCluster),
      secrets: [dbCluster.secret!],
      vpc,
      borrowTimeout: Duration.seconds(300),
      dbProxyName: "db-proxy",
      debugLogging: true,
      requireTLS: true,
      securityGroups: [rdsProxySg],
      vpcSubnets: vpc.selectSubnets({
        onePerAz: true,
        subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
      }),
    });

    // DB Client IAM Policy
    const getSecretValueIamPolicy = new iam.ManagedPolicy(
      this,
      "GetSecretValueIamPolicy",
      {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: [dbAdminSecret.secretArn],
            actions: ["secretsmanager:GetSecretValue"],
          }),
        ],
      }
    );

    // DB Client IAM Role
    const dbClientIamRole = new iam.Role(this, "DbClientIamRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore"
        ),
        getSecretValueIamPolicy,
      ],
    });

    // User data for Amazon Linux 2
    const userDataParameter = fs.readFileSync(
      "./src/ec2/user_data_db_client.sh",
      "utf8"
    );
    const userDataAmazonLinux2 = ec2.UserData.forLinux({
      shebang: "#!/bin/bash",
    });
    userDataAmazonLinux2.addCommands(userDataParameter);

    // DB Client
    new ec2.Instance(this, "DbClient", {
      instanceType: new ec2.InstanceType("t3.micro"),
      machineImage: ec2.MachineImage.latestAmazonLinux({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      vpc,
      blockDevices: [
        {
          deviceName: "/dev/xvda",
          volume: ec2.BlockDeviceVolume.ebs(8, {
            encrypted: true,
            volumeType: ec2.EbsDeviceVolumeType.GP3,
          }),
        },
      ],
      role: dbClientIamRole,
      securityGroup: dbClientSg,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
      }),
      userData: userDataAmazonLinux2,
    });

    // Lambda Function DB access
    new nodejs.NodejsFunction(this, "DbAccessFunction", {
      entry: "./src/lambda/handlers/db-access.ts",
      runtime: lambda.Runtime.NODEJS_14_X,
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ["pg-native"],
        target: "node14.19",
        tsconfig: "./src/lambda/tsconfig.json",
        format: nodejs.OutputFormat.ESM,
        nodeModules: ["@aws-sdk/client-secrets-manager", "pg"],
      },
      environment: {
        PROXY_ENDPOINT: rdsProxy.endpoint,
        SECRET_ID: dbAdminSecret.secretArn,
        NODE_OPTIONS: "--enable-source-maps",
      },
      role: new iam.Role(this, "DbAccessFunctionIamRole", {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            "service-role/AWSLambdaVPCAccessExecutionRole"
          ),
          getSecretValueIamPolicy,
        ],
      }),
      logRetention: logs.RetentionDays.TWO_WEEKS,
      tracing: lambda.Tracing.ACTIVE,
      securityGroups: [dbClientSg],
      vpc,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
      }),
    });
  }
}
