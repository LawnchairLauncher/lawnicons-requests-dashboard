"""
Refactored Email -> Request Processor
Outputs flat JSON structure with firstAppearance tracking.
"""

import argparse
import json
import re
import io
import os
import zipfile
import email
import lxml.etree as ET
from time import mktime
from datetime import date
from pathlib import Path
from email.message import Message
from email.utils import parsedate

COMPONENT_PATTERN = re.compile('ComponentInfo{(?P<ComponentInfo>.+)}')

CONFIG = {
    "request_limit": 50,
}

# -------------------------------------------------------
# CLI
# -------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(description="Parse icon request emails into requests.json")
    parser.add_argument("folder_path", type=str, help="Folder containing .eml files")
    parser.add_argument("appfilter_path", type=str, help="Current appfilter.xml path")
    parser.add_argument("extracted_png_folder_path", type=str, help="Output folder for PNGs")
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
                    # Deduplicate filename only for newly created entries.
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
                   apps: dict, png_out_dir: Path) -> dict:

    item_data = process_item_tag(item)
    if not item_data: return apps

    component_info, app_name, drawable = item_data
    req_time = get_request_timestamp(msg)
    
    # 1. Update Existing
    if component_info in apps:
        entry = apps[component_info]
        entry["requestCount"] += 1
        entry["lastRequested"] = max(entry.get("lastRequested", 0), req_time)

        # Refresh PNG for existing requests while keeping their drawable key stable.
        existing_drawable = entry.get("drawable") or drawable
        entry["drawable"] = extract_png(
            zip_file,
            drawable,
            png_out_dir,
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
        drawable_name = extract_png(zip_file, drawable, png_out_dir)
        apps[component_info] = create_app_entry(
            app_name, component_info, drawable_name, req_time)
    except Exception as e:
        print(f"Failed to process new request {component_info}: {e}")

    return apps

def parse_emails(email_files: list[Path], apps: dict, png_out_dir: Path) -> dict:
    failed_count = 0
    limit = CONFIG["request_limit"]
    
    for email_file in email_files:
        msg = read_email(email_file)
        zip_file = extract_zip_from_email(msg)

        if not zip_file:
            failed_count += 1
            continue

        try:
            xml_root = extract_xml(zip_file)
            items = xml_root.findall('item')
            
            if len(items) <= limit:
                for item in items:
                    apps = parse_item_tag(item, msg, zip_file, apps, png_out_dir)
            else:
                # Prioritise new items over existing ones
                item_data_list = []
                for item in items:
                    data = process_item_tag(item)
                    if data:
                        component_info = data[0]
                        is_new = component_info not in apps
                        item_data_list.append((is_new, item))
                
                # Prioritise country-code domains
                NON_GEO = {'ai','me','my','tv','fm','to','st','cc','ws','nu','tk','sh','is','as','je','gg','im','io','co','su','ac','bh','mf','nh','mo','bd','hk'}
                def is_country_domain(comp):
                    pkg = comp.split('/')[0]
                    domain = pkg.split('.')[0]
                    return len(domain) == 2 and domain not in NON_GEO

                item_data_list.sort(key=lambda x: (not x[0], not is_country_domain(x[1].get('component', ''))))
                
                for _, item in item_data_list[:limit]:
                    apps = parse_item_tag(item, msg, zip_file, apps, png_out_dir)
                    
                print(f"  Limited from {len(items)} to {limit} items (new prioritised)")
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
    # Convert dict back to flat list
    apps_list = list(apps.values())
    
    # Sort by Request Count (Descending)
    apps_list.sort(key=lambda x: x['requestCount'], reverse=True)
    
    data = {
        "count": len(apps_list),
        "lastUpdate": date.today().strftime("%Y-%m-%d"),
        "apps": apps_list
    }
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def run_pipeline(folder_path: Path, appfilter_path: Path, png_out_path: Path, output_path: Path):
    email_files = load_emails(folder_path)

    # 1. Load State
    apps = parse_existing_requests_json(output_path)

    # 2. Update State
    apps = parse_emails(email_files, apps, png_out_path)

    # Remove apps already in appfilter (Done)
    if appfilter_path.exists():
        existing = load_existing_components(appfilter_path)
        apps = {k: v for k, v in apps.items() if k not in existing}
    else:
        print("Warning: appfilter.xml not found, skipping deduplication.")

    # 3. Save
    write_json_output(output_path, apps)

    # 4. Cleanup
    keep_pngs = {a["drawable"] for a in apps.values()}
    delete_unused_pngs(png_out_path, keep_pngs)

    print(f"Processed {len(email_files)} emails. Total requests: {len(apps)}")

# -------------------------------------------------------
# MAIN
# -------------------------------------------------------
def main():
    args = parse_args()
    run_pipeline(
        folder_path=Path(args.folder_path),
        appfilter_path=Path(args.appfilter_path),
        png_out_path=Path(args.extracted_png_folder_path),
        output_path=Path(args.requests_path) / "requests.json"
    )

if __name__ == "__main__":
    main()