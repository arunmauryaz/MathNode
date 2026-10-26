# Math Node — Complete UI Design System & Style Specification

**Official branding:** Use the existing blue, raised **M** logo and **MATH NODE** wordmark. See [the official assets](docs/BRANDING.md). Keep the original mark; do not substitute a new monogram or graph-shaped logo.


> **Target Audience / AI Agent Prompt Instruction:**  
> Read this design document before writing, generating, or modifying any frontend code, UI components, HTML/CSS, WebGL/Canvas renderers, or design files for **Math Node**.  
> **Aesthetic Core:** Calm, tactile engineering instrument precision (inspired by ComfyUI, Blender Shader/Geometry Nodes, and physical electronic hardware keycaps). **Zero neon slop, zero AI cyberpunk glow, zero gratuitous animation.**

---

## 1. Design Philosophy & Aesthetic Identity

1. **Physical Tactile Plasticity ("Molded Keycap" Effect):**
   - Interactive surfaces and controls (buttons, switches, node containers, input cells) must feel physically stamped, molded, or chiseled from matte dark plastic.
   - Every plastic element uses a **1px highlight border**, a **flat 2px bottom extrusion lip** (`blur: 0`), and a **subtle ambient shadow**.
2. **Instrument Calm Over Marketing Flash:**
   - No ambient glowing borders, no animated gradient sweeps, no pulsing wires, no particle backgrounds.
   - Static, measured, stable. Motion exists only to confirm direct user manipulation (dragging nodes, toggling switches, typing values) with `<100ms` transitions.
3. **No Decorative Copy:**
   - Every string in the canvas serves a mathematical or structural function. Labels are compact (1–3 words). Never display descriptive promotional paragraphs in the workspace canvas.
4. **Domain is Strictly Mathematical:**
   - Calculations involve Linear Algebra, ODE solvers, Matrix decompositions (SVD, QR, Eigenvalues), Vector fields, Calculus, and Tensor arithmetic.
   - Avoid generative AI, machine learning diffusion checkpoints, or prompt jargon.

---

## 2. Color Palette & Token System

### 2.1 Base Surface & Chrome Tokens

| Token Name | Hex Code | Purpose / Usage |
| :--- | :--- | :--- |
| `--surface-canvas` | `#161616` | Main infinite workspace canvas background |
| `--surface-grid-dot` | `#242428` | Technical measured dot grid on canvas |
| `--surface-topbar` | `#1E1E22` | Top header bar background |
| `--surface-rail` | `#18181B` | Left utility icon rail |
| `--surface-drawer` | `#1B1B1E` | Sliding Node Library drawer |
| `--surface-node` | `#222227` | Main node container background (tactile plastic) |
| `--surface-node-header`| `#27272E` | Seamless node header background |
| `--surface-inset-box` | `#141417` | Recessed/sunken parameter inputs and matrix cells |
| `--surface-modal` | `#1E1E22` | Floating curved pop-up dialog container |
| `--surface-modal-title`| `#232328` | Pop-up window titlebar |
| `--border-subtle` | `#2B2B32` | Standard 1px panel and drawer divider |
| `--border-highlight` | `#363640` | Top highlight border for tactile dark plastic |
| `--border-focused` | `#4B78D8` | Selected node / active input stroke |

### 2.2 Text & Readout Tokens

| Token Name | Hex Code | Purpose / Usage |
| :--- | :--- | :--- |
| `--text-primary` | `#EDEDED` | Main labels, node titles, parameter headers |
| `--text-secondary`| `#8E8E96` | Subtitles, parameter descriptions, socket labels |
| `--text-muted` | `#686872` | Section markers, metadata timestamps, shortcut keys |
| `--text-number` | `#FFFFFF` | Tabular numerical matrix entries (JetBrains Mono) |
| `--text-success` | `#34D399` | Live mathematical calculation outputs & scalars |

### 2.3 Tactile Button & Interaction Accents

