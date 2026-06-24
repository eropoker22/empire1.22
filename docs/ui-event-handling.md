# UI Event Handling

This document defines event handling rules for map input, overlays, and legacy runtime code.

## Map Input

- Map selection handlers must check `isOverlayOpen()` before opening a district.
- Map selection handlers must call `shouldSuppressMapInput(event)` before resolving the tapped district.
- If either check blocks the event, the handler must not mutate selected district state.
- Document/global click handlers that can affect map state must use the same checks.

## Ghost Click Suppression

- Closing an overlay starts a short suppression window for map input.
- Suppression absorbs delayed touch/click events that browsers can emit after a backdrop or close-button tap.
- Suppressed events should call `preventDefault()` and `stopPropagation()`.
- Suppression applies to map click, map pointer gestures, wheel zoom, and zoom controls.

## Tap Vs Drag

- Pointer handlers record `pointerdown` start coordinates.
- A map tap is valid only when movement stays within the tap threshold.
- Movement beyond the threshold is a drag/pan and must not open a district.
- `pointercancel` invalidates the pending tap.

## Overlay Stack

- The overlay stack represents visual and interaction ownership.
- The topmost overlay owns backdrop, Escape, and focus handling.
- Closing the topmost overlay must not close lower overlays.
- Opening a modal above a district sheet pushes a new stack entry.
- Closing that modal restores focus and leaves the sheet entry active.

## Backdrop Rules

- Backdrops close only their own overlay.
- Backdrop events must not bubble into the map.
- Backdrop close must use the same close flow as close buttons.
- Backdrop close must trigger map input suppression.

## Scroll Lock

- Mobile overlays lock body/page scroll.
- The scroll lock stores the current page scroll position.
- Unlock restores the exact stored scroll position.
- Overlay content can scroll internally; the page behind it cannot.

## Focus Management

- Opened overlays use `role="dialog"`.
- Blocking overlays use `aria-modal="true"`.
- Do not use autofocus for overlays that can scroll the page.
- Use `focus({ preventScroll: true })` when moving focus programmatically.
- Close flow restores focus to the previous safe element when possible.
- Focus restoration must not cause scroll jumps.

## Legacy Runtime Must Not

- Open a district while any overlay is open.
- Open a district from a ghost click after an overlay closes.
- Create multiple district sheets for double tap.
- Close multiple overlay layers from one Escape press.
- Bypass the shared close flow for district sheets or district action modals.
- Let map pan/zoom handlers start while an overlay owns input.

## Manual QA Checklist

- Open a district.
- Close it with the backdrop.
- Verify the district under the backdrop does not open.
- Open a district and close it with the X button.
- Scroll the sheet and verify the page behind it does not move.
- Double tap a district and verify there is still one sheet.
- Open a modal above the sheet and close it with the backdrop.
- Verify the sheet remains open and the map does not react.
- On desktop, press Escape and verify only the topmost overlay closes.
