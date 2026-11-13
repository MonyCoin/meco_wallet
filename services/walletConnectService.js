// services/walletConnectService.js
import { Core } from '@walletconnect/core';
import { WalletKit } from '@reown/walletkit';
import { buildApprovedNamespaces, getSdkError } from '@walletconnect/utils';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';
import i18n from '../i18n';
import { useAppStore } from '../store';
import { requireAuth } from './appLock';
import * as web3 from '@solana/web3.js';
import { getAssociatedTokenAddress, AccountLayout, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import { Buffer } from 'buffer';
import { default as heliusService } from './heliusService';
import { svcError } from './svcError';
import { sessionMatchesActive, readVerify, buildSiteList } from './pureHelpers';

// معرّف مشروع WalletConnect/Reown: علني بطبيعته. يُقرأ من EXPO_PUBLIC_WC_PROJECT_ID إن وُجد، وإلا القيمة الحالية.
// (يجب كتابة process.env.EXPO_PUBLIC_* بهذه الصيغة المباشرة ليُدمج عند البناء)
const PROJECT_ID = process.env.EXPO_PUBLIC_WC_PROJECT_ID || '21dc279d9fb09e92a14421d4a189efec';
const WHIRLPOOL_PROGRAM_ID = 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
// Jupiter Lock (العنوان الرسمي من وثائق Jupiter) و Jupiter Swap v6
const JUPITER_LOCK_PROGRAM_ID = 'LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn';
const JUPITER_V6_PROGRAM_ID   = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';
const ATA_PROGRAM_ID         = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1gdS';
const SOL_MINT               = 'So11111111111111111111111111111111111111112';
export let web3wallet;

const listeners = {};
export const WCEvents = {
  on:   (event, cb)   => { listeners[event] = cb; },
  off:  (event)       => { delete listeners[event]; },
  emit: (event, data) => { if (listeners[event]) listeners[event](data); },
};

async function getLookupTables(vTx, connection) {
  if (!vTx.message.addressTableLookups?.length) return [];
  const tables = await Promise.all(
    vTx.message.addressTableLookups.map(async lut => {
      const result = await connection.getAddressLookupTable(lut.accountKey);
      return result.value;
    })
  );
  return tables.filter(Boolean);
}

// ✅ Anchor instruction discriminators لبرنامج Orca Whirlpool
// كل قيمة = أول 8 بايت من sha256("global:<اسم التعليمة بصيغة snake_case>")
const WHIRLPOOL_DISCRIMINATORS = {
  '87802f4d0f98f031': 'open_position',
  'f21d86303a6e0e3c': 'open_position',
  'd42f5f5c726683fa': 'open_position',
  '2e9cf3760dcdfbb2': 'add_liquidity',
  '851d59df45eeb00a': 'add_liquidity',
  'a026d06f685b2c01': 'remove_liquidity',
  '3a7fbc3e4f52c460': 'remove_liquidity',
  'a498cf631eba13b6': 'collect_fees',
  'cf755fbfe5b4e20f': 'collect_fees',
  '4605845756ebb122': 'collect_reward',
  'b16b25b4a01331d1': 'collect_reward',
  '7b86510031446262': 'close_position',
  'f8c69e91e17587c8': 'swap',
  '2b04ed0b1ac91e62': 'swap',
  'c360ed6c44a2dbe6': 'swap',
  'ba8fd11dfe02c275': 'swap',
  '5fb40aac54aee828': 'create_pool',
  'cf2d57f21b3fcc43': 'create_pool',
};

const OPERATION_PRIORITY = [
  'create_pool', 'open_position', 'close_position',
  'add_liquidity', 'remove_liquidity',
  'collect_fees', 'collect_reward', 'swap',
];

function detectWhirlpoolOperation(instructions) {
  const found = new Set();
  for (const ix of instructions) {
    const pid = ix.programId?.toBase58?.();
    if (pid !== WHIRLPOOL_PROGRAM_ID) continue;
    const data = ix.data;
    if (!data || data.length < 8) continue;
    const disc = Buffer.from(data).slice(0, 8).toString('hex');
    const type = WHIRLPOOL_DISCRIMINATORS[disc];
    if (type) found.add(type);
  }
  if (found.size === 0) return null;
  const primary = OPERATION_PRIORITY.find(t => found.has(t)) || [...found][0];
  return { type: primary };
}

const KNOWN_TOKENS = {
  'So11111111111111111111111111111111111111112': 'SOL',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
  'A5Ln25cfww33kfUSzBb89bMha7j1PnFQTy7H3FsQHN7W': 'MECO',
};

const WELL_KNOWN_DECIMALS = {
  'So11111111111111111111111111111111111111112': 9,
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6,
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6,
  'A5Ln25cfww33kfUSzBb89bMha7j1PnFQTy7H3FsQHN7W': 9,
};
const mintDecimalsCache = {};
async function getMintDecimals(connection, mint) {
  if (WELL_KNOWN_DECIMALS[mint] != null) return WELL_KNOWN_DECIMALS[mint];
  if (mintDecimalsCache[mint] != null) return mintDecimalsCache[mint];
  const info = await connection.getParsedAccountInfo(new web3.PublicKey(mint));
  const d = info?.value?.data?.parsed?.info?.decimals;
  if (typeof d !== 'number') throw new Error('mint decimals unavailable');
  mintDecimalsCache[mint] = d;
  return d;
}

const shortMint = (m) => `${m.slice(0, 4)}…${m.slice(-4)}`;
const MAX_SIM_ACCOUNTS = 100; // حد RPC لعدد الحسابات المُرجَعة من المحاكاة

// يحاكي المعاملة ويُرجع تغيّر أرصدة المحفظة (SOL + كل رموزها). يُرجع null إن تعذّر التحقق.
async function getBalanceChanges(connection, ownerPubkey, txForSim, instructions) {
  try {
    const owner   = new web3.PublicKey(ownerPubkey);
    const owner58 = owner.toBase58();

    const [legacyRes, t22Res, preSol] = await Promise.all([
      connection.getTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
      connection.getTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID }),
      connection.getBalance(owner),
    ]);

    // كل حسابات الرموز الموجودة للمحفظة: العنوان ← { mint, pre }
    const tracked = new Map();
    for (const r of [...legacyRes.value, ...t22Res.value]) {
      const dec = AccountLayout.decode(r.account.data.slice(0, AccountLayout.span));
      tracked.set(r.pubkey.toBase58(), { mint: dec.mint.toBase58(), pre: dec.amount });
    }

    // حسابات قد تُنشأ داخل المعاملة نفسها: الرموز المعروفة + أي AToken create تخص المحفظة
    await Promise.all(Object.keys(KNOWN_TOKENS).map(async (m) => {
      const ata = (await getAssociatedTokenAddress(new web3.PublicKey(m), owner)).toBase58();
      if (!tracked.has(ata)) tracked.set(ata, { mint: m, pre: 0n });
    }));
    for (const ix of instructions) {
      if (ix.programId?.toBase58?.() !== ATA_PROGRAM_ID) continue;
      const k = ix.keys;
      if (!k || k.length < 4 || k[2].pubkey.toBase58() !== owner58) continue;
      const ata = k[1].pubkey.toBase58();
      if (!tracked.has(ata)) tracked.set(ata, { mint: k[3].pubkey.toBase58(), pre: 0n });
    }

    const addrs = [...tracked.keys()];
    if (addrs.length + 1 > MAX_SIM_ACCOUNTS) return null; // لا نعرض ملخصاً ناقصاً

    const sim = await connection.simulateTransaction(txForSim, {
      accounts: { encoding: 'base64', addresses: [owner58, ...addrs] },
      sigVerify: false,
      replaceRecentBlockhash: true,
    });
    if (sim.value.err || !sim.value.accounts) return null;

    const [postOwner, ...postTokenAccs] = sim.value.accounts;
    const deltas = new Map(); // mint ← bigint (SOL الأصلي و wSOL يُدمجان تحت mint واحد)
    const add = (mint, d) => { if (d !== 0n) deltas.set(mint, (deltas.get(mint) || 0n) + d); };

    add(SOL_MINT, BigInt((postOwner?.lamports ?? preSol) - preSol));

    addrs.forEach((addr, i) => {
      const { mint, pre } = tracked.get(addr);
      const acc = postTokenAccs[i];
      let post = 0n;
      if (acc?.data?.[0]) {
        try {
          const raw = Buffer.from(acc.data[0], 'base64');
          post = raw.length >= AccountLayout.span ? AccountLayout.decode(raw.slice(0, AccountLayout.span)).amount : 0n;
        } catch (_) { post = pre; }
      }
      add(mint, post - pre);
    });

    const changes = [];
    for (const [mint, delta] of deltas) {
      if (mint === SOL_MINT && (delta > -1000n && delta < 1000n)) continue;
      const decimals = await getMintDecimals(connection, mint);
      changes.push({ symbol: KNOWN_TOKENS[mint] || shortMint(mint), amount: Number(delta) / 10 ** decimals });
    }
    changes.sort((a, b) => (a.amount < 0 ? 0 : 1) - (b.amount < 0 ? 0 : 1));
    return changes; // قد تكون فارغة = المحاكاة نجحت ولا تغيّر في الأرصدة
  } catch (e) {
    console.warn('⚠️ [getBalanceChanges] تعذّر التحقق:', e.message);
    return null;
  }
}

