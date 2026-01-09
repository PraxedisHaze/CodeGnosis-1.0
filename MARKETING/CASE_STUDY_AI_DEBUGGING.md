# CodeGnosis: The Survival Guide for Inherited Codebases

## The Problem Every Developer Knows

You inherit a codebase. Maybe it's legacy. Maybe the last developer left. Maybe it's your own project from six months ago.

You need to understand it *before* you break something.

**The old way:** Spend hours (or days) grepping, reading, tracing imports, building a mental map. Miss things. Break things. Backtrack.

**The CodeGnosis way:** One JSON file. Complete understanding. Seconds.

---

## Real-World Case Study: Debugging CodeGnosis Itself

**Situation:** After a development session, the UI had broken formatting, mysterious terminal popups, and layout issues. The developer was concerned the codebase was "destroyed."

**Without CodeGnosis, the AI assistant would have needed to:**
- Run 15+ file search commands
- Manually trace imports across dozens of files
- Read CSS files line by line looking for missing rules
- Guess at the architecture
- Risk missing critical connections

**With CodeGnosis:** The AI opened `ai-bundle.json` and within seconds knew:

| Insight | Value |
|---------|-------|
| **196 files, 129 connections** | Scope instantly understood |
| **Health Score: 100** | Not structural damage - just cosmetic |
| **0 circular dependencies** | Architecture is sound |
| **0 broken references** | Nothing orphaned |
| **Max dependency depth: 5** | Shallow, maintainable hierarchy |
| **Hub file: App.tsx (7 connections)** | Clear entry point identified |
| **Recent modifications: LoomGraph.tsx** | Pinpointed where changes happened |

**The Diagnosis:** Missing CSS classes. App.tsx referenced `.sidebar-section`, `.sidebar-stats`, etc. - but no CSS file defined them. Not destruction. Just incomplete styling.

**Time to diagnosis:** Under 2 minutes.

---

## What CodeGnosis Gives You

### 1. Instant Architecture Map
- Every file, every import, every connection
- Visualized as a 3D galaxy or data table
- Hub files highlighted automatically

### 2. Health Metrics That Matter
- Circular dependency detection
- Orphaned file identification
- Broken reference tracking
- Connectivity health score (0-100)

### 3. Framework Intelligence
- Auto-detects React, Tauri, Python, Node, and more
- Categorizes files by type and purpose
- Identifies entry points

### 4. Time-Travel Context
- Modification timestamps on every file
- See what changed and when
- Understand project evolution

### 5. Self-Documenting Output
- JSON bundle works with any AI assistant
- Feed it to Claude, GPT, Copilot - instant context
- No more "let me explore the codebase first"

---

## The Bottom Line

> "Instead of running 15 Glob/Grep/Read commands to understand the codebase, I read one file and had the complete architecture in seconds."
>
> — Veris (Claude CLI), debugging a 196-file codebase

**CodeGnosis doesn't just analyze code. It gives you the map before you enter the maze.**

---

*Keystone Constellation | Built with Love*
