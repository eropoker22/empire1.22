// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
const transport = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock('../../page-assets/js/app/runtime/serverGameplaySource.js', () => ({
  submitServerAllianceCommand: transport.submit, submitServerCityChatCommand: vi.fn()
}));
let runtime;
afterEach(() => { runtime?.destroyAllianceRuntime(); vi.useRealTimers(); vi.restoreAllMocks(); document.body.replaceChildren(); delete window.__EMPIRE_GAMEPLAY_EXECUTION_MODE__; });
const alliance = () => ({ allianceId: 'a1', name: 'Testovací aliance', tag: 'WOLF', status: 'active',
  currentPlayerRole: 'leader', memberCount: 2, members: [], chatMessages: [], inviteTargets: [] });
function publish(active = alliance(), playerId = 'p1') {
  document.dispatchEvent(new CustomEvent('empire:gameplay-slice-rendered', { detail: { gameplaySlice: {
    allianceBoard: { currentPlayerId: playerId, activeAlliance: active, publicAlliances: [], playerInvites: [] }
  } } }));
}
async function setup() {
  vi.resetModules(); vi.useFakeTimers(); vi.spyOn(window.performance, "now").mockImplementation(() => Date.now()); window.__EMPIRE_GAMEPLAY_EXECUTION_MODE__ = 'server-authoritative';
  document.body.innerHTML = readFileSync('pages/game.html', 'utf8');
  runtime = await import('../../page-assets/js/app/alliance-runtime.js'); runtime.bindAllianceRuntime();
  vi.advanceTimersByTime(1000); publish(); document.querySelector('[data-alliance-popup-open]').click();
  document.querySelector('button[data-alliance-tab="chat"]').click();
  return document.querySelector('[data-alliance-chat-input]');
}
function type(input, text) { input.value = text; input.dispatchEvent(new Event('input', { bubbles: true })); }
it('preserves the input node, focus, caret and draft when live messages arrive', async () => {
  const input = await setup(); input.click(); expect(document.querySelector('[data-alliance-chat-input]')).toBe(input); input.focus(); type(input, 'Ahoj aliance'); input.setSelectionRange(4, 4);
  const update = alliance(); update.chatMessages = [{ messageId:'m1', authorPlayerId:'p2', authorName:'Spoluhráč', body:'Zpráva od člena', createdAt:new Date().toISOString() }];
  publish(update);
  expect(document.querySelector('[data-alliance-chat-input]')).toBe(input);
  expect(document.activeElement).toBe(input); expect(input.selectionStart).toBe(4); expect(input.value).toBe('Ahoj aliance');
  expect(document.querySelector('[data-alliance-chat-log]').textContent).toContain('Zpráva od člena');
});
it('keeps a newly written draft when the previous send completes and clears drafts on membership change', async () => {
  const input = await setup(); let finish;
  transport.submit.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  type(input, 'První zpráva'); document.querySelector('[data-alliance-chat-send]').click();
  expect(transport.submit).toHaveBeenCalledWith({type:'send-alliance-chat-message',payload:{allianceId:'a1',body:'První zpráva'}});
  type(input, 'Druhá rozepsaná'); finish({accepted:true}); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(document.querySelector('[data-alliance-chat-input]').value).toBe('Druhá rozepsaná');
  publish({...alliance(), allianceId:'a2'}); expect(document.querySelector('[data-alliance-chat-input]').value).toBe('');
  publish(null); expect(document.querySelector('[data-alliance-chat-input]')).toBeNull();
});
