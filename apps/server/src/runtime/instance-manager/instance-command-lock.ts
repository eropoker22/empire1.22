const instanceLocks = new Map<string, Promise<void>>();

export const withInstanceCommandLock = async <TResult>(
  instanceId: string,
  callback: () => Promise<TResult>
): Promise<TResult> => {
  const previous = instanceLocks.get(instanceId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current);
  instanceLocks.set(instanceId, queued);
  await previous;
  try {
    return await callback();
  } finally {
    release();
    if (instanceLocks.get(instanceId) === queued) {
      instanceLocks.delete(instanceId);
    }
  }
};
