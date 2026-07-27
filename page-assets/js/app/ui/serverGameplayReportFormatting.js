const REPORT_RESULT_LABELS = Object.freeze({
  success: "Úspěch",
  partial: "Částečný úspěch",
  failed: "Neúspěch",
  failure: "Neúspěch",
  blocked: "Zablokováno",
  catastrophe: "Katastrofa",
  critical_failed: "Kritické selhání"
});
const NUMBER_FORMATTER = new Intl.NumberFormat("cs-CZ");

export function resultLabel(result) {
  return REPORT_RESULT_LABELS[result] || toTitleCase(result || "Neznámý");
}

export function formatNumberRecord(values = {}) {
  const entries = Object.entries(values)
    .filter(([, amount]) => Number(amount || 0) !== 0);
  return entries.length > 0
    ? entries.map(([key, amount]) => `${formatNumber(amount)} ${toTitleCase(key)}`).join(", ")
    : "Žádné";
}

export function formatSigned(value) {
  const amount = Number(value || 0);
  return amount >= 0 ? `+${formatNumber(amount)}` : formatNumber(amount);
}

export function formatNumber(value) {
  return NUMBER_FORMATTER.format(Number(value || 0));
}

export function parseTimestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toTitleCase(value) {
  return String(value || "")
    .replaceAll("_", "-")
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
