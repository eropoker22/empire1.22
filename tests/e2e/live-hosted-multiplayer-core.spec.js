import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  loginAndResumeHostedUiParityGame,
  waitForLiveGame
} from "./helpers/hostedUiParityEntry.js";

const hostedEnabled = process.env.EMPIRE_HOSTED_UI_PARITY_E2E === "1";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";
const identities = parseIdentities(process.env.EMPIRE_HOSTED_BOOTSTRAP_IDENTITIES_JSON);
let commandSequence = 0;

test.describe("hosted multiplayer direct-command integration", () => {
  test.skip(
    !hostedEnabled || !serverInstanceId || identities.length !== 3,
    "Hosted multiplayer coverage requires the guarded three-player harness."
  );
  test.setTimeout(900_000);

  test("persists direct-submit conflicts, bounty, market and alliance flows", async ({ browser }) => {
    const clients = [];
    try {
      for (const identity of identities) {
        const context = await browser.newContext({
          baseURL: process.env.PLAYWRIGHT_E2E_BASE_URL
        });
        const page = await context.newPage();
        page.setDefaultTimeout(15_000);
        const entry = await loginAndResumeHostedUiParityGame(page, identity);
        clients.push({ context, page, diagnostics: entry.diagnostics, identity });
      }
      const [creator, target, hunter] = clients;
      await assertFeatureEntrypoints(creator.page);

      let creatorSlice = await loadDistrict(creator.page, "district:1");
      let targetSlice = await loadDistrict(target.page, "district:3");
      let hunterSlice = await loadDistrict(hunter.page, "district:26");
      expect(creatorSlice.readModel.player.profile.displayName).toBe(creator.identity.username);
      expect(targetSlice.readModel.player.profile.displayName).toBe(target.identity.username);
      expect(hunterSlice.readModel.player.profile.displayName).toBe(hunter.identity.username);
      const creatorPlayerId = creatorSlice.readModel.player.playerId;
      const targetPlayerId = targetSlice.readModel.player.playerId;
      const hunterPlayerId = hunterSlice.readModel.player.playerId;
      const targetVersionBeforeBounty = targetSlice.readModel.server.stateVersion;

      const bountyReward = creatorSlice.readModel.bounty.minRewardCleanCash;
      const bountyDuration = creatorSlice.readModel.bounty.durationOptionsHours[0];
      const bountyCreated = await submitCommand(creator.page, creatorSlice.readModel, {
        type: "create-bounty",
        payload: {
          targetPlayerId,
          objectiveType: "attack-player",
          targetDistrictId: null,
          rewardCleanCash: bountyReward,
          durationHours: bountyDuration,
          isAnonymous: false
        }
      });
      const bounty = bountyCreated.readModel.bounty.activeBounties.find(
        (entry) => entry.targetPlayerId === targetPlayerId
      );
      expect(bounty).toMatchObject({
        rewardCleanCash: bountyReward,
        objectiveType: "attack-player",
        status: "active"
      });
      targetSlice = await waitForStateVersion(
        target.page,
        "district:3",
        targetVersionBeforeBounty
      );
      expect(targetSlice.readModel.bounty.activeBounties).toEqual(expect.arrayContaining([
        expect.objectContaining({ bountyId: bounty.bountyId })
      ]));

      const creatorChemicalsBefore = bountyCreated.readModel.player.resourceBalances.chemicals;
      const listingCreated = await submitCommand(creator.page, bountyCreated.readModel, {
        type: "create-player-market-listing",
        payload: {
          resourceId: "chemicals",
          amount: 10,
          unitPrice: 10,
          paymentType: "cleanCash"
        }
      });
      const listing = listingCreated.readModel.market.playerMarket.listings.find(
        (entry) => entry.sellerPlayerId === creatorPlayerId && entry.resourceId === "chemicals"
      );
      expect(listing).toMatchObject({
        amount: 10,
        unitPrice: 10,
        isOwn: true
      });
      expect(listingCreated.readModel.player.resourceBalances.chemicals)
        .toBe(creatorChemicalsBefore - 10);

      targetSlice = await loadDistrict(target.page, "district:3");
      const buyerListing = targetSlice.readModel.market.playerMarket.listings.find(
        (entry) => entry.id === listing.id
      );
      expect(buyerListing).toMatchObject({ canBuy: true, isOwn: false });
      const targetChemicalsBefore = targetSlice.readModel.player.resourceBalances.chemicals;
      const listingBought = await submitCommand(target.page, targetSlice.readModel, {
        type: "buy-player-market-listing",
        payload: {
          listingId: listing.id
        }
      });
      expect(listingBought.readModel.player.resourceBalances.chemicals)
        .toBe(targetChemicalsBefore + 10);
      expect(listingBought.readModel.market.playerMarket.listings)
        .not.toEqual(expect.arrayContaining([expect.objectContaining({ id: listing.id })]));

      creatorSlice = await loadDistrict(creator.page, "district:1");
      const spyTarget = findTarget(creatorSlice.readModel, "spyTargets", "district:25");
      expect(spyTarget.enabled, spyTarget.disabledReason).toBe(true);
      const spyResult = await submitCommand(creator.page, creatorSlice.readModel, {
        type: "spy-district",
        payload: {
          districtId: spyTarget.districtId,
          sourceDistrictId: spyTarget.sourceDistrictId
        }
      });
      expect(spyResult.readModel.reports).toEqual(expect.arrayContaining([
        expect.objectContaining({
          reportType: "spy",
          actionType: "spy-district",
          targetDistrictId: "district:25"
        })
      ]));

      creatorSlice = await loadDistrict(creator.page, "district:1");
      const robTarget = findTarget(creatorSlice.readModel, "robTargets", "district:24");
      expect(robTarget.enabled, robTarget.disabledReason).toBe(true);
      const robResult = await submitCommand(creator.page, creatorSlice.readModel, {
        type: "rob-district",
        payload: {
          targetDistrictId: robTarget.districtId,
          sourceDistrictId: robTarget.sourceDistrictId,
          expectedTargetVersion: robTarget.expectedTargetVersion,
          expectedSourceVersion: robTarget.expectedSourceVersion,
          expectedLootPoolRevision: robTarget.expectedLootPoolRevision,
          expectedConflictRevision: robTarget.expectedConflictRevision
        }
      });
      expect(robResult.readModel.reports).toEqual(expect.arrayContaining([
        expect.objectContaining({
          reportType: "rob",
          actionType: "rob-district",
          targetDistrictId: "district:24"
        })
      ]));

      targetSlice = await loadDistrict(target.page, "district:3");
      const heistTarget = findTarget(targetSlice.readModel, "heistTargets", "district:4");
      expect(heistTarget.enabled, heistTarget.disabledReason).toBe(true);
      const heistStyle = heistTarget.styles.find((entry) => entry.style === "balanced")
        || heistTarget.styles[0];
      const heistResult = await submitCommand(target.page, targetSlice.readModel, {
        type: "heist-district",
        payload: {
          targetDistrictId: heistTarget.districtId,
          sourceDistrictId: heistTarget.sourceDistrictId,
          style: heistStyle.style,
          gangMembersSent: heistStyle.defaultGangMembersSent,
          expectedTargetVersion: heistTarget.expectedTargetVersion,
          expectedSourceVersion: heistTarget.expectedSourceVersion,
          expectedConflictRevision: heistTarget.expectedConflictRevision
        }
      });
      expect(heistResult.readModel.reports).toEqual(expect.arrayContaining([
        expect.objectContaining({
          reportType: "heist",
          actionType: "heist-district",
          targetDistrictId: "district:4"
        })
      ]));

      hunterSlice = await loadDistrict(hunter.page, "district:26");
      const attackTarget = findTarget(hunterSlice.readModel, "attackTargets", "district:2");
      expect(attackTarget.enabled, attackTarget.disabledReason).toBe(true);
      const availableBazookas = hunterSlice.readModel.player.attackWeapons.weapons.find(
        (weapon) => weapon.resourceKey === "bazooka"
      )?.availableAmount;
      expect(availableBazookas).toBeGreaterThanOrEqual(20);
      const attackResult = await submitCommand(hunter.page, hunterSlice.readModel, {
        type: "attack-district",
        payload: {
          districtId: attackTarget.districtId,
          sourceDistrictId: attackTarget.sourceDistrictId,
          weapons: { bazooka: 20 },
          expectedSourceVersion: attackTarget.expectedSourceVersion,
          expectedTargetVersion: attackTarget.expectedTargetVersion,
          expectedConflictRevision: attackTarget.expectedConflictRevision
        }
      });
      const battleReport = attackResult.readModel.reports.find(
        (report) => report.actionType === "attack-district"
      );
      expect(battleReport).toMatchObject({
        reportType: "battle",
        attackerPlayerId: hunterPlayerId,
        defenderPlayerId: targetPlayerId,
        targetDistrictId: "district:2"
      });
      expect(["success", "catastrophe"]).toContain(battleReport.result);
      expect(attackResult.readModel.bounty.recentBountyEvents).toEqual(expect.arrayContaining([
        expect.objectContaining({
          bountyId: bounty.bountyId,
          type: "claimed"
        })
      ]));

      creatorSlice = await waitForNextTick(
        creator.page,
        "district:5",
        robResult.readModel.server.currentTick
      );
      const occupyTarget = findTarget(creatorSlice.readModel, "occupyTargets", "district:6");
      expect(occupyTarget.enabled, occupyTarget.disabledReason).toBe(true);
      const occupyResult = await submitCommand(creator.page, creatorSlice.readModel, {
        type: "occupy-district",
        payload: {
          districtId: occupyTarget.districtId,
          sourceDistrictId: occupyTarget.sourceDistrictId,
          expectedConflictRevision: occupyTarget.expectedConflictRevision
        }
      });
      expect(occupyResult.readModel.reports).toEqual(expect.arrayContaining([
        expect.objectContaining({
          reportType: "occupy",
          actionType: "occupy-district",
          targetDistrictId: "district:6"
        })
      ]));

      const allianceCreated = await submitCommand(creator.page, occupyResult.readModel, {
        type: "create-alliance",
        payload: {
          name: "Hosted Core Alliance",
          tag: "HCA",
          emblemColor: "#22d3ee"
        }
      });
      const allianceId = allianceCreated.readModel.allianceBoard.activeAlliance.allianceId;
      const inviteCreated = await submitCommand(creator.page, allianceCreated.readModel, {
        type: "invite-alliance-member",
        payload: {
          allianceId,
          targetPlayerId
        }
      });
      expect(inviteCreated.readModel.allianceBoard.activeAlliance.pendingInvites)
        .toHaveLength(1);

      targetSlice = await loadDistrict(target.page, "district:3");
      const invite = targetSlice.readModel.allianceBoard.incomingInvites.find(
        (entry) => entry.allianceId === allianceId
      );
      expect(invite).toBeTruthy();
      const inviteAccepted = await submitCommand(target.page, targetSlice.readModel, {
        type: "respond-alliance-invite",
        payload: {
          inviteId: invite.inviteId,
          response: "accept"
        }
      });
      expect(inviteAccepted.readModel.allianceBoard.activeAlliance).toMatchObject({
        allianceId,
        memberCount: 2
      });

      const chatBody = "Hosted cross-client state is authoritative.";
      const chatSent = await submitCommand(creator.page, inviteCreated.readModel, {
        type: "send-alliance-chat-message",
        payload: {
          allianceId,
          body: chatBody
        }
      });
      expect(chatSent.readModel.allianceBoard.activeAlliance.chatMessages).toEqual(
        expect.arrayContaining([expect.objectContaining({ body: chatBody })])
      );

      await target.page.reload({ waitUntil: "load" });
      await waitForLiveGame(target.page);
      const restoredTarget = await loadDistrict(target.page, "district:3");
      expect(restoredTarget.readModel.allianceBoard.activeAlliance).toMatchObject({
        allianceId,
        memberCount: 2
      });
      expect(restoredTarget.readModel.allianceBoard.activeAlliance.chatMessages).toEqual(
        expect.arrayContaining([expect.objectContaining({ body: chatBody })])
      );
      expect(restoredTarget.readModel.bounty.activeBounties).toEqual(expect.arrayContaining([
        expect.objectContaining({
          bountyId: bounty.bountyId,
          status: "claimed"
        })
      ]));
      expect(restoredTarget.readModel.bounty.recentBountyEvents).toEqual(expect.arrayContaining([
        expect.objectContaining({
          bountyId: bounty.bountyId,
          type: "claimed"
        })
      ]));

      for (const client of clients) {
        await expectHostedUiParityClean(client.page, client.diagnostics);
      }
      expect(creator.diagnostics.submitRequests.map((entry) => entry.command.type))
        .toEqual(expect.arrayContaining([
          "create-bounty",
          "create-player-market-listing",
          "spy-district",
          "rob-district",
          "occupy-district",
          "create-alliance",
          "invite-alliance-member",
          "send-alliance-chat-message"
        ]));
      expect(target.diagnostics.submitRequests.map((entry) => entry.command.type))
        .toEqual(expect.arrayContaining([
          "buy-player-market-listing",
          "heist-district",
          "respond-alliance-invite"
        ]));
      expect(hunter.diagnostics.submitRequests.map((entry) => entry.command.type))
        .toContain("attack-district");
    } finally {
      await Promise.allSettled(clients.map((client) => client.context.close()));
    }
  });
});

