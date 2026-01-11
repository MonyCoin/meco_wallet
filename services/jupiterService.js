const JUPITER_BASE = 'https://quote-api.jup.ag/v6';

/**
 * جلب quote (سعر متوقع)
 * @param {string} inputMint
 * @param {string} outputMint
 * @param {number} amountBaseUnits  // ⚠️ base units فقط
 */
export async function fetchQuoteViaRest(
  inputMint,
  outputMint,
  amountBaseUnits
) {
  const url =
    `${JUPITER_BASE}/quote` +
    `?inputMint=${inputMint}` +
    `&outputMint=${outputMint}` +
    `&amount=${amountBaseUnits}` +
    `&slippageBps=50`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Quote failed: ${res.status}`);
  }

  const data = await res.json();

  if (!data?.data?.length) {
    throw new Error('No valid route');
  }

  // نأخذ أفضل route
  return data.data[0];
}

/**
 * تنفيذ swap
 * @param {object} quote
 * @param {string} userPublicKey
 * @param {function} signAndSend
 */
export async function executeSwapViaRest(
  quote,
  userPublicKey,
  signAndSend
) {
  try {
    const res = await fetch(`${JUPITER_BASE}/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey,
        wrapAndUnwrapSol: true,
      }),
    });

    if (!res.ok) {
      throw new Error(`Swap API failed: ${res.status}`);
    }

    const data = await res.json();

    if (!data?.swapTransaction) {
      throw new Error('Invalid swap transaction');
    }

    const txBuffer = Buffer.from(data.swapTransaction, 'base64');
    const txid = await signAndSend(txBuffer);

    return { success: true, txid };
  } catch (err) {
    console.error('❌ Swap error:', err.message);
    return { success: false, error: err.message };
  }
}
