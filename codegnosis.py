"""
CodeGnosis
Combines the best of all versions:
- Complete multi-language file scanning
- Proper import/dependency detection
- Beautiful UI with zoom/pan
- Export to all formats
- Threading for large projects
- Dark/Light theme toggle
"""

import os
import ast
import re
import json
import tkinter as tk
from tkinter import (
    filedialog,
    messagebox,
    Label,
    Frame,
    Entry,
    Button,
    Canvas,
    Scrollbar,
    Text,
)
from PIL import Image, ImageTk, ImageDraw
from pathlib import Path
from datetime import datetime, timezone
from threading import Thread
import base64
import graphviz
import webbrowser
import subprocess
import platform

# Optional exports - graceful handling
try:
    from openpyxl import Workbook
    from openpyxl.drawing.image import Image as OpenpyxlImage
except ImportError:
    OpenpyxlImage = None


# Theme definitions
LIGHT_THEME = {
    "bg": "#f0f0f0",
    "fg": "#000000",
    "button_bg": "#e0e0e0",
    "entry_bg": "#ffffff",
    "canvas_bg": "#f0f0f0",
    "frame_bg": "#f0f0f0",
    "highlight": "#ffffff",
    "accent": "#4CAF50",
    "status_bg": "#e0e0e0",
    "scrollbar_bg": "#e0e0e0",
    "scrollbar_fg": "#999999",
}

DARK_THEME = {
    "bg": "#1e1e1e",
    "fg": "#e0e0e0",
    "button_bg": "#2e2e2e",
    "entry_bg": "#2a2a2a",
    "canvas_bg": "#2a2a2a",
    "frame_bg": "#2e2e2e",
    "highlight": "#3e3e3e",
    "accent": "#007acc",
    "status_bg": "#2a2a2a",
    "scrollbar_bg": "#1a1a1a",
    "scrollbar_fg": "#cccccc",
}

SATURATED_THEME = {
    "bg": "#0f0f23",  # Deep space blue
    "fg": "#ffffff",
    "button_bg": "#1a1f3a",
    "entry_bg": "#141829",
    "canvas_bg": "#0a0a15",
    "frame_bg": "#1a1f3a",
    "highlight": "#2a2f4a",
    "accent": "#00d9ff",  # Electric cyan
    "status_bg": "#141829",
    "scrollbar_bg": "#0a0a15",
    "scrollbar_fg": "#00d9ff",
}

# Theme cycle order
THEMES = [LIGHT_THEME, DARK_THEME, SATURATED_THEME]
THEME_NAMES = ["Light", "Dark", "Saturated"]


class CodeGnosis:
    """Ultimate project analyzer with complete multi-language support."""

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
        self, directory, extensions_to_find, custom_categories={}, excluded_folders=[]
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
        self.all_categories = {**self.MASTER_CATEGORIES, **custom_categories}

        self.file_graph = {}
        self.file_types = {}
        self.file_data = {}
        self.unfamiliar_extensions = set()
        self.found_extensions = set()

    def analyze(self):
        """Main analysis entry point."""
        files = self._find_files()

        for file_path in files:
            rel_path = self._get_relpath(file_path)
            category = self._categorize(file_path)

            self.file_types[rel_path] = category
            self.file_graph[rel_path] = []

            # Detect dependencies based on file type
            deps = self._detect_dependencies(file_path)
            for dep in deps:
                resolved = self._resolve_path(file_path, dep)
                if resolved and resolved in self.file_types:
                    self.file_graph[rel_path].append(resolved)

        return self.file_graph, self.file_types, self.unfamiliar_extensions

    def _find_files(self):
        """Find all relevant files in the project."""
        found = []
        for root, dirs, files in os.walk(self.project_dir):
            # ALWAYS filter excluded folders (regardless of include_all setting)
            dirs[:] = [d for d in dirs if d not in self.excluded_folders]

            for filename in files:
                ext = Path(filename).suffix.lower()
                self.found_extensions.add(ext if ext else "(no extension)")

                # Include if: all files mode OR extension matches
                if (
                    self.include_all
                    or ext in self.extensions_to_find
                    or filename.lower() in self.extensions_to_find
                ):
                    found.append(Path(root) / filename)

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

        # import ... from '...'
        imports.extend(re.findall(r"import\s+.*?\s+from\s+['\"](.+?)['\"]", content))

        # require('...')
        imports.extend(re.findall(r"require\(['\"](.+?)['\"]\)", content))

        # dynamic import()
        imports.extend(re.findall(r"import\(['\"](.+?)['\"]\)", content))

        return imports

    def _detect_html_refs(self, content):
        """Detect HTML script/link/img references."""
        refs = []

        # <script src="...">
        refs.extend(
            re.findall(r'<script[^>]+src=["\'](.+?)["\']', content, re.IGNORECASE)
        )

        # <link href="...">
        refs.extend(
            re.findall(r'<link[^>]+href=["\'](.+?)["\']', content, re.IGNORECASE)
        )

        # <img src="...">
        refs.extend(re.findall(r'<img[^>]+src=["\'](.+?)["\']', content, re.IGNORECASE))

        return [r for r in refs if not r.startswith(("http://", "https://", "//"))]

    def _detect_css_refs(self, content):
        """Detect CSS @import and url() references."""
        refs = []

        # @import "...";
        refs.extend(re.findall(r'@import\s+["\'](.+?)["\']', content))

        # url(...)
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

        # Try as-is
        candidates = [current_dir / ref_str, self.project_dir / ref_str]

        # Try with common extensions
        if not Path(ref_str).suffix:
            for ext in [".js", ".jsx", ".ts", ".tsx", ".json", ".py", ".cjs"]:
                candidates.append(current_dir / (ref_str + ext))
                candidates.append(self.project_dir / (ref_str + ext))

        # Try resolving ../
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

    def build_graph(self, is_dark_theme=False):
        """Build Graphviz diagram with theme support."""
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

        # Add nodes with consistent dark text on light backgrounds
        for file, file_type in self.file_types.items():
            label = Path(file).name
            color = self.CATEGORY_COLORS.get(file_type, self.CATEGORY_COLORS["Default"])

            # Always use dark text for maximum legibility
            dot.node(file, label, fillcolor=color, fontcolor="black")

        # Add edges
        for file, deps in self.file_graph.items():
            for dep in deps:
                if dep in self.file_types:
                    dot.edge(file, dep)

        return dot


