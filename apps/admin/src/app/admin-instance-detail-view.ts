import type { AdminInstanceDetailView } from "@empire/shared-types";
import {
  badge,
  escapeHtml,
  formatNumber,
  formatTime,
  keyValue,
  pill,
  disclosureSection,
  table
} from "./admin-view-helpers";

export const renderAdminInstanceDetail = (detail: AdminInstanceDetailView | null): string => detail ? `
  <section id="admin-instance-detail" class="admin-section-anchor admin-instance-hero">
    <div class="admin-section__head">
      <div><p>Vybraná instance</p><h2>${escapeHtml(detail.summary.displayName)}</h2>
        <small>${escapeHtml(detail.serverInstanceId)} · ${escapeHtml(detail.summary.mode)} · ${escapeHtml(detail.summary.region)}</small></div>
      ${badge(detail.summary.workerStatus.toUpperCase(), detail.summary.workerStatus === "live" ? "success" : "warning")}
    </div>
    <div class="admin-instance-hero__metrics">
      ${keyValue("Lifecycle", detail.summary.status)}
      ${keyValue("Worker", detail.summary.workerStatus)}
      ${keyValue("Hráči", `${detail.players.length} / ${detail.summary.capacity}`)}
      ${keyValue("Tick", detail.summary.currentTick)}
      ${keyValue("State version", detail.summary.stateVersion)}
      ${keyValue("Data k", formatTime(detail.freshness.dataAsOf))}
    </div>
    ${detail.runtimeAvailable ? "" : `<p class="admin-notice">Live runtime není dostupný. Zobrazená data pocházejí z durable snapshotu a mohou být zastaralá.</p>`}
    ${detail.freshness.stale ? `<p class="admin-notice">Stale důvod: ${escapeHtml(detail.freshness.staleReason ?? "nezjištěno")}</p>` : ""}
    <details class="admin-disclosure admin-disclosure--technical">
      <summary><span>Technický stav instance</span><small>Freshness, snapshot, heartbeat a lease</small></summary>
      <div class="admin-kv-grid">
        ${keyValue("Join policy", detail.summary.joinPolicy)}${keyValue("Zdroj", detail.freshness.source)}
        ${keyValue("Snapshot", formatTime(detail.summary.lastSnapshotAt))}${keyValue("Heartbeat", formatTime(detail.summary.lastHeartbeatAt))}
        ${keyValue("Lease owner", detail.summary.leaseOwner)}${keyValue("Lease expires", formatTime(detail.summary.leaseExpiresAt))}
      </div>
    </details>
  </section>
  <div class="admin-detail-grid">
    ${renderPlayers(detail)}
    ${renderDistricts(detail)}
    ${renderEconomy(detail)}
    ${disclosureSection("production", "Gameplay", "Výroba", `<div class="admin-kv-grid">
      ${keyValue("Buildings", detail.production.productionBuildingCount)}
      ${keyValue("Ready", detail.production.readyToCollectCount)}
      ${keyValue("Crafts", detail.production.activeCraftCount)}
      ${keyValue("Storage full", detail.production.storageFullCount)}
    </div>`)}
    ${disclosureSection("police", "Gameplay", "Policie", `<div class="admin-kv-grid">
      ${keyValue("Pressure", detail.police.heatPressure)}${keyValue("Max heat", detail.police.maxPlayerHeat)}
      ${keyValue("Wanted", detail.police.wantedPlayerCount)}${keyValue("Raids", detail.police.pendingRaidCount)}
    </div>`)}
    ${renderLiveness(detail)}
    ${renderAlliances(detail)}
  </div>
  <section class="admin-technical-stack" aria-labelledby="admin-technical-title">
    <div class="admin-technical-stack__head"><span>Technická diagnostika</span><h2 id="admin-technical-title">Persistence, build a systémové události</h2>
      <p>Méně časté provozní detaily jsou záměrně sbalené.</p></div>
    ${renderSnapshots(detail)}
    ${disclosureSection("commands", "Instance log", "Commands", table(
      ["Type", "Command", "Actor", "Tick", "Received"],
      detail.commands.map((row) => `<tr data-admin-search-row><td>${escapeHtml(row.commandType)}</td>
        <td><code>${escapeHtml(row.commandId)}</code></td><td>${escapeHtml(row.actorId)}</td>
        <td>${row.tickAtReceive}</td><td>${formatTime(row.receivedAt)}</td></tr>`).join("")
    ))}
    ${disclosureSection("events", "Instance log", "Events", table(
      ["Type", "Event", "Command", "Tick", "Occurred"],
      detail.events.map((row) => `<tr data-admin-search-row><td>${escapeHtml(row.eventType)}</td>
        <td><code>${escapeHtml(row.eventId)}</code></td><td>${escapeHtml(row.causedByCommandId ?? "–")}</td>
        <td>${row.tick}</td><td>${formatTime(row.occurredAt)}</td></tr>`).join("")
    ))}
    ${disclosureSection("diagnostics", "Instance log", "Diagnostika", table(
      ["Level", "Category", "Code", "Command", "Occurred"],
      detail.diagnostics.map((row) => `<tr data-admin-search-row><td>${pill(row.level)}</td>
        <td>${escapeHtml(row.category)}</td><td>${escapeHtml(row.messageCode)}</td>
        <td>${escapeHtml(row.commandId ?? "–")}</td><td>${formatTime(row.occurredAt)}</td></tr>`).join("")
    ))}
  </section>
` : `<section class="admin-panel" role="status"><h3>Načítám detail instance...</h3></section>`;

