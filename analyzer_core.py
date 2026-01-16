"""BOM-STRICT"""

"""
analyzer_core.py
================
Headless Python engine for CodeGnosis (Project Analyzer Star).
Performs file system analysis, dependency detection, and Graphviz rendering.
Designed for execution via a Node.js/Electron bridge.
"""

import os
import ast
import re
import json
import sys
import graphviz
import tempfile
from pathlib import Path
from datetime import datetime, timezone
import platform
import time
import logging  # Added import

try:
    import ai_packager
except Exception:
    ai_packager = None

try:
    import ghost_protocol
except Exception:
    ghost_protocol = None


def get_folder_size(path):
    """Calculate total size of a folder in bytes."""
    total = 0
    try:
        for dirpath, dirnames, filenames in os.walk(path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                try:
                    total += os.path.getsize(fp)
                except (OSError, FileNotFoundError):
                    pass
    except (OSError, PermissionError):
        pass
    return total


def format_size(bytes_val):
    """Format bytes as human-readable string."""
    if bytes_val >= 1024 * 1024 * 1024:
        return f"{bytes_val / (1024 * 1024 * 1024):.1f} GB"
    elif bytes_val >= 1024 * 1024:
        return f"{bytes_val / (1024 * 1024):.1f} MB"
    elif bytes_val >= 1024:
        return f"{bytes_val / 1024:.1f} KB"
    else:
        return f"{bytes_val} B"


def analyze_build_profile(project_path):
    """
    Analyze the build profile of a project including dependencies and shipping weight.
    Returns a buildProfile dict with dev footprint, shipping weight, and dependency lists.
    """
    project_path = Path(project_path)

    build_profile = {
        "devFootprint": {
            "total": "0 B",
            "totalBytes": 0,
            "breakdown": {}
        },
        "shippingWeight": {
            "installers": [],
            "executables": [],
            "totalBytes": 0,
            "total": "0 B"
        },
        "dependencies": {
            "npm": [],
            "cargo": []
        }
    }

    # --- Dev Footprint ---
    total_dev_bytes = 0
    breakdown = {}

    # node_modules
    node_modules_path = project_path / "node_modules"
    if node_modules_path.exists():
        nm_size = get_folder_size(node_modules_path)
        breakdown["node_modules"] = format_size(nm_size)
        total_dev_bytes += nm_size

        # Get top-level package sizes
        npm_deps = []
        for pkg_dir in node_modules_path.iterdir():
            if pkg_dir.is_dir() and not pkg_dir.name.startswith('.'):
                pkg_size = get_folder_size(pkg_dir)
                if pkg_size > 1024 * 1024:  # Only packages > 1MB
                    npm_deps.append({
                        "name": pkg_dir.name,
                        "size": format_size(pkg_size),
                        "sizeBytes": pkg_size
                    })
        npm_deps.sort(key=lambda x: x["sizeBytes"], reverse=True)
        build_profile["dependencies"]["npm"] = npm_deps[:20]  # Top 20

    # Rust target
    rust_target_path = project_path / "src-tauri" / "target"
    if rust_target_path.exists():
        rt_size = get_folder_size(rust_target_path)
        breakdown["rustTarget"] = format_size(rt_size)
        total_dev_bytes += rt_size

    # Source code (src folder)
    src_path = project_path / "src"
    if src_path.exists():
        src_size = get_folder_size(src_path)
        breakdown["sourceCode"] = format_size(src_size)
        total_dev_bytes += src_size

    # Total project
    total_project = get_folder_size(project_path)
    other_size = total_project - sum([
        get_folder_size(node_modules_path) if node_modules_path.exists() else 0,
        get_folder_size(rust_target_path) if rust_target_path.exists() else 0,
        get_folder_size(src_path) if src_path.exists() else 0
    ])
    breakdown["other"] = format_size(max(0, other_size))

    build_profile["devFootprint"]["breakdown"] = breakdown
    build_profile["devFootprint"]["totalBytes"] = total_project
    build_profile["devFootprint"]["total"] = format_size(total_project)

    # --- Shipping Weight ---
    shipping_bytes = 0

    # Check for installers
    bundle_path = project_path / "src-tauri" / "target" / "release" / "bundle"
    if bundle_path.exists():
        # MSI installers
        msi_path = bundle_path / "msi"
        if msi_path.exists():
            for msi in msi_path.glob("*.msi"):
                msi_size = msi.stat().st_size
                build_profile["shippingWeight"]["installers"].append({
                    "name": msi.name,
                    "type": "msi",
                    "size": format_size(msi_size),
                    "sizeBytes": msi_size
                })
                shipping_bytes += msi_size

        # NSIS installers
        nsis_path = bundle_path / "nsis"
        if nsis_path.exists():
            for exe in nsis_path.glob("*.exe"):
                exe_size = exe.stat().st_size
                build_profile["shippingWeight"]["installers"].append({
                    "name": exe.name,
                    "type": "nsis",
                    "size": format_size(exe_size),
                    "sizeBytes": exe_size
                })
                shipping_bytes += exe_size

    # Check for release executables
    release_path = project_path / "src-tauri" / "target" / "release"
    if release_path.exists():
        for exe in release_path.glob("*.exe"):
            if "setup" not in exe.name.lower():  # Skip installers already counted
                exe_size = exe.stat().st_size
                build_profile["shippingWeight"]["executables"].append({
                    "name": exe.name,
                    "size": format_size(exe_size),
                    "sizeBytes": exe_size
                })

    build_profile["shippingWeight"]["totalBytes"] = shipping_bytes
    build_profile["shippingWeight"]["total"] = format_size(shipping_bytes)

    # --- Parse package.json for npm dependencies with versions ---
    package_json_path = project_path / "package.json"
    if package_json_path.exists():
        try:
            with open(package_json_path, "r", encoding="utf-8") as f:
                pkg_data = json.load(f)

            deps = pkg_data.get("dependencies", {})
            dev_deps = pkg_data.get("devDependencies", {})

            # Enrich npm deps with version info
            for dep in build_profile["dependencies"]["npm"]:
                dep_name = dep["name"]
                if dep_name in deps:
                    dep["version"] = deps[dep_name]
                    dep["isDev"] = False
                elif dep_name in dev_deps:
                    dep["version"] = dev_deps[dep_name]
                    dep["isDev"] = True
        except Exception:
            pass

    # --- Parse Cargo.toml for Rust crates ---
    cargo_toml_path = project_path / "src-tauri" / "Cargo.toml"
    if cargo_toml_path.exists():
        try:
            with open(cargo_toml_path, "r", encoding="utf-8") as f:
                cargo_content = f.read()

            # Simple regex parsing for dependencies
            # [dependencies] section
            dep_section = re.search(r'\[dependencies\](.*?)(?=\[|$)', cargo_content, re.DOTALL)
            if dep_section:
                dep_lines = dep_section.group(1).strip().split('\n')
                for line in dep_lines:
                    line = line.strip()
                    if '=' in line and not line.startswith('#'):
                        parts = line.split('=', 1)
                        crate_name = parts[0].strip()
                        version_part = parts[1].strip()

                        # Extract version from various formats
                        version = "unknown"
                        if version_part.startswith('"'):
                            version = version_part.strip('"')
                        elif 'version' in version_part:
                            ver_match = re.search(r'version\s*=\s*"([^"]+)"', version_part)
                            if ver_match:
                                version = ver_match.group(1)

                        build_profile["dependencies"]["cargo"].append({
                            "name": crate_name,
                            "version": version
                        })
        except Exception:
            pass

    return build_profile


def load_codegnosis_config(project_path):
    """
    Load configuration from codegnosis.config.json.
    Returns merged config with defaults for any missing keys.
    """
    config_path = Path(project_path) / "codegnosis.config.json"
    default_config = {
        "language_extensions": {},
        "compliance_checks": {
            "required_header_text": "",
            "mandatory_files": [],
            "forbidden_licenses": ["AGPL", "GPL", "LGPL"],
        },
        "custom_regex_parsers": {},
        "exclusions": {
            "directories": [
                ".git",
                "node_modules",
                "__pycache__",
                "dist",
                "build",
                "target",
            ],
            "files": ["package-lock.json", ".DS_Store"],
            "extensions": [
                ".exe", ".dll", ".pyc", ".png", ".jpg", ".jpeg", ".gif", ".webp",
                ".zip", ".tar", ".gz", ".7z", ".rar",
                ".xcf", ".psd", ".ai", ".sketch", ".fig", ".blend", ".fbx"
            ],
        },
        "analysisSettings": {
            "fileSizeLimitMB": 5,
            "checkCircularDependencies": True,
            "checkOrphans": True,
            "checkMissingAssets": True,
            "scanDepth": 10,
        },
        "tauri": {"enabled": False, "v2Checks": True},
        "visualization": {"maxNodes": 400, "maxEdges": 900, "categoryColors": {}},
    }

    if not config_path.exists():
        return default_config

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            user_config = json.load(f)
        # Merge user config with defaults (user overrides defaults)
        merged = {
            "language_extensions": user_config.get("language_extensions", {}),
            "compliance_checks": {
                **default_config["compliance_checks"],
                **user_config.get("compliance_checks", {}),
            },
            "custom_regex_parsers": user_config.get("custom_regex_parsers", {}),
            "exclusions": {
                **default_config["exclusions"],
                **user_config.get("exclusions", {}),
            },
            "analysisSettings": {
                **default_config["analysisSettings"],
                **user_config.get("analysisSettings", {}),
            },
            "tauri": {**default_config["tauri"], **user_config.get("tauri", {})},
            "visualization": {
                **default_config["visualization"],
                **user_config.get("visualization", {}),
            },
        }
        return merged
    except Exception as e:
        logging.warning(f"Could not load codegnosis.config.json: {e}")
        return default_config


# Configure logging to a file
LOG_FILE = Path(tempfile.gettempdir()) / "codegnosis_analyzer.log"
logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)  # Global logger instance

