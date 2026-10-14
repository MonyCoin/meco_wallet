// services/assetChartService.js
// خدمة موحّدة للرسوم البيانية والأخبار للأصول الخارجية

const YAHOO_BASE   = 'https://query1.finance.yahoo.com/v8/finance/chart';
const CG_BASE      = 'https://api.coingecko.com/api/v3';
const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const FINNHUB_KEY  = 'db711tpr01qspnlfv7igdb711tpr01qspnlfv7j0';

const FETCH_TIMEOUT = 8000;

const fetchWT = (url, ms = FETCH_TIMEOUT) => {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, {
    signal: ctrl.signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (Mobile; MECO Wallet) AppleWebKit/537.36',
    },
  }).finally(() => clearTimeout(timer));
};

// ─── خريطة الأطر الزمنية ──────────────────────────────────────────────────────
const YAHOO_TF = {
  '1D':  { range: '1d',  interval: '5m'  },
  '7D':  { range: '5d',  interval: '30m' },
  '30D': { range: '1mo', interval: '1d'  },
  '90D': { range: '3mo', interval: '1d'  },
  '1Y':  { range: '1y',  interval: '1d'  },
};

const CG_TF = {
  '1D':  1,
  '7D':  7,
  '30D': 30,
  '90D': 90,
  '1Y':  365,
};

// ═════════════════════════════════════════════════════════════════════════════
// 📈 شارت Yahoo (أسهم + سلع)
// ═════════════════════════════════════════════════════════════════════════════
export async function getYahooChart(symbol, tfLabel = '30D') {
  const tf = YAHOO_TF[tfLabel] || YAHOO_TF['30D'];
  try {
    const url  = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?interval=${tf.interval}&range=${tf.range}`;
    const res  = await fetchWT(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const r    = body?.chart?.result?.[0];
    if (!r?.timestamp?.length) return { data: [], stats: null };

    const q = r.indicators?.quote?.[0] || {};
    const data = r.timestamp.map((ts, i) => ({
      timestamp: ts * 1000,
      open:      q.open?.[i]   ?? 0,
      high:      q.high?.[i]   ?? 0,
      low:       q.low?.[i]    ?? 0,
      close:     q.close?.[i]  ?? 0,
      volume:    q.volume?.[i] ?? 0,
    })).filter(c => c.open || c.close);

    const last  = data[data.length - 1] || {};
    const first = data[0] || {};
    const stats = {
      current: last.close || 0,
      open:    first.open || 0,
      high:    Math.max(...data.map(d => d.high || 0)),
      low:     Math.min(...data.map(d => d.low  || 0).filter(x => x > 0)),
      change:  first.open > 0 ? ((last.close - first.open) / first.open) * 100 : 0,
    };
    return { data, stats };
  } catch (e) {
    console.warn('[Yahoo Chart] failed:', e.message);
    return { data: [], stats: null };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 📊 شارت CoinGecko (عملات خارجية)
// ═════════════════════════════════════════════════════════════════════════════
export async function getCoinGeckoChart(coinId, tfLabel = '30D') {
  if (!coinId) return { data: [], stats: null };
  const days = CG_TF[tfLabel] || 30;
  try {
    const url  = `${CG_BASE}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
    const res  = await fetchWT(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arr  = await res.json();
    if (!Array.isArray(arr) || !arr.length) return { data: [], stats: null };

    const data = arr.map(([ts, o, h, l, c]) => ({
      timestamp: ts,
      open:      o, high: h, low: l, close: c,
    }));

    const last  = data[data.length - 1] || {};
    const first = data[0] || {};
    const stats = {
      current: last.close || 0,
      open:    first.open || 0,
      high:    Math.max(...data.map(d => d.high || 0)),
      low:     Math.min(...data.map(d => d.low  || 0).filter(x => x > 0)),
      change:  first.open > 0 ? ((last.close - first.open) / first.open) * 100 : 0,
    };
    return { data, stats };
  } catch (e) {
    console.warn('[CG Chart] failed:', e.message);
    return { data: [], stats: null };
  }
}

// ─── موجّه عام ────────────────────────────────────────────────────────────────
export async function getAssetChart(asset, tfLabel = '30D') {
  if (asset.type === 'stock' || asset.type === 'commodity') {
    return getYahooChart(asset.id, tfLabel);
  }
  if (asset.coingeckoId) return getCoinGeckoChart(asset.coingeckoId, tfLabel);
  return { data: [], stats: null };
}

// ═════════════════════════════════════════════════════════════════════════════
// 📰 الأخبار
// ═════════════════════════════════════════════════════════════════════════════
const fmtDate = (d) => d.toISOString().split('T')[0];

export async function getStockNews(symbol, limit = 5) {
  try {
    if (!FINNHUB_KEY) return [];
    const to   = new Date();
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const url  = `${FINNHUB_BASE}/company-news?symbol=${symbol}&from=${fmtDate(from)}&to=${fmtDate(to)}&token=${FINNHUB_KEY}`;
    const res  = await fetchWT(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arr  = await res.json();
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(n => n.headline && n.url)
      .slice(0, limit)
      .map(n => ({
        id:       n.id,
        headline: n.headline,
        summary:  n.summary || '',
        source:   n.source || '',
        image:    n.image || null,
        url:      n.url,
        datetime: n.datetime * 1000,
      }));
  } catch (e) {
    console.warn('[Finnhub News] failed:', e.message);
    return [];
  }
}

export async function getCryptoNews(limit = 5) {
  try {
    if (!FINNHUB_KEY) return [];
    const url = `${FINNHUB_BASE}/news?category=crypto&token=${FINNHUB_KEY}`;
    const res = await fetchWT(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arr = await res.json();
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(n => n.headline && n.url)
      .slice(0, limit)
      .map(n => ({
        id:       n.id,
        headline: n.headline,
        summary:  n.summary || '',
        source:   n.source || '',
        image:    n.image || null,
        url:      n.url,
        datetime: n.datetime * 1000,
      }));
  } catch (e) {
    console.warn('[Finnhub Crypto News] failed:', e.message);
    return [];
  }
}

// ─── موجّه عام للأخبار ───────────────────────────────────────────────────────
export async function getAssetNews(asset, limit = 5) {
  if (asset.type === 'stock') return getStockNews(asset.id, limit);
  if (asset.type === 'external_crypto') return getCryptoNews(limit);
  return [];
}

// ─── الأسهم: ملف تعريفي مختصر ─────────────────────────────────────────────────
export async function getStockProfile(symbol) {
  try {
    if (!FINNHUB_KEY) return null;
    const url = `${FINNHUB_BASE}/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`;
    const res = await fetchWT(url);
    if (!res.ok) return null;
    const d = await res.json();
    if (!d?.name) return null;
    return {
      name:      d.name,
      logo:      d.logo || null,
      industry:  d.finnhubIndustry || '',
      country:   d.country || '',
      exchange:  d.exchange || '',
      ipo:       d.ipo || '',
      weburl:    d.weburl || null,
      marketCap: (d.marketCapitalization || 0) * 1e6,
    };
  } catch (_) { return null; }
}
