import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';

const resources = {
  ar: {
    translation: {
      welcome: 'مرحبًا بك في محفظة MECO',
      create_wallet: 'إنشاء محفظة',
      import_wallet: 'استيراد محفظة',
      balance: 'رصيد المحفظة',
      send: 'إرسال',
      receive: 'استلام',
      swap: 'مبادلة',
      settings: 'الإعدادات',
      error: "خطأ",
      success: "نجاح",
      fill_fields: "يرجى ملء جميع الحقول",
      sent: "تم الإرسال",
      to: "إلى",
      recipient_address: "عنوان المستلم",
      amount: "المبلغ",
      confirm_send: "تأكيد الإرسال",
      copied: "تم النسخ",
      wallet_address_copied: "تم نسخ عنوان المحفظة",
      copy_address: "نسخ العنوان",
      backup_phrase: "نسخة احتياطية للمفاتيح",
      cancel: "إلغاء",

      // إعدادات
      change_language: "تغيير اللغة",
      toggle_theme: "تبديل النمط",
      biometric: "المصادقة الحيوية",
      contact_support: "الاتصال بالدعم",
      logout: "تسجيل الخروج",
      user_settings: "إعدادات المستخدم",
      edit_wallet_name: "تعديل اسم المحفظة",
      enter_wallet_name: "أدخل اسم المحفظة",
      wallet_name_placeholder: "محفظتي",
      save: "حفظ",
      light: "فاتح",
      dark: "غامق",
      authenticated: "تم التحقق بنجاح",
      auth_failed: "فشل في التحقق",
      biometric_not_supported: "الجهاز لا يدعم المصادقة الحيوية",
      no_notifications: "لا توجد إشعارات حالياً",

      // شاشة المبادلة
      from: "من",
      to_currency: "إلى",
      enter_amount: "أدخل المبلغ",
      execute_swap: "تنفيذ المبادلة",
      same_currency_error: "لا يمكن المبادلة بنفس العملة.",
      swap_success: "تمت المبادلة بنجاح",
      select_token: "اختر العملة",
      fee_deducted: "تم خصم الرسوم",
      insufficient_after_fee: "المبلغ غير كافٍ بعد خصم الرسوم",
      no_wallet_found: "لم يتم العثور على المحفظة",
      swap_failed: "فشلت عملية المبادلة. يرجى المحاولة مرة أخرى.",
      loading: "جارٍ التحميل...",
      no_valid_route: "لم يتم العثور على مسار صالح.",
      amount_must_be_positive: "يجب أن يكون المبلغ أكبر من صفر.",
      expected_output: "المبلغ المتوقع",

      // تبويبات
      wallet: "المحفظة",
      notifications: "الإشعارات",
      transactions: "سجل المعاملات",
      transaction_signature: "التوقيع",
      status: "الحالة",
      time: "الزمن",

      // شاشة MECO
      meco: "MECO",
      meco_title: "حول رمز MECO",
      meco_description: "رمز MECO هو مشروع رقمي عربي على شبكة Solana يهدف إلى تقديم تجربة مالية آمنة وسريعة. تم بناء هذا التطبيق لدعمه وتوسيع نطاق استخدامه.",
      price: "السعر",
      telegram: "قناة التليجرام",
      website: "الموقع الإلكتروني",

      // شاشة السوق
      market: "السوق",
      symbol: "الرمز",
      token_name: "اسم العملة",
      token_price: "السعر",

      // مضاف الآن
      first_arab_wallet: "أول محفظة عملات رقمية عربية",
    },
  },
  en: {
    translation: {
      welcome: 'Welcome to MECO Wallet',
      create_wallet: 'Create Wallet',
      import_wallet: 'Import Wallet',
      balance: 'Wallet Balance',
      send: 'Send',
      receive: 'Receive',
      swap: 'Swap',
      settings: 'Settings',
      error: "Error",
      success: "Success",
      fill_fields: "Please fill all fields",
      sent: "Sent",
      to: "to",
      recipient_address: "Recipient Address",
      amount: "Amount",
      confirm_send: "Confirm Send",
      copied: "Copied",
      wallet_address_copied: "Wallet address copied",
      copy_address: "Copy Address",
      backup_phrase: "Backup Phrase",
      cancel: "Cancel",

      // Settings
      change_language: "Change Language",
      toggle_theme: "Toggle Theme",
      biometric: "Biometric Authentication",
      contact_support: "Contact Support",
      logout: "Logout",
      user_settings: "User Settings",
      edit_wallet_name: "Edit Wallet Name",
      enter_wallet_name: "Enter Wallet Name",
      wallet_name_placeholder: "My Wallet",
      save: "Save",
      light: "Light",
      dark: "Dark",
      authenticated: "Authenticated successfully",
      auth_failed: "Authentication failed",
      biometric_not_supported: "Biometric authentication not supported",
      no_notifications: "No notifications at the moment",

      // Swap
      from: "From",
      to_currency: "To",
      enter_amount: "Enter Amount",
      execute_swap: "Execute Swap",
      same_currency_error: "Cannot swap to the same token.",
      swap_success: "Swap completed successfully",
      select_token: "Select Token",
      fee_deducted: "Fee deducted",
      insufficient_after_fee: "Insufficient amount after fee",
      no_wallet_found: "Wallet not found",
      swap_failed: "Swap failed. Please try again.",
      loading: "Loading...",
      no_valid_route: "No valid route found.",
      amount_must_be_positive: "Amount must be greater than zero.",
      expected_output: "Expected output",

      // Tabs
      wallet: "Wallet",
      notifications: "Notifications",
      transactions: "Transactions",
      transaction_signature: "Signature",
      status: "Status",
      time: "Time",

      // MECO Screen
      meco: "MECO",
      meco_title: "About MECO Token",
      meco_description: "MECO Token is an Arabic digital asset built on the Solana blockchain aiming to provide a secure and fast financial experience. This app was created to support and grow its ecosystem.",
      price: "Price",
      telegram: "Telegram Channel",
      website: "Official Website",

      // Market screen
      market: "Market",
      symbol: "Symbol",
      token_name: "Token Name",
      token_price: "Price",

      // Added now
      first_arab_wallet: "The first Arabic cryptocurrency wallet",
    },
  },
};

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    resources,
    lng: 'ar',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
