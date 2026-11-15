// services/globalCoinsService.js
// قوائم العملات العالمية من CoinGecko (طلب مخزّن مؤقتاً يُشارَك بين شاشة السوق وشاشة الأسواق العالمية).
const CACHE_MS = 60000;
const CACHE = {};      // key -> { rows, ts }
const PENDING = {};    // key -> Promise (يمنع تكرار الطلب نفسه في وقت واحد)

export const toAsset = (r) => ({
  id:          r.id,
  symbol:      String(r.symbol || '').toUpperCase(),
  name:        r.name,
  image:       r.image,
  mint:        `external:${r.id}`,
  isExternal:  true,
  type:        'external_crypto',
  coingeckoId: r.id,
  rank:        r.market_cap_rank || 0,
  current_price:               r.current_price || 0,
  price_change_percentage_24h: r.price_change_percentage_24h || 0,
  high: r.high_24h || 0,
  low:  r.low_24h  || 0,
});

export function getCachedCoins(category = 'all', perPage = 150) {
  return CACHE[`${category}:${perPage}`]?.rows || null;
}
export function getCachedAt(category = 'all', perPage = 150) {
  const ts = CACHE[`${category}:${perPage}`]?.ts;
  return ts ? new Date(ts) : null;
}

export async function fetchCoinsMarkets(category = 'all', perPage = 150, force = false) {
  const key = `${category}:${perPage}`;
  const hit = CACHE[key];
  if (!force && hit && Date.now() - hit.ts < CACHE_MS) return hit.rows;
  if (PENDING[key]) return PENDING[key];

  PENDING[key] = (async () => {
    try {
      const url =
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc'
        + `&per_page=${perPage}&page=1&sparkline=false&price_change_percentage=24h`
        + (category !== 'all' ? `&category=${category}` : '');
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json)) throw new Error('bad response');
      const rows = json.map(toAsset);
      CACHE[key] = { rows, ts: Date.now() };
      return rows;
    } finally {
      delete PENDING[key];
    }
  })();
  return PENDING[key];
}
