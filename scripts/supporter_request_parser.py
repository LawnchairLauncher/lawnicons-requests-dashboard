""""
Refactored ZIP -> Request Processor
Outputs flat JSON structure with firstAppearance tracking.

Usage
python3 scripts/supporter_request_parser.py zips src/assets/appfilter.xml src/extracted_png src/assets src/assets/filters/supported.json
"""

import argparse
import json
import re
import os
import zipfile
import lxml.etree as ET
from datetime import date
from pathlib import Path

COMPONENT_PATTERN = re.compile('ComponentInfo{(?P<ComponentInfo>.+)}')

# -------------------------------------------------------
# CLI
# -------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(description="Parse icon request ZIPs into requests.json")
    parser.add_argument("folder_path", type=str, help="Folder containing .zip files")
    parser.add_argument("appfilter_path", type=str, help="Current appfilter.xml path")
    parser.add_argument("extracted_png_folder_path", type=str, help="Output folder for PNGs")
    parser.add_argument("requests_path", type=str, help="Folder containing requests.json")
    parser.add_argument("supported_path", type=str, help="Path to supported.json")
    return parser.parse_args()

# -------------------------------------------------------
# FILE I/O
# -------------------------------------------------------

def load_zips(folder_path: Path) -> list[Path]:
    if not folder_path.is_dir():
        raise ValueError(f"Path is not a directory: {folder_path}")
    return list(folder_path.glob('*.zip'))

def extract_xml(zip_file: zipfile.ZipFile) -> ET.Element:
    xml_string = zip_file.read('!appfilter.xml')
    return ET.fromstring(xml_string)

def extract_png(zip_file: zipfile.ZipFile, drawable_name: str, out_dir: Path,
                target_name: str | None = None, overwrite: bool = False) -> str:
    base_name = target_name or drawable_name
    candidate_name = base_name
    try:
        for file_info in zip_file.infolist():
            if file_info.filename.endswith(f'{base_name}.png'):
                with zip_file.open(file_info.filename) as png_file:
                    png_content = png_file.read()
                
                png_path = out_dir / f"{candidate_name}.png"
                if not overwrite:
                    count = 1
                    while png_path.exists():
                        candidate_name = f"{base_name}_{count}"
                        png_path = out_dir / f"{candidate_name}.png"
                        count += 1

                out_dir.mkdir(parents=True, exist_ok=True)
                with open(png_path, 'wb') as f:
                    f.write(png_content)
                return candidate_name
    except Exception as e:
        print(f"Error extracting PNG '{drawable_name}': {e}")
    return candidate_name

# -------------------------------------------------------
# PARSING EXISTING DATA
# -------------------------------------------------------

