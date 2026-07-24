const OVERVIEW_LABELS = new Set(["District", "Typ razie", "Konec za"]);
const IMPACT_LABELS = new Set([
  "Income na 1h",
  "Income po dobu razie",
  "Zabavení",
  "Zabavení cash",
  "Drogy",
  "Materiály",
  "Zatčení",
  "Zbraně",
  "Síla zbraní",
  "Vliv"
]);
const LOCK_LABELS = new Set(["Zákaz akcí", "Výroba"]);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function trimSentence(value) {
  return String(value || "").trim().replace(/[.!?]+$/u, "");
}

function playerFacingValue(label, value) {
  const text = trimSentence(value);
  const normalized = text.toLocaleLowerCase("cs");

  if (label === "Zákaz akcí") {
    if (normalized.includes("bez tvrdého zákazu")) {
      return "Akce můžeš používat dál. Policie tě pouze sleduje.";
    }
    if (normalized.includes("všechny akce")) {
      return "Do konce razie nemůžeš provádět žádné akce ani speciální akce v budovách.";
    }
    return `Do konce razie nemůžeš použít: ${text}.`;
  }

  if (label === "Výroba") {
    if (normalized.includes("bez omezení výroby")) {
      return "Výroba běží dál normálně.";
    }
    if (normalized.includes("výroba zablokovaná")) {
      return "Výroba stojí až do konce razie.";
    }
    if (normalized.includes("silně omezená výroba")) {
      return "Výroba běží výrazně pomaleji až do konce razie.";
    }
    return `Do konce razie platí: ${text}.`;
  }

  if (label.startsWith("Income")) {
    const penalty = text.replace(/^-/u, "").replace(/\s+globálně$/u, "");
    return `Do konce razie dostáváš o ${penalty} méně ze všech příjmů.`;
  }

  if (label === "Drogy") {
    return `Policie zabavila ${text.replace(/^-/u, "")} zásob drog.`;
  }

  if (label === "Materiály") {
    const penalty = text.replace(/^-/u, "").replace(/\s+včetně factory supplies$/iu, "");
    return `Policie zabavila ${penalty} materiálů a výrobních zásob.`;
  }

  if (label === "Zatčení") {
    const penalty = text.replace(/^-/u, "").replace(/\s+obyvatel$/iu, "");
    return `Policie odvedla ${penalty} obyvatel z tvého gangu.`;
  }

  if (label === "Vliv") {
    return `Tvůj vliv klesl o ${text.replace(/^-/u, "")}.`;
  }

  return String(value || "").trim();
}

function normalizeRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row && row.label != null && row.value != null)
    .map((row) => ({
      label: String(row.label || "").trim(),
      value: playerFacingValue(String(row.label || "").trim(), row.value),
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
        ${groupMarkup("Co se teď děje", impactRows, "is-impact")}
        ${groupMarkup("Blokace", lockRows, "is-lock")}
        ${groupMarkup("Zabaveno", actualRows, "is-loss")}
      </div>
      <div class="police-raid-impact-detail" data-police-raid-impact-detail hidden aria-hidden="true">
        <button class="police-raid-impact-detail__backdrop" type="button" data-police-raid-impact-close aria-label="Zavřít dopady razie"></button>
        <section class="police-raid-impact-detail__card" role="dialog" aria-modal="true" aria-label="Detail dopadů razie">
          <header class="police-raid-impact-detail__header">
            <div>
              <span>Policejní protokol je aktivní</span>
              <h4>Co jsi ztratil a co teď nemůžeš použít</h4>
            </div>
            <button class="police-raid-impact-detail__close" type="button" data-police-raid-impact-close aria-label="Zavřít">×</button>
          </header>
          <div class="police-raid-impact-detail__body">
            ${detailGroupMarkup("Zabaveno a ztraceno", lossRows, "is-loss", "Policie ti nic dalšího nezabavila.")}
            ${detailGroupMarkup("Dočasně blokováno", lockRows, "is-lock", "Žádná aktivní blokace.")}
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
