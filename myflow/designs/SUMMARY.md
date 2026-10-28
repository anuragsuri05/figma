# Designer-agent test of My Flow

Ten independent designer agents each built a real design in My Flow. They worked **only through the UI**, driving Chromium with clicks, drags, keyboard shortcuts, panels, menus and modals, then checked their work end to end and reported bugs. All the reported bugs that affect designers were then fixed, regression-tested, and the agents' build scripts were run again against the fixed app.

See `gallery.png` / `gallery.html` for all 10 exported designs. Each `agent-XX/` folder has its `build.mjs`, `design.png`, `design.myflow`, screenshots and `report.md`.

## Results

"Before" is each agent's original run; "after" is a fresh run of the same unchanged build script against the fixed app.

| # | Design | Checks (before → after) | Notes |
|---|---|---|---|
| 01 | Flowly mobile login and sign-up | 21/21 → passes | Auto layout form, button component and overrides, Smart animate to Home |
| 02 | Pulse SaaS dashboard | 25/28 → **28/28** | 120 nodes, 5-level nested auto layout, plugin chart, Dev Mode CSS |
| 03 | Aero Glide product page | 16/17 → passes | Image fills, star ratings, size-picker variants, 2x JPG |
| 04 | Lumen startup hero | 24/24 → 23/23 | Gradients, layer blur, booleans, styles that propagate, constraints. The rerun script has one fewer assertion because a workaround step is no longer needed. |
| 05 | Theme Kit design system | 27/28 → 27/28* | Variables with Light/Dark modes, variants, instances across pages |
| 06 | Music player | 18/18 → passes** | Pen-tool icons, vector editing, ellipse arc ring, Play/Pause interactive component |
| 07 | Ember & Oak Instagram set | 24/25 → **25/25** | Masks, Multiply, rotation, copy/paste properties |
| 08 | Habitly 3-screen onboarding | 27/27 → 27/27 | 9 interactions, Smart animate, slide, after-delay, overlay, Back, flows |
| 09 | Weather widgets and handoff | 18 pass + 3 partial → passes | Glass blur, union clouds, Dev Mode code, annotations, comments |
| 10 | "Type, Matters" A4 poster | 18/18 → 18/18 | Typography, lists, angular/diamond gradients, find/replace, versions, PDF |

\* Agent 05's remaining "fail" is a probe in its own script that looks for the binding button in the wrong element. Number-variable binding now exists, and the regression test `tests/11-designer-regressions.spec.ts` covers it.
\*\* Agent 06's rerun renames layers by name. Instances are now named after their component set, as in Figma, so the script renamed the set instead of the instance. Checked separately on its saved file: Play → Pause → Play toggles correctly in Present.

## Bugs found by the agents and fixed
| Severity | Bug | Reported by |
|---|---|---|
| Major | Text tool couldn't re-edit existing text (typed letters ran as tool shortcuts) | 10 |
| Major | Variant switch reset text overrides on pasted or duplicated instances | 03 |
| Major | Number variables couldn't be bound from the UI. Now radius, gap, padding, W, H and opacity can be bound. | 05 |
| Major | Pen paths always landed on the page root instead of inside the frame | 06 |
| Major | Couldn't edit the fill of several layers at once (always showed "mixed") | 04 |
| Major | Applying a text style changed the layer's resize mode and alignment | 04 |
| Major | Paste properties dropped the blend mode and stroke alignment | 07 |
| Major | Dev Mode code: CSS Fill was on the wrong axis; Tailwind, SwiftUI and Compose lost opacity, blur, stroke and shadow | 09 |
| Minor | Shift+A reset a preset frame or a Fill child to Hug | 01 |
| Minor | Shift+A wrapper frames clipped their children's shadows | 02 |
| Minor | Zoom to fit / to selection put content under the side panels | 01, 02, 03 |
| Minor | Present counted main components and overlay-only frames as screens | 01, 08 |
| Minor | Present flow dropdown reset after navigating | 01 |
| Minor | Rounded overlays showed a square shadow | 08 |
| Minor | Clicking a child of a selected top-level frame kept the frame selected | 03 |
| Minor | Dragging inside a selected path over another layer moved the wrong layer | 06 |
| Minor | Instances kept the variant name ("State=Default") instead of the set name | 03, 05 |
| Minor | Combine as variants named the set "Component"; there was no way to rename a variant property | 05, 06 |
| Minor | Text layer names contained newlines and didn't follow plugin edits | 10 |
| Minor | Style "…" opened the wrong style; Styles window could only edit size and weight | 04, 05 |
| Minor | Export rows had a mismatched scale and "@2x" suffix | 02, 10 |
| Minor | Dev Mode opened partway down the panel; the Colors list merged opacities and overlapped text | 02, 09 |
| Minor | Smart animate didn't crossfade text whose content changed | 08 |
| Minor | Variables table header scrolled away; newly wrapped frames were all named "Frame" | 05, 02 |
| Minor | Missing test IDs and labels (arc start, overlay options, direction buttons, Present flow and hotspots) | 06, 08 |

## Known limitations, not fixed
- PDF export is a high-resolution raster page, not vector with selectable text.
- SVG export leaves out background blur and embeds every Inter face, not just the ones used.
- Smart animate moves position and opacity but doesn't interpolate size or colour.
- A two-stop angular gradient shows a seam unless you add a third stop, which matches how real conic gradients behave.

## Test suite
62 Playwright tests pass: the original 47, plus 15 regression tests written from these reports.