async function assertFeatureEntrypoints(page) {
  await expect(page.locator("[data-bounty-open-trigger]:visible").first()).toBeVisible();
  await page.locator("[data-bounty-open-trigger]:visible").first().click();
  await expect(page.locator("#bounty-modal")).toBeVisible();
  await page.locator("#bounty-modal-close").click();

  await expect(page.locator("[data-market-popup-open]:visible").first()).toBeVisible();
  await page.locator("[data-market-popup-open]:visible").first().click();
  await expect(page.locator("[data-market-popup]")).toBeVisible();
  await page.locator("[data-market-popup-close]").last().click();

  await expect(page.locator("#alliance-btn")).toBeVisible();
  await page.locator("#alliance-btn").click();
  await expect(page.locator("#alliance-modal")).toBeVisible();
  await page.locator("#alliance-modal-backdrop").evaluate((element) => element.click());
}

async function loadDistrict(page, districtId) {
  const result = await postGameplaySliceRequest(page, "load", {
    serverInstanceId,
    districtId
  });
  expect(result.status, `${districtId} load status`).toBe(200);
  expect(result.payload?.accepted, `${districtId} load`).toBe(true);
  expect(result.payload?.readModel?.district?.districtId).toBe(districtId);
  return result.payload;
}

async function submitCommand(page, readModel, { type, payload }) {
  commandSequence += 1;
  const result = await postGameplaySliceRequest(page, "submit", {
    command: {
      id: `hosted-multiplayer:${commandSequence}:${type}`,
      type,
      mode: readModel.mode.mode,
      playerId: readModel.player.playerId,
      serverInstanceId: readModel.server.serverInstanceId,
      issuedAt: new Date().toISOString(),
      payload,
      clientRequestId: null
    },
    focusDistrictId: readModel.district.districtId,
    expectedStateVersion: null
  });
  const errorCodes = result.payload?.errors?.map((error) => error.code).filter(Boolean).join(", ");
  expect(result.status, `${type} submit status`).toBe(200);
  expect(result.payload?.accepted, `${type}${errorCodes ? ` (${errorCodes})` : ""}`).toBe(true);
  expect(result.payload.readModel.server.stateVersion)
    .toBeGreaterThan(readModel.server.stateVersion);
  return result.payload;
}

