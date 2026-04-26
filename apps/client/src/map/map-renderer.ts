import type { MapDistrictViewModel } from "../selectors";

/**
 * Responsibility: Rendering boundary for the map surface and layers.
 * Belongs here: drawing districts and visual overlays from prepared view models.
 * Does not belong here: gameplay rules, combat math, or authoritative state changes.
 */
export interface MapRendererProps {
  districts: MapDistrictViewModel[];
  selectedDistrictId: string | null;
}

export const renderMap = ({ districts, selectedDistrictId }: MapRendererProps): string =>
  [
    `<section data-map-surface="district-list" data-selected-district-id="${selectedDistrictId ?? ""}">`,
    districts
      .map(
        (district) => {
          const ownerColorAttribute = district.ownerColor
            ? ` data-owner-color="${district.ownerColor}" style="--map-owner-color:${district.ownerColor}"`
            : "";

          return district.isDestroyed
            ? [
                `<button class="map-district map-district--destroyed" data-district-id="${district.districtId}" data-selected="${district.isSelected}" data-owned="${district.isOwnedByPlayer}" data-destroyed="true" data-attack-target="${district.isAttackTarget}" data-attack-enabled="false">`,
                `<span class="map-district__ruin-cracks" aria-hidden="true"></span>`,
                `<strong>${district.label}</strong>`,
                `<span>V piči, zničen.</span>`,
                `</button>`
              ].join("")
            : [
                `<button class="map-district" data-district-id="${district.districtId}" data-selected="${district.isSelected}" data-owned="${district.isOwnedByPlayer}" data-destroyed="false" data-attack-target="${district.isAttackTarget}" data-attack-enabled="${district.attackEnabled}"${ownerColorAttribute}>`,
                `<strong>${district.label}</strong>`,
                `<span>${district.ownerLabel}</span>`,
                `<span>Zone: ${district.zoneLabel}</span>`,
                `<span>Buildings: ${district.buildingSummary}</span>`,
                `<span>Heat: ${district.heatLabel} · Influence: ${district.influenceLabel}</span>`,
                district.isAttackTarget
                  ? `<span>${district.attackEnabled ? "Attack Ready" : district.attackDisabledReason ?? "Attack unavailable"}</span>`
                  : "",
                district.isContested ? "<span>Contested</span>" : "",
                "</button>"
              ].join("");
        }
      )
      .join(""),
    "</section>"
  ].join("");
