const INLINE_SOURCE_MAP_PATTERN = /\n?\/\/# sourceMappingURL=data:application\/json;base64,[A-Za-z0-9+/=]+\s*$/u;
const RAW_MODULE_PREFIX = "export default ";

export const decodeViteRawSourceAsset = (body, contentType = "") => {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const moduleSource = buffer.toString("utf8").replace(INLINE_SOURCE_MAP_PATTERN, "");
  if (!moduleSource.startsWith(RAW_MODULE_PREFIX)) {
    if (!String(contentType).toLowerCase().includes("javascript")) return buffer;
    throw new Error("Vite raw source response did not use the expected export-default module contract.");
  }

  let decoded;
  try {
    decoded = JSON.parse(moduleSource.slice(RAW_MODULE_PREFIX.length));
  } catch (_error) {
    throw new Error("Vite raw source response contained an invalid JSON string payload.");
  }
  if (typeof decoded !== "string") {
    throw new Error("Vite raw source response did not contain a string payload.");
  }
  return Buffer.from(decoded, "utf8");
};

export const fetchServedSourceAsset = async (url, fetchImplementation = fetch) => {
  const response = await fetchImplementation(url, {
    cache: "no-store",
    headers: { accept: "text/css,*/*;q=0.1" }
  });
  if (!response.ok) {
    throw new Error(`Served source asset ${url} returned HTTP ${response.status}.`);
  }
  return decodeViteRawSourceAsset(
    Buffer.from(await response.arrayBuffer()),
    response.headers.get("content-type") ?? ""
  );
};
