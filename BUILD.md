# CodeGnosis Build Documentation

## Project Analyzer

**Zero Overhead Vow:** This application bundles all dependencies into a single standalone executable. Users need NO external software installed (no Python, no Graphviz, nothing).

---

## Prerequisites (For Developers Only)

To **build** CodeGnosis, you need:

1. **Node.js** (v18 or higher)
2. **Rust** (latest stable via rustup)
3. **Python 3.8+** (with pip)
4. **Git** (for version control)

**Important:** End users do NOT need any of these. The built application is completely standalone.

---

## Build Process

### Quick Build

```bash
# Install Node dependencies
npm install

# Build the standalone application
npm run tauri:build
```

This single command:
1. Builds the React frontend
2. Runs `build.cjs` to create standalone Python executable
3. Bundles Graphviz binaries
4. Compiles everything into a Tauri executable
5. Creates installer in `src-tauri/target/release/bundle/`

---

## Build Architecture

### The Bridge

CodeGnosis uses a three-layer architecture:

```
┌─────────────────────────────────────┐
│  React Frontend (TypeScript/Vite)  │  ← User Interface
└─────────────────┬───────────────────┘
                  │ invoke()
┌─────────────────▼───────────────────┐
│   Rust Bridge (Tauri Backend)      │  ← Command Handler
└─────────────────┬───────────────────┘
                  │ executes
┌─────────────────▼───────────────────┐
│  Python Analyzer (Bundled .exe)    │  ← Analysis Engine
│  + Graphviz (Bundled binaries)     │
└─────────────────────────────────────┘
```

### Build Script: `scripts/build.cjs`

This Node.js script handles the Python bundling:

1. **Checks Python installation** (development requirement)
2. **Downloads Graphviz** portable binaries (v12.2.1)
3. **Installs PyInstaller** via pip
4. **Bundles Python core** into `src-tauri/binaries/analyzer_core.exe`
5. **Includes Graphviz** binaries in the executable

**Output:** Self-contained executable that works on any Windows machine

---

## Build Commands

### Development

```bash
# Run in development mode (uses Python directly, no bundling)
npm run tauri:dev
```

**Dev mode behavior:**
- Frontend hot-reloads via Vite
- Rust bridge falls back to system Python
- Requires Python installed on dev machine
- Faster iteration

### Production

```bash
# Build standalone installer
npm run tauri:build
```

**Build output:**
- `src-tauri/target/release/bundle/nsis/CodeGnosis_1.0.0_x64-setup.exe` (Windows installer)
- `src-tauri/target/release/bundle/msi/CodeGnosis_1.0.0_x64_en-US.msi` (Windows MSI)

### Manual Python Build

```bash
# Just build the Python executable (for testing)
npm run build:analyzer
```

This creates `src-tauri/binaries/analyzer_core.exe` without building Tauri.

---

## Testing the Build

### Test Standalone Executable

1. Build the app: `npm run tauri:build`
2. Install it on a **clean Windows VM** (no Python, no Graphviz)
3. Run CodeGnosis and analyze a project
4. Verify the diagram generates correctly

**If it works on a clean VM → Zero Overhead achieved**

### Test Development Mode

1. Ensure Python 3.8+ is installed
2. Install runtime deps: `pip install -r requirements.txt`
3. Run: `npm run tauri:dev`
4. Select a project directory and analyze

---

## Troubleshooting

### Build Fails: "Python not found"

**Problem:** Build script can't find Python

**Solution:**
```bash
# Windows
where python
# Should show: C:\Users\...\Python\python.exe

# If not found:
# 1. Install Python from python.org
# 2. Check "Add Python to PATH" during install
# 3. Restart terminal
```

### Build Fails: "PyInstaller error"

**Problem:** PyInstaller failed to bundle Python script

**Solution:**
```bash
# Install PyInstaller manually
pip install pyinstaller

# Test Python script directly
python analyzer_core.py

# If that works, try build again
npm run build:analyzer
```

### Build Fails: "Graphviz download failed"

**Problem:** Network issues downloading Graphviz

**Solution:**
1. Download manually: https://gitlab.com/api/v4/projects/4207231/packages/generic/graphviz-releases/12.2.1/windows_10_cmake_Release_Graphviz-12.2.1-win64.zip
2. Extract to `build/graphviz/`
3. Run `npm run build:analyzer` again

