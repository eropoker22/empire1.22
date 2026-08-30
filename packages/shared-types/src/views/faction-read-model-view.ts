import type {
  FactionPassiveModifiers,
  FactionSpecialActionMetadata,
  FactionUiTheme,
  PlayerFactionId
} from "../entities/faction";

export interface FactionReadModel {
  factionId: PlayerFactionId;
  name: string;
  tagline: string;
  playstyleSummary: string;
  strengths: string[];
  weaknesses: string[];
  activePassiveEffects: string[];
  plannedPassiveEffects: string[];
  passiveModifiers: FactionPassiveModifiers;
  startingPackageSummary?: string[];
  specialAction?: FactionSpecialActionMetadata;
  uiTheme: FactionUiTheme;
}
