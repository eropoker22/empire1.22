import { adminLoginErrorMessage } from "./admin-login-error-messages";
import type { AdminApiClient } from "./admin-monitoring-client";
import type { AdminSessionView } from "@empire/shared-types";

export const createAdminLoginController = (options: {
  client: AdminApiClient;
  target: () => HTMLElement | null;
  onAuthenticated: (session: AdminSessionView) => Promise<void>;
}) => ({
  bind: (): void => {
    const target = options.target();
    const form = target?.querySelector<HTMLFormElement>("[data-admin-login]");
    const usernameInput = target?.querySelector<HTMLInputElement>("[data-admin-username]");
    const passwordInput = target?.querySelector<HTMLInputElement>("[data-admin-password]");
    if (!form || !usernameInput || !passwordInput) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const username = usernameInput.value;
      const password = passwordInput.value;
      passwordInput.value = "";
      try {
        await options.onAuthenticated(await options.client.login(username, password));
      } catch (error) {
        const message = options.target()?.querySelector<HTMLElement>("[data-admin-login-error]");
        if (message) message.textContent = adminLoginErrorMessage(error);
      }
    });
  }
});
