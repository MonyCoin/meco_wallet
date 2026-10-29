// services/appLock.js
// قفل التطبيق برمز الهاتف (أو بصمته كخيار من نظام الهاتف) عند كل عودة للتطبيق
import * as LocalAuthentication from 'expo-local-authentication';
import { useAppStore } from '../store';
import AsyncStorage from '@react-native-async-storage/async-storage';

let suspendedUntil = 0;

/** تعليق القفل مؤقتًا لعمليات نظام قصيرة (منتقي الصور، أذونات الكاميرا) حتى لا تُقفل أثناءها */
export function suspendAppLock(ms = 60000) {
  suspendedUntil = Date.now() + ms;
}
export function isLockSuspended() {
  return Date.now() < suspendedUntil;
}

/**
 * يطلب مصادقة نظام الهاتف. يرجع true عند النجاح.
 * - إن لم يكن للهاتف قفل أصلًا (لا رمز ولا بصمة): لا يمكن الحماية فيُسمح بالدخول.
 * - أي خطأ غير متوقع: يُرفض (يمكن للمستخدم إعادة المحاولة).
 */
export async function authenticateDevice(lang) {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level === LocalAuthentication.SecurityLevel.NONE) return true;
    const ar = lang === 'ar';
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: ar ? 'أدخل رمز الهاتف للمتابعة' : 'Enter your phone passcode to continue',
      cancelLabel: ar ? 'إلغاء' : 'Cancel',
      disableDeviceFallback: false,
      fallbackLabel: ar ? 'استخدم رمز الهاتف' : 'Use phone passcode',
    });
    return !!result.success;
  } catch (_) {
    return false;
  }
}

/**
 * تأكيد هوية المستخدم قبل أي عملية تنقل أموالًا. يرجع true عند النجاح.
 * يعلّق قفل التطبيق لحظيًا حتى لا تُقفل الشاشة بسبب نافذة المصادقة نفسها.
 */
export async function requireAuth() {
  suspendAppLock(30000);
  const ok = await authenticateDevice(useAppStore.getState().language);
  suspendedUntil = 0;
  return ok;
}

// ───────────── إعدادات قفل التطبيق (تشغيل/إيقاف + مدة القفل) ─────────────
const K_ENABLED = 'app_lock_enabled';
const K_TIMEOUT = 'app_lock_timeout_ms';

export const LOCK_TIMEOUTS = [
  { ms: 0,        ar: 'فورًا',      en: 'Immediately' },
  { ms: 30000,    ar: '30 ثانية',   en: '30 seconds' },
  { ms: 60000,    ar: 'دقيقة',      en: '1 minute' },
  { ms: 300000,   ar: '5 دقائق',    en: '5 minutes' },
  { ms: 900000,   ar: '15 دقيقة',   en: '15 minutes' },
  { ms: 1800000,  ar: '30 دقيقة',   en: '30 minutes' },
];

// الافتراضي: مفعّل + فورًا (نفس السلوك السابق)
let lockSettings = { enabled: true, timeoutMs: 0 };

export function getLockSettings() {
  return { ...lockSettings };
}

export async function loadLockSettings() {
  try {
    const e = await AsyncStorage.getItem(K_ENABLED);
    const t = await AsyncStorage.getItem(K_TIMEOUT);
    const ms = parseInt(t, 10);
    lockSettings = {
      enabled: e !== 'false',
      timeoutMs: LOCK_TIMEOUTS.some(o => o.ms === ms) ? ms : 0,
    };
  } catch (_) { /* نبقي الافتراضي الآمن */ }
  return getLockSettings();
}

export async function saveLockSettings(partial) {
  lockSettings = { ...lockSettings, ...partial };
  try {
    await AsyncStorage.setItem(K_ENABLED, lockSettings.enabled ? 'true' : 'false');
    await AsyncStorage.setItem(K_TIMEOUT, String(lockSettings.timeoutMs));
  } catch (_) {}
  return getLockSettings();
}
