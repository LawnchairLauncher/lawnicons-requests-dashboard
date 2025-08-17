import email
import zipfile
import lxml.etree as ET
import re
from time import mktime
from email.utils import parsedate
import io
from datetime import date
from collections import defaultdict, Counter
from pathlib import Path
import argparse
import os

config = {
    "request_limit": 1000,
    "months_limit": 6,
    "min_requests": 4,
    "date_format": "X%d %B %Y",
}

def parse_args():
    parser = argparse.ArgumentParser(description="Script to parse emails and generate/update requests.txt and updatable.txt")
    parser.add_argument("folder_path", type=str, help="Path to folder containing .eml files of requests")
    parser.add_argument("appfilter_path", type=str, help="Path to existing appfilter.xml to recognize potentially updatable appfilters")
    parser.add_argument("extracted_png_folder_path", type=str, help="Path to folder containing extracted PNGs")
    parser.add_argument("requests_path", type=str, default=None, help="Path to folder containing the request.txt and updatable.txt")
    return parser.parse_args()

class EmailParser:
    def __init__(self, folder_path, appfilter_path, extracted_png_folder_path, requests_path=None):
        self.folder_path = Path(folder_path)
        self.appfilter_path = Path(appfilter_path)
        self.extracted_png_folder_path = Path(extracted_png_folder_path)
        self.requests_path = Path(requests_path+'/requests.txt') if requests_path else None
        self.updatable_path = Path(requests_path+'/updatable.txt') if requests_path else None

        self.filelist = list(self.folder_path.glob('*.eml'))
        self.apps = defaultdict(dict)
        self.email_count = Counter()
        self.no_zip = {}
        self.updatable = []
        self.new_apps = []
        self.keep_pngs = set()

        # --- SIMPLIFICATION ---
        # The name_pattern regex is no longer needed as the name is a direct attribute.
        self.component_pattern = re.compile('ComponentInfo{(?P<ComponentInfo>.+)}')
        self.package_name_pattern = re.compile(r'(?P<PackageName>[\w\.]+)/')
        self.request_block_query = re.compile(r'<!-- (?P<Name>.+) -->\s<item component=\"ComponentInfo{(?P<ComponentInfo>.+)}\" drawable=\"(?P<drawable>.+|)\"(/>| />)\s(https:\/\/play.google.com\/store\/apps\/details\?id=.+\shttps:\/\/f-droid\.org\/en\/packages\/.+\shttps:\/\/apt.izzysoft.de\/fdroid\/index\/apk\/.+\shttps:\/\/galaxystore.samsung.com\/detail\/.+\shttps:\/\/www.ecosia.org\/search\?q\=.+\s)Requested (?P<count>\d+) times\s?(Last requested (?P<requestDate>\d+\.?\d+?))?', re.M)
        self.update_block_query = re.compile(r'<!-- (?P<Name>.+) -->\s<item component=\"ComponentInfo{(?P<ComponentInfo>.+)}\" drawable=\"(?P<drawable>.+|)\"(/>| />)', re.M)

    def parse_existing(self,block_query,path):
        if not path.exists():
            return
        with open(path, 'r', encoding="utf8") as existing_file:
            contents = existing_file.read()
            existing_requests = re.finditer(block_query, contents)
            for req in existing_requests:
                element_info = req.groupdict()
                self.apps[element_info['ComponentInfo']] = element_info
                self.apps[element_info['ComponentInfo']]['requestDate'] = float(element_info.get('requestDate', mktime(date.today().timetuple()))) if element_info.get('requestDate', mktime(date.today().timetuple())) is not None else mktime(date.today().timetuple())
                self.apps[element_info['ComponentInfo']]['count'] = int(element_info.get('count',1)) if element_info.get('count',1) is not None else 1
                self.apps[element_info['ComponentInfo']]['senders'] = []

    def filter_old(self):
        current_date = date.today()
        def diff_month(d1, d2):
            return (d1.year - d2.year) * 12 + d1.month - d2.month
        self.apps = {
            k: v for k, v in self.apps.items()
            if v["count"] > config["min_requests"] or diff_month(current_date, date.fromtimestamp(v['requestDate'])) < config["months_limit"]
        }

    def find_zip(self, message):
        for part in message.walk():
            if part.get_content_maintype() == 'application' and part.get_content_subtype() in ['zip', 'octet-stream']:
                zip_data = part.get_payload(decode=True)
                return zipfile.ZipFile(io.BytesIO(zip_data))
        return None

    def greedy(self, message):
        sender = message['From']
        self.email_count[sender] += 1
        return self.email_count[sender] > config["request_limit"]

    def print_greedy_senders(self):
        for sender, count in self.email_count.items():
            if count > config["request_limit"]:
                print(f'---- We have a greedy one: {count} Requests from {sender}')

    def parse_email(self):
        for mail in self.filelist:
            with open(mail, 'rb') as f:
                message = email.message_from_bytes(f.read())
                zip_file = self.find_zip(message)
                if zip_file is None:
                    self.no_zip[message['From']] = mail
                    continue
                try:
                    with zip_file as zip_ref:
                        xml_string = zip_ref.read('!appfilter.xml')
                        root = ET.fromstring(xml_string)
                        self.process_xml(root, message, zip_file)
                except Exception as e:
                    self.no_zip[message['From']] = mail
                    print(f"Error processing email {mail}: {e}")

    def process_xml(self, root, msg, zip_file):
        # The new format is simpler; we can directly iterate over 'item' tags
        for child in root.findall('.//item'):
            self.process_request_item(child, msg, zip_file)

    def extract_png(self, drawable_name, zip_file):
        new_drawable_name = drawable_name
        try:
            for file_info in zip_file.infolist():
                if file_info.filename.endswith(f'{drawable_name}.png'):
                    with zip_file.open(file_info.filename) as png_file:
                        png_content = png_file.read()
                        png_filename = os.path.join(self.extracted_png_folder_path, f"{drawable_name}.png")

                        number = 0
                        while os.path.exists(png_filename):
                            number += 1
                            new_drawable_name = f"{drawable_name}_{number}"
                            png_filename = os.path.join(self.extracted_png_folder_path, f"{new_drawable_name}.png")

                        with open(png_filename, 'wb') as new_png_file:
                            new_png_file.write(png_content)
                        return new_drawable_name
        except Exception as e:
            print(f"Error extracting PNG file for '{drawable_name}': {e}")
        return new_drawable_name

    # --- MAJOR REFACTOR ---
    # This method is now heavily simplified. It no longer needs to handle comments
    # and items separately. All required data is in the <item> tag.
    def process_request_item(self, item, msg, zip_file):
        component_name = item.get('component')
        app_name = item.get('name')
        drawable = item.get('drawable')

        # Skip if essential information is missing
        if not all([component_name, app_name, drawable]):
            return

        component_match = re.search(self.component_pattern, component_name)
        if not component_match:
            return

        component_info = component_match.group('ComponentInfo')

        if self.greedy(msg):
            return

        if component_info in self.apps:
            self.apps[component_info]['count'] += 1
        else:
            # This is a new request
            new_drawable_name = self.extract_png(drawable, zip_file)
            self.apps[component_info] = {
                'Name': app_name,
                'ComponentInfo': component_info,
                'drawable': new_drawable_name,
                'count': 1
            }

        # Always update to the most recent request date
        request_timestamp = mktime(parsedate(msg['Date']))
        if 'requestDate' not in self.apps[component_info] or self.apps[component_info]['requestDate'] < request_timestamp:
            self.apps[component_info]['requestDate'] = request_timestamp

    def move_no_zip(self):
        for failedmail in self.no_zip:
            normalized_path = Path(self.no_zip[failedmail]).resolve()
            print(f'--- No zip file found for {failedmail}\n------ File moved to failedmail')
            if normalized_path.exists():
                destination_path = Path("failedmail") / normalized_path.name
                destination_path.parent.mkdir(parents=True, exist_ok=True)
                try:
                    normalized_path.rename(destination_path)
                except FileNotFoundError:
                    print(f"Error: File not found during move: {normalized_path}")
            else:
                print(f"Error: File not found: {normalized_path}")

    def separate_updatable(self):
        object_block = """
<!-- {name} -->
<item component="ComponentInfo{{{component}}}" drawable="{appname}"/>
https://play.google.com/store/apps/details?id={packageName}
https://f-droid.org/en/packages/{packageName}/
https://apt.izzysoft.de/fdroid/index/apk/{packageName}
https://galaxystore.samsung.com/detail/{packageName}
https://www.ecosia.org/search?q={packageName}
Requested {count} times
Last requested {reqDate}
    """
        # --- ROBUSTNESS FIX ---
        # Handle case where the provided path is a directory instead of a file.
        appfilter_file_path = self.appfilter_path
        if appfilter_file_path.is_dir():
            # If a directory is given, assume the target file is 'combined_appfilter.xml'
            # as this is the standard output from the GitHub Action.
            print(f"Path provided is a directory. Looking for 'combined_appfilter.xml' inside...")
            appfilter_file_path = appfilter_file_path / 'appfilter.xml'

        try:
            appfilter_tree = ET.parse(appfilter_file_path)
        except FileNotFoundError:
            print(f"FATAL ERROR: The master appfilter file could not be found at '{appfilter_file_path}'.")
            print("Please check that the path is correct and the file exists.")
            return # Exit the method gracefully to avoid a crash.
        except ET.ParseError as e:
            print(f"FATAL ERROR: Failed to parse the XML file at '{appfilter_file_path}'. It may be corrupted. Error: {e}")
            return

        root = appfilter_tree.getroot()

        # Build sets of existing components and package names for efficient lookup
        existing_components = set()
        existing_package_names = set()
        for item in root.findall('.//item'):
            component_info = item.get('component')
            match = re.search(r'\{(.*?)\}', component_info)
            if match:
                component = match.group(1)
                existing_components.add(component)
                existing_package_names.add(component.split('/')[0])

        new_apps_set = set()
        updatable_set = set()

        for componentInfo, values in self.apps.items():
            try:
                packageName = componentInfo.split('/')[0]

                if componentInfo in existing_components:
                    continue # Already themed, ignore.

                if packageName not in existing_package_names and componentInfo not in new_apps_set:
                    # This is a completely new app
                    self.new_apps.append(object_block.format(
                        name=values["Name"],
                        component=values["ComponentInfo"],
                        appname=values["drawable"],
                        packageName=packageName,
                        count=values["count"],
                        reqDate=values["requestDate"],
                    ))
                    self.keep_pngs.add(values["drawable"])
                    new_apps_set.add(componentInfo)
                elif packageName in existing_package_names and componentInfo not in updatable_set:
                    # This is a new activity for an existing app
                    self.updatable.append(
                        f'<!-- {values["Name"]} -->\n'
                        f'<item component="ComponentInfo{{{values["ComponentInfo"]}}}" drawable="{values["drawable"]}"/>\n\n'
                    )
                    updatable_set.add(componentInfo)
                    self.keep_pngs.add(values["drawable"])
            except Exception as e:
                print(f"Error separating app '{values.get('Name')}': {e}")

    def delete_unused_icons(self):
        if not os.path.exists(self.extracted_png_folder_path):
            return
        for png_file in os.listdir(self.extracted_png_folder_path):
            if png_file.endswith(".png"):
                drawable_name = os.path.splitext(png_file)[0]
                if drawable_name not in self.keep_pngs:
                    file_path = os.path.join(self.extracted_png_folder_path, png_file)
                    os.remove(file_path)
                    print(f"Deleted unused icon: {file_path}")

    def write_output(self):
        new_list_header = """-------------------------------------------------------
{total_count} Requested Apps Pending (Updated {date})
-------------------------------------------------------
"""
        new_list = new_list_header.format(total_count=len(self.new_apps), date=date.today().strftime(config["date_format"]).replace("X0", "X").replace("X", ""))
        new_list += ''.join(self.new_apps)

        with open(self.requests_path, 'w', encoding='utf-8') as file:
            file.write(new_list)
        if len(self.updatable):
            with open(self.updatable_path, 'w', encoding='utf-8') as file_two:
                file_two.write(''.join(self.updatable))

    def main(self):
        if self.updatable_path and self.updatable_path.exists():
            print("Parsing Existing Updatable...")
            self.parse_existing(self.update_block_query, self.updatable_path)
        if self.requests_path and self.requests_path.exists():
            print("Parsing Existing Requests...")
            self.parse_existing(self.request_block_query, self.requests_path)

        print("Filtering Old Requests...")
        self.filter_old()

        print("Parsing New Emails...")
        self.parse_email()

        print("Sorting Apps by Request Count...")
        self.apps = dict(sorted(self.apps.items(), key=lambda item: item[1]['count'], reverse=True))

        print("Separating New vs. Updatable Apps...")
        self.separate_updatable()

        print("Writing Output Files...")
        self.write_output()

        print("Cleaning Up Unused Icons...")
        self.delete_unused_icons()

        self.print_greedy_senders()
        self.move_no_zip()
        print("Processing complete.")

if __name__ == "__main__":
    args = parse_args()
    parser = EmailParser(args.folder_path, args.appfilter_path, args.extracted_png_folder_path, args.requests_path)
    parser.main()
