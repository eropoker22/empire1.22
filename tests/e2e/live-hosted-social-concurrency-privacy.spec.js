import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  loginAndResumeHostedUiParityGame,
  waitForLiveGame
} from "./helpers/hostedUiParityEntry.js";
import { waitForTerminalGameplaySubmit } from "./helpers/gameplaySubmitResponse.js";

const hostedEnabled = process.env.EMPIRE_HOSTED_UI_PARITY_E2E === "1";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";
const gameplayLoadPath = "/api/gameplay-slice/load";
const identities = parseIdentities(process.env.EMPIRE_HOSTED_BOOTSTRAP_IDENTITIES_JSON);
const bountyEntryKeys = Object.freeze([
  "bountyId",
  "canCancel",
  "cancelDisabledReason",
  "createdByLabel",
  "expiresAtTick",
  "isOwn",
  "objectiveLabel",
  "objectiveType",
  "remainingMs",
  "remainingTicks",
  "rewardCleanCash",
  "status",
  "targetDistrictId",
  "targetDistrictName",
  "targetPlayerId",
  "targetPlayerName"
].sort());
const marketTransactionKeys = Object.freeze([
  "amount",
  "isOwn",
  "marketType",
  "paymentType",
  "resourceId",
  "timestamp",
  "totalPrice",
  "type",
  "unitPrice"
].sort());

