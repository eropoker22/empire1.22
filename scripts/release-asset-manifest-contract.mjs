import { createHash } from "node:crypto";

export const RELEASE_ASSET_TARGETS = Object.freeze([
  ["admin.html", "client/admin.html", "/admin.html", "revalidate"],
  ["pages/login.html", "client/pages/login.html", "/pages/login.html", "revalidate"],
  ["pages/lobby.html", "client/pages/lobby.html", "/pages/lobby.html", "revalidate"],
  ["pages/game.html", "client/pages/game.html", "/pages/game.html", "revalidate"],
  ["page-assets/css/styles.css", "client/page-assets/css/styles.css", "/page-assets/css/styles.css", "revalidate"],
  ["page-assets/css/styles-mobile-fixes.css", "client/page-assets/css/styles-mobile-fixes.css", "/page-assets/css/styles-mobile-fixes.css", "revalidate"],
  ["page-assets/js/client-assets/gameplay-slice-client.js", "client/page-assets/js/client-assets/gameplay-slice-client.js", "/page-assets/js/client-assets/gameplay-slice-client.js", "revalidate"],
  ["img/logmes.png", "client/img/logmes.png", "/img/logmes.png", "revalidate"]
]);

export const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");

export const createReleaseAssetEntry = ({ sourcePath, buildPath, publicPath, cachePolicy, source, build }) => ({
  sourcePath,
  buildPath,
  publicPath,
  cachePolicy,
  sourceHash: sha256Hex(source),
  buildHash: sha256Hex(build),
  bytes: build.byteLength
});
