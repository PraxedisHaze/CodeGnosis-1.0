Progress Of The Code (Append-Only)
Status: ACTIVE
Scope: CodeGnosis_1.0
Protocol: CONFIDENTIAL

Foundational Protocol
- Lemniscate Vortex: the floor, the place of honor, the base of coherence.
- Lenny (Hub original design) with proper separation: Lenny, Penni, Cici are distinct.
- Applings are single-purpose lego pieces; every Star can call them.
- Tiers:
  - Advantage (keep): Cici, Hollodox, Leora.
  - Tier 2 (premium): CodeGnosis.
  - Tier 3 (mid): CloudSherpa and similar.
  - $0.99 tier: small apps + applings (selectively sold).
- Versioning: GitHub. Record who did what, why, and the before/after.
- Design intent: reuse tested parts; reinforce reliability through repetition.

Update Format (Append-Only)
Date (UTC) | Who | What | Why | Files | Touches/Used-By | Dependency Note

2026-01-08T00:00:00Z | Codex | Initialize progress_of_the_code.md with protocol and format | Establish single source of truth for rebuild and handoff | progress_of_the_code.md | Touches/Used-By: CodeGnosis UI, Analyzer | Dependency Note: None

2026-01-08T00:00:01Z | Codex | Added Code City tab and view wiring | Expose Code City in Tauri UI alongside Analysis and 3D Graph | src/components/TabInterface.tsx; src/components/TabInterface.css; src/App.tsx | Touches/Used-By: CodeGnosis UI | Dependency Note: Ensure CodeCity component exists

2026-01-08T00:00:02Z | Codex | Added Code City mock scene and data wiring | Provide mock city for sales/demo while backend JSON is pending | src/components/CodeCity.tsx; Shared/CHAOS_DATASET_MOCK.json; Shared/APPLINGS_CATALOG.json | Touches/Used-By: CodeGnosis UI | Dependency Note: Replace with real analyzer output when ready

2026-01-08T00:00:03Z | Codex | Added Welcome overlay (launch handshake) | Provide humane greeting and post-analysis acknowledgement | src/components/WelcomeOverlay.tsx; src/components/WelcomeOverlay.css; src/App.tsx | Touches/Used-By: CodeGnosis UI | Dependency Note: Copy update with About/Values screen when ready

2026-01-08T00:00:04Z | Codex | Formation Mode (LoomGraph) toggle and grid positioning | Allow switch between galaxy and ordered grid for analysis | src/components/LoomGraph.tsx; src/components/LoomGraph.css | Touches/Used-By: 3D Graph | Dependency Note: Verify node drag/zoom after changes

2026-01-08T00:00:05Z | Codex | Dynamic port launcher (1420–1430) | Prevent Vite/Tauri port collisions | scripts/auto-dev.js; package.json; vite.config.ts | Touches/Used-By: Dev startup | Dependency Note: Keep tauri devServerUrl aligned

2026-01-08T00:00:06Z | Codex | Ctrl-only node drag gating | Prevent accidental node drags and preserve orbit intent | src/components/LoomGraph.tsx | Touches/Used-By: 3D Graph | Dependency Note: Requires clear mouse spec

2026-01-08T00:00:07Z | Codex | Mouse interaction spec applied (pan/orbit/drag threshold) | Avoid diagonal pan and suppress click after drag >5px | src/components/LoomGraph.tsx | Touches/Used-By: 3D Graph | Dependency Note: May need horizon lock validation

2026-01-08T00:00:08Z | Codex | Navigation controls re-enabled | Restore camera control after regression | src/components/LoomGraph.tsx | Touches/Used-By: 3D Graph | Dependency Note: Verify with overlay inputs


2026-01-08T00:10:00Z | Codex | Logged history DB research summary | Capture research guidance for future implementation | progress_of_the_code.md | Touches/Used-By: CodeGnosis DB history | Dependency Note: Requires Claude review