test.describe("hosted social concurrency and privacy", () => {
  test.skip(
    !hostedEnabled || !serverInstanceId || identities.length !== 5,
    "Social concurrency coverage requires the guarded five-player hosted harness."
  );
  test.setTimeout(900_000);

  test("serializes bounty, market and alliance races without leaking private fields", async ({
    browser
  }) => {
    const clients = [];
    try {
      for (const identity of identities) {
        const context = await browser.newContext({
          baseURL: process.env.PLAYWRIGHT_E2E_BASE_URL,
          viewport: { width: 1440, height: 900 }
        });
        const page = await context.newPage();
        page.setDefaultTimeout(20_000);
        clients.push({ context, page, diagnostics: null, identity });
      }
      await Promise.all(clients.map(async (client) => {
        const entry = await loginAndResumeHostedUiParityGame(client.page, client.identity);
        client.diagnostics = entry.diagnostics;
      }));

      const [creator, target, hunterA, hunterB, hunterC] = clients;
      const participantIds = await Promise.all(clients.map(async (client) => (
        (await getRenderedReadModel(client.page)).player.playerId
      )));
      const [
        creatorPlayerId,
        targetPlayerId,
        hunterAPlayerId,
        hunterBPlayerId,
        hunterCPlayerId
      ] = participantIds;

      const forgedSubmit = await submitForgedPlayerIdCommand(target.page, creatorPlayerId);
      expect(forgedSubmit.responseStatus).toBe(200);
      expect(forgedSubmit.request.command.playerId).toBe(creatorPlayerId);
      expect(forgedSubmit.body).toMatchObject({
        accepted: false,
        readModel: null,
        errors: [expect.objectContaining({ code: "PLAYER_IDENTITY_MISMATCH" })]
      });

      const bountyReward = 100_000;
      const bountyCreated = await createBountyThroughVisibleUi(creator.page, {
        targetPlayerId,
        rewardCleanCash: bountyReward
      });
      assertRequestAuthority(bountyCreated.request, creatorPlayerId);
      const bountyId = findBountyId(bountyCreated.body.readModel, targetPlayerId, "active");
      await closeBountyPanel(creator.page);

      const unauthorizedBountyClients = [target, hunterA, hunterB, hunterC];
      const unauthorizedBountyPlayerIds = [
        targetPlayerId,
        hunterAPlayerId,
        hunterBPlayerId,
        hunterCPlayerId
      ];
      const bountyLoads = await Promise.all(unauthorizedBountyClients.map(({ page }) => (
        reloadHostedGameWithRawLoad(page, { playerId: creatorPlayerId })
      )));
      await Promise.all(unauthorizedBountyClients.map(async (client, index) => {
        expect(bountyLoads[index].request.playerId).toBe(creatorPlayerId);
        expect(bountyLoads[index].body.readModel.player.playerId)
          .toBe(unauthorizedBountyPlayerIds[index]);
        assertAnonymousBounty(bountyLoads[index].body.readModel, bountyId);
        assertAnonymousBounty(await getRenderedReadModel(client.page), bountyId);
        await openBountyPanel(client.page, "active");
        const row = client.page.locator(`[data-bounty-row="${bountyId}"]`);
        await expect(row).toBeVisible();
        await expect(row).toContainText("Anonymní");
        await expect(row).not.toContainText(creator.identity.username);
        await closeBountyPanel(client.page);
      }));

      const hunterCashBefore = new Map([
        [hunterAPlayerId, getCleanCash(await getRenderedReadModel(hunterA.page))],
        [hunterBPlayerId, getCleanCash(await getRenderedReadModel(hunterB.page))]
      ]);

      const attackPreparations = await Promise.all([
        prepareAttackThroughVisibleUi(hunterA.page, "district:2"),
        prepareAttackThroughVisibleUi(hunterB.page, "district:2")
      ]);
      const attackAttempts = await Promise.all([
        clickAndReadTypedSubmit(hunterA.page, "attack-district", attackPreparations[0].button),
        clickAndReadTypedSubmit(hunterB.page, "attack-district", attackPreparations[1].button)
      ]);
      const attacks = attackAttempts.map((result, index) => ({
        playerId: index === 0 ? hunterAPlayerId : hunterBPlayerId,
        result
      }));
      for (let index = 0; index < attacks.length; index += 1) {
        const attempt = attacks[index];
        assertRequestAuthority(attempt.result.request, attempt.playerId);
        expect(attempt.result.request.command.payload).toMatchObject({
          districtId: "district:2",
          sourceDistrictId: attackPreparations[index].projection.sourceDistrictId,
          expectedConflictRevision: attackPreparations[index].projection.expectedConflictRevision,
          weapons: { bazooka: 20 }
        });
        assertAnonymousBounty(attempt.result.body.readModel, bountyId, "claimed");
        expect(claimedBountyEvents(attempt.result.body.readModel, bountyId)).toHaveLength(1);
      }
      const acceptedAttacks = attacks.filter(({ result }) => result.body.accepted === true);
      const rejectedAttacks = attacks.filter(({ result }) => result.body.accepted !== true);
      expect(acceptedAttacks).toHaveLength(1);
      expect(rejectedAttacks).toHaveLength(1);
      expect(rejectedAttacks[0].result.body.errors?.[0]?.code)
        .toBe("DISTRICT_CONFLICT_STATE_CHANGED");

      const hunterLoadsAfterClaim = await Promise.all([
        reloadHostedGameWithRawLoad(hunterA.page),
        reloadHostedGameWithRawLoad(hunterB.page)
      ]);
      const winnerPlayerId = acceptedAttacks[0].playerId;
      for (let index = 0; index < hunterLoadsAfterClaim.length; index += 1) {
        const playerId = index === 0 ? hunterAPlayerId : hunterBPlayerId;
        const readModel = hunterLoadsAfterClaim[index].body.readModel;
        const payoutDelta = getCleanCash(readModel) - hunterCashBefore.get(playerId);
        if (playerId === winnerPlayerId) {
          expect(payoutDelta).toBeGreaterThanOrEqual(bountyReward);
          expect(payoutDelta).toBeLessThan(bountyReward * 2);
        } else {
          expect(payoutDelta).toBeLessThan(bountyReward);
        }
        expect(claimedBountyEvents(readModel, bountyId)).toHaveLength(1);
        assertAnonymousBounty(readModel, bountyId, "claimed");
      }

      const listingCreated = await createMarketListingThroughVisibleUi(creator.page, {
        resourceId: "chemicals",
        amount: 10,
        unitPrice: 10,
        paymentType: "cleanCash"
      });
      assertRequestAuthority(listingCreated.request, creatorPlayerId);
      assertSafeMarketTransactions(listingCreated.body.readModel);
      const listing = findOwnListing(listingCreated.body.readModel, creatorPlayerId, "chemicals");
      await closeMarketPanel(creator.page);

      const buyers = [target, hunterA, hunterB, hunterC];
      const buyerIds = [targetPlayerId, hunterAPlayerId, hunterBPlayerId, hunterCPlayerId];
      await Promise.all(buyers.map(({ page }) => reloadHostedGame(page)));
      await Promise.all(buyers.map(({ page }) => closeBountyPanel(page)));
      await Promise.all(buyers.map(({ page }) => openPlayerMarket(page)));
      const peerListings = buyers.map(({ page }) => page.locator(
        '.market-player-listing[data-listing-owner="peer"]'
      ).first());
      await Promise.all(peerListings.map((card) => expect(card).toBeVisible()));
      const buyAttempts = await Promise.all(peerListings.map(async (card, index) => ({
        playerId: buyerIds[index],
        result: await clickAndReadTypedSubmit(
          buyers[index].page,
          "buy-player-market-listing",
          card.locator(".market-player-listing__buy")
        )
      })));
      for (const attempt of buyAttempts) {
        assertRequestAuthority(attempt.result.request, attempt.playerId);
        expect(attempt.result.request.command.payload).toEqual({ listingId: listing.id });
        assertSafeMarketTransactions(attempt.result.body.readModel);
      }
      const acceptedBuys = buyAttempts.filter(({ result }) => result.body.accepted === true);
      const rejectedBuys = buyAttempts.filter(({ result }) => result.body.accepted !== true);
      expect(acceptedBuys).toHaveLength(1);
      expect(rejectedBuys).toHaveLength(3);
      for (const rejected of rejectedBuys) {
        expect(rejected.result.body.errors?.[0]?.code).toBe("market_listing_not_found");
      }
      await Promise.all(buyers.map(({ page }) => closeMarketPanel(page)));

      const participantLoads = await Promise.all(clients.map(({ page }) => (
        reloadHostedGameWithRawLoad(page)
      )));
      for (let index = 0; index < clients.length; index += 1) {
        const expectedOwn = participantIds[index] === acceptedBuys[0].playerId;
        for (const readModel of [
          participantLoads[index].body.readModel,
          await getRenderedReadModel(clients[index].page)
        ]) {
          const matching = assertSafeMarketTransactions(readModel).filter((entry) => (
            entry.marketType === "player"
            && entry.type === "buy"
            && entry.resourceId === "chemicals"
            && entry.amount === 10
            && entry.totalPrice === 100
          ));
          expect(matching).toHaveLength(1);
          expect(matching[0].isOwn).toBe(expectedOwn);
        }
      }

      const allianceName = `Race Crew ${Date.now().toString(36)}`.slice(0, 32);
      const allianceCreated = await createAllianceThroughVisibleUi(creator.page, allianceName);
      assertRequestAuthority(allianceCreated.request, creatorPlayerId);
      const allianceId = allianceCreated.body.readModel.allianceBoard.activeAlliance.allianceId;
      const inviteCreated = await inviteAllianceMemberThroughVisibleUi(
        creator.page,
        targetPlayerId,
        { verifyDraftAcrossPoll: true }
      );
      assertRequestAuthority(inviteCreated.request, creatorPlayerId);
      const invite = inviteCreated.body.readModel.allianceBoard.activeAlliance.pendingInvites.find(
        (entry) => entry.targetPlayerId === targetPlayerId
      );
      expect(invite).toBeTruthy();

      const pendingInviteOutsiderLoad = await reloadHostedGameWithRawLoad(hunterC.page);
      expect(pendingInviteOutsiderLoad.body.readModel.player.playerId).toBe(hunterCPlayerId);
      assertAlliancePrivateStateRedacted(
        pendingInviteOutsiderLoad.body.readModel,
        allianceId,
        invite.inviteId
      );
      assertAlliancePrivateStateRedacted(
        await getRenderedReadModel(hunterC.page),
        allianceId,
        invite.inviteId
      );

      const duplicateContext = await browser.newContext({
        baseURL: process.env.PLAYWRIGHT_E2E_BASE_URL,
        viewport: { width: 1440, height: 900 }
      });
      const duplicateTargetPage = await duplicateContext.newPage();
      duplicateTargetPage.setDefaultTimeout(20_000);
      const duplicateEntry = await loginAndResumeHostedUiParityGame(
        duplicateTargetPage,
        target.identity
      );
      clients.push({
        context: duplicateContext,
        page: duplicateTargetPage,
        diagnostics: duplicateEntry.diagnostics,
        identity: target.identity
      });
      await reloadHostedGame(target.page);
      const acceptButtons = await Promise.all([
        prepareAllianceInviteAccept(
          target.page,
          invite.inviteId,
          inviteCreated.body.commandResult?.rootVersionAfter
        ),
        prepareAllianceInviteAccept(
          duplicateTargetPage,
          invite.inviteId,
          inviteCreated.body.commandResult?.rootVersionAfter
        )
      ]);
      const inviteAttempts = await Promise.all(acceptButtons.map((button, index) => (
        clickAndReadTypedSubmit(
          index === 0 ? target.page : duplicateTargetPage,
          "respond-alliance-invite",
          button
        )
      )));
      for (const attempt of inviteAttempts) {
        assertRequestAuthority(attempt.request, targetPlayerId);
        expect(attempt.request.command.payload).toEqual({
          inviteId: invite.inviteId,
          response: "accept"
        });
      }
      const acceptedInvites = inviteAttempts.filter(({ body }) => body.accepted === true);
      const rejectedInvites = inviteAttempts.filter(({ body }) => body.accepted !== true);
      expect(acceptedInvites).toHaveLength(1);
      expect(rejectedInvites).toHaveLength(1);
      expect(rejectedInvites[0].body.errors?.[0]?.code).toBe("ALLIANCE_INVITE_NOT_FOUND");
      assertAllianceMembership(acceptedInvites[0].body.readModel, allianceId, targetPlayerId, 2);

      const creatorAllianceLoad = await reloadHostedGameWithRawLoad(creator.page);
      assertAllianceMembership(creatorAllianceLoad.body.readModel, allianceId, targetPlayerId, 2);

      const fillerInviteCreated = await inviteAllianceMemberThroughVisibleUi(
        creator.page,
        hunterAPlayerId
      );
      assertRequestAuthority(fillerInviteCreated.request, creatorPlayerId);
      const fillerInvite = fillerInviteCreated.body.readModel
        .allianceBoard.activeAlliance.pendingInvites.find(
          (entry) => entry.targetPlayerId === hunterAPlayerId
        );
      expect(fillerInvite).toBeTruthy();
      await reloadHostedGame(hunterA.page);
      const fillerAccept = await clickAndReadTypedSubmit(
        hunterA.page,
        "respond-alliance-invite",
        await prepareAllianceInviteAccept(hunterA.page, fillerInvite.inviteId)
      );
      assertRequestAuthority(fillerAccept.request, hunterAPlayerId);
      expect(fillerAccept.body.accepted, formatErrors(fillerAccept.body)).toBe(true);
      assertAllianceMembership(fillerAccept.body.readModel, allianceId, hunterAPlayerId, 3);

      await reloadHostedGame(creator.page);
      const lastSlotCandidates = [
        { client: hunterB, playerId: hunterBPlayerId },
        { client: hunterC, playerId: hunterCPlayerId }
      ];
      for (const candidate of lastSlotCandidates) {
        const created = await inviteAllianceMemberThroughVisibleUi(
          creator.page,
          candidate.playerId
        );
        assertRequestAuthority(created.request, creatorPlayerId);
        const candidateInvite = created.body.readModel
          .allianceBoard.activeAlliance.pendingInvites.find(
            (entry) => entry.targetPlayerId === candidate.playerId
          );
        expect(candidateInvite).toBeTruthy();
        candidate.invite = candidateInvite;
      }

      await Promise.all(lastSlotCandidates.map(({ client }) => reloadHostedGame(client.page)));
      const lastSlotButtons = await Promise.all(lastSlotCandidates.map(({ client, invite: entry }) => (
        prepareAllianceInviteAccept(client.page, entry.inviteId)
      )));
      const lastSlotAttempts = await Promise.all(lastSlotCandidates.map(
        async (candidate, index) => ({
          candidate,
          result: await clickAndReadTypedSubmit(
            candidate.client.page,
            "respond-alliance-invite",
            lastSlotButtons[index]
          )
        })
      ));
      for (const { candidate, result } of lastSlotAttempts) {
        assertRequestAuthority(result.request, candidate.playerId);
        expect(result.request.command.payload).toEqual({
          inviteId: candidate.invite.inviteId,
          response: "accept"
        });
      }
      const acceptedLastSlot = lastSlotAttempts.filter(({ result }) => result.body.accepted === true);
      const rejectedLastSlot = lastSlotAttempts.filter(({ result }) => result.body.accepted !== true);
      expect(acceptedLastSlot).toHaveLength(1);
      expect(rejectedLastSlot).toHaveLength(1);
      expect(rejectedLastSlot[0].result.body.errors?.[0]?.code).toBe("ALLIANCE_FULL");
      assertAllianceMembership(
        acceptedLastSlot[0].result.body.readModel,
        allianceId,
        acceptedLastSlot[0].candidate.playerId,
        4
      );

      const loser = rejectedLastSlot[0].candidate;
      const finalCreatorAllianceLoad = await reloadHostedGameWithRawLoad(creator.page);
      assertAllianceRoster(finalCreatorAllianceLoad.body.readModel, allianceId, [
        creatorPlayerId,
        targetPlayerId,
        hunterAPlayerId,
        acceptedLastSlot[0].candidate.playerId
      ]);
      const privateChatBody = `private-race-${Date.now().toString(36)}`;
      const chatSent = await sendAllianceChatThroughVisibleUi(creator.page, privateChatBody);
      assertRequestAuthority(chatSent.request, creatorPlayerId);

      const loserLoad = await reloadHostedGameWithRawLoad(loser.client.page);
      expect(loserLoad.body.readModel.player.playerId).toBe(loser.playerId);
      assertAlliancePrivateStateRedacted(loserLoad.body.readModel, allianceId, privateChatBody);
      assertAlliancePrivateStateRedacted(
        await getRenderedReadModel(loser.client.page),
        allianceId,
        privateChatBody
      );
      await openAllianceTab(loser.client.page, "alliances");
      const publicAllianceCard = loser.client.page.locator(
        `.alliance-public-row:has([data-alliance-public-message="${allianceId}"])`
      );
      await expect(publicAllianceCard).toBeVisible();
      await expect(publicAllianceCard).not.toContainText(privateChatBody);

      await Promise.all(clients.map((client) => (
        expectHostedUiParityClean(client.page, client.diagnostics)
      )));
    } finally {
      await Promise.allSettled(clients.map(({ context }) => context.close()));
    }
  });
});