class CodeGnosisApp:
    """CodeGnosis GUI."""

    def __init__(self, root):
        self.root = root
        self.root.title("CodeGnosis")
        self.root.geometry("1250x850")
        self.root.protocol("WM_DELETE_WINDOW", self.root.destroy)

        # Theme state
        self.current_theme = LIGHT_THEME
        self.widgets = {}  # Store widget references for theming

        # State
        self.project_path = tk.StringVar()
        self.custom_categories = {}
        self.original_image = None
        self.photo_image = None
        self.zoom_level = 1.0
        self.last_image_path = None
        self.last_analyzer = None
        self.last_html_path = None
        self.last_json_path = None

        # App state for dynamic instructions
        self.app_state = "initial"  # States: initial, directory_selected, analyzing, analysis_complete, exported

        # Build UI
        self._create_ui()
        self._apply_theme()

    def _create_ui(self):
        """Create the main UI."""
        main_frame = Frame(self.root, padx=10, pady=10)
        main_frame.pack(fill="both", expand=True)
        self.widgets["main_frame"] = main_frame

        # Left side - controls and canvas
        left_frame = Frame(main_frame)
        left_frame.pack(side="left", fill="both", expand=True)
        self.widgets["left_frame"] = left_frame

        # Right side - instructions (WIDER NOW)
        right_frame = Frame(
            main_frame, width=280, padx=10, pady=10, relief=tk.GROOVE, borderwidth=2
        )
        right_frame.pack(side="right", fill="y")
        right_frame.pack_propagate(False)
        self.widgets["right_frame"] = right_frame

        # Controls
        controls = Frame(left_frame, padx=10, pady=10, relief=tk.RIDGE, borderwidth=2)
        controls.pack(fill="x", pady=(0, 10))
        self.widgets["controls"] = controls

        # Theme toggle button (top right)
        theme_btn = Button(
            controls,
            text="🌙 Toggle Theme",
            command=self.toggle_theme,
            font=("Arial", 10, "bold"),
        )
        theme_btn.pack(side="right", padx=5, pady=5)
        self.widgets["theme_btn"] = theme_btn

        # Directory selection
        dir_frame = Frame(controls)
        dir_frame.pack(fill="x", pady=5)
        self.widgets["dir_frame"] = dir_frame

        dir_btn = Button(
            dir_frame,
            text="[1] 📂 Select Directory",
            command=self.select_directory,
            font=("Arial", 11, "bold"),
        )
        dir_btn.pack(side="left", padx=5)
        self.widgets["dir_btn"] = dir_btn

        dir_label = Label(
            dir_frame, textvariable=self.project_path, fg="#5DADE2", font=("Arial", 10)
        )
        dir_label.pack(side="left", padx=5, fill="x", expand=True)
        self.widgets["dir_label"] = dir_label

        # Extensions
        ext_frame = Frame(controls)
        ext_frame.pack(fill="x", pady=5)
        self.widgets["ext_frame"] = ext_frame

        ext_label = Label(
            ext_frame,
            text="[2] Extensions (blank = scan ALL):",
            font=("Arial", 10, "bold"),
        )
        ext_label.pack(side="left", padx=5)
        self.widgets["ext_label"] = ext_label

        self.ext_entry = Entry(ext_frame, font=("Arial", 10))
        self.ext_entry.insert(0, ".py,.js,.jsx,.ts,.tsx,.html,.css,.json,.md")
        self.ext_entry.pack(side="left", padx=5, fill="x", expand=True)
        self.widgets["ext_entry"] = self.ext_entry

        # Exclude folders
        excl_frame = Frame(controls)
        excl_frame.pack(fill="x", pady=5)
        self.widgets["excl_frame"] = excl_frame

        excl_label = Label(
            excl_frame, text="[2] Exclude Folders:", font=("Arial", 10, "bold")
        )
        excl_label.pack(side="left", padx=5)
        self.widgets["excl_label"] = excl_label

        self.exclude_entry = Entry(excl_frame, font=("Arial", 10))
        self.exclude_entry.insert(
            0, "node_modules,.git,.vscode,dist,build,venv,__pycache__"
        )
        self.exclude_entry.pack(side="left", padx=5, fill="x", expand=True)
        self.widgets["exclude_entry"] = self.exclude_entry

        # Action buttons
        actions = Frame(controls)
        actions.pack(pady=10)
        self.widgets["actions"] = actions

        gen_btn = Button(
            actions,
            text="[3] 🎨 Generate Visual Chart",
            command=self.generate_chart,
            font=("Arial", 11, "bold"),
            bg="#4CAF50",
            fg="white",
            padx=15,
            pady=8,
        )
        gen_btn.pack(side="left", padx=5)
        self.widgets["gen_btn"] = gen_btn

        # JSON Export with filename display
        json_frame = Frame(actions)
        json_frame.pack(side="left", padx=5)
        self.widgets["json_frame"] = json_frame

        json_btn = Button(
            json_frame,
            text="[4] 📊 Export to JSON",
            command=self.export_json,
            font=("Arial", 11, "bold"),
            bg="#2196F3",
            fg="white",
            padx=15,
            pady=8,
        )
        json_btn.pack()
        self.widgets["json_btn"] = json_btn

        self.json_filename_label = Label(
            json_frame,
            text="",
            font=("Arial", 8, "italic"),
            fg="gray"
        )
        self.json_filename_label.pack()
        self.widgets["json_filename_label"] = self.json_filename_label

        # HTML Export with filename display
        html_frame = Frame(actions)
        html_frame.pack(side="left", padx=5)
        self.widgets["html_frame"] = html_frame

        html_btn = Button(
            html_frame,
            text="[4] 🌐 Export HTML Report",
            command=self.export_html,
            font=("Arial", 11, "bold"),
            bg="#FF9800",
            fg="white",
            padx=15,
            pady=8,
        )
        html_btn.pack()
        self.widgets["html_btn"] = html_btn

        self.html_filename_label = Label(
            html_frame,
            text="",
            font=("Arial", 8, "italic"),
            fg="gray"
        )
        self.html_filename_label.pack()
        self.widgets["html_filename_label"] = self.html_filename_label

        # Export buttons
        export_frame = Frame(
            left_frame, padx=10, pady=5, relief=tk.GROOVE, borderwidth=2
        )
        export_frame.pack(fill="x")
        self.widgets["export_frame"] = export_frame

        export_label = Label(
            export_frame, text="[4] Additional Exports:", font=("Arial", 10, "bold")
        )
        export_label.pack(side="left", padx=5)
        self.widgets["export_label"] = export_label

        # Markdown export button
        md_btn = Button(
            export_frame,
            text="📝 Markdown (AI-Ready)",
            command=self.export_markdown,
            font=("Arial", 10, "bold"),
            bg="#9C27B0",
            fg="white",
            padx=15,
            pady=5,
        )
        md_btn.pack(side="left", padx=5)
        md_btn.config(state="disabled")
        self.widgets["md_btn"] = md_btn

        # Excel export button (keep)
        xlsx_btn = Button(
            export_frame,
            text="📊 Excel (Chart)",
            command=lambda: self.export_chart("xlsx"),
            font=("Arial", 10, "bold"),
            bg="#217346",
            fg="white",
            padx=15,
            pady=5,
        )
        xlsx_btn.pack(side="left", padx=5)
        xlsx_btn.config(state="disabled")
        self.widgets["xlsx_btn"] = xlsx_btn

        # Copy for AI button
        copy_btn = Button(
            export_frame,
            text="📋 Copy for AI",
            command=self.copy_for_ai,
            font=("Arial", 10, "bold"),
            bg="#E91E63",
            fg="white",
            padx=15,
            pady=5,
        )
        copy_btn.pack(side="left", padx=5)
        copy_btn.config(state="disabled")
        self.widgets["copy_btn"] = copy_btn

        self.export_buttons = [md_btn, xlsx_btn, copy_btn]

        # Quick Access Tools
        quick_access_frame = Frame(
            left_frame, padx=10, pady=5, relief=tk.GROOVE, borderwidth=2
        )
        quick_access_frame.pack(fill="x")
        self.widgets["quick_access_frame"] = quick_access_frame

        quick_label = Label(
            quick_access_frame, text="Quick Access:", font=("Arial", 10, "bold")
        )
        quick_label.pack(side="left", padx=5)
        self.widgets["quick_label"] = quick_label

        # View Last Chart button
        view_chart_btn = Button(
            quick_access_frame,
            text="🔍 View Last Chart",
            command=self.view_last_chart,
            font=("Arial", 10, "bold"),
            bg="#00BCD4",
            fg="white",
            padx=15,
            pady=5,
        )
        view_chart_btn.pack(side="left", padx=5)
        view_chart_btn.config(state="disabled")
        self.widgets["view_chart_btn"] = view_chart_btn

        # Open Chart Folder button
        open_folder_btn = Button(
            quick_access_frame,
            text="📁 Open Chart Folder",
            command=self.open_chart_folder,
            font=("Arial", 10, "bold"),
            bg="#607D8B",
            fg="white",
            padx=15,
            pady=5,
        )
        open_folder_btn.pack(side="left", padx=5)
        open_folder_btn.config(state="disabled")
        self.widgets["open_folder_btn"] = open_folder_btn

        self.quick_access_buttons = [view_chart_btn, open_folder_btn]

        # Canvas
        canvas_frame = Frame(left_frame, relief=tk.SUNKEN, borderwidth=1)
        canvas_frame.pack(fill="both", expand=True, padx=10, pady=10)
        self.widgets["canvas_frame"] = canvas_frame

        self.canvas = Canvas(canvas_frame, bg="#f0f0f0")
        v_scroll = Scrollbar(canvas_frame, orient="vertical", command=self.canvas.yview)
        h_scroll = Scrollbar(
            canvas_frame, orient="horizontal", command=self.canvas.xview
        )
        self.canvas.config(xscrollcommand=h_scroll.set, yscrollcommand=v_scroll.set)

        h_scroll.pack(side="bottom", fill="x")
        v_scroll.pack(side="right", fill="y")
        self.canvas.pack(side="left", fill="both", expand=True)

        self.widgets["canvas"] = self.canvas
        self.widgets["v_scroll"] = v_scroll
        self.widgets["h_scroll"] = h_scroll

        # Bind mouse events
        self.canvas.bind("<MouseWheel>", self._on_mousewheel)
        self.canvas.bind("<ButtonPress-1>", self._pan_start)
        self.canvas.bind("<B1-Motion>", self._pan_move)

        # Status bar
        self.status = Label(self.root, text="Ready", bd=1, relief="sunken", anchor="w")
        self.status.pack(side="bottom", fill="x")
        self.widgets["status"] = self.status

        # Instructions
        self._create_instructions(right_frame)

    def _create_instructions(self, frame):
        """Create dynamic instruction panel."""
        # Store the frame reference
        self.instruction_frame = frame

        # Create title
        title = Label(frame, text="🎯 Mission Control", font=("Arial", 14, "bold"))
        title.pack(pady=10)
        self.widgets["instructions_title"] = title

        # Create a container for dynamic content
        content_frame = Frame(frame)
        content_frame.pack(fill="both", expand=True, pady=5)
        self.widgets["instruction_content"] = content_frame
        self.widgets["instruction_content_frame"] = content_frame  # Store for theme updates

        # Initial load
        self._update_instructions()

    def _update_instructions(self):
        """Update instructions based on current app state."""
        # Clear existing content
        if "instruction_content" in self.widgets:
            for widget in self.widgets["instruction_content"].winfo_children():
                widget.destroy()

        frame = self.widgets["instruction_content"]
        theme = self.current_theme

        # Ensure content frame has correct background
        frame.config(bg=theme["frame_bg"])

        # Define instruction content based on state
        if self.app_state == "initial":
            content = [
                ("🧠 CodeGnosis", ""),
                ("", "Map your project architecture. Give your AI complete context in seconds."),
                ("", ""),
                ("🎯 Mission: Start", ""),
                ("", "Click 'Select Directory' above to choose your coding project folder."),
                ("", ""),
                ("📊 What You'll Get:", ""),
                ("✓", "Visual architecture diagram"),
                ("✓", "AI-ready JSON context"),
                ("✓", "Dependency analysis"),
                ("✓", "Project health insights"),
            ]
        elif self.app_state == "directory_selected":
            content = [
                ("✅ Target Locked", ""),
                ("", f"Directory selected!"),
                ("", ""),
                ("⚙️ Next Step:", ""),
                ("", "Configure your scan settings or use the defaults."),
                ("", ""),
                ("🔧 Options:", ""),
                ("• Extensions", "Blank = scan ALL files"),
                ("• Exclude", "Skip unnecessary folders"),
                ("", ""),
                ("🚀 Ready?", ""),
                ("", "Hit 'Generate Visual Chart' to analyze your project!"),
            ]
        elif self.app_state == "analyzing":
            content = [
                ("⚡ Analysis in Progress", ""),
                ("", "Scanning your codebase..."),
                ("", ""),
                ("🔍 What's Happening:", ""),
                ("✓", "Detecting file types"),
                ("✓", "Mapping dependencies"),
                ("✓", "Building graph structure"),
                ("✓", "Generating visualization"),
                ("", ""),
                ("⏳ Status:", ""),
                ("", "This may take a moment for large projects."),
            ]
        elif self.app_state == "analysis_complete":
            stats = ""
            if self.last_analyzer:
                total = len(self.last_analyzer.file_types)
                connections = sum(len(deps) for deps in self.last_analyzer.file_graph.values())
                stats = f"{total} files • {connections} connections"

            content = [
                ("🎉 Mission Complete!", ""),
                ("", stats if stats else "Analysis successful!"),
                ("", ""),
                ("📊 Export Options:", ""),
                ("📋", "Copy for AI - Quick clipboard export"),
                ("📝", "Markdown - Detailed documentation"),
                ("🌐", "HTML - Interactive D3.js graph"),
                ("📈", "JSON - Programmatic access"),
                ("📊", "Excel - Chart visualization"),
                ("", ""),
                ("🤖 AI-Ready:", ""),
                ("", "All exports optimized for ChatGPT, Claude, and GitHub Copilot"),
                ("", ""),
                ("💡 Pro Tip:", ""),
                ("", "Use Ctrl+Wheel to zoom the diagram"),
            ]
        elif self.app_state == "exported":
            content = [
                ("🏆 Export Success!", ""),
                ("", "Your files are ready!"),
                ("", ""),
                ("📁 Generated Files:", ""),
                ("", "• project_architecture.html"),
                ("", "• project_structure.md"),
                ("", "• ai_context.json"),
                ("", "• project_architecture.xlsx"),
                ("", ""),
                ("🤖 Using with AI:", ""),
                ("", "1. Copy for AI → Instant clipboard"),
                ("", "2. Open Markdown → Paste to Claude/ChatGPT"),
                ("", "3. Open HTML → Interactive browser view"),
                ("", ""),
                ("🔄 What's Next?", ""),
                ("", "• Analyze another project"),
                ("", "• Try different export formats"),
            ]

        # Render content
        for title_text, desc in content:
            if title_text and not desc:
                # This is a header
                lbl = Label(frame, text=title_text, font=("Arial", 11, "bold"), bg=theme["frame_bg"], fg=theme["fg"])
                lbl.pack(pady=(10, 2), anchor="w")
            elif desc and title_text:
                # This is a bullet point with title
                bullet_frame = Frame(frame, bg=theme["frame_bg"])
                bullet_frame.pack(anchor="w", pady=2)

                title_lbl = Label(bullet_frame, text=title_text, font=("Arial", 9, "bold"), bg=theme["frame_bg"], fg=theme["accent"])
                title_lbl.pack(side="left")

                desc_lbl = Label(bullet_frame, text=desc, font=("Arial", 9), bg=theme["frame_bg"], fg=theme["fg"])
                desc_lbl.pack(side="left", padx=(5, 0))
            elif desc:
                # This is body text
                lbl = Label(frame, text=desc, wraplength=250, justify="left", font=("Arial", 9), bg=theme["frame_bg"], fg=theme["fg"])
                lbl.pack(anchor="w", pady=1, padx=5)

    def toggle_theme(self):
        """Cycle through all themes: Light → Dark → Saturated → Light..."""
        # Find current theme index
        try:
            current_index = THEMES.index(self.current_theme)
        except ValueError:
            current_index = 0

        # Cycle to next theme
        next_index = (current_index + 1) % len(THEMES)
        self.current_theme = THEMES[next_index]

        self._apply_theme()
        self._update_instructions()  # Refresh instructions with new theme

        # Update theme button text with current theme name
        theme_icons = ["🌙", "🎨", "☀️"]  # Icons for Light→Dark, Dark→Saturated, Saturated→Light
        next_theme_name = THEME_NAMES[(next_index + 1) % len(THEME_NAMES)]
        self.widgets["theme_btn"].config(text=f"{theme_icons[next_index]} {THEME_NAMES[next_index]} Theme")

    def _apply_theme(self):
        """Apply current theme to all widgets."""
        theme = self.current_theme

        # Root window
        self.root.config(bg=theme["bg"])

        # All frames
        for key in [
            "main_frame",
            "left_frame",
            "right_frame",
            "controls",
            "dir_frame",
            "ext_frame",
            "excl_frame",
            "actions",
            "json_frame",
            "html_frame",
            "export_frame",
            "quick_access_frame",
            "canvas_frame",
            "instruction_content",
            "instruction_content_frame",
        ]:
            if key in self.widgets:
                self.widgets[key].config(bg=theme["frame_bg"])

        # All labels
        for key, widget in self.widgets.items():
            if isinstance(widget, Label):
                if key == "dir_label":  # Directory path - use lighter blue in dark theme
                    dir_color = "#2196F3" if theme == DARK_THEME else "blue"
                    widget.config(bg=theme["frame_bg"], fg=dir_color)
                elif key in ["json_filename_label", "html_filename_label"]:  # Filename labels
                    filename_color = "#AAAAAA" if theme == DARK_THEME else "gray"
                    widget.config(bg=theme["frame_bg"], fg=filename_color)
                else:
                    widget.config(bg=theme["frame_bg"], fg=theme["fg"])

        # All entries
        for key in ["ext_entry", "exclude_entry"]:
            if key in self.widgets:
                self.widgets[key].config(
                    bg=theme["entry_bg"], fg=theme["fg"], insertbackground=theme["fg"]
                )

        # Regular buttons (not action buttons with custom colors)
        for key in ["dir_btn", "theme_btn"]:
            if key in self.widgets:
                self.widgets[key].config(
                    bg=theme["button_bg"],
                    fg=theme["fg"],
                    activebackground=theme["highlight"],
                )

        # Export buttons - keep custom colors, but use white text for dark theme
        for key in ["md_btn", "xlsx_btn", "copy_btn", "view_chart_btn", "open_folder_btn"]:
            if key in self.widgets:
                # Always use white text on colored buttons for better contrast
                self.widgets[key].config(fg="white")

        # Canvas
        if "canvas" in self.widgets:
            self.widgets["canvas"].config(bg=theme["canvas_bg"])

        # Scrollbars - themed for dark/saturated modes
        for key in ["v_scroll", "h_scroll"]:
            if key in self.widgets:
                self.widgets[key].config(
                    bg=theme["scrollbar_bg"],
                    troughcolor=theme["scrollbar_bg"],
                    activebackground=theme["scrollbar_fg"],
                    highlightbackground=theme["frame_bg"],
                    highlightcolor=theme["scrollbar_fg"]
                )

        # Status bar
        if "status" in self.widgets:
            self.widgets["status"].config(bg=theme["status_bg"], fg=theme["fg"])

    def select_directory(self):
        """Select project directory."""
        path = filedialog.askdirectory()
        if path:
            self.project_path.set(path)
            self.canvas.delete("all")
            self.original_image = None
            for btn in self.export_buttons:
                btn.config(state="disabled")
            self.status.config(text=f"Selected: {path}")
            self.app_state = "directory_selected"
            self._update_instructions()

    def generate_chart(self):
        """Generate visual chart in thread."""
        if not self.project_path.get():
            messagebox.showerror("Error", "Please select a directory first")
            return

        self.status.config(text="Analyzing project... Please wait")
        self.canvas.delete("all")

        for btn in self.export_buttons:
            btn.config(state="disabled")

        self.app_state = "analyzing"
        self._update_instructions()

        thread = Thread(target=self._analyze_in_thread, daemon=True)
        thread.start()

    def _analyze_in_thread(self):
        """Run analysis in background thread."""
        try:
            path = self.project_path.get()
            ext_str = self.ext_entry.get().strip()
            excl_str = self.exclude_entry.get().strip()

            extensions = (
                [e.strip() for e in ext_str.split(",") if e.strip()] if ext_str else []
            )
            excluded = [f.strip() for f in excl_str.split(",") if f.strip()]

            analyzer = CodeGnosis(
                path, extensions, self.custom_categories, excluded
            )
            self.last_analyzer = analyzer

            # Analyze
            graph, types, unfamiliar = analyzer.analyze()

            # Build graph with theme
            is_dark = self.current_theme == DARK_THEME
            dot = analyzer.build_graph(is_dark_theme=is_dark)

            # Check project size
            total_files = len(analyzer.file_types)
            total_connections = sum(len(deps) for deps in analyzer.file_graph.values())
            is_large_project = total_files > 100 or total_connections > 200

            # Render - Use SVG for large projects (scales better), PNG for small ones
            output = Path(path) / "project_architecture"

            if is_large_project:
                # SVG is vector-based, scales infinitely
                image_format = "svg"
                image_path = str(output) + ".svg"
            else:
                image_format = "png"
                image_path = str(output) + ".png"

            try:
                dot.render(str(output), format=image_format, cleanup=True)
            except Exception as render_error:
                # If graphviz isn't installed, show helpful error
                self.root.after(0, lambda: self._graphviz_error(str(render_error)))
                return

            # Verify image was created
            if not Path(image_path).exists():
                self.root.after(0, lambda: self._analysis_error("Image file was not created. Check if Graphviz is installed."))
                return

            self.last_image_path = image_path

            # For large projects, recommend HTML export
            if is_large_project:
                self.root.after(0, lambda: self._large_project_notice(total_files, total_connections))

            # Update UI on main thread
            self.root.after(0, self._post_analysis, analyzer, unfamiliar)

        except Exception as e:
            import traceback
            error_msg = f"{str(e)}\n\n{traceback.format_exc()}"
            self.root.after(0, lambda: self._analysis_error(error_msg))

    def _post_analysis(self, analyzer, unfamiliar):
        """Post-analysis UI update."""
        try:
            total = len(analyzer.file_types)
            connections = sum(len(deps) for deps in analyzer.file_graph.values())

            # Update status before loading image
            self.status.config(text=f"Loading visualization... ({total} files, {connections} connections)")
            self.root.update_idletasks()  # Force UI update

            # Load the generated chart image
            if self.last_image_path and Path(self.last_image_path).exists():
                self.load_image(self.last_image_path)
            else:
                messagebox.showwarning(
                    "Chart Not Found",
                    f"Chart image was not created.\n\nExpected: {self.last_image_path}\n\n"
                    "The analysis completed successfully, but the visual chart file is missing."
                )

            # Final status update
            self.status.config(text=f"✓ Found {total} files, {connections} connections")

            for btn in self.export_buttons:
                btn.config(state="normal")

            self.app_state = "analysis_complete"
            self._update_instructions()

            # Show unfamiliar extensions dialog
            if unfamiliar and len(unfamiliar) > 0:
                self._show_unfamiliar(unfamiliar)
            elif unfamiliar is not None:
                # All file types were recognized
                messagebox.showinfo(
                    "File Types",
                    "✓ All file types were recognized!\n\nNo unknown extensions found."
                )

        except Exception as e:
            self._analysis_error(str(e))

    def _analysis_error(self, error):
        """Handle analysis error."""
        messagebox.showerror("Analysis Failed", f"Error: {error}")
        self.status.config(text="Analysis failed")

    def _graphviz_error(self, error):
        """Handle Graphviz-specific errors."""
        msg = f"""Graphviz is required to generate visual charts.

Error: {error}

To install Graphviz:

Windows:
1. Download from: https://graphviz.org/download/
2. Install and add to PATH
3. Or use: winget install graphviz

Mac:
brew install graphviz

Linux:
sudo apt install graphviz

After installing, restart this application.

NOTE: You can still use the other export formats:
- JSON Export (works without Graphviz)
- HTML Export (works without Graphviz)
- Markdown Export (works without Graphviz)
- Copy for AI (works without Graphviz)
"""
        messagebox.showerror("Graphviz Not Found", msg)
        self.status.config(text="Chart generation failed - Graphviz required")

    def _large_project_notice(self, total_files, total_connections):
        """Notify user about large project and recommend HTML export."""
        msg = f"""🎯 Large Project Detected!

Files: {total_files}
Connections: {total_connections}

The static diagram has been saved as SVG (vector format) but may be too dense to view easily.

💡 RECOMMENDED: Use the Interactive HTML Export!

Click '🌐 Export HTML Report' for the best experience:
✓ Pan and zoom infinitely
✓ Search for specific files
✓ Click nodes to highlight connections
✓ Professional D3.js visualization
✓ Perfect for projects of any size

The HTML export is optimized for large codebases like yours!
"""
        messagebox.showinfo("Large Project - Use HTML Export", msg)

    def _show_unfamiliar(self, extensions):
        """Show unfamiliar extensions dialog."""
        dialog = tk.Toplevel(self.root)
        dialog.title("Unfamiliar Extensions Found")
        dialog.geometry("400x300")
        dialog.transient(self.root)
        dialog.grab_set()

        # Apply theme to dialog
        theme = self.current_theme
        dialog.config(bg=theme["bg"])

        lbl = Label(
            dialog,
            text="These file types were not categorized:",
            font=("Arial", 11, "bold"),
            bg=theme["bg"],
            fg=theme["fg"],
        )
        lbl.pack(pady=10)

        text = Text(dialog, height=10, width=40, bg=theme["entry_bg"], fg=theme["fg"])
        text.pack(padx=10, pady=10, fill="both", expand=True)
        text.insert("1.0", "\n".join(sorted(extensions)))
        text.config(state="disabled")

        btn = Button(
            dialog,
            text="OK",
            command=dialog.destroy,
            font=("Arial", 10),
            bg=theme["button_bg"],
            fg=theme["fg"],
        )
        btn.pack(pady=10)

    def load_image(self, path):
        """Load image into canvas."""
        try:
            if not Path(path).exists():
                raise FileNotFoundError(f"Image file not found: {path}")

            # Check if it's an SVG file
            if path.endswith('.svg'):
                # SVG files can't be displayed directly in Tkinter canvas with PIL
                # Show a message instead
                self._show_svg_message(path)
                return

            self.original_image = Image.open(path)
            self.zoom_level = 1.0

            # Fit to canvas
            canvas_w = self.canvas.winfo_width()
            canvas_h = self.canvas.winfo_height()

            if canvas_w > 100 and canvas_h > 100:
                self.zoom_level = min(
                    canvas_w / self.original_image.width,
                    canvas_h / self.original_image.height,
                    1.0,
                )

            self._update_canvas_image()
        except Exception as e:
            messagebox.showerror("Image Load Error", f"Failed to load image:\n{path}\n\nError: {e}")
            raise

    def _show_svg_message(self, svg_path):
        """Display message for SVG files that can't be shown in canvas."""
        self.canvas.delete("all")

        # Get canvas dimensions
        canvas_w = self.canvas.winfo_width()
        canvas_h = self.canvas.winfo_height()

        if canvas_w < 100:
            canvas_w = 800
        if canvas_h < 100:
            canvas_h = 600

        # Draw message in canvas
        theme = self.current_theme

        # Background
        self.canvas.create_rectangle(
            0, 0, canvas_w, canvas_h,
            fill=theme["canvas_bg"],
            outline=""
        )

        # Message
        msg_lines = [
            "📊 Large Project - SVG Generated",
            "",
            f"Vector diagram saved to:",
            Path(svg_path).name,
            "",
            "🌐 For best viewing experience:",
            "Use the 'Export HTML Report' button",
            "",
            "The HTML export provides:",
            "• Interactive zoom & pan",
            "• Search functionality",
            "• Click to highlight connections",
            "• Perfect for large projects",
            "",
            "Or open the SVG file in your browser",
            "for infinite zoom capability"
        ]

        y_pos = 100
        for line in msg_lines:
            if line.startswith("📊") or line.startswith("🌐"):
                font = ("Arial", 16, "bold")
                color = theme["accent"]
            elif line.startswith("•"):
                font = ("Arial", 11)
                color = theme["fg"]
            elif "project_architecture.svg" in line or Path(svg_path).name in line:
                font = ("Arial", 11, "italic")
                color = "#4FC1FF"
            else:
                font = ("Arial", 12)
                color = theme["fg"]

            self.canvas.create_text(
                canvas_w // 2, y_pos,
                text=line,
                font=font,
                fill=color,
                anchor="center"
            )
            y_pos += 30

    def _update_canvas_image(self):
        """Update canvas with current zoom."""
        if not self.original_image:
            return

        w = int(self.original_image.width * self.zoom_level)
        h = int(self.original_image.height * self.zoom_level)

        if w < 1 or h < 1:
            return

        # Limit max size
        max_dim = 4000
        if w > max_dim or h > max_dim:
            scale = max_dim / max(w, h)
            w = int(w * scale)
            h = int(h * scale)

        resized = self.original_image.resize((w, h), Image.Resampling.LANCZOS)
        self.photo_image = ImageTk.PhotoImage(resized)

        self.canvas.delete("all")
        self.canvas.create_image(
            0, 0, anchor="nw", image=self.photo_image, tags="image"
        )
        self.canvas.config(scrollregion=self.canvas.bbox("all"))

    def _on_mousewheel(self, event):
        """Handle mouse wheel for zoom/scroll."""
        is_ctrl = (event.state & 0x4) != 0

        if is_ctrl and self.original_image:
            # Zoom
            factor = 1.1 if event.delta > 0 else 0.9
            self.zoom_level = max(0.1, min(self.zoom_level * factor, 5.0))
            self._update_canvas_image()
        else:
            # Scroll
            self.canvas.yview_scroll(-1 * (event.delta // 120), "units")

    def _pan_start(self, event):
        """Start panning."""
        self.canvas.scan_mark(event.x, event.y)

    def _pan_move(self, event):
        """Pan canvas."""
        self.canvas.scan_dragto(event.x, event.y, gain=1)

    def _check_directory_writable(self, directory):
        """Check if we can write to the directory."""
        try:
            test_file = Path(directory) / ".codegnosis_write_test"
            test_file.touch()
            test_file.unlink()
            return True
        except (PermissionError, OSError):
            return False

    def export_json(self):
        """Export enhanced AI context JSON."""
        if not self.last_analyzer:
            messagebox.showwarning("Warning", "Generate chart first")
            return

        # Ask user for filename/location
        project_dir = Path(self.project_path.get())

        # Check if we can write to project directory
        can_write_to_project = self._check_directory_writable(project_dir)

        # Always offer file save dialog for custom naming
        if can_write_to_project:
            initial_dir = str(project_dir)
        else:
            initial_dir = str(Path.home() / "Documents")

        custom_save_path = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")],
            initialfile="ai_context.json",
            initialdir=initial_dir,
            title="Save JSON Export As..."
        )

        if not custom_save_path:
            return  # User cancelled

        try:
            analyzer = self.last_analyzer

            # Calculate statistics and insights
            total_files = len(analyzer.file_types)
            total_connections = sum(len(deps) for deps in analyzer.file_graph.values())

            # Language breakdown
            language_counts = {}
            for file_type in analyzer.file_types.values():
                language_counts[file_type] = language_counts.get(file_type, 0) + 1

            # Find entry points (files that nothing imports)
            imported_files = set()
            for deps in analyzer.file_graph.values():
                imported_files.update(deps)

            entry_points = []
            for file in analyzer.file_types.keys():
                if file not in imported_files:
                    entry_points.append(
                        {"file": file, "category": analyzer.file_types[file]}
                    )

            # Find hub files (most imported)
            import_counts = {}
            for file in analyzer.file_types.keys():
                import_counts[file] = 0

            for deps in analyzer.file_graph.values():
                for dep in deps:
                    import_counts[dep] = import_counts.get(dep, 0) + 1

            hub_files = []
            for file, count in sorted(
                import_counts.items(), key=lambda x: x[1], reverse=True
            )[:10]:
                if count > 0:
                    hub_files.append(
                        {
                            "file": file,
                            "importedBy": count,
                            "category": analyzer.file_types[file],
                        }
                    )

            # Detect circular dependencies
            circular_deps = self._detect_circular_dependencies(analyzer.file_graph)

            # Find orphaned files (no imports, not imported)
            orphaned = []
            for file in analyzer.file_types.keys():
                has_no_imports = len(analyzer.file_graph.get(file, [])) == 0
                is_not_imported = import_counts.get(file, 0) == 0
                if has_no_imports and is_not_imported:
                    orphaned.append(file)

            # Find god files (too many dependencies)
            god_files = []
            for file, deps in analyzer.file_graph.items():
                if len(deps) > 10:
                    god_files.append(
                        {
                            "file": file,
                            "dependencies": len(deps),
                            "category": analyzer.file_types[file],
                        }
                    )

            # Health warnings
            health_warnings = []

            for cycle in circular_deps:
                health_warnings.append(
                    {"type": "circular_dependency", "files": cycle, "severity": "high"}
                )

            for orphan in orphaned:
                health_warnings.append(
                    {
                        "type": "orphaned_file",
                        "file": orphan,
                        "reason": "No imports, not imported by anything",
                        "severity": "low",
                    }
                )

            for god in god_files:
                health_warnings.append(
                    {
                        "type": "high_complexity",
                        "file": god["file"],
                        "dependencies": god["dependencies"],
                        "reason": "Too many dependencies",
                        "severity": "medium",
                    }
                )

            # Detect frameworks and project type
            frameworks = self._detect_frameworks(analyzer.file_types)
            project_type = self._detect_project_type(analyzer.file_types, entry_points)

            # Build detailed file info
            detailed_files = {}
            for file, file_type in analyzer.file_types.items():
                file_path = Path(analyzer.project_dir) / file

                file_info = {
                    "category": file_type,
                    "imports": analyzer.file_graph.get(file, []),
                    "importedBy": [],
                    "isEntryPoint": file in [ep["file"] for ep in entry_points],
                    "isOrphaned": file in orphaned,
                    "dependencyCount": len(analyzer.file_graph.get(file, [])),
                }

                # Add file size and line count if file exists
                try:
                    if file_path.exists():
                        file_info["size"] = f"{file_path.stat().st_size / 1024:.1f}KB"

                        # Count lines for text files
                        if file_type not in ["Image", "Video", "Audio", "Font"]:
                            try:
                                with open(
                                    file_path, "r", encoding="utf-8", errors="ignore"
                                ) as f:
                                    file_info["lines"] = sum(1 for _ in f)
                            except:
                                pass
                except:
                    pass

                detailed_files[file] = file_info

            # Add importedBy to each file
            for file, deps in analyzer.file_graph.items():
                for dep in deps:
                    if dep in detailed_files:
                        detailed_files[dep]["importedBy"].append(file)

            # Calculate statistics
            avg_deps = total_connections / total_files if total_files > 0 else 0
            max_chain_depth = self._calculate_max_chain_depth(analyzer.file_graph)

            # Build the complete AI context
            data = {
                "projectName": Path(self.project_path.get()).name,
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "summary": {
                    "totalFiles": total_files,
                    "totalConnections": total_connections,
                    "languages": language_counts,
                    "detectedFrameworks": frameworks,
                    "projectType": project_type,
                },
                "entryPoints": entry_points,
                "hubFiles": hub_files,
                "healthWarnings": health_warnings,
                "statistics": {
                    "avgDependenciesPerFile": round(avg_deps, 2),
                    "maxDependencyChainDepth": max_chain_depth,
                    "circularDependencies": len(circular_deps),
                    "orphanedFiles": len(orphaned),
                    "highComplexityFiles": len(god_files),
                },
                "files": detailed_files,
                "dependencyGraph": analyzer.file_graph,
            }

            # Use the path from file dialog
            path = Path(custom_save_path)

            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)

            # Store path for quick access
            self.last_json_path = path

            self.app_state = "exported"
            self._update_instructions()

            # Update filename label
            self.json_filename_label.config(text=f"→ {path.name}")

            # Enable quick access buttons
            for btn in self.quick_access_buttons:
                btn.config(state="normal")

            # Ask if user wants to open the folder
            result = messagebox.askyesno(
                "Export Successful",
                f"AI context exported to:\n{path}\n\nOpen folder to view the file?",
                icon='info'
            )

            if result:
                self._open_folder(path.parent)
        except PermissionError as e:
            messagebox.showerror(
                "Permission Denied",
                f"Cannot write to the selected location.\n\n"
                f"Error: {e}\n\n"
                "Try:\n"
                "• Run as Administrator\n"
                "• Choose a different save location\n"
                "• Check folder permissions"
            )
        except Exception as e:
            messagebox.showerror("Error", f"Export failed: {e}\n\nPlease try saving to a different location.")

    def _detect_circular_dependencies(self, graph):
        """Detect circular dependencies in the graph."""
        cycles = []
        visited = set()
        rec_stack = []

        def dfs(node, path):
            if node in rec_stack:
                cycle_start = rec_stack.index(node)
                cycle = rec_stack[cycle_start:] + [node]
                if len(cycle) <= 5 and cycle not in cycles:  # Limit cycle size
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

        return cycles[:10]  # Return max 10 cycles

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

    def _detect_frameworks(self, file_types):
        """Detect frameworks used in the project."""
        frameworks = set()

        files = list(file_types.keys())
        types = list(file_types.values())

        # Check for web frameworks
        if "React" in types or "TypeScript React" in types:
            frameworks.add("React")

        if any("vue" in f.lower() for f in files):
            frameworks.add("Vue")

        if any("angular" in f.lower() for f in files):
            frameworks.add("Angular")

        # Check for backend frameworks
        if any("django" in f.lower() or "manage.py" in f for f in files):
            frameworks.add("Django")

        if any("flask" in f.lower() or "app.py" in f for f in files):
            frameworks.add("Flask")

        if any("express" in f.lower() or "server.js" in f for f in files):
            frameworks.add("Express")

        # Check for build tools
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
            if any("test" in f.lower() for f in files):
                return "Python Library/Package"
            else:
                return "Python Application"
        elif has_html and has_css and not has_js:
            return "Static Website"
        else:
            return "Mixed/Unknown"

    def export_html(self):
        """Export interactive D3.js force-directed graph."""
        if not self.last_analyzer:
            messagebox.showwarning("Warning", "Generate chart first")
            return

        # Ask user for filename/location
        project_dir = Path(self.project_path.get())

        # Check if we can write to project directory
        can_write_to_project = self._check_directory_writable(project_dir)

        # Always offer file save dialog for custom naming
        if can_write_to_project:
            initial_dir = str(project_dir)
        else:
            initial_dir = str(Path.home() / "Documents")

        custom_save_path = filedialog.asksaveasfilename(
            defaultextension=".html",
            filetypes=[("HTML files", "*.html"), ("All files", "*.*")],
            initialfile="project_architecture.html",
            initialdir=initial_dir,
            title="Save HTML Export As..."
        )

        if not custom_save_path:
            return  # User cancelled

        try:
            # Build nodes and edges for D3
            nodes = []
            links = []

            # Color mapping for categories
            category_colors = {
                "Python": "#3572A5",
                "JavaScript": "#F1E05A",
                "React": "#61DAFB",
                "TypeScript": "#3178C6",
                "TypeScript React": "#3178C6",
                "HTML": "#E34C26",
                "CSS": "#563D7C",
                "SCSS": "#C6538C",
                "JSON": "#CBCB41",
                "YAML": "#CB171E",
                "SQL": "#E38C00",
                "Image": "#A8B9CC",
                "SVG": "#FFB13B",
                "Document": "#0078D4",
                "Spreadsheet": "#217346",
                "Graphviz": "#2C3E50",
                "Config": "#6C757D",
                "Default": "#6C757D",
                "Unfamiliar": "#DC3545",
            }

            # Create nodes
            node_id_map = {}
            for idx, (file, file_type) in enumerate(self.last_analyzer.file_types.items()):
                node_id_map[file] = idx
                color = category_colors.get(file_type, category_colors["Default"])
                nodes.append({
                    "id": idx,
                    "name": Path(file).name,
                    "fullPath": file,
                    "category": file_type,
                    "color": color
                })

            # Create links
            for file, deps in self.last_analyzer.file_graph.items():
                source_id = node_id_map.get(file)
                if source_id is not None:
                    for dep in deps:
                        target_id = node_id_map.get(dep)
                        if target_id is not None:
                            links.append({"source": source_id, "target": target_id})

            project_name = Path(self.project_path.get()).name
            total_files = len(nodes)
            total_connections = len(links)

            html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{project_name} - Architecture Map</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #1e1e1e;
            color: #cccccc;
            overflow: hidden;
        }}

        #graph {{
            width: 100vw;
            height: 100vh;
        }}

        .controls {{
            position: absolute;
            top: 20px;
            left: 20px;
            background: #252526;
            border: 1px solid #3e3e42;
            border-radius: 6px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            max-width: 320px;
        }}

        .controls h1 {{
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 8px;
            color: #ffffff;
        }}

        .controls .subtitle {{
            font-size: 13px;
            color: #858585;
            margin-bottom: 20px;
        }}

        .stat {{
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #3e3e42;
            font-size: 13px;
        }}

        .stat:last-child {{
            border-bottom: none;
        }}

        .stat-label {{
            color: #858585;
        }}

        .stat-value {{
            color: #4FC1FF;
            font-weight: 600;
        }}

        .search-box {{
            width: 100%;
            padding: 8px 12px;
            background: #3c3c3c;
            border: 1px solid #3e3e42;
            border-radius: 4px;
            color: #cccccc;
            font-size: 13px;
            margin-top: 15px;
        }}

        .search-box:focus {{
            outline: none;
            border-color: #007acc;
        }}

        .legend {{
            position: absolute;
            bottom: 20px;
            left: 20px;
            background: #252526;
            border: 1px solid #3e3e42;
            border-radius: 6px;
            padding: 15px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            max-height: 300px;
            overflow-y: auto;
        }}

        .legend h3 {{
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 10px;
            color: #ffffff;
        }}

        .legend-item {{
            display: flex;
            align-items: center;
            margin-bottom: 6px;
            font-size: 12px;
        }}

        .legend-color {{
            width: 14px;
            height: 14px;
            border-radius: 3px;
            margin-right: 8px;
        }}

        .node {{
            cursor: pointer;
            stroke: #1e1e1e;
            stroke-width: 2px;
        }}

        .node:hover {{
            stroke: #ffffff;
            stroke-width: 3px;
        }}

        .node.highlighted {{
            stroke: #4FC1FF;
            stroke-width: 3px;
        }}

        .link {{
            stroke: #404040;
            stroke-opacity: 0.4;
            stroke-width: 1.5px;
            fill: none;
        }}

        .link.highlighted {{
            stroke: #4FC1FF;
            stroke-opacity: 0.8;
            stroke-width: 2.5px;
        }}

        .node-label {{
            font-size: 11px;
            fill: #cccccc;
            pointer-events: none;
            text-anchor: middle;
            font-family: 'Consolas', 'Monaco', monospace;
        }}

        .tooltip {{
            position: absolute;
            background: #252526;
            border: 1px solid #3e3e42;
            border-radius: 4px;
            padding: 10px;
            pointer-events: none;
            display: none;
            font-size: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
            max-width: 300px;
        }}

        .tooltip-title {{
            font-weight: 600;
            color: #4FC1FF;
            margin-bottom: 5px;
        }}

        .tooltip-path {{
            color: #858585;
            font-family: 'Consolas', 'Monaco', monospace;
            word-break: break-all;
        }}

        ::-webkit-scrollbar {{
            width: 10px;
        }}

        ::-webkit-scrollbar-track {{
            background: #1e1e1e;
        }}

        ::-webkit-scrollbar-thumb {{
            background: #3e3e42;
            border-radius: 5px;
        }}

        ::-webkit-scrollbar-thumb:hover {{
            background: #4e4e52;
        }}
    </style>