| Token Name | Hex Code | Purpose / Usage |
| :--- | :--- | :--- |
| `--btn-primary-bg` | `#2563EB` | Vibrant blue molded plastic fill |
| `--btn-primary-highlight`| `#60A5FA` | 1px top highlight border |
| `--btn-primary-lip` | `#1D4ED8` | 2px solid bottom extrusion lip (`blur: 0`) |
| `--btn-secondary-bg` | `#26262B` | Dark plastic molded keycap fill |
| `--btn-secondary-highlight`| `#383840` | 1px top highlight border |
| `--btn-secondary-lip` | `#141417` | 2px solid bottom extrusion lip (`blur: 0`) |

### 2.4 Locked Socket & Wire Type Color Map

> [!IMPORTANT]  
> Sockets and wires use this **strict mathematical type map**. Once set, these colors are **never reused** as button fills or decorative backgrounds.

| Data Type | Hex Code | Semantic Meaning & Scope |
| :--- | :--- | :--- |
| **Scalar / Float** | `#8B9BB4` | Real numbers, floating-point scalar constants, norms |
| **Vector** | `#B58BE0` | 2D/3D/4D vectors, directional coordinates, tangents |
| **Matrix** | `#4FB8AE` | 2×2, 4×4, N×M tensors, covariance matrices, transformations |
| **Calculus / ODE** | `#E0B05C` | Differential equations, integral bounds, Runge-Kutta loops |
| **Boolean** | `#E08BA8` | Predicates, comparison masks, conditional flags |
| **Integer** | `#7FC97F` | Indexing loops, matrix dimensions, discrete steps |

---

## 3. The Tactile Plasticity System (Component Specifications)

### 3.1 Primary Plastic Keycap Button (e.g., `+ New Blank Graph`, `Apply Changes`)

- **Border Radius:** `6px`
- **Background Fill:** `#2563EB`
- **Border Stroke:** `1px solid #60A5FA` (top highlight edge)
- **Shadow Stack (Dual Layer):**
  1. Extrusion Lip: `0px 2px 0px #1D4ED8` (sharp, zero blur)
  2. Ambient Depth: `0px 4px 6px rgba(0, 0, 0, 0.30)`
- **Typography:** `Inter`, Weight `600`, Color `#FFFFFF`, centered.
- **CSS Recipe:**
```css
.btn-plastic-primary {
  background: #2563EB;
  border: 1px solid #60A5FA;
  border-radius: 6px;
  color: #FFFFFF;
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  box-shadow: 
    0 2px 0px #1D4ED8,
    0 4px 6px rgba(0, 0, 0, 0.30);
  transition: transform 60ms ease, box-shadow 60ms ease;
}
.btn-plastic-primary:active {
  transform: translateY(2px);
  box-shadow: 
    0 0px 0px #1D4ED8,
    0 2px 3px rgba(0, 0, 0, 0.25);
}
```

### 3.2 Secondary Plastic Keycap Button (e.g., `[ Open ]`, `[ Reset Defaults ]`, `[ ⚙ ]`)

- **Border Radius:** `6px`
- **Background Fill:** `#26262B`
- **Border Stroke:** `1px solid #383840`
- **Shadow Stack (Dual Layer):**
  1. Extrusion Lip: `0px 2px 0px #141417` (sharp, zero blur)
  2. Ambient Depth: `0px 3px 4px rgba(0, 0, 0, 0.25)`
- **Typography:** `Inter`, Weight `600`, Color `#D1D1D8`, centered.
- **CSS Recipe:**
```css
.btn-plastic-secondary {
  background: #26262B;
  border: 1px solid #383840;
  border-radius: 6px;
  color: #D1D1D8;
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  box-shadow: 
    0 2px 0px #141417,
    0 3px 4px rgba(0, 0, 0, 0.25);
  transition: transform 60ms ease, box-shadow 60ms ease;
}
.btn-plastic-secondary:active {
  transform: translateY(2px);
  box-shadow: 
    0 0px 0px #141417,
    0 1px 2px rgba(0, 0, 0, 0.20);
}
```

