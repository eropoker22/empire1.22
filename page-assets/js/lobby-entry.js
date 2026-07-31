import { resolveClientEntryExecutionMode } from "./app/runtime/clientAuthorityState.js";

resolveClientEntryExecutionMode({ localDemoEnabled: false });
void import("./lobby-live.js?v=20260731-live-only");