</head>
<body>
    <div class="controls">
        <h1>{project_name}</h1>
        <div class="subtitle">Project Architecture Map</div>
        <div class="stat">
            <span class="stat-label">Total Files</span>
            <span class="stat-value">{total_files}</span>
        </div>
        <div class="stat">
            <span class="stat-label">Connections</span>
            <span class="stat-value">{total_connections}</span>
        </div>
        <input type="text" class="search-box" id="search" placeholder="Search files..." />
    </div>

    <div class="legend" id="legend"></div>
    <div class="tooltip" id="tooltip"></div>
    <svg id="graph"></svg>

    <script>
        const nodes = {json.dumps(nodes)};
        const links = {json.dumps(links)};

        const width = window.innerWidth;
        const height = window.innerHeight;

        const svg = d3.select("#graph")
            .attr("width", width)
            .attr("height", height)
            .call(d3.zoom()
                .scaleExtent([0.1, 10])
                .on("zoom", (event) => {{
                    g.attr("transform", event.transform);
                }}));

        const g = svg.append("g");

        // Create force simulation
        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide().radius(30));

        // Draw links
        const link = g.append("g")
            .selectAll("path")
            .data(links)
            .join("path")
            .attr("class", "link")
            .attr("marker-end", "url(#arrowhead)");

        // Add arrowhead marker
        svg.append("defs").append("marker")
            .attr("id", "arrowhead")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 20)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", "#404040");

        // Draw nodes
        const node = g.append("g")
            .selectAll("circle")
            .data(nodes)
            .join("circle")
            .attr("class", "node")
            .attr("r", 8)
            .attr("fill", d => d.color)
            .call(drag(simulation))
            .on("mouseover", showTooltip)
            .on("mouseout", hideTooltip)
            .on("click", highlightConnections);

        // Add labels
        const label = g.append("g")
            .selectAll("text")
            .data(nodes)
            .join("text")
            .attr("class", "node-label")
            .attr("dy", -12)
            .text(d => d.name);

        // Update positions on tick
        simulation.on("tick", () => {{
            link.attr("d", d => {{
                const dx = d.target.x - d.source.x;
                const dy = d.target.y - d.source.y;
                const dr = Math.sqrt(dx * dx + dy * dy);
                return `M${{d.source.x}},${{d.source.y}}L${{d.target.x}},${{d.target.y}}`;
            }});

            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);

            label
                .attr("x", d => d.x)
                .attr("y", d => d.y);
        }});

        // Drag behavior
        function drag(simulation) {{
            function dragstarted(event) {{
                if (!event.active) simulation.alphaTarget(0.3).restart();
                event.subject.fx = event.subject.x;
                event.subject.fy = event.subject.y;
            }}

            function dragged(event) {{
                event.subject.fx = event.x;
                event.subject.fy = event.y;
            }}

            function dragended(event) {{
                if (!event.active) simulation.alphaTarget(0);
                event.subject.fx = null;
                event.subject.fy = null;
            }}

            return d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended);
        }}

        // Tooltip
        const tooltip = d3.select("#tooltip");

        function showTooltip(event, d) {{
            tooltip
                .style("display", "block")
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px")
                .html(`
                    <div class="tooltip-title">${{d.name}}</div>
                    <div class="tooltip-path">${{d.fullPath}}</div>
                    <div style="margin-top: 5px; color: #cccccc;">Category: ${{d.category}}</div>
                `);
        }}

        function hideTooltip() {{
            tooltip.style("display", "none");
        }}

        // Highlight connections
        function highlightConnections(event, d) {{
            const connected = new Set();
            connected.add(d.id);

            links.forEach(link => {{
                if (link.source.id === d.id) connected.add(link.target.id);
                if (link.target.id === d.id) connected.add(link.source.id);
            }});

            node.classed("highlighted", n => connected.has(n.id));
            link.classed("highlighted", l => l.source.id === d.id || l.target.id === d.id);
        }}

        // Search functionality
        d3.select("#search").on("input", function() {{
            const searchTerm = this.value.toLowerCase();
            node.attr("opacity", d => {{
                const matches = d.name.toLowerCase().includes(searchTerm) ||
                               d.fullPath.toLowerCase().includes(searchTerm);
                return matches || searchTerm === "" ? 1 : 0.2;
            }});
            label.attr("opacity", d => {{
                const matches = d.name.toLowerCase().includes(searchTerm) ||
                               d.fullPath.toLowerCase().includes(searchTerm);
                return matches || searchTerm === "" ? 1 : 0.2;
            }});
        }});

        // Build legend
        const categories = [...new Set(nodes.map(n => n.category))];
        const categoryColors = {{}};
        nodes.forEach(n => {{
            if (!categoryColors[n.category]) {{
                categoryColors[n.category] = n.color;
            }}
        }});

        const legend = d3.select("#legend");
        legend.append("h3").text("File Types");

        categories.sort().forEach(cat => {{
            const item = legend.append("div").attr("class", "legend-item");
            item.append("div")
                .attr("class", "legend-color")
                .style("background-color", categoryColors[cat]);
            item.append("span").text(cat);
        }});
    </script>