async function getNetworkFee(connection, message) {
  try {
    const { value } = await connection.getFeeForMessage(message, 'confirmed');
    return value != null ? value / web3.LAMPORTS_PER_SOL : null;
  } catch (_) {
    return null;
  }
}

async function parseTransactionDetails(method, params) {
  try {
    if (method === 'solana_signMessage') return { instructionCount: 0, programs: [], operation: null, estimatedFee: null, verified: null, noChange: false };
    const buffer     = Buffer.from(params.transaction, 'base64');
    const connection = await heliusService.getConnection();
    let   instructions = [];
    let   txForSim, messageForFee;
    try {
      const vTx  = web3.VersionedTransaction.deserialize(buffer);
      const luts = await getLookupTables(vTx, connection);
      const msg  = web3.TransactionMessage.decompile(vTx.message, { addressLookupTableAccounts: luts });
      instructions  = msg.instructions;
      txForSim      = vTx;
      messageForFee = vTx.message;
    } catch (_) {
      const legacyTx = web3.Transaction.from(buffer);
      instructions   = legacyTx.instructions;
      messageForFee   = legacyTx.compileMessage();
      txForSim        = new web3.VersionedTransaction(messageForFee);
    }
    const KNOWN = {
      [WHIRLPOOL_PROGRAM_ID]:                          'Orca Whirlpool',
      [JUPITER_LOCK_PROGRAM_ID]:                       'Jupiter Lock',
      [JUPITER_V6_PROGRAM_ID]:                         'Jupiter',
      'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb':  'Token-2022',
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'Token',
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1gdS': 'AToken',
      '11111111111111111111111111111111':             'System',
      'ComputeBudget111111111111111111111111111111':  'Budget',
    };
    const programs = [...new Set(instructions.map(ix => {
      const pid = ix.programId?.toBase58?.();
      return KNOWN[pid] || (pid ? pid.slice(0,6)+'...' : '?');
    }))];

    let operation = detectWhirlpoolOperation(instructions);
    if (!operation && programs.includes('Jupiter Lock')) operation = { type: 'jupiter_lock' };
    if (!operation && programs.includes('Jupiter'))      operation = { type: 'jupiter_swap' };

    // ✅ نحاكي كل معاملة (وليس Orca فقط) لنعرض ما سيخرج من المحفظة وما سيصل إليها،
    // بدل عرض خام (عدد التعليمات وأسماء البرامج) لا يفهمه المستخدم.
    const ownerPubkey = useAppStore.getState().walletPublicKey;
    const [changes, estimatedFee] = await Promise.all([
      ownerPubkey ? getBalanceChanges(connection, ownerPubkey, txForSim, instructions) : null,
      getNetworkFee(connection, messageForFee),
    ]);

    const verified = Array.isArray(changes);
    const noChange = verified && changes.length === 0;
    if (verified && !noChange) {
      const summary = changes.map(c => ({
        label: c.amount < 0 ? i18n.t('walletConnect.amount_sent') : i18n.t('walletConnect.amount_received'),
        value: `${Math.abs(c.amount).toLocaleString('en-US', { maximumFractionDigits: 6 })} ${c.symbol}`,
      }));
      operation = operation ? { ...operation, summary } : { type: null, summary };
    }

    return { instructionCount: instructions.length, programs, operation, estimatedFee, verified, noChange };
  } catch (_) {
    return { instructionCount: 0, programs: [], operation: null, estimatedFee: null, verified: false, noChange: false };
  }
}


