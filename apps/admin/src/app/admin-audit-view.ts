import type { AdminAuditEntryView, AdminRole } from "@empire/shared-types";
import { badge, escapeHtml, formatTime, pill, table } from "./admin-view-helpers";

export const renderAdminAudit = (input: {
  role: AdminRole;
  entries: AdminAuditEntryView[] | null;
  error?: string | null;
}): string => {
  if (input.role !== "owner") return "";
  const status = input.error
    ? badge("AUDIT NEDOSTUPNÝ", "warning")
    : badge(`${input.entries?.length ?? 0} ZÁZNAMŮ`, "info");
  return `<details id="admin-audit" class="admin-panel admin-audit admin-section-anchor">
    <summary class="admin-panel__head">
      <div><span>Owner only</span><h3>Bezpečnostní audit trail</h3></div>
      <div class="admin-actions">${status}<span class="admin-audit__open-label">Otevřít audit</span></div>
    </summary>
    <div class="admin-audit__body">
      <div class="admin-audit__toolbar">
        <p>Citlivé provozní operace a jejich korelační identifikátory.</p>
        <button class="admin-button" type="button" data-admin-audit-refresh>Načíst nejnovější</button>
      </div>
      ${input.error ? `<p class="admin-notice" role="alert">${escapeHtml(input.error)}</p>` : ""}
      ${input.entries === null ? `<p class="admin-copy" role="status">Načítám audit trail...</p>` : table(
        ["Výsledek", "Akce", "Actor / role", "Instance", "Čas", "Correlation"],
        input.entries.map((entry) => `<tr data-admin-search-row>
          <td>${pill(entry.result)}</td><td>${escapeHtml(entry.action)}</td>
          <td>${escapeHtml(entry.actorId ?? "system")}<br><small>${escapeHtml(entry.role ?? "worker")}</small></td>
          <td>${escapeHtml(entry.targetInstanceId ?? "–")}</td><td>${formatTime(entry.createdAt)}</td>
          <td><code>${escapeHtml(entry.correlationId)}</code></td>
        </tr>`).join("")
      )}
    </div>
  </details>`;
};
