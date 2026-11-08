// tests/pure.test.js — يعمل بأداة Node المدمجة: node --test tests/
const test   = require('node:test');
const assert = require('node:assert/strict');
const {
  toBaseUnits, friendlySendError, sessionMatchesActive, readVerify, extractWcUri,
} = require('../services/pureHelpers');

test('toBaseUnits: مبالغ معروفة كانت تفقد وحدة بسبب الفاصلة العائمة', () => {
  assert.equal(toBaseUnits(4.35, 9), 4350000000n);
  assert.equal(toBaseUnits(0.29, 9), 290000000n);
  assert.equal(toBaseUnits(1.15, 6), 1150000n);
  assert.equal(toBaseUnits(0.57, 2), 57n);
});

test('toBaseUnits: رسم الخدمة 0.0005 SOL = 500000 lamports بالضبط', () => {
  assert.equal(toBaseUnits(0.0005, 9), 500000n);
});

test('toBaseUnits: كل المبالغ بأربع خانات عشرية تعطي نتيجة دقيقة (9 و6 خانات)', () => {
  for (let i = 1; i <= 100000; i++) {
    assert.equal(toBaseUnits(i / 10000, 9), BigInt(i) * 100000n, `9 decimals, i=${i}`);
    assert.equal(toBaseUnits(i / 10000, 6), BigInt(i) * 100n,    `6 decimals, i=${i}`);
  }
});

test('toBaseUnits: القطع (وليس التقريب) للكسور الزائدة عن decimals', () => {
  assert.equal(toBaseUnits(1.1234567899, 9), 1123456789n);
  assert.equal(toBaseUnits(0.0000000019, 9), 1n);
});

test('toBaseUnits: نصوص ومدخلات غير صالحة', () => {
  assert.equal(toBaseUnits('0.1', 9), 100000000n);
  assert.equal(toBaseUnits(0, 9), 0n);
  assert.equal(toBaseUnits(-1, 9), 0n);
  assert.equal(toBaseUnits(NaN, 9), 0n);
  assert.equal(toBaseUnits(Infinity, 9), 0n);
  assert.equal(toBaseUnits(undefined, 9), 0n);
  assert.equal(toBaseUnits('abc', 9), 0n);
});

test('toBaseUnits: مبالغ كبيرة', () => {
  assert.equal(toBaseUnits(1000000, 9), 1000000000000000n);
  assert.equal(toBaseUnits(123456789.123456789, 9) > 123456789000000000n, true);
});

const sess = (...accs) => ({ namespaces: { solana: { accounts: accs.map((a) => `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:${a}`) } } });

test('sessionMatchesActive: يطابق الحساب النشط فقط', () => {
  assert.equal(sessionMatchesActive(sess('AAA'), 'AAA'), true);
  assert.equal(sessionMatchesActive(sess('AAA'), 'BBB'), false);
  assert.equal(sessionMatchesActive(sess('AAA', 'BBB'), 'BBB'), true);
});

test('sessionMatchesActive: سلوك سابق عند تعذّر التحديد', () => {
  assert.equal(sessionMatchesActive(null, 'AAA'), true);
  assert.equal(sessionMatchesActive({}, 'AAA'), true);
  assert.equal(sessionMatchesActive(sess('AAA'), ''), true);
});

test('readVerify: القيم الافتراضية والحالات الثلاث', () => {
  assert.deepEqual(readVerify(undefined), { scam: false, validation: 'UNKNOWN', origin: '' });
  assert.deepEqual(readVerify({}), { scam: false, validation: 'UNKNOWN', origin: '' });
  assert.deepEqual(readVerify({ verified: { validation: 'VALID', origin: 'https://www.orca.so', isScam: false } }),
    { scam: false, validation: 'VALID', origin: 'https://www.orca.so' });
  assert.equal(readVerify({ verified: { validation: 'INVALID', origin: 'https://evil.example' } }).validation, 'INVALID');
  assert.equal(readVerify({ verified: { isScam: true } }).scam, true);
  assert.equal(readVerify({ verified: { isScam: 'true' } }).scam, false); // لا نعتبر غير القيمة المنطقية true
});

test('extractWcUri: رابط مشفّر وغير مشفّر ومعاملات إضافية', () => {
  assert.equal(extractWcUri('meco-wallet://wc?uri=wc%3Aabc%401%3Frelay-protocol%3Dirn%26symKey%3Dxyz'),
    'wc%3Aabc%401%3Frelay-protocol%3Dirn%26symKey%3Dxyz');
  assert.equal(extractWcUri('meco-wallet://wc?uri=wc%3Aabc%401&foo=bar'), 'wc%3Aabc%401');
  assert.equal(extractWcUri('meco-wallet://wc?uri=wc:abc@1?relay-protocol=irn&symKey=xyz'),
    'wc:abc@1?relay-protocol=irn&symKey=xyz');
});

test('extractWcUri: روابط أخرى أو فارغة تُهمل', () => {
  assert.equal(extractWcUri('https://example.com/wc?uri=wc%3Aabc'), '');
  assert.equal(extractWcUri('meco-wallet://other?uri=wc%3Aabc'), '');
  assert.equal(extractWcUri('meco-wallet://wc'), '');
  assert.equal(extractWcUri(null), '');
  assert.equal(extractWcUri(undefined), '');
});

const t = (k) => k;

test('friendlySendError: تصنيف الأخطاء إلى مفاتيح الترجمة', () => {
  assert.equal(friendlySendError(new Error('Attempt to debit an account but found no record of a prior credit.'), t), 'sendScreen.alerts.sender_needs_sol');
  assert.equal(friendlySendError(new Error('insufficient lamports 1, need 2'), t), 'sendScreen.alerts.sender_needs_sol');
  assert.equal(friendlySendError(new Error('Blockhash not found'), t), 'sendScreen.alerts.tx_expired');
  assert.equal(friendlySendError(new Error('Network request failed'), t), 'sendScreen.alerts.network_failed');
  assert.equal(friendlySendError(new Error('User rejected the request'), t), 'sendScreen.alerts.cancelled');
});

test('friendlySendError: أخطاء الخدمات المترجمة تُعرض كما هي، والمجهول بنص عام', () => {
  const e = new Error('رسالة مترجمة'); e.code = 'SVC_insufficient_input';
  assert.equal(friendlySendError(e, t), 'رسالة مترجمة');
  assert.equal(friendlySendError(new Error('weird failure'), t), 'sendScreen.alerts.sendFailed\nweird failure');
  assert.equal(friendlySendError(null, t), 'sendScreen.alerts.sendFailed');
  assert.equal(friendlySendError(new Error('x'.repeat(300)), t).length, 'sendScreen.alerts.sendFailed\n'.length + 120);
});
