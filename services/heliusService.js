// services/heliusService.js - النسخة النهائية المحدثة (مع دعم الأسعار المباشرة)
import * as SecureStore from 'expo-secure-store';
import * as web3 from '@solana/web3.js';
import * as splToken from '@solana/spl-token';

// ✅ عنوان عقد عملة MECO
const MECO_MINT_ADDRESS = '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i';

// ✅ قائمة RPCs مع أولويات
const RPC_ENDPOINTS = [
  { url: 'https://api.mainnet-beta.solana.com', priority: 1 },
  { url: 'https://solana-api.projectserum.com', priority: 2 },
  { url: 'https://rpc.ankr.com/solana', priority: 3 }
];

// ✅ نظام Caching محسن
const CACHE = {
  sol: { balance: 0, timestamp: 0 },
  tokens: new Map(),
  blockhash: null,
  blockhashTime: 0
};

const CACHE_DURATION = 30000; // 30 ثانية
const BLOCKHASH_DURATION = 30000; // 30 ثانية

// ✅ الحصول على اتصال يعمل
async function getConnection() {
  const endpoints = [...RPC_ENDPOINTS].sort((a, b) => a.priority - b.priority);
  
  for (const { url } of endpoints) {
    try {
      const connection = new web3.Connection(url, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
        disableRetryOnRateLimit: false,
        wsEndpoint: url.replace('https://', 'wss://')
      });
      
      const start = Date.now();
      await Promise.race([
        connection.getEpochInfo(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]);
      
      console.log(`✅ Connected to ${url.split('//')[1]} (${Date.now() - start}ms)`);
      return connection;
    } catch (error) {
      console.warn(`❌ Failed ${url}:`, error.message);
      continue;
    }
  }
  
  throw new Error('جميع اتصالات RPC فشلت');
}

// ✅ الحصول على أحدث blockhash مع caching
export async function getLatestBlockhash(forceRefresh = false) {
  try {
    const now = Date.now();
    
    if (!forceRefresh && 
        CACHE.blockhash && 
        (now - CACHE.blockhashTime) < BLOCKHASH_DURATION) {
      return CACHE.blockhash;
    }
    
    const connection = await getConnection();
    const blockhash = await connection.getLatestBlockhash('confirmed');
    
    CACHE.blockhash = blockhash;
    CACHE.blockhashTime = now;
    
    console.log('✅ Blockhash cached:', blockhash.blockhash.substring(0, 16));
    return blockhash;
  } catch (error) {
    console.warn('⚠️ Failed to get blockhash:', error.message);
    return {
      blockhash: '11111111111111111111111111111111',
      lastValidBlockHeight: 0
    };
  }
}

// ✅ دالة جديدة: جلب سعر العملة الحقيقي من Jupiter API 🚀
export const getTokenMarketPrice = async (tokenSymbol) => {
  try {
    // 1. تحديد عنوان العملة (Mint Address)
    let mintAddress = null;
    
    if (tokenSymbol === 'SOL') {
      mintAddress = 'So11111111111111111111111111111111111111112';
    } else if (tokenSymbol === 'MECO') {
      mintAddress = '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i';
    } else if (tokenSymbol === 'USDT') {
      mintAddress = 'Es9vMFrzaCERc8Foa8XfRduKiSfrhEL5c7qr2WXXBWY5';
    } else if (tokenSymbol === 'USDC') {
      mintAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    }

    if (!mintAddress) return 0;

    // 2. طلب السعر من Jupiter API (V2) - المصدر الأدق في سولانا
    console.log(`🔄 Fetching price for ${tokenSymbol}...`);
    const response = await fetch(`https://api.jup.ag/price/v2?ids=${mintAddress}`);
    const data = await response.json();

    // 3. استخراج السعر
    if (data && data.data && data.data[mintAddress]) {
      const price = parseFloat(data.data[mintAddress].price);
      console.log(`💰 ${tokenSymbol} Price: $${price}`);
      return price;
    }
    
    // خطة بديلة لـ MECO في حال وجود ضغط على API أو عدم استجابة مؤقتة
    if (tokenSymbol === 'MECO') {
      console.log('⚠️ Using fallback price for MECO');
      return 0.00613; 
    }

    return 0;

  } catch (error) {
    console.error(`❌ Failed to fetch price for ${tokenSymbol}:`, error.message);
    // في حالة الخطأ، نعيد السعر الأخير المعروف لـ MECO
    if (tokenSymbol === 'MECO') return 0.00613;
    return 0;
  }
};

// ✅ الحصول على رصيد SOL
export async function getSolBalance(forceRefresh = false) {
  try {
    const now = Date.now();
    const cache = CACHE.sol;
    
    if (!forceRefresh && (now - cache.timestamp) < CACHE_DURATION) {
      return cache.balance;
    }
    
    const pubKeyStr = await SecureStore.getItemAsync('wallet_public_key');
    if (!pubKeyStr) return 0;
    
    const connection = await getConnection();
    const pubKey = new web3.PublicKey(pubKeyStr);
    const balanceLamports = await connection.getBalance(pubKey);
    const balance = balanceLamports / web3.LAMPORTS_PER_SOL;
    
    CACHE.sol = { balance, timestamp: now };
    
    return balance;
  } catch (error) {
    console.warn('⚠️ SOL balance error:', error.message);
    return CACHE.sol.balance || 0;
  }
}

