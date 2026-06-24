const REQUIRED_MAJOR = 20;

const version = process.versions.node;
const major = Number.parseInt(version.split(".")[0] || "", 10);

if (!Number.isFinite(major) || major < REQUIRED_MAJOR) {
  console.error([
    `Empire Streets requires Node >=${REQUIRED_MAJOR}.`,
    `Detected Node ${version}.`,
    "Use the repo .nvmrc/.node-version value (20) before running dev, E2E, or browser smoke commands.",
    "Examples: nvm use, fnm use, volta install node@20, or install Node 20 through your normal local toolchain."
  ].join("\n"));
  process.exit(1);
}
