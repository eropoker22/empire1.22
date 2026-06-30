import { submitServerAllianceCommand } from "./runtime.js";

const LOCAL_ALLIANCE_KEY = "empire_local_alliance_state";
const GLOBAL_CHAT_KEY = "empire_local_global_chat_state";

let latestAllianceBoard = null;
let selectedIconKey = "crown_skull";

const qs = (id) => document.getElementById(id);

const escapeHtml = (value) => String(value || "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const formatRelativeTime = (isoValue) => {
  const timestamp = Date.parse(isoValue || "");
  if (!Number.isFinite(timestamp)) return "-";
  const minutes = Math.floor(Math.max(0, Date.now() - timestamp) / 60000);
  if (minutes < 1) return "prave ted";
  if (minutes < 60) return `pred ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `pred ${hours} h`;
  return `pred ${Math.floor(hours / 24)} d`;
};

const formatReadyCountdown = (isoValue) => {
  const delta = Math.max(0, Math.floor((Date.parse(isoValue || "") - Date.now()) / 1000));
  const hours = Math.floor(delta / 3600);
  const minutes = Math.floor((delta % 3600) / 60);
  const seconds = delta % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const notify = (message) => {
  const summary = document.querySelector("[data-building-action-summary]");
  if (summary) summary.textContent = message;
};

const commandMessage = (response, fallback) =>
  response?.errors?.[0]?.message || response?.errors?.[0]?.code || fallback;

const runAllianceCommand = async (type, payload, successMessage) => {
  const response = await submitServerAllianceCommand({ type, payload });
  if (!response?.accepted && response?.errors?.length) {
    notify(commandMessage(response, "Alliance akci se nepodarilo dokoncit."));
    return false;
  }
  notify(successMessage);
  return true;
};

const setModalVisible = (modal, visible) => {
  if (!modal) return;
  modal.classList.toggle("hidden", !visible);
  modal.setAttribute("aria-hidden", visible ? "false" : "true");
};

const renderAllianceIdentityMarkup = (alliance) => `
  <span class="alliance-badge-markup">
    <span class="alliance-badge-markup__icon">${escapeHtml(alliance?.tag || "AL")}</span>
    <span class="alliance-badge-markup__name">${escapeHtml(alliance?.name || "Aliance")}</span>
  </span>
`;

const renderMember = (member) => `
  <div class="alliance-member">
    <div class="alliance-member__top">
      <div class="alliance-member__avatar alliance-member__avatar--empty">${escapeHtml((member.name || "?").slice(0, 1))}</div>
      <div class="alliance-member__identity">
        <strong>${escapeHtml(member.name)}</strong>
        <span>${escapeHtml(member.role === "leader" ? "Leader" : "Clen")} · ${escapeHtml(member.status)} · ${member.activeDistrictCount} districtu</span>
      </div>
    </div>
    <span class="alliance-ready-state ${member.status === "active" ? "alliance-ready-state--ok" : "alliance-ready-state--bad"}">
      ${member.readyDueAt ? formatReadyCountdown(member.readyDueAt) : "READY"}
    </span>
  </div>
`;

const renderChat = (messages = []) => {
  const log = document.querySelector("[data-alliance-chat-log]");
  if (!log) return;
  log.innerHTML = messages.length
    ? messages.map((message) => `
      <div class="alliance-chat__item">
        <strong>${escapeHtml(message.authorName)}</strong>
        <span>${escapeHtml(message.body)}</span>
      </div>
    `).join("")
    : `<div class="alliance-chat__item"><span>Alliance chat je prazdny.</span></div>`;
  log.scrollTop = log.scrollHeight;
};

const renderGlobalServerChat = () => {
  const log = document.querySelector("[data-global-chat-log]");
  if (!log) return;
  let messages = [];
  try {
    messages = JSON.parse(localStorage.getItem(GLOBAL_CHAT_KEY) || "[]");
  } catch {
    messages = [];
  }
  log.innerHTML = (Array.isArray(messages) && messages.length ? messages : [
    { author: "System", text: "Serverovy chat je pripraveny." }
  ]).slice(0, 30).map((message) => `
    <div class="alliance-chat__item server-chat-panel__message">
      <strong>${escapeHtml(message.author || "System")}</strong>
      <span>${escapeHtml(message.text || "")}</span>
    </div>
  `).join("");
};

const saveGlobalMessage = (text) => {
  let messages = [];
  try {
    messages = JSON.parse(localStorage.getItem(GLOBAL_CHAT_KEY) || "[]");
  } catch {
    messages = [];
  }
  messages = [{ author: "Ty", text }, ...(Array.isArray(messages) ? messages : [])].slice(0, 30);
  localStorage.setItem(GLOBAL_CHAT_KEY, JSON.stringify(messages));
};

const renderAllianceState = () => {
  const board = latestAllianceBoard;
  const createEntry = qs("alliance-create-entry");
  const activePanel = qs("alliance-active-panel");
  const invitesPanel = qs("alliance-player-invites-panel");
  const listPanel = qs("alliance-list-panel");
  const leaveBtn = qs("alliance-leave-btn");
  const managementBtn = qs("alliance-management-footer-btn");
  const activeAlliance = board?.activeAlliance || null;

  document.querySelector("[data-gang-alliance]")?.replaceChildren(document.createTextNode(activeAlliance?.name || "Zadna"));
  document.querySelector("[data-player-popup-alliance]")?.replaceChildren(document.createTextNode(activeAlliance?.name || "Zadna"));
  createEntry?.classList.toggle("hidden", Boolean(activeAlliance));
  leaveBtn?.classList.toggle("hidden", !activeAlliance);
  managementBtn?.classList.toggle("hidden", !activeAlliance);

  if (activePanel) {
    activePanel.innerHTML = activeAlliance ? `
      <div class="alliance-active-card">
        <div class="alliance-active-card__top">
          <div class="alliance-active-card__badge-wrap">
            <div class="alliance-active-card__badge-line">
              <div class="alliance-active-card__badge">${renderAllianceIdentityMarkup(activeAlliance)}</div>
              <div class="alliance-ready-panel">
                <div class="alliance-ready-panel__meta">
                  <span>${escapeHtml(activeAlliance.currentPlayerRole === "leader" ? "Leader" : "Clen")}</span>
                  <div class="alliance-ready-panel__timer ${activeAlliance.canConfirmReady ? "alliance-ready-panel__timer--bad" : "alliance-ready-panel__timer--ok"}">
                    ${escapeHtml(activeAlliance.readyReasonCode || "active")}
                  </div>
                </div>
              </div>
            </div>
            <div class="alliance-active-card__description">
              <span>Serverova aliance</span>
              <strong>${activeAlliance.memberCount}/${activeAlliance.maxMembers} clenu · obrana spojencu aktivni</strong>
            </div>
            <div class="alliance-active-card__badges">
              <span class="alliance-ready-state alliance-ready-state--leader">Server authoritative</span>
              <button class="btn btn--primary alliance-ready-btn alliance-ready-btn--inline" id="alliance-ready-btn" ${activeAlliance.canConfirmReady ? "" : "disabled"}>READY</button>
            </div>
          </div>
        </div>
        <div class="alliance-active-card__overview">
          <div class="alliance-active-card__stats-column">
            <div class="alliance-active-card__stat"><span>Clenove</span><strong>${activeAlliance.memberCount}/${activeAlliance.maxMembers}</strong></div>
            <div class="alliance-active-card__stat"><span>Defense</span><strong>Ally contribution</strong></div>
            <div class="alliance-active-card__stat"><span>Chat</span><strong>Server log</strong></div>
          </div>
          <div class="alliance-active-card__chat-pane">
            <div class="alliance-chat alliance-chat--modal">
              <div class="alliance-chat__title">Alliance chat</div>
              <div class="alliance-chat__log" data-alliance-chat-log></div>
              <div class="alliance-chat__input alliance-chat__input--modal alliance-active-card__chat-compose">
                <input type="text" placeholder="Napis zpravu do chatu aliance..." data-alliance-chat-input>
                <button type="button" class="btn btn--primary" data-alliance-chat-send>Odeslat</button>
              </div>
            </div>
          </div>
        </div>
        <div class="alliance-pending-panel">
          <div class="alliance-pending-panel__title">Clenove aliance</div>
          <div class="alliance-members">${activeAlliance.members.map(renderMember).join("")}</div>
        </div>
        <div class="alliance-pending-panel">
          <div class="alliance-pending-panel__title">Spojenecka obrana</div>
          ${renderDefenseContributions(activeAlliance.defenseContributions)}
        </div>
        <div class="alliance-active-card__actions">
          <button class="btn btn--ghost alliance-management-btn" id="alliance-management-open-btn">Sprava aliance</button>
        </div>
      </div>
    ` : "";
  }

  if (invitesPanel) {
    invitesPanel.innerHTML = board?.incomingInvites?.length ? `
      <div class="alliance-pending-panel">
        <div class="alliance-pending-panel__title">Prime pozvanky</div>
        ${board.incomingInvites.map((invite) => `
          <div class="alliance-request-item">
            <div class="alliance-request-item__copy">
              <strong>${escapeHtml(invite.allianceName)}</strong>
              <span>Pozvanka od ${escapeHtml(invite.invitedByName)} · ${escapeHtml(formatRelativeTime(invite.createdAt))}</span>
            </div>
            <div class="alliance-request-item__actions">
              <button class="btn btn--primary" data-alliance-invite-accept="${escapeHtml(invite.inviteId)}">Prijmout</button>
              <button class="btn btn--ghost" data-alliance-invite-reject="${escapeHtml(invite.inviteId)}">Odmitnout</button>
            </div>
          </div>
        `).join("")}
      </div>
    ` : "";
  }

  if (listPanel) {
    const publicAlliances = board?.publicAlliances || [];
    listPanel.innerHTML = `
      <div class="alliance-pending-panel">
        <div class="alliance-pending-panel__title">Verejne aliance</div>
        <div class="alliance-list">
          ${publicAlliances.length ? publicAlliances.map((alliance) => `
            <div class="alliance-list__item">
              <div class="alliance-list__name">${renderAllianceIdentityMarkup(alliance)}</div>
              <div class="alliance-list__meta">${alliance.memberCount}/${alliance.maxMembers} clenu · leader ${escapeHtml(alliance.ownerName)}</div>
              <div class="alliance-list__description">Serverova aliance s ready cyklem, chatem a ally obranou.</div>
              <div class="alliance-request-item__actions">
                <button class="btn btn--ghost" data-alliance-join="${escapeHtml(alliance.allianceId)}" ${alliance.canJoin ? "" : "disabled"}>
                  ${escapeHtml(alliance.canJoin ? "Vstoupit" : alliance.joinDisabledReason || "Nedostupne")}
                </button>
              </div>
            </div>
          `).join("") : `<div class="alliance-request-item alliance-request-item--empty">Zatim neexistuje zadna verejna aliance.</div>`}
        </div>
      </div>
    `;
  }

  renderChat(activeAlliance?.chatMessages || []);
};

const renderAllianceManagementState = () => {
  const panel = qs("alliance-management-panel");
  const activeAlliance = latestAllianceBoard?.activeAlliance || null;
  if (!panel) return;
  if (!activeAlliance) {
    panel.innerHTML = `<div class="alliance-request-item alliance-request-item--empty">Nejsi v zadne alianci.</div>`;
    return;
  }

  panel.innerHTML = `
    <div class="alliance-management-ready">
      <div class="alliance-management-ready__copy">
        <span>Status</span>
        <strong>${escapeHtml(activeAlliance.currentPlayerRole === "leader" ? "Leader" : "Clen")} · ${escapeHtml(activeAlliance.name)}</strong>
      </div>
      <div class="alliance-management-ready__actions">
        <button class="btn btn--primary alliance-ready-btn alliance-ready-btn--management" id="alliance-management-ready-btn" ${activeAlliance.canConfirmReady ? "" : "disabled"}>READY</button>
      </div>
    </div>
    <div class="alliance-pending-panel">
      <div class="alliance-pending-panel__title">Pozvat hrace</div>
      <div class="alliance-control__row">
        <select id="alliance-management-invite-name" ${activeAlliance.canInvite ? "" : "disabled"}>
          <option value="">Vyber hrace</option>
          ${(latestAllianceBoard?.eligibleInviteTargets || []).map((target) => `
            <option value="${escapeHtml(target.playerId)}" ${target.canInvite ? "" : "disabled"}>
              ${escapeHtml(target.name)}${target.disabledReason ? ` · ${escapeHtml(target.disabledReason)}` : ""}
            </option>
          `).join("")}
        </select>
        <button class="btn btn--primary" id="alliance-management-invite-btn" ${activeAlliance.canInvite ? "" : "disabled"}>Pozvat</button>
      </div>
    </div>
    <div class="alliance-pending-panel">
      <div class="alliance-pending-panel__title">Clenove aliance</div>
      ${activeAlliance.members.map((member) => `
        <div class="alliance-request-item">
          <div class="alliance-request-item__copy">
            <strong>${escapeHtml(member.name)}</strong>
            <span>${escapeHtml(member.role)} · ${escapeHtml(member.status)} · ${member.activeDistrictCount} districtu</span>
          </div>
          <div class="alliance-request-item__actions">
            ${member.canStartKickVote ? `<button class="btn btn--primary" data-alliance-kick-start="${escapeHtml(member.playerId)}">Spustit hlasovani</button>` : ""}
          </div>
        </div>
      `).join("")}
    </div>
    <div class="alliance-pending-panel">
      <div class="alliance-pending-panel__title">Odeslane pozvanky</div>
      ${activeAlliance.pendingInvites.length ? activeAlliance.pendingInvites.map((invite) => `
        <div class="alliance-request-item">
          <div class="alliance-request-item__copy">
            <strong>${escapeHtml(invite.targetName)}</strong>
            <span>Pozvano ${escapeHtml(formatRelativeTime(invite.createdAt))}</span>
          </div>
        </div>
      `).join("") : `<div class="alliance-request-item alliance-request-item--empty">Zadne aktivni pozvanky.</div>`}
    </div>
    <div class="alliance-pending-panel">
      <div class="alliance-pending-panel__title">Defense contributions</div>
      ${renderDefenseContributions(activeAlliance.defenseContributions)}
    </div>
  `;
};

const renderDefenseContributions = (contributions = []) => contributions.length
  ? contributions.map((contribution) => `
    <div class="alliance-request-item">
      <div class="alliance-request-item__copy">
        <strong>${escapeHtml(contribution.itemId)} x${Number(contribution.amount || 0)}</strong>
        <span>${escapeHtml(contribution.ownerName)} -> ${escapeHtml(contribution.districtName)} (${escapeHtml(contribution.hostName)}) · ${escapeHtml(contribution.status)}</span>
      </div>
    </div>
  `).join("")
  : `<div class="alliance-request-item alliance-request-item--empty">Zatim neni vlozena zadna spojenecka obrana.</div>`;

const rerenderAll = () => {
  renderAllianceState();
  renderAllianceManagementState();
  renderGlobalServerChat();
};

const openAllianceModal = () => {
  setModalVisible(qs("alliance-modal"), true);
  document.dispatchEvent(new CustomEvent("empire:onboarding-event", { detail: { type: "alliance:opened" } }));
  rerenderAll();
};

const closeAllAllianceModals = () => {
  ["alliance-modal", "alliance-create-modal", "alliance-leave-modal", "alliance-management-modal"].forEach((id) =>
    setModalVisible(qs(id), false)
  );
};

const resetCreateForm = () => {
  if (qs("alliance-create-name")) qs("alliance-create-name").value = "";
  if (qs("alliance-create-description")) qs("alliance-create-description").value = "";
};

const bindAllianceRuntime = () => {
  try {
    localStorage.removeItem(LOCAL_ALLIANCE_KEY);
  } catch (_error) {
    // Local alliance state is deprecated and intentionally ignored.
  }

  qs("alliance-btn")?.addEventListener("click", openAllianceModal);
  qs("alliance-modal-backdrop")?.addEventListener("click", closeAllAllianceModals);
  qs("alliance-modal-close")?.addEventListener("click", closeAllAllianceModals);
  qs("alliance-create-toggle-btn")?.addEventListener("click", () => setModalVisible(qs("alliance-create-modal"), true));
  qs("alliance-create-modal-backdrop")?.addEventListener("click", () => setModalVisible(qs("alliance-create-modal"), false));
  qs("alliance-create-modal-close")?.addEventListener("click", () => setModalVisible(qs("alliance-create-modal"), false));
  qs("alliance-leave-modal-backdrop")?.addEventListener("click", () => setModalVisible(qs("alliance-leave-modal"), false));
  qs("alliance-leave-modal-close")?.addEventListener("click", () => setModalVisible(qs("alliance-leave-modal"), false));
  qs("alliance-leave-cancel-btn")?.addEventListener("click", () => setModalVisible(qs("alliance-leave-modal"), false));
  qs("alliance-leave-btn")?.addEventListener("click", () => setModalVisible(qs("alliance-leave-modal"), true));
  qs("alliance-management-modal-backdrop")?.addEventListener("click", () => setModalVisible(qs("alliance-management-modal"), false));
  qs("alliance-management-modal-close")?.addEventListener("click", () => setModalVisible(qs("alliance-management-modal"), false));
  qs("alliance-management-footer-btn")?.addEventListener("click", () => setModalVisible(qs("alliance-management-modal"), true));

  qs("alliance-create-btn")?.addEventListener("click", async () => {
    const name = String(qs("alliance-create-name")?.value || "").trim();
    const tag = selectedIconKey.slice(0, 4);
    if (!name) {
      notify("Zadej nazev aliance.");
      return;
    }
    const ok = await runAllianceCommand("create-alliance", { name, tag }, `Aliance ${name} byla zalozena.`);
    if (ok) {
      setModalVisible(qs("alliance-create-modal"), false);
      resetCreateForm();
    }
  });

  qs("alliance-leave-confirm-btn")?.addEventListener("click", async () => {
    const activeAlliance = latestAllianceBoard?.activeAlliance;
    if (!activeAlliance) return;
    const type = activeAlliance.currentPlayerRole === "leader" ? "disband-alliance" : "leave-alliance";
    const ok = await runAllianceCommand(type, { allianceId: activeAlliance.allianceId }, "Aliance byla opustena.");
    if (ok) setModalVisible(qs("alliance-leave-modal"), false);
  });

  qs("alliance-management-invite-btn")?.addEventListener("click", async () => {
    const activeAlliance = latestAllianceBoard?.activeAlliance;
    const targetPlayerId = String(qs("alliance-management-invite-name")?.value || "").trim();
    if (!activeAlliance || !targetPlayerId) {
      notify("Vyber hrace pro pozvanku.");
      return;
    }
    await runAllianceCommand("invite-alliance-member", {
      allianceId: activeAlliance.allianceId,
      targetPlayerId
    }, "Pozvanka byla odeslana.");
  });

  document.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target.closest(
      "[data-alliance-join], [data-alliance-invite-accept], [data-alliance-invite-reject], #alliance-ready-btn, #alliance-management-ready-btn, #alliance-management-open-btn, [data-alliance-chat-send], [data-alliance-kick-start]"
    ) : null;
    if (!(target instanceof HTMLElement)) return;
    const activeAlliance = latestAllianceBoard?.activeAlliance;

    if (target.id === "alliance-management-open-btn") {
      setModalVisible(qs("alliance-management-modal"), true);
      return;
    }
    if (target.id === "alliance-ready-btn" || target.id === "alliance-management-ready-btn") {
      if (activeAlliance) {
        await runAllianceCommand("confirm-alliance-ready", { allianceId: activeAlliance.allianceId }, "READY stav byl potvrzen.");
      }
      return;
    }
    if (target.hasAttribute("data-alliance-chat-send")) {
      const input = document.querySelector("[data-alliance-chat-input]");
      const body = String(input?.value || "").trim();
      if (activeAlliance && body) {
        const ok = await runAllianceCommand("send-alliance-chat-message", { allianceId: activeAlliance.allianceId, body }, "Zprava odeslana.");
        if (ok && input instanceof HTMLInputElement) input.value = "";
      }
      return;
    }
    if (target.hasAttribute("data-alliance-join")) {
      await runAllianceCommand("join-alliance", { allianceId: target.getAttribute("data-alliance-join") }, "Vstoupil jsi do aliance.");
      return;
    }
    if (target.hasAttribute("data-alliance-invite-accept") || target.hasAttribute("data-alliance-invite-reject")) {
      await runAllianceCommand("respond-alliance-invite", {
        inviteId: target.getAttribute("data-alliance-invite-accept") || target.getAttribute("data-alliance-invite-reject"),
        response: target.hasAttribute("data-alliance-invite-accept") ? "accept" : "reject"
      }, target.hasAttribute("data-alliance-invite-accept") ? "Pozvanka prijata." : "Pozvanka odmitnuta.");
      return;
    }
    if (target.hasAttribute("data-alliance-kick-start") && activeAlliance) {
      await runAllianceCommand("start-alliance-kick-vote", {
        allianceId: activeAlliance.allianceId,
        targetPlayerId: target.getAttribute("data-alliance-kick-start")
      }, "Hlasovani bylo spusteno.");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAllAllianceModals();
    const target = event.target;
    if (event.key === "Enter" && target instanceof HTMLInputElement && target.hasAttribute("data-alliance-chat-input")) {
      event.preventDefault();
      document.querySelector("[data-alliance-chat-send]")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  });

  qs("alliance-chat-send")?.addEventListener("click", () => {
    const input = qs("alliance-chat-input");
    const text = String(input?.value || "").trim();
    if (!text) return;
    saveGlobalMessage(text);
    if (input instanceof HTMLInputElement) input.value = "";
    renderGlobalServerChat();
  });

  document.addEventListener("empire:gameplay-slice-rendered", (event) => {
    latestAllianceBoard = event?.detail?.gameplaySlice?.allianceBoard || null;
    rerenderAll();
    window.dispatchEvent(new CustomEvent("empire:alliance-state-changed"));
  });

  window.empireStreetsAllianceState = {
    getActiveAlliance: () => latestAllianceBoard?.activeAlliance || null,
    getMapBadge: () => {
      const alliance = latestAllianceBoard?.activeAlliance;
      return alliance ? { name: alliance.name, iconKey: "server", symbol: alliance.tag || "AL" } : null;
    }
  };

  renderGlobalServerChat();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindAllianceRuntime, { once: true });
} else {
  bindAllianceRuntime();
}
