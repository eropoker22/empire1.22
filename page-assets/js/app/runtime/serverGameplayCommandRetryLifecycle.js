const retryDelayCancellers = new Set();
let retryGeneration = 0;

export const capturePendingServerGameplayCommandRetryGeneration = () => retryGeneration;

export const isPendingServerGameplayCommandRetryGenerationCurrent = (generation) => (
  generation === retryGeneration
);

export function cancelPendingServerGameplayCommandRetries() {
  retryGeneration += 1;
  const cancellers = [...retryDelayCancellers];
  retryDelayCancellers.clear();
  cancellers.forEach((cancel) => cancel());
  return cancellers.length;
}

export function waitForPendingServerGameplayCommandRetry(delay, generation) {
  if (!isPendingServerGameplayCommandRetryGenerationCurrent(generation)) {
    return Promise.resolve(false);
  }
  if (delay <= 0) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;
    const finish = (isCurrent) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
      retryDelayCancellers.delete(cancel);
      resolve(isCurrent);
    };
    const cancel = () => finish(false);
    timeoutId = setTimeout(
      () => finish(isPendingServerGameplayCommandRetryGenerationCurrent(generation)),
      delay
    );
    retryDelayCancellers.add(cancel);
    if (!isPendingServerGameplayCommandRetryGenerationCurrent(generation)) cancel();
  });
}
