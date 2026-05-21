/**
 * Responsibility: Admin-only shell boundary for bootstrapping the admin application.
 * Belongs here: app mounting and top-level wiring only.
 * Does not belong here: gameplay logic or direct server state mutation.
 */
export interface AdminAppShell {
  mount(target?: HTMLElement | null): void | Promise<void>;
}

export const createAdminAppShell = (shell: AdminAppShell): AdminAppShell => shell;
