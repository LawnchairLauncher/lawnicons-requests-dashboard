/**
 * LAWNICONS REQUEST MANAGER
 * Pure Vanilla JS
 */

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
const CONFIG = {
  data: {
    endpoint: "/docs/assets/requests.json",
    assetsPath: "/docs/extracted_png/",
    iconExtension: ".png",
    filterPath: "/docs/assets/filters/",
  },
  filters: [
    { id: "unlabeled", label: "Unlabeled", desc: "Apps with no matching labels" }, // NEW
    { id: "wip",      label: "WIP", desc: "Apps with icons that are currently being made" },
    { id: "easy",     label: "Easy", desc: "Apps with easy to make icons" },
    { id: "conflict", label: "Name in Use", desc: "Apps that match existing names" },
    { id: "link",     label: "Matches", desc: "Apps that match existing packages" },
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
  listRow(app, isSelected, tags, iconUrl, dateStr) {
    const id = app.componentNames[0].componentName;
    const name = app.componentNames[0].label;
    const pkg = id.split('/')[0];

    const tagHtml = tags.map(t => 
      `<span class="status-pill status-${t.id}" title="${t.desc}">${t.label}</span>`
    ).join("");

    return `
      <div class="list-row ${isSelected ? 'selected' : ''}" data-id="${id}">
        <div class="check-col">
          <input type="checkbox" ${isSelected ? "checked" : ""} class="row-checkbox" />
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
      </div>
    `;
  },

  gridCard(app, isSelected, iconUrl) {
    const id = app.componentNames[0].componentName;
    return `
      <div class="grid-card ${isSelected ? 'selected' : ''}" data-id="${id}" title="${app.componentNames[0].label}">
        <img src="${iconUrl}" loading="lazy" onerror="this.style.display='none'" />
        <div class="grid-overlay-check">
          <input type="checkbox" ${isSelected ? "checked" : ""} style="pointer-events:none;">
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
    const id = app.componentNames[0].componentName;
    const pkg = id.split('/')[0];
    const name = app.componentNames[0].label;
    
    return `
      <div class="ctx-item" onclick="window.open('${CONFIG.urls.fDroid}${pkg}')">
        ${ICONS.fDroid} <span>F-Droid</span>
      </div>
      <div class="ctx-item" onclick="window.open('${CONFIG.urls.izzy}${pkg}')">
        ${ICONS.izzyOnDroid} <span>IzzyOnDroid</span>
      </div>
      <div class="ctx-item" onclick="window.open('${CONFIG.urls.galaxyStore}${pkg}')">
        ${ICONS.galaxyStore} <span>Galaxy Store</span>
      </div>
      <div class="ctx-item" onclick="Actions.copyIconToolCmd('${id}')">
        ${ICONS.terminal} <span>Copy icontool command</span>
      </div>
      <div class="ctx-item" onclick="Actions.copyToClipboard('${name.replace(/'/g, "\\'")}\\n${id}')">
        ${ICONS.copy} <span>Copy name and component</span>
      </div>
      <div class="ctx-item" onclick="Actions.copyAppFilterEntry('${id}')">
        ${ICONS.copy} <span>Copy appfilter</span>
      </div>
    `;
  },

  fabMenu() {
    return `
      <div class="ctx-item" onclick="Actions.copyBulkAppFilter()">
        ${ICONS.copy} <span>Copy appfilter entries</span>
      </div>
       <div class="ctx-item" onclick="Actions.downloadSelectionAsJson()">
        ${ICONS.download} <span>Download JSON config</span>
      </div>
      <div class="ctx-item" onclick="Actions.copyPrTemplate()">
        ${ICONS.copy} <span>Copy PR template</span>
      </div>
      <div class="ctx-item" onclick="Actions.copyBulkIconToolCmd()">
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
      const validTag = CONFIG.filters.find(f => f.id === tag.toLowerCase());
      if (validTag) result.tags.add(validTag.id);
      return "";
    });
    
    result.text = cleanQuery.trim();
    return result;
  },

  generateXml(app) {
    const cmp = app.componentNames[0].componentName;
    const name = app.componentNames[0].label;
    const draw = Utils.sanitizeDrawableName(name);
    return `<item component="ComponentInfo{${cmp}}" drawable="${draw}" name="${name}" />`;
  },

  generateIconToolCmd(app) {
    let path = App.dom.inputPath.value.trim();
    if (path && !path.endsWith("/")) path += "/";
    
    const cmp = app.componentNames[0].componentName;
    const name = app.componentNames[0].label.replace(/"/g, '\\"');
    const cleanName = Utils.sanitizeDrawableName(app.componentNames[0].label);
    
    return `python3 ./icontool.py add "${path}${cleanName}.svg" ${cmp} "${name}"`;
  },

  getTagsForApp(id) {
    const tags = [];
    const appTags = App.state.appTags.get(id);
    if (appTags) {
      CONFIG.filters.forEach(f => {
        if (appTags.has(f.id)) tags.push(f);
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
  toggleSelection(id) {
    const s = App.state.selected;
    if (s.has(id)) s.delete(id);
    else s.add(id);
    
    UI.updateItemVisuals(id);
    UI.updateHeader();
    UI.updateFab();
  },

  toggleSelectAll(isChecked) {
    if (isChecked) {
      App.state.currentData.forEach(app => App.state.selected.add(app.componentNames[0].componentName));
    } else {
      App.state.currentData.forEach(app => App.state.selected.delete(app.componentNames[0].componentName));
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

        let filename = Utils.sanitizeDrawableName(app.componentNames[0].label);
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
      ...CONFIG.filters.map(f => this.fetchFilter(f.id))
    ])
    .then(([json, ...filterResults]) => {
      App.data = json.apps;

      App.state.idMap = new Map();
      App.data.forEach(app => {
        App.state.idMap.set(app.componentNames[0].componentName, app);
      });

      App.state.appTags = new Map();
      CONFIG.filters.forEach((f, idx) => {
        const ids = filterResults[idx];
        if (ids && Array.isArray(ids)) {
          ids.forEach(id => this.addTag(id, f.id));
        }
      });

      this.loadUrlState();

      App.data.forEach(app => {
        const id = app.componentNames[0].componentName;
        
        // Check if app has any tags in the map
        const tags = App.state.appTags.get(id);
        
        if (!tags || tags.size === 0) {
          // It has no tags! Mark it as unlabeled.
          Data.addTag(id, "unlabeled");
        }
      });

      UI.init();
    })
    .catch(e => {
      console.error(e);
      Toast.show("Failed to load data", "error");
    });
  },

  async fetchFilter(id) {
    try {
      const res = await fetch(`${CONFIG.data.filterPath}${id}.json`);
      if (!res.ok) return null;
      const data = await res.json();
      return data[id] || null;
    } catch { return null; }
  },

  addTag(id, tag) {
    if (!App.state.appTags.has(id)) App.state.appTags.set(id, new Set());
    App.state.appTags.get(id).add(tag);
  },

  getSelectedApps() {
    return App.data.filter(a => App.state.selected.has(a.componentNames[0].componentName));
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
        const id = app.componentNames[0].componentName;
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
            a.componentNames.some(c => regex.test(c.label) || regex.test(c.componentName))
          );
        } catch { data = []; }
      } else {
        const term = query.text.toLowerCase();
        data = data.filter(a => 
          a.componentNames.some(c => 
            c.label.toLowerCase().includes(term) || c.componentName.toLowerCase().includes(term)
          )
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
        "time-desc": (a, b) => b.lastRequested - a.lastRequested,
        "time-asc":  (a, b) => a.lastRequested - b.lastRequested,
        "name-asc":  (a, b) => a.componentNames[0].label.localeCompare(b.componentNames[0].label),
        "name-desc": (a, b) => b.componentNames[0].label.localeCompare(a.componentNames[0].label)
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
        if (CONFIG.filters.some(f => f.id === t)) App.state.activeFilters.add(t);
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
        Actions.toggleSelection(id);
      }
    });
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
      const id = app.componentNames[0].componentName;
      const isSelected = s.selected.has(id);
      const iconUrl = `${CONFIG.data.assetsPath}${app.drawable}${CONFIG.data.iconExtension}`;
      
      let html = "";
      if (s.view === "list") {
        const tags = Utils.getTagsForApp(id);
        html = Templates.listRow(app, isSelected, tags, iconUrl, Utils.formatDate(app.lastRequested));
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
    
    CONFIG.filters.forEach(f => {
      const btn = document.createElement("button");
      btn.className = `tag tag-${f.id} chip`;
      btn.title = f.desc;
      btn.textContent = f.label;
      if (App.state.activeFilters.has(f.id)) btn.classList.add("active");
      
      btn.onclick = () => {
        const s = App.state.activeFilters;
        
        // LOGIC: Mutual Exclusivity for "Unlabeled"
        if (f.id === "unlabeled") {
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
          if (s.has(f.id)) s.delete(f.id);
          else s.add(f.id);
        }
        
        // Update UI classes immediately (faster than full render)
        Array.from(c.children).forEach(b => {
          const filterId = b.className.match(/tag-([a-z]+)/)[1];
          
          if (s.has(filterId)) b.classList.add("active");
          else b.classList.remove("active");
        });

        this.render();
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
      if (App.state.selected.has(app.componentNames[0].componentName)) count++;
    });

    hc.checked = (count === total);
    hc.indeterminate = (count > 0 && count < total);
    
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
  },

  showFabMenu() {
    App.dom.fabMenu.innerHTML = Templates.fabMenu();
    App.dom.fabMenu.showPopover();
  },

  closeContextMenu() {
    try { App.dom.rowMenu.hidePopover(); } catch {}
    try { App.dom.fabMenu.hidePopover(); } catch {}
  }
};

// Start
Data.init();