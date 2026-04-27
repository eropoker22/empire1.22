import { ADMIN_SECTIONS, ADMIN_API_ENDPOINTS, RESOURCE_KEYS, ZONE_META } from "./admin-data.js";
import { renderBarChart, renderDonut, renderSparkline } from "./admin-charts.js";
import { getPermissionHint } from "./admin-security.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderDashboard(state) {
  const section = ADMIN_SECTIONS.find((item) => item.id === state.view.section) || ADMIN_SECTIONS[0];
  return `
    <aside class="admin-sidebar">
      ${renderBrand(state)}
      ${renderNavigation(state)}
      ${renderBackendSeam()}
    </aside>
    <section class="admin-main">
      ${renderTopbar(state, section)}
      <div class="admin-content" data-admin-content>
        ${renderSection(state)}
      </div>
    </section>
    ${renderModal(state)}
    ${renderToasts(state)}
  `;
}

function renderBrand(state) {
  return `
    <div class="admin-brand">
      <span class="admin-brand__mark">ES</span>
      <div>
        <p>Empire Streets</p>
        <strong>Admin Center</strong>
      </div>
      <span class="admin-status admin-status--${token(state.data.admin.status)}">${escapeHtml(state.data.admin.status)}</span>
    </div>
  `;
}

function renderNavigation(state) {
  return `
    <nav class="admin-nav" aria-label="Admin navigation">
      ${ADMIN_SECTIONS.map((item) => `
        <button type="button" class="admin-nav__item ${state.view.section === item.id ? "is-active" : ""}" data-section="${escapeHtml(item.id)}">
          <span class="admin-nav__dot"></span>
          <span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.hint)}</small></span>
        </button>
      `).join("")}
    </nav>
  `;
}

function renderBackendSeam() {
  return `
    <section class="admin-sidebar-card">
      <span>Backend seam</span>
      <strong>Mock provider active</strong>
      <p>Snapshot: ${escapeHtml(ADMIN_API_ENDPOINTS.snapshot)}<br>Commands: ${escapeHtml(ADMIN_API_ENDPOINTS.command)}<br>Stream: ${escapeHtml(ADMIN_API_ENDPOINTS.stream)}</p>
    </section>
  `;
}

