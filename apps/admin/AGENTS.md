# Admin Layer Rules

- Admin is never the source of truth.
- Do not place gameplay logic in admin UI, admin services, or read-model modules.
- Read data through admin-safe projections and service boundaries only.
- Keep admin commands separate from player commands.
- Do not import `game-core` into the admin app.
- Keep admin modules small and monitoring-focused.

