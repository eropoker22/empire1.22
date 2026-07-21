import { resolveClientAuthorityState, publishClientAuthorityState } from "./clientAuthorityState.js";

const CLIENT_SCRIPT_SRC = "../page-assets/js/client-assets/gameplay-slice-client.js";

export const prepareLiveGameplayBootstrap = (membership, documentRef = document) => {
  const root = documentRef.querySelector("[data-gameplay-slice-client]");
  if (!(root instanceof HTMLElement)) throw new Error("Gameplay slice mount is missing.");
  if (!isActiveMembership(membership)) throw new Error("Active server membership is required.");

  root.dataset.serverInstanceId = membership.serverInstanceId;
  root.dataset.playerId = membership.playerId;
  root.dataset.districtId = membership.reservedSpawnDistrictId;
  root.dataset.factionId = membership.factionId || "";
  root.dataset.gameplayBootstrapReady = "true";
  documentRef.body?.classList.add("game-body--booting");
  documentRef.body?.setAttribute("data-authority-state", "booting");
  setGameShellLocked(documentRef, true);
  renderAuthorityGate(documentRef, {
    status: "PŘIPOJUJI SERVER",
    message: "Ověřuji účet, členství a aktuální stav města.",
    retryVisible: false
  });
  publishClientAuthorityState(resolveClientAuthorityState({
    accountReady: true,
    membershipReady: true,
    serverReady: false,
    gameplayReady: false,
    reasonCode: "GAMEPLAY_SLICE_PENDING"
  }));

  return root;
};

export const mountLiveGameplayClient = async (root, documentRef = document) => {
  bindAuthorityEvents(documentRef);
  await ensureClientScript(documentRef);
  const mount = window.EmpireGameplaySliceClient?.mount;
  if (typeof mount !== "function") throw new Error("Gameplay client failed to initialize.");
  const mounted = mount({ root });
  if (!mounted) throw new Error("Gameplay client rejected the live bootstrap.");
  return mounted;
};

export const showLiveGameplayUnavailable = (error, documentRef = document) => {
  const message = error instanceof Error && error.message.trim()
    ? error.message.trim()
    : "Živý stav serveru se nepodařilo načíst.";
  documentRef.body?.classList.add("game-body--booting");
  documentRef.body?.setAttribute("data-authority-state", "unavailable");
  setGameShellLocked(documentRef, true);
  renderAuthorityGate(documentRef, {
    status: "SERVER NENÍ DOSTUPNÝ",
    message: `${message} Žádná lokální náhrada nebyla spuštěna.`,
    retryVisible: true
  });
  publishClientAuthorityState(resolveClientAuthorityState({
    accountReady: true,
    membershipReady: true,
    serverReady: false,
    gameplayReady: false,
    reasonCode: "GAMEPLAY_SERVER_UNAVAILABLE"
  }));
};

export const bindGameAuthorityGate = (documentRef = document) => {
  documentRef.querySelector("[data-game-authority-retry]")?.addEventListener("click", () => location.reload());
};

const bindAuthorityEvents = (documentRef) => {
  if (documentRef.documentElement.dataset.liveAuthorityEventsBound === "true") return;
  documentRef.documentElement.dataset.liveAuthorityEventsBound = "true";
  documentRef.addEventListener("empire:gameplay-slice-rendered", (event) => {
    if (!event.detail?.gameplaySlice?.player?.playerId) return;
    documentRef.body?.classList.remove("game-body--booting");
    documentRef.body?.setAttribute("data-authority-state", "ready");
    setGameShellLocked(documentRef, false);
    renderAuthorityGate(documentRef, { status: "PŘIPOJENO", message: "", retryVisible: false });
    publishClientAuthorityState(resolveClientAuthorityState({
      accountReady: true,
      membershipReady: true,
      serverReady: true,
      gameplayReady: true
    }));
  });
  documentRef.addEventListener("empire:gameplay-connection-state", (event) => {
    if (event.detail?.status === "ready") return;
    if (documentRef.body?.dataset.authorityState !== "ready") {
      showLiveGameplayUnavailable(new Error(event.detail?.lastErrorMessage || "Spojení se serverem selhalo."), documentRef);
    }
  });
};

const ensureClientScript = (documentRef) => new Promise((resolve, reject) => {
  if (window.EmpireGameplaySliceClient?.mount) {
    resolve(window.EmpireGameplaySliceClient);
    return;
  }
  const existing = documentRef.querySelector("script[data-live-gameplay-client]");
  if (existing) {
    existing.addEventListener("load", () => resolve(window.EmpireGameplaySliceClient), { once: true });
    existing.addEventListener("error", () => reject(new Error("Gameplay client bundle is unavailable.")), { once: true });
    return;
  }
  const script = documentRef.createElement("script");
  script.src = CLIENT_SCRIPT_SRC;
  script.async = true;
  script.dataset.liveGameplayClient = "true";
  script.addEventListener("load", () => resolve(window.EmpireGameplaySliceClient), { once: true });
  script.addEventListener("error", () => reject(new Error("Gameplay client bundle is unavailable.")), { once: true });
  documentRef.head.append(script);
});

const setGameShellLocked = (documentRef, locked) => {
  const shell = documentRef.querySelector("#game-root");
  if (!(shell instanceof HTMLElement)) return;
  shell.inert = locked;
  shell.setAttribute("aria-busy", String(locked));
};

const renderAuthorityGate = (documentRef, { status, message, retryVisible }) => {
  const gate = documentRef.querySelector("[data-game-authority-gate]");
  if (!(gate instanceof HTMLElement)) return;
  const statusNode = gate.querySelector("[data-game-authority-status]");
  const messageNode = gate.querySelector("[data-game-authority-message]");
  const retry = gate.querySelector("[data-game-authority-retry]");
  if (statusNode) statusNode.textContent = status;
  if (messageNode) messageNode.textContent = message;
  if (retry instanceof HTMLButtonElement) retry.hidden = !retryVisible;
  gate.setAttribute("aria-hidden", documentRef.body?.classList.contains("game-body--booting") ? "false" : "true");
};

const isActiveMembership = (membership) => Boolean(
  membership?.status === "active"
  && String(membership.serverInstanceId || "").startsWith("instance:")
  && String(membership.playerId || "").startsWith("player:")
);
