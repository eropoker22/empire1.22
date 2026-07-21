import { CLIENT_EXECUTION_MODES, resolveClientEntryExecutionMode } from "./app/runtime/clientAuthorityState.js";

if (resolveClientEntryExecutionMode() === CLIENT_EXECUTION_MODES.localDemo) {
  void import("./faction.js");
} else {
  void import("./faction-live.js");
}
