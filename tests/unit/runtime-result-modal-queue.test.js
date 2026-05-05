import { describe, expect, it } from "vitest";
import { createResultModalQueue } from "../../page-assets/js/app/ui/resultModalQueue.js";

class FakeClassList {
  constructor() {
    this.tokens = new Set();
  }

  add(...tokens) {
    for (const token of tokens) {
      this.tokens.add(token);
    }
  }

  contains(token) {
    return this.tokens.has(token);
  }
}

class FakeModal {
  constructor() {
    this.classList = new FakeClassList();
  }
}

describe("result modal queue", () => {
  it("opens immediately when no modal is visible", () => {
    const calls = [];
    const queue = createResultModalQueue({
      getVisibleModal: () => null,
      openByKind: (_root, kind, payload) => calls.push({ kind, payload })
    });

    queue.queueOrOpen({}, "attack", { ok: true });

    expect(calls).toEqual([{ kind: "attack", payload: { ok: true } }]);
    expect(queue.getQueueSize()).toBe(0);
  });

  it("queues while a modal is visible and opens next item after close", () => {
    const calls = [];
    const visibleModal = new FakeModal();
    const closingModal = new FakeModal();
    const root = { querySelector: () => closingModal };
    let visible = visibleModal;
    const queue = createResultModalQueue({
      getVisibleModal: () => visible,
      openByKind: (_root, kind, payload) => calls.push({ kind, payload }),
      setTimeout: (callback) => callback()
    });

    queue.queueOrOpen(root, "spy", { id: 1 });
    expect(queue.getQueueSize()).toBe(1);

    visible = null;
    queue.close(root, "[data-modal]");

    expect(closingModal.classList.contains("hidden")).toBe(true);
    expect(calls).toEqual([{ kind: "spy", payload: { id: 1 } }]);
    expect(queue.getQueueSize()).toBe(0);
  });
});
