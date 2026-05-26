export interface NetlifyFunctionResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export const createJsonResponse = <TBody>(
  statusCode: number,
  body: TBody | null
): NetlifyFunctionResponse => ({
  statusCode,
  headers: {
    "access-control-allow-headers": "content-type, x-empire-admin-token",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "content-type": "application/json; charset=utf-8"
  },
  body: body ? JSON.stringify(body) : ""
});
