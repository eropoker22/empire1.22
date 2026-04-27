import { createAdminDataProvider } from "./admin-data.js";
import { bindAdminActions } from "./admin-actions.js";
import { renderDashboard } from "./admin-render.js";
import { ensureAdminAccess } from "./admin-security.js";

const root = document.getElementById("admin-dashboard-root");
const provider = createAdminDataProvider();

if (root) {
  void bootstrapAdminDashboard(root);
}

async function bootstrapAdminDashboard(mount) {
  const data = await provider.fetchSnapshot();
  const state = {
    data,
    access: ensureAdminAccess(data),
    view: {
      section: "overview",
      mode: "all",
      server: "all",
      search: "",
      sortBy: "none",
      selectedPlayerId: data.players[0]?.id || null,
      modal: null,
      toasts: []
    }
  };

  const render = () => {
    mount.innerHTML = renderDashboard(state);
  };

  bindAdminActions(mount, state, render, provider);
  render();
}
