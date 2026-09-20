// services/priceAlertService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addNotification, NOTIF_TYPES } from './notificationsService';
import { getJupiterMarketData } from './jupiterMarketService';

const ALERTS_KEY   = '@meco_price_alerts';
const MAX_ALERTS   = 50;

// ─── جلب جميع التنبيهات ─────────────────────────────────────────────────────
export const getAlerts = async () => {
  try {
    const stored = await AsyncStorage.getItem(ALERTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (_) {
    return [];
  }
};

// ─── حفظ التنبيهات ──────────────────────────────────────────────────────────
const saveAlerts = async (alerts) => {
  try {
    await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
  } catch (e) {
    console.warn('saveAlerts error:', e);
  }
};

// ─── إضافة تنبيه جديد ───────────────────────────────────────────────────────
/**
 * @param {Object} options
 * @param {String} options.symbol          - رمز العملة (مثل SOL)
 * @param {String} options.mint            - عنوان العقد
 * @param {String} options.image           - رابط الأيقونة
 * @param {Number} options.targetPrice     - السعر المستهدف
 * @param {String} options.direction       - 'above' أو 'below'
 * @param {Number} options.currentPrice    - السعر الحالي عند الإنشاء
 */
export const addAlert = async ({
  symbol,
  mint,
  image,
  targetPrice,
  direction,
  currentPrice,
}) => {
  try {
    const alerts = await getAlerts();

    const newAlert = {
      id:                  Date.now().toString() + Math.random().toString(36).slice(2, 7),
      symbol,
      mint,
      image,
      targetPrice:         parseFloat(targetPrice),
      direction,           // 'above' | 'below'
      priceAtCreate:       parseFloat(currentPrice) || 0,
      enabled:             true,
      triggered:           false,
      createdAt:           Date.now(),
      triggeredAt:         null,
    };

    const updated = [newAlert, ...alerts].slice(0, MAX_ALERTS);
    await saveAlerts(updated);
    return newAlert;
  } catch (e) {
    console.warn('addAlert error:', e);
    return null;
  }
};

// ─── حذف تنبيه ──────────────────────────────────────────────────────────────
export const deleteAlert = async (id) => {
  try {
    const alerts  = await getAlerts();
    const updated = alerts.filter(a => a.id !== id);
    await saveAlerts(updated);
    return updated;
  } catch (_) {
    return [];
  }
};

// ─── تفعيل / تعطيل تنبيه ───────────────────────────────────────────────────
export const toggleAlert = async (id) => {
  try {
    const alerts  = await getAlerts();
    const updated = alerts.map(a => {
      if (a.id !== id) return a;
      // إعادة التعيين إذا كان مفعّلاً
      if (a.triggered) {
        return { ...a, enabled: true, triggered: false, triggeredAt: null };
      }
      return { ...a, enabled: !a.enabled };
    });
    await saveAlerts(updated);
    return updated;
  } catch (_) {
    return [];
  }
};

// ─── جلب تنبيهات عملة معينة ────────────────────────────────────────────────
export const getAlertsForSymbol = async (symbol) => {
  try {
    const alerts = await getAlerts();
    return alerts.filter(a => a.symbol === symbol);
  } catch (_) {
    return [];
  }
};

// ─── عدد التنبيهات النشطة ─────────────────────────────────────────────────
export const getActiveAlertsCount = async () => {
  try {
    const alerts = await getAlerts();
    return alerts.filter(a => a.enabled && !a.triggered).length;
  } catch (_) {
    return 0;
  }
};

// ─── تنسيق السعر للعرض ─────────────────────────────────────────────────────
export const formatAlertPrice = (price) => {
  if (!price && price !== 0) return '$0.00';
  if (price >= 1) {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (price >= 0.001) {
    return `$${price.toFixed(4)}`;
  }
  return `$${price.toFixed(8).replace(/\.?0+$/, '')}`;
};

// ─── الدالة الرئيسية: فحص التنبيهات وإطلاق الإشعارات ─────────────────────
export const checkPriceAlerts = async () => {
  try {
    const alerts = await getAlerts();
    if (!alerts.length) return;

    // جلب التنبيهات النشطة فقط
    const activeAlerts = alerts.filter(a => a.enabled && !a.triggered);
    if (!activeAlerts.length) return;

    // جلب أسعار السوق
    let marketData = [];
    try {
      marketData = await getJupiterMarketData();
    } catch (_) {
      return; // لا نتائج إذا فشل جلب الأسعار
    }
    if (!Array.isArray(marketData) || !marketData.length) return;

    const priceMap = {};
    marketData.forEach(tk => {
      if (tk.symbol) priceMap[tk.symbol] = tk.current_price || 0;
    });

    const triggered = [];

    // فحص كل تنبيه
    for (const alert of activeAlerts) {
      const currentPrice = priceMap[alert.symbol];
      if (!currentPrice || currentPrice <= 0) continue;

      const shouldTrigger =
        (alert.direction === 'above' && currentPrice >= alert.targetPrice) ||
        (alert.direction === 'below' && currentPrice <= alert.targetPrice);

      if (shouldTrigger) {
        triggered.push({ alert, currentPrice });
      }
    }

    if (!triggered.length) return;

    // تحديث حالة التنبيهات المفعّلة
    const updatedAlerts = alerts.map(a => {
      const hit = triggered.find(t => t.alert.id === a.id);
      if (hit) {
        return { ...a, triggered: true, triggeredAt: Date.now() };
      }
      return a;
    });
    await saveAlerts(updatedAlerts);

    // إرسال إشعار لكل تنبيه مفعّل
    for (const { alert, currentPrice } of triggered) {
      await addNotification({
        type:       NOTIF_TYPES.INFO,
        icon:       '🔔',
        titleKey:   'notif_price_alert_title',
        messageKey: 'notif_price_alert_message',
        params: {
          symbol:       alert.symbol,
          targetPrice:  formatAlertPrice(alert.targetPrice),
          currentPrice: formatAlertPrice(currentPrice),
          direction:    alert.direction,
        },
        data: {
          symbol:       alert.symbol,
          targetPrice:  alert.targetPrice,
          currentPrice: currentPrice,
          direction:    alert.direction,
          alertId:      alert.id,
        },
      });
    }
  } catch (e) {
    console.warn('checkPriceAlerts error:', e);
  }
};

// ─── مسح جميع التنبيهات (للاختبار) ─────────────────────────────────────────
export const clearAllAlerts = async () => {
  try {
    await AsyncStorage.removeItem(ALERTS_KEY);
    return [];
  } catch (_) {
    return [];
  }
};
