// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createResultPayloadBuilders } from '../../page-assets/js/app/runtime/resultPayloadBuilders.js';
import { resolveDistrictNumericId } from '../../page-assets/js/app/runtime/districtGossipRuntime.js';
import { createServerMapEffectsModel } from '../../page-assets/js/app/map/serverMapPresentationModel.js';
import { createStabilizationNews, createPlayerFeedbackPresentation } from '../../page-assets/js/app/runtime/playerFeedback.js';
import { createBuildingActionEntry, createBuildingActionFeedItemElement } from '../../page-assets/js/app/ui/eventFeedPanel.js';
import { selectBountyBoardEntries } from '../../page-assets/js/app/bounty-view-helpers.js';
import { observeAuthoritativeSnapshot } from '../../packages/shared-types/src/views/authoritative-snapshot-clock.js';

const epoch = Date.parse('2026-09-11T12:00:00Z');
let mono = 0;
function snapshot(tick = 0, seconds = 0, status = 'running') {
  const slice = {server:{serverInstanceId:'free:followup',currentTick:tick,status,generatedAt:new Date(epoch+seconds*1000).toISOString(),
    logicalTime:new Date(epoch+tick*10000).toISOString()},mode:{tickRateMs:10000},player:{playerId:'p1',profile:{displayName:'Moje jméno'}},
    districts:[{districtId:'district:1',isOwnedByPlayer:true,ownerPlayerId:'p1',stabilizingUntilTick:120},
      {districtId:'district:2',ownerPlayerId:'p2',ownerName:'Skutečný obránce'}],
    mapEffects:[{effectId:'public-operation:attack:district:2:0',type:'attack',districtId:'district:2',playerId:'p1',playerName:'Útočník',
      sourceDistrictId:'district:1',startedAt:new Date(epoch).toISOString(),expiresAt:new Date(epoch+1200000).toISOString(),expiresAtTick:120}]};
  observeAuthoritativeSnapshot(slice,null,mono);
  return slice;
}
function setup() {
  mono=0; vi.spyOn(performance,'now').mockImplementation(()=>mono);
  let current=snapshot();
  const marker=createServerMapEffectsModel(current).activeAttackMarkersByDistrictId.get(2);
  const builders=createResultPayloadBuilders({resolveDistrictNumericId,getGameplaySlice:()=>current,
    formatDurationLabel:ms=>`${ms/1000}s`,getWorldState:()=>({ownedDistrictIds:[2]}),startPhaseOwnerByDistrictId:new Map([[2,7]])});
  return {builders,marker,getSlice:()=>current,setSlice:slice=>{current=slice;}};
}
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();document.body.innerHTML='';});

