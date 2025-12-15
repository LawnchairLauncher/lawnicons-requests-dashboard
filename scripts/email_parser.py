"""
Functional outline for refactored email → request processor
Now outputs structured requests.json (single file).
"""

import argparse
from email.message import Message
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
from collections import defaultdict, Counter
from email.utils import parseaddr, parsedate, parsedate_to_datetime

COMPONENT_PATTERN = re.compile('ComponentInfo{(?P<ComponentInfo>.+)}')

CONFIG = {
    "request_limit": 1000,
    "months_limit": 6,
    "min_requests": 4,
}

# -------------------------------------------------------
# CLI
# -------------------------------------------------------


def parse_args():
    """Parse CLI arguments."""
    parser = argparse.ArgumentParser(
        description="Script to parse emails and generate/update requests.txt and updatable.txt")
    parser.add_argument("folder_path", type=str,
                        help="Path to folder containing .eml files of requests")
    parser.add_argument("appfilter_path", type=str,
                        help="Path to existing appfilter.xml to recognize potentially updatable appfilters")
    parser.add_argument("extracted_png_folder_path", type=str,
                        help="Path to folder containing extracted PNGs")
    parser.add_argument("requests_path", type=str, default=None,
                        help="Path to folder containing the request.txt and updatable.txt")
    return parser.parse_args()

# -------------------------------------------------------
# FILE / EMAIL I/O
# -------------------------------------------------------


def load_emails(folder_path: Path) -> list[Path]:
    """Return list of .eml files."""
    if not folder_path.is_dir():
        raise ValueError(f"Provided path is not a directory: {folder_path}")
    return list(folder_path.glob('*.eml'))


def read_email(file_path: Path) -> Message:
    """Return parsed email.message.Message."""
    with open(file_path, 'rb') as f:
        return email.message_from_bytes(f.read())


def extract_zip_from_email(message: Message) -> zipfile.ZipFile | None:
    """Return zipfile.ZipFile or None."""
    for part in message.walk():
        if ((part.get_content_maintype() == 'application' and part.get_content_subtype() in ['zip', 'octet-stream']) or
                (filename := part.get_filename()) and filename.endswith('.zip')):
            zip_data = part.get_payload(decode=True)
            return zipfile.ZipFile(io.BytesIO(zip_data))  # type: ignore
    return None


def extract_xml(zip_file: zipfile.ZipFile) -> ET.Element:
    """Return parsed appfilter XML root."""
    xml_string = zip_file.read('!appfilter.xml')
    root = ET.fromstring(xml_string)
    return root


def extract_png(zip_file: zipfile.ZipFile, drawable_name: str, out_dir: Path) -> str:
    """Extract PNG from zip, deduplicate filename if needed, and save to out_dir."""
    base_name = drawable_name
    candidate_name = base_name
    try:
        # Find the PNG file in the zip matching the drawable name
        for file_info in zip_file.infolist():
            if file_info.filename.endswith(f'{base_name}.png'):
                with zip_file.open(file_info.filename) as png_file:
                    png_content = png_file.read()
                # Deduplicate filename if needed
                png_path = out_dir / f"{candidate_name}.png"
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
        print(f"Error extracting PNG file for '{drawable_name}': {e}")
    return candidate_name

# -------------------------------------------------------
# PARSING EXISTING DATA (JSON)
# -------------------------------------------------------

