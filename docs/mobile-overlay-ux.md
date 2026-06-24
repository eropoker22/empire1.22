# Mobile Overlay UX

This document defines the mobile overlay behavior for `game.html` and the legacy runtime.

## Overlay Stack

- Overlays are tracked as a stack. The last opened overlay is the topmost overlay.
- A district bottom sheet counts as an overlay.
- A modal opened above the district sheet is pushed above it.
- Closing the top modal must leave the sheet below it open.
- `Escape` on desktop closes only the topmost overlay.

## Backdrop Rules

- Backdrop taps close only the overlay they belong to.
- Backdrop taps must call the same close flow as the close button.
- Backdrop taps must call `preventDefault()` and `stopPropagation()`.
- Legacy backdrop/close controls also stop immediate propagation on pointer and click events.
- After a backdrop close, map input is suppressed long enough to absorb ghost clicks.
- A tap on backdrop must never select or reopen a district underneath.

## Scroll Lock

- Any open mobile overlay locks body/page scroll.
- The scroll position is restored when the last overlay closes.
- The sheet body/card may scroll internally.
- Opening, focusing, and closing overlays must not cause page scroll jumps.
- Legacy `game.html` overlays use the shared `EmpireLegacyOverlay` coordinator for the body lock and ghost-click suppression.

## Focus Management

- Open overlays use `role="dialog"`.
- `aria-modal` is set by overlay type. Blocking district sheets and blocking modals use `aria-modal="true"`.
- Do not use autofocus that can scroll the page.
- If focus is moved, call `focus({ preventScroll: true })`.
- Prefer focusing the sheet/modal container or its close button.
- On close, return focus to the previously focused safe element when it still exists.

## Mobile Sheet Vs Desktop Modal

- Mobile district detail is a bottom sheet: it is anchored to the viewport bottom and has its own scrollable body/card.
- Desktop district detail behaves like a dialog panel over the map.
- Both count as overlays for map input suppression.
- Modals above the sheet are topmost overlays and must not close the sheet beneath them.

## Z-Index Tokens

- Backdrop is below its sheet/modal content.
- Sheet/modal content is above the backdrop.
- A nested modal above a sheet must have a higher effective stacking order than the sheet.
- Do not create independent z-index islands that bypass the overlay stack.

## Manual QA Checklist

- Open a district.
- Close it with the backdrop.
- Verify the district under the backdrop does not open.
- Open a district and close it with the X button.
- Open a district, scroll the sheet, and verify the background/page does not move.
- Double tap a district and verify only one sheet exists.
- Open a modal above the district sheet, close that modal with its backdrop, and verify the sheet remains open.
- On desktop, press Escape and verify only the topmost overlay closes.
