const DESKTOP_MEDIA = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";
const DEFAULT_BOTTOM_LIMIT_PX = 250;

export function bindDesktopGameScrollLimit(documentObj = document, windowObj = window, options = {}) {
  const limitPx = Math.max(0, Number(options.limitPx ?? DEFAULT_BOTTOM_LIMIT_PX));
  const anchorSelector = options.anchorSelector ?? "#game-command-bar-mount";
  const media = windowObj.matchMedia?.(DESKTOP_MEDIA);

  if (!media) {
    return null;
  }

  let frameId = null;

  const getViewportHeight = () =>
    Math.max(1, Number(windowObj.innerHeight || documentObj.documentElement.clientHeight || 0));

  const getScrollY = () =>
    Math.max(
      0,
      Math.floor(
        Number(
          windowObj.scrollY
            || windowObj.pageYOffset
            || documentObj.documentElement.scrollTop
            || documentObj.body.scrollTop
            || 0
        )
      )
    );

  const resolveMaxScrollY = () => {
    const anchor = documentObj.querySelector(anchorSelector);

    if (!anchor) {
      return null;
    }

    const anchorBottom = anchor.getBoundingClientRect().bottom + getScrollY();
    return Math.max(0, Math.floor(anchorBottom + limitPx - getViewportHeight()));
  };

  const applyLimit = () => {
    frameId = null;

    if (!media.matches || documentObj.body.classList.contains("game-modal-scroll-locked")) {
      return;
    }

    const maxScrollY = resolveMaxScrollY();

    if (maxScrollY === null) {
      return;
    }

    const currentScrollY = getScrollY();

    if (currentScrollY > maxScrollY) {
      windowObj.scrollTo({ top: maxScrollY, left: 0, behavior: "instant" });
    }
  };

  const requestApplyLimit = () => {
    if (frameId !== null) {
      return;
    }

    frameId = windowObj.requestAnimationFrame(applyLimit);
  };

  windowObj.addEventListener("scroll", requestApplyLimit, { passive: true });
  windowObj.addEventListener("resize", requestApplyLimit);
  windowObj.visualViewport?.addEventListener?.("resize", requestApplyLimit);

  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", requestApplyLimit);
  } else if (typeof media.addListener === "function") {
    media.addListener(requestApplyLimit);
  }

  requestApplyLimit();

  return {
    apply: requestApplyLimit,
    destroy: () => {
      if (frameId !== null) {
        windowObj.cancelAnimationFrame(frameId);
        frameId = null;
      }
      windowObj.removeEventListener("scroll", requestApplyLimit);
      windowObj.removeEventListener("resize", requestApplyLimit);
      windowObj.visualViewport?.removeEventListener?.("resize", requestApplyLimit);
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", requestApplyLimit);
      } else if (typeof media.removeListener === "function") {
        media.removeListener(requestApplyLimit);
      }
    }
  };
}
