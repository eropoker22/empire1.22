import { describe, it, expect } from 'vitest';
import { resolveModeConfig } from '@empire/game-config';
import { applyCommand, createPlayerView, createConflictReportViews } from '@empire/game-core';
import { createOpenedDistrictTargetActions } from '../../../packages/game-core/src/projections/district-target-action-projection';
import { createCombatStateFixture } from '../../fixtures/game-state-fixtures';
import { createAttackDistrictCommandFixture, createSpyDistrictCommandFixture } from '../../fixtures/command-fixtures';
import { resolvePendingDistrictAction } from '../../fixtures/timed-operation-fixtures';
import type { GameCoreContext } from '../../../packages/game-core/src/engine/context';
import type { GameCommand } from '@empire/shared-types';
const config = resolveModeConfig('free');
const epoch = Date.parse('2026-09-11T00:00:00Z');
const at = (ms: number) => new Date(epoch + ms).toISOString();
const ctx = (ms = 7200000): GameCoreContext => ({ config, clock: { now: () => new Date(at(ms)), nowIso: () => at(ms) } });
function fixture() {
  const s = createCombatStateFixture(); s.serverInstance.startedAt = at(0);
  // Distinct accounts must own distinct cash containers (the older generic combat fixture shares resource:1).
  s.playersById['player:2'].resourceStateId = 'resource:defender';
  s.resourceStatesById['resource:defender'] = { ...s.resourceStatesById['resource:1'], id: 'resource:defender', ownerId: 'player:2', balances: {cash: 1000} };
  return s;
}
const attack = () => createAttackDistrictCommandFixture({ issuedAt: at(7200000) });
const run = (s: ReturnType<typeof fixture>, type: string, playerId: string, payload: unknown, id = type) => applyCommand(s, {
  ...attack(), id, type, playerId, payload
} as GameCommand, ctx());

