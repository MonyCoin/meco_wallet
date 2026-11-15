// services/coinInfoService.js
// معلومات العملة الرقمية (نبذة + الموقع + التواصل + الفئات) من CoinGecko — بلا أخبار ولا روابط خارجية عشوائية.
const CACHE_MS   = 10 * 60 * 1000;
const TIMEOUT_MS = 8000;
const CACHE = {};

const clean = (s) => String(s || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ').trim();

const shorten = (s, max = 320) => {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const dot = cut.lastIndexOf('. ');
  return (dot > 120 ? cut.slice(0, dot + 1) : cut.replace(/\s+\S*$/, '') + '…');
};

const httpsOnly = (u) => {
  const s = String(u || '').trim();
  return /^https:\/\/[^\s/$.?#][^\s]*\.[^\s]{2,}$/i.test(s) ? s : '';
};

export async function getCoinInfo(coingeckoId) {
  if (!coingeckoId) return null;
  const hit = CACHE[coingeckoId];
  if (hit && Date.now() - hit.ts < CACHE_MS) return hit.data;

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coingeckoId)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`,
      { signal: ctrl.signal, headers: { Accept: 'application/json' } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const L = j.links || {};

    const website  = httpsOnly((L.homepage || []).find(u => httpsOnly(u)));
    const tw       = /^[A-Za-z0-9_]{1,15}$/.test(L.twitter_screen_name || '') ? `https://x.com/${L.twitter_screen_name}` : '';
    const tg       = /^[A-Za-z0-9_]{3,}$/.test(L.telegram_channel_identifier || '') ? `https://t.me/${L.telegram_channel_identifier}` : '';
    const reddit   = /^https:\/\/(www\.)?reddit\.com\/r\/[A-Za-z0-9_]+\/?$/i.test(L.subreddit_url || '') ? L.subreddit_url : '';

    const data = {
      description: shorten(clean(j.description?.en)),
      website, twitter: tw, telegram: tg, reddit,
      categories: (j.categories || []).filter(Boolean).slice(0, 3),
    };
    CACHE[coingeckoId] = { data, ts: Date.now() };
    return data;
  } catch (_) {
    return hit?.data || null;
  } finally {
    clearTimeout(timer);
  }
}
