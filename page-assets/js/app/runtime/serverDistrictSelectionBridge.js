let activeCoordinator = null;

function disposeCoordinator(coordinator) {
  coordinator?.cancel?.();
  coordinator?.clearCache?.();
}

export function activateServerDistrictSelectionCoordinator(coordinator) {
  if (!coordinator || typeof coordinator.cacheReadModel !== "function") {
    return false;
  }
  if (activeCoordinator && activeCoordinator !== coordinator) {
    disposeCoordinator(activeCoordinator);
  }
  activeCoordinator = coordinator;
  return true;
}

export function cacheServerDistrictSelectionReadModel(readModel, renderState = null) {
  return activeCoordinator?.cacheReadModel?.(readModel, renderState) === true;
}

export function deactivateServerDistrictSelectionCoordinator(coordinator) {
  if (!coordinator || activeCoordinator !== coordinator) {
    return false;
  }
  disposeCoordinator(activeCoordinator);
  activeCoordinator = null;
  return true;
}
