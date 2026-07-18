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
  const itemSummary = normalizedItems.length
    ? normalizedItems.map((item) => `${item.label} ${item.value}`).join(" · ")
    : "Bez položek";
  return {
    tone: "is-specialty-financial",
    title: `${buildingLabel}: výběr do skladu`,
    badge: "Sklad",
    hideBadge: Boolean(hideBadge),
    summary: `Do skladu přesunuto: ${itemSummary}.`,
    rows: [
      { label: "Budova", value: buildingLabel },
      districtLabel ? { label: "District", value: districtLabel } : null,
      { label: "Typ", value: meta },
      { label: "Celkem", value: total > 0 ? `${total} ks` : `${normalizedItems.length} položek`, nowrap: true },
      ...normalizedItems.map((item) => ({ label: item.label, value: item.value, nowrap: true }))
    ].filter(Boolean),
    collectItems: normalizedItems
  };
}
