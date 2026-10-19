// services/marketDataService.js

const FINNHUB_BASE   = 'https://finnhub.io/api/v1';
const YAHOO_BASE     = 'https://query1.finance.yahoo.com/v8/finance/chart';
const FETCH_TIMEOUT  = 8000;
const CACHE_DURATION = 120000;

// ✅ المفتاح يُقرأ من متغير البيئة (يُحقن وقت البناء/التحديث) ولا يُكتب في الكود
// ملاحظة: يجب كتابة process.env.EXPO_PUBLIC_* بهذه الصيغة المباشرة ليعمل الاستبدال الثابت
const FINNHUB_KEY = process.env.EXPO_PUBLIC_FINNHUB_API_KEY;

const CACHE = {
  commodities:     null,
  commoditiesTime: 0,
  stocks:          null,
  stocksTime:      0,
  forex:           null,
  forexTime:       0,
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
      console.warn('⚠️ [Finnhub] API key missing');
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
  CACHE.commodities     = null;
  CACHE.commoditiesTime = 0;
  CACHE.stocks          = null;
  CACHE.stocksTime      = 0;
  CACHE.forex           = null;
  CACHE.forexTime       = 0;
}

export default { getCommodities, getUSStocks, getForexRates, clearMarketDataCache, COMMODITIES, US_STOCKS, FOREX_PAIRS };
