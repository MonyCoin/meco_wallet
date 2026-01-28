// services/heliusService.js
import * as SecureStore from 'expo-secure-store';
import { MECO_MINT, RPC_URL, WALLET_ADDRESSES } from '../constants';

const HELIUS_API_KEY = '886a8252-15e3-4eef-bc26-64bd552dded0';
const HELIUS_BASE_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const FALLBACK_RPC_URL = RPC_URL || 'https://api.mainnet-beta.solana.com';

// تحسين: إضافة retry logic مع فترات انتظار متدرجة
const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 2000]; // فترات انتظار بالميلي ثانية

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRpcRequest(url, method, params = [], retryCount = 0) {
  try {
    const body = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // timeout 10 ثانية

    const res = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    
    if (json.error) {
      throw new Error(`RPC Error: ${json.error.message || JSON.stringify(json.error)}`);
    }
    
    return json.result;
  } catch (error) {
    // إعادة المحاولة فقط لأخطاء الشبكة أو timeout
    const isNetworkError = error.name === 'AbortError' || 
                          error.message.includes('Network') ||
                          error.message.includes('timeout') ||
                          error.message.includes('fetch');
    
    if (isNetworkError && retryCount < MAX_RETRIES) {
      const delayTime = RETRY_DELAYS[retryCount];
      console.log(`🔄 Retrying ${method} (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await delay(delayTime);
      return makeRpcRequest(url, method, params, retryCount + 1);
    }
    
    throw error;
  }
}

// ✅ Export هذه الدالة
export async function heliusRpcRequest(method, params = []) {
  try {
    const result = await makeRpcRequest(HELIUS_BASE_URL, method, params);
    return result;
  } catch (error) {
    console.log(`⚠️ Helius failed for ${method}:`, error.message);
    
    // استخدم fallback فقط للطرق الحرجة
    const criticalMethods = ['getBalance', 'getTokenAccountsByOwner', 'getAccountInfo'];
    if (criticalMethods.includes(method)) {
      return fallbackRpcRequest(method, params);
    }
    
    throw error;
  }
}

// ✅ Export هذه الدالة
export async function fallbackRpcRequest(method, params = []) {
  try {
    console.log(`🔄 Using fallback RPC for ${method}`);
    const result = await makeRpcRequest(FALLBACK_RPC_URL, method, params);
    return result;
  } catch (error) {
    console.error(`❌ Fallback also failed for ${method}:`, error.message);
    
    // قيمة افتراضية في حالة فشل كل شيء
    if (method === 'getBalance') {
      return { value: 0 };
    } else if (method === 'getTokenAccountsByOwner') {
      return { value: [] };
    }
    
    throw error;
  }
}

export async function getSolBalance() {
  try {
    const pubKey = await SecureStore.getItemAsync('wallet_public_key');
    if (!pubKey) {
      console.warn('⚠️ No wallet public key found');
      return 0;
    }

    const result = await heliusRpcRequest('getBalance', [pubKey]);
    
    // تحسين: معالجة مختلف أشكال الاستجابة
    let balanceInLamports = 0;
    if (typeof result === 'number') {
      balanceInLamports = result;
    } else if (result && typeof result === 'object') {
      balanceInLamports = result.value || result.lamports || 0;
    }
    
    const balance = balanceInLamports / 1e9;
    console.log(`✅ SOL Balance: ${balance.toFixed(6)} SOL`);
    return balance;
  } catch (error) {
    console.error('❌ Error in getSolBalance:', error.message);
    return 0;
  }
}

export async function getTokenAccounts() {
  try {
    const pubKey = await SecureStore.getItemAsync('wallet_public_key');
    if (!pubKey) {
      console.warn('⚠️ No wallet public key found');
      return [];
    }

    const result = await heliusRpcRequest('getTokenAccountsByOwner', [
      pubKey,
      { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
      { encoding: 'jsonParsed' },
    ]);

    // تحسين: معالجة مختلف أشكال الاستجابة
    let accounts = [];
    if (result && Array.isArray(result)) {
      accounts = result;
    } else if (result && result.value && Array.isArray(result.value)) {
      accounts = result.value;
    }

    const tokens = accounts.map((acc) => {
      try {
        const info = acc.account?.data?.parsed?.info;
        if (!info) return null;

        const amount = Number(info.tokenAmount?.amount || 0);
        const decimals = info.tokenAmount?.decimals || 0;
        const mint = info.mint;
        
        if (!mint) return null;
        
        const uiAmount = amount / Math.pow(10, decimals);
        
        return {
          mint,
          amount: uiAmount,
          decimals,
          rawAmount: amount,
          pubkey: acc.pubkey,
        };
      } catch (error) {
        console.warn('⚠️ Error processing token account:', error.message);
        return null;
      }
    }).filter(token => token !== null && token.amount > 0);

    console.log(`✅ Found ${tokens.length} tokens with balance`);
    return tokens;
  } catch (error) {
    console.error('❌ Error in getTokenAccounts:', error.message);
    return [];
  }
}

export async function getMecoBalance() {
  try {
    const tokens = await getTokenAccounts();
    const mecoToken = tokens.find(t => t.mint === MECO_MINT);
    
    if (mecoToken) {
      console.log(`✅ MECO Balance: ${mecoToken.amount.toFixed(4)} MECO`);
      return mecoToken.amount;
    }
    
    console.log('ℹ️ No MECO balance found');
    return 0;
  } catch (error) {
    console.error('❌ Error in getMecoBalance:', error.message);
    return 0;
  }
}

export async function getTokenBalance(mintAddress) {
  try {
    const tokens = await getTokenAccounts();
    const token = tokens.find(t => t.mint === mintAddress);
    return token ? token.amount : 0;
  } catch (error) {
    console.error(`❌ Error in getTokenBalance for ${mintAddress}:`, error.message);
    return 0;
  }
}

export async function hasTokenAccount(mintAddress) {
  try {
    const tokens = await getTokenAccounts();
    return tokens.some(t => t.mint === mintAddress);
  } catch (error) {
    console.error(`❌ Error checking token account for ${mintAddress}:`, error.message);
    return false;
  }
}

export async function getAccountInfo(publicKey) {
  try {
    const result = await heliusRpcRequest('getAccountInfo', [
      publicKey,
      { encoding: 'jsonParsed' }
    ]);
    return result;
  } catch (error) {
    console.error('❌ Error in getAccountInfo:', error.message);
    return null;
  }
}

// دالة جديدة: الحصول على توازن محفظة محددة
export async function getWalletBalance(walletAddress) {
  try {
    const result = await heliusRpcRequest('getBalance', [walletAddress]);
    const balance = result?.value ? result.value / 1e9 : 0;
    console.log(`💰 Wallet balance: ${balance.toFixed(6)} SOL`);
    return balance;
  } catch (error) {
    console.error(`❌ Error getting wallet balance:`, error.message);
    return 0;
  }
}

// دالة جديدة: الحصول على أحدث blockhash
export async function getLatestBlockhash() {
  try {
    const result = await heliusRpcRequest('getLatestBlockhash', []);
    return result;
  } catch (error) {
    console.error('❌ Error getting latest blockhash:', error.message);
    // قيمة افتراضية
    return {
      blockhash: '11111111111111111111111111111111',
      lastValidBlockHeight: 0
    };
  }
}

// دالة جديدة: الحصول على رسوم الأولوية
export async function getRecentPrioritizationFees() {
  try {
    const result = await heliusRpcRequest('getRecentPrioritizationFees', []);
    return result || [];
  } catch (error) {
    console.error('❌ Error getting prioritization fees:', error.message);
    return [];
  }
}

// دالة مساعدة: التحقق من أرصدة المحافظ الإدارية
export async function checkAdminWalletsBalance() {
  try {
    const wallets = [
      WALLET_ADDRESSES.PRESALE_TREASURY,
      WALLET_ADDRESSES.PROGRAM_WALLET,
      WALLET_ADDRESSES.FEE_COLLECTOR
    ].filter(wallet => wallet && wallet !== 'undefined');
    
    const balances = {};
    
    for (const wallet of wallets) {
      try {
        const balance = await getWalletBalance(wallet);
        balances[wallet] = balance;
      } catch (error) {
        balances[wallet] = 'Error';
      }
    }
    
    console.log('📊 Admin Wallets Balances:', balances);
    return balances;
  } catch (error) {
    console.error('❌ Error checking admin wallets:', error.message);
    return {};
  }
}

// ✅ التصدير الكامل للدوال
export default {
  heliusRpcRequest,
  fallbackRpcRequest,
  getSolBalance,
  getTokenAccounts,
  getMecoBalance,
  getTokenBalance,
  hasTokenAccount,
  getAccountInfo,
  getWalletBalance,
  getLatestBlockhash,
  getRecentPrioritizationFees,
  checkAdminWalletsBalance,
};
