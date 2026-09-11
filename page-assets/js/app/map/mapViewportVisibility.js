// Rendering visibility only. Server state, polling and mission clocks keep running.
export function observeMapViewportVisibility({ element, windowRef, documentRef, onChange }) {
  let intersecting = true;
  let destroyed = false;
  let observer = null;
  const refresh = () => {
    return !destroyed && onChange(intersecting && !documentRef?.hidden);
  };
  const Observer = windowRef?.IntersectionObserver;
  if (element && typeof Observer === "function") {
    observer = new Observer((entries) => {
      if (destroyed) return;
      for (const entry of entries) {
        if (entry.target === element) intersecting = entry.isIntersecting;
      }
      refresh();
    }, { threshold: 0 });
    observer.observe(element);
  }
  documentRef?.addEventListener?.("visibilitychange", refresh);
  refresh();
  return {
    destroy() {
      destroyed = true;
      observer?.disconnect();
      documentRef?.removeEventListener?.("visibilitychange", refresh);
    }
  };
}
