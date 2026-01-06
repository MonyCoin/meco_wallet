import * as SecureStore from 'expo-secure-store';

const HELIUS_API_KEY = '886a8252-15e3-4eef-bc26-64bd552dded0';
const BASE_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

/**
 * دالة طلب عامة لأي استعلام Helius RPC
 */
export async function heliusRpcRequest(method, params = []) {
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
}

/**
 * ✅ رصيد SOL — مع التحقق من وجود المحفظة
 */
export async function getSolBalance() {
  const pubKey = await SecureStore.getItemAsync('wallet_public_key');
  if (!pubKey) throw new Error('Wallet public key not found');

  const result = await heliusRpcRequest('getBalance', [pubKey]);
  return result.value / 1e9;
}

/**
 * ✅ استرجاع التوكنات المرتبطة بالمحفظة — مع حماية
 */
export async function getTokenAccounts() {
  const pubKey = await SecureStore.getItemAsync('wallet_public_key');
  if (!pubKey) throw new Error('Wallet public key not found');

  const result = await heliusRpcRequest('getTokenAccountsByOwner', [
    pubKey,
    { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
    { encoding: 'jsonParsed' },
  ]);

  const tokens = result.value.map((acc) => {
    const info = acc.account.data.parsed.info;
    const amount = Number(info.tokenAmount.amount);
    const decimals = info.tokenAmount.decimals;
    return {
      mint: info.mint,
      amount: amount / Math.pow(10, decimals),
      decimals,
    };
  });

  return tokens.filter((t) => t.amount > 0);
}