const renderPlayers = (detail: AdminInstanceDetailView): string => disclosureSection("players", "Gameplay", "Hráči", table(
  ["Hráč", "Faction / stav", "Území", "Cash", "Populace", "Heat", "Poslední akce"],
  detail.players.map((row) => `<tr data-admin-search-row>
    <td><strong>${escapeHtml(row.displayName)}</strong><br><small>${escapeHtml(row.playerId)}</small></td>
    <td>${escapeHtml(row.factionId)}<br>${pill(row.status)}</td>
    <td>${row.ownedDistrictCount} districtů<br><small>home: ${escapeHtml(row.homeDistrictId ?? "–")}</small></td>
    <td>${formatNumber(row.cash)} clean<br><small>${formatNumber(row.dirtyCash)} dirty</small></td>
    <td>${formatNumber(row.population)}</td>
    <td>${row.heat}<br><small>wanted ${row.wantedLevel}</small></td>
    <td>${formatTime(row.lastActionAt)}</td>
  </tr>`).join("")
), true);

const renderDistricts = (detail: AdminInstanceDetailView): string => disclosureSection("map", "Gameplay", "Mapa districtů", table(
  ["District", "Zone / stav", "Owner", "Influence", "Heat", "Buildings"],
  detail.districts.map((row) => `<tr data-admin-search-row>
    <td><strong>${escapeHtml(row.name)}</strong><br><small>${escapeHtml(row.districtId)}</small></td>
    <td>${escapeHtml(row.zone)}<br>${pill(row.status)}</td><td>${escapeHtml(row.ownerPlayerId ?? "–")}</td>
    <td>${formatNumber(row.influence)}</td><td>${row.heat}</td><td>${row.buildingCount}</td>
  </tr>`).join("")
));

const renderEconomy = (detail: AdminInstanceDetailView): string => disclosureSection("economy", "Gameplay", "Ekonomika", `
  <div class="admin-kv-grid">
    ${keyValue("Clean cash", formatNumber(detail.economy.totalCleanCash))}
    ${keyValue("Dirty cash", formatNumber(detail.economy.totalDirtyCash))}
    ${Object.entries(detail.economy.totalResources)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([resource, value]) => keyValue(resource, formatNumber(value))).join("")}
  </div>`);

const renderLiveness = (detail: AdminInstanceDetailView): string => disclosureSection("liveness", "Gameplay", "Liveness", `
  <div class="admin-kv-grid">
    ${keyValue("Active", detail.liveness.activePlayers)}${keyValue("Playable", detail.liveness.playablePlayers)}
    ${keyValue("Sealed", detail.liveness.temporarilySealedPlayers)}${keyValue("Encircled", detail.liveness.encircledPlayers)}
    ${keyValue("Last stand", detail.liveness.lastStandPlayers)}
    ${keyValue("Emergency recovery", detail.liveness.emergencyRecoveryEligiblePlayers)}
    ${keyValue("Invalid softlocks", detail.liveness.invalidSoftlocks)}
  </div>`);

const renderAlliances = (detail: AdminInstanceDetailView): string => disclosureSection("alliances", "Gameplay", "Aliance", table(
  ["Alliance ID", "Členové"],
  detail.alliances.map((row) => `<tr data-admin-search-row><td><code>${escapeHtml(row.allianceId)}</code></td>
    <td>${row.memberCount}</td></tr>`).join("")
));

const renderSnapshots = (detail: AdminInstanceDetailView): string => disclosureSection("snapshots", "Persistence", "Snapshoty a recovery", `
  <div class="admin-kv-grid">
    ${keyValue("Recovery head ID", detail.snapshot.snapshotId)}
    ${keyValue("Recovery head tick", detail.snapshot.tick)}
    ${keyValue("Recovery head root version", detail.snapshot.stateVersion)}
    ${keyValue("Schema version", detail.snapshot.schemaVersion)}
    ${keyValue("Recovery head updated", formatTime(detail.snapshot.createdAt))}
    ${keyValue("Last checkpoint", formatTime(detail.snapshot.lastCheckpointAt))}
    ${keyValue("Rolling checkpoints", detail.snapshot.rollingCheckpointCount ?? 0)}
    ${keyValue("Lifecycle checkpoints", detail.snapshot.lifecycleCheckpointCount ?? 0)}
    ${keyValue("Terminal checkpoints", detail.snapshot.terminalCheckpointCount ?? 0)}
    ${keyValue("Last cleanup", formatTime(detail.snapshot.lastCleanupAt))}
    ${keyValue("Cleanup status", detail.snapshot.lastCleanupStatus ?? "unavailable")}
    ${keyValue("Storage health", detail.snapshot.storageHealth ?? "unavailable")}
  </div>`);
