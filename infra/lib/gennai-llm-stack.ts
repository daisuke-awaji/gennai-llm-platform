import * as cdk from "aws-cdk-lib/core";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as elbv2Targets from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";

const VLLM_PORT = 8000;

interface ModelConfig {
  modelId: string;
  servedModelName: string;
  constructId: string;
  routePrefix: string;
  instanceType: string;
  nlbListenerPort: number;
  tensorParallelSize: number;
  maxModelLen: number;
  ebsSizeGb: number;
  gated?: boolean;
  extraVllmArgs?: string;
}

const MODEL_CONFIGS: ModelConfig[] = [
  {
    modelId: "openai/gpt-oss-20b",
    servedModelName: "gpt-oss-20b",
    constructId: "gpt-oss-20b",
    routePrefix: "gpt-oss-20b",
    instanceType: "g7e.4xlarge",
    nlbListenerPort: 80,
    tensorParallelSize: 1,
    maxModelLen: 8192,
    ebsSizeGb: 200,
  },
  {
    modelId: "cyberagent/Llama-3.1-70B-Japanese-Instruct-2407",
    servedModelName: "llama-3.1-70b-ja",
    constructId: "llama-3.3-70b",
    routePrefix: "llama-3.1-70b-ja",
    instanceType: "g7e.12xlarge",
    nlbListenerPort: 8080,
    tensorParallelSize: 2,
    maxModelLen: 8192,
    ebsSizeGb: 500,
    gated: false,
    extraVllmArgs: "--dtype bfloat16",
  },
];

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
    // Shared resources
    // ----------------------------------------------------------------
    const instanceSg = new ec2.SecurityGroup(this, "InstanceSg", {
      vpc,
      description: "vLLM inference servers",
      allowAllOutbound: true,
    });

    const instanceRole = new iam.Role(this, "InstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore"
        ),
      ],
      inlinePolicies: {
        HfTokenAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["ssm:GetParameter"],
              resources: [
                `arn:aws:ssm:${this.region}:${this.account}:parameter/gennai/hf-token`,
              ],
            }),
          ],
        }),
      },
    });

    const ami = ec2.MachineImage.lookup({
      name: "Deep Learning Base OSS Nvidia Driver GPU AMI (Ubuntu 22.04)*",
      owners: ["amazon"],
    });

    instanceSg.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(VLLM_PORT),
      "Allow NLB health checks and traffic"
    );

    // ----------------------------------------------------------------
    // NLB (Internal)
    // ----------------------------------------------------------------
    const nlbSg = new ec2.SecurityGroup(this, "NlbSecurityGroup", {
      vpc,
      description: "NLB security group for vLLM API",
      allowAllOutbound: false,
    });

    nlbSg.addEgressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(VLLM_PORT),
      "Allow traffic to vLLM targets"
    );

    const nlb = new elbv2.NetworkLoadBalancer(this, "Nlb", {
      vpc,
      internetFacing: false,
      crossZoneEnabled: true,
      securityGroups: [nlbSg],
    });

    // ----------------------------------------------------------------
    // Per-model: EC2 instance + NLB listener/target group
    // ----------------------------------------------------------------
    const instances: Record<string, ec2.Instance> = {};

    for (const cfg of MODEL_CONFIGS) {
      const userData = ec2.UserData.forLinux();
      const tpArg =
        cfg.tensorParallelSize > 1
          ? `--tensor-parallel-size ${cfg.tensorParallelSize}`
          : "";
      const extraArgs = [tpArg, cfg.extraVllmArgs].filter(Boolean).join(" ");

      userData.addCommands(
        "set -euxo pipefail",
        "pip install -U pip",
        "pip install vllm",
        `cat > /etc/systemd/system/vllm.service << 'EOF'`,
        "[Unit]",
        "Description=vLLM OpenAI-compatible server",
        "After=network.target",
        "",
        "[Service]",
        "Type=simple",
        "User=root",
        `Environment="HF_HOME=/opt/huggingface"`,
        ...(cfg.gated
          ? [`EnvironmentFile=-/etc/default/vllm`]
          : []),
        `ExecStart=/usr/local/bin/vllm serve ${cfg.modelId} --host 0.0.0.0 --port ${VLLM_PORT} --served-model-name ${cfg.servedModelName} --max-model-len ${cfg.maxModelLen} --gpu-memory-utilization 0.90 ${extraArgs}`,
        "Restart=always",
        "RestartSec=10",
        "",
        "[Install]",
        "WantedBy=multi-user.target",
        "EOF",
        ...(cfg.gated
          ? [
              `HF_TOKEN=$(aws ssm get-parameter --name /gennai/hf-token --with-decryption --query Parameter.Value --output text --region ${this.region})`,
              `echo "HF_TOKEN=$HF_TOKEN" > /etc/default/vllm`,
              "chmod 600 /etc/default/vllm",
            ]
          : []),
        "systemctl daemon-reload",
        "systemctl enable vllm",
        "systemctl start vllm"
      );

      // EC2 Instance (constructId keeps CloudFormation resource stable)
      const instance = new ec2.Instance(this, `VllmInstance-${cfg.constructId}`, {
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        instanceType: new ec2.InstanceType(cfg.instanceType),
        machineImage: ami,
        securityGroup: instanceSg,
        role: instanceRole,
        userData,
        blockDevices: [
          {
            deviceName: "/dev/sda1",
            volume: ec2.BlockDeviceVolume.ebs(cfg.ebsSizeGb, {
              volumeType: ec2.EbsDeviceVolumeType.GP3,
              encrypted: true,
            }),
          },
        ],
      });
      instances[cfg.constructId] = instance;

      // NLB Target Group + Listener (constructId keeps CloudFormation resource stable)
      const tg = new elbv2.NetworkTargetGroup(this, `VllmTg-${cfg.constructId}`, {
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

      // REST API VPC Link creates ENIs within AWS-managed network space,
      // not necessarily within VPC CIDR — use anyIpv4 for compatibility
      nlbSg.addIngressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(cfg.nlbListenerPort),
        `Allow API Gateway VPC Link traffic for ${cfg.routePrefix}`
      );

      nlb.addListener(`Listener-${cfg.constructId}`, {
        port: cfg.nlbListenerPort,
        defaultTargetGroups: [tg],
      });
    }

    // ----------------------------------------------------------------
    // API Gateway — REST API with Response Streaming
    // ----------------------------------------------------------------
    const api = new apigateway.RestApi(this, "LlmApi", {
      restApiName: "gennai-llm-api",
      description:
        "Multi-model OpenAI-compatible LLM API with SSE Streaming (Response Streaming)",
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
      apiKeySourceType: apigateway.ApiKeySourceType.HEADER,
      deployOptions: {
        stageName: "v1",
      },
    });

    const vpcLink = new apigateway.VpcLink(this, "VpcLink", {
      targets: [nlb],
      description: "VPC Link to internal NLB for vLLM",
    });

    // Per-model route: /{routePrefix}/{proxy+}
    for (const cfg of MODEL_CONFIGS) {
      const modelResource = api.root.addResource(cfg.routePrefix);

      const integration = new apigateway.Integration({
        type: apigateway.IntegrationType.HTTP_PROXY,
        integrationHttpMethod: "ANY",
        uri: `http://${nlb.loadBalancerDnsName}:${cfg.nlbListenerPort}/{proxy}`,
        options: {
          connectionType: apigateway.ConnectionType.VPC_LINK,
          vpcLink,
          requestParameters: {
            "integration.request.path.proxy": "method.request.path.proxy",
          },
          responseTransferMode: apigateway.ResponseTransferMode.STREAM,
        },
      });

      const proxyResource = modelResource.addProxy({
        anyMethod: true,
        defaultIntegration: integration,
        defaultMethodOptions: {
          apiKeyRequired: true,
          requestParameters: {
            "method.request.path.proxy": true,
          },
        },
      });

      // Health check on model root: GET /{routePrefix}/
      modelResource.addMethod(
        "GET",
        new apigateway.Integration({
          type: apigateway.IntegrationType.HTTP_PROXY,
          integrationHttpMethod: "GET",
          uri: `http://${nlb.loadBalancerDnsName}:${cfg.nlbListenerPort}/health`,
          options: {
            connectionType: apigateway.ConnectionType.VPC_LINK,
            vpcLink,
          },
        }),
        { apiKeyRequired: false }
      );
    }

    // Root health check — returns 200 OK (not tied to any specific model)
    api.root.addMethod(
      "GET",
      new apigateway.MockIntegration({
        requestTemplates: { "application/json": '{"statusCode": 200}' },
        integrationResponses: [
          {
            statusCode: "200",
            responseTemplates: {
              "application/json": '{"status":"ok","models":["gpt-oss-20b","llama-3.1-70b-ja"]}',
            },
          },
        ],
      }),
      {
        apiKeyRequired: false,
        methodResponses: [{ statusCode: "200" }],
      }
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

    for (const cfg of MODEL_CONFIGS) {
      new cdk.CfnOutput(this, `InstanceId-${cfg.constructId}`, {
        value: instances[cfg.constructId].instanceId,
        description: `EC2 Instance ID for ${cfg.servedModelName} (${cfg.instanceType})`,
      });
    }

    new cdk.CfnOutput(this, "TestCommands", {
      value: MODEL_CONFIGS.map(
        (cfg) =>
          `# ${cfg.servedModelName} (${cfg.instanceType}):\n` +
          `#   curl -N ${api.url}${cfg.routePrefix}/v1/chat/completions \\\n` +
          `#     -H 'Content-Type: application/json' \\\n` +
          `#     -H 'x-api-key: <YOUR_API_KEY>' \\\n` +
          `#     -d '{"model":"${cfg.servedModelName}","messages":[{"role":"user","content":"Hello"}],"stream":true}'`
      ).join("\n\n"),
      description: "Test commands for each model",
    });
  }
}
