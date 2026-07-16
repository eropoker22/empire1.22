export interface NetlifyFunctionResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export const createJsonResponse = <TBody>(
  statusCode: number,
  body: TBody | null,
  headers: Record<string, string> = {}
): NetlifyFunctionResponse => ({
  statusCode,
  headers: {
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "content-type": "application/json; charset=utf-8",
    ...headers
  },
  body: body ? JSON.stringify(body) : ""
});
