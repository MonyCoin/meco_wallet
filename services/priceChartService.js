// services/priceChartService.js
import { CORE_TOKENS } from './jupiterMarketService';

const COINGECKO_API   = 'https://api.coingecko.com/api/v3';
const CACHE_DURATION  = 60000;
const FETCH_TIMEOUT   = 8000;

// CoinGecko IDs للعملات الكبرى — MECO غير موجود هنا عمداً
const COINGECKO_IDS = {
  SOL:'solana', USDT:'tether', USDC:'usd-coin',
  JUP:'jupiter-exchange-solana', RAY:'raydium', BONK:'bonk',
  WIF:'dogwifcoin', PYTH:'pyth-network', JTO:'jito-governance-token',
  HNT:'helium', ORCA:'orca', MNDE:'marinade',
  BOME:'book-of-meme', POPCAT:'popcat', MEW:'cat-in-a-dogs-world',
};

// العملات المستقرة: مخطط حقيقي من CoinGecko فقط — لا بيانات مولَّدة عند الفشل
const STABLE   = new Set(['USDT','USDC']);
const CACHE    = {};

const fetchWT = (url, ms = FETCH_TIMEOUT) => {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal, headers:{ Accept:'application/json' } })
    .finally(() => clearTimeout(timer));
};

// ─── شموع حقيقية من GeckoTerminal — لكل عملة بدون CoinGecko ID (MECO والرموز المخصصة) ───
// لا نُولّد أي بيانات: إن تعذّر الجلب يُعاد مخطط فارغ.
const GECKO_API = 'https://api.geckoterminal.com/api/v2/networks/solana';
const POOL_CACHE = {};
const POOL_TTL   = 6 * 3600 * 1000;

