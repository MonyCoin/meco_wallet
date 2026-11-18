// services/rentReclaimService.js
// استرداد إيجار سولانا: إغلاق حسابات العملات الفارغة (رصيدها صفر) وإعادة إيجارها إلى مالك المحفظة.
// أمان: لا يُغلق أي حساب فيه رصيد، والإيجار يعود إلى المالك نفسه دون أي رسوم منصة.
import * as web3 from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import { default as heliusService } from './heliusService';
import { svcError } from './svcError';

export const BASE_FEE_LAMPORTS = 5000;   // رسم الشبكة لتوقيع واحد (لا رسوم أولوية)
const CLOSE_PER_TX = 12;                 // عدد الحسابات في المعاملة الواحدة (هامش أمان لحجم المعاملة)

const PROGRAMS = [splToken.TOKEN_PROGRAM_ID, splToken.TOKEN_2022_PROGRAM_ID];

// حسابات قابلة للإغلاق بأمان: رصيدها صفر، غير مجمّدة، المالك هو من يملك صلاحية الإغلاق،
// ولا تحمل إضافات Token-2022 قد تمنع الإغلاق (رسوم محجوزة، سرّية).
function isSafelyClosable(info, ownerStr) {
  if (!info || info.tokenAmount?.amount !== '0') return false;
  if (info.state && info.state !== 'initialized') return false;
  if (info.closeAuthority && info.closeAuthority !== ownerStr) return false;
  for (const ext of (info.extensions || [])) {
    const name = String(ext?.extension || '');
    if (name.toLowerCase().includes('confidential')) return false;
    if (Number(ext?.state?.withheldAmount || 0) > 0) return false;
  }
  return true;
}

export async function findReclaimableAccounts(ownerStr) {
  const connection = await heliusService.getConnection();
  const owner = new web3.PublicKey(ownerStr);

  const results = await Promise.all(PROGRAMS.map(programId =>
    connection.getParsedTokenAccountsByOwner(owner, { programId }).catch(() => null)
  ));
  if (results.every(r => r === null)) throw svcError('connect_failed');

  const out = [];
  results.forEach((res, i) => {
    for (const acc of (res?.value || [])) {
      const info = acc.account?.data?.parsed?.info;
      if (!isSafelyClosable(info, ownerStr)) continue;
      out.push({
        pubkey:    acc.pubkey.toBase58(),
        mint:      info.mint,
        programId: PROGRAMS[i].toBase58(),
        lamports:  acc.account.lamports,
      });
    }
  });
  const totalLamports = out.reduce((s, a) => s + a.lamports, 0);
  return { accounts: out, totalLamports };
}

export function estimateFeeLamports(accountCount) {
  return Math.ceil(accountCount / CLOSE_PER_TX) * BASE_FEE_LAMPORTS;
}

async function sendClose(connection, keypair, accs) {
  const owner = keypair.publicKey;
  const tx = new web3.Transaction();
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = owner;
  for (const a of accs) {
    tx.add(splToken.createCloseAccountInstruction(
      new web3.PublicKey(a.pubkey), owner, owner, [], new web3.PublicKey(a.programId),
    ));
  }
  return web3.sendAndConfirmTransaction(connection, tx, [keypair], { commitment: 'confirmed' });
}

// يغلق الحسابات على دفعات. عند فشل دفعة يُعاد المحاولة لكل حساب منفرداً حتى لا يعطّل حساب واحد الباقي.
export async function closeEmptyAccounts(keypair, accounts, onProgress) {
  const connection = await heliusService.getConnection();
  let closed = 0, reclaimedLamports = 0, failed = 0;

  for (let i = 0; i < accounts.length; i += CLOSE_PER_TX) {
    const chunk = accounts.slice(i, i + CLOSE_PER_TX);
    try {
      await sendClose(connection, keypair, chunk);
      closed += chunk.length;
      reclaimedLamports += chunk.reduce((s, a) => s + a.lamports, 0);
    } catch (_) {
      for (const a of chunk) {
        try {
          await sendClose(connection, keypair, [a]);
          closed += 1;
          reclaimedLamports += a.lamports;
        } catch (_) { failed += 1; }
      }
    }
    if (onProgress) onProgress(Math.min(i + CLOSE_PER_TX, accounts.length), accounts.length);
  }
  return { closed, failed, reclaimedLamports };
}
