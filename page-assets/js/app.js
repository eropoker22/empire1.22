import { bindDesktopGameScrollLimit } from "./app/runtime/desktopScrollLimitRuntime.js";
import {
  bootstrapPage,
  destroyRuntime,
  PAGE_ROOT_SELECTOR
} from "./app/runtime.js?v=ui-refresh-20260805-2";
import { loadLobbyOverview } from "./app/player-entry-client.js";
import {
  bindGameAuthorityGate,
  mountLiveGameplayClient,
  prepareLiveGameplayBootstrap,
  showLiveGameplayUnavailable
} from "./app/runtime/liveGameplayBootstrap.js";

let activeRuntime = null;
let authorityGateBound = false;
let desktopScrollController = null;
let activeBootContext = null;

async function resolveGameBootContext() {
  try {
    const overview = await loadLobbyOverview();
    const membership = overview.activeBlockingMembership;
    if (membership?.status === "active") return { kind: "membership", membership };
    if (membership && ["setup_required", "finalizing_setup"].includes(membership.status)) {
      window.location.replace(`./faction.html?membership=${encodeURIComponent(membership.membershipId)}`);
      return { kind: "redirect" };
    }
    window.location.replace("./lobby.html");
    return { kind: "redirect" };
  } catch (error) {
    if (error?.status === 401) {
      window.location.replace("./login.html");
      return { kind: "redirect" };
    }
    return { kind: "unavailable", error };
  }
}

function bootGamePage(context) {
  if (!authorityGateBound) {
    authorityGateBound = true;
    bindGameAuthorityGate();
  }
  if (context.kind === "unavailable") {
    showLiveGameplayUnavailable(context.error);
    return null;
  }
  if (activeRuntime) {
    return activeRuntime;
  }
  activeBootContext = context;
  const sliceRoot = prepareLiveGameplayBootstrap(context.membership);
  const runtime = bootstrapPage();
  activeRuntime = runtime;
  document.body.classList.add("game-body--booting");
  desktopScrollController?.destroy?.();
  desktopScrollController = bindDesktopGameScrollLimit();
  void mountLiveGameplayClient(sliceRoot).catch((error) => showLiveGameplayUnavailable(error));
  return runtime;
}

function destroyGamePage() {
  const root = activeRuntime?.root || document.querySelector(PAGE_ROOT_SELECTOR);
  activeRuntime = null;
  desktopScrollController?.destroy?.();
  desktopScrollController = null;
  return root ? destroyRuntime(root) : false;
}

window.addEventListener("pagehide", () => {
  destroyGamePage();
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted === true && activeBootContext && !activeRuntime) {
    bootGamePage(activeBootContext);
  }
});

void resolveGameBootContext().then((context) => {
  if (context.kind === "redirect") return;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => bootGamePage(context), { once: true });
  } else if (document.querySelector(PAGE_ROOT_SELECTOR)) {
    bootGamePage(context);
  }
});