2026-01-09T00:00:00Z | Veris | Mouse controls rewrite: LMB orbit, RMB/MMB pan, horizon-locked, 5px threshold | Fix unreliable mouse behavior per Designer spec | src/components/LoomGraph.tsx | Touches/Used-By: 3D Graph | Dependency Note: Ctrl+LMB drag nodes via enableNodeDrag prop

2026-01-09T00:00:01Z | Veris | Settings panel scrollbar: max-height 85vh, overflow-y auto, subtle scrollbar styling | Prevent settings from spilling below viewport | src/components/SettingsModal.css | Touches/Used-By: Settings UI | Dependency Note: None

2026-01-09T00:00:02Z | Veris | Sidebar arrow button: updated transition to 200ms ease-out | Match Designer spec for slide animation timing | src/components/LoomGraph.css | Touches/Used-By: Info panel | Dependency Note: Toggle logic already existed

2026-01-09T00:00:03Z | Veris | Theme system: CSS variables for 5 themes, unified dropdown controls sidebar+skybox+accents | Wire themes dropdown per Designer spec | src/index.css, src/App.css, src/App.tsx, src/components/SettingsModal.tsx | Touches/Used-By: Entire UI | Dependency Note: Skybox in LoomGraph also reads settings.skybox

2026-01-09T00:00:04Z | Veris | Analysis Results expanded: 6 metrics with tooltips, frameworks tags, hub files list | Restore missing data and add plain-English explanations | src/App.tsx, src/App.css | Touches/Used-By: Analysis tab | Dependency Note: Reads analysisResult.summary, statistics, hubFiles

2026-01-09T00:00:05Z | Veris | Welcome/Values/Glossary credits section: About, Values, AI notice, feedback email | Add scrollable credits per Designer spec (humans skip, AI sees) | src/components/WelcomeOverlay.tsx, src/components/WelcomeOverlay.css | Touches/Used-By: Post-analysis overlay | Dependency Note: Displays after analysis completes

2026-01-09T00:00:06Z | Veris | Move star brightness from Settings to Calibration panel | User requested, now uses internal state with live updates | src/components/LoomGraph.tsx, src/components/LoomControls.tsx, src/components/SettingsModal.tsx | Touches/Used-By: 3D Graph, Calibration panel | Dependency Note: Now controlled locally like bloom/linkOpacity

2026-01-08T22:20:00Z | Gemini | Consolidate and archive CODEGNOSIS__PROGRESS__DO_NOT_MISS.md | Maintain single source of truth for project state | progress_of_the_code.md | Touches/Used-By: Project Management | Dependency Note: Merges "Current Focus", "Immediate Issues", and "Decisions"

## Consolidated Status (Archived 2026-01-08)
**Current Focus:**
- Mouse controls: stabilize drag/zoom/pan (Visual Graph / LoomGraph)
- Analysis flow: stop resets, ensure clean analyzer output
- UI polish: tabs, settings scroll, analysis metrics and explanations

**Immediate Issues:**
- Mouse controls intermittently dead (zoom/drag/pan)
- Analyze Project resets app (needs error-path fix + analyzer stdout discipline)
- Arrow switch sides broken
- Themes dropdown no effect (use Themes appling)
- Settings list scroll missing
- Code City overflow and cursor issues
- Missing analysis data in Results
- Help tooltip toggle not implemented
- Ctrl+scroll zoom scaling

**Decisions:**
- Mouse drag: Ctrl-only drag for stars; pan option required
- Context menu suppressed after drag >5px
- "Visual Graph" renamed to "3D Graph"
- "We speak your AI's language." tagline approved
- Controller support moved to Phase 2

2026-01-08T19:30:00Z | Veris | ai_packager.py: Added 10 new exclusion patterns | Eliminate 64MB bundle bloat from node_modules, dist, etc. | ai_packager.py | Touches/Used-By: AI Bundle generation | Dependency Note: None

2026-01-08T19:35:00Z | Veris | ai_packager.py: Added file-level chunking for files >50KB | Large files split at function/class boundaries with headers | ai_packager.py | Touches/Used-By: AI Bundle generation | Dependency Note: Supports Python, JS/TS, Rust patterns

