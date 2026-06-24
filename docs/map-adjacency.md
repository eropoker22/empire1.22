# Map Adjacency

Adjacency is stored in `neighborIds` on each manifest district. A neighbor means districts share a real edge segment. Center distance, same zone, visual proximity, and corner-only contact are not adjacency rules.

Current adjacency was derived from the canvas polygons by matching shared polygon edge segments. The output is stored in the manifest, and gameplay reads that stored graph.

Validation lives in `packages/game-config/src/maps/empire-city-map-validation.ts` and checks:

- unique district IDs and legacy IDs
- valid zones
- valid polygons
- no duplicate neighbors
- no self-neighbors
- every neighbor exists
- symmetric adjacency
- connected graph
- Downtown count
- spawn candidates and spawn zones

Debug reporting also exposes articulation points, bridge edges, chokepoints, distance to Downtown, spawn candidate neighbor counts, and spawn routes to center.