async function createBountyThroughVisibleUi(page, { targetPlayerId, rewardCleanCash }) {
  await openBountyPanel(page, "create");
  await page.locator("[data-bounty-target-toggle]").click();
  const target = page.locator(`[data-bounty-target-option="${targetPlayerId}"]`);
  await expect(target).toBeEnabled();
  await target.click();
  await page.locator('label:has(input[name="bounty-objective"][value="attack-player"])').click();
  await page.locator('label:has(input[name="bounty-duration"][value="1"])').click();
  await page.locator("#bounty-anonymous-input").setChecked(true);
  const reward = page.locator("#bounty-cash-input");
  await reward.fill(String(rewardCleanCash));
  await reward.dispatchEvent("input");
  await page.locator("#bounty-modal-submit").click();
  const confirmation = page.locator("#bounty-confirm-modal");
  await expect(confirmation).toBeVisible();
  const result = await clickAndReadTypedSubmit(
    page,
    "create-bounty",
    confirmation.locator("#bounty-confirm-modal-submit")
  );
  expect(result.body.accepted, formatErrors(result.body)).toBe(true);
  return result;
}

async function openBountyPanel(page, tab = null) {
  const modal = page.locator("#bounty-modal");
  if (!await modal.isVisible().catch(() => false)) {
    await page.locator("[data-bounty-open-trigger]:visible").first().click();
  }
  await expect(modal).toBeVisible();
  if (tab) {
    const tabButton = modal.locator(`[data-bounty-tab="${tab}"]`);
    await expect(tabButton).toBeVisible();
    await tabButton.click();
    await expect(tabButton).toHaveAttribute("aria-selected", "true");
    await expect(modal).toHaveAttribute("data-bounty-tab", tab);
  }
}

