// services/liquidityActions.js
// سحب/جمع رسوم/قراءة مراكز سيولة MECO على Orca (الإيداع يتم على موقع Orca)
// ⚠️ معاملات بأموال حقيقية - كل دالة تتحقق قبل التنفيذ.
import * as web3 from '@solana/web3.js';
import bs58 from 'bs58';
import heliusService, { clearBalanceCache } from './heliusService';
import { MECO_POOLS } from './liquidityService';
import { clearPositionsCache } from './liquidityPositions';
import { ensureBufferSubarray } from './bufferFix';

export const MECO_MINT = 'A5Ln25cfww33kfUSzBb89bMha7j1PnFQTy7H3FsQHN7W';
export const SLIPPAGE_PCT = 1;          // 1%
export const SERVICE_FEE_SOL = 0.0005;  // رسوم خدمة التطبيق (سحب فقط)
export const FEE_COLLECTOR_ADDRESS = 'BkaJsFAJKPQZgreBFLrY2pPUi44fTJzXhmeBc8LeuF5W';

let _listCache = null; // { owner, at, data }
const LIST_CACHE_MS = 60 * 1000;
function invalidateCaches() { _listCache = null; clearPositionsCache(); }

// رسوم الخدمة: معاملة منفصلة صغيرة بعد نجاح العملية الأساسية (لا تُدفع إن فشلت)
async function chargeServiceFee(connection, kp) {
  try {
    const tx = new web3.Transaction().add(web3.SystemProgram.transfer({
      fromPubkey: kp.publicKey,
      toPubkey: new web3.PublicKey(FEE_COLLECTOR_ADDRESS),
      lamports: Math.round(SERVICE_FEE_SOL * web3.LAMPORTS_PER_SOL),
    }));
    await web3.sendAndConfirmTransaction(connection, tx, [kp], { commitment: 'confirmed' });
    return true;
  } catch (e) {
    return false; // العملية الأساسية نجحت؛ لا نُفشل المستخدم بسبب الرسوم
  }
}

const OTHER_SYMBOL = { usdt: 'USDT', sol: 'SOL' };

function loadLibs() {
  ensureBufferSubarray();
  // eslint-disable-next-line global-require
  const orca = require('@orca-so/whirlpools-sdk');
  // eslint-disable-next-line global-require
  const common = require('@orca-so/common-sdk');
  // eslint-disable-next-line global-require
  const DecimalMod = require('decimal.js');
  return { orca, common, Decimal: DecimalMod.default || DecimalMod };
}

export function getKeypairFromStore(storePrivateKey) {
  if (!storePrivateKey) throw new Error('NO_KEY');
  const secretKey = storePrivateKey.startsWith('[')
    ? new Uint8Array(JSON.parse(storePrivateKey))
    : bs58.decode(storePrivateKey);
  return web3.Keypair.fromSecretKey(secretKey);
}

const isVersioned = (tx) => tx && typeof tx === 'object' && 'version' in tx;

function signerWallet(kp) {
  const signOne = (tx) => {
    if (isVersioned(tx)) tx.sign([kp]); else tx.partialSign(kp);
    return tx;
  };
  return {
    publicKey: kp.publicKey,
    signTransaction: async (tx) => signOne(tx),
    signAllTransactions: async (txs) => txs.map(signOne),
  };
}

function readOnlyWallet(publicKey) {
  const fail = async () => { throw new Error('read-only'); };
  return { publicKey, signTransaction: fail, signAllTransactions: fail };
}

async function makeContext(wallet) {
  const { orca } = loadLibs();
  const connection = await heliusService.getConnection();
  const ctx = orca.WhirlpoolContext.from(connection, wallet);
  const client = orca.buildWhirlpoolClient(ctx);
  return { ctx, client, connection };
}

function poolMeta(poolId) {
  const meta = MECO_POOLS.find(p => p.id === poolId);
  if (!meta) throw new Error('UNKNOWN_POOL');
  return meta;
}

