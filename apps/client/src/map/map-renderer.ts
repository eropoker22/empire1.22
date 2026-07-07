import type { MapDistrictViewModel } from "../selectors";
import { escapeAttribute, escapeHtml } from "../shared-ui";

const DAY_MAP_IMAGE_PATH = "../img/mapaden2.png";

/**
 * Responsibility: Rendering boundary for the map surface and layers.
 * Belongs here: drawing districts and visual overlays from prepared view models.
 * Does not belong here: gameplay rules, combat math, or authoritative state changes.
 */
export interface MapRendererProps {
  districts: MapDistrictViewModel[];
  selectedDistrictId: string | null;
  phaseId?: "day" | "night" | null;
}

export const renderMap = ({ districts, selectedDistrictId, phaseId }: MapRendererProps): string => {
  const normalizedPhase = phaseId === "day" ? "day" : "night";
  const dayVisual = normalizedPhase === "day"
    ? `<span class="map-day-visual" data-map-day-image="${escapeAttribute(DAY_MAP_IMAGE_PATH)}" style="--map-day-image:url('${escapeAttribute(DAY_MAP_IMAGE_PATH)}')" aria-hidden="true"></span>`
    : "";
  return [
    `<section data-map-surface="district-list" data-map-phase="${escapeAttribute(normalizedPhase)}" data-selected-district-id="${escapeAttribute(selectedDistrictId ?? "")}">`,
    dayVisual,
    districts
      .map(
        (district) => {
          const ownerColor = toSafeCssColorValue(district.ownerColor);
          const ownerColorAttribute = ownerColor
            ? ` data-owner-color="${escapeAttribute(ownerColor)}" style="--map-owner-color:${escapeAttribute(ownerColor)}"`
            : "";

          return district.isDestroyed
            ? [
                `<button class="map-district map-district--destroyed" data-district-id="${escapeAttribute(district.districtId)}" data-selected="${escapeAttribute(district.isSelected)}" data-owned="${escapeAttribute(district.isOwnedByPlayer)}" data-destroyed="true" data-attack-target="${escapeAttribute(district.isAttackTarget)}" data-attack-enabled="false">`,
                `<span class="map-district__ruin-cracks" aria-hidden="true"></span>`,
                `<strong>${escapeHtml(district.label)}</strong>`,
                `<span>V piči, zničen.</span>`,
                `</button>`
              ].join("")
            : [
                `<button class="map-district" data-district-id="${escapeAttribute(district.districtId)}" data-selected="${escapeAttribute(district.isSelected)}" data-owned="${escapeAttribute(district.isOwnedByPlayer)}" data-destroyed="false" data-attack-target="${escapeAttribute(district.isAttackTarget)}" data-attack-enabled="${escapeAttribute(district.attackEnabled)}"${ownerColorAttribute}>`,
                `<strong>${escapeHtml(district.label)}</strong>`,
                `<span>${escapeHtml(district.ownerLabel)}</span>`,
                `<span>Zóna: ${escapeHtml(district.zoneLabel)}</span>`,
                `<span>Budovy: ${escapeHtml(district.buildingSummary)}</span>`,
                `<span>Hledanost: ${escapeHtml(district.heatLabel)} · Vliv: ${escapeHtml(district.influenceLabel)}</span>`,
                district.isAttackTarget
                  ? `<span>${escapeHtml(district.attackEnabled ? "Attack Ready" : district.attackDisabledReason ?? "Attack unavailable")}</span>`
                  : "",
                district.isContested ? "<span>Contested</span>" : "",
                "</button>"
              ].join("");
        }
      )
      .join(""),
    "</section>"
  ].join("");
};

const toSafeCssColorValue = (value: string | null): string => {
  const normalized = String(value ?? "").trim();
  return /^[#a-zA-Z0-9(),.%\s-]+$/u.test(normalized) ? normalized : "";
};