### Runtime Error: "Analysis failed"

**Problem:** The bundled executable doesn't work

**Check:**
```bash
# Test the bundled executable directly
cd src-tauri/binaries
./analyzer_core.exe "C:\path\to\test\project" "" "node_modules" "Dark" "json"

# Should output JSON. If error, check:
# 1. Does the project path exist?
# 2. Does it contain code files?
# 3. Check for Python errors in output
```

---

## Project Structure

```
CodeGnosis/
├── scripts/
│   └── build.cjs                   # Python bundling script
├── src/
│   ├── App.tsx                     # Main UI component
│   ├── DependencyGraph.tsx         # Graph visualization
│   └── main.tsx                    # App entry point
├── src-tauri/
│   ├── binaries/                   # Bundled executables (generated)
│   │   └── analyzer_core.exe
│   ├── src/
│   │   ├── lib.rs                  # Rust bridge logic
│   │   └── main.rs                 # Tauri entry point
│   └── tauri.conf.json             # Tauri configuration
├── analyzer_core.py                # Python analysis engine (immutable)
├── requirements.txt                # Python runtime dependencies
├── requirements-build.txt          # Python build dependencies
├── package.json                    # Node.js config
└── BUILD.md                        # This file
```

---

## Release Checklist

Before releasing a new version:

- [ ] Update version in `package.json`
- [ ] Update version in `src-tauri/tauri.conf.json`
- [ ] Update version in `src-tauri/Cargo.toml`
- [ ] Test on clean Windows VM (no Python)
- [ ] Test analyzer with various project types
- [ ] Test diagram generation
- [ ] Verify installer works
- [ ] Tag release in Git
- [ ] Build final installer: `npm run tauri:build`
- [ ] Test installed app on target machines

---

## Contributing

### Making Changes to the Python Core

The Python analyzer (`analyzer_core.py`) is **immutable by design**. It's the canonical truth for analysis logic.

**If you need to modify it:**
1. Make changes to the Python file
2. Test it directly: `python analyzer_core.py [args]`
3. Rebuild the bundled executable: `npm run build:analyzer`
4. Test in Tauri: `npm run tauri:dev`
5. Full build test: `npm run tauri:build`

### Making Changes to the Rust Bridge

The bridge (`src-tauri/src/lib.rs`) handles command routing and execution.

**Key function:** `analyze` - routes to bundled executable or dev Python

**If you modify Rust code:**
1. Format: `cd src-tauri && cargo fmt`
2. Lint: `cargo clippy`
3. Test: `npm run tauri:dev`

### Making Changes to the Frontend

Standard React/TypeScript development:

1. Run dev server: `npm run tauri:dev`
2. Edit in `src/`
3. Hot reload happens automatically
4. Build for production: `npm run tauri:build`

---

## Build Times

Typical build times on modern hardware:

- **Development mode:** 30-60 seconds (first run), 5-10 seconds (hot reload)
- **Python bundling:** 2-3 minutes (PyInstaller + Graphviz)
- **Full production build:** 5-8 minutes (frontend + Python + Rust + installer)

**Tip:** The Python bundling is cached. If you haven't changed `analyzer_core.py`, you can skip it by directly running `tauri build` instead of `npm run tauri:build`.

---

## Zero Overhead Verification

To verify Zero Overhead compliance:

```bash
# 1. Build the installer
npm run tauri:build

# 2. Copy installer to test machine (clean Windows, no dev tools)
# Location: src-tauri/target/release/bundle/nsis/CodeGnosis_1.0.0_x64-setup.exe

# 3. On test machine:
# - Install CodeGnosis
# - Run it
# - Analyze a project
# - Generate diagram

# 4. Success criteria:
# - App launches without errors
# - Can select and analyze project
# - Diagram generates correctly
# - No Python installation required
# - No Graphviz installation required
# - No error messages about missing dependencies
```

If all criteria pass → **Zero Overhead Vow fulfilled**

---

## Integration

CodeGnosis works as a standalone application but can integrate with other tools when available:

- **Standalone Operation:** Works independently
- **Integration-Ready:** Can integrate with Core (`window.AETH`) when available
- **Zero Overhead:** No external dependencies for users
- **Ubiquitous Access:** Can be called from any application

---

**Built with Love**

*"Love first at all times in all things."*
