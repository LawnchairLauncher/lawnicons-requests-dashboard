import json
import time
import random
import io
import os
import requests
import re
import unicodedata
import signal
from google_play_scraper import app as play_app
from PIL import Image

# CONFIG
JSON_PATH = "src/assets/requests.json"
DEAD_PATH = "src/assets/dead_links.json"
EASY_PATH = "src/assets/filters/easy.json"
NAMEINUSE_PATH = "src/assets/filters/nameinuse.json"
MATCH_PATH = "src/assets/filters/match.json"
STALE_PATH = "src/assets/filters/stale.json"
SETS_PATH = "src/assets/stats/sets_stats.json"
ICON_DIR = "src/extracted_images/"


# Throttling & Limits
SLEEP_MIN = 0.5
SLEEP_MAX = 1
SAVE_INTERVAL = 10         # Autosave every N requests
MAX_CONSECUTIVE_ERRORS = 5 # Stop if IP blocked
BATCH_LIMIT = 500         # Max apps to update per run (Set 0 for infinite)

# Packages that don't exist in Play Store
NON_PLAY_STORE_PREFIXES = ("org.chromium.webapk", "com.sec.android.app.sbrowser.webapk")

# STATE
DATA = None
DEAD_SET = set()
IS_INTERRUPTED = False

def signal_handler(sig, frame):
    global IS_INTERRUPTED
    print("\n\n🛑 Interrupt received! Finishing current item then saving...")
    IS_INTERRUPTED = True

signal.signal(signal.SIGINT, signal_handler)

def sanitize_name(label):
    if not label: return "icon"
    name = unicodedata.normalize('NFD', label).encode('ascii', 'ignore').decode("utf-8")
    name = re.sub(r'[^a-z0-9]+', '_', name.lower())
    name = name.strip('_')
    if name and name[0].isdigit():
        name = "_" + name
    return name or "icon"

def download_icon(url, filename):
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            os.makedirs(ICON_DIR, exist_ok=True)

            for ext in ['.webp']:
                old_path = os.path.join(ICON_DIR, f"{filename}{ext}")
                if os.path.exists(old_path):
                    os.remove(old_path)
            
            path = os.path.join(ICON_DIR, f"{filename}.webp")
            img = Image.open(io.BytesIO(response.content))
            img.save(path, "webp", quality=90)
            return filename
    except Exception as e:
        print(f"Icon DL Error: {e}")
    return None

def load_dead_links():
    global DEAD_SET
    if os.path.exists(DEAD_PATH):
        try:
            with open(DEAD_PATH, 'r') as f:
                DEAD_SET = set(json.load(f))
        except: pass

