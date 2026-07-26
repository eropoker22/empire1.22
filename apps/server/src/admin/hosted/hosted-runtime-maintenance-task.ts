export interface HostedRuntimeMaintenanceTask {
  schedule(nowIso: string): boolean;
  drain(): Promise<void>;
  isRunning(): boolean;
}

export const createHostedRuntimeMaintenanceTask = (
  run: (nowIso: string) => Promise<unknown>
): HostedRuntimeMaintenanceTask => {
  let activeRun: Promise<void> | null = null;
  let draining = false;

  const schedule = (nowIso: string): boolean => {
    if (draining || activeRun) return false;
    const operation = Promise.resolve()
      .then(() => run(nowIso))
      .then(() => undefined)
      .catch(() => undefined);
    let tracked!: Promise<void>;
    tracked = operation.finally(() => {
      if (activeRun === tracked) activeRun = null;
    });
    activeRun = tracked;
    return true;
  };

  return {
    schedule,
    drain: async () => {
      draining = true;
      if (activeRun) await activeRun;
    },
    isRunning: () => activeRun !== null
  };
};