function findTarget(readModel, collectionKey, districtId) {
  const targets = readModel.district?.[collectionKey]
    || readModel.district?.targetActions?.[collectionKey]
    || [];
  const target = targets.find((entry) => entry.districtId === districtId);
  expect(target, `${collectionKey} must contain ${districtId}`).toBeTruthy();
  return target;
}

async function waitForStateVersion(page, districtId, previousVersion) {
  await expect.poll(
    async () => (await loadDistrict(page, districtId)).readModel.server.stateVersion,
    {
      message: `Cross-client state must advance beyond ${previousVersion}.`,
      timeout: 30_000
    }
  ).toBeGreaterThan(previousVersion);
  return loadDistrict(page, districtId);
}

async function waitForNextTick(page, districtId, currentTick) {
  await expect.poll(
    async () => (await loadDistrict(page, districtId)).readModel.server.currentTick,
    {
      message: `Command rate window must advance after tick ${currentTick}.`,
      timeout: 30_000
    }
  ).toBeGreaterThan(currentTick);
  return loadDistrict(page, districtId);
}

async function postGameplaySliceRequest(page, route, requestBody) {
  return page.evaluate(async ({ requestRoute, body }) => {
    const response = await fetch(`/api/gameplay-slice/${requestRoute}`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    return {
      status: response.status,
      payload: await response.json()
    };
  }, {
    requestRoute: route,
    body: requestBody
  });
}

function parseIdentities(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
