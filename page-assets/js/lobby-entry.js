import { isExplicitLocalDemoEnabled } from "./app/local-demo-gate.js";

if (isExplicitLocalDemoEnabled()) {
  void import("./lobby.js");
} else {
  void import("./lobby-live.js");
}
