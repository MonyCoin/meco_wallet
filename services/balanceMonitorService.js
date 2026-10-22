// services/balanceMonitorService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccountsOverview } from './heliusService';
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

// ─── قائمة الرموز المراقَبة (Core + Custom) — نفس قواعد التسمية السابقة ──────
const buildTokenList = (customTokens) => {
  const list = [];
  const seen = new Set(['SOL']);

  for (const token of CORE_TOKENS) {
    if (token.symbol === 'SOL' || !token.mint) continue;
    list.push(token);
    seen.add(token.symbol);
  }
  for (const token of (customTokens || [])) {
    if (!token.mint || seen.has(token.symbol)) continue;
    list.push(token);
    seen.add(token.symbol);
  }
  return list;
};

// ─── أرصدة حساب واحد بصيغة اللقطة نفسها { SOL, MECO, ... } من نتيجة الجلب المجمّع ─
const balancesFromOverview = (entry, tokenList) => {
  const balances = { SOL: entry.sol || 0 };
  for (const token of tokenList) {
    balances[token.symbol] = entry.tokens[token.mint] || 0;
  }
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

    // ✅ جلب أرصدة كل الحسابات دفعة واحدة (بدل طلب لكل رمز في كل حساب)
    const accountList  = accounts.filter(a => a?.publicKey);
    const customTokens = await getCustomTokens().catch(() => []);
    const tokenList    = buildTokenList(customTokens);
    const overview     = await getAccountsOverview(accountList.map(a => a.publicKey));

    // فحص كل حساب
    for (const account of accountList) {
      const publicKey = account.publicKey;
      const entry     = overview[publicKey];

      // فشل جلب هذا الحساب: نُبقي لقطته السابقة كما هي ولا نعتبر الرصيد صفرًا
      if (!entry || !entry.ok) {
        if (oldSnapshots[publicKey]) newSnapshots[publicKey] = oldSnapshots[publicKey];
        continue;
      }

      const currentBalances = balancesFromOverview(entry, tokenList);
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
