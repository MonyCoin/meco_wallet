// solanaService.js - التكامل مع العقد الجديد
import { Connection, PublicKey, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress,
  getAccount
} from '@solana/spl-token';

// ✅ استيراد الثوابت الجديدة
import { 
  PROGRAM_ID, 
  RPC_URL, 
  MECO_MINT, 
  PRESALE_CONFIG, 
  STAKING_CONFIG,
  PDA_SEEDS,
  ERROR_MESSAGES 
} from '../constants';

// ✅ استيراد IDL من العقد الجديد
import IDL from '../contracts/monycoin_meco.json';

// إنشاء اتصال Solana
export const connection = new Connection(RPC_URL, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000
});

// متغيرات حالة
export let PRESALE_WALLET_ADDRESS = '';
export let PROGRAM_INSTANCE = null;

// =================== دوال إيجاد PDA (الجديدة) ===================
export const findProtocolPDA = () => {
  try {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(PDA_SEEDS.PROTOCOL)],
      new PublicKey(PROGRAM_ID)
    );
  } catch (error) {
    console.warn('❌ فشل إيجاد Protocol PDA:', error);
    return [null, null];
  }
};

export const findPresaleVaultPDA = () => {
  try {
    const [protocolPDA] = findProtocolPDA();
    return PublicKey.findProgramAddressSync(
      [Buffer.from(PDA_SEEDS.PRESALE_VAULT), protocolPDA.toBuffer()],
      new PublicKey(PROGRAM_ID)
    );
  } catch (error) {
    console.warn('❌ فشل إيجاد Presale Vault PDA:', error);
    return [null, null];
  }
};

export const findStakingVaultPDA = () => {
  try {
    const [protocolPDA] = findProtocolPDA();
    return PublicKey.findProgramAddressSync(
      [Buffer.from(PDA_SEEDS.STAKING_VAULT), protocolPDA.toBuffer()],
      new PublicKey(PROGRAM_ID)
    );
  } catch (error) {
    console.warn('❌ فشل إيجاد Staking Vault PDA:', error);
    return [null, null];
  }
};

export const findRewardsVaultPDA = () => {
  try {
    const [protocolPDA] = findProtocolPDA();
    return PublicKey.findProgramAddressSync(
      [Buffer.from(PDA_SEEDS.REWARDS_VAULT), protocolPDA.toBuffer()],
      new PublicKey(PROGRAM_ID)
    );
  } catch (error) {
    console.warn('❌ فشل إيجاد Rewards Vault PDA:', error);
    return [null, null];
  }
};

export const findStakeAccountPDA = (userPublicKey) => {
  try {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(PDA_SEEDS.STAKE_ACCOUNT), userPublicKey.toBuffer()],
      new PublicKey(PROGRAM_ID)
    );
  } catch (error) {
    console.warn('❌ فشل إيجاد Stake Account PDA:', error);
    return [null, null];
  }
};

// =================== تهيئة البرنامج ===================
export const initProgram = (wallet) => {
  try {
    if (!wallet?.publicKey) return null;
    
    const provider = new AnchorProvider(connection, wallet, { 
      commitment: 'confirmed' 
    });
    
    const program = new Program(IDL, new PublicKey(PROGRAM_ID), provider);
    PROGRAM_INSTANCE = program;
    
    console.log('✅ البرنامج مهيأ:', PROGRAM_ID);
    return program;
  } catch (error) {
    console.error('❌ فشل تهيئة البرنامج:', error);
    return null;
  }
};

