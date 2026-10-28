# Agent 01: Flowly login and sign-up

**Verdict:** a designer can build and prototype this end to end. 21 of 21 checks passed and there were no console errors.

## Design
The file "Flowly — Login & Sign-up" has 39 layers, 1 component and 2 instances.

- **Login (iPhone 16, 393×852):**
  - Vertical auto layout with gap 16 and padding 24 left/right, 72 top/bottom.
  - Logo row (ellipse plus wordmark) and heading.
  - Email and password fields: auto-layout frames with radius 12 and a 1px stroke, set to fill the width.
  - A right-aligned "Forgot password?" link.
  - The Sign in button, an instance with its text overridden.
  - A divider row (line, "or", line).
  - A Google button: an instance with text, fill and stroke overrides.
  - A spacer that fills vertically, then the footer.
- **Button/Primary component:** auto layout, fixed 345 wide × hug 52 high, colour #4F46E5.
- **Home:** logo, greeting, hero card and 3 task rows.
- **Prototype:** Sign in goes to Home on click with Smart animate, ease-out, 300ms. Flow 1 was created automatically.

## Checks: 21 pass
File rename, frame preset, Shift+A auto layout, component creation, dragging an asset in to make an instance, text override (`overrides:["text"]`), multiple overrides, nested auto layout, hug/fill/fixed sizing, spacer fill, the noodle connection, Smart animate, Present opening on Login, clicking Sign in to reach Home, PNG export, Save local copy, and no errors.

## Bugs (all minor)
1. **Zoom to fit (Shift+1) ignores the floating panels.** Content ends up under the left and right panels; the cause is `zoomToRect`.
2. **Shift+A resets a "Fill container" frame to Hug.** `configureAutoLayout` always sets HUG.
3. **Shift+A collapses a preset device frame (393×852) to hug×hug.** Same root cause as 2.
4. **Present counts a top-level main component as a screen.** The counter shows "1 / 3".
5. **Present's flow dropdown resets to the "Flows" placeholder** after you navigate away from the flow's starting frame.

## Not bugs
- A newly wrapped auto-layout frame starts collapsed in the layers panel.
- `al-pad-t` only exists in individual padding mode.

The original report was relayed by the agent and saved here by the coordinator.