// أكبر مجمّع سيولة للرمز (ونحدد هل الرمز هو base أم quote فيه)
async function getTopPool(mint) {
  const c = POOL_CACHE[mint];
  if (c && Date.now() - c.ts < POOL_TTL) return c;
  const res = await fetchWT(`${GECKO_API}/tokens/${mint}/pools?page=1`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json  = await res.json();
  const pools = Array.isArray(json?.data) ? json.data : [];
  if (!pools.length) throw new Error('No pools');
  const liq  = (p) => parseFloat(p?.attributes?.reserve_in_usd || 0);
  const best = pools.reduce((b, p) => (liq(p) > liq(b) ? p : b), pools[0]);
  const pool = best?.attributes?.address;
  if (!pool) throw new Error('No pool address');
  const quoteId = String(best?.relationships?.quote_token?.data?.id || '').toLowerCase();
  const side    = quoteId.endsWith(String(mint).toLowerCase()) ? 'quote' : 'base';
  const entry   = { pool, side, ts: Date.now() };
  POOL_CACHE[mint] = entry;
  return entry;
}

// خطة الجلب لكل إطار زمني (عدد الشموع النهائي ≤ 60 ليناسب الشاشتين)
function ohlcvPlan(days) {
  if (days <= 1)  return { unit:'hour', agg:1,  limit:24,  merge:1 };
  if (days <= 7)  return { unit:'hour', agg:4,  limit:42,  merge:1 };
  if (days <= 30) return { unit:'hour', agg:12, limit:60,  merge:1 };
  if (days <= 90) return { unit:'day',  agg:1,  limit:90,  merge:2 };
  return { unit:'day', agg:1, limit:Math.min(days, 365), merge:Math.ceil(Math.min(days, 365) / 52) };
}

function mergeCandles(rows, n) {
  if (n <= 1) return rows;
  const out = [];
  for (let i = 0; i < rows.length; i += n) {
    const g = rows.slice(i, i + n);
    out.push({
      timestamp: g[0].timestamp,
      open:      g[0].open,
      high:      Math.max(...g.map(x => x.high)),
      low:       Math.min(...g.map(x => x.low)),
      close:     g[g.length - 1].close,
      volume:    g.reduce((a, x) => a + (x.volume || 0), 0),
    });
  }
  return out;
}

async function buildOHLCFromGeckoTerminal(symbol, mint, days) {
  const key = `gt_${symbol}_${mint}_${days}`;
  const now = Date.now();
  if (CACHE[key] && now - CACHE[key].ts < CACHE_DURATION) return CACHE[key].data;

  try {
    const { pool, side } = await getTopPool(mint);
    const plan = ohlcvPlan(days);
    let url = `${GECKO_API}/pools/${pool}/ohlcv/${plan.unit}?aggregate=${plan.agg}&limit=${plan.limit}&currency=usd`;
    if (side === 'quote') url += '&token=quote';
    const res = await fetchWT(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const list = json?.data?.attributes?.ohlcv_list;
    if (!Array.isArray(list) || !list.length) throw new Error('No candles');

    const raw = list
      .map(r => ({ timestamp:Number(r[0]) * 1000, open:+r[1], high:+r[2], low:+r[3], close:+r[4], volume:+r[5] || 0 }))
      .filter(r => [r.open, r.high, r.low, r.close].every(Number.isFinite) && r.close > 0)
      .sort((a, b) => a.timestamp - b.timestamp);
    if (!raw.length) throw new Error('No valid candles');

    const volume24h = raw.filter(r => r.timestamp >= now - 86400000).reduce((a, r) => a + r.volume, 0);
    const data      = mergeCandles(raw, plan.merge);
    const first     = data[0].open;
    const last      = data[data.length - 1].close;
    const chg       = first > 0 ? ((last - first) / first) * 100 : 0;

    const result = {
      symbol, days,
      data: data.map(({ timestamp, open, high, low, close }) => ({ timestamp, open, high, low, close })),
      volumeData: data.map(d => ({ timestamp:d.timestamp, volume:d.volume || 0 })),
      stats:{
        currentPrice:last, openPrice:first,
        high:Math.max(...data.map(d => d.high)), low:Math.min(...data.map(d => d.low)),
        volume24h, periodChange:chg, periodChangeFormatted:fmtChg(chg),
      },
      sparklineData: sparkline(data), timestamp:now, isFallback:false,
    };
    CACHE[key] = { data:result, ts:now };
    return result;
  } catch (e) {
    console.warn(`[Chart] GeckoTerminal failed for ${symbol}:`, e.message);
    return empty(symbol, days);
  }
}

// ─── getOHLCData — موحد لكل العملات ──────────────────────────────────────────
export async function getOHLCData(symbol, days = 7, mintOverride = null, coinIdOverride = null) {
  // العملات الخارجية (BTC/ETH/...) بتبعت coingeckoId جاهز من الشاشة، فبنفضّله
  // على الخريطة المحلية اللي مقتصرة على عملات سولانا فقط
  const coinId = coinIdOverride || COINGECKO_IDS[symbol];

  // بدون CoinGecko ID → DexScreener (MECO والرموز المخصصة)
  if (!coinId) {
    const token = CORE_TOKENS.find(t => t.symbol === symbol);
    const mint  = mintOverride || token?.mint;
    if (!mint) return empty(symbol, days);
    return buildOHLCFromGeckoTerminal(symbol, mint, days);
  }

  const key = `cg_${symbol}_${days}`;
  const now = Date.now();
  if (CACHE[key] && now - CACHE[key].ts < CACHE_DURATION) return CACHE[key].data;

  try {
    const res = await fetchWT(`${COINGECKO_API}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    if (!Array.isArray(raw) || !raw.length) throw new Error('Empty');

    const data    = raw.map(p => ({ timestamp:p[0], open:p[1], high:p[2], low:p[3], close:p[4] }));
    const last    = data[data.length-1]?.close || 0;
    const first   = data[0]?.open || 0;
    const chg     = first > 0 ? ((last - first)/first)*100 : 0;

    const result = {
      symbol, days, data,
      stats:{
        currentPrice:last, openPrice:first,
        high:Math.max(...data.map(d=>d.high)), low:Math.min(...data.map(d=>d.low)),
        periodChange:chg, periodChangeFormatted:fmtChg(chg),
      },
      sparklineData: sparkline(data), timestamp:now, isFallback:false,
    };
    CACHE[key] = { data:result, ts:now };
    return result;
  } catch (e) {
    console.warn(`[Chart] CoinGecko failed for ${symbol}, fallback DexScreener:`, e.message);
    if (STABLE.has(symbol)) return empty(symbol, days);
    const token = CORE_TOKENS.find(t => t.symbol === symbol);
    const mint  = mintOverride || token?.mint;
    if (mint) return buildOHLCFromGeckoTerminal(symbol, mint, days);
    return empty(symbol, days);
  }
}

export async function getVolumeData(symbol, days = 7, coinIdOverride = null) {
  const coinId = coinIdOverride || COINGECKO_IDS[symbol];
  if (!coinId) return [];
  const key = `vol_${symbol}_${days}`;
  const now = Date.now();
  if (CACHE[key] && now - CACHE[key].ts < CACHE_DURATION) return CACHE[key].data;
  try {
    const res = await fetchWT(`${COINGECKO_API}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!Array.isArray(body?.total_volumes)) throw new Error('No volume');
    const vol = body.total_volumes.map(p => ({ timestamp:p[0], volume:p[1] }));
    CACHE[key] = { data:vol, ts:now };
    return vol;
  } catch (_) { return []; }
}

export async function getFullChartData(symbol, days = 7, mintOverride = null, coinIdOverride = null) {
  const [ohlc, vol] = await Promise.all([
    getOHLCData(symbol, days, mintOverride, coinIdOverride),
    getVolumeData(symbol, days, coinIdOverride),
  ]);
  return { ...ohlc, volumeData: ohlc.volumeData?.length ? ohlc.volumeData : vol };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function empty(symbol, days) {
  return { symbol, days, data:[], stats:{ currentPrice:0, openPrice:0, high:0, low:0, periodChange:0, periodChangeFormatted:'0%' }, sparklineData:[], volumeData:[], timestamp:Date.now(), isFallback:true };
}
function sparkline(data) {
  if (!data?.length) return [];
  const step = Math.max(1, Math.floor(data.length/20));
  return data.filter((_,i) => i % step === 0).map(d => d.close);
}
function fmtChg(c) {
  if (!c && c !== 0) return '0%';
  return `${c >= 0 ? '+' : ''}${c.toFixed(2)}%`;
}

export function clearPriceChartCache() { Object.keys(CACHE).forEach(k => delete CACHE[k]); }
export default { getOHLCData, getVolumeData, getFullChartData, clearPriceChartCache };
