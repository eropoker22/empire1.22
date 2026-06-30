# Alliance Lifecycle

Alliance lifecycle is server-authoritative in `game-core`. The browser may render controls and submit commands, but membership, READY, voting, leave, penalty, truce, and cleanup state live in the authoritative server snapshot.

## Model

- `Alliance.memberIds` is the public active member list.
- `Alliance.membershipByPlayerId` is the lifecycle source of truth for each member.
- `Alliance.kickVotesById` stores inactive kick votes.
- `allianceExitPenaltiesById`, `formerAllianceTrucesById`, `allianceDefenseContributionsById`, and `allianceAuditEventsById` are normalized server maps.

Membership statuses:

- `active`
- `due_soon`
- `overdue`
- `vote_eligible`
- `vote_pending`
- `exit_pending`
- `removed`

The status is derived from server timestamps where possible. Commands persist only state transitions that must survive reconnect, such as READY confirmation, vote cancellation, removal, penalty, and truce creation.

## Commands

All writing actions use the existing command envelope and `command.id` idempotence:

- `confirm-alliance-ready`
- `start-alliance-kick-vote`
- `cast-alliance-kick-vote`
- `leave-alliance`
- `disband-alliance`

Server runtime command reservation still prevents duplicate command execution. Lifecycle handlers also use stable IDs for vote, notification, penalty, truce, and audit records so retries do not duplicate side effects.

## Leader

An alliance must have at most one leader. The leader is `Alliance.ownerPlayerId`, and membership roles are synchronized during leave or kick.

When a leader leaves:

- a chosen active successor is used if valid,
- otherwise the server picks the oldest active member,
- ties are resolved by newer READY and then stable player ID,
- if no member remains, the alliance is disbanded.

Inactive leader kick is supported by the same vote path. Before removal, leadership is transferred to a remaining eligible member so an active alliance never persists without a leader.

## Disband

Disband removes all members with reason `alliance_disbanded`. It does not apply betrayal debuffs. It may apply only the configured short technical lockout and former ally truce.

## Client Runtime

`page-assets/js/app/alliance-runtime.js` renders the server `allianceBoard` read model and submits lifecycle commands through the gameplay slice submit path. It is not authority for membership, READY, vote, leave, penalty, truce, or cleanup state.

The current client runtime is wired for:

- create and join alliance,
- direct invite accept/reject,
- leader invite from eligible server targets,
- READY confirmation,
- inactive kick vote start,
- inactive kick vote yes/no cast,
- leave or disband through server commands.
