const bindings = new Set();
let intervalId = null;
let timerApi = null;

function stopIfIdle() {
  if (bindings.size > 0 || intervalId === null) return;
  timerApi?.clearInterval?.(intervalId);
  intervalId = null;
  timerApi = null;
}

function tick() {
  const documentRef = timerApi?.document || (typeof document !== "undefined" ? document : null);
  if (documentRef?.hidden) return;
  for (const binding of [...bindings]) {
    if (binding.element?.isConnected === false || binding.element?.closest?.("[hidden]")) {
      bindings.delete(binding);
      continue;
    }
    binding.render(binding.getValue());
  }
  stopIfIdle();
}

export function bindSharedCountdown(element, getValue, options = {}) {
  if (!element || Number.isFinite(Number(options.now))) return;
  const elementTimerApi = element?.ownerDocument?.defaultView || (typeof window !== "undefined" ? window : null);
  if (typeof elementTimerApi?.setInterval !== "function" || typeof elementTimerApi?.clearInterval !== "function") return;
  bindings.add({
    element,
    getValue,
    render: typeof options.render === "function"
      ? options.render
      : (value) => { element.textContent = value; }
  });
  if (intervalId === null) {
    timerApi = elementTimerApi;
    intervalId = elementTimerApi.setInterval(tick, 1000);
  }
}

export function getSharedCountdownDiagnostics() {
  return {
    bindingCount: bindings.size,
    hasActiveTicker: intervalId !== null
  };
}
