import { canPerformAction, createAdminAuditEntry, isDangerousAction, requiresDoubleConfirm } from "./admin-security.js";

export function bindAdminActions(root, state, render, provider) {
  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.matches("[data-close-modal]") && !target.closest("[data-modal-card]")) {
      closeModal(state, render);
      return;
    }

    const closeButton = target.closest("[data-close-modal]");
    if (closeButton) {
      closeModal(state, render);
      return;
    }

    const confirmButton = target.closest("[data-confirm-action]");
    if (confirmButton instanceof HTMLElement) {
      const action = confirmButton.dataset.confirmAction || "";
      const id = confirmButton.dataset.entityId || "";
      const mustDoubleConfirm = Boolean(root.querySelector("[data-double-confirm]"));
      const doubleConfirmed = Boolean(root.querySelector("[data-double-confirm]:checked"));
      if (mustDoubleConfirm && !doubleConfirmed) {
        pushToast(state, "Double confirmation required", "Zaškrtni potvrzení pro nevratnou admin akci.", "danger");
        render();
        return;
      }
      state.view.modal = null;
      void performAdminAction({ action, id, state, render, provider, confirmed: true });
      return;
    }

    const sectionButton = target.closest("[data-section]");
    if (sectionButton instanceof HTMLElement) {
      state.view.section = sectionButton.dataset.section || "overview";
      state.view.modal = null;
      render();
      return;
    }

    const actionButton = target.closest("[data-action]");
    if (actionButton instanceof HTMLElement) {
      const action = actionButton.dataset.action || "";
      const id = actionButton.dataset.entityId || "";
      void performAdminAction({ action, id, state, render, provider });
    }
  });

  root.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;

    if (target.matches("[data-admin-mode]")) {
      state.view.mode = target.value;
      state.view.server = "all";
      render();
    }

    if (target.matches("[data-admin-server]")) {
      state.view.server = target.value;
      render();
    }

    if (target.matches("[data-admin-sort]")) {
      state.view.sortBy = target.value;
      render();
    }
  });

  root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.matches("[data-admin-search]")) {
      state.view.search = target.value;
      render();
    }
  });
}

async function performAdminAction({ action, id, state, render, provider, confirmed = false }) {
  if (!action) return;
  if (!canPerformAction(state.access.role, action)) {
    pushToast(state, "Permission denied", `${state.access.role} nemá právo pro ${action}.`, "danger");
    render();
    return;
  }

  if (isDangerousAction(action) && !confirmed) {
    state.view.modal = {
      type: "confirm",
      action,
      id,
      doubleConfirm: requiresDoubleConfirm(action),
      message: `Akce ${action} zasáhne ${id || "aktuální scope"}. V produkci ji musí potvrdit backend permission check a audit log.`
    };
    render();
    return;
  }

  const handled = applyMockMutation(action, id, state);
  const response = await provider.applyCommand({
    id: `admin-command-${Date.now()}`,
    action,
    targetId: id || null,
    actorAdminId: state.data.admin.id,
    issuedAt: new Date().toISOString()
  });

  appendAudit(state, action, id, response.ok ? "accepted" : "rejected");
  pushToast(
    state,
    handled.title,
    `${handled.message} Backend seam: ${response.endpoint || "mock"}.`,
    handled.tone
  );
  render();
}

