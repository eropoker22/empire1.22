import type { DistrictPanelView } from "./district-panel-view";
import type { DistrictSummaryView } from "./district-summary-view";
import type { GameplayModeView } from "./gameplay-mode-view";
import type { PlayerView } from "./player-view";
import type { PoliceReadModel } from "./police-read-model-view";
import type { ConflictReportView } from "./report-view";
import type { CityFeedProjectionView } from "./city-feed-view";
import type { DayNightReadModel } from "./day-night-read-model-view";
import type { EliminationReadModel } from "./elimination-read-model-view";
import type { OnboardingReadModel } from "./onboarding-read-model-view";

/**
 * Responsibility: Minimal server-fed read model for one migrated gameplay slice.
 * Belongs here: only the data needed to render the district/building panel.
 * Does not belong here: transport envelopes or write-model internals.
 */
export interface GameplaySliceView {
  mode: GameplayModeView;
  player: PlayerView;
  dayNight?: DayNightReadModel | null;
  elimination?: EliminationReadModel | null;
  onboarding?: OnboardingReadModel | null;
  police?: PoliceReadModel | null;
  cityFeed?: CityFeedProjectionView | null;
  districts: DistrictSummaryView[];
  district: DistrictPanelView | null;
  reports: ConflictReportView[];
}
