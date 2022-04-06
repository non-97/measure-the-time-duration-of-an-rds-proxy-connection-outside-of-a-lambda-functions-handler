export interface Secret {
  dbClusterIdentifier: string;
  password: string;
  dbname: string;
  engine: string;
  port: number;
  host: string;
  username: string;
}
