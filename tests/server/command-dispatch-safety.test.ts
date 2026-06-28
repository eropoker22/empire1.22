import { describe, expect, it } from "vitest";
import {
  PRODUCTION_GAME_LIFECYCLE_PHASES,
  type DomainError,
  type GameCommand,
  type GameplaySliceView
} from "@empire/shared-types";
import { createServerApp, type ServerApp } from "../../apps/server/src/app";
import {
  createCommandReservationPayload,
  createCommandReservationPayloadHash,
  createInMemoryCommandReservationRepository,
  createInMemoryRuntimePersistenceRepositories,
  type CommandReservationDraft,
  type CommandReservationRepository,
  type CommandReservationReserveResult
} from "../../apps/server/src/runtime";
import {
  createPlaceTrapCommandFixture
} from "../fixtures/command-fixtures";
import {
  createDevGameplaySession,
  seedDevSpawnSelection
} from "../helpers/gameplay-session-test-helpers";

describe("command dispatch reservation safety", () => {
  it("fails production submit safely when commandReservationRepository is unavailable", async () => {
    const persistence = {
      ...createInMemoryRuntimePersistenceRepositories(),
      commandReservationRepository: undefined
    };
    const server = createServerApp({ persistence });
    const fixture = await createJsonSubmitFixture(server, {
      instanceId: "instance:safety:missing-reservation",
      playerId: "player:safety:missing-reservation",
      districtId: "district:safety:missing-reservation",
      commandId: "command:safety:missing-reservation"
    });
    const rootBefore = fixture.runtime.state.root.version;

    const response = await submitJsonCommand(server, fixture);

    expect(response.body.accepted).toBe(false);
    expect(response.body.errors[0]).toMatchObject({
      code: "server.command_reservation_unavailable"
    });
    expect(fixture.runtime.state.root.version).toBe(rootBefore);
    await expect(server.instanceManager.listCommandRecords(fixture.instanceId)).resolves.toHaveLength(0);
    await expect(server.instanceManager.listEventRecords(fixture.instanceId)).resolves.toHaveLength(0);
  });

  it("does not mutate state twice for duplicate commands through the JSON submit path", async () => {
    const reservations = createTrackingReservationRepository();
    const server = createServerWithTrackingReservation(reservations.repository);
    const fixture = await createJsonSubmitFixture(server, {
      instanceId: "instance:safety:duplicate-applied",
      playerId: "player:safety:duplicate-applied",
      districtId: "district:safety:duplicate-applied",
      commandId: "command:safety:duplicate-applied"
    });

    const first = await submitJsonCommand(server, fixture);
    const rootAfterFirst = fixture.runtime.state.root.version;
    const second = await submitJsonCommand(server, {
      ...fixture,
      expectedStateVersion: first.body.metadata?.stateVersion
    });

    expect(first.body.accepted).toBe(true);
    expect(second.body.accepted).toBe(true);
    expect(second.body.errors).toEqual([]);
    expect(fixture.runtime.state.root.version).toBe(rootAfterFirst);
    expect(reservations.calls.reserve).toBe(2);
    expect(reservations.calls.markApplied).toBe(1);
    expect(reservations.calls.markRejected).toBe(0);

    const commandRecords = await server.instanceManager.listCommandRecords(fixture.instanceId);
    const eventRecords = await server.instanceManager.listEventRecords(fixture.instanceId);
    expect(commandRecords.filter((record) => record.command.id === fixture.command.id)).toHaveLength(1);
    expect(eventRecords.filter((record) => record.causedByCommandId === fixture.command.id)).toHaveLength(1);
  });

  it("returns command_in_flight for a pending duplicate without mutating state", async () => {
    const reservations = createTrackingReservationRepository();
    const server = createServerWithTrackingReservation(reservations.repository);
    const fixture = await createJsonSubmitFixture(server, {
      instanceId: "instance:safety:pending-duplicate",
      playerId: "player:safety:pending-duplicate",
      districtId: "district:safety:pending-duplicate",
      commandId: "command:safety:pending-duplicate"
    });
    await reservations.seed(createReservationDraft(fixture.runtime.record.id, fixture.command));
    reservations.reset();
    const rootBefore = fixture.runtime.state.root.version;

    const response = await submitJsonCommand(server, fixture);

    expect(response.body.accepted).toBe(false);
    expect(response.body.errors[0]?.code).toBe("server.command_in_flight");
    expect(fixture.runtime.state.root.version).toBe(rootBefore);
    expect(reservations.calls.reserve).toBe(1);
    expect(reservations.calls.markApplied).toBe(0);
    expect(reservations.calls.markRejected).toBe(0);
    await expect(server.instanceManager.listCommandRecords(fixture.instanceId)).resolves.toHaveLength(0);
    await expect(server.instanceManager.listEventRecords(fixture.instanceId)).resolves.toHaveLength(0);
  });

  it("rejects duplicate command ids with a different payload before mutation", async () => {
    const reservations = createTrackingReservationRepository();
    const server = createServerWithTrackingReservation(reservations.repository);
    const fixture = await createJsonSubmitFixture(server, {
      instanceId: "instance:safety:payload-conflict",
      playerId: "player:safety:payload-conflict",
      districtId: "district:safety:payload-conflict",
      commandId: "command:safety:payload-conflict"
    });
    await reservations.seed(createReservationDraft(fixture.runtime.record.id, fixture.command));
    reservations.reset();
    const rootBefore = fixture.runtime.state.root.version;

    const response = await submitJsonCommand(server, {
      ...fixture,
      command: createPlaceTrapCommandFixture({
        id: fixture.command.id,
        mode: fixture.runtime.record.mode,
        playerId: fixture.playerId,
        serverInstanceId: fixture.instanceId,
        payload: {
          districtId: "district:safety:payload-conflict:changed"
        }
      })
    });

    expect(response.body.accepted).toBe(false);
    expect(response.body.errors[0]?.code).toBe("server.command_payload_conflict");
    expect(fixture.runtime.state.root.version).toBe(rootBefore);
    expect(reservations.calls.reserve).toBe(1);
    expect(reservations.calls.markApplied).toBe(0);
    expect(reservations.calls.markRejected).toBe(0);
  });

  it("returns stored rejected duplicate errors without replaying command application", async () => {
    const reservations = createTrackingReservationRepository();
    const server = createServerWithTrackingReservation(reservations.repository);
    const fixture = await createJsonSubmitFixture(server, {
      instanceId: "instance:safety:rejected-duplicate",
      playerId: "player:safety:rejected-duplicate",
      districtId: "district:safety:rejected-duplicate",
      commandId: "command:safety:rejected-duplicate"
    });
    const storedErrors: DomainError[] = [
      {
        code: "core.fixture_rejected",
        message: "Stored rejection."
      }
    ];
    await reservations.seed(createReservationDraft(fixture.runtime.record.id, fixture.command));
    await reservations.repository.markRejected(fixture.runtime.record.id, fixture.command.id, storedErrors);
    reservations.reset();
    const rootBefore = fixture.runtime.state.root.version;

    const response = await submitJsonCommand(server, fixture);

    expect(response.body.accepted).toBe(false);
    expect(response.body.errors).toEqual(storedErrors);
    expect(fixture.runtime.state.root.version).toBe(rootBefore);
    expect(reservations.calls.reserve).toBe(1);
    expect(reservations.calls.markApplied).toBe(0);
    expect(reservations.calls.markRejected).toBe(0);
  });

  it("records rejected reservations for dispatch gates without mutating state", async () => {
    const reservations = createTrackingReservationRepository();
    const server = createServerWithTrackingReservation(reservations.repository);
    const fixture = await createJsonSubmitFixture(server, {
      instanceId: "instance:safety:pre-gate",
      playerId: "player:safety:pre-gate",
      districtId: "district:safety:pre-gate",
      commandId: "command:safety:pre-gate"
    });
    const assertRejectedReservationWithoutMutation = (rootBefore: number) => {
      expect(fixture.runtime.state.root.version).toBe(rootBefore);
      expect(reservations.calls.reserve).toBe(1);
      expect(reservations.calls.markApplied).toBe(0);
      expect(reservations.calls.markRejected).toBe(1);
    };

    reservations.reset();
    const staleRootBefore = fixture.runtime.state.root.version;
    const stale = await submitJsonCommand(server, {
      ...fixture,
      expectedStateVersion: fixture.runtime.state.root.version + 1
    });
    expect(stale.body.errors[0]?.code).toBe("server.state_version_conflict");
    assertRejectedReservationWithoutMutation(staleRootBefore);

    reservations.reset();
    const modeRootBefore = fixture.runtime.state.root.version;
    const modeMismatch = await submitJsonCommand(server, {
      ...fixture,
      command: {
        ...fixture.command,
        id: "command:safety:pre-gate:mode",
        mode: fixture.runtime.record.mode === "free" ? "war" : "free"
      }
    });
    expect(modeMismatch.body.errors[0]?.code).toBe("server.mode_mismatch");
    assertRejectedReservationWithoutMutation(modeRootBefore);

    reservations.reset();
    fixture.runtime.state.root.phase = PRODUCTION_GAME_LIFECYCLE_PHASES.resolved;
    const resolvedRootBefore = fixture.runtime.state.root.version;
    const resolved = await submitJsonCommand(server, {
      ...fixture,
      command: {
        ...fixture.command,
        id: "command:safety:pre-gate:resolved"
      }
    });
    expect(resolved.body.errors[0]?.code).toBe("server.instance_resolved");
    assertRejectedReservationWithoutMutation(resolvedRootBefore);
    fixture.runtime.state.root.phase = PRODUCTION_GAME_LIFECYCLE_PHASES.live;

    reservations.reset();
    fixture.runtime.commandRateLimitWindow = {
      tick: fixture.runtime.state.root.tick,
      commandCountsByPlayerId: {
        [fixture.command.playerId]: 5
      }
    };
    const rateRootBefore = fixture.runtime.state.root.version;
    const rateLimited = await submitJsonCommand(server, {
      ...fixture,
      command: {
        ...fixture.command,
        id: "command:safety:pre-gate:rate"
      }
    });
    expect(rateLimited.body.errors[0]?.code).toBe("server.rate_limited");
    assertRejectedReservationWithoutMutation(rateRootBefore);
  });

  it("marks core rejection as rejected and reuses stored errors for duplicates", async () => {
    const reservations = createTrackingReservationRepository();
    const server = createServerWithTrackingReservation(reservations.repository);
    const fixture = await createJsonSubmitFixture(server, {
      instanceId: "instance:safety:core-rejection",
      playerId: "player:safety:core-rejection",
      districtId: "district:safety:core-rejection",
      commandId: "command:safety:core-rejection"
    });
    const rejectedCommand = createPlaceTrapCommandFixture({
      id: fixture.command.id,
      mode: fixture.runtime.record.mode,
      playerId: fixture.playerId,
      serverInstanceId: fixture.instanceId,
      payload: {
        districtId: "district:safety:core-rejection:missing"
      }
    });
    const rootBefore = fixture.runtime.state.root.version;

    const first = await submitJsonCommand(server, {
      ...fixture,
      command: rejectedCommand
    });
    const second = await submitJsonCommand(server, {
      ...fixture,
      command: rejectedCommand
    });

    expect(first.body.accepted).toBe(false);
    expect(first.body.errors[0]?.code).toBe("trap_district_not_found");
    expect(second.body.accepted).toBe(false);
    expect(second.body.errors).toEqual(first.body.errors);
    expect(fixture.runtime.state.root.version).toBe(rootBefore);
    expect(reservations.calls.reserve).toBe(2);
    expect(reservations.calls.markApplied).toBe(0);
    expect(reservations.calls.markRejected).toBe(1);
    await expect(reservations.repository.getByCommandId(fixture.instanceId, fixture.command.id))
      .resolves.toMatchObject({
        status: "rejected",
        rejectionErrors: [
          {
            code: "trap_district_not_found"
          }
        ]
      });
  });
});

