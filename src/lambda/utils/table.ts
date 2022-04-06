export interface TableColumn {
  id: number;
  name: string;
  created_at: string;
}

export interface QueryResult {
  beforeInsertQueryRows: TableColumn[];
  afterInsertQueryRows: TableColumn[];
}
