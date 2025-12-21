import argparse
import json
import os
import re
import unicodedata

def sanitize_drawable_name(label):
    if not label: return "unknown"
    # Normalize and clean
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
    # Only strip TLD if we have enough segments (avoid stripping 'miui' from 'miui.system')
    if len(parts) >= 3:
        return '.'.join(parts[1:])
    return pkg

def write_json(output_dir, filename, key, data_list):
    path = os.path.join(output_dir, filename)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump({key: data_list}, f, indent=2)

def main(input_file, output_dir):
    # Ensure output dir exists
    os.makedirs(output_dir, exist_ok=True)

    # Load Data
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            apps = data['apps']
    except FileNotFoundError:
        print(f"Error: {input_file} not found.")
        return

    # Data Structures
    app_list = []
    for app in apps:
        app_id = app['componentName']
        pkg = app_id.split('/')[0]
        label = comp_info['label']
        
        app_list.append({
            'id': app_id,
            'pkg': pkg,
            'clean_name': sanitize_drawable_name(label)
        })

    # ==========================================
    # 1. Identify Links (Matches)
    # Logic: Same 'core' package OR one core contains the other (suffix match)
    # ==========================================
    
    link_ids = set()
    
    # Group by core package (handles TLD differences)
    core_map = {}
    for item in app_list:
        core = get_core_package(item['pkg'])
        if core not in core_map: core_map[core] = []
        core_map[core].append(item)
        
    # A. Mark items with identical cores (e.g. com.foo vs uk.foo)
    for core, items in core_map.items():
        if len(items) > 1:
            for item in items:
                link_ids.add(item['id'])

    # B. Mark items with suffix matches (e.g. 'foo.bar' vs 'foo.bar.beta')
    cores = list(core_map.keys())
    # Naive O(N^2) comparison of cores (fast enough for <5k items)
    for i in range(len(cores)):
        for j in range(i + 1, len(cores)):
            c1 = cores[i]
            c2 = cores[j]
            
            # Check if one starts with the other + a dot (to ensure segment boundary)
            if c1.startswith(c2 + '.') or c2.startswith(c1 + '.'):
                for item in core_map[c1]: link_ids.add(item['id'])
                for item in core_map[c2]: link_ids.add(item['id'])

    # ==========================================
    # 2. Identify Conflicts (Name in Use)
    # Logic: Same icon name, but NOT a package match
    # ==========================================
    
    conflict_ids = set()
    
    # Group by sanitized name
    name_map = {}
    for item in app_list:
        if item['clean_name'] not in name_map: name_map[item['clean_name']] = []
        name_map[item['clean_name']].append(item)
        
    for name, items in name_map.items():
        if len(items) > 1:
            # We have duplicates. Check if they are already explained by Links.
            for item in items:
                # If an item shares a name but isn't linked to its peers via package,
                # it's a naming conflict.
                if item['id'] not in link_ids:
                    conflict_ids.add(item['id'])

    # ==========================================
    # 3. Output
    # ==========================================
    write_json(output_dir, "conflict.json", "conflict", list(conflict_ids))
    write_json(output_dir, "link.json", "link", list(link_ids))
    
    print(f"Generated tags: {len(conflict_ids)} conflicts, {len(link_ids)} links.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate automatic tags for website script")
    parser.add_argument("input_file", help="Path to requests.json")
    parser.add_argument("output_dir", help="Directory to save filter JSONs")
    args = parser.parse_args()
    
    main(args.input_file, args.output_dir)