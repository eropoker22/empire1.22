export const createGameplaySliceSelectiveRenderer = () => {
  let hasRendered = false;

  return {
    render(
      mounts: Record<"status" | "topBar" | "map" | "panel", HTMLElement>,
      html: readonly [string, string, string, string],
      reason: string
    ): void {
      const updatedMountCount = [mounts.status, mounts.topBar, mounts.map, mounts.panel]
        .filter((mount, index) => {
          if (mount.innerHTML === html[index]) return false;
          mount.innerHTML = html[index];
          return true;
        })
        .length;
      if (!hasRendered) {
        window.empireStreetsRuntimeDiagnostics?.recordFullUiRender?.(reason);
        hasRendered = true;
      } else if (updatedMountCount > 0) {
        window.empireStreetsRuntimeDiagnostics?.recordSelectiveUiUpdate?.(reason, updatedMountCount);
      }
    }
  };
};
