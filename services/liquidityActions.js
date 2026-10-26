// services/liquidityActions.js
// إيداع/سحب/جمع رسوم سيولة MECO على Orca (مجمعات Splash - نطاق كامل فقط)
// ⚠️ معاملات بأموال حقيقية - كل دالة تتحقق قبل التنفيذ.
import * as web3 from '@solana/web3.js';
import bs58 from 'bs58';
import heliusService, { getSolBalance, getTokenBalance, clearBalanceCache } from './heliusService';
import { MECO_POOLS } from './liquidityService';
import { clearPositionsCache } from './liquidityPositions';

export const MECO_MINT = 'A5Ln25cfww33kfUSzBb89bMha7j1PnFQTy7H3FsQHN7W';
export const SLIPPAGE_PCT = 1;          // 1%
export const SOL_RESERVE = 0.02;        // احتياطي SOL للرسوم وإيجار الحسابات
export const SERVICE_FEE_SOL = 0.0005;  // رسوم خدمة التطبيق (إيداع وسحب فقط)
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
const NATIVE_MINT = 'So11111111111111111111111111111111111111112';

function loadLibs() {
  // eslint-disable-next-line global-require
  const orca = require('@orca-so/whirlpools-sdk');
  // eslint-disable-next-line global-require
  const common = require('@orca-so/common-sdk');
  // eslint-disable-next-line global-require
  const DecimalMod = require('decimal.js');
  return { orca, common, Decimal: DecimalMod.default || DecimalMod };
}

// تشخيص مؤقت: يعزل أي لبنة ترميز تفشل داخل بيئة التطبيق
function runDecodeProbes() {
  const out = [];
  const t = (name, fn) => { try { fn(); out.push(name + '=ok'); } catch (e) { out.push(name + '=ERR(' + String((e && e.message) || e).slice(0, 30) + ')'); } };
  let BN, bl, borsh;
  t('req', () => { BN = require('bn.js'); bl = require('buffer-layout'); borsh = require('@coral-xyz/borsh'); });
  if (BN) t('bn', () => new BN(Buffer.alloc(16), 10, 'le'));
  if (bl) t('blob', () => bl.blob(16).decode(Buffer.alloc(16), 0));
  if (bl) t('u8', () => bl.u8().decode(Buffer.alloc(4), 0));
  if (bl) t('u32', () => bl.u32().decode(Buffer.alloc(4), 0));
  if (bl) t('s32', () => bl.s32().decode(Buffer.alloc(4), 0));
  if (borsh) t('u64', () => borsh.u64().decode(Buffer.alloc(8), 0));
  if (borsh) t('u128', () => borsh.u128().decode(Buffer.alloc(16), 0));
  if (borsh) t('pk', () => borsh.publicKey().decode(Buffer.alloc(32), 0));
  if (borsh) t('struct', () => borsh.struct([borsh.u8('a'), borsh.u128('b')]).decode(Buffer.alloc(17), 0));
  if (borsh) t('array', () => borsh.array(borsh.u8(), 3).decode(Buffer.alloc(3), 0));
  t('sub', () => Buffer.alloc(8).subarray(2));
  return out.join(' ');
}

