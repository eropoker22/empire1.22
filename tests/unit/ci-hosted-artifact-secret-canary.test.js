import { deflateRawSync } from "node:zlib";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  CI_HOSTED_EPHEMERAL_SECRET_NAMES,
  scanCiHostedArtifactSecrets
} from "../../scripts/verify-ci-hosted-artifact-secret-canary.mjs";

const temporaryDirectories = [];
const createTemporaryDirectory = async () => {
  const directory = await mkdtemp(join(tmpdir(), "streets-secret-canary-"));
  temporaryDirectories.push(directory);
  return directory;
};
const createSecrets = () => Object.fromEntries(CI_HOSTED_EPHEMERAL_SECRET_NAMES.map((name, index) => [
  name,
  `ci-canary-${index}-${String(index).repeat(30)}`
]));

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("CI hosted artifact secret canary", () => {
  it("accepts clean plain artifacts and scans deflated Playwright-style ZIP entries", async () => {
    const directory = await createTemporaryDirectory();
    await mkdir(join(directory, ".tmp/local-hosted-full"), { recursive: true });
    await writeFile(join(directory, ".tmp/local-hosted-full/runtime.log"), "safe diagnostic\n", "utf8");
    await writeFile(join(directory, ".tmp/local-hosted-full/trace.zip"), createZip("0-trace.trace", "safe trace\n"));

    const result = await scanCiHostedArtifactSecrets({ environment: createSecrets(), baseDirectory: directory });

    expect(result.matches).toEqual([]);
    expect(result.filesScanned).toBe(2);
    expect(result.zipEntriesScanned).toBe(1);
  });

  it("detects canaries in plain logs and compressed trace entries without returning their values", async () => {
    const directory = await createTemporaryDirectory();
    const environment = createSecrets();
    const [plainName, zipName] = CI_HOSTED_EPHEMERAL_SECRET_NAMES;
    await mkdir(join(directory, ".tmp/local-hosted-full"), { recursive: true });
    await mkdir(join(directory, "artifacts/hosted-acceptance"), { recursive: true });
    await writeFile(join(directory, ".tmp/local-hosted-full/api.log"), `failure=${environment[plainName]}\n`, "utf8");
    await writeFile(join(directory, "artifacts/hosted-acceptance/trace.zip"),
      createZip("0-trace.trace", `fill=${environment[zipName]}\n`));

    const result = await scanCiHostedArtifactSecrets({ environment, baseDirectory: directory });
    const serialized = JSON.stringify(result);

    expect(result.matches.map(({ secretName }) => secretName)).toEqual(expect.arrayContaining([plainName, zipName]));
    expect(result.matches.some(({ location }) => location.includes("0-trace.trace"))).toBe(true);
    for (const secret of Object.values(environment)) expect(serialized).not.toContain(secret);
  });

  it("fails closed when a ZIP artifact cannot be inspected", async () => {
    const directory = await createTemporaryDirectory();
    await mkdir(join(directory, "artifacts"), { recursive: true });
    await writeFile(join(directory, "artifacts/broken.zip"), "not-a-zip", "utf8");

    await expect(scanCiHostedArtifactSecrets({ environment: createSecrets(), baseDirectory: directory }))
      .rejects.toThrow(/ZIP has no valid end record/u);
  });

  it("fails closed when any required ephemeral secret is unavailable", async () => {
    const environment = createSecrets();
    delete environment[CI_HOSTED_EPHEMERAL_SECRET_NAMES[0]];

    await expect(scanCiHostedArtifactSecrets({ environment, roots: [] }))
      .rejects.toThrow(/Required CI artifact canaries are unavailable/u);
  });
});

const createZip = (entryName, contents) => {
  const name = Buffer.from(entryName, "utf8");
  const source = Buffer.from(contents, "utf8");
  const compressed = deflateRawSync(source);
  const crc = crc32(source);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(source.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(source.length, 24);
  central.writeUInt16LE(name.length, 28);
  const centralOffset = local.length + name.length + compressed.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([local, name, compressed, central, name, end]);
};

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
};
