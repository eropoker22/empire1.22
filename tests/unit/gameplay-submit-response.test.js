import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isTerminalGameplaySubmitAttempt,
  waitForTerminalGameplaySubmit
} from "../e2e/helpers/gameplaySubmitResponse.js";

const stateVersionConflict = Object.freeze({
  accepted: false,
  errors: [{ code: "server.state_version_conflict" }]
});

class FakePage extends EventEmitter {
  #closed = false;

  isClosed() {
    return this.#closed;
  }

  close() {
    this.#closed = true;
    this.emit("close");
  }
}

const createSubmitAttempt = ({
  commandType = "invite-alliance-member",
  responseBody = { accepted: true, errors: [] }
} = {}) => {
  const requestBody = { command: { type: commandType } };
  const request = {
    method: () => "POST",
    postDataJSON: () => requestBody,
    url: () => "http://127.0.0.1:4174/api/gameplay-slice/submit"
  };
  const response = {
    json: vi.fn(async () => responseBody),
    request: () => request,
    status: () => 200,
    url: request.url
  };
  return { request, requestBody, response };
};

const emitSubmitAttempt = (page, attempt) => {
  page.emit("request", attempt.request);
  page.emit("response", attempt.response);
};

const matchesInvite = (request) => request?.command?.type === "invite-alliance-member";

afterEach(() => {
  vi.useRealTimers();
});

describe("gameplay submit response waiter", () => {
  it("waits past the first durable state-version conflict", () => {
    expect(isTerminalGameplaySubmitAttempt(stateVersionConflict, 0)).toBe(false);
  });

  it("treats the second durable conflict as the transport terminal response", () => {
    expect(isTerminalGameplaySubmitAttempt(stateVersionConflict, 1)).toBe(true);
  });

  it("returns immediately for a non-conflict response", () => {
    expect(isTerminalGameplaySubmitAttempt({ accepted: true, errors: [] }, 0)).toBe(true);
  });

  it("captures an immediate response after listeners are registered", async () => {
    const page = new FakePage();
    const attempt = createSubmitAttempt();
    const waiting = waitForTerminalGameplaySubmit(page, matchesInvite);

    emitSubmitAttempt(page, attempt);

    await expect(waiting).resolves.toMatchObject({
      attempts: [{ request: attempt.requestBody, response: attempt.response }],
      body: { accepted: true, errors: [] },
      request: attempt.requestBody,
      response: attempt.response,
      stateVersionConflicts: []
    });
    expect(page.listenerCount("request")).toBe(0);
    expect(page.listenerCount("response")).toBe(0);
    expect(page.listenerCount("close")).toBe(0);
  });

  it("treats the second durable conflict response as terminal", async () => {
    const page = new FakePage();
    const first = createSubmitAttempt({ responseBody: stateVersionConflict });
    const second = createSubmitAttempt({ responseBody: stateVersionConflict });
    const waiting = waitForTerminalGameplaySubmit(page, matchesInvite);

    emitSubmitAttempt(page, first);
    emitSubmitAttempt(page, second);

    const result = await waiting;
    expect(result.response).toBe(second.response);
    expect(result.attempts.map((attempt) => attempt.response)).toEqual([
      first.response,
      second.response
    ]);
    expect(result.stateVersionConflicts).toHaveLength(2);
  });

  it("does not spend the terminal response budget before the matching request", async () => {
    vi.useFakeTimers();
    const page = new FakePage();
    const attempt = createSubmitAttempt();
    const waiting = waitForTerminalGameplaySubmit(page, matchesInvite, { timeout: 25 });

    await vi.advanceTimersByTimeAsync(24);
    page.emit("request", attempt.request);
    await vi.advanceTimersByTimeAsync(24);
    page.emit("response", attempt.response);

    await expect(waiting).resolves.toMatchObject({ response: attempt.response });
  });

  it("starts the terminal timeout with the first matching request and cleans up", async () => {
    vi.useFakeTimers();
    const page = new FakePage();
    const attempt = createSubmitAttempt();
    const waiting = waitForTerminalGameplaySubmit(page, matchesInvite, { timeout: 25 });
    const outcome = waiting.catch((reason) => reason);
    page.emit("request", attempt.request);
    await vi.advanceTimersByTimeAsync(25);

    const error = await outcome;
    expect(error).toMatchObject({
      attempts: [{ body: null, request: attempt.requestBody, response: null }],
      request: attempt.requestBody
    });
    expect(error.message).toBe(
      "Timed out after 25ms waiting for a terminal gameplay submit response."
    );
    expect(page.listenerCount("request")).toBe(0);
    expect(page.listenerCount("response")).toBe(0);
    expect(page.listenerCount("close")).toBe(0);
  });

  it("times out cleanly when no matching request is emitted", async () => {
    vi.useFakeTimers();
    const page = new FakePage();
    const waiting = waitForTerminalGameplaySubmit(page, matchesInvite, { timeout: 25 });
    const outcome = waiting.catch((reason) => reason);

    await vi.advanceTimersByTimeAsync(25);

    await expect(outcome).resolves.toMatchObject({
      attempts: [],
      request: null,
      message: "Timed out after 25ms waiting for a matching gameplay submit request."
    });
    expect(page.listenerCount("request")).toBe(0);
    expect(page.listenerCount("response")).toBe(0);
    expect(page.listenerCount("close")).toBe(0);
  });

  it("rejects on page close and removes every listener", async () => {
    const page = new FakePage();
    const waiting = waitForTerminalGameplaySubmit(page, matchesInvite);
    const rejection = expect(waiting).rejects.toThrow(
      "Page closed while waiting for a terminal gameplay submit response."
    );

    page.close();

    await rejection;
    expect(page.listenerCount("request")).toBe(0);
    expect(page.listenerCount("response")).toBe(0);
    expect(page.listenerCount("close")).toBe(0);
  });

  it("cancels a waiter when the triggering click fails", async () => {
    const page = new FakePage();
    const abortController = new AbortController();
    const waiting = waitForTerminalGameplaySubmit(page, matchesInvite, {
      signal: abortController.signal
    });
    const clickError = new Error("Submit button detached before the click completed.");
    const rejection = expect(waiting).rejects.toBe(clickError);

    abortController.abort(clickError);

    await rejection;
    expect(page.listenerCount("request")).toBe(0);
    expect(page.listenerCount("response")).toBe(0);
    expect(page.listenerCount("close")).toBe(0);
  });
});
