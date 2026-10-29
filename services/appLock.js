// services/appLock.js
// قفل التطبيق برمز الهاتف (أو بصمته كخيار من نظام الهاتف) عند كل عودة للتطبيق
import * as LocalAuthentication from 'expo-local-authentication';
import { useAppStore } from '../store';

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
