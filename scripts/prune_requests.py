import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
LOCAL_APPFILTER = REPO_ROOT / "src/assets/appfilter.xml"
REQUESTS_JSON = REPO_ROOT / "src/assets/requests.json"
EXTRACTED_IMAGE_DIR = REPO_ROOT / "src/extracted_images"
FILTERS_DIR = REPO_ROOT / "src/assets/filters"

UPSTREAM_APPFILTER = "https://raw.githubusercontent.com/LawnchairLauncher/lawnicons/develop/app/assets/appfilter.xml"

COMPONENT_PATTERN = re.compile(r"ComponentInfo\{([^}]+)}")
DYNAMIC_PACKAGES_PATH = REPO_ROOT / "src/assets/dynamic_packages.json"


def set_workflow_output(name: str, value: str) -> None:
    github_output = os.environ.get("GITHUB_OUTPUT")
    if not github_output:
        return
    with open(github_output, "a", encoding="utf-8") as f:
        f.write(f"{name}={value}\n")


def fetch_upstream_appfilter() -> bytes:
    errors = []
    try:
        with urllib.request.urlopen(UPSTREAM_APPFILTER, timeout=30) as response:
            body = response.read()
            print(f"Fetched upstream appfilter from: {UPSTREAM_APPFILTER}")
            return body
    except urllib.error.HTTPError as err:
        errors.append(f"{UPSTREAM_APPFILTER} -> HTTP {err.code}")
    except urllib.error.URLError as err:
        errors.append(f"{UPSTREAM_APPFILTER} -> {err.reason}")

    details = "\n".join(errors)
    raise RuntimeError(f"Failed to download upstream appfilter.xml:\n{details}")


def extract_component(component_attr: str) -> str:
    match = COMPONENT_PATTERN.search(component_attr)
    if not match:
        return ""
    return match.group(1).strip()


def load_upstream_components(xml_bytes: bytes) -> set[str]:
    root = ET.fromstring(xml_bytes)
    components = set()

    for element in root:
        component_attr = element.get("component")
        if not component_attr:
            continue

        component = extract_component(component_attr)
        if component:
            components.add(component)

    return components

