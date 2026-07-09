import { describe, expect, it, vi } from "vitest";
import { createMapRenderScheduler } from "../../page-assets/js/app/map/mapRenderScheduler.js";

class FakeDocument {
  constructor() {
    this.hidden = false;
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type, listener) {
    if (this.listeners.get(type) === listener) {
      this.listeners.delete(type);
    }
  }

  dispatchVisibilityChange() {
    this.listeners.get("visibilitychange")?.();
  }
}

class FakeWindow {
  constructor() {
    this.frames = new Map();
    this.nextFrameId = 1;
    this.cancelled = [];
    this.performance = { now: () => this.now };
    this.now = 0;
  }

  requestAnimationFrame(callback) {
    const id = this.nextFrameId;
    this.nextFrameId += 1;
    this.frames.set(id, callback);
    return id;
  }

  cancelAnimationFrame(id) {
    this.cancelled.push(id);
    this.frames.delete(id);
  }

  fireFrame(id, time) {
    const callback = this.frames.get(id);
    this.frames.delete(id);
    this.now = time;
    callback?.(time);
  }
}

describe("map render scheduler", () => {
  it("does not render until marked dirty and coalesces clean frames", () => {
    const windowRef = new FakeWindow();
    const documentRef = new FakeDocument();
    const render = vi.fn();
    const scheduler = createMapRenderScheduler({ windowRef, documentRef, render });

    expect(render).not.toHaveBeenCalled();

    scheduler.invalidate("selected-district");
    expect(scheduler.isScheduled()).toBe(true);
    windowRef.fireFrame(1, 16);

    expect(render).toHaveBeenCalledTimes(1);
    expect(scheduler.isDirty()).toBe(false);

    scheduler.flush(32);

    expect(render).toHaveBeenCalledTimes(1);
  });

  it("keeps dirty work paused while the document is hidden", () => {
    const windowRef = new FakeWindow();
    const documentRef = new FakeDocument();
    const render = vi.fn();
    const scheduler = createMapRenderScheduler({ windowRef, documentRef, render });

    documentRef.hidden = true;
    scheduler.invalidate("server-slice");

    expect(scheduler.isDirty()).toBe(true);
    expect(scheduler.isScheduled()).toBe(false);

    documentRef.hidden = false;
    documentRef.dispatchVisibilityChange();
    windowRef.fireFrame(1, 40);

    expect(render).toHaveBeenCalledTimes(1);
  });

  it("cleanup cancels pending frames and removes visibility listener", () => {
    const windowRef = new FakeWindow();
    const documentRef = new FakeDocument();
    const render = vi.fn();
    const scheduler = createMapRenderScheduler({ windowRef, documentRef, render });

    scheduler.invalidate("resize");
    scheduler.destroy();
    scheduler.destroy();

    expect(windowRef.cancelled).toEqual([1]);
    expect(documentRef.listeners.size).toBe(0);
    windowRef.fireFrame(1, 16);
    expect(render).not.toHaveBeenCalled();
  });
});

