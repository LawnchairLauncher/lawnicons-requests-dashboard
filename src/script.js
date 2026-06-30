// @ts-check

/**
 * LAWNICONS REQUEST MANAGER
 * Pure Vanilla JS with JSDoc
 */

// ==========================================
// 0. TYPES & INTERFACES
// ==========================================

// @ts-ignore - VSCode does not support types from URL imports
/// <reference types="https://cdn.skypack.dev/fflate@0.8.2/lib/index.d.ts" />
const { fflate } = window;


/**
 * @typedef {Object} AppEntry
 * @property {string} drawable
 * @property {string} label
 * @property {string} componentName
 * @property {number} requestCount
 * @property {number} firstAppearance
 * @property {number} lastRequested
 * @property {string} [installs]
 */

/**
 * @typedef {'name' | 'req' | 'odds' | 'install' | 'time'} SortKeys
 */

/**
 * @typedef {Object} FilterMetadata
 * @property {string} label
 * @property {string} [description]
 * 
 */

/**
 * @typedef {Object} Icon
 * @property {string} drawable
 * @property {string} name
 * @property {string} component
 */

/**
 * @typedef {Object} Overrides
 * @property {string} [drawable]
 * @property {string} [label]
 * @property {'link' | 'new'} [mode]
 */

/**
 * @typedef {Object} Issue
 * @property {'nameinuse' | 'nameconflict' | 'emptyfields' | 'invalidsvg' | 'startdigit' | 'unescaped'} id
 * @property {string} label
 */

/**
 * @typedef {Object} CreationOdds
 * @property {number} popularity
 * @property {number} "0.1"
 * @property {number} "0.1_at_pace"
 * @property {number} "1"
 * @property {number} 1_at_pace
 * @property {number} "3"
 * @property {number} 3_at_pace
 * @property {number} "5"]
 * @property {number} "5_at_pace"
 * @property {number} "6"]
 * @property {number} "6_at_pace"
 * @property {number} "8"]
 * @property {number} "8_at_pace"
 */

/**
 * @typedef {Object} CreationStats
 */

/**
 * @typedef {Object} FulfillmentHistory
 * @property {number} firstAppearance - The Unix timestamp (in seconds) when the item first appeared.
 * @property {number} fulfilled - The Unix timestamp (in seconds) when the item was fulfilled.
 * @property {number} popularity - The popularity score or rank of the item.
 * @property {number} label_factor - The weighting or scaling factor applied to the item's label.
 */

/**
 * @typedef {Object} ActivityStats
 * @property {Date} date
 * @property {number} total
 * @property {number} added
 * @property {number} fulfilled
 * @property {number} expired
 */

/**
 * @typedef {Object} ReviewIssues
 * @property {string} drawable
 * @property {string[]} issues
 */

/**
 * @typedef {Object} AppState
 * @property {"list" | "grid"} view - The current display layout mode.
 * @property {string} sort - The current sorting key and direction (e.g., "req-desc").
 * @property {string} search - The current search query string.
 * @property {boolean} regexMode - Whether the search query should be treated as a Regular Expression.
 * @property {Set<string|number>} selected - A set of currently selected item IDs.
 * @property {Map<string, Set<string>>} appTags - A map of application tags.
 * @property {Map<string, FilterMetadata>} filterMetadata - Metadata associated with various filters.
 * @property {Set<string>} activeFilters - A set of currently active filter keys.
 * @property {string|number|null} lastSelectedId - The ID of the last selected item, used for shift-clicks.
 * * // Runtime / Data Cache
 * @property {Map<string|number, AppEntry>} idMap - Fast lookup map pairing item IDs to their full data entries.
 * @property {number} renderedCount - The number of items currently rendered in the DOM.
 * @property {AppEntry[]} currentData - The filtered and sorted list of entries currently on display.
 * @property {Icon[]} existingIcons - Array of currently loaded or available icon objects.
 * * // Actions & Contributions
 * @property {"new" | string} actionMode - The current action state or mode.
 * @property {boolean} lowQualityActive - Toggle state for rendering low-quality or performance-optimized views.
 * @property {boolean} contributionActive - Toggle state indicating if the contribution workflow is active.
 * @property {Array<AppEntry>} contribution - List of pending or current user contributions.
 * @property {Record<string, Overrides>} contributionOverrides - Key-value overrides applied to the contribution layer.
 * @property {Map<string, string>} existingSvgs - Cached SVG strings indexed by their identifier.
 * * // Statistics & Deltas
 * @property {Record<string, any>} setsStats - Statistical data aggregated by specific sets.
 * @property {CreationOdds[]} creationOdds - Odds/probabilities array related to creation metrics.
 * @property {Record<string, any>} domainStats - Aggregated domain-specific metrics.
 * @property {string} domainStatsMode - The current mode for displaying domain stats (e.g., "requests").
 * @property {ActivityStats[]} activityStats - Historical or timeline array tracking application activity.
 * @property {Record<string, number>} trendingDeltas - Numeric delta changes tracking trending items.
 * @property {string|null} lastUpdate - ISO timestamp or string representing the last data refresh.
 * @property {FulfillmentHistory[]|null} _fulfillmentData
 * @property {number} [medianTTF]
 * @property {{[key: string]: number}} [_domainAvgInstalls]
 * @property {string} [activePage]
 * @property {string} [quickPickMode]
 * @property {ReviewIssues[]} [lowQualityData]
 * @property {any[]} [_quickPickEasy]
 * @property {any[]} [_quickPickMiddle]
 * @property {number} [_lastQuickPickIdx]
 */

// ==========================================
// 1. CONFIGURATION
// ==========================================

const CONFIG = {
  data: {
    endpoint: "assets/requests.json",
    setsStatsPath: "assets/stats/sets_stats.json",
    creationOddsPath: "assets/stats/creation_odds.json",
    domainStatsPath: "assets/stats/domain_stats.json",
    activityStatsPath: "assets/stats/activity_stats.json",
    assetsPath: "extracted_png/",
    iconExtension: ".png",
    filterPath: "assets/filters/",
    // Order matters for UI
    filters: ["plan", "wip", "supported", "easy", "nameinuse", "match", "stale", "unlabeled"]
  },
  label_factors: {
    stale: 0.1,
    unlabeled: 1,
    nameinuse: 1,
    easy: 3,
    match: 5,
    supported: 6,
    wip: 8,
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
  check: `<svg><use href="#ic-check"/></svg>`,
  download: `<svg><use href="#ic-download"/></svg>`,
  play: `<svg><use href="#ic-play"/></svg>`,
  dots: `<svg><use href="#ic-dots"/></svg>`,
  copy: `<svg><use href="#ic-copy"/></svg>`,
  fDroid: `<svg><use href="#ic-fdroid"/></svg>`,
  izzyOnDroid: `<svg><use href="#ic-izzyondroid"/></svg>`,
  galaxyStore: `<svg><use href="#ic-galaxystore"/></svg>`,
  regex: `<svg><use href="#ic-regex"/></svg>`,
  downloadImage: `<svg><use href="#ic-download-image"/></svg>`,
};

const DEFAULTS = {
  view: "list",
  sort: "req-desc",
  search: "",
  regex: false
};

// ==========================================
// 2. STATE & DOM
// ==========================================

const App = {
  /** @type {AppEntry[]} */
  data: [],

  /** @type {AppState} */
  state: {
    view: "list",
    sort: "req-desc",
    search: "",
    regexMode: false,
    selected: new Set(),
    appTags: new Map(),
    filterMetadata: new Map(),
    activeFilters: new Set(),
    lastSelectedId: null,

    // Runtime
    idMap: new Map(),
    renderedCount: 0,
    currentData: [],
    existingIcons: [],

    actionMode: "new",
    lowQualityActive: false,
    contributionActive: false,
    contribution: [],
    contributionOverrides: {},
    existingSvgs: new Map(),
    setsStats: {},
    creationOdds: [],
    domainStats: {},
    domainStatsMode: "requests",
    activityStats: [],
    trendingDeltas: {},
    lastUpdate: null,

    _fulfillmentData: null,
  },

  dom: {
    /** @type {HTMLDivElement} */
    container: /** @type {any} */ (document.getElementById("appContainer")),
    /** @type {HTMLDivElement} */
    listHeader: /** @type {any} */ (document.getElementById("listHeader")),
    /** @type {HTMLInputElement} */
    headerCheck: /** @type {any} */ (document.getElementById("headerCheck")),
    /** @type {HTMLDivElement} */
    headerCount: /** @type {any} */ (document.getElementById("headerCount")),
    /** @type {HTMLDivElement} */
    sentinel: /** @type {any} */ (document.getElementById("scrollSentinel")),

    /** @type {HTMLInputElement} */
    inputSearch: /** @type {any} */ (document.getElementById("searchInput")),
    /** @type {HTMLButtonElement} */
    clearBtn: /** @type {any} */ (document.getElementById("clearSearchBtn")),
    /** @type {HTMLButtonElement} */
    regexBtn: /** @type {any} */ (document.getElementById("regexBtn")),

    /** @type {HTMLDivElement} */
    filterBox: /** @type {any} */ (document.getElementById("filterContainer")),

    /** @type {HTMLButtonElement} */
    mobileFilterBtn: /** @type {any} */ (document.getElementById("mobileFilterBtn")),
    /** @type {HTMLSpanElement} */
    mobileFilterCount: /** @type {any} */ (document.getElementById("mobileFilterCount")),
    /** @type {HTMLElement} */
    mobileFilterMenu: /** @type {any} */ (document.getElementById("mobileFilterMenu")),

    /** @type {HTMLDivElement} */
    sbBar: /** @type {any} */ (document.getElementById("selectionBar")),
    /** @type {HTMLDivElement} */
    sbCount: /** @type {any} */ (document.getElementById("sbCount")),
    /** @type {HTMLButtonElement} */
    sbDownloadBtn: /** @type {any} */ (document.getElementById("sbDownloadBtn")),
    /** @type {HTMLButtonElement} */
    sbMenuBtn: /** @type {any} */ (document.getElementById("sbMenuBtn")),
    /** @type {HTMLElement} */
    rowMenu: /** @type {any} */ (document.getElementById("rowMenu")),
    /** @type {HTMLDivElement} */
    toastBox: /** @type {any} */ (document.getElementById("toastContainer")),
    contributionBtn: /** @type {HTMLButtonElement} */ (document.getElementById("contributionBtn")),
    /** @type {HTMLButtonElement} */
    sortBtn: /** @type {any} */ (document.getElementById("sortBtn")),
    /** @type {HTMLButtonElement} */
    viewBtn: /** @type {any} */ (document.getElementById("viewBtn")),
    /** @type {HTMLElement} */
    viewIconList: /** @type {any} */ (document.getElementById("viewIconList")),
    /** @type {HTMLElement} */
    viewIconGrid: /** @type {any} */ (document.getElementById("viewIconGrid")),
    /** @type {HTMLElement} */
    sortMenu: /** @type {any} */ (document.getElementById("sortMenu")),
    /** @type {HTMLSpanElement} */
    sortLabel: /** @type {any} */ (document.getElementById("sortLabel"))
  }
};

// ==========================================
// 3. UTILITIES
// ==========================================
const Utils = {
  /**
   * @param {number} unix
   * @returns {string}
   */
  formatDate(unix) {
    if (!unix) return "—";
    return new Date(unix * 1000).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric"
    });
  },

  /**
   * @param {string} [str]
   * @returns {number}
   */
  parseInstalls(str) {
    if (!str) return -1;
    const clean = str.toString().replace(/[,+]/g, '');
    return parseInt(clean, 10) || 0;
  },

  /**
   * @param {string} label
   * @returns {string}
   */
  sanitizeDrawableName(label) {
    if (!label) return "unknown";
    // If name has ~~, use the right side
    const tildeIdx = label.indexOf("~~");
    if (tildeIdx !== -1) {
      label = label.slice(tildeIdx + 2).trim();
    }
    let name = label.replace(/&amp;/g, " and ").replace(/&/g, " and ");
    name = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    name = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    name = name.replace(/^_+|_+$/g, "");
    if (/^[0-9]/.test(name)) name = "_" + name;
    return name || "icon";
  },

  /**
   * @param {string} rawQuery
   * @returns {{ text: string; tags: Set<string>, isSet: boolean }}
   */
  parseSearchQuery(rawQuery) {
    const result = { text: "", tags: new Set(), isSet: false };
    const tokenRegex = /\b(?:is|tag|in):([a-z0-9-_]+)\b/gi;

    const cleanQuery = rawQuery.replace(tokenRegex, (_, tag) => {
      const lowerTag = tag.toLowerCase();
      if (lowerTag === 'set') {
        result.isSet = true;
        return "";
      }
      // Check if tag exists in config
      if (CONFIG.data.filters.includes(lowerTag)) {
        result.tags.add(lowerTag);
      }
      return "";
    });

    result.text = cleanQuery.trim();
    return result;
  },

  /**
   * @param {AppEntry} app
   * @returns {string}
   */
  generateXml(app) {
    const cmp = app.componentName;
    const name = app.label.replace(/&/g, '&amp;').replace(/"/g, '&quot;'); // Escape for XML
    const draw = Utils.sanitizeDrawableName(app.label);
    return `<item component="ComponentInfo{${cmp}}" drawable="${draw}" name="${name}" />`;
  },

  /**
   * @param {string} id
   * @returns {string[]}
   */
  getTagsForApp(id) {
    /** @type {string[]} */
    const tags = [];
    const appTags = App.state.appTags.get(id);
    if (appTags) {
      CONFIG.data.filters.forEach(fid => {
        if (appTags.has(fid)) tags.push(fid);
      });
    }
    return tags;
  },

  /**
   * @param {string} id
   * @param {Set<string>} s
   */
  mutualExclusiveTags(id, s) {
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
  },

  /**
   * @param {string} dateStr
   * @returns {string}
   */
  timeAgo(dateStr) {
    const now = new Date();
    const then = new Date(dateStr + "T00:00:00");
    const diff = now.getTime() - then.getTime();
    const days = Math.floor(diff / 86400000);
    if (days > 30) {
      return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    if (days === 0) return "Today";
    if (days === 1) return "1d";
    return `${days}d`;
  },

  /**
   * @param {number} num
   * @returns {string}
   */
  compactNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  },

  /**
   * @param {Element | null | undefined} element
   * @param {boolean} hidden
   */
  setHidden(element, hidden) {
    if (!(element instanceof HTMLElement || element instanceof SVGElement)) return;
    element.classList.toggle("is-hidden", hidden);
  },

  /**
   * @param {Event} event
   */
  handleImageError(event) {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) return;

    const errorMode = target.dataset.errorMode;
    if (errorMode === "hide-wrapper") {
      target.closest(".existing-svg-wrapper")?.classList.add("is-hidden");
      return;
    }

    target.classList.add("is-hidden");

    if (errorMode === "show-next-fallback") {
      const fallback = target.nextElementSibling;
      if (fallback instanceof HTMLElement) {
        fallback.classList.remove("is-hidden");
      }
    }
  },
};

