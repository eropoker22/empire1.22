import { readFile } from "node:fs/promises";
import { isExplicitLocalDemoEnabled } from "../page-assets/js/app/local-demo-gate.js";

const root = new URL("../", import.meta.url);
const checks = [];
const failures = [];
const check = (condition, label) => {
  const passed = Boolean(condition);
  checks.push({ passed, label });
  if (!passed) failures.push(label);
};
const source = async (path) => readFile(new URL(path, root), "utf8");

const publicStorage = createMemoryStorage({ "empire:local-demo-session:v1": "1" });
check(isExplicitLocalDemoEnabled({
  locationRef: { hostname: "empirestreets.cz", search: "?runtimeMode=local-demo" },
  configOverrides: { localDemoEnabled: true },
  sessionStorageRef: publicStorage
}) === false, "public hostname cannot activate local demo");
check(publicStorage.getItem("empire:local-demo-session:v1") === null, "public hostname clears stale demo session");
check(isExplicitLocalDemoEnabled({
  locationRef: { hostname: "localhost", search: "?runtimeMode=local-demo" },
  sessionStorageRef: createMemoryStorage()
}) === true, "loopback explicit local demo remains available");

const [gameHtml, appSource, loginLive, lobbyLive, factionLive, entryNetlify, cookieSource, registrationPolicy, registrationRequest] = await Promise.all([
  source("pages/game.html"),
  source("page-assets/js/app.js"),
  source("page-assets/js/login-live.js"),
  source("page-assets/js/lobby-live.js"),
  source("page-assets/js/faction-live.js"),
  source("apps/server/src/player-entry/player-entry-netlify.ts"),
  source("apps/server/src/player-entry/player-account-cookie.ts"),
  source("apps/server/src/player-entry/account-registration-policy.ts"),
  source("apps/server/src/player-entry/account-registration-request.ts")
]);
check(gameHtml.includes("data-game-authority-gate") && gameHtml.includes("PŘIPOJUJI SERVER"), "game shell starts behind an honest authority gate");
check(!gameHtml.includes(">20/20<") && !gameHtml.includes(">Host<") && !gameHtml.includes(">Guest Crew<"), "game shell does not expose live-looking seed state");
check(appSource.includes("loadLobbyOverview") && appSource.includes("mountLiveGameplayClient"), "live game boot requires lobby membership and gameplay slice");
check(!appSource.includes("app-demo.js"), "live game module has no demo fallback import");
check(loginLive.includes("loadAccountRegistrationPolicy") && loginLive.includes("accountSession"), "login uses live registration policy and account session");
check(loginLive.includes("passwordConfirmation") && loginLive.includes("dateOfBirth") && !loginLive.includes("inviteCode"),
  "login registration requires date of birth and password confirmation without invite data");
check(lobbyLive.includes("loadLobbyOverview"), "lobby uses live overview");
check(factionLive.includes("loadLobbyOverview") && factionLive.includes("finalizeServerSetup"), "faction setup uses live membership");
check(entryNetlify.includes('driver === "postgres"') && !entryNetlify.includes("createInMemory"), "player entry production bootstrap is PostgreSQL-only");
check(cookieSource.includes('"HttpOnly"') && cookieSource.includes('"SameSite=Strict"') && cookieSource.includes('"Path=/"'), "account cookie is HttpOnly, strict same-site and path scoped");
check(cookieSource.includes('environment.NODE_ENV === "production" ? "Secure"'), "account cookie is Secure in production");
check(!registrationPolicy.includes("INVITE_CODE") && registrationPolicy.includes("minimumAgeYears"),
  "public registration policy has no invite authority and exposes the minimum age");
check(registrationRequest.includes("ACCOUNT_REGISTRATION_MINIMUM_AGE_YEARS = 16")
  && registrationRequest.includes("ACCOUNT_PASSWORD_CONFIRMATION_MISMATCH"),
"registration enforces age 16 and matching passwords on the server");

const strict = process.env.NODE_ENV === "production" || process.env.EMPIRE_PRODUCTION_AUTHORITY_PREFLIGHT_STRICT === "1";
if (strict) {
  const env = process.env;
  const registrationEnabled = env.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED === "true";
  const throttlePepper = String(env.EMPIRE_AUTH_THROTTLE_PEPPER ?? "").trim();
  const origins = String(env.EMPIRE_ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const databaseUrl = String(env.EMPIRE_DATABASE_URL ?? env.GAMEPLAY_DATABASE_URL ?? "").trim();
  check(env.EMPIRE_PERSISTENCE_DRIVER === "postgres", "runtime persistence is PostgreSQL");
  check(env.GAMEPLAY_PERSISTENCE_DRIVER === "postgres", "gameplay persistence is PostgreSQL");
  check(isTlsPostgresUrl(databaseUrl), "production database URL uses PostgreSQL TLS");
  check(origins.length > 0 && origins.every(isSecureOrigin), "origin allowlist is explicit and secure");
  check(String(env.GAMEPLAY_SLICE_SESSION_SECRET ?? "").length >= 32, "gameplay session secret is strong");
  check(Boolean(env.EMPIRE_HOSTED_WORKER_ID), "hosted worker identity is configured");
  check(/^[0-9a-f]{40}$/u.test(String(env.EMPIRE_BUILD_SHA ?? "")), "release build SHA is exact");
  if (registrationEnabled) {
    check(throttlePepper.length >= 32, "public account registration has durable throttle pepper");
  } else {
    check(true, "account registration is safely closed");
  }
}

for (const result of checks) console.log(`${result.passed ? "PASS" : "FAIL"} ${result.label}`);
if (failures.length) {
  console.error(`Production authority cutover preflight failed (${failures.length} checks).`);
  process.exitCode = 1;
} else {
  console.log(`Production authority cutover preflight passed (${checks.length} checks${strict ? ", strict production mode" : ", code-level mode"}).`);
}

function createMemoryStorage(seed = {}) {
  const state = new Map(Object.entries(seed));
  return {
    getItem: (key) => state.get(key) ?? null,
    setItem: (key, value) => state.set(key, String(value)),
    removeItem: (key) => state.delete(key)
  };
}

function isSecureOrigin(candidate) {
  if (candidate === "*") return false;
  try {
    const url = new URL(candidate);
    return url.origin === candidate && url.protocol === "https:";
  } catch {
    return false;
  }
}

function isTlsPostgresUrl(candidate) {
  try {
    const url = new URL(candidate);
    return ["postgres:", "postgresql:"].includes(url.protocol)
      && ["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode"));
  } catch {
    return false;
  }
}
