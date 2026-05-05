import {
  ATTACK_RESULT_MODAL_ATTACK_LABEL_SELECTOR,
  ATTACK_RESULT_MODAL_ATTACK_LOSS_LABEL_SELECTOR,
  ATTACK_RESULT_MODAL_ATTACK_LOSS_VALUE_SELECTOR,
  ATTACK_RESULT_MODAL_ATTACK_VALUE_SELECTOR,
  ATTACK_RESULT_MODAL_BADGE_SELECTOR,
  ATTACK_RESULT_MODAL_CONTENT_SELECTOR,
  ATTACK_RESULT_MODAL_DEFENSE_LABEL_SELECTOR,
  ATTACK_RESULT_MODAL_DEFENSE_LOSS_LABEL_SELECTOR,
  ATTACK_RESULT_MODAL_DEFENSE_LOSS_VALUE_SELECTOR,
  ATTACK_RESULT_MODAL_DEFENSE_VALUE_SELECTOR,
  ATTACK_RESULT_MODAL_DURATION_LABEL_SELECTOR,
  ATTACK_RESULT_MODAL_DURATION_VALUE_SELECTOR,
  ATTACK_RESULT_MODAL_SELECTOR,
  ATTACK_RESULT_MODAL_STATE_LABEL_SELECTOR,
  ATTACK_RESULT_MODAL_STATE_VALUE_SELECTOR,
  ATTACK_RESULT_MODAL_STATS_SELECTOR,
  ATTACK_RESULT_MODAL_SUMMARY_SELECTOR,
  ATTACK_RESULT_MODAL_TARGET_LABEL_SELECTOR,
  ATTACK_RESULT_MODAL_TARGET_VALUE_SELECTOR,
  ATTACK_RESULT_MODAL_TITLE_SELECTOR
} from "../runtime/constants.js";

const ATTACK_RESULT_TONE_CLASSES = Object.freeze([
  "is-total-success",
  "is-pyrrhic-victory",
  "is-failure",
  "is-catastrophe",
  "is-trap-triggered"
]);

function safeQuery(root, selector) {
  if (!root || typeof root.querySelector !== "function") {
    return null;
  }

  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}

function warnMissingBattleReport(root, payload, missingKeys, options = {}) {
  const message = `Battle report modal is missing required elements: ${missingKeys.join(", ")}`;

  if (typeof options.onMissingContainer === "function") {
    options.onMissingContainer({ root, payload, missingKeys, message });
    return;
  }

  const logger = options.console || (typeof console !== "undefined" ? console : null);
  if (logger && typeof logger.warn === "function") {
    logger.warn(message);
  }
}

function collectBattleReportElements(root) {
  return {
    modal: safeQuery(root, ATTACK_RESULT_MODAL_SELECTOR),
    content: safeQuery(root, ATTACK_RESULT_MODAL_CONTENT_SELECTOR),
    title: safeQuery(root, ATTACK_RESULT_MODAL_TITLE_SELECTOR),
    badge: safeQuery(root, ATTACK_RESULT_MODAL_BADGE_SELECTOR),
    summary: safeQuery(root, ATTACK_RESULT_MODAL_SUMMARY_SELECTOR),
    stats: safeQuery(root, ATTACK_RESULT_MODAL_STATS_SELECTOR),
    targetLabel: safeQuery(root, ATTACK_RESULT_MODAL_TARGET_LABEL_SELECTOR),
    targetValue: safeQuery(root, ATTACK_RESULT_MODAL_TARGET_VALUE_SELECTOR),
    attackLabel: safeQuery(root, ATTACK_RESULT_MODAL_ATTACK_LABEL_SELECTOR),
    attackValue: safeQuery(root, ATTACK_RESULT_MODAL_ATTACK_VALUE_SELECTOR),
    defenseLabel: safeQuery(root, ATTACK_RESULT_MODAL_DEFENSE_LABEL_SELECTOR),
    defenseValue: safeQuery(root, ATTACK_RESULT_MODAL_DEFENSE_VALUE_SELECTOR),
    attackLossLabel: safeQuery(root, ATTACK_RESULT_MODAL_ATTACK_LOSS_LABEL_SELECTOR),
    attackLossValue: safeQuery(root, ATTACK_RESULT_MODAL_ATTACK_LOSS_VALUE_SELECTOR),
    defenseLossLabel: safeQuery(root, ATTACK_RESULT_MODAL_DEFENSE_LOSS_LABEL_SELECTOR),
    defenseLossValue: safeQuery(root, ATTACK_RESULT_MODAL_DEFENSE_LOSS_VALUE_SELECTOR),
    stateLabel: safeQuery(root, ATTACK_RESULT_MODAL_STATE_LABEL_SELECTOR),
    stateValue: safeQuery(root, ATTACK_RESULT_MODAL_STATE_VALUE_SELECTOR),
    durationLabel: safeQuery(root, ATTACK_RESULT_MODAL_DURATION_LABEL_SELECTOR),
    durationValue: safeQuery(root, ATTACK_RESULT_MODAL_DURATION_VALUE_SELECTOR)
  };
}

