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
import base64
import platform
import time
import logging # Added import
import ai_packager
import ghost_protocol

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
            "forbidden_licenses": ["AGPL", "GPL", "LGPL"]
        },
        "custom_regex_parsers": {}
    }

    if not config_path.exists():
        return default_config

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            user_config = json.load(f)
        # Merge user config with defaults
        return {
            "language_extensions": user_config.get("language_extensions", {}),
            "compliance_checks": {
                **default_config["compliance_checks"],
                **user_config.get("compliance_checks", {})
            },
            "custom_regex_parsers": user_config.get("custom_regex_parsers", {})
        }
    except Exception as e:
        logging.warning(f"Could not load codegnosis.config.json: {e}")
        return default_config

# Configure logging to a file
LOG_FILE = Path(tempfile.gettempdir()) / "codegnosis_analyzer.log"
logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__) # Global logger instance

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
        self, directory, extensions_to_find, custom_categories={}, excluded_folders=[], config=None
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

        # Merge categories: MASTER_CATEGORIES < config language_extensions < custom_categories
        config_extensions = self.config.get("language_extensions", {})
        self.all_categories = {**self.MASTER_CATEGORIES, **config_extensions, **custom_categories}

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
        self.logger = logger # Use the global logger instance

    # --- Core Logic Methods (Retained) ---

    def analyze(self):
        """Main analysis entry point."""
        files = self._find_files()
        self.logger.info(f"Scan complete: {len(files)} files after excludes")

        for file_path in files:
            rel_path = self._get_relpath(file_path)
            category = self._categorize(file_path)

            self.file_types[rel_path] = category
            self.file_graph[rel_path] = []

            deps = self._detect_dependencies(file_path)
            for dep in deps:
                resolved = self._resolve_path(file_path, dep)
                if resolved and resolved in self.file_types:
                    self.file_graph[rel_path].append(resolved)

        self.logger.info("Dependency graph built; analyzing connectivity")
        self._analyze_connectivity(files)

        # Calculate health score, stats, etc., and return a complete JSON-ready dictionary
        self.logger.info("Generating analysis report")
        return self.generate_analysis_report()

    def _find_files(self):
        """Find all relevant files in the project."""
        found = []
        default_excludes = {
            ".git",
            "node_modules",
            "dist",
            "build",
            "target",
            "src-tauri/target",
            ".vite",
            ".svelte-kit",
            ".next",
            ".cache",
            ".parcel-cache",
            ".angular",
            ".turbo",
            ".yarn",
            ".pnpm-store",
            ".venv",
            "venv",
            "env",
            "tmp",
            "temp",
            "logs",
            "deps",
            ".output",
            "coverage",
            "bin",
            "obj",
            ".scannerwork",
            ".gradle",
            ".idea",
            ".vscode",
            "__pycache__",
        }
        all_excludes = set(self.excluded_folders) | default_excludes
        skip_large_exts = {
            ".png",
            ".jpg",
            ".jpeg",
            ".gif",
            ".webp",
            ".svg",
            ".ico",
            ".mp4",
            ".mp3",
            ".pdf",
            ".zip",
            ".tar",
            ".gz",
            ".7z",
            ".ttf",
            ".woff",
            ".woff2",
        }
        max_size_bytes = 5 * 1024 * 1024  # 5MB cap for scan
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
                        if ext in skip_large_exts and fp.stat().st_size > max_size_bytes:
                            continue
                    except Exception:
                        pass
                    found.append(fp)
                    seen += 1
                    if seen % log_every == 0:
                        self.logger.info(f"Scanning... {seen} files queued (dir={root})")

        return found

    def _get_relpath(self, file_path):
        """Get normalized relative path."""
        return str(Path(file_path).relative_to(self.project_dir)).replace("\\", "/")

    def _categorize(self, file_path):
        """Categorize a file by extension."""
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

        if ext == ".py":
            return self._detect_python_imports(content)
        elif ext in [".js", ".jsx", ".ts", ".tsx", ".cjs"]:
            return self._detect_js_imports(content)
        elif ext in [".java", ".jav"]:
            return self._detect_java_imports(content)
        elif ext == ".cs":
            return self._detect_csharp_imports(content)
        elif ext in [".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".hxx", ".hh", ".inl", ".tpp", ".tcc"]:
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
        standard_imports = re.findall(r'^\s*import\s+([\w\.\*]+);', content, re.MULTILINE)
        for imp in standard_imports:
            # Convert package.Class to package/Class.java (strip wildcard for resolution)
            path = imp.replace(".", "/")
            if path.endswith("/*"):
                # Wildcard import - point to package directory
                imports.append(path[:-2])
            else:
                imports.append(path + ".java")

        # Static imports: import static com.example.ClassName.methodName;
        static_imports = re.findall(r'^\s*import\s+static\s+([\w\.\*]+);', content, re.MULTILINE)
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
            r'^\s*(?:global\s+)?using\s+(?:static\s+)?([\w\.]+);',
            content,
            re.MULTILINE
        )
        for ns in namespace_imports:
            # Convert Namespace.Class to Namespace/Class.cs
            path = ns.replace(".", "/") + ".cs"
            imports.append(path)

        # Alias directives: using Alias = Namespace.Class;
        alias_imports = re.findall(
            r'^\s*(?:global\s+)?using\s+\w+\s*=\s*([\w\.]+);',
            content,
            re.MULTILINE
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
            r'^\s*#\s*include\s*<([^>]+)>',
            content,
            re.MULTILINE
        )
        for inc in angled_includes:
            # System headers - keep as-is, may or may not resolve locally
            includes.append(inc)

        # Quoted includes: #include "myheader.h" - local/project headers
        # These are more likely to resolve to actual project files
        quoted_includes = re.findall(
            r'^\s*#\s*include\s*"([^"]+)"',
            content,
            re.MULTILINE
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
            r'^\s*import\s+(?:\w+\s+)?"([^"]+)"',
            content,
            re.MULTILINE
        )
        imports.extend(single_imports)

        # Block imports: import ( "fmt" \n "os" )
        # First, find all import blocks
        block_matches = re.findall(
            r'import\s*\(\s*([\s\S]*?)\s*\)',
            content
        )
        for block in block_matches:
            # Extract individual imports from within the block
            # Handles: "fmt", alias "path/pkg", . "pkg", _ "pkg"
            block_imports = re.findall(
                r'(?:[\w._]\s+)?"([^"]+)"',
                block
            )
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
            r'^\s*use\s+([\w:]+)(?:\s+as\s+\w+)?;',
            content,
            re.MULTILINE
        )
        for use_path in simple_uses:
            # Convert std::collections::HashMap to std/collections/HashMap.rs
            # But also handle crate:: and super:: prefixes
            file_path = use_path.replace("::", "/") + ".rs"
            imports.append(file_path)

        # Grouped use statements: use std::{io, fs, collections::HashMap};
        grouped_uses = re.findall(
            r'^\s*use\s+([\w:]+)::\{([^\}]+)\};',
            content,
            re.MULTILINE
        )
        for base_path, group in grouped_uses:
            # Split the group by comma and process each item
            items = [item.strip() for item in group.split(',')]
            for item in items:
                # Handle nested paths like collections::HashMap
                item = item.split(' as ')[0].strip()  # Remove 'as alias' if present
                if item:
                    full_path = base_path + "::" + item
                    file_path = full_path.replace("::", "/") + ".rs"
                    imports.append(file_path)

        # Also detect mod declarations which indicate submodule files
        mod_declarations = re.findall(
            r'^\s*(?:pub\s+)?mod\s+(\w+);',
            content,
            re.MULTILINE
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
            r'^\s*use\s+([\w\\]+)(?:\s+as\s+\w+)?;',
            content,
            re.MULTILINE
        )
        for ns in namespace_uses:
            # Convert namespace to PSR-4 style path: App\Utils\Logger -> App/Utils/Logger.php
            path = ns.replace("\\", "/") + ".php"
            imports.append(path)

        # Grouped use statements: use App\Models\{User, Post, Comment};
        grouped_uses = re.findall(
            r'^\s*use\s+([\w\\]+)\\\{([^\}]+)\};',
            content,
            re.MULTILINE
        )
        for base_ns, group in grouped_uses:
            items = [item.strip() for item in group.split(',')]
            for item in items:
                # Remove 'as Alias' if present
                item = item.split(' as ')[0].strip()
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
                if not match.startswith('$') and '$' not in match:
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

        current_dir = Path(from_file).parent
        candidates = [current_dir / ref_str, self.project_dir / ref_str]

        if not Path(ref_str).suffix:
            for ext in [".js", ".jsx", ".ts", ".tsx", ".json", ".py", ".cjs"]:
                candidates.append(current_dir / (ref_str + ext))
                candidates.append(self.project_dir / (ref_str + ext))

        if ref_str.startswith("./") or ref_str.startswith("../"):
            try:
                resolved = (current_dir / ref_str).resolve()
                candidates.append(resolved)
            except:
                pass

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
            color = self.CATEGORY_COLORS.get(file_type, self.CATEGORY_COLORS["Default"])
            dot.node(file, label, fillcolor=color, fontcolor="black")

        for file, deps in self.file_graph.items():
            for dep in deps:
                if dep in self.file_types:
                    dot.edge(file, dep)

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

    def generate_analysis_report(self):
        """Compiles all analysis data into a single JSON-ready report."""
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

        # Build detailed file info
        detailed_files = {}
        for file, file_type in self.file_types.items():
            file_path = Path(self.project_dir) / file
            file_info = {
                "category": file_type,
                "imports": self.file_graph.get(file, []),
                "importedBy": [
                    f for f, deps in self.file_graph.items() if file in deps
                ],
                "isEntryPoint": file in [ep["file"] for ep in entry_points],
                "dependencyCount": len(self.file_graph.get(file, [])),
                "isUnused": file in self.orphaned_files,
            }
            try:
                if file_path.exists():
                    file_info["size"] = f"{file_path.stat().st_size / 1024:.1f}KB"
                    if file_type not in ["Image", "Video", "Audio", "Font"]:
                        with open(
                            file_path, "r", encoding="utf-8", errors="ignore"
                        ) as f:
                            file_info["lines"] = sum(1 for _ in f)
            except:
                pass
            detailed_files[file] = file_info

        # Final Report Data
        report = {
            "projectName": self.project_dir.name,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
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
    project_path, extensions_str, excluded_str, theme_name, format_name
):
    """
    Main entry point for the Electron/Node.js bridge.
    Receives JSON arguments, performs analysis, and prints result to stdout.
    """
    try:
        extensions = (
            [e.strip() for e in extensions_str.split(",") if e.strip()]
            if extensions_str
            else []
        )
        excluded = [f.strip() for f in excluded_str.split(",") if f.strip()]

        # Load configuration from codegnosis.config.json
        config = load_codegnosis_config(project_path)
        logger.info(f"Loaded config: {len(config.get('language_extensions', {}))} custom language extensions")

        analyzer = AnalyzerCore(
            project_path, extensions, excluded_folders=excluded, config=config
        )
        analyzer.logger.info("Starting analysis")
        report = analyzer.analyze()

        # Include config info in report for transparency
        report["configLoaded"] = bool(config.get("language_extensions"))

        # --- MULTIPLIER: Ghost Protocol (Compliance Scan) ---
        # Ghost Protocol reads its own config internally from project_path
        compliance_report = ghost_protocol.perform_compliance_scan(report, project_path)
        report["complianceReport"] = compliance_report

        analyzer.logger.info(
            f"Analysis finished: {report['summary']['totalFiles']} files, "
            f"{report['summary']['totalConnections']} connections"
        )

        # Render graph for visualization (skip when above caps)
        is_dark = theme_name == "Dark"
        is_large = (
            report["summary"]["totalFiles"] > 100
            or report["summary"]["totalConnections"] > 200
        )
        graph_format = "svg" if is_large else "png"

        safe_graph_dir = Path(tempfile.gettempdir()) / "codegnosis_graphs"
        try:
            safe_graph_dir.mkdir(parents=True, exist_ok=True)
        except Exception:
            safe_graph_dir = Path(".")

        skip_graph = (
            report["summary"]["totalFiles"] > GRAPH_NODE_CAP
            or report["summary"]["totalConnections"] > GRAPH_EDGE_CAP
        )

        graph_path = None

        if skip_graph:
            analyzer.logger.info(
                f"Skipping graph render (cap hit; files={report['summary']['totalFiles']}, "
                f"connections={report['summary']['totalConnections']}, "
                f"caps={GRAPH_NODE_CAP}/{GRAPH_EDGE_CAP})"
            )
        else:
            graph_path = analyzer.build_graph(
                is_dark_theme=is_dark,
                graph_format=graph_format,
                output_dir=safe_graph_dir,
            )
            analyzer.logger.info(f"Graph rendered to {graph_path}")

        report["graphImagePath"] = graph_path
        report["graphImageFormat"] = graph_format if graph_path else None
        if skip_graph:
            report["graphSkipReason"] = (
                "Graph skipped due to size cap; view JSON-only for this project."
            )

        # Print the final JSON report to standard output for the calling Node process to capture
        sys.stdout.write(json.dumps(report))

        # --- MULTIPLIER: AI Context Packaging ---
        ai_bundle_name = f"ai_bundle_{report['projectName']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        ai_bundle_path = Path(project_path) / ai_bundle_name
        ai_packager.package_for_ai(report, ai_bundle_path, project_path)

    except FileNotFoundError as e:
        logger.error(f"Project directory not found: {e}")
        sys.stdout.write(
            json.dumps({"error": "Project directory not found.", "details": str(e)})
        )
        sys.exit(1)
    except graphviz.backend.ExecutableNotFound:
        logger.error("Graphviz not installed.")
        sys.stdout.write(
            json.dumps(
                {
                    "error": "Graphviz not installed.",
                    "details": "Graphviz is required for visual chart generation.",
                }
            )
        )
        sys.exit(1)
    except Exception as e:
        import traceback
        logger.error(f"Analysis failed unexpectedly: {traceback.format_exc()}")
        sys.stdout.write(
            json.dumps(
                {
                    "error": "Analysis failed unexpectedly.",
                    "details": traceback.format_exc(),
                }
            )
        )
        sys.exit(1)


if __name__ == "__main__":
    # Expects arguments from the Node/Electron process:
    # [project_path, extensions_str, excluded_str, theme_name, format_name (currently unused)]
    if len(sys.argv) > 4:
        analyze_project_cli(
            sys.argv[1],  # project_path
            sys.argv[2],  # extensions_str
            sys.argv[3],  # excluded_str
            sys.argv[4],  # theme_name
            "json",  # format_name (defaulting for now)
        )
    else:
        # Fallback for manual testing (e.g., python analyzer_core.py)
        # Placeholder analysis if run standalone
        sys.stdout.write(
            json.dumps(
                {"status": "Core Engine Ready. Awaiting command."}
            )
        )
