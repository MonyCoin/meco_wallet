// services/marketDataService.js

const YAHOO_BASE     = 'https://query1.finance.yahoo.com/v8/finance/chart';
const FETCH_TIMEOUT  = 8000;
const CACHE_DURATION = 120000;

const CACHE = {
  forex:           null,
  forexTime:       0,
};

// ─── أزواج العملات ────────────────────────────────────────────────────────────
// ✅ موسّعة: أضفنا أزواج رئيسية ناقصة (GBP/JPY, EUR/CHF, AUD/JPY) وأزواج إقليمية
// مهمة لجمهور عربي ودول نامية (TRY, INR, CNY, ZAR, MXN) — كل الصيغ هي تيكرات
// Yahoo Finance القياسية (XXXYYY=X)؛ أي زوج يفشل فى الجلب بيتفلتر تلقائيًا
// من fetchAll الموجودة أصلاً، فزيادة العدد دي بدون أي خطر على الشاشة لو زوج
// معيّن مش متاح مؤقتًا
export const FOREX_PAIRS = [
  { id:'EURUSD=X', symbol:'EUR/USD', digits:4 },
  { id:'GBPUSD=X', symbol:'GBP/USD', digits:4 },
  { id:'USDJPY=X', symbol:'USD/JPY', digits:2 },
  { id:'USDCHF=X', symbol:'USD/CHF', digits:4 },
  { id:'AUDUSD=X', symbol:'AUD/USD', digits:4 },
  { id:'USDCAD=X', symbol:'USD/CAD', digits:4 },
  { id:'NZDUSD=X', symbol:'NZD/USD', digits:4 },
  { id:'EURGBP=X', symbol:'EUR/GBP', digits:4 },
  { id:'EURJPY=X', symbol:'EUR/JPY', digits:2 },
  { id:'GBPJPY=X', symbol:'GBP/JPY', digits:2 },
  { id:'EURCHF=X', symbol:'EUR/CHF', digits:4 },
  { id:'AUDJPY=X', symbol:'AUD/JPY', digits:2 },
  { id:'USDAED=X', symbol:'USD/AED', digits:4 },
  { id:'USDSAR=X', symbol:'USD/SAR', digits:4 },
  { id:'USDEGP=X', symbol:'USD/EGP', digits:4 },
  { id:'USDTRY=X', symbol:'USD/TRY', digits:2 },
  { id:'USDINR=X', symbol:'USD/INR', digits:2 },
  { id:'USDCNY=X', symbol:'USD/CNY', digits:3 },
  { id:'USDZAR=X', symbol:'USD/ZAR', digits:2 },
  { id:'USDMXN=X', symbol:'USD/MXN', digits:2 },
];

const fetchWithTimeout = (url, ms = FETCH_TIMEOUT) => {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, {
    signal: ctrl.signal,
    headers: {
      'Accept':     'application/json',
      'User-Agent': 'Mozilla/5.0 (Mobile; MECO Wallet) AppleWebKit/537.36',
    },
  }).finally(() => clearTimeout(timer));
};

// ─── جلب زوج فوركس واحد ───────────────────────────────────────────────────────
const fetchForexPair = async (item) => {
  try {
    const url  = `${YAHOO_BASE}/${encodeURIComponent(item.id)}?interval=1d&range=1d`;
    const res  = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const body = await res.json();
    const meta = body?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price  = meta.regularMarketPrice || 0;
    const prev   = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change = (prev && price) ? ((price - prev) / prev) * 100 : 0;
    return {
      id:                          item.id,
      symbol:                      item.symbol,
      digits:                      item.digits,
      current_price:               price,
      price_change_percentage_24h: +change.toFixed(2),
    };
  } catch (_) { return null; }
};

const fetchAll = async (list, fetcher) => {
  const results = await Promise.all(list.map(fetcher));
  return results.filter(Boolean);
};

// ─── جلب أسعار الفوركس ────────────────────────────────────────────────────────
export async function getForexRates() {
  const now = Date.now();
  if (CACHE.forex && now - CACHE.forexTime < CACHE_DURATION) {
    return CACHE.forex;
  }
  try {
    const data = await fetchAll(FOREX_PAIRS, fetchForexPair);
    CACHE.forex     = data;
    CACHE.forexTime = now;
    return data;
  } catch (err) {
    console.warn('❌ [Forex] failed:', err.message);
    return CACHE.forex || [];
  }
}

export function clearMarketDataCache() {
  CACHE.forex           = null;
  CACHE.forexTime       = 0;
}

export default { getForexRates, clearMarketDataCache, FOREX_PAIRS };
