import { resolveModeConfig } from '@empire/game-config';
import { createReplacementValueResolver } from '@empire/game-core/rules/economy/replacementValue';
const config = resolveModeConfig('free');
const resolver = createReplacementValueResolver(config);
const rows = config.balance.cityEvents!.definitions.map(event => {
  const value = Object.entries(event.reward).reduce((sum, [key, amount]) => sum + Number(amount) * (key === 'influence' ? 0 : ['cash', 'dirty-cash'].includes(key) ? 1 : resolver.resolve(key) || 0), 0);
  const p = event.successRate / 100;
  const expectedNet = p * value - (1 - p) * event.risk.failureDirtyCashLoss - Object.values(event.risk.startCost || {}).reduce((sum, amount) => sum + Number(amount), 0);
  return { id: event.id, agent: event.agentId, difficulty: event.difficulty, value, expectedNet: Math.round(expectedNet), perHour: Math.round(expectedNet * 60 / event.durationMinutes), influence: event.reward.influence || 0 };
});
console.log(JSON.stringify({ assumptions: 'Replacement value, not resale proceeds. Dirty and clean cash valued 1:1; influence, heat, item scarcity and storage are not monetized.', groups: ['easy','medium','hard','rare'].map(difficulty => {
  const group = rows.filter(row => row.difficulty === difficulty);
  return { difficulty, count: group.length, value: [Math.min(...group.map(x=>x.value)),Math.max(...group.map(x=>x.value))], expectedPerHour: [Math.min(...group.map(x=>x.perHour)),Math.max(...group.map(x=>x.perHour))], medianPerHour: group.map(x=>x.perHour).sort((a,b)=>a-b)[Math.floor(group.length/2)] };
}), lowest: [...rows].sort((a,b)=>a.perHour-b.perHour).slice(0,10), rows }, null, 2));
