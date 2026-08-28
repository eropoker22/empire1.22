import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  loginAndResumeHostedUiParityGame,
  waitForLiveGame
} from "./helpers/hostedUiParityEntry.js";
import {
  MAX_DURABLE_STATE_VERSION_REBASES,
  waitForTerminalGameplaySubmit
} from "./helpers/gameplaySubmitResponse.js";

const hostedEnabled = process.env.EMPIRE_HOSTED_UI_PARITY_E2E === "1";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";
const identities = parseIdentities(process.env.EMPIRE_HOSTED_BOOTSTRAP_IDENTITIES_JSON);

test.describe("hosted bounty, market and alliance through visible UI", () => {
  test.skip(
    !hostedEnabled || !serverInstanceId || identities.length !== 3,
    "Visible social coverage requires the guarded three-player hosted harness."
  );
  test.setTimeout(900_000);

  test("persists visible social commands, serializes a market race, and protects private state", async ({
    browser
  }, testInfo) => {
    const clients = [];
    try {
      for (const identity of identities) {
        const context = await browser.newContext({
          baseURL: process.env.PLAYWRIGHT_E2E_BASE_URL,
          viewport: { width: 1440, height: 900 }
        });
        const page = await context.newPage();
        page.setDefaultTimeout(20_000);
        const entry = await loginAndResumeHostedUiParityGame(page, identity);
        clients.push({ context, page, diagnostics: entry.diagnostics, identity });
      }

      const [creator, target, hunter] = clients;
      const creatorPlayerId = (await getRenderedReadModel(creator.page)).player.playerId;
      const targetPlayerId = (await getRenderedReadModel(target.page)).player.playerId;
      const hunterPlayerId = (await getRenderedReadModel(hunter.page)).player.playerId;

      const claimBounty = await createBountyThroughVisibleUi(creator.page, {
        targetPlayerId,
        rewardCleanCash: 5_000,
        isAnonymous: true
      });
      assertRequestAuthority(claimBounty.request, creatorPlayerId);
      const claimBountyId = findBountyId(
        claimBounty.body.readModel,
        targetPlayerId,
        "active"
      );

      await reloadHostedGame(target.page);
      await openBountyPanel(target.page, "active");
      const anonymousRow = target.page.locator(
        `[data-bounty-row="${claimBountyId}"]`
      );
      await expect(anonymousRow).toBeVisible();
      await expect(anonymousRow).toContainText("Anonymní");
      await expect(anonymousRow).not.toContainText(creator.identity.username);
      await testInfo.attach("bounty-anonymous-target.png", {
        body: await target.page.screenshot(),
        contentType: "image/png"
      });
      await closeBountyPanel(target.page);

      const attack = await runAttackThroughVisibleUi(hunter.page, "district:2");
      assertRequestAuthority(attack.request, hunterPlayerId);
      expect(attack.body.readModel.bounty.activeBounties).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            bountyId: claimBountyId,
            status: "claimed"
          })
        ])
      );
      expect(attack.body.readModel.bounty.recentBountyEvents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            bountyId: claimBountyId,
            type: "claimed"
          })
        ])
      );

      await reloadHostedGame(creator.page);
      expect(findBounty(
        await getRenderedReadModel(creator.page),
        claimBountyId
      )?.status).toBe("claimed");

      const cancellableBounty = await createBountyThroughVisibleUi(creator.page, {
        targetPlayerId: hunterPlayerId,
        rewardCleanCash: 6_000,
        isAnonymous: false
      });
      assertRequestAuthority(cancellableBounty.request, creatorPlayerId);
      const cancellableBountyId = findBountyId(
        cancellableBounty.body.readModel,
        hunterPlayerId,
        "active"
      );
      const cleanCashInEscrow = getCleanCash(cancellableBounty.body.readModel);
      const cancelledBounty = await cancelBountyThroughVisibleUi(
        creator.page,
        cancellableBountyId
      );
      assertRequestAuthority(cancelledBounty.request, creatorPlayerId);
      expect(findBounty(
        cancelledBounty.body.readModel,
        cancellableBountyId
      )?.status).toBe("cancelled");
      expect(getCleanCash(cancelledBounty.body.readModel))
        .toBeGreaterThanOrEqual(cleanCashInEscrow + 6_000);
      await closeBountyPanel(creator.page);

      const creatorMarketBefore = await getRenderedReadModel(creator.page);
      const creatorChemicalsBefore = getResourceBalance(
        creatorMarketBefore,
        "chemicals"
      );
      const listingCreated = await createMarketListingThroughVisibleUi(
        creator.page,
        {
          resourceId: "chemicals",
          amount: 10,
          unitPrice: 10,
          paymentType: "cleanCash"
        }
      );
      assertRequestAuthority(listingCreated.request, creatorPlayerId);
      const listing = findOwnListing(
        listingCreated.body.readModel,
        creatorPlayerId,
        "chemicals"
      );
      expect(getResourceBalance(listingCreated.body.readModel, "chemicals"))
        .toBe(creatorChemicalsBefore - 10);
      await closeMarketPanel(creator.page);

      await Promise.all([
        reloadHostedGame(target.page),
        reloadHostedGame(hunter.page)
      ]);
      await Promise.all([
        closeBountyPanel(target.page),
        closeBountyPanel(hunter.page)
      ]);
      const targetMarketBefore = await getRenderedReadModel(target.page);
      const hunterMarketBefore = await getRenderedReadModel(hunter.page);
      const buyerStates = [
        {
          client: target,
          chemicalsBefore: getResourceBalance(targetMarketBefore, "chemicals")
        },
        {
          client: hunter,
          chemicalsBefore: getResourceBalance(hunterMarketBefore, "chemicals")
        }
      ];
      await Promise.all(buyerStates.map(({ client }) =>
        openPlayerMarket(client.page)
      ));
      const peerListings = buyerStates.map(({ client }) =>
        client.page.locator(
          '.market-player-listing[data-listing-owner="peer"]'
        ).first()
      );
      await Promise.all(peerListings.map((peerListing) =>
        expect(peerListing).toBeVisible()
      ));
      await testInfo.attach("market-peer-listing.png", {
        body: await target.page.screenshot(),
        contentType: "image/png"
      });
      const buyAttempts = await Promise.all(buyerStates.map(
        async ({ client }, index) => ({
          playerId: index === 0 ? targetPlayerId : hunterPlayerId,
          result: await clickAndReadTypedSubmit(
            client.page,
            "buy-player-market-listing",
            peerListings[index].locator(".market-player-listing__buy")
          )
        })
      ));
      for (const attempt of buyAttempts) {
        assertRequestAuthority(attempt.result.request, attempt.playerId);
        expect(attempt.result.request.command.payload).toEqual({
          listingId: listing.id
        });
      }
      const acceptedBuys = buyAttempts.filter(
        (attempt) => attempt.result.body.accepted === true
      );
      const rejectedBuys = buyAttempts.filter(
        (attempt) => attempt.result.body.accepted !== true
      );
      expect(acceptedBuys).toHaveLength(1);
      expect(rejectedBuys).toHaveLength(1);
      expect(rejectedBuys[0].result.body.errors?.[0]?.code)
        .toBe("market_listing_not_found");
      for (const { result } of buyAttempts) {
        expect(findListing(result.body.readModel, listing.id)).toBeNull();
      }
      await Promise.all(buyerStates.map(({ client }) =>
        closeMarketPanel(client.page)
      ));

      await Promise.all([
        reloadHostedGame(creator.page),
        ...buyerStates.map(({ client }) => reloadHostedGame(client.page))
      ]);
      const creatorAfterRace = await getRenderedReadModel(creator.page);
      expect(getResourceBalance(creatorAfterRace, "chemicals"))
        .toBe(creatorChemicalsBefore - 10);
      const persistedBuyerStates = await Promise.all(buyerStates.map(
        async ({ client, chemicalsBefore }) => {
          const readModel = await getRenderedReadModel(client.page);
          return {
            playerId: readModel.player.playerId,
            chemicalsBefore,
            chemicalsAfter: getResourceBalance(readModel, "chemicals")
          };
        }
      ));
      expect(persistedBuyerStates.map(
        ({ chemicalsBefore, chemicalsAfter }) => chemicalsAfter - chemicalsBefore
      ).sort((left, right) => left - right)).toEqual([0, 10]);
      expect(persistedBuyerStates.find(
        ({ playerId }) => playerId === acceptedBuys[0].playerId
      )?.chemicalsAfter).toBe(
        persistedBuyerStates.find(
          ({ playerId }) => playerId === acceptedBuys[0].playerId
        )?.chemicalsBefore + 10
      );
      expect(findMatchingSafePlayerMarketTransactions(creatorAfterRace, {
        resourceId: "chemicals",
        amount: 10,
        totalPrice: 100
      })).toHaveLength(1);
      const refundListingCreated = await createMarketListingThroughVisibleUi(
        creator.page,
        {
          resourceId: "chemicals",
          amount: 5,
          unitPrice: 12,
          paymentType: "cleanCash"
        }
      );
      const refundListing = findOwnListing(
        refundListingCreated.body.readModel,
        creatorPlayerId,
        "chemicals"
      );
      const chemicalsInListing = getResourceBalance(
        refundListingCreated.body.readModel,
        "chemicals"
      );
      const ownListingCard = creator.page.locator(
        '.market-player-listing[data-listing-owner="self"]'
      ).first();
      await expect(ownListingCard).toBeVisible();
      const listingCancelled = await clickAndReadTypedSubmit(
        creator.page,
        "cancel-player-market-listing",
        ownListingCard.locator(".market-player-listing__cancel")
      );
      assertRequestAuthority(listingCancelled.request, creatorPlayerId);
      expect(listingCancelled.request.command.payload).toEqual({
        listingId: refundListing.id
      });
      expect(getResourceBalance(listingCancelled.body.readModel, "chemicals"))
        .toBe(chemicalsInListing + 5);
      expect(findListing(listingCancelled.body.readModel, refundListing.id))
        .toBeNull();
      await closeMarketPanel(creator.page);

      const allianceName = `Visible Crew ${Date.now().toString(36)}`.slice(0, 32);
      const allianceCreated = await createAllianceThroughVisibleUi(
        creator.page,
        allianceName
      );
      assertRequestAuthority(allianceCreated.request, creatorPlayerId);
      const allianceId = allianceCreated.body.readModel
        .allianceBoard.activeAlliance.allianceId;
      expect(allianceCreated.body.readModel.allianceBoard.activeAlliance)
        .toMatchObject({
          allianceId,
          name: allianceName,
          memberCount: 1
        });

      const inviteCreated = await inviteAllianceMemberThroughVisibleUi(
        creator.page,
        targetPlayerId
      );
      assertRequestAuthority(inviteCreated.request, creatorPlayerId);
      const invite = inviteCreated.body.readModel
        .allianceBoard.activeAlliance.pendingInvites.find(
          (entry) => entry.targetPlayerId === targetPlayerId
        );
      expect(invite).toBeTruthy();

      await reloadHostedGame(target.page);
      const inviteAccepted = await acceptAllianceInviteThroughVisibleUi(
        target.page,
        invite.inviteId
      );
      assertRequestAuthority(inviteAccepted.request, targetPlayerId);
      expect(inviteAccepted.body.readModel.allianceBoard.activeAlliance)
        .toMatchObject({
          allianceId,
          memberCount: 2
        });
      expect(inviteAccepted.body.readModel.allianceBoard.incomingInvites)
        .toEqual([]);

      const privateChatBody = `private-${Date.now().toString(36)}`;
      await reloadHostedGame(creator.page);
      const chatSent = await sendAllianceChatThroughVisibleUi(
        creator.page,
        privateChatBody
      );
      assertRequestAuthority(chatSent.request, creatorPlayerId);
      expect(chatSent.body.readModel.allianceBoard.activeAlliance.chatMessages)
        .toEqual(expect.arrayContaining([
          expect.objectContaining({ body: privateChatBody })
        ]));

      await reloadHostedGame(target.page);
      await openAllianceTab(target.page, "chat");
      await expect(target.page.locator("[data-alliance-chat-log]"))
        .toContainText(privateChatBody);
      await testInfo.attach("alliance-member-private-chat.png", {
        body: await target.page.screenshot(),
        contentType: "image/png"
      });
      await closeAlliancePanel(target.page);

      await reloadHostedGame(hunter.page);
      const hunterBoard = (await getRenderedReadModel(hunter.page)).allianceBoard;
      const publicAlliance = hunterBoard.publicAlliances.find(
        (entry) => entry.allianceId === allianceId
      );
      expect(hunterBoard.activeAlliance).toBeNull();
      expect(publicAlliance).toBeTruthy();
      expect(publicAlliance.chatMessages).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ body: privateChatBody })
        ])
      );
      expect(publicAlliance.pendingInvites).toEqual([]);
      expect(publicAlliance.receivedInvites).toEqual([]);
      expect(publicAlliance.defenseContributions).toEqual([]);
      await openAllianceTab(hunter.page, "alliances");
      await expect(hunter.page.locator("#alliance-modal"))
        .not.toContainText(privateChatBody);
      await closeAlliancePanel(hunter.page);

      await reloadHostedGame(creator.page);
      const persistedCreator = await getRenderedReadModel(creator.page);
      expect(findBounty(persistedCreator, claimBountyId)?.status).toBe("claimed");
      expect(findBounty(
        persistedCreator,
        cancellableBountyId
      )?.status).toBe("cancelled");
      expect(findListing(persistedCreator, listing.id)).toBeNull();
      expect(findListing(persistedCreator, refundListing.id)).toBeNull();
      expect(persistedCreator.allianceBoard.activeAlliance).toMatchObject({
        allianceId,
        memberCount: 2
      });

      for (const client of clients) {
        await expectHostedUiParityClean(client.page, client.diagnostics);
      }
      expect(creator.diagnostics.submitRequests.map(commandType)).toEqual(
        expect.arrayContaining([
          "create-bounty",
          "cancel-bounty",
          "create-player-market-listing",
          "cancel-player-market-listing",
          "create-alliance",
          "invite-alliance-member",
          "send-alliance-chat-message"
        ])
      );
      expect(target.diagnostics.submitRequests.map(commandType)).toEqual(
        expect.arrayContaining([
          "buy-player-market-listing",
          "respond-alliance-invite"
        ])
      );
      expect(hunter.diagnostics.submitRequests.map(commandType))
        .toEqual(expect.arrayContaining([
          "buy-player-market-listing",
          "attack-district"
        ]));
    } finally {
      await Promise.allSettled(clients.map((client) => client.context.close()));
    }
  });
});

