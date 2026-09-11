import { readTickCountdown } from "./authoritativeTickCountdown.js";
import { formatEliminationRemainingMs } from "./authoritativeEliminationCountdown.js";
export { remainingUntilTick } from "./authoritativeTickCountdown.js";
export function createPlayerFeedbackPresentation(notification, slice, { resourceLabel = id => id, getSlice = () => slice } = {}) {
  const p = notification.payload || {};
  const district = String(p.districtId || "").replace(/^district:/u, "");
  const base = { title: notification.title, tone: "is-player-alert", badge: "Oznámení", syncToBuildingAction: false };
  if (p.kind === "incoming-attack") {
    const getRows = () => {
      const current = getSlice();
      const operation = current?.mapEffects?.find(effect => effect.type === "attack" && effect.districtId === p.districtId
        && effect.playerId === p.attackerPlayerId && effect.expiresAtTick === p.resolveAtTick);
      const countdown = readTickCountdown(current, operation?.expiresAtTick
        ?? (Array.isArray(current?.mapEffects) ? current?.server?.currentTick : null));
      return [{ label: "Útočník", value: p.attackerName }, { label: "Cíl", value: `District ${district}` },
        { label: "Konec boje", value: countdown.expired ? "Operace skončila nebo čeká na vyhodnocení" : countdown.label }];
    };
    return { ...base, summary: `${p.attackerName} zahájil útok na tvůj District ${district}.`, getRows, refreshMs: 1000 };
  }
  if (p.kind === "bounty-created") return { ...base, tone: "is-major-fail", badge: "Bounty",
    summary: `Byla na tebe vypsána odměna ${Number(p.rewardCleanCash).toLocaleString("cs-CZ")} čistých peněz.`,
    getRows: () => [{ label: "Zadavatel", value: p.createdByLabel || "Anonym" },
      { label: "Vypsáno", value: new Date(notification.createdAt).toLocaleString("cs-CZ") },
      { label: "Cíl", value: district ? `District ${district}` : "Tvůj gang" },
      { label: "Odměna", value: `${Number(p.rewardCleanCash).toLocaleString("cs-CZ")} $` },
      { label: "Platnost", value: getBountyValidity(getSlice(), p) }], refreshMs: 1000 };
  if (p.kind === "market-sale") return { ...base, tone: "is-success", badge: "Hráčský bazar",
    summary: `Obchod proběhl. Do kasy bylo připsáno ${Number(p.creditedAmount).toLocaleString("cs-CZ")} ${p.paymentType === "dirtyCash" ? "špinavých" : "čistých"} peněz.`,
    rows: [{ label: "Prodáno", value: `${p.amount}× ${resourceLabel(p.resourceId)}` },
      { label: "Připsáno do kasy", value: `${Number(p.creditedAmount).toLocaleString("cs-CZ")} $ (${p.paymentType === "dirtyCash" ? "špinavé" : "čisté"})` },
      { label: "Čas obchodu", value: new Date(notification.createdAt).toLocaleString("cs-CZ") }] };
  return null;
}