async function closeBountyPanel(page) {
  const modal = page.locator("#bounty-modal");
  if (!await modal.isVisible().catch(() => false)) return;
  await modal.locator("#bounty-modal-close").click();
  await expect(modal).toBeHidden();
}

async function prepareAttackThroughVisibleUi(page, districtId) {
  const projection = await openActionTargetFromMap(page, districtId, "attack");
  const action = page.locator(
    `[data-district-popup][data-district-id="${districtId.replace(/^district:/u, "")}"]`
      + ' [data-district-action-id="attack"]'
  );
  await expect(action).toBeEnabled();
  await action.click();
  const setup = page.locator("[data-attack-setup-popup]");
  await expect(setup).toBeVisible();
  await setup.locator("[data-attack-source-select]")
    .selectOption(projection.sourceDistrictId.replace(/^district:/u, ""));
  const bazookas = setup.locator('[data-attack-weapon-input="bazooka"]');
  await bazookas.fill("20");
  await bazookas.dispatchEvent("input");
  await setup.locator("[data-attack-confirm]").click();
  const button = page.locator("[data-attack-confirm-popup] [data-attack-confirm-button]");
  await expect(button).toBeEnabled();
  return { button, projection };
}

async function openActionTargetFromMap(page, districtId, actionId) {
  const numericDistrictId = Number(districtId.replace(/^district:/u, ""));
  const point = await page.evaluate((requestedDistrictId) => {
    const district = window.empireStreetsDistrictState?.getDistrictById?.(requestedDistrictId);
    const canvas = document.querySelector("[data-district-canvas]");
    const host = document.querySelector("[data-map-canvas]");
    if (!district || !(canvas instanceof HTMLCanvasElement) || !(host instanceof HTMLElement)) {
      return null;
    }
    const rect = host.getBoundingClientRect();
    return {
      x: rect.left + (Number(district.centerX) / canvas.width) * rect.width,
      y: rect.top + (Number(district.centerY) / canvas.height) * rect.height
    };
  }, numericDistrictId);
  expect(point).toBeTruthy();
  await page.mouse.click(point.x, point.y);
  await expect(page.locator("[data-district-popup]")).toHaveAttribute(
    "data-district-id",
    String(numericDistrictId)
  );
  await expect.poll(() => page.evaluate(() => (
    window.EmpireGameplaySliceClient?.getCurrentReadModel?.()?.district?.districtId || null
  ))).toBe(districtId);
  const projection = await page.evaluate(({ districtId: targetId, actionId: targetAction }) => {
    const readModels = [
      window.empireStreetsGameplaySliceReadModel,
      window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
    ].filter(Boolean);
    for (const readModel of readModels) {
      const target = (
        readModel?.district?.targetActions?.[`${targetAction}Targets`]
        || readModel?.district?.[`${targetAction}Targets`]
        || []
      ).find((entry) => entry.districtId === targetId) || null;
      if (!target) continue;
      const corridor = readModel?.frontier?.corridorTargets?.find(
        (entry) => entry.targetDistrictId === targetId
      ) || null;
      return {
        ...target,
        sourceDistrictId: corridor?.sourceDistrictId || target.sourceDistrictId
      };
    }
    return null;
  }, { districtId, actionId });
  expect(projection, `${actionId} projection must include ${districtId}`).toBeTruthy();
  expect(projection.enabled, projection.disabledReason || actionId).toBe(true);
  return projection;
}

