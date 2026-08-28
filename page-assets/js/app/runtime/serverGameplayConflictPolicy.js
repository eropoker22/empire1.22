export const DURABLE_STATE_VERSION_CONFLICT_CODE = "server.state_version_conflict";

export const MAX_DURABLE_STATE_VERSION_REBASES = 2;

export const isDurableStateVersionConflictResponse = (response) => {
  const errors = Array.isArray(response?.errors) ? response.errors : [];
  return response?.accepted === false
    && response?.pending !== true
    && response?.transportFailure !== true
    && errors.length === 1
    && String(errors[0]?.code || "") === DURABLE_STATE_VERSION_CONFLICT_CODE;
};
