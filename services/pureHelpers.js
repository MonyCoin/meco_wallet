// services/pureHelpers.js
// دوال نقية (بلا اعتماد على React Native أو الشبكة) لتسهيل اختبارها آلياً في GitHub Actions.
// مكتوبة بصيغة CommonJS عمداً ليعمل نفس الملف في التطبيق (Metro) وفي اختبارات Node.

// تحويل مبلغ عشري إلى أصغر وحدة (lamports وما يماثلها) دون أخطاء الفاصلة العائمة.
// السلوك: قطع (truncate) للكسور الزائدة عن decimals، ويُعيد BigInt. المبلغ غير الصالح أو ≤ 0 يُعيد 0n.
function toBaseUnits(amount, decimals) {
  const d = Number.isInteger(decimals) && decimals >= 0 && decimals <= 30 ? decimals : 9;
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || n >= 1e21) return 0n;
  // نُبقي 3 خانات إضافية لامتصاص ضجيج الفاصلة العائمة ثم نقطع عند decimals
  const fixed = n.toFixed(Math.min(d + 3, 100));
  const parts = fixed.split('.');
  const whole = parts[0];
  const frac  = parts[1] || '';
  return BigInt(whole + (frac + '0'.repeat(d)).slice(0, d));
}

// رسالة مفهومة للمستخدم: أخطاء الخدمات المترجمة (SVC_*) تُعرض كما هي، ورسائل الشبكة الخام تُحوَّل لنص مترجم
function friendlySendError(error, t) {
  const raw = String((error && error.message) || error || '');
  if (error && typeof error.code === 'string' && error.code.startsWith('SVC_')) return raw;
  if (/Attempt to debit an account but found no record of a prior credit|insufficient lamports|insufficient funds/i.test(raw)) {
    return t('sendScreen.alerts.sender_needs_sol');
  }
  if (/blockhash|block height exceeded|expired/i.test(raw)) return t('sendScreen.alerts.tx_expired');
  if (/Network request failed|fetch failed|timeout|timed out/i.test(raw)) return t('sendScreen.alerts.network_failed');
  if (/User rejected|cancel/i.test(raw)) return t('sendScreen.alerts.cancelled');
  // أي رسالة خام أخرى: نص عام + أول جزء من الرسالة للتشخيص
  return raw ? `${t('sendScreen.alerts.sendFailed')}\n${raw.slice(0, 120)}` : t('sendScreen.alerts.sendFailed');
}

function sessionAccounts(session) {
  const out = [];
  try {
    Object.values((session && session.namespaces) || {}).forEach((ns) => {
      ((ns && ns.accounts) || []).forEach((a) => {
        const pk = String(a).split(':').pop();
        if (pk) out.push(pk);
      });
    });
  } catch (_) {}
  return out;
}

// true إذا كانت الجلسة تخص الحساب النشط، أو إذا تعذّر تحديد حساب الجلسة (سلوك سابق)
function sessionMatchesActive(session, activePubkey) {
  const accs = sessionAccounts(session);
  if (accs.length === 0 || !activePubkey) return true;
  return accs.includes(activePubkey);
}

// نتيجة تحقق Reown من هوية الموقع (VALID / INVALID / UNKNOWN + تصنيف احتيال)
function readVerify(ctx) {
  const v = (ctx && ctx.verified) || {};
  return {
    scam:       v.isScam === true,
    validation: v.validation || 'UNKNOWN',
    origin:     v.origin || '',
  };
}

// استخراج قيمة uri من رابط meco-wallet://wc?uri=... (تُعاد كما هي دون فك ترميز)
// المشفّر (wc%3A...) يُقطع عند أول & ، وغير المشفّر يؤخذ كاملاً.
function extractWcUri(url) {
  if (typeof url !== 'string' || !url.startsWith('meco-wallet://wc')) return '';
  const m    = url.match(/[?&]uri=(.*)$/);
  const rest = m ? m[1] : '';
  return /^wc%3A/i.test(rest) ? rest.split('&')[0] : rest;
}

// اختيار أيقونة الموقع من بيانات WalletConnect: نتجاوز SVG (لا يدعمها Image في RN)
// ونحوّل المسارات النسبية (/icon.png) إلى روابط كاملة اعتماداً على نطاق الموقع
function resolveSiteIcon(icons, url) {
  const origin = ((typeof url === 'string' ? url : '').match(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]+/i) || [''])[0];
  const list = Array.isArray(icons) ? icons : [];
  for (const raw of list) {
    if (typeof raw !== 'string' || !raw) continue;
    if (/\.svg(\?|#|$)/i.test(raw)) continue;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('//')) return 'https:' + raw;
    if (origin) return origin + (raw.startsWith('/') ? raw : '/' + raw);
  }
  return null;
}

// تجهيز قائمة المواقع المتصلة من كائن الجلسات النشطة (topic -> session)
// الناتج مرتب أبجدياً بالاسم، وكل عنصر: { topic, name, host, url, icon, account }
function buildSiteList(sessions) {
  const out = [];
  try {
    Object.keys(sessions || {}).forEach((topic) => {
      const s    = sessions[topic] || {};
      const meta = (s.peer && s.peer.metadata) || {};
      const url  = typeof meta.url === 'string' ? meta.url : '';
      const host = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split(/[/?#]/)[0];
      const accs = sessionAccounts(s);
      out.push({
        topic,
        name:    meta.name || host || 'dApp',
        host,
        url,
        icon:    resolveSiteIcon(meta.icons, url),
        fallbackIcon: host ? `https://www.google.com/s2/favicons?domain=${host}&sz=128` : null,
        account: accs[0] || '',
      });
    });
  } catch (_) {}
  return out.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

module.exports = { resolveSiteIcon, buildSiteList, toBaseUnits, friendlySendError, sessionAccounts, sessionMatchesActive, readVerify, extractWcUri };
