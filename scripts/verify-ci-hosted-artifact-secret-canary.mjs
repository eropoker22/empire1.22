import { createReadStream } from "node:fs";
import { lstat, open, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createInflateRaw } from "node:zlib";

export const CI_HOSTED_EPHEMERAL_SECRET_NAMES = Object.freeze([
  "GAMEPLAY_SLICE_SESSION_SECRET",
  "GAMEPLAY_SLICE_SNAPSHOT_SECRET",
  "EMPIRE_ADMIN_FINGERPRINT_SECRET",
  "EMPIRE_ADMIN_SESSION_SECRET",
  "EMPIRE_AUTH_THROTTLE_PEPPER",
  "EMPIRE_ADMIN_BOOTSTRAP_PASSWORD"
]);

const DEFAULT_ARTIFACT_ROOTS = Object.freeze([
  ".tmp/local-hosted-full",
  "artifacts"
]);
const ZIP_END_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_SIGNATURE = 0x04034b50;
const MAX_ZIP_TAIL_BYTES = 65_557;
const MAX_ZIP_CENTRAL_BYTES = 64 * 1024 * 1024;
const MAX_ZIP_ENTRY_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_ZIP_TOTAL_BYTES = 8 * 1024 * 1024 * 1024;
const CRC32_TABLE = Object.freeze(Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  return value >>> 0;
}));

export const scanCiHostedArtifactSecrets = async ({
  environment = process.env,
  roots = DEFAULT_ARTIFACT_ROOTS,
  baseDirectory = process.cwd()
} = {}) => {
  const secrets = resolveRequiredSecrets(environment);
  const result = {
    filesScanned: 0,
    zipEntriesScanned: 0,
    matches: []
  };
  const matchKeys = new Set();
  const recordMatch = (secretName, location) => {
    const safeLocation = sanitizeDiagnostic(location, secrets);
    const key = `${secretName}\0${safeLocation}`;
    if (matchKeys.has(key)) return;
    matchKeys.add(key);
    result.matches.push({ secretName, location: safeLocation });
  };

  for (const configuredRoot of roots) {
    const artifactRoot = path.resolve(baseDirectory, configuredRoot);
    for await (const artifactPath of walkArtifactRoot(artifactRoot)) {
      const relativePath = toDiagnosticPath(path.relative(baseDirectory, artifactPath));
      result.filesScanned += 1;
      await scanReadableForSecrets(createReadStream(artifactPath), secrets,
        (secretName) => recordMatch(secretName, relativePath));
      if (artifactPath.toLowerCase().endsWith(".zip")) {
        result.zipEntriesScanned += await scanZipArchive({
          artifactPath,
          diagnosticPath: relativePath,
          secrets,
          recordMatch
        });
      }
    }
  }
  return result;
};

const resolveRequiredSecrets = (environment) => {
  const secrets = CI_HOSTED_EPHEMERAL_SECRET_NAMES.map((name) => ({
    name,
    value: String(environment[name] ?? "")
  }));
  const missing = secrets.filter(({ value }) => !value).map(({ name }) => name);
  if (missing.length > 0) {
    throw new Error(`Required CI artifact canaries are unavailable: ${missing.join(", ")}.`);
  }
  if (new Set(secrets.map(({ value }) => value)).size !== secrets.length) {
    throw new Error("Required CI artifact canaries are not distinct.");
  }
  return secrets;
};

