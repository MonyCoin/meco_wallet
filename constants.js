// constants.js - ملف الثوابت المصحح

// 🔵 1. العقد الذكي (Program ID) - تم التصحيح
export const PROGRAM_ID = 'A95VLbgDEpCctsDgAUc42HpsKYNLfjBo6u6ZdGTbRQMZ';

// 🟢 2. محفظة البيع المسبق (Treasury) - مؤكد
export const PRESALE_WALLET_ADDRESS = 'E9repjjKBq3RVLw1qckrG15gKth63fe98AHCSgXZzKvY';

// 🔴 3. محفظة إدارة المشروع (Admin) - مؤكد
export const PROGRAM_WALLET_ADDRESS = 'BNSuEN6GaRF76sc5m7nfNwxDRjxXtsZpctvPpd8sRLCv';

// 🟡 4. عنوان توكن MECO - مؤكد
export const MECO_MINT = '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i';

// 🌐 5. اتصال الشبكة - تم التصحيح
export const RPC_URL = 'https://api.mainnet-beta.solana.com';

// ⚙️ 6. إعدادات البيع المسبق
export const PRESALE_CONFIG = {
  MIN_SOL: 0.05,
  MAX_SOL: 1,
  RATE: 250000, // 250,000 MECO لكل 1 SOL
  TOTAL_TOKENS: 50000000,
  DECIMALS: 6,
  IS_ACTIVE: true,
};

// ⚙️ 7. إعدادات التخزين - تم التصحيح
export const STAKING_CONFIG = {
  APR: 25, // 25% سنوي
  MIN_STAKE: 1000, // 1000 MECO كحد أدنى
  MAX_STAKE: 10000000, // 10 مليون MECO كحد أقصى
  UNSTAKE_PERIOD: 3, // 3 أيام
  DECIMALS: 6,
  IS_ACTIVE: true,
};

// 🔑 8. عنوان محفظة الرسوم - تمت الإضافة
export const FEE_COLLECTOR_ADDRESS = 'HXkEZSKictbSYan9ZxQGaHpFrbA4eLDyNtEDxVBkdFy6';

// 🔑 9. عناوين المحافظ - مصححة ومبسطة
export const WALLET_ADDRESSES = {
  PRESALE_TREASURY: 'E9repjjKBq3RVLw1qckrG15gKth63fe98AHCSgXZzKvY',
  PROGRAM_WALLET: 'BNSuEN6GaRF76sc5m7nfNwxDRjxXtsZpctvPpd8sRLCv',
  FEE_COLLECTOR: 'HXkEZSKictbSYan9ZxQGaHpFrbA4eLDyNtEDxVBkdFy6',
  BURN_WALLET: 'So11111111111111111111111111111111111111112',
};

// 🗂️ 10. بيانات PDA للعقد الذكي - تم التصحيح
export const PDA_SEEDS = {
  CONFIG: 'config',
  STAKING_CONFIG: 'staking_config',
  STAKING_VAULT: 'staking_vault',
  REWARD_VAULT: 'reward_vault',
  STAKING_AUTH: 'staking_auth',
  STAKE_ACCOUNT: 'stake_account', // تم التصحيح من 'stake' إلى 'stake_account'
};

// 🌍 11. إعدادات الشبكة
export const NETWORK_CONFIG = {
  DEVNET: 'devnet',
  MAINNET: 'mainnet-beta',
  COMMITMENT: 'confirmed',
  TIMEOUT: 60000,
  MAX_RETRIES: 3,
  CONFIRMATION_TIMEOUT: 30000,
};

// 🔗 12. الروابط الخارجية
export const EXTERNAL_LINKS = {
  // روابط Solscan للتحقق
  SOLSCAN_PROGRAM: `https://solscan.io/account/${PROGRAM_ID}?cluster=mainnet-beta`,
  SOLSCAN_PRESALE_WALLET: `https://solscan.io/account/${PRESALE_WALLET_ADDRESS}?cluster=mainnet-beta`,
  SOLSCAN_PROGRAM_WALLET: `https://solscan.io/account/${PROGRAM_WALLET_ADDRESS}?cluster=mainnet-beta`,
  SOLSCAN_TOKEN: `https://solscan.io/token/${MECO_MINT}?cluster=mainnet-beta`,
  SOLSCAN_TX: (txId) => `https://solscan.io/tx/${txId}?cluster=mainnet-beta`,
  SOLSCAN_ACCOUNT: (address) => `https://solscan.io/account/${address}?cluster=mainnet-beta`,
  
  // روابط التواصل
  TELEGRAM: 'https://t.me/monycoin1',
  TWITTER: 'https://x.com/MoniCoinMECO',
  WEBSITE: 'https://monycoin1.blogspot.com/',
  GITHUB: 'https://monycoin.github.io/meco-token/MECO_Presale_Funds.html',
  BIRDEYE: `https://birdeye.so/token/${MECO_MINT}?chain=solana`,
  
  // روابط المراجعة الأمنية
  RUGCHECK: `https://rugcheck.xyz/tokens/${MECO_MINT}`,
  DEXSCREENER: `https://dexscreener.com/solana/${MECO_MINT}`,
};

