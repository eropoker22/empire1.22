export function formatCurrency(value) {
  return `$${value}`;
}

export function formatDistrictMetricNumber(value = 0, maximumFractionDigits = 1) {
  const safeValue = Math.max(0, Math.round(Number(value || 0) * 100) / 100);
  const roundedInteger = Math.round(safeValue);
  const hasDecimals = Math.abs(safeValue - roundedInteger) > Number.EPSILON;
  return safeValue.toLocaleString("cs-CZ", {
    minimumFractionDigits: hasDecimals ? Math.min(maximumFractionDigits, 1) : 0,
    maximumFractionDigits
  });
}

export function formatDistrictMoneyAmount(value = 0) {
  return `$${Math.max(0, Math.round(Number(value || 0))).toLocaleString("cs-CZ")}`;
}

export function formatDistrictIncomeLabel(hourlyIncome = 0, options = {}) {
  if (options.hidden) {
    return "Skryto";
  }

  if (options.destroyed) {
    return "V piči, zničen.";
  }

  return `${formatDistrictMoneyAmount(hourlyIncome)}/hod`;
}

export function formatDistrictHeatLabel(heatPerDay = 0, options = {}) {
  if (options.hidden) {
    return "Skryto";
  }

  if (options.destroyed) {
    return "0/den";
  }

  const safeHeat = Math.max(0, Math.round(Number(heatPerDay || 0) * 10) / 10);
  const hasDecimals = Math.abs(safeHeat - Math.round(safeHeat)) > Number.EPSILON;
  const formatted = safeHeat.toLocaleString("cs-CZ", {
    minimumFractionDigits: hasDecimals ? 1 : 0,
    maximumFractionDigits: 1
  });

  return safeHeat > 0 ? `+${formatted}/den` : "0/den";
}

export function formatDistrictInfluenceLabel(influencePerHour = 0, options = {}) {
  if (options.hidden) {
    return "Skryto";
  }

  if (options.destroyed) {
    return "0/hod";
  }

  const safeInfluence = Math.max(0, Number(influencePerHour || 0));
  return safeInfluence > 0 ? `+${formatDistrictMetricNumber(safeInfluence, 2)}/hod` : "0/hod";
}

export function formatDistrictBuildingMoney(value) {
  return formatCurrency(Math.max(0, Math.floor(Number(value) || 0)));
}

export function formatDistrictBuildingCooldown(ms) {
  const seconds = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${String(rest).padStart(2, "0")}s` : `${rest}s`;
}
