const outcomes = {
  clean_capture: "Čisté obsazení", costly_capture: "Obsazení se ztrátami",
  failed_raid: "Odražený útok", disaster: "Katastrofa"
};
export function createServerBattleReportPresentation(report, { districtLabel, recordLabel, formatDuration, tickRateMs = 10000, viewerId, resourceLabel } = {}) {
  const defending = viewerId === report.defenderPlayerId;
  const attackerWon = report.result === "success";
  const blocked = report.result === "blocked";
  const state = report.districtDestroyed ? "Zničen" : report.districtCaptured ? "Obsazen útočníkem"
    : report.districtDamaged ? "Poškozen; zůstává obránci" : "Zůstává obránci";
  const title = report.districtDestroyed ? "Bitva: District zničen" : defending ? (attackerWon ? "Obrana: District ztracen" : "Obrana: Útok odražen")
    : blocked ? "Útok: Zastaven" : attackerWon ? "Útok: Úspěch" : "Útok: Neúspěch";
  const outcome = blocked ? "Zastavený útok" : outcomes[report.outcomeTier] || (attackerWon ? "Úspěch" : "Neúspěch");
  const quantity = value => Math.max(0, Number(value || 0)).toLocaleString("cs-CZ");
  const losses = record => resourceLabel ? Object.entries(record || {}).filter(([,amount]) => Number(amount) !== 0)
    .map(([id,amount]) => `${resourceLabel(id)}: −${quantity(Math.abs(Number(amount)))}`).join(" · ") || "Žádné" : recordLabel(record);
  const extraRows = [
    { label: "Výsledek", value: outcome },
    { label: "Zdroj útoku", value: districtLabel(report.sourceDistrictId) },
    { label: "Ztráty lidí útočníka v boji", value: quantity(report.combatPopulationLoss) },
    { label: "Ztráty lidí při obsazení", value: quantity(report.occupationPopulationLoss) },
    { label: "Ztráty lidí obránce", value: quantity(report.defenderPopulationLoss) },
    { label: "Lidé zachránění vestami", value: quantity(report.vestPopulationSaved) },
    { label: "Past", value: report.trapTriggered ? "Spuštěna" : "Nespuštěna" },
    { label: "Přeživší obrana", value: report.survivingDefenseAbandoned ? "Opuštěna při ztrátě území" : "Zůstává v districtu" },
    { label: "HEAT útočníka", value: `+${quantity(report.heatGained)}` },
    { label: "Riziko katastrofy", value: `${(Number(report.catastropheFinalChance || 0) * 100).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} %` }
  ];
  if (report.tacticalGrid) extraRows.push({ label: "Tactical Grid", value: `Útočník: ${report.tacticalGrid.attackerApplied ? "ano" : "ne"} · Obránce: ${report.tacticalGrid.defenderApplied ? "ano" : "ne"}` });
  if (report.stabilizingUntilTick > report.tick) extraRows.push({ label: "Stabilizace po obsazení", value: formatDuration((report.stabilizingUntilTick - report.tick) * tickRateMs) });
  return { kind: "attack", modalKind: "attack", payload: {
    title, badge: outcome, tone: report.result === "catastrophe" ? "is-catastrophe"
      : (defending ? !attackerWon : attackerWon) ? "is-total-success" : "is-failure",
    summary: `${districtLabel(report.targetDistrictId)}: ${state.toLocaleLowerCase("cs-CZ")}. ${outcome}.`,
    targetDistrictId: report.targetDistrictId, districtName: districtLabel(report.targetDistrictId),
    attackPower: report.attackPower, defensePower: report.defensePower,
    attackerLossesLabel: losses(report.attackerLosses), defenderLossesLabel: losses(report.defenderLosses),
    districtStateValue: state, durationValue: formatDuration(report.attackDurationTicks * tickRateMs), extraRows
  } };
}
