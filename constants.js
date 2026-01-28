// constants.js - ملف الثوابت المحدث مع إدارة منظمة
// تم التحديث بناءً على هيكلية المشروع الحقيقية على Solana

// 🔵 1. العقد الذكي (Program ID) - الكود المنشور على Solana
export const PROGRAM_ID = '6SVpAYhP7XkKtW6SuRbdTRv1pjaVUDZP3ZQg9rLqGLzp';

// 🟢 2. محفظة البيع المسبق (للاستقبال الفعلي لأموال الشراء)
export const PRESALE_WALLET_ADDRESS = 'E9repjjKBq3RVLw1qckrG15gKth63fe98AHCSgXZzKvY';

// 🟡 3. محفظة إدارة المشروع (للتحكم في العقد الذكي)
export const PROGRAM_WALLET_ADDRESS = 'HQdvKi4Kk5kqo7F2mcpWLU7qmrLUC2tXPTNDvEyKz55Z';

// 🔴 4. عنوان توكن MECO على الشبكة الرئيسية
export const MECO_MINT = '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i';

// 🌐 5. اتصال الشبكة
export const RPC_URL = 'https://api.mainnet-beta.solana.com';

// ⚙️ 6. إعدادات البيع المسبق
export const PRESALE_CONFIG = {
  MIN_SOL: 0.05,
  MAX_SOL: 1,
  RATE: 250000,
  TOTAL_TOKENS: 50000000,
  DECIMALS: 6,
  IS_ACTIVE: true,
};

// ⚙️ 7. إعدادات التخزين
export const STAKING_CONFIG = {
  APR: 18.5,
  MIN_STAKE: 100,
  MAX_STAKE: 1000000,
  UNSTAKE_PERIOD: 3,
  DECIMALS: 6,
  IS_ACTIVE: true,
};

// 🔑 8. عناوين المحافظ المنظمة
export const WALLET_ADDRESSES = {
  // المحفظة الرئيسية لاستقبال أموال البيع المسبق
  PRESALE_TREASURY: PRESALE_WALLET_ADDRESS,
  
  // محفظة إدارة العقد الذكي والمشروع
  PROGRAM_WALLET: PROGRAM_WALLET_ADDRESS,
  
  // محفظة تحصيل الرسوم (إن وجدت)
  FEE_COLLECTOR: 'HXkEZSKictbSYan9ZxQGaHpFrbA4eLDyNtEDxVBkdFy6',
};

// 🗂️ 9. بيانات PDA للعقد الذكي
export const PDA_SEEDS = {
  PROTOCOL: 'protocol',
  PRESALE_VAULT: 'presale_vault',
  STAKING_VAULT: 'staking_vault',
  REWARDS_VAULT: 'rewards_vault',
  STAKE_ACCOUNT: 'stake',
};

// 🌍 10. إعدادات الشبكة
export const NETWORK_CONFIG = {
  DEVNET: 'devnet',
  MAINNET: 'mainnet-beta',
  COMMITMENT: 'confirmed',
  TIMEOUT: 60000,
};

// 🔗 11. الروابط الخارجية
export const EXTERNAL_LINKS = {
  // روابط Solscan للتحقق
  SOLSCAN_PROGRAM: `https://solscan.io/account/${PROGRAM_ID}`,
  SOLSCAN_PRESALE_WALLET: `https://solscan.io/account/${PRESALE_WALLET_ADDRESS}`,
  SOLSCAN_PROGRAM_WALLET: `https://solscan.io/account/${PROGRAM_WALLET_ADDRESS}`,
  SOLSCAN_TOKEN: `https://solscan.io/token/${MECO_MINT}`,
  SOLSCAN_TX: (txId) => `https://solscan.io/tx/${txId}`,
  SOLSCAN_ACCOUNT: (address) => `https://solscan.io/account/${address}`,
  
  // روابط التواصل والمواقع
  TELEGRAM: 'https://t.me/monycoin1',
  TWITTER: 'https://x.com/MoniCoinMECO',
  WEBSITE: 'https://monycoin1.blogspot.com/',
  GITHUB: 'https://monycoin.github.io/meco-token/MECO_Presale_Funds.html',
  BIRDEYE: `https://birdeye.so/token/${MECO_MINT}?chain=solana`,
};

