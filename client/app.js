window.Empire = window.Empire || {};
const runtimeConfig = window.Empire?.RuntimeConfig || null;
const empireStorage = window.Empire?.Storage || null;
Object.assign(window.Empire, {
  token: null,
  player: null,
  districts: [],
  selectedDistrict: null,
  mode: window.Empire?.mode || "war"
});

document.addEventListener("DOMContentLoaded", () => {
  const token = empireStorage?.getItem("token");
  if (token) {
    window.Empire.token = token;
  }

  window.Empire.UI.init();
  window.Empire.UI.initProfileModal();
  window.Empire.UI.initSettingsModal();
  window.Empire.Map.init();
  window.Empire.API.init();
  window.Empire.WS.init();

  if (token) {
    window.Empire.UI.hydrateAfterAuth();
    window.Empire.UI.setGuestMode(false);
  } else {
    window.Empire.UI.setGuestMode(true);
    const guestUsername = String(empireStorage?.getItem("guestUsername") || "").trim();
    const guestGangName = String(empireStorage?.getItem("gangName") || "").trim();
    window.Empire.UI.updateProfile({
      username: guestUsername || "Host",
      gangName: guestGangName || "Guest Crew",
      structure: empireStorage?.getItem("structure") || "-",
      alliance: "Žádná",
      districts: 0,
      influence: 0
    });
    window.Empire.UI.bootstrapGuestIndexMapView?.();
  }

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const cityEventsBtn = target.closest("#city-events-open");
    if (cityEventsBtn) {
      event.preventDefault();
      const eventsModal = document.getElementById("events-modal");
      if (eventsModal) {
        eventsModal.classList.remove("hidden");
        eventsModal.classList.add("events-modal--compact");
      }
      return;
    }
    const cityEventsClose = target.closest("#events-modal-close, #events-modal-backdrop");
    if (cityEventsClose) {
      event.preventDefault();
      const eventsModal = document.getElementById("events-modal");
      if (eventsModal) eventsModal.classList.add("hidden");
      return;
    }
    const marketBtn = target.closest("#market-open");
    if (!marketBtn) return;
    event.preventDefault();
    await window.Empire.UI.openMarketModal("server");
  });
});
