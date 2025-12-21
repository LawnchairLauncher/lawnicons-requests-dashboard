import argparse
import json
import os
import re
import unicodedata
import xml.etree.ElementTree as ET

# Metadata Definitions for the UI
METADATA = {
    "conflict": {
        "label": "Name in Use",
        "desc": "App name matches an existing icon, but the package is different"
    },
    "link": {
        "label": "Matches",
        "desc": "Apps that share a package structure with an existing icon (e.g. regional variants)"
    }
}

def sanitize_drawable_name(label):
    if not label: return "unknown"
    name = unicodedata.normalize('NFD', label).encode('ascii', 'ignore').decode("utf-8")
    name = re.sub(r'[^a-z0-9]+', '_', name.lower())
    name = name.strip('_')
    if name and name[0].isdigit():
        name = "_" + name
    return name or "icon"

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
    """
    Parses appfilter.xml to build indices of existing icons.
    Returns:
        existing_cores: Set of 'core' packages (e.g. 'google.maps')
        existing_names: Set of sanitized icon names (e.g. 'signal')
    """
    existing_cores = set()
    existing_names = set()

    if not os.path.exists(appfilter_path):
        print(f"Warning: {appfilter_path} not found. Auto-tags will be empty.")
        return existing_cores, existing_names

    try:
        # Use iterparse for memory efficiency if file is huge, but parse is fine for ~2MB
        tree = ET.parse(appfilter_path)
        root = tree.getroot()
        
        for item in root.findall('item'):
            # 1. Extract Package Core
            comp = item.get('component')
            if comp:
                # Format: ComponentInfo{package/class}
                match = re.search(r'ComponentInfo\{([^/]+)', comp)
                if match:
                    pkg = match.group(1)
                    existing_cores.add(get_core_package(pkg))
            
            # 2. Extract Name (Label)
            # We use the 'name' attribute to check for Label Conflicts
            raw_name = item.get('name')
            if raw_name:
                existing_names.add(sanitize_drawable_name(raw_name))
                
    except Exception as e:
        print(f"Error parsing appfilter: {e}")

    return existing_cores, existing_names

def write_json(output_dir, filename, key, data_list):
    path = os.path.join(output_dir, filename)
    output_data = {
        "label": METADATA.get(key, {}).get("label", key.capitalize()),
        "description": METADATA.get(key, {}).get("desc", ""),
        key: data_list
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
    existing_cores, existing_names = load_appfilter_data(appfilter_path)
    
    conflict_ids = []
    link_ids = []

    print(f"Scanning {len(apps)} requests against {len(existing_cores)} existing packages...")

    for app in apps:
        app_id = app.get('componentName')
        if not app_id: continue
        
        pkg = app_id.split('/')[0]
        label = app.get('label', '')
        
        req_core = get_core_package(pkg)
        req_name = sanitize_drawable_name(label)
        
        is_linked = False

        # --- Rule A: Matches (Link) ---
        # Check if core package exists in appfilter
        # e.g. Request 'uk.foo' matches Existing 'com.foo' (core: 'foo')
        if req_core in existing_cores:
            is_linked = True
            link_ids.append(app_id)
        
        # --- Rule B: Name in Use (Conflict) ---
        # Check if name exists, BUT package does not match
        # e.g. Request 'Signal' (tooth.brush) matches Existing 'Signal' (org.thoughtcrime)
        # But Request 'Signal' (org.thoughtcrime.beta) is LINKED, so not a conflict.
        if req_name in existing_names and not is_linked:
            conflict_ids.append(app_id)

    # 3. Output
    write_json(output_dir, "conflict.json", "conflict", conflict_ids)
    write_json(output_dir, "link.json", "link", link_ids)
    
    print(f"Generated tags: {len(conflict_ids)} conflicts, {len(link_ids)} matches.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate automatic tags based on appfilter.xml")
    parser.add_argument("input_file", help="Path to requests.json")
    parser.add_argument("output_dir", help="Directory to save filter JSONs")
    parser.add_argument("appfilter_path", help="Path to appfilter.xml")
    args = parser.parse_args()
    
    main(args.input_file, args.output_dir, args.appfilter_path)