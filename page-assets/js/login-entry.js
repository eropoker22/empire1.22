import { isExplicitLocalDemoEnabled } from "./app/local-demo-gate.js";

if (isExplicitLocalDemoEnabled()) {
  void import("./login.js?v=local-demo-sandbox-20260717");
} else {
  void import("./login-live.js?v=local-demo-sandbox-20260717");
}
