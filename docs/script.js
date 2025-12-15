/**
 * LAWNICONS REQUEST MANAGER
 * Pure Vanilla JS
 */

// ==========================================
// 1. CONFIGURATION
// ==========================================
const CONFIG = {
  data: {
    endpoint: "/docs/assets/requests.json",
    assetsPath: "/docs/extracted_png/",
    iconExtension: ".png"
  },
  urls: {
    playStore: "https://play.google.com/store/apps/details?id=",
    fDroid: "https://f-droid.org/en/packages/",
    izzy: "https://www.izzysoft.de/applists/category/named/",
    galaxyStore: "https://galaxystore.samsung.com/detail/"
  },
  ui: {
    batchSize: 500,
    wipThreshold: 9999,
    easyThreshold: 9999
  }
};

// ==========================================
// 2. ICONS (SVG Strings)
// ==========================================
const ICONS = {
  download: `<svg><use href="#ic-download"/></svg>`,
  play:     `<svg><use href="#ic-play"/></svg>`,
  dots:     `<svg><use href="#ic-dots"/></svg>`,
  copy:     `<svg><use href="#ic-copy"/></svg>`,
  fDroid:   `<svg><use href="#ic-fdroid"/></svg>`,
  izzyOnDroid: `<svg><use href="#ic-izzyondroid"/></svg>`,
  galaxyStore: `<svg><use href="#ic-galaxystore"/></svg>`,
};

// ==========================================
// 3. STATE & STORE
// ==========================================
const state = {
  view: "list",
  sort: "req-desc",
  search: "",
  selected: new Set(),
  renderedCount: 0, // How many items currently shown
  currentData: []   // The filtered/sorted dataset
};

let apps = []; // Raw data store
let observer;  // IntersectionObserver instance

// ==========================================
// 4. DOM ELEMENTS
// ==========================================
const DOM = {
  container:   document.getElementById("appContainer"),
  listHeader:  document.getElementById("listHeader"),
  headerCheck: document.getElementById("headerCheck"), // Master Checkbox
  headerCount: document.getElementById("headerCount"),
  sentinel:    document.getElementById("scrollSentinel"),
  
  inputSearch: document.getElementById("searchInput"),
  selectSort:  document.getElementById("sortSelect"),
  selectView:  document.getElementById("viewSelect"),
  
  fabBar:      document.getElementById("fabBar"),
  fabCount:    document.getElementById("fabCount"),
  fabMenuBtn:  document.getElementById("fabMenuBtn"),
  
  rowMenu:     document.getElementById("rowMenu"),
  fabMenu:     document.getElementById("fabMenu"),
};

// ==========================================
// 5. INITIALIZATION
// ==========================================
fetch(CONFIG.data.endpoint)
  .then(res => res.json())
  .then(json => {
    apps = json.apps;
    DOM.headerCount.textContent = `${json.count.toLocaleString()} requests`;
    initObserver();
    render(); // Initial Render
  })
  .catch(err => {
    console.error("Error loading data:", err);
    DOM.container.innerHTML = `<div style="padding:20px;text-align:center;color:red">Error loading data.</div>`;
  });


function initObserver() {
  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      loadMore();
    }
  }, { rootMargin: "400px" }); // Preload before hitting bottom

  observer.observe(DOM.sentinel);
}

// ==========================================
// 6. EVENT LISTENERS
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

// ==========================================
// 7. DATA PIPELINE
// ==========================================
function processData() {
  let data = apps;

  // Filter
  if (state.search) {
    const term = state.search.toLowerCase();
    data = data.filter(app => 
      app.componentNames.some(c => 
        c.label.toLowerCase().includes(term) || 
        c.componentName.toLowerCase().includes(term)
      )
    );
  }

  // Sort
  const sorters = {
    "req-desc":  (a, b) => b.requestCount - a.requestCount,
    "req-asc":   (a, b) => a.requestCount - b.requestCount,
    "time-desc": (a, b) => b.lastRequested - a.lastRequested,
    "time-asc":  (a, b) => a.lastRequested - b.lastRequested
  };

  if (state.sort !== "rand") {
    data.sort(sorters[state.sort]);
  }

  state.currentData = data; // Cache processed data
  return data;
}

// ==========================================
// 8. RENDER ENGINE (Infinite Scroll)
// ==========================================

