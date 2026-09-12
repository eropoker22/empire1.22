// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { createWantedActionConfirmation } from "../../page-assets/js/app/ui/wantedActionConfirmation.js";
let confirmation;
afterEach(() => { confirmation?.close(); document.body.replaceChildren(); });
it.each(["dirty", "clean", "influence"])("requires an explicit confirmation for %s, including updated server risks", method => {
  let quote = { method, available: true, cost: 2500, actualHeatReduction: 15, auditRiskPct: 10, auditHeatGain: 12, auditFineMax: 500, cooldownMs: 60000 };
  const send = vi.fn();
  confirmation = createWantedActionConfirmation({ root: document.body, readAction: () => quote, onConfirm: send });
  expect(confirmation.open(method)).toBe(true);
  expect(send).not.toHaveBeenCalled();
  expect(document.querySelector('[data-heat-confirm-risk]').textContent).toContain('10 %');
  document.querySelector('button[data-heat-confirm-cancel]').click();
  expect(send).not.toHaveBeenCalled();
  confirmation.open(method);
  quote = { ...quote, auditRiskPct: 25 };
  document.querySelector('[data-heat-confirm-submit]').click();
  expect(send).not.toHaveBeenCalled();
  expect(document.querySelector('[data-heat-confirm-risk]').textContent).toContain('25 %');
  document.querySelector('[data-heat-confirm-submit]').click();
  document.querySelector('[data-heat-confirm-submit]').click();
  expect(send).toHaveBeenCalledExactlyOnceWith(method);
});
it("refuses a quote that becomes unavailable before confirmation", () => {
  let quote = { method: "influence", available: true, cost: 20, actualHeatReduction: 25, auditRiskPct: 0 };
  const send = vi.fn();
  confirmation = createWantedActionConfirmation({ root: document.body, readAction: () => quote, onConfirm: send });
  confirmation.open("influence");
  quote = { ...quote, available: false, reason: "Nemáš dost prostředků." };
  document.querySelector('[data-heat-confirm-submit]').click();
  expect(send).not.toHaveBeenCalled();
  expect(document.querySelector('[data-heat-confirm-submit]').disabled).toBe(true);
  expect(document.querySelector('[data-heat-confirm-status]').textContent).toContain('Nemáš dost');
});