const createServerWithTrackingReservation = (
  commandReservationRepository: CommandReservationRepository
) => createServerApp({
  persistence: {
    ...createInMemoryRuntimePersistenceRepositories(),
    commandReservationRepository
  }
});

const createTrackingReservationRepository = () => {
  const delegate = createInMemoryCommandReservationRepository();
  const calls = {
    reserve: 0,
    markApplied: 0,
    markRejected: 0
  };
  const repository: CommandReservationRepository = {
    reserve: async (record) => {
      calls.reserve += 1;
      return delegate.reserve(record);
    },
    getByCommandId: (instanceId, commandId) =>
      delegate.getByCommandId(instanceId, commandId),
    markApplied: async (instanceId, commandId, metadata) => {
      calls.markApplied += 1;
      return delegate.markApplied(instanceId, commandId, metadata);
    },
    markRejected: async (instanceId, commandId, errors) => {
      calls.markRejected += 1;
      return delegate.markRejected(instanceId, commandId, errors);
    }
  };

  return {
    repository,
    calls,
    seed: (record: CommandReservationDraft): Promise<CommandReservationReserveResult> =>
      delegate.reserve(record),
    reset: () => {
      calls.reserve = 0;
      calls.markApplied = 0;
      calls.markRejected = 0;
    }
  };
};

