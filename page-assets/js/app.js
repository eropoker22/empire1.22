import { bindDesktopGameScrollLimit } from "./app/runtime/desktopScrollLimitRuntime.js";
import { bootstrapPage, PAGE_ROOT_SELECTOR } from "./app/render-ui.js?v=heat-audit-20260721";
import { loadLobbyOverview } from "./app/player-entry-client.js";
import { isExplicitGamePreviewEnabled } from "./app/local-demo-gate.js";
import {
  bindGameAuthorityGate,
  mountLiveGameplayClient,
  prepareLiveGameplayBootstrap,
  showLiveGameplayUnavailable
} from "./app/runtime/liveGameplayBootstrap.js";

async function resolveGameBootContext() {
  if (isExplicitGamePreviewEnabled()) return { kind: "preview" };
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
  bindGameAuthorityGate();
  if (context.kind === "unavailable") {
    showLiveGameplayUnavailable(context.error);
    return null;
  }
  if (context.kind === "preview") {
    const previewRuntime = bootstrapPage();
    bindDesktopGameScrollLimit();
    return previewRuntime;
  }
  const sliceRoot = prepareLiveGameplayBootstrap(context.membership);
  const runtime = bootstrapPage();
  document.body.classList.add("game-body--booting");
  bindDesktopGameScrollLimit();
  void mountLiveGameplayClient(sliceRoot).catch((error) => showLiveGameplayUnavailable(error));
  return runtime;
}

void resolveGameBootContext().then((context) => {
  if (context.kind === "redirect") return;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => bootGamePage(context), { once: true });
  } else if (document.querySelector(PAGE_ROOT_SELECTOR)) {
    bootGamePage(context);
  }
});
