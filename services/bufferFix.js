// services/bufferFix.js
// الإصدار 1.0 - إصلاح subarray في Hermes
// إصلاح لبيئة Hermes: Buffer.prototype.subarray تُرجع Uint8Array عادية بلا دوال Buffer
// (مثل readInt32LE)، فيفشل فك بيانات الحسابات في مكتبة Orca/Anchor.
// يُطبَّق فقط إذا ثبت العطل، ويحافظ على نفس سلوك Node (ذاكرة مشتركة).
let _done = false;

export function ensureBufferSubarray() {
  if (_done) return;
  _done = true;
  try {
    const B = global.Buffer || require('buffer').Buffer; // eslint-disable-line global-require
    const probe = B.alloc(4).subarray(1);
    if (typeof probe.readInt32LE === 'function') return; // سليم، لا حاجة للإصلاح
    const orig = B.prototype.subarray;
    B.prototype.subarray = function subarrayAsBuffer(start, end) {
      const out = orig.call(this, start, end);
      if (typeof out.readInt32LE === 'function') return out;
      return B.from(out.buffer, out.byteOffset, out.length);
    };
  } catch (e) { /* لا نكسر التطبيق إن تعذر الإصلاح */ }
}
