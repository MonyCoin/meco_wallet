<div align="center">

<img src="https://raw.githubusercontent.com/MonyCoin/meco_wallet/refs/heads/main/assets/icon.png" width="96" height="96" alt="MECO Wallet logo">

# MECO Wallet

### محفظتك العربية اللامركزية إلى منظومة Web3

<p>
  محفظة آمنة وسهلة الاستخدام لإدارة الأصول الرقمية على شبكة Solana،<br>
  مع أدوات متقدمة للتبادل، التخزين، مراقبة الأسعار وإدارة العناوين.
</p>

<p>
  <a href="https://monycoin.github.io/meco_web/"><strong>🌐 الموقع الرسمي</strong></a>
  ·
  <a href="https://github.com/MonyCoin/meco_wallet/releases"><strong>📦 الإصدارات</strong></a>
  ·
  <a href="https://github.com/MonyCoin/meco_wallet/issues"><strong>🐛 الإبلاغ عن مشكلة</strong></a>
</p>

<p>
  <a href="https://github.com/MonyCoin/meco_wallet/releases"><img src="https://img.shields.io/badge/version-v1.20.0-6C63FF?style=for-the-badge" alt="Version 1.20.0"></a>
  <a href="https://solana.com"><img src="https://img.shields.io/badge/network-Solana-9945FF?style=for-the-badge&logo=solana&logoColor=white" alt="Solana network"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-0BSD-10B981?style=for-the-badge" alt="0BSD license"></a>
</p>

<p>
  <img src="https://img.shields.io/badge/platform-Android-3DDC84?style=flat-square&logo=android&logoColor=white" alt="Android">
  <img src="https://img.shields.io/badge/React_Native-Expo-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React Native and Expo">
  <img src="https://img.shields.io/badge/status-Active-10B981?style=flat-square" alt="Active project">
</p>

</div>

> **MECO Wallet** ليست مجرد محفظة لإرسال واستقبال العملات؛ إنها مركز تحكم شخصي يمنحك ملكية أصولك وحرية الوصول إلى الاقتصاد الرقمي اللامركزي.

---

## 🧭 المحتويات