function applyMockMutation(action, id, state) {
  const data = state.data;

  if (action === "open-security") {
    state.view.section = "security";
    return ok("Security", "Otevřen security panel.", "info");
  }
  if (action === "open-logs" || action === "clear-filters") {
    state.view.section = "logs";
    state.view.search = "";
    return ok("Logs", "Filtry byly lokálně vyčištěné.", "info");
  }
  if (action === "view-player") {
    state.view.selectedPlayerId = id;
    state.view.modal = { type: "player", id };
    return ok("Player profile", "Detail hráče otevřen.", "info");
  }
  if (action === "add-resources") {
    const player = find(data.players, id);
    if (player) {
      player.cleanCash += 5000;
      player.dirtyCash += 8000;
    }
    return ok("Resources added", "Mock cash resources připsané hráči.", "success");
  }
  if (action === "reduce-player-heat" || action === "clear-wanted") {
    const player = find(data.players, id) || data.players.sort((a, b) => b.heat - a.heat)[0];
    if (player) player.heat = Math.max(0, player.heat - 15);
    return ok("Heat reduced", "Heat targetu byl snížen o 15 bodů.", "success");
  }
  if (action === "ban-player" || action === "unban-player") {
    const player = find(data.players, id);
    if (player) player.banned = action === "ban-player";
    return ok(action === "ban-player" ? "Player banned" : "Player unbanned", "Moderation flag změněn v mock datech.", "warning");
  }
  if (action === "reset-player") {
    const player = find(data.players, id);
    if (player) {
      player.cleanCash = 0;
      player.dirtyCash = 0;
      player.heat = 0;
      player.districtCount = 1;
    }
    return ok("Player reset", "Mock účet byl resetovaný.", "warning");
  }
  if (action === "move-player") {
    const player = find(data.players, id);
    if (player) player.server = data.servers.find((server) => server.id !== player.server)?.id || player.server;
    return ok("Player moved", "Hráč byl přesunut na další mock server.", "success");
  }
  if (action === "message-player" || action === "send-admin-message" || action === "message-alliance") {
    state.view.modal = { type: "notice", title: "Admin message", message: "Mock zpráva byla zapsána do admin action logu." };
    return ok("Message queued", "Admin message připravena pro command endpoint.", "success");
  }
  if (action.endsWith("-server")) {
    mutateServer(action, id, data);
    return ok("Server command", `Server action ${action} aplikována na mock instanci.`, isDangerousAction(action) ? "warning" : "success");
  }
  if (["change-owner", "clear-trap", "add-trap", "add-district-heat", "reduce-district-heat", "trigger-raid", "lock-district", "unlock-district", "inspect-district", "inspect-buildings"].includes(action)) {
    mutateDistrict(action, id, data);
    return ok("District command", `District action ${action} aplikována.`, action === "trigger-raid" ? "warning" : "success");
  }
  if (["rename-alliance", "apply-alliance-penalty", "inspect-war-activity", "dissolve-alliance"].includes(action)) {
    mutateAlliance(action, id, data);
    return ok("Alliance command", `Alliance action ${action} aplikována.`, isDangerousAction(action) ? "warning" : "success");
  }
  if (["create-event", "activate-event", "pause-event", "end-event", "duplicate-event"].includes(action)) {
    mutateEvent(action, id, data);
    return ok("Event command", `Event action ${action} aplikována.`, "success");
  }
  if (["edit-building-balance", "inspect-production", "disable-building", "boost-building", "reset-building-cooldowns"].includes(action)) {
    mutateBuilding(action, id, data);
    return ok("Building command", `Building action ${action} aplikována.`, "success");
  }
  if (action === "simulate-ai-tick" || action === "trigger-financial-raid" || action === "trigger-drug-raid" || action === "trigger-arms-raid" || action === "trigger-lockdown") {
    data.police.seizedResources += 4200;
    data.police.pressureByServer.forEach((server) => { server.value = Math.min(100, server.value + 3); });
    return ok("Police AI tick", "Police pressure a seized resources byly posunuty.", "warning");
  }
  if (action === "simulate-economy-tick") {
    data.economy.cashOverTime.push(data.economy.cashOverTime[data.economy.cashOverTime.length - 1] + 120);
    data.economy.cashOverTime = data.economy.cashOverTime.slice(-12);
    data.economy.inflation = Number((data.economy.inflation + 0.3).toFixed(1));
    return ok("Economy tick", "Economy time series posunuta o jeden mock tick.", "success");
  }
  if (action === "run-permission-check" || action === "save-settings" || action === "export-monetization" || action === "inspect-repeat-attacks") {
    return ok("Admin command", `${action} prošla mock command boundary.`, "info");
  }

  return ok("Admin command", `${action} připravena pro backend API.`, "info");
}

