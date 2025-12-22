import json
import time
import random
import os
import requests
import re
import unicodedata
import signal
from google_play_scraper import app as play_app

# CONFIG
JSON_PATH = "src/assets/requests.json"
DEAD_PATH = "src/assets/dead_links.json"
ICON_DIR = "src/extracted_png/"

# Throttling & Limits
SLEEP_MIN = 2
SLEEP_MAX = 5
SAVE_INTERVAL = 10         # Autosave every N requests
MAX_CONSECUTIVE_ERRORS = 5 # Stop if IP blocked
BATCH_LIMIT = 500          # Max apps to update per run (Set 0 for infinite)

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
            
            candidate = filename
            path = os.path.join(ICON_DIR, f"{candidate}.png")
            counter = 2
            
            while os.path.exists(path):
                candidate = f"{filename}_{counter}"
                path = os.path.join(ICON_DIR, f"{candidate}.png")
                counter += 1
            
            with open(path, 'wb') as f:
                f.write(response.content)
            return candidate
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
        
        with open(DEAD_PATH, 'w', encoding='utf-8') as f:
            json.dump(list(DEAD_SET), f, indent=2)
        print("OK.")
    except Exception as e:
        print(f"FAILED: {e}")

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
    consecutive_errors = 0
    
    print(f"📋 Loaded {total} apps. {len(DEAD_SET)} known dead links.")
    if BATCH_LIMIT > 0:
        print(f"🎯 Target: Update max {BATCH_LIMIT} apps this session.")

    for i, app in enumerate(apps):
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
        if pkg in DEAD_SET: continue
        if 'installs' in app and app.get('drawable') != 'unknown': continue

        try:
            print(f"[{i+1}/{total}] {pkg}...", end=" ", flush=True)
            
            details = play_app(pkg, lang='en', country='us')
            
            # Update Data
            app['installs'] = details.get('installs', '0')
            
            if app.get('label') == '(Unknown App)' or not app.get('label'):
                app['label'] = details.get('title', 'Unknown')

            if app.get('drawable') == 'unknown':
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
            if "404" in error_str or "not found" in error_str:
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
    print(f"✨ Finished. Updated {updated_session} apps.")
    
    if updated_session > 0:
        print("\n📝 Suggested Commit Message:")
        print(f"Update requests.json metadata for {updated_session} apps via Play Store")
    print("-" * 40)

if __name__ == "__main__":
    main()