// ==========================================
// 4. TEMPLATES
// ==========================================
const Templates = {
  /**
   * @param {AppEntry} app
   * @param {boolean} isSelected
   * @param {string[]} tags
   * @param {string} iconUrl
   * @param {string} firstStr
   * @param {string} lastStr
   * @returns {string}
   */
  listRow(app, isSelected, tags, iconUrl, firstStr, lastStr) {
    const id = app.componentName;
    const name = app.label;
    const pkg = id.split('/')[0];
    const isUnknown = app.drawable === "unknown" || name === "(Unknown App)";
    const existingDrawable = App.state.existingSvgs ? App.state.existingSvgs.get(id) : null;
    const appNameClass = isUnknown ? "app-name is-hidden" : "app-name";

    const tagHtml = tags.map(tagId => {
      const meta = App.state.filterMetadata.get(tagId);
      const label = meta ? meta.label : tagId;
      const desc = meta ? meta.description : "";
      return `<span class="status-pill status-${tagId}" title="${desc}">${label}</span>`;
    }).join("");

    const existingSvgHtml = existingDrawable
      ? `<span class="existing-svg-wrapper">
         <img src="https://raw.githubusercontent.com/LawnchairLauncher/lawnicons/develop/svgs/${existingDrawable}.svg" 
              class="existing-svg" 
              title="${existingDrawable}.svg"
              loading="lazy"
        data-error-mode="hide-wrapper" />
       </span>`
      : "";

    const iconHtml = isUnknown
      ? `<div class="fallback-icon-row">No Icon</div>`
      : `<img src="${iconUrl}" class="requested-icon" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'" alt="${name}" />
         <div class="fallback-icon-row" style="display:none">No Icon</div>`;

    const installsRaw = app.installs ? app.installs.replace(/[,+]/g, '') : null;
    const displayInstalls = installsRaw ? new Intl.NumberFormat('en', { notation: "compact" }).format(parseInt(installsRaw)) + "+" : "—";
    const installsTitle = installsRaw && installsRaw !== '0'
      ? `${app.installs} installs in Play Store`
      : 'Installs data unavailable';
    const rawOdds = Heuristics.calculateCreationOdds(app) * 100;
    const displayOdds = rawOdds < 1 ? rawOdds.toFixed(2) + "%" : rawOdds.toFixed(0) + "%";
    const trendingDelta = App.state.trendingDeltas[app.componentName];
    const reqValue = App.state.setsStats[pkg] || app.requestCount;
    const isSet = App.state.setsStats[pkg] !== undefined;
    const displayReq = isSet
      ? `<span title="Combined requests for this package.">${reqValue.toLocaleString()}S</span>`
      : reqValue.toLocaleString();

    return `
      <div class="list-row ${isSelected ? 'selected' : ''}"
        data-id="${id}"
        tabindex="0" 
        role="row" 
        aria-selected="${isSelected}">
        <div class="check-col">
          <input type="checkbox" ${isSelected ? "checked" : ""} class="row-checkbox" tabindex="-1" />
        </div>
        <div class="icon">${iconHtml}</div>
        <div class="name-col">
          <div class="name-content">
            ${existingSvgHtml}
          <div class="name-details">
              <div class="name-row">
                  ${tagHtml}
                  <span class="${appNameClass}">${name}</span>
              </div>
              <span class="item-sub" title="${id}">ID: ${id}</span>
          </div>
          </div>
        </div>
        <div class="col req">${displayReq}${trendingDelta ? ` <span class="trend-indicator" title="Growth from latest email import.">↑${trendingDelta}</span>` : ""}</div>        <div class="col creation-odds" title="Chance of this request being fulfilled within a year if you wait.">${displayOdds}</div>
        <div class="col install" title="${installsTitle}">${displayInstalls}</div>
        <div class="col first date-col">
          <div>${firstStr}</div>
          <div>Last: ${lastStr}</div>
        </div>
        <div class="actions-col">
          <a class="action-btn" data-action="download-png" data-url="${iconUrl}" data-drawable="${app.drawable}" title="Download PNG"
              tabindex="0" role="button" aria-label="Download">${ICONS.downloadImage}</a>
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

  /**
   * @param {AppEntry} app
   * @param {string[]} tags
   * @param {boolean} isSelected
   * @param {string} iconUrl
   * @returns {string}
   */
  gridCard(app, tags, isSelected, iconUrl) {
    const id = app.componentName;
    const isUnknown = app.drawable === "unknown";

    let contentHtml = "";
    const label = app.label === "(Unknown App)" ? id.split('/')[0] : app.label;

    if (isUnknown) {
      contentHtml = `
        <div class="fallback-icon-grid">
          <div class="fallback-icon-grid-title">No Icon</div>
          <div class="fallback-icon-grid-label">${label}</div>
        </div>
      `;
    } else {
      contentHtml = `<img src="${iconUrl}" loading="lazy" data-error-mode="show-next-fallback" alt="${label}" />
      <div class="fallback-icon-grid is-hidden">No Icon</div>`;
    }

    // Only show WIP tags on grid to avoid clutter
    const tagHtml = tags
      .filter(tagId => tagId === "wip")
      .map(tagId => {
        const meta = App.state.filterMetadata.get(tagId);
        const label = meta ? meta.label : tagId;
        const desc = meta ? meta.description : `Tagged with "${tagId}"`
        return `<span class="status-pill status-${tagId}" title="${desc}">${label}</span>`;
      })
      .join("");

    return `
      <div class="grid-card ${isSelected ? 'selected' : ''}" data-id="${id}" title="${label}"
        tabindex="0" role="checkbox" aria-checked="${isSelected}">
        ${contentHtml}
        <div class="grid-overlay-tags">${tagHtml}</div>
        <div class="grid-overlay-check">
          <input type="checkbox" ${isSelected ? "checked" : ""} tabindex="-1">
        </div>
      </div>
    `;
  },

  /**
   * @param {Icon} icon
   * @returns {string}
   */
  libraryIconCard(icon) {
    const svgUrl = `https://raw.githubusercontent.com/LawnchairLauncher/lawnicons/develop/svgs/${icon.drawable}.svg`;
    return `
          <div class="library-icon-card"
              data-drawable="${icon.drawable}"
              data-component="${icon.component}"
              title="${icon.name}\n${icon.drawable}.svg">
              <img src="${svgUrl}" 
                  alt="${icon.name}" 
                  loading="lazy"
                  onerror="this.parentElement.remove()" />
          </div>
      `;
  },

  /**
   * @param {Icon} icon
   * @returns {string}
   */
  libraryIconMenu(icon) {
    const svgUrl = `https://raw.githubusercontent.com/LawnchairLauncher/lawnicons/develop/svgs/${icon.drawable}.svg`;
    const githubUrl = `https://github.com/LawnchairLauncher/lawnicons/blob/develop/svgs/${icon.drawable}.svg`;
    return `
          <div class="ctx-item" tabindex="0" role="menuitem" data-action="library-download-svg" data-url="${svgUrl}" data-drawable="${icon.drawable}">
              ${ICONS.download} <span>Download SVG</span>
          </div>
          <div class="ctx-item" tabindex="0" role="menuitem" data-action="open-link" data-url="${githubUrl}">
              <svg><use href="#ic-github"/></svg> <span>Open on GitHub</span>
          </div>
          <div class="ctx-divider"></div>
          <div class="ctx-section">Copy</div>
          <div class="ctx-item" tabindex="0" role="menuitem" data-action="library-copy-svg" data-drawable="${icon.drawable}">
              <span>as SVG</span>
          </div>
          <div class="ctx-item" tabindex="0" role="menuitem" data-action="library-copy-name" data-drawable="${icon.drawable}">
              <span>icon name</span>
          </div>
      `;
  },

  /**
   * @returns {string}
   */
  emptyState() {
    return `
      <div class="empty-state">
        <svg><use href="#ic-search"/></svg>
        <h3>No requests found</h3>
        <p>Try adjusting your search or filters.</p>
      </div>
    `;
  },

  /**
   * @param {AppEntry} app
   * @returns {string}
   */
  rowMenu(app) {
    const id = app.componentName;
    const pkg = id.split('/')[0];

    return `
      <div class="ctx-item" tabindex="0" role="menuitem" data-action="open-link" data-url="${CONFIG.urls.fDroid}${pkg}">
        ${ICONS.fDroid} <span>F-Droid</span>
      </div>
      <div class="ctx-item" tabindex="0" role="menuitem" data-action="open-link" data-url="${CONFIG.urls.izzy}${pkg}">
        ${ICONS.izzyOnDroid} <span>IzzyOnDroid</span>
      </div>
      <div class="ctx-item" tabindex="0" role="menuitem" data-action="open-link" data-url="${CONFIG.urls.galaxyStore}${pkg}">
        ${ICONS.galaxyStore} <span>Galaxy Store</span>
      </div>
      <div class="ctx-divider"></div>
      <div class="ctx-section">Copy</div>
      <div class="ctx-item" tabindex="0" role="menuitem" data-action="copy-appfilter-entry" data-id="${id}">
        <span>appfilter.xml</span>
      </div>
      <div class="ctx-item" tabindex="0" role="menuitem" data-action="copy-name-id-entry" data-id="${id}">
        <span>name & app ID</span>
      </div>
      <div class="ctx-item" tabindex="0" role="menuitem" data-action="copy-pkg-entry" data-id="${id}">
        <span>package name</span>
      </div>
      <div class="ctx-item" tabindex="0" role="menuitem" data-action="copy-filter-entry" data-id="${id}">
        <span>as filter entry</span>
      </div>
      </div>
    `;
  },

  /**
   * @param {{ value: string, label: string }[]} options
   * @param {string} activeValue
   * @returns {string}
   */
  sortMenuItems(options, activeValue) {
    return options.map(opt => `
      <div class="ctx-item ${activeValue === opt.value ? 'active' : ''}" tabindex="0" role="menuitemradio" aria-checked="${activeValue === opt.value}" data-action="sort-option" data-value="${opt.value}">
        <span>${opt.label}</span>
      </div>
    `).join("");
  },

  /**
   * @param {AppEntry} app
   * @param {string} iconUrl
   * @returns {string}
   */
  contributionRow(app, iconUrl) {
    const id = app.componentName;
    const overrides = App.state.contributionOverrides[id] || {};
    const name = (overrides.label !== undefined ? overrides.label : app.label).replace(/&/g, '&amp;');
    const pkg = id.split('/')[0];
    const originalDrawable = app.drawable;
    const isUnknown = originalDrawable === "unknown" || name === "(Unknown App)";

    const rawSvg = Utils.sanitizeDrawableName(name);
    const defaultSvg = (rawSvg === 'icon' || rawSvg === 'unknown') ? '' : rawSvg;
    const drawable = overrides.drawable !== undefined ? overrides.drawable : defaultSvg;

    const mode = (overrides.mode === "link") ? "link" : "new";

    const existingIcon = App.state.existingIcons.find(icon => icon.drawable === drawable);
    const existsInLibrary = !!existingIcon;
    const isCustom = overrides.drawable && drawable !== defaultSvg;
    const svgHint = existsInLibrary ? 'Name in use.' : (isCustom ? 'Custom.' : 'Generated from name.');
    const libraryTitle = existingIcon ? `${existingIcon.name}\n${drawable}.svg` : 'Found in Lawnicons.';

    const libraryIconHtml = existsInLibrary
      ? `<span class="library-icon-card" title="${libraryTitle}">
                <img src="https://raw.githubusercontent.com/LawnchairLauncher/lawnicons/develop/svgs/${drawable}.svg" 
                      alt="${drawable}" 
                      loading="lazy"
                      onerror="this.parentElement.remove()" />
            </span>`
      : "";

    const iconHtml = isUnknown
      ? `<div class="fallback-icon-row">No Icon</div>`
      : `<img src="${iconUrl}" class="requested-icon" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'" alt="${name}" />
            <div class="fallback-icon-row" style="display:none">No Icon</div>`;

    return `
          <div class="contribution-row" data-id="${id}">
              <div class="col mode">
              <select class="chip mode-select" data-action="mode-select" data-id="${id}">
                <option value="new" ${mode === 'new' ? 'selected' : ''}>New</option>
                <option value="link" ${mode === 'link' ? 'selected' : ''}>Link</option>
                <option disabled>──────────</option>
                <option value="set-all-new">Set all to new</option>
                <option value="set-all-link">Set all to link</option>
              </select>
              </div>
              <div class="icon">${iconHtml}</div>
              <div class="name-col">
                  <div class="name-details">
                      <div class="name-row">
                          <input type="text" class="contribution-name-input" value="${name}" data-id="${id}" data-field="label" oninput="UI.updateContributionField(this)" title="Icon name" />
                      </div>
                      <span class="item-sub" title="${id}">ID: ${id}</span>
                  </div>
              </div>
              <div class="col svg-name">
                  <input type="text" class="contribution-svg-input" value="${drawable}" data-id="${id}" data-field="drawable" oninput="UI.updateContributionField(this)" title="SVG name" />
                  <span class="item-sub">${svgHint}</span>
              </div>
              <div class="col library-icon">
                  ${libraryIconHtml}
              </div>
              <div class="actions-col">
                  <a class="action-btn" href="https://www.google.com/search?q=%22${pkg}%22" target="_blank" title="Google Search">
                      <svg><use href="#ic-web-search"/></svg>
                  </a>
                  <a class="action-btn" href="${CONFIG.urls.playStore}${pkg}" target="_blank" title="Play Store">
                      ${ICONS.play}
                  </a>
                  <div class="action-btn ctx-trigger" title="More actions" tabindex="0" role="button" aria-label="More actions" aria-haspopup="true">
                      ${ICONS.dots}
                  </div>
              </div>
          </div>
      `;
  },

  /**
   * @param {AppEntry} app
   */
  contributionRowMenu(app) {
    const pkg = app.componentName.split('/')[0];
    return `
          <div class="ctx-item" tabindex="0" role="menuitem" data-action="open-link" data-url="${CONFIG.urls.fDroid}${pkg}">
              ${ICONS.fDroid} <span>F-Droid</span>
          </div>
          <div class="ctx-item" tabindex="0" role="menuitem" data-action="open-link" data-url="${CONFIG.urls.izzy}${pkg}">
              ${ICONS.izzyOnDroid} <span>IzzyOnDroid</span>
          </div>
          <div class="ctx-item" tabindex="0" role="menuitem" data-action="open-link" data-url="${CONFIG.urls.galaxyStore}${pkg}">
              ${ICONS.galaxyStore} <span>Galaxy Store</span>
          </div>
          <div class="ctx-divider"></div>
          <div class="ctx-item" tabindex="0" role="menuitem" data-action="restore-original" data-id="${app.componentName}">
            <span>Restore original</span>
          </div>
          <div class="ctx-item" tabindex="0" role="menuitem" data-action="remove-from-contribution" data-id="${app.componentName}">
              <span>Remove</span>
          </div>
      `;
  },

  /**
   * @param {[string, number, number, number][]} entries
   * @param {number} max
   * @returns {string}
   */
  domainStatsCard(entries, max) {
    return `<div class="card-chart has-bars">
        ${entries.map(([domain, done, requests, total]) => {
      const shortDomain = domain.length > 3 ? domain.slice(0, 3) : domain;
      const doneH = (done / max * 100).toFixed(0);
      const reqH = (requests / max * 100).toFixed(0);
      return `<div class="domain-col" data-action="domain-filter" data-domain="${domain}" data-done="${done}" data-requests="${requests}" data-total="${total}">
            <div class="domain-col-fill domain-col-requests" style="height:${reqH}%"></div>
            <div class="domain-col-fill domain-col-done" style="height:${doneH}%"></div>
            <span class="chart-label">${shortDomain}</span>
          </div>`;
    }).join("")}
      </div>
      <div class="chart-tooltip"></div>`;
  },

  /**
   * @param {string} domain
   * @param {number} done
   * @param {number} requests
   * @param {number} total
   * @param {string} mode
   * @param {number} extraValue
   * @param {number} population
   * @returns {string}
   */
  domainStatsTooltip(domain, done, requests, total, mode, extraValue, population) {
    const pct = total ? (done / total * 100).toFixed(1) : 0;
    let extra = "";
    if (mode === "local" && extraValue && population > 0) {
      const pctLocals = (extraValue / 1_000_000 / population * 100).toFixed(1);
      extra = `<div class="tooltip-value">Affects ${pctLocals}% locals</div>`;
    } else if (mode === "coverage") {
      extra = `<div class="tooltip-value">${((requests / total) * 100).toFixed(1)}% uncovered</div>`;
    }
    return `<div class="tooltip-label">${domain}</div>
        <div class="tooltip-value">${requests} requests</div>
        <div class="tooltip-value">${done} done (${pct}%)</div>${extra}`;
  },

  /**
   * @param {string} pathResolved
   * @param {string} addedDots
   * @param {string} dayLabels
   * @returns {string}
   */
  activityCard(pathResolved, addedDots, dayLabels) {
    return `<div class="card-chart activity-card-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="activity-svg">
        <line x1="0" y1="100" x2="100" y2="100" class="activity-zero" />
        <path d="${pathResolved}" class="activity-line activity-removed" />
      </svg>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="activity-dots-svg">
        ${addedDots}
      </svg>
      <div class="activity-days">${dayLabels}</div>
    </div>
    <div class="chart-tooltip"></div>`;
  },


  /**
   * @returns {string}
   */
  activityCardEmpty() {
    return `<div class="card-chart card-chart-empty">Collecting data…</div>`;
  },

  /**
   * @param {string} formattedDate
   * @param {number} added
   * @param {number} fulfilled
   * @returns {string}
   */
  activityTooltip(formattedDate, added, fulfilled) {
    let html = `<div class="tooltip-label">${formattedDate}</div>`;
    if (added > 0) html += `<div class="tooltip-value tooltip-value-primary">${added} new</div>`;
    if (fulfilled > 0) html += `<div class="tooltip-value tooltip-value-resolved">${fulfilled} fulfilled</div>`;
    return html;
  },

  /**
   * @param {string} id
   * @param {string} label
   * @param {boolean} isActive
   * @returns {string}
   */
  mobileFilterItem(id, label, isActive) {
    return `
      <div class="ctx-item ${isActive ? 'active' : ''}" data-action="mobile-filter-toggle" data-filter-id="${id}" tabindex="0" role="menuitemcheckbox" aria-checked="${isActive}">
        <span class="check-icon">${ICONS.check}</span>
        <span>${label}</span>
      </div>
    `;
  },

  /**
   * @returns {string}
   */
  selectionBarMenu() {
    return `
      <div class="ctx-item" role="menuitem" tabindex="0" data-action="sb-download-metadata">
        ${ICONS.download}<span>Download metadata</span>
      </div>
      <div class="ctx-divider"></div>
      <div class="ctx-section">Copy</div>
      <div class="ctx-item" role="menuitem" tabindex="0" data-action="sb-copy-appfilter">
        <span>appfilter.xml</span>
      </div>
      <div class="ctx-item" role="menuitem" tabindex="0" data-action="sb-copy-nameid">
        <span>names and app IDs</span>
      </div>
      <div class="ctx-item" role="menuitem" tabindex="0" data-action="sb-copy-pkgs">
        <span>package names</span>
      </div>
      <div class="ctx-item" role="menuitem" tabindex="0" data-action="sb-copy-filter-entries">
        <span>as filter entry</span>
      </div>
    `;
  },

  /**
   * @param {string[]} matches
   * @returns {string}
   */
  regexAutocompleteList(matches) {
    return matches.map(domain => `
      <div class="autocomplete-item" tabindex="0" role="option" data-action="regex-suggestion" data-value="^${domain}\\.">^${domain}\\.</div>
    `).join("");
  },

  /**
   * @param {string} text
   * @param {string} icon
   * @returns {string}
   */
  toast(text, icon) {
    return `
      <div class="toast-icon">${icon}</div>
      <div class="toast-text">${text}</div>
    `;
  }
};

const Components = {
  Toast: {
    /** @type {Set<string>} */
    activeToasts: new Set(),

    /**
     * @param {string} text
     * @param {"info" | "success" | "error"} [type]
     */
    show(text, type = "info") {
      const key = `${text}-${type}`;
      if (this.activeToasts.has(key)) return;

      if (App.dom.toastBox.children.length >= 3) {
        const first = App.dom.toastBox.firstElementChild;
        if (first) this.remove(/** @type {HTMLElement} */(first));
      }

      const el = document.createElement("div");
      el.className = `toast toast-${type}`;
      el.dataset.key = key;
      this.activeToasts.add(key);

      let iconSvg = "";
      if (type === "error") iconSvg = `<svg><use href="#ic-error"/></svg>`;
      if (type === "success") iconSvg = `<svg><use href="#ic-download"/></svg>`;

      el.innerHTML = `${iconSvg} ${text}`;
      App.dom.toastBox.appendChild(el);

      setTimeout(() => this.remove(el), 2500);
    },

    /**
     * @param {HTMLElement} el
     */
    remove(el) {
      if (el.classList.contains("hiding")) return;
      if (el.dataset.key) this.activeToasts.delete(el.dataset.key);
      el.classList.add("hiding");
      el.addEventListener("animationend", () => el.remove());
    }
  },
}


