import * as web3 from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import bs58 from 'bs58';
import * as SecureStore from 'expo-secure-store';

import {
  MECO_MINT,
  PROGRAM_ID,
  RPC_URL,
  PRESALE_CONFIG,
  STAKING_CONFIG,
  TOKEN_DECIMALS,
  WALLET_ADDRESSES,
  ERROR_MESSAGES
} from '../constants';

const connection = new web3.Connection(RPC_URL, 'confirmed');
const MECO_MINT_PUBKEY = new web3.PublicKey(MECO_MINT);
const PROGRAM_PUBKEY = new web3.PublicKey(PROGRAM_ID);

// =============================================
// 📊 دالات جلب الأرصدة والمعلومات
// =============================================

export async function getSOLBalance() {
  try {
    const pubKey = await SecureStore.getItemAsync('wallet_public_key');
    if (!pubKey) return 0;

    const result = await connection.getBalance(new web3.PublicKey(pubKey));
    return result / 1e9;
  } catch (error) {
    console.error('Error getting SOL balance:', error);
    return 0;
  }
}

export async function getMECOBalance() {
  try {
    const pubKey = await SecureStore.getItemAsync('wallet_public_key');
    if (!pubKey) return 0;

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      new web3.PublicKey(pubKey),
      { programId: splToken.TOKEN_PROGRAM_ID }
    );

    const mecoAccount = tokenAccounts.value.find(
      account => account.account.data.parsed.info.mint === MECO_MINT
    );

    if (mecoAccount) {
      const amount = mecoAccount.account.data.parsed.info.tokenAmount.uiAmount;
      return amount || 0;
    }

    return 0;
  } catch (error) {
    console.error('Error getting MECO balance:', error);
    return 0;
  }
}

export async function getRealTransactionFee() {
  try {
    const fees = await connection.getRecentPrioritizationFees();
    if (fees && fees.length > 0) {
      const total = fees.reduce((sum, f) => sum + f.prioritizationFee, 0);
      const average = total / fees.length;
      return Math.max(0.000005, Math.min(average / 1e9, 0.01));
    }
    return 0.000005;
  } catch (error) {
    console.error('Error getting transaction fee:', error);
    return 0.000005;
  }
}

// =============================================
// 🤝 دالات البيع المسبق (Presale)
// =============================================

export async function getPresaleStats(wallet = null) {
  try {
    // بيانات افتراضية حتى يتم ربط العقود الذكية
    const stats = {
      totalTokens: PRESALE_CONFIG.TOTAL_TOKENS,
      soldTokens: Math.floor(PRESALE_CONFIG.TOTAL_TOKENS * 0.15),
      minSOL: PRESALE_CONFIG.MIN_SOL,
      maxSOL: PRESALE_CONFIG.MAX_SOL,
      rate: PRESALE_CONFIG.RATE,
      isActive: PRESALE_CONFIG.IS_ACTIVE,
      raisedSOL: 0,
      remainingTokens: PRESALE_CONFIG.TOTAL_TOKENS - Math.floor(PRESALE_CONFIG.TOTAL_TOKENS * 0.15),
    };

    return stats;
  } catch (error) {
    console.error('Error getting presale stats:', error);
    return null;
  }
}

export async function buyMECOTransaction(wallet, solAmount) {
  try {
    if (!wallet || !wallet.publicKey) {
      throw new Error(ERROR_MESSAGES.WALLET_NOT_CONNECTED);
    }

    const sol = parseFloat(solAmount);
    if (isNaN(sol) || sol <= 0) {
      throw new Error(ERROR_MESSAGES.INVALID_AMOUNT);
    }

    if (sol < PRESALE_CONFIG.MIN_SOL) {
      throw new Error(`${ERROR_MESSAGES.BELOW_MINIMUM} (${PRESALE_CONFIG.MIN_SOL} SOL)`);
    }

    if (sol > PRESALE_CONFIG.MAX_SOL) {
      throw new Error(`${ERROR_MESSAGES.ABOVE_MAXIMUM} (${PRESALE_CONFIG.MAX_SOL} SOL)`);
    }

    if (!PRESALE_CONFIG.IS_ACTIVE) {
      throw new Error(ERROR_MESSAGES.PRESALE_INACTIVE);
    }

    // 1. حساب المبالغ
    const solAmountLamports = Math.floor(sol * 1e9);
    const mecoToReceive = Math.floor(sol * PRESALE_CONFIG.RATE);
    const mecoDecimals = TOKEN_DECIMALS[MECO_MINT] || 6;
    const mecoAmountLamports = Math.floor(mecoToReceive * Math.pow(10, mecoDecimals));

    const instructions = [];
    const userPublicKey = wallet.publicKey;

    // 2. إنشاء حساب MECO ATA للمستخدم إذا لم يكن موجوداً
    const userMecoATA = await splToken.getAssociatedTokenAddress(
      MECO_MINT_PUBKEY,
      userPublicKey
    );
    
    const userAtaInfo = await connection.getAccountInfo(userMecoATA);
    if (!userAtaInfo) {
      instructions.push(
        splToken.createAssociatedTokenAccountInstruction(
          userPublicKey,
          userMecoATA,
          userPublicKey,
          MECO_MINT_PUBKEY
        )
      );
    }

    // 3. تحويل SOL إلى محفظة البرنامج
    instructions.push(
      web3.SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: PROGRAM_PUBKEY,
        lamports: solAmountLamports,
      })
    );

    // 4. إرسال MECO إلى المستخدم (هذا يحتاج إلى عقود ذكية فعلية)
    // TODO: إضافة تعليمات إرسال MECO من العقد الذكي

    // 5. إنشاء وتوقيع المعاملة
    const transaction = new web3.Transaction().add(...instructions);
    
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;

    // 6. محاكاة المعاملة أولاً
    const simulation = await connection.simulateTransaction(transaction);
    if (simulation.value.err) {
      throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }

    // 7. توقيع المعاملة
    const signedTx = await wallet.signTransaction(transaction);

    // 8. إرسال المعاملة
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    
    // 9. تأكيد المعاملة
    await connection.confirmTransaction(signature, 'confirmed');

    return {
      success: true,
      signature,
      mecoReceived: mecoToReceive,
      solSent: sol,
      message: 'Purchase successful!',
    };
  } catch (error) {
    console.error('Error in buyMECOTransaction:', error);
    return {
      success: false,
      error: error.message,
      message: ERROR_MESSAGES.TRANSACTION_FAILED,
    };
  }
}