// =================== البيع المسبق ===================
export const getPresaleStats = async (wallet) => {
  try {
    const program = PROGRAM_INSTANCE || initProgram(wallet);
    if (!program) {
      console.log('ℹ️ استخدام بيانات افتراضية - البرنامج غير مهيأ');
      return getDefaultPresaleStats();
    }

    const [protocolPDA] = findProtocolPDA();
    if (!protocolPDA) return getDefaultPresaleStats();

    try {
      const protocolData = await program.account.protocol.fetch(protocolPDA);
      const [presaleVaultPDA] = findPresaleVaultPDA();
      
      let currentBalance = 0;
      if (presaleVaultPDA) {
        const balance = await connection.getBalance(presaleVaultPDA);
        currentBalance = balance / LAMPORTS_PER_SOL;
        PRESALE_WALLET_ADDRESS = presaleVaultPDA.toBase58();
      }

      return {
        totalTokens: Number(protocolData.presaleTotal) / 10 ** PRESALE_CONFIG.DECIMALS,
        soldTokens: Number(protocolData.presaleSold) / 10 ** PRESALE_CONFIG.DECIMALS,
        minSOL: Number(protocolData.presaleMin) / LAMPORTS_PER_SOL,
        maxSOL: Number(protocolData.presaleMax) / LAMPORTS_PER_SOL,
        rate: Number(protocolData.presaleRate),
        progress: protocolData.presaleTotal > 0 
          ? Math.min(100, (Number(protocolData.presaleSold) / Number(protocolData.presaleTotal)) * 100)
          : 0,
        currentBalance,
        isActive: protocolData.isActive,
        mecoMint: protocolData.mecoMint?.toBase58() || MECO_MINT,
        apr: Number(protocolData.stakingApr) / 100, // تحويل إلى نسبة مئوية
      };
    } catch (error) {
      console.warn('⚠️ استخدام بيانات افتراضية:', error.message);
      return getDefaultPresaleStats();
    }
  } catch (error) {
    console.error('❌ خطأ في getPresaleStats:', error);
    return getDefaultPresaleStats();
  }
};

// دالة مساعدة للبيانات الافتراضية
const getDefaultPresaleStats = () => ({
  totalTokens: PRESALE_CONFIG.TOTAL_TOKENS,
  soldTokens: 0,
  minSOL: PRESALE_CONFIG.MIN_SOL,
  maxSOL: PRESALE_CONFIG.MAX_SOL,
  rate: PRESALE_CONFIG.RATE,
  progress: 0,
  currentBalance: 0,
  isActive: true,
  mecoMint: MECO_MINT,
  apr: STAKING_CONFIG.APR,
});