</body>
</html>"""

            # Use the path from file dialog
            path = Path(custom_save_path)

            with open(path, "w", encoding="utf-8") as f:
                f.write(html)

            # Store path for "View Last Chart" feature
            self.last_html_path = path

            self.app_state = "exported"
            self._update_instructions()

            # Update filename label
            self.html_filename_label.config(text=f"→ {path.name}")

            # Enable quick access buttons
            for btn in self.quick_access_buttons:
                btn.config(state="normal")

            # Ask if user wants to open in browser
            result = messagebox.askyesno(
                "Export Successful",
                f"Interactive visualization exported to:\n{path}\n\nOpen in your browser now?",
                icon='info'
            )

            if result:
                self._open_in_browser(path)
        except PermissionError as e:
            messagebox.showerror(
                "Permission Denied",
                f"Cannot write to the selected location.\n\n"
                f"Error: {e}\n\n"
                "Try:\n"
                "• Run as Administrator\n"
                "• Choose a different save location\n"
                "• Check folder permissions"
            )
        except Exception as e:
            messagebox.showerror("Error", f"Export failed: {e}\n\nPlease try saving to a different location.")

    def export_markdown(self):
        """Export AI-optimized Markdown documentation."""
        if not self.last_analyzer:
            messagebox.showwarning("Warning", "Generate chart first")
            return

        # Check write permissions
        project_dir = Path(self.project_path.get())
        custom_save_path = None

        if not self._check_directory_writable(project_dir):
            result = messagebox.askyesno(
                "Permission Denied",
                f"Cannot write to:\n{project_dir}\n\n"
                "This directory may be write-protected or require administrator privileges.\n\n"
                "Would you like to save to a different location?",
                icon='warning'
            )
            if result:
                custom_save_path = filedialog.asksaveasfilename(
                    defaultextension=".md",
                    filetypes=[("Markdown files", "*.md"), ("All files", "*.*")],
                    initialfile="project_structure.md",
                    title="Save Markdown to Different Location"
                )
                if not custom_save_path:
                    return
            else:
                return

        try:
            analyzer = self.last_analyzer
            project_name = Path(self.project_path.get()).name
            total_files = len(analyzer.file_types)
            total_connections = sum(len(deps) for deps in analyzer.file_graph.values())

            # Calculate statistics
            language_counts = {}
            for file_type in analyzer.file_types.values():
                language_counts[file_type] = language_counts.get(file_type, 0) + 1

            # Build markdown content
            md = f"""# {project_name} - Project Architecture

