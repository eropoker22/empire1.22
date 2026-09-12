const resourceLabels = { chemicals: "Chemikálie", biomass: "Biomasa", "metal-parts": "Metal Parts", "tech-core": "Tech Core", "combat-module": "Bojové moduly" };

export function createPoliceRaidResultPayload(raid, formatDuration = value => Math.ceil(value / 1000) + " s", now = Date.now()) {
  const applied = raid.consequencesAppliedAtTick !== undefined || raid.status === "resolved";
  const expiresAt = Number(raid.expiresAtMs || 0);
  const active = applied && expiresAt > now && raid.status !== "resolved";
  const preview = raid.previewConsequences || {};
  const target = raid.targetDistrictId || null;
  const inspection = raid.kind === "inspection";
  return {
    title: inspection
      ? active ? "RUTINNÍ POLICEJNÍ KONTROLA" : applied ? "VÝSLEDEK POLICEJNÍ KONTROLY" : "PLÁNOVANÁ POLICEJNÍ KONTROLA"
      : active ? "PROBÍHÁ POLICEJNÍ RAZIE" : applied ? "DOPADY POLICEJNÍ RAZIE" : "POLICEJNÍ RAZIE SE BLÍŽÍ",
    hideSummary: true,
    badge: "POLICIE", tone: "is-owned-district-raid-alert", raidId: raid.raidId,
    targetDistrictId: target, previewConsequences: preview,
    summary: raid.explanation || (target ? `Policie zasáhla district ${target}.` : "Policejní zásah proti tvému gangu."),
    getRows: () => [
      ...(expiresAt > Date.now() ? [{ label: inspection ? "Konec kontroly za" : active ? "Konec razie za" : "Zásah za", value: formatDuration(Math.max(0, expiresAt - Date.now())), nowrap: true }] : []),
      ...(inspection ? [{ label: "Provoz budov", value: "Bez omezení" }] : []),
      { label: applied ? "Zabavené špinavé peníze" : "Špinavé peníze v ohrožení", value: Math.max(0, Number(preview.seizedDirtyCash || 0)) },
      ...Object.entries(preview.seizedResources || {}).filter(([, amount]) => Number(amount) > 0).map(([key, amount]) => ({ label: resourceLabels[key] || key, value: `−${amount}` })),
      ...(Number(preview.heatReducedBy) > 0 ? [{ label: "Snížení heat", value: `−${preview.heatReducedBy}` }] : [])
    ],
    refreshMs: 1000, syncToBuildingAction: false
  };
}

export function createServerPoliceRaidNews(police, { tick = 0, tickRateMs = 1000, now = Date.now(), formatDuration } = {}) {
  if (!police) return [];
  const raids = new Map();
  if (police.pendingRaid) raids.set(police.pendingRaid.raidId, police.pendingRaid);
  return [...raids.values()].filter(raid => raid.status !== "resolved"
    && raid.consequencesAppliedAtTick !== undefined && Number(raid.expiresAtMs) > now).map(raid => {
    const resultPayload = createPoliceRaidResultPayload(raid, formatDuration, now);
    return { id: `server-police-raid:${raid.raidId}`, timestampMs: now - Math.max(0, tick - Number(raid.createdAtTick || 0)) * tickRateMs,
      tone: "warning", title: resultPayload.title, summary: resultPayload.summary, meta: "Zobrazit skutečné dopady zásahu",
      expiresAt: Number(raid.expiresAtMs), sourceKind: "police-raid", category: "police-raid", persistent: true, dismissible: false,
      resultKind: "police", resultPayload };
  });
}
