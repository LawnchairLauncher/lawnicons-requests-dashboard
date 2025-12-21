/**
 * LAWNICONS REQUEST MANAGER
 * Pure Vanilla JS
 */

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
const CONFIG = {
  data: {
    endpoint: "/assets/requests.json",
    assetsPath: "/extracted_png/",
    iconExtension: ".png",
    filterPath: "/assets/filters/",
    filters: ["unlabeled", "wip", "easy", "conflict", "link"],
  },
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
  check:       `<svg><use href="#ic-check"/></svg>`,
  download:    `<svg><use href="#ic-download"/></svg>`,
  play:        `<svg><use href="#ic-play"/></svg>`,
  dots:        `<svg><use href="#ic-dots"/></svg>`,
  copy:        `<svg><use href="#ic-copy"/></svg>`,
  fDroid:      `<svg><use href="#ic-fdroid"/></svg>`,
  izzyOnDroid: `<svg><use href="#ic-izzyondroid"/></svg>`,
  galaxyStore: `<svg><use href="#ic-galaxystore"/></svg>`,
  terminal:    `<svg><use href="#ic-terminal"/></svg>`,
  regex:       `<svg><use href="#ic-regex"/></svg>`
};

const DEFAULTS = {
  view: "list",
  sort: "req-desc",
  search: "",
  regex: false
};

const PR_TEMPLATE =
`## Icons
<!-- Please specify in the sections below which apps and packages you have worked on.
     Unnecessary sections can be deleted. -->

### Added
<!--  Apps for which you add icons. -->
App name (\`com.package.app\`)  
App name (\`com.package.app\`)  

### Linked
<!--  New app components for existing icons. -->
App name (\`com.package.app\` → \`drawable.svg\`)  
App name (\`com.package.app\` → \`drawable.svg\`)  

### Updated
<!--  Outdated icons that you've updated. -->
App name (\`com.package.app\`)  
App name (\`com.package.app\`)`;

// ==========================================
// GLOBAL STATE
// ==========================================
const App = {
  data: [], // Raw apps list
  
  state: {
    view: "list",
    sort: "req-desc",
    search: "",
    regexMode: false,
    selected: new Set(),
    appTags: new Map(),
    activeFilters: new Set(),
    lastSelectedId: null,
    
    // Runtime
    idMap: new Map(), // NEW: O(1) Lookup Cache
    renderedCount: 0,
    currentData: [], // Filtered & Sorted list
  },

  // DOM Elements Cache
  dom: {
    container:   document.getElementById("appContainer"),
    listHeader:  document.getElementById("listHeader"),
    headerCheck: document.getElementById("headerCheck"),
    headerCount: document.getElementById("headerCount"),
    sentinel:    document.getElementById("scrollSentinel"),
    
    inputSearch: document.getElementById("searchInput"),
    regexBtn:    document.getElementById("regexBtn"),
    selectSort:  document.getElementById("sortSelect"),
    selectView:  document.getElementById("viewSelect"),
    filterBox:   document.getElementById("filterContainer"),
    inputPath:   document.querySelector(".path-wrapper input"),

    mobileFilterBtn: document.getElementById("mobileFilterBtn"),
    mobileFilterCount: document.getElementById("mobileFilterCount"),
    mobileFilterMenu: document.getElementById("mobileFilterMenu"),
    
    fabBar:      document.getElementById("fabBar"),
    fabCount:    document.getElementById("fabCount"),
    fabMenuBtn:  document.getElementById("fabMenuBtn"),
    
    rowMenu:     document.getElementById("rowMenu"),
    fabMenu:     document.getElementById("fabMenu"),
    toastBox:    document.getElementById("toastContainer")
  }
};

