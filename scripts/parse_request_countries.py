#!/usr/bin/env python3
"""Parse community country identifications and update requests_graph + tbd.

PR name: Add community-identified countries
Usage: python3 scripts/parse_request_countries.py
"""

import json
from pathlib import Path

REPO_ROOT = Path.cwd()
REQUESTS_JSON = REPO_ROOT / 'src/assets/requests.json'
REQUESTS_GRAPH = REPO_ROOT / 'src/assets/requests_graph.json'
TBD_JSON = REPO_ROOT / 'src/assets/filters/tbd.json'

SOURCE_SUFFIX = 'community.identified/parsing.result'

print('Paste country list, then press Enter twice to finish:')
print()

lines = []
while True:
    try:
        line = input()
    except EOFError:
        break
    if not line.strip() and lines and not lines[-1].strip():
        break
    lines.append(line)

text = '\n'.join(lines)

identifications = {}

for line in text.splitlines():
    line = line.strip()
    if not line or ':' not in line:
        continue
    country, pkgs_str = line.split(':', 1)
    country = country.strip().lower()
    pkgs = [p.strip() for p in pkgs_str.split(',') if p.strip()]
    if pkgs:
        identifications[country] = pkgs

print(f'Parsed countries: {len(identifications)}')
total_pkgs = sum(len(v) for v in identifications.values())
print(f'Total packages:   {total_pkgs}')

# 2. Load data
with open(REQUESTS_JSON, 'r', encoding='utf-8') as f:
    requests_data = json.load(f)
with open(REQUESTS_GRAPH, 'r', encoding='utf-8') as f:
    graph = json.load(f)

tbd = {}
if TBD_JSON.exists():
    with open(TBD_JSON, 'r', encoding='utf-8') as f:
        tbd = json.load(f)

# Build pkg -> [components] map
pkg_to_comps = {}
for a in requests_data['apps']:
    comp = a['componentName']
    pkg = comp.split('/')[0]
    pkg_to_comps.setdefault(pkg, []).append(comp)

# 3. Apply to graph
graph_added = 0
matched_pkgs = set()
not_found_pkgs = []

for country, pkgs in identifications.items():
    synth_key = f'{country}.{SOURCE_SUFFIX}'
    for pkg in pkgs:
        comps = pkg_to_comps.get(pkg, [])
        if not comps:
            not_found_pkgs.append(pkg)
            continue
        matched_pkgs.add(pkg)
        for comp in comps:
            if comp not in graph:
                graph[comp] = {}
            if synth_key not in graph[comp]:
                graph[comp][synth_key] = 1
                graph_added += 1

print(f'Packages matched: {len(matched_pkgs)}')
print(f'Packages not found: {len(not_found_pkgs)}')
if not_found_pkgs:
    for p in not_found_pkgs[:10]:
        print(f'  {p}')
print(f'Graph entries added: {graph_added}')

# 4. Save graph
with open(REQUESTS_GRAPH, 'w', encoding='utf-8') as f:
    json.dump(graph, f, indent=2, ensure_ascii=True)

# 5. Remove from TBD
if not tbd.get('tbd'):
    print()
    print('TBD empty or not found, skipping.')
else:
    tbd_set = set(tbd['tbd'])
    before = len(tbd_set)
    
    to_remove = set()
    for pkg in matched_pkgs:
        for comp in pkg_to_comps.get(pkg, []):
            to_remove.add(comp)
    
    tbd_set -= to_remove
    tbd['tbd'] = sorted(tbd_set)
    
    with open(TBD_JSON, 'w', encoding='utf-8') as f:
        json.dump(tbd, f, indent=2, ensure_ascii=False)
    
    print()
    print(f'TBD before: {before}')
    print(f'TBD after:  {len(tbd_set)}')
    print(f'Removed:    {before - len(tbd_set)}')

print()
print('Done.')