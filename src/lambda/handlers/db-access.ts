import { getSecretValue } from "../aws/getSecretValue";
import { dbConnect } from "../aws/dbConnect";

const secret = await getSecretValue();

const dbClient = await dbConnect(secret);

export const handler = async (): Promise<void | Error> => {
  // Query
  const beforeInsertQuery = await dbClient.query("SELECT * FROM test_table");
  console.log(beforeInsertQuery.rows);
  return;
};
