declare global {
  type InitTuple = [
    AppRequests,
    Record<string, number>,
    DomainStats,
    ActivityStats[],
    RawPriorities,
    Record<string, ContributorPoints>,
    ...Filter[],
  ];

  interface AppRequests {
    count: number;
    lastUpdate: string;
    apps: AppEntry[];
  }

  interface RawPriorities {
    '1'?: string[];
    '2'?: string[];
    '3'?: string[];
    '4'?: string[];
    '5'?: string[];
  }

  interface PriorityVotes {
    '1'?: number;
    '2'?: number;
    '3'?: number;
    '4'?: number;
    '5'?: number;
    sum: number;
    count: number;
  }

  interface ContributorPoints {
    earned: number;
    spent: number;
    boosted: number;
    balance: number;
  }

  interface AppEntry {
    drawable: string;
    label: string;
    componentName: string;
    requestCount: number;
    firstAppearance: number;
    lastRequested: number;
    installs?: string;
    priority?: string;
  }

  type SortKeys = 'name' | 'req' | 'odds' | 'install' | 'time';

  interface FilterMetadata {
    label: string;
    description?: string;
  }

  interface FilterContents {
    id: string;
    existing_drawable: string;
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
    id:
      | 'nameinuse'
      | 'nameconflict'
      | 'emptyfields'
      | 'invalidsvg'
      | 'startdigit'
      | 'unescaped';
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

  type DomainStats = {
    _population: Record<string, number>;
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
    period_start: TrendingBaselineItem;
    period_end: TrendingBaselineItem;
  }

  interface TrendingBaselineItem {
    date: string;
    total: number;
    snapshot: Record<string, number>;
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
    /** Sorting key and direction used by the contributor leaderboard. */
    contributorSort: string;
    /** Currently selected main tab. */
    activeTab: 'requests' | 'screens' | 'points-leaderboard' | 'homescreens';
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
    /** Screen membership graph used by screen and regex searches. */
    screensData: Record<string, string[]>;
    /** Component-to-component request graph used by geo and regex searches. */
    requestsGraph: Record<string, Record<string, number>>;
    /** Memoized icontool commands for dynamic package matches. */
    _dynamicMatchesCache?: string[] | null;
    /** Precomputed component ID -> geo prefix used by list rows. */
    _geoPrefixById?: Map<string, string> | null;

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
    setsStats: Record<string, number>;
    /** Odds/probabilities array related to creation metrics. */
    creationOdds: CreationOdds[];
    /** Aggregated domain-specific metrics. */
    domainStats: DomainStats | Record<string, never>;
    /** The current mode for displaying domain stats (e.g., "requests"). */
    domainStatsMode: string;
    /** Historical or timeline array tracking application activity. */
    activityStats: ActivityStats[];
    /** Ranked priority votes with derived sum/count totals. */
    prioritiesData: Record<string, PriorityVotes>;
    /** Derived contributor balances from Lawnicons point files. */
    contributorPoints: Record<string, ContributorPoints>;
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
    _quickPickEasy?: (AppEntry & { _score: number })[];
    _quickPickMiddle?: (AppEntry & { _score: number })[];
    _lastQuickPickIdx?: number;
  }
}

export {};
