# Agent 04: Lumen startup hero

**Verdict:** a designer can build this hero. 24 of 24 checks passed and there were no console errors.

## Design
The file has 41 layers.

- **Hero frame:** 1440×900, dark.
- **Nav:** horizontal auto layout with space-between: logo, 5 links and a CTA.
- **Badge pill** above the headline.
- **Headline:** 64px bold over 2 lines, line height 72, letter spacing −2%.
- **Subheadline**, plus primary and ghost CTA buttons.
- **"Trusted by" strip** with 6 wordmarks.
- **Decorative shapes:**
  - Radial gradient blobs.
  - A linear gradient blob with layer blur 140.
  - A Subtract ring.
  - A Union sparkle.
- **Styles:** Heading/H1 and Body text styles, and a Brand/Primary color style.

## Checks: 24 pass
- Gradients (radial and linear), layer blur, Subtract and Union.
- Space-between auto layout.
- Text and color styles: creating, applying and editing them, with edits propagating.
- Constraints: Left & right, Right/Bottom and Bottom.
- PNG and PDF export, Export frames to PDF, and Save local copy.

## Bugs
1. **Major: you can't recolor several selected layers from the Fill section.** It always shows "mixed" because `mixed()` compares fills including their unique `id`s.
2. **Major: applying a text style changes the layer's resize mode and alignment.** `createStyle('TEXT')` copies `autoResize`, `textAlign` and `verticalAlign`, so auto-width text wraps mid-word.
3. **Minor: the "…" button on a style row opens the Styles modal on the first style**, not the one clicked.
4. **Minor: the Styles list only shows when nothing is selected.** Escaping up from a deeply nested layer takes several presses.

The original report was relayed by the agent and saved here by the coordinator.
