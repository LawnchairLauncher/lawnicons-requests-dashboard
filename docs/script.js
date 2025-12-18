/**
 * LAWNICONS REQUEST MANAGER
 * Pure Vanilla JS
 */

// ==========================================
// CONFIGURATION AND STATE
// ==========================================

const CONFIG = {
  data: {
    endpoint: "/docs/assets/requests.json",
    assetsPath: "/docs/extracted_png/",
    iconExtension: ".png",

    // File name must match: assets/filters/{name}.json
    filterPath: "/docs/assets/filters/",
  },
  filters: [
    { id: "wip",      label: "WIP"         },
    { id: "easy",     label: "Easy",       },
    { id: "missing",  label: "Missing",    },
    { id: "conflict", label: "Name in Use" },
    { id: "link",     label: "Matches",    }
  ],
  urls: {
    playStore: "https://play.google.com/store/apps/details?id=",
    fDroid: "https://f-droid.org/en/packages/",
    izzy: "https://www.izzysoft.de/applists/category/named/",
    galaxyStore: "https://galaxystore.samsung.com/detail/"
  },
  ui: {
    batchSize: 500,
  }
};

const ICONS = {
  download: `<svg><use href="#ic-download"/></svg>`,
  play:     `<svg><use href="#ic-play"/></svg>`,
  dots:     `<svg><use href="#ic-dots"/></svg>`,
  copy:     `<svg><use href="#ic-copy"/></svg>`,
  fDroid:   `<svg><use href="#ic-fdroid"/></svg>`,
  izzyOnDroid: `<svg><use href="#ic-izzyondroid"/></svg>`,
  galaxyStore: `<svg><use href="#ic-galaxystore"/></svg>`,
  terminal: `<svg><use href="#ic-terminal"/></svg>`,
  regex: `<svg><use href="#ic-regex"/></svg>`
};

const DEFAULTS = {
  view: "list",
  sort: "req-desc",
  search: "",
  regex: false
};

const state = {
  view: "list",
  sort: "req-desc",
  search: "",
  regexMode: false,
  selected: new Set(),

  appTags: new Map(),

  activeFilters: new Set(),
  renderedCount: 0,
  currentData: [],
};

let apps = [];
let observer;

const DOM = {
  container:   document.getElementById("appContainer"),
  listHeader:  document.getElementById("listHeader"),
  headerCheck: document.getElementById("headerCheck"),
  headerCount: document.getElementById("headerCount"),
  sentinel:    document.getElementById("scrollSentinel"),
  
  inputSearch: document.getElementById("searchInput"),
  regexBtn: document.getElementById("regexBtn"),

  selectSort:  document.getElementById("sortSelect"),
  selectView:  document.getElementById("viewSelect"),

  filterContainer: document.getElementById("filterContainer"),

  inputPath: document.querySelector(".path-wrapper input"),
  
  fabBar:      document.getElementById("fabBar"),
  fabCount:    document.getElementById("fabCount"),
  fabMenuBtn:  document.getElementById("fabMenuBtn"),
  
  rowMenu:     document.getElementById("rowMenu"),
  fabMenu:     document.getElementById("fabMenu"),
};

// ==========================================
// INITIALIZATION
// ==========================================
Promise.all([
  fetch(CONFIG.data.endpoint).then(r => r.json()),
  ...CONFIG.filters.map(f => fetchFilterFile(f.id))
])
.then(([json, ...filterResults]) => {
  apps = json.apps;
  DOM.headerCount.textContent = `${json.count.toLocaleString()} requests`;

  state.appTags = new Map();

  CONFIG.filters.forEach((f, index) => {
    const ids = filterResults[index];
    if (ids && Array.isArray(ids)) {
      ids.forEach(appId => addTagToApp(appId, f.id));
    } else {
    }
  });

  loadStateFromUrl();

  generateFilterButtons();
  initObserver();
  render();
})
.catch(err => {
  console.error("Init failed:", err);
  Toast.show("Failed to load data. Check console.", "error");
});