function getBountyValidity(slice, notification) {
  const entries = slice?.bounty?.activeBounties;
  if (!Array.isArray(entries)) return "Čeká na server";
  const bounty = entries.find(entry => entry.bountyId === notification.bountyId);
  if (!bounty) return "Bounty již není aktivní";
  const terminal = { cancelled: "Zrušeno", claimed: "Odměna vyplacena", expired: "Platnost vypršela" };
  if (terminal[bounty.status]) return terminal[bounty.status];
  const countdown = readTickCountdown(slice, bounty.expiresAtTick);
  return countdown.expired ? "Čeká na potvrzení serveru" : countdown.label;
}
export function createPlayerFeedbackSync({ root, append, open, resourceLabel, getSlice, storage }) {
  const rendered = new Set();
  return slice => {
    if (!slice) return;
    const key = `empire:feedback:${slice.server?.serverInstanceId}:${slice.player?.playerId}`;
    let seen = [], lastCreatedAt = 0;
    try {
      const saved = JSON.parse(storage?.getItem(key) || "[]");
      seen = Array.isArray(saved) ? saved : Array.isArray(saved?.seen) ? saved.seen : [];
      lastCreatedAt = Number(saved?.lastCreatedAt || 0);
    } catch {}
    let latestCreatedAt = lastCreatedAt;
    for (const n of slice.player?.notifications || []) {
      if (n.category !== "player.feedback" || rendered.has(n.id)) continue;
      const payload = createPlayerFeedbackPresentation(n, slice, { resourceLabel, getSlice });
      if (!payload) continue;
      rendered.add(n.id);
      append(root, "police", payload, { id: n.id, timestampMs: Date.parse(n.createdAt), tone: payload.tone,
        title: payload.title, summary: payload.summary, sourceKind: "player-feedback", category: n.payload.kind },
        { refresh: false, syncPreview: true, forceLog: true });
      if (!seen.includes(n.id) && !n.readAt && Date.parse(n.createdAt) >= lastCreatedAt) open(root, "police", payload);
      latestCreatedAt = Math.max(latestCreatedAt, Date.parse(n.createdAt) || 0);
      seen.push(n.id);
    }
    try { storage?.setItem(key, JSON.stringify({ seen: [...new Set(seen)].slice(-300), lastCreatedAt: latestCreatedAt })); } catch {}
  };
}
export function renderDistrictBountyNotice(root, slice, districtId) {
  let node = root?.querySelector?.("[data-district-bounty-notice]");
  if (!node && root?.ownerDocument) {
    node = root.ownerDocument.createElement("p"); node.dataset.districtBountyNotice = "true";
    node.className = "district-bounty-notice"; root.querySelector("[data-district-popup-owner]")?.append(node);
    if (!node.parentNode) root.querySelector("[data-district-popup-card]")?.append(node);
  }
  if (!node) return;
  const ownerId = slice?.district?.ownerPlayerId;
  const entries = (slice?.bounty?.activeBounties || []).filter(b => b.status === "active" && b.remainingTicks > 0
    && (b.targetDistrictId ? b.targetDistrictId === districtId : b.targetPlayerId === ownerId));
  node.hidden = !entries.length;
  node.textContent = entries.map(b => `⌖ BOUNTY ${Number(b.rewardCleanCash).toLocaleString("cs-CZ")} $ · ${b.createdByLabel} · ${formatEliminationRemainingMs(b.remainingMs)}`).join(" · ");
}
export function createStabilizationNews(slice, { getSlice = () => slice } = {}) {
  return (slice?.districts || []).filter(d => d.isOwnedByPlayer && d.stabilizingUntilTick > slice.server.currentTick
    && !readTickCountdown(slice, d.stabilizingUntilTick).expired).map(d => {
    const getCountdown = () => {
      const current = getSlice();
      if (!Array.isArray(current?.districts)) return { label: "Čeká na server", expired: false };
      const district = current.districts.find(entry => entry.districtId === d.districtId);
      if (!district?.isOwnedByPlayer || !district.stabilizingUntilTick) return { label: "Stabilizace skončila", expired: true };
      return readTickCountdown(current, district.stabilizingUntilTick);
    };
    return { id: `stabilization:${d.districtId}`, sourceKind: "cooldown", category: "stabilization", tone: "warning",
      title: `District ${d.districtId.replace(/^district:/u, "")}: stabilizace`,
      summary: "Po stabilizaci může tento district znovu sloužit jako zdroj útoku.",
      meta: getCountdown().label, getCountdown, persistent: true, dismissible: false,
      countdownPrefix: "Útoky dostupné za ", resultKind: "police", resultPayload: {
        title: "Stabilizace districtu", summary: "District se po obsazení stabilizuje. Do skončení z něj nelze zaútočit.",
        syncToBuildingAction: false,
        getRows: () => [{ label: "Zbývá", value: getCountdown().label }], refreshMs: 1000
      } };
  });
}
