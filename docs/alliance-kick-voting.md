# Alliance Kick Voting

Inactive members are never removed automatically. Removal after missed READY requires a server vote.

## Start Vote

`start-alliance-kick-vote` requires:

- target is still in the same alliance,
- target is `vote_eligible`,
- target has no pending vote,
- initiator is a current member,
- initiator is not target,
- alliance has at least two members,
- retry cooldown is not active.

The eligible voter snapshot is captured when the vote starts. Target never votes.

## Required Votes

Use `calculateRequiredYesVotes`:

- 2-member alliance: 1 of 1
- 3-member alliance: 2 of 2
- 4-member alliance: 2 of 3

These values must not be duplicated in UI.

## Cast Vote

`cast-alliance-kick-vote` allows an eligible voter to choose `yes` or `no`. The voter may change their choice until the vote finishes.

The vote finishes early when:

- yes votes reach the required threshold,
- or the required threshold is mathematically impossible.

Expired votes are finalized by the scheduler. Failed or expired votes set retry cooldown on the target.

## READY During Vote

If the target confirms READY while the vote is pending:

- vote status becomes `cancelled_by_ready`,
- membership returns to `active`,
- existing votes remain for audit only,
- no kick runs.

The deterministic race rule is first committed transition wins. If READY commits first, vote cancellation persists. If kick commits first, later READY sees removed membership.

## Membership Changes During Vote

If an eligible voter or target leaves while a vote is pending, the vote is invalidated. The server does not adjust quorum mid-vote.