function renderTopbar(state, section) {
  const mode = state.view.mode;
  const servers = state.data.servers.filter((server) => mode === "all" || server.mode === mode);
  return `
    <header class="admin-topbar">
      <div class="admin-topbar__title">
        <p>${escapeHtml(section.hint)}</p>
        <h1>Empire Streets Admin</h1>
      </div>
      <div class="admin-topbar__controls">
        <label class="admin-field admin-field--select">
          <span>Mode</span>
          <select data-admin-mode>
            ${["all", "free", "war"].map((item) => `<option value="${item}" ${mode === item ? "selected" : ""}>${item === "all" ? "Free / War" : item.toUpperCase()}</option>`).join("")}
          </select>
        </label>
        <label class="admin-field admin-field--select">
          <span>Server</span>
          <select data-admin-server>
            <option value="all" ${state.view.server === "all" ? "selected" : ""}>All servers</option>
            ${servers.map((server) => `<option value="${escapeHtml(server.id)}" ${state.view.server === server.id ? "selected" : ""}>${escapeHtml(server.name)} / ${escapeHtml(server.mode.toUpperCase())}</option>`).join("")}
          </select>
        </label>
        <label class="admin-search">
          <span>Search</span>
          <input type="search" value="${escapeHtml(state.view.search)}" placeholder="hráč, server, district, log..." data-admin-search>
        </label>
        <label class="admin-field admin-field--select">
          <span>Sort</span>
          <select data-admin-sort>
            ${[
              ["none", "Default"],
              ["name", "Name"],
              ["heat", "Heat"],
              ["influence", "Influence"],
              ["cash", "Cash"],
              ["status", "Status"],
              ["time", "Time"]
            ].map(([value, label]) => `<option value="${value}" ${state.view.sortBy === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <button type="button" class="admin-profile" data-action="open-security">
          <span>${escapeHtml(state.data.admin.role)}</span>
          <strong>${escapeHtml(state.data.admin.name)}</strong>
        </button>
      </div>
    </header>
  `;
}

function renderSection(state) {
  switch (state.view.section) {
    case "servers": return renderServers(state);
    case "players": return renderPlayers(state);
    case "districts": return renderDistricts(state);
    case "alliances": return renderAlliances(state);
    case "economy": return renderEconomy(state);
    case "police": return renderPolice(state);
    case "events": return renderEvents(state);
    case "buildings": return renderBuildings(state);
    case "combat": return renderCombat(state);
    case "logs": return renderLogs(state);
    case "monetization": return renderMonetization(state);
    case "settings": return renderSettings(state);
    case "security": return renderSecurity(state);
    default: return renderOverview(state);
  }
}

function renderOverview(state) {
  const data = state.data;
  const players = scopePlayers(state);
  const districts = scopeDistricts(state);
  const metricItems = [
    ["Active Players", data.players.length, "all registered mock players"],
    ["Online Players", players.filter((player) => player.online).length, "current scoped online"],
    ["Total Districts", data.districts.length, "map districts"],
    ["Controlled Districts", districts.filter((district) => district.owner !== "Neutral").length, "owned in scope"],
    ["Active Alliances", data.alliances.length, "diplomacy entities"],
    ["Average Heat", average(players.map((player) => player.heat)), "player heat"],
    ["Police Raids Today", data.police.activeRaids.length + data.police.scheduledRaids.length, "active + planned"],
    ["Economy Volume", money(data.economy.cleanCash + data.economy.dirtyCash), "clean + dirty"],
    ["Dirty Cash Volume", money(data.economy.dirtyCash), "server shadow economy"],
    ["Clean Cash Volume", money(data.economy.cleanCash), "legal cash pool"],
    ["Active Events", data.events.filter((event) => event.active).length, "global and scoped"],
    ["Revenue / Premium", `${money(data.monetization.revenueEstimate)} / ${data.monetization.premiumUsers}`, "mock monetization"]
  ];
  return `
    <section class="admin-section">
      <div class="admin-section__head">
        <div><p>Command overview</p><h2>Live operating picture</h2></div>
        <button type="button" class="admin-button admin-button--primary" data-action="simulate-ai-tick">Simulate police AI tick</button>
      </div>
      <div class="admin-metrics">${metricItems.map(([label, value, note]) => renderMetric(label, value, note)).join("")}</div>
      <div class="admin-grid admin-grid--overview">
        <article class="admin-panel admin-panel--wide">
          <div class="admin-panel__head"><h3>Server economy balance</h3><span>${data.economy.balanceScore}/100</span></div>
          ${renderSparkline(data.economy.cashOverTime, { label: "cash over time", color: "#36f4ff" })}
        </article>
        <article class="admin-panel">
          <div class="admin-panel__head"><h3>Dirty vs clean cash</h3><span>volume</span></div>
          ${renderDonut(data.economy.dirtyVsClean, { label: "dirty vs clean cash" })}
        </article>
        <article class="admin-panel">
          <div class="admin-panel__head"><h3>Server health</h3><span>${escapeHtml(data.admin.status)}</span></div>
          ${renderServerHealth(data)}
        </article>
      </div>
      <section class="admin-panel admin-panel--critical">
        <div class="admin-panel__head"><h3>Critical Alerts</h3><span>${criticalAlerts(data).length} alerts</span></div>
        <div class="admin-alert-list">${criticalAlerts(data).map(renderAlert).join("")}</div>
      </section>
    </section>
  `;
}

function renderServers(state) {
  const servers = state.data.servers.filter((server) => state.view.mode === "all" || server.mode === state.view.mode);
  return `
    <section class="admin-section">
      ${sectionHeader("Server control", "Free / War instances", "Reset Demo", "reset-demo")}
      <div class="admin-card-grid">${servers.map((server) => `
        <article class="admin-server-card">
          <div class="admin-server-card__top">
            <div><p>${escapeHtml(server.mode.toUpperCase())}</p><h3>${escapeHtml(server.name)}</h3></div>
            ${statusBadge(server.status)}
          </div>
          <div class="admin-server-card__meter"><i style="width:${Math.min(100, Math.round((server.playerCount / server.capacity) * 100))}%"></i></div>
          <div class="admin-kv-grid">
            ${kv("Players", `${server.playerCount}/${server.capacity}`)}
            ${kv("Start", server.startLabel)}
            ${kv("Progress", `${server.progress}%`)}
            ${kv("End condition", server.endCondition)}
            ${kv("Winner", server.winningEntity)}
            ${kv("Region", server.region)}
          </div>
          <div class="admin-actions">
            ${serverAction("Start", "start-server", server.id)}
            ${serverAction("Pause", "pause-server", server.id)}
            ${serverAction("Maintenance", "maintenance-server", server.id)}
            ${serverAction("End", "end-server", server.id, true)}
          </div>
        </article>
      `).join("")}</div>
    </section>
  `;
}

function renderPlayers(state) {
  const players = sortItems(searchItems(scopePlayers(state), state.view.search, ["id", "nickname", "faction", "alliance", "server"]), state.view.sortBy);
  return `
    <section class="admin-section">
      ${sectionHeader("Player operations", "Accounts, heat, resources and moderation", "Send broadcast", "send-admin-message")}
      <div class="admin-split">
        <article class="admin-panel admin-panel--wide">
          ${renderTable({
            headers: ["ID", "Nickname", "Faction", "Alliance", "Server", "Online", "Districts", "Gang", "Clean", "Dirty", "Heat", "Influence", "Premium", "Last activity", "Actions"],
            rows: players.map((player) => [
              player.id,
              player.nickname,
              player.faction,
              player.alliance || "-",
              player.server,
              player.online ? "online" : "offline",
              player.districtCount,
              player.gangMembers,
              money(player.cleanCash),
              money(player.dirtyCash),
              heatBadge(player.heat),
              player.influence,
              player.premium ? "premium" : "free",
              timeAgo(player.lastActivity),
              rowActions([
                ["View", "view-player", player.id],
                ["+ Resources", "add-resources", player.id],
                ["Reduce heat", "reduce-player-heat", player.id],
                [player.banned ? "Unban" : "Ban", player.banned ? "unban-player" : "ban-player", player.id, true],
                ["Reset", "reset-player", player.id, true],
                ["Move", "move-player", player.id],
                ["Message", "message-player", player.id]
              ])
            ])
          })}
        </article>
        <aside class="admin-panel">
          <div class="admin-panel__head"><h3>Selected profile</h3><span>right panel</span></div>
          ${renderSelectedPlayerPanel(state)}
        </aside>
      </div>
    </section>
  `;
}

function renderDistricts(state) {
  const districts = sortItems(searchItems(scopeDistricts(state), state.view.search, ["id", "name", "owner", "alliance", "zone", "policeStatus"]), state.view.sortBy);
  return `
    <section class="admin-section">
      ${sectionHeader("District map admin", "Zones, owners, traps and police status", "Trigger raid", "trigger-raid")}
      <div class="admin-grid admin-grid--map">
        <article class="admin-panel admin-panel--map">
          <div class="admin-panel__head"><h3>Visual city grid</h3><span>toxic trap embedded in district</span></div>
          <div class="admin-map-grid">
            ${districts.map((district) => `<button type="button" class="admin-map-cell ${district.locked ? "is-locked" : ""}" style="--zone:${ZONE_META[district.zone]?.color || "#36f4ff"}" data-action="inspect-district" data-entity-id="${escapeHtml(district.id)}"><span>${escapeHtml(district.id.replace("D-", ""))}</span><strong>${escapeHtml(district.name)}</strong>${district.toxicTrap ? "<i>Toxic</i>" : ""}</button>`).join("")}
          </div>
        </article>
        <article class="admin-panel admin-panel--wide">
          ${renderTable({
            headers: ["District", "Zone", "Owner", "Alliance", "Buildings", "Heat", "Influence", "Trap", "Police", "Conflict", "Actions"],
            rows: districts.map((district) => [
              `${district.id} ${district.name}`,
              zonePill(district.zone),
              district.owner,
              district.alliance || "-",
              district.buildings.join(", "),
              district.heat,
              district.influence,
              district.activeTrap || "-",
              district.policeStatus,
              district.conflictStatus,
              rowActions([
                ["Owner", "change-owner", district.id],
                ["Clear trap", "clear-trap", district.id],
                ["Add trap", "add-trap", district.id],
                ["+Heat", "add-district-heat", district.id],
                ["-Heat", "reduce-district-heat", district.id],
                ["Raid", "trigger-raid", district.id, true],
                [district.locked ? "Unlock" : "Lock", district.locked ? "unlock-district" : "lock-district", district.id, true],
                ["Buildings", "inspect-buildings", district.id]
              ])
            ])
          })}
        </article>
      </div>
    </section>
  `;
}

function renderAlliances(state) {
  const alliances = sortItems(searchItems(state.data.alliances, state.view.search, ["name", "factionType"]), state.view.sortBy);
  return `
    <section class="admin-section">
      ${sectionHeader("Alliance control", "Snowball, war progress and diplomacy", "Apply penalty", "apply-alliance-penalty")}
      <div class="admin-card-grid">
        ${alliances.map((alliance) => `
          <article class="admin-panel">
            <div class="admin-panel__head"><h3>${escapeHtml(alliance.name)}</h3>${alliance.snowballWarning ? statusBadge("snowball") : statusBadge("stable")}</div>
            <div class="admin-kv-grid">
              ${kv("Faction", alliance.factionType)}
              ${kv("Members", alliance.members)}
              ${kv("Districts", alliance.controlledDistricts)}
              ${kv("Influence", alliance.influence)}
              ${kv("Heat", alliance.heat)}
              ${kv("Economy", money(alliance.economyPower))}
              ${kv("Last attacks", alliance.lastAttacks)}
              ${kv("85% progress", `${alliance.mapProgress}%`)}
            </div>
            <div class="admin-progress"><i style="width:${alliance.mapProgress}%"></i></div>
            <div class="admin-actions">${rowActions([["Rename", "rename-alliance", alliance.id], ["Message", "message-alliance", alliance.id], ["Penalty", "apply-alliance-penalty", alliance.id, true], ["War activity", "inspect-war-activity", alliance.id], ["Dissolve", "dissolve-alliance", alliance.id, true]])}</div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderEconomy(state) {
  const economy = state.data.economy;
  return `
    <section class="admin-section">
      ${sectionHeader("Economy telemetry", "Cash flow, inflation and production", "Simulate balance tick", "simulate-economy-tick")}
      <div class="admin-metrics">
        ${renderMetric("Clean cash", money(economy.cleanCash), "legal pool")}
        ${renderMetric("Dirty cash", money(economy.dirtyCash), "shadow pool")}
        ${renderMetric("Income / hour", money(economy.incomePerHour), "server aggregate")}
        ${renderMetric("Production / min", economy.productionPerMinute, "all resources")}
        ${renderMetric("Laundering", money(economy.launderingVolume), "last hour")}
        ${renderMetric("Inflation", `${economy.inflation}%`, "economy pressure")}
      </div>
      <div class="admin-grid">
        <article class="admin-panel admin-panel--wide"><div class="admin-panel__head"><h3>Cash over time</h3><span>12 ticks</span></div>${renderSparkline(economy.cashOverTime, { label: "cash over time", color: "#36f4ff" })}</article>
        <article class="admin-panel"><div class="admin-panel__head"><h3>Laundering activity</h3><span>risk</span></div>${renderSparkline(economy.launderingActivity, { label: "laundering activity", color: "#ff4fd8" })}</article>
        <article class="admin-panel"><div class="admin-panel__head"><h3>Dirty vs clean</h3><span>cash split</span></div>${renderDonut(economy.dirtyVsClean, { label: "dirty vs clean" })}</article>
      </div>
      <div class="admin-split">
        <article class="admin-panel admin-panel--wide">
          <div class="admin-panel__head"><h3>Resource generation</h3><span>${RESOURCE_KEYS.length} resources</span></div>
          ${renderBarChart(economy.resources.map((resource) => ({ label: resource.name, value: resource.pressure, color: resource.pressure > 70 ? "#ff9b42" : "#46e88f" })), { label: "resource production" })}
        </article>
        <article class="admin-panel">
          <div class="admin-panel__head"><h3>Suspicious income spikes</h3><span>${economy.suspiciousSpikes.length}</span></div>
          ${economy.suspiciousSpikes.map((player) => renderCompactEntity(player.nickname, `score ${player.suspiciousScore}`, money(player.economyDelta))).join("")}
        </article>
      </div>
    </section>
  `;
}

function renderPolice(state) {
  const police = state.data.police;
  return `
    <section class="admin-section">
      ${sectionHeader("Police / Heat", "AI target list, raids and lockdown pressure", "Simulate police AI tick", "simulate-ai-tick")}
      <div class="admin-grid">
        <article class="admin-panel admin-panel--wide"><div class="admin-panel__head"><h3>Heat levels 1-7</h3><span>player distribution</span></div>${renderBarChart(police.heatBuckets.map((bucket) => ({ label: `${bucket.level} ${bucket.label}`, value: bucket.players, color: bucket.level >= 5 ? "#ff4f6d" : "#36f4ff" })), { label: "heat levels" })}</article>
        <article class="admin-panel"><div class="admin-panel__head"><h3>Police pressure by server</h3><span>AI score</span></div>${renderBarChart(police.pressureByServer, { label: "police pressure" })}</article>
      </div>
      <div class="admin-actions admin-actions--top">
        ${["trigger-raid", "trigger-financial-raid", "trigger-drug-raid", "trigger-arms-raid", "trigger-lockdown", "clear-wanted"].map((action) => `<button type="button" class="admin-button ${action === "clear-wanted" ? "admin-button--ghost" : ""}" data-action="${action}">${labelAction(action)}</button>`).join("")}
      </div>
      <div class="admin-split">
        <article class="admin-panel admin-panel--wide">
          ${renderTable({
            headers: ["Raid", "Type", "District", "Owner", "Tier", "Remaining", "Seized"],
            rows: police.activeRaids.map((raid) => [raid.id, raid.type, raid.district, raid.owner, raid.tier, raid.remaining, money(raid.seized)])
          })}
        </article>
        <article class="admin-panel">
          <div class="admin-panel__head"><h3>AI police target list</h3><span>${police.targetList.length}</span></div>
          ${police.targetList.map((player) => renderCompactEntity(player.nickname, `Heat ${player.heat}`, player.server)).join("")}
        </article>
      </div>
    </section>
  `;
}

function renderEvents(state) {
  const events = sortItems(searchItems(state.data.events, state.view.search, ["name", "category", "scope"]), state.view.sortBy);
  return `
    <section class="admin-section">
      ${sectionHeader("Event management", "System, city, police, crisis and admin events", "Create event", "create-event")}
      <div class="admin-quick-grid">
        ${state.data.events.map((event) => `<button type="button" class="admin-quick-event ${event.active ? "is-active" : ""}" data-action="activate-event" data-entity-id="${escapeHtml(event.id)}"><strong>${escapeHtml(event.name)}</strong><span>${escapeHtml(event.category)} / ${escapeHtml(event.scope)}</span></button>`).join("")}
      </div>
      <article class="admin-panel admin-panel--wide">
        ${renderTable({
          headers: ["Name", "Category", "Description", "Duration", "Effects", "Scope", "Stacking", "Priority", "Visible to", "State", "Actions"],
          rows: events.map((event) => [
            event.name,
            event.category,
            event.description,
            event.duration,
            event.effects.join(", "),
            event.scope,
            event.stacking,
            event.priority,
            event.visibleTo,
            event.active ? "active" : "inactive",
            rowActions([["Activate", "activate-event", event.id], ["Pause", "pause-event", event.id], ["End", "end-event", event.id, true], ["Duplicate", "duplicate-event", event.id]])
          ])
        })}
      </article>
    </section>
  `;
}

function renderBuildings(state) {
  const buildings = sortItems(searchItems(state.data.buildings, state.view.search, ["name", "type", "zone", "production"]), state.view.sortBy);
  return `
    <section class="admin-section">
      ${sectionHeader("Building balance", "Income, heat, production and cooldowns", "Reset cooldowns", "reset-building-cooldowns")}
      <article class="admin-panel admin-panel--wide">
        ${renderTable({
          headers: ["Building", "Type", "Zone", "Income", "Heat", "Influence", "Production", "Cooldown", "Level", "Map count", "Actions"],
          rows: buildings.map((building) => [
            building.name,
            building.type,
            zonePill(building.zone),
            money(building.income),
            building.heat,
            building.influence,
            building.production,
            building.cooldown,
            building.upgradeLevel,
            building.occurrences,
            rowActions([["Balance", "edit-building-balance", building.id], ["Production", "inspect-production", building.id], [building.disabled ? "Enable" : "Disable", "disable-building", building.id, true], ["Boost", "boost-building", building.id], ["Cooldowns", "reset-building-cooldowns", building.id]])
          ])
        })}
      </article>
    </section>
  `;
}

function renderCombat(state) {
  const combat = state.data.combat;
  return `
    <section class="admin-section">
      ${sectionHeader("Combat operations", "Attacks, spy actions, traps and cooldown abuse", "Inspect repeated attacks", "inspect-repeat-attacks")}
      <div class="admin-grid">
        <article class="admin-panel"><div class="admin-panel__head"><h3>Attack weapons</h3><span>${combat.weapons.length}</span></div>${combat.weapons.map((item) => `<span class="admin-chip">${escapeHtml(item)}</span>`).join("")}</article>
        <article class="admin-panel"><div class="admin-panel__head"><h3>Defense loadouts</h3><span>${combat.defense.length}</span></div>${combat.defense.map((item) => `<span class="admin-chip admin-chip--green">${escapeHtml(item)}</span>`).join("")}</article>
      </div>
      <div class="admin-split">
        <article class="admin-panel admin-panel--wide">${renderTable({ headers: ["ID", "Attacker", "Defender", "District", "Type", "Remaining", "Risk"], rows: combat.activeAttacks.map((attack) => [attack.id, attack.attacker, attack.defender, attack.district, attack.type, attack.remaining, `${attack.risk}%`]) })}</article>
        <article class="admin-panel"><div class="admin-panel__head"><h3>Suspicious repeated attacks</h3><span>${combat.suspiciousRepeats.length}</span></div>${combat.suspiciousRepeats.map((player) => renderCompactEntity(player.nickname, `${player.attacks} attacks`, `Heat ${player.heat}`)).join("")}</article>
      </div>
    </section>
  `;
}

function renderLogs(state) {
  const logs = sortItems(searchItems(state.data.logs, state.view.search, ["server", "mode", "severity", "category", "actor", "message"]), state.view.sortBy);
  return `
    <section class="admin-section">
      ${sectionHeader("Log center", "Admin, player, economy, combat, police, event, security and error logs", "Clear local filters", "clear-filters")}
      <article class="admin-panel admin-panel--wide">
        ${renderTable({
          headers: ["Timestamp", "Server", "Mode", "Severity", "Category", "Actor", "Message", "Metadata"],
          rows: logs.map((log) => [timeAgo(log.timestamp), log.server, log.mode, severityBadge(log.severity), log.category, log.actor, log.message, log.metadata])
        })}
      </article>
    </section>
  `;
}

function renderMonetization(state) {
  const monetization = state.data.monetization;
  return `
    <section class="admin-section">
      ${sectionHeader("Monetization", "Free session end, War CTA and premium conversion", "Export revenue mock", "export-monetization")}
      <div class="admin-metrics">
        ${renderMetric("Free players", monetization.freePlayers, "currently tracked")}
        ${renderMetric("War players", monetization.warPlayers, "paid mode activity")}
        ${renderMetric("Premium users", monetization.premiumUsers, "mock flag")}
        ${renderMetric("Conversion rate", `${monetization.conversionRate}%`, "session to paid")}
        ${renderMetric("CTA clicks", monetization.ctaClicks, "war mode interest")}
        ${renderMetric("Revenue estimate", money(monetization.revenueEstimate), "mock admin data")}
      </div>
      <div class="admin-grid">
        <article class="admin-panel admin-panel--wide"><div class="admin-panel__head"><h3>Conversion funnel</h3><span>${escapeHtml(monetization.bestServer)} best</span></div>${renderBarChart([{ label: "Ended free", value: monetization.endedFreeSessions }, { label: "Clicked War", value: monetization.clickedWarMode }, { label: "Registered", value: monetization.registrations }, { label: "Paid", value: monetization.paid }], { label: "conversion funnel" })}</article>
        <article class="admin-panel"><div class="admin-panel__head"><h3>Top paying users</h3><span>mock only</span></div>${monetization.topPayingUsers.map((player) => renderCompactEntity(player.nickname, player.server, money(player.spend))).join("")}</article>
      </div>
    </section>
  `;
}

function renderSettings(state) {
  const settings = state.data.settings;
  const settingRows = [
    ["Free max players", settings.freeMode.maxPlayers],
    ["Free session length", `${settings.freeMode.sessionLengthHours}h`],
    ["Free win condition", settings.freeMode.winCondition],
    ["War max players", settings.warMode.maxPlayers],
    ["War session length", `${settings.warMode.sessionLengthHours}h`],
    ["War win condition", settings.warMode.winCondition],
    ["Alliance size", settings.warMode.allianceSize],
    ["Heat multiplier", settings.balance.heatMultiplier],
    ["Income multiplier", settings.balance.incomeMultiplier],
    ["Production multiplier", settings.balance.productionMultiplier],
    ["Attack duration", `${settings.balance.attackDurationMin}m`],
    ["Spy duration", `${settings.balance.spyDurationMin}m`],
    ["Trap rules", settings.balance.trapRules],
    ["Police aggressiveness", `${settings.balance.policeAggressiveness}%`],
    ["Event frequency", `${settings.balance.eventFrequencyMin}m`]
  ];
  return `
    <section class="admin-section">
      ${sectionHeader("Settings", "Editable mock config prepared for API persistence", "Save mock config", "save-settings")}
      <article class="admin-panel admin-panel--wide">
        <div class="admin-settings-grid">
          ${settingRows.map(([label, value], index) => `<label class="admin-setting"><span>${escapeHtml(label)}</span><input type="text" value="${escapeHtml(value)}" data-setting-index="${index}"></label>`).join("")}
        </div>
      </article>
    </section>
  `;
}

function renderSecurity(state) {
  const access = state.access;
  return `
    <section class="admin-section">
      ${sectionHeader("Security", "Access guard, roles, confirmations and audit", "Run permission check", "run-permission-check")}
      <div class="admin-grid">
        <article class="admin-panel admin-panel--wide">
          <div class="admin-panel__head"><h3>Admin access guard placeholder</h3>${statusBadge(access.allowed ? "allowed" : "blocked")}</div>
          <p class="admin-copy">${escapeHtml(access.reason)} No tokeny/API keys se v UI nevykreslují. Dangerous commands používají confirmation modal a backend permission seam.</p>
          <div class="admin-code">${escapeHtml(JSON.stringify(ADMIN_API_ENDPOINTS, null, 2))}</div>
        </article>
        <article class="admin-panel">
          <div class="admin-panel__head"><h3>Current admin</h3><span>${escapeHtml(state.data.admin.role)}</span></div>
          ${kvBlock([["ID", state.data.admin.id], ["Name", state.data.admin.name], ["Role", state.data.admin.role], ["Status", state.data.admin.status]])}
        </article>
      </div>
      <div class="admin-card-grid">
        ${state.data.security.roles.map((role) => `<article class="admin-panel"><div class="admin-panel__head"><h3>${escapeHtml(role.role)}</h3>${statusBadge(role.dangerous ? "dangerous" : "read")}</div><p class="admin-copy">${escapeHtml(role.scope)}</p></article>`).join("")}
      </div>
      <article class="admin-panel admin-panel--wide">
        <div class="admin-panel__head"><h3>Security / admin audit</h3><span>${state.data.security.auditTrail.length}</span></div>
        ${renderTable({ headers: ["Time", "Severity", "Actor", "Message", "Metadata"], rows: state.data.security.auditTrail.map((log) => [timeAgo(log.timestamp), severityBadge(log.severity), log.actor, log.message, log.metadata]) })}
      </article>
    </section>
  `;
}

function renderModal(state) {
  const modal = state.view.modal;
  if (!modal) return "";
  if (modal.type === "player") {
    const player = state.data.players.find((entry) => entry.id === modal.id);
    if (!player) return "";
    const districts = state.data.districts.filter((district) => district.ownerId === player.id);
    return modalShell("Player profile", `
      <div class="admin-profile-grid">
        ${renderMetric(player.nickname, player.id, player.faction)}
        ${renderMetric("Heat", heatBadge(player.heat), `level ${player.heatLevel}`)}
        ${renderMetric("Cash", `${money(player.cleanCash)} / ${money(player.dirtyCash)}`, "clean / dirty")}
        ${renderMetric("Influence", player.influence, player.alliance || "no alliance")}
      </div>
      <div class="admin-grid">
        <article class="admin-panel"><div class="admin-panel__head"><h3>Heat timeline</h3><span>latest</span></div>${renderSparkline(player.heatTimeline, { label: "heat timeline", color: "#ff4f6d" })}</article>
        <article class="admin-panel"><div class="admin-panel__head"><h3>Owned districts</h3><span>${districts.length}</span></div>${districts.slice(0, 8).map((district) => renderCompactEntity(district.name, district.zone, `Heat ${district.heat}`)).join("") || "<p class=\"admin-copy\">No scoped districts.</p>"}</article>
      </div>
      <p class="admin-copy">Poslední akce, útoky, podezřelé chování, ekonomika a heat timeline jsou mock projection. Backend detail endpoint se napojí přes admin data provider.</p>
    `);
  }
  if (modal.type === "confirm") {
    return modalShell("Confirm admin action", `
      <p class="admin-copy">${escapeHtml(modal.message)}</p>
      <p class="admin-copy admin-copy--hint">${escapeHtml(getPermissionHint(modal.action))}</p>
      ${modal.doubleConfirm ? `<label class="admin-confirm-line"><input type="checkbox" data-double-confirm> Confirm irreversible admin operation</label>` : ""}
      <div class="admin-actions admin-actions--modal">
        <button type="button" class="admin-button admin-button--danger" data-confirm-action="${escapeHtml(modal.action)}" data-entity-id="${escapeHtml(modal.id || "")}">Confirm</button>
        <button type="button" class="admin-button admin-button--ghost" data-close-modal>Cancel</button>
      </div>
    `);
  }
  return modalShell(modal.title || "Admin action", `
    <p class="admin-copy">${escapeHtml(modal.message || "Mock admin action ready.")}</p>
    <div class="admin-actions admin-actions--modal"><button type="button" class="admin-button admin-button--primary" data-close-modal>OK</button></div>
  `);
}

function modalShell(title, body) {
  return `
    <div class="admin-modal-backdrop" role="presentation" data-close-modal>
      <section class="admin-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}" data-modal-card>
        <button type="button" class="admin-modal__close" data-close-modal aria-label="Close">×</button>
        <header><p>Empire Streets Admin</p><h2>${escapeHtml(title)}</h2></header>
        ${body}
      </section>
    </div>
  `;
}

function renderToasts(state) {
  if (!state.view.toasts.length) return "";
  return `<div class="admin-toasts" aria-live="polite">${state.view.toasts.map((toast) => `<div class="admin-toast admin-toast--${token(toast.tone || "info")}"><strong>${escapeHtml(toast.title)}</strong><span>${escapeHtml(toast.message)}</span></div>`).join("")}</div>`;
}

function renderTable({ headers, rows }) {
  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">No data in current filter.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function renderSelectedPlayerPanel(state) {
  const player = state.data.players.find((entry) => entry.id === state.view.selectedPlayerId) || scopePlayers(state)[0];
  if (!player) return `<p class="admin-copy">No player selected.</p>`;
  return `
    <div class="admin-selected-player">
      <h4>${escapeHtml(player.nickname)}</h4>
      <p>${escapeHtml(player.faction)} / ${escapeHtml(player.server)} / ${escapeHtml(player.alliance || "solo")}</p>
      ${renderSparkline(player.heatTimeline, { label: "selected player heat", color: "#ff4f6d" })}
      ${kvBlock([["Heat", player.heat], ["Influence", player.influence], ["Districts", player.districtCount], ["Suspicion", `${player.suspiciousScore}%`]])}
      <button type="button" class="admin-button admin-button--primary" data-action="view-player" data-entity-id="${escapeHtml(player.id)}">Open profile</button>
    </div>
  `;
}

function renderMetric(label, value, note) {
  return `<article class="admin-metric"><span>${escapeHtml(label)}</span><strong>${value}</strong><small>${escapeHtml(note)}</small></article>`;
}

function renderServerHealth(data) {
  return data.servers.map((server) => `<div class="admin-health-row"><span>${escapeHtml(server.name)}</span>${statusBadge(server.health)}<strong>${server.progress}%</strong></div>`).join("");
}

function renderAlert(alert) {
  return `<article class="admin-alert admin-alert--${token(alert.tone)}"><strong>${escapeHtml(alert.title)}</strong><span>${escapeHtml(alert.message)}</span><button type="button" data-action="${escapeHtml(alert.action)}">Inspect</button></article>`;
}

function criticalAlerts(data) {
  const highestHeat = data.players.slice().sort((a, b) => b.heat - a.heat)[0];
  const snowball = data.alliances.find((alliance) => alliance.snowballWarning);
  return [
    { tone: "danger", title: "Extreme heat player", message: `${highestHeat.nickname} má heat ${highestHeat.heat}.`, action: "inspect-heat-alert" },
    { tone: "warning", title: "Snowball risk", message: `${snowball.name} drží ${snowball.mapProgress}% progress k 85 % mapy.`, action: "inspect-war-activity" },
    { tone: "warning", title: "Raid frequency", message: `${data.police.activeRaids.length} aktivních razií a ${data.police.scheduledRaids.length} plánovaných.`, action: "simulate-ai-tick" },
    { tone: "danger", title: "Economy inflation", message: `Inflation score je ${data.economy.inflation} %.`, action: "simulate-economy-tick" },
    { tone: "info", title: "Suspicious activity", message: `${data.economy.suspiciousSpikes.length} hráčů má income spike nad normálem.`, action: "open-logs" }
  ];
}

function sectionHeader(kicker, title, actionLabel, action) {
  return `<div class="admin-section__head"><div><p>${escapeHtml(kicker)}</p><h2>${escapeHtml(title)}</h2></div><button type="button" class="admin-button admin-button--primary" data-action="${escapeHtml(action)}">${escapeHtml(actionLabel)}</button></div>`;
}

function serverAction(label, action, id, danger = false) {
  return `<button type="button" class="admin-button ${danger ? "admin-button--danger" : ""}" data-action="${escapeHtml(action)}" data-entity-id="${escapeHtml(id)}">${escapeHtml(label)}</button>`;
}

function rowActions(actions) {
  return `<div class="admin-row-actions">${actions.map(([label, action, id, danger]) => `<button type="button" class="${danger ? "is-danger" : ""}" data-action="${escapeHtml(action)}" data-entity-id="${escapeHtml(id || "")}">${escapeHtml(label)}</button>`).join("")}</div>`;
}

function labelAction(action) {
  return String(action).replace(/^trigger-/, "").replace(/-/g, " ");
}

function statusBadge(status) {
  return `<span class="admin-badge admin-badge--${token(status)}">${escapeHtml(status)}</span>`;
}

function severityBadge(severity) {
  return `<span class="admin-severity admin-severity--${token(severity)}">${escapeHtml(severity)}</span>`;
}

function heatBadge(value) {
  const tone = Number(value) >= 75 ? "danger" : Number(value) >= 50 ? "warning" : "success";
  return `<span class="admin-heat admin-heat--${tone}">${escapeHtml(value)}</span>`;
}

function zonePill(zone) {
  const meta = ZONE_META[zone] || { label: zone, color: "#36f4ff" };
  return `<span class="admin-zone" style="--zone:${escapeHtml(meta.color)}">${escapeHtml(meta.label)}</span>`;
}

function renderCompactEntity(title, meta, value) {
  return `<div class="admin-compact"><span>${escapeHtml(title)}</span><small>${escapeHtml(meta)}</small><strong>${escapeHtml(value)}</strong></div>`;
}

function kv(label, value) {
  return `<span><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></span>`;
}

function kvBlock(rows) {
  return `<div class="admin-kv-grid">${rows.map(([label, value]) => kv(label, value)).join("")}</div>`;
}

function scopePlayers(state) {
  return state.data.players.filter((player) => {
    const modeOk = state.view.mode === "all" || player.mode === state.view.mode;
    const serverOk = state.view.server === "all" || player.server === state.view.server;
    return modeOk && serverOk;
  });
}

function scopeDistricts(state) {
  const scopedPlayerIds = new Set(scopePlayers(state).map((player) => player.id));
  return state.data.districts.filter((district) => district.owner === "Neutral" || scopedPlayerIds.has(district.ownerId));
}

function searchItems(items, query, keys) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) => keys.some((key) => String(item[key] || "").toLowerCase().includes(normalized)));
}

function sortItems(items, sortBy) {
  const key = String(sortBy || "none");
  if (key === "none") return items;
  const resolvers = {
    name: (item) => item.name || item.nickname || item.id || "",
    heat: (item) => Number(item.heat || 0),
    influence: (item) => Number(item.influence || 0),
    cash: (item) => Number(item.cleanCash || item.dirtyCash || item.economyPower || item.income || 0),
    status: (item) => item.status || item.policeStatus || item.conflictStatus || item.severity || "",
    time: (item) => new Date(item.timestamp || item.lastActivity || item.startTime || 0).getTime()
  };
  const resolve = resolvers[key];
  if (!resolve) return items;
  return [...items].sort((left, right) => {
    const leftValue = resolve(left);
    const rightValue = resolve(right);
    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return rightValue - leftValue;
    }
    return String(leftValue).localeCompare(String(rightValue));
  });
}

function money(value) {
  return `$${Math.round(Number(value) || 0).toLocaleString("en-US")}`;
}

function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + (Number(value) || 0), 0) / values.length);
}

function timeAgo(iso) {
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.round(diffMin / 60)}h ago`;
}

function token(value) {
  return String(value || "default").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "default";
}