// Full Re-render (Search/Sort/Init/View Change)
function render() {
  // 1. Clear Container
  DOM.container.innerHTML = "";
  
  // 2. Set Container Layout Class (CRITICAL FIX)
  if (state.view === "grid") {
    DOM.container.className = "grid-container";
  } else {
    DOM.container.className = ""; // Remove class for List view
  }

  // 3. Process & Load Data
  processData(); 
  state.renderedCount = 0;
  loadMore(); 
  
  // 4. Update UI States
  updateHeaderCheckbox();
  DOM.listHeader.style.display = state.view === "list" ? "grid" : "none";
}


function loadMore() {
  if (state.renderedCount >= state.currentData.length) return;

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
}

// ==========================================
// 9. COMPONENT FACTORIES
// ==========================================

function createListRow(app) {
  const id = app.componentNames[0].componentName;
  const name = app.componentNames[0].label;
  const pkg = id.split('/')[0];
  const isSelected = state.selected.has(id);
  const iconUrl = `${CONFIG.data.assetsPath}${app.drawable}${CONFIG.data.iconExtension}`;
  const dateStr = formatDate(app.lastRequested);

  let tagHtml = "";
  if (app.requestCount > CONFIG.ui.wipThreshold) tagHtml = `<span class="status-pill status-wip">WIP</span>`;
  else if (app.requestCount > CONFIG.ui.easyThreshold) tagHtml = `<span class="status-pill status-easy">EASY</span>`;

  const row = document.createElement("div");
  row.className = `list-row ${isSelected ? "selected" : ""}`;
  row.onclick = () => toggleSelection(id);

  row.innerHTML = `
    <div class="check-col">
      <input type="checkbox" ${isSelected ? "checked" : ""} onclick="event.stopPropagation(); toggleSelection('${id}')" />
    </div>
    <div class="icon"><img src="${iconUrl}" loading="lazy" onerror="this.style.opacity=0.2" /></div>
    <div class="name-col">
      <div class="name-row">${tagHtml}<span class="app-name">${name}</span></div>
      <span class="pkg-name">${id}</span>
    </div>
    <div class="col req">${app.requestCount}</div>
    <div class="col install">—</div>
    <div class="col first" style="line-height:1.4"><div>${dateStr}</div></div>
    <div class="actions-col">
      <a class="action-btn" href="${iconUrl}" download>${ICONS.download}</a>
      <a class="action-btn" href="${CONFIG.urls.playStore}${pkg}" target="_blank">${ICONS.play}</a>
      <div class="action-btn ctx-trigger">${ICONS.dots}</div>
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
  card.onclick = () => toggleSelection(id);

  const tag = app.requestCount > CONFIG.ui.wipThreshold ? `<div class="grid-tag">WIP</div>` : "";

  card.innerHTML = `
    <img src="${iconUrl}" loading="lazy" onerror="this.style.display='none'" />
    ${tag}
    <div class="grid-overlay-check">
      <input type="checkbox" ${isSelected ? "checked" : ""} style="pointer-events:none;">
    </div>
  `;
  return card;
}

// ==========================================
// 10. SELECTION LOGIC
// ==========================================

function toggleSelection(id) {
  if (state.selected.has(id)) state.selected.delete(id);
  else state.selected.add(id);
  
  // Efficiently update UI without full re-render
  updateSelectionUI(); 
}

function toggleSelectAll(isChecked) {
  if (isChecked) {
    // Select ALL currently filtered items
    state.currentData.forEach(app => state.selected.add(app.componentNames[0].componentName));
  } else {
    // Deselect ALL currently filtered items
    state.currentData.forEach(app => state.selected.delete(app.componentNames[0].componentName));
  }
  
  // Re-render visible items to show check state
  // (We re-render here to ensure all checkboxes update)
  render(); 
}

function updateSelectionUI() {
  // 1. Update Rows/Cards classes
  // Note: This is a quick DOM patch to avoid full re-render lag
  const elements = DOM.container.children;
  for (let el of elements) {
    const checkbox = el.querySelector('input[type="checkbox"]');
    if (!checkbox) continue; // Skip if grid card without overlay loaded
    
    // Find ID from the onclick handler or data attribute (adding data-id would be cleaner, but we can infer)
    // Let's rely on re-rendering for simplicity if performance is fine, 
    // OR just re-run render() which is safe with 500 items.
  }
  
  // Actually, for 500 items, full render() is fast enough and safer.
  render();
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
    DOM.fabBar.classList.add("visible");
    DOM.fabCount.textContent = `Download ${count} icons`;
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
    <div class="ctx-item" onclick="copyToClipboard('${name}\\n${id}')">
      ${ICONS.copy} <span>Copy name & ID</span>
    </div>
    <div class="ctx-item" onclick="copyAppFilterEntry('${id}')">
      ${ICONS.copy} <span>Copy appfilter</span>
    </div>
  `;

  // 2. Smart Positioning (Prevent clipping)
  const menuWidth = 240;
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
    <div class="ctx-item" onclick="downloadSelected()">
      ${ICONS.download} <span>Download selected</span>
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
  const draw = app.drawable;
  const name = app.componentNames[0].label;
  // Exact format requested
  return `<item component="ComponentInfo{${cmp}}" drawable="${draw}" name="${name}" />`;
}

