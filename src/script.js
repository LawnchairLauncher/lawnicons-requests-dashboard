// @ts-check
/** @type {typeof import('fflate')} */
const fflate = /** @type {* & {fflate: any}} */ (window).fflate;

/**
 * LAWNICONS REQUEST MANAGER
 */

// ==========================================
// 1. CONFIGURATION
// ==========================================

const CONFIG = {
  data: {
    endpoint: 'assets/requests.json',
    requestsGraphPath: 'assets/requests_graph.json',
    screensGraphPath: 'assets/screens_graph.json',
    setsStatsPath: 'assets/stats/sets_stats.json',
    domainStatsPath: 'assets/stats/domain_stats.json',
    activityStatsPath: 'assets/stats/activity_stats.json',
    assetsPath: 'extracted_png/',
    iconExtension: '.png',
    filterPath: 'assets/filters/',
    // Order matters for UI
    filters: [
      'plan',
      'wip',
      'supported',
      'easy',
      'nameinuse',
      'match',
      'stale',
      'unlabeled',
    ],
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
    playStore: 'https://play.google.com/store/apps/details?id=',
    fDroid: 'https://f-droid.org/en/packages/',
    izzy: 'https://www.izzysoft.de/applists/category/named/',
    galaxyStore: 'https://galaxystore.samsung.com/detail/',
  },
  ui: {
    batchSize: 500,
  },
};

const ISO_COUNTRIES = new Set(['ad','ae','af','ag','al','am','ao','ar','at','au','az','ba','bb','bd','be','bf','bg','bh','bi','bj','bo','br','bs','bt','bw','by','bz','ca','cd','cf','cg','ch','ci','cl','cm','cn','cr','cu','cv','cy','cz','de','dj','dk','dm','do','dz','ec','ee','eg','er','es','et','fi','fj','fr','ga','gb','ge','gh','gm','gn','gq','gr','gt','gw','gy','hk','hn','hr','ht','hu','id','ie','il','in','iq','ir','it','jm','jo','jp','ke','kg','kh','km','kn','kp','kr','kw','ky','kz','la','lb','lc','li','lk','lr','ls','lt','lu','lv','ly','ma','mc','md','mg','mk','ml','mm','mn','mr','mt','mu','mv','mw','mx','my','mz','na','nc','ne','nf','ng','ni','nl','no','np','nr','nz','om','pa','pe','pg','ph','pk','pl','pr','ps','pt','py','qa','ro','rs','ru','rw','sa','sc','sd','se','sg','si','sk','sl','sm','sn','so','sr','ss','st','sv','sy','sz','td','tg','th','tj','tl','tm','tn','tr','tt','tw','tz','ua','ug','us','uy','uz','va','vc','ve','vi','vn','vu','ye','yt','za','zm','zw']);

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
  view: 'list',
  sort: 'req-desc',
  search: '',
  regex: false,
};

// ==========================================
// 2. STATE & DOM
// ==========================================

