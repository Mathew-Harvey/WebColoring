// The Amazon stores the paperbacks are sold in. A KDP paperback has the same product id (ASIN)
// in every store, so one id gives a link to each.
//
// The visitor's store is a guess made on the device from its time zone (then its language),
// never sent anywhere; a store picked on the paper books page is kept in this browser instead.

export const STORES = {
  US: 'amazon.com',
  UK: 'amazon.co.uk',
  DE: 'amazon.de',
  FR: 'amazon.fr',
  ES: 'amazon.es',
  IT: 'amazon.it',
  NL: 'amazon.nl',
  PL: 'amazon.pl',
  SE: 'amazon.se',
  BE: 'amazon.com.be',
  IE: 'amazon.ie',
  JP: 'amazon.co.jp',
  CA: 'amazon.ca',
  AU: 'amazon.com.au',
} as const;

export type StoreId = keyof typeof STORES;

export const isStore = (v: unknown): v is StoreId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(STORES, v);

/** The product page for a book in a store, or null for anything that is not an ASIN. */
export function storeUrl(asin: string | null | undefined, store: StoreId): string | null {
  return asin && /^[A-Z0-9]{10}$/.test(asin) ? `https://www.${STORES[store]}/dp/${asin}` : null;
}

// Time zones that point to a store. New Zealand shops at amazon.com.au; Austria and Switzerland
// at amazon.de.
const ZONES: [RegExp, StoreId][] = [
  [/^(Australia\/|Pacific\/(Auckland|Chatham)$)/, 'AU'],
  [/^Europe\/(London|Belfast|Guernsey|Jersey|Isle_of_Man)$/, 'UK'],
  [/^Europe\/Dublin$/, 'IE'],
  [/^Europe\/(Berlin|Busingen|Vienna|Zurich)$/, 'DE'],
  [/^Europe\/(Paris|Monaco|Luxembourg)$/, 'FR'],
  [/^(Europe\/Madrid|Atlantic\/Canary|Africa\/Ceuta)$/, 'ES'],
  [/^Europe\/(Rome|Vatican|San_Marino)$/, 'IT'],
  [/^Europe\/Amsterdam$/, 'NL'],
  [/^Europe\/Warsaw$/, 'PL'],
  [/^Europe\/Stockholm$/, 'SE'],
  [/^Europe\/Brussels$/, 'BE'],
  [/^Asia\/Tokyo$/, 'JP'],
  [
    /^America\/(Toronto|Montreal|Vancouver|Edmonton|Calgary|Winnipeg|Regina|Swift_Current|Halifax|Glace_Bay|Moncton|Goose_Bay|St_Johns|Whitehorse|Dawson|Dawson_Creek|Creston|Fort_Nelson|Yellowknife|Inuvik|Cambridge_Bay|Iqaluit|Rankin_Inlet|Resolute|Thunder_Bay|Nipigon|Rainy_River|Atikokan|Blanc-Sablon|Pangnirtung)$/,
    'CA',
  ],
];

// Language regions that point to a store, for a time zone that says nothing.
const REGIONS: Record<string, StoreId> = {
  GB: 'UK', IE: 'IE', DE: 'DE', AT: 'DE', CH: 'DE', FR: 'FR', LU: 'FR', ES: 'ES', IT: 'IT', NL: 'NL',
  PL: 'PL', SE: 'SE', BE: 'BE', JP: 'JP', CA: 'CA', AU: 'AU', NZ: 'AU',
};

/** The store for a time zone and a list of languages (as the browser reports them), else US. */
export function guessStore(timeZone: string | undefined, languages: readonly string[] = []): StoreId {
  for (const [zone, store] of ZONES) if (timeZone && zone.test(timeZone)) return store;
  for (const lang of languages) {
    const region = lang.split('-')[1]?.toUpperCase();
    if (region && REGIONS[region]) return REGIONS[region];
    if (lang.toLowerCase() === 'ja') return 'JP';
  }
  return 'US';
}

const KEY = 'webcoloring.store';
const listeners = new Set<() => void>();
/** A pick made in this page, which counts even when storage is blocked. */
let picked: StoreId | null = null;

function deviceStore(): StoreId {
  try {
    const nav = typeof navigator === 'undefined' ? undefined : navigator;
    return guessStore(Intl.DateTimeFormat().resolvedOptions().timeZone, nav?.languages ?? (nav?.language ? [nav.language] : []));
  } catch {
    return 'US';
  }
}

/** The visitor's store: the one they picked, else the guess. */
export function activeStore(): StoreId {
  if (picked) return picked;
  try {
    const saved = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    if (isStore(saved)) return saved;
  } catch {
    /* storage may be blocked */
  }
  return deviceStore();
}

/** Keeps the visitor's pick in this browser, and tells the screens. */
export function chooseStore(store: StoreId) {
  picked = store;
  try {
    localStorage.setItem(KEY, store);
  } catch {
    /* storage may be blocked */
  }
  for (const fn of listeners) fn();
}

export function onStore(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