// ── تحقق تطابق حساب الجلسة مع الحساب النشط ──
function isArabicUi() {
  try { return String(i18n.language || '').startsWith('ar'); } catch (_) { return true; }
}

function mismatchMessage() {
  return i18n.t('wc.session_mismatch', { lng: isArabicUi() ? 'ar' : 'en' });
}

async function rejectMismatch(topic, id) {
  try {
    await web3wallet.respondSessionRequest({
      topic,
      response: { id, jsonrpc: '2.0', error: { code: 4001, message: 'Session account does not match the active account' } },
    });
  } catch (_) {}
}

async function getWalletKeypair() {
  const activeIndex = useAppStore.getState().activeAccountIndex;
  let privateKeyStr = await SecureStore.getItemAsync(`wallet_private_key_${activeIndex}`);
  if (!privateKeyStr && activeIndex === 0) {
    privateKeyStr = await SecureStore.getItemAsync('wallet_private_key');
  }
  if (!privateKeyStr) throw svcError('no_key');
  const secretKey = privateKeyStr.startsWith('[')
    ? new Uint8Array(JSON.parse(privateKeyStr))
    : bs58.decode(privateKeyStr);
  return web3.Keypair.fromSecretKey(secretKey);
}

export async function initWalletConnect() {
  try {
    if (web3wallet) return web3wallet;
    const core     = new Core({ projectId: PROJECT_ID });
    const metadata = {
      name:        'MECO Wallet',
      description: 'The First Arab Crypto Wallet on Solana',
      url:         'https://monycoin.github.io/meco_wallet-app/',
      icons:       ['https://raw.githubusercontent.com/MonyCoin/meco_wallet/refs/heads/main/assets/logo.png'],
      redirect: {
        native:    'meco-wallet://',
        universal: 'https://monycoin.github.io/meco_wallet-app/',
      },
    };
    web3wallet = await WalletKit.init({ core, metadata });
    setupEventListeners();
    return web3wallet;
  } catch (error) {
    console.log('⚠️ WalletConnect init error:', error.message);
  }
}

