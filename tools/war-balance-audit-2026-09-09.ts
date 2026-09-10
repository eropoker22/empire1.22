import { promises as fs } from "node:fs";
import { resolveModeConfig, FREE_HOSTED_STARTING_PLAYER_STATE, FACTION_DEFINITIONS } from "@empire/game-config";
import { createInitialState, calculateIncomeByPlayerId, applyCommand } from "@empire/game-core";
import { ensureSharedCityMap, enabledSharedCitySpawnDistrictIds } from "../apps/server/src/bootstrap/gameplay-slice-shared-city-seed";
import { createPlayerFixture, createResourceStateFixture, createFixedBuildingFixture } from "../tests/fixtures/game-state-fixtures";
import { calculateFixedBuildingPassivePressureByDistrictId, calculateDistrictResourceModifierStatRatesByDistrictId, collectIncome } from "../packages/game-core/src/rules/economy/collectIncome";
import { resolvePlayerStorageCapacitySummary } from "../packages/game-core/src/handlers/storageCapacityResolver";
import { resolveFactoryDurationTicks } from "../packages/game-core/src/handlers/factoryProductionShared";
import { resolveArmoryDurationTicks } from "../packages/game-core/src/handlers/armoryProductionShared";
import { resolveProductionLineDurationTicks } from "../packages/game-core/src/handlers/productionLineShared";
import { calculateProductionUpgradeCost } from "../packages/game-core/src/rules/buildings/buildingUpgradeRules";
import { resolveQuietHoursResumeTick, isTickInEliminationQuietHours } from "../packages/game-core/src/rules/elimination/eliminationConfig";
import { estimateFinalLockdownEndTick } from "../packages/game-core/src/rules/victory/finalLockdownLifecycle";
import { calculatePlayerPolicePressure } from "../packages/game-core/src/rules/police/policePressure";
import { getServerTotalMoney, getInflationFactor } from "../packages/game-core/src/rules/market/serverMarketSystem";
import { resolveCombat } from "../packages/game-core/src/rules/combat/resolveCombat";
import { resolveStockExchangeAction } from "../packages/game-core/src/handlers/stockExchangeActionResolution";
import { createCoreStateWithFixedBuildingFixture } from "../tests/fixtures/game-state-fixtures";
const config = resolveModeConfig("free"), balance = config.balance as any;
const context = { config, clock: { now: () => new Date("2026-09-09T08:00:00Z"), nowIso: () => "2026-09-09T08:00:00Z" } };
const base = createInitialState("instance:1", "free");
ensureSharedCityMap(base, "instance:1", {buildSlotLimit: balance.buildSlotLimit, productionBuildings: balance.productionBuildings ?? {}, robbery: balance.conflict.robbery});
const production = {pharmacy:"pharmacy",drug_lab:"drugLab",factory:"factory",armory:"armory"};
const player = createPlayerFixture({ population:150 });
function stateFor(ids: string[], factionId:any="mafian", starters=true) {
  const state = createInitialState("instance:1", "free");
  state.playersById[player.id] = {...player, factionId, homeDistrictId:ids[0]}; state.root.playerIds=[player.id];
  state.resourceStatesById[player.resourceStateId] = createResourceStateFixture({id:player.resourceStateId,ownerId:player.id,ownerType:"player", balances:{...FREE_HOSTED_STARTING_PLAYER_STATE.materials,cash:6000,"dirty-cash":3000}});
  state.root.districtIds=[...ids];
  for (const id of ids) {
    const d = structuredClone(base.districtsById[id]); d.ownerPlayerId=player.id;d.status="claimed";d.influence=id===ids[0]?15:0;
    state.districtsById[id]=d;
    for(const bid of d.buildingIds) state.buildingsById[bid]={...structuredClone(base.buildingsById[bid]),ownerPlayerId:player.id};
  }
  if(starters)for(const type of Object.keys(production)) {
    const d=state.districtsById[ids[0]];
    if(d.buildingIds.some(id=>state.buildingsById[id].buildingTypeId===type))continue;
    const building=createFixedBuildingFixture(type,{id:`audit:${ids[0]}:${type}`,districtId:ids[0]});
    state.buildingsById[building.id]=building;d.buildingIds.push(building.id);
  }
  return state;
}
function rates(state:any) {
  const phases: Array<Record<string, number>>=[];
  for(const tick of [0,balance.dayLengthTicks]) {
    const phaseState={...state,root:{...state.root,tick}};
    const income=calculateIncomeByPlayerId(phaseState,context)[player.id]??{};
    const pressure=calculateFixedBuildingPassivePressureByDistrictId(phaseState,context),zone=calculateDistrictResourceModifierStatRatesByDistrictId(phaseState,context);
    phases.push({clean:(income.cash??0)*360,dirty:(income["dirty-cash"]??0)*360,heat:Object.values(pressure).reduce((a:any,r:any)=>a+r.heatPerTick,0)*360+Object.values(zone).reduce((a:any,r:any)=>a+r.heatPerTick,0)*360,influence:Object.values(pressure).reduce((a:any,r:any)=>a+r.influencePerTick,0)*360});
  }
  let initial=collectIncome(state,context); initial.root={...initial.root,tick:6};
  const after=collectIncome(initial,context);
  const population=Object.values(after.buildingsById).filter((b:any)=>["apartment_block","school","convenience_store"].includes(b.buildingTypeId)).map((b:any)=>{
    const m=b.metadata?.apartmentBlock??b.metadata?.school??b.metadata?.convenienceStore??{};
    return {type:b.buildingTypeId,perHour:Number(m.storedPopulation??m.storedStudents??0)*60,capacity:m.lastCapacity??m.lastStudentCapacity??m.populationCapacity??null,metadata:m};
  });
  return {day:phases[0],night:phases[1],average:Object.fromEntries(Object.keys(phases[0]).map(key=>[key,(phases[0][key]+phases[1][key])/2])),population,storage:resolvePlayerStorageCapacitySummary(state,player.id,balance.warehouse).groups.map(g=>({id:g.id,capacity:g.currentCapacity}))};
}
const eligible=enabledSharedCitySpawnDistrictIds.filter(id=>["residential","park"].includes(base.districtsById[id]?.zone));
const starts=eligible.map(id=>{const s=stateFor([id]);return {id,zone:base.districtsById[id].zone,buildings:Object.values(s.buildingsById).map(b=>b.buildingTypeId),...rates(s)};});
const portfolios: Array<{zone:string;size:number;ids:string[];counts:Record<string,number>} & ReturnType<typeof rates>>=[];
for(const zone of ["residential","park"]) {
  const candidates=starts.filter(s=>s.zone===zone).sort((a,b)=>a.average.clean-b.average.clean);
  const start=candidates[Math.floor(candidates.length/2)]; if(!start)continue;
  const ids=[start.id];
  for(let size=1;size<=10;size++) {
    if(size>1){const choices=[...new Set(ids.flatMap(id=>base.districtsById[id].adjacentDistrictIds))].filter(id=>!ids.includes(id)&&base.districtsById[id].zone!=="downtown").sort();ids.push(choices[0]);}
    if([1,3,5,10].includes(size)){const s=stateFor(ids);portfolios.push({zone,size,ids:[...ids],counts:Object.values(s.buildingsById).reduce((r:any,b)=>{r[b.buildingTypeId]=(r[b.buildingTypeId]??0)+1;return r;},{}),...rates(s)});}
  }
}
const recipeById:any=Object.fromEntries(Object.entries(production).flatMap(([type,key])=>Object.entries(balance[key].recipes).map(([id,r])=>[id,{type,...r as any}])));
function cost(id:string):number{const r=recipeById[id];return r?((r.cleanCashCostPerUnit??0)+Object.entries(r.inputCosts??{}).reduce((s:number,[k,n])=>s+Number(n)*cost(k),0))/(r.outputAmount??1):0;}
function dependencies(id:string,quantity=1,result:any={}):any{const r=recipeById[id];result[id]=(result[id]??0)+quantity;for(const [k,n]of Object.entries(r.inputCosts??{}))dependencies(k,quantity*Number(n),result);return result;}
const recipeState=stateFor([starts[0].id]);
// Isolated four-building fixture for speed, without incidental infrastructure/network bonuses.
recipeState.buildingsById={};recipeState.districtsById[starts[0].id].buildingIds=[];
for(const type of Object.keys(production)){const b=createFixedBuildingFixture(type,{districtId:starts[0].id});recipeState.buildingsById[b.id]=b;recipeState.districtsById[starts[0].id].buildingIds.push(b.id);}
function seconds(id:string,level=1,phase="day",faction="mafian") {
  const r=recipeById[id],b={...Object.values(recipeState.buildingsById).find(b=>b.buildingTypeId===r.type)!,level};
  const s={...recipeState,playersById:{...recipeState.playersById,[player.id]:{...player,factionId:faction}},root:{...recipeState.root,tick:phase==="day"?0:balance.dayLengthTicks}} as any;
  return (r.type==="factory"?resolveFactoryDurationTicks(s,b,r,context):r.type==="armory"?resolveArmoryDurationTicks(s,b,r,context):resolveProductionLineDurationTicks(s,b,r,context))*10;
}
const recipes=Object.entries(recipeById).map(([id,r]:any)=>({id,type:r.type,cost:cost(id),inputCosts:r.inputCosts,queueCap:r.queueCap,localCap:r.localOutputCap,baseSeconds:r.durationTicksPerUnit*10,daySeconds:seconds(id),nightSeconds:seconds(id,1,"night"),dayLocalFullMinutes:seconds(id)*r.localOutputCap/60,dayQueueMinutes:seconds(id)*r.queueCap/60,level14DaySeconds:seconds(id,14),level14LocalFullMinutes:seconds(id,14)*r.localOutputCap/60,dependencies:dependencies(id)}));
const upgrades=Object.entries(production).map(([type,key])=>({type,levels:[2,3,4,5,6,8,10,12,14].map(level=>({level,speed:1+.1*(level-1),cost:calculateProductionUpgradeCost(balance[key].upgrade,level),total:Array.from({length:level-1},(_,i)=>calculateProductionUpgradeCost(balance[key].upgrade,i+2)).reduce((a,b)=>a+b,0)}))}));
const boostCosts=Object.values(balance.playerBoosts).map((boost:any)=>({id:boost.boostId,fullCost:boost.cleanCashCost+Object.entries(boost.inputCosts).reduce((s:number,[id,n])=>s+Number(n)*cost(id),0),durationMinutes:boost.activeDurationTicks/6,cooldownMinutes:boost.cooldownTicks/6,dependencies:Object.entries(boost.inputCosts).reduce((all:any,[id,n])=>dependencies(id,Number(n),all),{}),effect:boost.effect}));
function cachedFinalEnd(state:any,remaining:number) {
  let tick=state.root.tick;const cache=new Map<number,boolean>();
  while(remaining>0){tick++;const bucket=Math.floor(tick/360);if(!cache.has(bucket))cache.set(bucket,isTickInEliminationQuietHours(state,balance.elimination,tick,config.tickRateMs));if(!cache.get(bucket))remaining--;}
  return tick;
}
const lifecycle=[];const lifecycleChecks=[];
for(const count of [5,10,20])for(const combatLosses of [0,2,4,8].filter(n=>n<count))for(let localStart=0;localStart<24;localStart++) {
  const state=stateFor([starts[0].id]);state.serverInstance.startedAt=new Date(Date.UTC(2026,8,9,localStart-2)).toISOString();
  const threshold=Math.min(8,Math.max(1,count-1));let active=count,at=0,nextPurge=balance.elimination.firstEliminationTick,remainingCombat=combatLosses;const eliminations=[];
  while(active>threshold){let due=nextPurge;due=resolveQuietHoursResumeTick(state,balance.elimination,due,config.tickRateMs)??due;
    if(remainingCombat&&due>=12*360){at=12*360;active=Math.max(1,active-remainingCombat);remainingCombat=0;if(active<=threshold)break;}
    at=due;active--;eliminations.push(at/360);nextPurge=at+balance.elimination.intervalTicks;
  }
  state.root.tick=at;state.finalLockdownState={status:"active",remainingActiveTicks:balance.finalLockdown.activeDurationTicks} as any;
  const end=cachedFinalEnd(state,balance.finalLockdown.activeDurationTicks);
  if(count===20&&combatLosses===0&&[0,21].includes(localStart)){const authoritative=estimateFinalLockdownEndTick(state,context);if(authoritative!==end)throw new Error(`Lifecycle mismatch ${end} vs ${authoritative}`);lifecycleChecks.push({localStart,endTick:end,authoritativeEndTick:authoritative});}
  lifecycle.push({count,combatLosses,localStart,finalStartHours:at/360,endHours:end/360,eliminations});
}
const storageMatrix=[];
for(const count of [0,1,2,3,5])for(const level of [1,2,3,4]) {const s=structuredClone(recipeState);for(let i=0;i<count;i++){const b=createFixedBuildingFixture("warehouse",{id:`warehouse:${i}`,districtId:starts[0].id,level});s.buildingsById[b.id]=b;s.districtsById[starts[0].id].buildingIds.push(b.id);}storageMatrix.push({count,level,groups:resolvePlayerStorageCapacitySummary(s,player.id,balance.warehouse).groups.map(g=>({id:g.id,capacity:g.currentCapacity}))});}
const inflation=[5,10,20].map(count=>{const s=stateFor([starts[0].id]);s.playersById={};s.resourceStatesById={};for(let i=0;i<count;i++){const p={...player,id:`p:${i}`,resourceStateId:`r:${i}`};s.playersById[p.id]=p;s.resourceStatesById[p.resourceStateId]=createResourceStateFixture({id:p.resourceStateId,ownerType:"player",ownerId:p.id,balances:{cash:6000,"dirty-cash":3000}});}return {count,weightedMoney:getServerTotalMoney(s),factor:getInflationFactor(s)};});
const combat=[5,50].flatMap(size=>["clean","costly","failure"].map(tier=>{const r=resolveCombat({attackLoadoutAfterTrap:{"baseball-bat":size},defenseLoadout:{barricades:20},trapBlocked:false,districtDestroyed:false,effectiveAttackPower:tier==="clean"?400:tier==="costly"?260:200,effectiveDefensePower:240,trapLosses:{},heatGain:8});return {size,tier,losses:r.attackerLosses,defenderLosses:r.defenderLosses};}));
const checkins=recipes.map(r=>({id:r.id,level1:[15,60,120,360,480].map(minutes=>({minutes,itemsPerVisit:Math.min(r.localCap,Math.floor(minutes*60/r.daySeconds)),itemsPerHour:Math.min(r.localCap,Math.floor(minutes*60/r.daySeconds))*60/minutes})),level14:[15,60,120].map(minutes=>({minutes,itemsPerVisit:Math.min(r.localCap,Math.floor(minutes*60/r.level14DaySeconds))}))}));
const competitiveLifecycle=lifecycle.map(row=>{
  const state=stateFor([starts[0].id]);state.serverInstance.startedAt=new Date(Date.UTC(2026,8,9,row.localStart-2)).toISOString();
  const window=balance.finalLockdown.competitiveWindow;
  const at=row.count >= window.minimumStartingPlayers ? Math.min(window.latestStartTick,Math.max(window.earliestStartTick,row.finalStartHours*360)) : row.finalStartHours*360;state.root.tick=at;
  return {count:row.count,combatLosses:row.combatLosses,localStart:row.localStart,finalStartHours:at/360,endHours:cachedFinalEnd(state,balance.finalLockdown.activeDurationTicks)/360};
});
// Cover the hard-deadline branch independently; it can occur when purge timing changes.
const proposedDeadline=Array.from({length:24},(_,hour)=>{const state=stateFor([starts[0].id]);state.serverInstance.startedAt=new Date(Date.UTC(2026,8,9,hour-2)).toISOString();state.root.tick=78*360;return{localStart:hour,endHours:cachedFinalEnd(state,balance.finalLockdown.activeDurationTicks)/360};});
const factions=FACTION_DEFINITIONS.flatMap(f=>portfolios.filter(p=>p.size===1).map(p=>({faction:f.id,zone:p.zone,...rates(stateFor(p.ids,f.id))})));
const quests=balance.cityEvents.definitions.map((q:any)=>{
  const rewardValue=Object.entries(q.reward??{}).reduce((sum:number,[key,n])=>sum+Number(n)*(key==="cash"?1:key==="dirty-cash"?.7:cost(key)),0);
  const p=q.successRate/100;
  const expectedValue=p*rewardValue-(1-p)*Number(q.risk?.failureDirtyCashLoss??0)*.7;
  return {id:q.id,agent:q.agentId,difficulty:q.difficulty,minutes:q.durationMinutes,successRate:q.successRate,rewardValue,expectedValue,expectedValuePerHour:expectedValue*60/q.durationMinutes,expectedInfluence:p*Number(q.reward?.influence??0),expectedHeat:p*Number(q.risk?.successHeat??0)+(1-p)*Number(q.risk?.failureHeat??0)};
});
const speculationFixture=createCoreStateWithFixedBuildingFixture("stock_exchange",{playerBalances:{cash:100000}});
const speculationRows=[];
for(let seed=0;seed<10000;seed++){
  speculationFixture.state.serverInstance.worldSeed=`stock-audit-${seed}`;
  const result=resolveStockExchangeAction({state:speculationFixture.state,building:speculationFixture.building,action:balance.buildingActions.speculative_buy,balances:{cash:100000},config:balance.stockExchange,tickRateMs:config.tickRateMs,commandId:`client:${seed}`,payload:{districtId:speculationFixture.building.districtId,buildingId:speculationFixture.building.id,actionId:"speculative_buy",investmentCleanCash:10000,targetCategory:"materials"}})!;
  speculationRows.push({profit:result.balances.cash-100000,outcome:result.stockExchangeResult?.outcome});
}
const speculation={runs:speculationRows.length,investment:10000,fee:balance.stockExchange.speculativeBuy.costCleanCash,meanNetProfit:speculationRows.reduce((sum,r)=>sum+r.profit,0)/speculationRows.length,minNetProfit:Math.min(...speculationRows.map(r=>r.profit)),maxNetProfit:Math.max(...speculationRows.map(r=>r.profit)),outcomes:speculationRows.reduce((all:Record<string,number>,r)=>{const key=String(r.outcome);all[key]=(all[key]??0)+1;return all;},{})};
const out={date:"2026-09-09",method:"authoritative isolated rate/capacity/recipe functions; lifecycle timing scenarios, NOT a full multiplayer simulation",startingAssumption:{cleanCash:6000,dirtyCash:3000,population:150,influence:15,zones:["residential","park"],materials:FREE_HOSTED_STARTING_PLAYER_STATE.materials},starts,portfolios,recipes,upgrades,boostCosts,lifecycle,lifecycleChecks,storageMatrix,inflation,combat,checkins,competitiveLifecycle,proposedDeadline,factions,quests,speculation};
await fs.writeFile(".tmp/war-balance-numbers.json",JSON.stringify(out,null,2));
console.log(JSON.stringify({starts:starts.length,portfolios:portfolios.length,recipes:recipes.length,lifecycle:lifecycle.length,boostCosts,rangeByZone:["residential","park"].map(zone=>{const a=starts.filter(s=>s.zone===zone);return {zone,count:a.length,cleanMin:Math.min(...a.map(s=>s.average.clean)),cleanMax:Math.max(...a.map(s=>s.average.clean)),noPopulation:a.filter(s=>s.population.length===0).length};})}));
