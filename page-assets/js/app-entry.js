import { isExplicitLocalDemoEnabled } from "./app/local-demo-gate.js";

if (isExplicitLocalDemoEnabled()) {
  void import("./app-demo.js?v=game-preview-access-20260717");
} else {
  void import("./app.js?v=game-preview-access-20260717");
}