def parse_existing_requests_json(json_path: Path) -> dict:
    if not json_path.exists():
        return {}
        
    with open(json_path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            print(f"Warning: Failed to parse {json_path}. Starting fresh.")
            return {}
    
    apps_map = {}
    for app in data.get("apps", []):
        comp = app.get("componentName")
        if comp:
            apps_map[comp] = app
            
    return apps_map

def parse_existing_supported_json(supported_path: Path) -> set[str]:
    if not supported_path.exists():
        return set()
    
    with open(supported_path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
            return set(data.get("supported", []))
        except json.JSONDecodeError:
            print(f"Warning: Failed to parse {supported_path}. Starting fresh.")
            return set()

# -------------------------------------------------------
# APP REQUEST PROCESSING
# -------------------------------------------------------

def create_app_entry(app_name: str, component_info: str, drawable_name: str, timestamp: float) -> dict:
    return {
        "drawable": drawable_name,
        "label": app_name,
        "componentName": component_info,
        "requestCount": 1,
        "firstAppearance": timestamp,
        "lastRequested": timestamp
    }

def process_item_tag(item: ET.Element) -> tuple[str, str, str] | None:
    comp = item.get('component')
    name = item.get('name')
    draw = item.get('drawable')

    if not all([comp, name, draw]): return None
    
    match = COMPONENT_PATTERN.search(comp)
    if not match: return None

    return match.group('ComponentInfo'), name, draw

def parse_item_tag(item: ET.Element, zip_file: zipfile.ZipFile, apps: dict, 
                   png_out_dir: Path, req_time: float) -> dict:
    
    item_data = process_item_tag(item)
    if not item_data: return apps

    component_info, app_name, drawable = item_data
    
    if component_info in apps:
        entry = apps[component_info]
        entry["requestCount"] += 1
        entry["lastRequested"] = max(entry.get("lastRequested", 0), req_time)

        existing_drawable = entry.get("drawable") or drawable
        entry["drawable"] = extract_png(
            zip_file, drawable, png_out_dir, target_name=existing_drawable, overwrite=True)

        if "firstAppearance" not in entry:
            entry["firstAppearance"] = entry["lastRequested"]
        
        entry["firstAppearance"] = min(entry["firstAppearance"], req_time)
        return apps

    try:
        drawable_name = extract_png(zip_file, drawable, png_out_dir)
        apps[component_info] = create_app_entry(app_name, component_info, drawable_name, req_time)
    except Exception as e:
        print(f"Failed to process new request {component_info}: {e}")

    return apps

def parse_zips(zip_files: list[Path], apps: dict, png_out_dir: Path, graph_output_dir: Path = None, appfilter_path: Path = None) -> tuple[dict, set[str]]:
    failed_count = 0
    zip_components = set()
    
    existing_components = set()
    if appfilter_path and appfilter_path.exists():
        existing_components = load_existing_components(appfilter_path)
    
    for zip_path in zip_files:
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_file:
                xml_root = extract_xml(zip_file)
                req_time = os.path.getmtime(zip_path)
                zip_components = set()
                
                for item in xml_root.findall('item'):
                    item_data = process_item_tag(item)
                    if item_data:
                        zip_components.add(item_data[0])
                    apps = parse_item_tag(item, zip_file, apps, png_out_dir, req_time)
                
                if graph_output_dir and zip_components:
                    update_screens_graph(graph_output_dir, zip_path.name, list(zip_components), existing_components)
                    update_requests_graph(graph_output_dir, list(zip_components))
        except Exception as e:
            failed_count += 1
            print(f"Error processing {zip_path.name}: {e}")
    
    if failed_count > 0:
        word = "archive" if failed_count == 1 else "archives"
        print(f"Skipped {failed_count} {word} without valid structure")

    return apps, zip_components

# -------------------------------------------------------
# UTILITIES
# -------------------------------------------------------

def load_existing_components(appfilter_path: Path) -> set[str]:
    root = ET.parse(appfilter_path).getroot()
    components = set()
    for item in root.findall(".//item"):
        comp = item.get("component")
        if not comp: continue
        match = COMPONENT_PATTERN.search(comp)
        if match: components.add(match.group(1))
    return components

def delete_unused_pngs(out_dir: Path, keep: set[str]):
    if not out_dir.exists(): return
    for f in os.listdir(out_dir):
        if f.endswith(".png"):
            name = os.path.splitext(f)[0]
            if name == "_ic_default": continue
            if name not in keep:
                try: os.remove(os.path.join(out_dir, f))
                except: pass

# -------------------------------------------------------
# OUTPUT
# -------------------------------------------------------

def write_json_output(output_path: Path, apps: dict):
    apps_list = list(apps.values())
    apps_list.sort(key=lambda x: x['requestCount'], reverse=True)
    
    data = {
        "count": len(apps_list),
        "lastUpdate": date.today().strftime("%Y-%m-%d"),
        "apps": apps_list
    }
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def update_supported_json(supported_path: Path, existing_supported: set[str], new_components: set[str]):
    updated_supported = existing_supported | new_components
    
    # Preserve done/total if they exist
    done = 0
    if supported_path.exists():
        with open(supported_path, "r", encoding="utf-8") as f:
            old = json.load(f)
            done = old.get("done", 0)
    
    data = {
        "label": "Supported",
        "description": "Requests from Open Collective backers and GitHub sponsors.",
        "done": done,
        "total": done + len(updated_supported),
        "supported": sorted(list(updated_supported))
    }
    
    supported_path.parent.mkdir(parents=True, exist_ok=True)
    with open(supported_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    
    print(f"Updated supported.json with {len(new_components)} new components (total: {data['total']}, done: {data['done']})")

def update_activity_stats_for_supporter(requests_path: Path, new_added: int, total: int):
    """Record supporter additions in activity_stats.json."""
    activity_stats_path = requests_path / "activity_stats.json"
    today = date.today().isoformat()
    
    history = []
    if activity_stats_path.exists():
        with open(activity_stats_path) as f:
            history = json.load(f)
    
    if history and history[-1]["date"] == today:
        history[-1]["added"] = history[-1].get("added", 0) + new_added
        history[-1]["total"] = total
    else:
        history.append({
            "date": today,
            "total": total,
            "added": new_added,
            "fulfilled": 0,
            "expired": 0
        })
    
    with open(activity_stats_path, "w") as f:
        json.dump(history, f, indent=2)    

def run_pipeline(folder_path: Path, appfilter_path: Path, png_out_path: Path, 
                 output_path: Path, supported_path: Path):
    zip_files = load_zips(folder_path)

    apps = parse_existing_requests_json(output_path)
    apps_before = set(apps.keys())
    existing_supported = parse_existing_supported_json(supported_path)

    apps, zip_components = parse_zips(zip_files, apps, png_out_path, output_path.parent, appfilter_path)
    
    if appfilter_path.exists():
        existing = load_existing_components(appfilter_path)
        apps = {k: v for k, v in apps.items() if k not in existing}
    else:
        print("Warning: appfilter.xml not found, skipping deduplication.")

    write_json_output(output_path, apps)
    update_supported_json(supported_path, existing_supported, zip_components)

    new_added = len(set(apps.keys()) - apps_before)
    if new_added > 0:
        update_activity_stats_for_supporter(output_path.parent, new_added, len(apps))

    keep_pngs = {a["drawable"] for a in apps.values()}
    delete_unused_pngs(png_out_path, keep_pngs)

    print(f"Processed {len(zip_files)} archives. Total requests: {len(apps)}")
    if zip_files:
        print("Don't forget to delete processed ZIP files from the zips folder.")


def update_screens_graph(output_dir: Path, zip_filename: str, component_ids: list[str], existing_components: set[str]):
    component_ids = [c for c in component_ids if c not in existing_components]
    if not component_ids:
        return
        
    graph_path = output_dir / "screens_graph.json"
    if graph_path.exists():
        with open(graph_path, 'r') as f:
            graph = json.load(f)
    else:
        graph = {}
    
    existing_ids = [k for k in graph.keys() if k.startswith('scr-')]
    next_num = max([int(k.split('-')[1]) for k in existing_ids], default=0) + 1
    screen_id = f"scr-{next_num}"
    
    graph[screen_id] = list(set(component_ids))
    
    with open(graph_path, 'w') as f:
        json.dump(graph, f, indent=2)

def update_requests_graph(output_dir: Path, component_ids: list[str]):
    graph_path = output_dir / "requests_graph.json"
    if graph_path.exists():
        with open(graph_path, 'r') as f:
            graph = json.load(f)
    else:
        graph = {}

    ISO_COUNTRIES = {'ad','ae','af','ag','al','am','ao','ar','at','au','az','ba','bb','bd','be','bf','bg','bh','bi','bj','bo','br','bs','bt','bw','by','bz','ca','cd','cf','cg','ch','ci','cl','cm','cn','cr','cu','cv','cy','cz','de','dj','dk','dm','do','dz','ec','ee','eg','er','es','et','fi','fj','fr','ga','ge','gh','gm','gn','gq','gr','gt','gw','gy','hk','hn','hr','ht','hu','id','ie','il','in','iq','ir','it','jm','jo','jp','ke','kg','kh','km','kn','kp','kr','kw','ky','kz','la','lb','lc','li','lk','lr','ls','lt','lu','lv','ly','ma','mc','md','mg','mk','ml','mm','mn','mr','mt','mu','mv','mw','mx','my','mz','na','nc','ne','nf','ng','ni','nl','no','np','nr','nz','om','pa','pe','pg','ph','pk','pl','pr','ps','pt','py','qa','ro','rs','ru','rw','sa','sc','sd','se','sg','si','sk','sl','sm','sn','so','sr','ss','st','sv','sy','sz','td','tg','th','tj','tl','tm','tn','tr','tt','tw','tz','ua','ug','uk','us','uy','uz','va','vc','ve','vi','vn','vu','ye','yt','za','zm','zw'}

    def get_domain(comp):
        pkg = comp.split("/")[0]
        return pkg.split(".")[0] if "." in pkg else "unknown"

    def is_country(domain):
        return domain in ISO_COUNTRIES

    unique_ids = list(set(component_ids))
    for i, comp_a in enumerate(unique_ids):
        domain_a = get_domain(comp_a)
        for comp_b in unique_ids[i+1:]:
            domain_b = get_domain(comp_b)
            
            # Only store: non-geo key -> geo value
            if not is_country(domain_a) and is_country(domain_b):
                if comp_a not in graph:
                    graph[comp_a] = {}
                graph[comp_a][comp_b] = graph[comp_a].get(comp_b, 0) + 1
            elif is_country(domain_a) and not is_country(domain_b):
                if comp_b not in graph:
                    graph[comp_b] = {}
                graph[comp_b][comp_a] = graph[comp_b].get(comp_a, 0) + 1
    
    with open(graph_path, 'w') as f:
        json.dump(graph, f, indent=2)
        

# -------------------------------------------------------
# MAIN
# -------------------------------------------------------
def main():
    args = parse_args()
    run_pipeline(
        folder_path=Path(args.folder_path),
        appfilter_path=Path(args.appfilter_path),
        png_out_path=Path(args.extracted_png_folder_path),
        output_path=Path(args.requests_path) / "requests.json",
        supported_path=Path(args.supported_path)
    )

if __name__ == "__main__":
    main()