function mutateServer(action, id, data) {
  const server = find(data.servers, id) || data.servers[0];
  if (!server) return;
  const nextStatus = {
    "start-server": "running",
    "pause-server": "paused",
    "maintenance-server": "maintenance",
    "end-server": "ended",
    "reset-demo": "open"
  }[action];
  if (nextStatus) server.status = nextStatus;
  if (action === "reset-demo") {
    data.events.forEach((event) => { event.active = false; });
  }
}

function mutateDistrict(action, id, data) {
  const district = find(data.districts, id) || data.districts[0];
  if (!district) return;
  if (action === "change-owner") {
    const nextPlayer = data.players.find((player) => player.nickname !== district.owner);
    district.owner = nextPlayer?.nickname || district.owner;
    district.ownerId = nextPlayer?.id || district.ownerId;
  }
  if (action === "clear-trap") {
    district.activeTrap = "";
    district.toxicTrap = null;
  }
  if (action === "add-trap") {
    district.activeTrap = "toxic trap";
    district.toxicTrap = { embedded: true, severity: "medium", expiresIn: "30m" };
  }
  if (action === "add-district-heat") district.heat = Math.min(100, district.heat + 10);
  if (action === "reduce-district-heat") district.heat = Math.max(0, district.heat - 10);
  if (action === "trigger-raid") district.policeStatus = "raid active";
  if (action === "lock-district") district.locked = true;
  if (action === "unlock-district") district.locked = false;
}

function mutateAlliance(action, id, data) {
  const alliance = find(data.alliances, id) || data.alliances[0];
  if (!alliance) return;
  if (action === "apply-alliance-penalty") {
    alliance.influence = Math.max(0, alliance.influence - 8);
    alliance.economyPower = Math.max(0, alliance.economyPower - 18000);
  }
  if (action === "rename-alliance") alliance.name = `${alliance.name} Ops`;
  if (action === "dissolve-alliance") alliance.members = 0;
}

function mutateEvent(action, id, data) {
  if (action === "create-event") {
    data.events.unshift({
      id: `event-custom-${Date.now()}`,
      name: "Admin Pulse",
      category: "admin",
      description: "Mock custom admin event prepared for API persistence.",
      duration: "45m",
      effects: ["admin modifier"],
      scope: "server",
      stacking: "none",
      priority: 8,
      visibleTo: "admins",
      active: false
    });
    return;
  }
  const event = find(data.events, id) || data.events[0];
  if (!event) return;
  if (action === "activate-event") event.active = true;
  if (action === "pause-event" || action === "end-event") event.active = false;
  if (action === "duplicate-event") data.events.unshift({ ...event, id: `event-copy-${Date.now()}`, name: `${event.name} Copy`, active: false });
}

function mutateBuilding(action, id, data) {
  const building = find(data.buildings, id) || data.buildings[0];
  if (!building) return;
  if (action === "disable-building") building.disabled = !building.disabled;
  if (action === "boost-building") building.production = `${building.production} +boost`;
  if (action === "reset-building-cooldowns") building.cooldown = "ready";
  if (action === "edit-building-balance") building.income += 75;
}

function appendAudit(state, action, target, status) {
  const entry = createAdminAuditEntry({
    action,
    target,
    status,
    actor: state.data.admin.id
  });
  state.data.logs.unshift(entry);
  state.data.security.auditTrail.unshift(entry);
  state.data.security.auditTrail = state.data.security.auditTrail.slice(0, 16);
}

function pushToast(state, title, message, tone = "info") {
  state.view.toasts.unshift({
    id: `toast-${Date.now()}`,
    title,
    message,
    tone
  });
  state.view.toasts = state.view.toasts.slice(0, 4);
}

function closeModal(state, render) {
  state.view.modal = null;
  render();
}

function find(items, id) {
  return items.find((item) => String(item.id) === String(id));
}

function ok(title, message, tone) {
  return { title, message, tone };
}