// ✅ الحصول على رصيد التوكن
export async function getTokenBalance(mintAddress, forceRefresh = false) {
  try {
    const now = Date.now();
    const cache = CACHE.tokens.get(mintAddress);
    
    if (!forceRefresh && cache && (now - cache.timestamp) < CACHE_DURATION) {
      return cache.balance;
    }
    
    const pubKeyStr = await SecureStore.getItemAsync('wallet_public_key');
    if (!pubKeyStr) return 0;
    
    const connection = await getConnection();
    const pubKey = new web3.PublicKey(pubKeyStr);
    const mint = new web3.PublicKey(mintAddress);
    
    const ata = await splToken.getAssociatedTokenAddress(mint, pubKey);
    
    try {
      const accountInfo = await connection.getAccountInfo(ata);
      
      if (!accountInfo) {
        CACHE.tokens.set(mintAddress, { balance: 0, timestamp: now });
        return 0;
      }
      
      const tokenAccount = splToken.AccountLayout.decode(accountInfo.data);
      const rawBalance = tokenAccount.amount;
      
      const mintInfo = await splToken.getMint(connection, mint);
      const balance = Number(rawBalance) / Math.pow(10, mintInfo.decimals);
      
      CACHE.tokens.set(mintAddress, { balance, timestamp: now });
      
      return balance;
    } catch (ataError) {
      CACHE.tokens.set(mintAddress, { balance: 0, timestamp: now });
      return 0;
    }
    
  } catch (error) {
    console.warn(`⚠️ Token balance error:`, error.message);
    return CACHE.tokens.get(mintAddress)?.balance || 0;
  }
}

// ✅ الحصول على جميع التوكنات للمستخدم
export async function getTokenAccounts() {
  try {
    const pubKeyStr = await SecureStore.getItemAsync('wallet_public_key');
    if (!pubKeyStr) return [];
    
    const connection = await getConnection();
    const pubKey = new web3.PublicKey(pubKeyStr);
    
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      pubKey,
      { programId: splToken.TOKEN_PROGRAM_ID }
    );
    
    const accounts = tokenAccounts.value.map(account => ({
      pubkey: account.pubkey.toBase58(),
      mint: account.account.data.parsed.info.mint,
      owner: account.account.data.parsed.info.owner,
      amount: account.account.data.parsed.info.tokenAmount.uiAmount,
      decimals: account.account.data.parsed.info.tokenAmount.decimals
    }));
    
    return accounts;
  } catch (error) {
    console.warn('⚠️ Token accounts error:', error.message);
    return [];
  }
}

// ✅ التحقق من عنوان Solana
export async function validateSolanaAddress(address) {
  try {
    if (!address || typeof address !== 'string') {
      return { isValid: false, exists: false, error: 'تنسيق غير صالح' };
    }
    
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!base58Regex.test(address)) {
      return { isValid: false, exists: false, error: 'تنسيق Base58 غير صالح' };
    }
    
    try {
      new web3.PublicKey(address);
    } catch {
      return { isValid: false, exists: false, error: 'عنوان Solana غير صالح' };
    }
    
    return {
      isValid: true,
      exists: true, 
      isExecutable: false,
      lamports: 0,
      error: null
    };
    
  } catch (error) {
    return { isValid: false, exists: false, error: error.message };
  }
}

// ✅ حساب رسوم الشبكة
export async function getCurrentNetworkFee() {
  try {
    const connection = await getConnection();
    const fees = await connection.getRecentPrioritizationFees?.();
    
    if (fees && fees.length > 0) {
      const recent = fees.slice(0, Math.min(fees.length, 5));
      const total = recent.reduce((sum, f) => sum + (f.prioritizationFee || 0), 0);
      const average = total / recent.length;
      const feeInSol = average / 1_000_000 / web3.LAMPORTS_PER_SOL;
      
      const minFee = 0.000005;
      const maxFee = 0.00001;
      
      return Math.max(minFee, Math.min(feeInSol, maxFee));
    }
    return 0.000005;
  } catch (error) {
    return 0.000005;
  }
}

// ✅ إرسال معاملة SOL
export async function sendSolTransaction(fromKeypair, toAddress, amount, fee = 0.000005) {
  try {
    const connection = await getConnection();
    const { blockhash } = await getLatestBlockhash();
    
    const transaction = new web3.Transaction().add(
      web3.SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: new web3.PublicKey(toAddress),
        lamports: Math.floor(amount * web3.LAMPORTS_PER_SOL)
      })
    );
    
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromKeypair.publicKey;
    
    const signedTx = await web3.sendAndConfirmTransaction(
      connection,
      transaction,
      [fromKeypair],
      { commitment: 'confirmed' }
    );
    
    console.log('✅ SOL transaction sent:', signedTx);
    return signedTx;
  } catch (error) {
    console.error('❌ SOL transaction failed:', error);
    throw error;
  }
}

