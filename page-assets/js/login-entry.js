import { isExplicitLocalDemoEnabled } from "./app/local-demo-gate.js";

if (isExplicitLocalDemoEnabled()) {
  void import("./login.js");
} else {
  void import("./login-live.js");
}
