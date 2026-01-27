// constants.js - ثوابت مشروع MECO Wallet (العقد الجديد)
export const MECO_MINT = '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i';
export const PROGRAM_ID = '6SVpAYhP7XkKtW6SuRbdTRv1pjaVUDZP3ZQg9rLqGLzp';
export const RPC_URL = 'https://api.devnet.solana.com';

export const PRESALE_CONFIG = {
  MIN_SOL: 0.05,    // 0.05 SOL
  MAX_SOL: 1,       // 1 SOL
  RATE: 250000,     // 250,000 MECO per SOL
  TOTAL_TOKENS: 50000000,
  DECIMALS: 9,
};

export const STAKING_CONFIG = {
  APR: 18.5,
  MIN_STAKE: 100,
  MAX_STAKE: 1000000,
  UNSTAKE_PERIOD: 3, // أيام
  DECIMALS: 9,
};

// PDAs الثابتة (لا تتغير)
export const PDA_SEEDS = {
  PROTOCOL: 'protocol',
  PRESALE_VAULT: 'presale_vault',
  STAKING_VAULT: 'staking_vault',
  REWARDS_VAULT: 'rewards_vault',
  STAKE_ACCOUNT: 'stake',
};

// عناوين محافظ استقبال الأموال (تعديل حسب الحاجة)
export const WALLET_ADDRESSES = {
  PRESALE_TREASURY: '6SVpAYhP7XkKtW6SuRbdTRv1pjaVUDZP3ZQg9rLqGLzp', // نفس البرنامج
  STAKING_TREASURY: '6SVpAYhP7XkKtW6SuRbdTRv1pjaVUDZP3ZQg9rLqGLzp',
};

// إعدادات الشبكة
export const NETWORK_CONFIG = {
  DEVNET: 'devnet',
  MAINNET: 'mainnet-beta',
  COMMITMENT: 'confirmed',
  TIMEOUT: 60000,
};

// روابط خارجية
export const EXTERNAL_LINKS = {
  SOLSCAN_TX: (txId) => `https://solscan.io/tx/${txId}?cluster=devnet`,
  SOLSCAN_ACCOUNT: (address) => `https://solscan.io/account/${address}?cluster=devnet`,
  SOLSCAN_TOKEN: (mint) => `https://solscan.io/token/${mint}?cluster=devnet`,
  TELEGRAM: 'https://t.me/monycoin1',
  TWITTER: 'https://x.com/MoniCoinMECO',
  WEBSITE: 'https://monycoin1.blogspot.com/',
  GITHUB: 'https://monycoin.github.io/meco-token/MECO_Presale_Funds.html',
};

// رسوم المعاملات
export const TRANSACTION_FEES = {
  DEFAULT: 0.000005, // 5000 lamports
  PRIORITY: 0.00001, // 10000 lamports
  MAX: 0.00005,      // 50000 lamports
};

// الأخطاء الشائعة
export const ERROR_MESSAGES = {
  WALLET_NOT_CONNECTED: 'المحفظة غير متصلة',
  INSUFFICIENT_BALANCE: 'الرصيد غير كافي',
  BELOW_MINIMUM: 'المبلغ أقل من الحد الأدنى',
  ABOVE_MAXIMUM: 'المبلغ أعلى من الحد الأقصى',
  PRESALE_INACTIVE: 'البيع المسبق غير نشط',
  TRANSACTION_FAILED: 'فشلت المعاملة',
  NETWORK_ERROR: 'خطأ في الشبكة',
  CONTRACT_ERROR: 'خطأ في العقد الذكي',
};

// التوكن الأساسية
export const TOKENS = {
  MECO: {
    name: 'MECO',
    symbol: 'MECO',
    decimals: 9,
    supply: 1000000000,
    mint: '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i',
  },
  SOL: {
    name: 'Solana',
    symbol: 'SOL',
    decimals: 9,
  },
};
