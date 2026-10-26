// services/liquidityPositions.js
// قراءة حصص المستخدم في مجمعات MECO على Orca (قراءة فقط - لا توقيع ولا معاملات)
import { PublicKey } from '@solana/web3.js';
import heliusService from './heliusService';
import { MECO_POOLS } from './liquidityService';
import { ensureBufferSubarray } from './bufferFix';

let _cache = null; // { owner, at, data }
export function clearPositionsCache() { _cache = null; }
const CACHE_MS = 60 * 1000;

// محفظة للقراءة فقط: أي محاولة توقيع تفشل فورًا
const readOnlyWallet = (publicKey) => ({
  publicKey,
  signTransaction: async () => { throw new Error('read-only'); },
  signAllTransactions: async () => { throw new Error('read-only'); },
});

// تحميل المكتبة عند الحاجة فقط حتى لا يتأثر تشغيل التطبيق
function loadSdk() {
  ensureBufferSubarray();
  // eslint-disable-next-line global-require
  return require('@orca-so/whirlpools-sdk');
}

/**
 * يرجع مصفوفة بنفس ترتيب MECO_POOLS:
 * { id, ok, positions, sharePct, valueUsd }
 * ok=false تعني تعذر القراءة (وليس "لا توجد حصة")
 */
export async function getUserPositions(ownerAddress, poolStats = [], force = false) {
  if (!ownerAddress) return MECO_POOLS.map(p => ({ id: p.id, ok: false }));
  if (!force && _cache && _cache.owner === ownerAddress && Date.now() - _cache.at < CACHE_MS) {
    return _cache.data;
  }

  try {
    const sdk = loadSdk();
    const owner = new PublicKey(ownerAddress);
    const connection = await heliusService.getConnection();
    const ctx = sdk.WhirlpoolContext.from(connection, readOnlyWallet(owner));

    const map = await sdk.getAllPositionAccountsByOwner({
      ctx,
      owner,
      includesPositions: true,
      includesPositionsWithTokenExtensions: true,
      includesBundledPositions: false,
    });

    // المكتبة تعيد Map (وليس كائنًا عاديًا)
    const all = [];
    for (const key of ['positions', 'positionsWithTokenExtensions']) {
      const rec = map && map[key];
      if (!rec) continue;
      const vals = typeof rec.values === 'function' && !(rec instanceof Array) ? Array.from(rec.values()) : Object.values(rec);
      vals.forEach(p => all.push(p));
    }
    // إن كان شكل البيانات غير مفهوم لا نقول "لا توجد حصة" بل نعلن التعذر
    if (all.some(p => !p || !p.whirlpool || p.liquidity === undefined)) throw new Error('unexpected shape');

    // تشخيص مؤقت: ما وجدته المكتبة فعليًا في المحفظة
    const dbg = `wallet ${ownerAddress.slice(0, 4)}...${ownerAddress.slice(-4)} | found ${all.length}: ` +
      all.map(p => p.whirlpool.toBase58().slice(0, 4)).join(',');

    const result = [];
    for (const pool of MECO_POOLS) {
      const mine = all.filter(p => p.whirlpool.toBase58() === pool.address);
      if (mine.length === 0) { result.push({ id: pool.id, ok: true, positions: 0, sharePct: 0, valueUsd: 0, debug: dbg }); continue; }

      let sharePct = null, valueUsd = null;
      try {
        const acc = await ctx.fetcher.getPool(new PublicKey(pool.address), sdk.IGNORE_CACHE);
        const fullRange = acc && acc.tickSpacing >= sdk.FULL_RANGE_ONLY_TICK_SPACING_THRESHOLD;
        const poolLiq = acc ? BigInt(acc.liquidity.toString()) : 0n;
        // النسبة مضمونة فقط في مجمع Splash (نطاق كامل دائمًا داخل السعر)
        if (fullRange && poolLiq > 0n) {
          const mineLiq = mine.reduce((s, p) => s + BigInt(p.liquidity.toString()), 0n);
          sharePct = Number((mineLiq * 1000000n) / poolLiq) / 10000;
          const tvl = (poolStats.find(s => s.id === pool.id) || {}).tvl;
          if (typeof tvl === 'number') valueUsd = (sharePct / 100) * tvl;
        }
      } catch (e) { /* نكتفي بعدد المراكز */ }

      result.push({ id: pool.id, ok: true, positions: mine.length, sharePct, valueUsd, debug: dbg });
    }

    _cache = { owner: ownerAddress, at: Date.now(), data: result };
    return result;
  } catch (e) {
    const msg = String((e && e.message) || e).slice(0, 90);
    return MECO_POOLS.map(p => ({ id: p.id, ok: false, debug: msg }));
  }
}