export const buyMECOTransaction = async (wallet, amountSOL) => {
  try {
    if (!wallet?.publicKey) throw new Error(ERROR_MESSAGES.WALLET_NOT_CONNECTED);
    if (amountSOL <= 0) throw new Error('المبلغ يجب أن يكون أكبر من الصفر');

    const balance = await getSOLBalance(wallet.publicKey);
    if (balance < amountSOL) throw new Error(ERROR_MESSAGES.INSUFFICIENT_BALANCE);

    const program = PROGRAM_INSTANCE || initProgram(wallet);
    if (!program) throw new Error('البرنامج غير مهيأ');

    const [protocolPDA] = findProtocolPDA();
    const [presaleVaultPDA] = findPresaleVaultPDA();

    if (!protocolPDA || !presaleVaultPDA) {
      throw new Error('فشل في إيجاد الحسابات المطلوبة');
    }

    // التحقق من الحدود
    if (amountSOL < PRESALE_CONFIG.MIN_SOL) {
      throw new Error(`${ERROR_MESSAGES.BELOW_MINIMUM} (${PRESALE_CONFIG.MIN_SOL} SOL)`);
    }
    if (amountSOL > PRESALE_CONFIG.MAX_SOL) {
      throw new Error(`${ERROR_MESSAGES.ABOVE_MAXIMUM} (${PRESALE_CONFIG.MAX_SOL} SOL)`);
    }

    const mecoMint = new PublicKey(MECO_MINT);
    const buyerTokenAccount = await getAssociatedTokenAddress(mecoMint, wallet.publicKey);
    const mecoVault = await getAssociatedTokenAddress(mecoMint, protocolPDA, true);
    const amountLamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);

    console.log('📝 إعداد معاملة الشراء...', {
      buyer: wallet.publicKey.toBase58(),
      amountSOL,
      amountLamports,
      rate: PRESALE_CONFIG.RATE
    });

    const tx = await program.methods
      .buyTokens(new BN(amountLamports))
      .accounts({
        protocol: protocolPDA,
        buyer: wallet.publicKey,
        treasury: presaleVaultPDA,
        mecoVault: mecoVault,
        buyerTokenAccount: buyerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([wallet])
      .rpc();

    console.log('✅ تم إرسال المعاملة:', tx);
    await connection.confirmTransaction(tx, 'confirmed');

    const mecoAmount = Math.floor(amountSOL * PRESALE_CONFIG.RATE);

    return {
      success: true,
      signature: tx,
      mecoReceived: mecoAmount,
      message: 'تم الشراء بنجاح',
      amount: amountSOL,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ خطأ في الشراء:', error);
    return {
      success: false,
      error: error.message,
      message: `${ERROR_MESSAGES.TRANSACTION_FAILED}: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
};

// =================== Staking ===================
export const stakeMECO = async (wallet, amountMECO) => {
  try {
    if (!wallet?.publicKey) throw new Error(ERROR_MESSAGES.WALLET_NOT_CONNECTED);
    if (amountMECO <= 0) throw new Error('المبلغ يجب أن يكون أكبر من الصفر');

    const balance = await getMECOBalance(wallet.publicKey);
    if (balance < amountMECO) throw new Error(ERROR_MESSAGES.INSUFFICIENT_BALANCE);

    if (amountMECO < STAKING_CONFIG.MIN_STAKE) {
      throw new Error(`الحد الأدنى للتثبيت هو ${STAKING_CONFIG.MIN_STAKE} MECO`);
    }

    const program = PROGRAM_INSTANCE || initProgram(wallet);
    if (!program) throw new Error('البرنامج غير مهيأ');

    const [protocolPDA] = findProtocolPDA();
    const [stakeAccountPDA] = findStakeAccountPDA(wallet.publicKey);
    const [stakingVaultPDA] = findStakingVaultPDA();

    const mecoMint = new PublicKey(MECO_MINT);
    const userTokenAccount = await getAssociatedTokenAddress(mecoMint, wallet.publicKey);
    const amountLamports = Math.floor(amountMECO * 10 ** STAKING_CONFIG.DECIMALS);

    console.log('📝 إعداد معاملة التثبيت...', {
      user: wallet.publicKey.toBase58(),
      amountMECO,
      amountLamports,
    });

    const tx = await program.methods
      .stake(new BN(amountLamports))
      .accounts({
        protocol: protocolPDA,
        user: wallet.publicKey,
        stakeAccount: stakeAccountPDA,
        userTokenAccount: userTokenAccount,
        stakingVault: stakingVaultPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet])
      .rpc();

    console.log('✅ تم إرسال معاملة التثبيت:', tx);
    await connection.confirmTransaction(tx, 'confirmed');

    return {
      success: true,
      signature: tx,
      amountStaked: amountMECO,
      message: 'تم التثبيت بنجاح',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ خطأ في التثبيت:', error);
    return {
      success: false,
      error: error.message,
      message: `${ERROR_MESSAGES.TRANSACTION_FAILED}: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
};

export const unstakeMECO = async (wallet, amountMECO) => {
  try {
    if (!wallet?.publicKey) throw new Error(ERROR_MESSAGES.WALLET_NOT_CONNECTED);
    if (amountMECO <= 0) throw new Error('المبلغ يجب أن يكون أكبر من الصفر');

    const program = PROGRAM_INSTANCE || initProgram(wallet);
    if (!program) throw new Error('البرنامج غير مهيأ');

    const [protocolPDA] = findProtocolPDA();
    const [stakeAccountPDA] = findStakeAccountPDA(wallet.publicKey);
    const [stakingVaultPDA] = findStakingVaultPDA();
    const [rewardsVaultPDA] = findRewardsVaultPDA();

    const mecoMint = new PublicKey(MECO_MINT);
    const userTokenAccount = await getAssociatedTokenAddress(mecoMint, wallet.publicKey);
    const amountLamports = Math.floor(amountMECO * 10 ** STAKING_CONFIG.DECIMALS);

    console.log('📝 إعداد معاملة السحب...', {
      user: wallet.publicKey.toBase58(),
      amountMECO,
      amountLamports,
    });

    const tx = await program.methods
      .unstake(new BN(amountLamports))
      .accounts({
        protocol: protocolPDA,
        user: wallet.publicKey,
        stakeAccount: stakeAccountPDA,
        userTokenAccount: userTokenAccount,
        stakingVault: stakingVaultPDA,
        rewardsVault: rewardsVaultPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([wallet])
      .rpc();

    console.log('✅ تم إرسال معاملة السحب:', tx);
    await connection.confirmTransaction(tx, 'confirmed');

    return {
      success: true,
      signature: tx,
      amountUnstaked: amountMECO,
      message: 'تم السحب بنجاح',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ خطأ في السحب:', error);
    return {
      success: false,
      error: error.message,
      message: `${ERROR_MESSAGES.TRANSACTION_FAILED}: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
};

export const claimRewards = async (wallet) => {
  try {
    if (!wallet?.publicKey) throw new Error(ERROR_MESSAGES.WALLET_NOT_CONNECTED);

    const program = PROGRAM_INSTANCE || initProgram(wallet);
    if (!program) throw new Error('البرنامج غير مهيأ');

    const [protocolPDA] = findProtocolPDA();
    const [stakeAccountPDA] = findStakeAccountPDA(wallet.publicKey);
    const [rewardsVaultPDA] = findRewardsVaultPDA();

    const mecoMint = new PublicKey(MECO_MINT);
    const userTokenAccount = await getAssociatedTokenAddress(mecoMint, wallet.publicKey);

    console.log('📝 إعداد معاملة المطالبة بالمكافآت...', {
      user: wallet.publicKey.toBase58(),
    });

    const tx = await program.methods
      .claimRewards()
      .accounts({
        protocol: protocolPDA,
        user: wallet.publicKey,
        stakeAccount: stakeAccountPDA,
        userTokenAccount: userTokenAccount,
        rewardsVault: rewardsVaultPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([wallet])
      .rpc();

    console.log('✅ تم إرسال معاملة المكافآت:', tx);
    await connection.confirmTransaction(tx, 'confirmed');

    return {
      success: true,
      signature: tx,
      message: 'تم المطالبة بالمكافآت بنجاح',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ خطأ في المطالبة بالمكافآت:', error);
    return {
      success: false,
      error: error.message,
      message: `${ERROR_MESSAGES.TRANSACTION_FAILED}: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
};

// =================== دوال المساعدة ===================
export const getSOLBalance = async (publicKey) => {
  if (!publicKey) {
    console.warn('⚠️ لا يوجد عنوان محفظة لطلب الرصيد');
    return 0;
  }

  try {
    const pubKey = new PublicKey(publicKey);
    const balance = await connection.getBalance(pubKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.warn('❌ خطأ في جلب رصيد SOL:', error.message);
    return 0;
  }
};

export const getMECOBalance = async (walletAddress, mecoMint = MECO_MINT) => {
  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(walletAddress),
      { programId: TOKEN_PROGRAM_ID }
    );

    const mecoAccount = tokenAccounts.value.find(acc =>
      acc.account.data.parsed.info.mint === mecoMint
    );

    return mecoAccount ? mecoAccount.account.data.parsed.info.tokenAmount.uiAmount : 0;
  } catch (error) {
    console.error('❌ خطأ في جلب رصيد MECO:', error);
    return 0;
  }
};

export const getStakeData = async (wallet) => {
  try {
    if (!wallet?.publicKey) return null;

    const program = PROGRAM_INSTANCE || initProgram(wallet);
    if (!program) return null;

    const [stakeAccountPDA] = findStakeAccountPDA(wallet.publicKey);
    
    try {
      const stakeData = await program.account.stakeAccount.fetch(stakeAccountPDA);
      
      const currentTime = Math.floor(Date.now() / 1000);
      const timeStaked = currentTime - Number(stakeData.stakeTime);
      const amountStaked = Number(stakeData.amount) / 10 ** STAKING_CONFIG.DECIMALS;
      
      // حساب المكافآت
      const dailyReward = (amountStaked * STAKING_CONFIG.APR) / 365 / 100;
      const earnedRewards = dailyReward * (timeStaked / (24 * 60 * 60));
      
      return {
        user: stakeData.user.toBase58(),
        amount: amountStaked,
        stakeTime: Number(stakeData.stakeTime),
        lastClaimTime: Number(stakeData.lastClaimTime),
        rewardsClaimed: Number(stakeData.rewardsClaimed) / 10 ** STAKING_CONFIG.DECIMALS,
        currentRewards: earnedRewards,
        totalStakedTime: timeStaked,
        canUnstake: timeStaked >= (STAKING_CONFIG.UNSTAKE_PERIOD * 24 * 60 * 60),
        remainingTime: Math.max(0, (STAKING_CONFIG.UNSTAKE_PERIOD * 24 * 60 * 60) - timeStaked),
      };
    } catch (error) {
      // لا يوجد حساب staking بعد
      return {
        user: wallet.publicKey.toBase58(),
        amount: 0,
        stakeTime: 0,
        lastClaimTime: 0,
        rewardsClaimed: 0,
        currentRewards: 0,
        totalStakedTime: 0,
        canUnstake: false,
        remainingTime: 0,
      };
    }
  } catch (error) {
    console.error('❌ خطأ في جلب بيانات التثبيت:', error);
    return null;
  }
};

export const isValidSolanaAddress = (address) => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

export const getRealTransactionFee = async () => {
  try {
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    const feeCalculator = await connection.getFeeCalculatorForBlockhash(blockhash);
    return feeCalculator?.value?.lamportsPerSignature 
      ? feeCalculator.value.lamportsPerSignature / LAMPORTS_PER_SOL 
      : 0.000005;
  } catch (error) {
    console.warn('ℹ️ استخدام رسوم افتراضية:', error.message);
    return 0.000005;
  }
};

export const getSolscanLink = (address) => {
  return `https://solscan.io/account/${address}?cluster=devnet`;
};

export const updatePresaleWalletAddress = (address) => {
  PRESALE_WALLET_ADDRESS = address;
};

export const checkSolanaConnection = async () => {
  try {
    const version = await connection.getVersion();
    console.log('✅ اتصال Solana نشط:', version);
    return true;
  } catch (error) {
    console.error('❌ فشل اتصال Solana:', error);
    return false;
  }
};

// دالة لتحديث كل الأرصدة دفعة واحدة
export const refreshAllBalances = async (wallet) => {
  try {
    if (!wallet?.publicKey) return null;

    const [solBalance, mecoBalance, stakeData] = await Promise.all([
      getSOLBalance(wallet.publicKey),
      getMECOBalance(wallet.publicKey),
      getStakeData(wallet),
    ]);

    return {
      solBalance,
      mecoBalance,
      stakeData,
      walletAddress: wallet.publicKey.toBase58(),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ خطأ في تحديث الأرصدة:', error);
    return null;
  }
};

// دالة للتحقق من حالة العقد
export const checkContractStatus = async () => {
  try {
    const [protocolPDA] = findProtocolPDA();
    if (!protocolPDA) return null;

    const program = PROGRAM_INSTANCE;
    if (!program) return null;

    const protocolData = await program.account.protocol.fetch(protocolPDA);
    
    return {
      isActive: protocolData.isActive,
      presaleSold: Number(protocolData.presaleSold) / 10 ** PRESALE_CONFIG.DECIMALS,
      presaleTotal: Number(protocolData.presaleTotal) / 10 ** PRESALE_CONFIG.DECIMALS,
      stakingApr: Number(protocolData.stakingApr) / 100,
      minStake: Number(protocolData.minStake) / 10 ** STAKING_CONFIG.DECIMALS,
      unstakePeriod: Number(protocolData.unstakePeriod),
      authority: protocolData.authority.toBase58(),
    };
  } catch (error) {
    console.warn('⚠️ تعذر التحقق من حالة العقد:', error.message);
    return null;
  }
};