// Action: Copy Text
function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
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
  
  navigator.clipboard.writeText(xmlOutput).then(() => {
    const original = DOM.fabCount.textContent;
    DOM.fabCount.textContent = "Copied!";
    setTimeout(() => DOM.fabCount.textContent = original, 1500);
  });
  
  closeContextMenu();
}

// Action: Download
async function downloadSelected() {
// 1. Check for JSZip
  if (typeof JSZip === 'undefined') {
    alert("JSZip library is missing. Please include it in your HTML.");
    return;
  }

  const selectedIds = Array.from(state.selected);
  if (selectedIds.length === 0) return;

  // 2. Visual Feedback
  const originalText = DOM.fabCount.textContent;
  DOM.fabCount.textContent = "Preparing...";
  DOM.fabBar.style.cursor = "wait";

  try {
    const zip = new JSZip();
    const imgFolder = zip.folder("icons");
    
    // 3. Process items
    // We use a Set to avoid downloading the same drawable twice if multiple apps share it
    const processedDrawables = new Set();
    const promises = [];

    selectedIds.forEach(id => {
      const app = apps.find(a => a.componentNames[0].componentName === id);
      if (!app || processedDrawables.has(app.drawable)) return;

      processedDrawables.add(app.drawable);
      
      const filename = `${app.drawable}${CONFIG.data.iconExtension}`;
      const url = `${CONFIG.data.assetsPath}${filename}`;

      // Queue the fetch operation
      const promise = fetch(url)
        .then(res => {
          if (!res.ok) throw new Error(`404: ${url}`);
          return res.blob();
        })
        .then(blob => {
          imgFolder.file(filename, blob);
        })
        .catch(err => {
          console.warn(`Failed to load ${filename}`, err);
        });

      promises.push(promise);
    });

    // 4. Wait for all downloads
    DOM.fabCount.textContent = `Fetching ${promises.length} icons...`;
    await Promise.all(promises);

    // 5. Generate Zip
    DOM.fabCount.textContent = "Zipping...";
    const content = await zip.generateAsync({ type: "blob" });

    // 6. Trigger Download
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = `lawnicons-export-${new Date().toISOString().slice(0,10)}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    // Success State
    DOM.fabCount.textContent = "Done!";
  } catch (err) {
    console.error("Download failed:", err);
    DOM.fabCount.textContent = "Error";
    alert("Failed to generate zip. Check console for details.");
  } finally {
    // Reset UI
    DOM.fabBar.style.cursor = "default";
    setTimeout(() => DOM.fabCount.textContent = originalText, 2000);
  }
}

// 3. Mobile Menu Logic (Add to Actions & Logic section)
function showMobileMenu() {
  const isGrid = state.view === "grid";
  
  DOM.mobileMenu.innerHTML = `
    <div class="mobile-menu-section">
      <div class="mobile-menu-label">View Mode</div>
      <div class="mobile-options">
        <button class="mobile-opt-btn ${!isGrid ? 'active' : ''}" onclick="setMobileView('list')">List</button>
        <button class="mobile-opt-btn ${isGrid ? 'active' : ''}" onclick="setMobileView('grid')">Grid</button>
      </div>
    </div>

    <div class="mobile-menu-section">
      <div class="mobile-menu-label">Filter Status</div>
      <div class="mobile-options">
        <button class="mobile-opt-btn" onclick="alert('Filter logic here')">WIP</button>
        <button class="mobile-opt-btn" onclick="alert('Filter logic here')">Easy</button>
        <button class="mobile-opt-btn" onclick="alert('Filter logic here')">Missing</button>
      </div>
    </div>
  `;
  
  DOM.mobileMenu.showPopover();
}

function setMobileView(viewMode) {
  state.view = viewMode;
  DOM.selectView.value = viewMode; // Sync desktop dropdown
  render();
  showMobileMenu(); // Re-render menu to update active state
}