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
from pathlib import Path

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
    
    # Files to exclude from bundles (prevent recursive growth)
    exclude_patterns = [
        "ai_bundle_",  # Previous AI bundles
        ".exe",        # Executables
        ".dll",        # Libraries
        ".pdb",        # Debug symbols
        ".log",        # Log files
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
                with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                bundle_content.append("---")
                bundle_content.append(f"FILE: {rel_path}")
                bundle_content.append(f"CATEGORY: {info.get('category')}")
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

