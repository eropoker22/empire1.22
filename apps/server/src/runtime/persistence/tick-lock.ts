import type { ServerInstanceId } from "@empire/shared-types";

export interface RuntimeTickLock {
  withTickLock<TResult>(
    serverInstanceId: ServerInstanceId,
    callback: () => TResult | Promise<TResult>
  ): Promise<{
    acquired: boolean;
    result: TResult | null;
  }>;
}
