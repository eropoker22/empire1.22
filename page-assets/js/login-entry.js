import { CLIENT_EXECUTION_MODES, resolveClientEntryExecutionMode } from "./app/runtime/clientAuthorityState.js";

if (resolveClientEntryExecutionMode() === CLIENT_EXECUTION_MODES.localDemo) {
  void import("./login.js?v=local-demo-sandbox-20260717");
} else {
  void import("./login-live.js?v=local-demo-sandbox-20260717");
}
