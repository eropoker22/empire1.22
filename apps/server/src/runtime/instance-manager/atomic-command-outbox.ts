import type { InstanceRuntimeEvent } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import type { AtomicCommandCrashPoint } from "./atomic-command-dispatcher";

const publicationTails = new WeakMap<object, Promise<void>>();

export const publishOutbox = async (
  runtime: ServerInstanceRuntime,
  crash?: (point: AtomicCommandCrashPoint) => void | Promise<void>
): Promise<void> => {
  const outboxRepository = runtime.outboxRepository;
  if (!outboxRepository) return;

  const previous = publicationTails.get(outboxRepository) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(() => publishOutboxUnlocked(runtime, crash));
  publicationTails.set(outboxRepository, current);
  try {
    await current;
  } finally {
    if (publicationTails.get(outboxRepository) === current) publicationTails.delete(outboxRepository);
  }
};

const publishOutboxUnlocked = async (
  runtime: ServerInstanceRuntime,
  crash?: (point: AtomicCommandCrashPoint) => void | Promise<void>
): Promise<void> => {
  const outboxRepository = runtime.outboxRepository;
  if (!outboxRepository) return;
  for (const record of await outboxRepository.listUnpublished(runtime.record.id)) {
    try {
      await crash?.("duringOutboxPublish");
      runtime.eventPublisher.publish(record.payload as InstanceRuntimeEvent);
      await outboxRepository.markPublished(record.outboxId, runtime.clock.nowIso());
    } catch (error) {
      await outboxRepository.markPublishFailed(
        record.outboxId,
        error instanceof Error ? error.message : "Unknown outbox publish failure."
      );
      throw error;
    }
  }
};

