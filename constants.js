// constants.js - ثوابت مشروع MECO Wallet (محدث)
export const MECO_MINT = '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i';
export const PROGRAM_ID = '6SVpAYhP7XkKtW6SuRbdTRv1pjaVUDZP3ZQg9rLqGLzp';
export const RPC_URL = 'https://api.mainnet-beta.solana.com';

export const PRESALE_CONFIG = {
  MIN_SOL: 0.05,
  MAX_SOL: 1,
  RATE: 250000,
  TOTAL_TOKENS: 50000000,
  DECIMALS: 6,
  IS_ACTIVE: true,
};

export const STAKING_CONFIG = {
  APR: 18.5,
  MIN_STAKE: 100,
  MAX_STAKE: 1000000,
  UNSTAKE_PERIOD: 3,
  DECIMALS: 6,
  IS_ACTIVE: true,
};

export const PDA_SEEDS = {
  PROTOCOL: 'protocol',
  PRESALE_VAULT: 'presale_vault',
  STAKING_VAULT: 'staking_vault',
  REWARDS_VAULT: 'rewards_vault',
  STAKE_ACCOUNT: 'stake',
};

export const WALLET_ADDRESSES = {
  PRESALE_TREASURY: '6SVpAYhP7XkKtW6SuRbdTRv1pjaVUDZP3ZQg9rLqGLzp',
  STAKING_TREASURY: '6SVpAYhP7XkKtW6SuRbdTRv1pjaVUDZP3ZQg9rLqGLzp',
  FEE_COLLECTOR: 'HXkEZSKictbSYan9ZxQGaHpFrbA4eLDyNtEDxVBkdFy6',
};

export const NETWORK_CONFIG = {
  DEVNET: 'devnet',
  MAINNET: 'mainnet-beta',
  COMMITMENT: 'confirmed',
  TIMEOUT: 60000,
};

export const EXTERNAL_LINKS = {
  SOLSCAN_TX: (txId) => `https://solscan.io/tx/${txId}`,
  SOLSCAN_ACCOUNT: (address) => `https://solscan.io/account/${address}`,
  SOLSCAN_TOKEN: (mint) => `https://solscan.io/token/${mint}`,
  TELEGRAM: 'https://t.me/monycoin1',
  TWITTER: 'https://x.com/MoniCoinMECO',
  WEBSITE: 'https://monycoin1.blogspot.com/',
  GITHUB: 'https://monycoin.github.io/meco-token/MECO_Presale_Funds.html',
  BIRDEYE: (mint) => `https://birdeye.so/token/${mint}?chain=solana`,
};

export const TRANSACTION_FEES = {
  DEFAULT: 0.000005,
  PRIORITY: 0.00001,
  MAX: 0.00005,
  RENT_EXEMPT: 0.001,
};

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

export const TOKENS = {
  MECO: {
    name: 'MonyCoin',
    symbol: 'MECO',
    decimals: 6,
    supply: 1000000000,
    mint: '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i',
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

export const TOKEN_DECIMALS = {
  '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i': 6,
  'So11111111111111111111111111111111111111112': 9,
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6,
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6,
};

export const INSTRUCTION_CODES = {
  INITIALIZE: 0,
  BUY_PRESALE: 1,
  STAKE: 2,
  UNSTAKE: 3,
  CLAIM_REWARDS: 4,
  WITHDRAW_FUNDS: 5,
};

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

export const ADMIN_WALLETS = [
  '6SVpAYhP7XkKtW6SuRbdTRv1pjaVUDZP3ZQg9rLqGLzp',
  'HXkEZSKictbSYan9ZxQGaHpFrbA4eLDyNtEDxVBkdFy6',
];
