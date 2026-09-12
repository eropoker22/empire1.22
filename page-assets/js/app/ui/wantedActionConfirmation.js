import { closeOverlay, openOverlay } from "./legacyOverlayCoordinator.js";

const amount = value => Number(value || 0).toLocaleString("cs-CZ");
const currency = method => method === "influence" ? "vlivu" : `${method} cash`;
export const wantedActionCostLabel = action => `${amount(action.cost)} ${currency(action.method)} · −${amount(action.actualHeatReduction)} heat`;
export const wantedActionRiskLabel = action => `Audit risk ${amount(action.auditRiskPct)} % · pauza ${Math.ceil(Number(action.cooldownMs || 0) / 60000)} min${action.remainingMs > 0 ? ` · dostupné za ${Math.ceil(action.remainingMs / 60000)} min` : ""}`;
const quoteKey = action => JSON.stringify([action.method, action.cost, action.actualHeatReduction, action.auditRiskPct, action.auditHeatGain, action.auditFineMax, action.cooldownMs]);

// Re-read the server quote at confirmation; never charge from an outdated dialog.
export function createWantedActionConfirmation({ root, readAction, onConfirm }) {
  let shell = null;
  let quote = null;
  const close = () => {
    if (!shell || shell.hidden) return false;
    closeOverlay(shell);
    shell.hidden = true;
    quote = null;
    return true;
  };
  const render = (action, changed = false) => {
    quote = { ...action };
    shell.querySelector("[data-heat-confirm-cost]").textContent = wantedActionCostLabel(action);
    shell.querySelector("[data-heat-confirm-risk]").textContent = action.riskDescription || (
      Number(action.auditRiskPct) > 0
        ? `Riziko auditu je ${amount(action.auditRiskPct)} %. Audit může přidat ${amount(action.auditHeatGain)} heat a odečíst ještě až ${amount(action.auditFineMax)} ${currency(action.method)}.`
        : "Tato metoda nemá riziko auditu."
    );
    shell.querySelector("[data-heat-confirm-status]").textContent = action.available !== true
      ? action.reason || "Akce už není dostupná."
      : changed ? "Podmínky se změnily. Zkontroluj je a potvrď znovu." : "";
    shell.querySelector("[data-heat-confirm-submit]").disabled = action.available !== true;
  };
  const open = (method) => {
    const action = readAction(method);
    if (!action || action.available !== true || !root?.ownerDocument) return false;
    if (!shell) {
      shell = root.ownerDocument.createElement("div");
      shell.className = "heat-confirm-shell";
      shell.hidden = true;
      shell.setAttribute("role", "dialog");
      shell.setAttribute("aria-modal", "true");
      shell.setAttribute("aria-labelledby", "heat-confirm-title");
      shell.setAttribute("aria-describedby", "heat-confirm-details");
      shell.innerHTML = `<div class="heat-confirm-backdrop" data-heat-confirm-cancel></div>
        <section class="heat-confirm-card">
          <button type="button" class="heat-confirm-close" aria-label="Zavřít potvrzení" data-heat-confirm-cancel>×</button>
          <span class="heat-confirm-eyebrow">SNÍŽENÍ HEAT</span>
          <h2 id="heat-confirm-title">Opravdu provést akci?</h2>
          <div id="heat-confirm-details"><p class="heat-confirm-cost" data-heat-confirm-cost></p><p data-heat-confirm-risk></p>
          <p>Snižuje pouze heat hráče. Rozběhnutou razii nezruší.</p></div>
          <p role="status" data-heat-confirm-status></p>
          <div class="heat-confirm-actions"><button type="button" data-heat-confirm-cancel>Zpět</button><button type="button" data-heat-confirm-submit>Potvrdit snížení</button></div>
        </section>`;
      root.append(shell);
      shell.addEventListener("click", event => {
        if (event.target.closest("[data-heat-confirm-cancel]")) { close(); return; }
        if (!event.target.closest("[data-heat-confirm-submit]") || !quote) return;
        const latest = readAction(quote.method);
        if (!latest) { close(); return; }
        if (latest.available !== true || quoteKey(latest) !== quoteKey(quote)) { render(latest, true); return; }
        const method = quote.method;
        close();
        onConfirm(method);
      });
    }
    render(action);
    openOverlay(shell, { type: "modal", ariaModal: true, focusTarget: shell.querySelector("button[data-heat-confirm-cancel]") });
    return true;
  };
  return { open, close };
}
