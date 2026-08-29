#!/usr/bin/env python3
"""
Incremental SVG reviewer for Lawnicons dashboard.
Checks 100 new icons + 100 from review_issues.json per run.
Updates review_issues.json and review_pass.json.
"""

import json
import subprocess
import sys
import random
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
ASSETS_DIR = REPO_ROOT / "src/assets/qa_issues"
REVIEW_ISSUES_PATH = ASSETS_DIR / "review_issues.json"
REVIEW_PASS_PATH = ASSETS_DIR / "review_pass.json"
LAWNICONS_SVGS_DIR = REPO_ROOT / "src/assets/qa_issues/svgs"
LINTER_PATH = REPO_ROOT / "scripts/lint_icons.py"

NEW_PER_RUN = 100
REVIEW_PER_RUN = 100


def load_json(path):
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return []


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)


def get_all_icons():
    if not LAWNICONS_SVGS_DIR.exists():
        print(f"Lawnicons SVGs not found at {LAWNICONS_SVGS_DIR}")
        return []
    return sorted(p.stem for p in LAWNICONS_SVGS_DIR.glob("*.svg"))


def run_linter(icons):
    files = [str(LAWNICONS_SVGS_DIR / f"{icon}.svg") for icon in icons]
    result = subprocess.run(
        [sys.executable, str(LINTER_PATH), "--format", "json"] + files,
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"Linter error: {result.stderr}")
        return {}
    
    try:
        reports = json.loads(result.stdout)
    except json.JSONDecodeError:
        print(f"Failed to parse linter output")
        return {}

    ALLOWED_RULES = {'C01', 'C05', 'C06', 'C07', 'O01'}   
    findings = {}
    for report in reports:
        drawable = Path(report["file_path"]).stem
        issues = [
            r["message"] for r in report.get("results", [])
            if r.get("status") == "FAIL" and r.get("id") in ALLOWED_RULES
        ]
        if issues:
            findings[drawable] = issues
    
    return findings


def main():
    all_icons = get_all_icons()
    if not all_icons:
        print("No icons found. Make sure Lawnicons repo is cloned.")
        return

    review_issues = load_json(REVIEW_ISSUES_PATH)
    review_pass = load_json(REVIEW_PASS_PATH)

    issues_map = {item["drawable"]: item["issues"] for item in review_issues}
    pass_set = set(review_pass)
    checked_set = set(issues_map.keys()) | pass_set

    # Pick 90 new icons
    new_icons = [i for i in all_icons if i not in checked_set][:NEW_PER_RUN]

    # Pick random from review_issues for re-check
    review_icons = random.sample(list(issues_map.keys()), min(REVIEW_PER_RUN, len(issues_map)))

    to_check = new_icons + review_icons
    if not to_check:
        print("No icons to check.")
        return

    print(f"Checking {len(new_icons)} new + {len(review_icons)} review = {len(to_check)} icons...")
    findings = run_linter(to_check)

    # Update review_issues
    new_issues_map = {}
    for icon in review_icons:
        if icon in findings:
            new_issues_map[icon] = findings[icon]
        else:
            pass_set.add(icon)

    for icon in new_icons:
        if icon in findings:
            new_issues_map[icon] = findings[icon]
        else:
            pass_set.add(icon)

    # Merge with existing issues (keep those not re-checked this run)
    for icon, issues in issues_map.items():
        if icon not in review_icons:
            new_issues_map[icon] = issues

    review_issues = [
        {"drawable": icon, "issues": issues}
        for icon, issues in sorted(new_issues_map.items())
    ]
    review_pass = sorted(pass_set)

    save_json(REVIEW_ISSUES_PATH, review_issues)
    save_json(REVIEW_PASS_PATH, review_pass)

    new_issues = sum(1 for i in new_icons if i in findings)
    fixed = sum(1 for i in review_icons if i not in findings)
    print(f"New issues: {new_issues}, Fixed: {fixed}")
    print(f"Total issues: {len(review_issues)}, Total passed: {len(review_pass)}")


if __name__ == "__main__":
    main()