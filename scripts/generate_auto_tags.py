import argparse
import json
import os
import re
import unicodedata

def sanitize_drawable_name(label):
    if not label: return "unknown"
    
    # 1. Normalize (remove accents)
    name = unicodedata.normalize('NFD', label).encode('ascii', 'ignore').decode("utf-8")
    
    # 2. Lowercase & replace non-alphanumeric with underscore
    name = re.sub(r'[^a-z0-9]+', '_', name.lower())
    
    # 3. Trim underscores
    name = name.strip('_')
    
    # 4. Handle leading digit
    if name and name[0].isdigit():
        name = "_" + name
        
    return name or "icon"

def main(input_file: str, output_dir: str):
    # Ensure output dir exists
    os.makedirs(output_dir, exist_ok=True)

    # Load Data
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        apps = data['apps']

    name_map = {} # SanitizedName -> List[ID]
    pkg_map = {}  # Package -> List[ID]

    # 1. Build Indices
    for app in apps:
        comp_info = app['componentNames'][0]
        app_id = comp_info['componentName']
        label = comp_info['label']
        
        # Name Index
        clean_name = sanitize_drawable_name(label)
        if clean_name not in name_map: name_map[clean_name] = []
        name_map[clean_name].append(app_id)

        # Package Index
        pkg = app_id.split('/')[0]
        if pkg not in pkg_map: pkg_map[pkg] = []
        pkg_map[pkg].append(app_id)

    # 2. Identify Conflicts (Name in Use)
    conflicts = []
    for name, ids in name_map.items():
        if len(ids) > 1:
            conflicts.extend(ids)

    # 3. Identify Links (Matches)
    links = []
    for pkg, ids in pkg_map.items():
        if len(ids) > 1:
            links.extend(ids)

    # 4. Write JSON Files
    write_json("conflict.json", output_dir, "conflict", list(set(conflicts)))
    write_json("link.json", output_dir, "link", list(set(links)))

    print(f"Generated tags: {len(conflicts)} potential conflicts, {len(links)} potential links.")

def write_json(filename, output_dir, key, data_list):
    path = os.path.join(output_dir, filename)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump({key: data_list}, f, indent=2)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate automatic tags for website script")
    parser.add_argument("input_file")
    parser.add_argument("output_dir")
    args = parser.parse_args()
    main(args.input_file, args.output_dir)