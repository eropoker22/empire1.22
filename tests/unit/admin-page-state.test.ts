/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureAdminPageState,
  restoreAdminPageState
} from "../../apps/admin/src/app/admin-app-dom";

describe("admin page disclosure state", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  });

  it("restores matching disclosures without closing newly rendered default-open sections", () => {
    const root = document.createElement("main");
    root.innerHTML = `
      <details id="admin-builds"><summary>Buildy</summary></details>
      <details><summary>Provoz</summary></details>
    `;
    const snapshot = captureAdminPageState(root);

    root.innerHTML = `
      <details id="admin-players" open><summary>Hráči</summary></details>
      <details><summary>Provoz</summary></details>
      <details id="admin-builds" open><summary>Buildy</summary></details>
    `;
    restoreAdminPageState(root, snapshot);

    expect(root.querySelector<HTMLDetailsElement>("#admin-players")?.open).toBe(true);
    expect(root.querySelector<HTMLDetailsElement>("#admin-builds")?.open).toBe(false);
    expect(root.querySelectorAll<HTMLDetailsElement>("details")[1]?.open).toBe(false);
  });

  it("preserves both open and closed states by identity when sections reorder", () => {
    const root = document.createElement("main");
    root.innerHTML = `
      <details id="admin-players" open><summary>Hráči</summary></details>
      <details id="admin-map"><summary>Mapa</summary></details>
    `;
    const snapshot = captureAdminPageState(root);

    root.innerHTML = `
      <details id="admin-map" open><summary>Mapa</summary></details>
      <details id="admin-players"><summary>Hráči</summary></details>
    `;
    restoreAdminPageState(root, snapshot);

    expect(root.querySelector<HTMLDetailsElement>("#admin-players")?.open).toBe(true);
    expect(root.querySelector<HTMLDetailsElement>("#admin-map")?.open).toBe(false);
  });
});
