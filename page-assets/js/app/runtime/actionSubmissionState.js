const activeSubmissionByButton = new WeakMap();
const activeSubmissionByActionType = new Map();

const getWindowRef = (button) => button?.ownerDocument?.defaultView
  || (typeof window === "undefined" ? null : window);

const isDiagnosticsEnabled = (windowRef) => Boolean(
  windowRef?.empireStreetsRuntimeDiagnostics?.debugEnabled
);

const now = (windowRef) => windowRef?.performance?.now?.() ?? Date.now();

const publishDiagnostic = (submission, phase, extra = {}) => {
  const windowRef = submission.windowRef;
  if (!isDiagnosticsEnabled(windowRef)) return;
  const atMs = now(windowRef);
  submission.phases[phase] = {
    elapsedFromClickMs: Math.max(0, atMs - submission.clickedAtMs),
    ...extra
  };
  windowRef.empireStreetsPerformanceMetrics ??= {};
  windowRef.empireStreetsPerformanceMetrics.lastGameplayActionLifecycle = {
    actionType: submission.actionType,
    phases: { ...submission.phases }
  };
  windowRef.performance?.mark?.(`empire-action:${submission.actionType}:${phase}`);
};

export function beginActionSubmission(button, options = {}) {
  if (!button || activeSubmissionByButton.has(button)) return null;
  const actionType = String(options.actionType || "gameplay-command").trim() || "gameplay-command";
  const windowRef = options.windowRef || getWindowRef(button);
  const submission = {
    actionType,
    button,
    windowRef,
    clickedAtMs: now(windowRef),
    phases: {},
    original: {
      ariaBusy: button.getAttribute?.("aria-busy"),
      disabled: button.disabled === true,
      innerHTML: button.innerHTML,
      state: button.dataset?.state
    }
  };
  activeSubmissionByButton.set(button, submission);
  activeSubmissionByActionType.set(actionType, submission);
  publishDiagnostic(submission, "click", { elapsedFromClickMs: 0 });

  button.disabled = true;
  button.dataset.state = "submitting";
  button.dataset.serverCommandPending = "true";
  button.setAttribute?.("aria-busy", "true");
  button.textContent = String(options.submittingLabel || "Spouštím…");
  publishDiagnostic(submission, "first-feedback");

  const requestFrame = options.requestFrame || windowRef?.requestAnimationFrame?.bind(windowRef);
  requestFrame?.(() => publishDiagnostic(submission, "first-feedback-frame"));

  const release = () => {
    activeSubmissionByButton.delete(button);
    if (activeSubmissionByActionType.get(actionType) === submission) {
      activeSubmissionByActionType.delete(actionType);
    }
  };

  return {
    accepted(pendingLabel = "Akce probíhá") {
      button.dataset.state = "pending";
      button.removeAttribute?.("aria-busy");
      button.textContent = pendingLabel;
      publishDiagnostic(submission, "pending-visible");
      release();
    },
    rejected() {
      button.disabled = submission.original.disabled;
      button.innerHTML = submission.original.innerHTML;
      if (submission.original.state === undefined) delete button.dataset.state;
      else button.dataset.state = submission.original.state;
      delete button.dataset.serverCommandPending;
      if (submission.original.ariaBusy === null) button.removeAttribute?.("aria-busy");
      else button.setAttribute?.("aria-busy", submission.original.ariaBusy);
      publishDiagnostic(submission, "rejected");
      release();
    },
    ambiguous() {
      button.dataset.state = "submitting";
      button.textContent = "Ověřuji…";
      publishDiagnostic(submission, "result-ambiguous");
    }
  };
}

export function recordActionSubmissionTransportPhase(actionType, phase, extra = {}) {
  const submission = activeSubmissionByActionType.get(String(actionType || ""));
  if (!submission) return false;
  publishDiagnostic(submission, phase, extra);
  return true;
}
