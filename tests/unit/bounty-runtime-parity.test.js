import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createBountyBoardRenderSignature,
  createBountyEscrowPresentation,
  resolveBountyAvatarSrc,
  resolveBountyPlayerCleanCash
} from "../../page-assets/js/app/bounty-runtime.js";

describe("bounty demo and hosted presentation parity", () => {
  it("keeps authoritative target labels from widening the shared picker", () => {
    const css = readFileSync(resolve("page-assets/css/styles-bounty.css"), "utf8");
    expect(css).toMatch(/\.bounty-board__target-menu,[\s\S]*?min-width: 0;[\s\S]*?max-width: 100%;/u);
    expect(css).toMatch(/\.bounty-board__target-option,[\s\S]*?min-width: 0;[\s\S]*?max-width: 100%;/u);
  });

  it("reads local demo clean cash from the fixture session without replacing an explicit zero", () => {
    expect(resolveBountyPlayerCleanCash({
      authoritativeCleanCash: 25_000,
      localDemoSession: { economy: { cleanMoney: 0 } },
      useLocalDemoSession: true
    })).toBe(0);
    expect(resolveBountyPlayerCleanCash({
      authoritativeCleanCash: 0,
      localDemoSession: { economy: { cleanMoney: "12345.9" } },
      useLocalDemoSession: true
    })).toBe(12_345);
  });

  it("falls back to the read model only when local demo cash is nullish", () => {
    expect(resolveBountyPlayerCleanCash({
      authoritativeCleanCash: 7_654.9,
      localDemoSession: { economy: { cleanMoney: null } },
      useLocalDemoSession: true
    })).toBe(7_654);
  });

  it("uses one neutral escrow presentation in both authority modes", () => {
    expect(createBountyEscrowPresentation(0)).toEqual({
      stateLabel: "ESCROW",
      summary: "Vypsaná bounty se po potvrzení zamkne v escrow."
    });
    expect(createBountyEscrowPresentation(5_000)).toEqual({
      stateLabel: "ESCROW",
      summary: "5 000$ je připraveno v aktivních bounty."
    });
  });

  it("resolves an authoritative avatar id through the shared live catalog", () => {
    expect(resolveBountyAvatarSrc({
      avatarId: "mafian:1",
      factionLabel: "mafian"
    })).toBe("../img/avatars/Mafia/2854d1df-0f7c-4fe4-aa85-7a70dfe299db.jpg");
  });

  it("keeps bounty rows stable while only their countdown changes", () => {
    const baseEntry = {
      bountyId: "bounty:stable",
      targetPlayerId: "player:target",
      targetPlayerName: "Target",
      objectiveType: "attack-player",
      rewardCleanCash: 5_000,
      status: "active",
      canCancel: true,
      createdByPlayerName: "Creator",
      remainingMs: 60_000,
      countdownSnapshotAt: 1_000
    };
    const first = createBountyBoardRenderSignature([baseEntry]);
    const ticked = createBountyBoardRenderSignature([{
      ...baseEntry,
      remainingMs: 59_000,
      countdownSnapshotAt: 2_000
    }]);
    const changed = createBountyBoardRenderSignature([{
      ...baseEntry,
      rewardCleanCash: 10_000
    }]);

    expect(ticked).toBe(first);
    expect(changed).not.toBe(first);
    expect(first).toContain("data-bounty-remaining");
    expect(first).toContain("data-bounty-cancel=\"bounty:stable\"");
  });
});