**Generated:** {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}

## 📊 Project Overview

- **Total Files:** {total_files}
- **Total Connections:** {total_connections}
- **Average Dependencies per File:** {total_connections / total_files if total_files > 0 else 0:.2f}

### Language Breakdown

"""
            for lang, count in sorted(language_counts.items(), key=lambda x: x[1], reverse=True):
                md += f"- **{lang}:** {count} files\n"

            # Add project structure
            md += "\n## 📁 Project Structure\n\n```\n"

            # Build tree structure
            file_tree = {}
            for file in sorted(analyzer.file_types.keys()):
                parts = file.split('/')
                current = file_tree
                for part in parts[:-1]:
                    if part not in current:
                        current[part] = {}
                    current = current[part]
                current[parts[-1]] = analyzer.file_types[file]

            def print_tree(tree, prefix="", is_last=True):
                result = ""
                items = list(tree.items())
                for i, (name, subtree) in enumerate(items):
                    is_last_item = i == len(items) - 1
                    connector = "└── " if is_last_item else "├── "

                    if isinstance(subtree, dict):
                        result += f"{prefix}{connector}{name}/\n"
                        extension = "    " if is_last_item else "│   "
                        result += print_tree(subtree, prefix + extension, is_last_item)
                    else:
                        result += f"{prefix}{connector}{name} ({subtree})\n"

                return result

            md += print_tree(file_tree)
            md += "```\n\n"

            # Add dependency graph
            md += "## 🔗 Dependency Graph\n\n"
            md += "### Key Files\n\n"

            # Find hub files (most imported)
            import_counts = {}
            for file in analyzer.file_types.keys():
                import_counts[file] = 0

            for deps in analyzer.file_graph.values():
                for dep in deps:
                    import_counts[dep] = import_counts.get(dep, 0) + 1

            hub_files = sorted(import_counts.items(), key=lambda x: x[1], reverse=True)[:10]
            if any(count > 0 for _, count in hub_files):
                md += "**Most Imported Files:**\n\n"
                for file, count in hub_files:
                    if count > 0:
                        md += f"- `{file}` - imported by {count} file(s)\n"
                md += "\n"

            # Find entry points
            imported_files = set()
            for deps in analyzer.file_graph.values():
                imported_files.update(deps)

            entry_points = [f for f in analyzer.file_types.keys() if f not in imported_files]
            if entry_points:
                md += "**Entry Points** (not imported by any file):\n\n"
                for file in sorted(entry_points)[:15]:
                    md += f"- `{file}`\n"
                md += "\n"

            # Add detailed file listing
            md += "## 📄 Detailed File Information\n\n"

            for file in sorted(analyzer.file_types.keys()):
                file_type = analyzer.file_types[file]
                deps = analyzer.file_graph.get(file, [])
                imported_by_count = import_counts.get(file, 0)

                md += f"### `{file}`\n\n"
                md += f"- **Category:** {file_type}\n"
                md += f"- **Imports:** {len(deps)} file(s)\n"
                md += f"- **Imported by:** {imported_by_count} file(s)\n"

                if deps:
                    md += f"\n**Dependencies:**\n\n"
                    for dep in sorted(deps):
                        md += f"  - `{dep}`\n"

                md += "\n"

            # Add Mermaid diagram
            md += "## 📈 Visual Dependency Graph (Mermaid)\n\n"
            md += "```mermaid\ngraph LR\n"

            # Create node IDs (sanitize for mermaid)
            node_ids = {}
            for idx, file in enumerate(analyzer.file_types.keys()):
                node_ids[file] = f"N{idx}"
                # Truncate long names
                display_name = Path(file).name
                if len(display_name) > 25:
                    display_name = display_name[:22] + "..."
                md += f"    {node_ids[file]}[\"{display_name}\"]\n"

            # Add edges (limit to prevent huge diagrams)
            edge_count = 0
            max_edges = 100
            for file, deps in analyzer.file_graph.items():
                if edge_count >= max_edges:
                    md += f"    NOTE[\"... {total_connections - max_edges} more connections\"]\n"
                    break
                for dep in deps:
                    if edge_count >= max_edges:
                        break
                    if file in node_ids and dep in node_ids:
                        md += f"    {node_ids[file]} --> {node_ids[dep]}\n"
                        edge_count += 1

            md += "```\n\n"

            # Add usage guide
            md += """## 🤖 AI Assistant Usage Guide