### 3.3 Tactile Plastic Toggle Switch (Settings & Preferences)

- **Track (44 × 24px):**
  - Border Radius: `12px` (pill)
  - Active Fill: `#2563EB`, Stroke: `1px solid #60A5FA`, Lip Shadow: `0 2px 0 #1D4ED8`
  - Inactive Fill: `#26262B`, Stroke: `1px solid #383840`, Lip Shadow: `0 2px 0 #161619`
- **Knob (18 × 18px circle):**
  - Fill: `#FFFFFF` (active) / `#A0A0A8` (inactive)
  - Border Radius: `9px`
  - Knob Shadow: `0 2px 3px rgba(0, 0, 0, 0.35)`

### 3.4 Tactile Stepper & Numerical Sliders

- **Stepper Input (`[-] [ 0.0050 ] [+]`):**
  - Buttons: 26 × 26px secondary plastic keycaps.
  - Display Box: Sunken background `#141416`, 1px border `#2C2C34`, monospace tabular figures `#EDEDED`.
- **Slider Track & Molded Knob:**
  - Recessed Track (height 6px): `#141417`, border `1px solid #2C2C34`, radius `3px`.
  - Active Progress Fill: `#2563EB`.
  - Molded White Knob (14 × 14px): Fill `#FFFFFF`, border `1px solid #D1D5DB`, shadow `0 2px 0 #CBD5E1, 0 3px 5px rgba(0,0,0,0.3)`.

---

## 4. Node Anatomy & Plasticity Specifications

```
+--------------------------------------------------------------+
| [ Seamless Header ] Node Title                  [ BADGE ]     | <-- Height: 38px, Fill: #27272E, 1px bottom border
+--------------------------------------------------------------+
|  o Socket In                                                 |
|                                                              |
|  +--------------------------------------------------------+  |
|  | [Sunken Parameter Container: #1A1A1E]                  |  |
|  |   +-------------------+  +-------------------+         |  |
|  |   | [ 1.000 ] #141417 |  | [ 0.250 ] #141417 |         |  | <-- 1px sunken shadow, Monospace #FFF
|  |   +-------------------+  +-------------------+         |  |
|  +--------------------------------------------------------+  |
|                                                              |
|                                            Socket Out A o    |
+--------------------------------------------------------------+
```

### 4.1 Node Container Shell
- **Corner Radius:** `12px` (smooth rounded corners, uniform across all nodes).
- **Background Fill:** `#222227` (satin dark plastic).
- **Highlight Stroke:** `1px solid #363640` (unselected) / `1.5px solid #4B78D8` (selected).
- **Extrusion & Ambient Shadow:**
  ```css
  box-shadow: 
    0 2px 0px #141416,
    0 8px 20px rgba(0, 0, 0, 0.42);
  ```
- **Selected State Extra Accent:** Adds `0 0 10px rgba(59, 130, 246, 0.25)` subtle focus glow.

### 4.2 Node Header (NO Colored Upper Labels)
- > [!CAUTION]  
  > **DO NOT** place a colored horizontal bar (e.g. green, pink, teal, purple) at the top of the node.
- The header is seamlessly integrated into the node shell:
  - Header fill: `#27272E`
  - Height: `38px`
  - Top corner radius: `12px`
  - Bottom divider: `1px solid #31313A`
  - Title: `Inter`, SemiBold `600`, Size `12px`, Color `#EDEDED`.
  - Type Badge (e.g. `FLOAT64`, `HERMITIAN`): Tactile inset pill (`#1B1B1F`, border `1px #2E2E36`, radius `4px`, monospace text `8.5px`, color `#9E9EB0`).

