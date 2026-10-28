# Agent 10: A4 conference poster "Type, Matters"

**Verdict:** a designer can make this poster. 18 of 18 checks passed and there were no console errors.

## Design
"Poster A4" (595×842) has 24 nodes.

- **Title:** Playfair Display Italic at 150 ("Type,") and Inter Black at 84 ("MATTERS", made uppercase via Case).
- **Text:** a kicker line, a standfirst, the date and the volume number.
- **Lists:** a bulleted speakers list and a numbered schedule.
- **Shapes:** diamond and angular gradient shapes (a rotated square, a disc, a triangle and 5 avatars).
- **Lines:** an arrow divider (circle start cap, arrow end cap) and a dashed border (dash 6, gap 5).

## Workflow checks: 18 pass
- The Lorem ipsum plugin ran.
- Find & Replace fixed "Typograpy" to "Typography".
- Batch rename with "Speaker $n" worked.
- Version save, change and restore worked.
- PNG export, and PDF export (starts with `%PDF-1.4`, 595×842).
- Export frames to PDF, and Save local copy.

## Bugs
1. **Major: the Text tool can't re-edit existing text.** Press T, click an existing text, then type: the letters are run as tool shortcuts. `editingTextId` is set on pointerdown and then cleared.
2. **Minor: PDF export is a raster.** It is a JPEG inside a PDF, with no vectors and no selectable text.
3. **Minor: plugin edits don't rename text layers.** After Lorem ipsum, the layer is still called "Placeholder".
4. **Minor: multi-line text layer names contain a newline.** They should use the first line.
5. **Minor: export scale and suffix are inconsistent.** A new export row inherits 2x and "@2x" while row 0 has no suffix.
6. **UX: angular gradients have a seam.** A two-stop angular gradient shows a hard seam.
7. **UX: A4 sits right above the toolbar** at the default zoom.

The original report was relayed by the agent and saved here by the coordinator.
