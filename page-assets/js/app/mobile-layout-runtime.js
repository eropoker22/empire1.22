const MOBILE_MEDIA = "(max-width: 720px)";
const MOBILE_TOPBAR_GAP = 4;
const MOBILE_OVERLAY_SELECTOR = [
  ".modal",
  ".district-popup-shell",
  ".attack-setup-popup-shell",
  ".buildings-popup-shell",
  ".wanted-popup-shell",
  ".player-popup-shell",
  ".alliance-popup-shell",
  ".armory-popup-shell",
  ".pharmacy-popup-shell",
  ".druglab-popup-shell",
  ".factory-popup-shell",
  ".market-popup-shell",
  ".leaderboard-popup-shell",
  ".storage-popup-shell",
  ".district-building-detail-shell",
  ".avatar-lightbox",
  ".game-admin-slice-overlay"
].join(",");
const MOBILE_CLOSE_CONTROL_SELECTOR = [
  ".modal__close",
  ".district-popup-close",
  ".attack-setup-popup-close",
  ".wanted-popup-close",
  ".player-popup-close",
  ".market-popup-close",
  ".leaderboard-popup-close",
  ".storage-popup-close",
  ".building-tech-popup-close",
  ".avatar-lightbox__close",
  ".game-admin-slice-overlay__close"
].join(",");

function initMobileViewportLock(windowObj = window, documentObj = document) {
  const media = windowObj.matchMedia(MOBILE_MEDIA);
  const root = documentObj.documentElement;
  let lastWidth = windowObj.innerWidth;

  const apply = () => {
    if (!media.matches) {
      root.style.removeProperty("--mobile-locked-vh");
      return;
    }
    const viewportHeight = Math.max(
      0,
      Math.floor(windowObj.innerHeight || windowObj.visualViewport?.height || documentObj.documentElement.clientHeight || 0)
    );
    if (viewportHeight > 0) {
      root.style.setProperty("--mobile-locked-vh", `${viewportHeight}px`);
    }
    lastWidth = windowObj.innerWidth;
  };

  apply();
  windowObj.addEventListener("orientationchange", () => {
    windowObj.setTimeout(apply, 140);
  });
  windowObj.addEventListener("resize", () => {
    if (!media.matches) {
      apply();
      return;
    }
    const widthDelta = Math.abs(windowObj.innerWidth - lastWidth);
    if (widthDelta > 40) {
      apply();
    }
  });
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", apply);
  } else if (typeof media.addListener === "function") {
    media.addListener(apply);
  }
}

function initMobileTopbarState(windowObj = window, documentObj = document) {
  const media = windowObj.matchMedia(MOBILE_MEDIA);
  const topbar = documentObj.getElementById("game-header");
  const root = documentObj.documentElement;
  if (!topbar) return;

  let ticking = false;
  let offsetFrameId = null;

  const applyTopbarOffset = () => {
    offsetFrameId = null;
    if (!media.matches) {
      root.style.removeProperty("--mobile-topbar-offset");
      root.style.removeProperty("--mobile-overlay-top-offset");
      root.style.setProperty("--desktop-topbar-offset", `${Math.ceil(topbar.offsetHeight)}px`);
      return;
    }

    const topbarOffset = Math.ceil(topbar.getBoundingClientRect().height + MOBILE_TOPBAR_GAP);
    root.style.setProperty(
      "--mobile-topbar-offset",
      `${topbarOffset}px`
    );
    root.style.setProperty("--mobile-overlay-top-offset", `${topbarOffset}px`);
    root.style.removeProperty("--desktop-topbar-offset");
  };

  const requestTopbarOffset = () => {
    if (offsetFrameId !== null) return;
    offsetFrameId = windowObj.requestAnimationFrame(applyTopbarOffset);
  };

  const applyState = () => {
    ticking = false;
    documentObj.body.classList.toggle("is-mobile-topbar-condensed", media.matches);
    requestTopbarOffset();
  };

  const requestApply = () => {
    if (ticking) return;
    ticking = true;
    windowObj.requestAnimationFrame(applyState);
  };

  applyState();
  if (typeof windowObj.ResizeObserver === "function") {
    const observer = new windowObj.ResizeObserver(requestTopbarOffset);
    observer.observe(topbar);
  }
  windowObj.addEventListener("scroll", requestApply, { passive: true });
  windowObj.addEventListener("resize", requestApply);
  windowObj.visualViewport?.addEventListener?.("resize", requestApply);
  windowObj.visualViewport?.addEventListener?.("scroll", requestApply);
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", requestApply);
  } else if (typeof media.addListener === "function") {
    media.addListener(requestApply);
  }
}

