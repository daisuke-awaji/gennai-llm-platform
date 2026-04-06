#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { GennaiLlmStack } from "../lib/gennai-llm-stack";

const app = new cdk.App();
new GennaiLlmStack(app, "GennaiLlmStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

