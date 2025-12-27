# CodeGnosis - Project Analyzer

CodeGnosis is a powerful tool for developers and project managers to visualize and understand the architecture of software projects. It scans your codebase, identifies dependencies, and generates interactive diagrams and reports.

---

## Features

* **Visual Architecture Diagrams:** Automatically generate a Graphviz-powered dependency chart of your project.
* **Multi-Language Support:** Works with a wide range of languages including Python, JavaScript, TypeScript, Java, C#, and more.
* **Interactive UI:** An easy-to-use interface with features like zooming, panning, and theme selection (**Light, Dark, and Saturated**).
* **Progressive Control:** Interface controls are enabled progressively to guide the user workflow.
* **Multiple Export Formats:** Export your project analysis to:
  * **JSON** (for structured data and further processing)
  * **Interactive HTML** reports (optimized for large projects)
  * Markdown (for documentation)
  * Microsoft Excel (XLSX)
* **Project Health:** Reports **Fractures** (broken references) and **Drift** (orphaned files).

## How to Use

1. **Launch CodeGnosis:** Double-click the `CodeGnosis.exe` file.
2. **Select Directory:** Click the **"Select Directory"** button (1) and choose the root folder of your project.
3. **Configure (Optional):**
    * Use the **Language Template** menu (2) to automatically filter extensions.
    * Specify folders to exclude (e.g., `node_modules`, `.git`).
4. **Generate Chart:** Click the **"Generate Visual Chart"** button (3) to create the dependency graph.
5. **Export:** Use the export buttons (4) to save the analysis in your desired format or use **Copy to Clipboard** for instant sharing.

## 🛠️ Building from Source

To build CodeGnosis from source:

1. **Dependencies:** Ensure you have **Graphviz** installed on your system (required for visual charts) and install Python dependencies:

    ```bash
    pip install -r requirements.txt
    pip install pyinstaller
    ```

2. **Build the Analyzer:** Run the following command to create the executable:

    ```bash
    pyinstaller --onefile --windowed --name="CodeGnosis" "analyzer_core.py"
    ```

    *This command bundles the Python analysis engine into a standalone executable.*