function moveElementAfterAnchor(anchor, element) {
  if (!(anchor instanceof Element) || !(element instanceof Element)) {
    return;
  }

  if (element.parentElement === anchor.parentElement && element.previousElementSibling === anchor) {
    return;
  }

  anchor.insertAdjacentElement("afterend", element);
}

function initMobileBuildingShortcutsPlacement(documentObj = document) {
  const shortcuts = documentObj.getElementById("building-shortcut-grid");
  const homeAnchor = documentObj.getElementById("building-shortcuts-anchor");

  if (!shortcuts || !homeAnchor) {
    return;
  }
  moveElementAfterAnchor(homeAnchor, shortcuts);
}

function initMobileGangProfilePlacement(windowObj = window, documentObj = document) {
  const gangPanelMount = documentObj.getElementById("game-gang-panel-mount");
  const homeAnchor = documentObj.getElementById("game-gang-panel-anchor");
  const mobileAnchor = documentObj.getElementById("mobile-gang-panel-anchor");

  if (!gangPanelMount || !homeAnchor || !mobileAnchor) {
    return;
  }

  const media = windowObj.matchMedia(MOBILE_MEDIA);

  const applyPlacement = () => {
    if (media.matches) {
      moveElementAfterAnchor(mobileAnchor, gangPanelMount);
      return;
    }

    moveElementAfterAnchor(homeAnchor, gangPanelMount);
  };

  applyPlacement();
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", applyPlacement);
  } else if (typeof media.addListener === "function") {
    media.addListener(applyPlacement);
  }
  windowObj.addEventListener("resize", applyPlacement);
}

function initMobilePrimaryActionCardsPlacement(documentObj = document) {
  const cityEventsCard = documentObj.getElementById("city-events-card");
  const buildingsCard = documentObj.getElementById("buildings-card");
  const marketCard = documentObj.getElementById("market-card");
  const cityEventsAnchor = documentObj.getElementById("city-events-card-anchor");
  const buildingsAnchor = documentObj.getElementById("buildings-card-anchor");
  const marketAnchor = documentObj.getElementById("market-card-anchor");

  if (
    !cityEventsCard
    || !buildingsCard
    || !marketCard
    || !cityEventsAnchor
    || !buildingsAnchor
    || !marketAnchor
  ) {
    return;
  }

  const applyPlacement = () => {
    moveElementAfterAnchor(cityEventsAnchor, cityEventsCard);
    moveElementAfterAnchor(buildingsAnchor, buildingsCard);
    moveElementAfterAnchor(marketAnchor, marketCard);
  };

  applyPlacement();
}