// ==========================================
// TEMPLATES (View Layer)
// ==========================================
const Templates = {
  listRow(app, isSelected, tags, iconUrl, firstStr, lastStr) {
    const id = app.componentName;
    const name = app.label;
    const pkg = id.split('/')[0];
    const isUnknown = app.drawable === "unknown" || name === "(Unknown App)";


    const tagHtml = tags.map(tagId => {
      const meta = App.state.filterMetadata.get(tagId);
      const label = meta ? meta.label : tagId;
      const desc = meta ? meta.desc : `Tagged with "${tagId}"`
      return `<span class="status-pill status-${tagId}" title="${meta.desc}">${label}</span>`;
    }).join("");

    const iconHtml = isUnknown 
      ? `<div class="fallback-icon-row">No Icon</div>`
      : `<img src="${iconUrl}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'" />
        <div class="fallback-icon-row" style="display:none">No Icon</div>`;

    const installs = app.installs ? app.installs.replace(/,/g, '').replace(/\+/g, '') : null;
    const displayInstalls = installs ? new Intl.NumberFormat('en', { notation: "compact" }).format(installs) + "+" : "—";

    return `
      <div class="list-row ${isSelected ? 'selected' : ''}"
        data-id="${id}"
        tabindex="0" 
        role="row" 
        aria-selected="${isSelected}"
        >
        <div class="check-col">
          <input type="checkbox" ${isSelected ? "checked" : ""} class="row-checkbox" tabindex="-1" />
        </div>
        <div class="icon">
          ${iconHtml}
        </div>
        <div class="name-col">
          <div class="name-row">
            ${tagHtml}
            <span class="app-name" style="${isUnknown ? "display: none" : ""}">${name}</span>
          </div>
          <span class="pkg-name">${id}</span>
        </div>
        <div class="col req">${app.requestCount}</div>
        <div class="col install" title="${installs}+ installs in Play Store">${displayInstalls}</div>
        <div class="col first" style="line-height:1.4">
          <div>${firstStr}</div>
          <div>Last: ${lastStr}</div>
        </div>
        <div class="actions-col">
          <a class="action-btn" href="${iconUrl}" download title="Download icon"
            tabindex="0" role="button" aria-label="Download" >${ICONS.download}</a>
          <a class="action-btn" href="${CONFIG.urls.playStore}${pkg}" target="_blank" title="Play Store"
            tabindex="0" role="button" aria-label="Play Store" >${ICONS.play}</a>
          <div class="action-btn ctx-trigger" title="More actions"
            tabindex="0" 
            role="button" 
            aria-label="More actions" 
            aria-haspopup="true">${ICONS.dots}</div>
        </div>
      </div>
    `;
  },

  gridCard(app, isSelected, iconUrl) {
    const id = app.componentName;
    const isUnknown = app.drawable === "unknown";
    
    let contentHtml = "";
    const label = app.label === "(Unknown App)" 
      ? id.split('/')[0] // Show package
      : app.label;

    if (isUnknown) {
      contentHtml = `
        <div class="fallback-icon-grid">
          <div style="font-weight:700; margin-bottom:4px;">No Icon</div>
          <div style="word-break:break-word;">${label}</div>
        </div>
      `;
    } else {
      // Show Image with error handler
      contentHtml = `<img src="${iconUrl}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'" />
      <div class="grid-fallback" style="display:none; text-align:center; font-size:11px; color:var(--on-surface-variant)">No Icon</div>`;
    }

    return `
      <div class="grid-card ${isSelected ? 'selected' : ''}" data-id="${id}" title="${label}"
        tabindex="0" 
        role="checkbox" 
        aria-checked="${isSelected}">
        ${contentHtml}
        <div class="grid-overlay-check">
          <input type="checkbox" ${isSelected ? "checked" : ""} style="pointer-events:none;" tabindex="-1" >
        </div>
      </div>
    `;
  },

  emptyState() {
    return `
      <div class="empty-state">
        <svg><use href="#ic-search"/></svg>
        <h3>No requests found</h3>
        <p>Try adjusting your search or filters.</p>
      </div>
    `;
  },

  rowMenu(app) {
    const id = app.componentName;
    const pkg = id.split('/')[0];
    const name = app.label;
    
    return `
      <div class="ctx-item" tabindex="0" role="menuitem"
        onclick="window.open('${CONFIG.urls.fDroid}${pkg}')">
        ${ICONS.fDroid} <span>F-Droid</span>
      </div>
      <div class="ctx-item" tabindex="0" role="menuitem"
        onclick="window.open('${CONFIG.urls.izzy}${pkg}')">
        ${ICONS.izzyOnDroid} <span>IzzyOnDroid</span>
      </div>
      <div class="ctx-item" tabindex="0" role="menuitem"
        onclick="window.open('${CONFIG.urls.galaxyStore}${pkg}')">
        ${ICONS.galaxyStore} <span>Galaxy Store</span>
      </div>
      <div class="ctx-item" tabindex="0" role="menuitem"
        onclick="Actions.copyIconToolCmd('${id}')">
        ${ICONS.terminal} <span>Copy icontool command</span>
      </div>
      <div class="ctx-item" tabindex="0" role="menuitem" 
        onclick="Actions.copyToClipboard('${name.replace(/'/g, "\\'")}\\n${id}')">
        ${ICONS.copy} <span>Copy name and component</span>
      </div>
      <div class="ctx-item" tabindex="0" role="menuitem"
        onclick="Actions.copyAppFilterEntry('${id}')">
        ${ICONS.copy} <span>Copy appfilter</span>
      </div>
    `;
  },

  fabMenu() {
    return `
      <div class="ctx-item" tabindex="0" role="menuitem"
        onclick="Actions.copyBulkAppFilter()">
        ${ICONS.copy} <span>Copy appfilter entries</span>
      </div>
      <div class="ctx-item" onclick="Actions.copyPrTemplate()">
        ${ICONS.copy} <span>Copy PR template</span>
      </div>
      <div class="ctx-item" tabindex="0" role="menuitem"
        onclick="Actions.downloadSelectionAsJson()">
        ${ICONS.download} <span>Download JSON config</span>
      </div>
      <div class="ctx-item" tabindex="0" role="menuitem"
        onclick="Actions.copyBulkIconToolCmd()">
        ${ICONS.terminal} <span>Copy icontool commands</span>
      </div>
    `;
  },
  
  toast(text, icon) {
    return `
      <div class="toast-icon">${icon}</div>
      <div class="toast-text">${text}</div>
    `;
  }
};

