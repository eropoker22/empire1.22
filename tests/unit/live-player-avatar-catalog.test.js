import { describe, expect, it } from "vitest";
import {
  getLivePlayerAvatarPreviews,
  resolveLivePlayerAvatarSrc
} from "../../page-assets/js/app/model/livePlayerAvatarCatalog.js";

describe("live player avatar catalog", () => {
  it("resolves the server-selected avatar without local storage", () => {
    expect(resolveLivePlayerAvatarSrc("hackeri:1")).toContain("/img/avatars/Hacker/");
    expect(resolveLivePlayerAvatarSrc("mafian:1")).toContain("/img/avatars/Mafia/");
  });

  it("fails closed for an unknown avatar or faction", () => {
    expect(resolveLivePlayerAvatarSrc("unknown:1")).toBe("");
    expect(getLivePlayerAvatarPreviews("unknown")).toEqual([]);
  });
});
