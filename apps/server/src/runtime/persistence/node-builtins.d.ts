declare const process: {
  env: Record<string, string | undefined>;
  pid: number;
  stdout: { write(message: string): void };
  exit(code?: number): never;
  once(event: "SIGTERM" | "SIGINT", listener: () => void): void;
  loadEnvFile?(path?: string): void;
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
  export function readdir(path: URL): Promise<string[]>;
  export function readFile(path: URL, encoding: "utf8"): Promise<string>;
}

declare module "node:http" {
  export interface IncomingMessage {
    url?: string;
    method?: string;
    headers: Record<string, string | string[] | undefined>;
    setEncoding(encoding: "utf8"): void;
    on(event: "data", listener: (chunk: string) => void): void;
    on(event: "end", listener: () => void): void;
    on(event: "error", listener: (error: Error) => void): void;
  }
  export interface ServerResponse {
    writeHead(status: number, headers?: Record<string, string>): ServerResponse;
    end(data?: string): void;
  }
  export interface Server {
    listen(port: number, host: string, callback?: () => void): void;
    close(callback: () => void): void;
  }
  export function createServer(handler: (request: IncomingMessage, response: ServerResponse) => void): Server;
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
    on(event: "error", listener: (error: Error) => void): this;
    query<TRow extends QueryResultRow = QueryResultRow>(
      sql: string,
      params?: readonly unknown[]
    ): Promise<QueryResult<TRow>>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }
}