- [لماذا MECO Wallet؟](#-لماذا-meco-wallet)
- [المميزات الرئيسية](#-المميزات-الرئيسية)
- [تحميل التطبيق](#-تحميل-التطبيق)
- [التثبيت للمطورين](#-التثبيت-للمطورين)
- [التقنيات المستخدمة](#-التقنيات-المستخدمة)
- [معلومات الشبكة](#-معلومات-الشبكة)
- [الأمان والخصوصية](#-الأمان-والخصوصية)
- [خارطة الميزات](#-خارطة-الميزات)
- [دليل الاستخدام](#-دليل-الاستخدام)
- [المستودعات والروابط](#-المستودعات-والروابط)
- [المساهمة والدعم](#-المساهمة-والدعم)

---

## ✨ لماذا MECO Wallet؟

| 🛡️ ملكية حقيقية | 🌍 تجربة عربية | ⚡ أدوات متكاملة |
|:---:|:---:|:---:|
| مفاتيحك الخاصة تبقى على جهازك، ولا توجد جهة وسيطة تتحكم في أموالك. | واجهة عربية واضحة مع دعم اللغة الإنجليزية وتجربة مصممة للمستخدم العربي. | إرسال، استقبال، Swap، Staking، Web3، تنبيهات أسعار ودفتر عناوين في تطبيق واحد. |

---

## 🚀 المميزات الرئيسية

### 🔐 الأمان والملكية

- إنشاء محفظة جديدة أو استيراد محفظة موجودة.
- تخزين المفاتيح الخاصة محلياً باستخدام `expo-secure-store`.
- دعم المصادقة البيومترية و`PIN` الاختياري.
- بيئة لا مركزية **Non-custodial**؛ المستخدم هو المالك الوحيد لمحفظته.

### 💸 إدارة الأصول

- إرسال واستقبال MECO وجميع رموز SPL المدعومة على Solana.
- إدارة حسابات متعددة، لكل حساب رصيده وبياناته الخاصة.
- إضافة الرموز المخصصة من خلال عنوان العقد الذكي.
- سجل معاملات ذكي لتحليل العمليات الواردة والصادرة.

### 🔄 التداول وWeb3

- مبادلة فورية عبر **Jupiter** وبأسعار تنافسية.
- شاشة سوق تعرض الأسعار المحدثة عبر **CoinGecko** و**Jupiter**.
- شاشة تداول احترافية لمتابعة السوق.
- دعم **WalletConnect v2** للاتصال بتطبيقات Web3 وDeFi.
- متصفح Web3 مدمج للتفاعل مع التطبيقات اللامركزية.

### ⚡ التخزين والاستثمار

- تخزين MECO عبر باقات مرنة أو مقفلة لمدة 30 أو 60 يوماً.
- متابعة العوائد اليومية وحالة التخزين من داخل التطبيق.
- تكامل مع منظومة السيولة والخدمات اللامركزية على Solana.

### 📒 التنظيم والتنبيهات

- إشعارات محلية ذكية مع Badge وسجل للعمليات.
- اكتشاف تلقائي للأموال الواردة عند فتح التطبيق.
- تنبيهات سعرية عند وصول أي عملة إلى السعر المستهدف صعوداً أو هبوطاً.
- دفتر عناوين متقدم مع:
  - تصنيفات ملوّنة: عائلة، عمل، أصدقاء، منصات، أخرى.
  - بحث فوري وترتيب بالأحدث أو الأبجدي أو الأكثر استخداماً.
  - ملاحظات وإحصائيات استخدام لكل عنوان.
  - حفظ وتعديل وحذف العناوين مباشرة من شاشة الإرسال.
- ماسح QR ذكي مع عودة مباشرة إلى شاشة الإرسال.
- وضع ليلي ونهاري ودعم العربية والإنجليزية.

---

## 📥 تحميل التطبيق

<div align="center">

<a href="https://monycoin.github.io/meco_web/">
  <img src="https://img.shields.io/badge/📲_تحميل_MECO_Wallet-6C63FF?style=for-the-badge&logo=android&logoColor=white" alt="Download MECO Wallet">
</a>

<br><br>

| الإصدار الحالي | آخر تحديث | المنصة |
|:---:|:---:|:---:|
| **v1.20.0** | سبتمبر 2026 | Android |

</div>

> حمّل التطبيق من [الموقع الرسمي](https://monycoin.github.io/meco_web/) فقط، واحرص على حماية عبارة الاسترداد وعدم مشاركتها مع أي جهة.

---

## 🛠️ التثبيت للمطورين

### المتطلبات

- Node.js `v18+`
- npm أو Yarn
- Expo CLI
- Android Studio للاختبار المتقدم، عند الحاجة

### التشغيل محلياً

```bash
git clone https://github.com/MonyCoin/meco_wallet.git
cd meco_wallet
npm install
npm install -g expo-cli
expo start
```

لبناء نسخة Android للإنتاج:

```bash
eas build --platform android --build-profile production
```

### متغيرات البيئة

أنشئ ملف `.env` في جذر المشروع، ولا ترفع المفاتيح السرية إلى GitHub:

```env
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
HELIUS_API_KEY=your_helius_key_here
ANKR_API_KEY=your_ankr_key_here
JUPITER_API_KEY=your_jupiter_key
WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
COINGECKO_API_KEY=your_coingecko_key
```

---

## 🧱 التقنيات المستخدمة

| المجال | التقنيات |
|:---|:---|
| التطبيق | React Native، Expo SDK 54، TypeScript |
| البلوكتشين | Solana Web3.js، SPL-Token، `@solana/transactions` |
| الأمان والتخزين | `expo-secure-store`، AsyncStorage، TweetNaCl.js |
| الاتصال واللامركزية | WalletConnect v2 Core، Helius RPC، Ankr RPC |
| الأسعار والتبادل | Jupiter API، CoinGecko API |
| الترجمة | i18next، react-i18next |
| الواجهة وإدارة البيانات | React Navigation، Redux/Context API، React Query |

---

## 🌐 معلومات الشبكة

| المعلومة | القيمة |
|:---:|:---|
| البلوكتشين | Solana |
| الشبكة | Mainnet-Beta |
| رمز MECO | `A5Ln25cfww33kfUSzBb89bMha7j1PnFQTy7H3FsQHN7W` |
| مزودو RPC | Helius وAnkr |

- [عرض رمز MECO على Solscan](https://solscan.io/token/A5Ln25cfww33kfUSzBb89bMha7j1PnFQTy7H3FsQHN7W)
- [تحليل معاملات MECO](https://solscan.io/token/A5Ln25cfww33kfUSzBb89bMha7j1PnFQTy7H3FsQHN7W)

---

## 🔒 الأمان والخصوصية

- المفاتيح الخاصة **لا تغادر جهاز المستخدم**.
- لا توجد نسخة احتياطية للمفاتيح على خوادم بعيدة.
- لا توجد خوادم وسيطة تمتلك صلاحية الوصول إلى أموالك.
- استخدم عبارة استرداد قوية واحفظها خارج الإنترنت.
- لا تشارك عبارة الاسترداد أو المفتاح الخاص مع أي شخص.
- فعّل المصادقة البيومترية وحدّث التطبيق باستمرار.

> **تنبيه:** أنت المسؤول عن حفظ عبارة الاسترداد والمفاتيح الخاصة. لا يستطيع فريق MECO استعادتها إذا فُقدت.

---

## 🗺️ خارطة الميزات

| الميزة | الحالة | الإصدار |
|:---|:---:|:---:|
| 🔐 إنشاء واستيراد المحافظ | ✅ مكتملة | v1.0.0 |
| 💸 إرسال واستقبال رموز SPL | ✅ مكتملة | v1.1.0 |
| 📸 ماسح QR ذكي | ✅ مكتملة | v1.1.5 |
| 👥 إدارة حسابات متعددة | ✅ مكتملة | v1.2.0 |
| 📱 سجل المعاملات الذكي | ✅ مكتملة | v1.3.0 |
| 🪙 إضافة الرموز المخصصة | ✅ مكتملة | v1.4.0 |
| 🔄 التبادل الداخلي Swap | ✅ مكتملة | v1.5.0 |
| 📊 شاشة السوق | ✅ مكتملة | v1.6.0 |
| 🌗 تخصيص الواجهة | ✅ مكتملة | v1.7.0 |
| 🌐 WalletConnect v2 | ✅ مكتملة | v1.8.0 |
| ⚡ Staking | ✅ مكتملة | v1.10.0 |
| 🖼️ شاشة Portfolio | ✅ مكتملة | v1.11.0 |
| 🌍 متصفح Web3 مدمج | ✅ مكتملة | v1.12.0 |
| 📈 شاشة التداول الاحترافية | ✅ مكتملة | v1.14.0 |
| 🔔 الإشعارات المحلية الذكية | ✅ مكتملة | v1.18.0 |
| 📥 إشعارات الاستقبال التلقائية | ✅ مكتملة | v1.19.0 |
| 🎯 تنبيهات الأسعار | ✅ مكتملة | v1.20.0 |
| 📒 دفتر العناوين المتقدم | ✅ مكتملة | v1.20.0 |
| 🔄 التحديث الفوري OTA | ✅ مكتملة | v1.20.0 |
| 📲 تطبيق iOS | 🔄 قيد التطوير | — |

---

## 📖 دليل الاستخدام السريع

### إنشاء محفظة

1. اختر **إنشاء محفظة جديدة**.
2. احفظ كلمات الاسترداد الاثنتي عشرة في مكان آمن.
3. أكد الكلمات وحدد كلمة مرور قوية.

### إرسال واستقبال

1. اختر **إرسال** أو **استقبال** من الشاشة الرئيسية.
2. أدخل العنوان أو استخدم ماسح QR.
3. راجع المبلغ والرسوم قبل تأكيد العملية.
4. استخدم دفتر العناوين لحفظ العناوين المتكررة وتنظيمها.

### Swap وStaking

1. اختر العملة والمبلغ من قسم **Swap** أو **Staking**.
2. راجع السعر أو مدة التخزين والعوائد المتوقعة.
3. أكد العملية وأكمل المصادقة عند الطلب.

---

## 🔗 المستودعات والروابط

| المشروع | الرابط |
|:---|:---|
| 🪙 MECO Token | [meco-token](https://github.com/monycoin/meco-token) |
| 📱 MECO Wallet | [meco_wallet](https://github.com/MonyCoin/meco_wallet) |
| 🌐 الموقع الرسمي | [monycoin.github.io/meco_web](https://monycoin.github.io/meco_web/) |
| 📖 الوثائق | [docs.monycoin.io](https://docs.monycoin.io) |
| 🐛 Issues | [الإبلاغ عن مشكلة](https://github.com/MonyCoin/meco_wallet/issues) |

---

## 🤝 المساهمة والدعم

نرحب بالمطورين والمساهمين من جميع أنحاء العالم:

```bash
git checkout -b feature/my-feature
# نفّذ التغييرات والاختبارات
 git commit -m "Add my feature"
 git push origin feature/my-feature
```

بعد ذلك افتح **Pull Request** إلى فرع `main`. يرجى مراجعة [CONTRIBUTING.md](./CONTRIBUTING.md) قبل البدء.

### تواصل معنا

- [X / Twitter](https://x.com/MoniCoinMECO)
- [Telegram](https://t.me/monycoin1)
- [Facebook](https://www.facebook.com/share/1ZUbCbssCU/)

---

## 📄 الرخصة

هذا المشروع مرخص بموجب **0BSD License**. راجع [LICENSE](LICENSE) للتفاصيل.

---

<div align="center">

### ✨ شكراً لاستخدامك MECO Wallet ✨

**© 2026 — MECO Wallet**  
An Official Application of **MonyCoin Digital Development Foundation**  
Founder: **Mohamed Saadeh**

<br>

<a href="https://github.com/MonyCoin/meco_wallet/stargazers">⭐ Star</a>
 ·
<a href="https://github.com/MonyCoin/meco_wallet/network/members">🍴 Fork</a>
 ·
<a href="https://github.com/MonyCoin/meco_wallet/issues">💬 Feedback</a>

</div>