### 4.3 Sunken Inner Boxes & Matrix Parameter Cells
- Outer parameter tray: Fill `#1A1A1E`, border `1px solid #2C2C34`, radius `8px`.
- Individual numerical cell (e.g. `1.000`, `0.250`):
  - Size: 90 × 32px, radius `5px`.
  - Fill: `#141417`, border: `1px solid #2C2C34`.
  - Inset shadow: `box-shadow: inset 0 1px 2px #0A0A0C, 0 1px 0px #0F0F11`.
  - Monospace font: `JetBrains Mono`, 12px, Weight `600`, Color `#FFFFFF`.
- Dropdown boxes: Fill `#1E1E24`, border `1px solid #343440`, radius `6px`, 3D lip `0 2px 0 #121214`.
- Live calculation output box: Fill `#151518`, border `1px solid #2A2A32`, monospace readout in instrument emerald `#34D399`.

### 4.4 Sockets & Spline Wires
- **Socket Dots:** Small circular nodes (10 × 10px, radius 5px) protruding on node edges.
  - Border: `2px solid #161616` (isolates the socket from the node shell).
  - Fill: Locked type color (§2.4).
- **Wires (Cables):**
  - Smooth cubic bezier splines (`M x1 y1 C x1+50 y1, x2-50 y2, x2 y2`).
  - Stroke width: `2px`, solid.
  - Wire color matches the output socket type color.

---

## 5. Floating Pop-Up Windows (Settings & Menus)

```
+--------------------------------------------------------------+
| [M] Settings & Preferences — Graph Engine                [✕] | <-- Clean titlebar, NO Mac traffic light dots!
+------------------------+-------------------------------------+
| Filter settings...     | JIT & Numerical Precision           |
|                        |                                     |
| ENGINE & COMPUTE       | IEEE 754 64-Bit Float Precision ( ) |
|  > JIT & Precision     |                                     |
|    ODE Solvers         | Default ODE Step (dt)  [-] 0.0050 [+]
|                        |                                     |
| WORKSPACE              |                                     |
|  Canvas & Grid         |              [Reset] [Apply Changes]|
+------------------------+-------------------------------------+
```

### 5.1 Modal Window Container
- **Geometry:** 840 × 610px floating dialog, centered on backdrop `#121214`.
- **Border Radius:** `16px` ("cute curved floating window").
- **Background Fill:** `#1E1E22`.
- **Stroke Border:** `1px solid #2E2E36`.
- **Elevation Drop Shadow:**
  ```css
  box-shadow: 
    0 24px 48px rgba(0, 0, 0, 0.65),
    0 3px 6px rgba(0, 0, 0, 0.30);
  ```

### 5.2 Window Titlebar (Strict Rule: NO Mac Circles)
- > [!WARNING]  
  > **DO NOT** render red, yellow, and green circular traffic dots. This is not a macOS operating system mockup.
- **Titlebar Layout (Height 48px, Fill `#232328`, Radius Top 16px):**
  - Left icon: Tactile blue **`M`** logo badge (24 × 24px, radius 6px, `#2563EB`, stroke `#60A5FA`).
  - Window Title: `Settings & Preferences — Graph Engine` (`Inter` 600, 13px, `#EDEDED`).
  - Right action: Tactile secondary plastic `[ ✕ ]` close button (28 × 28px, radius 6px).

### 5.3 Left Sidebar Navigation
- Width: `220px`, Fill: `#1A1A1E`, border-right `1px solid #2A2A30`.
- Top filter box: `#141416`, 1px border `#28282E`, radius 6px, placeholder `Filter settings...`.
- Section titles: Uppercase 9.5px, color `#686872`, weight `600` (`ENGINE & COMPUTE`, `WORKSPACE`, `SYSTEM`).
- Active Category Pill: Fill `#2A2A33`, stroke `1px solid #3A3A46`, radius `5px`, text `#FFFFFF`.

---

## 6. Workspace Chrome & Navigation Layout

