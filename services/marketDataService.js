// services/marketDataService.js


const FINNHUB_BASE   = 'https://finnhub.io/api/v1';
const YAHOO_BASE     = 'https://query1.finance.yahoo.com/v8/finance/chart';
const FETCH_TIMEOUT  = 8000;
const CACHE_DURATION = 120000;

const FINNHUB_KEY = 'db711tpr01qspnlfv7igdb711tpr01qspnlfv7j0';

const CACHE = {
  commodities:     null,
  commoditiesTime: 0,
  stocks:          null,
  stocksTime:      0,
};

export const COMMODITIES = [
  { id:'GC=F', symbol:'XAU',    name:'الذهب',         nameEn:'Gold',         emoji:'🥇', color:'#FFD700' },
  { id:'SI=F', symbol:'XAG',    name:'الفضة',         nameEn:'Silver',       emoji:'🥈', color:'#C0C0C0' },
  { id:'CL=F', symbol:'WTI',    name:'النفط الخام',   nameEn:'Crude Oil',    emoji:'🛢️', color:'#4A4A4A' },
  { id:'BZ=F', symbol:'BRENT',  name:'نفط برنت',      nameEn:'Brent',        emoji:'🛢️', color:'#2C2C2C' },
  { id:'NG=F', symbol:'NG',     name:'الغاز الطبيعي', nameEn:'Natural Gas',  emoji:'🔥', color:'#FF6B35' },
  { id:'HG=F', symbol:'COPPER', name:'النحاس',        nameEn:'Copper',       emoji:'🔶', color:'#B87333' },
];

export const US_STOCKS = [
  { id:'AAPL',  symbol:'AAPL',  name:'Apple',     nameEn:'Apple',     emoji:'🍎', color:'#A2AAAD' },
  { id:'TSLA',  symbol:'TSLA',  name:'Tesla',     nameEn:'Tesla',     emoji:'⚡', color:'#E82127' },
  { id:'NVDA',  symbol:'NVDA',  name:'NVIDIA',    nameEn:'NVIDIA',    emoji:'🎮', color:'#76B900' },
  { id:'MSFT',  symbol:'MSFT',  name:'Microsoft', nameEn:'Microsoft', emoji:'💻', color:'#00A4EF' },
  { id:'GOOGL', symbol:'GOOGL', name:'Google',    nameEn:'Google',    emoji:'🔍', color:'#4285F4' },
  { id:'AMZN',  symbol:'AMZN',  name:'Amazon',    nameEn:'Amazon',    emoji:'📦', color:'#FF9900' },
  { id:'META',  symbol:'META',  name:'Meta',      nameEn:'Meta',      emoji:'👤', color:'#0866FF' },
  { id:'AMD',   symbol:'AMD',   name:'AMD',       nameEn:'AMD',       emoji:'⚙️', color:'#ED1C24' },
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

const fetchCommodity = async (item) => {
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
      name:                        item.name,
      nameEn:                      item.nameEn || item.name,
      emoji:                       item.emoji,
      color:                       item.color,
      current_price:               price,
      price_change_percentage_24h: +change.toFixed(2),
      currency:                    meta.currency || 'USD',
    };
  } catch (_) { return null; }
};

const fetchStock = async (item) => {
  try {
    if (!FINNHUB_KEY) {
      console.warn('⚠️ [Finnhub] API key missing — check config/apiKeys.js');
      return null;
    }
    const url  = `${FINNHUB_BASE}/quote?symbol=${item.id}&token=${FINNHUB_KEY}`;
    const res  = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data.c !== 'number' || data.c === 0) return null;
    return {
      id:                          item.id,
      symbol:                      item.symbol,
      name:                        item.name,
      nameEn:                      item.nameEn || item.name,
      emoji:                       item.emoji,
      color:                       item.color,
      current_price:               data.c,
      price_change_percentage_24h: +(data.dp || 0).toFixed(2),
      currency:                    'USD',
      high:                        data.h || 0,
      low:                         data.l || 0,
      open:                        data.o || 0,
      prev_close:                  data.pc || 0,
    };
  } catch (_) { return null; }
};

const fetchAll = async (list, fetcher) => {
  const results = await Promise.all(list.map(fetcher));
  return results.filter(Boolean);
};

export async function getCommodities() {
  const now = Date.now();
  if (CACHE.commodities && now - CACHE.commoditiesTime < CACHE_DURATION) {
    return CACHE.commodities;
  }
  try {
    const data = await fetchAll(COMMODITIES, fetchCommodity);
    CACHE.commodities     = data;
    CACHE.commoditiesTime = now;
    return data;
  } catch (err) {
    console.warn('❌ [Commodities] failed:', err.message);
    return CACHE.commodities || [];
  }
}

export async function getUSStocks() {
  const now = Date.now();
  if (CACHE.stocks && now - CACHE.stocksTime < CACHE_DURATION) {
    return CACHE.stocks;
  }
  try {
    const data = await fetchAll(US_STOCKS, fetchStock);
    CACHE.stocks     = data;
    CACHE.stocksTime = now;
    return data;
  } catch (err) {
    console.warn('❌ [Stocks] failed:', err.message);
    return CACHE.stocks || [];
  }
}

export function clearMarketDataCache() {
  CACHE.commodities     = null;
  CACHE.commoditiesTime = 0;
  CACHE.stocks          = null;
  CACHE.stocksTime      = 0;
}

export default { getCommodities, getUSStocks, clearMarketDataCache, COMMODITIES, US_STOCKS };
