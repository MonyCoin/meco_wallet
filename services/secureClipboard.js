// services/secureClipboard.js
// نسخ البيانات الحساسة (عبارة الاسترداد، المفتاح الخاص) مع مسح الحافظة تلقائيًا بعد وقت قصير
import * as Clipboard from 'expo-clipboard';

let timer = null;

export async function copySensitive(text, ms = 30000) {
  await Clipboard.setStringAsync(text);
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    timer = null;
    try {
      // لا نمسح إلا إن كانت الحافظة ما زالت تحمل النص الحساس نفسه
      const current = await Clipboard.getStringAsync();
      if (current === text) await Clipboard.setStringAsync('');
    } catch (_) { /* أفضل جهد */ }
  }, ms);
}