async function createBountyThroughVisibleUi(page, {
  targetPlayerId,
  rewardCleanCash,
  isAnonymous
}) {
  await openBountyPanel(page, "create");
  const targetToggle = page.locator("[data-bounty-target-toggle]");
  await expect(targetToggle).toBeVisible();
  await targetToggle.click();
  const targetOption = page.locator(
    `[data-bounty-target-option="${targetPlayerId}"]`
  );
  await expect(targetOption).toBeVisible();
  await expect(targetOption).toBeEnabled();
  await targetOption.click();
  await page.locator('label:has(input[name="bounty-objective"][value="attack-player"])')
    .click();
  await page.locator('label:has(input[name="bounty-duration"][value="1"])')
    .click();
  await page.locator("#bounty-anonymous-input").setChecked(isAnonymous);
  const rewardInput = page.locator("#bounty-cash-input");
  await rewardInput.fill(String(rewardCleanCash));
  await rewardInput.dispatchEvent("input");
  const openConfirmation = page.locator("#bounty-modal-submit");
  await expect(openConfirmation).toBeEnabled();
  await openConfirmation.click();
  const confirmation = page.locator("#bounty-confirm-modal");
  await expect(confirmation).toBeVisible();
  const result = await clickAndReadTypedSubmit(
    page,
    "create-bounty",
    confirmation.locator("#bounty-confirm-modal-submit")
  );
  expect(result.request.command.payload).toMatchObject({
    targetPlayerId,
    objectiveType: "attack-player",
    targetDistrictId: null,
    rewardCleanCash,
    durationHours: 1,
    isAnonymous
  });
  expect(result.body.accepted, formatErrors(result.body)).toBe(true);
  return result;
}

