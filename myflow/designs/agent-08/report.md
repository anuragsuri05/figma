# Agent 08: Habitly onboarding flow

**Verdict:** a designer can build and prototype this flow. 27 of 27 checks passed and there were no console errors.

## Design
The file has 77 layers.

- **Screens:** three iPhone screens (Onboarding 1–3), each with an illustration made from shapes, a title, body text, pagination dots and Next/Skip/Back buttons.
- **Welcome modal:** a 320×300 frame with rounded corners.
- **Pagination dots:** named `Dot 1–3` and `Active dot` on every screen, so Smart animate slides the active pill between screens.

**Prototype (9 interactions):**
- **Next:** Smart animate, 350ms.
- **Skip:** Slide in, to screen 3.
- **Get started:** opens the Welcome overlay, dimmed and closing on outside click.
- **Back:** on screens 2 and 3.
- **Let's go:** closes the overlay.
- **After delay:** 1500ms auto-advance on screen 1.
- **Flow and device:** an "Onboarding" flow, on iPhone 16.

## Checks: 27 pass
- Structure and every interaction are configured as intended.
- PNG export of each frame, plus a multi-frame export.
- Save local copy keeps all interactions and the flow.
- Present mode:
  - Next, Back, Skip and the after-delay advance all work.
  - The overlay opens, then closes on outside click and on "Let's go".
  - R restarts, and the flow selector works.
  - Hotspot hints and arrow-key stepping work.

## Bugs (all minor)
1. **Rounded overlay frames show a rectangular shadow.** `OverlayView` passes `roundCorners={0}`.
2. **An overlay-only frame counts as a screen in Present** (the counter shows "x / 4").
3. **Smart animate doesn't crossfade text whose content changed**, and doesn't animate size or colour.
4. **Some prototype controls have no `data-testid`.** The overlay position select, the overlay checkboxes, the Present flow select and the hotspot checkbox are affected; the direction buttons also have no accessible label.
5. **New interactions default "close on outside click" to true**, even for Navigate and Back.

The original report was relayed by the agent and saved here by the coordinator.
