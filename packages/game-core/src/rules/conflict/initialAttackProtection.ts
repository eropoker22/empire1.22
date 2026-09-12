import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";

export function getInitialAttackProtection(state: CoreGameState, context: GameCoreContext | undefined, serverNow: string) {
  const duration = Math.max(0, context?.config.balance.conflict?.initialAttackProtectionMs ?? 0);
  const startsAt = Date.parse(state.serverInstance.startedAt);
  const now = context?.clock?.now().getTime() ?? Date.parse(serverNow);
  const endsAt = startsAt + duration;
  return { endsAt: Number.isFinite(endsAt) ? endsAt : 0,
    remainingMs: Number.isFinite(now) && Number.isFinite(endsAt) ? Math.max(0, endsAt - now) : 0 };
}
