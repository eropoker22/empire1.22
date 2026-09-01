import type { GameplaySliceView, PlayerView, PoliceReadModel } from "../index";

export type AuthoritativeHeatSource = GameplaySliceView | PlayerView | PoliceReadModel | null | undefined;

export declare function selectAuthoritativePlayerHeat(source: AuthoritativeHeatSource): number | null;
export declare function getGameplaySliceStateVersion(model: Partial<GameplaySliceView> | null | undefined): number | null;
export declare function getGameplaySliceAuthorityScope(model: Partial<GameplaySliceView> | null | undefined): string | null;
export declare function mergeAuthoritativeGameplaySlice(
  current: GameplaySliceView | null | undefined,
  next: GameplaySliceView,
  options?: { allowScopeChange?: boolean }
): { accepted: boolean; model: GameplaySliceView | null; reason: string };
