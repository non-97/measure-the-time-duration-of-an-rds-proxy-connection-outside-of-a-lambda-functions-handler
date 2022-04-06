import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { Secret } from "../aws/secret";

export const getSecretValue = async (): Promise<Secret> => {
  const secretsManagerClient = new SecretsManagerClient({
    region: process.env.AWS_REGION!,
  });
  const getSecretValueCommand = new GetSecretValueCommand({
    SecretId: process.env.SECRET_ID,
  });
  const getSecretValueCommandResponse = await secretsManagerClient.send(
    getSecretValueCommand
  );
  return JSON.parse(getSecretValueCommandResponse.SecretString!);
};
