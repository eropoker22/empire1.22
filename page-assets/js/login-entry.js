import { CLIENT_EXECUTION_MODES, resolveClientEntryExecutionMode } from "./app/runtime/clientAuthorityState.js";

if (resolveClientEntryExecutionMode() === CLIENT_EXECUTION_MODES.localDemo) {
  void import("./login.js?v=20260726-defeat-preview-removed");
} else {
  void import("./login-live.js?v=20260726-defeat-preview-removed");
}