// 💰 13. رسوم المعاملات
export const TRANSACTION_FEES = {
  DEFAULT: 0.000005,
  PRIORITY: 0.00001,
  MAX: 0.00005,
  RENT_EXEMPT: 0.001,
  COMPUTE_UNIT_PRICE: 100000,
};

// ❌ 14. رسائل الأخطاء
export const ERROR_MESSAGES = {
  WALLET_NOT_CONNECTED: 'المحفظة غير متصلة',
  INSUFFICIENT_BALANCE: 'الرصيد غير كافي',
  BELOW_MINIMUM: 'المبلغ أقل من الحد الأدنى',
  ABOVE_MAXIMUM: 'المبلغ أعلى من الحد الأقصى',
  PRESALE_INACTIVE: 'البيع المسبق غير نشط',
  TRANSACTION_FAILED: 'فشلت المعاملة',
  NETWORK_ERROR: 'خطأ في الشبكة',
  CONTRACT_ERROR: 'خطأ في العقد الذكي',
  SIGNATURE_FAILED: 'فشل التحقق من التوقيع',
};

// 🪙 15. بيانات التوكنات
export const TOKENS = {
  MECO: {
    name: 'MonyCoin',
    symbol: 'MECO',
    decimals: 6,
    supply: 1000000000,
    mint: MECO_MINT,
    logoURI: 'https://raw.githubusercontent.com/saadeh73/meco-project/main/meco-logo.png',
    icon: 'rocket-launch',
    description: 'الرمز الرسمي لمشروع MonyCoin',
  },
  SOL: {
    name: 'Solana',
    symbol: 'SOL',
    decimals: 9,
    mint: 'So11111111111111111111111111111111111111112',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    icon: 'diamond',
    description: 'عملة Solana الأساسية',
  },
};

// 🔢 16. الخانات العشرية للتوكنات
export const TOKEN_DECIMALS = {
  [MECO_MINT]: 6,
  'So11111111111111111111111111111111111111112': 9,
};

// 📝 17. أكواد التعليمات للعقد الذكي - تم التصحيح
export const INSTRUCTION_CODES = {
  INITIALIZE_PRESALE: 0,
  PURCHASE_TOKENS: 1,
  INITIALIZE_STAKING: 2,
  STAKE: 3,
  UNSTAKE: 4,
  CLAIM_REWARDS: 5,
  UPDATE_CONFIG: 6,
  EMERGENCY_WITHDRAW: 7,
};

// 👑 18. قائمة المحافظ الإدارية
export const ADMIN_WALLETS = [
  'BNSuEN6GaRF76sc5m7nfNwxDRjxXtsZpctvPpd8sRLCv', // PROGRAM_WALLET
  'E9repjjKBq3RVLw1qckrG15gKth63fe98AHCSgXZzKvY', // PRESALE_WALLET
];

// 🏷️ 19. تسميات المحافظ
export const WALLET_LABELS = {
  'BNSuEN6GaRF76sc5m7nfNwxDRjxXtsZpctvPpd8sRLCv': 'MECO Management Wallet',
  'E9repjjKBq3RVLw1qckrG15gKth63fe98AHCSgXZzKvY': 'MECO Presale Treasury',
  'HXkEZSKictbSYan9ZxQGaHpFrbA4eLDyNtEDxVBkdFy6': 'Fee Collector Wallet',
  'So11111111111111111111111111111111111111112': 'Burn Wallet',
};

// 📈 20. معدلات التحويل
export const CONVERSION_RATES = {
  SOL_TO_MECO: 250000,
  MECO_TO_SOL: 0.000004,
};

// 🔧 21. إعدادات الرسوم الديناميكية
export const FEE_CONFIG = {
  NETWORK_FEE: 0.001,
  SERVICE_FEE_PERCENTAGE: 0.1, // 10%
  MIN_FEE: 0.000005,
  MAX_FEE: 0.01,
};

// ✅ 22. دالة للتحقق من صحة العنوان
export const isValidSolanaAddress = (address) => {
  try {
    const pubKey = new web3.PublicKey(address);
    return web3.PublicKey.isOnCurve(pubKey);
  } catch {
    return false;
  }
};
