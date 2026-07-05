# Bounty Server-Authoritative Contract

## MVP Scope

This sprint moves bounty escrow, status and payout authority to the server/core command flow.

In scope:

- create bounty
- cancel own active bounty
- clean cash escrow
- server-side claim after real attack/destroy outcomes
- expiry with escrow return
- bounty read model for UI
- legacy localStorage deprecation

Out of scope:

- item, drug or weapon bounty rewards
- player-created bounty categories beyond the three MVP objectives
- alliance bounty rules beyond ally/self rejection
- War tuning
- premium or monetization features

## Commands

`create-bounty`

```ts
{
  targetPlayerId: string;
  objectiveType: "attack-player" | "attack-district" | "destroy-player-district";
  targetDistrictId?: string | null;
  rewardCleanCash: number;
  durationHours: 1 | 6 | 12 | 24;
  isAnonymous?: boolean;
}
```

`cancel-bounty`

```ts
{
  bountyId: string;
}
```

The client must not send status, claim data, payout data, balance mutations, timestamps, `nextState`, or target-owner labels as authority.

## Objective Types

- `attack-player`: claimed after a successful server attack against any active district owned by the target player.
- `attack-district`: displayed as "Obsadit district" and claimed only after the server reports that the selected target district was captured/occupied.
- `destroy-player-district`: claimed after a server action reports `destroysDistrict: true` for the target player. With `targetDistrictId: null`, any target district can match.

## Escrow

On `create-bounty`, core validates the creator, target, district, duration, reward and clean cash balance. The reward is deducted from the creator's clean cash and locked in `bountiesById`.

On claim, core pays `rewardCleanCash` to the actor and marks the bounty `claimed`.

On cancel or expiry, core returns escrow to the creator if the bounty was still active.

## Claim Matching

Claim is a core side-effect through `resolveBountyClaims`. Browser events are ignored for reward authority.

The creator cannot claim their own bounty. A bounty can be claimed only once. Multiple active bounty records may be claimed by one action if they independently match the server outcome.

## Expiry

Expiry is tick-based. `expireBounties` can run lazily during bounty commands or claim resolution. Expired bounty returns escrow to the creator and cannot be claimed.

## Read Model

`readModel.bounty` contains:

- `minRewardCleanCash`
- `durationOptionsHours`
- `currentPlayerCleanCash`
- `eligibleTargets`
- `activeBounties`
- `recentBountyEvents`

The UI must render targets and district choices from this read model. It must not derive targets from legacy map owner constants as authority.

## Alpha Demo Targets

Production alpha should not fabricate bounty targets. If the server read model has no `eligibleTargets`, the UI shows an empty state and waits for server data.

For local/dev visual testing, enable demo bounty targets with `EMPIRE_ENABLE_BOUNTY_DEMO_TARGETS=1` in the server environment.

## UI Responsibilities

Status: Bounty Board UI is ready for the server-authoritative MVP.

The UI previews reward, target, objective and duration, then opens a confirmation modal. The first submit click must not spend cash. Confirm submits `create-bounty` through `/api/gameplay-slice/submit`.

The create tab renders the player target profile, target picker, district picker when the selected objective requires it, clean-cash reward controls, anonymous flag and confirm card without introducing client authority.

The active bounty tab renders server read model entries in the ready Bounty Board layout. Desktop uses the full-width active bounty table; mobile uses compact bounty cards. Cancel submits `cancel-bounty` from active bounty rows when available.

Legacy `window.empireStreetsBountyState` remains only as a map badge adapter backed by `readModel.bounty`.

## Forbidden Client Authority

The client cannot:

- create active bounty from localStorage
- mutate escrow locally
- pay rewards locally
- claim through `empire:bounty-action-resolved`
- send status, claimedBy, payout or balance mutation fields
- fake target district ownership

Old `empireStreets.bounty.v1` localStorage state is ignored and cleared by the UI runtime.