// يحمّل المجمع ويتحقق أنه Splash وأن MECO أحد طرفيه
async function loadPool(client, ctx, poolId) {
  const { orca } = loadLibs();
  const meta = poolMeta(poolId);
  const pool = await client.getPool(meta.address, orca.IGNORE_CACHE);
  const data = pool.getData();
  // النطاق الكامل يُحسب من tickSpacing الفعلي لأي مجمع (Splash أو غيره)
  const mecoIsA = data.tokenMintA.toBase58() === MECO_MINT;
  const mecoIsB = data.tokenMintB.toBase58() === MECO_MINT;
  if (!mecoIsA && !mecoIsB) throw new Error('POOL_WITHOUT_MECO');
  const [lower, upper] = orca.TickUtil.getFullRangeTickIndex(data.tickSpacing);
  const extCtx = await orca.TokenExtensionUtil.buildTokenExtensionContext(ctx.fetcher, data, orca.IGNORE_CACHE);
  return { meta, pool, data, mecoIsA, lower, upper, extCtx };
}

function toDec(common, bn, decimals) {
  return common.DecimalUtil.fromBN(bn, decimals).toNumber();
}

/** قائمة مراكز المستخدم التفصيلية في مجمعي MECO */
export async function listPositions(ownerAddress, force = false) {
  if (!force && _listCache && _listCache.owner === ownerAddress && Date.now() - _listCache.at < LIST_CACHE_MS) {
    return _listCache.data;
  }
  const libs = loadLibs();
  const { orca, common } = libs;
  const owner = new web3.PublicKey(ownerAddress);
  const { ctx, client } = await makeContext(readOnlyWallet(owner));

  const map = await orca.getAllPositionAccountsByOwner({
    ctx, owner,
    includesPositions: true,
    includesPositionsWithTokenExtensions: true,
    includesBundledPositions: false,
  });

  // المكتبة تعيد Map (وليس كائنًا عاديًا)
  const entries = [];
  for (const key of ['positions', 'positionsWithTokenExtensions']) {
    const rec = map && map[key];
    if (!rec) continue;
    const pairs = typeof rec.entries === 'function' && !(rec instanceof Array) ? Array.from(rec.entries()) : Object.entries(rec);
    pairs.forEach(([addr, d]) => entries.push([addr, d]));
  }
  if (entries.some(([, d]) => !d || !d.whirlpool || d.liquidity === undefined)) throw new Error('UNEXPECTED_SHAPE');
  // المراكز المقفلة: حساب رمز المركز (Token-2022) مجمّد
  const frozenMints = new Set();
  try {
    const tok = await ctx.connection.getParsedTokenAccountsByOwner(
      owner, { programId: new web3.PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') },
    );
    tok.value.forEach(({ account }) => {
      const info = account?.data?.parsed?.info;
      if (info && info.state === 'frozen') frozenMints.add(info.mint);
    });
  } catch (e) { /* إن تعذر الفحص نعتمد على ترجمة رسالة الخطأ */ }

  const out = [];
  for (const meta of MECO_POOLS) {
    const mine = entries.filter(([, d]) => d.whirlpool.toBase58() === meta.address);
    if (mine.length === 0) continue;

    const p = await loadPool(client, ctx, meta.id);
    const decA = p.pool.getTokenAInfo().decimals;
    const decB = p.pool.getTokenBInfo().decimals;
    const mecoDec = p.mecoIsA ? decA : decB;
    const otherDec = p.mecoIsA ? decB : decA;

    for (const [address, d] of mine) {
      const est = orca.decreaseLiquidityQuoteByLiquidityWithParams({
        liquidity: d.liquidity,
        slippageTolerance: common.Percentage.fromFraction(SLIPPAGE_PCT, 100),
        tickLowerIndex: d.tickLowerIndex,
        tickUpperIndex: d.tickUpperIndex,
        sqrtPrice: p.data.sqrtPrice,
        tickCurrentIndex: p.data.tickCurrentIndex,
        tokenExtensionCtx: p.extCtx,
      });

      let feeMeco = null, feeOther = null;
      try {
        const spacing = p.data.tickSpacing;
        const pda = (idx) => orca.PDAUtil.getTickArrayFromTickIndex(
          idx, spacing, new web3.PublicKey(meta.address), orca.ORCA_WHIRLPOOL_PROGRAM_ID,
        ).publicKey;
        const [lowArr, upArr] = await Promise.all([
          ctx.fetcher.getTickArray(pda(d.tickLowerIndex), orca.IGNORE_CACHE),
          ctx.fetcher.getTickArray(pda(d.tickUpperIndex), orca.IGNORE_CACHE),
        ]);
        const fees = orca.collectFeesQuote({
          whirlpool: p.data,
          position: d,
          tickLower: orca.TickArrayUtil.getTickFromArray(lowArr, d.tickLowerIndex, spacing),
          tickUpper: orca.TickArrayUtil.getTickFromArray(upArr, d.tickUpperIndex, spacing),
          tokenExtensionCtx: p.extCtx,
        });
        feeMeco = toDec(common, p.mecoIsA ? fees.feeOwedA : fees.feeOwedB, mecoDec);
        feeOther = toDec(common, p.mecoIsA ? fees.feeOwedB : fees.feeOwedA, otherDec);
      } catch (e) { /* الرسوم اختيارية في العرض */ }

      out.push({
        address,
        poolId: meta.id,
        otherSymbol: OTHER_SYMBOL[meta.id] || '',
        mecoAmount: toDec(common, p.mecoIsA ? est.tokenEstA : est.tokenEstB, mecoDec),
        otherAmount: toDec(common, p.mecoIsA ? est.tokenEstB : est.tokenEstA, otherDec),
        feeMeco,
        feeOther,
        hasLiquidity: !d.liquidity.isZero(),
        locked: !!(d.positionMint && frozenMints.has(d.positionMint.toBase58())),
      });
    }
  }
  _listCache = { owner: ownerAddress, at: Date.now(), data: out };
  return out;
}

// تأكد أن المركز يخص المحفظة وفي مجمعات MECO فقط قبل أي سحب
async function assertOwnPosition(ownerAddress, positionAddress) {
  const list = await listPositions(ownerAddress, true);
  const found = list.find(x => x.address === positionAddress);
  if (!found) throw new Error('POSITION_NOT_FOUND');
  return found;
}

/** سحب كامل المركز (السيولة + الرسوم) وإغلاقه */
export async function withdrawPosition({ privateKey, positionAddress }) {
  const libs = loadLibs();
  const { orca, common } = libs;
  const kp = getKeypairFromStore(privateKey);
  const owner = kp.publicKey;
  const found = await assertOwnPosition(owner.toBase58(), positionAddress);
  if (found.locked) throw new Error('POSITION_LOCKED');

  const { client, connection } = await makeContext(signerWallet(kp));
  const position = await client.getPosition(positionAddress, orca.IGNORE_CACHE);
  const pool = await client.getPool(position.getData().whirlpool, orca.IGNORE_CACHE);

  const txs = await pool.closePosition(
    positionAddress,
    common.Percentage.fromFraction(SLIPPAGE_PCT, 100),
    owner, owner, owner,
    true,
  );
  const signatures = [];
  for (const tx of txs) {
    signatures.push(await tx.buildAndExecute());   // بالتسلسل
  }

  const feeCharged = await chargeServiceFee(connection, kp);
  clearBalanceCache();
  invalidateCaches();
  return { signatures, feeCharged };
}

/** جمع الرسوم فقط (يبقى المركز مفتوحًا) */
export async function collectPositionFees({ privateKey, positionAddress }) {
  const { orca } = loadLibs();
  const kp = getKeypairFromStore(privateKey);
  const owner = kp.publicKey;
  await assertOwnPosition(owner.toBase58(), positionAddress);

  const { client } = await makeContext(signerWallet(kp));
  const position = await client.getPosition(positionAddress, orca.IGNORE_CACHE);
  const tx = await position.collectFees(true);
  const signature = await tx.buildAndExecute();

  clearBalanceCache();
  invalidateCaches();
  return { signature };
}