function setupEventListeners() {
  // انتهاء/قطع الجلسة من الموقع نفسه: نُعلم الواجهة لتحدّث قائمة المواقع المتصلة
  web3wallet.on('session_delete', () => { WCEvents.emit('sessions_changed'); });

  if (!web3wallet) return;

  web3wallet.on('session_proposal', async (proposal) => {
    const { name, url } = proposal.params.proposer.metadata;
    const vf = readVerify(proposal.verifyContext);

    // موقع مصنّف احتيالاً: نرفض الاتصال مباشرة
    if (vf.scam) {
      await rejectSession(proposal);
      Alert.alert(i18n.t('error'), i18n.t('walletConnect.verify_scam'));
      return;
    }

    let message = i18n.t('walletConnect.connection_request_message', { name, url });
    if (vf.validation === 'INVALID') {
      message += '\n\n' + i18n.t('walletConnect.verify_invalid', { origin: vf.origin || '—' });
    } else if (vf.validation !== 'VALID') {
      message += '\n\n' + i18n.t('walletConnect.verify_unknown');
    }

    Alert.alert(
      i18n.t('walletConnect.connection_request'),
      message,
      [
        { text: i18n.t('walletConnect.reject'),  onPress: () => rejectSession(proposal), style: 'cancel' },
        { text: i18n.t('walletConnect.approve'), onPress: () => approveSession(proposal) },
      ]
    );
  });

  web3wallet.on('session_request', async (event) => {
    const { topic, params, id } = event;
    const { request }           = params;
    const sessions = web3wallet.getActiveSessions?.() || {};
    const session  = sessions[topic];
    const appName  = session?.peer?.metadata?.name       || 'dApp';
    const appUrl   = session?.peer?.metadata?.url        || '';
    const appIcon  = session?.peer?.metadata?.icons?.[0] || null;

    // حماية: لا نوقّع بحساب غير الذي ارتبطت به الجلسة
    if (!sessionMatchesActive(session, useAppStore.getState().walletPublicKey)) {
      Alert.alert(i18n.t('error'), mismatchMessage());
      await rejectMismatch(topic, id);
      return;
    }

    // موقع مصنّف احتيالاً: نرفض الطلب دون عرضه
    const vf = readVerify(event.verifyContext);
    if (vf.scam) {
      await handleRequestRejection(topic, id);
      Alert.alert(i18n.t('error'), i18n.t('walletConnect.verify_scam'));
      return;
    }

    if (listeners['sign_request']) {
      const { instructionCount, programs, operation, estimatedFee, verified, noChange } = await parseTransactionDetails(request.method, request.params);
      WCEvents.emit('sign_request', {
        event,
        method: request.method,
        appName,
        appUrl,
        appIcon,
        verify: vf.validation,
        details: { instructionCount, programs, estimatedFee, verified, noChange },
        operation,
        onApprove: () => handleRequestApproval(event),
        onReject:  () => handleRequestRejection(topic, id),
      });
    } else {
      Alert.alert(
        `${appName} — ${i18n.t('walletConnect.sign_request')}`,
        i18n.t('walletConnect.sign_request_message'),
        [
          { text: i18n.t('walletConnect.reject'),  onPress: () => handleRequestRejection(topic, id), style: 'cancel' },
          { text: i18n.t('walletConnect.approve'), onPress: () => handleRequestApproval(event) },
        ],
        { cancelable: false }
      );
    }
  });
}

