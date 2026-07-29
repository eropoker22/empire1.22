import { AdminApiError } from "./admin-monitoring-client";

export const initialAdminLoginMessage = (error: unknown): string | undefined => {
  if (isSessionError(error)) {
    return error instanceof AdminApiError && error.code === "ADMIN_SESSION_EXPIRED"
      ? "Admin session vypršela."
      : undefined;
  }
  if (error instanceof AdminApiError && error.code === "ADMIN_CONFIGURATION_UNAVAILABLE") {
    return "Admin API momentálně není připojené k databázi. Přihlášení můžeš zkusit, ale serverové připojení musí být nejdřív dostupné.";
  }
  return "Admin API momentálně neodpovídá. Přihlašovací formulář zůstává dostupný pro další pokus.";
};

export const adminLoginErrorMessage = (error: unknown): string => {
  if (error instanceof AdminApiError && error.code === "ADMIN_INVALID_RESPONSE") {
    return "Admin API nevrátilo platná data. Nepoužívej VS Code Live Server; spusť `npm run dev:hosted-api` a `npm run dev:admin`.";
  }
  if (error instanceof AdminApiError && error.code === "ADMIN_CONFIGURATION_UNAVAILABLE") {
    return "Admin server nemá nastavené databázové připojení. Zkontroluj produkční EMPIRE_DATABASE_URL.";
  }
  if (error instanceof AdminApiError && error.code === "ADMIN_DATABASE_UNAVAILABLE") {
    return "Admin databáze je právě nedostupná. Zkus přihlášení znovu později.";
  }
  return error instanceof Error ? error.message : "Přihlášení selhalo.";
};

export const isSessionError = (error: unknown): boolean =>
  error instanceof AdminApiError && (error.status === 401 || error.code.includes("SESSION"));
