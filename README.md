# CodeGnosis

CodeGnosis is a powerful tool for developers and project managers to visualize and understand the architecture of software projects. It scans your codebase, identifies dependencies, and generates interactive diagrams and reports.

## Features

*   **Visual Architecture Diagrams:** Automatically generate a Graphviz-powered dependency chart of your project.
*   **Multi-Language Support:** Works with a wide range of languages including Python, JavaScript, TypeScript, Java, C#, and more.
*   **Interactive UI:** An easy-to-use interface with features like zooming, panning, and theme selection (dark/light).
*   **Multiple Export Formats:** Export your project analysis to:
    *   JSON (for AI context or further processing)
    *   Interactive HTML reports
    *   PDF
    *   Microsoft Word (DOCX)
    *   Microsoft PowerPoint (PPTX)
    *   Microsoft Excel (XLSX)
*   **System Tray Integration:** Runs discreetly in the system tray.

## How to Use

1.  **Launch CodeGnosis:** Double-click the `CodeGnosis.exe` file.
2.  **Select Directory:** Click the "Select Directory" button and choose the root folder of your project.
3.  **Configure (Optional):**
    *   Specify a comma-separated list of file extensions to include in the scan. Leave blank to scan all files.
    *   Specify a comma-separated list of folders to exclude (e.g., `node_modules`, `.git`).
4.  **Generate Chart:** Click the "Generate Visual Chart" button to create the dependency graph.
5.  **Export:** Use the export buttons to save the analysis in your desired format.

## Installation

No installation is required. Simply run the `CodeGnosis.exe` file from the `dist` folder.

## Building from Source

If you want to build the project from source, you'll need Python 3 and the following dependencies:

```
pip install -r requirements.txt
pip install pyinstaller
```

Then, run the following command to create the executable:

```
pyinstaller --onefile --windowed --name="CodeGnosis" "codegnosis.py"
```