export async function approveSession(proposal) {
  try {
    const pubKey = useAppStore.getState().walletPublicKey;
    if (!pubKey) throw svcError('no_active_wallet');
    const namespaces = buildApprovedNamespaces({
      proposal: proposal.params,
      supportedNamespaces: {
        solana: {
          chains:   ['solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'],
          methods:  ['solana_signTransaction', 'solana_signMessage', 'solana_signAndSendTransaction'],
          events:   [],
          accounts: [`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:${pubKey}`],
        },
      },
    });
    await web3wallet.approveSession({ id: proposal.id, namespaces });
    WCEvents.emit('sessions_changed');
    Alert.alert(
      i18n.t('walletConnect.connection_success'),
      i18n.t('walletConnect.connection_success_message')
    );
  } catch (error) {
    console.error('approveSession error:', error);
    Alert.alert(i18n.t('error'), i18n.t('walletConnect.connection_failed'));
    await rejectSession(proposal);
  }
}

// المواقع المتصلة حالياً (للعرض في الإعدادات)
export function getConnectedSites() {
  try { return buildSiteList(web3wallet?.getActiveSessions?.() || {}); }
  catch (_) { return []; }
}

// قطع موقع واحد (الجلسة تُغلق عند الطرفين)
export async function disconnectSite(topic) {
  try { await web3wallet.disconnectSession({ topic, reason: getSdkError('USER_DISCONNECTED') }); }
  catch (e) { console.log('⚠️ disconnectSite:', e?.message); }
  WCEvents.emit('sessions_changed');
}

// قطع كل المواقع
export async function disconnectAllSites() {
  const list = getConnectedSites();
  for (const s of list) {
    try { await web3wallet.disconnectSession({ topic: s.topic, reason: getSdkError('USER_DISCONNECTED') }); }
    catch (e) { console.log('⚠️ disconnectAllSites:', e?.message); }
  }
  WCEvents.emit('sessions_changed');
}

export async function rejectSession(proposal) {
  try {
    await web3wallet.rejectSession({ id: proposal.id, reason: getSdkError('USER_REJECTED') });
  } catch (_) {}
}

