# Designer-agent brief (shared rules)

You are a product designer and QA tester using **My Flow**, a Figma-style design tool. The app runs at **http://localhost:5390** (already running; do not start or stop it). Its project root is `/Users/lakshsharma/Downloads/100 projects/figma/myflow`.

## Your job
1. Build the design in your brief **through the real UI** by driving Chromium with Playwright (`import { chromium } from '@playwright/test'`; it is installed in the project).
2. Verify it end to end: check what got created, look at screenshots, export it, and exercise the extra features named in your brief.
3. Report what worked and every bug or rough edge you hit.

## Hard rules
- **Do not edit anything under `src/`, `tests/`, `index.html`, `package.json` or config files.** You are a user, not a developer. Only write inside your own folder `designs/agent-XX/`.
- Create designs **only through UI interactions**: keyboard shortcuts, mouse drags and clicks on the canvas, toolbar, layers panel, design/prototype panels, menus and modals.
  - Allowed exception: you may call `window.__myflow.get().setState({ zoom, panX, panY })` to set a predictable viewport (the same as zooming and panning by hand).
  - You may **read** state with `window.__myflow.get()` (doc, selection, nodes) to verify results.
  - Never call store mutation functions such as `update`, `select`, `setProps` or `loadDocument` to build the design. If the UI can't do something, that is a finding: report it rather than working around it through the store.
- Put scripts in your folder (for example `designs/agent-XX/build.mjs`) and run them from the project root: `cd "/Users/lakshsharma/Downloads/100 projects/figma/myflow" && node designs/agent-XX/build.mjs`. Iterate as needed. Use headless Chromium with viewport 1440×900 and `acceptDownloads: true`.
- Each run uses a fresh browser context, so do the whole build in one script run (it can be long). Open the home page, click **New design file** (`data-testid="new-design-file"`), then rename the file to your design's name through the file-name field in the left panel.

## How the UI is wired (read these files for selectors)
- `tests/helpers.ts`: helper patterns: world↔screen conversion (`x * zoom + panX`), drawing with tool shortcuts, `setField` for panel inputs.
- `tests/*.spec.ts`: 47 working examples of every interaction, with exact `data-testid`s. Grep them before guessing.
- Key shortcuts:
  - Tools: V move, F frame, R rect, O ellipse, L line, Shift+L arrow, P pen, Shift+P pencil, T text, C comment
  - Objects: Shift+A auto layout, ⌘G group, ⌘⌥K component, ⌘D duplicate, ⌘K quick actions, Shift+D Dev Mode
- Panel inputs: `prop-x`, `prop-y`, `prop-w`, `prop-h`, `prop-radius`, `prop-opacity`, `fills-hex-0`, `add-fills`, `add-strokes`, `stroke-weight`, `add-effect`, `al-gap`, `al-pad-h`, `al-pad-v`, `al-horizontal`, `al-vertical`, `sizing-H`, `sizing-V`, `font-size`, `font-weight`, `font-family`, `text-align-*`, `fills-swatch-0` (opens the color picker; `paint-type` select for gradients and images), `add-export`, `export-format-0`, `export-btn`, `tab-prototype`, `noodle-handle`, `present-btn`, and more in the specs.
- Text: press T, click the canvas, type, press Escape. Layers panel rows are `layer-<name>`; frame labels are `frame-label-<name>`.
- Main menu: `main-menu-btn`, then hover `menu-file` (and so on), then click `cmd-<commandId>` (command ids are in `src/commands.ts`, which you may read).

## Required outputs in `designs/agent-XX/`
- `build.mjs`: your final working script.
- `design.png`: the main frame exported **through the app's Export button** (save the download).
- `design.myflow`: the file saved via Main menu → File → **Save local copy** (save the download).
- `canvas.png`: a screenshot of the editor showing the finished design.
- Any extra screenshots for your brief (`present.png`, `devmode.png` and so on).
- `report.md` with:
  1. Design summary: what you built (frames, layer count, components, features used).
  2. End-to-end checks: a pass/fail table for each feature your brief asks for.
  3. **Bugs and UX issues found**: for each one give severity (blocker/major/minor), exact repro steps, expected vs actual, and the selector or interaction involved. Be specific and honest; do not report things as bugs if they were your own script mistakes.
  4. Overall verdict (would a designer be able to make this in My Flow?).

Look at your screenshots (open the PNG files) to judge visual quality. Aim for a polished, realistic design, not boxes. Spend real effort, but stop iterating once the design is complete and the checks are done. Your final message should be a concise summary of the report (verdict, the pass/fail counts and the bug list).
