/**
 * Responsibility: Small per-instance queue for runtime events waiting to be published.
 * Belongs here: enqueue, drain, and lightweight queue counters.
 * Does not belong here: websocket fanout, persistence, or business rules.
 */
export class InstanceEventQueue<TEvent = unknown> {
  private readonly events: TEvent[] = [];

  enqueue(event: TEvent): void {
    this.events.push(event);
  }

  drain(): TEvent[] {
    return this.events.splice(0, this.events.length);
  }

  size(): number {
    return this.events.length;
  }
}

