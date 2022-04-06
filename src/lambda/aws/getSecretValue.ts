import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { Secret } from "../aws/secret";

export const getSecretValue = async (): Promise<Secret> => {
  // console.log("getSecret");
  // console.log(process.env.AWS_REGION!);
  // console.log(SecretsManagerClient);
  const secretsManagerClient = new SecretsManagerClient({
    region: process.env.AWS_REGION!,
  });
  const getSecretValueCommand = new GetSecretValueCommand({
    SecretId: process.env.SECRET_ID,
  });
  const getSecretValueCommandResponse = await secretsManagerClient.send(
    getSecretValueCommand
  );
  // console.log(getSecretValueCommandResponse);
  return JSON.parse(getSecretValueCommandResponse.SecretString!);
};