const App = {
  /** @type {AppEntry[]} */
  data: [],

  /** @type {AppState} */
  state: {
    view: 'list',
    sort: 'req-desc',
    search: '',
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

    actionMode: 'new',
    lowQualityActive: false,
    contributionActive: false,
    contribution: [],
    contributionOverrides: {},
    existingSvgs: new Map(),
    setsStats: {},
    domainStats: {},
    domainStatsMode: 'requests',
    activityStats: [],
    trendingDeltas: {},
    lastUpdate: null,
    activeTab: 'requests',
    screensData: {},
    screenSort: 'req-desc',
    activeScreenFilter: null,
  },

  dom: {
    /** @type {HTMLDivElement} */
    container: /** @type {any} */ (document.getElementById('appContainer')),
    /** @type {HTMLDivElement} */
    listHeader: /** @type {any} */ (document.getElementById('listHeader')),
    /** @type {HTMLInputElement} */
    headerCheck: /** @type {any} */ (document.getElementById('headerCheck')),
    /** @type {HTMLDivElement} */
    headerCount: /** @type {any} */ (document.getElementById('headerCount')),
    /** @type {HTMLDivElement} */
    sentinel: /** @type {any} */ (document.getElementById('scrollSentinel')),

    /** @type {HTMLInputElement} */
    inputSearch: /** @type {any} */ (document.getElementById('searchInput')),
    /** @type {HTMLButtonElement} */
    clearBtn: /** @type {any} */ (document.getElementById('clearSearchBtn')),
    /** @type {HTMLButtonElement} */
    regexBtn: /** @type {any} */ (document.getElementById('regexBtn')),

    /** @type {HTMLDivElement} */
    filterBox: /** @type {any} */ (document.getElementById('filterContainer')),

    /** @type {HTMLButtonElement} */
    mobileFilterBtn:
      /** @type {any} */ (document.getElementById('mobileFilterBtn')),
    /** @type {HTMLSpanElement} */
    mobileFilterCount:
      /** @type {any} */ (document.getElementById('mobileFilterCount')),
    /** @type {HTMLElement} */
    mobileFilterMenu:
      /** @type {any} */ (document.getElementById('mobileFilterMenu')),

    /** @type {HTMLHeadingElement} */
    header: /** @type {any} */ (document.querySelector('.header-info h1')),

    /** @type {HTMLDivElement} */
    sbBar: /** @type {any} */ (document.getElementById('selectionBar')),
    /** @type {HTMLDivElement} */
    sbCount: /** @type {any} */ (document.getElementById('sbCount')),
    /** @type {HTMLButtonElement} */
    sbDownloadBtn:
      /** @type {any} */ (document.getElementById('sbDownloadBtn')),
    /** @type {HTMLButtonElement} */
    sbMenuBtn: /** @type {any} */ (document.getElementById('sbMenuBtn')),
    /** @type {HTMLElement} */
    rowMenu: /** @type {any} */ (document.getElementById('rowMenu')),
    /** @type {HTMLDivElement} */
    toastBox: /** @type {any} */ (document.getElementById('toastContainer')),
    contributionBtn: /** @type {HTMLButtonElement} */ (document.getElementById(
      'contributionBtn',
    )),
    /** @type {HTMLButtonElement} */
    sortBtn: /** @type {any} */ (document.getElementById('sortBtn')),
    /** @type {HTMLButtonElement} */
    viewBtn: /** @type {any} */ (document.getElementById('viewBtn')),
    /** @type {HTMLElement} */
    viewIconList: /** @type {any} */ (document.getElementById('viewIconList')),
    /** @type {HTMLElement} */
    viewIconGrid: /** @type {any} */ (document.getElementById('viewIconGrid')),
    /** @type {HTMLElement} */
    sortMenu: /** @type {any} */ (document.getElementById('sortMenu')),
    /** @type {HTMLSpanElement} */
    sortLabel: /** @type {any} */ (document.getElementById('sortLabel')),
    mainTabs: /** @type {HTMLElement} */ (document.getElementById('mainTabs')),
    screenSortBtn: /** @type {HTMLButtonElement} */ (document.getElementById('screenSortBtn')),
    screenSortLabel: /** @type {HTMLSpanElement} */ (document.getElementById('screenSortLabel')),
  },
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
    if (!unix) return '—';
    return new Date(unix * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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
    if (!label) return 'unknown';
    // If name has ~~, use the right side
    const tildeIdx = label.indexOf('~~');
    if (tildeIdx !== -1) {
      label = label.slice(tildeIdx + 2).trim();
    }
    let name = label.replace(/&amp;/g, ' and ').replace(/&/g, ' and ');
    name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    name = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    name = name.replace(/^_+|_+$/g, '');
    if (/^[0-9]/.test(name)) name = '_' + name;
    return name || 'icon';
  },

  /**
   * @param {string} rawQuery
   * @returns {{ text: string; tags: Set<string>, isSet: boolean }}
   */
  parseSearchQuery(rawQuery) {
    const result = { text: '', tags: new Set(), isSet: false };
    const tokenRegex = /\b(?:is|tag|in):([a-z0-9-_]+)\b/gi;

    const cleanQuery = rawQuery.replace(tokenRegex, (_, tag) => {
      const lowerTag = tag.toLowerCase();
      if (lowerTag === 'set') {
        result.isSet = true;
        return '';
      }
      // Check if tag exists in config
      if (CONFIG.data.filters.includes(lowerTag)) {
        result.tags.add(lowerTag);
      }
      return '';
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
      CONFIG.data.filters.forEach((fid) => {
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
    if (id === 'unlabeled') {
      if (s.has('unlabeled')) {
        s.delete('unlabeled'); // Toggle Off
      } else {
        s.clear(); // Clear others
        s.add('unlabeled'); // Toggle On
      }
    } else {
      // Clicking a normal filter
      if (s.has('unlabeled')) {
        s.delete('unlabeled'); // Clear unlabeled if active
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
    const then = new Date(dateStr + 'T00:00:00');
    const diff = now.getTime() - then.getTime();
    const days = Math.floor(diff / 86400000);
    if (days > 30) {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
    if (days === 0) return 'Today';
    if (days === 1) return '1d';
    return `${days}d`;
  },

  /**
   * @param {number} num
   * @returns {string}
   */
  compactNumber(num) {
      if (num >= 1000000000) return parseFloat((num / 1000000000).toFixed(1)) + 'B';
      if (num >= 1000000) return parseFloat((num / 1000000).toFixed(1)) + 'M';
      if (num >= 1000) return parseFloat((num / 1000).toFixed(1)) + 'K';
      return num.toString();
  },

  /**
   * @param {Element | null | undefined} element
   * @param {boolean} hidden
   */
  setHidden(element, hidden) {
    if (!(element instanceof HTMLElement || element instanceof SVGElement)) {
      return;
    }
    element.classList.toggle('is-hidden', hidden);
  },

  /**
   * @param {Event} event
   */
  handleImageError(event) {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) return;

    const errorMode = target.dataset.errorMode;
    if (errorMode === 'hide-wrapper') {
      target.closest('.existing-svg-wrapper')?.classList.add('is-hidden');
      return;
    }

    target.classList.add('is-hidden');

    if (errorMode === 'show-next-fallback') {
      const fallback = target.nextElementSibling;
      if (fallback instanceof HTMLElement) {
        fallback.classList.remove('is-hidden');
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

    const domain = id.split('/')[0].split('.')[0];
    let idPrefix = '';
    if (!ISO_COUNTRIES.has(domain) && App.state.requestsGraph[id]) {
      const neighbors = Object.keys(App.state.requestsGraph[id]);
      if (neighbors.length === 1) {
        idPrefix = neighbors[0].split('/')[0].split('.')[0] + ' • ';
      } else if (neighbors.length > 1) {
        idPrefix = 'global • ';
      }
    }

    const isUnknown = app.drawable === 'unknown' || name === '(Unknown App)';
    const existingDrawable = App.state.existingSvgs
      ? App.state.existingSvgs.get(id)
      : null;
    const appNameClass = isUnknown ? 'app-name is-hidden' : 'app-name';

    const tagHtml = tags.map((tagId) => {
      const meta = App.state.filterMetadata.get(tagId);
      const label = meta ? meta.label : tagId;
      const desc = meta ? meta.description : '';
      return `<span class="status-pill status-${tagId}" title="${desc}">${label}</span>`;
    }).join('');

    const existingSvgHtml = existingDrawable
      ? `<span class="existing-svg-wrapper">
         <img src="https://raw.githubusercontent.com/LawnchairLauncher/lawnicons/develop/svgs/${existingDrawable}.svg" 
              class="existing-svg" 
              alt="Icon of '${existingDrawable}'"
              title="${existingDrawable}.svg"
              loading="lazy"
        data-error-mode="hide-wrapper" />
       </span>`
      : '';

    const iconHtml = isUnknown
      ? `<div class="fallback-icon-row">No Icon</div>`
      : `<img src="${iconUrl}" class="requested-icon" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'" alt="${name}" />
         <div class="fallback-icon-row" style="display:none">No Icon</div>`;

    const installsRaw = app.installs ? app.installs.replace(/[,+]/g, '') : null;
    const displayInstalls = installsRaw
      ? new Intl.NumberFormat('en', /** @type {Intl.NumberFormatOptions} */ {
        notation: 'compact',
      })
        .format(parseInt(installsRaw)) + '+'
      : '—';
    const installsTitle = installsRaw && installsRaw !== '0'
      ? `${app.installs} installs in Play Store`
      : 'Installs data unavailable';
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
          <input type="checkbox" ${
      isSelected ? 'checked' : ''
    } class="row-checkbox" tabindex="-1" />
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
              <span class="item-sub" title="${idPrefix}${id}">ID: ${idPrefix}${id}</span>
          </div>
          </div>
        </div>
        <div class="col req">${displayReq}${
      trendingDelta
        ? ` <span class="trend-indicator" title="Growth from latest email import.">↑${trendingDelta}</span>`
        : ''
    }</div>       
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
    const isUnknown = app.drawable === 'unknown';

    let contentHtml;
    const label = app.label === '(Unknown App)' ? id.split('/')[0] : app.label;

    if (isUnknown) {
      contentHtml = `
        <div class="fallback-icon-grid">
          <div class="fallback-icon-grid-title">No Icon</div>
          <div class="fallback-icon-grid-label">${label}</div>
        </div>
      `;
    } else {
      contentHtml =
        `<img src="${iconUrl}" loading="lazy" data-error-mode="show-next-fallback" alt="${label}" />
      <div class="fallback-icon-grid is-hidden">No Icon</div>`;
    }

    // Only show WIP tags on grid to avoid clutter
    const tagHtml = tags
      .filter((tagId) => tagId === 'wip')
      .map((tagId) => {
        const meta = App.state.filterMetadata.get(tagId);
        const label = meta ? meta.label : tagId;
        const desc = meta ? meta.description : `Tagged with "${tagId}"`;
        return `<span class="status-pill status-${tagId}" title="${desc}">${label}</span>`;
      })
      .join('');

    return `
      <div class="grid-card ${
      isSelected ? 'selected' : ''
    }" data-id="${id}" title="${label}\nFirst time: ${Utils.formatDate(app.firstAppearance)}"
        tabindex="0" role="checkbox" aria-checked="${isSelected}">
        ${contentHtml}
        <div class="grid-overlay-tags">${tagHtml}</div>
        <div class="grid-overlay-check">
          <input type="checkbox" ${isSelected ? 'checked' : ''} tabindex="-1">
        </div>
      </div>
    `;
  },

  /**
   * @param {{ drawable: string, name: string, component: string }} icon
   * @returns {string}
   */
  libraryIconCard(icon) {
    const svgUrl =
      `https://raw.githubusercontent.com/LawnchairLauncher/lawnicons/develop/svgs/${icon.drawable}.svg`;
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
   */
  libraryIconMenu(icon) {
    const svgUrl =
      `https://raw.githubusercontent.com/LawnchairLauncher/lawnicons/develop/svgs/${icon.drawable}.svg`;
    const githubUrl =
      `https://github.com/LawnchairLauncher/lawnicons/blob/develop/svgs/${icon.drawable}.svg`;
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
    return options.map((opt) => `
      <div class="ctx-item ${
      activeValue === opt.value ? 'active' : ''
    }" tabindex="0" role="menuitemradio" aria-checked="${
      activeValue === opt.value
    }" data-action="sort-option" data-value="${opt.value}">
        <span>${opt.label}</span>
      </div>
    `).join('');
  },

  /**
   * @param {AppEntry} app
   * @param {string} iconUrl
   * @returns {string}
   */
  contributionRow(app, iconUrl) {
    const id = app.componentName;
    const overrides = App.state.contributionOverrides[id] || {};
    const name = (overrides.label !== undefined ? overrides.label : app.label)
      .replace(/&/g, '&amp;');
    const pkg = id.split('/')[0];
    const originalDrawable = app.drawable;
    const isUnknown = originalDrawable === 'unknown' ||
      name === '(Unknown App)';

    const rawSvg = Utils.sanitizeDrawableName(name);
    const defaultSvg = (rawSvg === 'icon' || rawSvg === 'unknown')
      ? ''
      : rawSvg;
    const drawable = overrides.drawable !== undefined
      ? overrides.drawable
      : defaultSvg;

    const mode = (overrides.mode === 'link') ? 'link' : 'new';

    const existingIcon = App.state.existingIcons.find((icon) =>
      icon.drawable === drawable
    );
    const existsInLibrary = !!existingIcon;
    const isCustom = overrides.drawable && drawable !== defaultSvg;
    const svgHint = existsInLibrary
      ? 'Name in use.'
      : (isCustom ? 'Custom.' : 'Generated from name.');
    const libraryTitle = existingIcon
      ? `${existingIcon.name}\n${drawable}.svg`
      : 'Found in Lawnicons.';

    const libraryIconHtml = existsInLibrary
      ? `<span class="library-icon-card" title="${libraryTitle}">
                <img src="https://raw.githubusercontent.com/LawnchairLauncher/lawnicons/develop/svgs/${drawable}.svg" 
                      alt="${drawable}" 
                      loading="lazy"
                      onerror="this.parentElement.remove()" />
            </span>`
      : '';

    const iconHtml = isUnknown
      ? `<div class="fallback-icon-row">No Icon</div>`
      : `<img src="${iconUrl}" class="requested-icon" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'" alt="${name}" />
            <div class="fallback-icon-row" style="display:none">No Icon</div>`;

    return `
          <div class="contribution-row" data-id="${id}">
              <div class="col mode">
              <select class="chip mode-select" data-action="mode-select" data-id="${id}">
                <option value="new" ${
      mode === 'new' ? 'selected' : ''
    }>New</option>
                <option value="link" ${
      mode === 'link' ? 'selected' : ''
    }>Link</option>
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

  /** @param {AppEntry} app */
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
   * @param {[string, number, number, number, number][]} entries
   * @param {number} max
   * @returns {string}
   */
  domainStatsCard(entries, max) {
    return `<div class="card-chart has-bars">
      ${entries.map(([domain, done, requests, total, global]) => {
        const shortDomain = domain.length > 3 ? domain.slice(0, 3) : domain;
        const doneH = (done / max * 100).toFixed(0);
        const directH = ((requests - (global || 0)) / max * 100).toFixed(0);
        const globalH = ((global || 0) / max * 100).toFixed(0);
        return `<div class="domain-col" data-action="domain-filter" data-domain="${domain}" data-done="${done}" data-requests="${requests}" data-total="${total}" data-global="${global || 0}">
          <div class="domain-col-fill domain-col-global" style="height:${globalH}%"></div>
          <div class="domain-col-fill domain-col-requests" style="height:${directH}%"></div>
          <div class="domain-col-fill domain-col-done" style="height:${doneH}%"></div>
          <span class="chart-label">${shortDomain}</span>
        </div>`;
      }).join('')}
    </div>
    <div class="tooltip"></div>`;
  },

  /**
   * @param {string} domain
   * @param {number} done
   * @param {number} requests
   * @param {number} total
   * @param {string} mode
   * @param {number} extraValue
   * @param {number} population
   * @param {number} global
   * @returns {string}
   */
  domainStatsTooltip(domain, done, requests, total, mode, extraValue, population, global) {
    const pct = total ? (done / total * 100).toFixed(1) : 0;
    let extra = '';
    if (mode === 'local' && extraValue && population > 0) {
      const pctLocals = (extraValue / 1_000_000 / population * 100).toFixed(1);
      extra = `<div class="tooltip-value">Affects ${pctLocals}% locals</div>`;
    } else if (mode === 'coverage') {
      extra = `<div class="tooltip-value">${((requests / total) * 100).toFixed(1)}% uncovered</div>`;
    }
    let globalHtml = '';
    if (global > 0) {
      globalHtml = `<div class="tooltip-value">${global} non-geo</div>`;
    }
    return `<div class="tooltip-label">${domain}</div>
      ${globalHtml}
      <div class="tooltip-value">${requests - global} local ${requests - global === 1 ? 'request' : 'requests'}</div>
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
    <div class="tooltip"></div>`;
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
    if (added > 0) {
      html +=
        `<div class="tooltip-value tooltip-value-primary">${added} new</div>`;
    }
    if (fulfilled > 0) {
      html +=
        `<div class="tooltip-value tooltip-value-resolved">${fulfilled} fulfilled</div>`;
    }
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
      <div class="ctx-item ${
      isActive ? 'active' : ''
    }" data-action="mobile-filter-toggle" data-filter-id="${id}" tabindex="0" role="menuitemcheckbox" aria-checked="${isActive}">
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
    return matches.map((domain) => `
      <div class="autocomplete-item" tabindex="0" role="option" data-action="regex-suggestion" data-value="^${domain}\\.">^${domain}\\.</div>
    `).join('');
  },
};

const Components = {
  Toast: {
    /** @type {Set<string>} */
    activeToasts: new Set(),

    /**
     * @param {string} text
     * @param {"info" | "success" | "error"} [type]
     */
    show(text, type = 'info') {
      const key = `${text}-${type}`;
      if (this.activeToasts.has(key)) return;

      if (App.dom.toastBox.children.length >= 3) {
        const first = App.dom.toastBox.firstElementChild;
        if (first) this.remove(/** @type {HTMLElement} */ (first));
      }

      const el = document.createElement('div');
      el.className = `toast toast-${type}`;
      el.dataset.key = key;
      this.activeToasts.add(key);

      let iconSvg = '';
      if (type === 'error') iconSvg = `<svg><use href="#ic-error"/></svg>`;
      if (type === 'success') iconSvg = `<svg><use href="#ic-download"/></svg>`;

      el.innerHTML = `${iconSvg} ${text}`;
      App.dom.toastBox.appendChild(el);

      setTimeout(() => this.remove(el), 2500);
    },

    /**
     * @param {HTMLElement} el
     */
    remove(el) {
      if (el.classList.contains('hiding')) return;
      if (el.dataset.key) this.activeToasts.delete(el.dataset.key);
      el.classList.add('hiding');
      el.addEventListener('animationend', () => el.remove());
    },
  },

  Tooltip: {
    /**
     * Display and position a tooltip.
     * @param {HTMLElement} el - The tooltip DOM element.
     * @param {string} html - HTML content to display.
     * @param {number} left - Target X coordinate (usually mouse or anchor left).
     * @param {number} top - Target Y coordinate (usually mouse or anchor top).
    * @param {
    HTMLElement | null
  }[container] - Optional parent to bound positioning within.
     */
    show(el, html, left, top, container = null) {
      if (!el) return;

      // 1. Inject Content
      el.innerHTML = html;
      el.style.display = 'block';

      // 3. Collision Detection (Right Edge)
      const tooltipWidth = el.offsetWidth || 150;

      // If parent container is used, get its relative offset to window
      const containerLeft = container
        ? container.getBoundingClientRect().left
        : 0;

      if (containerLeft + left + tooltipWidth > innerWidth - 10) {
        // Flip to the left side of the cursor if no room on the right
        left = left - tooltipWidth - 12;
      }

      // 4. Apply Styles
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;

      el.classList.add('visible');
    },

    /**
     * Hide the tooltip.
     * @param {HTMLElement} el - The tooltip DOM element.
     */
    hide(el) {
      if (el) {
        el.classList.remove('visible');
        el.innerHTML = '';
      }
    },
  },
};

// ==========================================
// 6. ACTIONS
// ==========================================
const Actions = {
  /**
   * @param {string} id
   * @param {MouseEvent | KeyboardEvent | null} [event]
   */
  toggleSelection(id, event = null) {
    const s = App.state.selected;
    const currentIdx = App.state.currentData.findIndex((a) =>
      a.componentName === id
    );

    // Handle Shift Click
    if (
      event && /** @type {MouseEvent} */ (event).shiftKey &&
      App.state.lastSelectedId
    ) {
      const lastIdx = App.state.currentData.findIndex((a) =>
        a.componentName === App.state.lastSelectedId
      );

      getSelection()?.removeAllRanges();

      if (lastIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(lastIdx, currentIdx);
        const end = Math.max(lastIdx, currentIdx);
        const range = App.state.currentData.slice(start, end + 1);

        range.forEach((app) => {
          s.add(app.componentName);
          UI.updateItemVisuals(app.componentName);
        });

        UI.updateHeader();
        return;
      }
    }

    if (s.has(id)) s.delete(id);
    else s.add(id);

    App.state.lastSelectedId = id;

    UI.updateItemVisuals(id);
    UI.updateHeader();
    UI.updateSelectionBar();
  },

  /**
   * @param {boolean} isChecked
   */
  toggleSelectAll(isChecked) {
    if (isChecked) {
      App.state.currentData.forEach((app) =>
        App.state.selected.add(app.componentName)
      );
    } else {
      App.state.currentData.forEach((app) =>
        App.state.selected.delete(app.componentName)
      );
    }

    UI.render();
    scrollTo(0, scrollY);
  },

  /**
   * @param {SortKeys} key
   */
  toggleSortHeader(key) {
    const current = App.state.sort;
    const [currKey, currDir] = current.split('-');

    /** @type {Record<SortKeys, 'asc' | 'desc'>} */
    const defaults = {
      name: 'asc',
      req: 'desc',
      install: 'desc',
      time: 'desc',
    };

    let nextSort = '';
    if (currKey === key) {
      nextSort = `${key}-${currDir === 'asc' ? 'desc' : 'asc'}`;
    } else {
      nextSort = `${key}-${defaults[key]}`;
    }

    App.state.sort = nextSort;
    const opt = UI.sortOptions.find((o) => o.value === nextSort);
    App.dom.sortLabel.textContent = opt ? opt.label : nextSort;
    UI.render();
  },

  clearAllSelections() {
    if (App.state.selected.size === 0) return;
    document.querySelectorAll('.list-row.selected, .grid-card.selected')
      .forEach((el) => {
        el.classList.remove('selected');
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
    document.getElementById('sbMenu')?.hidePopover();
  },

  /**
   * @param {string[] | null} [ids]
   * @returns {AppEntry[]}
   */
  resolveApps(ids = null) {
    if (ids) {
      return ids.flatMap((id) => {
        const app = App.state.idMap.get(id);
        return app ? [app] : [];
      });
    }
    return App.data.filter((a) => App.state.selected.has(a.componentName));
  },

  /**
   * @param {string} value
   * @returns {string}
   */
  escapeXmlAttr(value) {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  },

  /**
   * @param {string} value
   * @returns {string}
   */
  escapeCommandLabel(value) {
    return value.replace(/&/g, '&amp;').replace(/'/g, "'\\''");
  },

  /**
   * @param {string} componentName
   * @param {string} drawable
   * @param {string} label
   * @returns {string}
   */
  buildAppFilterItem(componentName, drawable, label) {
    return `    <item component="ComponentInfo{${componentName}}" drawable="${drawable}" name="${
      Actions.escapeXmlAttr(label)
    }" />\n`;
  },

  /**
   * @param {string} txtCommands
   * @returns {string}
   */
  withIcontoolInstructions(txtCommands) {
    if (!txtCommands) return '';
    const instructions = [
      '1. Open your Lawnicons repository folder.',
      '2. Copy your SVGs to the svgs folder.',
      '3. Run the commands below from the repository root in your terminal.',
      '',
      'Make sure your branch is up-to-date. If not and you are familiar with git, use:',
      '  git reset --hard upstream/develop',
      '',
      'If sorting is needed:',
      '  python3 ./icontool.py sort',
      '',
      'Commands:',
    ].join('\n');
    return instructions + '\n' + txtCommands;
  },

  /**
   * @param {import('fflate').Zippable} iconDir
   * @param {string} targetDrawable
   * @param {string} sourceDrawable
   * @param {Promise<void>[]} fetchPromises
   */
  queueIconFetch(iconDir, targetDrawable, sourceDrawable, fetchPromises) {
    const fileName = `${targetDrawable}.png`;
    if (iconDir[fileName]) return;

    const url =
      `${CONFIG.data.assetsPath}${sourceDrawable}${CONFIG.data.iconExtension}`;
    const p = fetch(url)
      .then((r) => r.ok ? r.arrayBuffer() : null)
      .then((buf) => {
        if (buf) iconDir[fileName] = new Uint8Array(buf);
      })
      .catch(() => {});
    fetchPromises.push(p);
  },

  /**
   * @param {BlobPart} content
   * @param {string} fileName
   */
  downloadZip(content, fileName) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(
      new Blob([content], { type: 'application/zip' }),
    );
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  },

  /**
   * @param {string[] | null} ids
   */
  generateNamesAndIDs(ids = null) {
    const apps = Actions.resolveApps(ids);
    return apps.map((app) => `${app.label}\n${app.componentName}`).join('\n\n');
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
    const pkgs = Actions.resolveApps([...App.state.selected])
      .map((app) => app.componentName.split('/')[0]);
    Actions.copyToClipboard([...new Set(pkgs)].join('\n'));
    Actions.closeSbMenu();
  },

  /** @param {string} id */
  copyFilterEntry(id) {
    Actions.copyToClipboard(`"${id}",`);
  },

  /**
   * @param {string} text
   */
  copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      Components.Toast.show('Copied!');
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
    const apps = Actions.resolveApps(ids);
    let xml = '<resources>\n';
    apps.forEach((app) => {
      xml += `    ${Utils.generateXml(app)}\n`;
    });
    xml += '</resources>';
    return xml;
  },

  copyAppFilter() {
    Actions.copyToClipboard(Actions.generateAppFilterXml());
  },

  async downloadBundle() {
    if (typeof fflate === 'undefined') {
      Components.Toast.show('fflate library missing', 'error');
      return;
    }

    const selectedApps = Actions.resolveApps();
    if (selectedApps.length === 0) return;

    selectedApps.sort((a, b) => a.label.localeCompare(b.label));

    // UI Feedback
    Components.Toast.show('Processing...');
    document.body.style.cursor = 'wait';

    try {
      const mode = App.state.actionMode; // "new" | "link"

      // fflate uses a simple object mapping paths to Uint8Arrays/Strings
      /** @type {import('fflate').Zippable} */
      const zipData = {};

      // Only include icons folder in "new" mode
      if (mode === 'new') {
        zipData._icons = {};
      }

      let xmlAppFilter = '<resources>\n';
      let txtCommands = '';

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
      selectedApps.forEach((app) => {
        const cmp = app.componentName;
        const cmdLabel = Actions.escapeCommandLabel(app.label);

        // Resolve Drawable Name
        const appIdentity = app.componentName;
        let drawable = assignedDrawables.get(appIdentity);

        if (!drawable) {
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
        xmlAppFilter += Actions.buildAppFilterItem(cmp, drawable, app.label);

        // Commands
        const cmdType = 'link';
        const svgPath = `"${drawable}.svg"`;
        txtCommands +=
          `python3 ./icontool.py ${cmdType} ${svgPath} ${cmp} '${cmdLabel}'\n`;

        if (mode === 'new') {
          const iconDir =
            /** @type {import('fflate').Zippable} */ (zipData._icons);
          Actions.queueIconFetch(
            iconDir,
            drawable,
            app.drawable,
            fetchPromises,
          );
        }
      });

      // --- FINALIZE OUTPUTS ---
      await Promise.all(fetchPromises);

      // 1. XML
      xmlAppFilter += '</resources>';
      zipData['appfilter.xml'] = fflate.strToU8(xmlAppFilter);

      // 2. Config
      const filterConfig = {
        'label': 'Selection',
        'description': 'Sample description',
        'selection': selectedApps.map((a) => a.componentName),
      };
      zipData['filter_config.json'] = fflate.strToU8(
        JSON.stringify(filterConfig, null, 2),
      );

      // 3. Commands
      if (txtCommands) {
        zipData['icontool_commands.txt'] = fflate.strToU8(
          Actions.withIcontoolInstructions(txtCommands),
        );
      }

      // 4. Zip & Download
      const content =
        /** @type {BlobPart} */ (fflate.zipSync(zipData, { level: 6 }));

      const date = new Date().toISOString().slice(5, 10); // MM-DD
      const name = mode === 'new'
        ? `lawnicons-add-icons-${date}`
        : `lawnicons-link-app-ids-${date}`;
      Actions.downloadZip(content, `${name}.zip`);
    } catch (e) {
      console.error(e);
      Components.Toast.show('Failed to generate zip', 'error');
    } finally {
      document.body.style.cursor = 'default';
      App.dom.sbDownloadBtn.innerHTML = ICONS.download;
    }
  },

  async downloadContributionBundle() {
    if (typeof fflate === 'undefined') {
      Components.Toast.show('fflate library missing', 'error');
      return;
    }

    const list = App.state.contribution;
    if (list.length === 0) return;

    /** @type {import('fflate').Zippable} */
    const zipData = {};
    let xmlAppFilter = '<resources>\n';
    let txtCommands = '';

    const usedDrawables = new Set();
    /** @type {Promise<void>[]} */
    const fetchPromises = [];

    // Sort by label from inputs
    const sorted = [...list].sort((a, b) => {
      const rowA = document.querySelector(
        `.contribution-row[data-id="${a.componentName}"]`,
      );
      const rowB = document.querySelector(
        `.contribution-row[data-id="${b.componentName}"]`,
      );
      const nameA = /** @type {string} */ (/** @type {HTMLInputElement} */ (rowA
        ?.querySelector('.contribution-name-input'))?.value || a.label);
      const nameB = /** @type {string} */ (/** @type {HTMLInputElement} */ (rowB
        ?.querySelector('.contribution-name-input'))?.value || b.label);
      return nameA.localeCompare(nameB);
    });

    sorted.forEach((app) => {
      const row = document.querySelector(
        `.contribution-row[data-id="${app.componentName}"]`,
      );
      const nameInput =
        /** @type {HTMLInputElement | null} */ (row?.querySelector(
          '.contribution-name-input',
        ));
      const svgInput =
        /** @type {HTMLInputElement | null} */ (row?.querySelector(
          '.contribution-svg-input',
        ));

      const label = nameInput?.value || app.label;
      const drawable = svgInput?.value || app.drawable;
      const mode =
        (App.state.contributionOverrides[app.componentName]?.mode === 'link')
          ? 'link'
          : 'new';

      let uniqueDrawable = drawable;
      let c = 2;
      while (usedDrawables.has(uniqueDrawable)) {
        uniqueDrawable = `${drawable}_${c}`;
        c++;
      }
      usedDrawables.add(uniqueDrawable);

      xmlAppFilter += Actions.buildAppFilterItem(
        app.componentName,
        uniqueDrawable,
        label,
      );

      const cmdType = 'link';
      const svgPath = `"${drawable}.svg"`;
      const cmdLabel = Actions.escapeCommandLabel(label);
      txtCommands +=
        `python3 ./icontool.py ${cmdType} ${svgPath} ${app.componentName} '${cmdLabel}'\n`;

      if (mode === 'new') {
        if (!zipData['_icons']) zipData['_icons'] = {};
        const iconDir =
          /** @type {import('fflate').Zippable} */ (zipData['_icons']);
        Actions.queueIconFetch(
          iconDir,
          uniqueDrawable,
          app.drawable,
          fetchPromises,
        );
      }
    });

    xmlAppFilter += '</resources>';
    zipData['appfilter.xml'] = fflate.strToU8(xmlAppFilter);

    if (txtCommands) {
      zipData['icontool_commands.txt'] = fflate.strToU8(
        Actions.withIcontoolInstructions(txtCommands),
      );
    }

    await Promise.all(fetchPromises);
    const content =
      /** @type {BlobPart} */ (fflate.zipSync(zipData, { level: 6 }));

    const date = new Date().toISOString().slice(5, 10);
    Actions.downloadZip(content, `lawnicons-contribution-${date}.zip`);
  },
};

// ==========================================
// 7. DATA PROCESSING
// ==========================================
const Data = {
  /** @param {string} url
   * @param fallback
   */
  async fetchJson(url, fallback = {}) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      console.error(`Failed to fetch ${url}:`, err);
      return fallback;
    }
  },

  async init() {
    try {
      /** @type {InitTuple} */
      const [
        json,
        setsStats,
        domainStats,
        activityStats,
        ...filterObjects
      ] = await Promise.all([
        this.fetchJson(CONFIG.data.endpoint),
        this.fetchJson(CONFIG.data.setsStatsPath, {}),
        this.fetchJson(CONFIG.data.domainStatsPath, {}),
        this.fetchJson(CONFIG.data.activityStatsPath, []),
        ...CONFIG.data.filters.map((id) => this.fetchFilterData(id)),
      ]);

      App.data = json.apps;
      App.state.setsStats = setsStats;
      App.state.domainStats = domainStats;
      App.state.activityStats = activityStats;
      App.state.lastUpdate = json.lastUpdate;

      App.state.idMap = new Map();
      App.data.forEach((app) => App.state.idMap.set(app.componentName, app));

      App.state.appTags = new Map();
      App.state.filterMetadata = new Map();
      App.state.filterMetadata.set('plan', {
        label: 'Plan',
        description: 'Requests added to your contribution plan.',
      });

      this._processFilters(filterObjects, App.state.filterMetadata);

      // Update supported card counter
      const supportedObj = filterObjects[CONFIG.data.filters.indexOf('supported')];
      if (supportedObj?.done !== undefined) {
        const el = document.getElementById('supportedSub');
        if (el) {
          const done = supportedObj.done;
          const total = supportedObj.total;
          el.textContent = done === total
            ? `${Utils.compactNumber(done)} done`
            : `${Utils.compactNumber(done)} of ${Utils.compactNumber(total)} done`;
        }
      }

      App.state.screensData = await this.fetchJson(CONFIG.data.screensGraphPath, {});
      App.state.requestsGraph = await this.fetchJson(CONFIG.data.requestsGraphPath, {});
      
      // Load optional data
      await Promise.all([
        (async () => {
          /** @type {FulfillmentHistory[]} */
          const history = await this.fetchJson(
            'assets/stats/fulfillment_history.json',
            [],
          );
          if (!(history && history.length >= 3)) return;

          App.state._fulfillmentData = history;

          /** @type {number[]} */
          const ttfs = history
            .map((h) => (h.fulfilled - h.firstAppearance) / 86400)
            .sort((a, b) => a - b);

          const medianIndex = Math.floor(ttfs.length / 2);

          App.state.medianTTF = Math.round(ttfs[medianIndex]);
        })(),
        (async () => {
          /** @type {TrendingBaseline} */
          const baseline = await this.fetchJson(
            'assets/stats/trending_baseline.json',
            {},
          );
          if (
            !(baseline?.period_start?.snapshot &&
              baseline?.period_end?.snapshot)
          ) return;

          const startSnapshot = baseline.period_start.snapshot;
          const endSnapshot = baseline.period_end.snapshot;
          App.state.trendingDeltas = {};
          for (const [comp, endCount] of Object.entries(endSnapshot)) {
            const startCount = startSnapshot[comp] || 0;
            const delta = endCount - startCount;
            if (delta > 0) {
              App.state.trendingDeltas[comp] = delta;
            }
          }
        })(),
      ]).catch(() => {/* no-op */});
    } catch (error) {
      console.error('Critical initialization failure:', error);
      Components.Toast.show('Failed to load data', 'error');
      return;
    }

    this.loadUrlState();

    Promise.all([
      (async () => {
        App.state.lowQualityData = await this.fetchJson(
          'assets/qa_issues/review_issues.json',
          [],
        );
        UI.updateLowQualityBadge();
      })(),
      this.loadAppfilterXml(),
    ]).finally(() => {
      UI.init();
      UI.updateLowQualityBadge();
      UI.buildQuickPickQueue();
      UI.renderQuickPick();
    });
  },

  /**
   * @param {Filter[]} filterObjects
   * @param {Map<string, FilterMetadata>} filterMetadata
   */
  _processFilters(filterObjects, filterMetadata) {
    filterObjects.forEach((obj, index) => {
      if (!obj) return;
      const id = CONFIG.data.filters[index];

      filterMetadata.set(id, {
        label: obj.label,
        description: obj.description,
      });

      const filter = obj[id];

      if (id === 'unlabeled') {
        this.computeUnlabeled(id);
      } else if (filter && Array.isArray(filter)) {
        filter.forEach((item) => {
          const appId = typeof item === 'string' ? item : item.id;
          this.addTag(appId, id);
          if (typeof item === 'object' && item.existing_drawable) {
            if (!App.state.existingSvgs) App.state.existingSvgs = new Map();
            App.state.existingSvgs.set(appId, item.existing_drawable);
          }
        });
      }
    });
  },

  async loadAppfilterXml() {
    /** @type {Icon[]} */
    let icons = [];

    try {
      const response = await fetch('assets/appfilter.xml');
      if (!response.ok) throw new Error('Failed to fetch appfilter.xml');
      const xmlText = await response.text();

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const items = xmlDoc.querySelectorAll('item');

      items.forEach((item) => {
        const component = item.getAttribute('component') || '';
        const drawable = item.getAttribute('drawable') || '';
        const name = item.getAttribute('name') || '';

        if (drawable && component) {
          const match = component.match(/ComponentInfo\{([^}]+)}/);
          const componentName = match ? match[1] : component;

          icons.push({
            drawable: drawable,
            name: name,
            component: componentName,
          });
        }
      });
    } catch (e) {
      console.error('Error loading appfilter:', e);
      icons = [];
    }

    App.state.existingIcons = icons;

    if (App.state.existingIcons.length === 0) return;

    if (App.state.search) UI.renderIconLibrary();
    if (App.state.contributionActive) UI.renderContributionMode();
  },

  /**
   * @param {string} id
   * @returns {Promise<any>}
   */
  async fetchFilterData(id) {
    if (id === 'unlabeled') {
      return {
        label: 'Unlabeled',
        description: 'Requests with medium to high complexity.',
        unlabeled: [],
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
    App.data.forEach((app) => {
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
    if (!App.state.appTags.has(id)) App.state.appTags.set(id, new Set());
    App.state.appTags.get(id)?.add(tag);
  },

  process() {
    let data = App.data;
    const s = App.state;

    // Search
    const query = Utils.parseSearchQuery(s.search);
    const activeFilters = new Set([...s.activeFilters, ...query.tags]);

    // Filter
    if (activeFilters.size > 0) {
      data = data.filter((app) => {
        const id = app.componentName;
        const tags = s.appTags.get(id);
        if (!tags) return false;
        return Array.from(activeFilters).every((fid) => tags.has(fid));
      });
    }

    // Text Search
    if (query.text) {
      if (s.regexMode) {
        try {
          const regex = new RegExp(query.text, 'i');
          data = data.filter((a) => {
            if (regex.test(a.label) || regex.test(a.componentName)) return true;
            const domainMatch = s.search.match(/^\^([a-z]+)\\\./);
            if (domainMatch) {
              const searchDomain = domainMatch[1];
              const comp = a.componentName;
              const graph = App.state.requestsGraph;
              if (graph[comp]) {
                const neighbors = Object.keys(graph[comp]);
                return neighbors.some(n => n.split('/')[0].split('.')[0] === searchDomain);
              }
            }
            return false;
          });
        } catch {
          data = [];
        }
      } else {
        const term = query.text.toLowerCase();
        data = data.filter((a) =>
          a.label.toLowerCase().includes(term) ||
          a.componentName.toLowerCase().includes(term)
        );
      }
    }

    // Set filter
    if (query.isSet) {
      data = data.filter((app) =>
        App.state.setsStats[app.componentName.split('/')[0]] !== undefined
      );
    }

    // Sort
    if (s.sort === 'underrated') {
      data = data.filter((app) =>
        app.requestCount >= 10 && Utils.parseInstalls(app.installs) > 0
      );
    }

    data = [...data];
    if (s.sort === 'rand') {
      for (let i = data.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [data[i], data[j]] = [data[j], data[i]];
      }
    } else {
      /** @type {(app: AppEntry) => number} */
      const getPop = (app) => {
        const pkg = app.componentName.split('/')[0];
        return App.state.setsStats[pkg] || app.requestCount;
      };

      /** @type {Record<string, (a: AppEntry, b: AppEntry) => number>} */
      const sorters = {
        'req-desc': (a, b) =>
          getPop(b) - getPop(a) ||
          a.componentName.split('/')[0].localeCompare(
            b.componentName.split('/')[0],
          ),
        'req-asc': (a, b) =>
          getPop(a) - getPop(b) ||
          a.componentName.split('/')[0].localeCompare(
            b.componentName.split('/')[0],
          ),
        'trending': (a, b) => {
          const deltaA = App.state.trendingDeltas[a.componentName] || 0;
          const deltaB = App.state.trendingDeltas[b.componentName] || 0;
          return deltaB - deltaA || getPop(b) - getPop(a);
        },
        'install-desc': (a, b) =>
          Utils.parseInstalls(b.installs) - Utils.parseInstalls(a.installs) ||
          getPop(b) - getPop(a) ||
          a.componentName.split('/')[0].localeCompare(
            b.componentName.split('/')[0],
          ),
        'install-asc': (a, b) =>
          Utils.parseInstalls(a.installs) - Utils.parseInstalls(b.installs) ||
          getPop(b) - getPop(a) ||
          a.componentName.split('/')[0].localeCompare(
            b.componentName.split('/')[0],
          ),
        'name-asc': (a, b) =>
          a.label.localeCompare(b.label) || getPop(b) - getPop(a),
        'name-desc': (a, b) =>
          b.label.localeCompare(a.label) || getPop(b) - getPop(a),
        'time-desc': (a, b) =>
          b.firstAppearance - a.firstAppearance || getPop(b) - getPop(a),
        'time-asc': (a, b) =>
          a.firstAppearance - b.firstAppearance || getPop(b) - getPop(a),
        'underrated': (a, b) =>
          Heuristics.calculateUnderratedScore(b) -
            Heuristics.calculateUnderratedScore(a) ||
          (App.state.setsStats[b.componentName.split('/')[0]] ||
              b.requestCount) -
            (App.state.setsStats[a.componentName.split('/')[0]] ||
              a.requestCount),
      };
      if (sorters[s.sort]) data.sort(sorters[s.sort]);
    }

    App.state.currentData = data;
  },

  loadUrlState() {
    const params = new URLSearchParams(location.search);
    if (params.has('q')) {
      App.state.search = params.get('q') || '';
      App.dom.inputSearch.value = App.state.search;
      Utils.setHidden(App.dom.clearBtn, !App.state.search);
    }
    if (params.has('view')) {
      const v = params.get('view');
      if (v === 'list' || v === 'grid') App.state.view = v;
    }
    if (params.has('sort')) {
      App.state.sort = params.get('sort') || DEFAULTS.sort;
      const opt = UI.sortOptions.find((o) => o.value === App.state.sort);
      App.dom.sortLabel.textContent = opt ? opt.label : App.state.sort;
    }
    if (params.has('regex')) {
      App.state.regexMode = true;
      App.dom.regexBtn.classList.add('active');
    }
    if (params.has('filters')) {
      params.get('filters')?.split(',').forEach((t) => {
        if (CONFIG.data.filters.includes(t)) App.state.activeFilters.add(t);
      });
    }
    if (params.has('tab')) {
      const tab = params.get('tab');
      if (tab === 'screens') App.state.activeTab = 'screens';
    }
    if (params.has('screen')) {
      const screenId = params.get('screen');
      if (App.state.screensData[screenId]) {
        App.state.activeScreenFilter = App.state.screensData[screenId];
        App.state.activeTab = 'requests';
      }
    }
    if (params.has('page')) {
      const page = params.get('page');
      if (page === 'low-quality-icons') {
        App.state.lowQualityActive = true;
      } else if (page === 'contribution-plan') {
        App.state.contributionActive = true;
      }
    }
  },

  syncUrlState() {
    const s = App.state;
    const params = new URLSearchParams(location.search);

    if (s.search) params.set('q', s.search);
    else params.delete('q');
    if (s.view !== DEFAULTS.view) params.set('view', s.view);
    else params.delete('view');
    if (s.sort !== DEFAULTS.sort) params.set('sort', s.sort);
    else params.delete('sort');
    if (s.regexMode) params.set('regex', '1');
    else params.delete('regex');

    if (s.activeFilters.size > 0) {
      const sortedFilters = Array.from(s.activeFilters).sort();
      params.set('filters', sortedFilters.join(','));
    } else {
      params.delete('filters');
    }

    if (s.activeTab !== 'requests') params.set('tab', s.activeTab);
    else params.delete('tab');
    
    if (s.activeScreenFilter) {
      const screenEntry = Object.entries(s.screensData).find(([_, ids]) => 
        ids.length === s.activeScreenFilter.length && 
        ids.every(id => s.activeScreenFilter.includes(id))
      );
      if (screenEntry) params.set('screen', screenEntry[0]);
    } else {
      params.delete('screen');
    }    

    if (App.state.lowQualityActive) {
      params.set('page', 'low-quality-icons');
    } else if (App.state.contributionActive) {
      params.set('page', 'contribution-plan');
    } else {
      params.delete('page');
    }

    const queryString = params.toString();
    const newUrl = queryString
      ? `${location.pathname}?${queryString}`
      : location.pathname;

    if (newUrl !== location.pathname + location.search) {
      history.replaceState({}, '', newUrl);
    }
  },
};

// ==========================================
// 8. HEURISTICS
// Pure mathematical formulas for ranking.
// ==========================================
const Heuristics = {
  /** @param {AppEntry} app */
  calculateUnderratedScore(app) {
    const req = app.requestCount || 1;
    const inst = Utils.parseInstalls(app.installs) || 1;
    return req / inst;
  },
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
    { value: 'req-desc', label: 'Most requested' },
    { value: 'req-asc', label: 'Least requested' },
    { value: 'install-desc', label: 'Most installed' },
    { value: 'install-asc', label: 'Least installed' },
    { value: 'underrated', label: 'Underrated' },
    { value: 'time-desc', label: 'Newest' },
    { value: 'time-asc', label: 'Oldest' },
    { value: 'name-asc', label: 'Name (A-Z)' },
    { value: 'name-desc', label: 'Name (Z-A)' },
    { value: 'trending', label: 'Trending' },
    { value: 'rand', label: 'Random' },
  ],

  screenSortOptions: [
    { value: 'req-desc', label: 'Most requested' },
    { value: 'req-asc', label: 'Least requested' },
    { value: 'inst-desc', label: 'Most installed' },
    { value: 'inst-asc', label: 'Least installed' },
    { value: 'missing-desc', label: 'Most icons' },
    { value: 'missing-asc', label: 'Least icons' },
    { value: 'easy-desc', label: 'Easiest' },
    { value: 'easy-asc', label: 'Hardest' },
  ],

  init() {
    if (App.state.regexMode) {
      App.dom.regexBtn.classList.add('active');
    }

    const savedList = localStorage.getItem('lawnicons_contribution');
    if (savedList) {
      try {
        /** @type {AppEntry[]} */
        const parsed = JSON.parse(savedList);
        const before = parsed.length;
        App.state.contribution = parsed.filter((app) =>
          App.data.some((d) => d.componentName === app.componentName)
        );

        const savedOverrides = localStorage.getItem(
          'lawnicons_contribution_overrides',
        );
        if (savedOverrides) {
          /** @type {Record<string, Overrides>} */
          const parsedOverrides = JSON.parse(savedOverrides);
          App.state.contributionOverrides = {};
          for (const [id, overrides] of Object.entries(parsedOverrides)) {
            if (App.state.contribution.some((a) => a.componentName === id)) {
              App.state.contributionOverrides[id] = overrides;
            }
          }
        }

        if (App.state.contribution.length < before) {
          this.saveContribution();
        }

        App.state.contribution.forEach((app) => {
          const tags = App.state.appTags.get(app.componentName) || new Set();
          tags.add('plan');
          App.state.appTags.set(app.componentName, tags);
        });
      } catch { /* no-op */ }
    }

    if (performance.navigation.type === 0) {
      localStorage.setItem('lawnicons_contribution_active', 'false');
    }

    const savedActive = localStorage.getItem('lawnicons_contribution_active');
    if (savedActive === 'true') {
      App.state.contributionActive = true;
      App.dom.contributionBtn?.classList.add('active');
    }

    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === App.state.activeTab);
    });    

    this.updateContributionBadge();
    this.renderDomainStats();
    this.renderQuickPick();
    this.renderActivityCard();
    this.generateFilters();
    this.initObserver();
    this.initRegexAutocomplete();
    this.handleEvents();
    this.render();
  },

  handleEvents() {
    document.getElementById('lowQualityBtn')?.addEventListener('click', () => {
      App.state.lowQualityActive = !App.state.lowQualityActive;
      if (!App.state.lowQualityActive) {
        App.dom.header.textContent = 'Lawnicons';
        App.dom.contributionBtn.style.display = '';
        document.getElementById('lowQualityBtn')?.classList.remove('active');
      } else {
        App.state.contributionActive = false;
        App.dom.contributionBtn.classList.remove('active');
      }
      this.render();
      Data.syncUrlState();
    });

    App.dom.contributionBtn?.addEventListener('click', () => {
      if (
        !App.state.contributionActive && App.state.contribution.length === 0
      ) {
        Components.Toast.show(
          'Contribution plan is empty. Add at least 1 request.',
        );
        return;
      }
      App.state.contributionActive = !App.state.contributionActive;
      App.dom.contributionBtn.classList.toggle(
        'active',
        App.state.contributionActive,
      );
      if (!App.state.contributionActive) {
        App.dom.header.textContent = 'Lawnicons';
        App.dom.sentinel.style.display = '';
        App.dom.contributionBtn.style.display = '';
      }
      this.saveContribution();
      this.render();
      Data.syncUrlState();
    });

    document.querySelectorAll("[data-action='domain-stats-mode']").forEach(
      (el) => {
        el.addEventListener('click', () => {
          const e = /** @type HTMLElement */ (el);
          const mode = e.dataset.mode;
          if (!mode) return;
          App.state.domainStatsMode = mode;
          document.querySelectorAll("[data-action='domain-stats-mode']")
            .forEach((sp) => {
              const s = /** @type HTMLElement */ (sp);
              const span = s.closest('span');
              if (span) {
                span.classList.toggle('active', s.dataset.mode === mode);
              }
            });
          this.renderDomainStats();
        });
      },
    );

    App.dom.mainTabs?.addEventListener('click', (e) => {
      const tab = /** @type {HTMLElement} */ (e.target).closest('.tab');
      if (!tab) return;
      App.state.activeTab = tab.dataset.tab;
      if (App.state.activeTab === 'requests') {
        App.state.activeScreenFilter = null;
      }      
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      this.render();
    });    

    const activeMode = App.state.domainStatsMode;
    const activeSvg = document.querySelector(
      `[data-action='domain-stats-mode'][data-mode='${activeMode}']`,
    );
    if (activeSvg) {
      const span = activeSvg.closest('span');
      if (span) span.classList.add('active');
    }

    document.getElementById('quickPickDownload')?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        const queue = App.state.quickPickMode === 'easy'
          ? App.state._quickPickEasy
          : App.state._quickPickMiddle;
        if (!queue || !queue.length) return;
        const app = queue[App.state._lastQuickPickIdx || 0];
        App.state.selected.clear();
        App.state.selected.add(app.componentName);
        Actions.downloadBundle();
      },
    );

    document.querySelectorAll("[data-action='quick-pick-mode']").forEach(
      (el) => {
        el.addEventListener('click', () => {
          const e = /** @type HTMLElement */ (el);
          const mode = e.dataset.mode;
          if (!mode) return;
          App.state.quickPickMode = mode;
          document.querySelectorAll("[data-action='quick-pick-mode']").forEach(
            (sp) => {
              const s = /** @type HTMLElement */ (sp);
              const span = s.closest('span');
              if (span) {
                span.classList.toggle('active', s.dataset.mode === mode);
              }
            },
          );
          this.pickRandomQuickPick();
        });
      },
    );

    let resizeTimer = 0;
    addEventListener('resize', () => {
      this.renderDomainStats();
      this.renderActivityCard();
      if (App.state.activeTab !== 'screens') return;
        clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => UI.layoutMasonry(), 100)
    });

    App.dom.container.addEventListener('error', (event) => {
      Utils.handleImageError(event);
    }, true);

    App.dom.inputSearch.addEventListener('input', (e) => {
      const target = /** @type HTMLInputElement */ (e.target);
      const val = target.value;
      App.state.search = val;
      Utils.setHidden(App.dom.clearBtn, val.length === 0);
      this.renderIconLibrary();
      this.render();
    });

    App.dom.clearBtn.addEventListener('click', () => {
      App.state.search = '';
      App.dom.inputSearch.value = '';
      Utils.setHidden(App.dom.clearBtn, true);
      App.dom.inputSearch.focus();
      App.dom.regexBtn.style.display = '';
      this.renderIconLibrary();
      this.render();
    });

    App.dom.sortBtn.addEventListener('click', () => this.showSortMenu());

    App.dom.screenSortBtn?.addEventListener('click', () => {
      const menu = App.dom.sortMenu;
      menu.innerHTML = UI.screenSortOptions.map(opt => `
        <div class="ctx-item ${App.state.screenSort === opt.value ? 'active' : ''}" 
            data-action="screen-sort-option" data-value="${opt.value}">
          <span>${opt.label}</span>
        </div>
      `).join('');
      const rect = App.dom.screenSortBtn.getBoundingClientRect();
      menu.style.left = rect.left + 'px';
      menu.style.top = (rect.bottom + 8) + 'px';
      menu.showPopover();
    });    

    App.dom.viewBtn.addEventListener('click', () => {
      App.state.view = App.state.view === 'list' ? 'grid' : 'list';
      App.dom.viewIconList.classList.toggle(
        'active',
        App.state.view === 'list',
      );
      App.dom.viewIconGrid.classList.toggle(
        'active',
        App.state.view === 'grid',
      );
      this.render();
    });

    App.dom.viewIconList.classList.add('active');
    App.dom.viewIconGrid.classList.remove('active');

    App.dom.regexBtn.addEventListener('click', () => {
      App.state.regexMode = !App.state.regexMode;
      App.dom.regexBtn.classList.toggle('active', App.state.regexMode);
      this.render();
    });

    App.dom.headerCheck.addEventListener(
      'change',
      (e) =>
        Actions.toggleSelectAll(
          (/** @type {HTMLInputElement} */ (e.target)).checked,
        ),
    );

    App.dom.mobileFilterBtn.addEventListener('click', () => {
      this.showMobileFilterPopover();
    });

    document.getElementById('sbContributeBtn')?.addEventListener(
      'click',
      () => {
        App.state.selected.forEach((id) => {
          const app = App.state.idMap.get(id);
          if (
            app && !App.state.contribution.some((a) => a.componentName === id)
          ) {
            App.state.contribution.push(app);
            const tags = App.state.appTags.get(id.toString()) || new Set();
            tags.add('plan');
            App.state.appTags.set(id.toString(), tags);
          }
        });
        this.saveContribution();
        const count = App.state.selected.size;
        Components.Toast.show(
          `${count} icon${count !== 1 ? 's' : ''} added to contribution plan.`,
        );
        Actions.clearAllSelections();
        this.render();
      },
    );

    App.dom.sbDownloadBtn.addEventListener('click', () => {
      App.state.actionMode = 'new';
      Actions.downloadBundle();
    });

    App.dom.sbMenuBtn.addEventListener('click', (e) => {
      const menu = document.getElementById('sbMenu');
      if (!menu) return;

      menu.innerHTML = Templates.selectionBarMenu();
      const rect =
        /** @type {DOMRect} */ (/** @type {HTMLElement} */ (e.currentTarget)
          .getBoundingClientRect());

      menu.style.visibility = 'hidden';
      menu.showPopover();

      const x = rect.right - menu.offsetWidth;
      const y = rect.top - menu.offsetHeight - 8;

      menu.style.left = `${x}px`;
      menu.style.top = `${y}px`;
      menu.style.transformOrigin = 'bottom right';
      menu.style.visibility = 'visible';
    });

    document.getElementById('sbHint')?.addEventListener('click', () => {
      Actions.clearAllSelections();
    });

    const headers = {
      '.col.name': 'name',
      '.col.req': 'req',
      '.col.install': 'install',
      '.col.first': 'time',
    };

    Object.entries(headers).forEach(([selector, key]) => {
      const el =
        /** @type {HTMLElement} */ (App.dom.listHeader.querySelector(selector));
      if (el) {
        el.title = 'Click to sort';
        el.onclick = () =>
          Actions.toggleSortHeader(/** @type {SortKeys} */ (key));
      }
    });

    document.addEventListener('click', (el) => {
      const e = /** @type {MouseEvent} */ (el);
      const target = /** @type {HTMLElement} */ (e.target);

      const actionEl =
        /** @type {HTMLElement | null} */ (target.closest('[data-action]'));
      if (actionEl) {
        const action = actionEl.dataset.action;

        if (action === 'download-png') {
          const url = actionEl.dataset.url;
          const drawable = actionEl.dataset.drawable;
          if (url && drawable) {
            fetch(url)
              .then((r) => r.blob())
              .then(async (blob) => {
                try {
                  // @ts-expect-error: File System Access API
                  const handle = await showSaveFilePicker({
                    suggestedName: `${drawable}.png`,
                    types: [
                      {
                        description: 'PNG Image',
                        accept: { 'image/png': ['.png'] },
                      },
                    ],
                  });
                  const writable = await handle.createWritable();
                  await writable.write(blob);
                  await writable.close();
                } catch (e) {
                  const err = /** @type {Error} */ (e);
                  if (err.name === 'AbortError') {
                    console.log('User cancelled the save dialog.');
                    return;
                  }

                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `${drawable}.png`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                }
              })
              .catch(() =>
                Components.Toast.show('Failed to download PNG', 'error')
              );
          }
          return;
        }

        if (action === 'library-download-svg') {
          const url = actionEl.dataset.url;
          const drawable = actionEl.dataset.drawable;
          if (url && drawable) {
            fetch(url)
              .then((r) => r.blob())
              .then((blob) => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `${drawable}.svg`;
                a.click();
                URL.revokeObjectURL(a.href);
              })
              .catch(() =>
                Components.Toast.show('Failed to download SVG', 'error')
              );
          }
          UI.closeContextMenu();
          return;
        }

        if (action === 'library-copy-svg') {
          const drawable = actionEl.dataset.drawable;
          if (drawable) {
            const svgUrl =
              `https://raw.githubusercontent.com/LawnchairLauncher/lawnicons/develop/svgs/${drawable}.svg`;
            fetch(svgUrl)
              .then((r) => r.text())
              .then((svgText) => {
                Actions.copyToClipboard(svgText);
              })
              .catch(() => {
                Components.Toast.show('Failed to copy SVG', 'error');
              });
          }
          UI.closeContextMenu();
          return;
        }

        if (action === 'library-copy-name') {
          const drawable = actionEl.dataset.drawable;
          if (drawable) {
            Actions.copyToClipboard(drawable);
          }
          UI.closeContextMenu();
          return;
        }

        if (action === 'open-link') {
          const url = actionEl.dataset.url;
          if (url) {
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.click();
            UI.closeContextMenu();
          }
          return;
        }

        if (action === 'restore-original') {
          const id = actionEl.dataset.id;
          const app = App.state.contribution.find((a) =>
            a.componentName === id
          );
          if (app && id) {
            delete App.state.contributionOverrides[id];
            UI.saveContribution();
            UI.render();
          }
          UI.closeContextMenu();
          return;
        }

        if (action === 'remove-from-contribution') {
          const id = actionEl.dataset.id ?? '';
          App.state.contribution = App.state.contribution.filter((a) =>
            a.componentName !== id
          );
          const tags = App.state.appTags.get(id.toString());
          if (tags) tags.delete('plan');
          if (App.state.contribution.length === 0) {
            App.state.contributionActive = false;
            App.state.activeFilters.delete('plan');
            App.dom.contributionBtn.style.display = '';
            App.dom.contributionBtn.classList.remove('active');
          }
          UI.saveContribution();
          UI.render();
          UI.closeContextMenu();
          return;
        }

        if (action === 'copy-appfilter-entry') {
          const id = actionEl.dataset.id;
          if (id) Actions.copyAppFilterEntry(id);
          return;
        }

        if (action === 'copy-name-id-entry') {
          const id = actionEl.dataset.id;
          if (id) Actions.copyNamesAndIDs([id]);
          return;
        }

        if (action === 'copy-pkg-entry') {
          const id = actionEl.dataset.id;
          if (id) Actions.copyPkgName(id);
          return;
        }

        if (action === 'copy-filter-entry') {
          const id = actionEl.dataset.id;
          if (id) Actions.copyFilterEntry(id);
          return;
        }

        if (action === 'sb-download-metadata') {
          App.state.actionMode = 'link';
          Actions.downloadBundle();
          Actions.closeSbMenu();
          return;
        }

        if (action === 'sb-copy-appfilter') {
          Actions.copyAppFilter();
          Actions.closeSbMenu();
          return;
        }

        if (action === 'sb-copy-nameid') {
          Actions.copyNamesAndIDs();
          Actions.closeSbMenu();
          return;
        }

        if (action === 'sb-copy-pkgs') {
          Actions.copySelectedPkgs();
          return;
        }

        if (action === 'sb-copy-filter-entries') {
          const entries = [...App.state.selected]
            .map((id) => `"${id}",`)
            .join('\n');
          Actions.copyToClipboard(entries);
          Actions.closeSbMenu();
          return;
        }

        if (action === 'sort-option') {
          const value = actionEl.dataset.value;
          if (!value) return;
          App.state.sort = value;
          App.dom.sortLabel.textContent = actionEl.textContent.trim() || value;
          App.dom.sortMenu.hidePopover();
          this.render();
          return;
        }

        if (action === 'screen-sort-option') {
          const value = actionEl.dataset.value;
          if (!value) return;
          App.state.screenSort = value;
          App.dom.screenSortLabel.textContent = actionEl.textContent.trim();
          App.dom.sortMenu.hidePopover();
          this.render();
          return;
        }

        if (action === 'clear-screen-filter') {
          App.state.activeScreenFilter = null;
          this.render();
          return;
        }

        if (action === 'filter-tag-toggle') {
          const id = actionEl.dataset.filterId;
          if (!id) return;
          const s = App.state.activeFilters;
          Utils.mutualExclusiveTags(id, s);
          this.render();
          return;
        }

        if (action === 'mobile-filter-toggle') {
          const id = actionEl.dataset.filterId;
          if (!id) return;
          const s = App.state.activeFilters;
          Utils.mutualExclusiveTags(id, s);
          this.render();
          this.showMobileFilterPopover();
          return;
        }

        if (action === 'regex-suggestion') {
          const value = actionEl.dataset.value;
          if (!value) return;
          App.dom.inputSearch.value = value;
          App.dom.inputSearch.focus();
          App.dom.inputSearch.dispatchEvent(new Event('input'));
          this.hideRegexAutocomplete();
          return;
        }

        if (action === 'sort-header-toggle') {
          const key = actionEl.dataset.sortKey;
          if (key) Actions.toggleSortHeader(/** @type {SortKeys} */ (key));
          return;
        }

        if (action === 'domain-filter') {
          const domain = actionEl.dataset.domain;
          if (!domain) return;

          App.state.regexMode = true;
          App.dom.regexBtn.classList.add('active');
          App.state.search = `^${domain}\\.`;
          App.dom.inputSearch.value = App.state.search;
          Utils.setHidden(App.dom.clearBtn, false);
          UI.render();
          return;
        }

        if (action === 'issue-jump') {
          const issueId = actionEl.dataset.issue;
          if (issueId) UI.jumpToIssue(issueId);
          return;
        }

        if (action === 'mode-select') {
          const id =
            /** @type {'link' | 'new' | undefined} */ (actionEl.dataset.id);
          const e = /** @type HTMLInputElement */ (actionEl);
          const mode =
            /** @type {'link' | 'new' | 'set-all-new' | 'set-all-link'} */ (e
              .value);

          if (mode === 'set-all-new' || mode === 'set-all-link') {
            const newMode = mode === 'set-all-new' ? 'new' : 'link';
            App.state.contribution.forEach((a) => {
              if (!App.state.contributionOverrides[a.componentName]) {
                App.state.contributionOverrides[a.componentName] = {};
              }
              App.state.contributionOverrides[a.componentName].mode = newMode;
            });
            UI.saveContribution();
            UI.render();
            return;
          }

          if (!id) return;

          if (!App.state.contributionOverrides[id]) {
            App.state.contributionOverrides[id] = {};
          }
          App.state.contributionOverrides[id].mode = mode;
          UI.saveContribution();
          UI.updateIssues();
          return;
        }
      }

      const input = target.closest(
        '.contribution-name-input, .contribution-svg-input',
      );
      if (input) {
        input.classList.remove('issue-highlight');
      }

      const libraryCard =
        /** @type {HTMLElement} */ (target.closest('.library-icon-card'));
      if (libraryCard) {
        e.stopPropagation();
        const drawable = libraryCard.dataset.drawable;
        const icon = App.state.existingIcons.find((i) =>
          i.drawable === drawable
        );
        if (icon) this.showLibraryIconMenu(e, icon);
        return;
      }

      const trigger = target.closest('.ctx-trigger');
      if (trigger) {
        if (App.state.contributionActive) {
          e.stopPropagation();
          const row = /** @type {HTMLElement} */ (trigger.closest('[data-id]'));
          if (!row) return;
          const id = row.dataset.id;
          const app = App.state.contribution.find((a) =>
            a.componentName === id
          );
          if (app) {
            App.dom.rowMenu.innerHTML = Templates.contributionRowMenu(app);
            const rect = trigger.getBoundingClientRect();
            const menu = App.dom.rowMenu;
            menu.style.visibility = 'hidden';
            menu.showPopover();
            const w = menu.offsetWidth || 220;
            let x = rect.right - w;
            let y = rect.bottom + 4;
            if (x < 0) x = rect.right - w;
            if (y + 200 > innerHeight) y = rect.top - 200 - 4;
            menu.style.left = `${x}px`;
            menu.style.top = `${y}px`;
            menu.style.transformOrigin = 'top right';
            menu.style.visibility = 'visible';
          }
          return;
        }
        e.stopPropagation();
        const row = /** @type {HTMLElement} */ (trigger.closest('[data-id]'));
        if (!row) return;
        const id = row.dataset.id;
        if (!id) return;
        const app = App.state.idMap.get(id);
        if (app) this.showRowMenu(e, app);
        return;
      }

      if (target.closest('a')) {
        e.stopPropagation();
        return;
      }

      if (
        this.regexListEl && !this.regexListEl.contains(target) &&
        target !== App.dom.inputSearch
      ) {
        this.hideRegexAutocomplete();
      }

      const item = /** @type {HTMLElement} */ (target.closest('[data-id]'));
      if (!item || !item.dataset.id) return;
      if (!App.state.contributionActive) {
        Actions.toggleSelection(item.dataset.id, /** @type {MouseEvent} */ (e));
      }
    });

    document.addEventListener('keydown', (el) => {
      const e = /** @type {KeyboardEvent} */ (el);
      const target = /** @type {HTMLElement} */ (e.target);

      // Esc on search input — remove focus
      if (e.key === 'Escape' && target === App.dom.inputSearch) {
        App.dom.inputSearch.blur();
        return;
      }

      if (
        target.tagName === 'INPUT' && /** @type {HTMLInputElement} */
        (target).type !== 'checkbox'
      ) return;

      // 1. Focus Search (/ or Ctrl + K)
      if (e.key === '/' || (e.ctrlKey || e.metaKey) && e.key === 'k') {
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
        if (App.state.selected.size > 0) Actions.clearAllSelections();
      }

      // 4. Focus selection bar (Ctrl + Enter)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (App.state.selected.size > 0) {
          e.preventDefault();
          App.dom.sbDownloadBtn.focus();
          App.dom.sbDownloadBtn.click();
        }
      }
    });

    App.dom.container.addEventListener(
      'keydown',
      (/** @type {KeyboardEvent} */ e) => {
        const target = /** @type {HTMLElement | null} */ (e.target);
        if (!target) return;

        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

        // --- 1. Selection & Actions (Enter/Space) ---
        if (!(e.ctrlKey || e.metaKey) && e.key === 'Enter' || e.key === ' ') {
          // A. Row/Card Selection
          if (
            target.classList.contains('list-row') ||
            target.classList.contains('grid-card')
          ) {
            e.preventDefault(); // Prevent page scroll on Space
            const id = target.dataset.id;
            if (!id) return;
            Actions.toggleSelection(id, e); // Pass event for Shift logic
          }

          // B. Context Menu Trigger
          if (target.classList.contains('ctx-trigger')) {
            e.preventDefault();
            e.stopPropagation();
            const row =
              /** @type {HTMLElement | null} */ (target.closest('[data-id]'));
            if (!row) return;
            const id = row.dataset.id;
            if (!id) return;
            const app = App.state.idMap.get(id);
            if (!app) return;

            const rect = target.getBoundingClientRect();
            const fakeEvent = {
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + rect.height / 2,
            };

            UI.showRowMenu(fakeEvent, app);
          }
          return; // Done with Enter/Space
        }

        // --- 2. Navigation (Arrow Keys) ---
        if (
          ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
        ) {
          const item =
            /** @type {HTMLElement | null} */ (target.closest('[data-id]'));
          if (!item) return;

          e.preventDefault(); // Prevent scrolling

          // Get only valid items (ignore loaders/sentinels)
          const items = /** @type {HTMLElement[]} */ (Array.from(
            App.dom.container.querySelectorAll('[data-id]'),
          ));
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
      },
    );

    const menus = ['rowMenu', 'mobileFilterMenu', 'sortMenu'];
    menus.forEach((id) => {
      const menu = /** @type {HTMLElement} */ (App
        .dom[/** @type {keyof typeof App.dom} */ (id)]);
      if (!menu) return;

      if (menu) {
        menu.addEventListener('toggle', (e) => {
          if (e.newState === 'closed') {
            // Wait for CSS transition
            setTimeout(() => menu.innerHTML = '', 200);
          }
        });
      }

      menu.addEventListener('keydown', (e) => {
        const items = /** @type {HTMLElement[]} */ (Array.from(
          menu.querySelectorAll('.ctx-item'),
        ));
        const index = items.indexOf(
          /** @type {HTMLElement} */ (document.activeElement),
        );

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
          (/** @type {HTMLElement} */ (document.activeElement)).click();
        } else if (e.key === 'Tab') {
          e.preventDefault();
          this.closeContextMenu();
        }
      });
    });
  },

  initObserver() {
    this.observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        const more = this.loadMore();
        App.dom.sentinel.style.opacity = more ? '1' : '0';
      }
    }, { rootMargin: '400px' });
    this.observer.observe(App.dom.sentinel);
  },

  render() {
    document.getElementById('lowQualityBtn')?.parentElement?.classList.remove('is-hidden');

    if (App.state.lowQualityActive) {
      this.renderLowQualityMode();
      return;
    }

    if (App.state.contributionActive) {
      this.renderContributionMode();
      return;
    }

    document.getElementById('lowQualityBtn')?.classList.remove('active');
    const lowQualityBackBtn = document.getElementById('lowQualityBackBtn');
    if (lowQualityBackBtn) lowQualityBackBtn.remove();

    const backBtn = document.getElementById('contributionBackBtn');
    if (backBtn) backBtn.remove();

    document.querySelector('.header-icon')?.classList.remove('is-hidden');
    document.getElementById('search-wrapper')?.classList.remove('is-hidden');
    App.dom.header.textContent = 'Lawnicons';
    App.dom.contributionBtn.style.display = '';
    this.updateContributionBadge();
    this.updateLowQualityBadge();

    const headerRight = document.querySelector('.header-right');
    headerRight?.querySelectorAll('a:not(#appfilterLink)')?.forEach((a) =>
      a.classList.remove('is-hidden')
    );
    const appfilterLink = document.getElementById('appfilterLink');
    if (appfilterLink) appfilterLink.classList.add('is-hidden');

    document.querySelector('.cards-row')?.classList.remove('is-hidden');
    document.getElementById('mainCards')?.classList.remove('is-hidden');
    const contribCards = document.getElementById('contributionCards');
    if (contribCards) contribCards.classList.add('is-hidden');

    const s = App.state;
    App.dom.container.innerHTML = '';
    App.dom.container.className = s.view === 'grid' ? 'grid-container' : '';

    this.generateFilters();
    this.syncFilterTagState();
    Data.process();
    if (s.activeScreenFilter) {
      s.currentData = s.currentData.filter(app => s.activeScreenFilter.includes(app.componentName));
    }    
    Data.syncUrlState();
    this.updateHeader();
    this.renderIconLibrary();

    const desc = document.getElementById('supportedDesc');
    const link = document.getElementById('supportedLink');
    Utils.setHidden(desc, false);
    Utils.setHidden(link, false);

    const tabsEl = document.getElementById('mainTabs');

    if (App.state.activeTab === 'screens') {
      document.querySelector('.controls')?.classList.add('is-hidden');
      tabsEl.classList.remove('is-hidden');
      App.dom.screenSortBtn.classList.remove('is-hidden');
      const activeLabel = UI.screenSortOptions.find(o => o.value === s.screenSort)?.label || 'Most requested';
      App.dom.screenSortLabel.textContent = activeLabel;
      App.dom.listHeader.style.display = 'none';
      App.dom.sentinel.style.display = 'none';
      this.renderScreens();
      return;
    }

    if (s.currentData.length === 0) {
      App.dom.container.innerHTML = Templates.emptyState();
      this.updateHeader();
      App.dom.listHeader.style.display = s.view === 'list' ? 'grid' : 'none';
      App.dom.sentinel.style.display = '';
      App.dom.screenSortBtn.classList.add('is-hidden');
      tabsEl.classList.remove('is-hidden');
      document.querySelector('.controls')?.classList.remove('is-hidden');
      return;
    }

    s.renderedCount = 0;
    this.loadMore();

    App.dom.listHeader.style.display = s.view === 'list' ? 'grid' : 'none';
    App.dom.sentinel.style.display = '';
    App.dom.screenSortBtn.classList.add('is-hidden');
    tabsEl.classList.remove('is-hidden');
    document.querySelector('.controls')?.classList.remove('is-hidden');
  },

  /**
   * @returns {boolean}
   */
  loadMore() {
    const s = App.state;
    if (s.renderedCount >= s.currentData.length) return false;

    const end = Math.min(
      s.renderedCount + CONFIG.ui.batchSize,
      s.currentData.length,
    );
    const batch = s.currentData.slice(s.renderedCount, end);
    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement('div');

    batch.forEach((app) => {
      const id = app.componentName;
      const isSelected = s.selected.has(id);
      const iconUrl =
        `${CONFIG.data.assetsPath}${app.drawable}${CONFIG.data.iconExtension}`;

      let html;
      const tags = Utils.getTagsForApp(id);
      if (s.view === 'list') {
        html = Templates.listRow(
          app,
          isSelected,
          tags,
          iconUrl,
          Utils.formatDate(app.firstAppearance),
          Utils.formatDate(app.lastRequested),
        );
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

  layoutMasonry() {
    const container = App.dom.container;
    const cards = [...container.children].filter(c => c instanceof HTMLElement);
    if (cards.length === 0) return;

    cards.forEach(c => {
      c.style.position = '';
      c.style.width = '';
      c.style.left = '';
      c.style.top = '';
    });

    const gap = 16;
    const containerParent = container.parentElement;
    if (!containerParent) return;
    const containerWidth = containerParent.getBoundingClientRect().width;
    const columnCount = Math.max(1, Math.floor((containerWidth + gap) / (216 + gap)));
    const cardWidth = (containerWidth - (columnCount - 1) * gap) / columnCount;

    container.style.position = 'relative';
    const colHeights = new Array(columnCount).fill(0);

    cards.forEach(card => {
      card.style.position = 'absolute';
      card.style.width = `${cardWidth}px`;
      const shortestCol = colHeights.indexOf(Math.min(...colHeights));
      card.style.left = `${shortestCol * (cardWidth + gap)}px`;
      card.style.top = `${colHeights[shortestCol]}px`;
      colHeights[shortestCol] += card.getBoundingClientRect().height + gap;
    });

    container.style.height = `${Math.max(...colHeights)}px`;
  },  

  showSortMenu() {
    const menu = App.dom.sortMenu;
    const options = UI.sortOptions.filter((opt) => {
      return !(opt.value === 'trending' &&
        Object.keys(App.state.trendingDeltas).length === 0);
    });

    menu.innerHTML = Templates.sortMenuItems(options, App.state.sort);

    menu.querySelectorAll('.ctx-item').forEach((i) => {
      const item = /** @type {HTMLElement} */ (i);
      item.onclick = () => {
        if (item.dataset.value) App.state.sort = item.dataset.value;
        App.dom.sortLabel.textContent = item.textContent.trim();
        menu.hidePopover();
        this.render();
      };
    });

    const rect = App.dom.sortBtn.getBoundingClientRect();
    menu.style.left = rect.left + 'px';
    menu.style.top = (rect.bottom + 8) + 'px';
    menu.showPopover();
  },

  generateFilters() {
    const c = App.dom.filterBox;
    if (!c) return;
    c.innerHTML = '';

    if (App.state.activeScreenFilter && App.state.activeTab === 'requests') {
      const btn = document.createElement('button');
      btn.className = 'tag tag-screen chip active';
      const screenEntry = Object.entries(App.state.screensData).find(([_, ids]) => 
        ids.length === App.state.activeScreenFilter.length && 
        ids.every(id => App.state.activeScreenFilter.includes(id))
      );
      const screenId = screenEntry ? screenEntry[0].replace(/^scr-0+/, 'scr-') : 'screen';
      btn.textContent = screenId;
      btn.title = 'Clear screen filter';
      btn.dataset.action = 'clear-screen-filter';
      c.insertBefore(btn, c.firstChild);
    }    

    CONFIG.data.filters.forEach((id) => {
      let count = 0;
      App.state.appTags.forEach((tags) => {
        if (tags.has(id)) count++;
      });
      if (count === 0) return;

      const meta = App.state.filterMetadata.get(id);
      if (!meta) return;

      const btn = document.createElement('button');
      btn.className = `tag tag-${id} chip`;
      btn.textContent = meta.label;
      btn.title = meta.description || `Filter by ${meta.label}`;
      btn.dataset.action = 'filter-tag-toggle';
      btn.dataset.filterId = id;
      btn.setAttribute('aria-pressed', String(App.state.activeFilters.has(id)));
      if (App.state.activeFilters.has(id)) btn.classList.add('active');
      c.appendChild(btn);
    });
  },

  syncFilterTagState() {
    const c = App.dom.filterBox;
    if (!c) return;

    const active = App.state.activeFilters;
    c.querySelectorAll('[data-filter-id]').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const id = el.dataset.filterId;
      if (!id) return;
      const isActive = active.has(id);
      el.classList.toggle('active', isActive);
      el.setAttribute('aria-pressed', String(isActive));
    });
  },

  /**
   * @param {string} id
   */
  updateItemVisuals(id) {
    const isSelected = App.state.selected.has(id);
    document.querySelectorAll(`[data-id="${id}"]`).forEach((el) => {
      el.classList.toggle('selected', isSelected);
      const cb = /** @type {HTMLInputElement} */ (el.querySelector(
        "input[type='checkbox']",
      ));
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
      const fullDate = new Date(App.state.lastUpdate + 'T00:00:00')
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      displayText +=
        ` • <a href="https://github.com/LawnchairLauncher/lawnicons-requests-dashboard" target="_blank" title="Last update: ${fullDate}">${timeAgo}</a>`;
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
    App.state.currentData.forEach((app) => {
      if (App.state.selected.has(app.componentName)) count++;
    });

    hc.checked = count === total;
    hc.indeterminate = count > 0 && count < total;

    const filterCount = App.state.activeFilters.size;
    if (filterCount > 0) {
      App.dom.mobileFilterCount.textContent = `(${filterCount})`;
    } else {
      App.dom.mobileFilterCount.textContent = '';
    }

    this.updateSelectionBar();
  },

  updateSelectionBar() {
    const count = App.state.selected.size;
    const bar = App.dom.sbBar;

    if (count > 0) {
      bar.classList.add('visible');
      App.dom.sbCount.textContent = `${count} icon${count !== 1 ? 's' : ''}`;
    } else {
      bar.classList.remove('visible');
    }
  },

  renderScreens() {
    const s = App.state;
    App.dom.container.innerHTML = '';
    App.dom.container.className = 'screens-grid';
    App.dom.sbBar.classList.remove('visible');

    const screens = s.screensData;
    if (!screens || Object.keys(screens).length === 0) {
      App.dom.container.innerHTML = '<div class="empty-state"><h3>No screens yet</h3><p>Screens will appear after email parsing.</p></div>';
      return;
    }

    let entries = Object.entries(screens).map(([id, ids]) => {
      let totalReq = 0;
      let totalInst = 0;
      let easyCount = 0;
      let supportedCount = 0;
      const previewIcons = [];

      ids.forEach(comp => {
        const app = s.idMap.get(comp);
        if (!app) return;
        totalReq += app.requestCount || 0;
        const inst = Utils.parseInstalls(app.installs);
        if (inst > 0) totalInst += inst;
        const tags = s.appTags.get(comp);
        if (tags?.has('easy')) easyCount++;
        if (tags?.has('supported')) supportedCount++;
        if (previewIcons.length < 9) {
          previewIcons.push({
            drawable: app.drawable,
            label: app.label,
          });
        }
      });

      return {
          id,
          ids,
          count: ids.length,
          sumReq: totalReq,
          sumInst: totalInst,
          easyPct: ids.length ? Math.round(easyCount / ids.length * 100) : 0,
          supportedCount,
          previewIcons,
      };
    });

    const [sortKey, sortDir] = s.screenSort.split('-');
    entries.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'missing') cmp = a.count - b.count;
      else if (sortKey === 'req') cmp = a.sumReq - b.sumReq;
      else if (sortKey === 'inst') cmp = a.sumInst - b.sumInst;
      else if (sortKey === 'easy') cmp = a.easyPct - b.easyPct;
      return sortDir === 'desc' ? -cmp : cmp;
    });

    // Apply search and filters to screen cards
    const query = Utils.parseSearchQuery(s.search);
    const activeFilters = new Set([...s.activeFilters, ...query.tags]);

    if (query.text) {
      entries = entries.filter(screen => {
        return screen.ids.some(comp => {
          const app = s.idMap.get(comp);
          if (!app) return false;

          if (s.regexMode) {
            try {
              const regex = new RegExp(query.text, 'i');
              return regex.test(app.label) || regex.test(app.componentName);
            } catch { return false; }
          } else {
            const term = query.text.toLowerCase();
            return app.label.toLowerCase().includes(term) ||
              app.componentName.toLowerCase().includes(term);
          }
        });
      });
    }

    if (entries.length === 0) {
      App.dom.container.innerHTML = '<div class="empty-state"><svg><use href="#ic-search"/></svg><h3>No screens found</h3><p>Try adjusting your search or filters.</p></div>';
      App.dom.container.className = '';
      return;
    }    

    if (!App.state._screenCardCache) App.state._screenCardCache = new Map();

    entries.forEach(screen => {
      let card = App.state._screenCardCache.get(screen.id);

      if (!card) {
        card = document.createElement('div');
        card.className = 'screen-card';
        card.dataset.screenId = screen.id;

        const cols = Math.min(screen.previewIcons.length, 3);
        let previewHtml = '<div class="screen-preview" style="grid-template-columns:repeat(' + cols + ',56px);">';
        screen.previewIcons.forEach(icon => {
          previewHtml += '<img src="' + CONFIG.data.assetsPath + icon.drawable + CONFIG.data.iconExtension + '" class="screen-preview-icon" loading="lazy" onerror="this.style.display=\'none\'" alt="' + icon.label + '" />';
        });
        previewHtml += '</div>';

        const iconLabel = screen.count === 1 ? 'icon' : 'icons';
        const reqLabel = screen.count === 1 ? 'request' : 'requests';
        const supLabel = screen.supportedCount === 1 ? 'supported icon' : 'supported icons';

        card.innerHTML = 
          (screen.supportedCount > 0 ? '<span class="status-pill status-supported screen-card-supported">' + screen.supportedCount + ' ' + supLabel + '</span>' : '') +
          previewHtml +
          (function() {
            const countries = new Set();
            const graph = App.state.requestsGraph;
            if (graph) {
              screen.ids.forEach(comp => {
                const domain = comp.split('/')[0].split('.')[0];
                if (ISO_COUNTRIES.has(domain)) {
                  countries.add(domain);
                } else if (graph[comp]) {
                  const geoNeighbors = Object.keys(graph[comp]).filter(n => ISO_COUNTRIES.has(n.split('/')[0].split('.')[0]));
                  if (geoNeighbors.length > 0) {
                    geoNeighbors.forEach(n => countries.add(n.split('/')[0].split('.')[0]));
                  } else {
                    countries.add('us');
                  }
                } else {
                  countries.add('us');
                }
              });
            }
            const arr = [...countries].sort();
            const countryStr = arr.length > 3 ? 'global' : arr.join(', ');
            return '<div class="screen-card-header"><span>' + screen.id + '</span>' + (countryStr ? '<span class="screen-card-countries">' + countryStr + '</span>' : '') + '</div>';
          })() +
          '<div class="screen-card-description">' + screen.count + ' ' + iconLabel + '</div>' +
          '<div class="screen-card-description">' + Utils.compactNumber(screen.sumReq) + ' ' + reqLabel + '</div>' +
          (screen.sumInst > 0 ? '<div class="screen-card-description">' + Utils.compactNumber(screen.sumInst) + ' installs</div>' : '') +
          (screen.easyPct > 0 ? '<div class="screen-card-description">' + screen.easyPct + '% easy</div>' : '');

        card.addEventListener('click', () => {
          App.state.activeTab = 'requests';
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          document.querySelector('.tab[data-tab="requests"]')?.classList.add('active');
          App.state.activeScreenFilter = screen.ids;
          Data.syncUrlState();
          this.render();
        });

        App.state._screenCardCache.set(screen.id, card);
      }

      App.dom.container.appendChild(card);
    });

    this.layoutMasonry();
  },

  renderLowQualityMode() {
    document.querySelector('.header-icon')?.classList.add('is-hidden');
    document.querySelector('.controls')?.classList.add('is-hidden');
    document.getElementById('iconLibraryResults')?.classList.add('is-hidden');
    document.getElementById('search-wrapper')?.classList.add('is-hidden');
    document.getElementById('mainTabs')?.classList.add('is-hidden');
    document.getElementById('lowQualityBtn')?.parentElement?.classList.add('is-hidden');
    App.dom.screenSortBtn.classList.add('is-hidden');
    App.dom.listHeader.style.display = 'none';
    App.dom.sentinel.style.display = 'none';
    App.dom.contributionBtn.style.display = 'none';
    const badge = document.getElementById('contributionCountBadge');
    if (badge) badge.style.display = 'none';
    document.getElementById('lowQualityBtn')?.classList.add('active');

    App.dom.header.textContent = 'Low quality icons';
    App.dom.headerCount.textContent = '';
    App.dom.sbBar.classList.remove('visible');
    App.dom.container.className = '';

    if (!document.getElementById('lowQualityBackBtn')) {
      document.querySelector('.header-left')?.insertAdjacentHTML(
        'afterbegin',
        `
              <button class="header-link back-btn" id="lowQualityBackBtn" title="Back to requests">
                  <svg><use href="#ic-arrow-back"/></svg>
              </button>
          `,
      );
      const newLowQABack = document.getElementById('lowQualityBackBtn');
      if (newLowQABack) {
        newLowQABack.onclick = () => {
          App.state.lowQualityActive = false;
          document.getElementById('lowQualityBtn')?.classList.remove('active');
          this.render();
          Data.syncUrlState();
        };
      }
    }

    const headerRight = document.querySelector('.header-right');
    const count = App.state.lowQualityData
      ? App.state.lowQualityData.length
      : 0;
    App.dom.headerCount.textContent = `${count} icon${count !== 1 ? 's' : ''}`;
    headerRight?.querySelectorAll('a')?.forEach((a) =>
      a.classList.add('is-hidden')
    );

    if (!document.getElementById('appfilterLink')) {
      headerRight?.insertAdjacentHTML(
        'afterbegin',
        `
              <a id="appfilterLink" href="https://raw.githubusercontent.com/LawnchairLauncher/lawnicons/refs/heads/develop/app/assets/appfilter.xml" class="header-link" title="Current appfilter.xml">
                  <svg><use href="#ic-code-xml"/></svg>
              </a>
          `,
      );
    } else {
      document.getElementById('appfilterLink')?.classList.remove('is-hidden');
    }

    document.getElementById('mainCards')?.classList.add('is-hidden');
    App.dom.container.innerHTML = '';

    fetch('assets/qa_issues/review_issues.json')
      .then((r) => r.json())
      .then((d) => {
        const data = /** @type {ReviewIssues[]} */ (d);
        App.state.lowQualityData = data;
        const count = data.length;
        App.dom.headerCount.textContent = `${count} icon${
          count !== 1 ? 's' : ''
        }`;
        if (data.length === 0) {
          App.state.lowQualityActive = false;
          document.getElementById('lowQualityBtn')?.classList.remove('active');
          Components.Toast.show('All existing icons look good.');
          this.render();
          return;
        }

        if (count === 0) {
          App.dom.container.innerHTML = '';
          return;
        }

        // Sort by issue count descending
        data.sort(
          /** @type {(a: ReviewIssues, b: ReviewIssues) => number} */
          (a, b) =>
            b.issues.length - a.issues.length ||
            a.drawable.localeCompare(b.drawable),
        );

        // Build cards
        let html = '';
        data.forEach((item) => {
          const svgUrl =
            `https://raw.githubusercontent.com/LawnchairLauncher/lawnicons/develop/svgs/${item.drawable}.svg`;
          const issueList = item.issues.map((i) =>
            `<div class="item-sub">${i}</div>`
          ).join('');
          html += `
                      <div class="library-icon-card" data-drawable="${item.drawable}" title="${
            item.issues.join('\n')
          }">
                          <img src="${svgUrl}" alt="${item.drawable}" loading="lazy" onerror="this.parentElement.remove()" />
                          <div class="qa-issues">${issueList}</div>
                      </div>
                  `;
        });

        App.dom.container.innerHTML = html;
        App.dom.container.className = 'qa-container';
      })
      .catch(() => {
        App.state.lowQualityData = [];
        App.dom.headerCount.textContent = '0 icons';
        UI.updateLowQualityBadge();
      });
  },

  updateLowQualityBadge() {
    const btn = document.getElementById('lowQualityBtn');
    const wrapper = btn?.parentElement;
    const badge = document.getElementById('lowQualityCountBadge');
    if (!btn || !wrapper) return;

    if (App.state.lowQualityActive || App.state.contributionActive) {
      wrapper.classList.add('is-hidden');
      if (badge) badge.style.display = 'none';
      return;
    }

    const count = App.state.lowQualityData ? App.state.lowQualityData.length : 0;
    if (count > 0) {
      wrapper.classList.remove('is-hidden');
      if (badge) {
        badge.textContent = count.toString();
        badge.style.display = 'flex';
      }
    } else {
      wrapper.classList.add('is-hidden');
      if (badge) badge.style.display = 'none';
    }
  },

  renderContributionMode() {
    document.querySelector('.header-icon')?.classList.add('is-hidden');
    document.querySelector('.controls')?.classList.add('is-hidden');
    document.getElementById('iconLibraryResults')?.classList.add('is-hidden');
    document.getElementById('search-wrapper')?.classList.add('is-hidden');
    document.getElementById('mainTabs')?.classList.add('is-hidden');
    document.getElementById('lowQualityBtn')?.parentElement?.classList.add('is-hidden');
    App.dom.screenSortBtn.classList.add('is-hidden');
    const contributionCountBadge = document.getElementById(
      'contributionCountBadge',
    );
    if (contributionCountBadge) contributionCountBadge.style.display = 'none';
    App.dom.listHeader.style.display = 'none';
    App.dom.sentinel.style.display = 'none';

    App.dom.contributionBtn.style.display = 'none';

    App.dom.header.textContent = 'Contribution plan';

    if (!document.getElementById('contributionBackBtn')) {
      document.querySelector('.header-left')?.insertAdjacentHTML(
        'afterbegin',
        `
              <button class="header-link back-btn" id="contributionBackBtn" title="Back to requests">
                  <svg><use href="#ic-arrow-back"/></svg>
              </button>
          `,
      );
      const newContributionBackBtn = document.getElementById(
        'contributionBackBtn',
      );
      if (newContributionBackBtn) {
        newContributionBackBtn.onclick = () => {
          App.state.contributionActive = false;
          App.dom.contributionBtn.style.display = '';
          App.dom.contributionBtn.classList.remove('active');
          this.saveContribution();
          this.render();
          Data.syncUrlState();
        };
      }
    }

    App.dom.container.className = 'contribution-container';
    App.dom.sbBar.classList.remove('visible');

    const headerRight = document.querySelector('.header-right');
    headerRight?.querySelectorAll('a').forEach((a) =>
      a.classList.add('is-hidden')
    );

    if (!document.getElementById('appfilterLink')) {
      headerRight?.insertAdjacentHTML(
        'afterbegin',
        `
          <a id="appfilterLink" href="https://raw.githubusercontent.com/LawnchairLauncher/lawnicons/refs/heads/develop/app/assets/appfilter.xml" class="header-link" title="Current appfilter.xml">
            <svg><use href="#ic-code-xml"/></svg>
          </a>
        `,
      );
    } else {
      document.getElementById('appfilterLink')?.classList.remove('is-hidden');
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

    document.getElementById('mainCards')?.classList.add('is-hidden');

    const cardsRow = document.querySelector('.cards-row');
    cardsRow?.classList.remove('is-hidden');

    if (!document.getElementById('contributionCards')) {
      cardsRow?.insertAdjacentHTML(
        'beforeend',
        `
          <div id="contributionCards" style="display:contents;">
            <div class="card" id="contributionDomainsCard">
              <canvas id="domainsPie"></canvas>
              <div class="tooltip" id="domainsTooltip"></div>
            </div>
            <div class="issues-list" id="contributionIssuesList"></div>
          </div>
        `,
      );
    } else {
      document.getElementById('contributionCards')?.classList.remove(
        'is-hidden',
      );
    }

    // Draw domains pie chart
    /** @type {Record<string, number> } */
    const domainCounts = {};
    App.state.contribution.forEach((app) => {
      const pkg = app.componentName.split('/')[0];
      const domain = pkg.split('.')[0];
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    });

    const canvas =
      /** @type {HTMLCanvasElement} */ (document.getElementById('domainsPie'));
    const tooltip = document.getElementById('domainsTooltip');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const entries = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);
      const total = entries.reduce((s, e) => s + e[1], 0);

      const dpr = devicePixelRatio || 1;
      const size = 88;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';
      ctx.scale(dpr, dpr);

      let angle = -Math.PI / 2;
      const style = getComputedStyle(document.documentElement);
      /** @type {(string | CanvasGradient | CanvasPattern)[]} */
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

        const label = entry[0].length <= 4
          ? entry[0]
          : entry[0][0] + '...' + entry[0][entry[0].length - 1];

        if (pct >= 0.2) {
          const labelR = size / 2 * 0.6;
          const lx = size / 2 + Math.cos(midAngle) * labelR;
          const ly = size / 2 + Math.sin(midAngle) * labelR;
          ctx.fillStyle = getComputedStyle(document.documentElement)
            .getPropertyValue('--surface').trim();
          ctx.font = '600 10px ' +
            getComputedStyle(document.documentElement).getPropertyValue(
              '--font-main',
            ).trim();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, lx, ly);
        }

        angle += slice;
      });

      canvas.onmousemove = (e) => {
        if (!tooltip) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        const dist = Math.sqrt(x * x + y * y);
        const r = size / 2 - 2;

        if (dist > r) {
          Components.Tooltip.hide(tooltip);
          return;
        }

        let mouseAngle = Math.atan2(y, x);
        if (mouseAngle < -Math.PI / 2) mouseAngle += Math.PI * 2;

        let a = -Math.PI / 2;
        for (let i = 0; i < entries.length; i++) {
          const slice = (entries[i][1] / total) * Math.PI * 2;
          if (mouseAngle >= a && mouseAngle < a + slice) {
            const pct = ((entries[i][1] / total) * 100).toFixed(1);
            const html = `<div class="tooltip-label">${
              entries[i][0]
            }</div><div class="tooltip-value">${entries[i][1]} icon${
              entries[i][1] !== 1 ? 's' : ''
            } (${pct}%)</div>`;
            const card = document.getElementById('contributionDomainsCard');
            const cardRect = card?.getBoundingClientRect();
            if (!cardRect) return;
            const left = e.clientX - cardRect.left + 12;
            const top = e.clientY - cardRect.top;
            Components.Tooltip.show(tooltip, html, left, top, card);
            break;
          }
          a += slice;
        }
      };

      canvas.onmouseleave = () => {
        if (tooltip) Components.Tooltip.hide(tooltip);
      };
    }

    const issues = [
      { id: 'nameinuse', label: 'SVG name in use' },
      { id: 'nameconflict', label: 'Duplicate in plan' },
      { id: 'emptyfields', label: 'Empty fields' },
      { id: 'invalidsvg', label: 'Bad chars in SVG' },
      { id: 'startdigit', label: 'No _ before digit' },
    ];

    /** @type {{ [key: string]: number }} */
    const issueCounts = {};
    issues.forEach((issue) => issueCounts[issue.id] = 0);

    App.state.contribution.forEach((app) => {
      const ov = App.state.contributionOverrides[app.componentName] || {};
      const name = ov.label !== undefined ? ov.label : app.label;
      const rawSvg = Utils.sanitizeDrawableName(name);
      const defaultSvg = (rawSvg === 'icon' || rawSvg === 'unknown')
        ? ''
        : rawSvg;
      const drawable = ov.drawable !== undefined ? ov.drawable : defaultSvg;

      if (
        drawable &&
        App.state.existingIcons.some((icon) => icon.drawable === drawable)
      ) {
        issueCounts.nameinuse++;
      }

      if (
        drawable && App.state.contribution.filter((a) => {
            const aOv = App.state.contributionOverrides[a.componentName] || {};
            const aName = aOv.label !== undefined ? aOv.label : a.label;
            const aDrawable = aOv.drawable !== undefined
              ? aOv.drawable
              : Utils.sanitizeDrawableName(aName);
            return aDrawable === drawable;
          }).length > 1
      ) {
        issueCounts.nameconflict++;
      }

      if (!name.trim()) issueCounts.emptyfields++;
      if (!drawable.trim()) issueCounts.emptyfields++;
      if (drawable && /[^a-z0-9_]/.test(drawable)) issueCounts.invalidsvg++;
      if (drawable && /^[0-9]/.test(drawable)) issueCounts.startdigit++;
      if (name.includes('&') && !name.includes('&amp;')) {
        issueCounts.unescaped++;
      }
    });

    const issueEntries = issues
      .map((issue) => ({ ...issue, count: issueCounts[issue.id] }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    const issuesList = document.getElementById('contributionIssuesList');
    if (issuesList) {
      issuesList.innerHTML = issueEntries.map((issue) => `
          <div class="issue-item" data-action="issue-jump" data-issue="${issue.id}" ${
        issue.count > 0
          ? `title="Show ${issue.count} issue${issue.count !== 1 ? 's' : ''}"`
          : ''
      }>
            <div class="issue-label">${issue.label}</div>
            <div class="issue-count">${issue.count}</div>
          </div>
        `).join('');
    }

    const sorted = [...App.state.contribution].sort((a, b) =>
      a.label.localeCompare(b.label)
    );
    const rowsHtml = sorted.map((app) => {
      const iconUrl =
        `${CONFIG.data.assetsPath}${app.drawable}${CONFIG.data.iconExtension}`;
      return Templates.contributionRow(app, iconUrl);
    }).join('');

    const downloadReady = issueCounts.emptyfields === 0 &&
      issueCounts.invalidsvg === 0 && issueCounts.startdigit === 0;

    const hasIcons = App.state.contribution.length > 0;
    if (!hasIcons) {
      document.getElementById('contributionCards')?.classList.add('is-hidden');
      App.dom.headerCount.textContent = '0 icons';
      return;
    }

    const newCount =
      App.state.contribution.filter((a) =>
        (App.state.contributionOverrides[a.componentName]?.mode || 'new') ===
          'new'
      ).length;
    const linkCount = App.state.contribution.length - newCount;
    const parts = [];
    if (newCount > 0) {
      parts.push(`${newCount} new icon${newCount !== 1 ? 's' : ''}`);
    }
    if (linkCount > 0) {
      parts.push(`${linkCount} link${linkCount !== 1 ? 's' : ''}`);
    }
    App.dom.headerCount.textContent = parts.join(' \u2022 ') || '0 icons';

    const clearHtml = hasIcons
      ? `
        <button class="sb-action-btn sb-action-btn-icon contribution-clear-btn" id="contributionClearBtn" title="Remove all" style="position:fixed; bottom:var(--space-xxl); left:var(--space-xxl); z-index:900;">
          <svg><use href="#ic-remove"/></svg>
        </button>
      `
      : '';

    const downloadHtml = `
        <div class="contribution-download-wrapper">
          <button class="sb-action-btn" id="contributionDownloadBtn" style="${
      downloadReady ? '' : 'display:none'
    }">
            <svg><use href="#ic-download"/></svg>
            <span>Download</span>
          </button>
        </div>
      `;

    App.dom.container.innerHTML = clearHtml + downloadHtml + headerHtml +
      rowsHtml;

    const clearBtn = document.getElementById('contributionClearBtn');
    if (clearBtn) {
      clearBtn.onclick = () => {
        App.state.contribution.forEach((a) => {
          const tags = App.state.appTags.get(a.componentName);
          if (tags) tags.delete('plan');
        });
        App.state.contribution = [];
        App.state.activeFilters.delete('plan');
        App.state.contributionOverrides = {};
        App.state.contributionActive = false;
        App.dom.contributionBtn.style.display = '';
        App.dom.contributionBtn.classList.remove('active');
        UI.saveContribution();
        UI.render();
      };
    }

    if (downloadReady) {
      const downloadBtn = document.getElementById('contributionDownloadBtn');
      if (downloadBtn) {
        downloadBtn.onclick = () => {
          Actions.downloadContributionBundle();
        };
      }
    }
  },  

  updateIssues() {
    const list = document.getElementById('contributionIssuesList');
    if (!list) return null;

    const issues = [
      { id: 'nameinuse', label: 'SVG name in use' },
      { id: 'nameconflict', label: 'Duplicate in plan' },
      { id: 'emptyfields', label: 'Empty fields' },
      { id: 'invalidsvg', label: 'Bad chars in SVG' },
      { id: 'startdigit', label: 'No _ before digit' },
    ];

    /** @type {{ [key: string]: number }} */
    const issueCounts = {};
    issues.forEach((issue) => issueCounts[issue.id] = 0);

    App.state.contribution.forEach((app) => {
      const ov = App.state.contributionOverrides[app.componentName] || {};
      const name = ov.label !== undefined ? ov.label : app.label;
      const rawSvg = Utils.sanitizeDrawableName(name);
      const defaultSvg = (rawSvg === 'icon' || rawSvg === 'unknown')
        ? ''
        : rawSvg;
      const drawable = ov.drawable !== undefined ? ov.drawable : defaultSvg;

      if (
        drawable &&
        App.state.existingIcons.some((icon) => icon.drawable === drawable)
      ) {
        issueCounts.nameinuse++;
      }

      const sameDrawable = App.state.contribution.filter((a) => {
        const aOv = App.state.contributionOverrides[a.componentName] || {};
        const aName = aOv.label !== undefined ? aOv.label : a.label;
        const aDrawable = aOv.drawable !== undefined
          ? aOv.drawable
          : Utils.sanitizeDrawableName(aName);
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
      .map((issue) => ({ ...issue, count: issueCounts[issue.id] }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    list.innerHTML = issueEntries.map((issue) => `
      <div class="issue-item" data-action="issue-jump" data-issue="${issue.id}" ${
      issue.count > 0
        ? `title="Show ${issue.count} issue${issue.count !== 1 ? 's' : ''}"`
        : ''
    }>
        <div class="issue-label">${issue.label}</div>
        <div class="issue-count">${issue.count}</div>
      </div>
    `).join('');

    const downloadReady = issueCounts.emptyfields === 0 &&
      issueCounts.invalidsvg === 0 && issueCounts.startdigit === 0;
    const btn = document.getElementById('contributionDownloadBtn');
    if (btn) {
      btn.style.display = (App.state.contribution.length > 0 && downloadReady)
        ? ''
        : 'none';
    }

    const newCount =
      App.state.contribution.filter((a) =>
        (App.state.contributionOverrides[a.componentName]?.mode || 'new') ===
          'new'
      ).length;
    const linkCount = App.state.contribution.length - newCount;
    const parts = [];
    if (newCount > 0) {
      parts.push(`${newCount} new icon${newCount !== 1 ? 's' : ''}`);
    }
    if (linkCount > 0) {
      parts.push(`${linkCount} link${linkCount !== 1 ? 's' : ''}`);
    }
    App.dom.headerCount.textContent = parts.join(' \u2022 ') || '0 icons';

    return issueCounts;
  },

  /**
   * @param {string} issueId
   */
  jumpToIssue(issueId) {
    const rows =
      /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(
        '.contribution-row',
      ));
    if (!rows.length) return;

    document.querySelectorAll('.issue-highlight').forEach((el) =>
      el.classList.remove('issue-highlight')
    );

    for (const row of rows) {
      const appId = row.dataset.id ?? '';
      const app = App.state.contribution.find((a) => a.componentName === appId);
      if (!app) continue;

      const ov = App.state.contributionOverrides[appId] || {};
      const name = ov.label !== undefined ? ov.label : app.label;
      const rawSvg = Utils.sanitizeDrawableName(name);
      const defaultSvg = (rawSvg === 'icon' || rawSvg === 'unknown')
        ? ''
        : rawSvg;
      const drawable = ov.drawable !== undefined ? ov.drawable : defaultSvg;

      let match = false;
      let highlightName = false;
      let highlightSvg = false;

      switch (issueId) {
        case 'nameinuse':
          match = !!drawable &&
            App.state.existingIcons.some((icon) => icon.drawable === drawable);
          highlightSvg = match;
          break;
        case 'nameconflict':
          match = !!drawable && App.state.contribution.filter((a) => {
                const aOv = App.state.contributionOverrides[a.componentName] ||
                  {};
                const aName = aOv.label !== undefined ? aOv.label : a.label;
                const aDrawable = aOv.drawable !== undefined
                  ? aOv.drawable
                  : Utils.sanitizeDrawableName(aName);
                return aDrawable === drawable;
              }).length > 1;
          highlightSvg = match;
          break;
        case 'emptyfields':
          match = !name.trim() || !drawable.trim();
          highlightName = !name.trim();
          highlightSvg = !drawable.trim();
          break;
        case 'invalidsvg':
          match = !!drawable && /[^a-z0-9_]/.test(drawable);
          highlightSvg = match;
          break;
        case 'startdigit':
          match = !!drawable && /^[0-9]/.test(drawable);
          highlightSvg = match;
          break;
      }

      if (match) {
        if (highlightName) {
          const nameInput = row.querySelector('.contribution-name-input');
          if (nameInput) nameInput.classList.add('issue-highlight');
        }
        if (highlightSvg) {
          const svgInput = row.querySelector('.contribution-svg-input');
          if (svgInput) svgInput.classList.add('issue-highlight');
        }
      }
    }

    if (rows.length > 0 && document.querySelector('.issue-highlight')) {
      document.querySelector('.issue-highlight')?.closest('.contribution-row')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  },

  /**
   * @param {HTMLInputElement} input
   */
  updateContributionField(input) {
    const id = input.dataset.id ?? '';
    const field = input.dataset.field ?? '';

    if (!App.state.contributionOverrides[id]) {
      App.state.contributionOverrides[id] = {};
    }
    App.state.contributionOverrides[id][field] = input.value;

    const row = input.closest('.contribution-row');
    if (!row) return;
    const nameInput =
      /** @type {HTMLInputElement | null} */ (row?.querySelector(
        '.contribution-name-input',
      ));
    const svgInput = /** @type {HTMLInputElement | null} */ (row?.querySelector(
      '.contribution-svg-input',
    ));
    const svgHint =
      /** @type {HTMLElement | null} */ (svgInput?.nextElementSibling);
    const libraryIconCol =
      /** @type {HTMLDivElement | null} */ (row?.querySelector(
        '.col.library-icon',
      ));

    const name = nameInput?.value ?? '';
    let drawable = svgInput?.value;
    const defaultSvg = Utils.sanitizeDrawableName(name);

    if (field === 'label') {
      const sanitized = Utils.sanitizeDrawableName(input.value);
      if (sanitized === 'icon' || sanitized === 'unknown') {
        drawable = '';
        if (svgInput) svgInput.value = '';
        App.state.contributionOverrides[id].drawable = '';
      } else {
        drawable = sanitized;
        if (svgInput) svgInput.value = drawable;
        App.state.contributionOverrides[id].drawable = drawable;
      }
    }

    const existingIcon = App.state.existingIcons.find((icon) =>
      icon.drawable === drawable
    );
    const existsInLibrary = !!existingIcon;
    const isCustom = drawable !== defaultSvg;
    const libraryTitle = existingIcon
      ? `${existingIcon.name}\n${drawable}.svg`
      : 'Found in Lawnicons.';

    if (svgHint && svgHint.classList.contains('item-sub')) {
      svgHint.textContent = existsInLibrary
        ? 'Name in use.'
        : (isCustom ? 'Custom.' : 'Generated from name.');
    }

    if (libraryIconCol) {
      if (existsInLibrary) {
        libraryIconCol.innerHTML =
          `<span class="library-icon-card" title="${libraryTitle}">
                  <img src="https://raw.githubusercontent.com/LawnchairLauncher/lawnicons/develop/svgs/${drawable}.svg" 
                      alt="${drawable}" 
                      loading="lazy"
                      onerror="this.parentElement.remove()" />
              </span>`;
      } else {
        libraryIconCol.innerHTML = '';
      }
    }

    this.saveContribution();
    const issueCounts = this.updateIssues();
    if (issueCounts) {
      const downloadReady = issueCounts.emptyfields === 0 &&
        issueCounts.invalidsvg === 0 && issueCounts.startdigit === 0;
      const btn = document.getElementById('contributionDownloadBtn');
      if (btn) {
        btn.style.display = (App.state.contribution.length > 0 && downloadReady)
          ? ''
          : 'none';
      }
    }
  },

  saveContribution() {
    localStorage.setItem(
      'lawnicons_contribution',
      JSON.stringify(App.state.contribution),
    );
    localStorage.setItem(
      'lawnicons_contribution_active',
      App.state.contributionActive.toString(),
    );
    localStorage.setItem(
      'lawnicons_contribution_overrides',
      JSON.stringify(App.state.contributionOverrides),
    );
    if (!App.state.contributionActive) {
      this.updateContributionBadge();
    }
  },

  updateContributionBadge() {
    const badge = document.getElementById('contributionCountBadge');
    if (!badge) return;
    const count = App.state.contribution.length;
    badge.textContent = count.toString();
    badge.style.display = count > 0 ? 'flex' : 'none';
  },

  renderDomainStats() {
    const data = App.state.domainStats;
    const card = document.getElementById('domainStatsCard');
    if (!card) return;

    if (!data || Object.keys(data).length === 0) {
      card.style.display = 'none';
      return;
    }
    card.style.display = '';

    const container = document.getElementById('domainStats');
    if (!container) return;

    const isCountry = (/** @type {string} */ domain) =>
      ISO_COUNTRIES.has(domain);
    const mode = App.state.domainStatsMode;
    const population = (data._population) || {};

    if (!App.state._domainAvgInstalls) {
      App.state._domainAvgInstalls = {};
      /** @type {Record<string, number>} */
      const domainCountsI = {};
      /** @type {Record<string, number>} */
      const domainSumsI = {};
      App.data.forEach((app) => {
        const pkg = app.componentName.split('/')[0];
        const domain = pkg.split('.')[0];
        if (isCountry(domain)) {
          const instStr = app.installs
            ? app.installs.replace(/[,+]/g, '')
            : '0';
          const inst = parseInt(instStr, 10) || 0;
          const pop = population[domain] || 1;
          if (inst / 1_000_000 > pop) return;
          domainSumsI[domain] = (domainSumsI[domain] || 0) + inst;
          domainCountsI[domain] = (domainCountsI[domain] || 0) + 1;
        }
      });

      // Add global_installs to domain stats for local impact
      for (const [domain, stats] of Object.entries(data)) {
        if (isCountry(domain) && stats.global_installs > 0 && stats.global > 0) {
          const avgGlobalInst = stats.global_installs / stats.global;
          const pop = population[domain] || 1;
          if (avgGlobalInst / 1_000_000 > pop) continue;
          domainSumsI[domain] = (domainSumsI[domain] || 0) + stats.global_installs;
          domainCountsI[domain] = (domainCountsI[domain] || 0) + stats.global;
        }
      }

      for (const d of Object.keys(domainSumsI)) {
        App.state._domainAvgInstalls[d] = Math.round(
          domainSumsI[d] / domainCountsI[d],
        );
      }
    }

    /** @type {[string, any, number, number, number][]} */
    let entries = Object.entries(data)
      .filter(([domain]) => isCountry(domain) && domain !== '_population')
      .map(([domain, stats]) => [domain, stats.done, stats.requests, stats.total, stats.global || 0]);

    if (mode === 'local') {
      entries = entries
        .filter(([, , requests, total]) => total - requests > 5)
        .sort((a, b) => {
          const domainAvgInstalls = App.state._domainAvgInstalls ?? {};

          const instA = domainAvgInstalls[a[0]] || 0;
          const instB = domainAvgInstalls[b[0]] || 0;
          const popA = population[a[0]] || 1;
          const popB = population[b[0]] || 1;
          const scoreA = instA / popA;
          const scoreB = instB / popB;
          return scoreB - scoreA;
        });
    } else if (mode === 'coverage') {
      entries = entries
        .filter(([, , requests, total]) => total - requests > 5)
        .sort((a, b) => {
          const pctA = a[1] / a[3];
          const pctB = b[1] / b[3];
          return pctA - pctB;
        });
    } else {
      entries = entries
        .filter(([, , requests, total]) => total - requests > 5)
        .sort((a, b) => b[3] - a[3]);
    }

    const max = Math.max(...entries.map((e) => e[3]), 1);

    const title = document.querySelector('#domainStatsCard .card-title');
    if (title) {
      if (mode === 'local') title.textContent = 'Local impact';
      else if (mode === 'coverage') title.textContent = 'Lowest coverage';
      else title.textContent = 'Country distribution';
    }

    const sub = /** @type {HTMLElement} */ (document.querySelector(
      '#domainStatsCard .card-sub',
    ));
    if (sub) sub.style.display = 'none';

    container.innerHTML = Templates.domainStatsCard(entries, max);

    /** @type {HTMLElement | null} */
    const tooltip = container.querySelector('.tooltip');
    if (!tooltip) return;

    container.addEventListener('mousemove', (el) => {
      const e = /** @type {MouseEvent} */ (el);
      const col =
        /** @type {HTMLElement} */ (/** @type {HTMLElement} */ (e.target)
          .closest('.domain-col'));
      if (!col) {
        Components.Tooltip.hide(tooltip);
        return;
      }
      const domain = col.dataset.domain;
      const done = parseInt(col.dataset.done ?? '');
      const requests = parseInt(col.dataset.requests ?? '');
      const total = parseInt(col.dataset.total ?? '');
      const globalVal = parseInt(col.dataset.global ?? '0');
      const avgInst = App.state?._domainAvgInstalls?.[domain ?? ''] || 0;
      const pop = population[domain ?? ''] || 0;
      const html = Templates.domainStatsTooltip(
        domain ?? '',
        done,
        requests,
        total,
        mode,
        avgInst,
        pop,
        globalVal
      );

      const rect = col.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const left = rect.left - containerRect.left + rect.width;

      Components.Tooltip.show(tooltip, html, left, 0, container);
    });

    container.addEventListener('mouseleave', () => {
      Components.Tooltip.hide(tooltip);
    });
  },

  renderActivityCard() {
    const history = App.state.activityStats;
    const container = document.getElementById('activityChart');
    if (!container) return;

    if (!history || history.length < 2) {
      container.innerHTML = Templates.activityCardEmpty();
      return;
    }

    const rawDays = history.slice(-30);

    // Fill gaps between days with zero entries
    const filledDays = [];
    if (rawDays.length > 0) {
      filledDays.push(rawDays[0]);
      for (let i = 1; i < rawDays.length; i++) {
        const prevDate = /** @type {Date} */ (new Date(
          filledDays[filledDays.length - 1].date + 'T12:00:00',
        ));
        const currDate = new Date(rawDays[i].date + 'T12:00:00');
        while (prevDate.getTime() + 86400000 < currDate.getTime()) {
          prevDate.setTime(prevDate.getTime() + 86400000);
          filledDays.push({
            date: prevDate.toISOString().slice(0, 10),
            total: filledDays[filledDays.length - 1].total,
            added: 0,
            fulfilled: 0,
            expired: 0,
          });
        }
        filledDays.push(rawDays[i]);
      }
    }

    const days = filledDays.length >= 2 ? filledDays : rawDays;

    const totalNew = days.reduce((sum, d) => sum + (d.added || 0), 0);

    // Resolved as main line
    const maxRemoved = Math.max(...days.map((d) => d.fulfilled || 0), 1);
    const resolvedPoints = days.map((d, i) => ({
      x: i / (days.length - 1) * 100,
      y: 100 - (d.fulfilled || 0) / maxRemoved * 100,
    }));

    const maxAdded = Math.max(...days.map((d) => d.added || 0), 1);

    if (maxRemoved === 0 && maxAdded === 0) return;

    const makePath = (/** @type {{x: number, y: number}[]} */ points) => {
      if (points.length < 2) return '';
      let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
      for (let i = 1; i < points.length; i++) {
        const cp1x = ((points[i - 1].x + points[i].x) / 2).toFixed(1);
        const cp1y = points[i - 1].y.toFixed(1);
        const cp2x = ((points[i - 1].x + points[i].x) / 2).toFixed(1);
        const cp2y = points[i].y.toFixed(1);
        d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${points[i].x.toFixed(1)},${
          points[i].y.toFixed(1)
        }`;
      }
      return d;
    };

    const pathResolved = makePath(resolvedPoints);

    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const firstDate = new Date(days[0].date + 'T12:00:00');
    const lastDate = new Date(days[days.length - 1].date + 'T12:00:00');
    const firstLabel = `${
      monthNames[firstDate.getMonth()]
    } ${firstDate.getDate()}`;
    const lastLabel = `${
      monthNames[lastDate.getMonth()]
    } ${lastDate.getDate()}`;

    const dayLabels = `
        <span class="chart-label">${firstLabel}</span>
        <span class="chart-label" id="activityPace"></span>
        <span class="chart-label">${lastLabel}</span>
    `;

    container.innerHTML = Templates.activityCard(pathResolved, '', dayLabels);

    const dotsSvg = container.querySelector('.activity-dots-svg');
    if (dotsSvg) {
      const chartEl = container.querySelector('.card-chart');
      if (!chartEl) return;

      const w = chartEl.clientWidth;
      const h = chartEl.clientHeight;
      dotsSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);

      const getSize = (/** @type {number} */ added) => {
        if (added >= 1000) return 7;
        if (added >= 251) return 5;
        return 3;
      };

      dotsSvg.innerHTML = days.map((d, i) => {
        const x = (i / (days.length - 1) * w).toFixed(1);
        const added = d.added || 0;
        if (added === 0) return '';
        const r = getSize(added);
        return `<circle cx="${x}" cy="${
          r + 2
        }" r="${r}" class="activity-added-dot" />`;
      }).join('');
    }

    const totalFulfilled = days.reduce((sum, d) => sum + (d.fulfilled || 0), 0);
    const subEl = document.getElementById('activitySub');
    if (subEl) {
      subEl.textContent = `${Utils.compactNumber(totalNew)} new • ${
        Utils.compactNumber(totalFulfilled)
      } done`;
    }

    const paceEl = document.getElementById('activityPace');
    if (paceEl && App.state.medianTTF !== undefined) {
      paceEl.textContent = `${App.state.medianTTF}d from ask to icon`;
      const count = App.state._fulfillmentData?.length || 0;
      paceEl.title =
        `Median time from request to icon, based on ${count} fulfilled requests.`;
    }

    /** @type {SVGElement | null} */
    const svg = container.querySelector('.activity-svg');
    if (!svg) return;

    const tooltip =
      /** @type {HTMLElement | null} */ (container.querySelector('.tooltip'));
    if (!tooltip) return;

    const vLine = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'line',
    );
    vLine.classList.add('activity-vline');
    vLine.style.display = 'none';
    svg.appendChild(vLine);

    svg.addEventListener('mouseleave', () => {
      vLine.style.display = 'none';
      tooltip.style.display = 'none';
    });

    svg.addEventListener('mousemove', (e) => {
      const svgRect = svg.getBoundingClientRect();
      const x = (e.clientX - svgRect.left) / svgRect.width * 100;
      const idx = Math.round(x / 100 * (days.length - 1));
      const clamped = Math.min(days.length - 1, Math.max(0, idx));
      const snapX = clamped / (days.length - 1) * 100;

      vLine.setAttribute('x1', snapX.toString());
      vLine.setAttribute('x2', snapX.toString());
      vLine.setAttribute('y1', '0');
      vLine.setAttribute('y2', '100');
      vLine.style.display = '';

      const added = days[clamped].added || 0;
      const fulfilled = days[clamped].fulfilled || 0;

      if (added === 0 && fulfilled === 0) {
        Components.Tooltip.hide(tooltip);
        return;
      }

      const dateParts = days[clamped].date.toString().split('-');
      const formattedDate = `${monthNames[parseInt(dateParts[1]) - 1]} ${
        parseInt(dateParts[2])
      }`;
      const html = Templates.activityTooltip(formattedDate, added, fulfilled);

      const left = snapX / 100 * svgRect.width + 12;

      Components.Tooltip.show(tooltip, html, left, 0, container);
    });
  },

  initRegexAutocomplete() {
    const input = App.dom.inputSearch;
    const wrapper = document.getElementById('search-wrapper');
    if (!wrapper) return;

    input.addEventListener('input', () => {
      this.hideRegexAutocomplete();
      if (!App.state.regexMode) return;

      const val = input.value;
      if (!val || val.includes('.')) return;

      const domains = Object.keys(App.state.domainStats);
      if (!domains.length) return;

      const matches = domains
        .filter((d) => d.toLowerCase().startsWith(val.toLowerCase()))
        .slice(0, 5);
      if (!matches.length) return;

      const listEl = document.createElement('div');
      listEl.className = 'autocomplete-list';
      listEl.setAttribute('role', 'listbox');
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
   * @param {any} e
   * @param {AppEntry} app
   */
  showRowMenu(e, app) {
    App.dom.rowMenu.innerHTML = Templates.rowMenu(app);
    const trigger =
      /** @type {HTMLElement} */ (e.target.closest('.ctx-trigger'));
    const rect = trigger.getBoundingClientRect();
    const menu = App.dom.rowMenu;

    // Hide first to measure
    menu.style.visibility = 'hidden';
    menu.showPopover();

    const w = menu.offsetWidth || 255;
    let x = rect.right - w;
    let y = rect.bottom + 4;

    if (x < 0) x = rect.right - w;
    if (y + 290 > innerHeight) y = rect.top - 290 - 4;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.transformOrigin = 'top right';
    menu.style.visibility = 'visible';
  },

  showMobileFilterPopover() {
    const menu = App.dom.mobileFilterMenu;
    menu.innerHTML = '';

    // Screen filter
    if (App.state.activeScreenFilter) {
      const screenEntry = Object.entries(App.state.screensData).find(([_, ids]) => 
        ids.length === App.state.activeScreenFilter.length && 
        ids.every(id => App.state.activeScreenFilter.includes(id))
      );
      const screenId = screenEntry ? screenEntry[0].replace(/^scr-0+/, 'scr-') : 'screen';
      menu.innerHTML += `
        <div class="ctx-item active" data-action="clear-screen-filter">
          <span class="check-icon">${ICONS.check}</span>
          <span>${screenId}</span>
        </div>
      `;
    }

    const s = App.state.activeFilters;
    menu.innerHTML += CONFIG.data.filters.map((id) => {
      let count = 0;
      App.state.appTags.forEach((tags) => {
        if (tags.has(id)) count++;
      });
      if (count === 0) return '';

      const meta = App.state.filterMetadata.get(id);
      if (!meta) return '';
      return Templates.mobileFilterItem(id, meta.label, s.has(id));
    }).join('');

    const rect = App.dom.mobileFilterBtn.getBoundingClientRect();
    menu.style.visibility = 'hidden';
    menu.showPopover();
    menu.style.left = `${rect.right - menu.offsetWidth}px`;
    menu.style.top = `${rect.bottom + 8}px`;
    menu.style.visibility = 'visible';
  },

  buildQuickPickQueue() {
    const POP = App.state.domainStats._population || {};
    const isCountry = (/** @type {string} */ d) =>
      ISO_COUNTRIES.has(d) && d in POP;

    // Calc local_impact per country
    /** @type {Record<string, number>} */
    const domainInstalls = {};
    /** @type {Record<string, number>} */
    const domainInstCounts = {};
    App.data.forEach((app) => {
      const pkg = app.componentName.split('/')[0];
      const domain = pkg.split('.')[0];
      if (!isCountry(domain)) return;
      const inst = Utils.parseInstalls(app.installs);
      domainInstalls[domain] = (domainInstalls[domain] || 0) + inst;
      domainInstCounts[domain] = (domainInstCounts[domain] || 0) + 1;
    });

    /** @type {Record<string, number>} */
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

    const quartileUrgency = (/** @type {number} */ li) => {
      if (li >= q3) return 1.0;
      if (li >= q2) return 0.75;
      if (li >= q1) return 0.5;
      return 0.25;
    };

    App.state._quickPickMiddle = [];
    App.state._quickPickEasy = [];

    App.data.forEach((app) => {
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

      /** @type {(AppEntry & { _score: number })} */
      const item = { ...app, _score: score };

      // Easy: only easy, excl. match and nameinuse
      if (isEasy && !isMatch && !isNameInUse) {
        App.state._quickPickEasy?.push(item);
      }

      // Middle+: excl. easy, match and nameinuse
      if (!isEasy && !isMatch && !isNameInUse) {
        App.state._quickPickMiddle?.push(item);
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
    const card = document.getElementById('quickPickCard');
    if (!card) return;

    card.style.backgroundImage = `url('extracted_png/${app.drawable}.png')`;
    card.style.backgroundSize = 'cover';
    card.style.backgroundPosition = 'center';
    card.style.backgroundRepeat = 'no-repeat';
    card.title = app.label;
  },

  renderIconLibrary() {
    const s = App.state;
    const container = document.getElementById('iconLibraryResults');
    const cardsRow = document.querySelector('.cards-row');

    if (!container || !cardsRow) return;

    const query = s.search.trim();

    if (!query || !s.existingIcons || s.existingIcons.length === 0) {
      Utils.setHidden(container, true);
      Utils.setHidden(cardsRow, false);
      return;
    }

    const term = query.toLowerCase();
    const seen = new Set();
    const matches = s.existingIcons.filter((icon) => {
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

    const title = container.querySelector('.library-title');
    if (title) title.textContent = 'Found in Lawnicons';

    const grid = container.querySelector('.library-grid');
    if (grid) {
      grid.innerHTML = matches.slice(0, 20).map((icon) =>
        Templates.libraryIconCard(icon)
      ).join('');
    }
  },

  /**
   * @param {MouseEvent} e
   * @param {Icon} icon
   */
  showLibraryIconMenu(e, icon) {
    const menu = App.dom.rowMenu;
    menu.innerHTML = Templates.libraryIconMenu(icon);
    const target =
      /** @type {HTMLElement} */ (/** @type {HTMLElement} */ (e.target)
        ?.closest('.library-icon-card'));
    const rect = target.getBoundingClientRect();

    menu.style.visibility = 'hidden';
    menu.showPopover();

    const w = menu.offsetWidth || 220;
    let x = rect.left;
    let y = rect.bottom + 4;

    if (x < 8) x = 8;
    if (x + w > innerWidth - 8) x = innerWidth - w - 8;
    if (y + 150 > innerHeight) y = rect.top - 150 - 4;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.transformOrigin = 'top left';
    menu.style.visibility = 'visible';
  },

  /**
   * @param {HTMLElement} menuEl
   */
  focusMenu(menuEl) {
    // Wait for browser to render the popover
    requestAnimationFrame(() => {
      const firstItem =
        /** @type {HTMLElement} */ (menuEl.querySelector('.ctx-item'));
      if (firstItem) firstItem.focus();
    });
  },

  closeContextMenu() {
    try {
      /** @type {any} */ (App.dom.sortMenu).hidePopover();
    } catch { /* no-op*/ }
    try {
      /** @type {any} */ (App.dom.rowMenu).hidePopover();
    } catch { /* no-op */ }
    try {
      /** @type {any} */ (App.dom.mobileFilterMenu).hidePopover();
    } catch { /* no-op */ }

    setTimeout(() => {
      App.dom.rowMenu.innerHTML = '';
      App.dom.mobileFilterMenu.innerHTML = '';
    }, 200);
  },
};

// Start
Data.init();