async function cancelBountyThroughVisibleUi(page, bountyId) {
  await expect(page.locator("#bounty-modal")).toBeVisible();
  await page.locator('[data-bounty-tab="active"]').click();
  const cancelButton = page.locator(`[data-bounty-cancel="${bountyId}"]`);
  await expect(cancelButton).toBeVisible();
  await expect(cancelButton).toBeEnabled();
  const result = await clickAndReadTypedSubmit(
    page,
    "cancel-bounty",
    cancelButton
  );
  expect(result.request.command.payload).toEqual({ bountyId });
  expect(result.body.accepted, formatErrors(result.body)).toBe(true);
  return result;
}

async function openBountyPanel(page, tab = null) {
  const modal = page.locator("#bounty-modal");
  if (!await modal.isVisible().catch(() => false)) {
    const trigger = page.locator("[data-bounty-open-trigger]:visible").first();
    await expect(trigger).toBeVisible();
    await trigger.click();
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

async function createMarketListingThroughVisibleUi(page, {
  resourceId,
  amount,
  unitPrice,
  paymentType
}) {
  await openPlayerMarket(page);
  const form = page.locator(".market-player-form");
  await form.locator("select").nth(0).selectOption(`materials|${resourceId}`);
  await form.locator('input[type="number"]').nth(0).fill(String(amount));
  await form.locator('input[type="number"]').nth(1).fill(String(unitPrice));
  await form.locator("select").nth(1).selectOption(
    paymentType === "dirtyCash" ? "dirtyMoney" : "cleanMoney"
  );
  const result = await clickAndReadTypedSubmit(
    page,
    "create-player-market-listing",
    form.locator(".market-player-sell-button")
  );
  expect(result.request.command.payload).toEqual({
    resourceId,
    amount,
    unitPrice,
    paymentType
  });
  expect(result.body.accepted, formatErrors(result.body)).toBe(true);
  return result;
}

async function openPlayerMarket(page) {
  const popup = page.locator("[data-market-popup]");
  if (!await popup.isVisible().catch(() => false)) {
    const trigger = page.locator("[data-market-popup-open]:visible").first();
    await expect(trigger).toBeVisible();
    await trigger.click();
  }
  await expect(popup).toBeVisible();
  await expect(popup).toHaveAttribute("data-market-authoritative", "true");
  await popup.locator('[data-market-tab="player-market"]').click();
  await expect(popup).toHaveAttribute("data-market-mode", "player-market");
  await expect(popup.locator(".market-player")).toBeVisible();
}

async function closeMarketPanel(page) {
  const popup = page.locator("[data-market-popup]");
  if (!await popup.isVisible().catch(() => false)) return;
  await popup.locator("[data-market-popup-close]").last().click();
  await expect(popup).toBeHidden();
}

async function createAllianceThroughVisibleUi(page, allianceName) {
  await openAlliancePanel(page);
  const toggle = page.locator("#alliance-create-toggle-btn");
  await expect(toggle).toBeVisible();
  await expect(toggle).toBeEnabled();
  await toggle.click();
  const modal = page.locator("#alliance-create-modal");
  await expect(modal).toBeVisible();
  await modal.locator("#alliance-create-name").fill(allianceName);
  const icon = modal.locator("[data-alliance-icon-option]").nth(1);
  await expect(icon).toBeVisible();
  await icon.click();
  const color = modal.locator("[data-alliance-color-option]").nth(1);
  await expect(color).toBeVisible();
  await color.click();
  const result = await clickAndReadTypedSubmit(
    page,
    "create-alliance",
    modal.locator("#alliance-create-btn")
  );
  expect(result.request.command.payload.name).toBe(allianceName);
  expect(result.request.command.payload.tag).toBeTruthy();
  expect(result.request.command.payload.emblemColor).toMatch(/^#[0-9a-f]{6}$/iu);
  expect(result.body.accepted, formatErrors(result.body)).toBe(true);
  return result;
}

async function inviteAllianceMemberThroughVisibleUi(page, targetPlayerId) {
  await openAllianceTab(page, "invites");
  const select = page.locator("#alliance-management-invite-name");
  await expect(select).toBeEnabled();
  await select.selectOption(targetPlayerId);
  const result = await clickAndReadTypedSubmit(
    page,
    "invite-alliance-member",
    page.locator("#alliance-management-invite-btn")
  );
  expect(result.request.command.payload.targetPlayerId).toBe(targetPlayerId);
  expect(result.body.accepted, formatErrors(result.body)).toBe(true);
  return result;
}

async function acceptAllianceInviteThroughVisibleUi(page, inviteId) {
  await openAllianceTab(page, "invites");
  const button = page.locator(`[data-alliance-invite-accept="${inviteId}"]`);
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  const result = await clickAndReadTypedSubmit(
    page,
    "respond-alliance-invite",
    button
  );
  expect(result.request.command.payload).toEqual({
    inviteId,
    response: "accept"
  });
  expect(result.body.accepted, formatErrors(result.body)).toBe(true);
  return result;
}

async function sendAllianceChatThroughVisibleUi(page, body) {
  await openAllianceTab(page, "chat");
  const input = page.locator("[data-alliance-chat-input]");
  await expect(input).toBeEnabled();
  await input.fill(body);
  const result = await clickAndReadTypedSubmit(
    page,
    "send-alliance-chat-message",
    page.locator("[data-alliance-chat-send]")
  );
  expect(result.request.command.payload.body).toBe(body);
  expect(result.body.accepted, formatErrors(result.body)).toBe(true);
  return result;
}

async function openAlliancePanel(page) {
  const modal = page.locator("#alliance-modal");
  if (!await modal.isVisible().catch(() => false)) {
    await page.locator("#alliance-btn").click();
  }
  await expect(modal).toBeVisible();
}

async function openAllianceTab(page, tabId) {
  await openAlliancePanel(page);
  const tab = page.locator(`button[data-alliance-tab="${tabId}"]`);
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(page.locator("#alliance-modal"))
    .toHaveAttribute("data-alliance-tab", tabId);
}

async function closeAlliancePanel(page) {
  const modal = page.locator("#alliance-modal");
  if (!await modal.isVisible().catch(() => false)) return;
  await modal.locator("[data-alliance-modal-close]").click();
  await expect(modal).toBeHidden();
}

async function runAttackThroughVisibleUi(page, districtId) {
  const projection = await openActionTargetFromMap(page, districtId, "attack");
  const action = visibleDistrictAction(page, districtId, "attack");
  await expect(action).toBeEnabled();
  await action.click();
  const setup = page.locator("[data-attack-setup-popup]");
  await expect(setup).toBeVisible();
  await setup.locator("[data-attack-source-select]")
    .selectOption(projection.sourceDistrictId.replace(/^district:/u, ""));
  const bazookas = setup.locator('[data-attack-weapon-input="bazooka"]');
  await expect(bazookas).toBeEnabled();
  await bazookas.fill("20");
  await bazookas.dispatchEvent("input");
  const prepare = setup.locator("[data-attack-confirm]");
  await expect(prepare).toBeEnabled();
  await prepare.click();
  const result = await clickAndReadTypedSubmit(
    page,
    "attack-district",
    page.locator("[data-attack-confirm-popup] [data-attack-confirm-button]")
  );
  expect(result.request.command.payload).toMatchObject({
    districtId,
    sourceDistrictId: projection.sourceDistrictId,
    expectedConflictRevision: projection.expectedConflictRevision,
    weapons: { bazooka: 20 }
  });
  expect(result.body.accepted, formatErrors(result.body)).toBe(true);
  const close = page.locator("#attack-result-modal-close:visible");
  await close.waitFor({ state: "visible", timeout: 3_000 }).catch(() => {});
  if (await close.isVisible().catch(() => false)) await close.click();
  return result;
}

async function openActionTargetFromMap(page, districtId, actionId) {
  const numericDistrictId = Number(districtId.replace(/^district:/u, ""));
  const point = await page.evaluate((requestedDistrictId) => {
    const district = window.empireStreetsDistrictState?.getDistrictById?.(
      requestedDistrictId
    );
    const canvas = document.querySelector("[data-district-canvas]");
    const canvasHost = document.querySelector("[data-map-canvas]");
    if (
      !district
      || !(canvas instanceof HTMLCanvasElement)
      || !(canvasHost instanceof HTMLElement)
    ) {
      return null;
    }
    const rect = canvasHost.getBoundingClientRect();
    return {
      x: rect.left + (Number(district.centerX) / canvas.width) * rect.width,
      y: rect.top + (Number(district.centerY) / canvas.height) * rect.height
    };
  }, numericDistrictId);
  expect(point, `District ${districtId} must have a clickable canvas point`)
    .toBeTruthy();
  await page.mouse.click(point.x, point.y);
  const popup = page.locator("[data-district-popup]");
  await expect(popup).toBeVisible();
  await expect(popup).toHaveAttribute("data-district-id", String(numericDistrictId));
  await expect.poll(() => page.evaluate(() => (
    window.EmpireGameplaySliceClient?.getCurrentReadModel?.()?.district?.districtId
      || null
  ))).toBe(districtId);
  const projection = await page.evaluate((input) => {
    const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
      || window.empireStreetsGameplaySliceReadModel;
    const collectionKey = `${input.actionId}Targets`;
    const target = (
      readModel?.district?.targetActions?.[collectionKey]
      || readModel?.district?.[collectionKey]
      || []
    ).find((entry) => entry.districtId === input.districtId) || null;
    if (!target) return null;
    const corridor = readModel?.frontier?.corridorTargets?.find(
      (entry) => entry.targetDistrictId === input.districtId
    ) || null;
    return {
      ...target,
      sourceDistrictId: corridor?.sourceDistrictId || target.sourceDistrictId
    };
  }, { districtId, actionId });
  expect(projection, `${actionId} projection must include ${districtId}`)
    .toBeTruthy();
  expect(projection.enabled, projection.disabledReason || actionId).toBe(true);
  return projection;
}

function visibleDistrictAction(page, districtId, actionId) {
  return page.locator(
    `[data-district-popup][data-district-id="${districtId.replace(/^district:/u, "")}"]`
      + ` [data-district-action-id="${actionId}"]`
  );
}

async function clickAndReadTypedSubmit(page, commandType, button) {
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  const abortController = new AbortController();
  const responsePromise = waitForTerminalGameplaySubmit(page, (request) => (
    request?.command?.type === commandType
  ), { signal: abortController.signal });
  let submission;
  try {
    await button.click();
    submission = await responsePromise;
  } catch (error) {
    abortController.abort(error);
    await responsePromise.catch(() => {});
    throw error;
  }
  const { body, request, response } = submission;
  expect(response.status(), `${commandType} response status`).toBe(200);
  expect(
    submission.stateVersionConflicts.length,
    `${commandType} bounded OCC rebase`
  ).toBeLessThanOrEqual(MAX_DURABLE_STATE_VERSION_REBASES);
  return {
    request,
    body,
    stateVersionConflicts: submission.stateVersionConflicts
  };
}

async function reloadHostedGame(page) {
  await page.reload({ waitUntil: "load" });
  await waitForLiveGame(page);
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

function findBountyId(readModel, targetPlayerId, status) {
  const bounty = readModel?.bounty?.activeBounties?.find((entry) => (
    entry.targetPlayerId === targetPlayerId && entry.status === status
  ));
  expect(bounty, `Bounty for ${targetPlayerId} must be ${status}`).toBeTruthy();
  return bounty.bountyId;
}

function findBounty(readModel, bountyId) {
  return readModel?.bounty?.activeBounties?.find(
    (entry) => entry.bountyId === bountyId
  ) || null;
}

function findOwnListing(readModel, sellerPlayerId, resourceId) {
  const listing = readModel?.market?.playerMarket?.listings?.find((entry) => (
    entry.sellerPlayerId === sellerPlayerId
    && entry.resourceId === resourceId
    && entry.isOwn === true
  ));
  expect(listing, `Own ${resourceId} listing must be rendered`).toBeTruthy();
  return listing;
}

function findListing(readModel, listingId) {
  return readModel?.market?.playerMarket?.listings?.find(
    (entry) => entry.id === listingId
  ) || null;
}

function findMatchingSafePlayerMarketTransactions(readModel, {
  resourceId,
  amount,
  totalPrice
}) {
  const recentTransactions = readModel?.market?.recentTransactions || [];
  for (const entry of recentTransactions) {
    expect(entry).not.toHaveProperty("id");
    expect(entry).not.toHaveProperty("playerId");
    expect(entry).not.toHaveProperty("auditTriggered");
  }
  return recentTransactions.filter((entry) => (
    entry.marketType === "player"
    && entry.type === "buy"
    && entry.resourceId === resourceId
    && entry.amount === amount
    && entry.totalPrice === totalPrice
    && entry.isOwn === false
  ));
}

function getCleanCash(readModel) {
  return Number(readModel?.player?.economy?.cleanCash || 0);
}

function getResourceBalance(readModel, resourceId) {
  return Number(
    readModel?.player?.resourceBalances?.[resourceId]
    ?? readModel?.player?.economy?.resources?.[resourceId]
    ?? 0
  );
}

function assertRequestAuthority(request, expectedPlayerId) {
  expect(request.command.playerId).toBe(expectedPlayerId);
  expect(request.command.serverInstanceId).toBe(serverInstanceId);
}

function commandType(entry) {
  return entry?.command?.type;
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
