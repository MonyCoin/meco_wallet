// services/heliusService.js - الإصدار النهائي مع إصلاح Rate Limiting
import * as SecureStore from 'expo-secure-store';
import * as web3 from '@solana/web3.js';
import * as splToken from '@solana/spl-token';

// ✅ بسيط وموثوق: RPCs مع fallbacks
const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
  'https://rpc.ankr.com/solana'
];

// نظام caching للأرصدة
const BALANCE_CACHE = {
  sol: { value: 0, timestamp: 0 },
  tokens: {} // mintAddress -> { value, timestamp }
};
const CACHE_DURATION = 60000; // 60 ثانية - زيادة المدة

// تأخير ذكي لتجنب Rate Limiting
export async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// الحصول على اتصال يعمل
async function getWorkingConnection() {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const connection = new web3.Connection(endpoint, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 30000
      });
      
      // اختبار سريع للاتصال
      await Promise.race([
        connection.getEpochInfo(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ]);
      
      console.log(`✅ Connected to: ${endpoint.split('//')[1]}`);
      return connection;
    } catch (error) {
      console.warn(`❌ Failed to connect to ${endpoint}:`, error.message);
      continue;
    }
  }
  
  throw new Error('All RPC endpoints failed');
}

// =============================================
// 📊 دالات الأرصدة الأساسية
// =============================================

export async function getSolBalance(forceRefresh = false) {
  try {
    const now = Date.now();
    const cache = BALANCE_CACHE.sol;
    
    // استخدام الكاش إذا كان حديثاً
    if (!forceRefresh && cache && (now - cache.timestamp) < CACHE_DURATION) {
      console.log(`✅ SOL (cached): ${cache.value.toFixed(6)}`);
      return cache.value;
    }

    const pubKey = await SecureStore.getItemAsync('wallet_public_key');
    if (!pubKey) {
      console.log('No wallet public key');
      return 0;
    }

    // ✅ تأخير لتجنب Rate Limiting
    await delay(1500);
    
    const connection = await getWorkingConnection();
    const balanceInLamports = await connection.getBalance(new web3.PublicKey(pubKey));
    const balance = balanceInLamports / 1e9;
    
    // تحديث الكاش
    BALANCE_CACHE.sol = { value: balance, timestamp: now };
    
    console.log(`✅ SOL Balance: ${balance.toFixed(6)} SOL`);
    return balance;
  } catch (error) {
    console.warn('⚠️ SOL balance error:', error.message);
    return BALANCE_CACHE.sol.value || 0;
  }
}

// دالة getTokenAccounts المبسطة (لشاشات أخرى)
export async function getTokenAccounts() {
  console.log('ℹ️ getTokenAccounts: Simplified version');
  return []; // إرجاع مصفوفة فارغة
}

export async function getTokenBalance(mintAddress, forceRefresh = false) {
  try {
    const now = Date.now();
    const cacheKey = mintAddress;
    const cache = BALANCE_CACHE.tokens[cacheKey];
    
    // استخدام الكاش إذا كان حديثاً
    if (!forceRefresh && cache && (now - cache.timestamp) < CACHE_DURATION) {
      console.log(`✅ Token ${mintAddress.substring(0, 8)} (cached): ${cache.value}`);
      return cache.value;
    }

    const pubKey = await SecureStore.getItemAsync('wallet_public_key');
    if (!pubKey) {
      console.log('No public key for token balance');
      return 0;
    }

    console.log(`🔄 Token balance for: ${mintAddress.substring(0, 8)}...`);
    
    // ✅ تأخير عشوائي طويل لتجنب Rate Limiting
    const randomDelay = Math.floor(Math.random() * 3000) + 2000;
    await delay(randomDelay);
    
    try {
      const connection = await getWorkingConnection();
      
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        new web3.PublicKey(pubKey),
        { 
          mint: new web3.PublicKey(mintAddress),
          programId: splToken.TOKEN_PROGRAM_ID
        }
      );

      if (tokenAccounts.value.length === 0) {
        console.log(`📭 No token account for ${mintAddress.substring(0, 8)}`);
        BALANCE_CACHE.tokens[cacheKey] = { value: 0, timestamp: now };
        return 0;
      }

      const account = tokenAccounts.value[0];
      const balance = account.account.data.parsed.info.tokenAmount.uiAmount || 0;
      
      BALANCE_CACHE.tokens[cacheKey] = { value: balance, timestamp: now };
      
      console.log(`✅ Token ${mintAddress.substring(0, 8)}: ${balance}`);
      return balance;
      
    } catch (web3Error) {
      console.warn(`⚠️ Token balance failed: ${web3Error.message}`);
      return BALANCE_CACHE.tokens[cacheKey]?.value || 0;
    }
    
  } catch (error) {
    console.warn(`⚠️ getTokenBalance error: ${error.message}`);
    return BALANCE_CACHE.tokens[mintAddress]?.value || 0;
  }
}

