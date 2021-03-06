import { getSecretValue } from "../utils/getSecretValue";
import { dbConnect } from "../utils/dbConnect";
import { QueryResult } from "../utils/table";

const secret = await getSecretValue();
const dbClient = await dbConnect(secret);

export const handler = async (): Promise<QueryResult | Error> => {
  // Query
  const beforeInsertQuery = await dbClient.query("SELECT * FROM test_table");
  console.log(beforeInsertQuery.rows);

  await dbClient.query("INSERT INTO test_table (name) VALUES ('non-97')");

  const afterInsertQuery = await dbClient.query("SELECT * FROM test_table");
  console.log(afterInsertQuery.rows);

  return {
    beforeInsertQueryRows: beforeInsertQuery.rows,
    afterInsertQueryRows: afterInsertQuery.rows,
  };
};