# Theme definitions (Kept for Graphviz coloring logic)
LIGHT_THEME = {
    "bg": "#f5f5f5",
    "fg": "#000000",
    "canvas_bg": "#ffffff",
    "border": "#cccccc",
    "comp1_bg": "#e8f4f8",
    "comp2_bg": "#fff8e1",
    "comp3_bg": "#e8f5e9",
    "comp4_bg": "#f3e5f5",
}
DARK_THEME = {
    "bg": "#1e1e1e",
    "fg": "#e0e0e0",
    "canvas_bg": "#252525",
    "border": "#404040",
    "comp1_bg": "#2d2d2d",
    "comp2_bg": "#2d2d2d",
    "comp3_bg": "#2d2d2d",
    "comp4_bg": "#2d2d2d",
}
SATURATED_THEME = {
    "bg": "#0f0f23",
    "fg": "#ffffff",
    "canvas_bg": "#0a0a15",
    "border": "#2a2f4a",
    "comp1_bg": "#1a1f3a",
    "comp2_bg": "#1a1f3a",
    "comp3_bg": "#1a1f3a",
    "comp4_bg": "#1a1f3a",
    "rainbow": True,
}
THEMES = [LIGHT_THEME, DARK_THEME, SATURATED_THEME]
# Legacy caps - now loaded from config, these are fallbacks only
GRAPH_NODE_CAP = 400
GRAPH_EDGE_CAP = 900


