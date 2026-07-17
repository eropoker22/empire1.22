(function() {
  "use strict";
  class AdminApiError extends Error {
    constructor(status, code, message) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  const createAdminApiClient = (basePath = "/api/admin") => ({
    getSession: (signal) => request(`${basePath}/session`, { signal }),
    login: (username, password, signal) => request(`${basePath}/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal
    }),
    logout: async (signal) => {
      await request(`${basePath}/session`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: "{}",
        signal
      });
    },
    getOverview: (signal) => request(`${basePath}/overview`, { signal }),
    getInstance: (instanceId, signal) => request(
      `${basePath}/instances/${encodeURIComponent(instanceId)}`,
      { signal }
    ),
    getControlPlane: (signal) => request(`${basePath}/control-plane`, { signal }),
    createServer: (input, idempotencyKey, signal) => request(`${basePath}/servers`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify(input),
      signal
    }),
    requestLifecycleAction: (instanceId, input, idempotencyKey, signal) => request(
      `${basePath}/servers/${encodeURIComponent(instanceId)}/actions`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
        body: JSON.stringify(input),
        signal
      }
    )
  });
  const request = async (url, init) => {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: { accept: "application/json", ...init.headers },
      cache: "no-store",
      ...init
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !(payload == null ? void 0 : payload.accepted)) {
      const apiError = payload && !payload.accepted ? payload.errors[0] : null;
      throw new AdminApiError(
        response.status,
        (apiError == null ? void 0 : apiError.code) ?? "ADMIN_INVALID_RESPONSE",
        (apiError == null ? void 0 : apiError.message) ?? "Admin server returned an invalid response."
      );
    }
    return payload.data;
  };
  const mapTotal = (form) => {
    const data = new FormData(form);
    return 8 + ["commercial", "residential", "industrial", "park"].reduce((sum, key) => sum + Number(data.get(key) ?? 0), 0);
  };
  const validateWizardPanel = (form, step) => {
    const panel = form.querySelector(`[data-admin-wizard-panel="${step}"]`);
    if (!panel) return false;
    for (const field of panel.querySelectorAll("input,select")) {
      if (!field.reportValidity()) return false;
    }
    if (step === 2 && mapTotal(form) !== 161) {
      const message = form.querySelector("[data-admin-create-error]");
      if (message) message.textContent = "Mapa musí obsahovat přesně 161 districtů.";
      return false;
    }
    return true;
  };
  const updateWizardReview = (form) => {
    const review = form.querySelector("[data-admin-create-review]");
    if (!review) return;
    const data = new FormData(form);
    const values = [
      ["Název", data.get("displayName")],
      ["Mode", data.get("mode")],
      ["Region", data.get("region")],
      ["Kapacita", data.get("capacity")],
      ["Join policy", data.get("joinPolicy")],
      ["Mapa", `8 / ${data.get("commercial")} / ${data.get("residential")} / ${data.get("industrial")} / ${data.get("park")}`]
    ];
    review.innerHTML = values.map(([label, value]) => `<span><small>${escapeHtml(label)}</small><strong>${escapeHtml(value ?? "-")}</strong></span>`).join("");
  };
  const escapeHtml = (value) => String(value).replace(
    /[&<>"']/gu,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]
  );
  const renderLogin = (message = "Přihlaste se do admin konzole.") => `
  <section class="admin-login" aria-labelledby="admin-login-title">
    <p class="admin-boot__eyebrow">Empire Streets</p>
    <h1 id="admin-login-title">Admin konzole</h1>
    <p>${escape(message)}</p>
    <form data-admin-login>
      <label><span>Uživatelské jméno</span><input data-admin-username type="text" autocomplete="username" required></label>
      <label><span>Heslo</span><input data-admin-password type="password" autocomplete="current-password" required></label>
      <button class="admin-button admin-button--primary" type="submit">Přihlásit</button>
      <p data-admin-login-error role="alert"></p>
    </form>
  </section>`;
  const renderLoading = () => `
  <section class="admin-login" role="status"><p class="admin-boot__eyebrow">Read-only monitoring</p><h1>Načítám admin konzoli...</h1></section>`;
  const renderUnavailable = (detail) => `
  <section class="admin-login" role="alert"><p class="admin-boot__eyebrow">Read-only monitoring</p>
    <h1>ADMIN SERVER NEDOSTUPNÝ</h1><p>${escape(detail)}</p>
    <button class="admin-button admin-button--primary" type="button" data-admin-refresh>Obnovit</button>
  </section>`;
  const renderDashboard = (input) => `
  <aside class="admin-sidebar">
    <div class="admin-brand"><span class="admin-brand__mark">ES</span><div><p>Empire Streets</p><strong>Admin</strong></div></div>
    <nav class="admin-nav" aria-label="Sekce admin konzole">
      ${nav("overview", "Overview")}${nav("servers", "Servery")}${nav("players", "Hráči")}${nav("map", "Mapa")}
      ${nav("economy", "Ekonomika")}${nav("production", "Výroba")}${nav("police", "Police")}${nav("liveness", "Liveness")}
      ${nav("commands", "Commands")}${nav("events", "Events")}${nav("diagnostics", "Diagnostics")}
    </nav>
  </aside>
  <section class="admin-main">
    <header class="admin-topbar">
      <div class="admin-topbar__title"><p>Durable control plane</p><h1>Read-only admin</h1></div>
      <div class="admin-topbar__controls">
        <div class="admin-profile"><span>Operátor</span><strong>${escape(input.session.displayName)} · ${escape(input.session.role)}</strong></div>
        <button class="admin-button" type="button" data-admin-refresh>Obnovit</button>
        <button class="admin-button" type="button" data-admin-logout>Odhlásit</button>
      </div>
    </header>
    <div class="admin-content">
      ${renderOverview(input.overview)}
      ${renderControlPlane(input.controlPlane, input.session, input.wizardOpen, input.wizardStep, input.selectedInstanceId)}
      ${renderServers(input.overview.instances, input.selectedInstanceId)}
      ${input.selectedInstanceId ? renderDetail(input.detail) : renderNoSelection()}
    </div>
  </section>`;
  const renderOverview = (overview) => `
  <section id="admin-overview" class="admin-section-anchor">
    <div class="admin-section__head"><div><p>Overview</p><h2>Autoritativní stav instancí</h2></div>${badge("DB AVAILABLE", "success")}</div>
    <div class="admin-metrics">
      ${metric("Známé servery", overview.counts.known)}${metric("Live", overview.counts.live)}${metric("Stale", overview.counts.stale)}
      ${metric("Offline", overview.counts.offline)}${metric("No worker", overview.counts.noWorker)}${metric("Failed", overview.counts.failed)}
      ${metric("Running", overview.counts.running)}${metric("Lobby", overview.counts.lobby)}${metric("Paused", overview.counts.paused)}
      ${metric("Hráči", overview.counts.players)}
    </div>
    <p class="admin-copy">Data vygenerována ${time(overview.generatedAt)}. Stav LIVE určuje durable heartbeat, ne úspěch HTTP requestu.</p>
  </section>`;
  const renderControlPlane = (control, session, wizardOpen, wizardStep, selectedInstanceId) => {
    if (!control) return `<section class="admin-panel" role="status"><h3>Načítám control plane...</h3></section>`;
    const ready = !control.unavailableCode && session.role !== "viewer";
    const selected = control.servers.find((entry) => entry.serverInstanceId === selectedInstanceId) ?? null;
    return `<section id="admin-control-plane" class="admin-panel admin-section-anchor">
    <div class="admin-panel__head"><div><span>Hosted control plane</span><h3>Provisioning a lifecycle</h3></div>
      ${badge(control.unavailableCode ?? "WRITES ENABLED", ready ? "success" : "warning")}</div>
    <div class="admin-kv-grid">${kv("Database", control.databaseAvailable ? "AVAILABLE" : "UNAVAILABLE")}
      ${kv("Migrace", control.migrationsCurrent ? "CURRENT" : "PENDING")}${kv("Worker", control.workerStatus.toUpperCase())}
      ${kv("Provisioning", control.provisioningEnabled ? "ENABLED" : "DISABLED")}</div>
    ${ready && !wizardOpen ? `<button class="admin-button admin-button--primary" type="button" data-admin-create-open>Vytvořit server</button>` : ""}
    ${wizardOpen && ready ? renderCreateWizard(wizardStep) : ""}
    ${selected && ready ? renderLifecycle(selected, session) : ""}
  </section>`;
  };
  const renderCreateWizard = (step) => `
  <form class="admin-wizard" data-admin-create-form>
    <div class="admin-wizard__steps" aria-label="Kroky vytvoření serveru">
      ${["Základ", "Mapa", "Přístup", "Kontrola"].map((label, index) => `<span class="${step === index + 1 ? "is-active" : ""}">${index + 1}. ${label}</span>`).join("")}
    </div>
    <fieldset data-admin-wizard-panel="1" ${step === 1 ? "" : "hidden"}>
      <legend>Základ</legend>
      <label><span>Název</span><input name="displayName" minlength="3" maxlength="80" required></label>
      <label><span>Mode</span><select name="mode"><option value="free">Free</option><option value="war">War</option></select></label>
      <label><span>Region</span><select name="region"><option value="eu-central">EU Central</option></select></label>
      <label><span>Kapacita</span><input name="capacity" type="number" min="1" max="20" value="20" required></label>
      <button class="admin-button admin-button--primary" type="button" data-admin-wizard-next>Další</button>
    </fieldset>
    <fieldset data-admin-wizard-panel="2" ${step === 2 ? "" : "hidden"}>
      <legend>Mapa</legend><div class="admin-map-counts">
        <label><span>Downtown</span><input value="8" disabled></label>
        <label><span>Commercial</span><input name="commercial" data-admin-map-count type="number" min="0" value="40" required></label>
        <label><span>Residential</span><input name="residential" data-admin-map-count type="number" min="0" value="38" required></label>
        <label><span>Industrial</span><input name="industrial" data-admin-map-count type="number" min="0" value="38" required></label>
        <label><span>Park</span><input name="park" data-admin-map-count type="number" min="0" value="37" required></label>
      </div><p>Celkem: <output data-admin-map-total>161</output> / 161</p>
      <button class="admin-button" type="button" data-admin-wizard-back>Zpět</button>
      <button class="admin-button admin-button--primary" type="button" data-admin-wizard-next>Další</button>
    </fieldset>
    <fieldset data-admin-wizard-panel="3" ${step === 3 ? "" : "hidden"}>
      <legend>Přístup</legend>
      <label><input type="radio" name="joinPolicy" value="closed" checked> Closed</label>
      <label><input type="radio" name="joinPolicy" value="invite_only"> Invite-only</label>
      <label><input type="radio" name="joinPolicy" value="open" disabled> Open (až po provisioningu)</label>
      <button class="admin-button" type="button" data-admin-wizard-back>Zpět</button>
      <button class="admin-button admin-button--primary" type="button" data-admin-wizard-next>Další</button>
    </fieldset>
    <fieldset data-admin-wizard-panel="4" ${step === 4 ? "" : "hidden"}>
      <legend>Kontrola</legend><div class="admin-kv-grid" data-admin-create-review></div>
      <p class="admin-notice">Server vznikne jako REQUESTED a joins zůstanou zavřené do dokončení provisioningu.</p>
      <button class="admin-button" type="button" data-admin-wizard-back>Zpět</button>
      <button class="admin-button admin-button--primary" type="submit">Create Server</button>
    </fieldset>
    <button class="admin-button" type="button" data-admin-create-cancel>Zrušit</button>
    <p data-admin-create-error role="alert"></p>
  </form>`;
  const renderLifecycle = (server, session) => `
  <div class="admin-lifecycle"><h4>Lifecycle: ${escape(server.displayName)}</h4>
    <p>${pill(server.status)} ${pill(server.provisioningState)} · version ${server.version}</p>
    <div class="admin-kv-grid">${kv("Committed players", server.committedPlayers ?? 0)}
      ${kv("Reserved slots", server.reservedSlots ?? 0)}${kv("Capacity", server.capacity)}
      ${kv("Join policy", server.joinPolicy)}${kv("Lease owner", server.runtimeLeaseOwnerId)}
      ${kv("Last error", server.lastErrorCode)}</div>
    <label><span>Důvod akce</span><input data-admin-action-reason minlength="3" maxlength="240" required></label>
    <div class="admin-lifecycle__actions">
      ${lifecycleButton(server, "open-joins", "Open joins")}${lifecycleButton(server, "close-joins", "Close joins")}
      ${lifecycleButton(server, "start", "Start")}${lifecycleButton(server, "pause", "Pause")}
      ${lifecycleButton(server, "resume", "Resume")}${lifecycleButton(server, "restart", "Safe restart")}
      ${session.role === "owner" ? lifecycleButton(server, "stop", "Stop") : ""}
    </div><p data-admin-action-error role="alert"></p>
  </div>`;
  const lifecycleButton = (server, action, label) => `<button class="admin-button" type="button" data-admin-lifecycle="${attr(action)}" data-admin-server-id="${attr(server.serverInstanceId)}">${escape(label)}</button>`;
  const renderServers = (instances, selected) => `
  <section id="admin-servers" class="admin-panel admin-section-anchor">
    <div class="admin-panel__head"><div><span>Servery</span><h3>Durable instance registry</h3></div>${badge(`${instances.length} INSTANCÍ`, "info")}</div>
    ${instances.length === 0 ? `<p class="admin-copy">Žádné instance.</p>` : table(
    ["Instance", "Mode / region", "Status", "Worker", "Hráči", "Snapshot", "Heartbeat"],
    instances.map((item) => `<tr class="${item.serverInstanceId === selected ? "is-selected" : ""}">
        <td><a href="?instance=${encodeURIComponent(item.serverInstanceId)}" data-admin-instance="${attr(item.serverInstanceId)}"><strong>${escape(item.displayName)}</strong><br><small>${escape(item.serverInstanceId)}</small></a></td>
        <td>${escape(item.mode)} / ${escape(item.region)}</td><td>${pill(item.status)}</td><td>${pill(item.workerStatus)}</td>
        <td>${item.playerCount} / ${item.capacity}</td><td>${time(item.lastSnapshotAt)}</td><td>${time(item.lastHeartbeatAt)}</td></tr>`).join("")
  )}
  </section>`;
  const renderNoSelection = () => `
  <section class="admin-panel" role="status"><div class="admin-panel__head"><div><span>Detail</span><h3>Vyberte instanci</h3></div></div>
    <p class="admin-copy">Bez explicitně vybrané instance se detailní data nenačítají.</p></section>`;
  const renderDetail = (detail) => detail ? `
  <section class="admin-section-anchor">
    <div class="admin-section__head"><div><p>Instance detail</p><h2>${escape(detail.summary.displayName)}</h2><small>${escape(detail.serverInstanceId)}</small></div>
      ${badge(detail.summary.workerStatus.toUpperCase(), detail.summary.workerStatus === "live" ? "success" : "warning")}</div>
    <div class="admin-kv-grid">${kv("Mode", detail.summary.mode)}${kv("Region", detail.summary.region)}${kv("Status", detail.summary.status)}
      ${kv("Join policy", detail.summary.joinPolicy)}${kv("Tick", detail.summary.currentTick)}${kv("State version", detail.summary.stateVersion)}
      ${kv("Snapshot", time(detail.summary.lastSnapshotAt))}${kv("Heartbeat", time(detail.summary.lastHeartbeatAt))}${kv("Lease owner", detail.summary.leaseOwner)}</div>
    ${detail.runtimeAvailable ? "" : `<p class="admin-notice">Live runtime není dostupný. Zobrazená data pocházejí z durable snapshotu a mohou být stale.</p>`}
  </section>
  ${section("players", "Hráči", table(["Hráč", "Stav", "Districty", "Cash", "Heat"], detail.players.map((row) => `<tr><td>${escape(row.displayName)}<br><small>${escape(row.playerId)}</small></td><td>${escape(row.status)}</td><td>${row.ownedDistrictCount}</td><td>${row.cash}</td><td>${row.heat}</td></tr>`).join("")))}
  ${section("map", "Mapa", table(["District", "Zone", "Owner", "Heat", "Buildings"], detail.districts.map((row) => `<tr><td>${escape(row.name)}<br><small>${escape(row.districtId)}</small></td><td>${escape(row.zone)}</td><td>${escape(row.ownerPlayerId ?? "-")}</td><td>${row.heat}</td><td>${row.buildingCount}</td></tr>`).join("")))}
  ${section("economy", "Ekonomika", `<div class="admin-kv-grid">${kv("Clean cash", detail.economy.totalCleanCash)}${kv("Dirty cash", detail.economy.totalDirtyCash)}${kv("Resources", Object.values(detail.economy.totalResources).reduce((sum, value) => sum + value, 0))}</div>`)}
  ${section("production", "Výroba", `<div class="admin-kv-grid">${kv("Buildings", detail.production.productionBuildingCount)}${kv("Ready", detail.production.readyToCollectCount)}${kv("Crafts", detail.production.activeCraftCount)}${kv("Storage full", detail.production.storageFullCount)}</div>`)}
  ${section("police", "Police", `<div class="admin-kv-grid">${kv("Pressure", detail.police.heatPressure)}${kv("Max heat", detail.police.maxPlayerHeat)}${kv("Wanted", detail.police.wantedPlayerCount)}${kv("Raids", detail.police.pendingRaidCount)}</div>`)}
  ${section("liveness", "Liveness", `<div class="admin-kv-grid">${kv("Active", detail.liveness.activePlayers)}${kv("Playable", detail.liveness.playablePlayers)}${kv("Sealed", detail.liveness.temporarilySealedPlayers)}${kv("Softlocks", detail.liveness.invalidSoftlocks)}</div>`)}
  ${section("commands", "Commands", table(["Type", "Command", "Actor", "Tick", "Received"], detail.commands.map((row) => `<tr><td>${escape(row.commandType)}</td><td>${escape(row.commandId)}</td><td>${escape(row.actorId)}</td><td>${row.tickAtReceive}</td><td>${time(row.receivedAt)}</td></tr>`).join("")))}
  ${section("events", "Events", table(["Type", "Event", "Command", "Tick", "Occurred"], detail.events.map((row) => `<tr><td>${escape(row.eventType)}</td><td>${escape(row.eventId)}</td><td>${escape(row.causedByCommandId ?? "-")}</td><td>${row.tick}</td><td>${time(row.occurredAt)}</td></tr>`).join("")))}
  ${section("diagnostics", "Diagnostics", table(["Level", "Category", "Code", "Command", "Occurred"], detail.diagnostics.map((row) => `<tr><td>${pill(row.level)}</td><td>${escape(row.category)}</td><td>${escape(row.messageCode)}</td><td>${escape(row.commandId ?? "-")}</td><td>${time(row.occurredAt)}</td></tr>`).join("")))}
` : `<section class="admin-panel" role="status"><h3>Načítám detail instance...</h3></section>`;
  const nav = (id, label) => `<a class="admin-nav__item" href="#admin-${id}"><span class="admin-nav__dot"></span><strong>${escape(label)}</strong></a>`;
  const section = (id, title, body) => `<section id="admin-${id}" class="admin-panel admin-section-anchor"><div class="admin-panel__head"><div><span>Instance</span><h3>${escape(title)}</h3></div></div>${body}</section>`;
  const metric = (label, value) => `<article class="admin-metric"><span>${escape(label)}</span><strong>${value}</strong></article>`;
  const kv = (label, value) => `<span><small>${escape(label)}</small><strong>${escape(value ?? "-")}</strong></span>`;
  const badge = (label, tone) => `<span class="admin-badge admin-badge--${tone}">${escape(label)}</span>`;
  const pill = (value) => `<span class="admin-table-status">${escape(value)}</span>`;
  const table = (headers, rows) => `<div class="admin-table-wrap"><table class="admin-table"><thead><tr>${headers.map((head) => `<th>${escape(head)}</th>`).join("")}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}">Žádná data.</td></tr>`}</tbody></table></div>`;
  const time = (value) => value ? escape(new Date(value).toLocaleString("cs-CZ")) : "-";
  const escape = (value) => String(value).replace(/[&<>"']/gu, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const attr = escape;
  const POLL_INTERVAL_MS = 1e4;
  const MAX_BACKOFF_MS = 8e4;
  const createAdminApp = (options = {}) => {
    const client = options.client ?? createAdminApiClient();
    const pollInterval = Math.max(1e3, options.pollIntervalMs ?? POLL_INTERVAL_MS);
    let target = null;
    let session = null;
    let overview = null;
    let detail = null;
    let controlPlane = null;
    let selectedInstanceId = selectedFromUrl();
    let requestSequence = 0;
    let activeRequest = null;
    let timer = null;
    let backoff = pollInterval;
    let wizardOpen = false;
    let wizardStep = 1;
    let createIdempotencyKey = null;
    const mount = async (mountTarget) => {
      target = mountTarget ?? document.getElementById("admin-dashboard-root");
      if (!target) return;
      target.innerHTML = renderLoading();
      document.addEventListener("visibilitychange", handleVisibility);
      try {
        session = await client.getSession();
        await refresh();
      } catch (error) {
        handleError(error);
      }
    };
    const refresh = async () => {
      if (!target || !session || document.hidden) return;
      if (wizardOpen) {
        schedule(pollInterval);
        return;
      }
      const sequence = ++requestSequence;
      activeRequest == null ? void 0 : activeRequest.abort();
      activeRequest = new AbortController();
      try {
        const requestedInstanceId = selectedInstanceId;
        const [nextOverview, nextDetail, nextControlPlane] = await Promise.all([
          client.getOverview(activeRequest.signal),
          requestedInstanceId ? client.getInstance(requestedInstanceId, activeRequest.signal) : Promise.resolve(null),
          client.getControlPlane(activeRequest.signal)
        ]);
        if (sequence !== requestSequence || requestedInstanceId !== selectedInstanceId) return;
        overview = nextOverview;
        detail = nextDetail;
        controlPlane = nextControlPlane;
        backoff = pollInterval;
        render();
        schedule(pollInterval);
      } catch (error) {
        if (isAbort(error)) return;
        backoff = Math.min(MAX_BACKOFF_MS, backoff * 2);
        handleError(error);
        if (session) schedule(backoff);
      }
    };
    const render = () => {
      if (!target || !session || !overview) return;
      target.innerHTML = renderDashboard({ session, overview, detail, selectedInstanceId, controlPlane, wizardOpen, wizardStep });
      bindActions();
    };
    const bindActions = () => {
      var _a, _b, _c, _d, _e;
      target == null ? void 0 : target.querySelectorAll("[data-admin-instance]").forEach((link) => link.addEventListener("click", (event) => {
        var _a2;
        event.preventDefault();
        const next = ((_a2 = link.dataset.adminInstance) == null ? void 0 : _a2.trim()) || null;
        if (next === selectedInstanceId) return;
        selectedInstanceId = next;
        detail = null;
        updateUrl(next);
        render();
        void refresh();
      }));
      (_a = target == null ? void 0 : target.querySelector("[data-admin-refresh]")) == null ? void 0 : _a.addEventListener("click", () => void refresh());
      (_b = target == null ? void 0 : target.querySelector("[data-admin-logout]")) == null ? void 0 : _b.addEventListener("click", () => void logout());
      (_c = target == null ? void 0 : target.querySelector("[data-admin-create-open]")) == null ? void 0 : _c.addEventListener("click", () => {
        wizardOpen = true;
        wizardStep = 1;
        createIdempotencyKey ?? (createIdempotencyKey = createKey());
        render();
      });
      (_d = target == null ? void 0 : target.querySelector("[data-admin-create-cancel]")) == null ? void 0 : _d.addEventListener("click", () => {
        wizardOpen = false;
        wizardStep = 1;
        createIdempotencyKey = null;
        render();
      });
      target == null ? void 0 : target.querySelectorAll("[data-admin-wizard-next]").forEach((button) => button.addEventListener("click", () => {
        const form = target == null ? void 0 : target.querySelector("[data-admin-create-form]");
        if (!form || !validateWizardPanel(form, wizardStep)) return;
        wizardStep = Math.min(4, wizardStep + 1);
        applyWizardStep();
      }));
      target == null ? void 0 : target.querySelectorAll("[data-admin-wizard-back]").forEach((button) => button.addEventListener("click", () => {
        wizardStep = Math.max(1, wizardStep - 1);
        applyWizardStep();
      }));
      bindMapTotal();
      (_e = target == null ? void 0 : target.querySelector("[data-admin-create-form]")) == null ? void 0 : _e.addEventListener("submit", (event) => void submitCreate(event));
      target == null ? void 0 : target.querySelectorAll("[data-admin-lifecycle]").forEach((button) => button.addEventListener("click", () => void submitLifecycle(button)));
    };
    const submitCreate = async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity() || !createIdempotencyKey) return;
      if (mapTotal(form) !== 161) {
        const message = form.querySelector("[data-admin-create-error]");
        if (message) message.textContent = "Mapa musí obsahovat přesně 161 districtů.";
        return;
      }
      const data = new FormData(form);
      const payload = {
        displayName: String(data.get("displayName") ?? ""),
        mode: String(data.get("mode")),
        region: String(data.get("region")),
        capacity: Number(data.get("capacity")),
        joinPolicy: String(data.get("joinPolicy")),
        mapComposition: {
          downtown: 8,
          commercial: Number(data.get("commercial")),
          residential: Number(data.get("residential")),
          industrial: Number(data.get("industrial")),
          park: Number(data.get("park"))
        }
      };
      const submit = form.querySelector("[type=submit]");
      if (submit) submit.disabled = true;
      try {
        const result = await client.createServer(payload, createIdempotencyKey);
        selectedInstanceId = result.server.serverInstanceId;
        updateUrl(selectedInstanceId);
        wizardOpen = false;
        wizardStep = 1;
        createIdempotencyKey = null;
        await refresh();
      } catch (error) {
        const message = form.querySelector("[data-admin-create-error]");
        if (message) message.textContent = error instanceof Error ? error.message : "Server nebylo možné vytvořit.";
        if (submit) submit.disabled = false;
      }
    };
    const submitLifecycle = async (button) => {
      var _a;
      const instanceId = button.dataset.adminServerId;
      const action = button.dataset.adminLifecycle;
      const hosted = controlPlane == null ? void 0 : controlPlane.servers.find((entry) => entry.serverInstanceId === instanceId);
      const reason = ((_a = target == null ? void 0 : target.querySelector("[data-admin-action-reason]")) == null ? void 0 : _a.value.trim()) ?? "";
      if (!instanceId || !action || !hosted) return;
      if (reason.length < 3) {
        const message = target == null ? void 0 : target.querySelector("[data-admin-action-error]");
        if (message) message.textContent = "Uveďte důvod akce alespoň třemi znaky.";
        return;
      }
      button.disabled = true;
      try {
        await client.requestLifecycleAction(instanceId, { action, expectedVersion: hosted.version, reason }, createKey());
        await refresh();
      } catch (error) {
        const message = target == null ? void 0 : target.querySelector("[data-admin-action-error]");
        if (message) message.textContent = error instanceof Error ? error.message : "Akci nebylo možné zařadit.";
        button.disabled = false;
      }
    };
    const bindMapTotal = () => {
      const form = target == null ? void 0 : target.querySelector("[data-admin-create-form]");
      const output = form == null ? void 0 : form.querySelector("[data-admin-map-total]");
      if (!form || !output) return;
      const update = () => {
        const total = mapTotal(form);
        output.value = String(total);
        output.dataset.valid = String(total === 161);
        updateWizardReview(form);
      };
      form.querySelectorAll("[data-admin-map-count]").forEach((input) => input.addEventListener("input", update));
      update();
    };
    const applyWizardStep = () => {
      target == null ? void 0 : target.querySelectorAll("[data-admin-wizard-panel]").forEach((panel) => {
        panel.hidden = Number(panel.dataset.adminWizardPanel) !== wizardStep;
      });
      const form = target == null ? void 0 : target.querySelector("[data-admin-create-form]");
      if (form) updateWizardReview(form);
    };
    const bindLogin = () => {
      const form = target == null ? void 0 : target.querySelector("[data-admin-login]");
      const usernameInput = target == null ? void 0 : target.querySelector("[data-admin-username]");
      const passwordInput = target == null ? void 0 : target.querySelector("[data-admin-password]");
      if (!form || !usernameInput || !passwordInput) return;
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const username = usernameInput.value;
        const password = passwordInput.value;
        passwordInput.value = "";
        try {
          session = await client.login(username, password);
          overview = null;
          controlPlane = null;
          detail = null;
          target.innerHTML = renderLoading();
          await refresh();
        } catch (error) {
          const message = target == null ? void 0 : target.querySelector("[data-admin-login-error]");
          if (message) message.textContent = error instanceof Error ? error.message : "Přihlášení selhalo.";
        }
      });
    };
    const logout = async () => {
      activeRequest == null ? void 0 : activeRequest.abort();
      clearSchedule();
      try {
        await client.logout();
      } catch (_error) {
      }
      session = null;
      overview = null;
      detail = null;
      controlPlane = null;
      if (target) target.innerHTML = renderLogin("Admin session byla ukončena.");
      bindLogin();
    };
    const handleError = (error) => {
      var _a;
      if (!target) return;
      if (error instanceof AdminApiError && (error.status === 401 || error.code.includes("SESSION"))) {
        session = null;
        overview = null;
        detail = null;
        controlPlane = null;
        target.innerHTML = renderLogin(error.code === "ADMIN_SESSION_EXPIRED" ? "Admin session vypršela." : void 0);
        bindLogin();
        return;
      }
      target.innerHTML = renderUnavailable(error instanceof Error ? error.message : "Monitoring není dostupný.");
      (_a = target.querySelector("[data-admin-refresh]")) == null ? void 0 : _a.addEventListener("click", () => void refresh());
    };
    const handleVisibility = () => {
      if (document.hidden) {
        activeRequest == null ? void 0 : activeRequest.abort();
        clearSchedule();
      } else if (session) void refresh();
    };
    const schedule = (delay) => {
      clearSchedule();
      timer = setTimeout(() => void refresh(), delay);
    };
    const clearSchedule = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    return { mount, refresh };
  };
  const selectedFromUrl = () => typeof location === "undefined" ? null : new URL(location.href).searchParams.get("instance");
  const updateUrl = (instanceId) => {
    const url = new URL(location.href);
    instanceId ? url.searchParams.set("instance", instanceId) : url.searchParams.delete("instance");
    history.replaceState(null, "", url);
  };
  const isAbort = (error) => error instanceof DOMException && error.name === "AbortError";
  const createKey = () => `admin-ui:${crypto.randomUUID()}`;
  void createAdminApp().mount();
})();
