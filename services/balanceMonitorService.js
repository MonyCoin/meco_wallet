// services/balanceMonitorService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSolBalance, getTokenBalance } from './heliusService';
import { CORE_TOKENS, getCustomTokens } from './jupiterMarketService';
import { addNotification, NOTIF_TYPES } from './notificationsService';

const SNAPSHOTS_KEY = '@meco_balance_snapshots';
const MIN_INCREASE  = 0.000001; // تجاهل الفروق الطفيفة جداً (أخطاء عشرية)

// ─── جلب snapshots المحفوظة ────────────────────────────────────────────────
const getSnapshots = async () => {
  try {
    const stored = await AsyncStorage.getItem(SNAPSHOTS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (_) {
    return {};
  }
};

// ─── حفظ snapshots ─────────────────────────────────────────────────────────
const saveSnapshots = async (snapshots) => {
  try {
    await AsyncStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
  } catch (e) {
    console.warn('saveSnapshots error:', e);
  }
};

// ─── جلب كل أرصدة حساب واحد (SOL + Core + Custom) ─────────────────────────
const fetchAccountBalances = async (publicKey) => {
  const balances = {};

  // SOL
  try {
    balances['SOL'] = (await getSolBalance(true, publicKey)) || 0;
  } catch (_) {
    balances['SOL'] = 0;
  }

  // Core tokens (ما عدا SOL)
  for (const token of CORE_TOKENS) {
    if (token.symbol === 'SOL' || !token.mint) continue;
    try {
      balances[token.symbol] = (await getTokenBalance(token.mint, true, publicKey)) || 0;
    } catch (_) {
      balances[token.symbol] = 0;
    }
  }

  // Custom tokens
  try {
    const customTokens = await getCustomTokens();
    for (const token of customTokens) {
      if (!token.mint || balances[token.symbol] !== undefined) continue;
      try {
        balances[token.symbol] = (await getTokenBalance(token.mint, true, publicKey)) || 0;
      } catch (_) {
        balances[token.symbol] = 0;
      }
    }
  } catch (_) {}

  return balances;
};

// ─── تنسيق الأرقام لعرضها في الإشعار ───────────────────────────────────────
const formatAmount = (amount) => {
  if (amount >= 1000) {
    return amount.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  if (amount >= 1) {
    return amount.toLocaleString('en-US', { maximumFractionDigits: 4 });
  }
  return amount.toLocaleString('en-US', { maximumFractionDigits: 6 });
};

// ─── الدالة الرئيسية: فحص الزيادات وإرسال إشعار موحّد ─────────────────────
export const checkBalanceChanges = async (accounts) => {
  try {
    if (!accounts || accounts.length === 0) return;

    const oldSnapshots = await getSnapshots();
    const newSnapshots = {};
    const increases    = {}; // { symbol: إجمالي الزيادة }

    const isFirstRun = Object.keys(oldSnapshots).length === 0;

    // فحص كل حساب
    for (const account of accounts) {
      const publicKey = account?.publicKey;
      if (!publicKey) continue;

      const currentBalances = await fetchAccountBalances(publicKey);
      newSnapshots[publicKey] = currentBalances;

      // المقارنة فقط إذا كان لدينا snapshot سابق
      if (!isFirstRun && oldSnapshots[publicKey]) {
        const oldBalances = oldSnapshots[publicKey];

        for (const symbol in currentBalances) {
          const oldVal = oldBalances[symbol] || 0;
          const newVal = currentBalances[symbol] || 0;
          const diff   = newVal - oldVal;

          if (diff > MIN_INCREASE) {
            increases[symbol] = (increases[symbol] || 0) + diff;
          }
        }
      }
    }

    // حفظ snapshots الجديدة
    await saveSnapshots(newSnapshots);

    // أول تشغيل أو لا زيادات → لا إشعار
    if (isFirstRun || Object.keys(increases).length === 0) return;

    // بناء ملخص موحّد للزيادات
    const summaryParts = Object.entries(increases).map(
      ([symbol, amount]) => `${formatAmount(amount)} ${symbol}`
    );
    const summary = summaryParts.join(' + ');

    // إشعار واحد مجمّع
    await addNotification({
      type:       NOTIF_TYPES.RECEIVE,
      titleKey:   'notif_receive_combined_title',
      messageKey: 'notif_receive_combined_message',
      params:     { summary },
      data:       { increases },
    });
  } catch (e) {
    console.warn('checkBalanceChanges error:', e);
  }
};

// ─── مسح الـ snapshots (للاختبار أو إعادة التعيين) ────────────────────────
export const resetSnapshots = async () => {
  try {
    await AsyncStorage.removeItem(SNAPSHOTS_KEY);
  } catch (_) {}
};
