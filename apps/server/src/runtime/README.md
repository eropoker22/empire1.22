# Runtime

Multi-instance runtime for player realms and game servers.

- instance lifecycle
- scheduler ownership
- authoritative state loading and persistence boundaries
- server is the only source of truth for game state
- each instance keeps isolated config, state, queues, logs, and monitoring