// 💰 12. رسوم المعاملات
export const TRANSACTION_FEES = {
  DEFAULT: 0.000005,
  PRIORITY: 0.00001,
  MAX: 0.00005,
  RENT_EXEMPT: 0.001,
};

// ❌ 13. رسائل الأخطاء
export const ERROR_MESSAGES = {
  WALLET_NOT_CONNECTED: 'المحفظة غير متصلة',
  INSUFFICIENT_BALANCE: 'الرصيد غير كافي',
  BELOW_MINIMUM: 'المبلغ أقل من الحد الأدنى',
  ABOVE_MAXIMUM: 'المبلغ أعلى من الحد الأقصى',
  PRESALE_INACTIVE: 'البيع المسبق غير نشط',
  STAKING_INACTIVE: 'Staking غير نشط',
  TRANSACTION_FAILED: 'فشلت المعاملة',
  NETWORK_ERROR: 'خطأ في الشبكة',
  CONTRACT_ERROR: 'خطأ في العقد الذكي',
  INVALID_ADDRESS: 'عنوان غير صالح',
  INSUFFICIENT_RENT: 'رصيد غير كافي لتغطية Rent',
};

// 🪙 14. بيانات التوكنات
export const TOKENS = {
  MECO: {
    name: 'MonyCoin',
    symbol: 'MECO',
    decimals: 6,
    supply: 1000000000,
    mint: MECO_MINT,
    logoURI: 'https://raw.githubusercontent.com/saadeh73/meco-project/main/meco-logo.png',
    icon: 'rocket-outline',
  },
  SOL: {
    name: 'Solana',
    symbol: 'SOL',
    decimals: 9,
    mint: 'So11111111111111111111111111111111111111112',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    icon: 'diamond-outline',
  },
  USDC: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    icon: 'wallet-outline',
  },
  USDT: {
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 6,
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png',
    icon: 'cash-outline',
  },
};

// 🔢 15. الخانات العشرية للتوكنات
export const TOKEN_DECIMALS = {
  [MECO_MINT]: 6,
  'So11111111111111111111111111111111111111112': 9,
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6,
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6,
};

// 📝 16. أكواد التعليمات للعقد الذكي
export const INSTRUCTION_CODES = {
  INITIALIZE: 0,
  BUY_PRESALE: 1,
  STAKE: 2,
  UNSTAKE: 3,
  CLAIM_REWARDS: 4,
  WITHDRAW_FUNDS: 5,
};

// ⚠️ 17. أكواد أخطاء البرنامج
export const PROGRAM_ERRORS = {
  NOT_INITIALIZED: 100,
  ALREADY_INITIALIZED: 101,
  INVALID_AMOUNT: 102,
  PRESALE_INACTIVE: 103,
  STAKING_INACTIVE: 104,
  INSUFFICIENT_BALANCE: 105,
  STAKE_NOT_FOUND: 106,
  CLAIM_NOT_AVAILABLE: 107,
  UNAUTHORIZED: 108,
};

// 👑 18. قائمة المحافظ الإدارية
export const ADMIN_WALLETS = [
  PROGRAM_WALLET_ADDRESS,      // محفظة إدارة العقد الذكي
  PRESALE_WALLET_ADDRESS,      // محفظة البيع المسبق
  'HXkEZSKictbSYan9ZxQGaHpFrbA4eLDyNtEDxVBkdFy6', // محفظة الرسوم
];

// 🎯 19. إصدار البرنامج
export const PROGRAM_VERSION = '2.0.1';

// 📅 20. تواريخ إطلاق المشروع
export const LAUNCH_DATES = {
  PRESALE_START: '2024-01-15',
  STAKING_START: '2024-01-20',
  TOKEN_LAUNCH: '2024-02-01',
};

// ✅ تم تحديث ملف الثوابت بنظام إدارة واضح:
// 1. العقد الذكي (PROGRAM_ID) - للتفاعل مع البرنامج
// 2. محفظة البيع (PRESALE_WALLET_ADDRESS) - لاستقبال أموال الشراء
// 3. محفظة الإدارة (PROGRAM_WALLET_ADDRESS) - لإدارة المشروع
// 4. روابط التحقق الصحيحة على Solscan لكل عنوان
