// services/svcError.js
// أخطاء الخدمات المترجمة: النص من i18n (المجموعة svc_errors) + رمز ثابت err.code = 'SVC_<key>'
// يستعمله من يحتاج المطابقة على نوع الخطأ دون الاعتماد على لغة النص.
import i18n from '../i18n';

// نص مترجم فقط (لأخطاء تُرجَع ككائن {success:false, error} لا كاستثناء)
export function svcText(key, params) {
  return i18n.t('svc_errors.' + key, params);
}

export function svcError(key, params) {
  const e = new Error(i18n.t('svc_errors.' + key, params));
  e.code = 'SVC_' + key;
  return e;
}
