// services/tradingService.js
import * as web3 from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';
import bs58 from 'bs58';
import { Buffer } from 'buffer';
import { default as heliusService } from './heliusService';
import { svcError } from './svcError';
import { IMPACT_GUARD_MINTS, IMPACT_BLOCK_PCT } from './guardedTokens';
import { v2Quote, executeV2Swap, sendServiceFee, markV2Only, isV2Only } from './jupiterV2';

const FEE_COLLECTOR_ADDRESS = 'BkaJsFAJKPQZgreBFLrY2pPUi44fTJzXhmeBc8LeuF5W';
const SERVICE_FEE_SOL       = 0.0005;
const MECO_MINT             = 'A5Ln25cfww33kfUSzBb89bMha7j1PnFQTy7H3FsQHN7W';

// ✅ نفس مسار swapService: lite-api.jup.ag هو المسار الحالي من Jupiter (مجاني وبدون مفتاح)
// تم حذف quote-api.jup.ag/v6 القديم لأنه يسبب تأخيرًا قبل الرجوع إلى lite-api
const JUPITER_QUOTE_API = 'https://lite-api.jup.ag/swap/v1/quote';
const JUPITER_SWAP_API  = 'https://lite-api.jup.ag/swap/v1/swap';

// ترويسات الطلبات — بدون مفتاح وبدون انتحال ترويسات الموقع
const API_HEADERS = {
  'Accept':       'application/json',
  'Content-Type': 'application/json',
};

const fetchWT = async (url, options = {}, ms = 20000) => {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal, credentials: 'omit' });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw svcError('timeout');
    throw err;
  }
};

async function getKeypair(activeIndex) {
  let pk = await SecureStore.getItemAsync(`wallet_private_key_${activeIndex}`);
  if (!pk && activeIndex === 0) pk = await SecureStore.getItemAsync('wallet_private_key');
  if (!pk) throw svcError('no_key');
  const secretKey = pk.startsWith('[') ? new Uint8Array(JSON.parse(pk)) : bs58.decode(pk);
  return web3.Keypair.fromSecretKey(secretKey);
}

async function getConnection() {
  try { return await heliusService.getConnection(); }
  catch (_) { return new web3.Connection('https://api.mainnet-beta.solana.com', 'confirmed'); }
}

// ─── Quote — مع معالجة MECO مطابقة لـ swapService ───────────────────────────
async function getQuote(inputMint, outputMint, amount, slippageBps = 50) {
  const isMeco          = inputMint === MECO_MINT || outputMint === MECO_MINT;
  const extraParams     = isMeco ? '&onlyDirectRoutes=false' : '';
  const effectiveSlippage = isMeco ? Math.max(slippageBps, 300) : slippageBps;

  if (isV2Only(inputMint, outputMint)) {
    return v2Quote(inputMint, outputMint, amount, effectiveSlippage);
  }

  const endpoints = [
    { name: 'Lite API', url: JUPITER_QUOTE_API },
  ];

  let lastError;
  for (const ep of endpoints) {
    try {
      const url = `${ep.url}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${effectiveSlippage}${extraParams}`;
      const res = await fetchWT(url, { method: 'GET', headers: API_HEADERS }, 15000);

      if (!res.ok) {
        const raw = await res.text();
        if (raw.includes('TOKEN_NOT_TRADABLE') || raw.includes('is not tradable')) {
          lastError = new Error('TOKEN_NOT_TRADABLE'); continue;
        }
        if (raw.includes('insufficient_balance')) {
          lastError = new Error('INSUFFICIENT_BALANCE'); continue;
        }
        lastError = new Error(raw); continue;
      }

      const quote = await res.json();
      if (!quote?.routePlan?.length) { lastError = new Error('NO_ROUTE'); continue; }
      return quote;
    } catch (err) { lastError = err; }
  }
  // احتياطي: Swap V2 عند فشل المسار العادي
  try {
    const q = await v2Quote(inputMint, outputMint, amount, effectiveSlippage);
    if (isMeco) markV2Only(MECO_MINT);
    return q;
  } catch (_) {}
  throw lastError || new Error('NO_ROUTE');
}

