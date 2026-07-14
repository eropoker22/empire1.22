const bindings = new Set();
const bindingByElement = new WeakMap();
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
      bindingByElement.delete(binding.element);
      continue;
    }
    binding.render(binding.getValue());
  }
  stopIfIdle();
}

export function bindSharedCountdown(element, getValue, options = {}) {
  if (!element || Number.isFinite(Number(options.now))) return () => {};
  const elementTimerApi = element?.ownerDocument?.defaultView || (typeof window !== "undefined" ? window : null);
  if (typeof elementTimerApi?.setInterval !== "function" || typeof elementTimerApi?.clearInterval !== "function") return () => {};
  const previous = bindingByElement.get(element);
  if (previous) bindings.delete(previous);
  const binding = {
    element,
    getValue,
    render: typeof options.render === "function"
      ? options.render
      : (value) => { element.textContent = value; }
  };
  bindings.add(binding);
  bindingByElement.set(element, binding);
  binding.render(binding.getValue());
  if (intervalId === null) {
    timerApi = elementTimerApi;
    intervalId = elementTimerApi.setInterval(tick, 1000);
  }
  return () => {
    if (bindingByElement.get(element) !== binding) return;
    bindingByElement.delete(element);
    bindings.delete(binding);
    stopIfIdle();
  };
}

export function getSharedCountdownDiagnostics() {
  return {
    bindingCount: bindings.size,
    hasActiveTicker: intervalId !== null
  };
}