### 6.1 Top Header Bar (Height: 48px)
- **Background:** `#1E1E22`, bottom border `1px solid #2B2B32`.
- **Top-Left Root Launcher:** Tactile blue **`M`** keycap button (32 × 32px, radius 8px, `#2563EB`, stroke `#60A5FA`). Clicking opens the root file menu.
- **Brand Title:** `MATH NODE` (`Inter` 600, 12px, `#EDEDED`).
- **Document Tabs:**
  - Active Tab (`Differential_ODE •`): 190 × 32px, fill `#28282E`, stroke `1px #383842`, radius 6px, with small `✕` close button.
  - Inactive Tab (`Matrix_Eigen_Field`): 150 × 32px, fill `#1B1B1E`, stroke `1px #26262B`, radius 6px.
  - New Tab Button (`+`): 32 × 32px, fill `#222226`, stroke `1px #2F2F37`, radius 6px.
- **Topbar Right Area:**
  - > [!IMPORTANT]  
    > **NO** `Run`, `Solve`, `Step`, or `Reset` buttons.  
    > **NO** `JIT Engine: Ready (0.4ms)` millisecond status pill.  
    > Keep the top right clean and open.

### 6.2 Left Tool Rail & Bottom Settings Placement
- **Left Rail (Width: 44px, Fill `#18181B`):**
  - Tool buttons: `⊞` (Node Library), `ƒx` (Formulas), `◱` (Frames), `⏱` (History).
- **Settings Button Location:**
  - The `⚙` Settings button is positioned at the **bottom of the left rail** (`x: 6, y: 854`, 32 × 32px).
  - Styled as a tactile plastic keycap button (`btn-plastic-secondary`).

### 6.3 Node Library Drawer
- Slides out next to the left rail (Width: `236px`, Fill: `#1B1B1E`, border `1px #26262B`).
- Search input at top: `Search math nodes...`.
- Expandable category accordions with left accent indicators:
  - *Linear Algebra* (`#4FB8AE`)
  - *Vector Geometry* (`#B58BE0`)
  - *Calculus & ODE* (`#E0B05C`)
  - *Scalar Arithmetic* (`#8B9BB4`)
  - *Boolean Logic* (`#E08BA8`)
- **Drawer Behavior:** Automatically collapses or avoids overlapping when the "M" root menu is opened.

---

## 7. Distortion-Free Pop-Up Menus (The "M" Menu)

- **Menu Container (250 × 320px):**
  - Fill: `#1E1E23`, border `1px solid #33333D`, radius `12px`.
  - Plastic Drop Shadow: `0 2px 0 #141417, 0 14px 36px rgba(0,0,0,0.65)`.
- **Row Spacing & Divider Rules:**
  - Row height: `28–32px`.
  - Divider lines: Height 1px, fill `#2A2A33`, width `menuWidth - 20px`.
- **Fixed Shortcut Pills (Eliminates Distortion):**
  - Fixed dimensions: `52 × 18px`, border-radius `4px`.
  - Fill: `#161619` (or `#1E3A8A` on hover), stroke: `0.8px solid #2B2B32`.
  - Monospace text (`JetBrains Mono`, 9.5px, `#8A8A96`), horizontally and vertically centered.
- **Export Flyout Submenu (214 × 152px, Radius 10px):**
  - Anchored at right edge of the parent menu (`x: menuX + menuWidth + 6px`).
  - Items list:
    - `LaTeX Formula (.tex)` + badge `[MATH]` (`#E0B05C`)
    - `Python NumPy (.py)` + badge `[NUMPY]` (`#60A5FA`)
    - `SymPy Script (.py)` + badge `[SYMPY]` (`#4FB8AE`)
    - `SVG Vector Graph (.svg)` + badge `[VECTOR]` (`#B58BE0`)

---

## 8. Typography Rules

