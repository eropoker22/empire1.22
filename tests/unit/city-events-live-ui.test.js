// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
const transport = vi.hoisted(() => ({ view:null, submit:vi.fn() }));
vi.mock('../../page-assets/js/app/runtime/serverGameplaySource.js', () => ({ getServerGameplaySliceReadModel:()=>transport.view, submitServerCityEventCommand:transport.submit }));
let runtime;
afterEach(()=>{ runtime?.destroyCityEventsRuntime(); document.body.replaceChildren(); delete window.__EMPIRE_GAMEPLAY_EXECUTION_MODE__; });
it('keeps rewards accessible when contacts are closed or locked and lets a failed start be retried', async()=>{
  document.body.innerHTML=readFileSync('pages/game.html','utf8');
  window.__EMPIRE_GAMEPLAY_EXECUTION_MODE__='server-authoritative';
  const offer={ offerId:'offer:1', title:'Ověřená zakázka', description:'Popis', rewards:{cash:500}, startCost:{'dirty-cash':200}, successRate:80, durationMinutes:15, durationTicks:90, canStart:true, difficulty:'medium' };
  transport.view={player:{economy:{influence:100},cityEvents:{cityClock:{minuteOfDay:600},activeRun:null,
    pendingRewards:[{pendingRewardId:'reward:1',resourceKey:'cash',amount:500,reason:'storage-capacity',canClaim:true}],
    agents:[{agentId:'victor',unlocked:true,availableNow:false,offers:[]},{agentId:'leon',unlocked:true,availableNow:true,offers:[offer]},{agentId:'nyra',unlocked:false,availableNow:true,requiredInfluence:300,offers:[]}]}}};
  runtime=await import('../../page-assets/js/app/city-events-runtime.js'); runtime.initCityEventsRuntime();
  document.querySelector('#city-events-open').click();
  expect(document.querySelector('[data-city-event-claim]')).not.toBeNull();
  document.querySelector('.events-agent[data-agent="victor"]').click();
  expect(document.querySelector('#events-tasklist').textContent).toContain('Kontakt je teď zavřený');
  expect(document.querySelector('[data-city-event-claim]').disabled).toBe(false);
  document.querySelector('.events-agent[data-agent="nira"]').click();
  expect(document.querySelector('#events-tasklist').textContent).toContain('Zakázky zamčené');
  transport.submit.mockImplementationOnce(async()=>{transport.view.player.cityEvents.pendingRewards=[]; return {accepted:true};});
  document.querySelector('[data-city-event-claim]').click();
  await vi.waitFor(()=>expect(document.querySelector('[data-city-event-claim]')).toBeNull());
  expect(transport.submit).toHaveBeenCalledWith({action:'claim',id:'reward:1'});
  document.querySelector('.events-agent[data-agent="leon"]').click();
  document.querySelector('[data-event-open]').click();
  expect(document.querySelector('#event-detail-desc').textContent).toContain('Vstupní cena:');
  expect(document.querySelector('#event-detail-desc').textContent).toContain('200');
  transport.submit.mockResolvedValueOnce({accepted:false,errors:[{message:'Dočasně nedostupné'}]});
  document.querySelector('#event-detail-accept').click();
  await vi.waitFor(()=>expect(document.querySelector('#event-detail-accept').disabled).toBe(false));
  expect(document.querySelector('#event-detail-accept').textContent).toBe('Začít');
});
