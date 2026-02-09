import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';

const resources = {
  ar: {
    translation: {
      // ========== مفاتيح الشاشات الأساسية ==========
      welcome: 'مرحبًا بك في محفظة MECO',
      create_wallet: 'إنشاء محفظة',
      import_wallet: 'استيراد المحفظة',
      balance: 'رصيد المحفظة',
      send: 'إرسال',
      receive: 'استلام',
      settings: 'الإعدادات',
      error: "خطأ",
      success: "نجاح",
      copied: "تم النسخ",
      cancel: "إلغاء",
      save: "حفظ",
      light: "فاتح",
      dark: "غامق",
      loading: 'جارٍ التحميل...',
      wallet: 'المحفظة',
      market: 'السوق',
      user_settings: 'إعدادات المستخدم',
      presale: "البيع المسبق",
      ok: 'موافق',

      // ========== HomeScreen.js ==========
      first_arab_wallet: 'أول محفظة عملات رقمية عربية',

      // ========== WalletScreen.js ==========
      my_wallet: 'محفظتي',
      total_balance: 'إجمالي الرصيد',
      copy_address: 'نسخ العنوان',
      wallet_address_copied: 'تم نسخ عنوان المحفظة',
      send_crypto: 'إرسال عملة',
      swap_title: 'تبادل',
      edit_wallet_name: 'تعديل اسم المحفظة',
      enter_wallet_name: 'أدخل اسم المحفظة',
      market_all_coins: 'جميع العملات',
      loading_market_data: 'جاري تحميل بيانات السوق...',

      // ========== MarketScreen.js ==========
      market_title: "سوق العملات",
      market_subtitle: "أسعار حقيقية • تحديث مباشر",
      all_tokens: "جميع العملات",
      solana_tokens: "سولانا",
      stablecoins: "مستقرة",
      current_prices: "الأسعار الحالية",
      tokens_count: "{{count}} عملة",
      important_note: "ملاحظة هامة",
      prices_auto_updated: "الأسعار يتم تحديثها تلقائياً من مصادر موثوقة",
      market_solana_tokens: "رموز سولانا",
      market_stablecoins: "العملات المستقرة",
      market_top_gainers: "الأعلى ارتفاعاً",
      market_last_update: "آخر تحديث",
      market_prices_note: "الرموز المميزة باللون البرتقالي غير متاحة للتبادل المباشر على Solana. البيانات مقدمة من CoinGecko API.",
      market_unavailable: "غير متاح",
      market_balance: "رصيد",

      // ========== SettingsScreen.js ==========
      change_language: "تغيير اللغة",
      toggle_theme: "تبديل النمط",
      biometric: "المصادقة الحيوية",
      contact_support: "الاتصال بالدعم",
      logout: "تسجيل الخروج",
      language: "اللغة",
      biometric_authentication: "المصادقة الحيوية",
      use_fingerprint_or_face_id: "استخدام البصمة أو Face ID",
      dark_mode: "الوضع الداكن",
      enabled: "مفعل",
      disabled: "معطل",
      accent_color: "لون التمييز",
      choose_accent_color: "اختر لون التمييز",
      get_help_or_report_issues: "احصل على مساعدة أو أبلغ عن مشاكل",
      about_app: "عن التطبيق",
      version_and_information: "الإصدار والمعلومات",
      sign_out_from_wallet: "الخروج من المحفظة",
      secure_crypto_wallet_description: "محفظة تشفير آمنة مصممة للعملات الرقمية مع دعم متعدد اللغات وميزات أمان متقدمة.",
      confirm_logout: "تأكيد تسجيل الخروج",
      logout_confirmation_message: "هل أنت متأكد من رغبتك في تسجيل الخروج؟ سيتم حذف مفاتيح المحفظة المحلية.",
      logout_failed: "فشل تسجيل الخروج",
      authenticate_to_continue: "قم بالمصادقة للمتابعة",
      authentication_successful: "تمت المصادقة بنجاح",
      authentication_failed: "فشلت المصادقة",
      biometric_not_available: "المصادقة الحيوية غير متاحة",
      biometric_not_supported_message: "جهازك لا يدعم المصادقة الحيوية أو لم تقم بإعدادها.",

      // ========== SendScreen.js ==========
      sendScreen: {
        title: "إرسال",
        subtitle: "تحويل إلى محفظة أخرى",
        balance: {
          available: "الرصيد المتاح",
          solForFees: "رصيد SOL للرسوم:"
        },
        inputs: {
          recipient: "عنوان المستلم",
          recipientPlaceholder: "أدخل عنوان المحفظة",
          amount: "المبلغ",
          amountPlaceholder: "أدخل المبلغ",
          maxButton: "أقصى قيمة",
          minimum: "الحد الأدنى:"
        },
        fees: {
          networkFee: "رسوم الشبكة:"
        },
        buttons: {
          send: "إرسال",
          sending: "جاري الإرسال..."
        },
        modals: {
          chooseCurrency: "اختر العملة",
          loadingBalances: "جاري تحميل الأرصدة..."
        },
        warnings: {
          inactiveAddress: "⚠️ هذا العنوان قد لا يكون نشطاً",
          enterRecipient: "أدخل عنوان المستلم",
          enterAmount: "أدخل المبلغ",
          availableToSend: "متاح للإرسال",
          verifyAddress: "تحقق من العنوان قبل الإرسال"
        },
        tokens: {
          solana: "Solana",
          mecoToken: "MECO Token",
          tetherUSD: "Tether USD",
          usdCoin: "USD Coin",
          noBalance: "لا يوجد رصيد",
          balance: "الرصيد:"
        },
        alerts: {
          error: "خطأ",
          incompleteData: "البيانات غير مكتملة أو غير صالحة للإرسال",
          invalidAddress: "عنوان المستلم غير صالح",
          selfTransfer: "لا يمكن الإرسال لنفس المحفظة",
          amountTooSmall: "المبلغ صغير جداً للإرسال",
          insufficientBalance: "رصيدك غير كافي. الرصيد الحالي:",
          insufficientSolForFees: "رصيد SOL غير كافي للرسوم. تحتاج {{needed}} SOL، رصيدك: {{balance}} SOL",
          minimumAmount: "الحد الأدنى للإرسال هو {{amount}} {{currency}}",
          success: "✅ تم الإرسال بنجاح",
          sent: "تم إرسال",
          to: "إلى:",
          fees: "📊 الرسوم:",
          transactionHash: "🔗",
          done: "تم",
          sendFailed: "فشل الإرسال",
          unexpectedError: "حدث خطأ غير متوقع"
        }
      },

      // ========== ReceiveScreen.js ==========
      receive_crypto: "استلام عملة",
      your_address: "عنوانك",
      share_address: "شارك العنوان",
      qr_code: "كود QR",
      share_to_receive: "شارك عنوانك لاستلام الأموال",
      scan_to_receive: "مسح للاستلام",
      qr_hint: "يمكن مسح الكود بأي محفظة",
      loading_address: "جاري تحميل العنوان...",
      security_tips: "نصائح أمنية",
      tip1: "شارك هذا العنوان فقط مع أشخاص تثق بهم",
      tip2: "يمكن استلام أي عملة على شبكة سولانا",
      tip3: "تأكد من صحة العنوان قبل الإرسال",
      transaction_time_note: "المعاملات تستغرق عادةً بضع ثوانٍ على شبكة سولانا",
      copy_failed: "فشل نسخ العنوان",
      wallet_address: "عنوان المحفظة",
      share_message_with_address: "عنوان محفظتي على سولانا: {{address}}\n\nيمكنك إرسال أي عملة رقمية إليها.",

      // ========== PresaleScreen.js ==========
      presale_title: "MECO Presale 🚀",
      presale_exclusive_offer: "عرض البيع المسبق الحصري",
      presale_rate: "1 SOL = 125,000 MECO",
      buy_meco: "شراء MECO",
      buy_meco_now: "اشترِ MECO الآن",
      minimum_amount: "الحد الأدنى",
      maximum_amount: "الحد الأقصى",
      enter_sol_amount: "أدخل كمية SOL",
      you_send: "ترسل",
      you_receive: "تستلم",
      transaction_fee: "رسوم المعاملة",
      view_on_solscan: "عرض على سولسكان",
      confirm_purchase: "تأكيد الشراء",
      official_meco_token: "رمز MECO الرسمي",
      verified_on_solana: "تم التحقق منه على شبكة سولانا",

      presaleScreen: {
        header_title: "البيع المسبق MECO 🚀",
        offer_title: "عرض حصري للبيع المسبق",
        rate_label: "1 SOL = 125,000 MECO",
        min_badge: "الحد الأدنى: {{amount}} SOL",
        max_badge: "الحد الأقصى: {{amount}} SOL",
        label_you_pay: "المبلغ الذي تدفعه",
        label_you_receive: "المبلغ الذي تستلمه",
        your_balance: "رصيدك: {{amount}} SOL",
        fee_label: "رسوم المعاملة",
        note_footer: "* سيتم إرسال عملات MECO إلى محفظتك مباشرة بعد الشراء",
        buy_btn: "شراء الآن 🔥",
        alerts: {
          title_warning: "تنبيه",
          balance_low_limit: "رصيدك منخفض جداً. يجب أن يكون لديك SOL كافي للرسوم",
          title_error: "خطأ",
          invalid_amount: "الرجاء إدخال مبلغ صحيح",
          min_error: "الحد الأدنى للشراء هو {{amount}} SOL",
          max_error: "الحد الأقصى للشراء هو {{amount}} SOL",
          title_insufficient: "رصيد غير كافٍ",
          insufficient_msg: "تحتاج {{required}} SOL، رصيدك الحالي: {{balance}} SOL",
          config_error: "خطأ في إعدادات المطور: لم يتم تعيين محفظة البيع المسبق",
          private_key_error: "لم يتم العثور على المفتاح الخاص",
          title_failed: "فشلت العملية",
          generic_error: "حدث خطأ غير متوقع أثناء المعاملة"
        },
        modal: {
          title_success: "🎉 تم الشراء بنجاح!",
          instruction_title: "معلومات مهمة:",
          instruction_1: "سيتم توزيع عملات MECO بعد انتهاء فترة البيع المسبق",
          instruction_2: "يرجى الحفاظ على رسالة التحقق من المعاملة",
          verify_note: "يمكنك التحقق من المعاملة على Solscan باستخدام توقيع المعاملة",
          warning_1: "⚠️ لا يمكن استرداد SOL بعد الشراء",
          warning_2: "⚠️ المعاملات على شبكة Solana غير قابلة للاسترداد",
          team_signature: "فريق MECO",
          contact_dev: "اتصل بالمطور على تلغرام",
          close: "إغلاق"
        }
      },

      // ========== TransactionHistoryScreen.js ==========
      transaction_history: "سجل المعاملات",
      transaction_history_title: "سجل المعاملات",
      all_transactions: "جميع المعاملات",
      no_transactions_yet: "لا توجد معاملات بعد",
      your_transactions_will_appear_here: "ستظهر معاملاتك هنا",
      send_transaction: "إرسال",
      receive_transaction: "استلام",
      pending: "قيد الانتظار",
      confirmed: "مؤكد",
      failed: "فشل",
      fee: "رسوم",

      // ========== BackupScreen.js ==========
      backup_wallet: "نسخ احتياطي للمحفظة",
      backup_phrase: "نسخة احتياطية للمفاتيح",
      security_phrase: "العبارة الأمنية",
      confirm_security_phrase: "تأكيد العبارة الأمنية",
      wallet_created: "تم إنشاء المحفظة",
      keep_secret: "احفظ هذه المعلومات في مكان آمن",

      // ========== CreateWalletScreen.js و ImportWalletScreen.js ==========
      fill_fields: "يرجى ملء جميع الحقول",
      confirm_send: "تأكيد الإرسال"
    }
  },
  en: {
    translation: {
      // ========== Basic Screen Keys ==========
      welcome: 'Welcome to MECO Wallet',
      create_wallet: 'Create Wallet',
      import_wallet: 'Import Wallet',
      balance: 'Wallet Balance',
      send: 'Send',
      receive: 'Receive',
      settings: 'Settings',
      error: "Error",
      success: "Success",
      copied: "Copied",
      cancel: "Cancel",
      save: "Save",
      light: "Light",
      dark: "Dark",
      loading: 'Loading...',
      wallet: 'Wallet',
      market: 'Market',
      user_settings: 'User Settings',
      presale: "Presale",
      ok: 'OK',

      // ========== HomeScreen.js ==========
      first_arab_wallet: 'The first Arabic cryptocurrency wallet',

      // ========== WalletScreen.js ==========
      my_wallet: 'My Wallet',
      total_balance: 'Total Balance',
      copy_address: 'Copy Address',
      wallet_address_copied: 'Wallet address copied',
      send_crypto: 'Send Crypto',
      swap_title: 'Swap',
      edit_wallet_name: 'Edit Wallet Name',
      enter_wallet_name: 'Enter Wallet Name',
      market_all_coins: 'All Coins',
      loading_market_data: 'Loading market data...',

      // ========== MarketScreen.js ==========
      market_title: "Market",
      market_subtitle: "Real prices • Live updates",
      all_tokens: "All Tokens",
      solana_tokens: "Solana",
      stablecoins: "Stable",
      current_prices: "Current Prices",
      tokens_count: "{{count}} tokens",
      important_note: "Important Note",
      prices_auto_updated: "Prices are auto-updated from reliable sources",
      market_solana_tokens: "Solana Tokens",
      market_stablecoins: "Stablecoins",
      market_top_gainers: "Top Gainers",
      market_last_update: "Last update",
      market_prices_note: "Tokens marked in orange are not available for direct swapping on Solana. Data provided by CoinGecko API.",
      market_unavailable: "Unavailable",
      market_balance: "Balance",

      // ========== SettingsScreen.js ==========
      change_language: "Change Language",
      toggle_theme: "Toggle Theme",
      biometric: "Biometric Authentication",
      contact_support: "Contact Support",
      logout: "Logout",
      language: "Language",
      biometric_authentication: "Biometric Authentication",
      use_fingerprint_or_face_id: "Use fingerprint or Face ID",
      dark_mode: "Dark Mode",
      enabled: "Enabled",
      disabled: "Disabled",
      accent_color: "Accent Color",
      choose_accent_color: "Choose Accent Color",
      get_help_or_report_issues: "Get help or report issues",
      about_app: "About App",
      version_and_information: "Version and information",
      sign_out_from_wallet: "Sign out from wallet",
      secure_crypto_wallet_description: "Secure crypto wallet designed for digital currencies with multi-language support and advanced security features.",
      confirm_logout: "Confirm Logout",
      logout_confirmation_message: "Are you sure you want to logout? Local wallet keys will be deleted.",
      logout_failed: "Logout failed",
      authenticate_to_continue: "Authenticate to continue",
      authentication_successful: "Authentication successful",
      authentication_failed: "Authentication failed",
      biometric_not_available: "Biometric not available",
      biometric_not_supported_message: "Your device does not support biometric authentication or you have not set it up.",

      // ========== SendScreen.js ==========
      sendScreen: {
        title: "Send",
        subtitle: "Transfer to another wallet",
        balance: {
          available: "Available Balance",
          solForFees: "SOL Balance for Fees:"
        },
        inputs: {
          recipient: "Recipient Address",
          recipientPlaceholder: "Enter wallet address",
          amount: "Amount",
          amountPlaceholder: "Enter amount",
          maxButton: "MAX",
          minimum: "Minimum:"
        },
        fees: {
          networkFee: "Network Fee:"
        },
        buttons: {
          send: "Send",
          sending: "Sending..."
        },
        modals: {
          chooseCurrency: "Choose Currency",
          loadingBalances: "Loading balances..."
        },
        warnings: {
          inactiveAddress: "⚠️ This address may not be active",
          enterRecipient: "Enter recipient address",
          enterAmount: "Enter amount",
          availableToSend: "Available to send",
          verifyAddress: "Verify address before sending"
        },
        tokens: {
          solana: "Solana",
          mecoToken: "MECO Token",
          tetherUSD: "Tether USD",
          usdCoin: "USD Coin",
          noBalance: "No balance",
          balance: "Balance:"
        },
        alerts: {
          error: "Error",
          incompleteData: "Incomplete or invalid data for sending",
          invalidAddress: "Recipient address is invalid",
          selfTransfer: "Cannot send to the same wallet",
          amountTooSmall: "Amount is too small for sending",
          insufficientBalance: "Your balance is insufficient. Current balance:",
          insufficientSolForFees: "Insufficient SOL for fees. You need {{needed}} SOL, your balance: {{balance}} SOL",
          minimumAmount: "Minimum amount to send is {{amount}} {{currency}}",
          success: "✅ Sent successfully",
          sent: "Sent",
          to: "To:",
          fees: "📊 Fees:",
          transactionHash: "🔗",
          done: "Done",
          sendFailed: "Send failed",
          unexpectedError: "An unexpected error occurred"
        }
      },

      // ========== ReceiveScreen.js ==========
      receive_crypto: "Receive Crypto",
      your_address: "Your Address",
      share_address: "Share Address",
      qr_code: "QR Code",
      share_to_receive: "Share your address to receive funds",
      scan_to_receive: "Scan to Receive",
      qr_hint: "This QR can be scanned by any wallet",
      loading_address: "Loading address...",
      security_tips: "Security Tips",
      tip1: "Only share this address with people you trust",
      tip2: "You can receive any token on the Solana network",
      tip3: "Always verify the address before sending",
      transaction_time_note: "Transactions usually take a few seconds on Solana",
      copy_failed: "Failed to copy address",
      wallet_address: "Wallet Address",
      share_message_with_address: "My Solana wallet address: {{address}}\n\nYou can send any cryptocurrency to it.",

      // ========== PresaleScreen.js ==========
      presale_title: "MECO Presale 🚀",
      presale_exclusive_offer: "Exclusive Presale Offer",
      presale_rate: "1 SOL = 125,000 MECO",
      buy_meco: "Buy MECO",
      buy_meco_now: "Buy MECO Now",
      minimum_amount: "Minimum amount",
      maximum_amount: "Maximum amount",
      enter_sol_amount: "Enter SOL Amount",
      you_send: "You Send",
      you_receive: "You Receive",
      transaction_fee: "Transaction Fee",
      view_on_solscan: "View on Solscan",
      confirm_purchase: "Confirm Purchase",
      official_meco_token: "Official MECO Token",
      verified_on_solana: "Verified on Solana network",

      presaleScreen: {
        header_title: "MECO Presale 🚀",
        offer_title: "Exclusive Presale Offer",
        rate_label: "1 SOL = 125,000 MECO",
        min_badge: "Min: {{amount}} SOL",
        max_badge: "Max: {{amount}} SOL",
        label_you_pay: "You Pay",
        label_you_receive: "You Receive",
        your_balance: "Your Balance: {{amount}} SOL",
        fee_label: "Transaction Fee",
        note_footer: "* MECO tokens will be sent to your wallet directly after purchase",
        buy_btn: "Buy Now 🔥",
        alerts: {
          title_warning: "Warning",
          balance_low_limit: "Your balance is too low. You must have enough SOL for fees",
          title_error: "Error",
          invalid_amount: "Please enter a valid amount",
          min_error: "Minimum purchase is {{amount}} SOL",
          max_error: "Maximum purchase is {{amount}} SOL",
          title_insufficient: "Insufficient Balance",
          insufficient_msg: "You need {{required}} SOL, your current balance: {{balance}} SOL",
          config_error: "Developer config error: Presale wallet not set",
          private_key_error: "Private key not found",
          title_failed: "Transaction Failed",
          generic_error: "An unexpected error occurred during the transaction"
        },
        modal: {
          title_success: "🎉 Purchase Successful!",
          instruction_title: "Important Information:",
          instruction_1: "MECO tokens will be distributed after the presale period ends",
          instruction_2: "Please keep your transaction verification message",
          verify_note: "You can verify the transaction on Solscan using the transaction signature",
          warning_1: "⚠️ SOL cannot be refunded after purchase",
          warning_2: "⚠️ Transactions on Solana network are irreversible",
          team_signature: "MECO Team",
          contact_dev: "Contact Developer on Telegram",
          close: "Close"
        }
      },

      // ========== TransactionHistoryScreen.js ==========
      transaction_history: "Transaction History",
      transaction_history_title: "Transaction History",
      all_transactions: "All Transactions",
      no_transactions_yet: "No transactions yet",
      your_transactions_will_appear_here: "Your transactions will appear here",
      send_transaction: "Send",
      receive_transaction: "Receive",
      pending: "Pending",
      confirmed: "Confirmed",
      failed: "Failed",
      fee: "Fee",

      // ========== BackupScreen.js ==========
      backup_wallet: "Backup Wallet",
      backup_phrase: "Backup Phrase",
      security_phrase: "Security Phrase",
      confirm_security_phrase: "Confirm Security Phrase",
      wallet_created: "Wallet Created",
      keep_secret: "Keep this information in a safe place",

      // ========== CreateWalletScreen.js و ImportWalletScreen.js ==========
      fill_fields: "Please fill all fields",
      confirm_send: "Confirm Send"
    }
  }
};

// دالة بسيطة للتهيئة
const initI18n = () => {
  return i18n
    .use(initReactI18next)
    .init({
      compatibilityJSON: 'v3',
      resources,
      lng: 'ar', // اللغة العربية الافتراضية
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
      initImmediate: false,
    });
};

// تهيئة مباشرة
initI18n();

// تصدير الدوال المساعدة
export const changeLanguage = (lng) => {
  i18n.changeLanguage(lng);
  SecureStore.setItemAsync('app_language', lng);
};

export const getCurrentLanguage = () => i18n.language;

export default i18n;