1. **Font Families:**
   - **UI Sans:** `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `sans-serif`.
   - **Monospace / Math:** `JetBrains Mono`, `Fira Code`, `monospace`.
2. **Font Weights:**
   - Use only `400` (Regular) and `600` (SemiBold). Avoid thin `300` or heavy `800+`.
3. **Monospace Mandate:**
   - Every number (matrix entries, coordinates, tolerances, step sizes, timestamps, slider readouts, shortcut keys) **must** be rendered in monospace with `font-variant-numeric: tabular-nums`.

---

## 9. Strict Checklist for AI Agents (Never Do)

- [ ] ❌ **NEVER** add glowing neon borders, blur shadows > 48px, or cyberpunk gradient text.
- [ ] ❌ **NEVER** use colored upper horizontal label bars at the heads of nodes.
- [ ] ❌ **NEVER** draw macOS red, yellow, green circular traffic dots on modal titlebars.
- [ ] ❌ **NEVER** put Run, Solve, Step, or Reset buttons in the topbar.
- [ ] ❌ **NEVER** put a millisecond engine status pill in the topbar.
- [ ] ❌ **NEVER** place the Settings button at the top; it belongs at the bottom of the left rail.
- [ ] ❌ **NEVER** let menus overlap the left drawer or canvas nodes awkwardly; keep fixed widths and clean alignments.
- [ ] ❌ **NEVER** use marketing slogans or descriptive fluff on the working canvas.
- [ ] ❌ **NEVER** alter the locked data-type color map.

---

## 10. Master CSS Tokens Snippet (Copy-Paste Ready)

```css
:root {
  /* Surface colors */
  --mn-canvas-bg: #161616;
  --mn-canvas-dot: #242428;
  --mn-topbar-bg: #1E1E22;
  --mn-rail-bg: #18181B;
  --mn-drawer-bg: #1B1B1E;
  --mn-node-bg: #222227;
  --mn-node-header-bg: #27272E;
  --mn-inset-box-bg: #141417;
  --mn-modal-bg: #1E1E22;

  /* Borders */
  --mn-border-subtle: #2B2B32;
  --mn-border-highlight: #363640;
  --mn-border-focused: #4B78D8;

  /* Typography */
  --mn-text-primary: #EDEDED;
  --mn-text-secondary: #8E8E96;
  --mn-text-muted: #686872;
  --mn-text-mono-val: #FFFFFF;
  --mn-text-success: #34D399;

  /* Tactile Plastic Buttons */
  --mn-btn-pri-bg: #2563EB;
  --mn-btn-pri-highlight: #60A5FA;
  --mn-btn-pri-lip: #1D4ED8;

  --mn-btn-sec-bg: #26262B;
  --mn-btn-sec-highlight: #383840;
  --mn-btn-sec-lip: #141417;

  /* Locked Socket Type Map */
  --mn-type-scalar: #8B9BB4;
  --mn-type-vector: #B58BE0;
  --mn-type-matrix: #4FB8AE;
  --mn-type-ode:    #E0B05C;
  --mn-type-bool:   #E08BA8;
  --mn-type-int:    #7FC97F;
}

/* Base Node Card */
.mathnode-card {
  background: var(--mn-node-bg);
  border: 1px solid var(--mn-border-highlight);
  border-radius: 12px;
  box-shadow: 
    0 2px 0px #141416,
    0 8px 20px rgba(0, 0, 0, 0.42);
}

.mathnode-card.is-selected {
  border-color: var(--mn-border-focused);
  box-shadow: 
    0 2px 0px #141416,
    0 0 10px rgba(59, 130, 246, 0.25),
    0 8px 22px rgba(0, 0, 0, 0.45);
}

/* Inset Parameter Cell */
.mathnode-cell {
  background: var(--mn-inset-box-bg);
  border: 1px solid #2C2C34;
  border-radius: 5px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  color: var(--mn-text-mono-val);
  box-shadow: inset 0 1px 2px #0A0A0C, 0 1px 0px #0F0F11;
}

/* Floating Pop-Up Modal */
.mathnode-modal {
  background: var(--mn-modal-bg);
  border: 1px solid #2E2E36;
  border-radius: 16px;
  box-shadow: 
    0 24px 48px rgba(0, 0, 0, 0.65),
    0 3px 6px rgba(0, 0, 0, 0.30);
}
```