function createExtraRow(root, row = {}) {
  const ownerDocument = root?.ownerDocument || (typeof document !== "undefined" ? document : null);
  const item = ownerDocument?.createElement?.("div");
  const label = ownerDocument?.createElement?.("span");
  const value = ownerDocument?.createElement?.("strong");
  if (!item || !label || !value) {
    return null;
  }

  item.className = "modal__row attack-result-modal__stat attack-result-modal__extra";
  label.textContent = String(row.label || "");
  value.textContent = String(row.value ?? "-");
  item.append(label, value);
  return item;
}

function renderBattleReportExtraRows(root, stats, payload = {}) {
  if (!stats) {
    return;
  }

  for (const existing of Array.from(stats.querySelectorAll?.(".attack-result-modal__extra") || [])) {
    existing.remove?.();
  }

  const extraRows = Array.isArray(payload.extraRows)
    ? payload.extraRows
    : [
        { label: "Loot", value: payload.lootLabel || "Žádný" },
        { label: "Heat gained", value: payload.heatGainedLabel || "+0" },
        { label: "Police warning", value: payload.policeWarningLabel || "Bez hlášení" },
        { label: "Další krok", value: payload.nextActionLabel || "Zpět na mapu" }
      ];

  for (const row of extraRows.filter((entry) => entry && entry.label)) {
    const element = createExtraRow(root, row);
    if (element) {
      stats.append(element);
    }
  }
}

export function renderBattleReport(root, payload = {}, options = {}) {
  const elements = collectBattleReportElements(root);
  const missingKeys = Object.entries(elements)
    .filter(([, element]) => !element)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    warnMissingBattleReport(root, payload, missingKeys, options);
    return false;
  }

  const {
    modal,
    content,
    title,
    badge,
    summary,
    stats,
    targetLabel,
    targetValue,
    attackLabel,
    attackValue,
    defenseLabel,
    defenseValue,
    attackLossLabel,
    attackLossValue,
    defenseLossLabel,
    defenseLossValue,
    stateLabel,
    stateValue,
    durationLabel,
    durationValue
  } = elements;

  content.classList.remove(...ATTACK_RESULT_TONE_CLASSES);
  content.classList.add(payload.tone || "is-failure");
  title.textContent = payload.title || "Výsledek útoku";
  badge.textContent = payload.badge || "Výsledek útoku";
  summary.textContent = payload.summary || "";
  targetLabel.textContent = payload.targetLabel || "Cíl";
  targetValue.textContent = payload.districtName || payload.target || "-";
  attackLabel.textContent = payload.attackLabel || "Útočná síla";
  attackValue.textContent = payload.attackPower != null ? String(payload.attackPower) : "-";
  defenseLabel.textContent = payload.defenseLabel || "Obranná síla";
  defenseValue.textContent = payload.showDefensePower === false ? "-" : (payload.defensePower != null ? String(payload.defensePower) : "-");
  attackLossLabel.textContent = payload.attackLossLabel || "Ztráty útočníka";
  attackLossValue.textContent = payload.attackerLossesLabel || "-";
  defenseLossLabel.textContent = payload.defenseLossLabel || "Ztráty obránce";
  defenseLossValue.textContent = payload.defenderLossesLabel || "-";
  stateLabel.textContent = payload.stateLabel || "Stav districtu";
  stateValue.textContent = payload.districtStateValue || "-";
  durationLabel.textContent = payload.durationLabel || "Trvání";
  durationValue.textContent = payload.durationValue || "-";
  defenseValue.closest?.(".modal__row")?.classList.toggle("hidden", payload.showDefensePower === false);
  renderBattleReportExtraRows(root, stats, payload);
  modal.classList.remove("hidden");
  return true;
}
