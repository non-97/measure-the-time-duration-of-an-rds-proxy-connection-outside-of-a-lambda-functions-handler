import pg from "pg";
import { Secret } from "./secret";

export const dbConnect = async (secret: Secret): Promise<pg.Client> => {
  // DB Client
  const dbClient = new pg.Client({
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