// =============================================
// 🏦 دالات Staking
// =============================================

export async function getStakingStats(wallet = null) {
  try {
    const stats = {
      apr: STAKING_CONFIG.APR,
      totalStaked: 0,
      totalStakers: 0,
      minStake: STAKING_CONFIG.MIN_STAKE,
      maxStake: STAKING_CONFIG.MAX_STAKE,
      unstakePeriod: STAKING_CONFIG.UNSTAKE_PERIOD,
      isActive: STAKING_CONFIG.IS_ACTIVE,
      userStaked: 0,
      userRewards: 0,
    };

    if (wallet && wallet.publicKey) {
      // TODO: جلب بيانات Staking الخاصة بالمستخدم
    }

    return stats;
  } catch (error) {
    console.error('Error getting staking stats:', error);
    return null;
  }
}

export async function stakeMECO(wallet, mecoAmount) {
  try {
    if (!wallet || !wallet.publicKey) {
      throw new Error(ERROR_MESSAGES.WALLET_NOT_CONNECTED);
    }

    const amount = parseFloat(mecoAmount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error(ERROR_MESSAGES.INVALID_AMOUNT);
    }

    if (amount < STAKING_CONFIG.MIN_STAKE) {
      throw new Error(`${ERROR_MESSAGES.BELOW_MINIMUM} (${STAKING_CONFIG.MIN_STAKE} MECO)`);
    }

    if (amount > STAKING_CONFIG.MAX_STAKE) {
      throw new Error(`${ERROR_MESSAGES.ABOVE_MAXIMUM} (${STAKING_CONFIG.MAX_STAKE} MECO)`);
    }

    if (!STAKING_CONFIG.IS_ACTIVE) {
      throw new Error(ERROR_MESSAGES.STAKING_INACTIVE);
    }

    // TODO: تنفيذ Staking مع العقود الذكية

    return {
      success: true,
      message: 'Staking successful!',
      amountStaked: amount,
    };
  } catch (error) {
    console.error('Error in stakeMECO:', error);
    return {
      success: false,
      error: error.message,
      message: ERROR_MESSAGES.TRANSACTION_FAILED,
    };
  }
}

// =============================================
// 🔧 دالات مساعدة
// =============================================

export async function initProgram(wallet) {
  try {
    if (!wallet) {
      console.warn('No wallet provided for program initialization');
      return null;
    }

    console.log('✅ Program initialized with wallet:', wallet.publicKey.toBase58());
    return {
      connection,
      wallet,
      programId: PROGRAM_PUBKEY,
    };
  } catch (error) {
    console.error('Error initializing program:', error);
    return null;
  }
}

export async function simulateTransaction(transaction) {
  try {
    const simulation = await connection.simulateTransaction(transaction);
    return {
      success: !simulation.value.err,
      logs: simulation.value.logs || [],
      error: simulation.value.err,
    };
  } catch (error) {
    console.error('Error simulating transaction:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function getTransactionHistory(publicKey, limit = 10) {
  try {
    const signatures = await connection.getSignaturesForAddress(
      new web3.PublicKey(publicKey),
      { limit }
    );
    return signatures;
  } catch (error) {
    console.error('Error getting transaction history:', error);
    return [];
  }
}

export async function validateWalletAddress(address) {
  try {
    const pubKey = new web3.PublicKey(address);
    return web3.PublicKey.isOnCurve(pubKey);
  } catch {
    return false;
  }
}

export async function getNetworkFee() {
  try {
    const fees = await connection.getRecentPrioritizationFees();
    let fee = 0.001;
    
    if (fees && fees.length > 0) {
      const totalFees = fees.reduce((sum, f) => sum + f.prioritizationFee, 0);
      fee = (totalFees / fees.length) / 1e9;
    }
    
    const minFee = 0.000005;
    const maxFee = 0.01;
    return Math.max(minFee, Math.min(fee, maxFee));
  } catch (error) {
    console.warn('Failed to fetch network fee:', error);
    return 0.001;
  }
}
