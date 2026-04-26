# Client Layer Rules

- Keep the client thin: render server-fed state and dispatch commands only.
- Do not place gameplay rules, combat math, economy calculations, or police logic in UI modules.
- Keep map rendering separate from game rules and server communication.
- Treat notifications, reports, and modals as presentation concerns over server-fed data.
- Keep debug modules isolated from the production client surface.
- Do not import `game-core` into the client.

