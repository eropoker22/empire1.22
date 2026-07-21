import { CLIENT_EXECUTION_MODES, resolveClientEntryExecutionMode } from "./app/runtime/clientAuthorityState.js";

if (resolveClientEntryExecutionMode() === CLIENT_EXECUTION_MODES.localDemo) {
  void import("./lobby.js?v=local-demo-sandbox-20260717");
} else {
  void import("./lobby-live.js?v=local-demo-sandbox-20260717");
}
