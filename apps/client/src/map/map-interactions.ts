/**
 * Responsibility: UI-only district interaction events such as click, hover, and focus.
 * Belongs here: map interaction contracts that dispatch commands or patch UI state.
 * Does not belong here: district rule validation or command outcomes.
 */
export interface MapInteractions {
  onDistrictSelect(districtId: string): void;
  onDistrictHover(districtId: string | null): void;
}

