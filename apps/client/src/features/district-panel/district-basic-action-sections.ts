import type {
  DistrictPanelDefenseActionViewModel,
  DistrictPanelHeistTargetViewModel,
  DistrictPanelRobTargetViewModel,
  DistrictPanelViewModel
} from "../../selectors";
import { escapeAttribute, escapeHtml } from "../../shared-ui";

type TargetSectionInput<TTarget> = {
  attribute: string;
  title: string;
  copy: string;
  emptyCopy: string;
  targetAttribute: string;
  buttonModifier: string;
  targets: TTarget[];
  renderMeta: (target: TTarget) => string;
};

type BasicTarget = {
  districtId: string;
  label: string;
  statusLabel: string;
  disabled: boolean;
  disabledReason: string | null;
  cooldownLabel: string | null;
};

export const renderBasicDistrictActionSections = (panel: DistrictPanelViewModel): string =>
  [
    renderTargetSection<DistrictPanelRobTargetViewModel>({
      attribute: "data-rob-targets",
      title: "Cíle loupeže",
      copy: "Vykradení neutrálního souseda potvrzuje server.",
      emptyCopy: "Z tohoto distriktu není dostupný neutrální cíl loupeže.",
      targetAttribute: "data-rob-target-id",
      buttonModifier: "rob",
      targets: panel.robTargets,
      renderMeta: (target) => target.statusLabel
    }),
    renderTargetSection<DistrictPanelHeistTargetViewModel>({
      attribute: "data-heist-targets",
      title: "Cíle heistu",
      copy: "Okamžitý alpha heist krade zdroje bez převzetí území. Výsledek počítá server.",
      emptyCopy: "Z tohoto distriktu není dostupný nepřátelský cíl heistu.",
      targetAttribute: "data-heist-target-id",
      buttonModifier: "heist",
      targets: panel.heistTargets,
      renderMeta: (target) => `${target.ownerLabel} · ${target.statusLabel}`
    }),
    renderDefenseSection(panel.placeDefense, panel.removeDefense)
  ].join("");

const renderTargetSection = <TTarget extends BasicTarget>(
  input: TargetSectionInput<TTarget>
): string =>
  [
    `<section class="district-panel__section" ${input.attribute}="true">`,
    `<div class="district-panel__section-head">`,
    `<div>`,
    `<h3 class="district-panel__section-title">${escapeHtml(input.title)}</h3>`,
    `<p class="district-panel__section-copy">${escapeHtml(input.copy)}</p>`,
    `</div>`,
    `<span class="district-panel__section-meta">${escapeHtml(input.targets.length)} celkem</span>`,
    `</div>`,
    input.targets.length > 0
      ? input.targets.map((target) => renderTargetRow(input, target)).join("")
      : `<p class="district-panel__empty-copy">${escapeHtml(input.emptyCopy)}</p>`,
    `</section>`
  ].join("");

const renderTargetRow = <TTarget extends BasicTarget>(
  input: TargetSectionInput<TTarget>,
  target: TTarget
): string => {
  const disabledAttribute = target.disabled ? " disabled" : "";
  const reasonAttribute = target.disabledReason
    ? ` data-disabled-reason="${escapeAttribute(target.disabledReason)}"`
    : "";

  return [
    `<div class="district-panel__action-row">`,
    `<button class="district-panel__action-button district-panel__action-button--${escapeAttribute(input.buttonModifier)}" ${input.targetAttribute}="${escapeAttribute(target.districtId)}"${disabledAttribute}${reasonAttribute}>`,
    `<span class="district-panel__action-title">${escapeHtml(target.label)}</span>`,
    `<span class="district-panel__action-meta">${escapeHtml(input.renderMeta(target))}</span>`,
    target.cooldownLabel
      ? `<span class="district-panel__action-meta">${escapeHtml(`Čekání ${target.cooldownLabel}`)}</span>`
      : "",
    `</button>`,
    target.disabledReason
      ? `<p class="district-panel__action-reason">${escapeHtml(target.disabledReason)}</p>`
      : "",
    `</div>`
  ].join("");
};

const renderDefenseSection = (
  placeDefense: DistrictPanelDefenseActionViewModel | null,
  removeDefense: DistrictPanelDefenseActionViewModel | null
): string =>
  placeDefense || removeDefense
    ? [
        `<section class="district-panel__section" data-defense-actions="true">`,
        `<div class="district-panel__section-head">`,
        `<div>`,
        `<h3 class="district-panel__section-title">Obrana</h3>`,
        `<p class="district-panel__section-copy">Obranu ve vlastním distriktu mění jen serverový command.</p>`,
        `</div>`,
        `</div>`,
        placeDefense ? renderDefenseButton("data-place-defense", placeDefense) : "",
        removeDefense ? renderDefenseButton("data-remove-defense", removeDefense) : "",
        `</section>`
      ].join("")
    : "";

const renderDefenseButton = (
  attribute: "data-place-defense" | "data-remove-defense",
  action: DistrictPanelDefenseActionViewModel
): string =>
  [
    `<div class="district-panel__action-row">`,
    `<button class="district-panel__action-button district-panel__action-button--defense" ${attribute}="true"${action.disabled ? " disabled" : ""}>${escapeHtml(action.actionLabel)}</button>`,
    action.disabledReason
      ? `<p class="district-panel__action-reason">${escapeHtml(action.disabledReason)}</p>`
      : "",
    `</div>`
  ].join("");
