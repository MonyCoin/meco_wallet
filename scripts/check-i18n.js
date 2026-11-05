#!/usr/bin/env node
/**
 * فحص الترجمة — بلا أي حزم خارجية.
 * التشغيل:  node scripts/check-i18n.js
 *
 * يفحص:
 *  1) تطابق مفاتيح العربية والإنجليزية في الاتجاهين.
 *  2) عدم وجود قيم فارغة.
 *  3) تطابق متغيرات {{name}} بين اللغتين لكل مفتاح.
 *  4) كل t('key') / i18n.t('key') بنص ثابت يجب أن يكون مفتاحه موجودًا (المفاتيح الديناميكية: يُفحص البادئة فقط).
 *  5) نصوص عربية مكتوبة مباشرة في Alert.alert / new Error / شرط اللغة (يجب أن تكون في i18n.js).
 *
 * الخروج: 0 = سليم، 1 = يوجد خطأ.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const I18N_FILE = path.join(ROOT, 'i18n.js');
const SCAN_DIRS = ['screens', 'components', 'services'];
const SCAN_FILES = ['AppContainer.js', 'App.js', 'store.js'];
const ARABIC = /[\u0600-\u06FF]/;
// نصوص عربية مسموحة مباشرة (اسم اللغة بلغتها نفسها يجب أن يبقى ثابتًا)
const ALLOWED_AR = new Set(['العربية']);

const errors = [];
const fail = (msg) => errors.push(msg);

// ── 1) استخراج الترجمات من i18n.js ──────────────────────────────────────────
function loadResources() {
  const src = fs.readFileSync(I18N_FILE, 'utf8');
  const start = src.indexOf('const resources = ');
  const end = src.indexOf('\n};', start);
  if (start < 0 || end < 0) {
    console.error('تعذّر العثور على كائن resources داخل i18n.js');
    process.exit(1);
  }
  const literal = src.slice(start + 'const resources = '.length, end + 3).replace(/;\s*$/, '');
  try {
    return new Function('return ' + literal)();
  } catch (e) {
    console.error('تعذّر قراءة resources:', e.message);
    process.exit(1);
  }
}

function flatten(obj, prefix, out) {
  for (const k of Object.keys(obj)) {
    const key = prefix ? prefix + '.' + k : k;
    const v = obj[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

const res = loadResources();
const ar = flatten(res.ar.translation, '', {});
const en = flatten(res.en.translation, '', {});

// ── مفاتيح اللغتين ─────────────────────────────────────────────────────────
for (const k of Object.keys(ar)) if (!(k in en)) fail(`[parity] المفتاح "${k}" موجود في العربية وناقص في الإنجليزية`);
for (const k of Object.keys(en)) if (!(k in ar)) fail(`[parity] المفتاح "${k}" موجود في الإنجليزية وناقص في العربية`);

// ── قيم فارغة + متغيرات ────────────────────────────────────────────────────
const vars = (s) =>
  (typeof s === 'string' ? (s.match(/\{\{\s*[\w.]+\s*\}\}/g) || []) : [])
    .map((x) => x.replace(/\s+/g, ''))
    .sort()
    .join(',');
for (const [lang, map] of [['ar', ar], ['en', en]]) {
  for (const [k, v] of Object.entries(map)) {
    if (typeof v === 'string' && v.trim() === '') fail(`[empty] القيمة فارغة: ${lang}.${k}`);
  }
}
for (const k of Object.keys(ar)) {
  if (k in en && vars(ar[k]) !== vars(en[k])) {
    fail(`[vars] متغيرات مختلفة في "${k}": ar(${vars(ar[k]) || '-'}) ≠ en(${vars(en[k]) || '-'})`);
  }
}

// ── 4 + 5) فحص الكود ──────────────────────────────────────────────────────
function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (/\.(js|jsx)$/.test(f.name)) out.push(p);
  }
  return out;
}
const files = [];
SCAN_DIRS.forEach((d) => walk(path.join(ROOT, d), files));
SCAN_FILES.forEach((f) => fs.existsSync(path.join(ROOT, f)) && files.push(path.join(ROOT, f)));

const allKeys = Object.keys(en);
const hasPrefix = (p) => allKeys.some((k) => k.startsWith(p));

// نزيل التعليقات (تقريبيًا) حتى لا تُحسب كنصوص
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const T_CALL = /(?<![\w$.])(?:i18n\.)?t\(\s*(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g;
const T_CALL_I18N = /\bi18n\.t\(\s*(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g;
const AR_IN_CALL = [
  /\bnew Error\(\s*(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g,
  /\bAlert\.alert\(\s*(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g,
  /\bAlert\.alert\(\s*[^,()]+,\s*(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g,
];
const AR_TERNARY = /(?:===?\s*['"]ar['"]|\bisAr\w*|\bisArabic\w*)\s*\?\s*(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g;

const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

for (const file of files) {
  const text = stripComments(fs.readFileSync(file, 'utf8'));
  const seen = new Set();
  for (const re of [T_CALL, T_CALL_I18N]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const quote = m[1];
      const key = m[2];
      const id = file + ':' + m.index;
      if (seen.has(id)) continue;
      seen.add(id);
      const loc = `${rel(file)}:${lineOf(text, m.index)}`;
      if (quote === '`' && key.includes('${')) {
        const prefix = key.split('${')[0];
        if (prefix && !hasPrefix(prefix)) fail(`[missing] ${loc} — لا يوجد أي مفتاح يبدأ بـ "${prefix}"`);
        continue;
      }
      // نص عادي لا يشبه مفتاحًا (مثل t('') أو جملة) نتجاهله
      if (!/^[A-Za-z_][\w]*(\.[\w]+)*$/.test(key)) continue;
      if (!(key in en) && !hasPrefix(key + '.')) fail(`[missing] ${loc} — المفتاح "${key}" غير معرَّف في i18n.js`);
    }
  }
  if (rel(file) === 'i18n.js') continue;
  for (const re of AR_IN_CALL) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      if (ARABIC.test(m[2]) && !ALLOWED_AR.has(m[2])) fail(`[hardcoded] ${rel(file)}:${lineOf(text, m.index)} — نص عربي مباشر: "${m[2].slice(0, 40)}"`);
    }
  }
  AR_TERNARY.lastIndex = 0;
  let m;
  while ((m = AR_TERNARY.exec(text))) {
    if (ARABIC.test(m[2]) && !ALLOWED_AR.has(m[2])) fail(`[hardcoded] ${rel(file)}:${lineOf(text, m.index)} — شرط لغة بنص عربي مباشر: "${m[2].slice(0, 40)}"`);
  }
}

// ── النتيجة ────────────────────────────────────────────────────────────────
if (errors.length) {
  console.error(`\n❌ فحص الترجمة فشل — ${errors.length} مشكلة:\n`);
  errors.forEach((e) => console.error('  • ' + e));
  console.error('\nأصلح المشاكل أعلاه ثم أعد الدفع.\n');
  process.exit(1);
}
console.log(`✅ فحص الترجمة سليم — ${allKeys.length} مفتاحًا في كل لغة، ${files.length} ملف كود تم فحصه.`);
