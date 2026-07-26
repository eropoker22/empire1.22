export function createServerAuthoritativePageLifecycle({
  windowRef = globalThis.window,
  onPageHide,
  onResume
} = {}) {
  let activeContext = null;
  let listening = false;
  let resumePending = false;
  let destroyed = false;

  const handlePageHide = (event) => {
    const persisted = event?.persisted === true;
    resumePending = persisted && Boolean(activeContext);
    onPageHide?.({
      context: activeContext,
      persisted
    });
    if (!persisted) {
      activeContext = null;
    }
  };

  const handlePageShow = (event) => {
    if (destroyed || event?.persisted !== true || !resumePending || !activeContext) {
      return;
    }
    resumePending = false;
    onResume?.(activeContext);
  };

  const listen = () => {
    if (listening || destroyed) {
      return;
    }
    listening = true;
    windowRef?.addEventListener?.("pagehide", handlePageHide);
    windowRef?.addEventListener?.("pageshow", handlePageShow);
  };

  return Object.freeze({
    destroy: () => {
      if (destroyed) {
        return false;
      }
      destroyed = true;
      activeContext = null;
      resumePending = false;
      if (listening) {
        windowRef?.removeEventListener?.("pagehide", handlePageHide);
        windowRef?.removeEventListener?.("pageshow", handlePageShow);
        listening = false;
      }
      return true;
    },
    isResumePending: () => resumePending,
    track: (context) => {
      if (destroyed || !context) {
        return false;
      }
      activeContext = context;
      listen();
      return true;
    }
  });
}
