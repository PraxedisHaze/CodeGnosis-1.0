# CodeGnosis Progress Tracker (DO NOT MISS)

Status: ACTIVE
Scope: CodeGnosis_1.0 (Tauri + Python analyzer + UI)
Protocol: CONFIDENTIAL
Owner: Timothy

## Current Focus (Top 3)
- Mouse controls: stabilize drag/zoom/pan (Visual Graph / LoomGraph)
- Analysis flow: stop resets, ensure clean analyzer output
- UI polish: tabs, settings scroll, analysis metrics and explanations

## Immediate Issues (Open)
- Mouse controls intermittently dead (zoom/drag/pan)
- Analyze Project resets app (needs error-path fix + analyzer stdout discipline)
- Arrow switch sides broken
- Themes dropdown no effect (use Themes appling)
- Settings list scroll missing
- Code City overflow and cursor issues
- Missing analysis data in Results
- Help tooltip toggle not implemented
- Ctrl+scroll zoom scaling

## Decisions / Notes
- Mouse drag: Ctrl-only drag for stars; pan option required
- Context menu suppressed after drag >5px (pending control spec)
- “Visual Graph” should be renamed to “3D Graph”
- Post-analysis message + About Us/Values + AI/Human glossary strip required
- “We speak your AI’s language.” tagline approved
- Controller support: Phase 2 (note only)

## Pending Requests
- Gather Ignore list UX (list of folders to skip, toggle for common deps)
- “Show broken only” filter; highlight critical nodes
- Large “Vault of Value” section; add Perchance
- Specials list (definition TBD)

## Completed (Recent)
- enableNavigationControls set to true in LoomGraph (mouse control attempt)
- Ctrl-only node drag added (LoomGraph)
- Dynamic port script added (scripts/auto-dev.js)
- package.json dev uses auto-dev, vite.config uses VITE_PORT

## Hand-off / Next Steps
- Confirm mouse/pan behavior spec (waiting on research)
- Fix Analyze reset (stabilize analyzer_core stdout/stderr)
- Restore missing metrics in Analysis Results
- Implement settings scroll + UI overflow fixes

