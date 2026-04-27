const OVERVIEW_LABELS = new Set(["District", "Vlastník", "Typ razie", "Doba razie", "Konec za"]);
const IMPACT_LABELS = new Set(["Income na 1h", "Zabavení", "Drogy", "Materiály", "Zatčení", "Zbraně", "Síla zbraní", "Vliv"]);
const LOCK_LABELS = new Set(["Zákaz akcí", "Výroba"]);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row && row.label != null && row.value != null)
    .map((row) => ({
      label: String(row.label || "").trim(),
      value: String(row.value || "").trim(),
      nowrap: Boolean(row.nowrap)
    }));
}

function rowMarkup(row) {
  return `
    <div class="police-raid-impact__row">
      <span>${escapeHtml(row.label)}</span>
      <strong class="${row.nowrap ? "modal__nowrap-value" : ""}">${escapeHtml(row.value)}</strong>
    </div>
  `;
}

function groupMarkup(title, rows, tone = "") {
  if (!rows.length) {
    return "";
  }
  return `
    <section class="police-raid-impact__group ${tone}">
      <h4>${escapeHtml(title)}</h4>
      <div class="police-raid-impact__rows">${rows.map(rowMarkup).join("")}</div>
    </section>
  `;
}

export function renderPoliceRaidImpactDetails(container, payload = {}, rows = []) {
  const tone = String(payload?.tone || "");
  if (!container || !tone.includes("is-owned-district-raid-alert")) {
    return false;
  }

  const normalizedRows = normalizeRows(rows);
  const overviewRows = normalizedRows.filter((row) => OVERVIEW_LABELS.has(row.label));
  const impactRows = normalizedRows.filter((row) => IMPACT_LABELS.has(row.label));
  const lockRows = normalizedRows.filter((row) => LOCK_LABELS.has(row.label));
  const actualRows = normalizedRows.filter((row) => (
    row.label.startsWith("Zabaven")
    || row.label === "Zatčení členové"
    || row.label === "Ztracený vliv"
  ));
  const badge = String(payload?.badge || "Razia aktivní").trim();

  container.innerHTML = `
    <div class="police-raid-impact">
      <section class="police-raid-impact__hero">
        <div>
          <span>Police / Raid</span>
          <strong>${escapeHtml(payload?.title || "Dopady razie")}</strong>
          <p>${escapeHtml(payload?.summary || "Razia probíhá. Níže jsou aktivní dopady, blokace a aktuální ztráty.")}</p>
        </div>
        <em>${escapeHtml(badge)}</em>
      </section>
      <div class="police-raid-impact__overview">
        ${overviewRows.map((row) => `
          <article>
            <span>${escapeHtml(row.label)}</span>
            <strong>${escapeHtml(row.value)}</strong>
          </article>
        `).join("")}
      </div>
      <div class="police-raid-impact__grid">
        ${groupMarkup("Dopady razie", impactRows, "is-impact")}
        ${groupMarkup("Blokace", lockRows, "is-lock")}
        ${groupMarkup("Zabaveno teď", actualRows, "is-loss")}
      </div>
    </div>
  `;
  return true;
}