function initMobileLeaderboardPlacement(windowObj = window, documentObj = document) {
  const leaderboardCard = documentObj.getElementById("leaderboard-card");
  const leaderboardAnchor = documentObj.getElementById("leaderboard-card-anchor");
  const streetNewsAnchor = documentObj.getElementById("mobile-alliance-card-anchor");
  const globalChatCard = documentObj.getElementById("global-chat-card");
  const globalChatAnchor = documentObj.getElementById("global-chat-card-anchor");
  const allianceChatCard = documentObj.getElementById("alliance-chat-card");
  const allianceChatAnchor = documentObj.getElementById("alliance-chat-card-anchor");
  const leaderboardLaunchRow = leaderboardCard?.closest(".leaderboard-launch-row");

  if (
    !leaderboardCard
    || !leaderboardAnchor
    || !globalChatCard
    || !globalChatAnchor
    || !allianceChatAnchor
  ) {
    return;
  }

  const media = windowObj.matchMedia(MOBILE_MEDIA);

  const applyPlacement = () => {
    const leaderboardBlock = leaderboardLaunchRow || leaderboardCard;

    if (media.matches) {
      if (allianceChatCard) {
        if (streetNewsAnchor) {
          moveElementAfterAnchor(streetNewsAnchor, allianceChatCard);
        }
        moveElementAfterAnchor(allianceChatCard, globalChatCard);
        moveElementAfterAnchor(globalChatCard, leaderboardBlock);
        return;
      }
      moveElementAfterAnchor(globalChatCard, leaderboardBlock);
      return;
    }

    if (allianceChatCard) {
      moveElementAfterAnchor(allianceChatAnchor, allianceChatCard);
    }
    moveElementAfterAnchor(globalChatAnchor, globalChatCard);
    moveElementAfterAnchor(leaderboardAnchor, leaderboardBlock);
  };

  applyPlacement();
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", applyPlacement);
  } else if (typeof media.addListener === "function") {
    media.addListener(applyPlacement);
  }
  windowObj.addEventListener("resize", applyPlacement);
}

function initMobileOverlayScrollLock(windowObj = window, documentObj = document) {
  const media = windowObj.matchMedia(MOBILE_MEDIA);
  const root = documentObj.documentElement;
  let frameId = null;
  let lockedScrollY = null;

  const getScrollY = () => Math.max(
    0,
    Math.floor(windowObj.scrollY || windowObj.pageYOffset || root.scrollTop || documentObj.body.scrollTop || getLockedBodyScrollY() || 0)
  );
  const getLockedBodyScrollY = () => {
    const lockedTop = Number.parseFloat(documentObj.body.style.top || "");
    return documentObj.body.style.position === "fixed" && Number.isFinite(lockedTop) && lockedTop < 0
      ? Math.abs(lockedTop)
      : 0;
  };
  let lastKnownScrollY = getScrollY();

  const restorePageScroll = (nextScrollY) => {
    root.scrollTop = nextScrollY;
    documentObj.body.scrollTop = nextScrollY;
    if (typeof windowObj.scrollTo !== "function") {
      return;
    }
    try {
      windowObj.scrollTo({ top: nextScrollY, left: 0, behavior: "instant" });
    } catch {
      windowObj.scrollTo(0, nextScrollY);
    }
    if (Math.abs(getScrollY() - nextScrollY) > 1) {
      try {
        windowObj.scrollTo(0, nextScrollY);
      } catch {
        // Older embedded browsers can reject scrollTo while layout is settling.
      }
    }
  };

  const lockPageScroll = () => {
    if (lockedScrollY !== null) {
      return;
    }

    const currentScrollY = getScrollY();
    lockedScrollY = currentScrollY > 0 || lastKnownScrollY <= 0 ? currentScrollY : lastKnownScrollY;
    lastKnownScrollY = lockedScrollY;
    documentObj.body.style.position = "fixed";
    documentObj.body.style.top = `-${lockedScrollY}px`;
    documentObj.body.style.left = "0";
    documentObj.body.style.right = "0";
    documentObj.body.style.width = "100%";
  };

  const unlockPageScroll = () => {
    if (lockedScrollY === null) {
      return;
    }

    const nextScrollY = lockedScrollY;
    lockedScrollY = null;
    lastKnownScrollY = nextScrollY;
    const restoreScrollPosition = () => {
      restorePageScroll(nextScrollY);
    };
    documentObj.body.style.removeProperty("position");
    documentObj.body.style.removeProperty("top");
    documentObj.body.style.removeProperty("left");
    documentObj.body.style.removeProperty("right");
    documentObj.body.style.removeProperty("width");
    restoreScrollPosition();
    windowObj.requestAnimationFrame(restoreScrollPosition);
    windowObj.requestAnimationFrame(() => windowObj.requestAnimationFrame(restoreScrollPosition));
    windowObj.setTimeout(restoreScrollPosition, 80);
    windowObj.setTimeout(restoreScrollPosition, 180);
  };

  const rememberScrollY = () => {
    if (lockedScrollY === null) {
      lastKnownScrollY = getScrollY();
    }
  };

  const isOpenOverlay = (element) => {
    if (!(element instanceof windowObj.HTMLElement)) {
      return false;
    }
    if (element.hidden || element.classList.contains("hidden") || element.getAttribute("aria-hidden") === "true") {
      return false;
    }
    const style = windowObj.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  };

  const applyLock = () => {
    frameId = null;
    if (!media.matches) {
      unlockPageScroll();
      root.classList.remove("game-modal-scroll-locked");
      documentObj.body.classList.remove("game-modal-scroll-locked");
      return;
    }

    const openOverlays = Array.from(documentObj.querySelectorAll(MOBILE_OVERLAY_SELECTOR)).filter(isOpenOverlay);
    const hasOpenOverlay = openOverlays.length > 0;
    const shouldFreezeBody = hasOpenOverlay;

    if (shouldFreezeBody) {
      lockPageScroll();
    } else {
      unlockPageScroll();
    }

    root.classList.toggle("game-modal-scroll-locked", hasOpenOverlay);
    documentObj.body.classList.toggle("game-modal-scroll-locked", hasOpenOverlay);
  };

  const requestApply = () => {
    if (frameId !== null) {
      return;
    }
    frameId = windowObj.requestAnimationFrame(applyLock);
  };

  const shouldRefreshForMutation = (mutation) => {
    const target = mutation.target;
    if (!(target instanceof windowObj.Element)) {
      return false;
    }
    if (target.matches(MOBILE_OVERLAY_SELECTOR)) {
      return true;
    }
    return Boolean(target.closest(MOBILE_OVERLAY_SELECTOR));
  };

  applyLock();
  if (typeof windowObj.MutationObserver === "function") {
    const observer = new windowObj.MutationObserver((mutations) => {
      if (mutations.some(shouldRefreshForMutation)) {
        requestApply();
      }
    });
    observer.observe(documentObj.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "style", "aria-hidden"]
    });
  }
  windowObj.addEventListener("scroll", rememberScrollY, { passive: true });
  windowObj.addEventListener("resize", requestApply);
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", requestApply);
  } else if (typeof media.addListener === "function") {
    media.addListener(requestApply);
  }
}

