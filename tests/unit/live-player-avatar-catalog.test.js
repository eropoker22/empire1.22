import { describe, expect, it } from "vitest";
import {
  getLivePlayerAvatarPreviews,
  resolveLivePlayerAvatarSrc
} from "../../page-assets/js/app/model/livePlayerAvatarCatalog.js";

describe("live player avatar catalog", () => {
  const factions = [
    "mafian",
    "kartel",
    "kult",
    "tajna-organizace",
    "hackeri",
    "motorkarsky-gang",
    "soukroma-armada",
    "korporace"
  ];

  it("resolves the server-selected avatar without local storage", () => {
    expect(resolveLivePlayerAvatarSrc("hackeri:1")).toContain("/img/avatars/Hacker/");
    expect(resolveLivePlayerAvatarSrc("mafian:1")).toContain("/img/avatars/Mafia/");
  });

  it("offers every server-supported avatar for every faction", () => {
    for (const factionId of factions) {
      expect(getLivePlayerAvatarPreviews(factionId)).toHaveLength(9);
      expect(resolveLivePlayerAvatarSrc(`${factionId}:9`)).not.toBe("");
      expect(resolveLivePlayerAvatarSrc(`${factionId}:10`)).toBe("");
    }
  });

  it("fails closed for an unknown avatar or faction", () => {
    expect(resolveLivePlayerAvatarSrc("unknown:1")).toBe("");
    expect(getLivePlayerAvatarPreviews("unknown")).toEqual([]);
  });
});
