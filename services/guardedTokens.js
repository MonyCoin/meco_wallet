// services/guardedTokens.js
// عملات إضافية على سولانا (مغلّفة/مجسّرة أو سيولتها محدودة): يُقرأ عدد خاناتها العشرية من السلسلة
// وتُطبَّق عليها حماية التأثير السعري (تحذير > 2%، حجب > 5%).
export const GUARDED_TOKENS = [
  { symbol:'cbBTC',   mint:'cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij', name:'Coinbase Wrapped BTC',   dec:8, cg:'coinbase-wrapped-btc' },
  { symbol:'WBTC',    mint:'3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh', name:'Wrapped BTC (Wormhole)', dec:8, cg:'bitcoin'  },
  { symbol:'WETH',    mint:'7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', name:'Wrapped ETH (Wormhole)', dec:8, cg:'ethereum' },
  { symbol:'WBNB',    mint:'9gP2kCy3wA1ctvYWQk75guqXuHfrEomqydHLtcTCqiLa', name:'Wrapped BNB (Wormhole)', dec:8, cg:'binancecoin' },
  { symbol:'LINK',    mint:'LinkhB3afbBKb2EQQu7s7umdZceV3wcvAUJhQAfQ23L', name:'Chainlink',               dec:9, cg:'chainlink' },
  { symbol:'UNI',     mint:'uniHfuPhEQSrtpzXpJZDCSq53yaejKKpNhFUiKoHKHV', name:'Uniswap',                 dec:9, cg:'uniswap' },
  { symbol:'AAVE',    mint:'AavE1kKKnesPw4MuRJmJ9jZs9QzEE8CPxQ3ViczUDfc1', name:'Aave',                    dec:9, cg:'aave' },
  { symbol:'SHIB',    mint:'shib5gSoVKPjwkXrxRk7SbQFzb2R9rQB3TgQWYX4RwW', name:'Shiba Inu',               dec:9, cg:'shiba-inu' },
  { symbol:'PEPE',    mint:'PEPEqnuuCDbBC89p1u9vpnP1KQ2oj1xTcQBsjt9X55m', name:'Pepe',                    dec:9, cg:'pepe' },
  { symbol:'ONDO',    mint:'ondohH8Vssxiqcy5u6Efi4AYN17KZrzQtv2a91dnrgW', name:'Ondo',                    dec:9, cg:'ondo-finance' },
  { symbol:'WLD',     mint:'WLDTE73PPdfFFjhpBz8Yuhvx5N45gvgEgyMXqwa3rFn', name:'Worldcoin',               dec:9, cg:'worldcoin-wld' },
  { symbol:'AVAX',    mint:'avaxGHCq3T7hoxd73oY2KY9hJSTaeMibXvHy5KNzh5D', name:'Avalanche',               dec:9, cg:'avalanche-2' },
  { symbol:'JTO',     mint:'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL', name:'Jito',                    dec:9, cg:'jito-governance-token', native:true },
  { symbol:'JitoSOL', mint:'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', name:'Jito Staked SOL',        dec:9, cg:null },
  { symbol:'mSOL',    mint:'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', name:'Marinade Staked SOL',     dec:9, cg:null },
  { symbol:'PYUSD',   mint:'2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo', name:'PayPal USD',             dec:6, cg:'paypal-usd', native:true },
  { symbol:'TRUMP',   mint:'6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN', name:'Official Trump',         dec:6, cg:'official-trump', native:true },
  { symbol:'FARTCOIN',mint:'9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump', name:'Fartcoin',               dec:6, cg:'fartcoin', native:true },
  { symbol:'POPCAT',  mint:'7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', name:'Popcat',                 dec:9, cg:'popcat', native:true },
  { symbol:'MEW',     mint:'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',  name:'cat in a dogs world',    dec:5, cg:'cat-in-a-dogs-world', native:true },
  { symbol:'TRX',    mint:'GbbesPbaYh5uiAZSYNXTc7w9jty1rpg3P9L4JeN4LkKc', name:'TRON',                    dec:6, cg:'tron' },
  { symbol:'cbLTC',  mint:'cbLTC4T5NpzSUtQ7ekgEMZGaUPVJY1ko6BUikqa4gGf', name:'Coinbase Wrapped LTC',    dec:8, cg:'litecoin' },
  { symbol:'wXRP',   mint:'6UpQcMAb5xMzxc7ZfPaVMgx3KqsvKZdT5U718BzD5We2', name:'Wrapped XRP (Hex Trust)', dec:6, cg:'ripple' },
  { symbol:'pSOL',   mint:'pSo1f9nQXWgXibFtKf7NWYxb5enAM4qfP6UJSiXRQfL', name:'Phantom Staked SOL',      dec:9, cg:null },
  { symbol:'KMNO',   mint:'KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS', name:'Kamino',                  dec:6, cg:'kamino', native:true },
  { symbol:'DOGE',   mint:'DoGEV7LASBkQbibMc5k5vKnTZoMg423GpJ5QtJEGfm7R', name:'Dogecoin (Wormhole NTT)', dec:8, cg:'dogecoin' },
  { symbol:'cbADA',  mint:'cbADAmv9issuPfhFwyQG3xac4DGPd1LDSt1oz7vwJsg', name:'Coinbase Wrapped ADA',    dec:6, cg:'cardano' },
];

export const GUARDED_SYMBOLS = GUARDED_TOKENS.map(t => t.symbol);
export const GUARDED_MINTS   = GUARDED_TOKENS.map(t => t.mint);

export const IMPACT_WARN_PCT  = 2;
export const IMPACT_BLOCK_PCT = 5;

// ربط عملة عالمية (CoinGecko id) بنسخها القابلة للتداول على سولانا
export const WRAPPED_BY_COINGECKO_ID = GUARDED_TOKENS.reduce((acc, t) => {
  if (t.cg) (acc[t.cg] = acc[t.cg] || []).push(t.symbol);
  return acc;
}, {});
