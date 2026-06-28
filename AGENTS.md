# Project Instructions for AI Agents

These instructions apply to the whole repository unless a more specific `AGENTS.md` in a subdirectory adds narrower rules.

## Testing policy for AI agents

- Do not automatically run the full test suite after every small change.
- Do not automatically run E2E tests after every change. E2E is intentionally treated as an expensive verification step.
- Run E2E tests only when the change affects one of these areas:
  - login, registration, or onboarding flow
  - the main `game.html` flow
  - routing, server selection, lobby flow, or game start
  - a critical browser interaction that unit tests do not cover well
  - the user explicitly asks for E2E tests
- For smaller changes, prefer the narrowest useful verification:
  - a targeted unit test for the changed file or behavior
  - `npm run typecheck`
  - lint only when relevant to the touched code
  - no test run for copywriting, documentation, minor visual CSS, or small layout-only changes
- Before running expensive tests such as E2E, first state why they are necessary for the current change.
- If tests are not run, the final response must say so clearly, for example:
  - `Testy jsem nespustil, protože změna byla malá / vizuální / dokumentační.`
  - or recommend the specific test that would make sense to run manually.

The goal is not to avoid testing. The goal is to choose verification proportional to the risk and avoid spending time on slow E2E runs when a targeted check is enough.

## Identity/session security policy

- `playerId` from a request is never proof of identity.
- `accountId` from a request is never proof of identity.
- Gameplay `load` must derive the player from a validated gameplay session.
- Gameplay `submit` must derive authority from a validated gameplay session and reject forged command `playerId`.
- Snapshot tokens restore instance state only; they must not authorize `load`, `submit`, join, or logout.
- Production must fail closed without a production-ready account identity provider and production-ready gameplay session repository.
- The dev account identity provider is for local/dev/test only and must not be the production default.
- Logout must revoke the gameplay session, not merely clear a client token.
