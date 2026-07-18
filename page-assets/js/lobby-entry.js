import { isExplicitLocalDemoEnabled } from "./app/local-demo-gate.js";

if (isExplicitLocalDemoEnabled()) {
  void import("./lobby.js?v=local-demo-sandbox-20260717");
} else {
  void import("./lobby-live.js?v=local-demo-sandbox-20260717");
}
