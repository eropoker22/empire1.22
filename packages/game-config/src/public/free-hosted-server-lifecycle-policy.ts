export interface FreeHostedServerLifecyclePolicy {
  readonly version: 1;
  readonly minimumReadyPlayersToStart: number;
  readonly registrationWindowMs: number;
  readonly allowJoinsWhileRunningDuringWindow: boolean;
  readonly requireFreshWorkerForRegistration: boolean;
  readonly allowSetupCompletionAfterWindow: boolean;
}

export type FreeHostedServerTemplate = "control" | "full";

export interface FreeHostedServerTemplatePolicy {
  readonly template: FreeHostedServerTemplate;
  readonly eliminationEnabled: boolean;
  readonly capacityPolicy: "configurable" | "canonical_max";
}

export const FREE_HOSTED_SERVER_LIFECYCLE_POLICY = Object.freeze({
  version: 1,
  minimumReadyPlayersToStart: 2,
  registrationWindowMs: 60 * 60 * 1000,
  allowJoinsWhileRunningDuringWindow: true,
  requireFreshWorkerForRegistration: true,
  allowSetupCompletionAfterWindow: true
} satisfies FreeHostedServerLifecyclePolicy);

export const FREE_HOSTED_SERVER_TEMPLATE_POLICIES = Object.freeze({
  control: Object.freeze({
    template: "control",
    eliminationEnabled: false,
    capacityPolicy: "configurable"
  }),
  full: Object.freeze({
    template: "full",
    eliminationEnabled: true,
    capacityPolicy: "canonical_max"
  })
} satisfies Record<FreeHostedServerTemplate, FreeHostedServerTemplatePolicy>);
