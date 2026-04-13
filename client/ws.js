window.Empire = window.Empire || {};

window.Empire.WS = (() => {
  let socket = null;

  function init() {
    // Connect later after login
  }

  function connect() {
    if (!window.Empire.token) return;
    const url = `ws://localhost:3000?token=${window.Empire.token}&mode=${encodeURIComponent(window.Empire.mode || "war")}`;
    socket = new WebSocket(url);

    socket.addEventListener("open", () => {
      subscribeMap();
      subscribeMarket();
    });

    socket.addEventListener("message", (event) => {
      let payload = null;
      try {
        payload = JSON.parse(event.data);
      } catch (err) {
        return;
      }

      if (payload.type === "map:update") {
        window.Empire.Map.applyUpdate(payload.data);
      }
      if (payload.type === "market:update" && window.Empire.UI.handleMarketUpdate) {
        window.Empire.UI.handleMarketUpdate(payload.data);
      }
    });
  }

  function subscribeMap() {
    if (socket && socket.readyState === 1) {
      socket.send(JSON.stringify({ type: "map:subscribe", mode: window.Empire.mode || "war" }));
    }
  }

  function subscribeMarket() {
    if (socket && socket.readyState === 1) {
      socket.send(JSON.stringify({ type: "market:subscribe", mode: window.Empire.mode || "war" }));
    }
  }

  return { init, connect };
})();
