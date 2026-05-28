declare const process: {
  env: Record<string, string | undefined>;
  pid: number;
};

declare module "node:fs" {
  export const promises: {
    mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
    appendFile(path: string, data: string, encoding?: string): Promise<void>;
    readFile(path: string, encoding: string): Promise<string>;
    writeFile(path: string, data: string, encoding?: string): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
  };
}

declare module "node:fs/promises" {
  export function mkdtemp(prefix: string): Promise<string>;
  export function rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
}

declare module "node:child_process" {
  export function execFile(
    file: string,
    args: string[],
    options: { cwd?: string; maxBuffer?: number },
    callback: (error: Error | null, stdout: string, stderr: string) => void
  ): void;
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
}

declare module "node:os" {
  export function tmpdir(): string;
}

declare module "pg" {
  export interface QueryResultRow {
    [column: string]: unknown;
  }

  export interface QueryResult<TRow extends QueryResultRow = QueryResultRow> {
    rows: TRow[];
    rowCount: number | null;
    command: string;
    oid: number;
    fields: unknown[];
  }

  export interface PoolClient {
    query<TRow extends QueryResultRow = QueryResultRow>(
      sql: string,
      params?: readonly unknown[]
    ): Promise<QueryResult<TRow>>;
    release(): void;
  }

  export class Pool {
    constructor(options: { connectionString: string });
    query<TRow extends QueryResultRow = QueryResultRow>(
      sql: string,
      params?: readonly unknown[]
    ): Promise<QueryResult<TRow>>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }
}
