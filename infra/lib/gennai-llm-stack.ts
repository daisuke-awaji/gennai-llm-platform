import * as cdk from "aws-cdk-lib/core";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as elbv2Targets from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";

const MODEL_ID = "openai/gpt-oss-20b";
const VLLM_PORT = 8000;

export class GennaiLlmStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ----------------------------------------------------------------
    // VPC
    // ----------------------------------------------------------------
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: "Public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        {
          name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    // ----------------------------------------------------------------
    // EC2 — GPU instance running vLLM
    // ----------------------------------------------------------------
    const instanceSg = new ec2.SecurityGroup(this, "InstanceSg", {
      vpc,
      description: "vLLM inference server",
      allowAllOutbound: true,
    });

    const instanceRole = new iam.Role(this, "InstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore"
        ),
      ],
    });

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      "#!/bin/bash",
      "set -euxo pipefail",

      // Install NVIDIA drivers + CUDA (Deep Learning AMI already has them)
      // Install vLLM
      "pip install -U pip",
      "pip install vllm",

      // Create systemd service for vLLM
      `cat > /etc/systemd/system/vllm.service << 'EOF'`,
      "[Unit]",
      "Description=vLLM OpenAI-compatible server",
      "After=network.target",
      "",
      "[Service]",
      "Type=simple",
      "User=root",
      `Environment="HF_HOME=/opt/huggingface"`,
      `ExecStart=/usr/local/bin/vllm serve ${MODEL_ID} --host 0.0.0.0 --port ${VLLM_PORT} --served-model-name gpt-oss-20b --max-model-len 8192 --gpu-memory-utilization 0.90`,
      "Restart=always",
      "RestartSec=10",
      "",
      "[Install]",
      "WantedBy=multi-user.target",
      "EOF",

      "systemctl daemon-reload",
      "systemctl enable vllm",
      "systemctl start vllm"
    );

    // Use Deep Learning AMI (NVIDIA GPU-Optimized)
    const ami = ec2.MachineImage.lookup({
      name: "Deep Learning Base OSS Nvidia Driver GPU AMI (Ubuntu 22.04)*",
      owners: ["amazon"],
    });

    const instance = new ec2.Instance(this, "VllmInstance", {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      instanceType: new ec2.InstanceType("g6e.xlarge"),
      machineImage: ami,
      securityGroup: instanceSg,
      role: instanceRole,
      userData,
      blockDevices: [
        {
          deviceName: "/dev/sda1",
          volume: ec2.BlockDeviceVolume.ebs(200, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
    });

    // ----------------------------------------------------------------
    // NLB (Internal) — fronting the EC2 instance
    // ----------------------------------------------------------------
    const nlb = new elbv2.NetworkLoadBalancer(this, "Nlb", {
      vpc,
      internetFacing: false,
      crossZoneEnabled: true,
    });

    const targetGroup = new elbv2.NetworkTargetGroup(this, "VllmTg", {
      vpc,
      port: VLLM_PORT,
      protocol: elbv2.Protocol.TCP,
      targets: [new elbv2Targets.InstanceTarget(instance, VLLM_PORT)],
      healthCheck: {
        protocol: elbv2.Protocol.HTTP,
        path: "/health",
        port: String(VLLM_PORT),
        interval: cdk.Duration.seconds(30),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    nlb.addListener("TcpListener", {
      port: 80,
      defaultTargetGroups: [targetGroup],
    });

    // Allow NLB health checks
    instanceSg.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(VLLM_PORT),
      "Allow NLB health checks and traffic"
    );

    // ----------------------------------------------------------------
    // API Gateway — REST API with Response Streaming
    // ----------------------------------------------------------------
    const api = new apigateway.RestApi(this, "LlmApi", {
      restApiName: "gennai-llm-api",
      description:
        "OpenAI-compatible LLM API with SSE Streaming (Response Streaming)",
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
      apiKeySourceType: apigateway.ApiKeySourceType.HEADER,
      deployOptions: {
        stageName: "v1",
        throttlingRateLimit: 100,
        throttlingBurstLimit: 50,
      },
    });

    // VPC Link for private integration
    const vpcLink = new apigateway.VpcLink(this, "VpcLink", {
      targets: [nlb],
      description: "VPC Link to internal NLB for vLLM",
    });

    // Integration: HTTP_PROXY through VPC Link with Response Streaming
    const integration = new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: "ANY",
      uri: `http://${nlb.loadBalancerDnsName}/{proxy}`,
      options: {
        connectionType: apigateway.ConnectionType.VPC_LINK,
        vpcLink,
        requestParameters: {
          "integration.request.path.proxy": "method.request.path.proxy",
        },
        responseTransferMode: apigateway.ResponseTransferMode.STREAM,
      },
    });

    // Catch-all: ANY /{proxy+}
    const proxyResource = api.root.addProxy({
      anyMethod: false,
      defaultIntegration: integration,
      defaultMethodOptions: {
        apiKeyRequired: true,
        requestParameters: {
          "method.request.path.proxy": true,
        },
      },
    });
    proxyResource.addMethod("ANY", integration, {
      apiKeyRequired: true,
      requestParameters: {
        "method.request.path.proxy": true,
      },
    });

    // Root path (GET / for health check)
    api.root.addMethod(
      "GET",
      new apigateway.Integration({
        type: apigateway.IntegrationType.HTTP_PROXY,
        integrationHttpMethod: "GET",
        uri: `http://${nlb.loadBalancerDnsName}/`,
        options: {
          connectionType: apigateway.ConnectionType.VPC_LINK,
          vpcLink,
        },
      }),
      { apiKeyRequired: false }
    );

    // ----------------------------------------------------------------
    // API Key + Usage Plan
    // ----------------------------------------------------------------
    const apiKey = api.addApiKey("GennaiApiKey", {
      apiKeyName: "gennai-poc-key",
      description: "API Key for PoC access",
    });

    const usagePlan = api.addUsagePlan("UsagePlan", {
      name: "gennai-poc-plan",
      throttle: { rateLimit: 50, burstLimit: 25 },
      quota: { limit: 10000, period: apigateway.Period.DAY },
    });
    usagePlan.addApiStage({ stage: api.deploymentStage });
    usagePlan.addApiKey(apiKey);

    // ----------------------------------------------------------------
    // Outputs
    // ----------------------------------------------------------------
    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: api.url,
      description: "API Gateway endpoint URL",
    });

    new cdk.CfnOutput(this, "ApiKeyId", {
      value: apiKey.keyId,
      description:
        "API Key ID (retrieve value with: aws apigateway get-api-key --api-key <id> --include-value)",
    });

    new cdk.CfnOutput(this, "InstanceId", {
      value: instance.instanceId,
      description: "EC2 Instance ID (connect via SSM Session Manager)",
    });

    new cdk.CfnOutput(this, "TestCommand", {
      value: [
        "# 1. Get API Key value:",
        `#    aws apigateway get-api-key --api-key \${API_KEY_ID} --include-value --query 'value' --output text`,
        "# 2. Test chat completions (SSE Streaming):",
        `#    curl -N ${api.url}v1/chat/completions \\`,
        "#      -H 'Content-Type: application/json' \\",
        "#      -H 'x-api-key: <YOUR_API_KEY>' \\",
        '#      -d \'{"model":"gpt-oss-20b","messages":[{"role":"user","content":"Hello"}],"stream":true}\'',
      ].join("\n"),
      description: "Test commands",
    });
  }
}
