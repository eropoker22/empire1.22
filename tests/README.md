# Testing Strategy

## Layers

- `tests/unit` - isolated pure-function tests, mainly `packages/game-core`
- `tests/integration` - command to state/event flow tests
- `tests/server` - instance manager and orchestration tests
- `tests/persistence` - snapshot and restore tests
- `tests/read-models` - admin-safe summary and projection tests

## Naming

- file names: `*.test.ts`
- fixtures: `createXFixture`
- describe blocks: module name first, scenario second
- tests should be deterministic and avoid timers or network