def save_state():
    if DATA is None: return
    print(f"💾 Autosaving...", end=" ")
    try:
        with open(JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(DATA, f, indent=2)
        
        # Load existing dead links, merge with new
        if os.path.exists(DEAD_PATH):
            with open(DEAD_PATH, 'r') as f:
                existing_dead = set(json.load(f))
            if DEAD_SET - existing_dead:
                merged = sorted(DEAD_SET | existing_dead)
                with open(DEAD_PATH, 'w') as f:
                    json.dump(merged, f, indent=2)
        else:
            with open(DEAD_PATH, 'w') as f:
                json.dump(sorted(DEAD_SET), f, indent=2)
        
        print("OK.")
    except Exception as e:
        print(f"FAILED: {e}")

def is_small_image(drawable_name):
    if not drawable_name or drawable_name == 'unknown':
        return True
    path = os.path.join(ICON_DIR, f"{drawable_name}.webp")
    if not os.path.exists(path):
        return True
    try:
        img = Image.open(path)
        return img.width < 256 or img.height < 256
    except:
        return True

def main():
    global DATA, IS_INTERRUPTED
    
    try:
        with open(JSON_PATH, 'r', encoding='utf-8') as f:
            DATA = json.load(f)
    except FileNotFoundError:
        print("requests.json not found.")
        return

    load_dead_links()
    
    apps = DATA['apps']
    total = len(apps)
    updated_session = 0
    attempted = 0
    consecutive_errors = 0

    easy_ids = set()
    if os.path.exists(EASY_PATH):
        with open(EASY_PATH) as f:
            easy_data = json.load(f)
        easy_ids = set(easy_data.get("easy", []))

    stale_ids = set()
    if os.path.exists(STALE_PATH):
        with open(STALE_PATH) as f:
            stale_data = json.load(f)
            stale_ids = set(stale_data.get('stale', []))

    has_stale = len(stale_ids) > 0
    has_missing_installs = any('installs' not in a for a in apps)
    has_missing_icon = any(a.get('drawable') == 'unknown' for a in apps)

    if not has_stale and not has_missing_installs and not has_missing_icon:
        print("✅ Nothing to sync.")
        return      

    sorted_apps = sorted(apps, key=lambda app: (
        app['componentName'] not in stale_ids,
        app.get('drawable') != 'unknown' and not is_small_image(app.get('drawable')),
        app['componentName'] not in easy_ids,
        app.get('requestCount', 0)
    ))
    
    print(f"📋 Loaded {total} apps. {len(DEAD_SET)} known dead links.")
    if BATCH_LIMIT > 0:
        print(f"🎯 Target: Update max {BATCH_LIMIT} apps this session.")

    nameinuse_ids = set()
    match_ids = set()
    sets_pkgs = set()

    if os.path.exists(NAMEINUSE_PATH):
        with open(NAMEINUSE_PATH) as f:
            nameinuse_data = json.load(f)
            nameinuse_ids = {item['id'] for item in nameinuse_data.get('nameinuse', [])}

    if os.path.exists(MATCH_PATH):
        with open(MATCH_PATH) as f:
            match_data = json.load(f)
            match_ids = {item['id'] for item in match_data.get('match', [])}

    if os.path.exists(SETS_PATH):
        with open(SETS_PATH) as f:
            sets_stats = json.load(f)
            sets_pkgs = set(sets_stats.keys())

    for i, app in enumerate(sorted_apps):
        if IS_INTERRUPTED: break
        
        # Batch Limit Check
        if BATCH_LIMIT > 0 and updated_session >= BATCH_LIMIT:
            print(f"\n✅ Batch limit reached ({BATCH_LIMIT}). Stopping gracefully.")
            break

        # Circuit Breaker
        if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
            print(f"\n\n🚨 CIRCUIT BREAKER TRIPPED! Too many errors ({consecutive_errors}).")
            break

        pkg = app['componentName'].split('/')[0]

        # Skip Logic
        if pkg.startswith(NON_PLAY_STORE_PREFIXES):
            DEAD_SET.add(pkg)
            continue
        if pkg in DEAD_SET: continue
        
        skip_icon = app['componentName'] in nameinuse_ids or app['componentName'] in match_ids or pkg in sets_pkgs
        needs_installs = 'installs' not in app
        needs_icon = not skip_icon and (app.get('drawable') == 'unknown' or is_small_image(app.get('drawable')))
        is_stale = app['componentName'] in stale_ids
        if not needs_installs and not needs_icon and not is_stale: continue

        attempted += 1

        try:
            print(f"[{attempted}] {pkg}...", end=" ", flush=True)
            
            details = play_app(pkg, lang='en', country='us')
            
            # Update Data
            app['installs'] = details.get('installs', '0')
            if app['componentName'] in stale_ids:
                app['lastRequested'] = time.time()
            
            if app.get('label') == '(Unknown App)' or not app.get('label'):
                app['label'] = details.get('title', 'Unknown')

            if not skip_icon and (app.get('drawable') == 'unknown' or is_small_image(app.get('drawable'))):
                icon_url = details.get('icon')
                if icon_url:
                    clean_name = sanitize_name(app['label'])
                    new_drawable = download_icon(icon_url, clean_name)
                    if new_drawable:
                        app['drawable'] = new_drawable
                        print(f"[Icon: {new_drawable}]", end=" ")                  

            print(f"OK ({app['installs']})")
            updated_session += 1
            consecutive_errors = 0

            # Autosave
            if updated_session > 0 and updated_session % SAVE_INTERVAL == 0:
                save_state()

        except Exception as e:
            error_str = str(e).lower()
            if "404" in error_str or "not found" in error_str or "cannot identify image" in error_str:
                print("Dead/404")
                DEAD_SET.add(pkg)
                consecutive_errors = 0
            else:
                print(f"Failed ({e})")
                consecutive_errors += 1
                print(f"   ⚠️ Strike {consecutive_errors}/{MAX_CONSECUTIVE_ERRORS}")

        time.sleep(random.uniform(SLEEP_MIN, SLEEP_MAX))

    save_state()
    
    print("-" * 40)
    print(f"✨ Finished. Tried {attempted} apps from Play Store, updated {updated_session}.")
    
    if updated_session > 0:
        print("\n📝 Suggested Commit Message:")
        print(f"Update requests.json metadata for {updated_session} apps via Play Store")
    print("-" * 40)

if __name__ == "__main__":
    main()
