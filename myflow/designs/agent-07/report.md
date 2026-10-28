# Agent 07: Ember & Oak coffee, Instagram post and story set

**Verdict:** a designer can make this in My Flow. 24 of 25 checks passed.

## Design
The file "Ember & Oak — IG Set" has 29 nodes: 2 frames, 4 groups, 11 text layers, 2 stars, 6 rectangles (2 with image fills) and 3 ellipses.

- **IG Post (1080×1350):**
  - A generated latte photo masked into a circle with ⌃⌘M.
  - A "Warm overlay" rectangle set to Multiply at 35% opacity.
  - A Playfair headline, logo and subcopy.
  - A rotated star badge (−14°).
  - A locked decorative disc and a hidden draft headline.
- **IG Story (1080×1920):**
  - The same photo, flipped and masked into a rounded rectangle, with a Multiply overlay inside the mask group.
  - A headline styled with copy/paste properties.
  - A CTA pill and the badge copied over and rotated +12°.

## Checks: 24 pass, 1 fail
**Passed:** frame presets, image placement, both mask methods, star settings, rotation, blend mode and opacity, flip, copy/paste properties for fill, opacity and text style, ⌘C/⌘V across frames, layers panel reorder, drag into a group, lock, hide and rename, locked layers can't be selected, PNG and JPG export of both frames, Save local copy, and no console errors.

**Failed:** paste properties does not carry the blend mode.

## Bugs
1. **Major: paste properties drops the blend mode** (and stroke alignment).
   - **Repro:** copy properties (⌘⌥C) from a rectangle set to Multiply at 35%, then paste them (⌘⌥V) onto another rectangle.
   - **Result:** the blend mode stays pass-through.
   - **Cause:** `pasteProperties()` in `src/commands.ts` never applies `blendMode` or `strokeAlign`.
2. **Minor UX:** a mask group takes the mask shape's name, so two layers share it.
3. **Note:** the second export row defaults to 2x with an "@2x" suffix. This matches Figma.

The original report was relayed by the agent and saved here by the coordinator.
