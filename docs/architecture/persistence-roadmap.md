# Persistence Roadmap

## Scope

This is a design spike for production persistence of authoritative Empire Streets
server instances. It does not implement a database, change runtime behavior, or
change gameplay logic.

The target scenario is one authoritative 20-player battle royale instance with:

- server-owned `CoreGameState`
- multiplayer membership
- local/dev tick loop
- snapshot repository boundaries
- command and event log boundaries
- temporary snapshot token fallback for serverless/dev flows

## Current State

The server already has the right persistence seams, but they are mostly null or
development-only boundaries:

- `SnapshotRepository`
  - `save(snapshot)`
  - `loadLatest(instanceId)`
  - current default: `createNullSnapshotRepository()`
- `CommandLogRepository`
  - `append(record)`
  - `listByInstance(instanceId)`
  - current default: `createNullCommandLogRepository()`
- `EventLogRepository`
  - `append(record)`
  - `listByInstance(instanceId)`
  - current default: `createNullEventLogRepository()`
- `GameStateRepository`
  - compatibility facade over snapshot save/load services
- `InstanceSnapshotDto`
  - contains `instanceId`, `tick`, `mode`, version metadata, integrity metadata,
    runtime command guard state, and normalized `CoreGameState`
- snapshot token codec
  - useful for serverless/cold restore and local development
  - not a production source of truth

Recent multiplayer work means one instance can contain multiple players. That
makes client-carried snapshots more dangerous: a token from one player can be
older than the shared warm runtime used by other players.

## Snapshot Token Risk

Snapshot tokens are convenient, but they are not a shared authoritative store.
For real 20-player multiplayer they have these risks:

- A stale client token can represent an older tick than the current instance.
- A token can miss players who joined after the token was issued.
- A token can miss commands or events processed by the warm runtime.
- A token restore after a cold start can fork the instance if no shared store is
  consulted first.
- Tokens make conflict resolution depend on client request timing.
- Tokens are poor audit records because the canonical command/event history is
  not guaranteed to be centralized.

The current stale-token guard prevents overwriting an existing warm runtime, but
production still needs a shared store that can answer: "What is the latest
authoritative tick for this instance?"

## Persistence Options

### Option A: Redis-like Volatile Instance Store

Store the latest instance snapshot in a fast shared key-value system. Use TTLs
or explicit lifecycle cleanup for ended instances.

Pros:

- Simple operational model for local/dev and short-lived matches.
- Fast load/save path.
- Good fit for active instance cache and lease heartbeat.
- Easy to pair with an in-memory runtime owner.

Cons:

- Volatile by default; crash or eviction can lose the match.
- Weak audit trail unless command/event logs are stored elsewhere.
- Harder to debug disputes or replay matches after the fact.
- Not enough as the only source of truth for 3-4 day battle royale instances.

Best use in this project:

- Cache active snapshots.
- Store short leases.
- Do not use as the only canonical persistence layer.

### Option B: Postgres Snapshot + Command/Event Log

Persist periodic snapshots plus append-only command and event records in a
relational database. Runtime owns active state, but Postgres owns recovery and
history.

Pros:

- Durable canonical state.
- Easy to query latest snapshot by `instanceId` and `tick`.
- Command/event audit is straightforward.
- Good support for idempotency keys, unique command IDs, and integrity checks.
- Fits the existing repository boundaries.
- Keeps deployment choices open.

Cons:

- Requires schema, migrations, and operational discipline.
- Snapshot writes must be throttled or batched.
- Needs a lock/lease strategy so two runtimes do not own the same instance.
- More work than volatile cache-only storage.

Best use in this project:

- Canonical production persistence.
- Store latest snapshots, command log, event log, instance metadata, and leases.

### Option C: Durable Object / Actor-per-Instance

Route each instance to one durable actor. The actor owns state, ticks, commands,
and persistence for that instance.

Pros:

- Very clean authority model: one actor owns one instance.
- Locking becomes routing/ownership instead of shared lease tables.
- Good fit for multiplayer instance isolation.
- Reduces cross-process coordination complexity.

Cons:

- Platform-specific architecture.
- May constrain deployment away from the current Node/serverless shape.
- Requires careful integration with existing runtime composition.
- Less portable than repository-backed Postgres.

Best use in this project:

- Strong long-term option if the deployment platform is intentionally actor
  based.
- Not the smallest next step for the current repository.

### Option D: Custom Node Authoritative Process

Run a long-lived Node process that owns active instances in memory and saves to a
persistent store.

Pros:

- Closest to the current server runtime model.
- Easy local development path.
- Works well with the existing tick loop and `ServerInstanceManager`.

Cons:

- Needs process supervision, failover, and instance ownership rules.
- In-memory state alone is not durable.
- Horizontal scaling requires leases or actor routing anyway.

Best use in this project:

- Runtime owner model for local/dev and early production.
- Pair with Postgres persistence before treating it as production-ready.

## Recommendation

Use **Postgres snapshot + command/event log as the canonical durable store**,
with **single-owner runtime execution per instance**.

The recommended shape is:

1. A Node runtime process owns active instances in memory.
2. A Postgres repository adapter persists snapshots, commands, events, and
   instance metadata.
3. A lease/lock prevents two runtime owners from mutating the same instance at
   the same time.
