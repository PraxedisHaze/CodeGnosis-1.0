# CodeGnosis Development Plan (Living Document)

**Last Updated:** 2026-01-04
**Status:** UI Polish / "Olympic Gold" Standard
**Version:** 1.0.1 (Pre-Ship Polish)

---

## 1. Project Overview
CodeGnosis is a 3D visualization and analysis tool for software projects. It maps file structures, dependencies, and "rot" (unused files) into a navigable galaxy.

**Core Stack:**
- **Frontend:** React + Three.js (via `react-three-fiber` / `react-force-graph-3d`).
- **Backend:** Tauri (Rust) + Python Sidecar (`aletheari_analyzer_core.py`).
- **Data Bridge:** Standard Input/Output (JSON) between Rust and Python.

---

## 2. Current Architecture (Reconstruction Guide)

### A. Directory Structure
```
CodeGnosis_1.0/
├── src/
│   ├── components/
│   │   ├── LoomGraph.tsx       # Main 3D Viewport (Force Graph)
│   │   ├── LoomControls.tsx    # Bottom Toolbar (New!)
│   │   ├── LoomLegend.tsx      # Bottom-Right Overlay (New!)
│   │   ├── TabInterface.tsx    # Top Navigation
│   │   └── WelcomeOverlay.tsx  # Mission Selector
│   ├── App.tsx                 # State Manager (activeMission, theme)
│   └── main.tsx                # Entry Point
├── src-tauri/
│   ├── src/main.rs             # Tauri Entry
│   └── tauri.conf.json         # Config (Sidecars defined here)
├── scripts/
│   └── build.cjs               # Build script for Python sidecar
└── package.json
```

### B. The "Lost Ark" Logic (Analyzer Engine)
The Python analyzer (`aletheari_analyzer_core.py`) is the brain. It must be transplanted from the "Lost Ark" backup (`_archive/CodeGnosis_Old_Engines/codegnosis_ULTIMATE_REFERENCE.py`) to ensure:
-   **Deep Dependency Scanning:** Regex-based import detection for JS, TS, PY, RS, etc.
-   **Graphviz Theming:** Color-coding by file type (e.g., React components = Blue, Utils = Grey).
-   **Rot Detection:** Identification of "Ghost" nodes (0 imports).

---

## 3. The "Olympic Gold" UI Spec (Current Sprint)

### A. Viewport Controls (LoomControls.tsx)
*Goal: Clear the sky. No floating panels obscuring the graph.*

-   **Location:** Bottom Toolbar (Fixed, Glassmorphism).
-   **Components:**
    -   **Calibration Button:** Slides up a panel with Bloom, Star Size, and Link Opacity sliders.
    -   **Reset View:** Re-centers the camera.
    -   **Formation Toggle:** Switches between "Galaxy" (Force Directed) and "Formation" (Grid/Tree).
-   **Logic:**
    -   `pointer-events: auto` ONLY on the toolbar itself. Container must be `none` to allow click-through to the graph.

### B. The Legend 2.0 (LoomLegend.tsx)
*Goal: Powerful filtering without clutter.*

-   **Location:** Bottom-Right Corner (Overlay).
-   **Design:** Semi-transparent list of file types (e.g., `.tsx`, `.py`, `.json`).
-   **Interaction Protocol:**
    -   **Checkbox:** Toggles visibility of that file family. (Multi-select allowed).
    -   **Color Dot (Click):** "Solo Focus" Mode.
        -   *First Click:* Zooms camera to fit ALL nodes of this type. Dims all other nodes to 10% opacity.
        -   *Second Click:* Restores full visibility (Exit Solo Focus).
    -   **Hover:** NO EFFECT (Removed to reduce noise).

### C. The Horizon Ring
*Goal: Orientation in 3D space.*

-   **Design:** A large ring at the vertical equator of the simulation.
-   **Polish:** **Two-Tone Color.**
    -   0-180 degrees: Cyan (North/Front).
    -   180-360 degrees: Purple (South/Back).
    -   *Why:* Helps user know if they are looking "behind" the graph.

### D. Mission Logic (App.tsx -> LoomGraph.tsx)
*Goal: Context-aware visualization.*

-   **Prop:** `activeMission` (string).
-   **States:**
    -   `'default'`: Standard view.
    -   `'incident'`: Highlight files modified < 24h.
    -   `'rot'`: Dim everything except 0-import nodes.
    -   `'architecture'`: Highlight only `index` and `App` files (Skeleton view).

---

## 4. Implementation Plan (Step-by-Step)

1.  **Refactor `App.tsx`:** Pass `activeMission` down to `LoomGraph`.
2.  **Update `LoomGraph.tsx`:**
    -   Add `activeMission` to dependency array of the graph data processor.
    -   Implement the "Dimming" logic based on mission state.
3.  **Build `LoomControls.tsx`:**
    -   Implement the Bottom Toolbar CSS (`.loom-toolbar`).
    -   Ensure `z-index` is higher than Canvas.
4.  **Build `LoomLegend.tsx`:**
    -   Implement Checkbox + Dot logic.
    -   Add `handleSoloFocus(type)` function.
5.  **Shader Update:** Modify `HorizonRing` to use a gradient or split color material.

---

**Guidance for the Foreman (Codex):**
-   Update this document at the end of every session.
-   If you change the architecture, CHANGE THIS DOC.
-   This file is the Source of Truth for "What is CodeGnosis?"