// ==========================================
// UTILITIES
// ==========================================
const Utils = {
  formatDate(unix) {
    if (!unix) return "—";
    return new Date(unix * 1000).toLocaleDateString("en-US", { 
      month: "short", day: "numeric", year: "numeric" 
    });
  },

  parseInstalls(str) {
    if (!str) return -1; // Unknown installs go to bottom
    // Remove commas and plus signs, then parse
    const clean = str.toString().replace(/[,+]/g, '');
    return parseInt(clean, 10) || 0;
  },

  sanitizeDrawableName(label) {
    if (!label) return "unknown";
    let name = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    name = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    name = name.replace(/^_+|_+$/g, "");
    if (/^[0-9]/.test(name)) name = "_" + name;
    return name || "icon";
  },

  parseSearchQuery(rawQuery) {
    const result = { text: "", tags: new Set() };
    const tokenRegex = /\b(?:is|tag|in):([a-z0-9-_]+)\b/gi;
    
    const cleanQuery = rawQuery.replace(tokenRegex, (match, tag) => {
      const validTag = CONFIG.data.filters.find(id => id === tag.toLowerCase());
      if (validTag) result.tags.add(validTag);
      return "";
    });
    
    result.text = cleanQuery.trim();
    return result;
  },

  generateXml(app) {
    const cmp = app.componentName;
    const name = app.label;
    const draw = Utils.sanitizeDrawableName(name);
    return `<item component="ComponentInfo{${cmp}}" drawable="${draw}" name="${name}" />`;
  },

  generateIconToolCmd(app) {
    let path = App.dom.inputPath.value.trim();
    if (path && !path.endsWith("/")) path += "/";
    
    const cmp = app.componentName;
    const name = app.label.replace(/"/g, '\\"');
    const cleanName = Utils.sanitizeDrawableName(app.label);
    
    return `python3 ./icontool.py add "${path}${cleanName}.svg" ${cmp} "${name}"`;
  },

  getTagsForApp(id) {
    const tags = [];
    const appTags = App.state.appTags.get(id);
    if (appTags) {
      CONFIG.data.filters.forEach(id => {
        if (appTags.has(id)) tags.push(id);
      });
    }
    return tags;
  }
};

// ==========================================
// TOAST SYSTEM
// ==========================================
const Toast = {
  activeToasts: new Set(),

  show(text, type = "info") {
    const key = `${text}-${type}`;
    if (this.activeToasts.has(key)) return;

    if (App.dom.toastBox.children.length >= 3) {
      this.remove(App.dom.toastBox.firstElementChild);
    }

    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.dataset.key = key;
    this.activeToasts.add(key);

    let iconSvg = ICONS.copy;
    if (type === "error") iconSvg = `<svg><use href="#ic-search"/></svg>`;
    if (type === "success") iconSvg = `<svg><use href="#ic-download"/></svg>`;

    el.innerHTML = Templates.toast(text, iconSvg);
    App.dom.toastBox.appendChild(el);

    setTimeout(() => this.remove(el), 2500);
  },

  remove(el) {
    if (el.classList.contains("hiding")) return;
    if (el.dataset.key) this.activeToasts.delete(el.dataset.key);
    el.classList.add("hiding");
    el.addEventListener("animationend", () => el.remove());
  }
};

// ==========================================
// ACTIONS (Business Logic)
// ==========================================
const Actions = {
  toggleSelection(id, event = null) {
    const s = App.state.selected;
    const currentIdx = App.state.currentData.findIndex(a => a.componentName === id);

    // Handle Shift Click
    if (event && event.shiftKey && s.lastSelectedId) {
      const lastIdx = App.state.currentData.findIndex(a => a.componentName === s.lastSelectedId);

      window.getSelection()?.removeAllRanges();
      
      if (lastIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(lastIdx, currentIdx);
        const end = Math.max(lastIdx, currentIdx);
        
        const range = App.state.currentData.slice(start, end + 1);
        
        // Determine mode: if current clicked item is NOT selected, we select range.
        // If it IS selected (and we shift click), we typically select range.
        // Standard behavior: Add range to selection.
        
        range.forEach(app => {
          s.add(app.componentName);
          UI.updateItemVisuals(app.componentName);
        });
        
        UI.updateHeaderCheckbox();
        UI.updateFab();
        return; // Stop standard toggle
      }
    }

    if (s.has(id)) s.delete(id);
    else s.add(id);

    s.lastSelectedId = id;
    
    UI.updateItemVisuals(id);
    UI.updateHeader();
    UI.updateFab();
  },

  toggleSelectAll(isChecked) {
    if (isChecked) {
      App.state.currentData.forEach(app => App.state.selected.add(app.componentName));
    } else {
      App.state.currentData.forEach(app => App.state.selected.delete(app.componentName));
    }
    
    const scrollY = window.scrollY;
    UI.render();
    window.scrollTo(0, scrollY);
  },

  copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    Toast.show("Copied!");
    UI.closeContextMenu();
  },

  copyAppFilterEntry(id) {
    const app = App.state.idMap.get(id);
    if (app) Actions.copyToClipboard(Utils.generateXml(app));
  },

  copyIconToolCmd(id) {
    const app = App.state.idMap.get(id);
    if (app) Actions.copyToClipboard(Utils.generateIconToolCmd(app));
  },

  copyPrTemplate() {
    Actions.copyToClipboard(PR_TEMPLATE);
  },

  copyBulkAppFilter() {
    const selected = Data.getSelectedApps();
    if (selected.length === 0) return;
    const output = selected.map(Utils.generateXml).join('\n');
    Actions.copyToClipboard(output);
  },

  copyBulkIconToolCmd() {
    const selected = Data.getSelectedApps();
    if (selected.length === 0) return;
    const output = selected.map(Utils.generateIconToolCmd).join('\n');
    Actions.copyToClipboard(output);
  },

  downloadSelectionAsJson() {
    const ids = Array.from(App.state.selected);
    if (ids.length === 0) return;

    const label = prompt("Enter label for group:", "custom") || "custom";
    const blob = new Blob([JSON.stringify({ [label]: ids }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `${label}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    UI.closeContextMenu();
  },

  async downloadSelected() {
    if (typeof JSZip === 'undefined') {
      Toast.show("JSZip library missing", "error");
      return;
    }

    const ids = Array.from(App.state.selected);
    if (ids.length === 0) return;

    const originalText = App.dom.fabCount.textContent;
    App.dom.fabCount.textContent = "Preparing...";
    App.dom.fabBar.style.cursor = "wait";

    try {
      const zip = new JSZip();
      const folder = zip.folder("icons");
      const usedNames = new Set();
      const promises = [];

      ids.forEach(id => {
        const app = App.state.idMap.get(id);
        if (!app) return;

        let filename = Utils.sanitizeDrawableName(app.label);
        if (usedNames.has(filename)) {
          let c = 2;
          while (usedNames.has(`${filename}_${c}`)) c++;
          filename = `${filename}_${c}`;
        }
        usedNames.add(filename);

        const url = `${CONFIG.data.assetsPath}${app.drawable}${CONFIG.data.iconExtension}`;
        promises.push(
          fetch(url)
            .then(r => r.ok ? r.blob() : Promise.reject())
            .then(blob => folder.file(`${filename}.png`, blob))
            .catch(() => console.warn(`Failed: ${url}`))
        );
      });

      App.dom.fabCount.textContent = `Fetching ${promises.length}...`;
      await Promise.all(promises);

      App.dom.fabCount.textContent = "Zipping...";
      const content = await zip.generateAsync({ type: "blob" });
      
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `lawnicons-export-${new Date().toISOString().slice(0,10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      Toast.show("Download started", "success");
    } catch (e) {
      console.error(e);
      Toast.show("Download failed", "error");
    } finally {
      App.dom.fabBar.style.cursor = "default";
      App.dom.fabCount.textContent = originalText;
      UI.closeContextMenu();
    }
  }
};

// ==========================================
// DATA & STATE LOGIC
// ==========================================
const Data = {
  init() {
    Promise.all([
      fetch(CONFIG.data.endpoint).then(r => r.json()),
      ...CONFIG.data.filters.map(id => this.fetchFilterData(id)) // Fetch all
    ])
    .then(([json, ...filterObjects]) => {
      App.data = json.apps;
      
      // 1. Build ID Map
      App.state.idMap = new Map();
      App.data.forEach(app => App.state.idMap.set(app.componentName, app));

      // 2. Initialize Tags & Metadata Storage
      App.state.appTags = new Map();
      App.state.filterMetadata = new Map(); // Store labels/desc here

      // 3. Process Filters
      filterObjects.forEach((obj, index) => {
        if (!obj) return;
        const id = CONFIG.data.filters[index];

        // Store Metadata for UI
        App.state.filterMetadata.set(id, { 
          label: obj.label, 
          desc: obj.description 
        });

        // Handle "Unlabeled" Logic
        if (id === "unlabeled") {
          this.computeUnlabeled(id);
        } 
        // Handle Standard JSON Logic
        else if (obj[id] && Array.isArray(obj[id])) {
          obj[id].forEach(appId => this.addTag(appId, id));
        }
      });

      this.loadUrlState();
      UI.init();
    })
    .catch(e => {
      console.error(e);
      Toast.show("Failed to load data", "error");
    });
  },

  async fetchFilterData(id) {
    // Special handling for Unlabeled (No network request)
    if (id === "unlabeled") {
      return {
        label: "Unlabeled",
        description: "Apps with no other tags assigned.",
        unlabeled: [] // Empty placeholder
      };
    }

    try {
      const res = await fetch(`${CONFIG.data.filterPath}${id}.json`);
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  },

  computeUnlabeled(tagId) {
    // Run after other tags are populated
    App.data.forEach(app => {
      const id = app.componentName;
      const existingTags = App.state.appTags.get(id);
      // If no tags exist (or set is empty), mark as unlabeled
      if (!existingTags || existingTags.size === 0) {
        this.addTag(id, tagId);
      }
    });
  },

  addTag(id, tag) {
    if (!App.state.appTags.has(id)) App.state.appTags.set(id, new Set());
    App.state.appTags.get(id).add(tag);
  },

  getSelectedApps() {
    return App.data.filter(a => App.state.selected.has(a.componentName));
  },

  process() {
    let data = App.data;
    const s = App.state;

    // 1. Search
    const query = Utils.parseSearchQuery(s.search);
    const activeFilters = new Set([...s.activeFilters, ...query.tags]);

    // 2. Filter (Tags)
    if (activeFilters.size > 0) {
      data = data.filter(app => {
        const id = app.componentName;
        const tags = s.appTags.get(id);
        if (!tags) return false;
        return Array.from(activeFilters).every(fid => tags.has(fid));
      });
    }

    // 3. Filter (Text)
    if (query.text) {
      if (s.regexMode) {
        try {
          const regex = new RegExp(query.text, 'i');
          data = data.filter(a => 
            a.componentNames.some(c => regex.test(a.label) || regex.test(a.componentName))
          );
        } catch { data = []; }
      } else {
        const term = query.text.toLowerCase();
        data = data.filter(a => 
          a.label.toLowerCase().includes(term) || a.componentName.toLowerCase().includes(term)
        );
      }
    }

    // 4. Sort
    data = [...data]; // Clone
    if (s.sort === "rand") {
      for (let i = data.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [data[i], data[j]] = [data[j], data[i]];
      }
    } else {
      const sorters = {
        "req-desc":  (a, b) => b.requestCount - a.requestCount,
        "req-asc":   (a, b) => a.requestCount - b.requestCount,
        "install-desc": (a, b) => Utils.parseInstalls(b.installs) - Utils.parseInstalls(a.installs),
        "install-asc":  (a, b) => Utils.parseInstalls(a.installs) - Utils.parseInstalls(b.installs),
        "time-desc": (a, b) => b.lastRequested - a.lastRequested,
        "time-asc":  (a, b) => a.lastRequested - b.lastRequested,
        "name-asc":  (a, b) => a.label.localeCompare(b.label),
        "name-desc": (a, b) => b.label.localeCompare(a.label)
      };
      if (sorters[s.sort]) data.sort(sorters[s.sort]);
    }

    App.state.currentData = data;
  },

  loadUrlState() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("q")) {
      App.state.search = params.get("q");
      App.dom.inputSearch.value = App.state.search;
    }
    if (params.has("view")) {
      const v = params.get("view");
      if (["list", "grid"].includes(v)) App.state.view = v;
      App.dom.selectView.value = App.state.view;
    }
    if (params.has("sort")) {
      App.state.sort = params.get("sort");
      App.dom.selectSort.value = App.state.sort;
    }
    if (params.has("regex")) {
      App.state.regexMode = true;
      App.dom.regexBtn.classList.add("active");
    }
    if (params.has("filters")) {
      params.get("filters").split(",").forEach(t => {
        if (CONFIG.data.filters.some(id => id === t)) App.state.activeFilters.add(t);
      });
    }
  },

  syncUrlState() {
    const s = App.state;
    const params = new URLSearchParams();

    if (s.search) params.set("q", s.search);
    if (s.view !== DEFAULTS.view) params.set("view", s.view);
    if (s.sort !== DEFAULTS.sort) params.set("sort", s.sort);
    if (s.regexMode) params.set("regex", "1");
    
    if (s.activeFilters.size > 0) {
      const sortedFilters = Array.from(s.activeFilters).sort();
      params.set("filters", sortedFilters.join(","));
    }
    
    const queryString = params.toString();
    const newUrl = queryString 
      ? `${window.location.pathname}?${queryString}` 
      : window.location.pathname;

    window.history.replaceState({}, "", newUrl);
  }
};

// ==========================================
// UI LOGIC
// ==========================================
const UI = {
  observer: null,

  init() {
    this.generateFilters();
    this.initObserver();
    this.render();
    
    // Bind Global Events
    App.dom.inputSearch.addEventListener("input", e => {
      App.state.search = e.target.value;
      this.render();
    });
    App.dom.selectSort.addEventListener("change", e => {
      App.state.sort = e.target.value;
      this.render();
    });
    App.dom.selectView.addEventListener("change", e => {
      App.state.view = e.target.value;
      this.render();
    });
    App.dom.regexBtn.addEventListener("click", () => {
      App.state.regexMode = !App.state.regexMode;
      App.dom.regexBtn.classList.toggle("active", App.state.regexMode);
      this.render();
    });
    App.dom.headerCheck.addEventListener("change", e => Actions.toggleSelectAll(e.target.checked));
    App.dom.fabMenuBtn.addEventListener("click", e => {
      e.stopPropagation();
      this.showFabMenu();
    });
    App.dom.mobileFilterBtn.addEventListener("click", () => {
      this.showMobileFilterPopover();
    });

    App.dom.container.addEventListener('click', (e) => {
      const trigger = e.target.closest('.ctx-trigger');
      if (trigger) {
        e.stopPropagation(); // Prevent row selection
        const row = trigger.closest('[data-id]');
        const id = row.dataset.id;
        const app = App.state.idMap.get(id);
        if (app) this.showRowMenu(e, app);
        return;
      }

      // 2. Handle Links/Buttons (Download, Play Store)
      // We explicitly IGNORE clicks on <a> tags so they perform their default action
      // but do NOT trigger row selection.
      if (e.target.closest('a')) {
        e.stopPropagation(); 
        return;
      }

      // 3. Handle Row/Card Selection
      const item = e.target.closest('[data-id]');
      if (item) {
        const id = item.dataset.id;
        
        // If clicking the checkbox directly, or the row background
        Actions.toggleSelection(id, e);
      }
    });

    document.addEventListener('keydown', (e) => {
      // Ignore if typing in an input
      if (e.target.tagName === 'INPUT') return;

      // 1. Focus Search (/)
      if (e.key === '/') {
        e.preventDefault();
        App.dom.inputSearch.focus();
      }

      // 2. Select All (Ctrl+A)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        Actions.toggleSelectAll(true);
      }

      // 3. Clear Selection (Esc)
      if (e.key === 'Escape') {
        if (App.state.selected.size > 0) {
          Actions.toggleSelectAll(false);
        }
      }

      // 4. Focus FAB
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (App.state.selected.size > 0) {
          e.preventDefault();
          App.dom.fabBar.focus()
        }
      }
    });

    // Add 'keydown' listener to container
    App.dom.container.addEventListener('keydown', (e) => {
      const target = e.target;
      
      // --- 1. Selection & Actions (Enter/Space) ---
      if (e.key === 'Enter' || e.key === ' ') {
        // A. Row/Card Selection
        if (target.classList.contains('list-row') || target.classList.contains('grid-card')) {
          e.preventDefault(); // Prevent page scroll on Space
          const id = target.dataset.id;
          Actions.toggleSelection(id, e); // Pass event for Shift logic
        }

        // B. Context Menu Trigger
        if (target.classList.contains('ctx-trigger')) {
          e.preventDefault();
          e.stopPropagation();
          const row = target.closest('[data-id]');
          const id = row.dataset.id;
          const app = App.state.idMap.get(id);
          
          const rect = target.getBoundingClientRect();
          const fakeEvent = { 
            clientX: rect.left + rect.width / 2, 
            clientY: rect.top + rect.height / 2 
          };
          
          UI.showRowMenu(fakeEvent, app);
        }
        return; // Done with Enter/Space
      }

      // --- 2. Navigation (Arrow Keys) ---
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const item = target.closest('[data-id]');
        if (!item) return;

        e.preventDefault(); // Prevent scrolling

        // Get only valid items (ignore loaders/sentinels)
        const items = Array.from(App.dom.container.querySelectorAll('[data-id]'));
        const index = items.indexOf(item);
        let nextIndex = index;

        if (App.state.view === 'list') {
          // List: Up/Down only
          if (e.key === 'ArrowUp') nextIndex = index - 1;
          if (e.key === 'ArrowDown') nextIndex = index + 1;
        } else {
          // Grid: Calculate columns dynamically
          const itemWidth = item.getBoundingClientRect().width + 16; // Width + Gap
          const containerWidth = App.dom.container.clientWidth;
          const cols = Math.floor(containerWidth / itemWidth) || 1;

          if (e.key === 'ArrowLeft') nextIndex = index - 1;
          if (e.key === 'ArrowRight') nextIndex = index + 1;
          if (e.key === 'ArrowUp') nextIndex = index - cols - 1;
          if (e.key === 'ArrowDown') nextIndex = index + cols + 1;
        }

        // Apply Focus if valid
        if (nextIndex >= 0 && nextIndex < items.length) {
          items[nextIndex].focus();
        }
      }
    });

    // Handle Menu Navigation (Shared for all menus)
    ['rowMenu', 'fabMenu', 'mobileFilterMenu'].forEach(id => {
      const menu = App.dom[id];
      if (!menu) return;

      if (menu) {
        menu.addEventListener("toggle", (e) => {
          if (e.newState === "closed") {
            // Wait for CSS transition
            setTimeout(() => menu.innerHTML = "", 200);
          }
        });
      }

      menu.addEventListener('keydown', (e) => {
        const items = Array.from(menu.querySelectorAll('.ctx-item'));
        const index = items.indexOf(document.activeElement);

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const next = items[index + 1] || items[0];
          next.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = items[index - 1] || items[items.length - 1];
          prev.focus();
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          document.activeElement.click();
        } else if (e.key === 'Tab') {
          e.preventDefault()
          this.closeContextMenu()
        }  else if (e.key === 'Escape') {
          // Popover handles close, but we should return focus to trigger?
          // Native behavior usually handles this, but explicit is better.
        }
      });
    });

    const isDesktop = window.matchMedia('(pointer: fine)').matches;
    if (isDesktop) {
      App.dom.inputSearch.focus();
    }
  },

  initObserver() {
    this.observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        const more = this.loadMore();
        App.dom.sentinel.style.opacity = more ? 1 : 0;
      }
    }, { rootMargin: "400px" });
    this.observer.observe(App.dom.sentinel);
  },

  render() {
    const s = App.state;
    App.dom.container.innerHTML = "";
    App.dom.container.className = s.view === "grid" ? "grid-container" : "";

    Data.process();

    Data.syncUrlState();

    this.updateHeader();

    if (s.currentData.length === 0) {
      App.dom.container.innerHTML = Templates.emptyState();
      this.updateHeader();
      return;
    }

    s.renderedCount = 0;
    this.loadMore();
    
    App.dom.listHeader.style.display = s.view === "list" ? "grid" : "none";
  },

  // In UI object
  loadMore() {
    const s = App.state;
    if (s.renderedCount >= s.currentData.length) return false;

    const end = Math.min(s.renderedCount + CONFIG.ui.batchSize, s.currentData.length);
    const batch = s.currentData.slice(s.renderedCount, end);
    const fragment = document.createDocumentFragment();

    // Create a temporary container to hold the HTML string
    const tempDiv = document.createElement('div');

    batch.forEach(app => {
      const id = app.componentName;
      const isSelected = s.selected.has(id);
      const iconUrl = `${CONFIG.data.assetsPath}${app.drawable}${CONFIG.data.iconExtension}`;
      
      let html = "";
      if (s.view === "list") {
        const tags = Utils.getTagsForApp(id);
        html = Templates.listRow(app, isSelected, tags, iconUrl, Utils.formatDate(app.firstAppearance), Utils.formatDate(app.lastRequested));
      } else {
        html = Templates.gridCard(app, isSelected, iconUrl);
      }
      
      // Append HTML string to temp container
      tempDiv.innerHTML = html.trim();
      
      // Move the created element to fragment (No event listeners attached!)
      while (tempDiv.firstChild) {
        fragment.appendChild(tempDiv.firstChild);
      }
    });

    App.dom.container.appendChild(fragment);
    s.renderedCount = end;
    return true;
  },

  generateFilters() {
    const c = App.dom.filterBox;
    if (!c) return;
    c.innerHTML = "";
    
    CONFIG.data.filters.forEach(id => {
      const meta = App.state.filterMetadata.get(id);
      if (!meta) return;

      const btn = document.createElement("button");
      btn.className = `tag tag-${id} chip`;
      btn.textContent = meta.label;
      btn.title = meta.desc || `Filter by ${meta.label}`; // Use description for 
      if (App.state.activeFilters.has(id)) btn.classList.add("active");
      
      btn.onclick = () => {
        const s = App.state.activeFilters;
        
        // LOGIC: Mutual Exclusivity for "Unlabeled"
        if (id === "unlabeled") {
          if (s.has("unlabeled")) {
            s.delete("unlabeled"); // Toggle Off
          } else {
            s.clear();             // Clear others
            s.add("unlabeled");    // Toggle On
          }
        } else {
          // Clicking a normal filter
          if (s.has("unlabeled")) {
            s.delete("unlabeled"); // Clear unlabeled if active
          }
          
          // Standard Toggle
          if (s.has(id)) s.delete(id);
          else s.add(id);
        }
        
        // Update UI classes immediately (faster than full render)
        Array.from(c.children).forEach(b => {
          const filterId = b.className.match(/tag-([a-z]+)/)[1];
          
          if (s.has(filterId)) b.classList.add("active");
          else b.classList.remove("active");
        });

        this.render()
      };
      c.appendChild(btn);
    });
  },

  updateItemVisuals(id) {
    const isSelected = App.state.selected.has(id);
    document.querySelectorAll(`[data-id="${id}"]`).forEach(el => {
      el.classList.toggle("selected", isSelected);
      const cb = el.querySelector("input[type='checkbox']");
      if (cb) cb.checked = isSelected;
    });
  },

  updateHeader() {
    const total = App.state.currentData.length; // Filtered Count
    const absoluteTotal = App.data.length;      // Global Count
    
    // 1. Update Text
    const countEl = App.dom.headerCount;
    
    if (total === absoluteTotal) {
      // No filters active
      countEl.textContent = `${absoluteTotal.toLocaleString()} requests`;
    } else {
      // Filters active
      countEl.textContent = `${total.toLocaleString()} of ${absoluteTotal.toLocaleString()} requests`;
    }

    // 2. Update Checkbox (Existing Logic)
    const hc = App.dom.headerCheck;
    if (total === 0) {
      hc.checked = false; hc.indeterminate = false; return;
    }

    let count = 0;
    App.state.currentData.forEach(app => {
      if (App.state.selected.has(app.componentName)) count++;
    });

    hc.checked = (count === total);
    hc.indeterminate = (count > 0 && count < total);
    
    const filterCount = App.state.activeFilters.size;
    if (filterCount > 0) {
      App.dom.mobileFilterCount.textContent = `(${filterCount})`;
    } else {
      App.dom.mobileFilterCount.textContent = "";
    }

    this.updateFab();
  },

  updateFab() {
    const count = App.state.selected.size;
    if (count > 0) {
      App.dom.fabBar.classList.add("visible");
      App.dom.fabCount.textContent = `Download ${count} icon${count > 1 ? 's' : ''}`;
    } else {
      App.dom.fabBar.classList.remove("visible");
    }
  },

  showRowMenu(e, app) {
    App.dom.rowMenu.innerHTML = Templates.rowMenu(app);
    
    // Positioning
    const w = 280, h = 280;
    let x = e.clientX + 2, y = e.clientY + 2;
    if (x + w > window.innerWidth) x -= (w + 4);
    if (y + h > window.innerHeight) y -= (h + 4);
    
    App.dom.rowMenu.style.left = `${x}px`;
    App.dom.rowMenu.style.top = `${y}px`;
    App.dom.rowMenu.style.transformOrigin = "top left";
    App.dom.rowMenu.showPopover();
    this.focusMenu(App.dom.rowMenu);
  },

  showFabMenu() {
    App.dom.fabMenu.innerHTML = Templates.fabMenu();
    App.dom.fabMenu.showPopover();
    this.focusMenu(App.dom.fabMenu);
  },

  showMobileFilterPopover() {
    const menu = App.dom.mobileFilterMenu;
    menu.innerHTML = ""; // Clear previous content

    const s = App.state.activeFilters;

    // 1. Build Items
    CONFIG.data.filters.forEach(id => {
      const meta = App.state.filterMetadata.get(id);
      if (!meta) return;

      const item = document.createElement("div");
      const isActive = App.state.activeFilters.has(id);
      item.tabIndex = 0
      item.role = "menuitemcheckbox"
      item.className = `ctx-item ${isActive ? 'active' : ''}`;
      
      item.innerHTML = `
        <span class="check-icon">${ICONS.check}</span>
        <span>${meta.label}</span>      
      `;
      
      item.onclick = (e) => {
        e.stopPropagation(); // Prevent popover from closing
    
        if (id === "unlabeled") {
          if (s.has("unlabeled")) s.delete("unlabeled");
          else { s.clear(); s.add("unlabeled"); }
        } else {
          if (s.has("unlabeled")) s.delete("unlabeled");
          if (s.has(id)) s.delete(id);
          else s.add(id);
        }
        UI.render();
        
        // Re-render menu content to update checkmarks instantly
        this.showMobileFilterPopover();
      };
      menu.appendChild(item);
    });

    // 2. Position below button
    const rect = App.dom.mobileFilterBtn.getBoundingClientRect();
    const padding = (s.size > 0) ? 135 : 150

    menu.style.left = `${rect.left - padding}px`;
    menu.style.top = `${rect.bottom + 8}px`;

    // 3. Show
    menu.showPopover();
    this.focusMenu(App.dom.mobileFilterMenu);
  },

  focusMenu(menuEl) {
    // Wait for browser to render the popover
    requestAnimationFrame(() => {
      const firstItem = menuEl.querySelector('.ctx-item');
      if (firstItem) firstItem.focus();
    });
  },

  closeContextMenu() {
    try { App.dom.rowMenu.hidePopover(); } catch {}
    try { App.dom.fabMenu.hidePopover(); } catch {}
    try { App.dom.mobileFilterMenu.hidePopover(); } catch {}

    setTimeout(() => {
      App.dom.rowMenu.innerHTML = "";
      App.dom.fabMenu.innerHTML = "";
      App.dom.mobileFilterMenu.innerHTML = ""; // If present
    }, 200);
  }
};

// Start
Data.init();