2026-01-08T19:40:00Z | Veris | Added SQLite foundation: tauri-plugin-sql, migration 0001_code_files.sql | Foundation for v2 context storage and FTS search | src-tauri/Cargo.toml, src-tauri/src/lib.rs, src-tauri/src/sql/migrations/0001_code_files.sql | Touches/Used-By: Future context retrieval | Dependency Note: Requires cargo build to compile

2026-01-08T20:30:00Z | Veris | Full-scale AnalysisReport component: Cognitive Command Center redesign | Transforms data into actionable intelligence - health ring, debt meters, AI readiness, onboarding estimates, blast radius, expandable panels | src/components/AnalysisReport.tsx, src/components/AnalysisReport.css, src/App.tsx | Touches/Used-By: Analysis tab | Dependency Note: Replaces old inline stats grid

2026-01-08T21:00:00Z | Veris | AnalysisReport fixes: scrollable panels, 2x2 metric grid, health ring CSS variable fix | Panel content now has overflow-y:auto with styled scrollbar; metrics use repeat(2,1fr) grid; health ring uses --health-score CSS var properly for conic gradient | src/components/AnalysisReport.css, src/components/AnalysisReport.tsx | Touches/Used-By: Analysis tab | Dependency Note: None

2026-01-08T21:15:00Z | Veris | Main report container scroll | Added max-height calc(100vh - 120px) and overflow-y:auto to .analysis-report so expanded panels don't push content off-screen | src/components/AnalysisReport.css | Touches/Used-By: Analysis tab | Dependency Note: None

2026-01-08T21:30:00Z | Veris | Layman tooltips for all Analysis Report elements | Added title attributes with plain-English explanations to: 4 metric cards (FILES, LINKS, DEPTH, BLAST), health ring, and all 7 intel panels (Technical Debt, AI Readiness, Onboarding, Hub Files, Entry Points, Health Warnings, Circular Dependencies) | src/components/AnalysisReport.tsx | Touches/Used-By: Analysis tab UX | Dependency Note: Native browser tooltips, no library needed

## SESSION SUMMARY 2026-01-08 (Veris/Claude CLI)

**Role:** Designer then Maverick (Foreman) after Gemmy was dismissed

**Major Accomplishments:**
1. **ai_packager.py overhaul:**
   - Added 10 exclusion patterns (node_modules, dist, build, target, .git, __pycache__, package-lock.json, .map, .min.js, .min.css)
   - Implemented file-level chunking for files >50KB at function/class boundaries
   - Supports Python, JavaScript, TypeScript, React, Rust patterns

2. **SQLite foundation added:**
   - tauri-plugin-sql dependency in Cargo.toml
   - Plugin wired in lib.rs
   - Migration 0001_code_files.sql with code_files table and FTS5 search
   - Ready for Lenny DB attachment when available

3. **AnalysisReport.tsx - Complete redesign:**
   - Hero section with project name, type, frameworks, health ring
   - Command center: 4 key metrics (FILES, LINKS, DEPTH, BLAST) in 2x2 grid
   - 7 expandable intel panels: Technical Debt, AI Readiness, Onboarding Intelligence, Hub Files, Entry Points, Health Warnings, Circular Dependencies
   - AI Readiness panel estimates context window fit and recommends strategy
   - Onboarding panel estimates time-to-productivity for new devs
   - All elements have layman tooltips explaining value

4. **Context optimization:**
   - Thinned CONTEXT_LOG.md from ~171 lines to ~76 lines
   - Created CONTEXT_ARCHIVE_2026_01.md for archived sections
   - Created deep research prompt for GemmyB on scalable AI context ingestion

**Outstanding from progress_of_the_code.md (not addressed this session):**
- Mouse controls intermittently dead
- Arrow switch sides broken
- Themes dropdown no effect
- Code City overflow and cursor issues
- Help tooltip toggle not implemented
- Ctrl+scroll zoom scaling
- Wire Code City to real analysisResult.files data