async function createMarketListingThroughVisibleUi(page, input) {
  await openPlayerMarket(page);
  const form = page.locator(".market-player-form");
  await form.locator("select").nth(0).selectOption(`materials|${input.resourceId}`);
  await form.locator('input[type="number"]').nth(0).fill(String(input.amount));
  await form.locator('input[type="number"]').nth(1).fill(String(input.unitPrice));
  await form.locator("select").nth(1).selectOption("cleanMoney");
  const authoritativeRefresh = page.waitForResponse((response) => (
    new URL(response.url()).pathname === gameplayLoadPath
    && response.request().method() === "POST"
  ));
  expect((await authoritativeRefresh).status()).toBe(200);
  await expect(form.locator('input[type="number"]').nth(0)).toHaveValue(String(input.amount));
  await expect(form.locator('input[type="number"]').nth(1)).toHaveValue(String(input.unitPrice));
  const result = await clickAndReadTypedSubmit(
    page,
    "create-player-market-listing",
    form.locator(".market-player-sell-button")
  );
  expect(result.request.command.payload).toMatchObject({
    amount: input.amount,
    unitPrice: input.unitPrice
  });
  expect(result.body.accepted, formatErrors(result.body)).toBe(true);
  return result;
}

async function openPlayerMarket(page) {
  const popup = page.locator("[data-market-popup]");
  if (!await popup.isVisible().catch(() => false)) {
    await page.locator("[data-market-popup-open]:visible").first().click();
  }
  await expect(popup).toBeVisible();
  await popup.locator('[data-market-tab="player-market"]').click();
  await expect(popup).toHaveAttribute("data-market-mode", "player-market");
}

