// services/jupiterV2.js
// Jupiter Swap V2 (api.jup.ag/swap/v2) — مسار احتياطي للعملات التي أخرجتها Metis من التوجيه العادي (مثل MECO).
// بلا مفتاح وبلا وسيط: الطلب مباشر من التطبيق. المعاملة تُوقَّع كما وصلت دون أي تعديل (بعض المسارات موقّعة من صانع السوق).
import * as web3 from '@solana/web3.js';
import bs58 from 'bs58';
import { Buffer } from 'buffer';
import { svcError } from './svcError';
import { IMPACT_BLOCK_PCT } from './guardedTokens';

const V2_ORDER   = 'https://api.jup.ag/swap/v2/order';
const V2_EXECUTE = 'https://api.jup.ag/swap/v2/execute';
const HEADERS    = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

// عملات رفضها المسار العادي (غير قابلة للتداول/لا مسار) — تُوجَّه مباشرة إلى V2 لمدة قصيرة
const V2_ONLY = {};
const V2_ONLY_TTL = 10 * 60 * 1000;
export const markV2Only = (mint) => { V2_ONLY[mint] = Date.now(); };
export const isV2Only   = (a, b) => [a, b].some(m => V2_ONLY[m] && Date.now() - V2_ONLY[m] < V2_ONLY_TTL);

const fetchT = async (url, options = {}, ms = 15000) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal, credentials: 'omit' });
  } catch (err) {
    if (err.name === 'AbortError') throw svcError('timeout');
    throw err;
  } finally { clearTimeout(timer); }
};

export async function fetchV2Order({ inputMint, outputMint, amount, taker, slippageBps }) {
  let url = `${V2_ORDER}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}`;
  if (slippageBps) url += `&slippageBps=${slippageBps}`;
  if (taker) url += `&taker=${taker}`;
  const res = await fetchT(url, { method: 'GET', headers: HEADERS }, 15000);
  const raw = await res.text();
  let data; try { data = JSON.parse(raw); } catch (_) { data = null; }
  if (!res.ok || !data) throw new Error(raw || `HTTP ${res.status}`);
  if (data.error || data.errorCode) throw new Error(data.errorMessage || data.error || String(data.errorCode));
  if (!data.outAmount || !(Number(data.outAmount) > 0)) throw svcError('no_route');
  return data;
}

// تأثير السعر: نقارن سعر الكمية الكاملة بسعر كمية صغيرة (1/50)
async function measureImpactPct(inputMint, outputMint, amount, slippageBps, full) {
  const jp = parseFloat(full.priceImpactPct);
  if (isFinite(jp) && jp >= 0 && full.priceImpactPct !== '-1' && jp !== -1) return Math.abs(jp);
  const probeAmt = Math.floor(Number(amount) / 50);
  if (probeAmt < 1) return 0;
  try {
    const probe = await fetchV2Order({ inputMint, outputMint, amount: String(probeAmt), slippageBps });
    const pFull  = Number(full.outAmount)  / Number(amount);
    const pProbe = Number(probe.outAmount) / probeAmt;
    return Math.max(0, (1 - pFull / pProbe) * 100);
  } catch (_) {
    return IMPACT_BLOCK_PCT + 1;   // تعذّر القياس → نحجب (الأمان أولاً)
  }
}

// يعيد كائناً بصيغة عرض السعر المعتاد، مع علامة _v2
export async function v2Quote(inputMint, outputMint, amount, slippageBps = 100) {
  const order  = await fetchV2Order({ inputMint, outputMint, amount: String(amount), slippageBps });
  const impact = await measureImpactPct(inputMint, outputMint, amount, slippageBps, order);
  return {
    inAmount:       String(order.inAmount || amount),
    outAmount:      String(order.outAmount),
    priceImpactPct: String(impact / 100),   // نسبة عشرية مثل المسار العادي
    routePlan:      [{ portionBps: 10000, swapInfo: { label: order.router || 'Jupiter' } }],
    _v2:            true,
    _slippageBps:   slippageBps,
  };
}

async function sigStatus(connection, sig) {
  try {
    const { value } = await connection.getSignatureStatuses([sig]);
    const st = value?.[0];
    if (!st) return null;
    if (st.err) return false;
    if (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized') return true;
    return null;
  } catch (_) { return null; }
}

// تنفيذ عبر V2: طلب جديد مع taker → توقيع بلا تعديل → /execute → تحقق على السلسلة
export async function executeV2Swap({ inputMint, outputMint, amount, slippageBps, quotedOut, keypair, userPubKey, connection }) {
  const order = await fetchV2Order({ inputMint, outputMint, amount: String(amount), slippageBps, taker: userPubKey.toString() });
  if (!order.transaction || !order.requestId) throw svcError('tx_incomplete');

  // لا ننفّذ إن تدهور الناتج عن المعروض بأكثر من الانزلاق المسموح
  const minOut = Number(quotedOut) * (1 - (slippageBps || 100) / 10000);
  if (Number(order.outAmount) < minOut) throw svcError('quote_failed', { msg: 'price_moved' });

  const tx = web3.VersionedTransaction.deserialize(Buffer.from(order.transaction, 'base64'));
  tx.sign([keypair]);
  const sig = bs58.encode(tx.signatures[0]);
  const signedB64 = Buffer.from(tx.serialize()).toString('base64');

  let execErr = null;
  try {
    const res = await fetchT(V2_EXECUTE, {
      method: 'POST', headers: HEADERS,
      body: JSON.stringify({ signedTransaction: signedB64, requestId: order.requestId }),
    }, 30000);
    const data = await res.json().catch(() => null);
    if (res.ok && data && data.status === 'Success' && Number(data.code) === 0) {
      return { signature: data.signature || sig, outAmount: Number(data.outputAmountResult || order.outAmount) };
    }
    execErr = new Error((data && (data.error || data.message)) || `HTTP ${res.status}`);
    execErr.definitiveFail = !!(data && data.status === 'Failed');
  } catch (err) { execErr = err; }

  // الحالة غير مؤكدة: نتحقق من السلسلة قبل الحكم
  for (let i = 0; i < 10; i++) {
    const st = await sigStatus(connection, sig);
    if (st === true)  return { signature: sig, outAmount: Number(order.outAmount) };
    if (st === false) { const e = svcError('tx_rejected'); throw e; }
    await new Promise(r => setTimeout(r, 2000));
  }
  const e = execErr || svcError('tx_rejected');
  e.noRetry = !execErr.definitiveFail;   // لا نعيد المحاولة إن كان قد تكون المعاملة نُفّذت
  throw e;
}

// رسوم الخدمة: تحويل منفصل بعد نجاح التبديل (لا يمكن تعديل معاملة V2) — لا يفشل التبديل بسببه
export async function sendServiceFee({ connection, keypair, userPubKey, feeTo, lamports }) {
  try {
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    const msg = new web3.TransactionMessage({
      payerKey: userPubKey, recentBlockhash: blockhash,
      instructions: [web3.SystemProgram.transfer({ fromPubkey: userPubKey, toPubkey: new web3.PublicKey(feeTo), lamports })],
    }).compileToV0Message();
    const tx = new web3.VersionedTransaction(msg);
    tx.sign([keypair]);
    await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
  } catch (e) { console.warn('[V2] fee transfer skipped:', e.message); }
}