// ─── Swap TX ──────────────────────────────────────────────────────────────────
async function buildSwapTx(quote, walletPublicKey) {
  const endpoints = [
    { url: JUPITER_SWAP_API },
  ];
  let lastError;
  for (const ep of endpoints) {
    try {
      const res = await fetchWT(ep.url, {
        method: 'POST', headers: API_HEADERS,
        body: JSON.stringify({
          quoteResponse:             quote,
          userPublicKey:             walletPublicKey,
          wrapAndUnwrapSol:          true,
          dynamicComputeUnitLimit:   true,
          prioritizationFeeLamports: 'auto',
          asLegacyTransaction:       false,
        }),
      }, 20000);
      if (!res.ok) {
        const raw = await res.text();
        if (raw.includes('insufficient_balance') || raw.includes('Insufficient balance')) {
          lastError = new Error('INSUFFICIENT_BALANCE'); continue;
        }
        lastError = new Error(raw); continue;
      }
      const data = await res.json();
      if (!data.swapTransaction) { lastError = svcError('tx_incomplete'); continue; }
      return data.swapTransaction;
    } catch (err) { lastError = err; }
  }
  throw lastError || svcError('build_failed');
}

// ─── تنفيذ المعاملة — الرسوم atomic ─────────────────────────────────────────
async function executeVersionedTx(swapTxBase64, keypair, connection, walletPublicKey) {
  const buffer = Buffer.from(swapTxBase64, 'base64');
  let tx       = web3.VersionedTransaction.deserialize(buffer);

  const luts = await Promise.all(
    tx.message.addressTableLookups.map(async lut =>
      (await connection.getAddressLookupTable(lut.accountKey)).value
    )
  );
  const validLuts = luts.filter(Boolean);

  const msg = web3.TransactionMessage.decompile(tx.message, {
    addressLookupTableAccounts: validLuts,
  });

  msg.instructions.push(
    web3.SystemProgram.transfer({
      fromPubkey: new web3.PublicKey(walletPublicKey),
      toPubkey:   new web3.PublicKey(FEE_COLLECTOR_ADDRESS),
      lamports:   Math.floor(SERVICE_FEE_SOL * web3.LAMPORTS_PER_SOL),
    })
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  msg.recentBlockhash = blockhash;
  tx = new web3.VersionedTransaction(msg.compileToV0Message(validLuts));
  tx.sign([keypair]);

  let sig;
  try {
    sig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true, maxRetries: 5, preflightCommitment: 'processed',
    });
  } catch (_) {
    sig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false, maxRetries: 3,
    });
  }

  let blockhashData = { blockhash, lastValidBlockHeight };
  for (let i = 0; i < 3; i++) {
    try {
      const conf = await connection.confirmTransaction(
        { signature: sig, ...blockhashData }, 'confirmed'
      );
      if (conf.value?.err) throw svcError('tx_rejected');
      break;
    } catch (err) {
      if (i < 2) {
        blockhashData = await connection.getLatestBlockhash('confirmed');
        await new Promise(r => setTimeout(r, 2000));
      } else throw err;
    }
  }

  return sig;
}

// ─── Market Swap ✅ ────────────────────────────────────────────────────────────
export async function executeMarketSwap({
  inputMint, outputMint, amount, walletPublicKey, activeIndex,
}) {
  const keypair    = await getKeypair(activeIndex);
  const connection = await getConnection();
  const quote      = await getQuote(inputMint, outputMint, amount);
  if ((IMPACT_GUARD_MINTS.includes(inputMint) || IMPACT_GUARD_MINTS.includes(outputMint))
      && parseFloat(quote.priceImpactPct || 0) * 100 > IMPACT_BLOCK_PCT) {
    throw new Error('PRICE_IMPACT_TOO_HIGH');
  }
  if (quote._v2) {
    const userPubKey = new web3.PublicKey(walletPublicKey);
    const r = await executeV2Swap({
      inputMint, outputMint, amount, slippageBps: quote._slippageBps,
      quotedOut: quote.outAmount, keypair, userPubKey, connection,
    });
    await sendServiceFee({
      connection, keypair, userPubKey, feeTo: FEE_COLLECTOR_ADDRESS,
      lamports: Math.floor(SERVICE_FEE_SOL * web3.LAMPORTS_PER_SOL),
    });
    return r.signature;
  }
  const swapTx     = await buildSwapTx(quote, walletPublicKey);
  return executeVersionedTx(swapTx, keypair, connection, walletPublicKey);
}