async function closeMarketPanel(page) {
  const popup = page.locator("[data-market-popup]");
  if (!await popup.isVisible().catch(() => false)) return;
  await popup.locator("[data-market-popup-close]").last().click();
  await expect(popup).toBeHidden();
}

async function createAllianceThroughVisibleUi(page, allianceName) {
  await openAlliancePanel(page);
  await page.locator("#alliance-create-toggle-btn").click();
  const modal = page.locator("#alliance-create-modal");
  await expect(modal).toBeVisible();
  await modal.locator("#alliance-create-name").fill(allianceName);
  const result = await clickAndReadTypedSubmit(
    page,
    "create-alliance",
    modal.locator("#alliance-create-btn")
  );
  expect(result.body.accepted, formatErrors(result.body)).toBe(true);
  return result;
}

async function inviteAllianceMemberThroughVisibleUi(page, targetPlayerId, options = {}) {
  await openAllianceTab(page, "invites");
  const select = page.locator("#alliance-management-invite-name");
  const authoritativeRefresh = options.verifyDraftAcrossPoll
    ? page.waitForResponse((response) => (
      new URL(response.url()).pathname === gameplayLoadPath
      && response.request().method() === "POST"
    ))
    : null;
  await select.selectOption(targetPlayerId);
  if (authoritativeRefresh) {
    expect((await authoritativeRefresh).status()).toBe(200);
  }
  await expect(select).toHaveValue(targetPlayerId);
  const result = await clickAndReadTypedSubmit(
    page,
    "invite-alliance-member",
    page.locator("#alliance-management-invite-btn")
  );
  expect(result.request.command.payload).toMatchObject({ targetPlayerId });
  expect(result.body.accepted, formatErrors(result.body)).toBe(true);
  return result;
}

