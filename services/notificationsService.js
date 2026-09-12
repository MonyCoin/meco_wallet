// services/notificationsService.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIF_KEY  = '@meco_notifications';
const MAX_NOTIFS = 100;

// ─── أنواع الإشعارات ───────────────────────────────────────────────────────
export const NOTIF_TYPES = {
  SEND:       'send',
  RECEIVE:    'receive',
  SWAP:       'swap',
  STAKING:    'staking',
  UNSTAKING:  'unstaking',
  SECURITY:   'security',
  INFO:       'info',
};

// ─── الأيقونة الافتراضية حسب النوع ─────────────────────────────────────────
const getDefaultIcon = (type) => {
  switch (type) {
    case NOTIF_TYPES.SEND:      return '📤';
    case NOTIF_TYPES.RECEIVE:   return '📥';
    case NOTIF_TYPES.SWAP:      return '🔄';
    case NOTIF_TYPES.STAKING:   return '⚡';
    case NOTIF_TYPES.UNSTAKING: return '🔓';
    case NOTIF_TYPES.SECURITY:  return '🔐';
    default:                    return 'ℹ️';
  }
};

// ─── اللون حسب النوع ────────────────────────────────────────────────────────
export const getNotifColor = (type, primaryColor = '#E74C3C') => {
  switch (type) {
    case NOTIF_TYPES.SEND:      return '#EF4444';
    case NOTIF_TYPES.RECEIVE:   return '#10B981';
    case NOTIF_TYPES.SWAP:      return '#3B82F6';
    case NOTIF_TYPES.STAKING:   return '#F59E0B';
    case NOTIF_TYPES.UNSTAKING: return '#8B5CF6';
    case NOTIF_TYPES.SECURITY:  return '#EF4444';
    default:                    return primaryColor;
  }
};

// ─── إضافة إشعار جديد ──────────────────────────────────────────────────────
/**
 * @param {Object} options
 * @param {String} options.type       - نوع الإشعار من NOTIF_TYPES
 * @param {String} options.titleKey   - مفتاح الترجمة للعنوان
 * @param {String} options.messageKey - مفتاح الترجمة للرسالة
 * @param {Object} options.params     - متغيرات للترجمة (مثل المبلغ، العملة)
 * @param {Object} options.data       - بيانات إضافية (signature, amount, token...)
 * @param {String} options.icon       - أيقونة مخصصة (اختياري)
 */
export const addNotification = async ({
  type,
  titleKey,
  messageKey,
  params = {},
  data   = {},
  icon,
}) => {
  try {
    const stored = await AsyncStorage.getItem(NOTIF_KEY);
    const list   = stored ? JSON.parse(stored) : [];

    const newNotif = {
      id:        Date.now().toString() + Math.random().toString(36).slice(2, 7),
      type,
      titleKey,
      messageKey,
      params,
      data,
      icon:      icon || getDefaultIcon(type),
      read:      false,
      createdAt: Date.now(),
    };

    const updated = [newNotif, ...list].slice(0, MAX_NOTIFS);
    await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
    return newNotif;
  } catch (e) {
    console.warn('addNotification error:', e);
    return null;
  }
};

// ─── جلب جميع الإشعارات ────────────────────────────────────────────────────
export const getNotifications = async () => {
  try {
    const stored = await AsyncStorage.getItem(NOTIF_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (_) {
    return [];
  }
};

// ─── عدد الإشعارات غير المقروءة ────────────────────────────────────────────
export const getUnreadCount = async () => {
  try {
    const list = await getNotifications();
    return list.filter(n => !n.read).length;
  } catch (_) {
    return 0;
  }
};

// ─── تعليم إشعار واحد كمقروء ───────────────────────────────────────────────
export const markAsRead = async (id) => {
  try {
    const list    = await getNotifications();
    const updated = list.map(n => n.id === id ? { ...n, read: true } : n);
    await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
    return updated;
  } catch (_) {
    return [];
  }
};

// ─── تعليم الجميع كمقروء ───────────────────────────────────────────────────
export const markAllAsRead = async () => {
  try {
    const list    = await getNotifications();
    const updated = list.map(n => ({ ...n, read: true }));
    await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
    return updated;
  } catch (_) {
    return [];
  }
};

// ─── حذف إشعار ─────────────────────────────────────────────────────────────
export const deleteNotification = async (id) => {
  try {
    const list    = await getNotifications();
    const updated = list.filter(n => n.id !== id);
    await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
    return updated;
  } catch (_) {
    return [];
  }
};

// ─── مسح جميع الإشعارات ────────────────────────────────────────────────────
export const clearAllNotifications = async () => {
  try {
    await AsyncStorage.removeItem(NOTIF_KEY);
    return [];
  } catch (_) {
    return [];
  }
};

// ─── تنسيق "منذ..." ────────────────────────────────────────────────────────
export const formatTimeAgo = (timestamp, t) => {
  const diff    = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);

  if (seconds < 60) return t('just_now', 'الآن');
  if (minutes < 60) return t('minutes_ago', { count: minutes, defaultValue: `منذ ${minutes} دقيقة` });
  if (hours   < 24) return t('hours_ago',   { count: hours,   defaultValue: `منذ ${hours} ساعة` });
  if (days    < 7)  return t('days_ago',    { count: days,    defaultValue: `منذ ${days} يوم` });

  return new Date(timestamp).toLocaleDateString();
};
