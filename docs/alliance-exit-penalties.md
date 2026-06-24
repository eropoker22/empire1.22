# Alliance Exit Penalties

Exit penalties are server-owned and reason-specific. They are keyed by exit event so retries do not stack uncontrolled debuffs.

## Reasons

- `voluntary_leave`: strongest penalty.
- `inactive_kick`: mild lockout, no economic or cooldown debuff.
- `alliance_disbanded`: no betrayal debuff, only configured technical lockout/truce.
- `administrative_removal`: cleanup and audit only.

## Free Defaults

Voluntary leave:

- join/create lockout: 12 hours
- Influence multiplier: 0.80 for 8 hours
- action cooldown multiplier: 1.15 for 6 hours
- alliance defense support blocked during lockout
- former ally truce: 60 minutes

Inactive kick:

- join/create lockout: 6 hours
- no Influence debuff
- no action cooldown debuff
- alliance defense support blocked during lockout
- former ally truce: 60 minutes

## War Defaults

Voluntary leave:

- join/create lockout: 24 hours
- Influence multiplier: 0.80 for 18 hours
- action cooldown multiplier: 1.15 for 12 hours
- alliance defense support blocked during lockout
- former ally truce: 120 minutes

Inactive kick:

- join/create lockout: 12 hours
- no economic debuff
- no action cooldown debuff
- alliance defense support blocked during lockout
- former ally truce: 120 minutes

## Affected Actions

`actionCooldownMultiplier` applies only to configured action IDs:

- `spy`
- `heist`
- `attack`
- `rob`

It must not apply to READY, alliance UI, district management, production collection, or combat power.

## Join/Create Validation

Server validation must reject:

- `ALLIANCE_JOIN_LOCKED`
- `ALLIANCE_CREATE_LOCKED`
- `ALLIANCE_EXIT_PENDING`
- `PLAYER_ALREADY_IN_ALLIANCE`
- `ALLIANCE_FULL`
- `INVITE_EXPIRED`
- `INVITE_INVALIDATED`
