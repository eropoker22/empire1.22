import { assertSupportedNodeVersion } from "./supported-node-policy.mjs";

try {
  assertSupportedNodeVersion(process.versions.node);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
