function normalizeCollectItems(items = []) {
  const byLabel = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const label = String(item?.label || item?.name || "Výstup").trim() || "Výstup";
    const amount = Number.isFinite(Number(item?.amount)) ? Math.max(0, Math.floor(Number(item.amount))) : null;
    const value = amount === null ? String(item?.value || "").trim() : `${amount} ks`;
    if (!value) continue;
    const current = byLabel.get(label);
    if (amount !== null && current?.amount !== null && current?.amount !== undefined) {
      current.amount += amount;
      current.value = `${current.amount} ks`;
    } else if (!current) {
      byLabel.set(label, { label, value, amount });
    }
  }
  return [...byLabel.values()];
}

export function getCollectItemsTotal(items = []) {
  return normalizeCollectItems(items).reduce((total, item) => total + Math.max(0, Number(item.amount || 0)), 0);
}

export function createStorageCollectResultPayload({ buildingLabel = "Budova", items = [], meta = "Sklad", districtLabel = "", hideBadge = false } = {}) {
  const normalizedItems = normalizeCollectItems(items);
  const total = getCollectItemsTotal(normalizedItems);
  const recruitmentTitleByBuildingLabel = {
    "Večerka": "Večerka: Nový nábor",
    "Bytový blok": "Bytový blok - Nový nábor"
  };
  const recruitmentTitle = recruitmentTitleByBuildingLabel[String(buildingLabel || "").trim()] || "";
  const isRecruitment = Boolean(recruitmentTitle);
  const isConvenienceStoreRecruitment = String(buildingLabel || "").trim() === "Večerka";
  const isApartmentBlockRecruitment = String(buildingLabel || "").trim() === "Bytový blok";
  const itemSummary = normalizedItems.length
    ? normalizedItems.map((item) => `${item.label} ${item.value}`).join(" · ")
    : "Bez položek";
  return {
    tone: "is-specialty-financial",
    title: recruitmentTitle || `${buildingLabel}: výběr do skladu`,
    badge: "Sklad",
    hideBadge: isRecruitment || Boolean(hideBadge),
    hideSummary: isApartmentBlockRecruitment,
    summary: isConvenienceStoreRecruitment
      ? "Podařilo se ti překecat místní na svou stranu."
      : isApartmentBlockRecruitment
        ? ""
      : `Do skladu přesunuto: ${itemSummary}.`,
    rows: [
      { label: "Budova", value: buildingLabel },
      districtLabel ? { label: "District", value: districtLabel } : null,
      isConvenienceStoreRecruitment ? null : { label: "Typ", value: meta },
      isApartmentBlockRecruitment ? null : { label: "Celkem", value: total > 0 ? `${total} ks` : `${normalizedItems.length} položek`, nowrap: true },
      ...normalizedItems.map((item) => ({ label: item.label, value: item.value, nowrap: true }))
    ].filter(Boolean),
    collectItems: normalizedItems
  };
}
