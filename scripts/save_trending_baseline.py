"""
Save trending baseline snapshots for comparing request counts between email fetches.
period_start: saved 2 days before the next scheduled fetch.
period_end: saved the day after emails were fetched (last_email_fetch.txt updated).
"""

import json
import sys
from pathlib import Path
from datetime import date, datetime, timedelta, timezone

REPO_ROOT = Path(__file__).resolve().parents[1]
REQUESTS_JSON = REPO_ROOT / "src/assets/requests.json"
BASELINE_PATH = REPO_ROOT / "src/assets/stats/trending_baseline.json"
LAST_FETCH_PATH = REPO_ROOT / "src/assets/last_email_fetch.txt"
MAPUTO = timezone(timedelta(hours=2))

def load_baseline():
    if BASELINE_PATH.exists():
        with open(BASELINE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"period_start": None, "period_end": None}


def save_baseline(data):
    with open(BASELINE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def build_snapshot(apps, min_req=10):
    snapshot = {}
    for app in apps:
        comp = app.get("componentName", "")
        req = app.get("requestCount", 0)
        if comp and req >= min_req:
            snapshot[comp] = req
    return snapshot


def get_next_fetch_date():
    if not LAST_FETCH_PATH.exists():
        return None
    last = date.fromisoformat(LAST_FETCH_PATH.read_text().strip())
    return last + timedelta(days=30)


def main():
    today = datetime.now(MAPUTO).date()
    baseline = load_baseline()

    with open(REQUESTS_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    apps = data["apps"]
    total = data.get("count", len(apps))
    snapshot = build_snapshot(apps)

    entry = {
        "date": today.isoformat(),
        "total": total,
        "snapshot": snapshot
    }

    next_fetch = get_next_fetch_date()

    # period_start: 2 days before next fetch
    if next_fetch:
        two_days_before_fetch = next_fetch - timedelta(days=2)
        if today == two_days_before_fetch:
            baseline["period_start"] = entry
            print(f"Saved period_start with {len(snapshot)} entries")
            save_baseline(baseline)
            return

    # period_end: day after last fetch
    if LAST_FETCH_PATH.exists():
        last_fetch = date.fromisoformat(LAST_FETCH_PATH.read_text().strip())
        day_after_fetch = last_fetch + timedelta(days=1)
        if today == day_after_fetch:
            start_snapshot = baseline.get("period_start", {}).get("snapshot", {})
            filtered_snapshot = {k: v for k, v in snapshot.items() if k in start_snapshot}
            entry["snapshot"] = filtered_snapshot
            baseline["period_end"] = entry
            print(f"Saved period_end with {len(filtered_snapshot)} entries")
            save_baseline(baseline)
            return

    print("No snapshot needed at this time.")


if __name__ == "__main__":
    main()