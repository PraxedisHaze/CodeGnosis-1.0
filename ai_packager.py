"""BOM-STRICT"""
"""
ai_packager.py
==============
Utility to package analyzed code files into a single, LLM-ready context bundle.
Designed to be called by AnalyzerCore.
"""

import json
import os
import sys
import re
from pathlib import Path

# Chunk size threshold (50KB)
CHUNK_THRESHOLD_BYTES = 50 * 1024

# Regex patterns for splitting at function/class boundaries
CHUNK_PATTERNS = {
    "Python": [
        r'^(class\s+\w+)',           # class definitions
        r'^(def\s+\w+)',             # function definitions
        r'^(async\s+def\s+\w+)',     # async functions
    ],
    "JavaScript": [
        r'^(class\s+\w+)',           # class definitions
        r'^(function\s+\w+)',        # named functions
        r'^(const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)',  # arrow functions
        r'^(export\s+(?:default\s+)?(?:class|function|const))',  # exports
    ],
    "TypeScript": [
        r'^(class\s+\w+)',
        r'^(function\s+\w+)',
        r'^(const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)',
        r'^(export\s+(?:default\s+)?(?:class|function|const|interface|type))',
        r'^(interface\s+\w+)',
        r'^(type\s+\w+)',
    ],
    "TypeScript React": [
        r'^(class\s+\w+)',
        r'^(function\s+\w+)',
        r'^(const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)',
        r'^(export\s+(?:default\s+)?(?:class|function|const|interface|type))',
    ],
    "React": [
        r'^(class\s+\w+)',
        r'^(function\s+\w+)',
        r'^(const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)',
        r'^(export\s+)',
    ],
    "Rust": [
        r'^(fn\s+\w+)',              # functions
        r'^(pub\s+fn\s+\w+)',        # public functions
        r'^(impl\s+)',               # implementations
        r'^(struct\s+\w+)',          # structs
        r'^(enum\s+\w+)',            # enums
        r'^(trait\s+\w+)',           # traits
    ],
}


def chunk_large_file(content, category, rel_path):
    """
    Split large files at function/class boundaries.
    Returns list of (chunk_content, chunk_index, total_chunks, context).
    """
    patterns = CHUNK_PATTERNS.get(category, [])
    if not patterns:
        # No patterns for this category - return as single chunk
        return [(content, 1, 1, "full_file")]

    # Combine patterns into one regex
    combined_pattern = '|'.join(f'({p})' for p in patterns)

    lines = content.split('\n')
    chunks = []
    current_chunk_lines = []
    current_context = "header"

    for line in lines:
        # Check if this line starts a new logical block
        match = re.match(combined_pattern, line.strip(), re.MULTILINE)
        if match and current_chunk_lines:
            # Save current chunk
            chunk_text = '\n'.join(current_chunk_lines)
            if chunk_text.strip():
                chunks.append((chunk_text, current_context))
            current_chunk_lines = [line]
            # Extract context from the match
            current_context = match.group(0)[:50].strip()
        else:
            current_chunk_lines.append(line)

    # Don't forget the last chunk
    if current_chunk_lines:
        chunk_text = '\n'.join(current_chunk_lines)
        if chunk_text.strip():
            chunks.append((chunk_text, current_context))

    # If we only got one chunk, return it
    if len(chunks) <= 1:
        return [(content, 1, 1, "full_file")]

    # Format chunks with indices
    total = len(chunks)
    return [(text, idx + 1, total, ctx) for idx, (text, ctx) in enumerate(chunks)]

def package_for_ai(report_data, output_path, project_root):
    """
    Aggregates code content based on the analysis report.
    """
    print(f"[packager] Packaging project for AI: {report_data.get('projectName', 'Unknown')}", file=sys.stderr)
    
    project_root = Path(project_root)
    bundle_content = []
    
    bundle_content.append("================================================================================")
    bundle_content.append(f"CODEGNOSIS AI CONTEXT BUNDLE - {report_data.get('projectName', 'Unknown')}")
    bundle_content.append(f"Generated At: {report_data.get('generatedAt', 'Unknown')}")
    bundle_content.append("================================================================================\n")
    
    # Add summary
    summary = report_data.get('summary', {})
    bundle_content.append("## PROJECT SUMMARY")
    bundle_content.append(f"- Total Files: {summary.get('totalFiles')}")
    bundle_content.append(f"- Languages: {summary.get('languages')}")
    bundle_content.append(f"- Frameworks: {summary.get('detectedFrameworks')}")
    bundle_content.append(f"- Project Type: {summary.get('projectType')}\n")
    
    # Process files
    files_data = report_data.get('files', {})
    processed_count = 0
    
    # Files to exclude from bundles (prevent recursive growth and bloat)
    exclude_patterns = [
        "ai_bundle_",      # Previous AI bundles
        ".exe",            # Executables
        ".dll",            # Libraries
        ".pdb",            # Debug symbols
        ".log",            # Log files
        "node_modules/",   # NPM dependencies (massive bloat)
        "dist/",           # Build output
        "build/",          # Build output
        "target/",         # Rust build artifacts
        ".git/",           # Git internals
        "__pycache__/",    # Python bytecode
        "package-lock.json",  # NPM lockfile (huge, not useful)
        ".map",            # Source maps
        ".min.js",         # Minified JS (unreadable)
        ".min.css",        # Minified CSS (unreadable)
    ]

    for rel_path, info in files_data.items():
        # Skip binaries
        if info.get('category') in ["Image", "Video", "Audio", "Font", "Archive", "Executable"]:
            continue

        # Skip files matching exclude patterns (prevents recursive bundle growth)
        if any(pattern in rel_path for pattern in exclude_patterns):
            continue
            
        full_path = project_root / rel_path
        
        try:
            if full_path.exists():
                file_size = full_path.stat().st_size
                category = info.get('category', 'Unknown')

                with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()

                # Check if file needs chunking
                if file_size > CHUNK_THRESHOLD_BYTES:
                    chunks = chunk_large_file(content, category, rel_path)
                    for chunk_content, chunk_idx, chunk_total, context in chunks:
                        bundle_content.append("---")
                        bundle_content.append(f"FILE: {rel_path} | CHUNK: {chunk_idx}/{chunk_total} | CONTEXT: {context}")
                        bundle_content.append(f"CATEGORY: {category}")
                        bundle_content.append("-----")
                        bundle_content.append(chunk_content)
                        bundle_content.append("\n")
                    processed_count += 1
                    print(f"[packager] Chunked large file: {rel_path} ({chunk_total} chunks)", file=sys.stderr)
                else:
                    bundle_content.append("---")
                    bundle_content.append(f"FILE: {rel_path}")
                    bundle_content.append(f"CATEGORY: {category}")
                    bundle_content.append("-----")
                    bundle_content.append(content)
                    bundle_content.append("\n")
                    processed_count += 1
        except Exception as e:
            bundle_content.append(f"\n[!] ERROR READING FILE {rel_path}: {e}\n")

    # Write the bundle
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(bundle_content))
        print(f"[packager] AI Bundle created successfully: {output_path} ({processed_count} files included)", file=sys.stderr)
        return True
    except Exception as e:
        print(f"[packager] Failed to write AI Bundle: {e}", file=sys.stderr)
        return False

if __name__ == "__main__":
    # For standalone testing
    import sys
    if len(sys.argv) > 3:
        with open(sys.argv[1], 'r') as f:
            data = json.load(f)
        package_for_ai(data, sys.argv[2], sys.argv[3])