def load_dynamic_packages() -> set[str]:
    if not DYNAMIC_PACKAGES_PATH.exists():
        return set()
    try:
        with open(DYNAMIC_PACKAGES_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return set(data.get("packages", []))
    except Exception as e:
        print(f"Warning: could not load dynamic_packages.json: {e}")
        return set()

def delete_drawable_image(drawable_name: str) -> bool:
    if not drawable_name:
        return False
    drawable_path = EXTRACTED_IMAGE_DIR / f"{drawable_name}.webp"
    if not drawable_path.exists():
        return False
    drawable_path.unlink()
    return True


def prune_filter_files() -> int:
    """Remove stale componentName entries from every filter JSON in FILTERS_DIR.

    An entry is stale if it no longer exists in the current requests.json.
    This catches entries left over from previous pruning runs, not just the
    current one.

    Returns the total number of entries removed across all filter files.
    """
    if not FILTERS_DIR.exists():
        return 0

    # Build the authoritative set of valid componentNames from the current requests.json
    try:
        with open(REQUESTS_JSON, "r", encoding="utf-8") as f:
            requests_data = json.load(f)
        valid_components = {
            app.get("componentName", "")
            for app in requests_data.get("apps", [])
        }
        valid_components.discard("")
    except Exception as e:
        print(f"  Warning: could not load requests.json for filter cleanup: {e}")
        return 0

    total_removed = 0

    for filter_path in FILTERS_DIR.glob("*.json"):
        try:
            with open(filter_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"  Warning: could not read {filter_path.name}: {e}")
            continue

        # The list key matches the file stem (e.g. "match.json" -> "match")
        key = filter_path.stem
        if key not in data or not isinstance(data[key], list):
            continue

        original = data[key]
        cleaned = [entry for entry in original if (entry if isinstance(entry, str) else entry.get("id", "")) in valid_components]
        pruned = len(original) - len(cleaned)

        if pruned:
            # Save done/total before overwriting for supported.json
            saved_done = data.get('done', 0)
            saved_total = data.get('total', 0)
            data[key] = cleaned
            if key == 'supported':
                data['done'] = saved_done
                data['total'] = saved_total
            with open(filter_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            print(f"  Pruned {pruned} stale entries from {filter_path.name}")
            total_removed += pruned

    return total_removed


def prune_requests(components_to_remove: set[str]) -> tuple[int, int, set[str]]:
    with open(REQUESTS_JSON, "r", encoding="utf-8") as f:
        requests_data = json.load(f)

    apps = requests_data.get("apps", [])
    kept_apps = []
    removed_apps = []

    for app in apps:
        component_name = app.get("componentName", "")
        if component_name in components_to_remove:
            removed_apps.append(app)
        else:
            kept_apps.append(app)

    if removed_apps:
        requests_data["apps"] = kept_apps
        requests_data["count"] = len(kept_apps)
        requests_data["lastUpdate"] = time.strftime("%Y-%m-%d")
        with open(REQUESTS_JSON, "w", encoding="utf-8") as f:
            json.dump(requests_data, f, indent=2)

    deleted_image_count = 0
    seen_drawables = set()
    for app in removed_apps:
        drawable = app.get("drawable", "")
        if not drawable or drawable in seen_drawables:
            continue
        seen_drawables.add(drawable)
        if delete_drawable_image(drawable):
            deleted_image_count += 1

    removed_components = {app.get("componentName", "") for app in removed_apps}
    removed_components.discard("")
    return len(removed_apps), deleted_image_count, removed_components


def is_expired(app: dict, now: float) -> bool:
    """Check if an app request is expired.

    A request is expired when it was last made >= 1 year ago AND has been
    requested at most 3^(full years since last update) times.
    """
    last_requested = app.get("lastRequested", 0)
    request_count = app.get("requestCount", 0)
    if not last_requested:
        return False

    seconds_per_year = 365.25 * 86400
    age_years = (now - last_requested) / seconds_per_year
    full_years = int(age_years)

    if full_years < 1:
        return False

    return request_count <= 3 ** full_years + 3


def prune_expired_requests() -> tuple[int, int]:
    """Remove expired requests from requests.json and delete their images."""
    with open(REQUESTS_JSON, "r", encoding="utf-8") as f:
        requests_data = json.load(f)

    apps = requests_data.get("apps", [])
    now = time.time()
    kept_apps = []
    removed_apps = []

    for app in apps:
        if is_expired(app, now):
            removed_apps.append(app)
        else:
            kept_apps.append(app)

    if removed_apps:
        requests_data["apps"] = kept_apps
        requests_data["count"] = len(kept_apps)
        requests_data["lastUpdate"] = time.strftime("%Y-%m-%d")
        with open(REQUESTS_JSON, "w", encoding="utf-8") as f:
            json.dump(requests_data, f, indent=2)

    deleted_image_count = 0
    seen_drawables = set()
    for app in removed_apps:
        drawable = app.get("drawable", "")
        if not drawable or drawable in seen_drawables:
            continue
        seen_drawables.add(drawable)
        if delete_drawable_image(drawable):
            deleted_image_count += 1

    for app in removed_apps:
        label = app.get("label", "?")
        count = app.get("requestCount", 0)
        last = app.get("lastRequested", 0)
        age = (now - last) / (365.25 * 86400) if last else float("inf")
        print(f"  Expired: {label} (requests={count}, age={age:.1f}y)")

    return len(removed_apps), deleted_image_count


def generate_stale_list() -> int:
    """Generate stale.json containing requests that are at the front of the
    deletion queue.

    A stale request is one whose calculated expiration date falls within a 30-day
    window starting from the earliest expiration date among all requests.
    """
    try:
        with open(REQUESTS_JSON, "r", encoding="utf-8") as f:
            requests_data = json.load(f)
    except Exception as e:
        print(f"Error loading requests.json for stale list generation: {e}")
        return 0

    apps = requests_data.get("apps", [])
    if not apps:
        print("No apps in requests.json, skipping stale list generation")
        return 0

    now = time.time()
    seconds_per_year = 365.25 * 86400
    QUARTER_IN_SECONDS = 90 * 24 * 60 * 60

    request_expiration_dates = []
    
    for app in apps:
        last_requested = app.get("lastRequested", 0)
        request_count = app.get("requestCount", 0)
        comp_name = app.get("componentName", "")

        if not last_requested or not comp_name:
            continue

        n = 1
        while 3 ** n + 3 < request_count:
            n += 1
        
        expiration_at = last_requested + (n * seconds_per_year)
        request_expiration_dates.append((comp_name, expiration_at))

    if not request_expiration_dates:
        print("No requests with valid expiration dates found")
        return 0

    earliest_expiration = min(date for _, date in request_expiration_dates)
    window_end = earliest_expiration + QUARTER_IN_SECONDS

    start_date = time.strftime("%Y-%m-%d", time.localtime(earliest_expiration))
    end_date = time.strftime("%Y-%m-%d", time.localtime(window_end))
    print(f"Stale window: {start_date} to {end_date}")

    stale_components = [
        comp_name 
        for comp_name, expiration_at in request_expiration_dates
        if earliest_expiration <= expiration_at <= window_end
    ]

    stale_components.sort()

    stale_file_path = FILTERS_DIR / "stale.json"
    output_data = {
        "label": "Stale",
        "description": "Requests on death row. Double-check if the app is still around.",
        "stale": stale_components
    }

    with open(stale_file_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)

    print(f"Generated {stale_file_path} with {len(stale_components)} entries")
    return len(stale_components)

def update_sets_stats(apps: list) -> int:
    """Generate sets_stats.json with summed request counts per package.
    Only includes packages that appear 2+ times in requests.json."""
    sets_path = REPO_ROOT / "src/assets/stats/sets_stats.json"
    sets = {}
    
    for app in apps:
        component = app.get("componentName", "")
        if not component:
            continue
        package = component.split("/")[0]
        sets[package] = sets.get(package, 0) + app.get("requestCount", 0)

    # Keep only packages with 2+ components
    sets = {pkg: count for pkg, count in sets.items() if count > 1 and any(
        a.get("componentName", "").startswith(pkg + "/") for a in apps if a.get("componentName", "").split("/")[0] == pkg
    )}
    
    package_counts = {}
    for app in apps:
        pkg = app.get("componentName", "").split("/")[0]
        if pkg:
            package_counts[pkg] = package_counts.get(pkg, 0) + 1
    
    sets = {pkg: count for pkg, count in sets.items() if package_counts.get(pkg, 0) >= 2}

    sets = dict(sorted(sets.items(), key=lambda x: x[1], reverse=True))
    
    with open(sets_path, "w", encoding="utf-8") as f:
        json.dump(sets, f, indent=2)
    
    print(f"Updated sets_stats.json with {len(sets)} packages (2+ occurrences)")
    return len(sets)

def update_domain_stats() -> int:
    """Generate domain_stats.json with request counts and appfilter coverage by domain."""
    from collections import Counter
    import xml.etree.ElementTree as ET
    
    domain_stats_path = REPO_ROOT / "src/assets/stats/domain_stats.json"
    requests_graph_path = REPO_ROOT / "src/assets/requests_graph.json"
    
    with open(REQUESTS_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Load requests graph for presumed country
    req_graph = {}
    if requests_graph_path.exists():
        with open(requests_graph_path, "r", encoding="utf-8") as f:
            req_graph = json.load(f)

    # ISO country set
    ISO_COUNTRIES = {'ad','ae','af','ag','al','am','ao','ar','at','au','az','ba','bb','bd','be','bf','bg','bh','bi','bj','bo','br','bs','bw','by','bz','ca','cd','cf','cg','ch','ci','cl','cm','cn','cr','cu','cv','cy','cz','de','dj','dk','dm','do','dz','ec','ee','eg','er','es','et','fi','fj','fr','ga','ge','gh','gm','gn','gq','gr','gt','gw','gy','hk','hn','hr','ht','hu','id','ie','il','in','iq','ir','it','jm','jo','jp','ke','kg','kh','km','kn','kp','kr','kw','ky','kz','la','lb','lc','li','lk','lr','ls','lt','lu','lv','ly','ma','mc','md','mg','mk','ml','mm','mn','mr','mt','mu','mv','mw','mx','my','mz','na','ne','ng','ni','nl','no','np','nz','om','pa','pe','pg','ph','pk','pl','pr','ps','pt','py','qa','ro','rs','ru','rw','sa','sc','sd','se','sg','si','sk','sl','sm','sn','so','sr','ss','sv','sy','sz','td','tg','th','tj','tl','tm','tn','tr','tt','tw','tz','ua','ug','uk','us','uy','uz','vc','ve','vi','vn','ye','za','zm','zw'}
    
    def get_domain(comp):
        pkg = comp.split("/")[0]
        return pkg.split(".")[0] if "." in pkg else "unknown"

    def is_country(domain):
        return domain in ISO_COUNTRIES

    # Build apps dict for quick installs lookup
    apps_dict = {app["componentName"]: app for app in data.get("apps", [])}

    # Counters
    requests_counter = Counter()
    global_counter = Counter()
    global_installs_counter = Counter()

    for app in data.get("apps", []):
        comp = app.get("componentName", "")
        domain = get_domain(comp)
        
        if is_country(domain):
            requests_counter[domain] += 1
        elif comp in req_graph:
            # Count for the non-geo domain itself
            requests_counter[domain] += 1
            
            neighbors = req_graph[comp]
            linked_countries = set()

            for neighbor in neighbors:
                n_domain = get_domain(neighbor)
                if is_country(n_domain):
                    linked_countries.add(n_domain)

            # Get installs for this request
            inst = 0
            app_data = apps_dict.get(comp)
            if app_data:
                inst_val = app_data.get("installs")
                inst_str = (inst_val or "0").replace(",", "").replace("+", "")
                inst = int(inst_str) if inst_str.isdigit() else 0

            for country in linked_countries:
                requests_counter[country] += 1
                global_counter[country] += 1
                global_installs_counter[country] += inst

        elif domain == 'com':
            requests_counter['us'] += 1
            global_counter['us'] += 1
            inst = 0
            app_data = apps_dict.get(comp)
            if app_data:
                inst_val = app_data.get("installs")
                inst_str = (inst_val or "0").replace(",", "").replace("+", "")
                inst = int(inst_str) if inst_str.isdigit() else 0
            global_installs_counter['us'] += inst

        else:
            # Non-geo, not in graph — still count for its domain
            requests_counter[domain] += 1

    appfilter_counter = Counter()
    appfilter_path = REPO_ROOT / "src/assets/appfilter.xml"
    if appfilter_path.exists():
        tree = ET.parse(appfilter_path)
        for item in tree.findall("item"):
            comp = item.get("component", "")
            match = re.search(r"ComponentInfo\{([^/]+)", comp)
            if match:
                domain = match.group(1).split(".")[0]
                appfilter_counter[domain] += 1

    all_domains = set(list(requests_counter.keys()) + list(appfilter_counter.keys()))
    output = {}
    for domain in all_domains:
        output[domain] = {
            "requests": requests_counter.get(domain, 0),
            "done": appfilter_counter.get(domain, 0),
            "total": requests_counter.get(domain, 0) + appfilter_counter.get(domain, 0),
            "global": global_counter.get(domain, 0),
            "global_installs": global_installs_counter.get(domain, 0)
        }

    output = dict(sorted(output.items(), key=lambda x: (-x[1]["total"], x[0])))

    if domain_stats_path.exists():
        try:
            with open(domain_stats_path, "r", encoding="utf-8") as f:
                old_data = json.load(f)
            if "_population" in old_data:
                output["_population"] = old_data["_population"]
        except Exception:
            pass

    with open(domain_stats_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    total_global = sum(global_counter.values())
    print(f"Updated domain_stats.json with {len(output)} domains ({total_global} presumed country assignments)")
    return len(output)

def update_activity_stats(
    total: int,
    fulfilled_removed: int,
    expired_removed: int,
) -> int:
    """Append daily stats point to stats_history.json for activity graph."""
    from datetime import date
    
    activity_stats_path = REPO_ROOT / "src/assets/stats/activity_stats.json"
    today = date.today().isoformat()
    
    history = []
    if activity_stats_path.exists():
        try:
            with open(activity_stats_path, "r", encoding="utf-8") as f:
                history = json.load(f)
        except Exception:
            history = []

    # Fill missing days with zero entries
    if history:
        last = history[-1]
        last_date = date.fromisoformat(last["date"])
        day = last_date + date.resolution
        stop = date.fromisoformat(today)
        while day < stop:
            history.append({
                "date": day.isoformat(),
                "total": last["total"],
                "added": 0,
                "fulfilled": 0,
                "expired": 0,
            })
            day += date.resolution

    last_total = history[-1]["total"] if history else total
    new_added = max(0, total - last_total + fulfilled_removed + expired_removed)

    entry = {
        "date": today,
        "total": total,
        "added": new_added,
        "fulfilled": fulfilled_removed,
        "expired": expired_removed,
    }
    
    if history and history[-1]["date"] == today:
        existing = history[-1]
        entry = {
            "date": today,
            "total": total,
            "added": existing["added"] + new_added,
            "fulfilled": existing["fulfilled"] + fulfilled_removed,
            "expired": existing["expired"] + expired_removed,
        }
        history[-1] = entry
    else:
        history.append(entry)

    # Keep only last 365 days
    cutoff = (date.today() - date.resolution * 365).isoformat()
    history = [entry for entry in history if entry["date"] >= cutoff]        
        
    with open(activity_stats_path, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)
    
    total_resolved = fulfilled_removed + expired_removed
    print(f"Updated activity_stats.json with {len(history)} entries (today: +{new_added}, -{total_resolved} resolved)")
    return len(history)

label_factors = {
    "stale": 0.1,
    "unlabeled": 1,
    "nameinuse": 1,
    "easy": 3,
    "match": 5,
    "supported": 6,
    "wip": 8,
}

def update_fulfillment_history(removed_components: set[str], old_apps: dict) -> int:
    """Record fulfilled requests with firstAppearance and fulfillment date.
    
    Only records requests that were just removed from requests.json
    (i.e., newly discovered in upstream appfilter.xml).
    Keeps entries from the last 365 days.
    """
    fulfillment_path = REPO_ROOT / "src/assets/stats/fulfillment_history.json"
    now = time.time()
    cutoff = now - 365 * 86400  # 1 year ago
    
    # Load sets_stats for popularity
    sets_stats = {}
    sets_path = REPO_ROOT / "src/assets/stats/sets_stats.json"
    try:
        with open(sets_path) as f:
            sets_stats = json.load(f)
    except:
        pass
    
    # Load filter data to compute label_factor
    app_tags = {}
    for filter_path in FILTERS_DIR.glob("*.json"):
        tag = filter_path.stem
        if tag not in label_factors:
            continue
        try:
            with open(filter_path) as f:
                data = json.load(f)
            for item in data.get(tag, []):
                comp_id = item if isinstance(item, str) else item.get("id", "")
                if comp_id:
                    if comp_id not in app_tags:
                        app_tags[comp_id] = set()
                    app_tags[comp_id].add(tag)
        except:
            pass
    
    # Load existing history
    history = []
    if fulfillment_path.exists():
        try:
            with open(fulfillment_path, "r") as f:
                history = json.load(f)
        except Exception:
            history = []
    
    # Add newly fulfilled requests
    added = 0
    for comp in removed_components:
        app = old_apps.get(comp)
        if not app:
            continue
        first_appearance = app.get("firstAppearance")
        if not first_appearance:
            continue
        
        pkg = comp.split("/")[0]
        pop = sets_stats.get(pkg, app.get("requestCount", 0))
        
        tags = app_tags.get(comp, set())
        factor = 1
        for tag in tags:
            if tag in label_factors and label_factors[tag] > factor:
                factor = label_factors[tag]
        
        history.append({
            "firstAppearance": first_appearance,
            "fulfilled": now,
            "popularity": pop,
            "label_factor": factor
        })
        added += 1
    
    # Rotate: keep only last 365 days
    history = [entry for entry in history if entry["fulfilled"] >= cutoff]
    
    with open(fulfillment_path, "w") as f:
        json.dump(history, f, indent=2)
    
    print(f"Updated fulfillment_history.json: +{added} entries, {len(history)} total (last 365 days)")
    return len(history)

def calculate_roi_scores():
    """Calculate ROI score for each request and update requests.json."""
    import math
    from collections import Counter
    
    with open(REQUESTS_JSON, "r", encoding="utf-8") as f:
        requests_data = json.load(f)
    
    apps = requests_data.get("apps", [])
    
    # Load required data

    with open(REPO_ROOT / "src/assets/filters/supported.json") as f:
        supported = set(json.load(f).get("supported", []))

    with open(REPO_ROOT / "src/assets/filters/easy.json") as f:
        easy = set(json.load(f).get("easy", []))
    
    with open(REPO_ROOT / "src/assets/filters/foss.json") as f:
        foss = set(json.load(f).get("foss", []))

    with open(REPO_ROOT / "src/assets/filters/stale.json") as f:
        stale = set(json.load(f).get("stale", []))
    
    with open(REPO_ROOT / "src/assets/requests_graph.json") as f:
        graph = json.load(f)
    
    with open(REPO_ROOT / "src/assets/stats/domain_stats.json") as f:
        domain_stats = json.load(f)
    
    with open(REPO_ROOT / "src/assets/screens_graph.json") as f:
        screens_graph = json.load(f)
    
    with open(REPO_ROOT / "src/assets/stats/trending_baseline.json") as f:
        trending = json.load(f)
    
    # 90d May-July 2026
    USER_LOSS = {
        'in': 5231, 'us': 2806, 'br': 1842, 'ru': 1810, 'id': 1681,
        'ph': 957, 'mx': 820, 'uk': 643, 'bd': 616, 'de': 588,
        'vn': 568, 'tr': 478, 'ar': 447, 'pk': 424, 'ca': 423,
        'it': 393, 'jp': 342, 'co': 341, 'pl': 339, 'ua': 315,
        've': 308, 'eg': 288, 'fr': 281, 'my': 268, 'es': 253,
        'ng': 232, 'nl': 205, 'hk': 202, 'pe': 171, 'za': 168,
        'th': 163, 'dz': 157, 'ir': 153, 'ec': 150, 'ro': 149,
        'lk': 132, 'sa': 123, 'by': 109, 'ke': 104, 'ae': 95,
        'sg': 85, 'ch': 78, 'mg': 77, 'cz': 71, 'et': 61,
        'sv': 60, 'no': 51, 'tz': 47, 'uz': 46, 'at': 39,
        'bg': 39, 'zw': 38, 'zm': 21, 'pa': 17, 'ci': 14,
        'bt': 2, 'aw': 1
    }
    
    MAX_LOSS = max(USER_LOSS.values())
    POPULATION = domain_stats.get('_population', {})
    
    ISO_COUNTRIES = {'ad','ae','af','ag','al','am','ao','ar','at','au','az','ba','bb','bd','be','bf','bg','bh','bi','bj','bo','br','bs','bw','by','bz','ca','cd','cf','cg','ch','ci','cl','cm','cn','cr','cu','cv','cy','cz','de','dj','dk','dm','do','dz','ec','ee','eg','er','es','et','fi','fj','fr','ga','ge','gh','gm','gn','gq','gr','gt','gw','gy','hk','hn','hr','ht','hu','id','ie','il','in','iq','ir','it','jm','jo','jp','ke','kg','kh','km','kn','kp','kr','kw','ky','kz','la','lb','lc','li','lk','lr','ls','lt','lu','lv','ly','ma','mc','md','mg','mk','ml','mm','mn','mr','mt','mu','mv','mw','mx','my','mz','na','ne','ng','ni','nl','no','np','nz','om','pa','pe','pg','ph','pk','pl','pr','ps','pt','py','qa','ro','rs','ru','rw','sa','sc','sd','se','sg','si','sk','sl','sm','sn','so','sr','ss','sv','sy','sz','td','tg','th','tj','tl','tm','tn','tr','tt','tw','tz','ua','ug','uk','us','uy','uz','vc','ve','vi','vn','ye','za','zm','zw'}
    
    def parse_installs(s):
        if not s:
            return 0
        clean = s.replace(',', '').replace('+', '')
        return int(clean) if clean.isdigit() else 0
    
    # Calculate average installs per country (direct geo domains only)
    avg_installs_by_country = {}
    installs_sum_by_country = {}
    installs_count_by_country = {}
    
    for app in apps:
        comp = app.get('componentName', '')
        domain = comp.split('/')[0].split('.')[0]
        if domain in ISO_COUNTRIES:
            inst = parse_installs(app.get('installs', '0'))
            if inst > 0:
                installs_sum_by_country[domain] = installs_sum_by_country.get(domain, 0) + inst
                installs_count_by_country[domain] = installs_count_by_country.get(domain, 0) + 1
    
    for domain in sorted(installs_sum_by_country):
        avg_installs_by_country[domain] = installs_sum_by_country[domain] / installs_count_by_country[domain]
    
    def country_loss_weight(comp):
        # Direct geo domain
        domain = comp.split('/')[0].split('.')[0]
        if domain in USER_LOSS:
            return USER_LOSS[domain] / MAX_LOSS
        
        # Presumed through graph
        if comp in graph:
            countries = set()
            for n in graph[comp]:
                nd = n.split('/')[0].split('.')[0]
                if nd in ISO_COUNTRIES:
                    countries.add(nd)
            if countries:
                total_weight = sum(USER_LOSS.get(c, 0) for c in countries)
                return total_weight / MAX_LOSS
        
        # com domain without graph — presumed US
        if domain == 'com':
            return USER_LOSS.get('us', 0) / MAX_LOSS
        
        return 0
    
    def local_impact(comp, installs=0):
        # Direct geo domain
        domain = comp.split('/')[0].split('.')[0]
        if domain in ISO_COUNTRIES:
            stats = domain_stats.get(domain, {})
            requests = stats.get('requests', 0)
            total = stats.get('total', 0)
            pop = POPULATION.get(domain, 1)
            actual_installs = installs if installs > 0 else avg_installs_by_country.get(domain, 0)
            
            # Skip if installs exceed population (global installs, not local)
            if actual_installs / 1_000_000 > pop:
                return 0.01
            
            if pop > 0 and actual_installs > 0 and total > 0:
                uncovered_ratio = requests / total
                affected = (actual_installs / 1_000_000) * uncovered_ratio
                return (affected / pop) * 100
        
        # Presumed through graph
        if comp in graph:
            countries = set()
            for n in graph[comp]:
                nd = n.split('/')[0].split('.')[0]
                if nd in ISO_COUNTRIES:
                    countries.add(nd)
            impacts = []
            for c in countries:
                stats = domain_stats.get(c, {})
                requests = stats.get('requests', 0)
                total = stats.get('total', 0)
                pop = POPULATION.get(c, 1)
                actual_installs = installs if installs > 0 else avg_installs_by_country.get(c, 0)
                
                if actual_installs / 1_000_000 > pop:
                    continue
                
                if pop > 0 and actual_installs > 0 and total > 0:
                    uncovered_ratio = requests / total
                    affected = (actual_installs / 1_000_000) * uncovered_ratio
                    impacts.append((affected / pop) * 100)
            
            if impacts:
                return sum(impacts)
        
        # com domain without graph — presumed US
        if domain == 'com':
            stats = domain_stats.get('us', {})
            requests = stats.get('requests', 0)
            total = stats.get('total', 0)
            pop = POPULATION.get('us', 1)
            actual_installs = installs if installs > 0 else avg_installs_by_country.get('us', 0)
            
            # Skip if installs exceed population (global installs, not local)
            if actual_installs / 1_000_000 > pop:
                return 0.01
            
            if pop > 0 and actual_installs > 0 and total > 0:
                uncovered_ratio = requests / total
                affected = (actual_installs / 1_000_000) * uncovered_ratio
                return (affected / pop) * 100
        
        # Fallback
        return 0.01
    
    def coverage_gap(comp):
        # Direct geo domain
        domain = comp.split('/')[0].split('.')[0]
        if domain in ISO_COUNTRIES:
            stats = domain_stats.get(domain, {})
            requests = stats.get('requests', 0)
            done = stats.get('done', 0)
            total = requests + done
            if total > 0:
                return requests / total
        
        # Presumed through graph
        if comp in graph:
            countries = set()
            for n in graph[comp]:
                nd = n.split('/')[0].split('.')[0]
                if nd in ISO_COUNTRIES:
                    countries.add(nd)
            if countries:
                gaps = []
                for c in countries:
                    stats = domain_stats.get(c, {})
                    requests = stats.get('requests', 0)
                    done = stats.get('done', 0)
                    total = requests + done
                    if total > 0:
                        gaps.append(requests / total)
                return max(gaps) if gaps else 1.0
        
        # com domain without graph — presumed US
        if domain == 'com':
            stats = domain_stats.get('us', {})
            requests = stats.get('requests', 0)
            done = stats.get('done', 0)
            total = requests + done
            if total > 0:
                return requests / total
        
        return 1.0
    
    # Finisher scores — count screens that request closes (size = 1)
    finisher_scores = {}
    for comps in screens_graph.values():
        if len(comps) == 1:
            comp = next(iter(comps))
            finisher_scores[comp] = finisher_scores.get(comp, 0) + 1
    
    # Trending deltas
    trending_deltas = {}
    if trending.get('period_start', {}).get('snapshot') and trending.get('period_end', {}).get('snapshot'):
        start = trending['period_start']['snapshot']
        end = trending['period_end']['snapshot']
        for comp, count in end.items():
            if comp in start:
                delta = count - start[comp]
                if delta > 0:
                    trending_deltas[comp] = delta
    
    # Fallback installs for unknown
    median_installs = 100000
    
    # Calculate scores
    scores_list = []
    for app in apps:
        comp = app.get('componentName', '')
        if comp in stale:
            app['roi_score'] = 0
            continue
        installs = parse_installs(app.get('installs', '0'))
        req_count = app.get('requestCount', 0)
        loss_weight = country_loss_weight(comp)
        impact = local_impact(comp, installs)
        gap = coverage_gap(comp)
        finisher = finisher_scores.get(comp, 0)
        trend = trending_deltas.get(comp, 0)
        
        is_easy = comp in easy
        is_foss = comp in foss
        
        complexity = 1 if is_easy else 15

        is_supported = comp in supported
        supported_multiplier = 15.0 if is_supported else 1.0

        if installs == 0:
            installs = median_installs
            installs_penalty = 0.5
        else:
            installs_penalty = 1.0

        if impact > 0:
            impact_pow = impact ** 0.7
        else:
            impact_pow = 0.01 ** 0.7

        if installs > 0:
            installs_sqrt = installs ** 0.5
        else:
            installs_sqrt = 0

        # Install multiplier and geo boost based on market penetration
        domain_for_pen = comp.split('/')[0].split('.')[0]
        installs_multiplier = 1 + installs_sqrt * 0.003
        geo_boost = 1.0
        
        if domain_for_pen in ISO_COUNTRIES and installs > 0:
            pop_for_pen = POPULATION.get(domain_for_pen, 1)
            if installs / 1_000_000 > pop_for_pen:
                penetration = 0
            else:
                penetration = (installs / 1_000_000) / pop_for_pen * 100
            
            if penetration >= 10:
                installs_multiplier = 1 + installs_sqrt * 0.01
                geo_boost = 3.0
            elif penetration >= 5:
                installs_multiplier = 1 + installs_sqrt * 0.005

        req_log = math.log(req_count + 1)
        trend_log = math.log(trend + 1) if trend > 0 else 0

        # Age factor by half-years
        last_requested = app.get('lastRequested', 0)
        if last_requested > 0:
            age_days = (time.time() - last_requested) / 86400
            half_years = int(age_days / 180)
            age_multiplier = 1 + half_years * 1.0
        else:
            age_multiplier = 1.0

        finisher_multiplier = min(1 + finisher * 0.5, 10)

        score = (
            (loss_weight * 10 + 1) *
            (1 + impact_pow * 3) *
            installs_multiplier *
            geo_boost *
            (1 + req_log * 2) *
            (1 + gap * 2) *
            finisher_multiplier *
            (1.3 if is_foss else 1.0) *
            age_multiplier *
            (1 + trend_log) *
            installs_penalty *
            supported_multiplier
        ) / complexity
        
        scores_list.append((app, score))
    
    # Calculate priority thresholds
    all_scores = sorted([score for _, score in scores_list if score > 0], reverse=True)
    total = len(all_scores)
    
    p1 = all_scores[int(total * 0.01)] if total > 100 else 0
    p5 = all_scores[int(total * 0.05)] if total > 20 else 0
    p25 = all_scores[int(total * 0.25)] if total > 4 else 0
    p50 = all_scores[int(total * 0.50)] if total > 2 else 0
    
    def get_priority(score):
        if score <= 0:
            return '—'
        if score > p1:
            return 'Critical'
        if score > p5:
            return 'High'
        if score > p25:
            return 'Medium'
        return 'Low'
    
    changed = 0
    for app, score in scores_list:
        new_score = round(score)
        if app.get('roi_score') != new_score:
            app['roi_score'] = new_score
            changed += 1
        
        priority = get_priority(new_score)
        if app.get('priority') != priority:
            app['priority'] = priority
            changed += 1
    
    if changed > 0:
        with open(REQUESTS_JSON, "w", encoding="utf-8") as f:
            json.dump(requests_data, f, indent=2)
    
    print(f"Calculated ROI scores for {len(apps)} requests ({changed} changed)")
    return len(apps)
    
def main() -> int:

    # --- Fulfilled request pruning (depends on upstream appfilter changes) ---
    appfilter_changed = False
    fulfilled_removed = 0

    try:
        upstream_xml = fetch_upstream_appfilter()
    except RuntimeError as err:
        print(f"Error: {err}")
        set_workflow_output("appfilter_changed", "error")
        return 1

    if LOCAL_APPFILTER.exists():
        local_xml = LOCAL_APPFILTER.read_bytes()
        if local_xml != upstream_xml:
            appfilter_changed = True
    else:
        appfilter_changed = True

    if appfilter_changed:
        LOCAL_APPFILTER.write_bytes(upstream_xml)
        print(f"Updated local appfilter at: {LOCAL_APPFILTER}")

        # Save old state before pruning
        with open(REQUESTS_JSON, "r") as f:
            old_data = json.load(f)
        old_apps = {app["componentName"]: app for app in old_data.get("apps", [])}

        components = load_upstream_components(upstream_xml)
        fulfilled_removed, fulfilled_deleted, removed_components = prune_requests(components)

        # Record fulfilled requests
        update_fulfillment_history(removed_components, old_apps)

        print(f"Components in upstream appfilter: {len(components)}")
        print(f"Removed fulfilled requests: {fulfilled_removed}")
        print(f"Deleted extracted images (fulfilled): {fulfilled_deleted}")

        # Update supported counters
        supported_path = FILTERS_DIR / "supported.json"
        if removed_components and supported_path.exists():
            with open(supported_path, "r+", encoding="utf-8") as f:
                data = json.load(f)
                supported_list = data.get("supported", [])
                fulfilled_now = sum(1 for c in removed_components if c in supported_list)
                if fulfilled_now > 0:
                    data["supported"] = [c for c in supported_list if c not in removed_components]
                    data["done"] = data.get("done", 0) + fulfilled_now
                    data["total"] = data["done"] + len(data["supported"])
                    f.seek(0)
                    json.dump(data, f, indent=2)
                    f.truncate()
                    print(f"Updated supported counters: {fulfilled_now} fulfilled, {data['done']} done, {data['total']} total")

        # Clean screens_graph from all fulfilled requests (by appfilter)
        screens_graph_path = REPO_ROOT / "src/assets/screens_graph.json"
        if screens_graph_path.exists():
            with open(screens_graph_path, "r", encoding="utf-8") as f:
                screens = json.load(f)
            
            updated_screens = {}
            removed_count = 0
            for screen_id, comps in screens.items():
                filtered = [c for c in comps if c not in components]
                removed_count += len(comps) - len(filtered)
                if filtered:
                    updated_screens[screen_id] = filtered
            
            with open(screens_graph_path, "w", encoding="utf-8") as f:
                json.dump(updated_screens, f, indent=2)
            
            if removed_count > 0:
                print(f"Cleaned {removed_count} fulfilled requests from screens_graph")

        # Clean requests_graph from all fulfilled requests (by appfilter)
        requests_graph_path = REPO_ROOT / "src/assets/requests_graph.json"
        if requests_graph_path.exists():
            with open(requests_graph_path, "r", encoding="utf-8") as f:
                req_graph = json.load(f)
            
            for comp in list(req_graph.keys()):
                if comp in components:
                    del req_graph[comp]
            
            with open(requests_graph_path, "w", encoding="utf-8") as f:
                json.dump(req_graph, f, indent=2)
            
            print(f"Cleaned fulfilled requests from requests_graph")
            
    else:
        print("No upstream appfilter.xml changes detected.")

    # --- Expired request pruning (runs unconditionally) ---
    expired_removed, expired_deleted = prune_expired_requests()
    print(f"Removed expired requests: {expired_removed}")
    print(f"Deleted extracted images (expired): {expired_deleted}")

    # --- Dynamic packages cleanup ---
    dynamic_packages = load_dynamic_packages()
    if dynamic_packages:
        with open(REQUESTS_JSON, "r", encoding="utf-8") as f:
            requests_data = json.load(f)
        apps = requests_data.get("apps", [])
        kept_apps = []
        removed_dynamic = []
        for app in apps:
            pkg = app.get("componentName", "").split("/")[0]
            if pkg in dynamic_packages:
                removed_dynamic.append(app)
            else:
                kept_apps.append(app)
        
        if removed_dynamic:
            requests_data["apps"] = kept_apps
            requests_data["count"] = len(kept_apps)
            requests_data["lastUpdate"] = time.strftime("%Y-%m-%d")
            with open(REQUESTS_JSON, "w", encoding="utf-8") as f:
                json.dump(requests_data, f, indent=2)
            
            seen_drawables = set()
            for app in removed_dynamic:
                drawable = app.get("drawable", "")
                if drawable and drawable not in seen_drawables:
                    seen_drawables.add(drawable)
                    delete_drawable_image(drawable)
            
            for app in removed_dynamic:
                print(f"  Dynamic package removed: {app.get('label', '?')} ({app.get('componentName', '')})")
            print(f"Removed {len(removed_dynamic)} requests from dynamic packages")

    # Load requests for later use
    with open(REQUESTS_JSON, "r") as f:
        requests_data = json.load(f)    

    # --- Filter file cleanup (always runs; catches stale entries from any past run) ---
    filter_entries_removed = prune_filter_files()
    if filter_entries_removed:
        print(f"Removed stale filter entries: {filter_entries_removed}")

    # --- Generate stale.json (runs unconditionally after all pruning) ---
    stale_count = generate_stale_list()
    print(f"Stale requests identified: {stale_count}")

    # --- Update sets_stats.json ---
    sets_count = update_sets_stats(requests_data.get("apps", []))
    print(f"Package sets updated: {sets_count}")

    # --- Update domain_stats.json ---
    domain_count = update_domain_stats()
    print(f"Domain stats updated: {domain_count} domains")

    # --- Re-load requests.json to capture the final state after all pruning ---
    with open(REQUESTS_JSON, "r") as f:
        requests_data = json.load(f)

    # --- Update activity stats ---
    history_count = update_activity_stats(
        total=len(requests_data.get("apps", [])),
        fulfilled_removed=fulfilled_removed,
        expired_removed=expired_removed,
    )
    print(f"Activity stats updated: {history_count} entries")    

    # --- Update Play Store metadata for new requests ---
    os.system(f"{sys.executable} scripts/dump_play_info.py")

    # --- Re-load requests.json after Play Store sync ---
    with open(REQUESTS_JSON, "r") as f:
        requests_data = json.load(f)

    # --- Calculate ROI scores (after installs updated) ---
    roi_count = calculate_roi_scores()
    print(f"ROI scores calculated: {roi_count}")

    # --- Regenerate stale.json after Play Store sync and ROI ---
    stale_count = generate_stale_list()
    print(f"Stale requests after sync: {stale_count}")

    # --- Workflow outputs ---
    has_changes = appfilter_changed or expired_removed > 0
    set_workflow_output("appfilter_changed", str(appfilter_changed).lower())
    set_workflow_output("requests_changed", str(has_changes).lower())
    set_workflow_output("fulfilled_removed", str(fulfilled_removed))
    set_workflow_output("expired_removed", str(expired_removed))

    return 0

if __name__ == "__main__":
    sys.exit(main())