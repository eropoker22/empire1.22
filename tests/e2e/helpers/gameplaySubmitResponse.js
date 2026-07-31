const gameplaySubmitPath = "/api/gameplay-slice/submit";

const readRequestBody = (response) => {
  try {
    return response.request().postDataJSON();
  } catch {
    return null;
  }
};

const readResponseBody = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export const isDurableStateVersionConflict = (body) => {
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  return body?.accepted === false
    && body?.pending !== true
    && body?.transportFailure !== true
    && errors.length === 1
    && String(errors[0]?.code || "") === "server.state_version_conflict";
};

export async function waitForTerminalGameplaySubmit(page, matchesRequest, options = {}) {
  const attempts = [];
  const response = await page.waitForResponse(async (candidate) => {
    if (
      new URL(candidate.url()).pathname !== gameplaySubmitPath
      || candidate.request().method() !== "POST"
    ) {
      return false;
    }
    const request = readRequestBody(candidate);
    if (!matchesRequest(request, candidate)) return false;
    const body = await readResponseBody(candidate);
    attempts.push({ body, request, response: candidate });
    return !isDurableStateVersionConflict(body);
  }, { timeout: options.timeout ?? 30_000 });
  const terminal = attempts.findLast((attempt) => attempt.response === response);
  return {
    attempts,
    body: terminal?.body || null,
    request: terminal?.request || null,
    response,
    stateVersionConflicts: attempts.filter((attempt) => (
      isDurableStateVersionConflict(attempt.body)
    ))
  };
}