function initMobileCloseTapAssist(windowObj = window, documentObj = document) {
  const media = windowObj.matchMedia(MOBILE_MEDIA);
  let activeControl = null;
  let startX = 0;
  let startY = 0;

  const getCloseControl = (target) => {
    if (!media.matches || !(target instanceof windowObj.Element)) {
      return null;
    }

    const control = target.closest(MOBILE_CLOSE_CONTROL_SELECTOR);
    if (!(control instanceof windowObj.HTMLButtonElement) || control.disabled) {
      return null;
    }

    return control;
  };

  documentObj.addEventListener("pointerdown", (event) => {
    const control = getCloseControl(event.target);

    if (!control) {
      activeControl = null;
      return;
    }

    activeControl = control;
    startX = event.clientX;
    startY = event.clientY;
  }, true);

  documentObj.addEventListener("pointerup", (event) => {
    const control = activeControl;
    activeControl = null;

    if (!control) {
      return;
    }

    const deltaX = Math.abs(event.clientX - startX);
    const deltaY = Math.abs(event.clientY - startY);

    if (deltaX > 18 || deltaY > 18) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    control.click();
  }, true);

  documentObj.addEventListener("pointercancel", () => {
    activeControl = null;
  }, true);
}

function initMobileLayoutRuntime() {
  initMobileViewportLock();
  initMobileTopbarState();
  initMobileBuildingShortcutsPlacement();
  initMobileGangProfilePlacement();
  initMobilePrimaryActionCardsPlacement();
  initMobileLeaderboardPlacement();
  initMobileOverlayScrollLock();
  initMobileCloseTapAssist();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMobileLayoutRuntime, { once: true });
} else {
  initMobileLayoutRuntime();
}
