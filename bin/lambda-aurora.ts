#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { LambdaAuroraStack } from "../lib/lambda-aurora-stack";

const app = new cdk.App();
new LambdaAuroraStack(app, "LambdaAuroraStack");
