import { Buffer } from 'buffer';

const JUPITER_BASE = 'https://quote-api.jup.ag/v6';
const SOLANA_TOKEN_LIST =
  'https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json';

/* =======================
   QUOTE
======================= */
export async function fetchQuoteViaRest(
  inputMint,
  outputMint,
  amountBaseUnits,
  slippageBps = 50
) {
  if (!inputMint || !outputMint) {
    throw new Error('يرجى اختيار العملات');
  }

  if (inputMint === outputMint) {
    throw new Error('لا يمكن التبديل بين نفس العملة');
  }

  if (!amountBaseUnits || amountBaseUnits <= 0) {
    throw new Error('المبلغ غير صالح');
  }

  const url =
    `${JUPITER_BASE}/quote` +
    `?inputMint=${inputMint}` +
    `&outputMint=${outputMint}` +
    `&amount=${amountBaseUnits}` +
    `&slippageBps=${slippageBps}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`فشل جلب السعر (${res.status})`);
  }

  const data = await res.json();

  if (!data?.data?.length) {
    throw new Error('لا يوجد مسار تداول متاح');
  }

  return data.data[0];
}

/* =======================
   SWAP
======================= */
export async function executeSwapViaRest(
  quote,
  userPublicKey,
  signAndSend
) {
  try {
    const res = await fetch(`${JUPITER_BASE}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey,
        wrapAndUnwrapSol: true,
      }),
    });

    if (!res.ok) {
      throw new Error(`فشل إنشاء المعاملة (${res.status})`);
    }

    const data = await res.json();
    if (!data?.swapTransaction) {
      throw new Error('بيانات المعاملة غير صالحة');
    }

    const txBuffer = Buffer.from(data.swapTransaction, 'base64');
    const txid = await signAndSend(txBuffer);

    return { success: true, txid };
  } catch (err) {
    console.error('❌ executeSwapViaRest:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

/* =======================
   TOKENS
======================= */
export async function getJupiterTokens() {
  try {
    const res = await fetch(SOLANA_TOKEN_LIST);
    if (!res.ok) throw new Error('token list fetch failed');

    const json = await res.json();
    const tokens = json.tokens || [];

    return tokens
      .filter(t => t.chainId === 101)
      .map(t => ({
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        logoURI: t.logoURI,
      }));
  } catch (e) {
    console.error('❌ getJupiterTokens:', e.message);
    return getDefaultTokens();
  }
}

/* =======================
   FALLBACK TOKENS
======================= */
function getDefaultTokens() {
  return [
    {
      address: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      name: 'Solana',
      decimals: 9,
      logoURI:
        'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    },
    {
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      logoURI:
        'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    },
    {
      address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      logoURI:
        'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
    },
    {
      address: '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i',
      symbol: 'MECO',
      name: 'MonyCoin',
      decimals: 6,
      logoURI:
        'https://raw.githubusercontent.com/saadeh73/meco-project/main/meco-logo.png',
    },
  ];
}

/* =======================
   UTILS
======================= */
export function amountToBaseUnits(amount, decimals) {
  if (!amount || amount <= 0) return 0;
  return Math.floor(amount * Math.pow(10, decimals));
}

export function baseUnitsToAmount(baseUnits, decimals) {
  if (!baseUnits || baseUnits <= 0) return 0;
  return baseUnits / Math.pow(10, decimals);
}
