import { bindDesktopGameScrollLimit } from "./app/runtime/desktopScrollLimitRuntime.js";
import { bootstrapPage, PAGE_ROOT_SELECTOR } from "./app/render-ui.js";
import { loadLobbyOverview } from "./app/player-entry-client.js";
import { isExplicitGamePreviewEnabled } from "./app/local-demo-gate.js";

async function canBootGame() {
  if (isExplicitGamePreviewEnabled()) return true;
  try {
    const overview = await loadLobbyOverview();
    const membership = overview.activeBlockingMembership;
    if (membership?.status === "active") return true;
    if (membership && ["setup_required", "finalizing_setup"].includes(membership.status)) {
      window.location.replace(`./faction.html?membership=${encodeURIComponent(membership.membershipId)}`);
      return false;
    }
    window.location.replace("./lobby.html");
    return false;
  } catch (error) {
    window.location.replace(error?.status === 401 ? "./login.html" : "./lobby.html");
    return false;
  }
}

function bootGamePage() {
  const runtime = bootstrapPage();
  bindDesktopGameScrollLimit();
  return runtime;
}

void canBootGame().then((shouldBootGame) => {
  if (shouldBootGame && document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootGamePage, { once: true });
  } else if (shouldBootGame && document.querySelector(PAGE_ROOT_SELECTOR)) {
    bootGamePage();
  }
});
