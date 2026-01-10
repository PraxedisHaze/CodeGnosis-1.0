"""BOM-STRICT"""
"""
ai_packager.py
==============
Utility to package analyzed code files into LLM-ready context bundles.
Designed to be called by AnalyzerCore.

KEY PRINCIPLE: WE DO NOT SHORT THE USER ON WHAT THEY CAN SCAN.
WE MEET THEM WHERE THEY ARE AT.

If a project is too large for one context window, we split it into
multiple bundles at ~40KB each (leaving room for other context).
"""

import json
import os
import sys
import re
from pathlib import Path
from datetime import datetime

# Bundle size threshold: 40KB to leave room for conversation context
BUNDLE_SIZE_LIMIT = 40 * 1024  # 40KB per bundle

# Chunk size threshold for individual large files: 50KB
FILE_CHUNK_THRESHOLD = 50 * 1024

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

# Files to exclude from bundles
EXCLUDE_PATTERNS = [
    "ai_bundle_",      # Previous AI bundles
    "ai-bundle",       # JSON bundles
    ".exe",            # Executables
    ".dll",            # Libraries
    ".pdb",            # Debug symbols
    ".log",            # Log files
    "node_modules/",   # NPM dependencies
    "dist/",           # Build output
    "build/",          # Build output
    "target/",         # Rust build artifacts
    ".git/",           # Git internals
    "__pycache__/",    # Python bytecode
    "package-lock.json",
    ".map",            # Source maps
    ".min.js",         # Minified JS
    ".min.css",        # Minified CSS
    "_archive/",       # Archives
]


def chunk_large_file(content, category, rel_path):
    """
    Split large files at function/class boundaries.
    Returns list of (chunk_content, chunk_index, total_chunks, context).
    """
    patterns = CHUNK_PATTERNS.get(category, [])
    if not patterns:
        return [(content, 1, 1, "full_file")]

    combined_pattern = '|'.join(f'({p})' for p in patterns)
    lines = content.split('\n')
    chunks = []
    current_chunk_lines = []
    current_context = "header"

    for line in lines:
        match = re.match(combined_pattern, line.strip(), re.MULTILINE)
        if match and current_chunk_lines:
            chunk_text = '\n'.join(current_chunk_lines)
            if chunk_text.strip():
                chunks.append((chunk_text, current_context))
            current_chunk_lines = [line]
            current_context = match.group(0)[:50].strip()
        else:
            current_chunk_lines.append(line)

    if current_chunk_lines:
        chunk_text = '\n'.join(current_chunk_lines)
        if chunk_text.strip():
            chunks.append((chunk_text, current_context))

    if len(chunks) <= 1:
        return [(content, 1, 1, "full_file")]

    total = len(chunks)
    return [(text, idx + 1, total, ctx) for idx, (text, ctx) in enumerate(chunks)]


def categorize_file(rel_path, info):
    """Categorize file by its role in the project."""
    category = info.get('category', 'Unknown')
    path_lower = rel_path.lower()

    if 'test' in path_lower or 'spec' in path_lower:
        return 'tests'
    elif any(x in path_lower for x in ['config', '.json', '.toml', '.yaml', '.yml', '.env']):
        return 'config'
    elif category in ['Markdown', 'Text']:
        return 'docs'
    elif info.get('isEntryPoint', False):
        return 'core'
    elif info.get('inboundCount', 0) > 5:
        return 'core'  # Hub files
    else:
        return 'src'


def create_bundle_header(project_name, bundle_index, total_bundles, focus_area, timestamp):
    """Create a header for an AI bundle."""
    header = []
    header.append("=" * 80)
    header.append(f"CODEGNOSIS AI CONTEXT BUNDLE")
    header.append(f"Project: {project_name}")
    header.append(f"Bundle: {bundle_index} of {total_bundles}")
    header.append(f"Focus: {focus_area}")
    header.append(f"Generated: {timestamp}")
    header.append("=" * 80)
    header.append("")
    header.append("NOTE: This is a chunked bundle. Other bundles contain additional files.")
    header.append(f"To see all files, request bundles 1-{total_bundles}.")
    header.append("")
    return '\n'.join(header)


