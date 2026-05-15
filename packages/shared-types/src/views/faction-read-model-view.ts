import type { FactionUiTheme, PlayerFactionId } from "../entities/faction";

export interface FactionReadModel {
  factionId: PlayerFactionId;
  name: string;
  tagline: string;
  playstyleSummary: string;
  strengths: string[];
  weaknesses: string[];
  activePassiveEffects: string[];
  startingPackageSummary: string[];
  uiTheme: FactionUiTheme;
}
