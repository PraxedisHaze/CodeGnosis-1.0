"""BOM-STRICT"""
"""
ghost_protocol.py
=================
Utility to perform a "Clean Hands" compliance audit.
Checks for license risks and mandatory file headers.
Now reads configuration from codegnosis.config.json for customizable compliance.
"""

import os
import json
from pathlib import Path
import re

def load_config(project_root):
    """
    Load compliance configuration from codegnosis.config.json.
    Falls back to defaults if file doesn't exist or is invalid.
    """
    config_path = Path(project_root) / "codegnosis.config.json"
    default_config = {
        "compliance_checks": {
            "required_header_text": "",
            "mandatory_files": [],
            "forbidden_licenses": ["AGPL", "GPL", "LGPL"]
        }
    }

    if not config_path.exists():
        return default_config

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        # Merge with defaults to ensure all keys exist
        compliance = config.get("compliance_checks", {})
        return {
            "compliance_checks": {
                "required_header_text": compliance.get("required_header_text", ""),
                "mandatory_files": compliance.get("mandatory_files", []),
                "forbidden_licenses": compliance.get("forbidden_licenses", ["AGPL", "GPL", "LGPL"])
            }
        }
    except Exception as e:
        import sys
        print(f"[compliance] Warning: Could not load config file: {e}", file=sys.stderr)
        return default_config

def perform_compliance_scan(report_data, project_root):
    """
    Scans analyzed files for legal and structural compliance.
    Reads rules from codegnosis.config.json for customizable checks.
    """
    import sys
    print(f"[compliance] Initiating Ghost Protocol Scan: {report_data.get('projectName', 'Unknown')}", file=sys.stderr)

    project_root = Path(project_root)

    # Load configuration
    config = load_config(project_root)
    compliance_config = config["compliance_checks"]

    compliance_report = {
        "status": "Incomplete",
        "violations": [],
        "warnings": [],
        "passed": 0,
        "failed": 0
    }

    # 1. License Check (from config)
    forbidden_licenses = compliance_config.get("forbidden_licenses", [])
    if not forbidden_licenses:
        forbidden_licenses = ["AGPL", "GPL", "LGPL"]  # Fallback defaults
    
    # Check package.json
    package_json = project_root / "package.json"
    if package_json.exists():
        with open(package_json, 'r') as f:
            content = f.read().upper()
            for lic in forbidden_licenses:
                if lic in content:
                    compliance_report["violations"].append(f"Potential viral license detected in package.json: {lic}")
                    compliance_report["failed"] += 1

    # 2. Mandatory Files Check (from config)
    mandatory_files = compliance_config.get("mandatory_files", [])
    for required_file in mandatory_files:
        file_path = project_root / required_file
        if not file_path.exists():
            compliance_report["violations"].append(f"Mandatory file missing: {required_file}")
            compliance_report["failed"] += 1
        else:
            compliance_report["passed"] += 1

    # 3. Check for THIRD_PARTY_NOTICES.txt (legacy check, kept for backwards compatibility)
    notices_file = project_root / "THIRD_PARTY_NOTICES.txt"
    if not notices_file.exists():
        compliance_report["warnings"].append("Section 13.1 Breach: THIRD_PARTY_NOTICES.txt is missing from root.")
        compliance_report["failed"] += 1
    else:
        compliance_report["passed"] += 1

    # 4. Header Check (from config - skipped if empty)
    required_header = compliance_config.get("required_header_text", "")

    if required_header:
        # User has defined a required header - check for it
        files_data = report_data.get('files', {})
        sample_files = [f for f, info in files_data.items() if info.get('category') in ["Python", "TypeScript", "TypeScript React", "JavaScript", "Rust", "Go", "Java", "C#", "C++", "C"]]

        for rel_path in sample_files[:10]:
            full_path = project_root / rel_path
            try:
                with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                    header = f.read(500)  # Read first 500 chars
                    if required_header not in header:
                        compliance_report["warnings"].append(f"Header Breach: Required header missing in {rel_path}")
                        compliance_report["failed"] += 1
                    else:
                        compliance_report["passed"] += 1
            except:
                pass
    # If no required_header_text is configured, skip header check entirely
    # This keeps CodeGnosis friendly to indie developers out-of-the-box

    if compliance_report["failed"] == 0:
        compliance_report["status"] = "CLEAN HANDS"
    
    print(f"[compliance] Compliance Scan Finished: Status={compliance_report['status']}", file=sys.stderr)
    return compliance_report

if __name__ == "__main__":
    # For standalone testing
    import sys
    import json
    if len(sys.argv) > 2:
        with open(sys.argv[1], 'r') as f:
            data = json.load(f)
        perform_compliance_scan(data, sys.argv[2])
