export const LOCAL_HOSTED_HTTP_KEEP_ALIVE_TIMEOUT_MS = 15_000;
export const LOCAL_HOSTED_HTTP_HEADERS_TIMEOUT_MS = LOCAL_HOSTED_HTTP_KEEP_ALIVE_TIMEOUT_MS + 5_000;

export interface LocalHostedHttpTimingTarget {
  keepAliveTimeout: number;
  headersTimeout: number;
}

export const applyLocalHostedHttpTiming = <Server extends LocalHostedHttpTimingTarget>(server: Server): Server => {
  server.keepAliveTimeout = LOCAL_HOSTED_HTTP_KEEP_ALIVE_TIMEOUT_MS;
  server.headersTimeout = LOCAL_HOSTED_HTTP_HEADERS_TIMEOUT_MS;
  return server;
};
