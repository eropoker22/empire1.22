import { canPlayerReceiveResource } from "@empire/game-core";
import type { ServerApp } from "../../../../apps/server/src/app/server-app";
import type { CommandExecutor } from "./executor";
import type { MutableSimulationClock } from "./mutable-clock";
import type { FullGameScenario, RejectionExpectation, SimulationBot } from "./types";
import { advanceOneTick, requiredRuntime } from "./action-candidate-utils";

const expectedGameplay = (
  codes: readonly string[],
  rationale: string
): RejectionExpectation => ({
  category: "EXPECTED_GAMEPLAY_REJECTION",
  codes,
  rationale
});

const expectedConcurrency = (
  codes: readonly string[],
  rationale: string
): RejectionExpectation => ({
  category: "EXPECTED_CONCURRENCY_REJECTION",
  codes,
  rationale
});

export const establishAlliances = async (
  executor: CommandExecutor,
  server: ServerApp,
  clock: MutableSimulationClock,
  instanceId: string,
  bots: SimulationBot[],
  scenario: FullGameScenario
): Promise<void> => {
  const groupCount = scenario === "alliance-war" ? 4 : 3;
  for (let group = 0; group < groupCount; group += 1) {
    const members = bots.slice(group * 4, group * 4 + 4);
    const leader = members[0];
    if (!leader) continue;
    const created = await executor.submit(leader, "create-alliance", {
      name: `Matrix ${group + 1}`,
      tag: `M${group + 1}`,
      emblemColor: ["#ef4444", "#3b82f6", "#22c55e", "#eab308"][group]
    });
    if (!created.accepted) continue;
    advanceOneTick(server, clock, instanceId);
    const allianceId = `alliance:${created.commandId}`;
    for (const member of members.slice(1)) {
      const invite = await executor.submit(leader, "invite-alliance-member", {
        allianceId,
        targetPlayerId: member.playerId
      });
      if (!invite.accepted) continue;
      advanceOneTick(server, clock, instanceId);
      const runtime = requiredRuntime(server, instanceId);
      const pending = Object.values(runtime.state.allianceInvitesById ?? {}).find((entry) =>
        entry.allianceId === allianceId
        && entry.targetPlayerId === member.playerId
        && entry.status === "pending"
      );
      if (pending) {
        await executor.submit(member, "respond-alliance-invite", {
          inviteId: pending.id,
          response: "accept"
        });
        advanceOneTick(server, clock, instanceId);
      }
    }
    clock.advance(requiredRuntime(server, instanceId).config.tickRateMs);
    server.instanceManager.tickInstance(instanceId);
    await executor.submit(leader, "invite-alliance-member", {
      allianceId,
      targetPlayerId: bots[(groupCount * 4 + group) % bots.length]!.playerId
    }, {
      rejectionExpectation: expectedGameplay(
        ["ALLIANCE_FULL", "TARGET_ALREADY_IN_ALLIANCE"],
        "Deliberate alliance-capacity probe after canonical membership setup."
      ),
      decisionContext: { probe: "alliance-capacity" }
    });
    advanceOneTick(server, clock, instanceId);
  }
};

export const exerciseMarketConcurrency = async (
  executor: CommandExecutor,
  server: ServerApp,
  instanceId: string,
  bots: SimulationBot[]
): Promise<boolean> => {
  const seller = bots.find((bot) => bot.archetype === "market-trader") ?? bots[0]!;
  const buyers = bots.filter((bot) => bot.playerId !== seller.playerId).slice(0, 2);
  const warehouseConfig = requiredRuntime(server, instanceId).config.balance.warehouse;
  if (!warehouseConfig) return false;
  const capacityDiagnostics: Array<Record<string, unknown>> = [];
  for (const buyer of buyers) {
    const capacity = canPlayerReceiveResource(
      requiredRuntime(server, instanceId).state,
      buyer.playerId,
      "chemicals",
      1,
      warehouseConfig
    );
    capacityDiagnostics.push({ buyerId: buyer.playerId, ...capacity });
    if (!capacity.allowed) {
      const amountToEscrow = Math.max(
        1,
        capacity.currentAmount - Number(capacity.maxAmount ?? capacity.currentAmount) + 1
      );
      const escrowed = await executor.submit(buyer, "create-player-market-listing", {
        resourceId: "chemicals", amount: amountToEscrow, unitPrice: 25, paymentType: "cleanCash"
      });
      if (!escrowed.accepted) {
        console.log(`[full-game market-concurrency] ${JSON.stringify({ capacityDiagnostics, escrowFailure: escrowed.reason })}`);
        return false;
      }
    }
  }
  const created = await executor.submit(seller, "create-player-market-listing", {
    resourceId: "chemicals", amount: 1, unitPrice: 25, paymentType: "cleanCash"
  });
  if (!created.accepted) {
    console.log(`[full-game market-concurrency] ${JSON.stringify({ capacityDiagnostics, sellerFailure: created.reason })}`);
    return false;
  }
  const runtime = requiredRuntime(server, instanceId);
  const listings = (runtime.state.market as {
    playerListings?: Array<{ id: string; sellerPlayerId: string; status: string }>;
  } | undefined)?.playerListings ?? [];
  const listing = listings.find((entry) =>
    entry.sellerPlayerId === seller.playerId && entry.status === "active"
  );
  if (!listing) {
    console.log(`[full-game market-concurrency] ${JSON.stringify({ capacityDiagnostics, listingMissing: true })}`);
    return false;
  }
  const expectedVersion = runtime.state.root.version;
  const results = await Promise.all(buyers.map((buyer) => executor.submit(
    buyer,
    "buy-player-market-listing",
    { listingId: listing.id },
    {
      expectedStateVersion: expectedVersion,
      rejectionExpectation: expectedConcurrency(
        ["market_listing_not_found", "market_listing_not_active", "STATE_VERSION_MISMATCH", "server.state_version_conflict"],
        "Two buyers intentionally submit against the same active listing and state version."
      ),
      decisionContext: { probe: "single-listing-two-buyer-race", listingId: listing.id }
    }
  )));
  const accepted = results.filter((entry) => entry.accepted).length;
  console.log(`[full-game market-concurrency] ${JSON.stringify({
    capacityDiagnostics,
    listingId: listing.id,
    accepted,
    results: results.map((entry) => ({ accepted: entry.accepted, reason: entry.reason }))
  })}`);
  return accepted === 1;
};

export const exerciseIdempotence = async (
  executor: CommandExecutor,
  server: ServerApp,
  instanceId: string,
  bot: SimulationBot
): Promise<boolean> => {
  const commandId = `full-game:idempotence:${bot.playerId}`;
  const payload = { body: "Matrix idempotence probe" };
  const before = Object.keys(requiredRuntime(server, instanceId).state.cityChatMessagesById ?? {}).length;
  const first = await executor.submit(bot, "send-city-chat-message", payload, { commandId });
  const second = await executor.submit(bot, "send-city-chat-message", payload, { commandId });
  const after = Object.keys(requiredRuntime(server, instanceId).state.cityChatMessagesById ?? {}).length;
  return first.accepted && second.accepted && after === before + 1;
};
