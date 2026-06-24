import type { GameCommand } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import type { CommandDispatchOptions } from "../orchestration/command-dispatch-options";
import type { InstanceCommandDispatchResult } from "../orchestration/instance-command-dispatch-result";
import {
  dispatchAtomicInstanceCommand,
  type AtomicCommandDispatcherOptions
} from "./atomic-command-dispatcher";

export const dispatchInstanceCommand = (
  runtime: ServerInstanceRuntime,
  command: GameCommand,
  options: CommandDispatchOptions = {},
  dispatcherOptions: AtomicCommandDispatcherOptions = {}
): Promise<InstanceCommandDispatchResult> =>
  dispatchAtomicInstanceCommand(runtime, command, options, dispatcherOptions);

