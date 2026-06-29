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
- Actions that are present in card data but do not have a legacy-safe handler are disabled as `Připravujeme serverový handler.`
