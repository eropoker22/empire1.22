import type { AllianceMembership } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreError } from "../errors";
import type { CoreEvent } from "../events";
import type { GameCoreContext } from "../engine/context";
import { getAllianceLifecycleConfig } from "../rules/alliances/allianceLifecycle";

export type AllianceMembershipResult = { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] };

export const createInitialAllianceMembership = (
  allianceId: string,
  playerId: string,
  role: AllianceMembership["role"],
  nowIso: string,
  context: GameCoreContext
): AllianceMembership => {
  const config = getAllianceLifecycleConfig(context);
  const readyDueAt = addSecondsIso(nowIso, config.readiness.readyIntervalSeconds);
  return {
    allianceId,
    playerId,
    role,
    joinedAt: nowIso,
    status: "active",
    lastReadyAt: nowIso,
    readyDueAt,
    graceEndsAt: addSecondsIso(readyDueAt, config.readiness.gracePeriodSeconds),
    version: 1
  };
};

export const sanitizeAllianceName = (value: string): string => String(value || "").trim().slice(0, 32);

export const sanitizeAllianceTag = (value: string): string =>
  String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/gu, "").slice(0, 8) || "AL";

export const sanitizeAllianceEmblemColor = (value: string | undefined, fallback = "#f7c948"): string => {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
};

export const nowIsoFromContext = (context: GameCoreContext): string =>
  context.clock?.nowIso?.() ?? new Date().toISOString();

export const rejected = (state: CoreGameState, code: string, message: string): AllianceMembershipResult => ({
  nextState: state,
  events: [],
  errors: [{ code, message } as CoreError]
});

const addSecondsIso = (isoValue: string, seconds: number): string =>
  new Date(Date.parse(isoValue) + Math.max(0, seconds) * 1000).toISOString();
