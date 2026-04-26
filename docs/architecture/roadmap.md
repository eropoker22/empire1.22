# Implementation Roadmap

## Phase 1 - Skeleton

- establish workspaces and package boundaries
- define path aliases and import contracts
- add architecture docs and package responsibilities

## Phase 2 - Shared contracts

- define IDs, commands, events, DTOs, error codes
- add schema validation and transport-safe serialization rules

## Phase 3 - Core runtime

- define game instance root state
- add command handlers and tick engine contracts
- create projection interfaces for player and admin views

## Phase 4 - Mode composition

- build base config primitives
- create `free` and `war` mode factories
- wire server bootstrap to mode registries

## Phase 5 - Server shell

- add HTTP/WebSocket transport
- add instance registry and lifecycle runtime
- add persistence interfaces and snapshot storage

## Phase 6 - Client shell

- add route shells for `/free` and `/war`
- add connection bootstrap and command dispatch flow
- render server-provided projections only

## Phase 7 - Debug isolation

- add seeds, scenarios, replay tooling, and local simulators
- keep all debug entrypoints out of production server boot

## Phase 8 - First vertical slice

- connect player to one instance
- load one district projection
- submit build command for one building type
- resolve on server and re-render the updated state

## Phase 9 - First PvP conflict slice

- submit `spy-district`, `place-trap`, and `attack-district` through the migrated command boundary
- keep trap state hidden in the authoritative core and expose it only through owner projection or spy reports
- resolve battle and spy outcomes in `packages/game-core`
- return server-fed battle/spy reports inside the gameplay slice projection
