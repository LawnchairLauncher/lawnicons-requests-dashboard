import csv
import json
import time
from datetime import datetime

# CONFIG
NEW_JSON_PATH = "docs/assets/requests.json"
LEGACY_CSV_PATH = "docs/assets/legacy.csv"
OUTPUT_PATH = "docs/assets/requests_merged.json"

# HARDCODED DATES (Unix Timestamp)
DATE_LEGACY_DEFAULT = 1743465600.0  # April 1, 2024 (Approx start of tracking?)
DATE_EMAIL_START = 1745020800.0     # April 19, 2024 (Start of email system)

def parse_date(date_str):
    """Parses DD/MM/YYYY HH:MM:SS to Unix timestamp."""
    try:
        dt = datetime.strptime(date_str.strip(), "%d/%m/%Y %H:%M:%S")
        return dt.timestamp()
    except ValueError:
        return None

def main():
    # 1. Load Current JSON Data
    with open(NEW_JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
        current_apps = data['apps']

    # Map: ComponentID -> AppObject
    app_map = {}
    
    # Initialize map with current data
    for app in current_apps:
        # Assuming componentNames[0] is the primary ID
        # (Though your structure supports multiple, we key by the first for merging)
        comp_id = app['componentNames'][0]['componentName']
        
        # Inject default firstAppearance if missing
        if 'firstAppearance' not in app:
            app['firstAppearance'] = DATE_EMAIL_START
            
        app_map[comp_id] = app

    # 2. Parse Legacy CSV
    print("Parsing legacy CSV...")
    with open(LEGACY_CSV_PATH, 'r', encoding='utf-8') as f:
        # Skip header if present, or handle it manually
        # Assuming header: First appearence,Component,Requests
        reader = csv.reader(f)
        try:
            next(reader) # Skip header row
        except StopIteration:
            pass

        last_valid_date = DATE_LEGACY_DEFAULT

        for row in reader:
            if len(row) < 3: continue
            
            date_str, comp_id, count_str = row[0], row[1], row[2]
            
            # Date Interpolation
            if date_str.strip():
                ts = parse_date(date_str)
                if ts: last_valid_date = ts
            
            first_seen = last_valid_date
            
            try:
                count = int(count_str)
            except ValueError:
                count = 1

            # 3. Merge Logic
            if comp_id in app_map:
                # EXISTING APP: Update stats
                app = app_map[comp_id]
                app['requestCount'] += count
                # Update firstAppearance to be the earliest date found
                app['firstAppearance'] = min(app.get('firstAppearance', first_seen), first_seen)
                # Ensure lastRequested is at least the legacy default (if it was somehow older, unlikely)
                # But typically current JSON has newer dates, so we keep max(current, legacy_default)
                # Actually, legacy items don't have "lastRequested" updates, so we ignore updating that field
                # unless the legacy date is somehow newer than the current one (impossible by definition).
            else:
                # NEW LEGACY APP: Create entry
                # Fallback values for missing metadata
                new_app = {
                    "drawable": "unknown", # Or a generic placeholder like "ic_placeholder"
                    "componentNames": [
                        {
                            "label": "(Unknown App)", # Name unknown in CSV
                            "componentName": comp_id
                        }
                    ],
                    "requestCount": count,
                    "lastRequested": DATE_LEGACY_DEFAULT, # April 1st cutoff
                    "firstAppearance": first_seen
                }
                app_map[comp_id] = new_app

    # 4. Final Formatting
    merged_apps = list(app_map.values())
    
    # Sort (Optional, e.g. by request count)
    merged_apps.sort(key=lambda x: x['requestCount'], reverse=True)

    output_data = {
        "count": sum(a['requestCount'] for a in merged_apps),
        "lastUpdate": datetime.now().strftime("%Y-%m-%d"),
        "apps": merged_apps
    }

    # 5. Write Result
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2)

    print(f"Migration complete. Merged {len(merged_apps)} apps.")
    print(f"Saved to {OUTPUT_PATH}")

if __name__ == "__main__":
    main()