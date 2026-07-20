export const createHostedRuntimeWorkerRunLoop = (options: {
  runOnce(): Promise<void>;
  requestDrain(): void;
  intervalMs?: number;
}) => {
  let activeRun: Promise<void> | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let draining = false;

  const runNow = (): Promise<void> => {
    if (draining) return Promise.resolve();
    if (activeRun) return activeRun;
    const operation = Promise.resolve().then(options.runOnce);
    let tracked!: Promise<void>;
    tracked = operation.finally(() => {
      if (activeRun === tracked) activeRun = null;
    });
    activeRun = tracked;
    return tracked;
  };

  const start = (): void => {
    if (draining || timer) return;
    timer = setInterval(() => { void runNow().catch(() => undefined); }, options.intervalMs ?? 5_000);
    void runNow().catch(() => undefined);
  };

  const drain = async (): Promise<void> => {
    if (!draining) {
      draining = true;
      options.requestDrain();
      if (timer) clearInterval(timer);
      timer = null;
    }
    if (activeRun) await activeRun;
  };

  return { start, runNow, drain };
};

export const shutdownHostedRuntimeWorker = async (options: {
  drain(): Promise<void>;
  closeHealthServer(): Promise<void>;
  stopWorker(): Promise<void>;
  closePersistence(): Promise<void>;
}): Promise<void> => {
  const drained = options.drain();
  await options.closeHealthServer();
  await drained;
  await options.stopWorker();
  await options.closePersistence();
};