This markdown file is optimized for use with AI assistants like ChatGPT, Claude, and GitHub Copilot.

### How to Use:

1. **Copy and paste this entire file** into your AI chat
2. Ask questions like:
   - "What are the main entry points of this project?"
   - "Which files have the most dependencies?"
   - "How does [file A] connect to [file B]?"
   - "What's the overall architecture pattern?"
   - "Which files should I look at first to understand the codebase?"

### Example Prompts:

- "Analyze the dependency graph and suggest potential refactoring opportunities"
- "Identify any circular dependencies or architectural issues"
- "Explain the data flow through this application"
- "What files would I need to modify to add [feature X]?"

---

*Generated by CodeGnosis - AI-Powered Project Analysis*
"""

            # Use custom path if provided, otherwise default location
            if custom_save_path:
                path = Path(custom_save_path)
            else:
                path = Path(self.project_path.get()) / "project_structure.md"

            with open(path, "w", encoding="utf-8") as f:
                f.write(md)

            self.app_state = "exported"
            self._update_instructions()

            # Ask if user wants to open the folder
            result = messagebox.askyesno(
                "Export Successful",
                f"AI-ready Markdown exported to:\n{path}\n\nOpen folder to view the file?",
                icon='info'
            )

            if result:
                self._open_folder(path.parent)
        except PermissionError as e:
            messagebox.showerror(
                "Permission Denied",
                f"Cannot write to the selected location.\n\n"
                f"Error: {e}\n\n"
                "Try:\n"
                "• Run as Administrator\n"
                "• Choose a different save location\n"
                "• Check folder permissions"
            )
        except Exception as e:
            messagebox.showerror("Error", f"Export failed: {e}\n\nPlease try saving to a different location.")

    def copy_for_ai(self):
        """Copy formatted project data to clipboard for AI assistants."""
        if not self.last_analyzer:
            messagebox.showwarning("Warning", "Generate chart first")
            return

        try:
            analyzer = self.last_analyzer
            project_name = Path(self.project_path.get()).name

            # Build clipboard content
            content = f"""PROJECT: {project_name}