def parse_existing_requests_json(json_path: Path) -> dict:
    """
    Load existing requests.json.
    Return dict[drawable] = {...request metadata...}
    """
    if not json_path.exists():
        return {}
    with open(json_path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            print(f"Warning: Failed to parse existing JSON at {json_path}. Starting fresh.")
            return {}
    
    apps = data.get("apps", [])
    data = {}
    
    for app in apps:
        component_names = app.get("componentNames", [])
        for comp in component_names:
            component_name = comp.get("componentName")
            if component_name:
                data[component_name] = app
    
    return  data


# -------------------------------------------------------
# APP REQUEST PROCESSING
# -------------------------------------------------------
def create_app_entry(app_name: str, component_info: str, drawable_name: str, request_timestamp: float) -> dict:
    """Create a new app entry structure."""
    return {
        "drawable": drawable_name,
        "componentNames": [{
            "label": app_name,
            "componentName": component_info
        }],
        "requestCount": 1,
        "lastRequested": request_timestamp
    }


def get_request_timestamp(msg: Message) -> float:
    """Extract and parse timestamp from email message."""
    try:
        date_header = msg.get('Date')
        if not date_header:
            return 0
        parsed = parsedate(str(date_header))
        return mktime(parsed) if parsed else 0
    except Exception:
        return 0


def process_item_tag(item: ET.Element) -> tuple[str, str, str] | None:
    """Extract and validate item tag data."""
    component_name = item.get('component')
    app_name = item.get('name')
    drawable = item.get('drawable')

    if not all([component_name, app_name, drawable]):
        return None

    component_match = COMPONENT_PATTERN.search(component_name)
    if not component_match:
        return None

    return component_match.group('ComponentInfo'), app_name, drawable


def parse_item_tag(item: ET.Element, msg: Message, zip_file: zipfile.ZipFile,
                   apps: dict, sender_counter: Counter, png_out_dir: Path) -> dict:
    """Process single item tag and update apps structure."""
    if is_greedy(msg, sender_counter):
        return apps

    item_data = process_item_tag(item)
    if not item_data:
        return apps

    component_info, app_name, drawable = item_data
    request_timestamp = get_request_timestamp(msg)
    updated_apps = apps.copy()

    if component_info in updated_apps:
        updated_apps[component_info].update({
            "requestCount": updated_apps[component_info].get("requestCount", 0) + 1,
            "lastRequested": max(updated_apps[component_info].get("lastRequested", 0), request_timestamp)
        })
        return updated_apps

    try:
        drawable_name = extract_png(zip_file, drawable, png_out_dir)
        updated_apps[component_info] = create_app_entry(
            app_name, component_info, drawable_name, request_timestamp)
    except Exception as e:
        print(f"Failed to process new request for {component_info}: {str(e)}")

    return updated_apps


def parse_emails(email_files: list[Path], apps: dict, sender_counter: Counter, png_out_dir: Path) -> dict:
    """Process all email files and update apps dictionary."""
    for email_file in email_files:
        msg = read_email(email_file)
        zip_file = extract_zip_from_email(msg)

        if not zip_file:
            sender = parseaddr(msg['From'])[1].lower()
            handle_invalid_email(sender, email_file)
            continue

        try:
            xml_root = extract_xml(zip_file)
            for item in xml_root.findall('item'):
                apps = parse_item_tag(
                    item, msg, zip_file, apps, sender_counter, png_out_dir)
        except Exception as e:
            print(f"Error processing email {email_file}: {e}")

    return apps


# -------------------------------------------------------
# CLEANUP + FILTERS
# -------------------------------------------------------
def handle_invalid_email(sender: str, email_path: Path) -> None:
    """
    Move invalid emails (those without zip attachments) to failedmail directory.

    Args:
        sender: Email sender address
        email_path: Path to email file
    """
    failed_dir = Path("failedmail")
    failed_dir.mkdir(parents=True, exist_ok=True)

    try:
        email_path.rename(failed_dir / email_path.name)
        print(f"Moved invalid email from {sender} to failedmail/")
    except OSError as e:
        print(f"Failed to move invalid email: {e}")

def load_existing_components(appfilter_path: Path) -> set[str]:
    """
    Parse appfilter.xml and return a set of ComponentInfo strings.
    Used only for deduplication.
    """
    import lxml.etree as ET
    root = ET.parse(appfilter_path).getroot()
    components = set()

    for item in root.findall(".//item"):
        comp = item.get("component")
        if not comp:
            continue
        match = COMPONENT_PATTERN.search(comp)
        if match:
            components.add(match.group(1))

    return components


def filter_old_requests(apps: dict, months_limit: int, min_requests: int) -> dict:
    """Remove outdated / rarely requested apps."""

    current_date = date.today()

    def diff_month(d1, d2):
        return (d1.year - d2.year) * 12 + d1.month - d2.month

    filtered_apps = {}
    for k, v in apps.items():
        ts = v.get("lastRequested", 0)
        if ts <= 0:
            continue
        app_date = date.fromtimestamp(ts)
        if v.get("requestCount", 0) >= min_requests or diff_month(current_date, app_date) < months_limit:
            filtered_apps[k] = v

    return filtered_apps


def delete_unused_pngs(out_dir: Path, keep: set[str]) -> None:
    """Delete icons not referenced in final JSON."""
    for png_file in os.listdir(out_dir):
        if png_file.endswith(".png"):
            drawable_name = os.path.splitext(png_file)[0]
            if drawable_name not in keep:
                file_path = os.path.join(out_dir, png_file)
                os.remove(file_path)
                print(f"Deleted unused icon: {file_path}")

# -------------------------------------------------------
# JSON OUTPUT STRUCTURE
# -------------------------------------------------------


def build_json_output(apps: dict) -> dict:
    """Assemble final JSON structure."""
    today = date.today()
    return {
        "count": len(apps),
        "lastUpdate": today.strftime("%Y-%m-%d"),
        "apps": list(apps.values()),
    }


def write_json_output(output_path: Path, data: dict):
    """Write requests.json file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)

# -------------------------------------------------------
# MAIN PIPELINE
# -------------------------------------------------------


def run_pipeline(folder_path: Path, appfilter_path: Path, png_out_path: Path, output_path: Path):
    """
    Pure functional pipeline:
    1. Load emails
    2. Load existing requests.json
    3. Parse new requests
    4. Filter + merge
    5. Write JSON output
    6. Cleanup icons
    """
    email_files = load_emails(folder_path)

    sender_counter = Counter()

    # Step 1: Load existing JSON
    apps = parse_existing_requests_json(output_path)

    # Step 2: Parse emails
    apps = parse_emails(email_files, apps, sender_counter, png_out_path)

    # Step 3: Filter
    apps = filter_old_requests(
        apps, CONFIG["months_limit"], CONFIG["min_requests"])
    
    existing_components = load_existing_components(appfilter_path)
    apps = {k: v for k, v in apps.items() if k not in existing_components}

    # Step 4: Write JSON
    json_data = build_json_output(apps)
    write_json_output(output_path, json_data)

    # Step 5: Cleanup
    keep_pngs = {a["drawable"] for a in apps.values()}
    delete_unused_pngs(png_out_path, keep_pngs)

    print("Requests updated successfully.")
    print_greedy_report(sender_counter, CONFIG["request_limit"])

# -------------------------------------------------------
# UTILITIES
# -------------------------------------------------------


def is_greedy(message, sender_counter):
    sender = parseaddr(message['From'])[1].lower()
    sender_counter[sender] += 1
    return sender_counter[sender] > CONFIG["request_limit"]


def print_greedy_report(counter: Counter, limit: int):
    """Report excessive senders."""
    for sender, count in counter.items():
        if count > limit:
            print(f"⚠️  Greedy sender ({count} requests): {sender}")


# -------------------------------------------------------
# ENTRY POINT
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