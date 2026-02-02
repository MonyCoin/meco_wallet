// services/heliusService.js - النسخة النهائية المثبتة
import * as SecureStore from 'expo-secure-store';
import * as web3 from '@solana/web3.js';
import * as splToken from '@solana/spl-token';

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
  // ترتيب حسب الأولوية
  const endpoints = [...RPC_ENDPOINTS].sort((a, b) => a.priority - b.priority);
  
  for (const { url } of endpoints) {
    try {
      const connection = new web3.Connection(url, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
        disableRetryOnRateLimit: false,
        wsEndpoint: url.replace('https://', 'wss://')
      });
      
      // اختبار الاتصال السريع
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

// ✅ الحصول على رصيد SOL
export async function getSolBalance(forceRefresh = false) {
  try {
    const now = Date.now();
    const cache = CACHE.sol;
    
    if (!forceRefresh && (now - cache.timestamp) < CACHE_DURATION) {
      console.log(`💾 SOL (cached): ${cache.balance.toFixed(6)}`);
      return cache.balance;
    }
    
    const pubKeyStr = await SecureStore.getItemAsync('wallet_public_key');
    if (!pubKeyStr) {
      console.log('No public key found');
      return 0;
    }
    
    const connection = await getConnection();
    const pubKey = new web3.PublicKey(pubKeyStr);
    const balanceLamports = await connection.getBalance(pubKey);
    const balance = balanceLamports / web3.LAMPORTS_PER_SOL;
    
    CACHE.sol = { balance, timestamp: now };
    console.log(`✅ SOL Balance: ${balance.toFixed(6)}`);
    
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
      console.log(`💾 Token ${mintAddress.substring(0, 8)} (cached): ${cache.balance}`);
      return cache.balance;
    }
    
    const pubKeyStr = await SecureStore.getItemAsync('wallet_public_key');
    if (!pubKeyStr) {
      console.log('No public key for token balance');
      return 0;
    }
    
    const connection = await getConnection();
    const pubKey = new web3.PublicKey(pubKeyStr);
    const mint = new web3.PublicKey(mintAddress);
    
    // البحث عن Associated Token Account
    const ata = await splToken.getAssociatedTokenAddress(mint, pubKey);
    
    try {
      const accountInfo = await connection.getAccountInfo(ata);
      
      if (!accountInfo) {
        console.log(`📭 No token account for ${mintAddress.substring(0, 8)}`);
        CACHE.tokens.set(mintAddress, { balance: 0, timestamp: now });
        return 0;
      }
      
      const tokenAccount = splToken.AccountLayout.decode(accountInfo.data);
      const rawBalance = tokenAccount.amount;
      
      // الحصول على decimal places
      const mintInfo = await splToken.getMint(connection, mint);
      const balance = Number(rawBalance) / Math.pow(10, mintInfo.decimals);
      
      CACHE.tokens.set(mintAddress, { balance, timestamp: now });
      console.log(`✅ Token ${mintAddress.substring(0, 8)}: ${balance}`);
      
      return balance;
    } catch (ataError) {
      console.warn(`Token account error:`, ataError.message);
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
    
    console.log(`✅ Found ${accounts.length} token accounts`);
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
    
    // تحقق من Base58
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!base58Regex.test(address)) {
      return { isValid: false, exists: false, error: 'تنسيق Base58 غير صالح' };
    }
    
    // التحقق من العنوان نفسه
    try {
      new web3.PublicKey(address);
    } catch {
      return { isValid: false, exists: false, error: 'عنوان Solana غير صالح' };
    }
    
    // التحقق من وجود الحساب
    const connection = await getConnection();
    const accountInfo = await connection.getAccountInfo(new web3.PublicKey(address));
    
    return {
      isValid: true,
      exists: !!accountInfo,
      isExecutable: accountInfo?.executable || false,
      lamports: accountInfo?.lamports || 0,
      error: null
    };
  } catch (error) {
    console.warn('Address validation warning:', error.message);
    return {
      isValid: false,
      exists: false,
      error: error.message
    };
  }
}

// ✅ حساب رسوم الشبكة الحالية
export async function getCurrentNetworkFee() {
  try {
    const connection = await getConnection();
    
    // الحصول على رسوم الأولوية الأخيرة
    const fees = await connection.getRecentPrioritizationFees?.();
    
    if (fees && fees.length > 0) {
      const recent = fees.slice(0, Math.min(fees.length, 5));
      const total = recent.reduce((sum, f) => sum + (f.prioritizationFee || 0), 0);
      const average = total / recent.length;
      
      // تحويل من microLamports إلى SOL
      const feeInSol = average / 1_000_000 / web3.LAMPORTS_PER_SOL;
      
      // حدود معقولة
      const minFee = 0.000001; // 0.000001 SOL
      const maxFee = 0.01;     // 0.01 SOL
      
      const calculatedFee = Math.max(minFee, Math.min(feeInSol, maxFee));
      console.log(`💰 Network fee: ${calculatedFee.toFixed(6)} SOL`);
      
      return calculatedFee;
    }
    
    // Default fees based on recent network conditions
    return 0.000005; // 0.000005 SOL (~$0.001)
  } catch (error) {
    console.warn('⚠️ Network fee error:', error.message);
    return 0.000005;
  }
}

// ✅ إرسال معاملة SOL
export async function sendSolTransaction(fromKeypair, toAddress, amount, fee = 0.000005) {
  try {
    const connection = await getConnection();
    const { blockhash, lastValidBlockHeight } = await getLatestBlockhash();
    
    const transaction = new web3.Transaction().add(
      web3.SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: new web3.PublicKey(toAddress),
        lamports: Math.floor(amount * web3.LAMPORTS_PER_SOL)
      })
    );
    
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromKeypair.publicKey;
    
    // التوقيع
    const signedTx = await web3.sendAndConfirmTransaction(
      connection,
      transaction,
      [fromKeypair],
      {
        commitment: 'confirmed',
        skipPreflight: false,
        maxRetries: 3,
        preflightCommitment: 'confirmed'
      }
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
    
    const instructions = [];
    
    // إنشاء حساب التوكن للمستقبل إذا لم يكن موجوداً
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
    
    // تعليمات التحويل
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
      {
        commitment: 'confirmed',
        skipPreflight: false,
        maxRetries: 3
      }
    );
    
    console.log('✅ Token transaction sent:', signedTx);
    return signedTx;
  } catch (error) {
    console.error('❌ Token transaction failed:', error);
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

// ✅ دالة تأخير مساعدة
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  delay
};
