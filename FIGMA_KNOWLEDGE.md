# FIGMA — End-to-End Knowledge Base

> Last researched: **2026-10-07**. Covers Figma Design, Dev Mode, FigJam, Slides, Sites, Make, Buzz, Draw, Weave, Motion, the Figma agent, MCP, plugins/API, admin, plans and keyboard shortcuts.
> Notation: `⌘` = Cmd (Mac) / Ctrl (Win), `⌥` = Option (Mac) / Alt (Win), `⇧` = Shift. Features from 2025–2026 are tagged **[2025]** / **[2026]**. Beta = **(β)**.
> Figma ships UI changes often. Menu locations can move, so treat exact positions as "where it usually is" and use **Quick Actions (`⌘/` or `⌘K`)** to find any command by name.

---

## 0. TABLE OF CONTENTS
1. Product family overview
2. File browser / home (workspace, teams, projects, folders)
3. Figma Design editor — interface anatomy (UI3)
4. Toolbar — every tool
5. Main menu (Figma logo menu) — every menu
6. Left sidebar — Layers, Pages, Assets
7. Right sidebar — Design / Prototype / Properties panel, every section
8. Layers & object types (frames, groups, sections, shapes, vectors, text, images)
9. Layout: constraints, auto layout (incl. wrap, grid), layout grids, rulers & guides
10. Styling: fills, strokes, effects, blend modes, shaders, masks, boolean ops
11. Text & typography
12. Components, instances, variants, component properties, slots
13. Styles, variables, modes, collections, libraries
14. Prototyping & interactions, smart animate, variables/conditionals
15. Figma Motion (timeline animation)
16. Collaboration: multiplayer, comments, branching, version history, sharing, permissions
17. Dev Mode, Code Connect, MCP server, Code Layers
18. AI: Figma agent, Make, First Draft, AI tools, Weave, shaders, generative plugins
19. FigJam (whiteboard) — every tool
20. Figma Slides
21. Figma Sites
22. Figma Buzz
23. Figma Draw
24. Plugins, widgets, Community, REST API, webhooks
25. Import / export
26. Plans, seats, AI credits, admin & security
27. Desktop / mobile apps, settings, preferences
28. Keyboard shortcuts (master list)
29. Workflows & best practices
30. Glossary
31. Recent changelog (2025–2026)

---

## 1. PRODUCT FAMILY OVERVIEW

| Product | What it is | File type / where |
|---|---|---|
| **Figma Design** | Core vector UI/UX design, prototyping, design systems | `.fig` design files |
| **Dev Mode** | Developer-focused inspect mode inside Design files (toggle `⇧D`) | Inside design files |
| **FigJam** | Online whiteboard: brainstorming, diagrams, workshops | `.jam` |
| **Figma Slides** | Presentation tool with design-system support **[2024]** | `.deck` |
| **Figma Sites** | Design → publish responsive websites, CMS, code layers **[2025]** | Sites files |
| **Figma Make** | Prompt-to-app / prompt-to-code prototyping (AI); GA Aug 2026 **[2025]** | Make files |
| **Figma Buzz** | On-brand marketing asset production at scale from templates **[2025]** | Buzz files |
| **Figma Draw** | Illustration mode inside Design (brushes, variable stroke, texture) **[2025]** | Toggle inside Design |
| **Figma Weave** | Node-based AI image/video/media workflows (acquired Weavy, 2025) **[2025–26]** | Weave workflows |
| **Figma Motion** | Timeline-based animation natively on canvas **[2026]** | Inside Design |
| **Figma agent** | AI agent that reads canvas context, edits designs, runs Skills; GA Oct 6 2026 **[2026]** | Panel in all editors |
| **Figma MCP server** | Model Context Protocol server giving coding agents (Claude Code, Cursor, Copilot, Codex) design context; local (desktop) + remote | Dev tooling |
| **Code Connect** | Maps Figma components → real code snippets in Dev Mode/MCP | CLI + UI |
| **Community** | Public marketplace of files, plugins, widgets, UI kits, Skills, Weave tools, riffs | figma.com/community |

---

## 2. FILE BROWSER / HOME

**Left nav:**
- **Search** (files, projects, people, Community).
- **Recents** — recently opened files; filter by product type (Design/FigJam/Slides/Sites/Make/Buzz).
- **Drafts** — private files owned by you (not in a team). Drafts can be moved to projects.
- **Shared with you / Shared projects**.
- **Community** — explore resources.
- **Teams** (Pro) or **Workspaces** (Enterprise) → **Projects** → **Folders [2026, nested folders, previews, colors, duplicate]** → **Files**.
- **Starred** — pinned files/projects.
- **Trash** — deleted files (restorable ~30 days on most plans).
- **Plugins / Widgets / Fonts** (team/org-installed resources, admin settings).
- **Admin** (Org/Enterprise): members, billing, seats, libraries, AI settings, SSO, activity logs.

**Top right:** `+ Create` → Design file, FigJam board, Slide deck, Site, Make, Buzz file; **Import** (.fig, .jam, Sketch, images, PDF); notifications bell; account menu.

**File actions (right-click a file thumbnail):** Open, Open in new tab, Copy link, Share, Duplicate, Rename, Move (to project/folder), Star, Show version history, Delete, Restore (from Trash), Branch info.

**File grid / list toggles; sort by last viewed, last modified, alphabetical; filter by type.**

**Org structure:** Organization → Workspaces (Enterprise) → Teams → Projects → Folders → Files.

---

## 3. FIGMA DESIGN EDITOR — INTERFACE ANATOMY (UI3)

UI3 (launched Config 2024, default since) layout:

```
┌──────────────┬─────────────────────────────────┬────────────────┐
│ LEFT PANEL   │            CANVAS               │  RIGHT PANEL   │
│ ▸ Figma menu │                                 │ Avatars/Share  │
│ File name    │                                 │ Play ▸ Zoom %  │
│ File|Assets  │                                 │ Design|Prototype│
│ Pages        │                                 │ (properties)   │
│ Layers       │                                 │                │
│              │   ┌──────── TOOLBAR ────────┐    │                │
│              │   └─────(bottom center)─────┘    │                │
└──────────────┴─────────────────────────────────┴────────────────┘
```