// ✅ إرسال معاملة توكن
export async function sendTokenTransaction(fromKeypair, toAddress, mintAddress, amount) {
  try {
    const connection = await getConnection();
    const { blockhash } = await getLatestBlockhash();
    
    const mint = new web3.PublicKey(mintAddress);
    const fromATA = await splToken.getAssociatedTokenAddress(mint, fromKeypair.publicKey);
    const toATA = await splToken.getAssociatedTokenAddress(mint, new web3.PublicKey(toAddress));
    
    const mintInfo = await splToken.getMint(connection, mint);
    const amountRaw = BigInt(Math.floor(amount * Math.pow(10, mintInfo.decimals)));
    
    if (amountRaw === 0n) throw new Error('المبلغ صغير جداً للإرسال');
    
    const instructions = [];
    const toAccountInfo = await connection.getAccountInfo(toATA);
    
    if (!toAccountInfo) {
      instructions.push(
        splToken.createAssociatedTokenAccountInstruction(
          fromKeypair.publicKey,
          toATA,
          new web3.PublicKey(toAddress),
          mint
        )
      );
    }
    
    instructions.push(
      splToken.createTransferInstruction(
        fromATA,
        toATA,
        fromKeypair.publicKey,
        amountRaw
      )
    );
    
    const transaction = new web3.Transaction().add(...instructions);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromKeypair.publicKey;
    
    const signedTx = await web3.sendAndConfirmTransaction(
      connection,
      transaction,
      [fromKeypair],
      { commitment: 'confirmed' }
    );
    
    console.log('✅ Token transaction sent:', signedTx);
    return signedTx;
  } catch (error) {
    console.error('❌ Token transaction failed:', error);
    throw error;
  }
}

// ✅ دالة تأخير مساعدة
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ✅ heliusRpcRequest
export async function heliusRpcRequest(method, params = []) {
  try {
    const connection = await getConnection();
    
    switch(method) {
      case 'getSignaturesForAddress':
        const pubKey = new web3.PublicKey(params[0]);
        const options = params[1] || {};
        return await connection.getSignaturesForAddress(pubKey, options);
      
      case 'getTransaction':
        const signature = params[0];
        const config = params[1] || { commitment: 'confirmed' };
        return await connection.getTransaction(signature, config);
      
      case 'getBalance':
        const address = new web3.PublicKey(params[0]);
        return await connection.getBalance(address);
      
      case 'getTokenAccountsByOwner':
        const owner = new web3.PublicKey(params[0]);
        const tokenFilter = params[1] || { programId: splToken.TOKEN_PROGRAM_ID };
        return await connection.getTokenAccountsByOwner(owner, tokenFilter);
      
      case 'getAccountInfo':
        const accountPubKey = new web3.PublicKey(params[0]);
        const accountConfig = params[1] || {};
        return await connection.getAccountInfo(accountPubKey, accountConfig);
      
      default:
        if (typeof connection[method] === 'function') {
          return await connection[method](...params);
        }
        if (connection._rpcRequest) {
          const response = await connection._rpcRequest(method, params);
          if (response.error) throw new Error(response.error.message);
          return response.result;
        }
        throw new Error(`Method ${method} not supported`);
    }
  } catch (error) {
    console.warn(`❌ heliusRpcRequest failed for ${method}:`, error.message);
    throw error;
  }
}

// ✅ مسح الكاش
export function clearBalanceCache() {
  CACHE.sol = { balance: 0, timestamp: 0 };
  CACHE.tokens.clear();
  CACHE.blockhash = null;
  CACHE.blockhashTime = 0;
  console.log('🧹 Cache cleared');
}

// ✅ سجل المعاملات
export async function getTransactionHistory(limit = 20) {
  try {
    const pubKeyStr = await SecureStore.getItemAsync('wallet_public_key');
    if (!pubKeyStr) return [];
    
    const connection = await getConnection();
    const pubKey = new web3.PublicKey(pubKeyStr);
    
    const signatures = await connection.getSignaturesForAddress(pubKey, { 
      limit,
      commitment: 'confirmed' 
    });
    
    const transactions = [];
    for (const sig of signatures) {
      try {
        const tx = await connection.getTransaction(sig.signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        });
        if (tx) {
          transactions.push({
            signature: sig.signature,
            blockTime: sig.blockTime,
            slot: sig.slot,
            confirmationStatus: sig.confirmationStatus,
            details: tx
          });
        }
      } catch (error) {}
    }
    
    return transactions;
  } catch (error) {
    return [];
  }
}

export default {
  getSolBalance,
  getTokenBalance,
  getTokenAccounts,
  validateSolanaAddress,
  getCurrentNetworkFee,
  getLatestBlockhash,
  sendSolTransaction,
  sendTokenTransaction,
  clearBalanceCache,
  delay,
  heliusRpcRequest,
  getTransactionHistory,
  getTokenMarketPrice // ✅ تم التصدير
};