def create_cross_reference(all_bundles, current_index):
    """Create cross-reference section showing what's in other bundles."""
    xref = []
    xref.append("## CROSS-REFERENCE (Other Bundles)")
    for idx, bundle in enumerate(all_bundles, 1):
        if idx == current_index:
            continue
        xref.append(f"- Bundle {idx} ({bundle['focus']}): {len(bundle['files'])} files")
        # Show first 5 files
        for f in bundle['files'][:5]:
            xref.append(f"    - {f}")
        if len(bundle['files']) > 5:
            xref.append(f"    - ... and {len(bundle['files']) - 5} more")
    xref.append("")
    return '\n'.join(xref)


def package_for_ai(report_data, output_path, project_root):
    """
    Aggregates code content based on the analysis report.
    Creates multiple bundles if project exceeds 40KB per bundle.
    """
    print(f"[packager] Packaging project for AI: {report_data.get('projectName', 'Unknown')}", file=sys.stderr)

    project_root = Path(project_root)
    project_name = report_data.get('projectName', 'Unknown')
    timestamp = report_data.get('generatedAt', datetime.now().isoformat())

    # Collect all eligible files with their content
    files_data = report_data.get('files', {})
    all_files = []

    for rel_path, info in files_data.items():
        # Skip binaries
        if info.get('category') in ["Image", "Video", "Audio", "Font", "Archive", "Executable"]:
            continue

        # Skip excluded patterns
        if any(pattern in rel_path for pattern in EXCLUDE_PATTERNS):
            continue

        full_path = project_root / rel_path

        try:
            if full_path.exists():
                file_size = full_path.stat().st_size
                category = info.get('category', 'Unknown')

                with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()

                role = categorize_file(rel_path, info)

                # Chunk large files
                if file_size > FILE_CHUNK_THRESHOLD:
                    chunks = chunk_large_file(content, category, rel_path)
                    for chunk_content, chunk_idx, chunk_total, context in chunks:
                        all_files.append({
                            'path': rel_path,
                            'category': category,
                            'role': role,
                            'content': chunk_content,
                            'chunk': f"{chunk_idx}/{chunk_total}",
                            'context': context,
                            'size': len(chunk_content.encode('utf-8'))
                        })
                else:
                    all_files.append({
                        'path': rel_path,
                        'category': category,
                        'role': role,
                        'content': content,
                        'chunk': None,
                        'context': None,
                        'size': len(content.encode('utf-8'))
                    })
        except Exception as e:
            print(f"[packager] Error reading {rel_path}: {e}", file=sys.stderr)

    # Sort files: core first, then src, then config, then tests, then docs
    role_order = {'core': 0, 'src': 1, 'config': 2, 'tests': 3, 'docs': 4}
    all_files.sort(key=lambda x: (role_order.get(x['role'], 5), x['path']))

    # Calculate total size
    total_size = sum(f['size'] for f in all_files)
    print(f"[packager] Total content size: {total_size / 1024:.1f} KB across {len(all_files)} file chunks", file=sys.stderr)

    # Split into bundles at 40KB boundaries
    bundles = []
    current_bundle = {'files': [], 'content': [], 'size': 0, 'focus': ''}
    current_role = None

    for file_info in all_files:
        file_entry = []
        file_entry.append("---")
        if file_info['chunk']:
            file_entry.append(f"FILE: {file_info['path']} | CHUNK: {file_info['chunk']} | CONTEXT: {file_info['context']}")
        else:
            file_entry.append(f"FILE: {file_info['path']}")
        file_entry.append(f"CATEGORY: {file_info['category']} | ROLE: {file_info['role']}")
        file_entry.append("---")
        file_entry.append(file_info['content'])
        file_entry.append("")

        entry_text = '\n'.join(file_entry)
        entry_size = len(entry_text.encode('utf-8'))

        # Check if we need to start a new bundle
        if current_bundle['size'] + entry_size > BUNDLE_SIZE_LIMIT and current_bundle['files']:
            # Finalize current bundle
            if current_bundle['files']:
                # Determine focus from dominant role
                roles = [f.split('|')[-1].strip() for f in current_bundle['files'] if '|' in f]
                focus = roles[0] if roles else 'mixed'
                current_bundle['focus'] = focus
                bundles.append(current_bundle)
            current_bundle = {'files': [], 'content': [], 'size': 0, 'focus': ''}

        current_bundle['files'].append(file_info['path'])
        current_bundle['content'].append(entry_text)
        current_bundle['size'] += entry_size

    # Don't forget the last bundle
    if current_bundle['files']:
        roles = [all_files[i]['role'] for i, f in enumerate(all_files) if f['path'] in current_bundle['files']]
        focus = max(set(roles), key=roles.count) if roles else 'mixed'
        current_bundle['focus'] = focus
        bundles.append(current_bundle)

    total_bundles = len(bundles)
    print(f"[packager] Splitting into {total_bundles} bundles", file=sys.stderr)

    # Prepare bundle metadata for cross-references
    bundle_meta = [{'focus': b['focus'], 'files': b['files']} for b in bundles]

    # Write bundles
    output_path = Path(output_path)
    base_name = output_path.stem
    output_dir = output_path.parent

    written_files = []

    for idx, bundle in enumerate(bundles, 1):
        if total_bundles == 1:
            bundle_path = output_path
        else:
            bundle_path = output_dir / f"{base_name}_part{idx}of{total_bundles}.txt"

        bundle_content = []

        # Header
        bundle_content.append(create_bundle_header(
            project_name, idx, total_bundles, bundle['focus'], timestamp
        ))

        # Summary section (only in first bundle)
        if idx == 1:
            summary = report_data.get('summary', {})
            bundle_content.append("## PROJECT SUMMARY")
            bundle_content.append(f"- Total Files: {summary.get('totalFiles')}")
            bundle_content.append(f"- Languages: {summary.get('languages')}")
            bundle_content.append(f"- Frameworks: {summary.get('detectedFrameworks')}")
            bundle_content.append(f"- Project Type: {summary.get('projectType')}")
            bundle_content.append("")

            # Build profile if available
            build_profile = report_data.get('buildProfile', {})
            if build_profile:
                bundle_content.append("## BUILD PROFILE")
                dev = build_profile.get('devFootprint', {})
                bundle_content.append(f"- Dev Footprint: {dev.get('total', 'Unknown')}")
                for k, v in dev.get('breakdown', {}).items():
                    bundle_content.append(f"    - {k}: {v}")

                ship = build_profile.get('shippingWeight', {})
                bundle_content.append(f"- Shipping Weight: {ship.get('total', 'Unknown')}")
                for inst in ship.get('installers', []):
                    bundle_content.append(f"    - {inst['name']}: {inst['size']}")

                deps = build_profile.get('dependencies', {})
                npm_deps = deps.get('npm', [])
                if npm_deps:
                    bundle_content.append(f"- Top NPM Dependencies ({len(npm_deps)} shown):")
                    for dep in npm_deps[:10]:
                        version = dep.get('version', '')
                        bundle_content.append(f"    - {dep['name']} {version}: {dep['size']}")

                cargo_deps = deps.get('cargo', [])
                if cargo_deps:
                    bundle_content.append(f"- Cargo Dependencies ({len(cargo_deps)}):")
                    for dep in cargo_deps:
                        bundle_content.append(f"    - {dep['name']}: {dep['version']}")

                bundle_content.append("")

        # Cross-reference (for multi-bundle)
        if total_bundles > 1:
            bundle_content.append(create_cross_reference(bundle_meta, idx))

        # File content
        bundle_content.append("## FILES IN THIS BUNDLE")
        bundle_content.append(f"({len(bundle['files'])} files)")
        bundle_content.append("")
        bundle_content.extend(bundle['content'])

        # Write
        try:
            with open(bundle_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(bundle_content))
            written_files.append(str(bundle_path))
            print(f"[packager] Bundle {idx}/{total_bundles} written: {bundle_path} ({bundle['size'] / 1024:.1f} KB)", file=sys.stderr)
        except Exception as e:
            print(f"[packager] Failed to write bundle {idx}: {e}", file=sys.stderr)

    print(f"[packager] AI packaging complete: {len(written_files)} bundle(s) created", file=sys.stderr)
    return written_files


if __name__ == "__main__":
    if len(sys.argv) > 3:
        with open(sys.argv[1], 'r') as f:
            data = json.load(f)
        package_for_ai(data, sys.argv[2], sys.argv[3])
