// services/liquidityService.js
// قراءة بيانات مجمعات سيولة MECO على Orca (قراءة فقط - بدون أي معاملات)

export const MECO_POOLS = [
  { id: 'usdt', address: '34Vqf9xFyUFVhp6wVt3ScB4CBJrGBm6BbVwR67jEn2Ed', label: 'MECO/USDT' },
  { id: 'sol',  address: '6SujZ9VU5vLyEZGkVdDDJB45ef1ugQvXAzht49Kbtfsc', label: 'MECO/SOL'  },
];

const ORCA_API  = 'https://api.orca.so/v2/solana/pools/';
const GECKO_API = 'https://api.geckoterminal.com/api/v2/networks/solana/pools/';

export const orcaPoolUrl     = (addr) => `https://www.orca.so/pools/${addr}`;
export const explorerPoolUrl = (addr) => `https://solscan.io/account/${addr}`;

const num = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
};

async function fetchJson(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// مجموع نسبة السيولة المقفلة إن وُجدت بصيغة مفهومة، وإلا null (لا نخمّن)
function parseLockedPercent(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  let sum = 0, found = false;
  for (const item of arr) {
    const v = num(item?.lockedPercentage ?? item?.locked_percentage ?? item?.percent ?? item?.percentage);
    if (v !== null) { sum += v; found = true; }
  }
  return found ? Math.min(sum, 100) : null;
}

async function fromOrca(pool) {
  const json = await fetchJson(ORCA_API + pool.address);
  const d = json?.data ?? json;
  if (!d || (d.tvlUsdc === undefined && d.stats === undefined)) throw new Error('bad orca payload');

  const s24 = d.stats?.['24h'] || {};
  const yieldOverTvl = num(s24.yieldOverTvl);
  const feeRate = num(d.feeRate);
  return {
    ...pool,
    source: 'orca',
    pair: pool.label,
    tvl: num(d.tvlUsdc),
    volume24h: num(s24.volume ?? s24.volumeUsdc ?? s24.volumeUsd),
    fees24h: num(s24.fees ?? s24.feesUsdc ?? s24.feesUsd),
    aprPct: yieldOverTvl !== null ? yieldOverTvl * 365 * 100 : null, // تقدير سنوي من عائد آخر 24 ساعة
    feePct: feeRate !== null ? feeRate / 10000 : null,               // feeRate بوحدة 1/100 من نقطة أساس
    lockedPct: parseLockedPercent(d.lockedLiquidityPercent),
    poolType: d.poolType || null,
    updatedAt: d.updatedAt || null,
  };
}

async function fromGecko(pool) {
  const json = await fetchJson(GECKO_API + pool.address);
  const a = json?.data?.attributes;
  if (!a) throw new Error('bad gecko payload');
  return {
    ...pool,
    source: 'gecko',
    pair: pool.label,
    tvl: num(a.reserve_in_usd),
    volume24h: num(a.volume_usd?.h24),
    fees24h: null,
    aprPct: null,
    feePct: null,
    lockedPct: null,
    poolType: null,
    updatedAt: null,
  };
}

export async function getPoolStats(pool) {
  try {
    return await fromOrca(pool);
  } catch (e1) {
    try {
      return await fromGecko(pool);
    } catch (e2) {
      return { ...pool, source: null, error: true };
    }
  }
}

let _cache = null; // { at, data }
const CACHE_MS = 60 * 1000;

export async function getAllPoolStats(force = false) {
  if (!force && _cache && Date.now() - _cache.at < CACHE_MS) return _cache.data;
  const data = await Promise.all(MECO_POOLS.map(getPoolStats));
  if (data.some(p => !p.error)) _cache = { at: Date.now(), data };
  return data;
}
