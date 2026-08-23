"""
Refactored Email -> Request Processor
Outputs flat JSON structure with firstAppearance tracking.
Run: python3 scripts/email_parser.py emails/ src/assets/appfilter.xml src/extracted_images src/assets
"""

import argparse
import json
import re
import io
import os
import zipfile
import email
import shutil
import lxml.etree as ET
from time import mktime
from datetime import date
from pathlib import Path
from email.message import Message
from email.utils import parsedate
from PIL import Image

COMPONENT_PATTERN = re.compile('ComponentInfo{(?P<ComponentInfo>.+)}')

CONFIG = {
    "request_limit": 100,
}

ISO_COUNTRIES = {'ad','ae','af','ag','al','am','ao','ar','at','au','az','ba','bb','bd','be','bf','bg','bh','bi','bj','bo','br','bs','bw','by','bz','ca','cd','cf','cg','ch','ci','cl','cm','cn','cr','cu','cv','cy','cz','de','dj','dk','dm','do','dz','ec','ee','eg','er','es','et','fi','fj','fr','ga','ge','gh','gm','gn','gq','gr','gt','gw','gy','hk','hn','hr','ht','hu','id','ie','il','in','iq','ir','it','jm','jo','jp','ke','kg','kh','km','kn','kp','kr','kw','ky','kz','la','lb','lc','li','lk','lr','ls','lt','lu','lv','ly','ma','mc','md','mg','mk','ml','mm','mn','mr','mt','mu','mv','mw','mx','my','mz','na','ne','ng','ni','nl','no','np','nz','om','pa','pe','pg','ph','pk','pl','pr','ps','pt','py','qa','ro','rs','ru','rw','sa','sc','sd','se','sg','si','sk','sl','sm','sn','so','sr','ss','sv','sy','sz','td','tg','th','tj','tl','tm','tn','tr','tt','tw','tz','ua','ug','uk','us','uy','uz','vc','ve','vi','vn','ye','za','zm','zw'}

# -------------------------------------------------------
# CLI
# -------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(description="Parse icon request emails into requests.json")
    parser.add_argument("folder_path", type=str, help="Folder containing .eml files")
    parser.add_argument("appfilter_path", type=str, help="Current appfilter.xml path")
    parser.add_argument("image_out_path", type=str, help="Output folder for images")
    parser.add_argument("requests_path", type=str, help="Folder containing requests.json")
    return parser.parse_args()

# -------------------------------------------------------
# FILE / EMAIL I/O
# -------------------------------------------------------

def load_emails(folder_path: Path) -> list[Path]:
    if not folder_path.is_dir():
        print(f"Emails directory not found: {folder_path}. Skipping email parsing.")
        return []
    return list(folder_path.glob('*.eml'))

def read_email(file_path: Path) -> Message:
    with open(file_path, 'rb') as f:
        return email.message_from_bytes(f.read())

def extract_zip_from_email(message: Message) -> zipfile.ZipFile | None:
    for part in message.walk():
        if ((part.get_content_maintype() == 'application' and part.get_content_subtype() in ['zip', 'octet-stream']) or
                (filename := part.get_filename()) and filename.endswith('.zip')):
            zip_data = part.get_payload(decode=True)
            return zipfile.ZipFile(io.BytesIO(zip_data))  # type: ignore
    return None

def extract_xml(zip_file: zipfile.ZipFile) -> ET.Element:
    xml_string = zip_file.read('!appfilter.xml')
    return ET.fromstring(xml_string)

def extract_image(zip_file: zipfile.ZipFile, drawable_name: str, out_dir: Path,
                target_name: str | None = None, overwrite: bool = False) -> str:
    base_name = target_name or drawable_name
    candidate_name = base_name
    try:
        for file_info in zip_file.infolist():
            if file_info.filename.endswith(f'{base_name}.png'):
                with zip_file.open(file_info.filename) as source_file:
                    image_data = source_file.read()
                
                image_path = out_dir / f"{candidate_name}.webp"
                if not overwrite:
                    count = 1
                    while image_path.exists():
                        candidate_name = f"{base_name}_{count}"
                        image_path = out_dir / f"{candidate_name}.webp"
                        count += 1

                out_dir.mkdir(parents=True, exist_ok=True)
                img = Image.open(io.BytesIO(image_data))
                img.save(image_path, "webp", quality=90)
                return candidate_name
    except Exception as e:
        print(f"Error extracting image '{drawable_name}': {e}")
    return candidate_name

# -------------------------------------------------------
# PARSING EXISTING DATA
# -------------------------------------------------------