async function* walkArtifactRoot(root) {
  let rootStat;
  try {
    rootStat = await lstat(root);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  if (rootStat.isSymbolicLink()) throw new Error(`Artifact root is a symbolic link: ${root}`);
  if (rootStat.isFile()) {
    yield root;
    return;
  }
  if (!rootStat.isDirectory()) throw new Error(`Artifact root has an unsupported type: ${root}`);
  yield* walkArtifactDirectory(root);
}

async function* walkArtifactDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Artifact tree contains a symbolic link: ${entryPath}`);
    if (entry.isDirectory()) {
      yield* walkArtifactDirectory(entryPath);
    } else if (entry.isFile()) {
      yield entryPath;
    } else {
      throw new Error(`Artifact tree contains an unsupported entry: ${entryPath}`);
    }
  }
}

const scanReadableForSecrets = async (
  readable,
  secrets,
  onMatch,
  { maximumBytes = Number.POSITIVE_INFINITY, calculateCrc = false } = {}
) => {
  const needles = secrets.map(({ name, value }) => ({ name, bytes: Buffer.from(value, "utf8") }));
  const carryLength = Math.max(...needles.map(({ bytes }) => bytes.length)) - 1;
  const matched = new Set();
  let carry = Buffer.alloc(0);
  let bytesRead = 0;
  let crc = 0xffffffff;
  for await (const rawChunk of readable) {
    const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
    bytesRead += chunk.length;
    if (bytesRead > maximumBytes) throw new Error("Artifact archive entry exceeded its declared size.");
    if (calculateCrc) {
      for (const byte of chunk) crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff];
    }
    const searchable = carry.length ? Buffer.concat([carry, chunk]) : chunk;
    for (const { name, bytes } of needles) {
      if (!matched.has(name) && searchable.indexOf(bytes) !== -1) {
        matched.add(name);
        onMatch(name);
      }
    }
    carry = carryLength > 0
      ? Buffer.from(searchable.subarray(Math.max(0, searchable.length - carryLength)))
      : Buffer.alloc(0);
  }
  return { bytesRead, crc32: calculateCrc ? (crc ^ 0xffffffff) >>> 0 : null };
};

const scanZipArchive = async ({ artifactPath, diagnosticPath, secrets, recordMatch }) => {
  const archive = await open(artifactPath, "r");
  try {
    const archiveSize = (await archive.stat()).size;
    const tailSize = Math.min(archiveSize, MAX_ZIP_TAIL_BYTES);
    const tail = await readExactly(archive, tailSize, archiveSize - tailSize);
    const endOffset = findZipEndOffset(tail);
    if (endOffset < 0) throw new Error(`Artifact ZIP has no valid end record: ${diagnosticPath}`);
    const diskNumber = tail.readUInt16LE(endOffset + 4);
    const centralDisk = tail.readUInt16LE(endOffset + 6);
    const entriesOnDisk = tail.readUInt16LE(endOffset + 8);
    const entryCount = tail.readUInt16LE(endOffset + 10);
    const centralSize = tail.readUInt32LE(endOffset + 12);
    const centralOffset = tail.readUInt32LE(endOffset + 16);
    if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) {
      throw new Error(`Artifact ZIP uses unsupported multi-disk layout: ${diagnosticPath}`);
    }
    if (centralSize === 0xffffffff || centralOffset === 0xffffffff || entryCount === 0xffff) {
      throw new Error(`Artifact ZIP64 layout is unsupported: ${diagnosticPath}`);
    }
    if (centralSize > MAX_ZIP_CENTRAL_BYTES || centralOffset + centralSize > archiveSize) {
      throw new Error(`Artifact ZIP central directory is unsafe: ${diagnosticPath}`);
    }
    const central = await readExactly(archive, centralSize, centralOffset);
    const entries = parseCentralEntries(central, entryCount, diagnosticPath);
    const totalBytes = entries.reduce((sum, entry) => sum + entry.uncompressedSize, 0);
    if (entries.some(({ uncompressedSize }) => uncompressedSize > MAX_ZIP_ENTRY_BYTES)
      || totalBytes > MAX_ZIP_TOTAL_BYTES) {
      throw new Error(`Artifact ZIP expands beyond the safety budget: ${diagnosticPath}`);
    }
    for (const entry of entries) {
      if (entry.name.endsWith("/") || entry.uncompressedSize === 0) continue;
      await scanZipEntry({ archive, archiveSize, artifactPath, entry, diagnosticPath, secrets, recordMatch });
    }
    return entries.filter(({ name, uncompressedSize }) => !name.endsWith("/") && uncompressedSize > 0).length;
  } finally {
    await archive.close();
  }
};

const findZipEndOffset = (tail) => {
  for (let offset = tail.length - 22; offset >= 0; offset -= 1) {
    if (tail.readUInt32LE(offset) !== ZIP_END_SIGNATURE) continue;
    const commentLength = tail.readUInt16LE(offset + 20);
    if (offset + 22 + commentLength === tail.length) return offset;
  }
  return -1;
};

const parseCentralEntries = (central, entryCount, diagnosticPath) => {
  const entries = [];
  let offset = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > central.length || central.readUInt32LE(offset) !== ZIP_CENTRAL_SIGNATURE) {
      throw new Error(`Artifact ZIP central entry is invalid: ${diagnosticPath}`);
    }
    const flags = central.readUInt16LE(offset + 8);
    const method = central.readUInt16LE(offset + 10);
    const crc32 = central.readUInt32LE(offset + 16);
    const compressedSize = central.readUInt32LE(offset + 20);
    const uncompressedSize = central.readUInt32LE(offset + 24);
    const nameLength = central.readUInt16LE(offset + 28);
    const extraLength = central.readUInt16LE(offset + 30);
    const commentLength = central.readUInt16LE(offset + 32);
    const localOffset = central.readUInt32LE(offset + 42);
    const entryEnd = offset + 46 + nameLength + extraLength + commentLength;
    if (entryEnd > central.length || compressedSize === 0xffffffff
      || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) {
      throw new Error(`Artifact ZIP entry requires unsupported ZIP64 metadata: ${diagnosticPath}`);
    }
    if ((flags & 1) !== 0 || ![0, 8].includes(method)) {
      throw new Error(`Artifact ZIP entry uses unsupported encryption or compression: ${diagnosticPath}`);
    }
    const encoding = (flags & 0x0800) !== 0 ? "utf8" : "latin1";
    const name = central.subarray(offset + 46, offset + 46 + nameLength).toString(encoding);
    entries.push({ name, flags, method, crc32, compressedSize, uncompressedSize, localOffset });
    offset = entryEnd;
  }
  if (offset !== central.length) throw new Error(`Artifact ZIP central directory is ambiguous: ${diagnosticPath}`);
  return entries;
};

const scanZipEntry = async ({ archive, archiveSize, artifactPath, entry, diagnosticPath, secrets, recordMatch }) => {
  const local = await readExactly(archive, 30, entry.localOffset);
  if (local.readUInt32LE(0) !== ZIP_LOCAL_SIGNATURE
    || local.readUInt16LE(6) !== entry.flags
    || local.readUInt16LE(8) !== entry.method) {
    throw new Error(`Artifact ZIP local entry is inconsistent: ${diagnosticPath}`);
  }
  const dataOffset = entry.localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
  if (dataOffset + entry.compressedSize > archiveSize) {
    throw new Error(`Artifact ZIP entry exceeds the archive boundary: ${diagnosticPath}`);
  }
  if (entry.method === 0 && entry.compressedSize !== entry.uncompressedSize) {
    throw new Error(`Stored artifact ZIP entry has inconsistent size: ${diagnosticPath}`);
  }
  if (entry.compressedSize === 0) {
    throw new Error(`Artifact ZIP entry has missing compressed data: ${diagnosticPath}`);
  }
  const compressed = createReadStream(artifactPath, {
    start: dataOffset,
    end: dataOffset + entry.compressedSize - 1
  });
  const readable = entry.method === 8 ? compressed.pipe(createInflateRaw()) : compressed;
  const entryLocation = `${diagnosticPath}!/${toDiagnosticPath(entry.name)}`;
  const scanned = await scanReadableForSecrets(readable, secrets,
    (secretName) => recordMatch(secretName, entryLocation), {
      maximumBytes: entry.uncompressedSize,
      calculateCrc: true
    });
  if (scanned.bytesRead !== entry.uncompressedSize || scanned.crc32 !== entry.crc32) {
    throw new Error(`Artifact ZIP entry failed its integrity check: ${diagnosticPath}`);
  }
};

const readExactly = async (file, length, position) => {
  const buffer = Buffer.alloc(length);
  let totalBytesRead = 0;
  while (totalBytesRead < length) {
    const { bytesRead } = await file.read(
      buffer,
      totalBytesRead,
      length - totalBytesRead,
      position + totalBytesRead
    );
    if (bytesRead === 0) throw new Error("Artifact archive ended unexpectedly.");
    totalBytesRead += bytesRead;
  }
  return buffer;
};

const toDiagnosticPath = (value) => String(value).replaceAll(path.sep, "/").replace(/[\r\n\t]/gu, "?");

const sanitizeDiagnostic = (value, secrets) => {
  let safe = toDiagnosticPath(value);
  for (const { name, value: secret } of secrets) safe = safe.replaceAll(secret, `<${name}>`);
  return safe;
};

const runCli = async () => {
  try {
    const result = await scanCiHostedArtifactSecrets();
    if (result.matches.length > 0) {
      console.error(`[ci-hosted-secret-canary] BLOCKED ${result.matches.length} secret occurrence(s) in hosted artifacts.`);
      for (const { secretName, location } of result.matches.slice(0, 50)) {
        console.error(`[ci-hosted-secret-canary] ${secretName}: ${location}`);
      }
      if (result.matches.length > 50) console.error("[ci-hosted-secret-canary] Additional matches were suppressed.");
      process.exitCode = 1;
      return;
    }
    console.log(`[ci-hosted-secret-canary] PASS: ${result.filesScanned} files and ${result.zipEntriesScanned} ZIP entries scanned.`);
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error);
    try {
      message = sanitizeDiagnostic(message, resolveRequiredSecrets(process.env));
    } catch {
      message = "Required canaries were unavailable or the artifact scan could not complete safely.";
    }
    console.error(`[ci-hosted-secret-canary] BLOCKED: ${message}`);
    process.exitCode = 1;
  }
};

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await runCli();
}
