import argparse
import json
import os
import re
import unicodedata
import xml.etree.ElementTree as ET

# Metadata Definitions for the UI
METADATA = {
    "nameinuse": {
        "label": "Name in use",
        "desc": "Requests with an existing app name and unknown package."
    },
    "match": {
        "label": "Match",
        "desc": "Requests with an existing package."
    }
}

PWA_PACKAGE_PREFIXES = ("org.chromium.webapk", "com.sec.android.app.sbrowser.webapk")

def sanitize_drawable_name(label):
    if not label:
        return ""
    return label.strip().lower()

def get_core_package(pkg):
    """
    Extracts the 'core' of a package name to handle TLD differences.
    e.g. 'com.example.app' -> 'example.app'
         'uk.example.app'  -> 'example.app'
    """
    parts = pkg.split('.')
    if len(parts) >= 3:
        return '.'.join(parts[1:])
    return pkg

def load_appfilter_data(appfilter_path):
    existing_packages = {}  # package → drawable
    existing_names = {}     # sanitized_name → drawable

    if not os.path.exists(appfilter_path):
        print(f"Warning: {appfilter_path} not found. Auto-tags will be empty.")
        return existing_packages, existing_names

    try:
        tree = ET.parse(appfilter_path)
        root = tree.getroot()
        
        for item in root.findall('item'):
            drawable = item.get('drawable', '')
            
            comp = item.get('component')
            if comp:
                match = re.search(r'ComponentInfo\{([^/]+)', comp)
                if match:
                    pkg = match.group(1)
                    existing_packages[pkg] = drawable
            
            raw_name = item.get('name')
            if raw_name:
                existing_names[sanitize_drawable_name(raw_name)] = drawable
                
    except Exception as e:
        print(f"Error parsing appfilter: {e}")

    return existing_packages, existing_names

def write_json(output_dir, filename, key, data_list):
    path = os.path.join(output_dir, filename)
    output_data = {
        "label": METADATA.get(key, {}).get("label", key.capitalize()),
        "description": METADATA.get(key, {}).get("desc", ""),
        key: [{"id": item[0], "existing_drawable": item[1]} for item in data_list]
    }
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2)

def main(input_file, output_dir, appfilter_path):
    os.makedirs(output_dir, exist_ok=True)

    # 1. Load Requests
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            apps = data['apps']
    except FileNotFoundError:
        print(f"Error: {input_file} not found.")
        return

    # 2. Load Appfilter (Source of Truth)
    existing_packages, existing_names = load_appfilter_data(appfilter_path)
    
    nameinuse_data = []
    match_data = []

    print(f"Scanning {len(apps)} requests against {len(existing_packages)} existing packages...")

    for app in apps:
        app_id = app.get('componentName')
        if not app_id: continue
        
        pkg = app_id.split('/')[0]
        label = app.get('label', '')
        
        req_pkg = pkg
        req_name = sanitize_drawable_name(label)
        
        is_matched = False

        # --- Rule A: Match ---
        # Check if exact package name exists in appfilter
        # e.g. Request 'uk.co.example.app' matches only if 'uk.co.example.app' exists
        if req_pkg in existing_packages:
            is_matched = True
            match_data.append((app_id, existing_packages[req_pkg]))

        # --- Rule B: Name in Use ---
        # Check if name exists, BUT package does not match
        # e.g. Request 'Signal' (tooth.brush) matches Existing 'Signal' (org.thoughtcrime)
        # But Request 'Signal' (org.thoughtcrime.beta) is LINKED, so not a conflict.

        # Ignore PWA wrappers
        is_pwa = req_pkg.startswith(PWA_PACKAGE_PREFIXES)

        if req_name in existing_names and not is_matched and not is_pwa:
            nameinuse_data.append((app_id, existing_names[req_name]))

    # 3. Output
    write_json(output_dir, "nameinuse.json", "nameinuse", nameinuse_data)
    write_json(output_dir, "match.json", "match", match_data)

    # Propagate easy tag to all components of the same package
    easy_path = os.path.join(output_dir, "easy.json")
    if os.path.exists(easy_path):
        with open(easy_path, 'r') as f:
            easy_data = json.load(f)
        
        easy_components = set(easy_data.get('easy', []))
        easy_pkgs = {comp.split('/')[0] for comp in easy_components 
                    if not comp.split('/')[0].startswith(PWA_PACKAGE_PREFIXES)}
        
        new_easy = set(easy_components)
        for app in apps:
            comp = app.get('componentName', '')
            pkg = comp.split('/')[0]
            if pkg.startswith(PWA_PACKAGE_PREFIXES):
                continue
            if pkg in easy_pkgs:
                new_easy.add(comp)
        
        added = len(new_easy) - len(easy_components)
        if added > 0:
            old_list = easy_data.get('easy', [])
            new_only = sorted(new_easy - easy_components)
            easy_data['easy'] = old_list + new_only
            with open(easy_path, 'w') as f:
                json.dump(easy_data, f, indent=2)
            print(f"Propagated easy tag to {added} additional components in same packages")    
    
    print(f"Generated tags: {len(nameinuse_data)} nameinuses, {len(match_data)} matches.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate automatic tags based on appfilter.xml")
    parser.add_argument("input_file", help="Path to requests.json")
    parser.add_argument("output_dir", help="Directory to save filter JSONs")
    parser.add_argument("appfilter_path", help="Path to appfilter.xml")
    args = parser.parse_args()
    
    main(args.input_file, args.output_dir, args.appfilter_path)