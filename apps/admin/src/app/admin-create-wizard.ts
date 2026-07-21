import { FREE_HOSTED_SERVER_LIFECYCLE_POLICY } from "@empire/game-config";

export const mapTotal = (form: HTMLFormElement): number => {
  const data = new FormData(form);
  return 8 + ["commercial", "residential", "industrial", "park"]
    .reduce((sum, key) => sum + Number(data.get(key) ?? 0), 0);
};

export const validateWizardPanel = (form: HTMLFormElement, step: number): boolean => {
  const panel = form.querySelector<HTMLElement>(`[data-admin-wizard-panel="${step}"]`);
  const serverTemplate = form.elements.namedItem("serverTemplate");
  if (!panel) return false;
  for (const field of panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select")) {
    if (!field.reportValidity()) return false;
  }
  if (step === 2 && mapTotal(form) !== 161) {
    const message = form.querySelector<HTMLElement>("[data-admin-create-error]");
    if (message) message.textContent = "Mapa musí obsahovat přesně 161 districtů.";
    return false;
  }
  if (step === 1 && serverTemplate instanceof HTMLSelectElement
    && serverTemplate.value === "full"
    && Number(new FormData(form).get("capacity")) !== 20) {
    const message = form.querySelector<HTMLElement>("[data-admin-create-error]");
    if (message) message.textContent = "Plnohodnotná šablona používá canonical kapacitu 20 hráčů.";
    return false;
  }
  return true;
};

export const updateWizardReview = (form: HTMLFormElement): void => {
  const review = form.querySelector<HTMLElement>("[data-admin-create-review]");
  if (!review) return;
  const data = new FormData(form);
  const serverTemplate = data.get("serverTemplate") === "full" ? "Plnohodnotný server" : "Kontrolní test";
  const values = [
    ["Název", data.get("displayName")], ["Mode", data.get("mode")], ["Region", data.get("region")],
    ["Šablona", serverTemplate],
    ["Kapacita", data.get("capacity")],
    ["Minimum ke spuštění", FREE_HOSTED_SERVER_LIFECYCLE_POLICY.minimumReadyPlayersToStart],
    ["Registrační okno", `${FREE_HOSTED_SERVER_LIFECYCLE_POLICY.registrationWindowMs / 60_000} minut`],
    ["Vstup po vytvoření", "Uzavřený do naplánování registrace"],
    ["Mapa", `8 / ${data.get("commercial")} / ${data.get("residential")} / ${data.get("industrial")} / ${data.get("park")}`]
  ];
  review.innerHTML = values.map(([label, value]) =>
    `<span><small>${escapeHtml(label)}</small><strong>${escapeHtml(value ?? "-")}</strong></span>`).join("");
};

const escapeHtml = (value: unknown): string => String(value).replace(/[&<>"']/gu,
  (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]!);
