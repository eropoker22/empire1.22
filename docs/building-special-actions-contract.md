# Building Special Actions Contract

Scope: district building detail special actions in the legacy `game.html` UI.

## Identity

- `actionId` is the canonical client identity for a special action.
- `actionIndex` is kept only as a legacy/debug fallback for old profile arrays.
- A click payload must include `actionId`, `buildingTypeId`, `districtId`, `buildingId` when available, and `actionIndex`.
- If `actionId` and `actionIndex` disagree, runtime rejects the click and does not grant rewards.

## Rendering

- The card button shows only the action label and a status badge (`Ready`, cooldown, active boost, or disabled state).
- Long description, cost, reward, risk and cooldown details are shown in the confirmation modal.
- Disabled actions are not clickable and expose a concrete disabled reason through the button title / modal reason.

## Confirmation

- Clicking an enabled action opens the special action confirmation modal.
- The modal shows action title, building, district, short description, cost, reward/effect, risk/heat and cooldown.
- `Escape`, backdrop and `Zrušit` close the modal without dispatch.
- `Potvrdit akci` dispatches the original action only after runtime re-validates identity and cooldown.

## Dispatch

- `buildingDetailPanel.js` uses one delegated click path on the shell/body.
- Direct per-button listeners are not used for district building detail special actions.
- Runtime resolves the request through `buildingSpecialActionRegistry.js`.
- Server-backed actions use `handlerId: "server-run-building-action"` and submit only the action intent; server/core owns reward, cost, heat and cooldown.
- Detail-card rows must not use local reward handlers for Park or Industrial alpha actions.
- A building action row that appears in the card must be implemented. Missing-handler rows are hidden from the card instead of rendered as disabled placeholders.

## Removed Rows

- If a building's design uses a separate production/craft/drug/pharmacy flow, it must not expose special action rows in the detail card.
- `Továrna`, `Drug lab` / `Lab`, `Zbrojovka` and `Lékárna` are handled this way: production/craft UI may exist elsewhere, but the building detail special-action section is empty.
- These rows should not be shown as placeholder buttons, because they are not planned card actions.

## Cooldown

- Cooldown is stored in district building detail state under `actionCooldowns[actionId]`.
- Legacy index cooldowns are still read for compatibility, but new writes use `actionId`.
- Cooldown starts only after a successful action result.
- Failed, disabled, unknown or cancelled actions do not start cooldown.
- The popup live refresh is active while any action cooldown deadline is still in the future.

## Street News

- Successful special actions append one entry to the existing `Uliční zprávy` feed.
- The entry includes action, building, district, result summary and cooldown.
- It uses the existing result feed (`resultKind/resultPayload`) instead of a parallel feed.
- Failed, disabled or unknown actions do not create success entries.
- TODO: direct click-to-open district/building detail from a feed entry should be added only after the map/detail context can be restored safely from feed payload. Current safe click target is the existing result detail modal.

## Missing Handlers

- Allowed fallback: a safe warning result with no reward, no cooldown and no success street-news entry.
- Forbidden fallback: silently granting generic influence/cash/effect when the action handler is missing.
- Actions that are present in card data but do not have a server-safe handler are filtered out of card UI and reported in audit as `missing-handler`.
- Actions that are no longer part of the building card design must be removed from card data instead of disabled.
