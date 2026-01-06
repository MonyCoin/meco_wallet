import AsyncStorage from '@react-native-async-storage/async-storage';
import { heliusRpcRequest } from './heliusService';

const STORAGE_KEY = 'transaction_log';

// 📝 حفظ عملية جديدة
export async function logTransaction(data) {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEY);
    const logs = existing ? JSON.parse(existing) : [];
    const updated = [data, ...logs];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    console.log('📝 Transaction saved');
  } catch (err) {
    console.error('❌ Failed to log transaction:', err);
  }
}

// 📦 جلب السجل من التخزين
export async function getTransactionLog() {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (err) {
    console.error('❌ Failed to get transaction log:', err);
    return [];
  }
}

// 🔍 جلب آخر المعاملات من Helius
export async function getTransactions(address) {
  try {
    const result = await heliusRpcRequest('getSignaturesForAddress', [
      address,
      { limit: 10 },
    ]);

    const transactions = await Promise.all(
      result.map(async (sig) => {
        const tx = await heliusRpcRequest('getTransaction', [sig.signature]);
        return {
          signature: sig.signature,
          slot: sig.slot,
          blockTime: tx?.blockTime,
          status: sig.confirmationStatus,
          fee: tx?.meta?.fee || 0,
          type: 'onchain',
        };
      })
    );

    return transactions;
  } catch (err) {
    console.error('❌ Error fetching transactions:', err);
    return [];
  }
}
