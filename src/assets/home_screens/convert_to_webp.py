# python3 scripts/convert_to_webp.py

from pathlib import Path
from PIL import Image

IMAGES = Path("src/assets/home_screens/images")
converted = 0

for f in IMAGES.iterdir():
    if f.suffix.lower() == ".webp":
        continue
    if f.suffix.lower() not in (".jpg", ".jpeg", ".png", ".gif", ".bmp"):
        continue
    out = f.with_suffix(".webp")
    try:
        img = Image.open(f).convert("RGBA")
        img.save(out, "webp", quality=90)
        f.unlink()
        converted += 1
        print(f"Converted: {f.name} → {out.name}")
    except Exception as e:
        print(f"Failed: {f.name}: {e}")

print(f"\nDone. Converted {converted} files.")