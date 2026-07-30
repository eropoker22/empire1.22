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
  root.dataset.gameplaySlicePresentationMode = "controller-only";
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
  const mounted = mount({ root, presentationMode: "controller-only" });
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

export const applyLiveGameplayAuthorityState = (gameplaySlice, documentRef = document) => {
  if (!gameplaySlice?.player?.playerId) return false;
  const lifecycleStatus = String(gameplaySlice?.server?.status || "").trim().toLowerCase();
  if (lifecycleStatus === "running") {
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
    return true;
  }

  const waitingState = resolveWaitingAuthorityState(lifecycleStatus);
  documentRef.body?.classList.add("game-body--booting");
  documentRef.body?.setAttribute("data-authority-state", waitingState.authorityState);
  setGameShellLocked(documentRef, true);
  renderAuthorityGate(documentRef, waitingState);
  publishClientAuthorityState(resolveClientAuthorityState({
    accountReady: true,
    membershipReady: true,
    serverReady: Boolean(lifecycleStatus),
    gameplayReady: false,
    reasonCode: waitingState.reasonCode
  }));
  return true;
};

const bindAuthorityEvents = (documentRef) => {
  if (documentRef.documentElement.dataset.liveAuthorityEventsBound === "true") return;
  documentRef.documentElement.dataset.liveAuthorityEventsBound = "true";
  documentRef.addEventListener("empire:gameplay-slice-rendered", (event) => {
    applyLiveGameplayAuthorityState(event.detail?.gameplaySlice, documentRef);
  });
  documentRef.addEventListener("empire:gameplay-connection-state", (event) => {
    const connectionStatus = String(event.detail?.status || "").trim().toLowerCase();
    if (connectionStatus === "ready" || connectionStatus === "connected") return;
    if (connectionStatus === "error" || connectionStatus === "unavailable") {
      showLiveGameplayUnavailable(new Error(event.detail?.lastErrorMessage || "Spojení se serverem selhalo."), documentRef);
    }
  });
};

const resolveWaitingAuthorityState = (lifecycleStatus) => {
  if (lifecycleStatus === "lobby" || lifecycleStatus === "created" || lifecycleStatus === "full") {
    return {
      authorityState: "waiting-for-start",
      status: "SERVER ČEKÁ NA START",
      message: "Jsi připojený do lobby. Herní akce budou dostupné, až vlastník server spustí.",
      retryVisible: false,
      reasonCode: "SERVER_WAITING_FOR_START"
    };
  }
  if (lifecycleStatus === "paused" || lifecycleStatus === "pausing") {
    return {
      authorityState: "paused",
      status: "SERVER JE POZASTAVENÝ",
      message: "Herní akce jsou do obnovení serveru uzamčené.",
      retryVisible: false,
      reasonCode: "SERVER_PAUSED"
    };
  }
  if (lifecycleStatus === "booting" || lifecycleStatus === "restarting") {
    return {
      authorityState: "starting",
      status: "SERVER SE SPOUŠTÍ",
      message: "Čekám na potvrzení běžící herní instance.",
      retryVisible: false,
      reasonCode: "SERVER_STARTING"
    };
  }
  return {
    authorityState: "unavailable",
    status: lifecycleStatus ? "SERVER NENÍ SPUŠTĚNÝ" : "ČEKÁM NA STAV SERVERU",
    message: lifecycleStatus
      ? "Herní instance teď nepřijímá akce. Vrať se do lobby nebo obnov připojení."
      : "Server zatím neposlal ověřený lifecycle stav.",
    retryVisible: true,
    reasonCode: lifecycleStatus ? "SERVER_NOT_RUNNING" : "SERVER_STATUS_PENDING"
  };
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