async function prepareAllianceInviteAccept(page, inviteId, minimumStateVersion = null) {
  await expect.poll(async () => {
    const readModel = await getRenderedReadModel(page);
    const stateVersion = Number(readModel?.server?.stateVersion ?? -1);
    return {
      hasInvite: Boolean(readModel?.allianceBoard?.incomingInvites?.some(
        (entry) => entry.inviteId === inviteId
      )),
      meetsMinimumVersion: !Number.isSafeInteger(minimumStateVersion)
        || stateVersion >= minimumStateVersion
    };
  }, {
    message: `Authoritative alliance invite ${inviteId} must be rendered before it can be accepted.`,
    timeout: 30_000,
    intervals: [250, 500, 1_000]
  }).toEqual({ hasInvite: true, meetsMinimumVersion: true });
  await openAllianceTab(page, "invites");
  const button = page.locator(`[data-alliance-invite-accept="${inviteId}"]`);
  await expect(button).toBeEnabled();
  return button;
}

async function sendAllianceChatThroughVisibleUi(page, body) {
  await openAllianceTab(page, "chat");
  const input = page.locator("[data-alliance-chat-input]");
  const authoritativeRefresh = page.waitForResponse((response) => (
    new URL(response.url()).pathname === gameplayLoadPath
    && response.request().method() === "POST"
  ));
  await input.fill(body);
  expect((await authoritativeRefresh).status()).toBe(200);
  await expect(input).toHaveValue(body);
  const result = await clickAndReadTypedSubmit(
    page,
    "send-alliance-chat-message",
    page.locator("[data-alliance-chat-send]")
  );
  expect(result.request.command.payload).toMatchObject({ body });
  expect(result.body.accepted, formatErrors(result.body)).toBe(true);
  return result;
}

async function openAlliancePanel(page) {
  const modal = page.locator("#alliance-modal");
  if (!await modal.isVisible().catch(() => false)) await page.locator("#alliance-btn").click();
  await expect(modal).toBeVisible();
}

async function openAllianceTab(page, tabId) {
  await openAlliancePanel(page);
  const modal = page.locator("#alliance-modal");
  await expect.poll(() => page.evaluate((nextTabId) => {
    const currentModal = document.querySelector("#alliance-modal");
    if (!(currentModal instanceof HTMLElement)) return false;
    if (currentModal.getAttribute("data-alliance-tab") === nextTabId) return true;
    const tab = Array.from(currentModal.querySelectorAll("button[data-alliance-tab]"))
      .find((candidate) => candidate.getAttribute("data-alliance-tab") === nextTabId);
    if (!(tab instanceof HTMLButtonElement)) return false;
    tab.click();
    return currentModal.getAttribute("data-alliance-tab") === nextTabId;
  }, tabId)).toBe(true);
  await expect(modal).toHaveAttribute("data-alliance-tab", tabId);
}

async function closeAlliancePanel(page) {
  const modal = page.locator("#alliance-modal");
  if (!await modal.isVisible().catch(() => false)) return;
  await modal.locator("[data-alliance-modal-close]").click();
  await expect(modal).toBeHidden();
}

async function clickAndReadTypedSubmit(page, commandType, button) {
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  const abortController = new AbortController();
  const responsePromise = waitForTerminalGameplaySubmit(page, (request) => (
    request?.command?.type === commandType
  ), { signal: abortController.signal });
  try {
    await button.click();
  } catch (error) {
    abortController.abort(error);
    await responsePromise.catch(() => {});
    throw error;
  }
  const submission = await responsePromise;
  expect(submission.response.status()).toBe(200);
  expect(submission.stateVersionConflicts.length).toBeLessThanOrEqual(1);
  return submission;
}

async function reloadHostedGame(page) {
  await page.reload({ waitUntil: "commit" });
  await waitForLiveGame(page);
}

async function reloadHostedGameWithRawLoad(page, requestOverrides = {}) {
  await reloadHostedGame(page);
  const rendered = await getRenderedReadModel(page);
  const request = {
    serverInstanceId,
    districtId: rendered?.district?.districtId || rendered?.player?.homeDistrictId,
    ...requestOverrides
  };
  const result = await page.evaluate(async (body) => {
    const response = await fetch("/api/gameplay-slice/load", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    return {
      body: await response.json(),
      responseStatus: response.status
    };
  }, request);
  expect(result.responseStatus).toBe(200);
  const body = result.body;
  expect(body.accepted, formatErrors(body)).toBe(true);
  return { body, request, responseStatus: result.responseStatus };
}

async function submitForgedPlayerIdCommand(page, forgedPlayerId) {
  const readModel = await getRenderedReadModel(page);
  const input = {
    expectedStateVersion: readModel?.server?.stateVersion ?? null,
    focusDistrictId: readModel?.district?.districtId || readModel?.player?.homeDistrictId,
    forgedPlayerId,
    mode: readModel?.player?.mode || readModel?.mode?.mode || "free",
    serverInstanceId
  };
  return page.evaluate(async ({
    expectedStateVersion,
    focusDistrictId,
    forgedPlayerId: playerId,
    mode,
    serverInstanceId: instanceId
  }) => {
    const request = {
      command: {
        id: `command:forged-identity-probe:${crypto.randomUUID()}`,
        type: "buy-player-market-listing",
        mode,
        playerId,
        serverInstanceId: instanceId,
        issuedAt: new Date().toISOString(),
        payload: { listingId: "listing:forged-identity-probe" },
        clientRequestId: null
      },
      focusDistrictId,
      expectedStateVersion
    };
    const response = await fetch("/api/gameplay-slice/submit", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request)
    });
    return {
      body: await response.json(),
      request,
      responseStatus: response.status
    };
  }, input);
}