TOTAL FILES: {len(analyzer.file_types)}
TOTAL CONNECTIONS: {sum(len(deps) for deps in analyzer.file_graph.values())}

FILE STRUCTURE:
"""

            for file, file_type in sorted(analyzer.file_types.items()):
                deps = analyzer.file_graph.get(file, [])
                content += f"\n{file} ({file_type})\n"
                if deps:
                    content += f"  Imports: {', '.join(deps)}\n"

            content += """\n
INSTRUCTIONS FOR AI:
Analyze this codebase structure. Help me understand:
1. The main architecture and patterns used
2. Key entry points and important files
3. Potential issues or improvements
4. Dependencies and relationships between files
"""

            # Copy to clipboard
            self.root.clipboard_clear()
            self.root.clipboard_append(content)
            self.root.update()

            messagebox.showinfo("Success", f"✓ Project structure copied to clipboard!\n\nPaste it into ChatGPT, Claude, or any AI assistant.\n\n{len(content)} characters copied.")
        except Exception as e:
            messagebox.showerror("Error", f"Copy failed: {e}")

    def export_chart(self, format):
        """Export chart to Excel."""
        if not self.last_image_path:
            messagebox.showwarning("Warning", "Generate chart first")
            return

        # Check if it's an SVG file
        if self.last_image_path.endswith('.svg'):
            messagebox.showinfo(
                "Large Project Detected",
                "Your project is too large for Excel export.\n\n"
                "The diagram was saved as SVG for scalability.\n\n"
                "Recommended alternatives:\n"
                "• Use 'Export HTML Report' for interactive viewing\n"
                "• Open the .svg file directly in your browser\n"
                "• Use the JSON or Markdown exports for AI analysis"
            )
            return

        try:
            base = Path(self.last_image_path).stem
            output = Path(self.last_image_path).parent / f"{base}.{format}"

            if format == "xlsx":
                if not OpenpyxlImage:
                    raise ImportError("openpyxl not installed")
                wb = Workbook()
                ws = wb.active
                if ws is not None:
                    ws.add_image(OpenpyxlImage(self.last_image_path), "A1")
                wb.save(str(output))

            messagebox.showinfo("Success", f"Exported to:\n{output}")

        except ImportError as e:
            messagebox.showerror(
                "Library Missing", f"Please install: pip install {str(e).split()[-1]}"
            )
        except Exception as e:
            messagebox.showerror("Error", f"Export failed: {e}")

    def _open_folder(self, folder_path):
        """Open folder in file explorer (cross-platform)."""
        try:
            folder_path = Path(folder_path)
            if not folder_path.exists():
                messagebox.showerror("Error", f"Folder not found:\n{folder_path}")
                return

            system = platform.system()
            if system == "Windows":
                os.startfile(folder_path)
            elif system == "Darwin":  # macOS
                subprocess.run(["open", str(folder_path)])
            else:  # Linux and others
                subprocess.run(["xdg-open", str(folder_path)])
        except Exception as e:
            messagebox.showerror("Error", f"Could not open folder:\n{e}")

    def view_last_chart(self):
        """Re-open the last exported HTML chart in browser."""
        if not self.last_html_path:
            messagebox.showinfo(
                "No Chart Available",
                "No HTML chart has been exported yet.\n\nGenerate a chart and export it as HTML first."
            )
            return

        if not self.last_html_path.exists():
            messagebox.showwarning(
                "File Not Found",
                f"The last chart file no longer exists:\n\n{self.last_html_path}\n\nIt may have been moved or deleted."
            )
            return

        # Open in browser
        self._open_in_browser(self.last_html_path)
        self.status.config(text=f"Opened: {self.last_html_path.name}")

    def open_chart_folder(self):
        """Open the folder containing the last exported chart."""
        # Determine which folder to open
        folder_to_open = None

        if self.last_html_path and self.last_html_path.exists():
            folder_to_open = self.last_html_path.parent
        elif self.last_json_path and self.last_json_path.exists():
            folder_to_open = self.last_json_path.parent
        elif self.last_image_path and Path(self.last_image_path).exists():
            folder_to_open = Path(self.last_image_path).parent
        else:
            # Fall back to project directory
            project_path = self.project_path.get()
            if project_path:
                folder_to_open = Path(project_path)

        if not folder_to_open:
            messagebox.showinfo(
                "No Folder Available",
                "No exports have been created yet.\n\nGenerate and export a chart first."
            )
            return

        # Open folder based on platform
        try:
            system = platform.system()
            if system == "Windows":
                os.startfile(folder_to_open)
            elif system == "Darwin":  # macOS
                subprocess.run(["open", str(folder_to_open)])
            else:  # Linux
                subprocess.run(["xdg-open", str(folder_to_open)])

            self.status.config(text=f"Opened folder: {folder_to_open.name}")
        except Exception as e:
            messagebox.showerror("Error", f"Could not open folder:\n{e}")

    def _open_in_browser(self, file_path):
        """Open HTML file in default browser."""
        try:
            file_path = Path(file_path)
            if not file_path.exists():
                messagebox.showerror("Error", f"File not found:\n{file_path}")
                return

            # Convert to file:// URL for proper browser opening
            file_url = file_path.as_uri()
            webbrowser.open(file_url)
        except Exception as e:
            messagebox.showerror("Error", f"Could not open browser:\n{e}")


if __name__ == "__main__":
    root = tk.Tk()
    app = CodeGnosisApp(root)
    root.mainloop()
