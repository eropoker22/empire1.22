const OVERVIEW_LABELS = new Set(["District", "Typ razie", "Konec za"]);
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

function detailCellMarkup(row) {
  return `
    <article class="police-raid-impact-detail__cell">
      <span>${escapeHtml(row.label)}</span>
      <strong class="${row.nowrap ? "modal__nowrap-value" : ""}">${escapeHtml(row.value)}</strong>
    </article>
  `;
}

function detailGroupMarkup(title, rows, tone = "", fallback = "Žádné aktivní dopady") {
  const safeRows = rows.length ? rows : [{ label: title, value: fallback }];
  return `
    <section class="police-raid-impact-detail__group ${tone}">
      <h4>${escapeHtml(title)}</h4>
      <div class="police-raid-impact-detail__cells">${safeRows.map(detailCellMarkup).join("")}</div>
    </section>
  `;
}

function bindPoliceRaidImpactDetailWindow(container) {
  if (!container || typeof container.querySelector !== "function") {
    return;
  }
  const trigger = container.querySelector("[data-police-raid-impact-open]");
  const detail = container.querySelector("[data-police-raid-impact-detail]");
  const closeButtons = container.querySelectorAll?.("[data-police-raid-impact-close]") || [];
  if (!trigger || !detail || typeof trigger.addEventListener !== "function") {
    return;
  }

  const openDetail = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    detail.hidden = false;
    detail.classList?.add?.("is-open");
    detail.setAttribute?.("aria-hidden", "false");
  };
  const closeDetail = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    detail.classList?.remove?.("is-open");
    detail.setAttribute?.("aria-hidden", "true");
    detail.hidden = true;
  };

  trigger.addEventListener("click", openDetail);
  for (const closeButton of closeButtons) {
    closeButton?.addEventListener?.("click", closeDetail);
  }
}

export function renderPoliceRaidImpactDetails(container, payload = {}, rows = []) {
  const tone = String(payload?.tone || "");
  if (!container || !tone.includes("is-owned-district-raid-alert")) {
    return false;
  }

  const normalizedRows = normalizeRows(rows);
  const existingDetail = container.querySelector?.("[data-police-raid-impact-detail]");
  const wasDetailOpen = Boolean(existingDetail && existingDetail.hidden === false && existingDetail.classList?.contains?.("is-open"));
  const overviewRows = normalizedRows.filter((row) => OVERVIEW_LABELS.has(row.label)).slice(0, 3);
  const impactRows = normalizedRows.filter((row) => IMPACT_LABELS.has(row.label));
  const lockRows = normalizedRows.filter((row) => LOCK_LABELS.has(row.label));
  const actualRows = normalizedRows.filter((row) => (
    row.label.startsWith("Zabaven")
    || row.label === "Zatčení členové"
    || row.label === "Ztracený vliv"
  ));
  const lossRows = [...impactRows, ...actualRows];
  const summary = String(payload?.summary || "Zkontroluj dopady a počkej na konec razie.").trim();

  container.innerHTML = `
    <div class="police-raid-impact">
      <button class="police-raid-impact__hero" type="button" data-police-raid-impact-open aria-haspopup="dialog">
        <div>
          <span>Policejní zásah</span>
          <p>${escapeHtml(summary)}</p>
          <small>Zobrazit ztráty a blokace</small>
        </div>
      </button>
      <div class="police-raid-impact__overview">
        ${overviewRows.map((row) => `
          <article>
            <span>${escapeHtml(row.label)}</span>
            <strong>${escapeHtml(row.value)}</strong>
          </article>
        `).join("")}
      </div>
      <div class="police-raid-impact__grid">
        ${groupMarkup("Dopad", impactRows, "is-impact")}
        ${groupMarkup("Blokace", lockRows, "is-lock")}
        ${groupMarkup("Zabaveno", actualRows, "is-loss")}
      </div>
      <div class="police-raid-impact-detail" data-police-raid-impact-detail hidden aria-hidden="true">
        <button class="police-raid-impact-detail__backdrop" type="button" data-police-raid-impact-close aria-label="Zavřít dopady razie"></button>
        <section class="police-raid-impact-detail__card" role="dialog" aria-modal="true" aria-label="Detail dopadů razie">
          <header class="police-raid-impact-detail__header">
            <div>
              <span>Momentální razie</span>
              <h4>Co ti policie vzala a zablokovala</h4>
            </div>
            <button class="police-raid-impact-detail__close" type="button" data-police-raid-impact-close aria-label="Zavřít">×</button>
          </header>
          <div class="police-raid-impact-detail__body">
            ${detailGroupMarkup("Přišel jsi o", lossRows, "is-loss")}
            ${detailGroupMarkup("Blokované akce", lockRows, "is-lock", "Žádná aktivní blokace")}
          </div>
        </section>
      </div>
    </div>
  `;
  bindPoliceRaidImpactDetailWindow(container);
  if (wasDetailOpen) {
    const detail = container.querySelector?.("[data-police-raid-impact-detail]");
    if (detail) {
      detail.hidden = false;
      detail.classList?.add?.("is-open");
      detail.setAttribute?.("aria-hidden", "false");
    }
  }
  return true;
}
