// services/assetChartService.js
// خدمة الرسوم البيانية للعملات الرقمية العالمية (CoinGecko)

const CG_BASE      = 'https://api.coingecko.com/api/v3';

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

const CG_TF = {
  '1D':  1,
  '7D':  7,
  '30D': 30,
  '90D': 90,
  '1Y':  365,
};


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
  if (asset.coingeckoId) return getCoinGeckoChart(asset.coingeckoId, tfLabel);
  return { data: [], stats: null };
}