- **Toolbar** is a floating bar at the **bottom center** of the canvas (UI3). Ends with **Dev Mode toggle** and **Draw / Motion / AI** mode switches.
- **Left panel** collapsible (`⌘\` hides all UI). Panels can be **minimized** to a compact floating header.
- **Right panel** = contextual properties (Design tab / Prototype tab; plus Inspect in Dev Mode).
- **Canvas** = infinite 2D space, zoom 0.39%–25,600%.
- **Context toolbar** — floating action bar appears on selection (e.g., for text, images, components, vectors: "Edit object", "Crop", "Edit text", AI actions).
- **Pixel preview / Pixel grid** toggles in View.
- **Agent panel [2026]** — opens from toolbar/top-right ("Figma agent"); can pop out to its own desktop window (Aug 2026).

**Top of left panel:** Figma logo (main menu), file name (click → rename/move/duplicate/version history/branch), project/team breadcrumb, **File / Assets** tabs, search layers (`⌘F` find & replace in layers).

**Top of right panel:** multiplayer avatars (click to follow/spotlight), **Share** button, **Present/Play** ▶ (dropdown: Present / Preview), **Zoom %** dropdown (Zoom in/out, to fit `⇧1`, to selection `⇧2`, 50%, 100% `⇧0`, 200%, pixel preview, rulers, outlines, multiplayer cursors, comments).

---

## 4. TOOLBAR — EVERY TOOL (Design mode)

| Group | Tool | Shortcut | Notes |
|---|---|---|---|
| **Move** | Move | `V` | Select/drag; `⌘`-click deep-select; `⌥`-drag duplicate |
| | Hand | `H` / hold `Space` | Pan |
| | Scale | `K` | Proportionally scales everything incl. strokes, text, effects |
| **Region** | Frame | `F` / `A` | Presets in right panel (iPhone, Android, Desktop, Watch, Paper, Social, Figma Community covers, Slides) |
| | Section | `⇧S` | Organize canvas areas; "Mark as ready for dev" |
| | Slice | `S` | Export region |
| **Shape** | Rectangle | `R` | `⇧`=square; corner radius, independent corners, corner smoothing (iOS squircle) |
| | Line | `L` | Arrowheads in stroke settings |
| | Arrow | `⇧L` | |
| | Ellipse | `O` | Arc handles: start/sweep/ratio (pie, donut) |
| | Polygon | — | Count of sides |
| | Star | — | Points, ratio |
| | Place image/video | `⌘⇧K` | Multi-place images into shapes |
| **Creation** | Pen | `P` | Vector networks (not just paths) |
| | Pencil | `⇧P` | Freehand |
| | Draw mode tools [2025] | — | Brushes, variable width, texture, Erase & drag-to-fill [Aug 2026] |
| **Text** | Text | `T` | Click=auto width, drag=fixed size |
| **Comment** | Comment | `C` | |
| **Actions / AI** | Actions | `⌘K` / `⌘/` | Quick actions + AI tools + plugins + assets |
| **Mode switches** | Design / Draw / Motion / Dev Mode | `⇧D` = Dev Mode | Toggles at toolbar right |
| | Eyedropper | `I` (while color picker open / on canvas) | |

**Pen-mode sub-toolbar (editing a vector, `Enter` on vector):** Move, Pen, Bend (`⌘` hold), Paint bucket (fill closed regions), Lasso select (`Q`), Cut / path cutting [2026], Variable width stroke [2026], Shape builder (Draw), Done.

**Image edit sub-toolbar:** Crop, Fill/Fit/Tile/Stretch, Remove background (AI), Upscale (AI), Edit image with AI / Weave tools [2026], Adjustments (exposure, contrast, saturation, temperature, tint, highlights, shadows).

**Text context toolbar:** font, size, weight, alignment, lists, links, AI "Rewrite this", "Translate", "Shorten".

---

## 5. MAIN MENU (Figma logo ▸) — EVERY MENU

**Back to files** · **Quick actions…** (`⌘/`)

**File:** New design file · New FigJam file · New Slides · Place image/video (`⌘⇧K`) · Import from CSV (Slides/Buzz) · Save local copy (.fig) · Save to version history (`⌥⌘S`) · Show version history · Export… (`⌘⇧E`) · Export frames to PDF · Export as… · Duplicate · Rename · Move to project · Delete · Branching: Create branch / View branches · Publish library · Preferences (desktop) · Help

**Edit:** Undo (`⌘Z`) · Redo (`⌘⇧Z`) · Copy · Cut · Paste (`⌘V`) · Paste over selection (`⌘⇧V`) · Paste to replace (`⌘⇧R`) · Copy as → Copy as CSS / iOS / Android / SVG / PNG (`⌘⇧C`) / Copy link · Copy properties (`⌥⌘C`) / Paste properties (`⌥⌘V`) · Duplicate (`⌘D`) · Delete · Set default properties · Select all (`⌘A`) · Select inverse (`⇧⌘A`) · Select none · Select all with same: fill, stroke, effect, text, font, instance, properties · Find and replace (`⌘F`) · Find next/previous

**View:** Pixel grid (`⇧'`) · Snap to pixel grid (`⇧⌘'`) · Layout grids (`⌃G` / `⇧G`) · Rulers (`⇧R`) · Outlines (`⌘Y`) · Multiplayer cursors (`⌥⌘\`) · Comments (`⇧C`) · Show/hide UI (`⌘\`) · Minimize UI (`⇧⌘\`) · Pixel preview · Mask outlines · Frame outlines · Resource panels · Zoom options · Panels: Layers (`⌥1`), Assets (`⌥2`), Design (`⌥8`), Prototype (`⌥9`), Inspect/Dev (`⌥0`)

**Object:** Group selection (`⌘G`) · Ungroup (`⇧⌘G`) · Frame selection (`⌥⌘G`) · Remove frame/unwrap · Add auto layout (`⇧A`) · Remove auto layout (`⌥⇧A`) · Suggest auto layout (AI) · Create component (`⌥⌘K`) · Create multiple components · Reset instance / Detach instance (`⌥⌘B`) · Go to main component · Push changes to main · Restore component · Use as mask (`⌃⌘M`) · Set as thumbnail · Bring to front (`⌘⇧]`) / Bring forward (`⌘]`) / Send backward (`⌘[`) / Send to back (`⌘⇧[`) · Flip horizontal (`⇧H`) · Flip vertical (`⇧V`) · Rotate 180° / 90° left/right · Flatten (`⌘E`) · Outline stroke (`⌥⌘O`) · Boolean groups: Union, Subtract, Intersect, Exclude · Rasterize selection · Lock/unlock (`⇧⌘L`) · Show/hide (`⇧⌘H`) · Collapse layers (`⌥L`) · Align (`⌥A` left, `⌥D` right, `⌥W` top, `⌥S` bottom, `⌥H` horizontal centers, `⌥V` vertical centers) · Distribute (`⌃⌥H`/`⌃⌥V`) · Tidy up (`⌃⌥T`) · Remove fill/stroke

**Vector:** Join selection · Smooth join · Delete and heal · Bend tool · Paint bucket · Offset path [2025] · Simplify vertices [2025] · Shape builder [2025]

**Text:** Bold (`⌘B`), Italic (`⌘I`), Underline (`⌘U`), Strikethrough (`⇧⌘X`), Create link (`⌘K` in text), Bulleted list (`⇧⌘8`), Numbered list (`⇧⌘7`), Alignment (`⌥⌘L/T/R/J`), Adjust size (`⇧⌘,` / `⇧⌘.`), Adjust letter spacing (`⌥,` / `⌥.`), Adjust line height (`⌥⇧,` / `⌥⇧.`), Adjust font weight (`⌥⌘,` / `⌥⌘.`), Text case (Upper/lower/Title), Show missing fonts

**Arrange:** Align · Distribute · Tidy up · Round to pixel · Pack horizontal/vertical

**Plugins:** Recents · Saved · Run last plugin (`⌥⌘P`) · Manage plugins · Find more · Development: New plugin / Import from manifest / Open console (`⌥⌘I`) / Hot reload

**Widgets:** recents, manage, development

**Preferences:** Snap to geometry · Snap to objects · Snap to pixel grid · Keep tool selected after use · Highlight layers on hover · Rename duplicated layers · Show dimensions on objects · Hide canvas UI during changes · Ctrl-click opens right-click menu (Mac) · Use number keys for opacity · Flip arrow keys/nudge amount (Small `1px` / Big `10px`, customizable) · Invert zoom direction · Use old trackpad zoom · Show hidden layers in a different color · Theme: Light / Dark / Follow system · Color profile (sRGB / Display P3) · Keyboard layout · Font settings · Accessibility: high contrast, reduced motion, larger text in UI

**Libraries** (`⌥3`): Manage team/org libraries; enable/disable libraries per file; update available library changes.

**Help & account:** Help page, Keyboard shortcuts (`⌃⇧?`), Release notes, Figma Learn, Support forum, Terms, Account settings.

---

## 6. LEFT SIDEBAR

### 6.1 File tab
- **Pages** — add `+`, rename, reorder (drag), duplicate, delete, copy link, **page dividers** (name a page `---` or "Mark as divider"). Page jump `PageUp/PageDown`.
- **Layers tree** — hierarchy. Icons indicate: Frame `#`, Group, Section, Component ◆ (main, purple), Instance ◇, Component set (dashed purple), Text `T`, Vector, Image, Boolean, Mask, Auto-layout frame (stacked bars icon), Slot [2026].
  - Hover actions: lock 🔒, show/hide 👁.
  - Rename: double-click or `⌘R`; batch rename with `⌘R` on multiple layers (find/replace, `$&` current name, `$n` number).
  - Search layers (top), filter by type.
  - Collapse all `⌥L`.
  - Drag to reorder / reparent.
  - Layers panel indicates "Ready for dev" status, branch changes.

### 6.2 Assets tab (`⌥2`)
- Search components across enabled libraries.
- **Local components** and **libraries** (click "Library" icon to manage).
- Drag instances onto canvas; hover to view description and docs link.
- Swap instance by `⌥`-drag onto existing instance.
- Also shows: Icons, UI kits (Figma's official UI kits — iOS, Material 3, Simple Design System), Community resources.

### 6.3 Libraries modal
- Tabs: **This file** (publish/update), **Team/Organization libraries** (enable/disable), **Updates** (review & accept library updates — Update all, preview changes, swap).
- Library **analytics** (Org/Ent): usage of components/styles/variables, detaches, inserts.

---

## 7. RIGHT SIDEBAR — DESIGN / PROTOTYPE PANEL (every section)

Tabs: **Design** · **Prototype** · (Dev Mode: Inspect, Plugins).

### 7.1 Nothing selected (Page settings)
- **Page** background color & opacity.
- **Variables** (open variables modal), **Styles** (local styles list: text, color, effect, grid), **Export** (whole page).

### 7.2 Selection header
- Layer type dropdown (e.g., change Frame ↔ Group ↔ Section; "Frame" presets), component name, instance swap, **Create component** button, **Boolean** buttons, **Mask** toggle, Auto-layout button, Mode toggles.

### 7.3 Position / Layout section (UI3 merges these)
- **Alignment row**: align left/center/right/top/middle/bottom, distribute (when multiple).
- **Position**: X, Y. Values accept math (`100*2`, `+10`, `50%`).
- **Rotation** (°), Flip H/V, rotate 90°.
- **Constraints** (when inside a frame without auto layout): Horizontal — Left, Right, Left & Right, Center, Scale; Vertical — Top, Bottom, Top & Bottom, Center, Scale. "Ignore auto layout" (absolute position) when parent is auto layout.
- **Layout section**:
  - Width/height (W, H) with **resizing modes**: **Fixed**, **Hug contents**, **Fill container**; **Min/Max width/height**.
  - Lock aspect ratio.
  - Auto layout controls (see §9.2).
  - **Clip content** checkbox (frames).
- **Corner radius** (uniform or individual), **Corner smoothing** (0–100%; 60% ≈ iOS).

### 7.4 Appearance
- **Opacity** (layer), **Blend mode** (Pass through, Normal, Darken, Multiply, Plus darker, Color burn, Lighten, Screen, Plus lighter, Color dodge, Overlay, Soft light, Hard light, Difference, Exclusion, Hue, Saturation, Color, Luminosity).
- Visibility toggle; bind to boolean variable.
- Corner radius may live here in UI3.

### 7.5 Fill
- `+` add fill, multiple fills stack; per-fill visibility, opacity, blend mode.
- Types: **Solid**, **Linear gradient**, **Radial gradient**, **Angular gradient**, **Diamond gradient**, **Image** (Fill/Fit/Crop/Tile; adjustments), **Video** (paid plans), **Pattern [2025]** (tile a layer as pattern), **Noise / Texture [2025]**, **Shader fill [2026]** (AI-generated WebGPU shader, parameterized).
- Color picker: HEX, RGB, HSL, HSB, CSS; P3 support; Eyedropper `I`; document colors; style/variable picker (◇ grid icon) to apply color styles/variables.
- Opacity can be bound to number variables (Sep 2026).

### 7.6 Stroke
- Color/fill types like fills; **Weight**; **Position**: Inside / Center / Outside; **Per-side strokes** (top/right/bottom/left/custom); **Stroke style**: Solid / Dashed (dash, gap, cap); **Join** (miter/round/bevel), **Cap** (none, round, square, line arrow, triangle arrow, reversed, circle, diamond); **Variable width strokes [2025–26]**; **Brush strokes** (Draw); **Miter angle**.
- "Outline stroke" converts to fill.

### 7.7 Effects
- **Drop shadow** (X, Y, blur, spread, color, "show behind transparent areas")
- **Inner shadow**
- **Layer blur** (uniform or **progressive blur [2025]**)
- **Background blur** (glassmorphism; progressive too)
- **Noise**, **Texture** **[2025]**
- **Glass [2025]** (Liquid-glass style: refraction, depth, dispersion, frost, light angle)
- **Custom shader effects [2026]**
- Effect styles; bind effect values to variables.

### 7.8 Layout guide (Layout grids)
- **Grid** (square px), **Columns**, **Rows**; count, width, gutter, margin, offset, type Stretch/Left/Center/Right; color; grid styles. Toggle `⌃G`.

### 7.9 Selection colors
- Lists every color used inside selection — edit all at once, swap to style/variable.

### 7.10 Text section (text layers) → see §11.

### 7.11 Component / Instance section
- Main component: description, documentation links, **component properties** list (+ add property), "Publish", variants properties.
- Instance: swap instance dropdown, property controls (boolean toggles, text fields, instance swap, variant dropdowns, slot content), **Reset all changes**, **Detach**, **Go to main**, "Show nested instances" (exposed properties).

### 7.12 Export
- `+` add export setting: scale (0.5x, 1x, 2x, 3x, 4x, or 512w/512h), suffix, format **PNG, JPG, SVG, PDF** (+ WebP via plugins / GIF/MP4/Lottie from Motion [2026]). Options: "Include 'id' attribute", "Outline text", "Simplify stroke", "Contents only", "Use absolute bounds", "Ignore overlapping layers". **Preview**. Export button.

### 7.13 Prototype tab → see §14.

### 7.14 Annotations/Measurements (Dev Mode) → see §17.

---

## 8. LAYERS & OBJECT TYPES

| Type | Purpose | Key facts |
|---|---|---|
| **Frame** | Container with its own size, fills, clipping, auto layout, grids, prototypes | Top-level frames = "screens/boards"; nested frames OK. Convert group→frame `⌥⌘G`. |
| **Group** | Lightweight container; bounds = children | No fills/auto layout; `⌘G`. |
| **Section** | Canvas organization area | Can contain frames; dev status ("Ready for dev"), presentation in prototypes, can hide contents; `⇧S`. |
| **Component** | Reusable master (main) | `⌥⌘K`. Purple ◆. |
| **Component set** | Container of variants | Dashed purple border. |
| **Instance** | Copy linked to main | Overrides preserved on update. |
| **Rectangle/Ellipse/Polygon/Star/Line/Arrow** | Primitive shapes | Editable as vectors (`Enter`). |
| **Vector** | Pen-drawn **vector network** | Points can connect to >2 segments; regions fillable with Paint bucket. |
| **Boolean group** | Union/Subtract/Intersect/Exclude | Non-destructive; flatten (`⌘E`) to commit. |
| **Text** | Typography | Auto width / Auto height / Fixed size / Truncate. |
| **Image / Video** | Image fills on rectangles | Images are always fills, not a separate layer type. |
| **Slice** | Export area | Not rendered. |
| **Mask** | Bottom layer clips layers above in group | Alpha, vector, or luminance masks [2025]. |
| **Slot [2026]** | Area inside a component accepting arbitrary content in instances | See §12.6. |
| **Code layer [2026 β]** | Live React/code on canvas (Sites/Make/Design) | See §17.5. |
| **Sticky/Shape/Connector** | FigJam-only types | See §19. |

**Selection behaviors:** Click selects top-level; double-click enters; `⌘`-click deep select; `Enter` selects children; `⇧Enter` selects parent; `Tab`/`⇧Tab` next/previous sibling; `⌘`-drag marquee selects within frames; `⌥` hover shows distances (redlines) between objects.

**Smart selection:** Select evenly spaced objects → pink handles to adjust spacing, drag to reorder.

**Nudge:** arrows = 1px, `⇧`+arrow = 10px (custom in prefs).

**Duplication:** `⌘D` repeats last offset ("smart duplicate"). `⌥`-drag duplicates.

---

## 9. LAYOUT

### 9.1 Constraints
- Set relationship of child to parent frame on resize (Left/Right/Left & Right/Center/Scale; Top/Bottom/Top & Bottom/Center/Scale).
- Hold `⌘` while resizing a frame to **ignore constraints**.
- Groups pass constraints to children.

### 9.2 Auto Layout (`⇧A`)
CSS-flexbox-like layout for frames.
- **Direction:** Vertical ↓, Horizontal →, **Wrap** (horizontal wrap; **vertical wrap added Sep 2026**), **Grid [2025]** (CSS-grid-like: rows/columns, fixed/fill (fr)/hug tracks, spanning cells, gaps).
- **Spacing between items** (fixed number or **Auto** = space-between). Negative spacing allowed. **Responsive spacing / horizontal & vertical flows [Aug 2026].**
- **Padding:** horizontal/vertical or individual (T/R/B/L).
- **Alignment:** 9-point grid control (+ text baseline alignment for horizontal).
- **Resizing for children:** Fixed / Hug / Fill; **min/max** width/height.
- **Absolute position** (child ignores auto layout; then constraints apply).
- **Canvas stacking order:** first on top or last on top.
- **Strokes included in layout** option.
- **Wrap**: row gap + column gap; align content.
- **Suggest auto layout** (AI, `⌥⇧A` variant) converts manual layouts.
- Shortcuts: `⇧A` add, `⌥⇧A` remove; with selection, arrow keys reorder children; `⌃⌥` + arrows adjust alignment; hold `⌥` while hover to see padding.
- Bind spacing/padding/radius/sizes to **number variables**.

### 9.3 Layout grids
- Columns/rows/grid on frames; frames' children snap; constraints can be relative to columns.

### 9.4 Rulers & Guides
- `⇧R` show rulers; drag from ruler to make guide; select guide to move/delete; guides are per frame or canvas.

### 9.5 Snapping & measurement
- Smart guides (red/pink lines), spacing indicators, snap to pixel grid; hold `⌥` to measure distance between selection and hovered layer.

---

## 10. STYLING

- **Fills / strokes / effects** — §7.5–7.7.
- **Blend modes** at layer level and per fill.
- **Masks** — select layers → `⌃⌘M`; bottom layer is the mask. Mask types: Alpha / Vector (outline) / Luminance.
- **Boolean operations** (toolbar/Object menu): Union `⌥⇧U`, Subtract `⌥⇧S`, Intersect `⌥⇧I`, Exclude `⌥⇧E`.
- **Flatten** `⌘E`, **Outline stroke** `⌥⌘O`.
- **Corner smoothing** for squircles.
- **Gradients**: on-canvas handles to edit stops; add stops by clicking bar; `Delete` removes stop.
- **Image adjustments**: Exposure, Contrast, Saturation, Temperature, Tint, Highlights, Shadows. Image crop mode. AI: Remove background, Boost resolution (upscale), Expand / edit image (Weave tools) [2026].
- **Shaders [2026]**: prompt the agent or reference an image to generate a WebGPU shader fill/effect; parameters exposed as sliders; saved and reused like styles; can be animated (Sep 2026) and published to Community.
- **Draw mode [2025]** illustrative styles: brush strokes (stretch/scatter brushes), variable width, textures, noise, multi-edit vectors.

---

## 11. TEXT & TYPOGRAPHY

**Text properties (right panel ▸ Typography):**
- Font family (Google Fonts built-in; local fonts via desktop app / font installer; **Shared fonts** on Org/Ent), weight/style, size, **line height** (auto, px, %), **letter spacing** (% or px), **paragraph spacing**, **paragraph indent**.
- **Alignment** horizontal (left/center/right/justify) and vertical (top/middle/bottom).
- **Resizing**: Auto width, Auto height, Fixed size, **Truncate text** (ellipsis + max lines).
- **Type details** (⋯ / settings icon): Decoration (underline, strikethrough; underline style/thickness/offset/color [2025–26]), Case (Original, UPPER, lower, Title, Small caps, Forced small caps), **Lists** (bulleted/numbered, nesting with Tab), **Hanging punctuation**, **Hanging lists**, **Leading trim** (cap height to baseline — CSS `text-box-trim`), **OpenType features** (ligatures, tabular/proportional numbers, fractions, stylistic sets, slashed zero, etc.), **Variable font axes** (wght, wdth, slnt, opsz, custom) — expanded Aug 2026, Vertical trim, Text direction (RTL support).
- **Text styles** (§13), **text variables** (string variables bound to content), font-family/weight/size bound to variables.
- **Links** in text (`⌘K` with text selected).
- **Find & replace** text across file (`⌘F`).
- **Missing fonts** dialog (replace fonts across file).
- AI text tools: Rewrite, Shorten, Translate, Replace content with realistic data.

---

## 12. COMPONENTS

### 12.1 Basics
- **Create**: `⌥⌘K` (single) or "Create multiple components" / "Create component set".
- **Main component** (◆) vs **instance** (◇). Changes to main propagate; instance **overrides** (text, fills, visibility, swaps) persist.
- **Go to main component** (right-click ▸ Main component), **Reset instance**, **Detach** (`⌥⌘B`), **Push changes to main**, **Restore component** (if main deleted).
- **Instance swap**: dropdown or `⌥`-drag from assets.
- **Nested instances** and **exposed nested properties**.
- **Description & documentation links** shown in Assets and Dev Mode.
- **Hidden from publishing**: name starting with `.` or `_`.

### 12.2 Variants
- Combine components into a **component set** ("Combine as variants").
- Variant properties: name/value pairs (e.g., `Size=Large, State=Hover`). Layer name encodes it: `Size=Large, State=Hover`.
- Instance shows dropdown per property; boolean-like values (`true/false`, `on/off`, `yes/no`) render as toggles.
- **Interactive components**: prototype interactions between variants (hover, press) inherited by all instances.

### 12.3 Component properties
| Property | Controls |
|---|---|
| **Variant** | Which variant |
| **Boolean** | Layer visibility toggle |
| **Text** | Text content field |
| **Instance swap** | Which nested component (with **preferred values**) |
| **Slot [2026]** | Freeform content area |
Create from right panel ▸ Properties `+`, or from the layer's property-binding icon.

### 12.4 Simplified instances / Show nested / Expose properties from nested instances.

### 12.5 Component playground (Dev Mode) — devs toggle props to see variants without editing.

### 12.6 Slots [2026, open beta Mar 2026]
- Mark a frame inside a component as a **slot**; in instances, users can drop any content (lists, cards) into that slot without detaching. Supports preferred components, min/max children. Rebuilt on the new **Materializer** instance engine.

### 12.7 Publishing
- Assets ▸ Library ▸ **Publish** (with change notes). Subscribers see "Updates available" → review → update. Library can include components, styles, variables.

---

## 13. STYLES, VARIABLES, MODES, LIBRARIES

### 13.1 Styles
- Types: **Color (paint)**, **Text**, **Effect**, **Layout guide (grid)**.
- Create via ◇ (style icon) ▸ `+`. Organize with `/` folders (`Brand/Primary/500`).
- Edit, detach (unlink), swap libraries, descriptions.
- Styles can contain multiple fills/effects and reference variables.

### 13.2 Variables (right panel with nothing selected ▸ Local variables; or `⌥⌘...`)
- **Types**: **Color**, **Number**, **String**, **Boolean**.
- **Collections** group variables; each collection has **Modes** (e.g., Light/Dark, Mobile/Desktop, Brand A/B, Languages). Mode count limited by plan (Pro: 10, Org: 20, Ent: unlimited-ish/40 — verify current).
- **Aliasing**: variables reference other variables (primitive → semantic tokens).
- **Scoping**: limit where a variable appears (e.g., only fill, only corner radius, only gap, text content, opacity, font family…).
- **Code syntax**: per-platform names (Web CSS, iOS, Android) surfaced in Dev Mode.
- **Bindable properties**: fills, strokes, effects (shadow color/offset/blur/spread), width/height/min/max, padding, gap, corner radius, stroke weight, opacity (incl. fill opacity, Sep 2026), layer visibility (boolean), text content (string), font family/weight/size/line height/letter spacing/paragraph spacing, grid values, prototype variables.
- **Set mode** on frames/sections/pages (right panel ▸ Appearance ▸ mode switcher); children inherit; "Auto" inherits from parent.
- **Extended collections [2025]**: inherit a parent collection and override values (multi-brand theming).
- **Import/export variables** as JSON (W3C design tokens format) [2025].
- **Variables in prototypes**: set variable, conditional (if/else), expressions (math, string concat, booleans).
- REST API: GET/POST variables (Enterprise).

### 13.3 Libraries
- Any file can publish. Team library (Pro) / Org-wide (Org) / Workspace defaults (Ent).
- **Default libraries** auto-enabled for new files (admins).
- **Library analytics**, **Library swaps** (swap all instances from one library to another), **Branching** to test library changes.
- **Figma UI kits** (iOS 26, Material 3, Simple Design System, macOS, etc.) available by default.

---

## 14. PROTOTYPING

Open **Prototype** tab (right panel) or `⇧E` toggles Design/Prototype tab.

### 14.1 Flow & settings (nothing selected)
- **Flow starting points** (multiple named flows per page; descriptions; share link per flow).
- **Device/Frame** (iPhone, Android, iPad, Desktop, Watch, Presentation, Custom) + model/color + orientation.
- **Background** color for presentation.
- **Prototype settings**: **Thumbnail**, scroll behavior.

### 14.2 Connections (noodles)
Hover a frame/layer in Prototype tab → drag the **⊕ handle** to a destination. Each interaction = **Trigger → Action → Animation**.

**Triggers:** On click/tap · On drag · While hovering · While pressing · Key/Gamepad (keyboard shortcuts, gamepad buttons) · Mouse enter · Mouse leave · Mouse down · Mouse up · **After delay** (ms) · **On media hit / On media end** (video) · On variable change (conditional) · Scroll-based triggers in Sites.

**Actions:**
- **Navigate to** (frame)
- **Change to** (variant — interactive components)
- **Back**
- **Scroll to** (layer in frame, with offset)
- **Open overlay** (position: center, top-left…, manual; close when clicking outside; add background dim)
- **Swap overlay**
- **Close overlay**
- **Open link** (URL, open in new tab)
- **Set variable** (value or expression)
- **Set variable mode** (e.g., switch theme/language)
- **Conditional** (if/else using variables)
- **Media actions** (Play, Pause, Mute, Unmute, Toggle play/pause, Toggle mute, Jump to time / forward / backward)
- **Multiple actions** per trigger (sequenced).

**Animations:** Instant · Dissolve · **Smart animate** (matches layers with same names across frames and tweens properties) · Move in · Move out · Push · Slide in · Slide out.
- Direction ← → ↑ ↓; "Animate matching layers".
- **Easing**: Linear, Ease in, Ease out, Ease in and out, Ease in back, Ease out back, Ease in and out back, Custom bezier, **Spring presets** (Gentle, Quick, Bouncy, Slow) and **Custom spring** (stiffness, damping, mass).
- Duration (ms).

### 14.3 Scroll & overflow
- **Overflow behavior** (frame): No scrolling, Horizontal, Vertical, Both. Content must exceed frame bounds (clip content).
- **Position when scrolling**: Scroll with parent, **Fixed** (stay in place), **Sticky** (sticks at top).

### 14.4 Advanced prototyping
- **Variables + conditionals + expressions** (counters, carts, form logic, themes).
- **Multiple actions**; **video** in prototypes; **text input** (via plugins/Sites).
- **Interactive components** (variant-based micro-interactions).
- **Prototype inside sections**; **Hotspots** (hold `⇧` to show).
- **Annotations for prototypes**, **flow descriptions**.

### 14.5 Presenting
- **Present** (`⌥⌘↵`) opens prototype viewer: arrows navigate frames; `R` restart; `Z` toggles fit; options menu: fit (Fit / Fill / Actual size), show hotspot hints, device frame, comments, share, flows sidebar, presentation mode.
- **Preview** inline window (small floating player in editor).
- **Mobile mirroring** via Figma mobile app (iOS/Android) — "Mirror" selected frame or open prototype.
- **Share prototype** link with password/expiry (paid plans); embed.

---

## 15. FIGMA MOTION [2026]

Native timeline animation in Figma Design (announced Config 2026).
- **Timeline panel** at bottom: tracks per layer, keyframes for **position, opacity, scale, rotation**, size, color, effects; fade in/out presets; **easing** curves (bezier/spring).
- Animate with the **Figma agent** by prompting ("make the card bounce in").
- **Motion styles** (custom, reusable animation patterns) [Sep 2026].
- **Audio** — drag an audio file onto any motion clip [Sep 2026].
- **Text animations** — per-character/word/line [Sep 2026].
- **Export**: CSS, JSON, React (via Dev Mode), MP4, WebM, GIF, animated SVG, **Lottie** [Sep 2026].
- Motion works with components (animated variants) and is inspectable in Dev Mode.
- Share animations as **Community riffs** [Sep 30 2026].
- **3D transforms** — early access/waitlist (Config 2026).

---

## 16. COLLABORATION

### 16.1 Multiplayer
- Real-time cursors, avatars top-right. Click avatar → **Observation mode** (follow their viewport). **Spotlight me** → everyone follows you.
- **Cursor chat** (`/` in FigJam & Design), **audio** (huddle-like voice in files), **reactions/emotes**.

### 16.2 Comments (`C`)
- Click to drop pin, or drag to comment on an area; attach to a layer (pins follow).
- **@mentions**, emoji reactions, attachments/images, markdown-ish formatting, **resolve**, reply threads.
- Comment sidebar: filter (unread, mine, resolved), sort, search; `⇧C` toggle visibility.
- Comments on prototypes, Dev Mode, FigJam, Slides.

### 16.3 Sharing (Share button)
- Invite by email; roles per file: **Can view**, **Can view prototypes only**, **Can edit** (Dev Mode access for viewers on Dev seat).
- **Link sharing**: Anyone with link / Only people invited / Org-only; can view / can edit; **password** and **expiry** (paid).
- Copy link (with node id: `?node-id=...`), copy link to selection (`⌘L` / right-click "Copy link to selection").
- **Embed** code (iframe embed kit).
- Transfer ownership; move to project.
- **Permissions inheritance**: Team → Project → File. Project-level access settings.

### 16.4 Version history
- Auto checkpoints every ~30 min of activity + named versions (`⌥⌘S`). Restore, duplicate version, compare. Free plans: 30-day history; paid: unlimited.

### 16.5 Branching (Org/Ent; Pro limited)
- Create branch from main file → edit isolated → **Request review** → reviewers compare changes (per-frame diff) → **Merge** (resolve conflicts: choose main vs branch). Archive branches. Library branches let you test system changes.

### 16.6 Notifications & activity
- Bell: comments, mentions, invites, library updates, access requests. **Activity** in file (who changed what, for Org).

### 16.7 Dev status & annotations
- **Mark as ready for dev** on frames/sections; status: Ready for dev / Completed / Changed since ready. Developers get notified; see **Compare changes** diff.

---

## 17. DEV MODE, CODE CONNECT, MCP, CODE LAYERS

### 17.1 Dev Mode (`⇧D`)
Requires **Dev seat** or **Full seat** (viewers can't access on paid plans).
- **Left panel**: Ready-for-dev view (sections/frames marked ready), layers list, **Focus view** on a single design (status, versions, compare changes, Jira/Linear links).
- **Right panel (Inspect)**:
  - Layer name, **Code** tab: **CSS** / **Tailwind [2025]** / **iOS (SwiftUI/UIKit)** / **Android (Compose/XML)**; units px/rem; scale; "Copy".
  - **Box model** (padding, margin-like spacing, size), **Layout properties**, **Typography**, **Colors/variables** (token names with code syntax), **Assets** export (icons, images in SVG/PNG/PDF at scales), **Component props** + **Component playground**, **Code Connect** snippets, **Dev resources** (links to Storybook, GitHub, Jira, docs), **Annotations**.
- **Measure tool** (`⇧M`): click-and-hover distances; persistent **measurements** (spacing, padding) on canvas.
- **Annotation tool** (`⇧T`): annotate layers with notes + pinned properties (e.g., "padding: 16"), annotation **categories** (Accessibility, Interaction, Development…).
- **Compare changes** (diff between versions: before/after with property-level changes).
- **Plugins in Dev Mode**: Jira, GitHub, Linear, Storybook, Anima, Locofy, Builder.io, AWS Amplify, custom codegen plugins.
- **VS Code extension** "Figma for VS Code": inspect, comments, notifications, code autocomplete from design in editor.

### 17.2 Code Connect
- Map Figma components to real code. Two modes: **Code Connect CLI** (`npx figma connect create|publish`, files `*.figma.tsx`, supports React, React Native, HTML/Web Components, SwiftUI, Jetpack Compose, Storybook) and **Code Connect UI** (map in-app via GitHub repo connection, no CLI) [2025–26]; **multiple mappings per component** [Mar 2026].
- Snippets appear in Dev Mode and are served to the **MCP server** for production-accurate code with fewer tokens [Aug 2026].
- GitHub integration: connect multiple GitHub orgs [Oct 5 2026].

### 17.3 Figma MCP server
- **Local (Desktop) server**: Figma desktop app ▸ Preferences ▸ "Enable Dev Mode MCP server" → `http://127.0.0.1:3845/mcp`.
- **Remote server**: `https://mcp.figma.com/mcp` (OAuth; no desktop app needed) [2025–26]. **Enterprise-managed MCP authorization** GA (Aug 2026), Okta Cross-App Access.
- Clients: Claude Code, Cursor, VS Code/GitHub Copilot, Windsurf, OpenAI Codex, Gemini CLI, etc.
- Typical tools: `get_design_context` / `get_code` (React+Tailwind representation of selection), `get_variable_defs` (tokens), `get_screenshot`, `get_metadata` (XML layer tree), `get_code_connect_map`, `create_design_system_rules`, FigJam `get_figjam`; **write-to-canvas tools** (agents can create/edit designs on canvas, "Agents, meet the Figma canvas" Mar 2026; code → Figma "Generate Figma design from code / capture UI"), Weave tool execution via MCP [Aug 2026].
- Workflow: select frame or pass link with `node-id` → ask agent to "implement this design" → agent pulls context + Code Connect + variables.

### 17.4 Design → code & code → design
- "Copy as code", Dev Mode codegen, plugins (Anima, Builder.io, Locofy), Figma Make (AI apps), Figma Sites (publish), **Code to Figma** (capture running web UI into editable layers via MCP/Claude Code/Copilot) [2026].

### 17.5 Code Layers [2026, closed beta / waitlist]
- Live, editable code-backed layers on the canvas: clone repos, edit code-backed components, extract flows into editable design layers, convert design layers ↔ code, version compare, sync back to codebase. Earlier version shipped in **Figma Sites** (2025) as "code layers" (React components with AI prompting).

---

## 18. AI IN FIGMA

### 18.1 Figma agent [GA Oct 6 2026]
- Chat panel in Design (and other editors) that reads canvas context; can create/modify layers, auto layout, components, apply design systems, rename layers, generate content, animate (Motion), make shaders, build generative plugins.
- **Skills**: markdown-based packaged workflows (SKILL.md); create your own, browse **Community skills** [Aug 2026]; team-shared.
- **Guidelines**: configurable rules for the agent (e.g., design-system conventions) [Oct 2026].
- **File search**, integrations with **Notion, Slack, GitHub**; interactions shared with team by default.
- Pop-out window on desktop [Aug 2026]. FigJam & Slides agents (coming soon / waitlist).
- Consumes **AI credits**.

### 18.2 Figma Make [GA Aug 2026]
- Prompt-to-app: describe an app → generates working React code + live preview; chat to iterate; **Point-and-edit** (select element, tweak visually); paste Figma frames as context; attach images; **Design systems in Make** (use your library/code packages); connect **Supabase** (backend, auth, DB); publish to web (custom domain); share/remix; code editor view; templates. Ships to Community.

### 18.3 First Draft / Make Designs
- Generate editable UI design layers from prompts using wireframe/high-fidelity design system kits (App, Web, Wireframe kits) — in Actions ▸ "First Draft" (now folded into agent flows).

### 18.4 AI tools (Actions menu `⌘K` ▸ AI)
- **Rename layers** (AI), **Replace content / Populate** realistic text, **Rewrite / Shorten / Translate text**, **Make image** (generate), **Edit image**, **Remove background**, **Boost resolution**, **Search with image / visual search** (find similar designs/components across libraries), **Suggest auto layout**, **Make prototype** (auto-wire connections), **Summarize** (FigJam), **Sort stickies**, **Generate board/diagram** (FigJam), **Generate slides / Tone rewrite** (Slides).

### 18.5 Figma Weave [2025–26]
- Formerly **Weavy** (acquired 2025). Node-based canvas chaining AI models (image/video gen from multiple providers, upscalers, style transfer, masking, compositing).
- **Weave tools in Figma Design** [2026]: swap backgrounds, add logos, change aspect ratios, style transfer, asset extraction without leaving the file.
- **Figma node** in Weave workflows — connect any Figma frame [Sep 17 2026].
- Publish Weave tools to Community [Sep 16 2026]; executable via MCP.

### 18.6 Generative plugins [2026]
- Describe a tool → agent builds a reusable plugin living in the file; shareable in file / Community; can include shaders/animations (Sep 2026).

### 18.7 AI credits & admin
- Credits per seat per month (Full/Dev/Collab differ; Dev seats 5,000/mo per Aug 2026); admins can buy more, set per-user caps, enable/disable AI, opt out of content training (Org/Ent default off for training).

---

## 19. FIGJAM — EVERY TOOL

**Toolbar (bottom):** Move `V` / Hand `H` · **Marker** `M` (colors, thicknesses), **Highlighter** `⇧M`, **Washi tape** `⇧W`, **Eraser** `⇧Backspace` · **Sticky note** `S` (colors; author name; votes; wide sticky) · **Shapes** `R`/`O`/`⇧S`: square, ellipse, rounded rect, diamond, triangle, parallelogram, cylinder (database), document, star, arrows, plus, chevron etc. (+ flowchart shape library, AWS/GCP/Azure icon libs) · **Connector** `X` (straight/elbowed/curved; arrowheads; labels; auto-reroute) · **Text** `T` · **Section** `⇧S` · **Table** `⇧T` · **Stamps** `E` and **Emotes** (react on canvas) · **Code block** (syntax-highlighted) · **Templates & resources** (templates, widgets, plugins, stickers, components, Community) · **AI** ✨ (generate diagrams/boards/templates, summarize, sort stickies, cluster) · **Mind map**, **Org chart**, **Timeline**, **Sticky clusters**.

**Facilitation features (top/right):**
- **Timer** (with music), **Voting** sessions (votes per person, results), **Spotlight**, **Cursor chat**, **Audio**, **Hide other cursors**, **Open session** (anyone with link can edit for 24h without account), **Lock** objects, **Sticky author toggle**, **Present** sections as slides, **Music** in timer.
- **Widgets**: polls, voting, Jira/GitHub cards, notes, dice, countdown, etc.
- Diagramming: **auto-layout-like diagram reflow**, quick-create (click `+` next to a shape to add connected shape), **diagram AI**.
- Import: images, PDFs, Design frames (copy/paste), Mermaid via plugins/AI, `.jam` files.
- Export: PNG, JPG, PDF, CSV (stickies/tables).
- **FigJam agent** — waitlist (Config 2026).
- MCP: read FigJam boards via `get_figjam`.

---

## 20. FIGMA SLIDES

- **Grid view / single slide view** toggle; drag to reorder; sections/rows.
- **Templates** + **design system** integration (use your library components/styles).
- **Slide themes** (colors, fonts, consistent across deck).
- **Interactive elements**: live **polls**, **alignment scale**, **stamps**, **embeds (Figma prototypes)**, **video**, YouTube.
- **Object animations** (appear, dissolve, slide, scale; build order) + **Smart animate transitions** between slides.
- **Presenter view** with **speaker notes**, timer; **Audience view**; **Present** from browser or desktop.
- **AI**: generate deck from outline/prompt, rewrite tone (formal↔casual), shorten/expand, "Slides agent" (waitlist 2026).
- **Design mode** inside Slides (full Figma design tools for slide).
- Import: **Google Slides / PowerPoint (.pptx)**; Export: **PDF, PNG/JPG, .pptx**, share link.
- **Slides templates in Buzz**; brand locking.

---

## 21. FIGMA SITES [2025]

- Design responsive pages with **breakpoints** (Desktop/Tablet/Mobile) and auto layout; **Sites from Figma Design** frames (copy/paste into site).
- **Webpages**, **site navigation**, **Interactions & animations** (appear, hover, press, scroll-based, scroll parallax, marquee, typewriter, rotate; presets), **Interactive components**.
- **Code layers**: React components generated via AI or written in code editor (e.g., 3D, calculators, forms).
- **CMS [2025]**: collections, fields, items, dynamic pages, bind content to layers.
- **Site settings**: SEO title/description, favicon, social preview, **custom domain**, analytics, password protection, custom code (head/body), redirects.
- **Publish** to `*.figma.site` or custom domain; preview; version history; responsive preview.
- Accessibility checks (semantic tags: heading levels, links, alt text).

---

## 22. FIGMA BUZZ [2025]

- For marketing/brand teams to produce assets at scale.
- **Templates** with **locked** areas (designers control), editable fields for others.
- **Bulk create** from **CSV / Google Sheets** (data-mapped fields) → hundreds of assets.
- **AI image generation/editing** (Weave-powered), background removal, resize to formats (Instagram, LinkedIn, Story, banners).
- Brand assets library, templates library.
- Export: PNG, JPG, PDF, MP4 (motion), bulk ZIP.

---

## 23. FIGMA DRAW [2025]

- Toggle **Draw** mode in Design toolbar.
- **Brushes**: stretch brushes (calligraphic, textured), scatter brushes; pressure via tablet.
- **Variable width strokes** (width profile editing on path).
- **Textures & noise effects**, pattern fills.
- **Vector editing upgrades**: Lasso select `Q`, **Shape builder** (merge/subtract regions by drag), **Offset path**, **Simplify vertices**, **multi-edit**, **path cutting** & **Erase / drag-to-fill** [Aug 2026].
- Illustration export as SVG.

---

## 24. PLUGINS, WIDGETS, COMMUNITY, API

### 24.1 Using plugins
- Run: `⌘K`/`⌘/` → type plugin name; right-click ▸ Plugins; `⌥⌘P` run last.
- Save plugins to toolbar/"Saved"; org admins can **approve/allowlist** plugins.
- Popular: Unsplash, Iconify, Lorem Ipsum/Content Reel, Stark/Contrast (a11y), Able, Autoflow, Remove BG, Html.to.design, Anima, Builder.io, Locofy, Tokens Studio, Batch Styler, Similayer, Find & Replace, Clean Document, LottieFiles, Rename It, Design Lint, Mockup, Blush, Charts.

### 24.2 Building plugins (Plugin API)
- Files: `manifest.json` (name, id, api `1.0.0`, main `code.js`, ui `ui.html`, `editorType: ["figma","figjam","dev","slides","buzz"]`, `networkAccess`, `documentAccess: "dynamic-page"`, `capabilities: ["codegen","inspect","vscode"]`, permissions).
- Two threads: **main** (sandbox, access `figma` global, no DOM) ↔ **UI iframe** (HTML/JS, network) via `figma.ui.postMessage` / `parent.postMessage({pluginMessage})`.
- Key APIs: `figma.currentPage`, `figma.root`, `figma.currentPage.selection`, `figma.createFrame/Rectangle/Text/Component()`, `figma.loadFontAsync()` before editing text, `node.appendChild`, `node.layoutMode = "VERTICAL"`, `figma.variables.*` (getLocalVariablesAsync, createVariable, setValueForMode, setBoundVariable), `figma.getStyleByIdAsync`, `figma.importComponentByKeyAsync`, `figma.notify()`, `figma.closePlugin()`, `figma.clientStorage`, `figma.on("selectionchange")`, `figma.codegen.on("generate")` (Dev Mode codegen plugins), `figma.showUI(__html__, {width, height, themeColors:true})`, `exportAsync`, dynamic page loading (`await figma.loadAllPagesAsync()`).
- Dev: Plugins ▸ Development ▸ New plugin (templates) / Import from manifest; console `⌥⌘I`; TypeScript typings `@figma/plugin-typings`; publish to Community or private to org.

### 24.3 Widgets
- Interactive objects (mainly FigJam) built with React-like `figma.widget` API (`useSyncedState`, `AutoLayout`, `Text`, `usePropertyMenu`).

### 24.4 Community
- Profiles, publish files/plugins/widgets/**Make apps**/**Skills**/**Weave tools**/**riffs** [2026]/**Apps (OAuth apps)** [Mar 2026]; free or paid resources; duplicate ("Open in Figma"), remix, like, comment; creator analytics.

### 24.5 REST API (`https://api.figma.com/v1`)
- Auth: Personal access token (`X-Figma-Token`) or OAuth 2 (scopes like `file_content:read`, `file_variables:read/write`, `webhooks:write`).
- Endpoints: `GET /files/:key` (document tree), `/files/:key/nodes?ids=`, `/images/:key?ids=&format=png|svg|pdf&scale=` (renders), `/files/:key/images` (image fills), `/files/:key/versions`, `/files/:key/comments` (GET/POST/DELETE), comment reactions, `/me`, `/teams/:id/projects`, `/projects/:id/files`, `/files/:key/components`, `/teams/:id/components`, `/components/:key`, styles, component sets, **variables** `GET /files/:key/variables/local|published`, `POST /files/:key/variables` (Enterprise), **dev resources**, **library analytics**, **activity logs** (Ent), **payments**, **webhooks v2** (`FILE_UPDATE`, `FILE_VERSION_UPDATE`, `FILE_DELETE`, `LIBRARY_PUBLISH`, `FILE_COMMENT`, `DEV_MODE_STATUS_UPDATE`, `PING`) at team/project/file context.
- Rate limits tiered by plan and seat.
- **Embed API / Embed Kit 2.0** for iframes of files & prototypes (with postMessage events).

---

## 25. IMPORT / EXPORT

**Import:** `.fig`, `.jam`, `.deck`, Sketch (`.sketch`), images (PNG, JPG, GIF, WebP, HEIC, TIFF, SVG — SVG becomes vectors), PDF (as pages/vectors), PowerPoint/Google Slides (Slides), video (MP4/MOV/WebM, paid), audio (Motion), CSV (Buzz/Slides/FigJam tables), Adobe XD via plugins, HTML via html.to.design / Code-to-Figma capture.
**Paste:** SVG code paste → vectors; paste images; paste from Google Docs keeps formatting; Paste from FigJam/Design across files keeps components.

**Export:** PNG, JPG, SVG, PDF (per layer, multipage frames→PDF), **Save local copy** (`.fig`), MP4/GIF/WebM/Lottie/SVG/CSS (Motion), PPTX/PDF (Slides), published website (Sites), React app (Make, also download code/GitHub), CSV (FigJam), Copy as SVG/PNG/CSS/code.
**Export settings**: scale, suffix, format, contents only, PDF compression; batch export via `⌘⇧E`.

---

## 26. PLANS, SEATS, AI CREDITS, ADMIN

> Prices change frequently (latest changes Mar & Aug 2026). Check figma.com/pricing before quoting.

**Plans:**
- **Starter (free)** — limited files (3 Design + 3 FigJam historically; "free limited access to Figma products" in 2026), 30-day version history, limited AI credits, unlimited drafts? (limited), personal use.
- **Professional** — unlimited files, team libraries, shared projects, prototype sharing w/ passwords, Dev Mode, branching (limited), included AI credits (doubled Aug 2026). Full seat reported ~$13.75/mo annual (Aug 2026).
- **Organization** — org-wide libraries, design system analytics, branching & merging, centralized admin, SSO (SAML), shared fonts, private plugins, AI credit controls.
- **Enterprise** — Workspaces, advanced security (SCIM, guest controls, idle timeout, network access restrictions, EKM), Variables REST API, activity logs API, dedicated support, **data residency** (EU, Japan Sep 2026…), MCP enterprise auth.
- **Education** (free for students/educators, verified) and Government (FedRAMP / government apps).

**Seat types (2025 model):**
| Seat | Access |
|---|---|
| **Full** | All products: Design, Dev Mode, FigJam, Slides, Sites, Make, Buzz, Draw, Weave |
| **Dev** | Dev Mode, FigJam, Slides, Make (limited), read Design; Dev seats 5,000 AI credits/mo (Aug 2026) |
| **Collab** | FigJam, Slides, Buzz (edit) |
| **Viewer** | Free; view & comment |
Seat upgrades via request flow; admins approve (auto-approve settings).

**Admin settings (Org/Ent):** members & roles (admin, member, guest), seat management & billing, upgrade requests, SSO/SAML, SCIM, 2FA enforcement, domain capture, guest access, link sharing defaults, external content controls, plugin/widget approval, font uploads, libraries defaults, **AI settings** (enable/disable AI features, data training opt-out, per-user credit limits, buy credits), activity log, workspace management, idle session timeout, data residency, MCP authorization, connected apps (GitHub, Jira, Slack, Teams, Notion).

---

## 27. APPS, SETTINGS & INTEGRATIONS

- **Desktop app** (macOS, Windows, Windows Arm [2026]): tabs, local fonts, offline-ish caching, **Dev Mode MCP local server**, mute tabs (Mar 2026), agent pop-out window, menu bar, custom zoom.
- **Font installer** (FigmaAgent) for local fonts in browser.
- **Mobile apps** (iOS/Android): view files & prototypes, **mirror** designs, comments, notifications, FigJam editing, page dropdown, frame slider, export frames (Sep 2026).
- **Integrations**: Slack (notifications, link unfurls), Microsoft Teams, Jira, Confluence, Linear, GitHub, Notion, Zoom (FigJam app), Google Workspace, Asana, Storybook, VS Code, Webflow/Framer (via plugins), Zeplin.
- **Account settings**: name, photo, email, password, 2FA, notifications, connected accounts, personal access tokens, theme, language (EN, JA, KO, ES, PT-BR, FR, DE…).

---

## 28. KEYBOARD SHORTCUTS (MASTER LIST)

Open the full in-app panel: **`⌃⇧?`** (Help ▸ Keyboard shortcuts). Use **`⌘/`** or **`⌘K`** Quick Actions to run any command by name.

### Tools
| Action | Key |
|---|---|
| Move | `V` |
| Frame | `F` or `A` |
| Section | `⇧S` |
| Slice | `S` |
| Rectangle | `R` |
| Ellipse | `O` |
| Line | `L` |
| Arrow | `⇧L` |
| Pen | `P` |
| Pencil | `⇧P` |
| Text | `T` |
| Hand | `H` / `Space` |
| Scale | `K` |
| Comment | `C` |
| Eyedropper | `I` |
| Place image | `⌘⇧K` |
| Lasso (vector) | `Q` |
| Dev Mode toggle | `⇧D` |
| Annotate (Dev Mode) | `⇧T` |
| Measure (Dev Mode) | `⇧M` |

### View & zoom
| Action | Key |
|---|---|
| Zoom in / out | `⌘+` / `⌘-` (or `+`/`-`, `Z` + click) |
| Zoom to 100% | `⇧0` |
| Zoom to fit | `⇧1` |
| Zoom to selection | `⇧2` |
| Previous / next frame | `N` / `⇧N` |
| Previous / next page | `PageUp` / `PageDown` |
| Show/hide UI | `⌘\` |
| Pixel grid | `⇧'` |
| Layout grids | `⌃G` |
| Rulers | `⇧R` |
| Outline mode | `⌘Y` |
| Multiplayer cursors | `⌥⌘\` |
| Comments visibility | `⇧C` |
| Layers panel / Assets | `⌥1` / `⌥2` |
| Design / Prototype tab | `⌥8` / `⌥9` (or `⇧E` toggle) |
| Libraries | `⌥3` |

### Selection
| Action | Key |
|---|---|
| Select all | `⌘A` |
| Select inverse | `⇧⌘A` |
| Deep select | `⌘` + click |
| Select children | `Enter` |
| Select parent | `⇧Enter` / `\` |
| Next / previous sibling | `Tab` / `⇧Tab` |
| Select matching layers | `⌥⌘A` |

### Edit
| Action | Key |
|---|---|
| Copy / Cut / Paste | `⌘C` / `⌘X` / `⌘V` |
| Paste over selection | `⇧⌘V` |
| Paste to replace | `⇧⌘R` |
| Duplicate | `⌘D` |
| Copy as PNG | `⇧⌘C` |
| Copy / Paste properties | `⌥⌘C` / `⌥⌘V` |
| Rename | `⌘R` |
| Find & replace | `⌘F` |
| Undo / Redo | `⌘Z` / `⇧⌘Z` |
| Export | `⇧⌘E` |
| Save to version history | `⌥⌘S` |

### Object
| Action | Key |
|---|---|
| Group / Ungroup | `⌘G` / `⇧⌘G` |
| Frame selection | `⌥⌘G` |
| Auto layout add / remove | `⇧A` / `⌥⇧A` |
| Create component | `⌥⌘K` |
| Detach instance | `⌥⌘B` |
| Use as mask | `⌃⌘M` |
| Lock / Hide | `⇧⌘L` / `⇧⌘H` |
| Flatten | `⌘E` |
| Outline stroke | `⌥⌘O` |
| Union / Subtract / Intersect / Exclude | `⌥⇧U` / `⌥⇧S` / `⌥⇧I` / `⌥⇧E` |
| Bring forward / to front | `⌘]` / `⌥⌘]` (`⇧⌘]` on some layouts) |
| Send backward / to back | `⌘[` / `⌥⌘[` |
| Flip horizontal / vertical | `⇧H` / `⇧V` |
| Opacity 10%–100% | `1`…`9`, `0` (e.g., `5` = 50%, `55` = 55%) |
| Align left / right / top / bottom | `⌥A` / `⌥D` / `⌥W` / `⌥S` |
| Align horiz. / vert. centers | `⌥H` / `⌥V` |
| Distribute horiz. / vert. | `⌃⌥H` / `⌃⌥V` |
| Tidy up | `⌃⌥T` |
| Collapse layers | `⌥L` |
| Remove fill / stroke | `⌥/` / `⇧/` |
| Swap fill & stroke | `⇧X` |

### Text
| Action | Key |
|---|---|
| Bold / Italic / Underline | `⌘B` / `⌘I` / `⌘U` |
| Strikethrough | `⇧⌘X` |
| Link | `⌘K` (in text edit) |
| Align left/center/right/justify | `⌥⌘L` / `⌥⌘T` / `⌥⌘R` / `⌥⌘J` |
| Font size ± | `⇧⌘>` / `⇧⌘<` |
| Letter spacing ± | `⌥>` / `⌥<` |
| Line height ± | `⌥⇧>` / `⌥⇧<` |
| Font weight ± | `⌥⌘>` / `⌥⌘<` |
| Bulleted / numbered list | `⇧⌘8` / `⇧⌘7` |

### Prototype
| Action | Key |
|---|---|
| Present | `⌥⌘↵` |
| Show hotspots | `⇧` (while presenting) |
| Restart prototype | `R` |

### Vector editing
| Action | Key |
|---|---|
| Enter/exit edit | `Enter` / `Esc` |
| Bend tool | hold `⌘` |
| Paint bucket | `B` |
| Mirror handles toggle | `⌥` drag (break), `⌘` (bend) |
| Delete & heal | `⇧Delete` |

### FigJam
Sticky `S`, Shape `R`/`O`, Connector `X`, Marker `M`, Highlighter `⇧M`, Washi `⇧W`, Eraser `⇧⌫`, Section `⇧S`, Table `⇧T`, Stamp `E`, Text `T`, Cursor chat `/`, Emotes `E` (hold).

---

## 29. WORKFLOWS & BEST PRACTICES

**File structure:** Cover page (custom thumbnail via "Set as thumbnail") → Pages per feature/flow → `---` dividers → "Archive"/"Playground" pages. Use Sections for flows; mark ready for dev.

**Design system build order:**
1. Primitive variables (color ramps, spacing, radius, type scale) in a "Primitives" collection.
2. Semantic variables (bg/surface, text/primary, border) with **modes** Light/Dark aliasing primitives; scope them.
3. Text & effect styles referencing variables.
4. Base components with auto layout, bound to variables; use component properties (boolean/text/instance swap/slots) to minimize variants.
5. Variants only for state/size/type axes.
6. Document (description, links), publish, track analytics; Code Connect each component; set up MCP rules.

**Naming:** `Category/Subcategory/Name` for components and styles; layer names semantic (helps Smart Animate, codegen, MCP, AI).

**Responsive design:** auto layout everywhere, Fill/Hug, min/max widths, wrap/grid, variables modes for breakpoints (Mobile/Tablet/Desktop number modes).

**Handoff:** Ready-for-dev status, annotations, measurements, dev resources, Code Connect, variables with code syntax, compare changes, MCP server for AI coding agents.

**Performance:** reduce hidden layers and huge images, split libraries, avoid deeply nested huge components, use "Memory usage" indicator (Help ▸ Troubleshooting) and dynamic page loading.

**Accessibility:** contrast checks (plugins + Dev Mode annotations), focus order annotations, min target 44/48px, text scaling, reduced-motion awareness for prototypes/Motion.

**Design-to-code with AI agents (Claude Code etc.):**
1. Enable MCP (desktop local or remote `https://mcp.figma.com/mcp`).
2. Clean file: auto layout, variables, semantic names, Code Connect.
3. Select frame / copy link with `node-id` → prompt agent to implement.
4. Agent calls `get_design_context`, `get_variable_defs`, `get_screenshot`; maps to code components.
5. Reverse: capture code UI → Figma layers for design review.

---

## 30. GLOSSARY

- **Auto layout** — flexbox-like layout on frames. **Hug/Fill/Fixed** — sizing modes.
- **Component / Main / Instance / Override / Detach** — reusable element system.
- **Variant / Component set** — multiple states in one component.
- **Slot** — instance content area for arbitrary children (2026).
- **Variable / Collection / Mode / Alias / Scope** — design tokens system.
- **Style** — saved reusable paint/text/effect/grid.
- **Library** — published components/styles/variables.
- **Section** — canvas organizing container.
- **Smart animate** — automatic tween between matching layers.
- **Noodle** — prototype connection line.
- **Hotspot** — clickable prototype area.
- **Vector network** — Figma's path model allowing branching points.
- **Dev Mode / Code Connect / MCP** — developer handoff & AI-agent context.
- **Branch** — isolated copy for review & merge.
- **Observation mode / Spotlight** — follow collaborators.
- **AI credits** — usage units for AI features.
- **Skill** — packaged agent workflow (SKILL.md).
- **Riff** — Community post of animations/prototypes/experiments (2026).
- **Weave** — node-based AI media workflows.
- **Code layer** — live code component on canvas.
- **UI3** — current Figma interface (2024+).

---

## 31. RECENT CHANGELOG (2025–2026 highlights)

**2025 (Config May 2025):** Figma Sites (β), Figma Make (β), Figma Buzz (β), Figma Draw, Grid auto layout, Code layers in Sites, CMS for Sites, extended collections, variables import/export, Dev Mode MCP server (β), progressive blur, noise/texture/pattern effects, Glass effect (late 2025), Weavy acquisition → Figma Weave, new pricing/seat model (Full/Dev/Collab), Code Connect UI.

**2026:**
- **Mar** — Slots (open beta); Figma agent on canvas (β); agents write to canvas via MCP; remote MCP server; AI credits system & purchasable credits; Starter tier; Code Connect UI multiple mappings; Apps in Community; Windows Arm app; tab muting; Claude Code ↔ Figma roundtrip; GitHub Copilot → Figma.
- **May/Jun (Config 2026)** — Figma Motion, custom shaders (fills/effects), Weave tools in Design, generative plugins, Skills for agent, agent integrations (Notion/Slack/GitHub); waitlists: Code Layers, 3D transforms, FigJam agent, Slides agent.
- **Aug** — Figma Make GA; expanded text properties (variable fonts, OpenType); variable stroke widths & path cutting; responsive spacing (horizontal/vertical flows) in auto layout; custom & community Skills; Weave via MCP; Code Connect in MCP; enterprise MCP auth GA (Okta XAA); per-user AI credit caps; Professional AI credits doubled; agent pop-out window; Erase & drag-to-fill vector tools; nested folders.
- **Sep** — Generative plugins/shaders animations + Community publishing (Sep 1); opacity variables (Sep 3); Japan data residency (Sep 11); folder previews/colors/duplicate (Sep 16); Weave tools in Community (Sep 16); Figma node in Weave (Sep 17); vertical wrap in auto layout (Sep 25); Motion styles/audio/text animation/Lottie (Sep 30); Community riffs (Sep 30); mobile app improvements (Sep 30).
- **Oct** — Multiple GitHub orgs per plan (Oct 5); **Figma agent GA** with speed, file search, configurable guidelines (Oct 6).

---

## SOURCES
- Figma release notes — https://www.figma.com/release-notes/
- Config 2026 recap — https://dev.classmethod.jp/en/articles/figma-config-2026-recap/
- Figma forum: Everything announced at Config 2026 — https://forum.figma.com/product-updates-3/everything-announced-at-config-2026-55221
- Releasebot Figma tracker — https://releasebot.io/updates/figma
- SpyingBee monthly digests — https://spyingbee.com/updates/figma/2026-03 , https://spyingbee.com/updates/figma/2026-08
- Figma Help Center — https://help.figma.com
- Figma Plugin API docs — https://www.figma.com/plugin-docs/ ; REST API — https://www.figma.com/developers/api
