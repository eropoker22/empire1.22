export function deduplicateRumorEntries(entries = []) {
  const seen = new Set();
  return entries.filter(entry => {
    const isRumor = entry.sourceKind === "rumor" || entry.category === "rumor"
      || String(entry.id || "").startsWith("rumor-street-news:");
    if (!isRumor) return true;
    const key = String(entry.summary || entry.resultPayload?.summary || "").trim().replace(/\s+/gu, " ").toLocaleLowerCase("cs-CZ");
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
