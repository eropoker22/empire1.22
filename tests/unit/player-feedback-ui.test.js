// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderPlayerMarketPanel } from '../../page-assets/js/app/ui/marketPanel.js';
import { createPlayerFeedbackSync, createPlayerFeedbackPresentation, renderDistrictBountyNotice } from '../../page-assets/js/app/runtime/playerFeedback.js';
import { createServerBattleReportPresentation } from '../../page-assets/js/app/runtime/serverBattleReportPresentation.js';
import { createServerDistrictActionPresentation } from '../../page-assets/js/app/runtime/serverDistrictActionPresentation.js';
import { renderDistrictActionButton } from '../../page-assets/js/app/ui/districtActionHub.js';
import { createServerMapEffectsModel } from '../../page-assets/js/app/map/serverMapPresentationModel.js';
import { observeAuthoritativeSnapshot } from '../../packages/shared-types/src/views/authoritative-snapshot-clock.js';
import { normalizeCityFeedEvents } from '../../page-assets/js/app/ui/rumorFeedPanel.js';
import { deduplicateRumorEntries } from '../../page-assets/js/app/runtime/rumorDeduplication.js';
import { openOverlay, closeOverlay, getTopOverlay } from '../../page-assets/js/app/ui/legacyOverlayCoordinator.js';
import { renderPoliceActionResultPanel } from '../../page-assets/js/app/ui/policeActionResultPanel.js';
import { createBuildingActionEntry, restoreBuildingActionEntries } from '../../page-assets/js/app/ui/eventFeedPanel.js';
import { readFileSync } from 'node:fs';
const epoch = Date.parse('2026-09-11T12:00:00Z');
const slice = (offset=0) => ({server: {serverInstanceId:'free:feedback',generatedAt:new Date(epoch+offset).toISOString(),logicalTime:new Date(epoch).toISOString(),status:'running',currentTick:0},mode:{tickRateMs:10000},player:{playerId:'p1'},district:{districtId:'district:2'},mapEffects:[]});
afterEach(() => {vi.useRealTimers(); vi.restoreAllMocks(); document.body.innerHTML='';localStorage.clear();});
function market(formState) {
 const root=document.createElement('div');document.body.append(root);const onState=vi.fn(); const submit=vi.fn();
 const data={sellableItems:[{inventory:'materials',itemId:'chemicals',name:'Chemikálie',amount:24,maxUnitPrice:1000}],ownListingCount:0,ownListingLimit:5,listings:[],formState};
 renderPlayerMarketPanel(root,data,{getSuggestedUnitPrice:()=>450,onFormStateChange:onState,onCreateListing:submit});
 return {root,inputs:root.querySelectorAll('input'),button:root.querySelector('.market-player-sell-button'),onState,submit};
}
function input(element,value){element.value=value;element.dispatchEvent(new Event('input',{bubbles:true}));}
describe('player feedback UI',()=>{
 it('allows empty and multi-digit amount/price drafts, caps only excess inventory, and restores the empty draft',()=>{
   const m=market();input(m.inputs[0],'');expect(m.inputs[0].value).toBe('');expect(m.button.disabled).toBe(true);
   input(m.inputs[0],'1');input(m.inputs[0],'12');expect(m.inputs[0].value).toBe('12');
   input(m.inputs[0],'200');expect(m.inputs[0].value).toBe('24');input(m.inputs[0],'7');
   input(m.inputs[1],'');expect(m.inputs[1].value).toBe('');expect(m.button.disabled).toBe(true);
   const restored=market(m.onState.mock.lastCall[0]);expect(restored.inputs[1].value).toBe('');expect(restored.inputs[0].value).toBe('7');
   input(restored.inputs[1],'2');input(restored.inputs[1],'25');expect(restored.inputs[1].value).toBe('25');
   restored.button.click();expect(restored.submit).toHaveBeenCalledWith(expect.objectContaining({requestedAmount:7,unitPrice:25}));
 });
 it('never silently publishes a price outside the allowed range',()=>{const m=market();input(m.inputs[1],'1001');expect(m.inputs[1].value).toBe('1001');m.button.click();expect(m.submit).not.toHaveBeenCalled();});
 it('delivers and logs each notice once and retains clickable history on reload',()=>{
   const s=slice();s.player.notifications=[{id:'sale:1',category:'player.feedback',title:'Prodáno',createdAt:new Date(epoch).toISOString(),payload:{kind:'market-sale',amount:2,resourceId:'chemicals',creditedAmount:900,paymentType:'cleanCash'}}];
   const append=vi.fn(),open=vi.fn();const deps={root:document.body,append,open,getSlice:()=>s,storage:localStorage};
   const sync=createPlayerFeedbackSync(deps);sync(s);sync(s);expect(open).toHaveBeenCalledTimes(1);expect(append).toHaveBeenCalledTimes(1);
   createPlayerFeedbackSync(deps)(s);expect(open).toHaveBeenCalledTimes(1);expect(append).toHaveBeenCalledTimes(2);
   expect(append.mock.calls[0][2].summary).toContain('900 čistých');
 });
 it('keeps separate server-confirmed sales with identical amounts in the real street-news feed',()=>{
   const s=slice();s.player.notifications=[1,2].map(id=>({id:`sale:${id}`,category:'player.feedback',title:'Prodáno',
     createdAt:new Date(epoch+id*1000).toISOString(),payload:{kind:'market-sale',amount:2,resourceId:'chemicals',creditedAmount:900,paymentType:'cleanCash'}}));
   const entries=[];
   createPlayerFeedbackSync({root:document.body,getSlice:()=>s,storage:localStorage,open:vi.fn(),
     append:(_root,kind,payload,snapshot)=>entries.push(createBuildingActionEntry({...snapshot,resultKind:kind,resultPayload:payload}))})(s);
   const restored=restoreBuildingActionEntries([...entries,entries[0]],epoch+3000);
   expect(restored.map(entry=>entry.id)).toEqual(['sale:1','sale:2']);
 });
 it('does not mistake an attacker nickname for an expired police notice',()=>{
   const s=slice();const notification={id:'attack:police-name',title:'Příchozí útok',createdAt:new Date(epoch).toISOString(),
     payload:{kind:'incoming-attack',attackerName:'Policejní zásah',districtId:'district:2'}};
   const payload=createPlayerFeedbackPresentation(notification,s);
   const entry=createBuildingActionEntry({id:notification.id,sourceKind:'player-feedback',title:payload.title,
     summary:payload.summary,resultKind:'police',resultPayload:payload,timestampMs:epoch});
   expect(restoreBuildingActionEntries([entry],epoch)).toHaveLength(1);
 });
 it('renders only active matching bounty targets and respects the anonymous issuer',()=>{
   document.body.innerHTML='<div data-district-popup-card></div>';const s=slice();s.district.ownerPlayerId='p2';
   s.bounty={activeBounties:[{status:'active',targetDistrictId:'district:2',targetPlayerId:'p2',remainingTicks:5,remainingMs:50000,createdByLabel:'Anonym',rewardCleanCash:6000},{status:'active',targetDistrictId:'district:3',remainingTicks:5,createdByLabel:'Other',rewardCleanCash:9000}]};
   renderDistrictBountyNotice(document.body,s,'district:2');const badge=document.querySelector('[data-district-bounty-notice]');
   expect(badge.textContent).toContain('Anonym');expect(badge.textContent).not.toContain('Other');expect(badge.hidden).toBe(false);
   s.bounty.activeBounties[0].status='claimed';renderDistrictBountyNotice(document.body,s,'district:2');expect(badge.hidden).toBe(true);
 });
 it('shows the same attack countdown from differently timed snapshots and ignores a changed device clock',()=>{
   const a=slice(0),b=slice(4500);const effect={effectId:'attack:1',type:'attack',districtId:'district:2',playerId:'p1',playerName:'Nick',sourceDistrictId:'district:1',startedAt:new Date(epoch).toISOString(),expiresAt:new Date(epoch+60000).toISOString(),expiresAtTick:6};
   a.mapEffects=[effect];b.mapEffects=[effect];observeAuthoritativeSnapshot(a,null,100);observeAuthoritativeSnapshot(b,null,4600);
   vi.spyOn(performance,'now').mockReturnValue(4600);
   const left=createServerMapEffectsModel(a).activeAttackMarkersByDistrictId.get(2),right=createServerMapEffectsModel(b).activeAttackMarkersByDistrictId.get(2);
   expect(left.getRemainingMs()).toBe(55500);expect(right.getRemainingMs()).toBe(55500);
   vi.spyOn(Date,'now').mockReturnValue(epoch+86400000);expect(left.getRemainingMs()).toBe(55500);
   expect(left.playerName).toBe('Nick');expect(left.sourceDistrictId).toBe('district:1');
 });
 it('deduplicates repeated rumor contents within a district but preserves different districts and confirmed events',()=>{
   const rumors=[{id:'1',districtId:'district:2',message:'Podezřelý pohyb.'},{id:'2',districtId:'district:2',message:'Podezřelý   pohyb.'},{id:'3',districtId:'district:3',message:'Podezřelý pohyb.'}];
   expect(normalizeCityFeedEvents(rumors)).toHaveLength(2);
   expect(normalizeCityFeedEvents(rumors.map(e=>({...e,intelType:'confirmed_event'})))).toHaveLength(3);
   expect(deduplicateRumorEntries([{id:'r1',sourceKind:'rumor',summary:'District 2: drb'},{id:'r2',sourceKind:'rumor',summary:'District 2: drb'}])).toHaveLength(1);
 });
 it('populates the battle card with Czech outcome, both losses, state, power and duration for the defender',()=>{
   const p=createServerBattleReportPresentation({reportType:'battle',result:'success',outcomeTier:'costly_capture',defenderPlayerId:'p2',attackerPlayerId:'p1',districtCaptured:true,targetDistrictId:'district:2',sourceDistrictId:'district:1',attackPower:230,defensePower:120,attackerLosses:{pistol:2},defenderLosses:{vest:1},attackDurationTicks:120,occupationPopulationLoss:4,defenderPopulationLoss:6,heatGained:9,tick:120,stabilizingUntilTick:180},{viewerId:'p2',districtLabel:x=>x.replace('district:','District '),recordLabel:x=>JSON.stringify(x),formatDuration:ms=>`${ms/1000} s`,tickRateMs:10000}).payload;
   expect(p.title).toBe('Obrana: District ztracen');expect(p.districtName).toBe('District 2');expect(p.attackPower).toBe(230);expect(p.defenderLossesLabel).toContain('vest');expect(p.durationValue).toBe('1200 s');
   expect(p.extraRows).toContainEqual({label:'Stabilizace po obsazení',value:'600 s'});expect(p.summary).not.toContain('costly_capture');
 });
 it('shows a disabled attack button with a live two-hour protection countdown and waits for server at zero',()=>{
   vi.useFakeTimers();const s=slice();observeAuthoritativeSnapshot(s,null,performance.now());
   s.district.targetActions={attackTargets:[{districtId:'district:2',enabled:false,disabledCode:'INITIAL_ATTACK_PROTECTION',disabledReason:'První dvě hodiny',cooldownRemainingTicks:2,attackUnlocksAt:new Date(epoch+20000).toISOString()}]};
   const action=createServerDistrictActionPresentation(s,'district:2')[0];const mount=document.createElement('div');document.body.append(mount);
   const button=renderDistrictActionButton(action,vi.fn(),{mount});mount.append(button);expect(button.disabled).toBe(true);expect(button.textContent).toContain('20s');
   vi.advanceTimersByTime(5000);expect(button.textContent).toContain('15s');vi.advanceTimersByTime(20000);expect(button.disabled).toBe(true);expect(button.textContent).toContain('Čeká na potvrzení serveru');
 });
 it('waits for the longer stabilization even when the real initial protection ends earlier',()=>{
   const s=slice();s.district.targetActions={attackTargets:[{districtId:'district:2',enabled:false,cooldownRemainingTicks:10,actionCooldownEndsAtTick:10,attackUnlocksAt:new Date(epoch+20000).toISOString()}]};
   expect(createServerDistrictActionPresentation(s,'district:2')[0].getCountdownLabel()).toContain('1min 40s');
 });
 it('freezes the displayed battle work while the authoritative server is paused',()=>{
   const s=slice(4500);s.server.status='paused';s.mapEffects=[{type:'attack',districtId:'district:2',expiresAt:new Date(epoch+60000).toISOString(),expiresAtTick:6}];
   const marker=createServerMapEffectsModel(s).activeAttackMarkersByDistrictId.get(2);
   vi.spyOn(performance,'now').mockReturnValue(performance.now()+20000);expect(marker.getRemainingMs()).toBe(60000);
 });
 it('raises and closes the real result dialog above an already open priority card',async()=>{
   document.body.innerHTML=readFileSync('pages/game.html','utf8');
   const root=document.querySelector('#game-root');const underlying=document.querySelector('[data-district-popup-shell]') || document.createElement('div');
   if(!underlying.parentNode)root.append(underlying);underlying.style.zIndex='90000';openOverlay(underlying,{alwaysOnTop:true,skipFocus:true});
   const ids=['modal','content','title','badge','summary','details'];const selectors=Object.fromEntries(ids.map(id=>[id,id==='modal'?'#police-action-result-modal':`#police-action-result-modal-${id}`]));
   const rendered=renderPoliceActionResultPanel(root,{title:'Příchozí útok',summary:'Nick útočí',rows:[{label:'Cíl',value:'District 2'}]},{selectors});
   expect(rendered.ok).toBe(true);expect(getTopOverlay().element).toBe(rendered.modal);expect(Number(rendered.modal.style.zIndex)).toBeGreaterThan(90000);
   document.querySelector('#police-action-result-modal-close').click();await Promise.resolve();expect(getTopOverlay()?.element).toBe(underlying);
   closeOverlay(underlying,{suppressMapInput:false});
 });
});