async function fetchFilterFile(id) {
  try {
    const res = await fetch(`${CONFIG.data.filterPath}${id}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    // Expecting format: { "wip": ["id1", "id2"] }
    return data[id] || null; 
  } catch (e) {
    console.warn(`Filter file missing: ${id}`);
    return null;
  }
}

function addTagToApp(id, tag) {
  if (!state.appTags.has(id)) {
    state.appTags.set(id, new Set());
  }
  state.appTags.get(id).add(tag);
}

function initObserver() {
  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      let moreContent = loadMore();
      if (!moreContent) DOM.sentinel.style.opacity = 0
    }
  }, { rootMargin: "400px" });

  observer.observe(DOM.sentinel);
}

// ==========================================
// EVENT LISTENERS
// ==========================================

DOM.inputSearch.addEventListener("input", e => {
  state.search = e.target.value;
  render();
});

DOM.selectSort.addEventListener("change", e => {
  state.sort = e.target.value;
  render();
});

DOM.selectView.addEventListener("change", e => {
  state.view = e.target.value;
  render();
});

// Master Checkbox
DOM.headerCheck.addEventListener("change", e => {
  toggleSelectAll(e.target.checked);
});

// FAB & Context Menus
DOM.fabMenuBtn.addEventListener("click", e => {
  e.stopPropagation();
  showFabContextMenu();
});

DOM.regexBtn.addEventListener("click", () => {
  state.regexMode = !state.regexMode;
  
  if (state.regexMode) DOM.regexBtn.classList.add("active");
  else DOM.regexBtn.classList.remove("active");
  
  render();
});

// ==========================================
// DATA PIPELINE
// ==========================================
function processData() {
  let data = apps;
  
  // 1. Parse Query (Extract "is:wip" etc)
  const query = parseSearchQuery(state.search);
  
  // 2. Combine Filters (Buttons + Typed)
  // We create a temporary set for this render pass
  const effectiveFilters = new Set([...state.activeFilters, ...query.tags]);

  // 3. Apply Filters
  if (effectiveFilters.size > 0) {
    data = data.filter(app => {
      const id = app.componentNames[0].componentName;
      const appTags = state.appTags.get(id);
      if (!appTags) return false;
      return Array.from(effectiveFilters).some(fId => appTags.has(fId));
    });
  }

  // 4. Apply Text Search
  if (query.text) {
    if (state.regexMode) {
      try {
        // Create Regex (Case insensitive)
        const regex = new RegExp(query.text, 'i');
        data = data.filter(app => 
          app.componentNames.some(c => 
            regex.test(c.label) || regex.test(c.componentName)
          )
        );
      } catch (e) {
        // If regex is invalid (e.g. "["), treat as empty or show error?
        // For now, we just don't filter (return all) or return empty.
        // Let's return empty to indicate "invalid query" visually
        data = []; 
      }
    } else {
      // Standard Includes
      const term = query.text.toLowerCase();
      data = data.filter(app => 
        app.componentNames.some(c => 
          c.label.toLowerCase().includes(term) || 
          c.componentName.toLowerCase().includes(term)
        )
      );
    }
  }

  // Sort
  data = [...data];

  if (state.sort === "rand") {
    // Fisher-Yates Shuffle
    for (let i = data.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [data[i], data[j]] = [data[j], data[i]];
    }
  } else {
    // Deterministic Sorts
    const sorters = {
      "req-desc":  (a, b) => b.requestCount - a.requestCount,
      "req-asc":   (a, b) => a.requestCount - b.requestCount,
      "time-desc": (a, b) => b.lastRequested - a.lastRequested,
      "time-asc":  (a, b) => a.lastRequested - b.lastRequested,
      "name-asc":  (a, b) => a.componentNames[0].label.localeCompare(b.componentNames[0].label),
      "name-desc": (a, b) => b.componentNames[0].label.localeCompare(a.componentNames[0].label)
    };

    if (sorters[state.sort]) {
      data.sort(sorters[state.sort]);
    }
  }

  state.currentData = data;
  return data;
}

// ==========================================
// 8. RENDER ENGINE (Infinite Scroll)
// ==========================================

// Full Re-render (Search/Sort/Init/View Change)
function render() {
  DOM.container.innerHTML = "";
  
  if (state.view === "grid") {
    DOM.container.className = "grid-container";
  } else {
    DOM.container.className = "";
  }

  // 3. Process & Load Data
  processData(); 

  if (state.currentData.length === 0) {
    DOM.container.innerHTML = `
      <div class="empty-state">
        <svg><use href="#ic-search"/></svg>
        <h3>No requests found</h3>
        <p>Try adjusting your search or filters.</p>
      </div>
    `;
    updateHeaderCheckbox();
    return; // Stop here
  }

  state.renderedCount = 0;
  loadMore(); 
  
  // 4. Update UI States
  updateHeaderCheckbox();
  DOM.listHeader.style.display = state.view === "list" ? "grid" : "none";

  syncStateToUrl();
}


function loadMore() {
  if (state.renderedCount >= state.currentData.length) return false;

  const nextBatchSize = CONFIG.ui.batchSize;
  const end = Math.min(state.renderedCount + nextBatchSize, state.currentData.length);
  const batch = state.currentData.slice(state.renderedCount, end);

  const fragment = document.createDocumentFragment();

  // Simple factory selection
  if (state.view === "list") {
    batch.forEach(app => fragment.appendChild(createListRow(app)));
  } else {
    batch.forEach(app => fragment.appendChild(createGridCard(app)));
  }

  DOM.container.appendChild(fragment);
  state.renderedCount = end;

  return true;
}

// ==========================================
// 9. COMPONENT FACTORIES
// ==========================================
// --- Helper: Get Tags for an App ---
function getTagsForApp(id) {
  const tags = [];
  
  // Check each loaded filter to see if this app ID is in it
  // We iterate CONFIG.data.availableFilters to maintain a consistent order
  CONFIG.data.availableFilters.forEach(filterName => {
    const set = state.filterCache[filterName];
    if (set && set.has(id)) {
      tags.push(filterName);
    }
  });
  
  return tags;
}

// --- List Row Factory ---
function createListRow(app) {
  const id = app.componentNames[0].componentName;
  const name = app.componentNames[0].label;
  const pkg = id.split('/')[0];
  const isSelected = state.selected.has(id);
  const iconUrl = `${CONFIG.data.assetsPath}${app.drawable}${CONFIG.data.iconExtension}`;
  const dateStr = formatDate(app.lastRequested);

  let tagHtml = "";
  const appTags = state.appTags.get(id);

  if (appTags) {
    // Iterate config to maintain order (e.g. WIP always before Conflict)
    CONFIG.filters.forEach(f => {
      if (appTags.has(f.id)) {
        tagHtml += `<span class="status-pill status-${f.id}">${f.label}</span>`;
      }
    });
  }

  const row = document.createElement("div");
  row.className = `list-row ${isSelected ? "selected" : ""}`;
  row.setAttribute("data-id", id);
  row.onclick = () => toggleSelection(id);

  row.innerHTML = `
    <div class="check-col">
      <input type="checkbox" ${isSelected ? "checked" : ""} onclick="event.stopPropagation(); toggleSelection('${id}')" />
    </div>
    
    <div class="icon">
      <img src="${iconUrl}" loading="lazy" onerror="this.style.opacity=0.2" />
    </div>

    <div class="name-col">
      <div class="name-row">
        ${tagHtml}
        <span class="app-name">${name}</span>
      </div>
      <span class="pkg-name">${id}</span>
    </div>

    <div class="col req">${app.requestCount}</div>
    <div class="col install">—</div>
    <div class="col first" style="line-height:1.4"><div>${dateStr}</div></div>
    
    <div class="actions-col">
      <a class="action-btn" href="${iconUrl}" download title="Download icon">${ICONS.download}</a>
      <a class="action-btn" href="${CONFIG.urls.playStore}${pkg}" target="_blank" title="Play Store">${ICONS.play}</a>
      <div class="action-btn ctx-trigger" title="More actions">${ICONS.dots}</div>
    </div>
  `;

  row.querySelector(".ctx-trigger").onclick = (e) => {
    e.stopPropagation();
    showRowContextMenu(e, app);
  };

  return row;
}

function createGridCard(app) {
  const id = app.componentNames[0].componentName;
  const isSelected = state.selected.has(id);
  const iconUrl = `${CONFIG.data.assetsPath}${app.drawable}${CONFIG.data.iconExtension}`;

  const card = document.createElement("div");
  card.className = `grid-card ${isSelected ? "selected" : ""}`;
  card.setAttribute("data-id", id);
  card.onclick = () => toggleSelection(id);

  card.innerHTML = `
    <img src="${iconUrl}" loading="lazy" onerror="this.style.display='none'" />
    <div class="grid-overlay-check">
      <input type="checkbox" ${isSelected ? "checked" : ""} style="pointer-events:none;">
    </div>
  `;
  return card;
}

function generateFilterButtons() {
  const container = document.getElementById("filterContainer");
  if (!container) return;
  
  container.innerHTML = "";

  CONFIG.filters.forEach(filter => {
    const btn = document.createElement("button");
    btn.className = `tag tag-${filter.id} chip`;
    btn.title = `Filter ${filter.label} entries`
    btn.textContent = filter.label;
    
    if (state.activeFilters.has(filter.id)) {
      btn.classList.add("active");
    }

    btn.onclick = () => {
      if (state.activeFilters.has(filter.id)) {
        state.activeFilters.delete(filter.id);
        btn.classList.remove("active");
      } else {
        state.activeFilters.add(filter.id);
        btn.classList.add("active");
      }
      render();
    };
    
    container.appendChild(btn);
  });
}

// ==========================================
// 10. SELECTION LOGIC
// ==========================================

function toggleSelection(id) {
  // 1. Update State
  if (state.selected.has(id)) {
    state.selected.delete(id);
  } else {
    state.selected.add(id);
  }
  
  // 2. Update UI directly (No full re-render)
  updateItemVisuals(id);
  updateHeaderCheckbox();
  updateFab();
}

function updateItemVisuals(id) {
  const isSelected = state.selected.has(id);

  const elements = document.querySelectorAll(`[data-id="${id}"]`);
  elements.forEach(el => {
    if (isSelected) el.classList.add("selected");
    else el.classList.remove("selected");
    
    const checkbox = el.querySelector('input[type="checkbox"]');
    if (checkbox) checkbox.checked = isSelected;
  });
}

function toggleSelectAll(isChecked) {
  // 1. Update State
  if (isChecked) {
    state.currentData.forEach(app => state.selected.add(app.componentNames[0].componentName));
  } else {
    state.currentData.forEach(app => state.selected.delete(app.componentNames[0].componentName));
  }
  
  // 2. For Select All, a full render is actually cleaner/faster than 500 DOM updates
  // But we can optimize by saving scroll position if needed.
  // For now, let's just re-render since Select All is a "heavy" action anyway.
  const scrollY = window.scrollY;
  render();
  window.scrollTo(0, scrollY);
}

function updateHeaderCheckbox() {
  const total = state.currentData.length;
  if (total === 0) {
    DOM.headerCheck.checked = false;
    DOM.headerCheck.indeterminate = false;
    return;
  }

  let selectedCount = 0;
  state.currentData.forEach(app => {
    if (state.selected.has(app.componentNames[0].componentName)) selectedCount++;
  });

  if (selectedCount === 0) {
    DOM.headerCheck.checked = false;
    DOM.headerCheck.indeterminate = false;
  } else if (selectedCount === total) {
    DOM.headerCheck.checked = true;
    DOM.headerCheck.indeterminate = false;
  } else {
    DOM.headerCheck.checked = false;
    DOM.headerCheck.indeterminate = true;
  }
  
  updateFab();
}

function updateFab() {
  const count = state.selected.size;
  if (count > 0) {
    const plural = count > 1 ? "s" : ""

    DOM.fabBar.classList.add("visible");
    DOM.fabCount.textContent = `Download ${count} icon${plural}`;
  } else {
    DOM.fabBar.classList.remove("visible");
  }
}

// ==========================================
// 11. CONTEXT MENUS & UTILS
// ==========================================

// --- Context Menu: Row Mode (Mouse Click) ---
function showRowContextMenu(e, app) {
  const id = app.componentNames[0].componentName;
  const pkg = id.split('/')[0];
  const name = app.componentNames[0].label;

  // 1. Inject Content
  DOM.rowMenu.innerHTML = `
    <div class="ctx-item" onclick="window.open('${CONFIG.urls.fDroid}${pkg}')">
      ${ICONS.fDroid} <span>F-Droid</span>
    </div>
    <div class="ctx-item" onclick="window.open('${CONFIG.urls.izzy}${pkg}')">
      ${ICONS.izzyOnDroid} <span>IzzyOnDroid</span>
    </div>
    <div class="ctx-item" onclick="window.open('${CONFIG.urls.galaxyStore}${pkg}')">
      ${ICONS.galaxyStore} <span>Galaxy Store</span>
    </div>
    <div class="ctx-item" onclick="copyIconToolCmd('${id}')">
      ${ICONS.terminal} <span>Copy icontool command</span>
    </div>
    <div class="ctx-item" onclick="copyToClipboard('${name}\\n${id}')">
      ${ICONS.copy} <span>Copy name and component</span>
    </div>
    <div class="ctx-item" onclick="copyAppFilterEntry('${id}')">
      ${ICONS.copy} <span>Copy appfilter</span>
    </div>
  `;

  // 2. Smart Positioning (Prevent clipping)
  const menuWidth = 280;
  const menuHeight = 280;
  
  let x = e.clientX + 2; 
  let y = e.clientY + 2;

  // Flip Left if too close to right edge
  if (x + menuWidth > window.innerWidth) x -= (menuWidth + 4);
  
  // Flip Up if too close to bottom edge
  if (y + menuHeight > window.innerHeight) y -= (menuHeight + 4);

  DOM.rowMenu.style.left = `${x}px`;
  DOM.rowMenu.style.top = `${y}px`;
  DOM.rowMenu.style.transformOrigin = "top left";

  // 3. Show
  DOM.rowMenu.showPopover();
}

// --- Context Menu: FAB Mode (Button Click) ---
function showFabContextMenu() {
  DOM.fabMenu.innerHTML = `
    <div class="ctx-item" onclick="copyBulkAppFilter()">
      ${ICONS.copy} <span>Copy appfilter entries</span>
    </div>
     <div class="ctx-item" onclick="downloadSelectionAsJson()">
      ${ICONS.download} <span>Download JSON config</span>
    </div>
    <div class="ctx-item" onclick="copyBulkIconToolCmd()">
      ${ICONS.terminal} <span>Copy icontool commands</span>
    </div>
  `;
  
  // CSS handles the bottom-sheet positioning for .fab-style
  DOM.fabMenu.showPopover();
}

function closeContextMenu() {
  try { DOM.rowMenu.hidePopover(); } catch(e) {}
  try { DOM.fabMenu.hidePopover(); } catch(e) {}
}



function formatDate(unix) {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleDateString("en-US", { 
    month: "short", day: "numeric", year: "numeric" 
  });
}

function generateXml(app) {
  const cmp = app.componentNames[0].componentName;
  const name = app.componentNames[0].label;
  const draw = sanitizeDrawableName(name);
  // Exact format requested
  return `<item component="ComponentInfo{${cmp}}" drawable="${draw}" name="${name}" />`;
}

// Action: Copy Text
function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  Toast.show("Copied!")
  closeContextMenu();
}

// Action: Copy Single AppFilter
function copyAppFilterEntry(id) {
  const app = apps.find(a => a.componentNames[0].componentName === id);
  if (app) {
    copyToClipboard(generateXml(app));
  }
}

// Action: Copy Bulk AppFilter
function copyBulkAppFilter() {
  const selectedApps = apps.filter(a => 
    state.selected.has(a.componentNames[0].componentName)
  );
  
  if (selectedApps.length === 0) return;

  const xmlOutput = selectedApps.map(generateXml).join('\n');
  
  copyToClipboard(xmlOutput)
}

// Action: Download selected
async function downloadSelected() {
  if (typeof JSZip === 'undefined') {
    Toast.show("JSZip library is missing.");
    return;
  }

  const selectedIds = Array.from(state.selected);
  if (selectedIds.length === 0) return;

  const originalText = DOM.fabCount.textContent;
  DOM.fabCount.textContent = "Preparing...";
  DOM.fabBar.style.cursor = "wait";

  try {
    const zip = new JSZip();
    const imgFolder = zip.folder("icons");
    
    // Track names to prevent overwriting if two apps sanitize to the same string
    const usedNames = new Set();
    const promises = [];

    selectedIds.forEach(id => {
      const app = apps.find(a => a.componentNames[0].componentName === id);
      if (!app) return;

      // 1. Generate the clean name
      let filename = sanitizeDrawableName(app.componentNames[0].label);
      
      // 2. Handle collisions (e.g. "App" and "App!" both -> "app")
      if (usedNames.has(filename)) {
        let counter = 2;
        while (usedNames.has(`${filename}_${counter}`)) counter++;
        filename = `${filename}_${counter}`;
      }
      usedNames.add(filename);

      // 3. Fetch Original -> Save as New
      const originalUrl = `${CONFIG.data.assetsPath}${app.drawable}${CONFIG.data.iconExtension}`;
      const saveName = `${filename}.png`; // Saving as PNG for now (source is PNG)

      promises.push(
        fetch(originalUrl)
          .then(res => {
            if (!res.ok) throw new Error(`404: ${originalUrl}`);
            return res.blob();
          })
          .then(blob => imgFolder.file(saveName, blob))
          .catch(err => console.warn(err))
      );
    });

    DOM.fabCount.textContent = `Fetching ${promises.length}...`;
    await Promise.all(promises);

    DOM.fabCount.textContent = "Zipping...";
    const content = await zip.generateAsync({ type: "blob" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);

    const fileName = `lawnicons-export-${new Date().toISOString().slice(0,10)}.zip`
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    Toast.show(`Saving ${fileName}...`, "success");
  } catch (err) {
    console.error(err);
    Toast.show("Failed to save file");
  } finally {
    DOM.fabBar.style.cursor = "default";
    setTimeout(() => DOM.fabCount.textContent = originalText, 2000);
    closeContextMenu();
  }
}

// Action: Download Selection as JSON
function downloadSelectionAsJson() {
  const selectedIds = Array.from(state.selected);
  if (selectedIds.length === 0) return;

  // Prompt for the key name (e.g. "easy", "wip")
  const label = prompt("Enter a label for this group:", "custom_selection") || "custom_selection";

  // Construct Object
  const exportObj = {
    [label]: selectedIds
  };

  // Create Blob
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  // Trigger Download
  const link = document.createElement("a");
  link.href = url;
  link.download = `${label}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  closeContextMenu();
}

// --- Naming Convention Helper ---
function sanitizeDrawableName(label) {
  if (!label) return "unknown";

  // 1. Normalize (e.g., "Pokémon" -> "Pokemon")
  let name = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 2. Lowercase & Replace non-alphanumeric with underscore
  name = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

  // 3. Trim underscores from start/end
  name = name.replace(/^_+|_+$/g, "");

  // 4. Handle leading digit (e.g., "1password" -> "_1password")
  if (/^[0-9]/.test(name)) {
    name = "_" + name;
  }

  return name || "icon";
}

function generateIconToolCommand(app) {
  // 1. Get Path (ensure trailing slash)
  let path = DOM.inputPath.value.trim();
  if (path && !path.endsWith("/")) path += "/";
  
  // 2. Get Data
  const cmp = app.componentNames[0].componentName;
  const name = app.componentNames[0].label.replace(/"/g, '\\"'); // Escape quotes

  const cleanName = sanitizeDrawableName(app.componentNames[0].label);
  const svg = `${path}${cleanName}.svg`;

  // 3. Format: python3 ./icontool.py add path/to/icon.svg package/component "App Name" 
  return `python3 ./icontool.py add "${svg}" ${cmp} "${name}"`;
}

// Action: Copy Bulk Commands
function copyBulkIconToolCmd() {
  const selectedApps = apps.filter(a => 
    state.selected.has(a.componentNames[0].componentName)
  );
  
  if (selectedApps.length === 0) return;

  const cmdOutput = selectedApps.map(generateIconToolCommand).join('\n');
  copyToClipboard(cmdOutput)
}

// Action: Copy Single Command
function copyIconToolCmd(id) {
  const app = apps.find(a => a.componentNames[0].componentName === id);
  if (app) {
    copyToClipboard(generateIconToolCommand(app));
  }
}

// --- Search Parser ---
function parseSearchQuery(rawQuery) {
  const result = {
    text: "",
    tags: new Set()
  };

  // Regex to find tokens like "is:wip", "tag:easy", "in:conflict"
  // Matches: (prefix): (value)
  const tokenRegex = /\b(?:is|tag|in):([a-z0-9-_]+)\b/gi;

  // 1. Extract Tags
  const cleanQuery = rawQuery.replace(tokenRegex, (match, tag) => {
    // Check if this tag actually exists in our config
    const validTag = CONFIG.filters.find(f => f.id === tag.toLowerCase());
    if (validTag) {
      result.tags.add(validTag.id);
    }
    return ""; // Remove token from text
  });

  // 2. Clean Text
  result.text = cleanQuery.trim();
  
  return result;
}

// --- URL State Management ---

function syncStateToUrl() {
  const params = new URLSearchParams();

  // 1. Search
  if (state.search) params.set("q", state.search);
  
  // 2. View
  if (state.view !== DEFAULTS.view) params.set("view", state.view);
  
  // 3. Sort
  if (state.sort !== DEFAULTS.sort) params.set("sort", state.sort);
  
  // 4. Regex
  if (state.regexMode) params.set("regex", "1");
  
  // 5. Active Filters (Buttons)
  if (state.activeFilters.size > 0) {
    params.set("filters", Array.from(state.activeFilters).join(","));
  }

  // Update URL without reload
  if (params.toString() != "") {
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", newUrl);
  }
}

function loadStateFromUrl() {
  const params = new URLSearchParams(window.location.search);

  // 1. Search
  if (params.has("q")) {
    state.search = params.get("q");
    DOM.inputSearch.value = state.search;
  }

  // 2. View
  if (params.has("view")) {
    const v = params.get("view");
    if (["list", "grid"].includes(v)) state.view = v;
    DOM.selectView.value = state.view;
  }

  // 3. Sort
  if (params.has("sort")) {
    state.sort = params.get("sort");
    DOM.selectSort.value = state.sort;
    if (DOM.selectSortMobile) DOM.selectSortMobile.value = state.sort;
  }

  // 4. Regex
  if (params.has("regex")) {
    state.regexMode = true;
    DOM.regexBtn.classList.add("active");
  }

  // 5. Filters
  if (params.has("filters")) {
    const tags = params.get("filters").split(",");
    tags.forEach(t => {
      if (CONFIG.filters.some(f => f.id === t)) {
        state.activeFilters.add(t);
      }
    });
  }
}

// --- Toast Notification System ---
const Toast = {
  container: document.getElementById("toastContainer"),
  activeToasts: new Set(), // Track active messages to prevent dupes

  show(text, type = "info") {
    // 1. Deduplication: Don't show if already visible
    const key = `${text}-${type}`;
    if (this.activeToasts.has(key)) return;

    // 2. Limit: Remove oldest if > 3
    if (this.container.children.length >= 3) {
      const oldest = this.container.firstElementChild;
      this.remove(oldest);
    }

    // 3. Create Element
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.dataset.key = key; // Store key for removal logic
    this.activeToasts.add(key);

    let iconSvg = ICONS.copy;
    if (type === "error") iconSvg = `<svg><use href="#ic-search"/></svg>`;
    if (type === "success") iconSvg = `<svg><use href="#ic-download"/></svg>`;

    el.innerHTML = `
      <div class="toast-icon">${iconSvg}</div>
      <div class="toast-text">${text}</div>
    `;

    this.container.appendChild(el);

    // 4. Auto Remove
    setTimeout(() => this.remove(el), 2500);
  },

  remove(el) {
    if (el.classList.contains("hiding")) return;
    
    // Cleanup Set
    if (el.dataset.key) this.activeToasts.delete(el.dataset.key);

    el.classList.add("hiding");
    el.addEventListener("animationend", () => el.remove());
  }
};
