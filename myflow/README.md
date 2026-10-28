# My Flow

A Figma-style design, prototyping and handoff tool that runs entirely in the browser. No sign-up or account is needed. Files are saved locally in IndexedDB.

## Run it

```bash
npm install
npm run dev          # http://localhost:5390
npm run build        # production build → dist/
npm run preview      # serve the build on http://localhost:4173
npm run test:e2e     # Playwright end-to-end suite (72 tests)
```

## What's inside

| Area | Features |
|---|---|
| **File browser** | Recents, Drafts, Starred, Trash, search, grid/list, sort, rename, duplicate, star, trash/restore/delete forever, templates (Mobile app, Landing page, Design system), import `.myflow` / image |
| **Canvas** | Infinite canvas, zoom (⌘+/−, ⇧0/1/2, ctrl/pinch-wheel), pan (Space/H/wheel), Figma selection rules (top-level frames act as canvas, double-click to go deeper, ⌘-click deep select), marquee, shift-select, smart snapping guides, ⌥-hover measurements, rulers & draggable guides, pixel grid, outline mode, layout-grid overlay, frame/section labels, size badge |
| **Tools** | Move, Hand, Scale, Frame (+ device presets), Section, Slice, Rectangle, Line, Arrow, Ellipse (arc/donut), Polygon, Star, Image placement, Pen (bezier and closed paths), Pencil, Text (auto width, fixed width), Comment |
| **Transform** | Move, ⌥-drag duplicate, resize handles (⇧ aspect, ⌥ from centre, rotated boxes), rotation zones, corner-radius handles, nudge, flip, rotate 90/180, align, distribute, tidy up, arrange order |
| **Layers** | Tree with expand/collapse, drag to reorder/reparent, rename (double-click, Tab to next), hide/lock, search, multi-select, context menu, batch rename (`$n`, `$&`) |
| **Design panel** | Position and constraints, W/H with Fixed/Hug/Fill and min/max, auto layout (vertical/horizontal/wrap, gap, space-between, padding, 9-point alignment, absolute position, clip), appearance (opacity, 17 blend modes, radius, independent corners, smoothing, variable modes), typography (family, weight, italic, size, line height, letter/paragraph spacing, align, resize modes, decoration, case, lists, links, text styles), fills/strokes (solid, linear, radial, angular, diamond, image; colour picker with HSB/RGB/HSL/hex/eyedropper; dash, caps, arrowheads; style and variable binding), effects (drop/inner shadow, layer/background blur), layout guides, selection colours, export settings with preview |
| **Objects** | Group/ungroup, frame selection, boolean union/subtract/intersect/exclude, masks, flatten, outline stroke, swap fill/stroke |
| **Components** | Create (single/multiple), instances via Assets panel (click or drag), overrides kept when main changes, reset, detach, go to main, push to main, variants (combine, add, switch property), swap instance, interactive components |
| **Variables & styles** | Collections, colour/number/string/boolean variables, modes, aliases, binding to fills/radius/gap/padding/size/opacity/text, per-frame mode switching; colour/text/effect/grid styles with live propagation |
| **Prototype** | Drag the ⊕ noodle to connect; triggers (click, hover, press, drag, mouse enter/leave, after delay, key); actions (navigate, change to, back, scroll to, open/swap/close overlay, open link, set variable); animations (instant, dissolve, smart animate, move/push/slide) with easing and spring presets; flows; device and background; scroll overflow and fixed layers; presentation player |
| **Dev Mode** (⇧D) | Inspect, CSS / Tailwind / SwiftUI / Compose code, typography and colour tokens, asset export, Ready-for-dev status, annotations |
| **Collaboration** | Comments (pins, threads, replies, resolve, delete, panel), share dialog, version history (named and autosave, restore) |
| **Export** | PNG, JPG (scales), SVG (with embedded fonts), PDF, frames to multi-page PDF, Save local copy (`.myflow`), copy as PNG/SVG/CSS |
| **Productivity** | Quick actions (⌘K / ⌘/), full keyboard shortcut set (⌃⇧?), main menu with search, context menus, find and replace, preferences, light/dark/system theme, built-in plugins (lorem ipsum, image fill, contrast checker, auto-rename, palette generator, clean document, icon set, bar chart) |

## Desktop app

Download installers from `release/` (see [INSTALL.md](INSTALL.md)): **macOS** DMGs for Apple Silicon (`arm64`) and Intel (`x64`), and **Windows** installer + portable `.exe`. Build them with `npm run dist:mac` / `npm run dist:win`.

## AI (bring your own key)

Open the agent with the ✨ toolbar button or **⌘J**, then **Connect a provider**. Paste an API key for **Claude** (Anthropic), **ChatGPT** (OpenAI) or **Gemini** (Google), press **Test** (this also lists the models your key can use), and pick one as active. Keys stay in your browser (localStorage, or the session only if "Remember" is off) and go directly to that provider. There is no My Flow server. Usage is billed to your provider account.

| Feature | Where |
|---|---|
| **Design agent**: chat that reads the canvas, builds complete screens with auto layout, edits selected layers, checks its own work with screenshots, wires prototypes, creates variables, styles and comments. Each run undoes in one step. | Agent panel |
| **First draft**: generate a screen from a prompt | Agent suggestions, AI menu |
| **Rename layers**, **realistic content**, **rewrite / shorten / lengthen / fix / tone / translate** | Quick chips, AI menu, right-click → AI |
| **Make prototype**: auto-wire screens with interactions | Quick chips, AI menu |
| **Design critique** and **accessibility review**: pinned as comments on the canvas | Quick chips, AI menu |
| **Generate code** (React+Tailwind, HTML/CSS, Vue, SwiftUI, Compose, Flutter) | Quick chips, AI menu |
| **Make**: prompt to a working single-file app, previewed in a sandboxed iframe, iterated with follow-up prompts, downloadable | Quick chips, AI menu |
| **Illustration / icon**: vector SVG inserted onto the canvas | Quick chips, AI menu |
| **Guidelines** (team rules the agent always follows) and **Skills** (reusable `/commands`) | AI settings |

Default models: `claude-opus-5-5`, `gpt-5.6-sol`, `gemini-3.5-flash`. You can change them in AI settings, and **Test** picks the best one your key actually has.

## Architecture

- `src/model`: document types, tree operations, layout engine (auto layout, constraints, groups, instance sync, variable binding), text measurement, code generation
- `src/store`: Zustand + Immer editor store (undo/redo history, transactions) and IndexedDB persistence
- `src/render`: shared SVG renderer (canvas, presentation, export) and export pipeline (SVG/PNG/JPG/PDF)
- `src/commands.ts`: one command registry that drives the menus, shortcuts, quick actions and context menus
- `src/editor`: UI (canvas, toolbar, panels, modals, comments)
- `src/present`: prototype player
- `src/ai`: provider adapters (official Anthropic, OpenAI and Google SDKs, loaded on demand), agent tools, design-spec builder, quick actions
- `tests/`: Playwright end-to-end specs (AI specs mock each provider's HTTP API)
