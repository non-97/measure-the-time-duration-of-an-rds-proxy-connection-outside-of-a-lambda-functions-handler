import pg from "pg";
import { Secret } from "../aws/secret";

const { Client } = pg;

export const dbConnect = async (secret: Secret): Promise<Client> => {
  // DB Client
  const dbClient = new Client({
    user: secret.username,
    host: process.env.PROXY_ENDPOINT,
    database: secret.dbname,
    password: secret.password,
    port: secret.port,
    ssl: true,
  });

  // DB Connect
  await dbClient.connect();

  return dbClient;
};
