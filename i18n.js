import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';

const resources = {
  ar: {
    translation: {
      // ========== الترجمات الأصلية ==========
      welcome: 'مرحبًا بك في محفظة MECO',
      create_wallet: 'إنشاء محفظة',
      import_wallet: 'استيراد محفظة',
      balance: 'رصيد المحفظة',
      send: 'إرسال',
      receive: 'استلام',
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
      no_notifications: 'لا توجد إشعارات حالياً',
      from: 'من',
      enter_amount: 'أدخل المبلغ',
      loading: 'جارٍ التحميل...',
      amount_must_be_positive: 'يجب أن يكون المبلغ أكبر من صفر.',
      wallet: 'المحفظة',
      notifications: 'الإشعارات',
      transactions: 'سجل المعاملات',
      transaction_signature: 'التوقيع',
      status: 'الحالة',
      time: 'الزمن',
      meco: 'MECO',
      meco_title: 'حول رمز MECO',
      meco_description: 'رمز MECO هو مشروع رقمي عربي على شبكة Solana يهدف إلى تقديم تجربة مالية آمنة وسريعة. تم بناء هذا التطبيق لدعمه وتوسيع نطاق استخدامه.',
      price: 'السعر',
      telegram: 'قناة التليجرام',
      website: 'الموقع الإلكتروني',
      market: 'السوق',
      symbol: 'الرمز',
      token_name: 'اسم العملة',
      token_price: 'السعر',
      first_arab_wallet: 'أول محفظة عملات رقمية عربية',

      // ========== الترجمات المضافة ==========
      home: 'الرئيسية',
      my_wallet: 'محفظتي',
      ok: 'موافق',
      scan: 'مسح',
      total_balance: 'إجمالي الرصيد',
      your_balance: 'رصيدك',
      change_currency: 'تغيير العملة',
      no_transactions: 'لا توجد معاملات',
      no_transactions_yet: 'لا توجد معاملات بعد',
      your_transactions_will_appear_here: 'ستظهر معاملاتك هنا',
      view_all: 'عرض الكل',
      recent_transactions: 'المعاملات الأخيرة',
      copy_to_clipboard: 'نسخ إلى الحافظة',
      no_wallet: 'لا توجد محفظة',
      send_crypto: 'إرسال عملة',
      transfer_to_another_wallet: 'تحويل إلى محفظة أخرى',
      available_balance: 'الرصيد المتاح',
      enter_wallet_address: 'أدخل عنوان المحفظة',
      max: 'الحد الأقصى',
      network_fee: 'رسوم الشبكة',
      total_amount: 'المبلغ الإجمالي',
      verify_address_before_sending: 'تحقق من العنوان قبل الإرسال',
      insufficient_balance: 'رصيد غير كافٍ',
      invalid_address: 'عنوان غير صالح',
      cannot_send_to_self: 'لا يمكن الإرسال إلى نفس العنوان',
      sent_successfully: 'تم الإرسال بنجاح',
      send_failed: 'فشل الإرسال',
      solana_network: 'شبكة سولانا',
      current_price: 'السعر الحالي',
      live_data: 'بيانات مباشرة',
      loading_price: 'جاري تحميل بيانات السعر...',
      real_time_update: 'تحديث فوري',
      token_statistics: 'إحصائيات العملة',
      circulating_supply: 'العرض المتداول',
      decimals: 'الخانات العشرية',
      trading_volume_24h: 'حجم التداول (٢٤ ساعة)',
      market_cap: 'القيمة السوقية',
      official_links: 'الروابط الرسمية',
      view_on_solscan: 'عرض على سولسكان',
      detailed_token_analysis: 'تحليل مفصل للعملة',
      telegram_channel: 'قناة تلغرام',
      official_community: 'المجتمع الرسمي',
      twitter_account: 'حساب إكس (تويتر)',
      follow_for_updates: 'تابع للحصول على التحديثات',
      facebook_page: 'صفحة فيسبوك',
      connect_on_facebook: 'تواصل على فيسبوك',
      official_website: 'الموقع الرسمي',
      learn_more_about_meco: 'تعرف أكثر على مشروع MECO',
      reliable_data_source: 'مصدر بيانات موثوق',
      last_update: 'آخر تحديث',
      share_title: 'MECO على سولانا 🚀',
      share_message: 'السعر الحالي',
      solscan_link: 'رابط سولسكان',
      data_fetch_error: 'فشل تحميل البيانات. يرجى المحاولة مرة أخرى.',
      price_fetch_error: 'فشل تحميل السعر. يتم عرض بيانات احتياطية.',
      no_data_found: 'لم يتم العثور على بيانات تداول لهذه العملة.',
      not_available: 'غير متوفر',
      manage_your_wallet_preferences: 'إدارة تفضيلات محفظتك',
      wallet_settings: 'إعدادات المحفظة',
      appearance: 'المظهر',
      support: 'الدعم',
      account: 'الحساب',
      transaction_history: 'سجل المعاملات',
      view_all_transactions: 'عرض جميع المعاملات',
      language: 'اللغة',
      biometric_authentication: 'المصادقة الحيوية',
      use_fingerprint_or_face_id: 'استخدام البصمة أو Face ID',
      dark_mode: 'الوضع الداكن',
      enabled: 'مفعل',
      disabled: 'معطل',
      accent_color: 'لون التمييز',
      choose_your_theme_color: 'اختر لون سمتك',
      get_help_or_report_issues: 'احصل على مساعدة أو أبلغ عن مشاكل',
      about_app: 'عن التطبيق',
      version_and_information: 'الإصدار والمعلومات',
      sign_out_from_wallet: 'الخروج من المحفظة',
      choose_accent_color: 'اختر لون التمييز',
      color_change_applies_immediately: 'سيطبق تغيير اللون فوراً',
      secure_crypto_wallet_description: 'محفظة تشفير آمنة مصممة للعملات الرقمية مع دعم متعدد اللغات وميزات أمان متقدمة.',
      secure_and_encrypted: 'آمن ومشفر',
      fast_transactions: 'معاملات سريعة',
      multi_language_support: 'دعم متعدد اللغات',
      close: 'إغلاق',
      confirm_logout: 'تأكيد تسجيل الخروج',
      logout_confirmation_message: 'هل أنت متأكد من رغبتك في تسجيل الخروج؟ سيتم حذف مفاتيح المحفظة المحلية.',
      logout_failed: 'فشل تسجيل الخروج',
      authenticate_to_continue: 'قم بالمصادقة للمتابعة',
      authentication_successful: 'تمت المصادقة بنجاح',
      authentication_failed: 'فشلت المصادقة',
      biometric_not_available: 'المصادقة الحيوية غير متاحة',
      biometric_not_supported_message: 'جهازك لا يدعم المصادقة الحيوية أو لم تقم بإعدادها.',
      receive_crypto: 'استلام عملة',
      your_address: 'عنوانك',
      share_address: 'شارك العنوان',
      qr_code: 'كود QR',
      transaction_history_title: 'سجل المعاملات',
      all_transactions: 'جميع المعاملات',
      sent_transaction: 'معاملة مرسلة',
      received_transaction: 'معاملة مستلمة',
      pending: 'قيد الانتظار',
      confirmed: 'مؤكد',
      failed: 'فشل',
      backup_wallet: 'نسخ احتياطي للمحفظة',
      security_phrase: 'العبارة الأمنية',
      confirm_security_phrase: 'تأكيد العبارة الأمنية',
      wallet_created: 'تم إنشاء المحفظة',
      keep_secret: 'احفظ هذه المعلومات في مكان آمن',
      save_changes: 'حفظ التغييرات',

      // ========== مفاتيح البيع المسبق الجديدة ==========
      minimum_amount: "الحد الأدنى",
      maximum_amount: "الحد الأقصى",
      purchase_confirmed: "تم تأكيد الشراء",
      you_will_send: "سوف ترسل",
      you_will_receive: "سوف تستلم",
      after_verification: "بعد التحقق",
      address_copied: "تم نسخ العنوان",
      presale: "البيع المسبق",
      buy_meco: "شراء MECO",
      presale_progress: "تقدم البيع المسبق",
      sold: "تم بيع",
      remaining: "متبقي",
      enter_sol_amount: "أدخل كمية SOL",
      you_send: "ترسل",
      you_receive: "تستلم",
      presale_wallet_address: "عنوان محفظة البيع المسبق",
      verify_on_solscan: "تحقق على Solscan",
      buy_meco_now: "اشترِ MECO الآن",
      confirm_purchase: "تأكيد الشراء",
      rate: "السعر",
      send_to: "إرسال إلى",
      confirm_pay: "تأكيد ودفع",
      connect_wallet_first: "يجب توصيل المحفظة أولاً",
      invalid_presale_address: "عنوان محفظة البيع المسبق غير صالح",
      approx: "تقريباً",
      refresh: "تحديث",
      transaction_fee: "رسوم المعاملة",
      you_need: "تحتاج",
      transaction_sent: "تم إرسال المعاملة",
      signature: "التوقيع",
      processing_transaction: "جاري معالجة المعاملة",
      transaction_failed: "فشلت المعاملة",
      view_on_solscan: "عرض على سولسكان",
      connect_wallet_to_buy: "توصيل المحفظة للشراء",
      official_meco_token: "رمز MECO الرسمي",
      verified_on_solana: "تم التحقق منه على شبكة سولانا",

      // ========== مفاتيح جديدة من شاشة MECO ==========
      real_contract_active: "✅ العقد الحقيقي نشط",
      solana_network_label: "شبكة Solana",
      smart_contract_info: "معلومات العقد الذكي",
      contract_verification: "التحقق على Solscan",
      contract_status: "حالة العقد",
      contract_rate: "سعر العقد",
      price_per_sol: "1 SOL = {{rate}} MECO",
      your_balance_label: "رصيدك",
      needs_for_transaction: "يحتاج إلى {{amount}} SOL للمعاملة",
      wallet_balance_zero: "❌ رصيد محفظتك 0 SOL. أضف رصيد للشراء",
      update_balance: "تحديث",
      real_presale: "البيع المسبق الحقيقي",
      presale_price: "1 SOL = {{rate}} MECO",
      progress_label: "تقدم البيع المسبق",
      progress_percentage: "{{percentage}}%",
      sold_tokens: "مباع: {{amount}} MECO",
      remaining_tokens: "متبقي: {{amount}} MECO",
      total_supply: "إجمالي العرض: {{amount}} MECO",
      enter_sol_amount_label: "أدخل مبلغ SOL",
      sol_currency: "SOL",
      minimum_sol: "الحد الأدنى: {{amount}} SOL",
      maximum_sol: "الحد الأقصى: {{amount}} SOL",
      you_will_send_label: "سترسل:",
      transaction_fee_label: "رسوم المعاملة:",
      you_will_receive_label: "ستحصل على:",
      calculation_price: "السعر: 1 SOL = {{rate}} MECO",
      buy_button: "شراء",
      presale_paused: "البيع متوقف مؤقتاً",
      real_transactions_notice: "✅ معاملات حقيقية على شبكة Solana Devnet",
      token_stats: "إحصائيات الرمز",
      circulating_supply_label: "العرض المتداول",
      decimal_places: "المنازل العشرية",
      official_links_label: "الروابط الرسمية",
      view_on_solscan_label: "عرض على Solscan",
      token_analysis: "تحليل مفصل للرمزي",
      telegram_channel_label: "قناة تلغرام",
      official_community_label: "المجتمع الرسمي",
      twitter_account_label: "حساب تويتر",
      follow_for_updates_label: "تابع للتحديثات",
      official_website_label: "الموقع الرسمي",
      learn_more_about_meco_label: "تعرف أكثر على MECO",
      github_repository: "مستودع GitHub",
      presale_funds_transparency: "شفافية أموال البيع المسبق",
      verified_official_token: "تم التحقق على Solana • العقد الذكي الحقيقي نشط",
      transaction_confirmation: "تأكيد الشراء",
      you_will_send_amount: "سوف ترسل {{amount}} SOL",
      transaction_rate: "السعر: 1 SOL = {{rate}} MECO",
      you_will_receive_amount: "ستحصل على: {{amount}} MECO",
      contract_address_short: "العقد: {{address}}...",
      processing_transaction_label: "جاري معالجة المعاملة...",
      via_real_contract: "عبر العقد الحقيقي",
      cancel_button: "إلغاء",
      confirm_payment: "تأكيد الدفع",
      purchase_successful: "تم الشراء بنجاح",
      purchase_failed: "فشلت المعاملة",
      purchased_amount: "تم شراء: {{amount}} MECO",
      via_real_contract_full: "عبر العقد الحقيقي: {{address}}...",
      view_on_solscan_button: "عرض على سولسكان",
      transaction_success_message: "✅ تم شراء {{mecoAmount}} MECO بنجاح!\n\nتم دفع: {{solAmount}} SOL\n\nرقم المعاملة: {{txId}}...",
      wallet_not_available: "المحفظة غير متاحة. يرجى المحاولة مرة أخرى.",
      insufficient_wallet_balance: "❌ رصيد محفظتك هو 0 SOL. يرجى إضافة رصيد SOL أولاً ثم المحاولة مرة أخرى.",
      insufficient_balance_with_fee: "❌ رصيدك الحالي: {{currentBalance}} SOL\nالمبلغ المطلوب: {{requiredAmount}} SOL\n\nيرجى إضافة رصيد إضافي إلى محفظتك.",
      below_minimum: "خطأ",
      below_minimum_message: "الحد الأدنى للشراء: {{minAmount}} SOL",
      above_maximum: "خطأ",
      above_maximum_message: "الحد الأقصى للشراء: {{maxAmount}} SOL",
      contract_not_initialized: "لم يتم تهيئة العقد الذكي",
      presale_inactive: "معلق",
      presale_inactive_message: "البيع المسبق متوقف مؤقتاً",
      transaction_failed_message: "فشلت المعاملة: {{error}}",
      wallet_initialization_failed: "❌ فشل إنشاء wallet:",
      contract_initialization_error: "❌ خطأ في تهيئة العقد:",
      presale_fetch_error: "❌ خطأ في جلب بيانات البيع المسبق:",
      connection_error: "❌ خطأ في جلب بيانات البيع المسبق:",
      confirm: "تأكيد",
      close_modal: "إغلاق",
      ok_button: "موافق",
      share_token_info: "شارك معلومات الرمز",

      // ========== مفاتيح Staking الجديدة ==========
      staking: "التخزين",
      stake_meco_earn_rewards: "خزن MECO، واربح المكافآت",
      staking_active: "نشط",
      staking_inactive: "غير نشط",
      available_meco: "MECO المتاح",
      staked_meco: "MECO المخزن",
      available_rewards: "المكافآت المتاحة",
      claim_rewards: "المطالبة بالمكافآت",
      staking_returns: "عوائد التخزين",
      annual_rate: "المعدل السنوي",
      estimated_apy: "نسبة العائد السنوي المقدرة",
      estimated_daily_rewards: "المكافآت اليومية المقدرة",
      stake_meco: "تخزين MECO",
      amount_to_stake: "المبلغ للتخزين",
      min: "الحد الأدنى",
      max: "الحد الأقصى",
      available: "المتاح",
      staking_paused: "التخزين متوقف",
      stake_now: "تخزين الآن",
      unstake_meco: "إلغاء تخزين MECO",
      amount_to_unstake: "المبلغ لإلغاء التخزين",
      staked: "المخزن",
      unstake_period_notice: "يستغرق إلغاء التخزين {{days}} يومًا. خلال هذه الفترة، لن تربح أي مكافآت.",
      unstake_now: "إلغاء التخزين الآن",
      global_staking_stats: "إحصائيات التخزين العالمية",
      total_staked: "إجمالي المخزن",
      total_stakers: "إجمالي المخزنين",
      unstake_days: "أيام إلغاء التخزين",
      staking_info_title: "معلومات التخزين",
      staking_info_description: "يحصل MECO المخزن على مكافآت يومية بناءً على APR. يتطلب إلغاء التخزين فترة انتظار لمدة {{days}} يومًا لا تتراكم خلالها أي مكافآت.",
      wallet_not_available: "المحفظة غير متاحة",
      no_meco_to_stake: "ليس لديك أي MECO للتخزين",
      below_minimum_stake: "المبلغ أقل من الحد الأدنى للتخزين وهو",
      above_maximum_stake: "المبلغ أعلى من الحد الأقصى للتخزين وهو",
      insufficient_meco_balance: "رصيد MECO غير كافٍ",
      current_balance: "الرصيد الحالي",
      required_amount: "المبلغ المطلوب",
      staking_inactive_message: "التخزين غير نشط حاليًا. يرجى المحاولة مرة أخرى لاحقًا.",
      wallet_not_connected: "المحفظة غير متصلة",
      staking_successful: "تم التخزين بنجاح",
      staking_success_message: "تم تخزين MECO الخاص بك بنجاح!",
      amount_staked: "المبلغ المخزن",
      transaction_id: "معرف المعاملة",
      view_on_solscan: "عرض على سولسكان",
      ok: "موافق",
      staking_failed: "فشل التخزين",
      staking_failed_message: "فشل تخزين MECO. يرجى المحاولة مرة أخرى.",
      no_staked_meco: "ليس لديك أي MECO مخزن",
      unstake_minimum: "الحد الأدنى لإلغاء التخزين هو 1 MECO",
      insufficient_staked_balance: "رصيد مخزن غير كافٍ",
      current_staked: "المخزن حاليًا",
      requested_amount: "المبلغ المطلوب",
      unstake_warning_title: "تحذير إلغاء التخزين",
      unstake_warning_message: "يتطلب إلغاء التخزين فترة انتظار لمدة {{days}} يومًا. خلال هذه الفترة، لن تربح أي مكافآت. هل أنت متأكد من المتابعة؟",
      cancel: "إلغاء",
      confirm_unstake: "تأكيد إلغاء التخزين",
      unstaking_successful: "تم إلغاء التخزين بنجاح",
      unstaking_success_message: "تم تقديم طلب إلغاء التخزين بنجاح!",
      amount_unstaked: "المبلغ الملغي",
      unlock_date: "تاريخ الإلغاء",
      unstaking_failed: "فشل إلغاء التخزين",
      unstaking_failed_message: "فشل إلغاء تخزين MECO. يرجى المحاولة مرة أخرى.",
      no_rewards_to_claim: "لا توجد مكافآت للمطالبة بها",
      claim_rewards_failed: "فشل المطالبة بالمكافآت",
      rewards_claimed_success: "تمت المطالبة بالمكافآت بنجاح",
      amount_claimed: "المبلغ المطالب به",
      confirm_staking: "تأكيد التخزين",
      amount_staked_modal: "المخزن: {{amount}} MECO",
      you_will_stake_amount: "ستقوم بتخزين {{amount}} MECO",
      apr: "نسبة العائد السنوية",
      unstake_period: "فترة إلغاء التخزين",
      days: "أيام",
      processing_staking: "جاري معالجة معاملة التخزين...",
      confirm_stake: "تأكيد التخزين",
      confirm_unstaking: "تأكيد إلغاء التخزين",
      amount_unstaked_modal: "المبلغ الملغي: {{amount}} MECO",
      unlock_date_modal: "تاريخ الإلغاء: {{date}}",
      you_will_unstake_amount: "ستقوم بإلغاء تخزين {{amount}} MECO",
      estimated_unlock_date: "تاريخ الإلغاء المقدر",
      during_unstaking_period: "خلال فترة إلغاء التخزين",
      no_rewards_earned: "لا توجد مكافآت مكتسبة",
      processing_unstaking: "جاري معالجة معاملة إلغاء التخزين...",
      info: "معلومات",
      success: "نجاح",

      // ========== مفاتيح إضافية من مفاتيح Staking القديمة ==========
      stake_title: "استثمار MECO",
      stake_subtitle: "اكسب دخل سلبي ودعم شبكة MECO",
      annual_percentage_rate: "النسبة السنوية",
      apr_description: "أعلى من معظم البنوك التقليدية",
      staking_wallet: "محفظة الاستثمار",
      accumulated_rewards: "المكافآت المتراكمة",
      available_meco_balance: "رصيد MECO المتاح",
      connected_to_smart_contract: "متصل بالعقد الذكي",
      stake_button: "استثمار",
      unstake_button: "سحب",
      estimated_rewards: "المكافآت المتوقعة",
      daily: "يوميًا",
      monthly: "شهريًا",
      yearly: "سنويًا",
      important_notes: "ملاحظات هامة",
      rewards_distributed_daily: "يتم توزيع المكافآت يومياً تلقائياً",
      minimum_stake_amount: "الحد الأدنى للاستثمار: {{amount}} MECO",
      unstake_waiting_period: "فترة انتظار السحب: {{days}} أيام",
      need_sol_for_fees: "تحتاج SOL لرسوم المعاملات",
      rates_may_change: "قد تتغير الأسعار بناءً على ظروف الشبكة",
      test_connection: "اختبار الاتصال",
      using_demo_mode: "استخدام وضع التجربة. قم بتوصيل المحفظة للمعاملات الحقيقية.",
      connect_wallet_real_transactions: "توصيل المحفظة للمعاملات الحقيقية",
      loading_staking_data: "جاري تحميل بيانات الاستثمار...",
      confirm_stake_title: "تأكيد الاستثمار",
      confirm_stake_message: "استثمار {{amount}} MECO بنسبة {{apr}}% سنوية؟",
      insufficient_sol_for_fee: "رصيد SOL غير كافٍ لرسوم المعاملة",
      stake_transaction_failed: "فشل معاملة الاستثمار",
      stake_success: "تم استثمار {{amount}} MECO بنجاح!\nالمعاملة: {{tx}}...",
      confirm_unstake_title: "تأكيد السحب",
      confirm_unstake_message: "سحب {{amount}} MECO؟\n\nملاحظة: الأموال ستكون متاحة بعد {{days}} أيام",
      amount_exceeds_staked: "المبلغ يتجاوز الرصيد المستثمر",
      unstake_period_not_passed: "فترة السحب لم تمر بعد (مطلوب {{days}} أيام)",
      unstake_transaction_failed: "فشل معاملة السحب",
      unstake_success: "تم طلب سحب {{amount}} MECO!\nستستلمها خلال {{days}} أيام\nالمعاملة: {{tx}}...",
      claim_rewards_title: "المطالبة بالمكافآت",
      claim_rewards_message: "المطالبة بـ {{amount}} MECO مكافآت؟",
      claim_transaction_failed: "فشل معاملة المطالبة",
      claim_success: "تم المطالبة بـ {{amount}} MECO بنجاح!\nالمعاملة: {{tx}}...",
      stake_modal_title: "استثمار MECO",
      stake_modal_description: "أدخل كمية MECO التي تريد استثمارها",
      unstake_modal_title: "سحب MECO",
      unstake_modal_description: "أدخل كمية MECO التي تريد سحبها",
      unstake_warning: "ملاحظة: الأموال ستكون متاحة بعد {{days}} أيام",
      confirm_stake_button: "تأكيد الاستثمار",
      confirm_unstake_button: "تأكيد السحب",
      start_staking: "🚀 ابدأ الاستثمار",
      get_meco_first: "🔄 احصل على MECO أولاً",
      wallet_not_connected_short: "🔗 المحفظة غير متصلة",
      no_funds_staked: "💼 لا توجد أموال مستثمرة",
      claim_rewards_info: "🎁 المطالبة بالمكافآت",
      no_rewards_available: "⏳ لا توجد مكافآت متاحة",
      real_transactions_active: "✅ معاملات حقيقية على Solana",
      staking_instructions: "لبدء الاستثمار في MECO، يرجى توصيل محفظتك أولاً.\n\n1. تأكد من أن لديك محفظة نشطة\n2. احصل على رصيد MECO للاستثمار\n3. ابدأ برحلة الاستثمار وحقق أرباحاً يومية",
      get_meco_instructions: "لا تملك رصيداً من MECO للاستثمار.\n\nللحصول على MECO:\n1. انتقل إلى شاشة MECO\n2. اشترِ MECO من البيع المسبق\n3. عد إلى هذه الشاشة لبدء الاستثمار\n\nيمكنك شراء MECO بسعر مخفض من البيع المسبق!",
      wallet_connection_instructions: "يجب توصيل محفظتك أولاً لسحب الأموال.\n\n1. تأكد من أن محفظتك متصلة\n2. تحقق من اتصالك بشبكة Solana\n3. حاول مرة أخرى",
      no_staked_funds_instructions: "لم تقم باستثمار أي أموال حتى الآن.\n\nللسحب، يجب أن:\n1. تستثمر MECO أولاً\n2. تنتظر فترة الاستثمار\n3. ثم يمكنك سحب أموالك\n\nابدأ الاستثمار الآن لتحقيق أرباح يومية!",
      claim_rewards_instructions: "توصيل المحفظة مطلوب للمطالبة بالمكافآت.\n\n1. قم بتوصيل محفظتك\n2. تأكد من اتصال العقد الذكي\n3. حاول مرة أخرى",
      no_rewards_instructions: "ليس لديك مكافآت جادة للمطالبة حالياً.\n\nلتراكم المكافآت:\n1. استثمر MECO أولاً\n2. انتظر لتراكم المكافآت اليومية\n3. المكافآت تتراكم تلقائياً مع الوقت\n\nيمكنك المطالبة بالمكافآت عندما تصل إلى الحد الأدنى",
      rewards_claim_info: "لديك {{rewards}} MECO مكافآت متاحة.\n\nفي العقد الحالي، المكافآت تُحول تلقائياً عند إلغاء التثبيت (Unstake).\n\nلتحصيل مكافآتك:\n1. قم بإلغاء تثبيت جزء من أموالك\n2. ستحصل على أموالك + المكافآت المتراكمة\n3. يمكنك استثمارها مرة أخرى لزيادة الأرباح",
      smart_contract_connected: "العقد الذكي متصل",
      connection_successful: "✅ اتصال ناجح",
      contract_address: "عنوان العقد",
      contract_active_available: "العقد الذكي نشط ومتوفر على:\n{{address}}...\n\nإصدار Solana: {{version}}",

      // ========== مفاتيح Market ==========
      market_title: "سوق العملات",
      market_subtitle: "أسعار حقيقية • تحديث مباشر",
      all_tokens: "جميع العملات",
      solana_tokens: "سولانا",
      stablecoins: "مستقرة",
      gainers: "الأعلى ربحاً",
      trending: "رائجة",
      current_prices: "الأسعار الحالية",
      tokens_count: "{{count}} عملة",
      loading_market_data: "جاري تحميل بيانات السوق...",
      important_note: "ملاحظة هامة",
      prices_auto_updated: "الأسعار يتم تحديثها تلقائياً من مصادر موثوقة",
      meco_price_note: "MECO: ${{price}}",

      // ========== مفاتيح SendScreen الجديدة ==========
      fee_details: "تفاصيل الرسوم",
      network_fee: "رسوم الشبكة",
      service_fee: "رسوم الخدمة",
      total_fees: "إجمالي الرسوم",
      dynamic_based_on_congestion: "(متحركة حسب الازدحام)",
      for_developer_support: "(10% للمطور لدعم التطبيق)",
      fee_developer_notice: "10% من رسوم الشبكة تذهب لدعم تطوير وصيانة التطبيق",
      no_balance: "لا رصيد",
      balance: "رصيد",
      loading_tokens: "جاري تحميل العملات...",
      total: "الإجمالي",

      // ========== مفاتيح ReceiveScreen الجديدة ==========
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

      // ========== مفاتيح TransactionHistoryScreen الجديدة ==========
      swap_transaction: "تبادل",
      stake_transaction: "استثمار",
      send_transaction: "إرسال",
      receive_transaction: "استلام",
      onchain_transaction: "معاملة سلسلة",
      transaction: "معاملة",
      transaction_history_title: "سجل المعاملات",
      all_transactions: "جميع المعاملات",
      transactions: "معاملة",
      no_transactions_yet: "لا توجد معاملات بعد",
      your_transactions_will_appear_here: "ستظهر معاملاتك هنا",
      fee: "رسوم",
      network_fee: "رسوم الشبكة",
      confirmed: "مؤكد",
      pending: "قيد الانتظار",
      failed: "فشل",
      unknown: "غير معروف",

      // ========== مفاتيح إضافية من كود StakingScreen المعدل ==========
      wallet_private_key_missing: "مفتاح المحفظة الخاص مفقود",
      private_key_conversion_failed: "فشل تحويل المفتاح الخاص",
      wallet_creation_failed: "فشل إنشاء المحفظة",
      starting_solana_connection: "بدء اتصال Solana",
      wallet_not_connected_readonly: "المحفظة غير متصلة، سيتم استخدام وضع القراءة فقط",
      wallet_creation_failed_readonly: "فشل إنشاء المحفظة، سيتم استخدام وضع القراءة فقط",
      program_instance_ready: "تم تهيئة برنامج العقد الذكي",
      loading_real_staking_data: "جاري تحميل بيانات الاستثمار الحقيقية",
      no_wallet_address: "لا يوجد عنوان محفظة",
      real_meco_balance: "رصيد MECO الحقيقي",
      failed_to_get_meco_balance: "فشل الحصول على رصيد MECO",
      real_staked_amount: "المبلغ المستثمر الحقيقي",
      calculated_rewards: "المكافآت المحسوبة",
      no_staking_account_found: "لم يتم العثور على حساب استثمار",
      load_data_error: "خطأ في تحميل البيانات",
      loading_readonly_data: "جاري تحميل بيانات القراءة فقط",
      readonly_mode_error: "خطأ في وضع القراءة فقط",
      wallet_program_initialization_failed: "فشل تهيئة برنامج المحفظة",
      sending_real_stake_transaction: "إرسال معاملة استثمار حقيقية",
      stake_transaction_sent: "تم إرسال معاملة الاستثمار",
      stake_transaction_confirmed: "تم تأكيد معاملة الاستثمار",
      stake_transaction_error: "خطأ في معاملة الاستثمار",
      stake_transaction_failed_message: "فشل معاملة الاستثمار: {{error}}",
      sending_real_unstake_transaction: "إرسال معاملة سحب حقيقية",
      unstake_transaction_sent: "تم إرسال معاملة السحب",
      unstake_transaction_confirmed: "تم تأكيد معاملة السحب",
      unstake_transaction_error: "خطأ في معاملة السحب",
      unstake_available_in: "السحب متاح خلال {{time}}",
      connection_failed: "❌ خطأ في الاتصال",
      contract_not_available: "العقد غير متوفر",
      contract_loading: "جاري تحميل العقد...",
      smart_contract_available: "العقد الذكي متوفر",
      stake_success_no_tx: "تم استثمار {{amount}} MECO بنجاح!",
      unstake_success_no_tx: "تم طلب سحب {{amount}} MECO بنجاح!\nستستلمها خلال {{days}} أيام",
      rewards_claimed_success: "تم المطالبة بـ {{rewards}} MECO بنجاح!\nالمعاملة: {{tx}}...",
      rewards_claimed_success_no_tx: "تم المطالبة بـ {{rewards}} MECO بنجاح!",
      claim_rewards_failed: "فشل المطالبة بالمكافآت",

      // ========== مفاتيح جديدة من شاشة MECO التي أرسلتها ==========
      TITLE: "موني كوين",
      SYMBOL: "ميكو",
      LIVE: "مباشر",
      ACTIVE: "نشط ✅",
      INACTIVE: "غير نشط ❌",
      BUY_NOW: "اشتري الآن",
      CONFIRM_PAYMENT: "تأكيد الدفع",
      CANCEL: "إلغاء",
      CLOSE: "إغلاق",
      REFRESH: "تحديث",
      CONTINUE: "متابعة",
      VIEW_ON_SOLSCAN: "عرض على سولسكان",
      VERIFY_ON_SOLSCAN: "التحقق على سولسكان",
      SECURITY_CHECK: "فحص الأمان",
      COPY: "تم النسخ",
      SHARE: "مشاركة",
      SMART_CONTRACT_INFO: "معلومات العقد الذكي",
      YOUR_BALANCE: "رصيدك",
      PURCHASE_MECO: "شراء ميكو",
      EXCLUSIVE_PRESALE: "بيع مسبق حصري",
      PRESALE_PROGRESS: "تقدم البيع المسبق",
      ENTER_SOL_AMOUNT: "أدخل مبلغ SOL",
      TOKEN_STATISTICS: "إحصائيات التوكن",
      OFFICIAL_LINKS: "الروابط الرسمية",
      PURCHASE_CONFIRMATION: "تأكيد الشراء",
      SOLD: "مباع:",
      REMAINING: "متبقي:",
      TOTAL: "المجموع",
      MINIMUM: "الحد الأدنى",
      MAXIMUM: "الحد الأقصى",
      YOU_WILL_SEND: "سترسل",
      TRANSACTION_FEE: "رسوم المعاملة",
      YOU_WILL_RECEIVE: "ستستلم",
      PURCHASE_PRICE: "سعر الشراء",
      VIA_SMART_CONTRACT: "عبر العقد الذكي:",
      SUCCESS: "نجاح!",
      FAILURE: "فشل",
      PURCHASE_SUCCESSFUL: "تم الشراء بنجاح!",
      YOU_RECEIVED: "🎉 لقد استلمت",
      YOU_SENT: "🪙 أرسلت",
      LOADING_DATA: "جاري تحميل البيانات...",
      PROCESSING_TRANSACTION: "جاري معالجة المعاملة...",
      PRESALE_PAUSED: "البيع المسبق متوقف",
      DEVNET: "شبكة التطوير",
      SMART_CONTRACT: "عقد ذكي",
      SECURE_TRANSACTION: "معاملة آمنة عبر العقد الذكي • غير قابلة للاسترجاع • تحقق على سولسكان",
      MECO_OFFICIAL_TOKEN: "ميكو - التوكن الرسمي",
      SECURE_SMART_CONTRACT: "عقد ذكي آمن • قابل للتحقق • مدعوم بسولانا",
      TOKEN_ANALYSIS: "تحليل التوكن والمعاملات",
      OFFICIAL_COMMUNITY: "المجتمع الرسمي",
      FOLLOW_FOR_NEWS: "تابعنا للأخبار",
      LEARN_ABOUT_MECO: "تعرف على ميكو",
      SOURCE_CODE: "الكود المصدري",
      WALLET_ADDRESSES: "عناوين المحافظ",
      PROJECT_MANAGEMENT_WALLET: "محفظة إدارة المشروع",
      PRESALE_TREASURY: "خزينة البيع المسبق",
      SMART_CONTRACT_PROGRAM: "العقد الذكي (البرنامج)",
      MECO_TOKEN: "توكن ميكو",
      ERROR: "خطأ",
      CANNOT_OPEN_LINK: "لا يمكن فتح هذا الرابط",
      ERROR_OCCURRED: "حدث خطأ أثناء فتح الرابط",
      WALLET_NOT_CONNECTED: "المحفظة غير موصولة",
      MINIMUM_AMOUNT: "الحد الأدنى هو",
      MAXIMUM_AMOUNT: "الحد الأقصى هو",
      INSUFFICIENT_BALANCE: "رصيد غير كافٍ",
      YOU_NEED: "تحتاج",
      INCLUDING_FEES: "بما في ذلك الرسوم",
      YOUR_CURRENT_BALANCE: "رصيدك الحالي",
      PRESALE_INACTIVE: "البيع المسبق غير نشط",
      PRESALE_CURRENTLY_INACTIVE: "البيع المسبق غير نشط حاليًا",
      SUCCESSFULLY_PURCHASED: "تم الشراء بنجاح",
      TRANSACTION_FAILED: "فشلت المعاملة",
      INSUFFICIENT_BALANCE_TRANSACTION: "رصيد غير كافٍ للمعاملة",
      TRANSACTION_REJECTED: "تم رفض المعاملة من المستخدم",
      TRANSACTION_TIMEOUT: "انتهت مهلة المعاملة، يرجى المحاولة مرة أخرى",
      BLOCKHASH_EXPIRED: "انتهت صلاحية البلوك هاش، يرجى المحاولة مرة أخرى",
      PLEASE_WAIT: "يرجى الانتظار",
      PLEASE_WAIT_SECONDS: "يرجى الانتظار {{time}} ثانية بين المعاملات",
      MONYCOIN_MECO_TOKEN: "توكن موني كوين (ميكو)",
      CONTRACT: "العقد:",
      PRESALE_RATE: "البيع المسبق:",
      MECO_PER_SOL: "ميكو لكل SOL",
      WEBSITE: "الموقع:",
      SOL: "سول",
      MECO_TOKEN_NAME: "ميكو",
      SUFFICIENT_FOR_PURCHASE: "✅ كافي للشراء (المطلوب:",
      INSUFFICIENT_FOR_PURCHASE: "❌ غير كافٍ للشراء (المطلوب:"
    }
  },
  en: {
    translation: {
      // ========== Original Translations ==========
      welcome: 'Welcome to MECO Wallet',
      create_wallet: 'Create Wallet',
      import_wallet: 'Import Wallet',
      balance: 'Wallet Balance',
      send: 'Send',
      receive: 'Receive',
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
      no_notifications: 'No notifications at the moment',
      from: 'From',
      enter_amount: 'Enter Amount',
      loading: 'Loading...',
      amount_must_be_positive: 'Amount must be greater than zero.',
      wallet: 'Wallet',
      notifications: 'Notifications',
      transactions: 'Transactions',
      transaction_signature: 'Signature',
      status: 'Status',
      time: 'Time',
      meco: 'MECO',
      meco_title: 'About MECO Token',
      meco_description: 'MECO Token is an Arabic digital asset built on the Solana blockchain aiming to provide a secure and fast financial experience. This app was created to support and grow its ecosystem.',
      price: 'Price',
      telegram: 'Telegram Channel',
      website: 'Official Website',
      market: 'Market',
      symbol: 'Symbol',
      token_name: 'Token Name',
      token_price: 'Price',
      first_arab_wallet: 'The first Arabic cryptocurrency wallet',

      // ========== Added Translations ==========
      home: 'Home',
      my_wallet: 'My Wallet',
      ok: 'OK',
      scan: 'Scan',
      total_balance: 'Total Balance',
      your_balance: 'Your Balance',
      change_currency: 'Change Currency',
      no_transactions: 'No transactions',
      no_transactions_yet: 'No transactions yet',
      your_transactions_will_appear_here: 'Your transactions will appear here',
      view_all: 'View All',
      recent_transactions: 'Recent Transactions',
      copy_to_clipboard: 'Copy to clipboard',
      no_wallet: 'No Wallet',
      send_crypto: 'Send Crypto',
      transfer_to_another_wallet: 'Transfer to another wallet',
      available_balance: 'Available Balance',
      enter_wallet_address: 'Enter wallet address',
      max: 'MAX',
      network_fee: 'Network Fee',
      total_amount: 'Total Amount',
      verify_address_before_sending: 'Verify address before sending',
      insufficient_balance: 'Insufficient balance',
      invalid_address: 'Invalid address',
      cannot_send_to_self: 'Cannot send to yourself',
      sent_successfully: 'Sent successfully',
      send_failed: 'Send failed',
      solana_network: 'Solana Network',
      current_price: 'Current Price',
      live_data: 'Live Data',
      loading_price: 'Loading price data...',
      real_time_update: 'Real-time update',
      token_statistics: 'Token Statistics',
      circulating_supply: 'Circulating Supply',
      decimals: 'Decimals',
      trading_volume_24h: 'Trading Volume (24h)',
      market_cap: 'Market Cap',
      official_links: 'Official Links',
      view_on_solscan: 'View on Solscan',
      detailed_token_analysis: 'Detailed token analysis',
      telegram_channel: 'Telegram Channel',
      official_community: 'Official community',
      twitter_account: 'X (Twitter) Account',
      follow_for_updates: 'Follow for updates',
      facebook_page: 'Facebook Page',
      connect_on_facebook: 'Connect on Facebook',
      official_website: 'Official Website',
      learn_more_about_meco: 'Learn more about MECO project',
      reliable_data_source: 'Reliable data source',
      last_update: 'Last update',
      share_title: 'MECO Token on Solana 🚀',
      share_message: 'Current price',
      solscan_link: 'Solscan link',
      data_fetch_error: 'Failed to fetch data. Please try again.',
      price_fetch_error: 'Failed to fetch price. Showing fallback data.',
      no_data_found: 'No trading data found for this token.',
      not_available: 'N/A',
      manage_your_wallet_preferences: 'Manage your wallet preferences',
      wallet_settings: 'Wallet Settings',
      appearance: 'Appearance',
      support: 'Support',
      account: 'Account',
      transaction_history: 'Transaction History',
      view_all_transactions: 'View all transactions',
      language: 'Language',
      biometric_authentication: 'Biometric Authentication',
      use_fingerprint_or_face_id: 'Use fingerprint or Face ID',
      dark_mode: 'Dark Mode',
      enabled: 'Enabled',
      disabled: 'Disabled',
      accent_color: 'Accent Color',
      choose_your_theme_color: 'Choose your theme color',
      get_help_or_report_issues: 'Get help or report issues',
      about_app: 'About App',
      version_and_information: 'Version and information',
      sign_out_from_wallet: 'Sign out from wallet',
      choose_accent_color: 'Choose Accent Color',
      color_change_applies_immediately: 'Color change applies immediately',
      secure_crypto_wallet_description: 'Secure crypto wallet designed for digital currencies with multi-language support and advanced security features.',
      secure_and_encrypted: 'Secure and encrypted',
      fast_transactions: 'Fast transactions',
      multi_language_support: 'Multi-language support',
      close: 'Close',
      confirm_logout: 'Confirm Logout',
      logout_confirmation_message: 'Are you sure you want to logout? Local wallet keys will be deleted.',
      logout_failed: 'Logout failed',
      authenticate_to_continue: 'Authenticate to continue',
      authentication_successful: 'Authentication successful',
      authentication_failed: 'Authentication failed',
      biometric_not_available: 'Biometric not available',
      biometric_not_supported_message: 'Your device does not support biometric authentication or you have not set it up.',
      receive_crypto: 'Receive Crypto',
      your_address: 'Your Address',
      share_address: 'Share Address',
      qr_code: 'QR Code',
      transaction_history_title: 'Transaction History',
      all_transactions: 'All Transactions',
      sent_transaction: 'Sent Transaction',
      received_transaction: 'Received Transaction',
      pending: 'Pending',
      confirmed: 'Confirmed',
      failed: 'Failed',
      backup_wallet: 'Backup Wallet',
      security_phrase: 'Security Phrase',
      confirm_security_phrase: 'Confirm Security Phrase',
      wallet_created: 'Wallet Created',
      keep_secret: 'Keep this information in a safe place',
      save_changes: 'Save Changes',

      // ========== New Presale Keys ==========
      minimum_amount: "Minimum amount",
      maximum_amount: "Maximum amount",
      purchase_confirmed: "Purchase Confirmed",
      you_will_send: "You will send",
      you_will_receive: "You will receive",
      after_verification: "after verification",
      address_copied: "Address copied",
      presale: "Presale",
      buy_meco: "Buy MECO",
      presale_progress: "Presale Progress",
      sold: "Sold",
      remaining: "Remaining",
      enter_sol_amount: "Enter SOL Amount",
      you_send: "You Send",
      you_receive: "You Receive",
      presale_wallet_address: "Presale Wallet Address",
      verify_on_solscan: "Verify on Solscan",
      buy_meco_now: "Buy MECO Now",
      confirm_purchase: "Confirm Purchase",
      rate: "Rate",
      send_to: "Send to",
      confirm_pay: "Confirm & Pay",
      connect_wallet_first: "Please connect wallet first",
      invalid_presale_address: "Invalid presale wallet address",
      approx: "Approx",
      refresh: "Refresh",
      transaction_fee: "Transaction Fee",
      you_need: "You need",
      transaction_sent: "Transaction sent",
      signature: "Signature",
      processing_transaction: "Processing transaction",
      transaction_failed: "Transaction failed",
      view_on_solscan: "View on Solscan",
      connect_wallet_to_buy: "Connect wallet to buy",
      official_meco_token: "Official MECO Token",
      verified_on_solana: "Verified on Solana network",

      // ========== New Keys from MECO Screen ==========
      real_contract_active: "✅ Real Contract Active",
      solana_network_label: "Solana Network",
      smart_contract_info: "Smart Contract Information",
      contract_verification: "Verify on Solscan",
      contract_status: "Contract Status",
      contract_rate: "Contract Rate",
      price_per_sol: "1 SOL = {{rate}} MECO",
      your_balance_label: "Your Balance",
      needs_for_transaction: "Needs {{amount}} SOL for transaction",
      wallet_balance_zero: "❌ Your wallet balance is 0 SOL. Add balance to purchase",
      update_balance: "Refresh",
      real_presale: "Real Presale",
      presale_price: "1 SOL = {{rate}} MECO",
      progress_label: "Presale Progress",
      progress_percentage: "{{percentage}}%",
      sold_tokens: "Sold: {{amount}} MECO",
      remaining_tokens: "Remaining: {{amount}} MECO",
      total_supply: "Total Supply: {{amount}} MECO",
      enter_sol_amount_label: "Enter SOL Amount",
      sol_currency: "SOL",
      minimum_sol: "Minimum: {{amount}} SOL",
      maximum_sol: "Maximum: {{amount}} SOL",
      you_will_send_label: "You will send:",
      transaction_fee_label: "Transaction Fee:",
      you_will_receive_label: "You will receive:",
      calculation_price: "Price: 1 SOL = {{rate}} MECO",
      buy_button: "Buy",
      presale_paused: "Presale Paused",
      real_transactions_notice: "✅ Real transactions on Solana Devnet",
      token_stats: "Token Statistics",
      circulating_supply_label: "Circulating Supply",
      decimal_places: "Decimal Places",
      official_links_label: "Official Links",
      view_on_solscan_label: "View on Solscan",
      token_analysis: "Detailed Token Analysis",
      telegram_channel_label: "Telegram Channel",
      official_community_label: "Official Community",
      twitter_account_label: "Twitter Account",
      follow_for_updates_label: "Follow for Updates",
      official_website_label: "Official Website",
      learn_more_about_meco_label: "Learn more about MECO",
      github_repository: "GitHub Repository",
      presale_funds_transparency: "Presale Funds Transparency",
      verified_official_token: "Verified on Solana • Real Smart Contract Active",
      transaction_confirmation: "Confirm Purchase",
      you_will_send_amount: "You will send {{amount}} SOL",
      transaction_rate: "Price: 1 SOL = {{rate}} MECO",
      you_will_receive_amount: "You will receive: {{amount}} MECO",
      contract_address_short: "Contract: {{address}}...",
      processing_transaction_label: "Processing transaction...",
      via_real_contract: "Via Real Contract",
      cancel_button: "Cancel",
      confirm_payment: "Confirm Payment",
      purchase_successful: "Purchase Successful",
      purchase_failed: "Transaction Failed",
      purchased_amount: "Purchased: {{amount}} MECO",
      via_real_contract_full: "Via Real Contract: {{address}}...",
      view_on_solscan_button: "View on Solscan",
      transaction_success_message: "✅ Purchased {{mecoAmount}} MECO successfully!\n\nPaid: {{solAmount}} SOL\n\nTransaction ID: {{txId}}...",
      wallet_not_available: "Wallet not available. Please try again.",
      insufficient_wallet_balance: "❌ Your wallet balance is 0 SOL. Please add SOL balance first then try again.",
      insufficient_balance_with_fee: "❌ Your current balance: {{currentBalance}} SOL\nRequired amount: {{requiredAmount}} SOL\n\nPlease add additional balance to your wallet.",
      below_minimum: "Error",
      below_minimum_message: "Minimum purchase: {{minAmount}} SOL",
      above_maximum: "Error",
      above_maximum_message: "Maximum purchase: {{maxAmount}} SOL",
      contract_not_initialized: "Smart contract not initialized",
      presale_inactive: "Paused",
      presale_inactive_message: "Presale is temporarily suspended",
      transaction_failed_message: "Transaction failed: {{error}}",
      wallet_initialization_failed: "❌ Failed to create wallet:",
      contract_initialization_error: "❌ Error initializing contract:",
      presale_fetch_error: "❌ Error fetching presale data:",
      connection_error: "❌ Error fetching presale data:",
      confirm: "Confirm",
      close_modal: "Close",
      ok_button: "OK",
      share_token_info: "Share Token Info",

      // ========== New Staking Keys ==========
      staking: "Staking",
      stake_meco_earn_rewards: "Stake MECO, Earn Rewards",
      staking_active: "Active",
      staking_inactive: "Inactive",
      available_meco: "Available MECO",
      staked_meco: "Staked MECO",
      available_rewards: "Available Rewards",
      claim_rewards: "Claim Rewards",
      staking_returns: "Staking Returns",
      annual_rate: "Annual Rate",
      estimated_apy: "Estimated APY",
      estimated_daily_rewards: "Estimated Daily Rewards",
      stake_meco: "Stake MECO",
      amount_to_stake: "Amount to Stake",
      min: "Min",
      max: "Max",
      available: "Available",
      staking_paused: "Staking Paused",
      stake_now: "Stake Now",
      unstake_meco: "Unstake MECO",
      amount_to_unstake: "Amount to Unstake",
      staked: "Staked",
      unstake_period_notice: "Unstaking takes {{days}} days. During this period, no rewards will be earned.",
      unstake_now: "Unstake Now",
      global_staking_stats: "Global Staking Stats",
      total_staked: "Total Staked",
      total_stakers: "Total Stakers",
      unstake_days: "Unstake Days",
      staking_info_title: "Staking Information",
      staking_info_description: "Staked MECO earns daily rewards based on APR. Unstaking requires a waiting period of {{days}} days during which no rewards are earned.",
      wallet_not_available: "Wallet not available",
      no_meco_to_stake: "You don't have any MECO to stake",
      below_minimum_stake: "Amount is below minimum stake of",
      above_maximum_stake: "Amount is above maximum stake of",
      insufficient_meco_balance: "Insufficient MECO balance",
      current_balance: "Current Balance",
      required_amount: "Required Amount",
      staking_inactive_message: "Staking is currently inactive. Please try again later.",
      wallet_not_connected: "Wallet not connected",
      staking_successful: "Staking Successful",
      staking_success_message: "Your MECO has been successfully staked!",
      amount_staked: "Amount Staked",
      transaction_id: "Transaction ID",
      view_on_solscan: "View on Solscan",
      ok: "OK",
      staking_failed: "Staking Failed",
      staking_failed_message: "Failed to stake MECO. Please try again.",
      no_staked_meco: "You don't have any staked MECO",
      unstake_minimum: "Minimum unstake amount is 1 MECO",
      insufficient_staked_balance: "Insufficient staked balance",
      current_staked: "Currently Staked",
      requested_amount: "Requested Amount",
      unstake_warning_title: "Unstake Warning",
      unstake_warning_message: "Unstaking requires {{days}} days waiting period. During this period, you will not earn any rewards. Are you sure you want to proceed?",
      cancel: "Cancel",
      confirm_unstake: "Confirm Unstake",
      unstaking_successful: "Unstaking Successful",
      unstaking_success_message: "Your unstaking request has been submitted successfully!",
      amount_unstaked: "Amount Unstaked",
      unlock_date: "Unlock Date",
      unstaking_failed: "Unstaking Failed",
      unstaking_failed_message: "Failed to unstake MECO. Please try again.",
      no_rewards_to_claim: "No rewards available to claim",
      claim_rewards_failed: "Failed to claim rewards",
      rewards_claimed_success: "Rewards Claimed Successfully",
      amount_claimed: "Amount Claimed",
      confirm_staking: "Confirm Staking",
      amount_staked_modal: "Staked: {{amount}} MECO",
      you_will_stake_amount: "You will stake {{amount}} MECO",
      apr: "APR",
      unstake_period: "Unstake Period",
      days: "days",
      processing_staking: "Processing staking transaction...",
      confirm_stake: "Confirm Stake",
      confirm_unstaking: "Confirm Unstaking",
      amount_unstaked_modal: "Unstaked: {{amount}} MECO",
      unlock_date_modal: "Unlock Date: {{date}}",
      you_will_unstake_amount: "You will unstake {{amount}} MECO",
      estimated_unlock_date: "Estimated Unlock Date",
      during_unstaking_period: "During Unstaking Period",
      no_rewards_earned: "No rewards earned",
      processing_unstaking: "Processing unstaking transaction...",
      info: "Information",
      success: "Success",

      // ========== Additional Keys from Old Staking Keys ==========
      stake_title: "Staking MECO",
      stake_subtitle: "Earn passive income & support MECO network",
      annual_percentage_rate: "Annual Percentage Rate",
      apr_description: "Higher than most traditional banks",
      staking_wallet: "Staking Wallet",
      accumulated_rewards: "Accumulated Rewards",
      available_meco_balance: "Available MECO Balance",
      connected_to_smart_contract: "Connected to Smart Contract",
      stake_button: "Stake",
      unstake_button: "Unstake",
      estimated_rewards: "Estimated Rewards",
      daily: "Daily",
      monthly: "Monthly",
      yearly: "Yearly",
      important_notes: "Important Notes",
      rewards_distributed_daily: "Rewards are distributed daily automatically",
      minimum_stake_amount: "Minimum stake amount: {{amount}} MECO",
      unstake_waiting_period: "Unstake waiting period: {{days}} days",
      need_sol_for_fees: "You need SOL for transaction fees",
      rates_may_change: "Rates may change based on network conditions",
      test_connection: "Test Connection",
      using_demo_mode: "Using demo mode. Connect wallet for real transactions.",
      connect_wallet_real_transactions: "Connect wallet for real transactions",
      loading_staking_data: "Loading staking data...",
      confirm_stake_title: "Confirm Stake",
      confirm_stake_message: "Stake {{amount}} MECO at {{apr}}% APR?",
      insufficient_sol_for_fee: "Insufficient SOL for transaction fee",
      stake_transaction_failed: "Stake transaction failed",
      stake_success: "{{amount}} MECO staked successfully!\nTransaction: {{tx}}...",
      confirm_unstake_title: "Confirm Unstake",
      confirm_unstake_message: "Unstake {{amount}} MECO?\n\nNote: Funds will be available after {{days}} days",
      amount_exceeds_staked: "Amount exceeds staked balance",
      unstake_period_not_passed: "Unstake period not passed yet ({{days}} days required)",
      unstake_transaction_failed: "Unstake transaction failed",
      unstake_success: "{{amount}} MECO unstake requested!\nYou will receive it in {{days}} days\nTransaction: {{tx}}...",
      claim_rewards_title: "Claim Rewards",
      claim_rewards_message: "Claim {{amount}} MECO rewards?",
      claim_transaction_failed: "Claim transaction failed",
      claim_success: "{{amount}} MECO claimed successfully!\nTransaction: {{tx}}...",
      stake_modal_title: "Stake MECO",
      stake_modal_description: "Enter the amount of MECO you want to stake",
      unstake_modal_title: "Unstake MECO",
      unstake_modal_description: "Enter the amount of MECO you want to unstake",
      unstake_warning: "Note: Funds will be available after {{days}} days",
      confirm_stake_button: "Confirm Stake",
      confirm_unstake_button: "Confirm Unstake",
      start_staking: "🚀 Start Staking",
      get_meco_first: "🔄 Get MECO First",
      wallet_not_connected_short: "🔗 Wallet Not Connected",
      no_funds_staked: "💼 No Funds Staked",
      claim_rewards_info: "🎁 Claim Rewards",
      no_rewards_available: "⏳ No Rewards Available",
      real_transactions_active: "✅ Real transactions on Solana",
      staking_instructions: "To start staking MECO, please connect your wallet first.\n\n1. Make sure you have an active wallet\n2. Get MECO balance for staking\n3. Start your staking journey and earn daily profits",
      get_meco_instructions: "You don't have MECO balance for staking.\n\nTo get MECO:\n1. Go to MECO screen\n2. Buy MECO from presale\n3. Return to this screen to start staking\n\nYou can buy MECO at a discounted price from the presale!",
      wallet_connection_instructions: "You must connect your wallet first to withdraw funds.\n\n1. Make sure your wallet is connected\n2. Check your connection to Solana network\n3. Try again",
      no_staked_funds_instructions: "You haven't staked any funds yet.\n\nTo withdraw, you must:\n1. Stake MECO first\n2. Wait for the staking period\n3. Then you can withdraw your funds\n\nStart staking now to earn daily profits!",
      claim_rewards_instructions: "Wallet connection is required to claim rewards.\n\n1. Connect your wallet\n2. Make sure smart contract is connected\n3. Try again",
      no_rewards_instructions: "You don't have any rewards ready to claim at the moment.\n\nTo accumulate rewards:\n1. Stake MECO first\n2. Wait for daily rewards to accumulate\n3. Rewards accumulate automatically over time\n\nYou can claim rewards when you reach the minimum",
      rewards_claim_info: "You have {{rewards}} MECO rewards available.\n\nIn the current contract, rewards are automatically transferred when you unstake.\n\nTo collect your rewards:\n1. Unstake a portion of your funds\n2. You'll receive your funds + accumulated rewards\n3. You can stake them again to increase profits",
      smart_contract_connected: "Smart Contract Connected",
      connection_successful: "✅ Connection Successful",
      contract_address: "Contract Address",
      contract_active_available: "Smart contract is active and available on:\n{{address}}...\n\nSolana version: {{version}}",

      // ========== Market Keys ==========
      market_title: "Market",
      market_subtitle: "Real prices • Live updates",
      all_tokens: "All Tokens",
      solana_tokens: "Solana",
      stablecoins: "Stable",
      gainers: "Gainers",
      trending: "Trending",
      current_prices: "Current Prices",
      tokens_count: "{{count}} tokens",
      loading_market_data: "Loading market data...",
      important_note: "Important Note",
      prices_auto_updated: "Prices are auto-updated from reliable sources",
      meco_price_note: "MECO: ${{price}}",

      // ========== New SendScreen Keys ==========
      fee_details: "Fee Details",
      network_fee: "Network Fee",
      service_fee: "Service Fee",
      total_fees: "Total Fees",
      dynamic_based_on_congestion: "(dynamic based on congestion)",
      for_developer_support: "(10% for developer support)",
      fee_developer_notice: "10% of network fees go to support development and maintenance of the app",
      no_balance: "No balance",
      balance: "Balance",
      loading_tokens: "Loading tokens...",
      total: "Total",

      // ========== New ReceiveScreen Keys ==========
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

      // ========== New TransactionHistoryScreen Keys ==========
      swap_transaction: "Swap",
      stake_transaction: "Stake",
      send_transaction: "Send",
      receive_transaction: "Receive",
      onchain_transaction: "On-chain",
      transaction: "Transaction",
      transaction_history_title: "Transaction History",
      all_transactions: "All Transactions",
      transactions: "transaction",
      no_transactions_yet: "No transactions yet",
      your_transactions_will_appear_here: "Your transactions will appear here",
      fee: "Fee",
      network_fee: "Network Fee",
      confirmed: "Confirmed",
      pending: "Pending",
      failed: "Failed",
      unknown: "Unknown",

      // ========== Additional Keys from updated StakingScreen ==========
      wallet_private_key_missing: "Wallet private key missing",
      private_key_conversion_failed: "Private key conversion failed",
      wallet_creation_failed: "Wallet creation failed",
      starting_solana_connection: "Starting Solana connection",
      wallet_not_connected_readonly: "Wallet not connected, using read-only mode",
      wallet_creation_failed_readonly: "Wallet creation failed, using read-only mode",
      program_instance_ready: "Program instance ready",
      loading_real_staking_data: "Loading real staking data",
      no_wallet_address: "No wallet address",
      real_meco_balance: "Real MECO balance",
      failed_to_get_meco_balance: "Failed to get MECO balance",
      real_staked_amount: "Real staked amount",
      calculated_rewards: "Calculated rewards",
      no_staking_account_found: "No staking account found",
      load_data_error: "Error loading data",
      loading_readonly_data: "Loading read-only data",
      readonly_mode_error: "Error in read-only mode",
      wallet_program_initialization_failed: "Wallet program initialization failed",
      sending_real_stake_transaction: "Sending real stake transaction",
      stake_transaction_sent: "Stake transaction sent",
      stake_transaction_confirmed: "Stake transaction confirmed",
      stake_transaction_error: "Stake transaction error",
      stake_transaction_failed_message: "Stake transaction failed: {{error}}",
      sending_real_unstake_transaction: "Sending real unstake transaction",
      unstake_transaction_sent: "Unstake transaction sent",
      unstake_transaction_confirmed: "Unstake transaction confirmed",
      unstake_transaction_error: "Unstake transaction error",
      unstake_available_in: "Unstake available in {{time}}",
      connection_failed: "❌ Connection Failed",
      contract_not_available: "Contract not available",
      contract_loading: "Loading contract...",
      smart_contract_available: "Smart contract available",
      stake_success_no_tx: "Successfully staked {{amount}} MECO!",
      unstake_success_no_tx: "Successfully requested unstake of {{amount}} MECO!\nYou will receive it in {{days}} days",
      rewards_claimed_success: "Successfully claimed {{rewards}} MECO!\nTransaction: {{tx}}...",
      rewards_claimed_success_no_tx: "Successfully claimed {{rewards}} MECO!",
      claim_rewards_failed: "Failed to claim rewards",

      // ========== New Keys from MECO Screen that you sent ==========
      TITLE: "MonyCoin",
      SYMBOL: "MECO",
      LIVE: "LIVE",
      ACTIVE: "Active ✅",
      INACTIVE: "Inactive ❌",
      BUY_NOW: "Buy Now",
      CONFIRM_PAYMENT: "Confirm Payment",
      CANCEL: "Cancel",
      CLOSE: "Close",
      REFRESH: "Refresh",
      CONTINUE: "Continue",
      VIEW_ON_SOLSCAN: "View on Solscan",
      VERIFY_ON_SOLSCAN: "Verify on Solscan",
      SECURITY_CHECK: "Security Check",
      COPY: "Copied",
      SHARE: "Share",
      SMART_CONTRACT_INFO: "Smart Contract Information",
      YOUR_BALANCE: "Your Balance",
      PURCHASE_MECO: "Purchase MECO",
      EXCLUSIVE_PRESALE: "Exclusive Presale",
      PRESALE_PROGRESS: "Presale Progress",
      ENTER_SOL_AMOUNT: "Enter SOL Amount",
      TOKEN_STATISTICS: "Token Statistics",
      OFFICIAL_LINKS: "Official Links",
      PURCHASE_CONFIRMATION: "Purchase Confirmation",
      SOLD: "Sold:",
      REMAINING: "Remaining:",
      TOTAL: "Total",
      MINIMUM: "Minimum",
      MAXIMUM: "Maximum",
      YOU_WILL_SEND: "You will send",
      TRANSACTION_FEE: "Transaction Fee",
      YOU_WILL_RECEIVE: "You will receive",
      PURCHASE_PRICE: "Purchase Price",
      VIA_SMART_CONTRACT: "Via Smart Contract:",
      SUCCESS: "Success!",
      FAILURE: "Failure",
      PURCHASE_SUCCESSFUL: "Purchase successful!",
      YOU_RECEIVED: "🎉 You received",
      YOU_SENT: "🪙 You sent",
      LOADING_DATA: "Loading data...",
      PROCESSING_TRANSACTION: "Processing transaction...",
      PRESALE_PAUSED: "Presale Paused",
      DEVNET: "Devnet",
      SMART_CONTRACT: "Smart Contract",
      SECURE_TRANSACTION: "Secure transaction via Smart Contract • Irreversible • Verify on Solscan",
      MECO_OFFICIAL_TOKEN: "MECO - Official Token",
      SECURE_SMART_CONTRACT: "Secure Smart Contract • Verifiable • Powered by Solana",
      TOKEN_ANALYSIS: "Token analysis & transactions",
      OFFICIAL_COMMUNITY: "Official community",
      FOLLOW_FOR_NEWS: "Follow us for news",
      LEARN_ABOUT_MECO: "Learn about MECO",
      SOURCE_CODE: "Source code",
      WALLET_ADDRESSES: "Wallet Addresses",
      PROJECT_MANAGEMENT_WALLET: "Project Management Wallet",
      PRESALE_TREASURY: "Presale Treasury",
      SMART_CONTRACT_PROGRAM: "Smart Contract (Program)",
      MECO_TOKEN: "MECO Token",
      ERROR: "Error",
      CANNOT_OPEN_LINK: "Cannot open this link",
      ERROR_OCCURRED: "An error occurred while opening the link",
      WALLET_NOT_CONNECTED: "Wallet not connected",
      MINIMUM_AMOUNT: "Minimum amount is",
      MAXIMUM_AMOUNT: "Maximum amount is",
      INSUFFICIENT_BALANCE: "Insufficient balance",
      YOU_NEED: "You need",
      INCLUDING_FEES: "including fees",
      YOUR_CURRENT_BALANCE: "Your current balance",
      PRESALE_INACTIVE: "Presale inactive",
      PRESALE_CURRENTLY_INACTIVE: "Presale is currently inactive",
      SUCCESSFULLY_PURCHASED: "Successfully purchased",
      TRANSACTION_FAILED: "Transaction failed",
      INSUFFICIENT_BALANCE_TRANSACTION: "Insufficient balance for transaction",
      TRANSACTION_REJECTED: "Transaction rejected by user",
      TRANSACTION_TIMEOUT: "Transaction timeout, please try again",
      BLOCKHASH_EXPIRED: "Blockhash expired, please try again",
      PLEASE_WAIT: "Please wait",
      PLEASE_WAIT_SECONDS: "Please wait {{time}} seconds between transactions",
      MONYCOIN_MECO_TOKEN: "MonyCoin (MECO) Token",
      CONTRACT: "Contract:",
      PRESALE_RATE: "Presale:",
      MECO_PER_SOL: "MECO per SOL",
      WEBSITE: "Website:",
      SOL: "SOL",
      MECO_TOKEN_NAME: "MECO",
      SUFFICIENT_FOR_PURCHASE: "✅ Sufficient for purchase (Required:",
      INSUFFICIENT_FOR_PURCHASE: "❌ Insufficient for purchase (Required:"
    }
  }
};

// دالة بسيطة للتهيئة (بدون async/await معقد)
const initI18n = () => {
  return i18n
    .use(initReactI18next)
    .init({
      compatibilityJSON: 'v3',
      resources,
      lng: 'ar', // تم تعيين اللغة العربية كافتراضية
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

// تهيئة مباشرة (بدون انتظار)
initI18n();

// تصدير الدوال المساعدة
export const changeLanguage = (lng) => {
  i18n.changeLanguage(lng);
  SecureStore.setItemAsync('app_language', lng);
};

export const getCurrentLanguage = () => i18n.language;

export default i18n;
