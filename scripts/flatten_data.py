import json

# CONFIG
INPUT_FILE = "docs/assets/requests.json"
OUTPUT_FILE = "docs/assets/requests.json" # Overwrite or use new name

def main():
    try:
        with open(INPUT_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print("Input file not found.")
        return

    flat_apps = []

    for app in data.get('apps', []):
        # Base stats
        base_data = {
            "drawable": app.get("drawable", "unknown"),
            "requestCount": app.get("requestCount", 0),
            "firstAppearance": app.get("firstAppearance", 0),
            "lastRequested": app.get("lastRequested", 0)
        }

        # Flatten componentNames array
        comps = app.get("componentNames", [])
        if not comps:
            # Handle empty component list case
            entry = base_data.copy()
            entry["label"] = "(Unknown App)"
            entry["componentName"] = "unknown/unknown"
            flat_apps.append(entry)
        else:
            for comp in comps:
                entry = base_data.copy()
                entry["label"] = comp.get("label", "(Unknown App)")
                entry["componentName"] = comp.get("componentName", "")
                flat_apps.append(entry)

    # Sort by request count (descending)
    flat_apps.sort(key=lambda x: x['requestCount'], reverse=True)

    data['apps'] = flat_apps

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    
    print(f"Flattened {len(flat_apps)} entries.")

if __name__ == "__main__":
    main()