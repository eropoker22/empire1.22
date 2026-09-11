import { describe, expect, it } from "vitest";
import {resolveModeConfig} from '@empire/game-config';
import {applyCommand,runTick} from '@empire/game-core';
import {createCoreStateWithFixedBuildingFixture,createPlayerFixture,createDistrictFixture,createResourceStateFixture,createFixedBuildingFixture,seedSuccessfulSpyIntel} from '../../fixtures/game-state-fixtures';
import {createCraftItemCommandFixture,createOccupyDistrictCommandFixture} from '../../fixtures/command-fixtures';
import {resolveFactoryDurationTicks} from '../../../packages/game-core/src/handlers/factoryProductionShared';
import {resolveProductionSupportMultiplier} from '../../../packages/game-core/src/rules/production/productionSpeedModifiers';
const config=resolveModeConfig('free');
const epoch=Date.parse('2026-09-10T12:00:00.000Z');
const at=(tick:number)=>new Date(epoch+tick*config.tickRateMs).toISOString();
const context=(tick:number)=>({config,clock:{now:()=>new Date(at(tick)),nowIso:()=>at(tick)}});
function fixture(){
 const {state,building}=createCoreStateWithFixedBuildingFixture('factory',{playerBalances:{cash:100000,'metal-parts':20,'tech-core':20}});
 state.serverInstance.startedAt=at(0);
 return {state,building};
}
function run(state:any,type:string,playerId:string,payload:any,id:string){
 const r=applyCommand(state,{id,clientRequestId:null,type,playerId,payload,mode:'free',serverInstanceId:'instance:1',issuedAt:at(state.root.tick)} as any,context(state.root.tick));
 if(r.errors.length)throw new Error(JSON.stringify({type,errors:r.errors}));
 return r.nextState;
}
function craft(state:any,building:any,id:string){
 const command=createCraftItemCommandFixture({id,issuedAt:at(state.root.tick),payload:{districtId:building.districtId,buildingId:building.id,recipeId:'tech-core',quantity:1}});
 const r=applyCommand(state,command,context(state.root.tick));
 if(r.errors.length)throw new Error(JSON.stringify(r.errors));
 return r.nextState;
}
function advance(state:any,target:number){
 while(state.root.tick<target){const r=runTick(state,context(state.root.tick+1));if(r.nextState.root.tick<=state.root.tick)throw new Error('Tick did not advance');state=r.nextState;}
 return state;
}