4. Snapshot tokens remain a dev/serverless fallback only, and never override a
   newer persisted snapshot or warm runtime.
5. Redis-like storage can be added later as a cache or lease acceleration layer,
   but not as the canonical state store.

This path matches the existing code best: the repository boundaries already
exist, `InstanceSnapshotDto` already contains the important runtime/state data,
and multiplayer membership/tick loop can stay server-authoritative.

## Minimal Interface

The existing interfaces are already close. Production adapters should converge
on this capability set:

```ts
interface AuthoritativeInstancePersistence {
  saveSnapshot(snapshot: InstanceSnapshotDto): Promise<void>;
  loadLatestSnapshot(instanceId: ServerInstanceId): Promise<InstanceSnapshotDto | null>;

  appendCommand(record: CommandRecord): Promise<void>;
  appendEvent(record: EventRecord): Promise<void>;

  acquireInstanceLock(request: AcquireInstanceLockRequest): Promise<InstanceLock | null>;
  renewInstanceLock(lock: InstanceLock): Promise<InstanceLock | null>;
  releaseInstanceLock(lock: InstanceLock): Promise<void>;
}

interface AcquireInstanceLockRequest {
  instanceId: ServerInstanceId;
  ownerId: string;
  ttlMs: number;
}

interface InstanceLock {
  instanceId: ServerInstanceId;
  ownerId: string;
  leaseToken: string;
  expiresAt: string;
}
```

If the project moves to an actor-per-instance platform, `acquireInstanceLock`
can be replaced by actor ownership/routing. The rest of the save/load and
append-only history contracts still remain useful for audit and recovery.

## Minimum First Implementation Step

Do not start with a full production database rollout. Start with a repository
adapter boundary that can be tested without changing gameplay behavior:

1. Add a concrete persistence adapter behind the existing repository interfaces.
2. Keep the default repository as null/in-memory for dev tests.
3. Add contract tests for `saveSnapshot`, `loadLatestSnapshot`,
   `appendCommand`, and `appendEvent`.
4. Add lock/lease contract tests before enabling multi-process runtime ownership.
5. Wire the adapter through the server composition root behind explicit config.

The first safe code step is therefore:

> Implement a Postgres-backed repository adapter behind `SnapshotRepository`,
> `CommandLogRepository`, and `EventLogRepository`, but keep it disabled by
> default until runtime save/load tests are green.

## Migration Plan

### Phase 1: Repository Adapter

- Add production adapter implementations for snapshots, command log, and event
  log.
- Add schema/migration scripts.
- Preserve null repositories as defaults for tests and local lightweight flows.
- Add adapter contract tests.

### Phase 2: Runtime Save/Load

- On instance creation, load the latest persisted snapshot before creating fresh
  state.
- On tick or controlled intervals, save snapshots with monotonically increasing
  `tick`.
- Append accepted commands before or during command processing with idempotency
  keys.
- Append emitted domain events after command/tick processing.
- Never let persisted snapshots move an instance backwards in `root.tick`.

### Phase 3: Stale Token Fallback

- Treat snapshot tokens as development/serverless fallback only.
- When persistent storage is enabled, compare token tick with latest persisted
  snapshot tick.
- Ignore or reject token restore if storage has a newer tick.
- Keep `instanceId` mismatch rejection.
- Include response metadata so clients can detect stale read models.

### Phase 4: Ownership and Monitoring

- Add instance lease/lock or actor ownership.
- Track owner ID, lease expiry, last persisted tick, last processed tick, and
  snapshot age.
- Expose health data for active instances.
- Alert on stuck tick, stale lease, failed snapshot save, and command append
  failure.

## Test Strategy

Persistence tests should prove durability, monotonicity, and multiplayer safety:

- Snapshot contract:
  - save/load latest by `instanceId`
  - latest snapshot is selected by highest `tick`
  - older snapshot cannot replace newer snapshot
  - snapshot integrity metadata is preserved
- Command/event logs:
  - append is ordered per instance
  - duplicate command IDs are idempotent or rejected
  - events can be listed by instance and tick range
- Membership:
  - player 1 creates instance, player 2 joins same instance
  - 20 players survive save/load
  - 21st player remains rejected after restore
- Tick recovery:
  - run ticks, save snapshot, restore, continue from same or higher tick
  - no restore path can move `root.tick` backwards
- Stale token:
  - token older than persisted snapshot is ignored or rejected
  - token missing a newly joined player cannot overwrite persisted state
- Locking:
  - only one owner can acquire active lease
  - expired lease can be reacquired
  - stale owner cannot save without valid ownership if lock enforcement is
    enabled
- Crash recovery:
  - restore latest snapshot
  - replay commands/events only if the replay model is explicitly introduced
  - verify read model metadata matches restored runtime tick

## Open Decisions

- Snapshot cadence: every N ticks, after important commands, on shutdown, or a
  hybrid.
- Command log ordering: database sequence, runtime tick, command timestamp, or
  all three.
- Event replay: audit-only at first, replay-capable later if needed.
- Lease enforcement: repository-level guard, runtime manager guard, or actor
  routing.
- Snapshot compression: probably useful later, not required for the first
  adapter.

## Non-Goals

- No database implementation in this spike.
- No runtime behavior change.
- No game-core change.
- No UI change.
- No replacement of snapshot token codec.
- No WebSocket, SSE, auth, matchmaking, or production deployment design.