async function handleRequestApproval(event) {
  const { topic, params, id } = event;
  const { request }           = params;

  // تأكيد الهوية قبل التوقيع؛ الفشل أو الإلغاء يُعامل كرفض للطلب
  if (!(await requireAuth())) {
    await handleRequestRejection(topic, id);
    return;
  }

  try {
    const keypair    = await getWalletKeypair();
    // فحص ثانٍ لحظة التوقيع (قد يتبدل الحساب بين ظهور النافذة والموافقة)
    const sess = (web3wallet.getActiveSessions?.() || {})[topic];
    if (!sessionMatchesActive(sess, keypair.publicKey.toBase58())) {
      Alert.alert(i18n.t('error'), mismatchMessage());
      await rejectMismatch(topic, id);
      return;
    }
    const connection = await heliusService.getConnection();
    let   result;

    if (request.method === 'solana_signMessage') {
      const messageBytes   = bs58.decode(request.params.message || request.params.pubkey);
      const signatureBytes = require('tweetnacl').sign.detached(messageBytes, keypair.secretKey);
      result = { signature: bs58.encode(signatureBytes) };
    }

    else if (request.method === 'solana_signTransaction') {
      const buffer = Buffer.from(request.params.transaction, 'base64');
      let signedBase64;

      try {
        const vTx          = web3.VersionedTransaction.deserialize(buffer);
        const lookupTables = await getLookupTables(vTx, connection);
        const msg          = web3.TransactionMessage.decompile(vTx.message, { addressLookupTableAccounts: lookupTables });
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        msg.recentBlockhash = blockhash;
        const rebuilt = new web3.VersionedTransaction(msg.compileToV0Message(lookupTables));
        rebuilt.sign([keypair]);
        signedBase64 = Buffer.from(rebuilt.serialize()).toString('base64');
      } catch (vErr) {
        if (vErr.message?.includes('Versioned') || vErr.message?.includes('deserialize')) {
          throw vErr;
        }
        const tx = web3.Transaction.from(buffer);
        tx.partialSign(keypair);
        signedBase64 = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
      }
      result = { transaction: signedBase64 };
    }
    else if (request.method === 'solana_signAndSendTransaction') {
      const buffer = Buffer.from(request.params.transaction, 'base64');
      let signature;
      try {
        const vTx          = web3.VersionedTransaction.deserialize(buffer);
        const lookupTables = await getLookupTables(vTx, connection);
        const msg          = web3.TransactionMessage.decompile(vTx.message, { addressLookupTableAccounts: lookupTables });
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        msg.recentBlockhash = blockhash;
        const rebuilt = new web3.VersionedTransaction(msg.compileToV0Message(lookupTables));
        rebuilt.sign([keypair]);
        signature = await connection.sendRawTransaction(rebuilt.serialize(), {
          skipPreflight:       false,
          preflightCommitment: 'confirmed',
        });
      } catch (vErr) {
        if (vErr.message?.includes('Versioned') || vErr.message?.includes('deserialize')) throw vErr;
        const tx = web3.Transaction.from(buffer);
        tx.partialSign(keypair);
        signature = await connection.sendRawTransaction(
          tx.serialize({ requireAllSignatures: false }),
          { skipPreflight: false }
        );
      }
      const conf = await connection.confirmTransaction(signature, 'confirmed');
      if (conf?.value?.err) {
        // المعاملة أُدرجت لكنها فشلت على السلسلة: لا نبلغ الموقع بنجاح كاذب
        throw new Error(
          i18n.t('wc.tx_failed_onchain', { lng: isArabicUi() ? 'ar' : 'en' }) +
          ` (${JSON.stringify(conf.value.err)})`
        );
      }
      result = { signature };
    }

    else {
      throw svcError('unsupported_method', { method: request.method });
    }

    await web3wallet.respondSessionRequest({
      topic,
      response: { id, jsonrpc: '2.0', result },
    });
    console.log('✅ [WalletConnect] تم التوقيع:', request.method);

  } catch (error) {
    console.error('❌ [WalletConnect]:', error.message);
    Alert.alert(i18n.t('error'), `${i18n.t('walletConnect.sign_failed')}: ${error.message}`);
    await handleRequestRejection(topic, id);
  }
}

async function handleRequestRejection(topic, id) {
  try {
    await web3wallet.respondSessionRequest({
      topic,
      response: { id, jsonrpc: '2.0', error: getSdkError('USER_REJECTED') },
    });
  } catch (_) {}
}

export async function pairWalletConnect(uri) {
  try {
    if (!web3wallet) await initWalletConnect();
    await web3wallet.core.pairing.pair({ uri });
  } catch (error) {
    console.error('❌ Pairing error:', error.message);
    Alert.alert(
      i18n.t('walletConnect.pairing_error'),
      i18n.t('walletConnect.pairing_error_message')
    );
  }
}
