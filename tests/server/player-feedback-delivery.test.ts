import { expect, it } from 'vitest';
import { createServerApp } from '../../apps/server/src/app';
import { createDevGameplaySession } from '../helpers/gameplay-session-test-helpers';
import { seedSuccessfulSpyIntel } from '../fixtures/game-state-fixtures';
import { createGameplaySliceProjection } from '../../apps/server/src/runtime/projections/gameplay-slice-projection-service';
import { createInstanceSnapshot } from '../../apps/server/src/runtime/persistence/mappers';
import { createAttackDistrictCommandFixture } from '../fixtures/command-fixtures';

it('persists an incoming attack and projects one canonical deadline to both authenticated players', async () => {
  const server = createServerApp();
  const instanceId = 'instance:free:feedback-delivery';
  const attackerSession = await createDevGameplaySession(server, {serverInstanceId: instanceId, playerId: 'player:feedback-a', autoSelectSpawn: true});
  const defenderSession = await createDevGameplaySession(server, {serverInstanceId: instanceId, playerId: 'player:feedback-b', factionId: 'kult', autoSelectSpawn: true});
  const runtime = server.instanceManager.getInstanceById(instanceId)!;
  const attacker = runtime.state.playersById[attackerSession.playerId];
  const defender = runtime.state.playersById[defenderSession.playerId];
  const source = runtime.state.districtsById[attacker.homeDistrictId!];
  const target = runtime.state.districtsById[defender.homeDistrictId!];
  source.adjacentDistrictIds.push(target.id); target.adjacentDistrictIds.push(source.id);
  runtime.state.resourceStatesById[attacker.resourceStateId].balances['baseball-bat'] = 2;
  attacker.population = 150; attacker.metadata = {...attacker.metadata, displayName: 'Útočící nick', gangName: 'Gang'};
  const now = runtime.clock.now().getTime();
  runtime.state.serverInstance.startedAt = new Date(now - 7200000).toISOString();
  runtime.state.serverInstance.calendarAnchor = {tick: runtime.state.root.tick, at: new Date(now).toISOString()};
  seedSuccessfulSpyIntel(runtime.state, attacker.id, source.id, target.id, defender.id);
  const command = createAttackDistrictCommandFixture({id: 'attack:feedback', serverInstanceId: instanceId, playerId: attacker.id,
    issuedAt: runtime.clock.nowIso(), payload: {districtId: target.id, sourceDistrictId: source.id, weapons: {'baseball-bat': 1}}});
  const result = await server.gameplaySliceTransport.submit({sessionToken: attackerSession.sessionToken, expectedStateVersion: runtime.state.root.version, focusDistrictId: target.id, command});
  expect(result.accepted, JSON.stringify(result.errors)).toBe(true);
  const defenderLoad = await server.gameplaySliceTransport.load({...defenderSession.loadRequest, districtId: target.id});
  expect(defenderLoad.accepted).toBe(true);
  const notice = defenderLoad.readModel!.player.notifications.find(n => n.category === 'player.feedback');
  expect(notice?.payload).toMatchObject({kind: 'incoming-attack', attackerName: 'Útočící nick', districtId: target.id});
  const originalClock = runtime.clock;
  const left = createGameplaySliceProjection(runtime, attacker.id, target.id).mapEffects.find(e => e.type === 'attack')!;
  const right = createGameplaySliceProjection({...runtime, clock: {now: () => new Date(now + 4500), nowIso: () => new Date(now + 4500).toISOString()}}, defender.id, target.id).mapEffects.find(e => e.type === 'attack')!;
  expect(left.expiresAt).toBe(right.expiresAt);
  expect(left.playerName).toBe('Útočící nick'); expect(left.sourceDistrictId).toBe(source.id);
  expect(left.expiresAtTick).toBe(notice!.payload.resolveAtTick);
  const snapshot = createInstanceSnapshot(runtime);
  expect(JSON.stringify(snapshot)).toContain(notice!.id);
  runtime.state = JSON.parse(JSON.stringify(runtime.state)); // Cold state read, no retained operation references.
  const recovered = createGameplaySliceProjection({...runtime, clock: originalClock}, defender.id, target.id);
  expect(recovered.mapEffects.find(e => e.type === 'attack')?.expiresAt).toBe(left.expiresAt);
  expect(recovered.player.notifications.filter(n => n.id === notice!.id)).toHaveLength(1);
  server.instanceManager.stopInstance(instanceId);
});
