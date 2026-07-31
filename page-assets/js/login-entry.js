import { resolveClientEntryExecutionMode } from "./app/runtime/clientAuthorityState.js";

resolveClientEntryExecutionMode({ localDemoEnabled: false });
void import("./login-live.js?v=20260731-live-only");
