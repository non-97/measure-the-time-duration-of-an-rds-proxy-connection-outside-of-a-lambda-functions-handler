import { getSecretValue } from "../utils/getSecretValue";
import { dbConnect } from "../utils/dbConnect";
import { QueryResult } from "../utils/table";

const secret = await getSecretValue();
const dbClient = await dbConnect(secret);

export const handler = async (): Promise<QueryResult | Error> => {
  // Query
  const beforeInsertQuery = await dbClient.query("SELECT * FROM test_table");
  console.log(beforeInsertQuery.rows);

  const insertQuery = await dbClient.query(
    "INSERT INTO test_table (name) VALUES ($1)",
    ["non-97"]
  );
  console.log(insertQuery.rows);

  const afterInsertQuery = await dbClient.query("SELECT * FROM test_table");
  console.log(afterInsertQuery.rows);

  return {
    beforeInsertQueryRows: beforeInsertQuery.rows,
    afterInsertQueryRows: afterInsertQuery.rows,
  };
};