// ==========================================
// 6. ACTIONS
// ==========================================
const Actions = {
  /**
   * @param {string} id
   * @param {MouseEvent | KeyboardEvent | null} [event]
   */
  toggleSelection(id, event = null) {
    const s = App.state;
    const currentData = s.currentData;
    const selected = s.selected;

    // 1. Handle Shift-Click Range Selection
    if (event?.shiftKey && s.lastSelectedId) {
      const lastIdx = currentData.findIndex(a => a.componentName === s.lastSelectedId);
      const currentIdx = currentData.findIndex(a => a.componentName === id);

      if (lastIdx !== -1 && currentIdx !== -1) {
      // Remove browser text selection side-effect
        window.getSelection()?.removeAllRanges();

        const start = Math.min(lastIdx, currentIdx);
        const end = Math.max(lastIdx, currentIdx);
        const range = currentData.slice(start, end + 1);

        range.forEach(app => {
          selected.add(app.componentName);
          UI.updateItemVisuals(app.componentName);
        });

        UI.updateHeader();
        return;
      }
    }

    // 2. Standard Toggle Logic
    if (selected.has(id)) {
      selected.delete(id);
    } else {
      selected.add(id);
    }

    s.lastSelectedId = id;

    // 3. Update Visuals
    UI.updateItemVisuals(id);
    UI.updateHeader();
    UI.updateSelectionBar();
  },

  /**
   * @param {boolean} isChecked
   */
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

  /**
   * @param {SortKeys} key
   */
  toggleSortHeader(key) {
    const current = App.state.sort;
    const [currKey, currDir] = current.split('-');

    const defaults = {
      name: 'asc',
      req: 'desc',
      odds: 'desc',
      install: 'desc',
      time: 'desc'
    };

    let nextSort = "";
    if (currKey === key) {
      nextSort = `${key}-${currDir === 'asc' ? 'desc' : 'asc'}`;
    } else {
      nextSort = `${key}-${defaults[key]}`;
    }

    App.state.sort = nextSort;
    const opt = UI.sortOptions.find(o => o.value === nextSort);
    App.dom.sortLabel.textContent = opt ? opt.label : nextSort;
    UI.render();
  },

  clearAllSelections() {
    if (App.state.selected.size === 0) return;
    document.querySelectorAll(".list-row.selected, .grid-card.selected").forEach(el => {
      el.classList.remove("selected");
      /** @type {HTMLInputElement | null} */
      const cb = el.querySelector("input[type='checkbox']");
      if (cb) cb.checked = false;
    });
    App.state.selected.clear();
    App.state.lastSelectedId = null;
    UI.updateHeader();
    UI.updateSelectionBar();
  },

  closeSbMenu() {
    document.getElementById("sbMenu")?.hidePopover();
  },

  /**
   * @param {string[] | null} ids
   */
  generateNamesAndIDs(ids = null) {
    const apps = ids
      ? ids.map(id => App.state.idMap.get(id)).filter(Boolean)
      : App.data.filter(a => App.state.selected.has(a.componentName));
    return apps.map(app => `${app?.label}\n${app?.componentName}`).join("\n\n");
  },

  /**
 * @param {string[] | null} ids
 */
  copyNamesAndIDs(ids = null) {
    Actions.copyToClipboard(Actions.generateNamesAndIDs(ids));
  },

  /**
   * @param {string} id
   */
  copyPkgName(id) {
    const app = App.state.idMap.get(id);
    if (!app) return;
    Actions.copyToClipboard(app.componentName.split('/')[0]);
  },

  copySelectedPkgs() {
    const pkgs = [...App.state.selected]
      .map(id => App.state.idMap.get(id))
      .filter(Boolean)
      .map(app => app?.componentName.split('/')[0]);
    Actions.copyToClipboard([...new Set(pkgs)].join("\n"));
    Actions.closeSbMenu();
  },

  /**
   * @param {string} id
   */
  copyFilterEntry(id) {
    Actions.copyToClipboard(`"${id}",`);
  },

  /**
   * @param {string} text
   */
  copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(_ => {
      Components.Toast.show("Copied!");
      UI.closeContextMenu();
    });
  },

  /**
   * @param {string} id
   */
  copyAppFilterEntry(id) {
    Actions.copyToClipboard(Actions.generateAppFilterXml([id]));
  },

  /**
   * @param {string[] | null} ids
   */
  generateAppFilterXml(ids = null) {
    const apps = ids
      ? /** @type {AppEntry[]} */ (ids.map(id => App.state.idMap.get(id)).filter(Boolean))
      : App.data.filter(a => App.state.selected.has(a.componentName));
    let xml = "<resources>\n";
    apps.forEach(app => {
      xml += `    ${Utils.generateXml(app)}\n`;
    });
    xml += "</resources>";
    return xml;
  },

  copyAppFilter() {
    Actions.copyToClipboard(Actions.generateAppFilterXml());
  },

  async downloadBundle() {
    if (typeof fflate === 'undefined') {
      Components.Toast.show("fflate library missing", "error");
      return;
    }

    const selectedApps = App.data.filter(a => App.state.selected.has(a.componentName));
    if (selectedApps.length === 0) return;

    selectedApps.sort((a, b) => a.label.localeCompare(b.label));

    // UI Feedback
    const originalText = App.dom.sbDownloadBtn.innerHTML;
    App.dom.sbDownloadBtn.textContent = "Processing...";
    document.body.style.cursor = "wait";

    try {
      const mode = App.state.actionMode; // "new" | "link"

      // fflate uses a simple object mapping paths to Uint8Arrays/Strings
      /** @type {Object.<string, Uint8Array | string | Object>} */
      const zipData = {};

      // Only include icons folder in "new" mode
      if (mode === "new") {
        zipData["_icons"] = {};
      }

      let xmlAppFilter = "<resources>\n";
      let txtCommands = "";

      /**
       * Tracks drawable names globally to prevent file overwrites (e.g. app.svg, app_2.svg)
       * @type {Set<string>}
       */
      const usedDrawables = new Set();

      /**
       * Maps a specific App Identity (Label + Package) to a Drawable.
       *
       * This ensures if we have "App (com.a/Act1)" and "App (com.a/Act2)", they both get "app.svg"
       * @type {Map<string, string>}
       */
      const assignedDrawables = new Map();

      /** @type {Promise<void>[]} */
      const fetchPromises = [];

      // --- LOOP ---
      selectedApps.forEach(app => {
        const cmp = app.componentName;
        const pkg = cmp.split('/')[0];
        const label = app.label.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        const cmdLabel = app.label.replace(/&/g, '&amp;').replace(/'/g, "'\\''");

        // Resolve Drawable Name
        const appIdentity = app.componentName;
        let drawable = "";

        if (assignedDrawables.has(appIdentity)) {
          drawable = assignedDrawables.get(appIdentity) ?? "";
        } else {
          drawable = Utils.sanitizeDrawableName(app.label);

          // Handle collision with DIFFERENT apps
          if (usedDrawables.has(drawable)) {
            let c = 2;
            while (usedDrawables.has(`${drawable}_${c}`)) c++;
            drawable = `${drawable}_${c}`;
          }

          usedDrawables.add(drawable);
          assignedDrawables.set(appIdentity, drawable);
        }

        // Appfilter entry
        xmlAppFilter += `    <item component="ComponentInfo{${cmp}}" drawable="${drawable}" name="${label}" />\n`;

        // Commands
        const cmdType = "link";
        const svgPath = `"${drawable}.svg"`;
        txtCommands += `python3 ./icontool.py ${cmdType} ${svgPath} ${cmp} '${cmdLabel}'\n`;

        const drawablePng = `${drawable}.png`

        // Queue Icon Fetch (only in "new" mode)
        if (mode === "new" && !zipData._icons[drawablePng]) {
          const url = `${CONFIG.data.assetsPath}${app.drawable}${CONFIG.data.iconExtension}`;
          const p = fetch(url)
            .then(r => r.ok ? r.arrayBuffer() : null)
            .then(buf => {
              if (buf) zipData._icons[drawablePng] = new Uint8Array(buf);
            })
            .catch(() => { });
          fetchPromises.push(p);
        }
      });

      // --- FINALIZE OUTPUTS ---
      App.dom.sbDownloadBtn.textContent = "Fetching...";
      await Promise.all(fetchPromises);

      // 1. XML
      xmlAppFilter += "</resources>";
      zipData["appfilter.xml"] = fflate.strToU8(xmlAppFilter);

      // 2. Config
      const filterConfig = {
        "label": "Selection",
        "description": "Sample description",
        "selection": selectedApps.map(a => a.componentName)
      };
      zipData["filter_config.json"] = fflate.strToU8(JSON.stringify(filterConfig, null, 2));

      // 3. Commands
      if (txtCommands) {
        const instructions = [
          "1. Open your Lawnicons repository folder.",
          "2. Copy your SVGs to the svgs folder.",
          "3. Run the commands below from the repository root in your terminal.",
          "",
          "Make sure your branch is up-to-date. If not and you are familiar with git, use:",
          "  git reset --hard upstream/develop",
          "",
          "If sorting is needed:",
          "  python3 ./icontool.py sort",
          "",
          "Commands:",
        ].join("\n");
        txtCommands = instructions + "\n" + txtCommands;
        zipData["icontool_commands.txt"] = fflate.strToU8(txtCommands);
      }

      // 4. Zip & Download
      App.dom.sbDownloadBtn.textContent = "Zipping...";
      const content = fflate.zipSync(zipData, { level: 6 });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([content], { type: 'application/zip' }));
      const date = new Date().toISOString().slice(5, 10); // MM-DD
      const name = mode === "new" ? `lawnicons-add-icons-${date}` : `lawnicons-link-app-ids-${date}`;
      link.download = `${name}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

    } catch (e) {
      console.error(e);
      Components.Toast.show("Failed to generate zip", "error");
    } finally {
      document.body.style.cursor = "default";
      App.dom.sbDownloadBtn.innerHTML = ICONS.download;
    }
  },

  async downloadContributionBundle() {
    if (typeof fflate === 'undefined') {
      Components.Toast.show("fflate library missing", "error");
      return;
    }

    const list = App.state.contribution;
    if (list.length === 0) return;

    /** @type {Object.<string, Uint8Array | string>} */
    const zipData = {};
    let xmlAppFilter = "<resources>\n";
    let txtCommands = "";

    const usedDrawables = new Set();

    /** @type {Promise<void>[]} */
    const fetchPromises = [];

    // Sort by label from inputs
    const sorted = [...list].sort((a, b) => {
      const rowA = document.querySelector(`.contribution-row[data-id="${a.componentName}"]`);
      const rowB = document.querySelector(`.contribution-row[data-id="${b.componentName}"]`);
      const nameA = (/** @type {HTMLInputElement} */ (rowA?.querySelector(".contribution-name-input")))?.value || a.label;
      const nameB = (/** @type {HTMLInputElement} */ (rowB?.querySelector(".contribution-name-input")))?.value || b.label;
      return nameA.localeCompare(nameB);
    });

    sorted.forEach(app => {
      const row = document.querySelector(`.contribution-row[data-id="${app.componentName}"]`);
      const nameInput = /** @type {HTMLInputElement} */ (row?.querySelector(".contribution-name-input"));
      const svgInput = /** @type {HTMLInputElement} */ (row?.querySelector(".contribution-svg-input"));

      const label = nameInput?.value || app.label;
      const drawable = svgInput?.value || app.drawable;
      const mode = (App.state.contributionOverrides[app.componentName]?.mode === "link") ? "link" : "new";

      let uniqueDrawable = drawable;
      let c = 2;
      while (usedDrawables.has(uniqueDrawable)) {
        uniqueDrawable = `${drawable}_${c}`;
        c++;
      }
      usedDrawables.add(uniqueDrawable);

      xmlAppFilter += `    <item component="ComponentInfo{${app.componentName}}" drawable="${uniqueDrawable}" name="${label.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" />\n`;

      const cmdType = "link";
      const svgPath = `"${drawable}.svg"`;
      const cmdLabel = label.replace(/&/g, '&amp;').replace(/'/g, "'\\''");
      txtCommands += `python3 ./icontool.py ${cmdType} ${svgPath} ${app.componentName} '${cmdLabel}'\n`;

      if (mode === "new") {
        if (!zipData["_icons"]) zipData["_icons"] = {};
        const url = `${CONFIG.data.assetsPath}${app.drawable}${CONFIG.data.iconExtension}`;
        const p = fetch(url)
          .then(r => r.ok ? r.arrayBuffer() : null)
          .then(buf => {
            if (buf) zipData["_icons"][`${uniqueDrawable}.png`] = new Uint8Array(buf);
          })
          .catch(() => { });
        fetchPromises.push(p);
      }
    });

    xmlAppFilter += "</resources>";
    zipData["appfilter.xml"] = fflate.strToU8(xmlAppFilter);

    if (txtCommands) {
      const instructions = [
        "1. Open your Lawnicons repository folder.",
        "2. Copy your SVGs to the svgs folder.",
        "3. Run the commands below from the repository root in your terminal.",
        "",
        "Make sure your branch is up-to-date. If not and you are familiar with git, use:",
        "  git reset --hard upstream/develop",
        "",
        "If sorting is needed:",
        "  python3 ./icontool.py sort",
        "",
        "Commands:",
      ].join("\n");
      txtCommands = instructions + "\n" + txtCommands;
      zipData["icontool_commands.txt"] = fflate.strToU8(txtCommands);
    }

    await Promise.all(fetchPromises);
    const content = fflate.zipSync(zipData, { level: 6 });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type: 'application/zip' }));
    const date = new Date().toISOString().slice(5, 10);
    link.download = `lawnicons-contribution-${date}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  },

};

