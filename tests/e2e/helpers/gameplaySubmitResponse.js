import {
  isDurableStateVersionConflictResponse,
  MAX_DURABLE_STATE_VERSION_REBASES
} from "../../../page-assets/js/app/runtime/serverGameplayConflictPolicy.js";

const gameplaySubmitPath = "/api/gameplay-slice/submit";

const readRequestBody = (request) => {
  try {
    return request.postDataJSON();
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

export const isDurableStateVersionConflict = isDurableStateVersionConflictResponse;
export { MAX_DURABLE_STATE_VERSION_REBASES };

export const isTerminalGameplaySubmitAttempt = (body, previousStateVersionConflictCount = 0) => (
  !isDurableStateVersionConflict(body)
  || previousStateVersionConflictCount >= MAX_DURABLE_STATE_VERSION_REBASES
);

const isGameplaySubmitRequest = (request) => {
  try {
    return new URL(request.url()).pathname === gameplaySubmitPath
      && request.method() === "POST";
  } catch {
    return false;
  }
};

export function waitForTerminalGameplaySubmit(page, matchesRequest, options = {}) {
  const timeout = options.timeout ?? 30_000;
  const abortSignal = options.signal ?? null;

  return new Promise((resolve, reject) => {
    const attempts = [];
    const matchingRequests = new Map();
    let responseQueue = Promise.resolve();
    let requestTimeout = null;
    let terminalTimeout = null;
    let settled = false;

    const removePageListener = (event, listener) => {
      if (typeof page.off === "function") {
        page.off(event, listener);
      } else if (typeof page.removeListener === "function") {
        page.removeListener(event, listener);
      }
    };

    const cleanup = () => {
      if (requestTimeout !== null) clearTimeout(requestTimeout);
      if (terminalTimeout !== null) clearTimeout(terminalTimeout);
      requestTimeout = null;
      terminalTimeout = null;
      removePageListener("request", onRequest);
      removePageListener("response", onResponse);
      removePageListener("close", onClose);
      abortSignal?.removeEventListener?.("abort", onAbort);
      matchingRequests.clear();
    };

    const finishWithError = (error) => {
      if (settled) return;
      settled = true;
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      const evidence = attempts.map(({ request, response, body }) => ({ request, response, body }));
      normalizedError.attempts = evidence;
      normalizedError.request = evidence.at(-1)?.request ?? null;
      cleanup();
      reject(normalizedError);
    };

    const startTerminalTimeout = () => {
      if (terminalTimeout !== null || settled) return;
      terminalTimeout = setTimeout(() => {
        finishWithError(new Error(
          `Timed out after ${timeout}ms waiting for a terminal gameplay submit response.`
        ));
      }, timeout);
    };

    const startRequestTimeout = () => {
      requestTimeout = setTimeout(() => {
        finishWithError(new Error(
          `Timed out after ${timeout}ms waiting for a matching gameplay submit request.`
        ));
      }, timeout);
    };

    const observeMatchingRequest = (request, matchCandidate = request) => {
      const existing = matchingRequests.get(request);
      if (existing) return existing;
      if (!isGameplaySubmitRequest(request)) return false;

      const requestBody = readRequestBody(request);
      let matches = false;
      try {
        matches = Boolean(matchesRequest(requestBody, matchCandidate));
      } catch (error) {
        finishWithError(error);
        return false;
      }
      if (!matches) return false;

      const attempt = {
        body: null,
        request: requestBody,
        response: null,
        responseParsed: false
      };
      attempts.push(attempt);
      matchingRequests.set(request, attempt);
      if (requestTimeout !== null) clearTimeout(requestTimeout);
      requestTimeout = null;
      startTerminalTimeout();
      return attempt;
    };

    const finishWithResponse = (response, terminal) => {
      if (settled) return;
      settled = true;
      const stateVersionConflicts = attempts.filter((attempt) => (
        isDurableStateVersionConflict(attempt.body)
      ));
      cleanup();
      resolve({
        attempts,
        body: terminal?.body || null,
        request: terminal?.request || null,
        response,
        stateVersionConflicts
      });
    };

    const processResponse = async (candidate) => {
      if (settled) return;
      const requestHandle = candidate.request();
      const attempt = observeMatchingRequest(requestHandle, candidate);
      if (!attempt || settled) return;

      attempt.response = candidate;
      attempt.body = await readResponseBody(candidate);
      attempt.responseParsed = true;
      if (settled) return;

      let previousStateVersionConflictCount = 0;
      for (const orderedAttempt of attempts) {
        if (!orderedAttempt.responseParsed) return;
        if (isTerminalGameplaySubmitAttempt(
          orderedAttempt.body,
          previousStateVersionConflictCount
        )) {
          finishWithResponse(orderedAttempt.response, orderedAttempt);
          return;
        }
        previousStateVersionConflictCount += 1;
      }
    };

    function onRequest(request) {
      observeMatchingRequest(request);
    }

    function onResponse(response) {
      responseQueue = responseQueue.then(() => processResponse(response));
      void responseQueue.catch(finishWithError);
    }

    function onClose() {
      finishWithError(new Error("Page closed while waiting for a terminal gameplay submit response."));
    }

    function onAbort() {
      const reason = abortSignal?.reason;
      const error = reason instanceof Error
        ? reason
        : new Error(reason ? String(reason) : "Gameplay submit wait aborted.");
      finishWithError(error);
    }

    if (abortSignal?.aborted) {
      onAbort();
      return;
    }
    page.on("request", onRequest);
    page.on("response", onResponse);
    page.on("close", onClose);
    abortSignal?.addEventListener?.("abort", onAbort, { once: true });
    startRequestTimeout();
    if (typeof page.isClosed === "function" && page.isClosed()) onClose();
  });
}
