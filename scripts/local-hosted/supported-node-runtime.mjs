import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  evaluateSupportedNodeVersion,
  formatUnsupportedNodeMessage
} from "../supported-node-policy.mjs";

export const resolveSupportedNodeExecutable = () => {
  const candidates = [
    process.env.EMPIRE_NODE24_BIN,
    process.execPath,
    ...localNodeCandidates()
  ].filter(Boolean);
  for (const candidate of [...new Set(candidates.map((value) => path.resolve(value)))]) {
    if (!existsSync(candidate)) continue;
    try {
      const version = execFileSync(candidate, ["--version"], {
        encoding: "utf8",
        windowsHide: true
      }).trim();
      if (evaluateSupportedNodeVersion(version).supported) {
        return Object.freeze({ executable: candidate, version });
      }
    } catch {
      continue;
    }
  }
  throw new Error([
    formatUnsupportedNodeMessage(process.versions.node),
    "Local hosted supervisor also checked EMPIRE_NODE24_BIN and .tmp/node24, but no usable Node 24 executable was found."
  ].join("\n"));
};

const localNodeCandidates = () => {
  const root = path.resolve(".tmp/node24");
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name, process.platform === "win32" ? "node.exe" : "bin/node"));
};