// ==========================================
// 7. DATA PROCESSING
// ==========================================
const Data = {
  /**
   * Entry point for application bootstrap.
   */
  async init() {
    try {
      const [json, setsStats, creationOdds, domainStats, activityStats, ...filterObjects] = await Promise.all([
        this._fetch(CONFIG.data.endpoint),
        this._fetch(CONFIG.data.setsStatsPath, {}),
        this._fetch(CONFIG.data.creationOddsPath, []),
        this._fetch(CONFIG.data.domainStatsPath, {}),
        this._fetch(CONFIG.data.activityStatsPath, []),
        ...CONFIG.data.filters.map(id => this.fetchFilterData(id))
      ]);

      App.data = json.apps;
      App.state.setsStats = setsStats;
      App.state.creationOdds = creationOdds;
      App.state.domainStats = domainStats;
      App.state.activityStats = activityStats;
      App.state.lastUpdate = json.lastUpdate;

      App.state.idMap = new Map(App.data.map(app => [app.componentName, app]));
      this.processFilters(filterObjects);

      await Promise.all([
        this.processEnrichment(),
        this.processLowQualityData(),
        this.processAppFilter()
      ]);

      this.loadUrlState();
      UI.init();
      UI.updateLowQualityBadge();
      UI.buildQuickPickQueue();
      UI.renderQuickPick();

      // If we entered with a search or contribution plan, trigger the specific views
      if (App.state.search && App.state.existingIcons.length > 0) UI.renderIconLibrary();
      if (App.state.contributionActive && App.state.existingIcons.length > 0) UI.renderContributionMode();

    } catch (e) {
      console.error("Critical Boot Error:", e);
      Components.Toast.show("Failed to load application data.", "error");
    }
  },

  /**
   * DRY fetch helper with default fallbacks
   * @param {string} url
   * @param {Object | Array<string> | null} fallback 
   */
  async _fetch(url, fallback = null) {
    try {
      const res = await fetch(url);
      if (!res.ok) return fallback;
      return await res.json();
    } catch {
      return fallback;
    }
  },

  /**
   * Logic for building app tags and metadata from filter files.
   * @param {Array<FilterMetadata>} filterObjects
   */
  processFilters(filterObjects) {
    App.state.appTags = new Map();
    App.state.filterMetadata = new Map();

    // Default system tag
    App.state.filterMetadata.set("plan", {
      label: "Plan",
      description: "Requests added to your contribution plan."
    });

    filterObjects.forEach((obj, index) => {
      if (!obj) return;
      const id = CONFIG.data.filters[index];

      App.state.filterMetadata.set(id, {
        label: obj.label,
        description: obj.description
      });

      if (id === "unlabeled") {
        this.computeUnlabeled(id);
      } else {
        /** @type {Record<string, any>} */
        const dynamicObj = obj;

        if (dynamicObj[id] && Array.isArray(dynamicObj[id])) {
          dynamicObj[id].forEach(item => {
          const appId = typeof item === 'string' ? item : item.id;
          this.addTag(appId, id);

          // Map existing SVG links if metadata exists
          if (typeof item === 'object' && item.existing_drawable) {
            if (!App.state.existingSvgs) App.state.existingSvgs = new Map();
            App.state.existingSvgs.set(appId, item.existing_drawable);
          }
        });
        }
      }
    });
  },

  /**
   * Derived statistical enrichment: Median TTF and Trending Deltas.
   */
  async processEnrichment() {
    /** @type {[FulfillmentHistory[], BaselineDataType|null]} */
    const [history, baseline] = await Promise.all([
      this._fetch("assets/stats/fulfillment_history.json", []),
      this._fetch("assets/stats/trending_baseline.json", null)
    ]);

    // Calculate Median Time To Fulfillment (TTF)
    if (history.length >= 3) {
      App.state._fulfillmentData = history;
      const ttfs = history.map(h => (h.fulfilled - h.firstAppearance) / 86400);
      ttfs.sort((a, b) => a - b);
      App.state.medianTTF = Math.round(ttfs[Math.floor(ttfs.length / 2)]);
    }

    // Calculate Trending (Growth Deltas)
    if (baseline?.period_start && baseline?.period_end) {
      const start = baseline.period_start.snapshot || {};
      const end = baseline.period_end.snapshot || {};
      App.state.trendingDeltas = {};

      for (const [comp, endCount] of Object.entries(end)) {
        const delta = endCount - (start[comp] || 0);
        if (delta > 0) App.state.trendingDeltas[comp] = delta;
      }
    }
  },

  /**
   * Logic for existing icon library via appfilter.xml
   */
  async processAppFilter() {
    try {
      const res = await fetch("assets/appfilter.xml");
      if (!res.ok) throw new Error();
      const xmlText = await res.text();

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");
      const items = xmlDoc.querySelectorAll("item");

      App.state.existingIcons = Array.from(items).map(item => {
        const component = item.getAttribute("component") || "";
        const match = component.match(/ComponentInfo\{([^}]+)\}/);
        return {
          drawable: item.getAttribute("drawable") || "",
          name: item.getAttribute("name") || "",
          component: match ? match[1] : component
        };
      }).filter(icon => icon.drawable && icon.component);

    } catch {
      App.state.existingIcons = [];
    }
  },

  /**
   * Loads issues for existing icons
   */
  async processLowQualityData() {
    App.state.lowQualityData = await this._fetch("assets/qa_issues/review_issues.json", []);
  },

  /**
   * @param {string} id
   * @returns {Promise<any>}
   */
  async fetchFilterData(id) {
    if (id === "unlabeled") {
      return {
        label: "Unlabeled",
        description: "Requests with medium to high complexity.",
        unlabeled: []
      };
    }
    try {
      const res = await fetch(`${CONFIG.data.filterPath}${id}.json`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  /**
   * @param {string} tagId
   */
  computeUnlabeled(tagId) {
    App.data.forEach(app => {
      const id = app.componentName;
      const existingTags = App.state.appTags.get(id);
      if (!existingTags || existingTags.size === 0) {
        this.addTag(id, tagId);
      }
    });
  },

  /**
   * @param {string} id
   * @param {string} tag
   */
  addTag(id, tag) {
    let tags = App.state.appTags.get(id);

    if (!tags) {
      tags = new Set();
      App.state.appTags.set(id, tags);
    }

    tags.add(tag);
  },

  process() {
    const s = App.state;
    let data = App.data;

    const query = Utils.parseSearchQuery(s.search);
    const activeFilters = new Set([...s.activeFilters, ...query.tags]);

    const filterTags = [...activeFilters]
    if (activeFilters.size > 0) {
      data = data.filter(app => {
        const tags = s.appTags.get(app.componentName);
        if (!tags) return false;
        return filterTags.every(tagId => tags.has(tagId));
      });
    }

    // Only show apps that are part of a multi-package set
    if (query.isSet) {
      data = data.filter(app => {
        const pkg = app.componentName.split('/')[0];
        return s.setsStats[pkg] !== undefined;
      });
    }

    // Balanced Filter (Specific to the "Balanced" sort mode threshold)
    if (s.sort === "balanced") {
      data = data.filter(app =>
        app.requestCount >= Heuristics.BALANCED_MIN_REQUESTS &&
        Utils.parseInstalls(app.installs) >= Heuristics.BALANCED_MIN_INSTALLS
      );
    }

    if (query.text) {
      data = this._applySearch(data, query.text, s.regexMode);
    }

    App.state.currentData = this._applySort(data, s.sort);
  },

  /**
   * Internal search engine
   * @param {AppEntry[]} data
   * @param {string} text
   * @param {boolean} isRegex
   * @returns {AppEntry[]}
   */
  _applySearch(data, text, isRegex) {
    if (isRegex) {
      try {
        const regex = new RegExp(text, 'i');
        return data.filter(a => regex.test(a.label) || regex.test(a.componentName));
      } catch {
        return [];
      }
    }

    const term = text.toLowerCase();
    return data.filter(a =>
      a.label.toLowerCase().includes(term) ||
      a.componentName.toLowerCase().includes(term)
    );
  },

  /**
   * Internal sorting engine
   * @param {AppEntry[]} data
   * @param {string} sortKey
   * @returns {AppEntry[]}
   */
  _applySort(data, sortKey) {
    if (sortKey === "rand") {
      const shuffled = [...data];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }

    const pkgCache = new Map();
    for (const item of data) {
      if (!pkgCache.has(item.componentName)) {
        pkgCache.set(item.componentName, item.componentName.split('/')[0]);
      }
    }

    const sorter = this._getSorter(sortKey, pkgCache);
    if (!sorter) {
      return [...data]; 
    } 

    // @ts-ignore
    return [...data].sort(sorter);
  },

  /**
   * Returns a compare function based on the sortKey
   * @param {string} sortKey
   * @param {Map<string, string>} pkgCache
   * @returns {(a: AppEntry, b: AppEntry) => number | null}
   */
  _getSorter(sortKey, pkgCache) {
    const s = App.state;

    /**
     * Helper to get normalized popularity (Set count or App count)
     * @type {(app: AppEntry) => number}
     */
    const getPop = (app) => {
      const pkg = pkgCache.get(app.componentName) ?? "";
      return s.setsStats[pkg] || app.requestCount;
    };

    /**
     *  Shared secondary sort using the precomputed cache
     * @type {(a: AppEntry, b: AppEntry) => number}
     */
    const secondary = (a, b) => {
      const pkgA = pkgCache.get(a.componentName) ?? "";
      const pkgB = pkgCache.get(b.componentName) ?? "";
      return pkgA.localeCompare(pkgB);
    };

    /** * @type {Record<string, (a: AppEntry, b: AppEntry) => number>} */
    const sorters = {

      "req-desc": (a, b) => getPop(b) - getPop(a) || secondary(a, b),
      "req-asc": (a, b) => getPop(a) - getPop(b) || secondary(a, b),
      "trending": (a, b) => {
        const deltaA = s.trendingDeltas[a.componentName] || 0;
        const deltaB = s.trendingDeltas[b.componentName] || 0;
        return deltaB - deltaA || getPop(b) - getPop(a);
      },
      "odds-desc": (a, b) => Heuristics.calculateCreationOdds(b) - Heuristics.calculateCreationOdds(a) || getPop(b) - getPop(a),
      "odds-asc": (a, b) => Heuristics.calculateCreationOdds(a) - Heuristics.calculateCreationOdds(b) || getPop(b) - getPop(a),
      "install-desc": (a, b) => Utils.parseInstalls(b.installs) - Utils.parseInstalls(a.installs) || getPop(b) - getPop(a) || secondary(a, b),
      "install-asc": (a, b) => Utils.parseInstalls(a.installs) - Utils.parseInstalls(b.installs) || getPop(b) - getPop(a) || secondary(a, b),
      "name-asc": (a, b) => a.label.localeCompare(b.label) || getPop(b) - getPop(a),
      "name-desc": (a, b) => b.label.localeCompare(a.label) || getPop(b) - getPop(a),
      "time-desc": (a, b) => b.firstAppearance - a.firstAppearance || getPop(b) - getPop(a),
      "time-asc": (a, b) => a.firstAppearance - b.firstAppearance || getPop(b) - getPop(a),
      "balanced": (a, b) => Heuristics.calculateBalancedScore(b) - Heuristics.calculateBalancedScore(a) || getPop(b) - getPop(a)
    };

    return sorters[sortKey] || null;
  },

  loadUrlState() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("q")) {
      App.state.search = params.get("q") || "";
      App.dom.inputSearch.value = App.state.search;
      Utils.setHidden(App.dom.clearBtn, !App.state.search);
    }
    if (params.has("view")) {
      const v = params.get("view");
      if (v === "list" || v === "grid") App.state.view = v;
    }
    if (params.has("sort")) {
      App.state.sort = params.get("sort") || DEFAULTS.sort;
      const opt = UI.sortOptions.find(o => o.value === App.state.sort);
      App.dom.sortLabel.textContent = opt ? opt.label : App.state.sort;
    }
    if (params.has("regex")) {
      App.state.regexMode = true;
      App.dom.regexBtn.classList.add("active");
    }
    if (params.has("filters")) {
      params.get("filters")?.split(",").forEach(t => {
        if (CONFIG.data.filters.includes(t)) App.state.activeFilters.add(t);
      });
    }

    if (params.has("page")) {
      const page = params.get("page");
      if (page === "low-quality-icons") {
        App.state.lowQualityActive = true;
      } else if (page === "contribution-plan") {
        App.state.contributionActive = true;
      }
    }

  },

  syncUrlState() {
    const s = App.state;
    const params = new URLSearchParams(window.location.search);

    if (s.search) params.set("q", s.search); else params.delete("q");
    if (s.view !== DEFAULTS.view) params.set("view", s.view); else params.delete("view");
    if (s.sort !== DEFAULTS.sort) params.set("sort", s.sort); else params.delete("sort");
    if (s.regexMode) params.set("regex", "1"); else params.delete("regex");

    if (s.activeFilters.size > 0) {
      const sortedFilters = Array.from(s.activeFilters).sort();
      params.set("filters", sortedFilters.join(","));
    } else {
      params.delete("filters");
    }

    if (App.state.lowQualityActive) {
      params.set("page", "low-quality-icons");
    } else if (App.state.contributionActive) {
      params.set("page", "contribution-plan");
    } else {
      params.delete("page");
    }

    const queryString = params.toString();
    const newUrl = queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;

    if (newUrl !== window.location.pathname + window.location.search) {
      window.history.replaceState({}, "", newUrl);
    }
  }
};

// ==========================================
// 8. HEURISTICS
// Pure mathematical formulas for ranking and probability.
// ==========================================
const Heuristics = {
  BALANCED_MIN_REQUESTS: 4,
  BALANCED_MIN_INSTALLS: 500000,

  /** @param {AppEntry} app */
  calculateCreationOdds(app) {
    const table = App.state.creationOdds;
    if (!table || table.length === 0) return 0;

    const pkg = app.componentName.split('/')[0];
    const pop = App.state.setsStats[pkg] || app.requestCount;
    const row = table.find(r => r.popularity === pop);
    if (!row) return 0;

    const tags = Utils.getTagsForApp(app.componentName);
    let factor = null;
    for (const tag of tags) {
      const f = CONFIG.label_factors[tag];
      if (f !== undefined && (factor === null || f > factor)) factor = f;
    }
    if (factor === null) factor = 1;

    const key = App.state.medianTTF !== undefined ? factor + "_at_pace" : String(factor);
    return row[key] ?? row[String(factor)] ?? 0;
  },

  /** @param {AppEntry} app */
  calculateBalancedScore(app) {
    const pkg = app.componentName.split('/')[0];
    const domain = pkg.split('.')[0];
    const req = app.requestCount || 1;
    const inst = Utils.parseInstalls(app.installs);

    const ds = App.state.domainStats[domain] || {};
    const requests = ds.requests || 0;
    const total = ds.total || 1;
    const coverage = requests >= 4 ? (requests / total) : 0.5;
    const significance = requests >= 4 ? 1.0 : 0.3;

    const population = App.state.domainStats._population || {};
    const isoCountries = new Set(['ad', 'ae', 'af', 'ag', 'al', 'am', 'ao', 'ar', 'at', 'au', 'az', 'ba', 'bb', 'bd', 'be', 'bf', 'bg', 'bh', 'bi', 'bj', 'bo', 'br', 'bs', 'bt', 'bw', 'by', 'bz', 'ca', 'cd', 'cf', 'cg', 'ch', 'ci', 'cl', 'cm', 'cn', 'cr', 'cu', 'cv', 'cy', 'cz', 'de', 'dj', 'dk', 'dm', 'do', 'dz', 'ec', 'ee', 'eg', 'er', 'es', 'et', 'fi', 'fj', 'fr', 'ga', 'gb', 'ge', 'gh', 'gm', 'gn', 'gq', 'gr', 'gt', 'gw', 'gy', 'hk', 'hn', 'hr', 'ht', 'hu', 'id', 'ie', 'il', 'in', 'iq', 'ir', 'it', 'jm', 'jo', 'jp', 'ke', 'kg', 'kh', 'km', 'kn', 'kp', 'kr', 'kw', 'ky', 'kz', 'la', 'lb', 'lc', 'li', 'lk', 'lr', 'ls', 'lt', 'lu', 'lv', 'ly', 'ma', 'mc', 'md', 'mg', 'mk', 'ml', 'mm', 'mn', 'mr', 'mt', 'mu', 'mv', 'mw', 'mx', 'my', 'mz', 'na', 'nc', 'ne', 'nf', 'ng', 'ni', 'nl', 'no', 'np', 'nr', 'nz', 'om', 'pa', 'pe', 'pg', 'ph', 'pk', 'pl', 'pr', 'ps', 'pt', 'py', 'qa', 'ro', 'rs', 'ru', 'rw', 'sa', 'sc', 'sd', 'se', 'sg', 'si', 'sk', 'sl', 'sm', 'sn', 'so', 'sr', 'ss', 'st', 'sv', 'sy', 'sz', 'td', 'tg', 'th', 'tj', 'tl', 'tm', 'tn', 'tr', 'tt', 'tw', 'tz', 'ua', 'ug', 'us', 'uy', 'uz', 'va', 'vc', 've', 'vi', 'vn', 'vu', 'ye', 'yt', 'za', 'zm', 'zw']);

    /** @type (d: string) => boolean */
    const isCountry = (d) => isoCountries.has(d) && d in population;

    let localImpact = 0;
    if (isCountry(domain)) {
      const pop = population[domain] || 1;
      localImpact = Math.min((inst / 1_000_000) / pop * 50, 1);
    }

    const now = Date.now() / 1000;
    const ageDays = Math.max((now - (app.firstAppearance || now)) / 86400, 1);

    const w = { req: 0.35, inst: 0.25, cov: 0.15, local: 0.12, age: 0.13 };

    return (w.req * Math.log(req + 1) / Math.log(100) +
      w.inst * Math.log(inst + 1) / Math.log(100_000_000) +
      w.cov * coverage * significance +
      w.local * localImpact * significance +
      w.age * (1 / Math.log(ageDays + 1)));
  }
};


const Router = {
  // Map page names to UI configurations
  pages: {
    MAIN: 'main',
    QA: 'low-quality-icons',
    CONTRIBUTION: 'contribution-plan'
  },

  /**
   * Initializes navigation listeners and handles initial page state.
   */
  init() {
    // Determine initial page from URL or State
    const params = new URLSearchParams(window.location.search);
    const pageParam = params.get("page");

    // Convert boolean flags to single activePage state
    if (pageParam === this.pages.QA || App.state.lowQualityActive) {
      this.navigate(this.pages.QA, false);
    } else if (pageParam === this.pages.CONTRIBUTION || App.state.contributionActive) {
      this.navigate(this.pages.CONTRIBUTION, false);
    } else {
      this.navigate(this.pages.MAIN, false);
    }

    // Bind Persistent Navigation Buttons
    document.getElementById("lowQualityBtn")?.addEventListener("click", () => {
      const target = App.state.activePage === this.pages.QA ? this.pages.MAIN : this.pages.QA;
      this.navigate(target);
    });

    App.dom.contributionBtn?.addEventListener("click", () => {
      if (App.state.contribution.length === 0 && App.state.activePage !== this.pages.CONTRIBUTION) {
        Components.Toast.show("Contribution plan is empty. Add at least 1 request.");
        return;
      }
      const target = App.state.activePage === this.pages.CONTRIBUTION ? this.pages.MAIN : this.pages.CONTRIBUTION;
      this.navigate(target);
    });
  },

  /**
   * Performs the transition between pages.
   * @param {string} page - The page ID to switch to.
   * @param {boolean} triggerRender - Whether to call UI.render immediately.
   */
  navigate(page, triggerRender = true) {
    this._cleanup();
    App.state.activePage = page;

    // Update state-specific booleans for backward compatibility with old logic
    App.state.lowQualityActive = (page === this.pages.QA);
    App.state.contributionActive = (page === this.pages.CONTRIBUTION);

    // Perform DOM modifications required for specific views
    switch (page) {
      case this.pages.QA:
        this._setupQAHeader();
        break;
      case this.pages.CONTRIBUTION:
        this._setupContributionHeader();
        break;
      default:
        this._setupMainHeader();
        break;
    }

    if (triggerRender) {
      UI.render();
    }
  },

  /**
   * Resets common UI elements before a new page is mounted.
   */
  _cleanup() {
    // Remove temporary back buttons
    document.getElementById("lowQualityBackBtn")?.remove();
    document.getElementById("contributionBackBtn")?.remove();

    // Reset global visibility
    App.dom.contributionBtn.style.display = "";
    document.getElementById("lowQualityBtn")?.parentElement?.classList.remove("is-hidden");
    document.getElementById("search-wrapper")?.classList.remove("is-hidden");
    document.querySelector(".header-icon")?.classList.remove("is-hidden");
    document.querySelector(".controls")?.classList.remove("is-hidden");

    // Ensure badges are visible if needed
    UI.updateContributionBadge();
    UI.updateLowQualityBadge();
  },

  _setupMainHeader() {
    const header = document.querySelector(".header-info h1");
    if (header) header.textContent = "Lawnicons";
    App.dom.contributionBtn.classList.remove("active");
    document.getElementById("lowQualityBtn")?.classList.remove("active");

    const headerRight = document.querySelector(".header-right");
    headerRight?.querySelectorAll("a").forEach(a => a.classList.remove("is-hidden"));
    document.getElementById("appfilterLink")?.classList.add("is-hidden");
  },

  _setupQAHeader() {
    const header = document.querySelector(".header-info h1");
    if (header) header.textContent = "Low quality icons";

    document.getElementById("lowQualityBtn")?.classList.add("active");

    // Inject Back Button
    this._injectBackButton("lowQualityBackBtn");

    // Hide Irrelevant Controls
    document.getElementById("search-wrapper")?.classList.add("is-hidden");
    document.querySelector(".header-icon")?.classList.add("is-hidden");
    document.querySelector(".controls")?.classList.add("is-hidden");

    this._setupToolLinks();
  },

  _setupContributionHeader() {
    const header = document.querySelector(".header-info h1");
    if (header) header.textContent = "Contribution plan";
    App.dom.contributionBtn.classList.add("active");

    // Inject Back Button
    this._injectBackButton("contributionBackBtn");

    // Hide Irrelevant Controls
    document.getElementById("search-wrapper")?.classList.add("is-hidden");
    document.querySelector(".header-icon")?.classList.add("is-hidden");
    document.querySelector(".controls")?.classList.add("is-hidden");

    this._setupToolLinks();
  },

  /**
   * @param {string} id
   */
  _injectBackButton(id) {
    if (document.getElementById(id)) return;
    const btn = document.createElement("button");
    btn.className = "header-link back-btn";
    btn.id = id;
    btn.title = 'Back to requests';
    btn.type = 'button'
    btn.setAttribute('aria-label', 'Back to requests')
    btn.innerHTML = `<svg><use href="#ic-arrow-back"/></svg>`;
    btn.onclick = () => this.navigate(this.pages.MAIN);
    document.querySelector(".header-left")?.prepend(btn);
  },

  _setupToolLinks() {
    const headerRight = document.querySelector(".header-right");
    headerRight?.querySelectorAll("a").forEach(a => a.classList.add("is-hidden"));

    if (!document.getElementById("appfilterLink")) {
      headerRight?.insertAdjacentHTML("afterbegin", `
        <a id="appfilterLink" href="https://raw.githubusercontent.com/LawnchairLauncher/lawnicons/refs/heads/develop/app/assets/appfilter.xml" 
           class="header-link" title="Current appfilter.xml" target="_blank" rel=\"noopener noreferrer\">
          <svg><use href="#ic-code-xml"/></svg>
        </a>
      `);
    } else {
      document.getElementById("appfilterLink")?.classList.remove("is-hidden");
    }
  }
};


