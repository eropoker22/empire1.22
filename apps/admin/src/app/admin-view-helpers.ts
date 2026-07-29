export const escapeHtml = (value: unknown): string => String(value).replace(
  /[&<>"']/gu,
  (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]!
);

export const attribute = escapeHtml;

export const formatTime = (value: string | null | undefined): string =>
  value ? escapeHtml(new Date(value).toLocaleString("cs-CZ")) : "–";

export const formatNumber = (value: number): string =>
  new Intl.NumberFormat("cs-CZ").format(value);

export const badge = (label: string, tone: string): string =>
  `<span class="admin-badge admin-badge--${attribute(tone)}"><span aria-hidden="true"></span>${escapeHtml(label)}</span>`;

export const pill = (value: string): string => {
  const presentation = resolveStatusPresentation(value);
  return `<span class="admin-table-status admin-table-status--${attribute(presentation.tone)}"
    data-status-value="${attribute(value)}" title="${attribute(value)}"><span aria-hidden="true"></span>${escapeHtml(presentation.label)}</span>`;
};

export const statusLabel = (value: string): string => resolveStatusPresentation(value).label;

export const keyValue = (label: string, value: unknown): string =>
  `<span><small>${escapeHtml(label)}</small><strong>${escapeHtml(value ?? "–")}</strong></span>`;

export const codeValue = (label: string, value: string | null | undefined): string => {
  const normalized = value?.trim() || "";
  const short = normalized.length > 14 ? `${normalized.slice(0, 8)}…${normalized.slice(-4)}` : normalized || "Nedostupné";
  return `<span><small>${escapeHtml(label)}</small><code title="${attribute(normalized || "Nedostupné")}">${escapeHtml(short)}</code></span>`;
};

export type AdminIconName =
  | "overview" | "server" | "players" | "control" | "registration" | "game"
  | "build" | "diagnostics" | "snapshot" | "refresh" | "logout" | "menu";

export const adminIcon = (name: AdminIconName): string => {
  const paths: Record<AdminIconName, string> = {
    overview: '<path d="M4 4h6v6H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 14h6v6H4z"/>',
    server: '<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01"/>',
    players: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    control: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    registration: '<path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="9"/>',
    game: '<path d="M8 21h8M12 17v4M5 3h14l-1 14H6L5 3zM8 7h8M9 11h6"/>',
    build: '<path d="m14.7 6.3 3 3M3 21l6.5-1.5L19 10a2.12 2.12 0 0 0-3-3l-9.5 9.5L3 21zM12 4l2-2 8 8-2 2"/>',
    diagnostics: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 17h.01"/>',
    snapshot: '<path d="M12 2 3 7l9 5 9-5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7"/>',
    logout: '<path d="M10 17l5-5-5-5M15 12H3M15 3h5a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>'
  };
  return `<svg class="admin-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
};

export const table = (headers: string[], rows: string): string => `
  <div class="admin-table-wrap">
    <table class="admin-table">
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>${rows || `<tr><td colspan="${headers.length}">Žádná data.</td></tr>`}</tbody>
    </table>
  </div>`;

export const section = (id: string, eyebrow: string, title: string, body: string): string => `
  <section id="admin-${attribute(id)}" class="admin-panel admin-section-anchor">
    <div class="admin-panel__head"><div><span>${escapeHtml(eyebrow)}</span><h3>${escapeHtml(title)}</h3></div></div>
    ${body}
  </section>`;

export const disclosureSection = (
  id: string,
  eyebrow: string,
  title: string,
  body: string,
  open = false
): string => `
  <details id="admin-${attribute(id)}" class="admin-panel admin-disclosure-section admin-section-anchor"${open ? " open" : ""}>
    <summary>
      <div><span>${escapeHtml(eyebrow)}</span><h3>${escapeHtml(title)}</h3></div>
      <span class="admin-disclosure-section__action">Zobrazit detail</span>
    </summary>
    <div class="admin-disclosure-section__body">${body}</div>
  </details>`;

const resolveStatusPresentation = (value: string): { label: string; tone: string } => {
  const normalized = value.trim().toLowerCase();
  const labels: Record<string, string> = {
    running: "Běží",
    lobby: "Lobby",
    paused: "Pozastaven",
    restarting: "Restartuje se",
    stopped: "Zastaven",
    failed: "Chyba",
    crashed: "Havárie",
    online: "Online",
    live: "Online",
    offline: "Offline",
    stale: "Zastaralý",
    "no-worker": "Bez workeru",
    no_worker: "Bez workeru",
    ready: "Připraven",
    requested: "Požadováno",
    provisioning: "Připravuje se",
    scheduled: "Naplánováno",
    open: "Otevřeno",
    closed: "Zavřeno",
    closed_early: "Nouzově zavřeno",
    current: "Aktuální",
    pending: "Čeká",
    success: "Úspěch",
    error: "Chyba",
    warning: "Varování",
    active: "Aktivní"
  };
  let tone = "neutral";
  if (["online", "live", "running", "ready", "open", "success", "applied", "healthy"].includes(normalized)) {
    tone = "success";
  } else if (["failed", "crashed", "error", "blocked", "closed_early", "danger"].includes(normalized)) {
    tone = "danger";
  } else if (["offline", "no-worker", "no_worker"].includes(normalized)) {
    tone = "offline";
  } else if (["stale", "warning", "paused", "requested", "provisioning", "scheduled", "pending", "restarting"].includes(normalized)) {
    tone = "warning";
  }
  return { label: labels[normalized] ?? value, tone };
};
