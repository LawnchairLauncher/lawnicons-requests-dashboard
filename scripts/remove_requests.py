import json
import sys
from pathlib import Path

INPUT_FILE = "src/assets/requests.json"
ICONS_DIR = "src/extracted_images"

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/remove_requests.py appid")
        lines = sys.stdin.read().strip().splitlines()
        if lines:
            ids_to_remove = [line.strip() for line in lines if line.strip()]
        else:
            sys.exit(1)
    else:
        ids_to_remove = sys.argv[1:]

    to_remove = set(filter(None, ids_to_remove))

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    drawables_to_remove = set()
    for app in data["apps"]:
        if app.get("componentName") in to_remove:
            drawable = app.get("drawable")
            if drawable:
                drawables_to_remove.add(f"{drawable}.webp")

    original_count = len(data["apps"])
    data["apps"] = [app for app in data["apps"] if app.get("componentName") not in to_remove]
    data["count"] = len(data["apps"])

    with open(INPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=True)

    for icon in drawables_to_remove:
        icon_path = Path(ICONS_DIR) / icon
        if icon_path.exists():
            icon_path.unlink()

    removed = original_count - len(data["apps"])
    remaining = len(data["apps"])
    
    removed_word = "request" if removed == 1 else "requests"
    remaining_word = "request" if remaining == 1 else "requests"
    
    print(f"Removed {removed} {removed_word}, {remaining} {remaining_word} remaining")

if __name__ == "__main__":
    main()