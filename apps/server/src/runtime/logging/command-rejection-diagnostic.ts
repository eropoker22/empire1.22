import type { DomainError, GameCommand } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import { writeDiagnosticLog } from "./diagnostic-log-writer";

type RejectionCategory = "command_rejected" | "transport_rejected";

interface CommandRejectionDiagnosticInput {
  runtime: ServerInstanceRuntime;
  command: GameCommand;
  errors: DomainError[];
  category: RejectionCategory;
  message: string;
  expectedStateVersion?: number | null;
  focusDistrictId?: string | null;
}

export const writeCommandRejectionDiagnostic = ({
  runtime,
  command,
  errors,
  category,
  message,
  expectedStateVersion,
  focusDistrictId
}: CommandRejectionDiagnosticInput): Promise<void> =>
  writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "warn", category, message, {
    commandId: command.id,
    commandType: command.type,
    playerId: command.playerId,
    serverInstanceId: command.serverInstanceId,
    currentTick: runtime.state.root.tick,
    rootVersion: runtime.state.root.version,
    errorCodes: errors.map((error) => error.code),
    errorMessages: errors.map((error) => error.message),
    expectedStateVersion: resolveExpectedStateVersion(errors, expectedStateVersion),
    currentStateVersion: resolveCurrentStateVersion(errors, runtime.state.root.version),
    focusDistrictId: focusDistrictId ?? null,
    clientRequestId: command.clientRequestId ?? null
  }, runtime.clock);

const resolveExpectedStateVersion = (
  errors: DomainError[],
  expectedStateVersion: number | null | undefined
): number | null => {
  if (typeof expectedStateVersion === "number" && Number.isFinite(expectedStateVersion)) {
    return expectedStateVersion;
  }

  const conflict = errors.find((error) => error.code === "server.state_version_conflict");
  const detail = conflict?.details?.expectedStateVersion;
  return typeof detail === "number" && Number.isFinite(detail) ? detail : null;
};

const resolveCurrentStateVersion = (
  errors: DomainError[],
  fallbackRootVersion: number
): number => {
  const conflict = errors.find((error) => error.code === "server.state_version_conflict");
  const detail = conflict?.details?.currentStateVersion;
  return typeof detail === "number" && Number.isFinite(detail) ? detail : fallbackRootVersion;
};
