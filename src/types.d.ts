declare global {
  type InitTuple = [
    AppRequests,
    Record<string, number>,
    CreationOdds[],
    DomainStats,
    ActivityStats[],
    ...Filter[]
  ]

  interface AppRequests {
    count: number;
    lastUpdate: string;
    apps: AppEntry[];
  }

  interface AppEntry {
    drawable: string;
    label: string;
    componentName: string;
    requestCount: number;
    firstAppearance: number;
    lastRequested: number;
    installs?: string;
  }

  type SortKeys = 'name' | 'req' | 'odds' | 'install' | 'time';

  interface FilterMetadata {
    label: string;
    description?: string;
  }

  interface FilterContents {
    id: string;
    existing_drawable: string,
  }

  interface Filter extends FilterMetadata {
    [key: string]: string | FilterContents[] | undefined;
  }

  interface Icon {
    drawable: string;
    name: string;
    component: string;
  }

  interface Overrides {
    [key: string]: string | undefined;
    drawable?: string;
    label?: string;
    mode?: 'link' | 'new';
  }

  interface Issue {
    id: 'nameinuse' | 'nameconflict' | 'emptyfields' | 'invalidsvg' | 'startdigit' | 'unescaped';
    label: string;
  }

  interface CreationOdds {
    popularity: number;
    '0.1': number;
    '0.1_at_pace': number;
    '1': number;
    '1_at_pace': number;
    '3': number;
    '3_at_pace': number;
    '5': number;
    '5_at_pace': number;
    '6': number;
    '6_at_pace': number;
    '8': number;
    '8_at_pace': number;
  }

  interface DomainStatistic {
    requests: number;
    done: number;
    total: number;
  }

  interface DomainPopulation {
    [key: string]: any;
  }

  type DomainStats = {
    _population: DomainPopulation;
  } & {
    [key: string]: DomainStatistic;
  };

  interface FulfillmentHistory {
    /** The Unix timestamp (in seconds) when the item first appeared. */
    firstAppearance: number;
    /** The Unix timestamp (in seconds) when the item was fulfilled. */
    fulfilled: number;
    /** The popularity score or rank of the item. */
    popularity: number;
    /** The weighting or scaling factor applied to the item's label. */
    label_factor: number;
  }

  interface ActivityStats {
    date: Date;
    total: number;
    added: number;
    fulfilled: number;
    expired: number;
  }

  interface TrendingBaseline {
    period_start: TrendingBaselineItem,
    period_end: TrendingBaselineItem,
  }

  interface TrendingBaselineItem {
    date: string,
    total: number,
    snapshot: Record<string, number>,
  }

  interface ReviewIssues {
    drawable: string;
    issues: string[];
  }

  interface AppState {
    /** The current display layout mode. */
    view: 'list' | 'grid';
    /** The current sorting key and direction (e.g., "req-desc"). */
    sort: string;
    /** The current search query string. */
    search: string;
    /** Whether the search query should be treated as a Regular Expression. */
    regexMode: boolean;
    /** A set of currently selected item IDs. */
    selected: Set<string>;
    /** A map of application tags. */
    appTags: Map<string, Set<string>>;
    /** Metadata associated with various filters. */
    filterMetadata: Map<string, FilterMetadata>;
    /** A set of currently active filter keys. */
    activeFilters: Set<string>;
    /** The ID of the last selected item, used for shift-clicks. */
    lastSelectedId: string | number | null;

    // Runtime / Data Cache
    /** Fast lookup map pairing item IDs to their full data entries. */
    idMap: Map<string | number, AppEntry>;
    /** The number of items currently rendered in the DOM. */
    renderedCount: number;
    /** The filtered and sorted list of entries currently on display. */
    currentData: AppEntry[];
    /** Array of currently loaded or available icon objects. */
    existingIcons: Icon[];

    // Actions & Contributions
    /** The current action state or mode. */
    actionMode: 'new' | string;
    /** Toggle state for rendering low-quality or performance-optimized views. */
    lowQualityActive: boolean;
    /** Toggle state indicating if the contribution workflow is active. */
    contributionActive: boolean;
    /** List of pending or current user contributions. */
    contribution: AppEntry[];
    /** Key-value overrides applied to the contribution layer. */
    contributionOverrides: Record<string, Overrides>;
    /** Cached SVG strings indexed by their identifier. */
    existingSvgs: Map<string, string>;

    // Statistics & Deltas
    /** Statistical data aggregated by specific sets. */
    setsStats: Record<string, any>;
    /** Odds/probabilities array related to creation metrics. */
    creationOdds: CreationOdds[];
    /** Aggregated domain-specific metrics. */
    domainStats: DomainStats | Record<string, never>;
    /** The current mode for displaying domain stats (e.g., "requests"). */
    domainStatsMode: string;
    /** Historical or timeline array tracking application activity. */
    activityStats: ActivityStats[];
    /** Numeric delta changes tracking trending items. */
    trendingDeltas: Record<string, number>;
    /** ISO timestamp or string representing the last data refresh. */
    lastUpdate: string | null;
    _fulfillmentData?: FulfillmentHistory[] | null;
    medianTTF?: number;
    _domainAvgInstalls?: Record<string, number>;
    activePage?: string;
    quickPickMode?: string;
    lowQualityData?: ReviewIssues[];
    _quickPickEasy?: any[];
    _quickPickMiddle?: any[];
    _lastQuickPickIdx?: number;
  }

}

export { };