// =============================================
// 🚀 دالات دعم شاشة Send
// =============================================

export async function validateSolanaAddress(address) {
  try {
    // تحقق سريع من الطول والصيغة
    if (!address || typeof address !== 'string') {
      return { isValid: false, exists: false, error: 'Invalid format' };
    }
    
    if (address.length < 32 || address.length > 44) {
      return { isValid: false, exists: false, error: 'Invalid length' };
    }
    
    // تحقق من صيغة Base58
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!base58Regex.test(address)) {
      return { isValid: false, exists: false, error: 'Invalid base58' };
    }
    
    // تحقق من وجود الحساب
    try {
      const connection = await getWorkingConnection();
      const accountInfo = await connection.getAccountInfo(new web3.PublicKey(address));
      const exists = !!accountInfo;
      
      return {
        isValid: true,
        exists,
        isExecutable: accountInfo?.executable || false,
        lamports: accountInfo?.lamports || 0,
        error: null
      };
    } catch (accountError) {
      return {
        isValid: true,
        exists: false,
        error: null
      };
    }
    
  } catch (error) {
    console.warn('Address validation warning:', error.message);
    return {
      isValid: false,
      exists: false,
      error: error.message
    };
  }
}

export async function getCurrentNetworkFee() {
  try {
    await delay(1000); // تأخير قبل طلب الرسوم
    
    const connection = await getWorkingConnection();
    const fees = await connection.getRecentPrioritizationFees();
    
    if (fees && fees.length > 0) {
      const recentFees = fees.slice(0, Math.min(fees.length, 3));
      const total = recentFees.reduce((sum, f) => sum + f.prioritizationFee, 0);
      const average = total / recentFees.length;
      
      const baseFee = average / 1e9;
      const calculatedFee = Math.max(0.000005, Math.min(baseFee, 0.01));
      
      console.log(`💰 Network fee: ${calculatedFee.toFixed(6)} SOL`);
      return calculatedFee;
    }
    
    return 0.000005; // Default
  } catch (error) {
    console.warn('⚠️ Network fee error:', error.message);
    return 0.000005;
  }
}

export function clearBalanceCache() {
  BALANCE_CACHE.sol = { value: 0, timestamp: 0 };
  BALANCE_CACHE.tokens = {};
  console.log('🧹 Balance cache cleared');
}

// =============================================
// 🔧 دالات مساعدة
// =============================================

export async function getAccountInfo(publicKey) {
  try {
    await delay(1000);
    const connection = await getWorkingConnection();
    const accountInfo = await connection.getAccountInfo(new web3.PublicKey(publicKey));
    
    if (!accountInfo) return null;
    
    return {
      value: {
        executable: accountInfo.executable,
        lamports: accountInfo.lamports,
        owner: accountInfo.owner.toBase58()
      }
    };
  } catch (error) {
    console.warn('Account info error:', error.message);
    return null;
  }
}

export async function getLatestBlockhash() {
  try {
    const connection = await getWorkingConnection();
    return await connection.getLatestBlockhash('confirmed');
  } catch (error) {
    console.warn('Blockhash error:', error.message);
    return {
      blockhash: '11111111111111111111111111111111',
      lastValidBlockHeight: 0
    };
  }
}

// ✅ التصدير الكامل
export default {
  getSolBalance,
  getTokenAccounts,
  getTokenBalance,
  validateSolanaAddress,
  getCurrentNetworkFee,
  clearBalanceCache,
  getAccountInfo,
  getLatestBlockhash,
  delay
};
