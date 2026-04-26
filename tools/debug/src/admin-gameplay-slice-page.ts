import {
  createClientSurfaceActionRouter,
  type ClientRenderState
} from "../../../apps/client/src/app";
import { refreshLiveCooldownLabels } from "../../../apps/client/src/shared-ui";
import { createAdminGameplaySliceDemo } from "./admin-gameplay-slice-demo";

export interface GameplaySliceSurfaceMounts {
  toolbarMount: HTMLElement;
  navigationMount: HTMLElement;
  filterMount: HTMLElement;
  contentMount: HTMLElement;
  modalRoot: HTMLElement;
  noticeRoot: HTMLElement;
}

export interface MountedGameplaySliceSurface {
  destroy(): void;
}

export interface GameplaySliceSurfaceApi {
  mount(mounts: GameplaySliceSurfaceMounts): MountedGameplaySliceSurface;
  autoMountAdminPage(): MountedGameplaySliceSurface | null;
}

declare global {
  interface Window {
    EmpireAdminSliceDemo?: GameplaySliceSurfaceApi;
  }
}

const createGameplaySliceSurfaceApi = (): GameplaySliceSurfaceApi => ({
  mount: (mounts) => mountGameplaySliceSurface(mounts),
  autoMountAdminPage: () => {
    const mounts = getAdminPageMounts();
    return mounts ? mountGameplaySliceSurface(mounts) : null;
  }
});

const mountGameplaySliceSurface = (
  mounts: GameplaySliceSurfaceMounts
): MountedGameplaySliceSurface => {
  const demo = createAdminGameplaySliceDemo();
  const actionRouter = createClientSurfaceActionRouter({
    client: demo.getClientShell(),
    createCommandId: (prefix) => demo.createCommandId(prefix)
  });

  const renderState = (state: ClientRenderState): void => {
    mounts.toolbarMount.innerHTML = [
      "<div class=\"slice-demo-toolbar\">",
      state.topBarHtml,
      `<div class="slice-demo-connection">Connection: ${state.connection.status}</div>`,
      `<button type="button" data-demo-reset="true">Reload slice</button>`,
      "</div>"
    ].join("");

    mounts.navigationMount.innerHTML = [
      "<h3 class=\"placeholder-title\">Gameplay slice bridge</h3>",
      "<p class=\"panel-note\">Tenhle panel čte session hry, bootstrapuje nový slice a dál běží přes `apps/server` a `packages/game-core` bez klientské gameplay autority.</p>",
      "<ul class=\"slice-demo-list\">",
      "<li>klik na district přepíná server-fed panel</li>",
      "<li>pevné budovy, speciální akce, spy, trap a attack jdou přes client command router</li>",
      "<li>reports panel je čistě server-fed projection</li>",
      "<li>render je čistě z aktuálního read modelu</li>",
      "</ul>"
    ].join("");

    mounts.filterMount.innerHTML = [
      "<h3 class=\"placeholder-title\">Current selection</h3>",
      state.districtPanel
        ? `<p class="panel-note">District: <strong>${state.districtPanel.title}</strong></p>`
        : "<p class=\"panel-note\">No district selected.</p>",
      `<p class="panel-note">Player: <strong>${state.player?.playerId ?? "n/a"}</strong></p>`,
      `<p class="panel-note">Visible districts: <strong>${state.mapDistricts.length}</strong></p>`
    ].join("");

    mounts.contentMount.innerHTML = [
      "<div class=\"slice-demo-grid\">",
      "<section class=\"slice-demo-surface\">",
      "<h3 class=\"placeholder-title\">District map/list</h3>",
      state.mapHtml,
      "</section>",
      "<section class=\"slice-demo-surface\">",
      "<h3 class=\"placeholder-title\">District panel</h3>",
      state.sidePanelHtml || "<p class=\"panel-note\">No district panel available.</p>",
      "</section>",
      "</div>",
      state.errors.length > 0
        ? `<section class="slice-demo-errors"><h3 class="placeholder-title">Errors</h3>${state.errors
            .map((error) => `<p>${error.message}</p>`)
            .join("")}</section>`
        : ""
    ].join("");

    mounts.modalRoot.innerHTML = [
      "<span class=\"placeholder-label\">Overlay root</span>",
      "<h3 class=\"placeholder-title\">Command trace</h3>",
      `<p class="panel-note">Pending commands: ${state.districtPanel ? "interactive" : "idle"}</p>`
    ].join("");

    mounts.noticeRoot.innerHTML = [
      "<span class=\"placeholder-label\">Overlay root</span>",
      "<h3 class=\"placeholder-title\">Run mode</h3>",
      "<p class=\"panel-note\">Direct embedded gameplay slice panel with live session bootstrap.</p>"
    ].join("");

    refreshCooldownLabels();
  };

  const onClick = async (event: Event): Promise<void> => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const resetButton = target.closest<HTMLButtonElement>("button[data-demo-reset]");
    if (resetButton) {
      renderState(await demo.reset());
      return;
    }

    const nextState = await actionRouter.handleTarget(target);

    if (nextState) {
      renderState(nextState);
    }
  };

  const roots = [
    mounts.toolbarMount,
    mounts.navigationMount,
    mounts.filterMount,
    mounts.contentMount,
    mounts.modalRoot,
    mounts.noticeRoot
  ];
  const clickListener = (event: Event) => {
    void onClick(event);
  };
  const refreshCooldownLabels = () => {
    roots.forEach((root) => refreshLiveCooldownLabels(root));
  };
  const cooldownTimerId = window.setInterval(refreshCooldownLabels, 1000);

  roots.forEach((root) => root.addEventListener("click", clickListener));
  void demo.load().then(renderState);

  return {
    destroy: () => {
      window.clearInterval(cooldownTimerId);
      roots.forEach((root) => root.removeEventListener("click", clickListener));
      roots.forEach((root) => {
        root.innerHTML = "";
      });
    }
  };
};

const getAdminPageMounts = (): GameplaySliceSurfaceMounts | null => {
  const toolbarMount = document.querySelector<HTMLElement>("#admin-toolbar-mount");
  const navigationMount = document.querySelector<HTMLElement>("#admin-nav-mount");
  const filterMount = document.querySelector<HTMLElement>("#admin-filter-mount");
  const contentMount = document.querySelector<HTMLElement>("#admin-content-mount");
  const modalRoot = document.querySelector<HTMLElement>("#admin-modal-root");
  const noticeRoot = document.querySelector<HTMLElement>("#admin-notice-root");

  return toolbarMount &&
    navigationMount &&
    filterMount &&
    contentMount &&
    modalRoot &&
    noticeRoot
    ? {
        toolbarMount,
        navigationMount,
        filterMount,
        contentMount,
        modalRoot,
        noticeRoot
      }
    : null;
};

window.EmpireAdminSliceDemo = createGameplaySliceSurfaceApi();
window.EmpireAdminSliceDemo.autoMountAdminPage();