async function getRenderedReadModel(page) {
  const readModel = await page.evaluate(() => (
    window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
      || window.empireStreetsGameplaySliceReadModel
      || null
  ));
  expect(readModel?.server?.serverInstanceId).toBe(serverInstanceId);
  return readModel;
}

function assertAnonymousBounty(readModel, bountyId, expectedStatus = "active") {
  const bounty = readModel?.bounty?.activeBounties?.find(
    (entry) => entry.bountyId === bountyId
  );
  expect(bounty).toBeTruthy();
  expect(Object.keys(bounty).sort()).toEqual(bountyEntryKeys);
  expect(bounty).toMatchObject({
    bountyId,
    createdByLabel: "Anonym",
    isOwn: false,
    status: expectedStatus
  });
  expect(bounty).not.toHaveProperty("createdByPlayerId");
}

function claimedBountyEvents(readModel, bountyId) {
  return (readModel?.bounty?.recentBountyEvents || []).filter((event) => (
    event.bountyId === bountyId && event.type === "claimed"
  ));
}

function assertSafeMarketTransactions(readModel) {
  const transactions = readModel?.market?.recentTransactions || [];
  for (const transaction of transactions) {
    expect(Object.keys(transaction).sort()).toEqual(marketTransactionKeys);
    expect(transaction).not.toHaveProperty("id");
    expect(transaction).not.toHaveProperty("playerId");
    expect(transaction).not.toHaveProperty("auditTriggered");
  }
  return transactions;
}

function assertAllianceMembership(readModel, allianceId, targetPlayerId, memberCount) {
  const alliance = readModel?.allianceBoard?.activeAlliance;
  expect(alliance).toMatchObject({ allianceId, memberCount });
  expect(alliance.members.filter((member) => member.playerId === targetPlayerId)).toHaveLength(1);
  expect(readModel.allianceBoard.incomingInvites).toEqual([]);
}

function assertAllianceRoster(readModel, allianceId, expectedPlayerIds) {
  const alliance = readModel?.allianceBoard?.activeAlliance;
  expect(alliance).toMatchObject({ allianceId, memberCount: expectedPlayerIds.length });
  expect(alliance.members.map((member) => member.playerId).sort())
    .toEqual([...expectedPlayerIds].sort());
}

function assertAlliancePrivateStateRedacted(readModel, allianceId, privateMarker) {
  const board = readModel?.allianceBoard;
  const alliance = board?.publicAlliances?.find((entry) => entry.allianceId === allianceId);
  expect(board?.activeAlliance).toBeNull();
  expect(alliance).toBeTruthy();
  expect(alliance.chatMessages).toEqual([]);
  expect(alliance.pendingInvites).toEqual([]);
  expect(alliance.receivedInvites).toEqual([]);
  expect(alliance.defenseContributions).toEqual([]);
  expect(JSON.stringify(readModel)).not.toContain(privateMarker);
}

function findBountyId(readModel, targetPlayerId, status) {
  const bounty = readModel?.bounty?.activeBounties?.find((entry) => (
    entry.targetPlayerId === targetPlayerId && entry.status === status
  ));
  expect(bounty).toBeTruthy();
  return bounty.bountyId;
}

function findOwnListing(readModel, sellerPlayerId, resourceId) {
  const listing = readModel?.market?.playerMarket?.listings?.find((entry) => (
    entry.sellerPlayerId === sellerPlayerId
    && entry.resourceId === resourceId
    && entry.isOwn === true
  ));
  expect(listing).toBeTruthy();
  return listing;
}

function getCleanCash(readModel) {
  return Number(readModel?.player?.economy?.cleanCash || 0);
}

function assertRequestAuthority(request, expectedPlayerId) {
  expect(request.command.playerId).toBe(expectedPlayerId);
  expect(request.command.serverInstanceId).toBe(serverInstanceId);
}

function formatErrors(body) {
  return (body?.errors || [])
    .map((error) => `${error.code || "error"}: ${error.message || ""}`)
    .join(", ");
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
