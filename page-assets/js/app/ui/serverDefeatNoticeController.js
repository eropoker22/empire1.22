import { createServerDefeatNoticeViewModel } from "./serverDefeatNoticeViewModel.js";

export {
  createServerDefeatNoticeViewModel,
  SERVER_DEFEAT_NOTICE_KINDS
} from "./serverDefeatNoticeViewModel.js";

const ACKNOWLEDGEMENT_PREFIX = "empire:server-defeat-notice:v1";

export function createServerDefeatNoticeController({
  documentRef = globalThis.document,
  windowRef = documentRef?.defaultView || globalThis.window,
  storageRef = windowRef?.localStorage
} = {}) {
  let root = null;
  let activeViewModel = null;
  let mounted = false;
  let previousFocus = null;
  const diagnostics = {
    opens: 0,
    closes: 0,
    updates: 0
  };

  const acknowledgeKey = (viewModel) => `${ACKNOWLEDGEMENT_PREFIX}:${viewModel.announcementId}`;
  const isAcknowledged = (viewModel) => {
    try {
      return storageRef?.getItem?.(acknowledgeKey(viewModel)) === "1";
    } catch (_error) {
      return false;
    }
  };
  const acknowledge = (viewModel) => {
    if (!viewModel) return;
    try {
      storageRef?.setItem?.(acknowledgeKey(viewModel), "1");
    } catch (_error) {}
  };

  const close = ({ acknowledged = true } = {}) => {
    if (!root || root.hidden) return false;
    if (acknowledged) acknowledge(activeViewModel);
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    documentRef?.body?.classList?.remove("server-defeat-notice-open");
    previousFocus?.focus?.();
    previousFocus = null;
    diagnostics.closes += 1;
    return true;
  };

  const render = (viewModel) => {
    if (!root || !viewModel) return 0;
    activeViewModel = viewModel;
    root.dataset.defeatKind = viewModel.kind;
    root.dataset.defeatNoticeId = viewModel.announcementId;
    root.querySelector("[data-server-defeat-status]").textContent = viewModel.status;
    root.querySelector("[data-server-defeat-title]").textContent = viewModel.title;
    root.querySelector("[data-server-defeat-lead]").textContent = viewModel.lead;
    root.querySelector("[data-server-defeat-reason-label]").textContent = viewModel.reasonLabel;
    root.querySelector("[data-server-defeat-reason]").textContent = viewModel.reasonText;
    root.querySelector("[data-server-defeat-code]").textContent = viewModel.code;
    root.querySelector("[data-server-defeat-lock-title]").textContent = viewModel.lockTitle;
    root.querySelector("[data-server-defeat-lock]").textContent = viewModel.lockText;
    root.querySelector("[data-server-defeat-action]").textContent = viewModel.actionLabel;
    const placement = root.querySelector("[data-server-defeat-placement]");
    placement.hidden = viewModel.finalPlacement === null;
    placement.querySelector("strong").textContent = viewModel.finalPlacement === null ? "—" : `#${viewModel.finalPlacement}`;
    diagnostics.updates += 1;
    return 10;
  };

  const openViewModel = (viewModel) => {
    if (!root || !viewModel) return 0;
    if (isAcknowledged(viewModel)) return 0;
    const writes = render(viewModel);
    previousFocus = documentRef?.activeElement || null;
    root.hidden = false;
    root.removeAttribute("aria-hidden");
    documentRef?.body?.classList?.add("server-defeat-notice-open");
    root.querySelector("[data-server-defeat-action]")?.focus?.();
    diagnostics.opens += 1;
    return writes + 2;
  };

  const handleClick = (event) => {
    const target = event.target?.closest?.("[data-server-defeat-close], [data-server-defeat-action]");
    if (!target) return;
    close();
  };
  const handleKeyDown = (event) => {
    if (event.key !== "Escape" || root?.hidden) return;
    event.preventDefault();
    close();
  };

  const mount = () => {
    if (mounted) return false;
    root = ensureNoticeShell(documentRef);
    if (!root) return false;
    mounted = true;
    root.addEventListener("click", handleClick);
    root.addEventListener("keydown", handleKeyDown);
    return true;
  };

  const update = (gameplaySlice) => {
    const viewModel = createServerDefeatNoticeViewModel(gameplaySlice);
    if (!viewModel) return 0;
    if (
      activeViewModel?.announcementId === viewModel.announcementId
      && root
      && !root.hidden
    ) {
      return 0;
    }
    return openViewModel(viewModel);
  };

  const destroy = () => {
    if (!mounted) return false;
    close({ acknowledged: false });
    root?.removeEventListener?.("click", handleClick);
    root?.removeEventListener?.("keydown", handleKeyDown);
    root?.remove?.();
    root = null;
    activeViewModel = null;
    mounted = false;
    return true;
  };

  return Object.freeze({
    close,
    destroy,
    getDiagnostics: () => ({ ...diagnostics, mounted, open: Boolean(root && !root.hidden) }),
    mount,
    update
  });
}

function ensureNoticeShell(documentRef) {
  if (!documentRef?.body) return null;
  const existing = documentRef.querySelector("[data-server-defeat-notice]");
  if (existing) return existing;
  const root = documentRef.createElement("div");
  root.className = "server-defeat-notice";
  root.dataset.serverDefeatNotice = "";
  root.hidden = true;
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = `
    <div class="server-defeat-notice__backdrop" data-server-defeat-close></div>
    <section class="server-defeat-notice__dialog" role="alertdialog" aria-modal="true" aria-labelledby="server-defeat-notice-title" tabindex="-1">
      <header class="server-defeat-notice__header">
        <div>
          <span>EMPIRE STREETS // SERVER REPORT</span>
          <strong data-server-defeat-status>OČISTA // ELIMINACE</strong>
        </div>
        <button type="button" class="server-defeat-notice__close" data-server-defeat-close aria-label="Zavřít oznámení">✕</button>
      </header>
      <div class="server-defeat-notice__body">
        <div class="server-defeat-notice__signal" aria-hidden="true"><span>×</span></div>
        <div class="server-defeat-notice__copy">
          <span class="server-defeat-notice__eyebrow">STATUS HRÁČE // ELIMINOVÁN</span>
          <h2 id="server-defeat-notice-title" data-server-defeat-title>OČISTA TĚ VYŘADILA</h2>
          <p class="server-defeat-notice__lead" data-server-defeat-lead>Server uzavřel tvoji válku o město.</p>
        </div>
        <div class="server-defeat-notice__reason">
          <span data-server-defeat-reason-label>DŮVOD VYŘAZENÍ</span>
          <strong data-server-defeat-reason></strong>
          <code data-server-defeat-code></code>
        </div>
        <div class="server-defeat-notice__lock">
          <span aria-hidden="true">!</span>
          <div>
            <strong data-server-defeat-lock-title>NOVÁ REGISTRACE JE UZAMČENÁ</strong>
            <p data-server-defeat-lock></p>
          </div>
        </div>
        <div class="server-defeat-notice__meta">
          <span>SERVER STATUS <strong>VYŘAZEN</strong></span>
          <span data-server-defeat-placement>FINÁLNÍ POŘADÍ <strong>—</strong></span>
        </div>
        <button type="button" class="server-defeat-notice__action" data-server-defeat-action>ROZUMÍM // ZAVŘÍT</button>
      </div>
      <footer class="server-defeat-notice__footer">CONNECTION TERMINATED // GAMEPLAY ACCESS REVOKED</footer>
    </section>
  `;
  documentRef.body.append(root);
  return root;
}
