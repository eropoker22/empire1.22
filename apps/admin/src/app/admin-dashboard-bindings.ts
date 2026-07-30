import {
  applyAdminServerFilters,
  DEFAULT_ADMIN_SERVER_FILTERS,
  updateAdminInstanceUrl,
  type AdminServerFilterState
} from "./admin-app-dom";

interface BindableController { bind(): void; }

export const createAdminDashboardBindings = (options: {
  target: () => HTMLElement | null;
  selectedInstanceId: () => string | null;
  selectInstance: (instanceId: string) => void;
  render: () => void;
  refresh: (includeAudit?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  dismissNotice: () => void;
  serverFilters: () => AdminServerFilterState;
  updateServerFilters: (next: Partial<AdminServerFilterState>) => void;
  mobileNavOpen: () => boolean;
  setMobileNavOpen: (open: boolean) => void;
  flushPendingRender: () => void;
  controllers: BindableController[];
}) => ({
  bind: (): void => {
    const target = options.target();
    target?.querySelectorAll<HTMLElement>("[data-admin-instance], [data-admin-mobile-instance]").forEach((link) => link.addEventListener("click", (event) => {
      event.preventDefault();
      const next = link.dataset.adminInstance?.trim() || link.dataset.adminMobileInstance?.trim() || null;
      if (!next || next === options.selectedInstanceId()) return;
      options.selectInstance(next);
      options.setMobileNavOpen(false);
      updateAdminInstanceUrl(next);
      options.render();
      void options.refresh();
    }));
    target?.querySelector<HTMLButtonElement>("[data-admin-refresh]")?.addEventListener("click", (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      if (!button.disabled) void options.refresh();
    });
    target?.querySelector<HTMLButtonElement>("[data-admin-audit-refresh]")?.addEventListener("click", (event) => {
      (event.currentTarget as HTMLButtonElement).disabled = true;
      void options.refresh(true);
    });
    target?.querySelector<HTMLElement>("[data-admin-logout]")?.addEventListener("click", () => void options.logout());
    target?.querySelector<HTMLElement>("[data-admin-notice-dismiss]")?.addEventListener("click", options.dismissNotice);
    const search = target?.querySelector<HTMLInputElement>("[data-admin-search]");
    search?.addEventListener("input", () => {
      options.updateServerFilters({ query: search.value });
      applyAdminServerFilters(target, options.serverFilters());
    });
    target?.querySelectorAll<HTMLSelectElement>("[data-admin-server-filter]").forEach((select) =>
      select.addEventListener("change", () => {
        const key = select.dataset.adminServerFilter as "status" | "mode" | "worker";
        options.updateServerFilters({ [key]: select.value });
        applyAdminServerFilters(target, options.serverFilters());
      }));
    target?.querySelectorAll<HTMLButtonElement>("[data-admin-server-scope]").forEach((button) =>
      button.addEventListener("click", () => {
        const visibility = button.dataset.adminServerScope as AdminServerFilterState["visibility"];
        if (visibility !== "active" && visibility !== "inactive") return;
        options.updateServerFilters({ visibility });
        target.querySelectorAll<HTMLButtonElement>("[data-admin-server-scope]").forEach((item) => {
          const selected = item === button;
          item.classList.toggle("is-active", selected);
          item.setAttribute("aria-selected", String(selected));
        });
        applyAdminServerFilters(target, options.serverFilters());
      }));
    target?.querySelector<HTMLButtonElement>("[data-admin-filter-reset]")?.addEventListener("click", () => {
      options.updateServerFilters(DEFAULT_ADMIN_SERVER_FILTERS);
      const filters = options.serverFilters();
      if (search) search.value = filters.query;
      target.querySelectorAll<HTMLSelectElement>("[data-admin-server-filter]").forEach((select) => {
        const key = select.dataset.adminServerFilter as "status" | "mode" | "worker";
        select.value = filters[key];
      });
      applyAdminServerFilters(target, filters);
    });
    search?.addEventListener("blur", () => queueMicrotask(options.flushPendingRender));
    const navItems = [...(target?.querySelectorAll<HTMLAnchorElement>(".admin-nav__item") ?? [])];
    const activateNavItem = (active: HTMLAnchorElement): void => navItems.forEach((item) => {
      const selected = item === active;
      item.classList.toggle("is-active", selected);
      if (selected) item.setAttribute("aria-current", "location");
      else item.removeAttribute("aria-current");
    });
    navItems.forEach((item) => item.addEventListener("click", () => {
      activateNavItem(item);
      options.setMobileNavOpen(false);
      const nav = target?.querySelector<HTMLElement>("#admin-primary-nav");
      const toggle = target?.querySelector<HTMLButtonElement>("[data-admin-nav-toggle]");
      if (nav) nav.dataset.open = "false";
      if (toggle) toggle.setAttribute("aria-expanded", "false");
      const destination = item.hash ? target?.querySelector<HTMLElement>(item.hash) : null;
      if (destination instanceof HTMLDetailsElement) destination.open = true;
    }));
    target?.querySelector<HTMLButtonElement>("[data-admin-nav-toggle]")?.addEventListener("click", (event) => {
      const open = !options.mobileNavOpen();
      options.setMobileNavOpen(open);
      (event.currentTarget as HTMLButtonElement).setAttribute("aria-expanded", String(open));
      const nav = target?.querySelector<HTMLElement>("#admin-primary-nav");
      if (nav) nav.dataset.open = String(open);
    });
    const hashItem = navItems.find((item) => item.hash === window.location.hash);
    const defaultItem = navItems.find((item) => item.hash === "#admin-overview");
    if (hashItem ?? defaultItem) activateNavItem((hashItem ?? defaultItem)!);
    options.controllers.forEach((controller) => controller.bind());
    target?.querySelectorAll<HTMLElement>("[data-admin-preserve-input]").forEach((input) =>
      input.addEventListener("blur", () => queueMicrotask(options.flushPendingRender)));
    applyAdminServerFilters(target, options.serverFilters());
  }
});
