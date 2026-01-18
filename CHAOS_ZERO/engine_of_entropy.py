"""
ENGINE OF ENTROPY
=================
A Destructor-Constructor for CodeGnosis.
Generates a 'Chaos Dataset' designed to trigger every possible warning, error, 
and topological fracture in the CodeGnosis analyzer.

TARGET: ./havoc_project/
SCOPE: CHAOS_ZERO (Quarantine Zone)
AUTHOR: GEMINI (Destructo)

INTENTIONAL FLAWS:
1. Circular Dependencies (The Ouroboros)
2. Orphaned Code (The Void)
3. Monster Files (Gravity Singularities)
4. Forbidden Patterns (Secrets, Evals)
5. License Violations (Viral Headers)
6. Deep Nesting (The Trench)
7. Dissonance (Empty Managers high in the tree)
"""

import os
from pathlib import Path
import random

# CONFIGURATION
BASE_DIR = Path("havoc_project")
FILES_COUNT = 50
DEPTH_MAX = 8

# CONTENT TEMPLATES (The Poison)
LICENSE_AGPL = """/* SPDX-License-Identifier: AGPL-3.0-only */
/* WARNING: VIRAL LICENSE DETECTED */
"""

SECRET_KEY = """
const AWS_SECRET = "EXAMPLE_KEY_NOT_REAL_12345"; // HARDCODED SECRET
const STRIPE_KEY = "sk_test_CHAOS_MODE_NOT_A_REAL_KEY";
"""

EVAL_BOMB = """
function executeChaos(input) {
    eval(input); // SECURITY RISK
    document.write(input); // XSS RISK
}
"""

MONSTER_CONTENT = "\n".join([f"function void_{{i}}() {{ return 'entropy'; }}" for i in range(5000)])

def ensure_dir(path):
    if not path.exists():
        os.makedirs(path)

def create_file(path, content):
    ensure_dir(path.parent)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def generate_chaos():
    root = Path.cwd() / BASE_DIR
    if root.exists():
        # Safety check: simplistic cleanup
        import shutil
        shutil.rmtree(root)
    
    ensure_dir(root)
    print(f"Igniting Entropy in {root}...")

    # 1. THE OUROBOROS (Circular Dependency Chain)
    # A -> B -> C -> A
    create_file(root / "ouroboros/alpha.js", 'import { beta } from "./beta"; export const alpha = beta + 1;')
    create_file(root / "ouroboros/beta.js", 'import { gamma } from "./gamma"; export const beta = gamma + 1;')
    create_file(root / "ouroboros/gamma.js", 'import { alpha } from "./alpha"; export const gamma = alpha + 1;')

    # 2. THE SINGULARITY (Monster File)
    # High Gravity, Low Logic
    create_file(root / "core/blackhole.ts", LICENSE_AGPL + MONSTER_CONTENT)

    # 3. THE TRENCH (Deep Nesting)
    deep_path = root / "level1/level2/level3/level4/level5/level6/level7/bottom.py"
    create_file(deep_path, "print('I am deep')")

    # 4. THE MINEFIELD (Security Risks)
    create_file(root / "config/secrets.js", SECRET_KEY)
    create_file(root / "utils/dangerous.js", EVAL_BOMB)

    # 5. THE DISSONANCE (High Status, No Weight)
    # Root level manager with zero logic
    create_file(root / "EnterpriseManager.java", "class EnterpriseManager {}")

    # 6. THE VOID (Orphans)
    for i in range(10):
        create_file(root / f"orphans/lost_soul_{{i}}.txt", f"I am alone {i}")

    print("Chaos Generated. Ready for Analysis.")

if __name__ == "__main__":
    generate_chaos()