interface JsonSubmitFixture {
  server: ServerApp;
  instanceId: string;
  playerId: string;
  focusDistrictId: string;
  sessionToken: string | null | undefined;
  expectedStateVersion: number | null | undefined;
  command: GameCommand;
  runtime: NonNullable<ReturnType<ServerApp["instanceManager"]["getInstanceById"]>>;
}

const createJsonSubmitFixture = async (
  server: ServerApp,
  options: {
    instanceId: string;
    playerId: string;
    districtId: string;
    commandId: string;
  }
): Promise<JsonSubmitFixture> => {
  const session = await createDevGameplaySession(server, {
    serverInstanceId: options.instanceId,
    playerId: options.playerId,
    districtId: options.districtId
  });
  const spawnDistrictId = seedDevSpawnSelection(server, {
    serverInstanceId: options.instanceId,
    playerId: options.playerId,
    requestedDistrictId: options.districtId
  });

  const load = await server.gameplaySliceJsonHandler.handle({
    method: "POST",
    path: "/api/gameplay-slice/load",
    body: {
      ...session.loadRequest,
      districtId: spawnDistrictId
    }
  });
  const readModel = load.body.readModel as GameplaySliceView | null;
  const runtime = server.instanceManager.getInstanceById(options.instanceId);

  if (!readModel || !runtime) {
    throw new Error("Failed to create gameplay slice submit fixture.");
  }

  const focusDistrictId = readModel.district?.districtId ?? spawnDistrictId;

  return {
    server,
    instanceId: options.instanceId,
    playerId: options.playerId,
    focusDistrictId,
    sessionToken: session.sessionToken,
    expectedStateVersion: load.body.metadata?.stateVersion,
    command: createPlaceTrapCommandFixture({
      id: options.commandId,
      mode: readModel.mode.mode,
      playerId: options.playerId,
      serverInstanceId: options.instanceId,
      payload: {
        districtId: focusDistrictId
      }
    }),
    runtime
  };
};

const submitJsonCommand = (
  server: ServerApp,
  fixture: JsonSubmitFixture
) => server.gameplaySliceJsonHandler.handle({
  method: "POST",
  path: "/api/gameplay-slice/submit",
  body: {
    sessionToken: fixture.sessionToken,
    expectedStateVersion: fixture.expectedStateVersion,
    focusDistrictId: fixture.focusDistrictId,
    command: fixture.command
  }
});

const createReservationDraft = (
  instanceId: string,
  command: GameCommand
): CommandReservationDraft => ({
  serverInstanceId: instanceId,
  commandId: command.id,
  commandType: command.type,
  playerId: command.playerId,
  payloadHash: createCommandReservationPayloadHash(command),
  payload: createCommandReservationPayload(command),
  reservedAt: "2026-05-17T17:00:00.000Z"
});