describe('player feedback follow-up',()=>{
  it('uses fresh snapshots in an already open battle, freezes on pause and reports stale connection',()=>{
    const s=setup();const payload=s.builders.createDistrictAttackInProgressPayload({id:2},s.marker);
    mono=59000;expect(payload.getRows()[2].value).toBe('1141s');
    mono=61000;s.setSlice(snapshot(6,61));expect(payload.getRows()[2].value).toBe('1139s');
    s.setSlice(snapshot(6,61,'paused'));mono=81000;expect(payload.getRows()[2].value).toBe('Pozastaveno · 1140s');
    s.setSlice(snapshot(8,81));mono=142000;expect(payload.getRows()[2].value).toBe('Čeká na server');
  });
  it('does not attach an old battle card to a new attack on the same district',()=>{
    const s=setup();const payload=s.builders.createDistrictAttackInProgressPayload({id:2},s.marker);
    const next=snapshot(2,20);next.mapEffects[0].effectId='public-operation:attack:district:2:2';next.mapEffects[0].expiresAtTick=122;
    s.setSlice(next);expect(payload.getRows()[2].value).toBe('Čeká na výsledek serveru');
  });
  it('reads authoritative defender ownership instead of the local scenario',()=>{
    const s=setup();expect(s.builders.getResultDistrictOwnerLabel(2)).toBe('Skutečný obránce');
    expect(s.builders.getResultDistrictOwnerLabel(1)).toBe('Moje jméno');
    s.getSlice().districts[1].ownerName=null;expect(s.builders.getResultDistrictOwnerLabel(2)).toBe('Neznámý hráč');
    s.getSlice().districts[1].ownerPlayerId=null;expect(s.builders.getResultDistrictOwnerLabel(2)).toBe('Neobsazeno');
    s.getSlice().districts[1].status='destroyed';expect(s.builders.getResultDistrictOwnerLabel(2)).toBe('Zničený');
  });
  it('refreshes stabilization in the real street-news row and open detail until server confirmation',()=>{
    vi.useFakeTimers();const s=setup();
    const entry=createBuildingActionEntry(createStabilizationNews(s.getSlice(),{getSlice:s.getSlice})[0]);
    const expired=vi.fn();const element=createBuildingActionFeedItemElement(document,entry,{onExpire:expired});document.body.append(element);
    expect(element.textContent).toContain('20min 00s');
    mono=61000;s.setSlice(snapshot(6,61));vi.advanceTimersByTime(1000);
    expect(element.textContent).toContain('18min 59s');expect(entry.resultPayload.getRows()[0].value).toBe('18min 59s');
    s.setSlice(snapshot(6,61,'paused'));mono=90000;vi.advanceTimersByTime(1000);
    expect(element.textContent).toContain('Pozastaveno');expect(expired).not.toHaveBeenCalled();
    mono=1200000;s.setSlice(snapshot(119,1200));vi.advanceTimersByTime(1000);
    expect(element.textContent).toContain('Čeká na potvrzení serveru');expect(expired).not.toHaveBeenCalled();
    s.setSlice(snapshot(120,1200));vi.advanceTimersByTime(1000);expect(expired).toHaveBeenCalledTimes(1);
    expect(createStabilizationNews(s.getSlice(),{getSlice:s.getSlice})).toEqual([]);
    expect(entry.resultPayload.syncToBuildingAction).toBe(false);
    s.setSlice(snapshot(50,500,'ended'));
    expect(createStabilizationNews(s.getSlice(),{getSlice:s.getSlice})).toEqual([]);
  });
  it.each([['cancelled','Zrušeno'],['claimed','Odměna vyplacena'],['expired','Platnost vypršela']])('updates an open bounty notice after %s', (status,label)=>{
    const s=setup();s.getSlice().bounty={activeBounties:[{bountyId:'b1',status:'active',expiresAtTick:360}]};
    const payload=createPlayerFeedbackPresentation({title:'Bounty',createdAt:new Date(epoch).toISOString(),payload:{kind:'bounty-created',bountyId:'b1',rewardCleanCash:5000}},s.getSlice(),{getSlice:s.getSlice});
    expect(payload.getRows().at(-1).value).toBe('1h 00min 00s');
    s.getSlice().bounty.activeBounties[0].status=status;expect(payload.getRows().at(-1).value).toBe(label);
    s.getSlice().bounty.activeBounties=[];expect(payload.getRows().at(-1).value).toBe('Bounty již není aktivní');
  });
  it('keeps every active bounty ahead of history without mutating the shared read model',()=>{
    const history=Array.from({length:50},(_,id)=>({bountyId:`closed:${id}`,status:'cancelled',rewardCleanCash:100000}));
    const active=Array.from({length:60},(_,id)=>({bountyId:`active:${id}`,status:'active',rewardCleanCash:5000+id}));
    const entries=[...history,...active],before=JSON.stringify(entries);
    const board=selectBountyBoardEntries(entries);
    expect(board.filter(b=>b.status==='active')).toHaveLength(60);expect(board[0].bountyId).toBe('active:59');
    expect(board.filter(b=>b.status!=='active')).toHaveLength(20);expect(JSON.stringify(entries)).toBe(before);
  });
  it('wires the live server getter at both runtime call sites',()=>{
    const source=readFileSync('page-assets/js/app/runtime.js','utf8');
    const factory=source.slice(source.indexOf('function getResultPayloadBuilders()'),source.indexOf('function clearPoliceActionResultLiveTimer()'));
    expect(factory).toMatch(/getGameplaySlice:\s*getServerGameplaySliceReadModel/u);
    expect(source).toMatch(/createStabilizationNews\(latestGameplaySliceReadModel,\s*\{\s*getSlice:\s*getServerGameplaySliceReadModel/u);
  });
});
