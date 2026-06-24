# Security Threat Model

This document covers identity and gameplay session threats for Empire Streets.

## Assets

- private player read-models
- gameplay command authority
- account-to-player registration
- gameplay session tokens
- join tickets
- snapshot recovery tokens

## Primary Risks

- attacker submits another player's `playerId` to `load`
- attacker submits commands with another player's `playerId`
- attacker reuses a join ticket
- snapshot token is treated as identity
- logout does not revoke the session
- production silently falls back to anonymous identity
- tokens leak through logs, URLs, DOM, localStorage or diagnostics

## Controls

- `AccountIdentityProvider` is the only account identity boundary.
- `playerId` and `accountId` from request bodies are deprecated compatibility input, not proof.
- Join tickets are short-lived, server-bound and one-time use.
- `load` requires a valid gameplay session and derives `playerId` from that session.
- `submit` requires a valid gameplay session and rejects forged command identity.
- Snapshot tokens can restore instance state only when paired with a valid gameplay session.
- Logout revokes the persistent session.
- Diagnostics redact `snapshotToken`, `sessionToken`, cookie and secret-like values.
- Production fails closed when secrets, auth provider or persistent repositories are missing.

## CSRF And Origin

Cookie-backed sessions require Origin checks for state-changing requests, an allowlist of production origins, and a custom CSRF header or equivalent token. SameSite is useful but is not the only CSRF control.

The temporary bearer-token bridge must remain in memory or `sessionStorage` only and must not be promoted to production localStorage.

## Test Invariants

- load without session does not return another player's data
- forged command `playerId` is rejected
- snapshot token alone cannot load or submit
- join ticket cannot be reused
- expired ticket is rejected
- two joins for one account/server share one registration
- logout revokes the old session
- production without configured identity/session persistence rejects safely