// ==========================================
// 9. UI LOGIC
// ==========================================
const UI = {
  /** @type {IntersectionObserver | null} */
  observer: null,

  /** @type {HTMLElement | null} */
  regexListEl: null,

  sortOptions: [
    { value: "req-desc", label: "Most requested" },
    { value: "req-asc", label: "Least requested" },
    { value: "odds-desc", label: "Highest creation odds" },
    { value: "odds-asc", label: "Lowest creation odds" },
    { value: "install-desc", label: "Most installed" },
    { value: "install-asc", label: "Least installed" },
    { value: "time-desc", label: "Newest" },
    { value: "time-asc", label: "Oldest" },
    { value: "name-asc", label: "Name (A-Z)" },
    { value: "name-desc", label: "Name (Z-A)" },
    { value: "trending", label: "Trending" },
    { value: "balanced", label: "Balanced" },
    { value: "rand", label: "Random" }
  ],

  /**
   * Main Orchestrator for UI Setup
   */
  init() {
    // 1. Recover persistent state from LocalStorage
    this._initStorageState();

    // 2. Initiate Router system
    Router.init();

    // 3. Initialize Visual Components
    this._initCharts();
    this.renderQuickPick();
    this.generateFilters();
    this.initObserver();
    this.initRegexAutocomplete();

    // 4. Bind UI Controls
    this._bindControls();

    // 5. Register Event Handling
    this._initGlobalDelegation();
    this._initKeyboardNavigation();

    // 6. Initial Render
    this.render();
  },

  /**
   * Loads contribution plans and UI preferences from storage.
   */
  _initStorageState() {
    // Regex Mode visibility
    if (App.state.regexMode) {
      App.dom.regexBtn.classList.add("active");
    }

    // Contribution Plan Recovery
    const savedList = localStorage.getItem("lawnicons_contribution");
    if (savedList) {
      try {
        const parsed = JSON.parse(savedList);
        const before = parsed.length;

        // Only keep items that still exist in the main dataset
        App.state.contribution = parsed.filter(app =>
          App.state.idMap.has(app.componentName)
        );

        // Recover Overrides (names, drawables, modes)
        const savedOverrides = localStorage.getItem("lawnicons_contribution_overrides");
        if (savedOverrides) {
          const parsedOverrides = JSON.parse(savedOverrides);
          App.state.contributionOverrides = {};
          for (const [id, overrides] of Object.entries(parsedOverrides)) {
            if (App.state.contribution.some(a => a.componentName === id)) {
              App.state.contributionOverrides[id] = overrides;
            }
          }
        }

        // Cleanup if data drifted
        if (App.state.contribution.length < before) this.saveContribution();

        // Tag apps in the plan
        App.state.contribution.forEach(app => {
          const tags = App.state.appTags.get(app.componentName) || new Set();
          tags.add("plan");
          App.state.appTags.set(app.componentName, tags);
        });
      } catch (e) {
        console.error("Failed to recover contribution plan", e);
      }
    }

    // Navigation state cleanup (Reset contribution view on fresh load)
    if (performance.navigation.type === 0) {
      localStorage.setItem("lawnicons_contribution_active", "false");
    }

    const savedActive = localStorage.getItem("lawnicons_contribution_active");
    if (savedActive === "true") {
      App.state.contributionActive = true;
      App.dom.contributionBtn?.classList.add("active");
    }

    this.updateContributionBadge();
  },

  /**
   * Binds listeners to static header/footer controls.
   */
  _bindControls() {
    // Search & Filtering
    App.dom.inputSearch.addEventListener("input", e => {
      App.state.search = (/** @type {HTMLInputElement} */ (e.target))?.value;
      Utils.setHidden(App.dom.clearBtn, App.state.search.length === 0);
      this.renderIconLibrary();
      this.render();
    });

    App.dom.clearBtn.addEventListener("click", () => {
      App.state.search = "";
      App.dom.inputSearch.value = "";
      Utils.setHidden(App.dom.clearBtn, true);
      App.dom.inputSearch.focus();
      this.renderIconLibrary();
      this.render();
    });

    App.dom.regexBtn.addEventListener("click", () => {
      App.state.regexMode = !App.state.regexMode;
      App.dom.regexBtn.classList.toggle("active", App.state.regexMode);
      this.render();
    });

    // View & Sort
    App.dom.sortBtn.addEventListener("click", () => this.showSortMenu());
    App.dom.viewBtn.addEventListener("click", () => {
      App.state.view = App.state.view === "list" ? "grid" : "list";
      App.dom.viewIconList.classList.toggle("active", App.state.view === "list");
      App.dom.viewIconGrid.classList.toggle("active", App.state.view === "grid");
      this.render();
    });

    // Bulk Actions
    App.dom.headerCheck.addEventListener("change", e =>
      Actions.toggleSelectAll((/** @type {HTMLInputElement} */ (e.target))?.checked)
    );

    App.dom.mobileFilterBtn.addEventListener("click", () => this.showMobileFilterPopover());

    // Selection Bar specific
    document.getElementById("sbContributeBtn")?.addEventListener("click", () => {
      App.state.selected.forEach(id => {
        const app = App.state.idMap.get(id);
        if (app && !App.state.contribution.some(a => a.componentName === id)) {
          App.state.contribution.push(app);
          const tags = App.state.appTags.get(id.toString()) || new Set();
          tags.add("plan");
          App.state.appTags.set(id.toString(), tags);
        }
      });
      this.saveContribution();
      Components.Toast.show(`${App.state.selected.size} icons added to plan.`);
      Actions.clearAllSelections();
      this.render();
    });

    App.dom.sbDownloadBtn.addEventListener("click", () => {
      App.state.actionMode = "new";
      Actions.downloadBundle();
    });

    App.dom.sbMenuBtn.addEventListener("click", (e) => this.showSelectionBarMenu(e));

    // List Header Sorters
    const headers = { '.col.name': 'name', '.col.req': 'req', '.col.creation-odds': 'odds', '.col.install': 'install', '.col.first': 'time' };
    Object.entries(headers).forEach(([selector, key]) => {
      /** @type {HTMLElement | null} */
      const el = App.dom.listHeader.querySelector(selector);
      const sortKey = /** @type {SortKeys} */ (key);
      if (el) el.onclick = () => Actions.toggleSortHeader(/** @type {SortKeys} */(sortKey));
    });
  },

  /**
   * Centralized Event Delegation for dynamic elements.
   */
  _initGlobalDelegation() {
    // 1. Click Actions via [data-action]
    document.addEventListener('click', (el) => {
      const e = /** @type {MouseEvent} */ (el)
      const target = /** @type {HTMLElement} */ (e.target);

      const actionEl = /** @type {HTMLElement} */ (target.closest('[data-action]'));
      if (actionEl) {
        this.handleAction(actionEl?.dataset?.action ?? "", actionEl, e);
        return;
      }

      // 2. Image Error Routing
      if (target.tagName === "IMG" && target.classList.contains("requested-icon")) {
        // Handled by Utils via capturing listener on container in original script
      }

      // 3. Selection Toggle (Rows/Cards)
      const item = /** @type {HTMLElement} */ (target.closest('[data-id]'));
      if (item && !App.state.contributionActive && !target.closest('a, .ctx-trigger, input')) {
        Actions.toggleSelection(item.dataset.id ?? "", e);
      }

      // 4. Context Menu Triggers
      const trigger = /** @type {HTMLElement} */ (target.closest('.ctx-trigger'));
      if (trigger) {
        e.stopPropagation();
        const row = /** @type {HTMLElement} */ (trigger.closest('[data-id]'));
        const app = App.state.idMap.get(row?.dataset.id ?? "");
        if (app) this.showRowMenu(e, app);
      }
    });

    // 5. Global Error Capture for Icons
    App.dom.container.addEventListener("error", e => Utils.handleImageError(e), true);

    // 6. Resizing Charts
    window.addEventListener("resize", () => {
      this.renderDomainStats();
      this.renderActivityCard();
    });
  },

  /**
   * Handles hotkeys and arrow navigation.
   */
  _initKeyboardNavigation() {
    document.addEventListener('keydown', (el) => {
      const e = /** @type {KeyboardEvent} */ (el);
      const target = /** @type {HTMLElement} */ (e.target);

      if (target.tagName === 'INPUT' && /** @type {HTMLInputElement} */ (target).type !== 'checkbox') {
        if (e.key === 'Escape') target.blur();
        return;
      }

      // Hotkeys
      if (e.key === '/' || (e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        App.dom.inputSearch.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        Actions.toggleSelectAll(true);
      }
      if (e.key === 'Escape' && App.state.selected.size > 0) {
        Actions.clearAllSelections();
      }

      // Container Navigation
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        this._handleArrowNavigation(e);
      }
    });
  },

  /**
   * Encapsulates chart rendering logic and data modes.
   */
  _initCharts() {
    this.renderDomainStats();
    this.renderActivityCard();

    // Mode toggles for Domain Stats
    document.querySelectorAll("[data-action='domain-stats-mode']").forEach(el => {
      el.addEventListener("click", () => {
        App.state.domainStatsMode = /** @type {HTMLElement} */ (el).dataset.mode || "";
        this.renderDomainStats();
      });
    });

    // Quick Pick toggles
    document.querySelectorAll("[data-action='quick-pick-mode']").forEach(el => {
      el.addEventListener("click", () => {
        App.state.quickPickMode = /** @type {HTMLElement} */ (el).dataset.mode || "";
        this.pickRandomQuickPick();
      });
    });
  },

  initObserver() {
    this.observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        const more = this.loadMore();
        App.dom.sentinel.style.opacity = more ? "1" : "0";
      }
    }, { rootMargin: "400px" });
    this.observer.observe(App.dom.sentinel);
  },

  render() {
    if (App.state.lowQualityActive) {
      this.renderLowQualityMode();
      return;
    }

    if (App.state.contributionActive) {
      this.renderContributionMode();
      return;
    }

    document.getElementById("lowQualityBtn")?.classList?.remove("active");
    const lowQualityBackBtn = document.getElementById("lowQualityBackBtn");
    if (lowQualityBackBtn) lowQualityBackBtn.remove();

    const backBtn = document.getElementById("contributionBackBtn");
    if (backBtn) backBtn.remove();

    document.querySelector(".header-icon")?.classList?.remove("is-hidden");
    document.getElementById("search-wrapper")?.classList?.remove("is-hidden");
    const header = document.querySelector(".header-info h1");
    if (header) header.textContent = "Lawnicons";
    App.dom.contributionBtn.style.display = "";
    this.updateContributionBadge();
    this.updateLowQualityBadge();

    const headerRight = document.querySelector(".header-right");
    headerRight?.querySelectorAll("a:not(#appfilterLink)")?.forEach(a => a.classList.remove("is-hidden"));
    const appfilterLink = document.getElementById("appfilterLink");
    if (appfilterLink) appfilterLink.classList.add("is-hidden");

    document.querySelector(".cards-row")?.classList?.remove("is-hidden");
    document.getElementById("mainCards")?.classList?.remove("is-hidden");
    const contribCards = document.getElementById("contributionCards");
    if (contribCards) contribCards.classList.add("is-hidden");
    document.querySelector(".controls")?.classList?.remove("is-hidden");

    const s = App.state;
    App.dom.container.innerHTML = "";
    App.dom.container.className = s.view === "grid" ? "grid-container" : "";

    this.generateFilters();
    this.syncFilterTagState();
    Data.process();
    Data.syncUrlState();
    this.updateHeader();
    this.renderIconLibrary();

    const desc = document.getElementById("supportedDesc");
    const link = document.getElementById("supportedLink");
    Utils.setHidden(desc, false);
    Utils.setHidden(link, false);

    if (s.currentData.length === 0) {
      App.dom.container.innerHTML = Templates.emptyState();
      this.updateHeader();
      return;
    }

    s.renderedCount = 0;
    this.loadMore();

    App.dom.listHeader.style.display = s.view === "list" ? "grid" : "none";
  },

  /**
   * @returns {boolean}
   */
  loadMore() {
    const s = App.state;
    if (s.renderedCount >= s.currentData.length) return false;

    const end = Math.min(s.renderedCount + CONFIG.ui.batchSize, s.currentData.length);
    const batch = s.currentData.slice(s.renderedCount, end);
    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement('div');

    batch.forEach(app => {
      const id = app.componentName;
      const isSelected = s.selected.has(id);
      const iconUrl = `${CONFIG.data.assetsPath}${app.drawable}${CONFIG.data.iconExtension}`;

      let html;
      const tags = Utils.getTagsForApp(id);
      if (s.view === "list") {
        html = Templates.listRow(app, isSelected, tags, iconUrl, Utils.formatDate(app.firstAppearance), Utils.formatDate(app.lastRequested));
      } else {
        html = Templates.gridCard(app, tags, isSelected, iconUrl);
      }

      tempDiv.innerHTML = html.trim();
      while (tempDiv.firstChild) {
        fragment.appendChild(tempDiv.firstChild);
      }
    });

    App.dom.container.appendChild(fragment);
    s.renderedCount = end;
    return true;
  },

  /**
   * Routes data-action triggers to their respective logic.
   * @param {string} action - The action key.
   * @param {HTMLElement} el - The element that triggered the action.
   * @param {Event} e - The original event object.
   */
  handleAction(action, el, e) {
    const s = App.state;
    const { id, url, drawable, value, domain, filterId, issue } = el.dataset;

    switch (action) {
      // --- DOWNLOADS ---
      case "download-png":
        if (url && drawable) this._downloadAsset(url, `${drawable}.png`);
        break;

      case "library-download-svg":
        if (url && drawable) this._downloadAsset(url, `${drawable}.svg`);
        this.closeContextMenu();
        break;

      case "sb-download-metadata":
        s.actionMode = "link";
        Actions.downloadBundle();
        this.closeContextMenu();
        break;

      // --- CLIPBOARD / COPY ---
      case "library-copy-svg":
        if (drawable) this._copySvgFromLibrary(drawable);
        break;

      case "library-copy-name":
        if (drawable) Actions.copyToClipboard(drawable);
        break;

      case "copy-appfilter-entry":
        if (id) Actions.copyAppFilterEntry(id);
        break;

      case "copy-name-id-entry":
        if (id) Actions.copyNamesAndIDs([id]);
        break;

      case "copy-pkg-entry":
        if (id) Actions.copyPkgName(id);
        break;

      case "copy-filter-entry":
        if (id) Actions.copyFilterEntry(id);
        break;

      case "sb-copy-appfilter":
        Actions.copyAppFilter();
        this.closeContextMenu();
        break;

      case "sb-copy-nameid":
        Actions.copyNamesAndIDs();
        this.closeContextMenu();
        break;

      case "sb-copy-pkgs":
        Actions.copySelectedPkgs();
        this.closeContextMenu();
        break;

      case "sb-copy-filter-entries": {
        const entries = [...s.selected].map(i => `"${i}",`).join("\n");
        Actions.copyToClipboard(entries);
        this.closeContextMenu();
        break;
      }

      // --- NAVIGATION & FILTERING ---
      case "open-link":
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
        this.closeContextMenu();
        break;

      case "sort-option":
        if (value) {
          s.sort = value;
          App.dom.sortLabel.textContent = el.textContent.trim();
          this.closeContextMenu();
          this.render();
        }
        break;

      case "filter-tag-toggle":
      case "mobile-filter-toggle":
        if (filterId) {
          Utils.mutualExclusiveTags(filterId, s.activeFilters);
          if (action === "mobile-filter-toggle") this.showMobileFilterPopover();
          this.render();
        }
        break;

      case "domain-filter":
        if (domain) {
          s.regexMode = true;
          App.dom.regexBtn.classList.add("active");
          s.search = `^${domain}\\.`;
          App.dom.inputSearch.value = s.search;
          Utils.setHidden(App.dom.clearBtn, false);
          // If we are in QA/Plan mode, jump back to Main to see search results
          if (s.activePage !== Router.pages.MAIN) Router.navigate(Router.pages.MAIN);
          else this.render();
        }
        break;

      case "regex-suggestion":
        if (value) {
          App.dom.inputSearch.value = value;
          App.dom.inputSearch.focus();
          App.dom.inputSearch.dispatchEvent(new Event("input"));
          this.hideRegexAutocomplete();
        }
        break;

      // --- CONTRIBUTION PLAN ACTIONS ---
      case "mode-select":
        this._handleContributionModeChange(id, value);
        break;

      case "restore-original":
        if (id) {
          delete s.contributionOverrides[id];
          this.saveContribution();
          this.render();
        }
        this.closeContextMenu();
        break;

      case "remove-from-contribution":
        if (id) {
          s.contribution = s.contribution.filter(a => a.componentName !== id);
          const tags = s.appTags.get(id);
          if (tags) tags.delete("plan");
          if (s.contribution.length === 0) Router.navigate(Router.pages.MAIN);
          else {
            this.saveContribution();
            this.render();
          }
        }
        this.closeContextMenu();
        break;

      case "issue-jump":
        if (issue) this.jumpToIssue(issue);
        break;

      case "quick-pick-mode":
        if (value) {
          s.quickPickMode = value;
          // Logic for updating UI state of quick pick icons
          document.querySelectorAll("[data-action='quick-pick-mode']").forEach(icon => {
            icon.classList.toggle("active", /** @type {HTMLElement} */(icon).dataset.value === value);
          });
          this.pickRandomQuickPick();
        }
        break;
    }
  },

  /**
 * Calculates current layout metrics.
 * Standardizes the "File Explorer" math.
 */
  _getLayoutConstants() {
    const isGrid = App.state.view === "grid";
    const containerWidth = App.dom.container.clientWidth;

    // Original logic: cards are approx 80px wide including margins
    const cardWidth = 80;
    const cols = isGrid ? Math.floor(containerWidth / cardWidth) || 1 : 1;

    return { isGrid, cols };
  },

  /**
   * Handles 2D Keyboard Navigation (Up, Down, Left, Right).
   * @param {KeyboardEvent} e 
   */
  _handleArrowNavigation(e) {
    /** @type {HTMLElement | null} */
    const target = /** @type {HTMLElement} */ (e.target).closest('[data-id]');
    if (!target) return;

    const items = /** @type {HTMLElement[]} */ (Array.from(App.dom.container.querySelectorAll('[data-id]')));
    const index = items.indexOf(target);
    if (index === -1) return;

    const { isGrid, cols } = this._getLayoutConstants();
    let nextIndex = index;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        nextIndex = isGrid ? index - cols : index - 1;
        break;
      case 'ArrowDown':
        e.preventDefault();
        nextIndex = isGrid ? index + cols : index + 1;
        break;
      case 'ArrowLeft':
        if (isGrid) {
          e.preventDefault();
          nextIndex = index - 1;
        }
        break;
      case 'ArrowRight':
        if (isGrid) {
          e.preventDefault();
          nextIndex = index + 1;
        }
        break;
    }

    // Clamp bounds and apply focus
    if (nextIndex >= 0 && nextIndex < items.length) {
      items[nextIndex].focus();

      // Optional: If holding shift while arrowing, extend selection
      if (e.shiftKey) {
        /** @type {string} */
        const id = items[nextIndex].dataset.id;
        Actions.toggleSelection(id, e);
      }
    }
  },

  /**
   * Helper for contribution mode dropdowns (New vs Link)
   * @param {string} appId
   * @param {string} mode
   */
  _handleContributionModeChange(appId, mode) {
    const s = App.state;
    if (mode === "set-all-new" || mode === "set-all-link") {
      const newMode = mode === "set-all-new" ? "new" : "link";
      s.contribution.forEach(a => {
        if (!s.contributionOverrides[a.componentName]) s.contributionOverrides[a.componentName] = {};
        s.contributionOverrides[a.componentName].mode = newMode;
      });
      this.saveContribution();
      this.render();
      return;
    }

    if (!s.contributionOverrides[appId]) s.contributionOverrides[appId] = {};
    s.contributionOverrides[appId].mode = mode;
    this.saveContribution();
    this.updateIssues();
  },

  /**
   * Helper to fetch and copy SVG source
   * @param {string} drawable
   */
  async _copySvgFromLibrary(drawable) {
    try {
      const url = `https://raw.githubusercontent.com/LawnchairLauncher/lawnicons/develop/svgs/${drawable}.svg`;
      const res = await fetch(url);
      const text = await res.text();
      if (!res.ok) throw "Failed to fetch asset";
      Actions.copyToClipboard(text);
      this.closeContextMenu();
    } catch {
      Components.Toast.show("Failed to copy SVG source", "error");
    }
  },

  /**
   * Universal downloader for blobs/images
   * @param {string} url
   * @param {string} filename
   */
  async _downloadAsset(url, filename) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      if (!res.ok) throw "Failed to fetch asset";
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      Components.Toast.show(`Failed to download ${filename}`, "error");
    }
  },

  showSortMenu() {
    const menu = App.dom.sortMenu;
    const options = UI.sortOptions.filter(opt => {
      if (opt.value === "trending" && Object.keys(App.state.trendingDeltas).length === 0) return false;
      return true;
    });

    menu.innerHTML = Templates.sortMenuItems(options, App.state.sort);

    menu.querySelectorAll(".ctx-item").forEach(item => {
      /** @type {HTMLElement} */
      (item).onclick = () => {
        App.state.sort = item.dataset.value;
        App.dom.sortLabel.textContent = item.textContent.trim();
        menu.hidePopover();
        this.render();
      };
    });

    const rect = App.dom.sortBtn.getBoundingClientRect();
    menu.style.left = rect.left + "px";
    menu.style.top = (rect.bottom + 8) + "px";
    menu.showPopover();
  },

  generateFilters() {
    const c = App.dom.filterBox;
    if (!c) return;
    c.innerHTML = "";

    CONFIG.data.filters.forEach(id => {
      let count = 0;
      App.state.appTags.forEach(tags => {
        if (tags.has(id)) count++;
      });
      if (count === 0) return;

      const meta = App.state.filterMetadata.get(id);
      if (!meta) return;

      const btn = document.createElement("button");
      btn.className = `tag tag-${id} chip`;
      btn.textContent = meta.label;
      btn.title = meta.description || `Filter by ${meta.label}`;
      btn.dataset.action = "filter-tag-toggle";
      btn.dataset.filterId = id;
      btn.setAttribute("aria-pressed", String(App.state.activeFilters.has(id)));
      if (App.state.activeFilters.has(id)) btn.classList.add("active");
      c.appendChild(btn);
    });
  },

  syncFilterTagState() {
    const c = App.dom.filterBox;
    if (!c) return;

    const active = App.state.activeFilters;
    c.querySelectorAll("[data-filter-id]").forEach(el => {
      if (!(el instanceof HTMLElement)) return;
      const id = el.dataset.filterId;
      if (!id) return;
      const isActive = active.has(id);
      el.classList.toggle("active", isActive);
      el.setAttribute("aria-pressed", String(isActive));
    });
  },

  /**
   * @param {string} id
   */
  updateItemVisuals(id) {
    const isSelected = App.state.selected.has(id);
    document.querySelectorAll(`[data-id="${id}"]`).forEach(el => {
      el.classList.toggle("selected", isSelected);
      const cb = /** @type {HTMLInputElement} */ (el.querySelector("input[type='checkbox']"));
      if (cb) cb.checked = isSelected;
    });
  },

  updateHeader() {
    const total = App.state.currentData.length;

    // Text
    const countEl = App.dom.headerCount;
    let displayText = `${Utils.compactNumber(total)} requests`;
    if (App.state.lastUpdate) {
      const timeAgo = Utils.timeAgo(App.state.lastUpdate);
      const fullDate = new Date(App.state.lastUpdate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
      displayText += ` • <a href="https://github.com/LawnchairLauncher/lawnicons-requests-dashboard" target="_blank" title="Last update: ${fullDate}">${timeAgo}</a>`;
    }
    countEl.innerHTML = displayText;

    // Checkbox
    const hc = App.dom.headerCheck;
    if (total === 0) {
      hc.checked = false;
      hc.indeterminate = false;
      return;
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

    this.updateSelectionBar();
  },

  updateSelectionBar() {
    const count = App.state.selected.size;
    const bar = App.dom.sbBar;

    if (count > 0) {
      bar.classList.add("visible");
      App.dom.sbCount.textContent = `${count} icon${count !== 1 ? 's' : ''}`;
    } else {
      bar.classList.remove("visible");
    }
  },

  renderLowQualityMode() {
    document.querySelector(".header-icon")?.classList.add("is-hidden");
    document.querySelector(".controls")?.classList.add("is-hidden");
    document.getElementById("iconLibraryResults")?.classList.add("is-hidden");
    document.getElementById("search-wrapper")?.classList.add("is-hidden");
    App.dom.listHeader.style.display = "none";
    App.dom.sentinel.style.display = "none";
    App.dom.contributionBtn.style.display = "none";
    document.getElementById("lowQualityBtn")?.parentElement?.classList.add("is-hidden");
    document.getElementById("contributionCountBadge").style.display = "none";
    document.getElementById("lowQualityBtn")?.classList.add("active");

    document.querySelector(".header-info h1").textContent = "Low quality icons";
    App.dom.headerCount.textContent = "";
    App.dom.sbBar.classList.remove("visible");
    App.dom.container.className = "";

    if (!document.getElementById("lowQualityBackBtn")) {
      document.querySelector(".header-left").insertAdjacentHTML("afterbegin", `
              <button class="header-link back-btn" id="lowQualityBackBtn" title="Back to requests">
                  <svg><use href="#ic-arrow-back"/></svg>
              </button>
          `);
      document.getElementById("lowQualityBackBtn").onclick = () => {
        App.state.lowQualityActive = false;
        document.getElementById("lowQualityBtn")?.classList.remove("active");
        this.render();
        Data.syncUrlState();
      };
    }

    const headerRight = document.querySelector(".header-right");
    const count = App.state.lowQualityData ? App.state.lowQualityData.length : 0;
    App.dom.headerCount.textContent = `${count} icon${count !== 1 ? 's' : ''}`;
    headerRight.querySelectorAll("a").forEach(a => a.classList.add("is-hidden"));

    if (!document.getElementById("appfilterLink")) {
      headerRight.insertAdjacentHTML("afterbegin", `
              <a id="appfilterLink" href="https://raw.githubusercontent.com/LawnchairLauncher/lawnicons/refs/heads/develop/app/assets/appfilter.xml" class="header-link" title="Current appfilter.xml">
                  <svg><use href="#ic-code-xml"/></svg>
              </a>
          `);
    } else {
      document.getElementById("appfilterLink")?.classList.remove("is-hidden");
    }

    document.getElementById("mainCards")?.classList.add("is-hidden");
    App.dom.container.innerHTML = "";

    fetch("assets/qa_issues/review_issues.json")
      .then(r => r.json())
      .then(d => {
        const data = /** @type {ReviewIssues[]} */ (d);
        App.state.lowQualityData = data;
        const count = data.length;
        App.dom.headerCount.textContent = `${count} icon${count !== 1 ? 's' : ''}`;
        if (data.length === 0) {
          App.state.lowQualityActive = false;
          document.getElementById("lowQualityBtn")?.classList.remove("active");
          Components.Toast.show("All existing icons look good.");
          this.render();
          return;
        }

        if (count === 0) {
          App.dom.container.innerHTML = "";
          return;
        }

        // Sort by issue count descending
        /** @type {(a: ReviewIssues, b: ReviewIssues) => number} */
        const comparator = (a, b) => b.issues.length - a.issues.length || a.drawable.localeCompare(b.drawable);
        data.sort(comparator);

        // Build cards
        let html = '';
        data.forEach(item => {
          const svgUrl = `https://raw.githubusercontent.com/LawnchairLauncher/lawnicons/develop/svgs/${item.drawable}.svg`;
          const issueList = item.issues.map(i => `<div class="item-sub">${i}</div>`).join("");
          html += `
                      <div class="library-icon-card" data-drawable="${item.drawable}" title="${item.issues.join('\n')}">
                          <img src="${svgUrl}" alt="${item.drawable}" loading="lazy" onerror="this.parentElement.remove()" />
                          <div class="qa-issues">${issueList}</div>
                      </div>
                  `;
        });

        App.dom.container.innerHTML = html;
        App.dom.container.className = "qa-container";
      })
      .catch(() => {
        App.state.lowQualityData = [];
        App.dom.headerCount.textContent = "0 icons";
        UI.updateLowQualityBadge();
      });

  },

  updateLowQualityBadge() {
    const btn = document.getElementById("lowQualityBtn");
    const wrapper = btn?.parentElement;
    const badge = document.getElementById("lowQualityCountBadge");
    if (!btn || !wrapper) return;
    const count = App.state.lowQualityData ? App.state.lowQualityData.length : 0;
    if (count > 0) {
      wrapper.classList.remove("is-hidden");
      if (badge) {
        badge.textContent = count.toString();
        badge.style.display = "flex";
      }
    } else {
      wrapper.classList.add("is-hidden");
      if (badge) badge.style.display = "none";
    }
  },

  renderContributionMode() {
    document.querySelector(".header-icon")?.classList.add("is-hidden");
    document.querySelector(".controls")?.classList.add("is-hidden");
    document.getElementById("iconLibraryResults")?.classList.add("is-hidden");
    document.getElementById("search-wrapper")?.classList.add("is-hidden");
    document.getElementById("contributionCountBadge").style.display = "none";
    App.dom.listHeader.style.display = "none";
    App.dom.sentinel.style.display = "none";
    const lowQualityWrapper = document.getElementById("lowQualityBtn")?.parentElement;
    if (lowQualityWrapper) lowQualityWrapper.classList.add("is-hidden");

    App.dom.contributionBtn.style.display = "none";

    document.querySelector(".header-info h1").textContent = "Contribution plan";

    if (!document.getElementById("contributionBackBtn")) {
      document.querySelector(".header-left").insertAdjacentHTML("afterbegin", `
              <button class="header-link back-btn" id="contributionBackBtn" title="Back to requests">
                  <svg><use href="#ic-arrow-back"/></svg>
              </button>
          `);
      document.getElementById("contributionBackBtn").onclick = () => {
        App.state.contributionActive = false;
        App.dom.contributionBtn.style.display = "";
        App.dom.contributionBtn.classList.remove("active");
        this.saveContribution();
        this.render();
        Data.syncUrlState();
      };
    }

    App.dom.container.className = "contribution-container";
    App.dom.sbBar.classList.remove("visible");

    const count = App.state.contribution.length;

    const headerRight = document.querySelector(".header-right");
    headerRight?.querySelectorAll("a")?.forEach(a => a.classList.add("is-hidden"));

    if (!document.getElementById("appfilterLink")) {
      headerRight?.insertAdjacentHTML("afterbegin", `
          <a id="appfilterLink" href="https://raw.githubusercontent.com/LawnchairLauncher/lawnicons/refs/heads/develop/app/assets/appfilter.xml" class="header-link" title="Current appfilter.xml">
            <svg><use href="#ic-code-xml"/></svg>
          </a>
        `);
    } else {
      document.getElementById("appfilterLink")?.classList.remove("is-hidden");
    }

    const headerHtml = `
          <div class="contribution-header">
              <div class="col mode">Mode</div>
              <div class="col icon">Icon</div>
              <div class="col name">Name</div>
              <div class="col svg-name">SVG name</div>
              <div class="col library-icon"></div>
              <div class="col actions"></div>  
          </div>
      `;

    document.getElementById("mainCards")?.classList.add("is-hidden");

    const cardsRow = document.querySelector(".cards-row");
    cardsRow?.classList.remove("is-hidden");

    if (!document.getElementById("contributionCards")) {
      cardsRow?.insertAdjacentHTML("beforeend", `
          <div id="contributionCards" style="display:contents;">
            <div class="card" id="contributionDomainsCard">
              <canvas id="domainsPie"></canvas>
              <div class="chart-tooltip" id="domainsTooltip"></div>
            </div>
            <div class="issues-list" id="contributionIssuesList"></div>
          </div>
        `);
    } else {
      document.getElementById("contributionCards")?.classList.remove("is-hidden");
    }

    // Draw domains pie chart
    /** @type {Record<string, number>} */
    const domainCounts = {};
    App.state.contribution.forEach(app => {
      const pkg = app.componentName.split('/')[0];
      const domain = pkg.split('.')[0];
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    });

    const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("domainsPie"));
    const tooltip =  /** @type {HTMLDivElement} */ (document.getElementById("domainsTooltip"));
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const entries = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);
      const total = entries.reduce((s, e) => s + e[1], 0);

      const dpr = window.devicePixelRatio || 1;
      const size = 88;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = size + "px";
      canvas.style.height = size + "px";
      ctx.scale(dpr, dpr);

      let angle = -Math.PI / 2;
      const style = getComputedStyle(document.documentElement);
      /** @type {string[]} */
      const colors = [];
      for (let i = 1; i <= 10; i++) {
        colors.push(style.getPropertyValue(`--chart-${i}`).trim());
      }

      entries.forEach((entry, i) => {
        const slice = (entry[1] / total) * Math.PI * 2;
        const midAngle = angle + slice / 2;
        const pct = entry[1] / total;

        ctx.beginPath();
        ctx.moveTo(size / 2, size / 2);
        ctx.arc(size / 2, size / 2, size / 2 - 2, angle, angle + slice);
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();

        const label = entry[0].length <= 4 ? entry[0] : entry[0][0] + "..." + entry[0][entry[0].length - 1];

        if (pct >= 0.2) {
          const labelR = size / 2 * 0.6;
          const lx = size / 2 + Math.cos(midAngle) * labelR;
          const ly = size / 2 + Math.sin(midAngle) * labelR;
          ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim();
          ctx.font = "600 10px " + getComputedStyle(document.documentElement).getPropertyValue("--font-main").trim();
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, lx, ly);
        }

        angle += slice;
      });

      canvas.onmousemove = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        const dist = Math.sqrt(x * x + y * y);
        const r = size / 2 - 2;

        if (dist > r) {
          tooltip.style.display = "none";
          return;
        }

        let mouseAngle = Math.atan2(y, x);
        if (mouseAngle < -Math.PI / 2) mouseAngle += Math.PI * 2;

        let a = -Math.PI / 2;
        for (let i = 0; i < entries.length; i++) {
          const slice = (entries[i][1] / total) * Math.PI * 2;
          if (mouseAngle >= a && mouseAngle < a + slice) {
            const pct = ((entries[i][1] / total) * 100).toFixed(1);
            tooltip.innerHTML = `<div class="tooltip-label">${entries[i][0]}</div><div class="tooltip-value">${entries[i][1]} icon${entries[i][1] !== 1 ? 's' : ''} (${pct}%)</div>`;
            tooltip.style.display = "block";
            const cardRect = document.getElementById("contributionDomainsCard")?.getBoundingClientRect();
            if (cardRect) {
              tooltip.style.left = (e.clientX - cardRect.left + 12) + "px";
              tooltip.style.top = (e.clientY - cardRect.top) + "px";
              tooltip.style.transform = "translateY(-50%)";
            }
            break;
          }
          a += slice;
        }
      };

      canvas.onmouseleave = () => {
        tooltip.style.display = "none";
      };
    }

    /** @type {Issue[]} */
    const issues = [
      { id: "nameinuse", label: "SVG name in use" },
      { id: "nameconflict", label: "Duplicate in plan" },
      { id: "emptyfields", label: "Empty fields" },
      { id: "invalidsvg", label: "Bad chars in SVG" },
      { id: "startdigit", label: "No _ before digit" },
    ];

    /** @type {Record<Issue['id'], number>} */
    const issueCounts = issues.reduce((acc, issue) => {
      acc[issue.id] = 0;
      return acc;
    }, /** @type {any} */({}));

    App.state.contribution.forEach(app => {
      const ov = App.state.contributionOverrides[app.componentName] || {};
      const name = ov.label !== undefined ? ov.label : app.label;
      const rawSvg = Utils.sanitizeDrawableName(name);
      const defaultSvg = (rawSvg === 'icon' || rawSvg === 'unknown') ? '' : rawSvg;
      const drawable = ov.drawable !== undefined ? ov.drawable : defaultSvg;

      if (drawable && App.state.existingIcons.some(icon => icon.drawable === drawable)) {
        issueCounts.nameinuse++;
      }

      if (drawable && App.state.contribution.filter(a => {
        const aOv = App.state.contributionOverrides[a.componentName] || {};
        const aName = aOv.label !== undefined ? aOv.label : a.label;
        const aDrawable = aOv.drawable !== undefined ? aOv.drawable : Utils.sanitizeDrawableName(aName);
        return aDrawable === drawable;
      }).length > 1) {
        issueCounts.nameconflict++;
      }

      if (!name.trim()) issueCounts.emptyfields++;
      if (!drawable.trim()) issueCounts.emptyfields++;
      if (drawable && /[^a-z0-9_]/.test(drawable)) issueCounts.invalidsvg++;
      if (drawable && /^[0-9]/.test(drawable)) issueCounts.startdigit++;
      if (name.includes("&") && !name.includes("&amp;")) issueCounts.unescaped++;
    });

    const issueEntries = issues
      .map(issue => ({ ...issue, count: issueCounts[issue.id] }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    const issuesList = document.getElementById("contributionIssuesList");
    if (issuesList) {
      issuesList.innerHTML = issueEntries.map(issue => `
          <div class="issue-item" data-action="issue-jump" data-issue="${issue.id}" ${issue.count > 0 ? `title="Show ${issue.count} issue${issue.count !== 1 ? 's' : ''}"` : ''}>
            <div class="issue-label">${issue.label}</div>
            <div class="issue-count">${issue.count}</div>
          </div>
        `).join("");
    }

    const sorted = [...App.state.contribution].sort((a, b) => a.label.localeCompare(b.label));
    const rowsHtml = sorted.map(app => {
      const iconUrl = `${CONFIG.data.assetsPath}${app.drawable}${CONFIG.data.iconExtension}`;
      return Templates.contributionRow(app, iconUrl);
    }).join("");

    const downloadReady = issueCounts.emptyfields === 0 && issueCounts.invalidsvg === 0 && issueCounts.startdigit === 0;

    const hasIcons = App.state.contribution.length > 0;
    if (!hasIcons) {
      document.getElementById("contributionCards")?.classList.add("is-hidden");
      App.dom.headerCount.textContent = "0 icons";
      return;
    }

    const newCount = App.state.contribution.filter(a => (App.state.contributionOverrides[a.componentName]?.mode || "new") === "new").length;
    const linkCount = App.state.contribution.length - newCount;
    let parts = [];
    if (newCount > 0) parts.push(`${newCount} new icon${newCount !== 1 ? 's' : ''}`);
    if (linkCount > 0) parts.push(`${linkCount} link${linkCount !== 1 ? 's' : ''}`);
    App.dom.headerCount.textContent = parts.join(' \u2022 ') || '0 icons';

    const clearHtml = hasIcons ? `
        <button class="sb-action-btn sb-action-btn-icon contribution-clear-btn" id="contributionClearBtn" title="Remove all" style="position:fixed; bottom:var(--space-xxl); left:var(--space-xxl); z-index:900;">
          <svg><use href="#ic-remove"/></svg>
        </button>
      ` : '';

    const downloadHtml = `
        <div class="contribution-download-wrapper">
          <button class="sb-action-btn" id="contributionDownloadBtn" style="${downloadReady ? '' : 'display:none'}">
            <svg><use href="#ic-download"/></svg>
            <span>Download</span>
          </button>
        </div>
      `;

    App.dom.container.innerHTML = clearHtml + downloadHtml + headerHtml + rowsHtml;

    const clearBtn = document.getElementById("contributionClearBtn");
    if (clearBtn) clearBtn.onclick = () => {
      App.state.contribution.forEach(a => {
        const tags = App.state.appTags.get(a.componentName);
        if (tags) tags.delete("plan");
      });
      App.state.contribution = [];
      App.state.activeFilters.delete("plan");
      App.state.contributionOverrides = {};
      App.state.contributionActive = false;
      App.dom.contributionBtn.style.display = "";
      App.dom.contributionBtn.classList.remove("active");
      UI.saveContribution();
      UI.render();
    };

    if (downloadReady) {
      const contibutionDownloadBtn = document.getElementById("contributionDownloadBtn")
      if (contibutionDownloadBtn) contibutionDownloadBtn.onclick = () => Actions.downloadContributionBundle();
    }
  },

  updateIssues() {
    const list = document.getElementById("contributionIssuesList");
    if (!list) return null;

    /** @type {Issue[]} */
    const issues = [
      { id: "nameinuse", label: "SVG name in use" },
      { id: "nameconflict", label: "Duplicate in plan" },
      { id: "emptyfields", label: "Empty fields" },
      { id: "invalidsvg", label: "Bad chars in SVG" },
      { id: "startdigit", label: "No _ before digit" },
    ];

    /** @type {Record<Issue['id'], number>} */
    const issueCounts = issues.reduce((acc, issue) => {
      acc[issue.id] = 0;
      return acc;
    }, /** @type {any} */({}));

    App.state.contribution.forEach(app => {
      const ov = App.state.contributionOverrides[app.componentName] || {};
      const name = ov.label !== undefined ? ov.label : app.label;
      const rawSvg = Utils.sanitizeDrawableName(name);
      const defaultSvg = (rawSvg === 'icon' || rawSvg === 'unknown') ? '' : rawSvg;
      const drawable = ov.drawable !== undefined ? ov.drawable : defaultSvg;

      if (drawable && App.state.existingIcons.some(icon => icon.drawable === drawable)) {
        issueCounts.nameinuse++;
      }

      const sameDrawable = App.state.contribution.filter(a => {
        const aOv = App.state.contributionOverrides[a.componentName] || {};
        const aName = aOv.label !== undefined ? aOv.label : a.label;
        const aDrawable = aOv.drawable !== undefined ? aOv.drawable : Utils.sanitizeDrawableName(aName);
        return aDrawable === drawable;
      }).length;
      if (drawable && sameDrawable > 1) {
        issueCounts.nameconflict++;
      }

      if (!name.trim()) issueCounts.emptyfields++;
      if (!drawable.trim()) issueCounts.emptyfields++;
      if (drawable && /[^a-z0-9_]/.test(drawable)) issueCounts.invalidsvg++;
      if (drawable && /^[0-9]/.test(drawable)) issueCounts.startdigit++;
    });

    const issueEntries = issues
      .map(issue => ({ ...issue, count: issueCounts[issue.id] }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    list.innerHTML = issueEntries.map(issue => `
      <div class="issue-item" data-action="issue-jump" data-issue="${issue.id}" ${issue.count > 0 ? `title="Show ${issue.count} issue${issue.count !== 1 ? 's' : ''}"` : ''}>
        <div class="issue-label">${issue.label}</div>
        <div class="issue-count">${issue.count}</div>
      </div>
    `).join("");

    const downloadReady = issueCounts.emptyfields === 0 && issueCounts.invalidsvg === 0 && issueCounts.startdigit === 0;
    const btn = document.getElementById("contributionDownloadBtn");
    if (btn) {
      btn.style.display = (App.state.contribution.length > 0 && downloadReady) ? '' : 'none';
    }

    const newCount = App.state.contribution.filter(a => (App.state.contributionOverrides[a.componentName]?.mode || "new") === "new").length;
    const linkCount = App.state.contribution.length - newCount;
    let parts = [];
    if (newCount > 0) parts.push(`${newCount} new icon${newCount !== 1 ? 's' : ''}`);
    if (linkCount > 0) parts.push(`${linkCount} link${linkCount !== 1 ? 's' : ''}`);
    App.dom.headerCount.textContent = parts.join(' \u2022 ') || '0 icons';

    return issueCounts;
  },

  /**
   * @param {string} issueId
   */
  jumpToIssue(issueId) {
    const rows = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(".contribution-row"));
    if (!rows.length) return;

    document.querySelectorAll(".issue-highlight").forEach(el => el.classList.remove("issue-highlight"));

    for (const row of rows) {
      const appId = row.dataset.id ?? "";
      const app = App.state.contribution.find(a => a.componentName === appId);
      if (!app) continue;

      const ov = App.state.contributionOverrides[appId] || {};
      const name = ov.label !== undefined ? ov.label : app.label;
      const rawSvg = Utils.sanitizeDrawableName(name);
      const defaultSvg = (rawSvg === 'icon' || rawSvg === 'unknown') ? '' : rawSvg;
      const drawable = ov.drawable !== undefined ? ov.drawable : defaultSvg;

      let match = false;
      let highlightName = false;
      let highlightSvg = false;

      switch (issueId) {
        case "nameinuse":
          match = !!drawable && App.state.existingIcons.some(icon => icon.drawable === drawable);
          highlightSvg = match;
          break;
        case "nameconflict":
          match = !!drawable && App.state.contribution.filter(a => {
            const aOv = App.state.contributionOverrides[a.componentName] || {};
            const aName = aOv.label !== undefined ? aOv.label : a.label;
            const aDrawable = aOv.drawable !== undefined ? aOv.drawable : Utils.sanitizeDrawableName(aName);
            return aDrawable === drawable;
          }).length > 1;
          highlightSvg = match;
          break;
        case "emptyfields":
          match = !name.trim() || !drawable.trim();
          highlightName = !name.trim();
          highlightSvg = !drawable.trim();
          break;
        case "invalidsvg":
          match = !!drawable && /[^a-z0-9_]/.test(drawable);
          highlightSvg = match;
          break;
        case "startdigit":
          match = !!drawable && /^[0-9]/.test(drawable);
          highlightSvg = match;
          break;
      }

      if (match) {
        if (highlightName) {
          const nameInput = row.querySelector(".contribution-name-input");
          if (nameInput) nameInput.classList.add("issue-highlight");
        }
        if (highlightSvg) {
          const svgInput = row.querySelector(".contribution-svg-input");
          if (svgInput) svgInput.classList.add("issue-highlight");
        }
      }
    }

    if (rows.length > 0 && document.querySelector(".issue-highlight")) {
      document.querySelector(".issue-highlight")?.closest(".contribution-row")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  },

  /**
   * @param {HTMLInputElement} input
   */
  updateContributionField(input) {
    const id = input.dataset.id ?? "";
    const field = input.dataset.field ?? "";
    const s = App.state;

    if (!s.contributionOverrides[id]) s.contributionOverrides[id] = {};
    s.contributionOverrides[id][field] = input.value;

    // Find relevant DOM elements for this specific row
    /** @type {HTMLElement | null} */
    const row = input.closest('.contribution-row');
    const nameInput = /** @type {HTMLInputElement | null} */ (row?.querySelector('.contribution-name-input'));
    const svgInput = /** @type {HTMLInputElement | null} */ (row?.querySelector('.contribution-svg-input'));
    const svgHint = /** @type {HTMLElement | null} */ (svgInput?.nextElementSibling);
    const libraryIconCol = /** @type {HTMLElement | null} */ (row?.querySelector('.col.library-icon'));

    let name = nameInput?.value ?? '';
    let drawable = svgInput?.value ?? '';

    // Logic Branch: If user changes the Label, auto-generate the SVG name
    if (field === 'label') {
      const sanitized = Utils.sanitizeDrawableName(input.value);
      // Avoid "icon.svg" or "unknown.svg" as they are generic failures
      if (sanitized === 'icon' || sanitized === 'unknown') {
        drawable = '';
        if (svgInput) svgInput.value = '';
        s.contributionOverrides[id].drawable = '';
      } else {
        drawable = sanitized;
        if (svgInput) svgInput.value = drawable;
        s.contributionOverrides[id].drawable = drawable;
      }
    }

    // Perform Real-time Library Collision Check
    const existingIcon = s.existingIcons.find(icon => icon.drawable === drawable);
    const existsInLibrary = !!existingIcon;
    const defaultSvg = Utils.sanitizeDrawableName(name);
    const isCustom = drawable !== defaultSvg;

    // Update the visual "Hint" text
    if (svgHint?.classList.contains('item-sub')) {
      if (existsInLibrary) {
        svgHint.textContent = 'Name in use.';
        svgHint.style.color = 'var(--error)';
      } else if (isCustom) {
        svgHint.textContent = 'Custom.';
        svgHint.style.color = 'var(--secondary)';
      } else {
        svgHint.textContent = 'Generated from name.';
        svgHint.style.color = '';
      }
    }

    // Update the Library Preview Icon
    if (libraryIconCol) {
      if (existsInLibrary) {
        const svgUrl = `https://raw.githubusercontent.com/LawnchairLauncher/lawnicons/develop/svgs/${drawable}.svg`;
        libraryIconCol.innerHTML = `
                <span class="library-icon-card" title="${existingIcon.name}\n${drawable}.svg">
                    <img src="${svgUrl}" alt="${drawable}" loading="lazy" onerror="this.parentElement.remove()" />
                </span>`;
      } else {
        libraryIconCol.innerHTML = '';
      }
    }

    // Save to storage and refresh issue counts in the header card
    this.saveContribution();
    this.updateIssues();

    // Remove the "red glow" from inputs if the user is actively fixing the issue
    input.classList.remove("issue-highlight");
  },

  saveContribution() {
    localStorage.setItem("lawnicons_contribution", JSON.stringify(App.state.contribution));
    localStorage.setItem("lawnicons_contribution_active", App.state.contributionActive.toString());
    localStorage.setItem("lawnicons_contribution_overrides", JSON.stringify(App.state.contributionOverrides));
    if (!App.state.contributionActive) {
      this.updateContributionBadge();
    }
  },

  updateContributionBadge() {
    const badge = document.getElementById("contributionCountBadge");
    if (!badge) return;
    const count = App.state.contribution.length;
    badge.textContent = count.toString();
    badge.style.display = count > 0 ? "flex" : "none";
  },

  renderDomainStats() {
    const data = App.state.domainStats;
    const card = document.getElementById("domainStatsCard");
    if (!card) return;

    if (!data || Object.keys(data).length === 0) {
      card.style.display = "none";
      return;
    }
    card.style.display = "";

    const container = document.getElementById("domainStats");
    if (!container) return;

    const containerWidth = container.clientWidth || (document.querySelector(".page")?.clientWidth ?? 0) - 64;
    const colWidth = 26;
    const fits = Math.floor(containerWidth / colWidth);

    const isoCountries = new Set(['ad', 'ae', 'af', 'ag', 'al', 'am', 'ao', 'ar', 'at', 'au', 'az', 'ba', 'bb', 'bd', 'be', 'bf', 'bg', 'bh', 'bi', 'bj', 'bo', 'br', 'bs', 'bt', 'bw', 'by', 'bz', 'ca', 'cd', 'cf', 'cg', 'ch', 'ci', 'cl', 'cm', 'cn', 'cr', 'cu', 'cv', 'cy', 'cz', 'de', 'dj', 'dk', 'dm', 'do', 'dz', 'ec', 'ee', 'eg', 'er', 'es', 'et', 'fi', 'fj', 'fr', 'ga', 'gb', 'ge', 'gh', 'gm', 'gn', 'gq', 'gr', 'gt', 'gw', 'gy', 'hk', 'hn', 'hr', 'ht', 'hu', 'id', 'ie', 'il', 'in', 'iq', 'ir', 'it', 'jm', 'jo', 'jp', 'ke', 'kg', 'kh', 'km', 'kn', 'kp', 'kr', 'kw', 'ky', 'kz', 'la', 'lb', 'lc', 'li', 'lk', 'lr', 'ls', 'lt', 'lu', 'lv', 'ly', 'ma', 'mc', 'md', 'mg', 'mk', 'ml', 'mm', 'mn', 'mr', 'mt', 'mu', 'mv', 'mw', 'mx', 'my', 'mz', 'na', 'nc', 'ne', 'nf', 'ng', 'ni', 'nl', 'no', 'np', 'nr', 'nz', 'om', 'pa', 'pe', 'pg', 'ph', 'pk', 'pl', 'pr', 'ps', 'pt', 'py', 'qa', 'ro', 'rs', 'ru', 'rw', 'sa', 'sc', 'sd', 'se', 'sg', 'si', 'sk', 'sl', 'sm', 'sn', 'so', 'sr', 'ss', 'st', 'sv', 'sy', 'sz', 'td', 'tg', 'th', 'tj', 'tl', 'tm', 'tn', 'tr', 'tt', 'tw', 'tz', 'ua', 'ug', 'us', 'uy', 'uz', 'va', 'vc', 've', 'vi', 'vn', 'vu', 'ye', 'yt', 'za', 'zm', 'zw']);

    /** @type {(domain: string) => boolean} */
    const isCountry = (domain) => isoCountries.has(domain);

    const mode = App.state.domainStatsMode;
    const population = (data._population) || {};

    if (!App.state._domainAvgInstalls) {
      /** @type {Record<string, number>} */
      App.state._domainAvgInstalls = {};
      /** @type {Record<string, number>} */
      const domainCountsI = {};
      /** @type {Record<string, number>} */
      const domainSumsI = {};
      App.data.forEach(app => {
        const pkg = app.componentName.split('/')[0];
        const domain = pkg.split('.')[0];
        if (isCountry(domain)) {
          const instStr = app.installs ? app.installs.replace(/[,+]/g, '') : '0';
          const inst = parseInt(instStr, 10) || 0;
          const pop = population[domain] || 1;
          if (inst / 1_000_000 > pop * 3) return;
          domainSumsI[domain] = (domainSumsI[domain] || 0) + inst;
          domainCountsI[domain] = (domainCountsI[domain] || 0) + 1;
        }
      });
      for (const d of Object.keys(domainSumsI)) {
        App.state._domainAvgInstalls[d] = Math.round(domainSumsI[d] / domainCountsI[d]);
      }
    }

    let entries = Object.entries(data)
      .filter(([domain]) => isCountry(domain) && domain !== "_population")
      .map(([domain, stats]) => [domain, stats.done, stats.requests, stats.total]);

    if (mode === "local") {
      entries = entries
        .filter(([, , requests]) => requests > 10)
        .sort((a, b) => {
          const instA = App.state._domainAvgInstalls[a[0]] || 0;
          const instB = App.state._domainAvgInstalls[b[0]] || 0;
          const popA = population[a[0]] || 1;
          const popB = population[b[0]] || 1;
          const scoreA = instA / popA;
          const scoreB = instB / popB;
          return scoreB - scoreA;
        });
    } else if (mode === "coverage") {
      entries = entries
        .filter(([, , requests]) => requests >= 15)
        .sort((a, b) => {
          const pctA = a[2] / a[3];
          const pctB = b[2] / b[3];
          return pctB - pctA;
        });
    } else {
      entries = entries
        .filter(([, , requests]) => requests >= 15)
        .sort((a, b) => b[3] - a[3]);
    }

    const max = Math.max(...entries.map(e => e[3]), 1);

    const title = document.querySelector("#domainStatsCard .card-title");
    if (title) {
      if (mode === "local") title.textContent = "Local impact";
      else if (mode === "coverage") title.textContent = "Lowest coverage";
      else title.textContent = "Top domains";
    }

    const sub = /** @type {HTMLElement | null} */ (document.querySelector("#domainStatsCard .card-sub"));
    if (sub) sub.style.display = "none";

    container.innerHTML = Templates.domainStatsCard(entries, max);

    const tooltip = /** @type {HTMLElement} */ (container.querySelector(".chart-tooltip"));
    if (!tooltip) return;

    container.addEventListener("mousemove", (el) => {
      const e = /** @type {MouseEvent} */ (el);
      const target = /** @type {HTMLElement} */ (e.target);

      const col = /** @type {HTMLElement | null} */ (target.closest(".domain-col"));
      if (!col) return;

      const domain = col.dataset?.domain ?? "";
      const done = parseInt(col.dataset?.done ?? "");
      const requests = parseInt(col.dataset?.requests ?? "");
      const total = parseInt(col.dataset?.total ?? "");
      const avgInst = App.state?._domainAvgInstalls[domain] || 0;
      const pop = population[domain] || 0;
      tooltip.innerHTML = Templates.domainStatsTooltip(domain, done, requests, total, mode, avgInst, pop);
      tooltip.style.display = "block";
      const rect = col.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      tooltip.style.top = "0px";
      tooltip.style.transform = "translateY(-50%)";
      tooltip.style.left = (rect.left - containerRect.left + rect.width) + "px";
    });

    container.addEventListener("mouseleave", () => {
      tooltip.style.display = "none";
    });
  },

  renderActivityCard() {
    const history = App.state.activityStats;
    const card = document.getElementById("activityCard");

    const container = document.getElementById("activityChart");
    if (!container) return;

    if (!history || history.length < 2) {
      container.innerHTML = Templates.activityCardEmpty();
      return;
    }

    const rawDays = history.slice(-90);

    // Fill gaps between days with zero entries
    const filledDays = [];
    if (rawDays.length > 0) {
      filledDays.push(rawDays[0]);
      for (let i = 1; i < rawDays.length; i++) {
        const prevDate = /** @type {Date} */ (new Date(filledDays[filledDays.length - 1].date + "T12:00:00"));
        const currDate = new Date(rawDays[i].date + "T12:00:00");
        while (prevDate.getTime() + 86400000 < currDate.getTime()) {
          prevDate.setTime(prevDate.getTime() + 86400000);
          filledDays.push({
            date: prevDate.toISOString().slice(0, 10),
            total: filledDays[filledDays.length - 1].total,
            added: 0,
            fulfilled: 0,
            expired: 0
          });
        }
        filledDays.push(rawDays[i]);
      }
    }

    const days = filledDays.length >= 2 ? filledDays : rawDays;

    const totalNew = days.reduce((sum, d) => sum + (d.added || 0), 0);

    // Resolved as main line
    const maxRemoved = Math.max(...days.map(d => d.fulfilled || 0), 1);
    const resolvedPoints = days.map((d, i) => ({
      x: (i / (days.length - 1) * 100),
      y: (100 - (d.fulfilled || 0) / maxRemoved * 100)
    }));

    const maxAdded = Math.max(...days.map(d => d.added || 0), 1);

    if (maxRemoved === 0 && maxAdded === 0) return;

    /** @type {(points: {x: number, y: number}[]) => string} */
    const makePath = (points) => {
      if (points.length < 2) return "";
      let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
      for (let i = 1; i < points.length; i++) {
        const cp1x = ((points[i - 1].x + points[i].x) / 2).toFixed(1);
        const cp1y = points[i - 1].y.toFixed(1);
        const cp2x = ((points[i - 1].x + points[i].x) / 2).toFixed(1);
        const cp2y = points[i].y.toFixed(1);
        d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${points[i].x.toFixed(1)},${points[i].y.toFixed(1)}`;
      }
      return d;
    };

    const pathResolved = makePath(resolvedPoints);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const firstDate = new Date(days[0].date + "T12:00:00");
    const lastDate = new Date(days[days.length - 1].date + "T12:00:00");
    const firstLabel = `${monthNames[firstDate.getMonth()]} ${firstDate.getDate()}`;
    const lastLabel = `${monthNames[lastDate.getMonth()]} ${lastDate.getDate()}`;

    const dayLabels = `
        <span class="chart-label">${firstLabel}</span>
        <span class="chart-label" id="activityPace"></span>
        <span class="chart-label">${lastLabel}</span>
    `;

    container.innerHTML = Templates.activityCard(pathResolved, "", dayLabels);

    const dotsSvg = container.querySelector(".activity-dots-svg");
    if (dotsSvg) {
      const chartEl = container.querySelector(".card-chart");
      if (!chartEl) return;
      const w = chartEl.clientWidth;
      const h = chartEl.clientHeight;
      dotsSvg.setAttribute("viewBox", `0 0 ${w} ${h}`);

      /** @type {(added: number) => number} */
      const getSize = (added) => {
        if (added >= 1000) return 7;
        if (added >= 251) return 5;
        return 3;
      };

      const addedDots = days.map((d, i) => {
        const x = (i / (days.length - 1) * w).toFixed(1);
        const added = d.added || 0;
        if (added === 0) return "";
        const r = getSize(added);
        return `<circle cx="${x}" cy="${r + 2}" r="${r}" class="activity-added-dot" />`;
      }).join("");

      dotsSvg.innerHTML = addedDots;
    }

    const totalFulfilled = days.reduce((sum, d) => sum + (d.fulfilled || 0), 0);
    const subEl = document.getElementById("activitySub");
    if (subEl) subEl.textContent = `${Utils.compactNumber(totalNew)} new • ${Utils.compactNumber(totalFulfilled)} done`;

    const paceEl = document.getElementById("activityPace");
    if (paceEl && App.state.medianTTF !== undefined) {
      paceEl.textContent = `${App.state.medianTTF}d from ask to icon`;
      const count = App.state._fulfillmentData?.length || 0;
      paceEl.title = `Median time from request to icon, based on ${count} fulfilled requests.`;
    }

    const svg = container.querySelector(".activity-svg");
    if (!svg) return;

    const tooltip = /** @type {HTMLElement | null} */ (container.querySelector(".chart-tooltip"));
    if (!tooltip) return;

    const vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    vLine.classList.add("activity-vline");
    vLine.style.display = "none";
    svg.appendChild(vLine);

    svg.addEventListener("mouseleave", () => {
      vLine.style.display = "none";
      tooltip.style.display = "none";
    });

    svg.addEventListener("mousemove", (el) => {
      const e = /** @type {MouseEvent} */ (el);
      const svgRect = svg.getBoundingClientRect();
      const x = (e.clientX - svgRect.left) / svgRect.width * 100;
      const idx = Math.round(x / 100 * (days.length - 1));
      const clamped = Math.min(days.length - 1, Math.max(0, idx));
      const snapX = (clamped / (days.length - 1) * 100);

      vLine.setAttribute("x1", snapX.toString());
      vLine.setAttribute("x2", snapX.toString());
      vLine.setAttribute("y1", "0");
      vLine.setAttribute("y2", "100");
      vLine.style.display = "";

      const added = days[clamped].added || 0;
      const fulfilled = days[clamped].fulfilled || 0;

      if (added === 0 && fulfilled === 0) {
        tooltip.style.display = "none";
        return;
      }

      const dateParts = days[clamped].date.toString().split("-");
      const formattedDate = `${monthNames[parseInt(dateParts[1]) - 1]} ${parseInt(dateParts[2])}`;
      tooltip.innerHTML = Templates.activityTooltip(formattedDate, added, fulfilled);
      tooltip.style.display = "block";

      const left = snapX / 100 * svgRect.width + 12;
      tooltip.style.left = left + "px";
      tooltip.style.top = "0px";
      tooltip.style.transform = "translateY(-50%)";
    });
  },

  initRegexAutocomplete() {
    const input = App.dom.inputSearch;
    const wrapper = document.getElementById("search-wrapper");
    if (!wrapper) return;

    input.addEventListener("input", () => {
      this.hideRegexAutocomplete();
      if (!App.state.regexMode) return;

      const val = input.value;
      if (!val || val.includes(".")) return;

      const domains = Object.keys(App.state.domainStats);
      if (!domains.length) return;

      const matches = domains
        .filter(d => d.toLowerCase().startsWith(val.toLowerCase()))
        .slice(0, 5);
      if (!matches.length) return;

      const listEl = document.createElement("div");
      listEl.className = "autocomplete-list";
      listEl.setAttribute("role", "listbox");
      listEl.innerHTML = Templates.regexAutocompleteList(matches);
      listEl.style.top = `${input.offsetTop + input.offsetHeight + 4}px`;
      listEl.style.left = `${input.offsetLeft}px`;
      listEl.style.width = `${input.offsetWidth}px`;

      wrapper.appendChild(listEl);
      this.regexListEl = listEl;
    });
  },

  hideRegexAutocomplete() {
    if (!this.regexListEl) return;
    this.regexListEl.remove();
    this.regexListEl = null;
  },

  /**
     * Displays the extended options menu for the Selection Bar.
     * @param {MouseEvent} e 
     */
  showSelectionBarMenu(e) {
    const menu = document.getElementById("sbMenu");
    const trigger = /** @type {HTMLElement} */ (e.currentTarget);
    if (!menu || !trigger) return;

    // 1. Populate Content
    menu.innerHTML = Templates.selectionBarMenu();

    // 2. Position Logic (Opening Upwards from fixed bottom bar)
    const rect = trigger.getBoundingClientRect();

    // Hide briefly to measure
    menu.style.visibility = "hidden";
    menu.showPopover();

    const menuWidth = menu.offsetWidth || 200;
    const menuHeight = menu.offsetHeight || 250;

    // Align right edges of button and menu
    const x = rect.right - menuWidth;
    // Position 8px above the button
    const y = rect.top - menuHeight - 8;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.transformOrigin = "bottom right";
    menu.style.visibility = "visible";

    // 3. Focus first item for accessibility
    this.focusMenu(menu);
  },

  /**
   * @param {any} e
   * @param {AppEntry} app
   */
  showRowMenu(e, app) {
    App.dom.rowMenu.innerHTML = Templates.rowMenu(app);
    const trigger = /** @type {HTMLElement} */ (e.target.closest('.ctx-trigger'));
    const rect = trigger.getBoundingClientRect();
    const menu = App.dom.rowMenu;

    // Hide first to measure
    menu.style.visibility = "hidden";
    menu.showPopover();

    const w = menu.offsetWidth || 255;
    let x = rect.right - w;
    let y = rect.bottom + 4;

    if (x < 0) x = rect.right - w;
    if (y + 290 > window.innerHeight) y = rect.top - 290 - 4;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.transformOrigin = "top right";
    menu.style.visibility = "visible";
  },

  showMobileFilterPopover() {
    const menu = App.dom.mobileFilterMenu;
    menu.innerHTML = "";
    const s = App.state.activeFilters;
    menu.innerHTML = CONFIG.data.filters.map(id => {
      let count = 0;
      App.state.appTags.forEach(tags => {
        if (tags.has(id)) count++;
      });
      if (count === 0) return "";

      const meta = App.state.filterMetadata.get(id);
      if (!meta) return "";
      return Templates.mobileFilterItem(id, meta.label, s.has(id));
    }).join("");

    const rect = App.dom.mobileFilterBtn.getBoundingClientRect();
    menu.style.visibility = "hidden";
    menu.showPopover();
    menu.style.left = `${rect.right - menu.offsetWidth}px`;
    menu.style.top = `${rect.bottom + 8}px`;
    menu.style.visibility = "visible";
  },

  buildQuickPickQueue() {
    const isoCountries = new Set(['ad', 'ae', 'af', 'ag', 'al', 'am', 'ao', 'ar', 'at', 'au', 'az', 'ba', 'bb', 'bd', 'be', 'bf', 'bg', 'bh', 'bi', 'bj', 'bo', 'br', 'bs', 'bt', 'bw', 'by', 'bz', 'ca', 'cd', 'cf', 'cg', 'ch', 'ci', 'cl', 'cm', 'cn', 'cr', 'cu', 'cv', 'cy', 'cz', 'de', 'dj', 'dk', 'dm', 'do', 'dz', 'ec', 'ee', 'eg', 'er', 'es', 'et', 'fi', 'fj', 'fr', 'ga', 'gb', 'ge', 'gh', 'gm', 'gn', 'gq', 'gr', 'gt', 'gw', 'gy', 'hk', 'hn', 'hr', 'ht', 'hu', 'id', 'ie', 'il', 'in', 'iq', 'ir', 'it', 'jm', 'jo', 'jp', 'ke', 'kg', 'kh', 'km', 'kn', 'kp', 'kr', 'kw', 'ky', 'kz', 'la', 'lb', 'lc', 'li', 'lk', 'lr', 'ls', 'lt', 'lu', 'lv', 'ly', 'ma', 'mc', 'md', 'mg', 'mk', 'ml', 'mm', 'mn', 'mr', 'mt', 'mu', 'mv', 'mw', 'mx', 'my', 'mz', 'na', 'nc', 'ne', 'nf', 'ng', 'ni', 'nl', 'no', 'np', 'nr', 'nz', 'om', 'pa', 'pe', 'pg', 'ph', 'pk', 'pl', 'pr', 'ps', 'pt', 'py', 'qa', 'ro', 'rs', 'ru', 'rw', 'sa', 'sc', 'sd', 'se', 'sg', 'si', 'sk', 'sl', 'sm', 'sn', 'so', 'sr', 'ss', 'st', 'sv', 'sy', 'sz', 'td', 'tg', 'th', 'tj', 'tl', 'tm', 'tn', 'tr', 'tt', 'tw', 'tz', 'ua', 'ug', 'us', 'uy', 'uz', 'va', 'vc', 've', 'vi', 'vn', 'vu', 'ye', 'yt', 'za', 'zm', 'zw']);
    const POP = App.state.domainStats._population || {};
    /** @param {string} d */
    const isCountry = (d) => isoCountries.has(d) && d in POP;

    // Calc local_impact per country
    const domainInstalls = {};
    const domainInstCounts = {};
    App.data.forEach(app => {
      const pkg = app.componentName.split('/')[0];
      const domain = pkg.split('.')[0];
      if (!isCountry(domain)) return;
      const inst = Utils.parseInstalls(app.installs);
      domainInstalls[domain] = (domainInstalls[domain] || 0) + inst;
      domainInstCounts[domain] = (domainInstCounts[domain] || 0) + 1;
    });

    const localImpact = {};
    for (const d of Object.keys(domainInstalls)) {
      const s = App.state.domainStats[d] || {};
      const unf = s.requests || 0;
      const avg = Math.round(domainInstalls[d] / domainInstCounts[d]);
      const pop = POP[d] || 1;
      localImpact[d] = unf * avg / pop;
    }

    const liValues = Object.values(localImpact).sort((a, b) => a - b);
    const n = liValues.length;
    const q1 = liValues[Math.floor(n / 4)] || 0;
    const q2 = liValues[Math.floor(n / 2)] || 0;
    const q3 = liValues[Math.floor(3 * n / 4)] || 0;

    const quartileUrgency = (li) => {
      if (li >= q3) return 1.0;
      if (li >= q2) return 0.75;
      if (li >= q1) return 0.5;
      return 0.25;
    };

    App.state._quickPickMiddle = [];
    App.state._quickPickEasy = [];

    App.data.forEach(app => {
      const tags = App.state.appTags.get(app.componentName) || new Set();

      const isStale = tags.has('stale');
      if (isStale) return;

      const inst = Utils.parseInstalls(app.installs);
      if (inst < 500000) return;
      if (app.requestCount < 5) return;

      const isEasy = tags.has('easy');
      const isMatch = tags.has('match');
      const isNameInUse = tags.has('nameinuse');

      const pkg = app.componentName.split('/')[0];
      const domain = pkg.split('.')[0];
      const req = app.requestCount || 0;

      let urg = 0.5;
      if (isCountry(domain)) {
        const li = localImpact[domain] || 0;
        urg = quartileUrgency(li);
      }
      const urgencyMod = 0.5 + 0.5 * urg;
      const score = Math.log(inst + 1) * Math.sqrt(req) * urgencyMod;

      const item = { ...app, _score: score };

      // Easy: only easy, excl. match and nameinuse
      if (isEasy && !isMatch && !isNameInUse) {
        App.state._quickPickEasy.push(item);
      }

      // Middle+: excl. easy, match and nameinuse
      if (!isEasy && !isMatch && !isNameInUse) {
        App.state._quickPickMiddle.push(item);
      }

    });

    App.state._quickPickMiddle.sort((a, b) => b._score - a._score);
    App.state._quickPickEasy.sort((a, b) => b._score - a._score);

    App.state.quickPickMode = App.state.quickPickMode || 'easy';
  },

  renderQuickPick() {
    if (!App.state._quickPickMiddle || !App.state._quickPickMiddle.length) {
      this.buildQuickPickQueue();
    }
    this.pickRandomQuickPick();
  },

  pickRandomQuickPick() {
    const queue = App.state.quickPickMode === 'easy'
      ? App.state._quickPickEasy
      : App.state._quickPickMiddle;
    if (!queue || !queue.length) return;

    const idx = Math.floor(Math.random() * queue.length);
    App.state._lastQuickPickIdx = idx;
    const app = queue[idx];
    const card = document.getElementById("quickPickCard");
    if (!card) return; 

    card.style.backgroundImage = `url('extracted_png/${app.drawable}.png')`;
    card.style.backgroundSize = 'cover';
    card.style.backgroundPosition = 'center';
    card.style.backgroundRepeat = 'no-repeat';
    card.title = app.label;
  },

  renderIconLibrary() {
    const s = App.state;
    const container = (/** @type {HTMLElement} */ document.getElementById("iconLibraryResults"));
    const cardsRow = document.querySelector(".cards-row");

    if (!container || !cardsRow) return;

    const query = s.search.trim();

    if (!query || !s.existingIcons || s.existingIcons.length === 0) {
      Utils.setHidden(container, true);
      Utils.setHidden(cardsRow, false);
      return;
    }

    const term = query.toLowerCase();
    const seen = new Set();
    const matches = s.existingIcons.filter(icon => {
      if (seen.has(icon.drawable)) return false;
      const match = icon.name.toLowerCase().includes(term) ||
        icon.drawable.toLowerCase().includes(term) ||
        icon.component.toLowerCase().includes(term);
      if (match) seen.add(icon.drawable);
      return match;
    });

    if (matches.length === 0) {
      Utils.setHidden(container, true);
      Utils.setHidden(cardsRow, false);
      return;
    }

    matches.sort((a, b) => {
      const aDrawStarts = a.drawable.toLowerCase().startsWith(term);
      const bDrawStarts = b.drawable.toLowerCase().startsWith(term);
      if (aDrawStarts !== bDrawStarts) return aDrawStarts ? -1 : 1;

      const aNameStarts = a.name.toLowerCase().startsWith(term);
      const bNameStarts = b.name.toLowerCase().startsWith(term);
      if (aNameStarts !== bNameStarts) return aNameStarts ? -1 : 1;

      const aDrawHas = a.drawable.toLowerCase().includes(term);
      const bDrawHas = b.drawable.toLowerCase().includes(term);
      if (aDrawHas !== bDrawHas) return aDrawHas ? -1 : 1;

      const aNameHas = a.name.toLowerCase().includes(term);
      const bNameHas = b.name.toLowerCase().includes(term);
      if (aNameHas !== bNameHas) return aNameHas ? -1 : 1;

      return a.drawable.localeCompare(b.drawable);
    });

    Utils.setHidden(cardsRow, true);
    Utils.setHidden(container, false);

    (/** @type {HTMLElement} */ (container.querySelector(".library-title"))).textContent = "Found in Lawnicons";

    const grid = (/** @type {HTMLElement} */ (container.querySelector(".library-grid")));
    grid.innerHTML = matches.slice(0, 20).map(icon =>
      Templates.libraryIconCard(icon)
    ).join("");
  },

  /**
   * @param {MouseEvent} e
   * @param {Icon} icon
   */
  showLibraryIconMenu(e, icon) {
    const menu = App.dom.rowMenu;
    menu.innerHTML = Templates.libraryIconMenu(icon);
    const target = /** @type {HTMLElement} */ (e?.target)?.closest('.library-icon-card');
    if (!target) return;
    const rect = target.getBoundingClientRect();

    menu.style.visibility = "hidden";
    menu.showPopover();

    const w = menu.offsetWidth || 220;
    let x = rect.left;
    let y = rect.bottom + 4;

    if (x < 8) x = 8;
    if (x + w > window.innerWidth - 8) x = window.innerWidth - w - 8;
    if (y + 150 > window.innerHeight) y = rect.top - 150 - 4;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.transformOrigin = "top left";
    menu.style.visibility = "visible";
  },

  /**
   * @param {HTMLElement} menuEl
   */
  focusMenu(menuEl) {
    // Wait for browser to render the popover
    requestAnimationFrame(() => {
      const firstItem = /** @type {HTMLElement} */ (menuEl.querySelector('.ctx-item'));
      if (firstItem) firstItem.focus();
    });
  },

  closeContextMenu() {
    try { /** @type {any} */ (App.dom.sortMenu).hidePopover(); } catch { }
    try { /** @type {any} */ (App.dom.rowMenu).hidePopover(); } catch { }
    try { /** @type {any} */ (App.dom.mobileFilterMenu).hidePopover(); } catch { }

    setTimeout(() => {
      App.dom.rowMenu.innerHTML = "";
      App.dom.mobileFilterMenu.innerHTML = "";
    }, 200);
  },
};


// Start
Data.init();
