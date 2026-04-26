const MOBILE_MEDIA = "(max-width: 720px)";
const CONDENSE_SCROLL_Y = 44;
const EXPAND_SCROLL_Y = 18;
const MOBILE_TOPBAR_GAP = 12;

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
  if (!topbar) return;

  let ticking = false;
  let condensed = false;

  const applyState = () => {
    ticking = false;
    if (media.matches) {
      const scrollY = Math.max(0, windowObj.scrollY || 0);
      if (!condensed && scrollY > CONDENSE_SCROLL_Y) {
        condensed = true;
      } else if (condensed && scrollY < EXPAND_SCROLL_Y) {
        condensed = false;
      }
    } else {
      condensed = false;
    }

    documentObj.body.classList.toggle("is-mobile-topbar-condensed", condensed && media.matches);

    if (media.matches) {
      documentObj.documentElement.style.setProperty(
        "--mobile-topbar-offset",
        `${Math.ceil(topbar.offsetHeight + MOBILE_TOPBAR_GAP)}px`
      );
      documentObj.documentElement.style.removeProperty("--desktop-topbar-offset");
      return;
    }

    documentObj.documentElement.style.removeProperty("--mobile-topbar-offset");
    documentObj.documentElement.style.setProperty("--desktop-topbar-offset", `${Math.ceil(topbar.offsetHeight)}px`);
  };

  const requestApply = () => {
    if (ticking) return;
    ticking = true;
    windowObj.requestAnimationFrame(applyState);
  };

  applyState();
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

  const restoreToLeftRail = () => {
    moveElementAfterAnchor(cityEventsAnchor, cityEventsCard);
    moveElementAfterAnchor(buildingsAnchor, buildingsCard);
    moveElementAfterAnchor(marketAnchor, marketCard);
  };
  restoreToLeftRail();
}

function initMobileLeaderboardPlacement(documentObj = document) {
  const leaderboardCard = documentObj.getElementById("leaderboard-card");
  const leaderboardAnchor = documentObj.getElementById("leaderboard-card-anchor");

  if (!leaderboardCard || !leaderboardAnchor) {
    return;
  }
  moveElementAfterAnchor(leaderboardAnchor, leaderboardCard);
}

function initMobileLayoutRuntime() {
  initMobileViewportLock();
  initMobileTopbarState();
  initMobileBuildingShortcutsPlacement();
  initMobileGangProfilePlacement();
  initMobilePrimaryActionCardsPlacement();
  initMobileLeaderboardPlacement();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMobileLayoutRuntime, { once: true });
} else {
  initMobileLayoutRuntime();
}
