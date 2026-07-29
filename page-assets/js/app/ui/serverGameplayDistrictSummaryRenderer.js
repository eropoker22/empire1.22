import {
  renderDistrictFlags,
  renderDistrictSummaryPanel
} from "./districtPanel.js";

export function renderServerGameplayDistrictSummary({
  elements,
  summaryRows,
  view
}) {
  let writes = 0;
  renderDistrictSummaryPanel({
    title: elements.popupTitle,
    type: elements.popupType,
    owner: elements.popupOwner,
    ownerMeta: elements.popupOwnerMeta,
    ownerAvatar: elements.popupOwnerAvatar,
    ownerAvatarFallback: elements.popupOwnerAvatarFallback,
    card: elements.popupCard
  }, view);
  writes += 4;

  const atmosphereMeta = view.atmosphereMeta || {};
  const atmosphereLocked = atmosphereMeta.typeKey === "unknown";
  if (elements.popupCard) {
    elements.popupCard.dataset.districtType = atmosphereMeta.typeKey || "unknown";
    elements.popupCard.dataset.atmosphereState = atmosphereLocked ? "locked" : "revealed";
  }
  if (elements.popupAtmosphereImage) {
    const imagePath = String(atmosphereMeta.imagePath || "");
    if (elements.popupAtmosphereImage.getAttribute("src") !== imagePath) {
      elements.popupAtmosphereImage.src = imagePath;
      writes += 1;
    }
    elements.popupAtmosphereImage.alt = `${atmosphereMeta.label || "District"} – atmosféra města`;
  }
  if (elements.popupAtmosphereHero) {
    elements.popupAtmosphereHero.dataset.atmosphereState = atmosphereLocked ? "locked" : "revealed";
    elements.popupAtmosphereHero.setAttribute(
      "aria-label",
      atmosphereLocked
        ? "Zobrazit skrytou atmosféru districtu."
        : `Zobrazit větší fotku atmosféry: ${atmosphereMeta.label}`
    );
  }
  if (elements.popupAtmosphereWindow) {
    elements.popupAtmosphereWindow.dataset.districtId = view.districtId;
  }
  if (elements.popupAtmosphereWindowImage) {
    elements.popupAtmosphereWindowImage.src = atmosphereMeta.imagePath || "";
    elements.popupAtmosphereWindowImage.alt = `${atmosphereMeta.label || "District"} – fotka atmosféry`;
  }

  writes += setText(elements.popupAtmosphereLabel, view.atmosphereLabel);
  writes += setText(elements.popupAtmosphereMood, view.atmosphereMood);
  writes += setText(elements.popupAtmosphereWindowLabel, view.atmosphereLabel);
  writes += setText(elements.popupAtmosphereWindowMood, view.atmosphereMood);
  if (elements.popupAtmosphereLabel) elements.popupAtmosphereLabel.hidden = atmosphereLocked;
  if (elements.popupAtmosphereMood) elements.popupAtmosphereMood.hidden = atmosphereLocked;
  writes += setText(elements.popupAlliance, view.allianceLabel);
  if (elements.popupAlliance) elements.popupAlliance.hidden = !view.allianceLabel;
  renderDistrictFlags(elements.popupFlags, view.flags);
  writes += 1;

  for (let index = 0; index < summaryRows.length; index += 1) {
    const metric = view.metrics[index] || { label: "—", value: "—" };
    writes += setText(summaryRows[index].label, metric.label);
    writes += setText(summaryRows[index].value, metric.value);
  }
  return writes;
}

const setText = (element, value) => {
  const text = String(value ?? "");
  if (!element || element.textContent === text) return 0;
  element.textContent = text;
  return 1;
};
