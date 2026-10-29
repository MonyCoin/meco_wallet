// services/screenGuard.js
// منع لقطات الشاشة وتسجيلها في الشاشات الحساسة فقط (عبارة الاسترداد والمفتاح الخاص).
// يعمل بأفضل جهد: إن لم تكن الوحدة موجودة في نسخة التطبيق المثبتة يُتجاهل دون أي خطأ.
let mod = null;
try {
  // eslint-disable-next-line global-require
  mod = require('expo-screen-capture');
} catch (_) { mod = null; }

export async function protectScreen(tag) {
  try { if (mod && mod.preventScreenCaptureAsync) await mod.preventScreenCaptureAsync(tag); } catch (_) {}
}
export async function unprotectScreen(tag) {
  try { if (mod && mod.allowScreenCaptureAsync) await mod.allowScreenCaptureAsync(tag); } catch (_) {}
}
