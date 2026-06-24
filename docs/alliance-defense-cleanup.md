# Alliance Defense Cleanup

Core district defense previously stored only `district.defenseLoadout`, which is not enough to safely return allied contributions. Alliance lifecycle therefore uses `allianceDefenseContributionsById` as the owner ledger for allied defense.

## Cleanup Rules

When a member leaves, is kicked, or the alliance disbands:

- the departing member's active defense in former allies' districts is returned,
- other members' active defense in the departing member's districts is returned,
- returned items are marked `returned`,
- destroyed items remain `destroyed`,
- active combat snapshots are not rewritten.

If a contribution has `combatSnapshotId`, cleanup leaves it pending for combat completion. The combat snapshot keeps its original defense values. After combat resolves, surviving contribution rows may be returned; destroyed rows stay destroyed.

## Idempotence

Cleanup uses contribution IDs and status transitions:

- `active -> returned`
- `active -> return_pending` for future snapshot integration
- `destroyed` remains terminal

Retrying cleanup sees non-active rows and does not subtract defense twice.

## Current Runtime Note

The server has authoritative cleanup support for seeded or future allied contribution rows. Existing ordinary district defense is still aggregate-only, so no ownership can be inferred for historical defense rows that were not written through the contribution ledger.
