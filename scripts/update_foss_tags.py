# python3 scripts/update_foss_tags.py

import json
import os
import ssl
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
REQUESTS_JSON = REPO_ROOT / "src/assets/requests.json"
FOSS_PATH = REPO_ROOT / "src/assets/filters/foss.json"

def main():
    tmp_path = REPO_ROOT / "src/assets/index-v2.tmp"
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    try:
        with urllib.request.urlopen(
            "https://f-droid.org/repo/index-v2.json",
            context=ctx
        ) as response:
            with open(tmp_path, 'wb') as f:
                f.write(response.read())
        print("Downloaded F-Droid index")
    except Exception as e:
        print(f"Failed to download F-Droid index: {e}")
        return 1
    
    try:
        with open(tmp_path) as f:
            fdroid_pkgs = set(json.load(f).get('packages', {}).keys())
    finally:
        if tmp_path.exists():
            os.unlink(tmp_path)
    
    with open(REQUESTS_JSON) as f:
        apps = json.load(f)['apps']
    
    foss = sorted([app['componentName'] for app in apps if app['componentName'].split('/')[0] in fdroid_pkgs])
    
    FOSS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(FOSS_PATH, 'w') as f:
        json.dump({
            'label': 'FOSS',
            'description': 'Requests available on F-Droid.',
            'foss': foss
        }, f, indent=2)
    
    print(f"Updated foss.json with {len(foss)} entries")
    return 0

if __name__ == "__main__":
    exit(main())