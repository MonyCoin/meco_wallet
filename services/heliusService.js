import * as SecureStore from 'expo-secure-store';
import { MECO_MINT } from '../constants';

const HELIUS_API_KEY = '886a8252-15e3-4eef-bc26-64bd552dded0';
const BASE_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const FALLBACK_RPC_URL = 'https://api.mainnet-beta.solana.com';

async function heliusRpcRequest(method, params = []) {
  try {
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    };

    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.result;
  } catch (error) {
    console.log(`⚠️ Helius failed, trying fallback for ${method}:`, error.message);
    return fallbackRpcRequest(method, params);
  }
}

async function fallbackRpcRequest(method, params = []) {
  try {
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    };

    const res = await fetch(FALLBACK_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.result;
  } catch (error) {
    console.error(`❌ Fallback also failed for ${method}:`, error);
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
    const balance = result?.value ? result.value / 1e9 : 0;
    console.log(`✅ SOL Balance: ${balance} SOL`);
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

    if (!result?.value) return [];

    const tokens = result.value.map((acc) => {
      const info = acc.account.data.parsed.info;
      const amount = Number(info.tokenAmount.amount);
      const decimals = info.tokenAmount.decimals;
      const uiAmount = info.tokenAmount.uiAmount || amount / Math.pow(10, decimals);
      
      return {
        mint: info.mint,
        amount: uiAmount,
        decimals,
        tokenAmount: info.tokenAmount,
        pubkey: acc.pubkey,
      };
    });

    const filteredTokens = tokens.filter((t) => t.amount > 0);
    console.log(`✅ Found ${filteredTokens.length} tokens with balance`);
    
    return filteredTokens;
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
      console.log(`✅ MECO Balance: ${mecoToken.amount} MECO`);
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