describe('player feedback release: authority, time, notifications', () => {
  it.each([0, 3600000, 7199999])('blocks attack before two real hours (%i ms), even with a forged issuedAt', ms => {
    const s = fixture(); const command = { ...attack(), issuedAt: at(86400000) };
    const before = JSON.stringify(s); const result = applyCommand(s, command, ctx(ms));
    expect(result.errors[0]?.code).toBe('INITIAL_ATTACK_PROTECTION');
    expect(JSON.stringify(result.nextState)).toBe(before);
    expect(result.nextState.root.notificationIds).toEqual(s.root.notificationIds);
  });
  it.each([7200000, 7200001])('accepts at and after the exact two-hour boundary during quiet hours (%i)', ms => {
    const result = applyCommand(fixture(), attack(), ctx(ms)); expect(result.errors).toEqual([]);
    expect(Object.values(result.nextState.pendingDistrictActionOperationsById || {})).toHaveLength(1);
  });
  it('delivers one incoming-attack notice to the defender, survives a snapshot and retries without duplicates', () => {
    const s = fixture(); s.playersById['player:1'].metadata = { displayName: 'Skutečný nick', gangName: 'Název gangu' };
    const accepted = applyCommand(s, attack(), ctx()); expect(accepted.errors).toEqual([]);
    const restored = JSON.parse(JSON.stringify(accepted.nextState));
    const received = createPlayerView(restored, 'player:2', ctx()).notifications.filter(n => n.category === 'player.feedback');
    expect(received).toHaveLength(1);
    expect(received[0].payload).toMatchObject({ kind: 'incoming-attack', attackerName: 'Skutečný nick', districtId: 'district:2' });
    expect(createPlayerView(restored, 'player:1', ctx()).notifications.some(n => n.category === 'player.feedback')).toBe(false);
    const retry = applyCommand(restored, attack(), ctx());
    expect(createPlayerView(retry.nextState, 'player:2', ctx()).notifications.filter(n => n.category === 'player.feedback')).toHaveLength(1);
  });
  it('projects the same start protection and the stabilization time that the command validates', () => {
    const s = fixture();
    const early = createOpenedDistrictTargetActions(s, { playerId: 'player:1', targetDistrictId: 'district:2', issuedAt: at(7190000), config }).attackTargets[0];
    expect(early).toMatchObject({ enabled: false, disabledCode: 'INITIAL_ATTACK_PROTECTION', attackUnlocksAt: at(7200000), cooldownRemainingTicks: 1 });
    s.districtsById['district:1'].stabilizingUntilTick = 25;
    const view = createOpenedDistrictTargetActions(s, { playerId: 'player:1', targetDistrictId: 'district:2', issuedAt: at(7200000), config }).attackTargets[0];
    expect(view).toMatchObject({ enabled: false, disabledCode: 'SOURCE_DISTRICT_STABILIZING', cooldownRemainingTicks: 25 });
    expect(applyCommand(s, attack(), ctx()).errors[0]).toMatchObject({ code: view.disabledCode, details: { cooldownUntilTick: 25 } });
  });
  it('keeps espionage HEAT at completion as explicitly requested', () => {
    const s = fixture(); s.notificationsById = {}; s.root.notificationIds = []; const command = createSpyDistrictCommandFixture({ issuedAt: at(7200000) });
    const before = s.policeStatesById[s.playersById['player:1'].policeStateId]?.heat || 0;
    const started = applyCommand(s, command, ctx()); expect(started.errors).toEqual([]);
    expect(started.nextState.policeStatesById[s.playersById['player:1'].policeStateId]?.heat || 0).toBe(before);
    const finished = resolvePendingDistrictAction(started.nextState, ctx());
    expect(finished.nextState.policeStatesById[s.playersById['player:1'].policeStateId]?.heat).toBe(before + config.balance.police!.spyActionHeatGain!);
  });
  it.each([false, true])('notifies the bounty target without leaking anonymous identity (%s)', anonymous => {
    const s = fixture(); s.resourceStatesById[s.playersById['player:1'].resourceStateId].balances.cash = 20000;
    s.playersById['player:1'].metadata = { displayName: 'SecretCreator' };
    const result = run(s, 'create-bounty', 'player:1', { targetPlayerId: 'player:2', targetDistrictId: 'district:2', objectiveType: 'attack-district', rewardCleanCash: 5000, durationHours: 1, isAnonymous: anonymous });
    expect(result.errors).toEqual([]);
    const notice = createPlayerView(JSON.parse(JSON.stringify(result.nextState)), 'player:2', ctx()).notifications.find(n => n.category === 'player.feedback');
    expect(notice?.payload).toMatchObject({ createdByLabel: anonymous ? 'Anonym' : 'SecretCreator', rewardCleanCash: 5000, districtId: 'district:2', expiresAtTick: 360 });
    if (anonymous) expect(JSON.stringify(notice)).not.toContain('SecretCreator');
  });
  it('credits and notifies the seller exactly once, with the actual payment currency', () => {
    const s = fixture(); s.resourceStatesById[s.playersById['player:1'].resourceStateId].balances['metal-parts'] = 10;
    const created = run(s, 'create-player-market-listing', 'player:1', { resourceId: 'metal-parts', amount: 3, unitPrice: 20, paymentType: 'cleanCash' });
    expect(created.errors).toEqual([]);
    const listingId = (created.nextState.market!.playerListings as Array<{ id: string }>)[0].id;
    const sellerCash = created.nextState.resourceStatesById[s.playersById['player:1'].resourceStateId].balances.cash;
    const bought = run(created.nextState, 'buy-player-market-listing', 'player:2', { listingId }, 'purchase'); expect(bought.errors).toEqual([]);
    const restored = JSON.parse(JSON.stringify(bought.nextState));
    const notice = createPlayerView(restored, 'player:1', ctx()).notifications.find(n => n.category === 'player.feedback');
    expect(notice?.payload).toMatchObject({ kind: 'market-sale', amount: 3, creditedAmount: 60, paymentType: 'cleanCash' });
    expect(restored.resourceStatesById[s.playersById['player:1'].resourceStateId].balances.cash).toBe(Number(sellerCash) + 60);
    const again = run(restored, 'buy-player-market-listing', 'player:2', { listingId }, 'purchase-second');
    expect(again.errors.length).toBeGreaterThan(0);
    expect(again.nextState.resourceStatesById).toEqual(restored.resourceStatesById);
    expect(createPlayerView(again.nextState, 'player:1', ctx()).notifications.filter(n => n.category === 'player.feedback')).toHaveLength(1);
  });
  it('battle reports retain actual power, losses and time for both participants', () => {
    const started = applyCommand(fixture(), attack(), ctx()); expect(started.errors).toEqual([]);
    const op = Object.values(started.nextState.pendingDistrictActionOperationsById!)[0];
    const finished = resolvePendingDistrictAction(started.nextState, ctx());
    const report = createConflictReportViews(finished.nextState, { playerId: 'player:1', limit: 10 }).find(r => r.reportType === 'battle');
    expect(report).toMatchObject({ attackPower: expect.any(Number), defensePower: expect.any(Number), attackerLosses: expect.any(Object), defenderLosses: expect.any(Object), attackDurationTicks: op.resolveAtTick - op.issuedAtTick });
    const defender = createConflictReportViews(finished.nextState, { playerId: 'player:2', limit: 10 }).find(r => r.reportType === 'battle');
    expect(defender).toMatchObject({ attackPower: report && 'attackPower' in report ? report.attackPower : undefined });
  });
});
