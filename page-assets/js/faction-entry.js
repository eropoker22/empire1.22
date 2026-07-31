import { resolveClientEntryExecutionMode } from "./app/runtime/clientAuthorityState.js";

resolveClientEntryExecutionMode({ localDemoEnabled: false });
void import("./faction-live.js?v=20260731-live-only");