def parse_existing_requests_json(json_path: Path) -> dict:
    """
    Load existing requests.json into a dict keyed by componentName.
    Handles the Flat Format.
    """
    if not json_path.exists():
        return {}
        
    with open(json_path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            print(f"Warning: Failed to parse {json_path}. Starting fresh.")
            return {}
    
    # Transform list to dict: { "com.pkg/act": { ...obj... } }
    apps_map = {}
    for app in data.get("apps", []):
        comp = app.get("componentName")
        if comp:
            apps_map[comp] = app
            
    return apps_map

# -------------------------------------------------------
# APP REQUEST PROCESSING
# -------------------------------------------------------

def create_app_entry(app_name: str, component_info: str, drawable_name: str, timestamp: float) -> dict:
    """Create a new FLATTENED app entry."""
    return {
        "drawable": drawable_name,
        "label": app_name,
        "componentName": component_info,
        "requestCount": 1,
        "firstAppearance": timestamp,
        "lastRequested": timestamp
    }

def get_request_timestamp(msg: Message) -> float:
    try:
        date_header = msg.get('Date')
        if not date_header: return 0
        parsed = parsedate(str(date_header))
        return mktime(parsed) if parsed else 0
    except: return 0

def process_item_tag(item: ET.Element) -> tuple[str, str, str] | None:
    comp = item.get('component')
    name = item.get('name')
    draw = item.get('drawable')

    if not all([comp, name, draw]): return None
    
    match = COMPONENT_PATTERN.search(comp)
    if not match: return None

    return match.group('ComponentInfo'), name, draw

def parse_item_tag(item: ET.Element, msg: Message, zip_file: zipfile.ZipFile,
                   apps: dict, image_out_dir: Path) -> dict:

    item_data = process_item_tag(item)
    if not item_data: return apps

    component_info, app_name, drawable = item_data
    req_time = get_request_timestamp(msg)
    
    # 1. Update Existing
    if component_info in apps:
        entry = apps[component_info]
        entry["requestCount"] += 1
        entry["lastRequested"] = max(entry.get("lastRequested", 0), req_time)

        # Refresh image for existing requests while keeping their drawable key stable.
        existing_drawable = entry.get("drawable") or drawable
        if existing_drawable.endswith('.png'):
            existing_drawable = existing_drawable[:-4]
        entry["drawable"] = extract_image(
            zip_file,
            drawable,
            image_out_dir,
            target_name=existing_drawable,
            overwrite=True,
        )

        # Ensure firstAppearance exists (legacy migration safety)
        if "firstAppearance" not in entry:
            entry["firstAppearance"] = entry["lastRequested"]
        
        # In case we process an older email later, capture the earliest date
        entry["firstAppearance"] = min(entry["firstAppearance"], req_time)
        
        # Optional: Update label if the new one is "better"? 
        # For now, keep the first one seen or maybe update to most recent? 
        # Keeping first seen is safer for consistency.
        
        return apps

    # 2. Create New
    try:
        drawable_name = extract_image(zip_file, drawable, image_out_dir)
        apps[component_info] = create_app_entry(
            app_name, component_info, drawable_name, req_time)
    except Exception as e:
        print(f"Failed to process new request {component_info}: {e}")

    return apps

def update_screens_graph(output_dir: Path, email_filename: str, component_ids: list[str], existing_components: set[str]):
    # Filter out already fulfilled requests
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

def parse_emails(email_files: list[Path], apps: dict, image_out_dir: Path, graph_output_path: Path = None, appfilter_path: Path = None) -> dict:
    failed_count = 0
    limit = CONFIG["request_limit"]

    existing_components = set()
    if appfilter_path and appfilter_path.exists():
        existing_components = load_existing_components(appfilter_path)    
    
    for email_file in email_files:
        msg = read_email(email_file)
        zip_file = extract_zip_from_email(msg)

        if not zip_file:
            failed_count += 1
            continue

        try:
            xml_root = extract_xml(zip_file)
            items = xml_root.findall('item')

            email_component_ids = []
            for item in items:
                data = process_item_tag(item)
                if data:
                    email_component_ids.append(data[0])            
            
            if len(items) <= limit:
                for item in items:
                    apps = parse_item_tag(item, msg, zip_file, apps, image_out_dir)
            else:
                item_data_list = []
                for item in items:
                    data = process_item_tag(item)
                    if data:
                        component_info = data[0]
                        is_new = component_info not in apps
                        item_data_list.append((is_new, item))
                
                def is_country_domain(comp):
                    pkg = comp.split('/')[0]
                    domain = pkg.split('.')[0]
                    return domain in ISO_COUNTRIES

                item_data_list.sort(key=lambda x: (not x[0], not is_country_domain(x[1].get('component', ''))))
                
                for _, item in item_data_list[:limit]:
                    apps = parse_item_tag(item, msg, zip_file, apps, image_out_dir)
                    
                print(f"  Limited from {len(items)} to {limit} items (new prioritised)")

            if graph_output_path and email_component_ids:
                if len(items) <= limit:
                    graph_ids = email_component_ids
                else:
                    graph_ids = [process_item_tag(item)[0] for _, item in item_data_list[:limit] if process_item_tag(item)]
                update_screens_graph(graph_output_path, email_file.name, graph_ids, existing_components)
                update_requests_graph(graph_output_path, graph_ids)

        except Exception as e:
            print(f"Error processing {email_file.name}: {e}")
    
    if failed_count > 0:
        word = "email" if failed_count == 1 else "emails"
        print(f"Skipped {failed_count} {word} without valid ZIP attachment")

    return apps

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

def delete_unused_images(out_dir: Path, keep: set[str]):
    if not out_dir.exists(): return
    for f in os.listdir(out_dir):
        if f.endswith(".webp"):
            name = os.path.splitext(f)[0]
            if name == "_ic_default": continue
            if name not in keep:
                try: os.remove(os.path.join(out_dir, f))
                except: pass

# -------------------------------------------------------
# OUTPUT
# -------------------------------------------------------

def write_json_output(output_path: Path, apps: dict):
    # Preserve existing order, append new requests at the end
    existing_order = []
    new_entries = []
    
    if output_path.exists():
        with open(output_path, "r", encoding="utf-8") as f:
            old_data = json.load(f)
        existing_ids = []
        for app in old_data.get("apps", []):
            comp = app.get("componentName")
            if comp in apps:
                existing_ids.append(comp)
        
        seen = set()
        for comp in existing_ids:
            if comp not in seen:
                seen.add(comp)
                existing_order.append(apps[comp])
        
        for comp, entry in apps.items():
            if comp not in seen:
                new_entries.append(entry)
    
    apps_list = existing_order + new_entries
    
    data = {
        "count": len(apps_list),
        "lastUpdate": date.today().strftime("%Y-%m-%d"),
        "apps": apps_list
    }
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def save_trending_snapshot(period_key, apps, output_path):
    baseline_path = output_path.parent / "stats" / "trending_baseline.json"
    baseline = {}
    if baseline_path.exists():
        with open(baseline_path, "r", encoding="utf-8") as f:
            baseline = json.load(f)
    
    snapshot = {}
    for app in apps:
        comp = app.get("componentName", "")
        req = app.get("requestCount", 0)
        if comp and req >= 10:
            snapshot[comp] = req
    
    baseline[period_key] = {
        "date": date.today().isoformat(),
        "total": len(apps),
        "snapshot": snapshot
    }
    
    baseline_path.parent.mkdir(parents=True, exist_ok=True)
    with open(baseline_path, "w", encoding="utf-8") as f:
        json.dump(baseline, f, indent=2)
    print(f"Saved trending {period_key} with {len(snapshot)} entries")


def deduplicate_emails(email_files):
    sender_latest = {}
    for file_path in email_files:
        try:
            msg = read_email(file_path)
            sender = msg.get("From", "unknown")
            date_str = msg.get("Date")
            ts = mktime(parsedate(date_str)) if date_str else 0
            
            if sender not in sender_latest or ts > sender_latest[sender][0]:
                if sender in sender_latest:
                    old_path = sender_latest[sender][1]
                    if old_path.exists():
                        old_path.unlink()
                        print(f"  Removed duplicate: {old_path.name}")
                sender_latest[sender] = (ts, file_path)
            else:
                file_path.unlink()
                print(f"  Removed duplicate: {file_path.name}")
        except Exception as e:
            print(f"  Warning: could not read {file_path.name}: {e}")
    
    remaining = [p for p in email_files if p.exists()]
    removed = len(email_files) - len(remaining)
    if removed:
        print(f"Deduplication: kept {len(remaining)} of {len(email_files)} emails")
    return remaining

def run_pipeline(folder_path: Path, appfilter_path: Path, image_out_path: Path, output_path: Path):
    email_files = load_emails(folder_path)
    
    if email_files:
        email_files = deduplicate_emails(email_files)

    apps = parse_existing_requests_json(output_path)
    
    # Save period_start before parsing
    if email_files:
        save_trending_snapshot("period_start", list(apps.values()), output_path)

    apps = parse_emails(email_files, apps, image_out_path, output_path.parent, appfilter_path)

    if appfilter_path.exists():
        existing = load_existing_components(appfilter_path)
        apps = {k: v for k, v in apps.items() if k not in existing}
    else:
        print("Warning: appfilter.xml not found, skipping deduplication.")

    write_json_output(output_path, apps)

    # Save period_end after parsing
    if email_files:
        save_trending_snapshot("period_end", list(apps.values()), output_path)

    keep_images = {a["drawable"] for a in apps.values()}
    delete_unused_images(image_out_path, keep_images)

    print(f"Processed {len(email_files)} emails. Total requests: {len(apps)}")

    answer = input("Delete processed emails? (Y/N): ").strip().upper()
    if answer == 'Y':
        shutil.rmtree(folder_path)
        print("Emails deleted.")
    else:
        print("Emails kept.")    

# -------------------------------------------------------
# MAIN
# -------------------------------------------------------
def main():
    args = parse_args()
    run_pipeline(
        folder_path=Path(args.folder_path),
        appfilter_path=Path(args.appfilter_path),
        image_out_path=Path(args.image_out_path),
        output_path=Path(args.requests_path) / "requests.json"
    )

if __name__ == "__main__":
    main()