// تشخيص مؤقت: يفك بيانات المركز الحقيقية حقلًا حقلًا بنفس لبنات Anchor لمعرفة الحقل الذي يفشل
function runRealProbe(data) {
  try {
    if (!data) return 'nodata';
    const borsh = require('@coral-xyz/borsh');
    const spec = [
      ['pk1', () => borsh.publicKey()], ['pk2', () => borsh.publicKey()], ['liq', () => borsh.u128()],
      ['tl', () => borsh.i32()], ['tu', () => borsh.i32()], ['fgA', () => borsh.u128()], ['foA', () => borsh.u64()],
      ['fgB', () => borsh.u128()], ['foB', () => borsh.u64()], ['r0g', () => borsh.u128()], ['r0a', () => borsh.u64()],
    ];
    let off = 8; const res = [];
    for (const [name, mk] of spec) {
      try { const l = mk(); l.decode(data, off); off += l.span; res.push(name + ':ok'); }
      catch (e) { res.push(name + ':ERR(' + String((e && e.message) || e).slice(0, 25) + ')'); break; }
    }
    // بُنى تدريجية: أول عدد من الحقول يفشل معه الفك
    try {
      const mk9 = [() => borsh.publicKey('a'), () => borsh.publicKey('b'), () => borsh.u128('c'), () => borsh.i32('d'), () => borsh.i32('e'),
        () => borsh.u128('f'), () => borsh.u64('g'), () => borsh.u128('h'), () => borsh.u64('i')];
      for (let k = 1; k <= mk9.length; k += 1) {
        try { borsh.struct(mk9.slice(0, k).map(f => f())).decode(data.subarray(8)); res.push('s' + k + ':ok'); }
        catch (e) { res.push('s' + k + ':ERR(' + String((e && e.message) || e).slice(0, 20) + ')'); break; }
      }
    } catch (e) { res.push('progERR'); }
    try { borsh.array(borsh.struct([borsh.u128('x'), borsh.u64('y')]), 3).decode(Buffer.alloc(72), 0); res.push('arrStruct:ok'); }
    catch (e) { res.push('arrStruct:ERR(' + String((e && e.message) || e).slice(0, 20) + ')'); }
    try { borsh.struct([borsh.u8('p'), borsh.array(borsh.u8(), 3, 'q')]).decode(Buffer.alloc(4), 0); res.push('structArr:ok'); }
    catch (e) { res.push('structArr:ERR(' + String((e && e.message) || e).slice(0, 20) + ')'); }
    // وبنية كاملة كما يبنيها Anchor
    try {
      const st = borsh.struct([borsh.publicKey('a'), borsh.publicKey('b'), borsh.u128('c'), borsh.i32('d'), borsh.i32('e'),
        borsh.u128('f'), borsh.u64('g'), borsh.u128('h'), borsh.u64('i'),
        borsh.array(borsh.struct([borsh.u128('x'), borsh.u64('y')]), 3, 'rw')]);
      st.decode(data.subarray(8));
      res.push('fullStruct:ok');
    } catch (e) { res.push('fullStruct:ERR(' + String((e && e.message) || e).slice(0, 25) + ')'); }
    return res.join(' ');
  } catch (e) { return 'probeERR ' + String((e && e.message) || e).slice(0, 40); }
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
  if (data.tickSpacing < orca.FULL_RANGE_ONLY_TICK_SPACING_THRESHOLD) throw new Error('NOT_SPLASH_POOL');
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

function buildQuote(libs, mecoAmount, p) {
  const { orca, common, Decimal } = libs;
  const amount = new Decimal(String(mecoAmount));
  if (!amount.isFinite() || amount.lte(0)) throw new Error('INVALID_AMOUNT');
  return orca.increaseLiquidityQuoteByInputTokenUsingPriceSlippage(
    new web3.PublicKey(MECO_MINT),
    amount,
    p.lower,
    p.upper,
    common.Percentage.fromFraction(SLIPPAGE_PCT, 100),
    p.pool,
    p.extCtx,
  );
}

function describeQuote(libs, quote, p) {
  const { common } = libs;
  const decA = p.pool.getTokenAInfo().decimals;
  const decB = p.pool.getTokenBInfo().decimals;
  const mecoDec = p.mecoIsA ? decA : decB;
  const otherDec = p.mecoIsA ? decB : decA;
  const otherMint = (p.mecoIsA ? p.data.tokenMintB : p.data.tokenMintA).toBase58();
  return {
    mecoEst: toDec(common, p.mecoIsA ? quote.tokenEstA : quote.tokenEstB, mecoDec),
    mecoMax: toDec(common, p.mecoIsA ? quote.tokenMaxA : quote.tokenMaxB, mecoDec),
    otherEst: toDec(common, p.mecoIsA ? quote.tokenEstB : quote.tokenEstA, otherDec),
    otherMax: toDec(common, p.mecoIsA ? quote.tokenMaxB : quote.tokenMaxA, otherDec),
    otherMint,
    otherSymbol: OTHER_SYMBOL[p.meta.id] || '',
    otherIsSol: otherMint === NATIVE_MINT,
  };
}

/** معاينة الإيداع (بدون توقيع) */
export async function previewDeposit(ownerAddress, poolId, mecoAmount) {
  const libs = loadLibs();
  const owner = new web3.PublicKey(ownerAddress);
  const { ctx, client } = await makeContext(readOnlyWallet(owner));
  const p = await loadPool(client, ctx, poolId);
  const quote = buildQuote(libs, mecoAmount, p);
  return describeQuote(libs, quote, p);
}

/** رصيد المستخدم من MECO والعملة المقابلة وSOL */
export async function getDepositBalances(ownerAddress, otherMint) {
  const [meco, sol, other] = await Promise.all([
    getTokenBalance(MECO_MINT, true, ownerAddress),
    getSolBalance(true, ownerAddress),
    otherMint === NATIVE_MINT ? Promise.resolve(null) : getTokenBalance(otherMint, true, ownerAddress),
  ]);
  return { meco, sol, other: otherMint === NATIVE_MINT ? sol : other };
}

/** إيداع: يفتح مركزًا جديدًا بنطاق كامل. يرجع { signature, positionMint } */
export async function depositToPool({ privateKey, poolId, mecoAmount }) {
  const libs = loadLibs();
  const { orca } = libs;
  const kp = getKeypairFromStore(privateKey);
  const owner = kp.publicKey;
  const { ctx, client, connection } = await makeContext(signerWallet(kp));

  const p = await loadPool(client, ctx, poolId);
  const quote = buildQuote(libs, mecoAmount, p);
  const info = describeQuote(libs, quote, p);

  // التحقق من الأرصدة قبل أي معاملة
  const bal = await getDepositBalances(owner.toBase58(), info.otherMint);
  if (bal.meco < info.mecoMax) throw new Error('INSUFFICIENT_MECO');
  if (info.otherIsSol) {
    if (bal.sol < info.otherMax + SOL_RESERVE) throw new Error('INSUFFICIENT_SOL');
  } else {
    if (bal.other < info.otherMax) throw new Error('INSUFFICIENT_OTHER');
    if (bal.sol < SOL_RESERVE) throw new Error('INSUFFICIENT_SOL_FEES');
  }

  // مصفوفات النطاق الكامل موجودة عادة؛ نهيئها فقط إن لم تكن
  const initTx = await p.pool.initTickArrayForTicks([p.lower, p.upper], owner, orca.IGNORE_CACHE);
  if (initTx) await initTx.buildAndExecute();

  const { positionMint, tx } = await p.pool.openPositionWithMetadata(
    p.lower, p.upper, quote, owner, owner, undefined, undefined, true,
  );
  const signature = await tx.buildAndExecute();

  const feeCharged = await chargeServiceFee(connection, kp);
  clearBalanceCache();
  invalidateCaches();
  return { signature, positionMint: positionMint.toBase58(), feeCharged };
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
  // تشخيص مؤقت: ما أعادته المكتبة فعليًا + فحص مستقل يتجاوز المكتبة
  let dbg = `wallet ${ownerAddress.slice(0, 4)}..${ownerAddress.slice(-4)} | sdk positions: ${entries.length}` +
    (entries.length ? ' → ' + entries.map(([, d]) => d.whirlpool.toBase58().slice(0, 4) + (d.liquidity.isZero() ? '(0)' : '')).join(',') : '');
  if (entries.length === 0) {
    try {
      const conn = ctx.connection;
      const progs = ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'];
      let nft = 0, found = 0, decodeErr = '', realData = null;
      for (const pid of progs) {
        const res = await conn.getParsedTokenAccountsByOwner(owner, { programId: new web3.PublicKey(pid) });
        const mints = res.value
          .map(v => v.account.data.parsed.info)
          .filter(i => i.tokenAmount && i.tokenAmount.amount === '1' && i.tokenAmount.decimals === 0)
          .map(i => new web3.PublicKey(i.mint));
        nft += mints.length;
        if (!mints.length) continue;
        const pdas = mints.map(m => orca.PDAUtil.getPosition(orca.ORCA_WHIRLPOOL_PROGRAM_ID, m).publicKey);
        const infos = await conn.getMultipleAccountsInfo(pdas);
        infos.forEach((info) => {
          if (info && info.owner.equals(orca.ORCA_WHIRLPOOL_PROGRAM_ID)) {
            found += 1;
            if (!realData) realData = info.data;
            if (!decodeErr) {
              try { orca.WHIRLPOOL_CODER.decode(orca.AccountName.Position, info.data); decodeErr = 'decode-ok'; }
              catch (e) { decodeErr = 'decode-ERR ' + String((e && e.message) || e).slice(0, 50) + ' @ ' + String((e && e.stack) || '').split('\n').slice(1, 6).map(l => l.trim().slice(0, 55)).join(' ; '); }
            }
          }
        });
      }
      dbg += ` | nft:${nft} posAcc:${found} ${decodeErr.slice(0, 40)}`;
      if (decodeErr.startsWith('decode-ERR')) dbg += ' | probes: ' + runDecodeProbes() + ' | real: ' + runRealProbe(realData);
    } catch (e) {
      dbg += ' | scanErr ' + String((e && e.message) || e).slice(0, 80);
    }
  }

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
      });
    }
  }
  out.debug = dbg;
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
  await assertOwnPosition(owner.toBase58(), positionAddress);

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
