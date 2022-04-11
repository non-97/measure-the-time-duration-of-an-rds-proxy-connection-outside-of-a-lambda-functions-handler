import { getSecretValue } from "../utils/getSecretValue";
import { dbConnect } from "../utils/dbConnect";
import { QueryResult } from "../utils/table";

const secret = await getSecretValue();

export const handler = async (): Promise<QueryResult | Error> => {
  const dbClient = await dbConnect(secret);

  // Query
  const beforeInsertQuery = await dbClient.query("SELECT * FROM test_table");
  console.log(beforeInsertQuery.rows);

  await dbClient.query("INSERT INTO test_table (name) VALUES ('non-97')");

  const afterInsertQuery = await dbClient.query("SELECT * FROM test_table");
  console.log(afterInsertQuery.rows);

  dbClient.end();

  return {
    beforeInsertQueryRows: beforeInsertQuery.rows,
    afterInsertQueryRows: afterInsertQuery.rows,
  };
};
