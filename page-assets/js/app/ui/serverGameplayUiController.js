import { createServerGameplayMarketController } from "./serverGameplayMarketController.js";
import { createServerGameplayBuildingShortcutController } from "./serverGameplayBuildingShortcutController.js";
import { createServerGameplayDistrictController } from "./serverGameplayDistrictController.js";
import { createServerGameplayLeaderboardController } from "./serverGameplayLeaderboardController.js";
import { createServerGameplayLobbyController } from "./serverGameplayLobbyController.js";
import { createServerGameplayProfileController } from "./serverGameplayProfileController.js";
import { createServerGameplayReportController } from "./serverGameplayReportController.js";
import { createServerGameplayResourceController } from "./serverGameplayResourceController.js";
import { createServerGameplaySettingsController } from "./serverGameplaySettingsController.js";
import { createServerGameplayStatusController } from "./serverGameplayStatusController.js";
import { createServerGameplayStorageController } from "./serverGameplayStorageController.js";
import { createServerGameplayWantedPoliceController } from "./serverGameplayWantedPoliceController.js";
import { createServerDefeatNoticeController } from "./serverDefeatNoticeController.js?v=20260726-preview-removed";

export function createServerGameplayUiController({
  root,
  source,
  manageSourceSubscription = true,
  managePageLifecycle = true,
  documentRef = root?.ownerDocument || globalThis.document,
  windowRef = documentRef?.defaultView || globalThis.window
} = {}) {
  if (
    !source
    || typeof source.getCurrentReadModel !== "function"
    || typeof source.subscribe !== "function"
  ) {
    throw new TypeError("Server gameplay UI requires a presentation source.");
  }

  const districtController = createServerGameplayDistrictController({
    root,
    source,
    documentRef
  });
  const controllers = [
    createServerDefeatNoticeController({ documentRef, windowRef }),
    createServerGameplayResourceController({ root, documentRef }),
    createServerGameplayStatusController({ root, documentRef }),
    createServerGameplayProfileController({ root, documentRef }),
    createServerGameplayWantedPoliceController({
      root,
      source,
      documentRef,
      onReadModel: (readModel) => update(readModel)
    }),
    createServerGameplayStorageController({ root, documentRef }),
    createServerGameplayReportController({ root, documentRef }),
    districtController,
    createServerGameplayBuildingShortcutController({
      root,
      source,
      districtController
    }),
    createServerGameplayMarketController({
      root,
      source,
      documentRef,
      windowRef,
      onReadModel: (readModel) => update(readModel)
    }),
    createServerGameplaySettingsController({
      root,
      documentRef,
      windowRef,
      managePageLifecycle: false
    }),
    createServerGameplayLobbyController({
      root,
      source,
      documentRef,
      windowRef,
      manageSourceSubscription: false,
      managePageLifecycle: false
    }),
    createServerGameplayLeaderboardController({
      root,
      source,
      documentRef,
      windowRef,
      manageSourceSubscription: false,
      managePageLifecycle: false
    })
  ];
  let mounted = false;
  let unsubscribe = null;
  let latestReadModel = null;
  const diagnostics = {
    updates: 0,
    selectiveDomWrites: 0
  };

  function update(readModel, reason = "state-change") {
    latestReadModel = readModel || null;
    if (!mounted || !latestReadModel) return 0;
    diagnostics.updates += 1;
    const writes = controllers.reduce(
      (total, controller) => total + Number(controller.update(latestReadModel) || 0),
      0
    );
    diagnostics.selectiveDomWrites += writes;
    const performanceDiagnostics = windowRef?.empireStreetsRuntimeDiagnostics;
    if (diagnostics.updates === 1) {
      performanceDiagnostics?.recordFullUiRender?.(reason);
    } else if (writes > 0) {
      performanceDiagnostics?.recordSelectiveUiUpdate?.(reason, writes);
    }
    return writes;
  }
  const onSourceReadModel = (readModel) => update(readModel);
  const onPageHide = () => destroy();

  const mount = () => {
    if (mounted) return false;
    mounted = true;
    for (const controller of controllers) controller.mount();
    if (managePageLifecycle) {
      windowRef?.addEventListener?.("pagehide", onPageHide);
    }
    if (manageSourceSubscription) {
      const cleanup = source.subscribe(onSourceReadModel);
      unsubscribe = typeof cleanup === "function" ? cleanup : null;
      update(source.getCurrentReadModel());
    }
    return true;
  };

  const destroy = () => {
    if (!mounted) return false;
    mounted = false;
    unsubscribe?.();
    unsubscribe = null;
    if (managePageLifecycle) {
      windowRef?.removeEventListener?.("pagehide", onPageHide);
    }
    for (const controller of [...controllers].reverse()) controller.destroy();
    latestReadModel = null;
    return true;
  };

  return {
    mount,
    update,
    destroy,
    handleDistrictSelected: (selection) => districtController.handleDistrictSelected(selection),
    getDiagnostics: () => ({
      ...diagnostics,
      mounted,
      controllers: controllers.map((controller) => controller.getDiagnostics())
    })
  };
}