class AnalyzerCore:
    """Core logic for project analysis, independent of any UI framework."""

    MASTER_CATEGORIES = {
        ".py": "Python",
        ".js": "JavaScript",
        ".cjs": "JavaScript",
        ".mjs": "JavaScript Module",
        ".jsx": "React",
        ".ts": "TypeScript",
        ".tsx": "TypeScript React",
        ".cts": "TypeScript",
        ".mts": "TypeScript Module",
        ".html": "HTML",
        ".htm": "HTML",
        ".css": "CSS",
        ".scss": "SCSS",
        ".less": "Less",
        ".java": "Java",
        ".cs": "C#",
        ".cpp": "C++",
        ".c": "C",
        ".h": "Header",
        ".go": "Go",
        ".rs": "Rust",
        ".php": "PHP",
        ".rb": "Ruby",
        ".swift": "Swift",
        ".kt": "Kotlin",
        ".pl": "Perl",
        ".sh": "Shell",
        ".ps1": "PowerShell",
        ".cmd": "Batch",
        ".bat": "Batch",
        ".json": "JSON",
        ".xml": "XML",
        ".yaml": "YAML",
        ".yml": "YAML",
        ".toml": "TOML",
        ".ini": "INI",
        ".env": "ENV",
        ".sql": "SQL",
        ".db": "Database",
        ".sqlite3": "SQLite",
        ".md": "Markdown",
        ".markdown": "Markdown",
        ".txt": "Text",
        ".csv": "CSV",
        ".png": "Image",
        ".jpg": "Image",
        ".jpeg": "Image",
        ".gif": "Image",
        ".webp": "Image",
        ".svg": "SVG",
        ".ico": "Icon",
        ".mp4": "Video",
        ".mp3": "Audio",
        ".ttf": "Font",
        ".woff": "Font",
        ".woff2": "Font",
        ".docx": "Document",
        ".pdf": "Document",
        ".xlsx": "Spreadsheet",
        ".dot": "Graphviz",
        ".code-workspace": "Config",
        ".webmanifest": "Config",
        ".map": "Source Map",
        ".coffee": "CoffeeScript",
        ".applescript": "AppleScript",
        ".bnf": "Grammar",
        ".flow": "Flow",
        ".exe": "Executable",
        ".zip": "Archive",
        ".tar": "Archive",
        ".gz": "Archive",
        ".1": "Man Page",
    }

    CATEGORY_COLORS = {
        "Python": "lightblue",
        "JavaScript": "lightyellow",
        "JavaScript Module": "khaki",
        "React": "lightcyan",
        "TypeScript": "deepskyblue",
        "TypeScript Module": "cornflowerblue",
        "TypeScript React": "dodgerblue",
        "HTML": "lightcoral",
        "CSS": "lightgreen",
        "SCSS": "mediumseagreen",
        "Less": "palegreen",
        "JSON": "wheat",
        "YAML": "khaki",
        "SQL": "plum",
        "Image": "lavender",
        "Icon": "violet",
        "SVG": "lavenderblush",
        "Document": "mistyrose",
        "Spreadsheet": "palegreen",
        "Graphviz": "lightsteelblue",
        "Config": "lightgoldenrodyellow",
        "Source Map": "gainsboro",
        "CoffeeScript": "rosybrown",
        "AppleScript": "lightpink",
        "Grammar": "thistle",
        "Flow": "powderblue",
        "Executable": "silver",
        "Archive": "darkgray",
        "Batch": "tan",
        "Man Page": "peachpuff",
        "Default": "lightgray",
        "Unfamiliar": "red",
    }

    def __init__(
        self,
        directory,
        extensions_to_find,
        custom_categories={},
        excluded_folders=[],
        config=None,
        progress_file_path=None,
    ):
        self.project_dir = Path(directory)
        self.extensions_to_find = (
            set(ext.lower() for ext in extensions_to_find)
            if extensions_to_find
            else set()
        )
        self.include_all = len(self.extensions_to_find) == 0
        self.excluded_folders = set(excluded_folders)
        self.custom_categories = custom_categories
        self.config = config or {}
        self.progress_file = Path(progress_file_path) if progress_file_path else None

        # ---------------------------------------------------------
        # EXCLUSIONS (from config)
        # ---------------------------------------------------------
        excl_conf = self.config.get("exclusions", {})
        self.excluded_dirs = set(
            excl_conf.get(
                "directories", [".git", "node_modules", "__pycache__", "dist", "build"]
            )
        )
        self.excluded_files = set(
            excl_conf.get("files", ["package-lock.json", ".DS_Store"])
        )
        # Normalize extensions to lowercase
        self.excluded_extensions = {
            ext.lower()
            for ext in excl_conf.get(
                "extensions", [".exe", ".dll", ".pyc", ".png", ".jpg", ".zip"]
            )
        }

        # ---------------------------------------------------------
        # ANALYSIS SETTINGS (from config)
        # ---------------------------------------------------------
        analysis_conf = self.config.get("analysisSettings", {})
        self.max_file_size_mb = analysis_conf.get("fileSizeLimitMB", 5)
        self.max_file_size_bytes = self.max_file_size_mb * 1024 * 1024
        self.check_circular = analysis_conf.get("checkCircularDependencies", True)
        self.check_orphans = analysis_conf.get("checkOrphans", True)
        self.check_missing_assets = analysis_conf.get("checkMissingAssets", True)
        self.scan_depth = analysis_conf.get("scanDepth", 10)

        # ---------------------------------------------------------
        # TAURI SETTINGS (from config)
        # ---------------------------------------------------------
        tauri_conf = self.config.get("tauri", {})
        self.tauri_enabled = tauri_conf.get("enabled", False)
        self.tauri_v2_checks = tauri_conf.get("v2Checks", True)

        # ---------------------------------------------------------
        # VISUALIZATION (from config)
        # ---------------------------------------------------------
        viz_conf = self.config.get("visualization", {})
        self.max_graph_nodes = viz_conf.get("maxNodes", 400)
        self.max_graph_edges = viz_conf.get("maxEdges", 900)
        # Merge config colors with defaults
        self.dynamic_category_colors = {
            **self.CATEGORY_COLORS,
            **viz_conf.get("categoryColors", {}),
        }

        # Merge categories: MASTER_CATEGORIES < config language_extensions < custom_categories
        config_extensions = self.config.get("language_extensions", {})
        self.all_categories = {
            **self.MASTER_CATEGORIES,
            **config_extensions,
            **self.custom_categories,
        }

        self.file_graph = {}
        self.file_types = {}
        self.file_data = {}
        self.unfamiliar_extensions = set()
        self.found_extensions = set()

        # Connectivity analysis
        self.missing_assets = {}
        self.orphaned_files = set()
        self.asset_references = {}
        self.start_time = time.time()
        self.logger = logger  # Use the global logger instance

    def emit_progress(self, stage, percent, message):
        if not self.progress_file:
            return
        payload = {
            "stage": stage,
            "percent": percent,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        try:
            self.progress_file.write_text(json.dumps(payload))
        except Exception as exc:
            self.logger.debug(f"Failed to write progress file: {exc}")

    # --- Core Logic Methods (Retained) ---

    def analyze(self):
        """Main analysis entry point."""
        files = self._find_files()
        self.emit_progress(
            "scanning",
            15,
            f"Scan complete: {len(files)} files after excludes",
        )
        self.logger.info(f"Scan complete: {len(files)} files after excludes")

        # PASS 1: Collect all files first (so we know what exists)
        for file_path in files:
            rel_path = self._get_relpath(file_path)
            category = self._categorize(file_path)
            self.file_types[rel_path] = category
            self.file_graph[rel_path] = []

        self.emit_progress("registering", 30, "File registration complete")
        self.logger.info(f"Pass 1 complete: {len(self.file_types)} files registered")

        # PASS 2: Now resolve dependencies (all files are known)
        for file_path in files:
            rel_path = self._get_relpath(file_path)
            deps = self._detect_dependencies(file_path)
            for dep in deps:
                resolved = self._resolve_path(file_path, dep)
                if resolved:
                    # Logic: Add local files OR external virtual nodes
                    if resolved in self.file_types or resolved.startswith("ext:"):
                        if resolved not in self.file_types:
                            # Register the external node with safe defaults
                            self.file_types[resolved] = "External"
                            self.file_graph[resolved] = []
                            # Add safe metadata for the frontend
                            if not hasattr(self, 'file_data'): self.file_data = {}
                            self.file_data[resolved] = {
                                "category": "External",
                                "size": "0KB",
                                "mtime": 0,
                                "ctime": 0,
                                "inboundCount": 0,
                                "outboundCount": 0,
                                "chainDepth": 1,
                                "isUnused": False,
                                "cycleParticipation": 0
                            }
                        
                        self.file_graph[rel_path].append(resolved)

        self.emit_progress(
            "dependencies", 55, "Dependency graph built and connections resolved"
        )
        self.logger.info("Dependency graph built; analyzing connectivity")
        self._analyze_connectivity(files)

        # Calculate health score, stats, etc., and return a complete JSON-ready dictionary
        self.logger.info("Generating analysis report")
        return self.generate_analysis_report()

    def _find_files(self):
        """Find all relevant files in the project."""
        found = []
        # Use config-driven exclusions merged with any passed excluded_folders
        all_excludes = self.excluded_dirs | set(self.excluded_folders)
        # Use config-driven extension exclusions for large file skipping
        skip_large_exts = self.excluded_extensions
        # Use config-driven file size limit
        max_size_bytes = self.max_file_size_bytes
        log_every = 500
        seen = 0
        for root, dirs, files in os.walk(self.project_dir):
            dirs[:] = [d for d in dirs if d not in all_excludes]

            for filename in files:
                ext = Path(filename).suffix.lower()
                self.found_extensions.add(ext if ext else "(no extension)")

                if (
                    self.include_all
                    or ext in self.extensions_to_find
                    or filename.lower() in self.extensions_to_find
                ):
                    fp = Path(root) / filename
                    try:
                        if (
                            ext in skip_large_exts
                            and fp.stat().st_size > max_size_bytes
                        ):
                            continue
                    except Exception:
                        pass
                    found.append(fp)
                    seen += 1
                    if seen % log_every == 0:
                        self.logger.info(
                            f"Scanning... {seen} files queued (dir={root})"
                        )

        return found

    def _get_relpath(self, file_path):
        """Get normalized relative path."""
        return str(Path(file_path).relative_to(self.project_dir)).replace("\\", "/")

    def _categorize(self, file_path):
        """Categorize a file by extension."""
        if str(file_path).startswith("ext:"):
            return "External"
            
        filename = Path(file_path).name
        ext = Path(file_path).suffix.lower()

        if filename in self.all_categories:
            return self.all_categories[filename]
        elif ext in self.all_categories:
            return self.all_categories[ext]
        else:
            self.unfamiliar_extensions.add(ext)
            return "Unfamiliar"

    def _detect_dependencies(self, file_path):
        """Detect dependencies based on file type."""
        ext = Path(file_path).suffix.lower()

        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except:
            return []

        # Map extensions to config parser keys
        ext_to_parser_key = {
            ".java": "java",
            ".jav": "java",
            ".j": "java",
            ".cs": "csharp",
            ".cshtml": "csharp",
            ".csx": "csharp",
            ".c": "c",
            ".cpp": "cpp",
            ".cc": "cpp",
            ".cxx": "cpp",
            ".c++": "cpp",
            ".cp": "cpp",
            ".h": "cpp",
            ".hpp": "cpp",
            ".hxx": "cpp",
            ".hh": "cpp",
            ".h++": "cpp",
            ".inl": "cpp",
            ".tpp": "cpp",
            ".tcc": "cpp",
            ".inc": "cpp",
            ".go": "go",
            ".rs": "rust",
            ".php": "php",
            ".phtml": "php",
            ".php3": "php",
            ".php4": "php",
            ".php5": "php",
        }

        # Check if we have custom regex parsers for this extension
        parser_key = ext_to_parser_key.get(ext)
        custom_parsers = self.config.get("custom_regex_parsers", {})

        if parser_key and parser_key in custom_parsers:
            # Use config-driven parsing
            imports = self._apply_custom_parsers(
                content, custom_parsers[parser_key], parser_key
            )
            if imports:
                return imports
            # Fall through to hardcoded if config parsing returned nothing

        # Hardcoded fallbacks (original behavior)
        if ext == ".py":
            return self._detect_python_imports(content)
        elif ext in [".js", ".jsx", ".ts", ".tsx", ".cjs"]:
            return self._detect_js_imports(content)
        elif ext in [".java", ".jav"]:
            return self._detect_java_imports(content)
        elif ext == ".cs":
            return self._detect_csharp_imports(content)
        elif ext in [
            ".c",
            ".cpp",
            ".cc",
            ".cxx",
            ".h",
            ".hpp",
            ".hxx",
            ".hh",
            ".inl",
            ".tpp",
            ".tcc",
        ]:
            return self._detect_cpp_includes(content)
        elif ext == ".go":
            return self._detect_go_imports(content)
        elif ext == ".rs":
            return self._detect_rust_imports(content)
        elif ext in [".php", ".phtml", ".php3", ".php4", ".php5"]:
            return self._detect_php_dependencies(content)
        elif ext in [".html", ".htm"]:
            return self._detect_html_refs(content)
        elif ext in [".css", ".scss"]:
            return self._detect_css_refs(content)
        elif ext == ".json":
            return self._detect_json_refs(content)
        else:
            return []

    def _apply_custom_parsers(self, content, parsers, lang_key):
        """
        Apply custom regex parsers from config to extract imports.
        Returns list of resolved import paths.
        """
        imports = []

        for parser in parsers:
            pattern = parser.get("regex_pattern")
            if not pattern:
                continue

            is_multiline = parser.get("is_multiline", False)
            capture_group = parser.get("capture_group", 1)
            pattern_name = parser.get("pattern_name", "unknown")

            flags = re.MULTILINE if is_multiline else 0

            try:
                matches = re.findall(pattern, content, flags)

                for match in matches:
                    # Handle tuple results from multiple capture groups
                    if isinstance(match, tuple):
                        if capture_group <= len(match):
                            raw_import = match[capture_group - 1]
                        else:
                            raw_import = match[0] if match else ""
                    else:
                        raw_import = match

                    if not raw_import or not raw_import.strip():
                        continue

                    # Convert raw import to file path based on language
                    resolved = self._convert_import_to_path(
                        raw_import.strip(), lang_key, pattern_name
                    )
                    if resolved:
                        if isinstance(resolved, list):
                            imports.extend(resolved)
                        else:
                            imports.append(resolved)

            except re.error as e:
                self.logger.warning(f"Invalid regex pattern '{pattern_name}': {e}")
                continue

        return imports

    def _convert_import_to_path(self, raw_import, lang_key, pattern_name):
        """
        Convert a raw import string to a file path based on language conventions.
        """
        if not raw_import:
            return None

        if lang_key == "java":
            # com.example.Class -> com/example/Class.java
            path = raw_import.replace(".", "/")
            if path.endswith("/*"):
                return path[:-2]  # Package directory
            return path + ".java"

        elif lang_key == "csharp":
            # System.Collections.Generic -> System/Collections/Generic.cs
            return raw_import.replace(".", "/") + ".cs"

        elif lang_key in ["c", "cpp"]:
            # Already a path (e.g., "myheader.h" or <iostream>)
            return raw_import

        elif lang_key == "go":
            if pattern_name == "block_import":
                # This is the full block content, need to extract individual imports
                block_imports = re.findall(r'(?:[\w._]\s+)?"([^"]+)"', raw_import)
                return block_imports if block_imports else None
            # Single import path
            return raw_import

        elif lang_key == "rust":
            if pattern_name == "mod_declaration":
                # mod foo -> foo.rs or foo/mod.rs
                return [raw_import + ".rs", raw_import + "/mod.rs"]
            # std::collections::HashMap -> std/collections/HashMap.rs
            return raw_import.replace("::", "/") + ".rs"

        elif lang_key == "php":
            # App\Utils\Logger -> App/Utils/Logger.php
            return raw_import.replace("\\", "/") + ".php"

        return raw_import

    def _detect_python_imports(self, content):
        """Detect Python imports."""
        imports = []
        try:
            tree = ast.parse(content)
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        imports.append(alias.name.replace(".", "/") + ".py")
                elif isinstance(node, ast.ImportFrom) and node.module:
                    imports.append(node.module.replace(".", "/") + ".py")
        except:
            pass
        return imports

    def _detect_js_imports(self, content):
        """Detect JavaScript/TypeScript imports."""
        imports = []
        imports.extend(re.findall(r"import\s+.*?\s+from\s+['\"](.+?)['\"]", content))
        imports.extend(re.findall(r"require\(['\"](.+?)['\"]\)", content))
        imports.extend(re.findall(r"import\(['\"](.+?)['\"]\)", content))
        return imports

    def _detect_java_imports(self, content):
        """
        Detect Java imports including standard, wildcard, and static imports.
        Converts FQN to file path format.
        """
        imports = []
        # Standard and wildcard imports: import com.example.ClassName;
        standard_imports = re.findall(
            r"^\s*import\s+([\w\.\*]+);", content, re.MULTILINE
        )
        for imp in standard_imports:
            # Convert package.Class to package/Class.java (strip wildcard for resolution)
            path = imp.replace(".", "/")
            if path.endswith("/*"):
                # Wildcard import - point to package directory
                imports.append(path[:-2])
            else:
                imports.append(path + ".java")

        # Static imports: import static com.example.ClassName.methodName;
        static_imports = re.findall(
            r"^\s*import\s+static\s+([\w\.\*]+);", content, re.MULTILINE
        )
        for imp in static_imports:
            # Static imports reference a class, extract class path (everything before last dot)
            parts = imp.rsplit(".", 1)
            if len(parts) > 1:
                class_path = parts[0].replace(".", "/") + ".java"
                imports.append(class_path)

        return imports

    def _detect_csharp_imports(self, content):
        """
        Detect C# using directives including global, static, and aliased.
        Converts namespace to potential file path.
        """
        imports = []

        # Standard namespace imports: using System.Collections.Generic;
        # Also handles: global using, using static
        namespace_imports = re.findall(
            r"^\s*(?:global\s+)?using\s+(?:static\s+)?([\w\.]+);", content, re.MULTILINE
        )
        for ns in namespace_imports:
            # Convert Namespace.Class to Namespace/Class.cs
            path = ns.replace(".", "/") + ".cs"
            imports.append(path)

        # Alias directives: using Alias = Namespace.Class;
        alias_imports = re.findall(
            r"^\s*(?:global\s+)?using\s+\w+\s*=\s*([\w\.]+);", content, re.MULTILINE
        )
        for ns in alias_imports:
            path = ns.replace(".", "/") + ".cs"
            imports.append(path)

        return imports

    def _detect_cpp_includes(self, content):
        """
        Detect C/C++ #include directives for both angled and quoted forms.
        Handles system headers (<...>) and local headers ("...").
        """
        includes = []

        # Angled brackets: #include <iostream> - system/library headers
        # These typically won't resolve to local files but we track them for completeness
        angled_includes = re.findall(
            r"^\s*#\s*include\s*<([^>]+)>", content, re.MULTILINE
        )
        for inc in angled_includes:
            # System headers - keep as-is, may or may not resolve locally
            includes.append(inc)

        # Quoted includes: #include "myheader.h" - local/project headers
        # These are more likely to resolve to actual project files
        quoted_includes = re.findall(
            r'^\s*#\s*include\s*"([^"]+)"', content, re.MULTILINE
        )
        for inc in quoted_includes:
            # Local headers - keep path as specified
            includes.append(inc)

        return includes

    def _detect_go_imports(self, content):
        """
        Detect Go import statements including single-line and block formats.
        Handles: import "fmt", import ( "fmt" "os" ), and aliased imports.
        """
        imports = []

        # Single-line imports: import "fmt" or import alias "path/to/pkg"
        single_imports = re.findall(
            r'^\s*import\s+(?:\w+\s+)?"([^"]+)"', content, re.MULTILINE
        )
        imports.extend(single_imports)

        # Block imports: import ( "fmt" \n "os" )
        # First, find all import blocks
        block_matches = re.findall(r"import\s*\(\s*([\s\S]*?)\s*\)", content)
        for block in block_matches:
            # Extract individual imports from within the block
            # Handles: "fmt", alias "path/pkg", . "pkg", _ "pkg"
            block_imports = re.findall(r'(?:[\w._]\s+)?"([^"]+)"', block)
            imports.extend(block_imports)

        # Convert import paths to potential file paths
        # Go imports like "github.com/user/repo/pkg" -> keep as-is for now
        # Local imports like "./utils" -> resolve relatively
        return imports

    def _detect_rust_imports(self, content):
        """
        Detect Rust use statements including simple and grouped imports.
        Handles: use std::io, use std::{io, fs}, use crate::module.
        """
        imports = []

        # Simple use statements: use std::collections::HashMap;
        simple_uses = re.findall(
            r"^\s*use\s+([\w:]+)(?:\s+as\s+\w+)?;", content, re.MULTILINE
        )
        for use_path in simple_uses:
            # Convert std::collections::HashMap to std/collections/HashMap.rs
            # But also handle crate:: and super:: prefixes
            file_path = use_path.replace("::", "/") + ".rs"
            imports.append(file_path)

        # Grouped use statements: use std::{io, fs, collections::HashMap};
        grouped_uses = re.findall(
            r"^\s*use\s+([\w:]+)::\{([^\}]+)\};", content, re.MULTILINE
        )
        for base_path, group in grouped_uses:
            # Split the group by comma and process each item
            items = [item.strip() for item in group.split(",")]
            for item in items:
                # Handle nested paths like collections::HashMap
                item = item.split(" as ")[0].strip()  # Remove 'as alias' if present
                if item:
                    full_path = base_path + "::" + item
                    file_path = full_path.replace("::", "/") + ".rs"
                    imports.append(file_path)

        # Also detect mod declarations which indicate submodule files
        mod_declarations = re.findall(
            r"^\s*(?:pub\s+)?mod\s+(\w+);", content, re.MULTILINE
        )
        for mod_name in mod_declarations:
            # mod foo; means either foo.rs or foo/mod.rs exists
            imports.append(mod_name + ".rs")
            imports.append(mod_name + "/mod.rs")

        return imports

    def _detect_php_dependencies(self, content):
        """
        Detect PHP dependencies including modern namespace 'use' statements
        and traditional include/require statements.
        Follows PSR-4 conventions for namespace-to-path conversion.
        """
        imports = []

        # Modern namespace use statements: use App\Utils\Logger;
        # Also handles: use App\Utils\Logger as Log;
        namespace_uses = re.findall(
            r"^\s*use\s+([\w\\]+)(?:\s+as\s+\w+)?;", content, re.MULTILINE
        )
        for ns in namespace_uses:
            # Convert namespace to PSR-4 style path: App\Utils\Logger -> App/Utils/Logger.php
            path = ns.replace("\\", "/") + ".php"
            imports.append(path)

        # Grouped use statements: use App\Models\{User, Post, Comment};
        grouped_uses = re.findall(
            r"^\s*use\s+([\w\\]+)\\\{([^\}]+)\};", content, re.MULTILINE
        )
        for base_ns, group in grouped_uses:
            items = [item.strip() for item in group.split(",")]
            for item in items:
                # Remove 'as Alias' if present
                item = item.split(" as ")[0].strip()
                if item:
                    full_ns = base_ns + "\\" + item
                    path = full_ns.replace("\\", "/") + ".php"
                    imports.append(path)

        # Traditional include/require statements (static paths only)
        # Handles: require 'file.php', include "path/to/file.php"
        # require_once, include_once variants
        include_patterns = [
            r"^\s*(?:require|include)(?:_once)?\s*\(\s*['\"]([^'\"]+)['\"]\s*\)",
            r"^\s*(?:require|include)(?:_once)?\s+['\"]([^'\"]+)['\"]",
        ]

        for pattern in include_patterns:
            matches = re.findall(pattern, content, re.MULTILINE)
            for match in matches:
                # Filter out dynamic paths (containing variables like $var)
                if not match.startswith("$") and "$" not in match:
                    imports.append(match)

        return imports

    def _detect_html_refs(self, content):
        """Detect HTML script/link/img references."""
        refs = []
        refs.extend(
            re.findall(r'<script[^>]+src=["\'](.+?)["\']', content, re.IGNORECASE)
        )
        refs.extend(
            re.findall(r'<link[^>]+href=["\'](.+?)["\']', content, re.IGNORECASE)
        )
        refs.extend(re.findall(r'<img[^>]+src=["\'](.+?)["\']', content, re.IGNORECASE))
        return [r for r in refs if not r.startswith(("http://", "https://", "//"))]

    def _detect_css_refs(self, content):
        """Detect CSS @import and url() references."""
        refs = []
        refs.extend(re.findall(r'@import\s+["\'](.+?)["\']', content))
        refs.extend(re.findall(r'url\(["\']?(.+?)["\']?\)', content))
        return [r for r in refs if not r.startswith(("http://", "https://", "data:"))]

    def _detect_json_refs(self, content):
        """Detect JSON file references."""
        refs = []
        try:
            data = json.loads(content)

            def extract_refs(obj):
                if isinstance(obj, dict):
                    for key, value in obj.items():
                        if key.lower() in ["main", "file", "path", "src", "entry"]:
                            if isinstance(value, str) and not value.startswith("http"):
                                refs.append(value)
                        extract_refs(value)
                elif isinstance(obj, list):
                    for item in obj:
                        extract_refs(item)

            extract_refs(data)
        except:
            pass
        return refs

    def _resolve_path(self, from_file, ref_str):
        """Resolve a reference string to an actual file path."""
        if not ref_str:
            return None

        # Capture external packages (no ./ or ../ prefix and no extension)
        if (
            not ref_str.startswith(".")
            and "/" not in ref_str
            and not Path(ref_str).suffix
        ):
            return f"ext:{ref_str}"  # Virtual external node

        current_dir = Path(from_file).parent
        candidates = []

        # Handle relative paths first
        if ref_str.startswith("./") or ref_str.startswith("../"):
            try:
                resolved = (current_dir / ref_str).resolve()
                candidates.append(resolved)
            except:
                pass

        # Add direct candidates
        candidates.extend([current_dir / ref_str, self.project_dir / ref_str])

        # Try with extensions if no suffix
        extensions = [".ts", ".tsx", ".js", ".jsx", ".json", ".py", ".cjs", ".mjs"]
        if not Path(ref_str).suffix:
            for ext in extensions:
                candidates.append(current_dir / (ref_str + ext))
                candidates.append(self.project_dir / (ref_str + ext))

            # Try index files (critical for folder imports)
            for ext in extensions:
                candidates.append(current_dir / ref_str / f"index{ext}")
                candidates.append(self.project_dir / ref_str / f"index{ext}")

        for candidate in candidates:
            try:
                if candidate.exists() and candidate.is_relative_to(self.project_dir):
                    return self._get_relpath(candidate)
            except:
                pass

        return None

    def _analyze_connectivity(self, files):
        """Analyze asset connectivity - find missing assets and orphaned files."""
        asset_patterns = [
            (r'<img[^>]+src=["\'](.*?)["\']', ["html", "jsx", "tsx", "js", "ts"]),
            (r'url\(["\']?(.*?)["\']?\)', ["css", "scss", "sass"]),
            (
                r'open\(["\']([^"\']+\.(?:png|jpg|jpeg|gif|svg|ico|pdf|csv|json|txt))["\']',
                ["py"],
            ),
            (
                r'from\s+["\']([^"\']+\.(?:png|jpg|jpeg|gif|svg|ico))["\']',
                ["js", "jsx", "ts", "tsx"],
            ),
            (
                r'require\(["\']([^"\']+\.(?:png|jpg|jpeg|gif|svg|ico))["\']',
                ["js", "jsx", "ts", "tsx"],
            ),
            (r'url\(["\']?([^"\']+\.(?:woff|woff2|ttf|eot))["\']?\)', ["css", "scss"]),
        ]

        all_existing_files = set(self.file_types.keys())
        referenced_files = set()

        for file_path in files:
            rel_path = self._get_relpath(file_path)
            category = self.file_types.get(rel_path)

            if category in ["Image", "Video", "Audio", "Font", "Archive"]:
                continue

            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()

                file_refs = []

                for pattern, applicable_types in asset_patterns:
                    if not any(
                        ext in str(file_path).lower() for ext in applicable_types
                    ):
                        continue

                    matches = re.findall(pattern, content)
                    for match in matches:
                        asset_ref = match.strip()
                        if not asset_ref or asset_ref.startswith("http"):
                            continue

                        resolved = self._resolve_asset_path(file_path, asset_ref)

                        if resolved:
                            referenced_files.add(resolved)
                            file_refs.append(asset_ref)

                            if resolved not in all_existing_files:
                                if rel_path not in self.missing_assets:
                                    self.missing_assets[rel_path] = []
                                self.missing_assets[rel_path].append(asset_ref)

                if file_refs:
                    self.asset_references[rel_path] = file_refs

            except Exception:
                pass

        for deps in self.file_graph.values():
            referenced_files.update(deps)

        self.orphaned_files = all_existing_files - referenced_files

        imported_files = set()
        for deps in self.file_graph.values():
            imported_files.update(deps)

        entry_points = all_existing_files - imported_files

        self.orphaned_files = self.orphaned_files - entry_points

    def _resolve_asset_path(self, from_file, asset_ref):
        """Resolve an asset reference to a file path."""
        if not asset_ref:
            return None

        current_dir = Path(from_file).parent
        candidates = [
            current_dir / asset_ref,
            self.project_dir / asset_ref,
        ]

        if asset_ref.startswith("./") or asset_ref.startswith("../"):
            try:
                resolved = (current_dir / asset_ref).resolve()
                candidates.append(resolved)
            except:
                pass

        for asset_dir in ["assets", "images", "img", "static", "public", "media"]:
            candidates.append(self.project_dir / asset_dir / asset_ref)

        for candidate in candidates:
            try:
                if candidate.exists() and candidate.is_relative_to(self.project_dir):
                    return self._get_relpath(candidate)
            except:
                pass

        return None

    def _get_node_color(self, category):
        """Retrieve color from config, falling back to defaults."""
        if category in self.dynamic_category_colors:
            return self.dynamic_category_colors[category]
        if "Default" in self.dynamic_category_colors:
            return self.dynamic_category_colors["Default"]
        return "lightgray"

    def build_graph(self, is_dark_theme=False, graph_format="png", output_dir="."):
        """Builds and renders the Graphviz diagram."""
        output_dir_path = Path(output_dir)
        try:
            output_dir_path.mkdir(parents=True, exist_ok=True)
        except Exception:
            output_dir_path = Path(".")

        dot = graphviz.Digraph(comment="Project Architecture")
        dot.attr(rankdir="LR", splines="ortho", concentrate="true")

        # Apply theme
        if is_dark_theme:
            dot.attr(bgcolor="#1e1e1e")
            dot.attr("node", shape="box", style="rounded,filled", fontcolor="white")
            dot.attr("edge", color="#e0e0e0")
        else:
            dot.attr(bgcolor="white")
            dot.attr("node", shape="box", style="rounded,filled", fontcolor="black")
            dot.attr("edge", color="black")

        for file, file_type in self.file_types.items():
            label = Path(file).name
            color = self._get_node_color(file_type)
            # Sanitize ID for Graphviz (replace colons with underscores)
            safe_id = file.replace(":", "_")
            dot.node(f'"{safe_id}"', label, fillcolor=color, fontcolor="black")

        for file, deps in self.file_graph.items():
            safe_source = file.replace(":", "_")
            for dep in deps:
                if dep in self.file_types:
                    safe_target = dep.replace(":", "_")
                    dot.edge(f'"{safe_source}"', f'"{safe_target}"')

        output_path = output_dir_path / "project_architecture"
        dot.render(str(output_path), format=graph_format, cleanup=True)
        return f"{output_path}.{graph_format}"

    # --- Metrics and Report Methods (Retained for JSON/MD/HTML Exports) ---

    def _detect_circular_dependencies(self, graph):
        """Detect circular dependencies in the graph."""
        cycles = []
        visited = set()
        rec_stack = []

        def dfs(node, path):
            if node in rec_stack:
                cycle_start = rec_stack.index(node)
                cycle = rec_stack[cycle_start:] + [node]
                if len(cycle) <= 5 and cycle not in cycles:
                    cycles.append(cycle)
                return

            if node in visited:
                return

            visited.add(node)
            rec_stack.append(node)

            for neighbor in graph.get(node, []):
                dfs(neighbor, path + [neighbor])

            rec_stack.pop()

        for node in graph:
            if node not in visited:
                dfs(node, [node])

        return cycles[:10]

    def _calculate_max_chain_depth(self, graph):
        """Calculate the maximum dependency chain depth."""

        def get_depth(node, visited):
            if node in visited:
                return 0

            visited.add(node)
            deps = graph.get(node, [])

            if not deps:
                return 1

            max_depth = 0
            for dep in deps:
                depth = get_depth(dep, visited.copy())
                max_depth = max(max_depth, depth)

            return max_depth + 1

        max_depth = 0
        for node in graph:
            depth = get_depth(node, set())
            max_depth = max(max_depth, depth)

        return max_depth

    def _calculate_chain_depths(self, graph):
        """Calculate per-node dependency chain depth (longest path from node)."""
        memo = {}
        visiting = set()

        def dfs(node):
            if node in memo:
                return memo[node]
            if node in visiting:
                return 0
            visiting.add(node)
            deps = graph.get(node, [])
            if not deps:
                depth = 1
            else:
                depth = 1 + max((dfs(dep) for dep in deps), default=0)
            visiting.remove(node)
            memo[node] = depth
            return depth

        for node in graph:
            dfs(node)
        return memo

    def _calculate_connectivity_score(self, analyzer):
        """Calculate connectivity health score (0-100)."""
        total_files = len(analyzer.file_types)
        if total_files == 0:
            return 100

        missing_penalty = len(analyzer.missing_assets) * 10
        unused_penalty = len(analyzer.orphaned_files) * 2

        score = 100 - missing_penalty - unused_penalty
        return max(0, min(100, score))

    def _detect_frameworks(self, file_types):
        """Detect frameworks used in the project."""
        frameworks = set()
        files = list(file_types.keys())
        types = list(file_types.values())

        if "React" in types or "TypeScript React" in types:
            frameworks.add("React")
        if any("vue" in f.lower() for f in files):
            frameworks.add("Vue")
        if any("angular" in f.lower() for f in files):
            frameworks.add("Angular")
        if any("django" in f.lower() or "manage.py" in f for f in files):
            frameworks.add("Django")
        if any("flask" in f.lower() or "app.py" in f for f in files):
            frameworks.add("Flask")
        if any("express" in f.lower() or "server.js" in f for f in files):
            frameworks.add("Express")
        if "package.json" in files:
            frameworks.add("npm/Node.js")
        if "requirements.txt" in files or "setup.py" in files:
            frameworks.add("Python")

        # Detect Tauri
        if any("src-tauri/tauri.conf.json" in f for f in files):
            # Check if Tauri 2
            tauri_conf_path = self.project_dir / "src-tauri" / "tauri.conf.json"
            if tauri_conf_path.exists():
                try:
                    with open(tauri_conf_path, "r", encoding="utf-8") as f:
                        tauri_conf = json.load(f)
                    schema = tauri_conf.get("$schema", "")
                    if "schema.tauri.app/config/2" in schema:
                        frameworks.add("Tauri 2")
                    else:
                        frameworks.add("Tauri 1.x")
                except Exception:
                    frameworks.add("Tauri")

        return sorted(list(frameworks))

    def _detect_project_type(self, file_types, entry_points):
        """Detect the type of project."""
        types = list(file_types.values())
        files = list(file_types.keys())

        has_html = "HTML" in types
        has_js = any(t in types for t in ["JavaScript", "TypeScript", "React"])
        has_python = "Python" in types
        has_css = any(t in types for t in ["CSS", "SCSS"])

        if has_html and has_js and has_css:
            return "Full-stack Web Application"
        elif has_js and not has_html:
            return "Node.js Application/Library"
        elif has_python and not has_html:
            return (
                "Python Library/Package"
                if any("test" in f.lower() for f in files)
                else "Python Application"
            )
        elif has_html and has_css and not has_js:
            return "Static Website"
        else:
            return "Mixed/Unknown"

    def _check_tauri_permissions(self):
        """
        Check Tauri 2 projects for permission/capability issues.
        Returns list of health warnings for Tauri-specific problems.
        """
        warnings = []

        # Skip if Tauri checks are disabled in config
        if not self.tauri_enabled:
            return warnings

        # Check if this is a Tauri 2 project
        tauri_conf_path = self.project_dir / "src-tauri" / "tauri.conf.json"
        if not tauri_conf_path.exists():
            return warnings  # Not a Tauri project

        try:
            with open(tauri_conf_path, "r", encoding="utf-8") as f:
                tauri_conf = json.load(f)
        except Exception as e:
            warnings.append(
                {
                    "type": "tauri_config_error",
                    "file": "src-tauri/tauri.conf.json",
                    "reason": f"Failed to parse tauri.conf.json: {e}",
                    "severity": "high",
                }
            )
            return warnings

        # Check if Tauri 2 (has schema v2)
        schema = tauri_conf.get("$schema", "")
        is_tauri_2 = "schema.tauri.app/config/2" in schema

        if not is_tauri_2:
            return warnings  # Tauri 1.x doesn't need these checks

        # Get windows from config
        app_config = tauri_conf.get("app", {})
        windows = app_config.get("windows", [])
        window_labels = [w.get("label", "main") for w in windows]

        # Check for withGlobalTauri setting
        has_global_tauri = app_config.get("withGlobalTauri", False)

        # Find static HTML files that use Tauri IPC
        static_html_with_tauri = []
        for file_path, category in self.file_types.items():
            if category == "HTML" and "public/" in file_path:
                full_path = self.project_dir / file_path
                try:
                    with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()

                    # Check for Tauri IPC usage patterns
                    uses_tauri = any(
                        pattern in content
                        for pattern in [
                            "window.__TAURI__",
                            "__TAURI__",
                            "@tauri-apps/api",
                            "invoke(",
                            ".listen(",
                            ".emit(",
                        ]
                    )

                    if uses_tauri:
                        static_html_with_tauri.append(file_path)
                except Exception:
                    pass

        # Warn if static HTML uses Tauri but withGlobalTauri not set
        if static_html_with_tauri and not has_global_tauri:
            warnings.append(
                {
                    "type": "tauri_missing_global_tauri",
                    "files": static_html_with_tauri,
                    "reason": "Static HTML files use window.__TAURI__ but 'withGlobalTauri: true' not set in app config. IPC calls will fail.",
                    "fix": "Add '\"withGlobalTauri\": true' to app section of tauri.conf.json",
                    "severity": "high",
                }
            )

        # Check capabilities
        capabilities_dir = self.project_dir / "src-tauri" / "capabilities"
        if not capabilities_dir.exists():
            warnings.append(
                {
                    "type": "tauri_no_capabilities",
                    "reason": "Tauri 2 project missing capabilities directory. Windows may lack required permissions.",
                    "fix": "Create src-tauri/capabilities/default.json with required permissions",
                    "severity": "medium",
                }
            )
        else:
            # Parse capabilities and check coverage
            capabilities = {}
            for cap_file in capabilities_dir.glob("*.json"):
                try:
                    with open(cap_file, "r", encoding="utf-8") as f:
                        cap_data = json.load(f)
                    cap_name = cap_data.get("identifier", cap_file.stem)
                    capabilities[cap_name] = cap_data
                except Exception:
                    pass

            # Check if all windows are covered by capabilities
            covered_windows = set()
            all_permissions = set()
            for cap_name, cap_data in capabilities.items():
                cap_windows = cap_data.get("windows", [])
                covered_windows.update(cap_windows)
                all_permissions.update(cap_data.get("permissions", []))

            uncovered = set(window_labels) - covered_windows
            if uncovered:
                warnings.append(
                    {
                        "type": "tauri_uncovered_windows",
                        "windows": list(uncovered),
                        "reason": f"Windows {list(uncovered)} not listed in any capability file. They may lack IPC access.",
                        "severity": "medium",
                    }
                )

            # Scan frontend for IPC usage and check permissions
            ipc_usage = self._scan_tauri_ipc_usage()

            # Check for missing event permissions
            if (
                ipc_usage.get("uses_listen")
                and "core:event:allow-listen" not in all_permissions
            ):
                warnings.append(
                    {
                        "type": "tauri_missing_permission",
                        "permission": "core:event:allow-listen",
                        "reason": "Frontend uses event.listen() but permission not granted in capabilities",
                        "severity": "high",
                    }
                )

            if (
                ipc_usage.get("uses_emit")
                and "core:event:allow-emit" not in all_permissions
            ):
                warnings.append(
                    {
                        "type": "tauri_missing_permission",
                        "permission": "core:event:allow-emit",
                        "reason": "Frontend uses event.emit() but permission not granted in capabilities",
                        "severity": "high",
                    }
                )

        return warnings

    def _scan_tauri_ipc_usage(self):
        """Scan frontend files for Tauri IPC usage patterns."""
        usage = {
            "uses_invoke": False,
            "uses_listen": False,
            "uses_emit": False,
            "invoke_commands": [],
            "listen_events": [],
        }

        frontend_extensions = [".ts", ".tsx", ".js", ".jsx", ".html"]

        for file_path, category in self.file_types.items():
            ext = Path(file_path).suffix.lower()
            if ext not in frontend_extensions:
                continue

            full_path = self.project_dir / file_path
            try:
                with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()

                # Check invoke usage
                if "invoke(" in content or ".invoke(" in content:
                    usage["uses_invoke"] = True
                    # Extract command names
                    invoke_matches = re.findall(r"invoke\(['\"](\w+)['\"]", content)
                    usage["invoke_commands"].extend(invoke_matches)

                # Check listen usage
                if ".listen(" in content or "listen(" in content:
                    usage["uses_listen"] = True
                    listen_matches = re.findall(r"listen\(['\"]([^'\"]+)['\"]", content)
                    usage["listen_events"].extend(listen_matches)

                # Check emit usage
                if ".emit(" in content or "emit(" in content:
                    usage["uses_emit"] = True

            except Exception:
                pass

        return usage

    def generate_analysis_report(self):
        """Compiles all analysis data into a single JSON-ready report."""
        self.emit_progress("report", 70, "Analysis report generated")
        total_files = len(self.file_types)
        total_connections = sum(len(deps) for deps in self.file_graph.values())

        # Calculate derived stats
        import_counts = {file: 0 for file in self.file_types.keys()}
        for deps in self.file_graph.values():
            for dep in deps:
                import_counts[dep] = import_counts.get(dep, 0) + 1

        imported_files = set(import_counts.keys())
        entry_points = [
            {"file": file, "category": self.file_types[file]}
            for file in self.file_types.keys()
            if file not in imported_files
        ]

        hub_files = sorted(import_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        hub_files = [
            {
                "file": file,
                "importedBy": count,
                "category": self.file_types.get(file, "Unknown"),
            }
            for file, count in hub_files
            if count > 0
        ]

        circular_deps = self._detect_circular_dependencies(self.file_graph)
        chain_depths = self._calculate_chain_depths(self.file_graph)

        cycle_participation = {file: 0 for file in self.file_types.keys()}
        cycles_payload = []
        for cycle in circular_deps:
            for file in cycle:
                cycle_participation[file] = cycle_participation.get(file, 0) + 1
            cycles_payload.append(
                {
                    "type": "circular_dependency",
                    "nodes": cycle,
                    "description": " -> ".join(cycle + [cycle[0]]),
                    "severity": "high",
                }
            )

        # Health warnings compilation
        health_warnings = []
        for cycle in circular_deps:
            health_warnings.append(
                {"type": "circular_dependency", "files": cycle, "severity": "high"}
            )
        for file, missing in self.missing_assets.items():
            health_warnings.append(
                {
                    "type": "missing_asset",
                    "file": file,
                    "missingAssets": missing,
                    "reason": f"{len(missing)} referenced asset(s) not found",
                    "severity": "high",
                }
            )
        for file in self.orphaned_files:
            health_warnings.append(
                {
                    "type": "unused_file",
                    "file": file,
                    "reason": "File exists but is never referenced",
                    "severity": "low",
                }
            )

        # Tauri 2 permission checks
        tauri_warnings = self._check_tauri_permissions()
        health_warnings.extend(tauri_warnings)

        # Build detailed file info
        detailed_files = {}
        for file, file_type in self.file_types.items():
            file_path = Path(self.project_dir) / file
            inbound_count = import_counts.get(file, 0)
            outbound_count = len(self.file_graph.get(file, []))
            depth_from_root = len(file.split("/")) - 1
            
            # Default metadata for all files (including external)
            file_info = {
                "category": file_type,
                "imports": self.file_graph.get(file, []),
                "importedBy": [
                    f for f, deps in self.file_graph.items() if file in deps
                ],
                "isEntryPoint": file in [ep["file"] for ep in entry_points],
                "dependencyCount": len(self.file_graph.get(file, [])),
                "isUnused": file in self.orphaned_files,
                "inboundCount": inbound_count,
                "outboundCount": outbound_count,
                "depthFromRoot": depth_from_root,
                "chainDepth": chain_depths.get(file, 1),
                "cycleParticipation": cycle_participation.get(file, 0),
                "mtime": 0,
                "size": "0KB",
                "signature": None
            }
            
            try:
                if not file.startswith("ext:") and file_path.exists():
                    stat = file_path.stat()
                    file_info["size"] = f"{stat.st_size / 1024:.1f}KB"
                    file_info["mtime"] = stat.st_mtime
                    file_info["ctime"] = stat.st_ctime
                    file_info["lastModified"] = datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat()
                    
                    if file_type not in ["Image", "Video", "Audio", "Font"]:
                        with open(
                            file_path, "r", encoding="utf-8", errors="ignore"
                        ) as f:
                            content = f.read()
                            file_info["lines"] = len(content.splitlines())
                            
                            # HUMAN TRACE: Scan for signatures
                            sig_match = re.search(r'(?i)(?:by|author|created\s+by|todo):\s*([A-Za-z\s]{3,20})', content)
                            if sig_match:
                                file_info["signature"] = sig_match.group(1).strip()
            except:
                pass
            detailed_files[file] = file_info

        # Build profile (dev footprint, shipping weight, dependencies)
        self.emit_progress("buildProfile", 80, "Analyzing build profile and dependencies")
        build_profile = analyze_build_profile(self.project_dir)

        # Final Report Data
        report = {
            "projectName": self.project_dir.name,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "buildProfile": build_profile,
            "summary": {
                "totalFiles": total_files,
                "totalConnections": total_connections,
                "languages": {
                    t: list(self.file_types.values()).count(t)
                    for t in set(self.file_types.values())
                },
                "detectedFrameworks": self._detect_frameworks(self.file_types),
                "projectType": self._detect_project_type(self.file_types, entry_points),
            },
            "entryPoints": entry_points,
            "hubFiles": hub_files,
            "healthWarnings": health_warnings,
            "cycles": cycles_payload,
            "brokenReferences": [
                {"file": file, "missingAssets": missing}
                for file, missing in self.missing_assets.items()
            ],
            "graphStats": {
                "totalNodes": total_files,
                "totalEdges": total_connections,
                "maxDepth": self._calculate_max_chain_depth(self.file_graph),
                "cycleCount": len(circular_deps),
                "isolatedNodes": len([f for f, deps in self.file_graph.items() if not deps and import_counts.get(f, 0) == 0]),
            },
            "statistics": {
                "avgDependenciesPerFile": (
                    round(total_connections / total_files, 2) if total_files > 0 else 0
                ),
                "maxDependencyChainDepth": self._calculate_max_chain_depth(
                    self.file_graph
                ),
                "circularDependencies": len(circular_deps),
                "unusedFiles": len(self.orphaned_files),
                "filesWithMissingAssets": len(self.missing_assets),
                "connectivityHealthScore": self._calculate_connectivity_score(self),
            },
            "files": detailed_files,
            "dependencyGraph": self.file_graph,
        }
        return report

    def _log(self, msg: str):
        pass


# --- Main Bridge Function ---
def analyze_project_cli(
    project_path,
    extensions_str,
    excluded_str,
    theme_name,
    format_name,
    progress_file_path=None,
):
    """
    Main entry point for the Electron/Node.js bridge.
    Receives JSON arguments, performs analysis, and prints result to stdout.
    """
    orig_stdout = sys.stdout
    # Force all non-JSON output to stderr to protect stdout for JSON only.
    sys.stdout = sys.stderr
    try:
        extensions = (
            [e.strip() for e in extensions_str.split(",") if e.strip()]
            if extensions_str
            else []
        )
        excluded = [f.strip() for f in excluded_str.split(",") if f.strip()]

        # Load configuration from codegnosis.config.json
        config = load_codegnosis_config(project_path)
        logger.info(
            f"Loaded config: {len(config.get('language_extensions', {}))} custom language extensions"
        )

        analyzer = AnalyzerCore(
            project_path,
            extensions,
            excluded_folders=excluded,
            config=config,
            progress_file_path=progress_file_path,
        )
        analyzer.logger.info("Starting analysis")
        report = analyzer.analyze()

        # Include config info in report for transparency
        report["configLoaded"] = bool(config.get("language_extensions"))

        # --- MULTIPLIER: Ghost Protocol (Compliance Scan) ---
        if ghost_protocol:
            # Ghost Protocol reads its own config internally from project_path
            compliance_report = ghost_protocol.perform_compliance_scan(report, project_path)
            analyzer.emit_progress("compliance", 85, "Compliance scan complete")
            report["complianceReport"] = compliance_report
        else:
            report["complianceReport"] = {}

        analyzer.logger.info(
            f"Analysis finished: {report['summary']['totalFiles']} files, "
            f"{report['summary']['totalConnections']} connections"
        )

        # Render graph for visualization (skip when above caps)
        is_dark = theme_name == "Dark"
        is_large = (
            report['summary']['totalFiles'] > 100
            or report['summary']['totalConnections'] > 200
        )
        graph_format = "svg" if is_large else "png"

        safe_graph_dir = Path(tempfile.gettempdir()) / "codegnosis_graphs"
        try:
            safe_graph_dir.mkdir(parents=True, exist_ok=True)
        except Exception:
            safe_graph_dir = Path(".")

        # Use config-driven caps (fallback to global constants)
        node_cap = (
            analyzer.max_graph_nodes
            if hasattr(analyzer, "max_graph_nodes")
            else GRAPH_NODE_CAP
        )
        edge_cap = (
            analyzer.max_graph_edges
            if hasattr(analyzer, "max_graph_edges")
            else GRAPH_EDGE_CAP
        )
        skip_graph = (
            report["summary"]["totalFiles"] > node_cap
            or report["summary"]["totalConnections"] > edge_cap
        )

        graph_path = None

        if skip_graph:
            analyzer.logger.info(
                f"Skipping graph render (cap hit; files={report['summary']['totalFiles']}, "
                f"connections={report['summary']['totalConnections']}, "
                f"caps={node_cap}/{edge_cap})"
            )
            analyzer.emit_progress(
                "visualization",
                95,
                "Graph render skipped due to size caps",
            )
        else:
            graph_path = analyzer.build_graph(
                is_dark_theme=is_dark,
                graph_format=graph_format,
                output_dir=str(safe_graph_dir),
            )
            analyzer.logger.info(f"Graph rendered to {graph_path}")
            analyzer.emit_progress(
                "visualization", 95, "Graph rendered for visualization"
            )

        report["graphImagePath"] = graph_path
        report["graphImageFormat"] = graph_format if graph_path else None
        if skip_graph:
            report["graphSkipReason"] = (
                "Graph skipped due to size cap; view JSON-only for this project."
            )

        # Write report to temp file to avoid IPC payload size limits
        result_file = Path(tempfile.gettempdir()) / "codegnosis_result.json"
        with open(result_file, "w", encoding="utf-8") as f:
            json.dump(report, f)

        analyzer.emit_progress("finalizing", 98, "Writing final report")
        # Return just the file path - frontend will read the file directly
        # Ensure we write ONLY JSON to stdout
        orig_stdout.write(json.dumps({"resultFile": str(result_file)}))
        orig_stdout.flush()

        # --- MULTIPLIER: AI Context Packaging ---
        if ai_packager:
            # Use consistent filename to overwrite instead of creating new files
            ai_bundle_name = f"ai_bundle_{report['projectName']}.txt"
            ai_bundle_path = Path(project_path) / ai_bundle_name
            ai_packager.package_for_ai(report, ai_bundle_path, project_path)

        analyzer.emit_progress("done", 100, "Analysis complete")

    except FileNotFoundError as e:
        sys.stderr.write(f"Project directory not found: {e}\n")
        orig_stdout.write(
            json.dumps({"error": "Project directory not found.", "details": str(e)})
        )
        orig_stdout.flush()
        sys.exit(1)
    except graphviz.backend.ExecutableNotFound:
        sys.stderr.write("Graphviz not installed.\n")
        orig_stdout.write(
            json.dumps(
                {
                    "error": "Graphviz not installed.",
                    "details": "Graphviz is required for visual chart generation.",
                }
            )
        )
        orig_stdout.flush()
        sys.exit(1)
    except Exception as e:
        import traceback
        sys.stderr.write(f"Analysis failed unexpectedly: {traceback.format_exc()}\n")
        orig_stdout.write(
            json.dumps(
                {
                    "error": "Analysis failed unexpectedly.",
                    "details": traceback.format_exc(),
                }
            )
        )
        orig_stdout.flush()
        sys.exit(1)
    finally:
        sys.stdout = orig_stdout


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="CodeGnosis Analyzer Core")
    parser.add_argument("project_path", help="Path to the project to analyze")
    parser.add_argument("extensions", help="Comma-separated extensions to include")
    parser.add_argument("excluded", help="Comma-separated folders to exclude")
    parser.add_argument("theme", help="Theme name (Dark/Light)")
    parser.add_argument("format", help="Output format (json)")
    parser.add_argument("--progress-file", help="Path to write progress JSON")
    
    args = parser.parse_args()
    
    analyze_project_cli(
        args.project_path,
        args.extensions,
        args.excluded,
        args.theme,
        args.format,
        args.progress_file
    )
