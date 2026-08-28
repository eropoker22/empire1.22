export const createHostedRuntimeWorkerRunLoop = (options: {
  runOnce(): Promise<void>;
  requestDrain(): void;
  intervalMs?: number;
  heartbeat?(): Promise<void>;
  heartbeatIntervalMs?: number;
}) => {
  let activeRun: Promise<void> | null = null;
  let activeHeartbeat: Promise<void> | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let draining = false;
  let rerunRequested = false;

  const runNow = (): Promise<void> => {
    if (draining) return Promise.resolve();
    if (activeRun) {
      rerunRequested = true;
      return activeRun;
    }
    const operation = Promise.resolve().then(options.runOnce);
    let tracked!: Promise<void>;
    tracked = operation.finally(() => {
      if (activeRun !== tracked) return;
      activeRun = null;
      if (!rerunRequested || draining) return;
      rerunRequested = false;
      void runNow().catch(() => undefined);
    });
    activeRun = tracked;
    return tracked;
  };

  const heartbeatNow = (): Promise<void> => {
    if (draining || !options.heartbeat) return Promise.resolve();
    if (activeHeartbeat) return activeHeartbeat;
    const operation = Promise.resolve().then(options.heartbeat);
    let tracked!: Promise<void>;
    tracked = operation.finally(() => {
      if (activeHeartbeat === tracked) activeHeartbeat = null;
    });
    activeHeartbeat = tracked;
    return tracked;
  };

  const start = (): void => {
    if (draining || timer) return;
    timer = setInterval(() => { void runNow().catch(() => undefined); }, options.intervalMs ?? 5_000);
    if (options.heartbeat) {
      heartbeatTimer = setInterval(
        () => { void heartbeatNow().catch(() => undefined); },
        options.heartbeatIntervalMs ?? 5_000
      );
      void heartbeatNow().catch(() => undefined);
    }
    void runNow().catch(() => undefined);
  };

  const drain = async (): Promise<void> => {
    if (!draining) {
      draining = true;
      rerunRequested = false;
      options.requestDrain();
      if (timer) clearInterval(timer);
      timer = null;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    await Promise.all([
      activeRun ?? Promise.resolve(),
      activeHeartbeat ?? Promise.resolve()
    ]);
  };

  return { start, runNow, heartbeatNow, drain };
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