function allianceFixture(type = 'factory') {
 const first = createCoreStateWithFixedBuildingFixture(type, { playerBalances: { cash: 1000000, chemicals: 1000, biomass: 1000, 'metal-parts': 1000, 'tech-core': 1000 } });
 first.state.serverInstance.startedAt = at(0); const state = first.state;
const playerIds=['player:2','player:1','player:3','player:4'];
for(const id of playerIds.filter(id=>id!=='player:1')){
 const districtId='district:audit:'+id,resourceId='resource:audit:'+id;
 state.playersById[id]=createPlayerFixture({id,accountId:'account:audit:'+id,homeDistrictId:districtId,resourceStateId:resourceId,allianceId:'alliance:audit'});
 state.districtsById[districtId]=createDistrictFixture({id:districtId,ownerPlayerId:id,buildingIds:[]});
 state.resourceStatesById[resourceId]=createResourceStateFixture({id:resourceId,ownerId:id,ownerType:'player',balances:{cash:6000}});
 state.root.playerIds.push(id);state.root.districtIds.push(districtId);
}
state.playersById['player:1'].allianceId='alliance:audit';
const joinedAt=new Date(epoch-29*3600000).toISOString();
state.alliancesById['alliance:audit']={id:'alliance:audit',serverInstanceId:'instance:1',name:'Audit',tag:'AUD',ownerPlayerId:'player:2',memberIds:playerIds,membershipByPlayerId:Object.fromEntries(playerIds.map((id,i)=>[id,{allianceId:'alliance:audit',playerId:id,role:i===0?'leader':'member',joinedAt,status:'active',lastReadyAt:joinedAt,readyDueAt:new Date(epoch-5*3600000).toISOString(),graceEndsAt:new Date(epoch-3600000).toISOString(),version:1}])),kickVotesById:{},status:'active',createdAt:joinedAt,version:1} as any;
state.root.allianceIds.push('alliance:audit');

 return first;
}
const end = (state: any, id: string) => state.buildingsById[id].productionLines['tech-core'].activeCompletesAtTick;
const output = (state: any, id: string) => Object.values(state.resourceStatesById).filter((r: any) => r.ownerType === 'building' && r.ownerId === id).reduce((n: number, r: any) => n + Number(r.balances['tech-core'] ?? 0), 0);
describe('production transition release regressions', () => {
 it.each([false, true])('retimes an accepted kick immediately, restore=%s, without early output or double costs', (restore) => {
  const first = allianceFixture(); const building = first.building;
  let state = advance(craft(first.state, building, 'craft'), 5);
  const originalEnd = end(state, building.id);
  const costs = structuredClone(state.buildingsById[building.id].productionLines!['tech-core'].reservedResourceCosts);
  state = run(state, 'start-alliance-kick-vote', 'player:2', { allianceId: 'alliance:audit', targetPlayerId: 'player:1' }, 'start');
  const voteId = Object.keys(state.alliancesById['alliance:audit'].kickVotesById!)[0];
  state = run(state, 'cast-alliance-kick-vote', 'player:2', { voteId, choice: 'yes' }, 'vote1');
  state = run(state, 'cast-alliance-kick-vote', 'player:3', { voteId, choice: 'yes' }, 'vote2');
  expect(state.playersById['player:1'].allianceId).toBeNull();
  const expected = 5 + Math.ceil((originalEnd - 5) / .8);
  expect(end(state, building.id)).toBe(expected);
  expect(state.buildingsById[building.id].productionLines!['tech-core'].reservedResourceCosts).toEqual(costs);
  if (restore) state = JSON.parse(JSON.stringify(state));
  state = advance(state, originalEnd);
  expect(output(state, building.id)).toBe(0);
  expect(end(state, building.id)).toBe(expected);
  state = advance(state, expected);
  expect(output(state, building.id)).toBe(1);
 });
 it.each([false, true])('accelerates only the remaining work when stabilization ends, restore=%s', (restore) => {
  const first = fixture(); const b = first.building;
  first.state.districtsById[b.districtId].stabilizingUntilTick = 5;
  let state = craft(first.state, b, 'stabilizing');
  const originalEnd = end(state, b.id);
  const expected = 5 + Math.ceil((originalEnd - 5) * .5);
  if (restore) state = JSON.parse(JSON.stringify(advance(state, 4)));
  state = advance(state, 5);
  expect(end(state, b.id)).toBe(expected);
  expect(output(advance(state, expected - 1), b.id)).toBe(0);
  expect(output(advance(state, expected), b.id)).toBe(1);
 });
 it('retimes a persisted due vote finalized by the scheduler', () => {
  const first = allianceFixture(); const b = first.building;
  let state = advance(craft(first.state, b, 'scheduled-craft'), 4);
  const originalEnd = end(state, b.id);
  state = run(state, 'start-alliance-kick-vote', 'player:2', { allianceId: 'alliance:audit', targetPlayerId: 'player:1' }, 'scheduled-vote');
  const vote = Object.values(state.alliancesById['alliance:audit'].kickVotesById!)[0] as import("@empire/shared-types").AllianceKickVote;
  // A pending persisted tally at its scheduler boundary (no client outcome injection).
  vote.votes = { 'player:2': 'yes', 'player:3': 'yes' }; vote.expiresAt = at(5);
  state = advance(JSON.parse(JSON.stringify(state)), 5);
  expect(state.playersById['player:1'].allianceId).toBeNull();
  const expected = 5 + Math.ceil((originalEnd - 5) / .8);
  expect(end(state, b.id)).toBe(expected);
  expect(output(advance(state, expected - 1), b.id)).toBe(0);
  expect(output(advance(state, expected), b.id)).toBe(1);
 });
 it('does not penalize work already completed at the same boundary', () => {
  const first = allianceFixture(); const b = first.building;
  let state = craft(first.state, b, 'boundary-craft');
  const due = end(state, b.id); state = advance(state, due);
  expect(output(state, b.id)).toBe(1);
  state = run(state, 'start-alliance-kick-vote', 'player:2', { allianceId: 'alliance:audit', targetPlayerId: 'player:1' }, 'boundary-vote');
  const voteId = Object.keys(state.alliancesById['alliance:audit'].kickVotesById!)[0];
  state = run(state, 'cast-alliance-kick-vote', 'player:2', { voteId, choice: 'yes' }, 'boundary-v1');
  state = run(state, 'cast-alliance-kick-vote', 'player:3', { voteId, choice: 'yes' }, 'boundary-v2');
  expect(end(state, b.id)).toBeNull(); expect(output(state, b.id)).toBe(1);
 });

 it('retimes the existing network after a real occupation, then completes captured-district stabilization', () => {
  const first = fixture(); const b = first.building; let state = first.state;
  state.playersById['player:1'].population = 200; state.districtsById[b.districtId].influence = 500;
  const captured = createFixedBuildingFixture('factory', { id: 'building:captured-factory', districtId: 'district:2', ownerPlayerId: 'player:neutral' });
  state.districtsById[b.districtId].adjacentDistrictIds = ['district:2'];
  state.districtsById['district:2'] = createDistrictFixture({ id: 'district:2', ownerPlayerId: null, zone: 'industrial', status: 'neutral', buildingIds: [captured.id], adjacentDistrictIds: [b.districtId] });
  state.buildingsById[captured.id] = captured; state.root.districtIds.push('district:2');
  seedSuccessfulSpyIntel(state, 'player:1', b.districtId, 'district:2', null);
  const started = applyCommand(state, createOccupyDistrictCommandFixture({ issuedAt: at(0) }), context(0));
  expect(started.errors).toEqual([]); state = started.nextState;
  const operation = Object.values(state.pendingOccupyOperationsById!)[0];
  state = advance(state, operation.resolveAtTick - 5);
  state = craft(state, b, 'network-before-capture');
  const oldEnd = end(state, b.id);
  state = advance(state, operation.resolveAtTick);
  expect(state.districtsById['district:2'].ownerPlayerId).toBe('player:1');
  expect(end(state, b.id)).toBe(operation.resolveAtTick + Math.ceil((oldEnd - operation.resolveAtTick) / 1.1));
  const stabilizationEnd = state.districtsById['district:2'].stabilizingUntilTick!;
  state = advance(state, stabilizationEnd - 5);
  state = craft(state, state.buildingsById[captured.id], 'captured-production');
  const slowedEnd = end(state, captured.id);
  state = advance(JSON.parse(JSON.stringify(state)), stabilizationEnd);
  const expected = stabilizationEnd + Math.ceil((slowedEnd - stabilizationEnd) * .5);
  expect(end(state, captured.id)).toBe(expected);
  expect(output(advance(state, expected - 1), captured.id)).toBe(0);
  expect(output(advance(state, expected), captured.id)).toBe(1);
 });

 it.each([
  ['pharmacy', 'chemicals', 'biomass'], ['drug_lab', 'neon-dust', 'velvet-smoke'],
  ['factory', 'metal-parts', 'tech-core'], ['armory', 'baseball-bat', 'pistol']
 ])('preserves both live recipe queues and paid inputs when %s gets a kick penalty', (type, firstRecipe, secondRecipe) => {
  const first = allianceFixture(type); const b = first.building; let state = first.state;
  for (const recipeId of [firstRecipe, secondRecipe]) {
   const result = applyCommand(state, createCraftItemCommandFixture({ id: 'multi:' + recipeId, issuedAt: at(0), payload: { districtId: b.districtId, buildingId: b.id, recipeId, quantity: 2 } }), context(0));
   expect(result.errors).toEqual([]); state = result.nextState;
  }
  state = advance(state, 5); const before = structuredClone(state.buildingsById[b.id].productionLines!);
  state = run(state, 'start-alliance-kick-vote', 'player:2', { allianceId: 'alliance:audit', targetPlayerId: 'player:1' }, 'multi-vote');
  const voteId = Object.keys(state.alliancesById['alliance:audit'].kickVotesById!)[0];
  state = run(state, 'cast-alliance-kick-vote', 'player:2', { voteId, choice: 'yes' }, 'multi-v1');
  state = run(state, 'cast-alliance-kick-vote', 'player:3', { voteId, choice: 'yes' }, 'multi-v2');
  for (const recipeId of [firstRecipe, secondRecipe]) {
   const line = state.buildingsById[b.id].productionLines![recipeId];
   expect(line.activeCompletesAtTick).toBe(5 + Math.ceil((before[recipeId].activeCompletesAtTick! - 5) / .8));
   expect(line.queuedAmount).toBe(before[recipeId].queuedAmount);
   expect(line.reservedCleanCash).toBe(before[recipeId].reservedCleanCash);
   expect(line.reservedResourceCosts).toEqual(before[recipeId].reservedResourceCosts);
  }
 });

});
