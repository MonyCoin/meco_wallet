import * as SecureStore from 'expo-secure-store';

const RPC = 'https://api.mainnet-beta.solana.com';

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 10000 } = options; // 10 ثواني مهلة افتراضية
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(resource, { ...options, signal: controller.signal });
  clearTimeout(id);
  return response;
}

export async function getJupiterTokens() {
  try {
    const response = await fetchWithTimeout('https://tokens.jup.ag/tokens');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const tokens = await response.json();

    const filtered = tokens.filter(token =>
      token.symbol &&
      token.address &&
      token.name &&
      token.logoURI &&
      typeof token.decimals === 'number'
    );

    return filtered.slice(0, 50).map(token => ({
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      logoURI: token.logoURI,
      decimals: token.decimals,
    }));
  } catch (err) {
    console.error('❌ Failed to fetch Jupiter tokens:', err);
    return [];
  }
}

export async function getGeckoPrices(symbols = []) {
  const idsMap = {
    SOL: 'solana',
    USDT: 'tether',
    BTC: 'bitcoin',
    ETH: 'ethereum',
    MECO: 'meco-token'
  };

  const ids = symbols.map(sym => idsMap[sym]).filter(Boolean);
  if (!ids.length) return [];

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();

    return symbols.map(sym => ({
      symbol: sym,
      price: data[idsMap[sym]]?.usd ?? 0,
    }));
  } catch (err) {
    console.warn('❌ Coingecko price error:', err.message);
    return symbols.map(sym => ({ symbol: sym, price: 0 }));
  }
}
