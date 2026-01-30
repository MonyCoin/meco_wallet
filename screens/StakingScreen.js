import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
  TextInput,
  Modal,
  Animated,
  Linking
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as web3 from '@solana/web3.js';
import bs58 from 'bs58';
import * as splToken from '@solana/spl-token';
import { BN } from 'bn.js';
import * as SecureStore from 'expo-secure-store';

import { getSolBalance, getMecoBalance } from '../services/heliusService';
import { 
  MECO_MINT, 
  PROGRAM_ID, 
  RPC_URL,
  STAKING_CONFIG,
  TOKEN_DECIMALS,
  PDA_SEEDS,
  INSTRUCTION_CODES,
  EXTERNAL_LINKS,
  FEE_COLLECTOR_ADDRESS,
  ERROR_MESSAGES
} from '../constants';

const { width } = Dimensions.get('window');
const connection = new web3.Connection(RPC_URL, 'confirmed');
const MECO_MINT_PUBKEY = new web3.PublicKey(MECO_MINT);
const PROGRAM_ID_PUBKEY = new web3.PublicKey(PROGRAM_ID);
const FEE_COLLECTOR_PUBKEY = new web3.PublicKey(FEE_COLLECTOR_ADDRESS);

// دالة التحقق من صحة المفتاح الخاص
const validatePrivateKey = async () => {
  try {
    console.log('🔑 بدء التحقق من المفتاح الخاص للتخزين...');
    
    // أولاً: جلب المفتاح الخاص من SecureStore
    const secretKeyStr = await SecureStore.getItemAsync('wallet_private_key');
    if (!secretKeyStr) {
      console.error('❌ المفتاح الخاص غير موجود في SecureStore');
      throw new Error(ERROR_MESSAGES.WALLET_NOT_CONNECTED);
    }

    let parsedKey;
    try {
      // محاولة تحليل المفتاح بعدة صيغ
      if (secretKeyStr.startsWith('[')) {
        parsedKey = Uint8Array.from(JSON.parse(secretKeyStr));
      } else {
        parsedKey = bs58.decode(secretKeyStr);
      }
    } catch (error) {
      console.error('❌ فشل في تحليل المفتاح الخاص:', error);
      throw new Error('تنسيق المفتاح الخاص غير صالح');
    }

    console.log(`📏 طول المفتاح: ${parsedKey.length} بايت`);
    
    // قبول 32 أو 64 بايت
    let keypair;
    if (parsedKey.length === 64) {
      keypair = web3.Keypair.fromSecretKey(parsedKey);
    } else if (parsedKey.length === 32) {
      keypair = web3.Keypair.fromSeed(parsedKey.slice(0, 32));
    } else {
      console.error(`❌ طول غير مدعوم: ${parsedKey.length}`);
      throw new Error(`طول المفتاح غير مدعوم: ${parsedKey.length} بايت`);
    }
    
    // التحقق من المفتاح العام
    const fromPubkey = keypair.publicKey;
    const storedPubkey = await SecureStore.getItemAsync('wallet_public_key');
    
    console.log('🔐 مقارنة المفاتيح العامة:', {
      stored: storedPubkey,
      calculated: fromPubkey.toBase58(),
      match: storedPubkey === fromPubkey.toBase58()
    });
    
    if (!storedPubkey || storedPubkey !== fromPubkey.toBase58()) {
      console.log('🔄 تحديث المفتاح العام المخزن...');
      await SecureStore.setItemAsync('wallet_public_key', fromPubkey.toBase58());
      // تحديث الـ store أيضاً
      useAppStore.getState().setCurrentWallet(fromPubkey.toBase58());
    }
    
    console.log('✅ المفتاح الخاص صالح');
    return keypair;
  } catch (error) {
    console.error('❌ خطأ في التحقق من المفتاح الخاص:', error);
    throw error;
  }
};

// التحقق من تواقيع المعاملة
const verifyTransactionSignatures = (tx, requiredSigners) => {
  try {
    console.log(`📌 التحقق من ${requiredSigners.length} موقع مطلوب`);
    
    // تحقق من كل موقع مطلوب
    for (const signerPubkey of requiredSigners) {
      const signatureExists = tx.signatures.some(sig => 
        sig.publicKey.toBase58() === signerPubkey.toBase58() && 
        sig.signature !== null
      );
      
      if (!signatureExists) {
        console.error(`❌ الموقع مطلوب: ${signerPubkey.toBase58()}`);
        return false;
      }
    }
    
    console.log('✅ تم توقيع المعاملة بنجاح بواسطة جميع الموقعين المطلوبين');
    return true;
  } catch (error) {
    console.error('❌ خطأ في التحقق من التواقيع:', error);
    return false;
  }
};

export default function StakingScreen() {
  const { t } = useTranslation();
  const theme = useAppStore(s => s.theme);
  const primaryColor = useAppStore(s => s.primaryColor);
  const currentWallet = useAppStore(s => s.currentWallet);
  const setCurrentWallet = useAppStore(s => s.setCurrentWallet);
  const isDark = theme === 'dark';

  const colors = {
    background: isDark ? '#0A0F1E' : '#F8FAFF',
    card: isDark ? '#1A2236' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#1A1A1A',
    textSecondary: isDark ? '#A0A0B0' : '#6B7280',
    border: isDark ? '#2D3A5E' : '#E8EDF5',
    success: '#10B981',
    danger: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
    purple: '#8B5CF6',
  };

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [showUnstakeModal, setShowUnstakeModal] = useState(false);
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [userSOLBalance, setUserSOLBalance] = useState(0);
  const [userMECOBalance, setUserMECOBalance] = useState(0);
  const [transactionResult, setTransactionResult] = useState(null);
  const [serviceFee] = useState(0.0001); // 0.0001 SOL رسوم خدمة

  const [stakingData, setStakingData] = useState({
    apr: STAKING_CONFIG.APR,
    totalStaked: 0,
    totalStakers: 0,
    minStake: STAKING_CONFIG.MIN_STAKE,
    maxStake: STAKING_CONFIG.MAX_STAKE,
    unstakePeriod: STAKING_CONFIG.UNSTAKE_PERIOD,
    isActive: STAKING_CONFIG.IS_ACTIVE,
    userStaked: 0,
    userRewards: 0,
    userPendingRewards: 0,
    userUnstaking: [],
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // 📱 تأثيرات الدخول
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    if (currentWallet) {
      fetchStakingData();
      fetchUserBalance();
    }
  }, [currentWallet]);

  // 💰 جلب أرصدة المستخدم
  const fetchUserBalance = async () => {
    if (!currentWallet) {
      setUserSOLBalance(0);
      setUserMECOBalance(0);
      return;
    }
    
    try {
      const [solBalance, mecoBalance] = await Promise.all([
        getSolBalance(),
        getMecoBalance()
      ]);
      
      setUserSOLBalance(solBalance);
      setUserMECOBalance(mecoBalance);
    } catch (error) {
      console.error('❌ Error fetching balances for staking:', error);
      setUserSOLBalance(0);
      setUserMECOBalance(0);
    }
  };

  // 📊 جلب بيانات Staking من العقد الذكي
  const fetchStakingData = async () => {
    try {
      setLoading(true);
      
      if (!currentWallet) {
        setStakingData({
          apr: STAKING_CONFIG.APR,
          totalStaked: 0,
          totalStakers: 0,
          minStake: STAKING_CONFIG.MIN_STAKE,
          maxStake: STAKING_CONFIG.MAX_STAKE,
          unstakePeriod: STAKING_CONFIG.UNSTAKE_PERIOD,
          isActive: STAKING_CONFIG.IS_ACTIVE,
          userStaked: 0,
          userRewards: 0,
          userPendingRewards: 0,
          userUnstaking: [],
        });
        return;
      }

      const userPublicKey = new web3.PublicKey(currentWallet);

      // حساب PDAs الجديدة
      const [stakingConfigPDA] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(PDA_SEEDS.STAKING_CONFIG)],
        PROGRAM_ID_PUBKEY
      );

      const [stakingVaultPDA] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(PDA_SEEDS.STAKING_VAULT)],
        PROGRAM_ID_PUBKEY
      );

      const [rewardVaultPDA] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(PDA_SEEDS.REWARD_VAULT)],
        PROGRAM_ID_PUBKEY
      );

      const [stakePDA] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(PDA_SEEDS.STAKE_ACCOUNT), userPublicKey.toBuffer()],
        PROGRAM_ID_PUBKEY
      );

      // جلب أرصدة الحسابات من الشبكة
      const [vaultBalance, rewardBalance, stakeAccountInfo, configInfo] = await Promise.all([
        connection.getTokenAccountBalance(stakingVaultPDA).catch(() => ({ value: { uiAmount: 0 } })),
        connection.getTokenAccountBalance(rewardVaultPDA).catch(() => ({ value: { uiAmount: 0 } })),
        connection.getAccountInfo(stakePDA).catch(() => null),
        connection.getAccountInfo(stakingConfigPDA).catch(() => null),
      ]);

      // حساب بيانات المستخدم
      let userStaked = 0;
      let userRewards = 0;

      if (stakeAccountInfo && stakeAccountInfo.data.length >= 56) {
        const data = stakeAccountInfo.data;
        const amountBuffer = data.slice(32, 40);
        userStaked = new BN(amountBuffer, 'le').toNumber() / Math.pow(10, TOKEN_DECIMALS[MECO_MINT]);
        
        const rewardBuffer = data.slice(48, 56);
        userRewards = new BN(rewardBuffer, 'le').toNumber() / Math.pow(10, TOKEN_DECIMALS[MECO_MINT]);
      }

      // حساب إجمالي عدد Stakers
      let totalStakers = 0;
      if (configInfo && configInfo.data.length >= 40) {
        const stakersBuffer = configInfo.data.slice(8, 16);
        totalStakers = new BN(stakersBuffer, 'le').toNumber();
      }

      setStakingData({
        apr: STAKING_CONFIG.APR,
        totalStaked: vaultBalance.value.uiAmount || 0,
        totalStakers: totalStakers,
        minStake: STAKING_CONFIG.MIN_STAKE,
        maxStake: STAKING_CONFIG.MAX_STAKE,
        unstakePeriod: STAKING_CONFIG.UNSTAKE_PERIOD,
        isActive: STAKING_CONFIG.IS_ACTIVE,
        userStaked: userStaked,
        userRewards: userRewards,
        userPendingRewards: 0,
        userUnstaking: [],
      });
      
    } catch (error) {
      console.error('❌ Error fetching staking data:', error);
      
      // بيانات طوارئ
      setStakingData({
        apr: STAKING_CONFIG.APR,
        totalStaked: 0,
        totalStakers: 0,
        minStake: STAKING_CONFIG.MIN_STAKE,
        maxStake: STAKING_CONFIG.MAX_STAKE,
        unstakePeriod: STAKING_CONFIG.UNSTAKE_PERIOD,
        isActive: true,
        userStaked: 0,
        userRewards: 0,
        userPendingRewards: 0,
        userUnstaking: [],
      });
    } finally {
      setLoading(false);
    }
  };

  // 🔄 تحديث البيانات
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchStakingData(), fetchUserBalance()]);
    setRefreshing(false);
  }, []);

  // 💳 معالجة ضغط Staking
  const handleStake = () => {
    const amount = parseFloat(stakeAmount) || 0;

    if (!currentWallet) {
      Alert.alert(t('error'), t('wallet_not_available'));
      return;
    }

    if (userMECOBalance === 0) {
      Alert.alert(t('insufficient_balance'), t('no_meco_to_stake'));
      return;
    }

    if (amount < stakingData.minStake) {
      Alert.alert(t('error'), `${t('below_minimum_stake')} ${stakingData.minStake} MECO`);
      return;
    }

    if (amount > stakingData.maxStake) {
      Alert.alert(t('error'), `${t('above_maximum_stake')} ${stakingData.maxStake} MECO`);
      return;
    }

    if (amount > userMECOBalance) {
      Alert.alert(
        t('insufficient_balance'),
        `${t('insufficient_meco_balance')}\n\n${t('current_balance')}: ${userMECOBalance.toFixed(4)} MECO\n${t('required_amount')}: ${amount} MECO`
      );
      return;
    }

    // التحقق من رصيد SOL للرسوم
    const totalSOLNeeded = serviceFee + 0.00001; // رسوم الخدمة + هامش صغير
    if (userSOLBalance < totalSOLNeeded) {
      Alert.alert(
        t('insufficient_balance'),
        `${t('insufficient_sol_for_fees')}\n\n${t('current_sol_balance')}: ${userSOLBalance.toFixed(6)} SOL\n${t('required_for_fees')}: ${totalSOLNeeded.toFixed(6)} SOL`
      );
      return;
    }

    if (!stakingData.isActive) {
      Alert.alert(t('staking_inactive'), t('staking_inactive_message'));
      return;
    }

    setTransactionResult(null);
    setShowStakeModal(true);
  };

  // 🔥 تأكيد عملية Staking - المحسنة
  const confirmStake = async () => {
    setTransactionLoading(true);

    try {
      const amount = parseFloat(stakeAmount) || 0;
      
      // 1. التحقق من المفتاح الخاص
      const keypair = await validatePrivateKey();
      if (!keypair) {
        throw new Error(t('wallet_not_connected'));
      }

      const userPublicKey = keypair.publicKey;

      // 2. حساب المبلغ باللامبير
      const mecoDecimals = TOKEN_DECIMALS[MECO_MINT] || 6;
      const mecoAmountLamports = Math.floor(amount * Math.pow(10, mecoDecimals));
      const serviceFeeLamports = Math.floor(serviceFee * Math.pow(10, 9));

      // 3. حساب PDAs باستخدام البذور الصحيحة
      const [stakingConfigPDA] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(PDA_SEEDS.STAKING_CONFIG)],
        PROGRAM_ID_PUBKEY
      );

      const [stakingVaultPDA] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(PDA_SEEDS.STAKING_VAULT)],
        PROGRAM_ID_PUBKEY
      );

      const [stakingAuthPDA] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(PDA_SEEDS.STAKING_AUTH)],
        PROGRAM_ID_PUBKEY
      );

      const [stakePDA] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(PDA_SEEDS.STAKE_ACCOUNT), userPublicKey.toBuffer()],
        PROGRAM_ID_PUBKEY
      );

      // 4. حساب ATA للمستخدم
      const userMecoATA = await splToken.getAssociatedTokenAddress(
        MECO_MINT_PUBKEY,
        userPublicKey
      );

      // 5. إنشاء تعليمات المعاملة
      const instructions = [];

      // أ. التحقق من وجود حساب MECO ATA للمستخدم وإنشاؤه إذا لزم الأمر
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

      // ب. التحويل من حساب المستخدم إلى stakingVault
      instructions.push(
        splToken.createTransferInstruction(
          userMecoATA,
          stakingVaultPDA,
          userPublicKey,
          mecoAmountLamports
        )
      );

      // ج. إرسال رسوم الخدمة
      instructions.push(
        web3.SystemProgram.transfer({
          fromPubkey: userPublicKey,
          toPubkey: FEE_COLLECTOR_PUBKEY,
          lamports: serviceFeeLamports,
        })
      );

      // د. إنشاء حساب staking للمستخدم (إذا كان أول مرة)
      const stakeAccountInfo = await connection.getAccountInfo(stakePDA);
      if (!stakeAccountInfo) {
        const rentExempt = await connection.getMinimumBalanceForRentExemption(56);
        instructions.push(
          web3.SystemProgram.createAccount({
            fromPubkey: userPublicKey,
            newAccountPubkey: stakePDA,
            lamports: rentExempt,
            space: 56,
            programId: PROGRAM_ID_PUBKEY,
          })
        );
      }

      // هـ. تعليمة العقد الذكي لتسجيل الـ Stake
      const stakeInstruction = new web3.TransactionInstruction({
        programId: PROGRAM_ID_PUBKEY,
        keys: [
          { pubkey: userPublicKey, isSigner: true, isWritable: true },
          { pubkey: userMecoATA, isSigner: false, isWritable: true },
          { pubkey: stakingVaultPDA, isSigner: false, isWritable: true },
          { pubkey: stakingConfigPDA, isSigner: false, isWritable: true },
          { pubkey: stakePDA, isSigner: false, isWritable: true },
          { pubkey: stakingAuthPDA, isSigner: false, isWritable: false },
          { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        data: Buffer.from([
          INSTRUCTION_CODES.STAKE,
          ...new BN(mecoAmountLamports).toArray('le', 8),
        ]),
      });

      instructions.push(stakeInstruction);

      // 6. إنشاء وإرسال المعاملة
      const transaction = new web3.Transaction().add(...instructions);
      
      // الحصول على blockhash حديث
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userPublicKey;
      transaction.lastValidBlockHeight = lastValidBlockHeight;

      // توقيع المعاملة
      console.log('✍️ جاري توقيع معاملة التخزين...');
      transaction.sign(keypair);

      // التحقق من التواقيع
      if (!verifyTransactionSignatures(transaction, [userPublicKey])) {
        throw new Error('فشل التحقق من توقيع معاملة التخزين');
      }

      // محاكاة المعاملة
      console.log('🔄 جاري محاكاة معاملة التخزين...');
      try {
        const simulation = await connection.simulateTransaction(transaction, {
          replaceRecentBlockhash: true,
          commitment: 'confirmed',
        });
        
        if (simulation.value.err) {
          const errorMsg = simulation.value.err.toString();
          console.error('❌ فشل محاكاة التخزين:', errorMsg);
          
          if (errorMsg.includes('insufficient funds')) {
            throw new Error('رصيد غير كافي للتخزين والرسوم');
          }
          throw new Error(`فشل المحاكاة: ${errorMsg}`);
        }
        console.log('✅ نجحت محاكاة التخزين');
      } catch (simError) {
        console.warn('⚠️ تحذير في محاكاة التخزين:', simError.message);
      }

      // إرسال المعاملة
      console.log('🚀 جاري إرسال معاملة التخزين...');
      const rawTransaction = transaction.serialize();
      const signature = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
        preflightCommitment: 'confirmed',
      });

      console.log('✅ معاملة التخزين مرسلة:', signature);

      // انتظار التأكيد
      console.log('⏳ جاري انتظار تأكيد التخزين...');
      const confirmation = await connection.confirmTransaction({
        signature: signature,
        blockhash: blockhash,
        lastValidBlockHeight: lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`فشل تأكيد التخزين: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log('✅ تم تأكيد التخزين بنجاح');

      // 7. تحديث البيانات
      await fetchStakingData();
      await fetchUserBalance();

      // 8. عرض النتيجة
      const result = {
        success: true,
        signature,
        amountStaked: amount,
        message: t('staking_successful'),
      };

      setTransactionResult(result);

      Alert.alert(
        t('success'),
        `${t('staking_success_message')}\n\n` +
        `${t('amount_staked')}: ${amount.toLocaleString()} MECO\n` +
        `${t('service_fee')}: ${serviceFee} SOL\n` +
        `${t('transaction_id')}: ${signature.substring(0, 16)}...`,
        [
          {
            text: t('view_on_solscan'),
            onPress: () => Linking.openURL(EXTERNAL_LINKS.SOLSCAN_TX(signature)),
          },
          {
            text: t('ok'),
            onPress: () => {
              setShowStakeModal(false);
              setTransactionLoading(false);
              setStakeAmount('');
            }
          }
        ]
      );

    } catch (error) {
      console.error('❌ Staking error:', error);
      
      const result = {
        success: false,
        message: t('staking_failed'),
        error: error.message || error.toString(),
      };

      setTransactionResult(result);
      
      // رسائل خطأ محددة
      let errorMessage = `${t('staking_failed_message')}\n\n${error.message || t('error')}`;
      
      if (error.message.includes('insufficient funds')) {
        errorMessage = t('insufficient_balance_for_staking') || 'رصيد غير كافي للتخزين والرسوم';
      } else if (error.message.includes('signature')) {
        errorMessage = 'فشل توقيع معاملة التخزين. تأكد من صلاحية المفتاح الخاص.';
      } else if (error.message.includes('Invalid public key')) {
        errorMessage = 'عنوان العقد الذكي غير صالح.';
      } else if (error.message.includes('network connection')) {
        errorMessage = 'فشل الاتصال بالشبكة. تحقق من اتصال الإنترنت.';
      } else if (error.message.includes('Wallet not connected')) {
        errorMessage = 'المحفظة غير متصلة. يرجى إعادة الاتصال.';
      }
      
      Alert.alert(
        t('error'),
        errorMessage,
        [{ text: t('ok'), onPress: () => setTransactionLoading(false) }]
      );
    }
  };

  // 📤 معالجة ضغط Unstake
  const handleUnstake = () => {
    const amount = parseFloat(unstakeAmount) || 0;

    if (!currentWallet) {
      Alert.alert(t('error'), t('wallet_not_available'));
      return;
    }

    if (stakingData.userStaked === 0) {
      Alert.alert(t('error'), t('no_staked_meco'));
      return;
    }

    if (amount < 1) {
      Alert.alert(t('error'), t('unstake_minimum'));
      return;
    }

    if (amount > stakingData.userStaked) {
      Alert.alert(
        t('insufficient_balance'),
        `${t('insufficient_staked_balance')}\n\n${t('current_staked')}: ${stakingData.userStaked.toFixed(4)} MECO\n${t('requested_amount')}: ${amount} MECO`
      );
      return;
    }

    // التحقق من رصيد SOL للرسوم
    if (userSOLBalance < serviceFee) {
      Alert.alert(
        t('insufficient_balance'),
        `${t('insufficient_sol_for_fees')}\n\n${t('current_sol_balance')}: ${userSOLBalance.toFixed(6)} SOL\n${t('required_for_fees')}: ${serviceFee.toFixed(6)} SOL`
      );
      return;
    }

    if (!stakingData.isActive) {
      Alert.alert(t('staking_inactive'), t('staking_inactive_message'));
      return;
    }

    Alert.alert(
      t('unstake_warning_title'),
      t('unstake_warning_message', { days: stakingData.unstakePeriod }),
      [
        { text: t('cancel'), style: 'cancel' },
        { 
          text: t('confirm_unstake'), 
          onPress: () => {
            setTransactionResult(null);
            setShowUnstakeModal(true);
          }
        }
      ]
    );
  };

  // 🔥 تأكيد عملية Unstake
  const confirmUnstake = async () => {
    setTransactionLoading(true);

    try {
      // 1. التحقق من المفتاح الخاص
      const keypair = await validatePrivateKey();
      if (!keypair) {
        throw new Error(t('wallet_not_connected'));
      }

      const userPublicKey = keypair.publicKey;

      // 2. حساب رسوم الخدمة
      const serviceFeeLamports = Math.floor(serviceFee * Math.pow(10, 9));

      // 3. حساب PDAs
      const [stakingConfigPDA] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(PDA_SEEDS.STAKING_CONFIG)],
        PROGRAM_ID_PUBKEY
      );

      const [stakingVaultPDA] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(PDA_SEEDS.STAKING_VAULT)],
        PROGRAM_ID_PUBKEY
      );

      const [stakingAuthPDA] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(PDA_SEEDS.STAKING_AUTH)],
        PROGRAM_ID_PUBKEY
      );

      const [stakePDA] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(PDA_SEEDS.STAKE_ACCOUNT), userPublicKey.toBuffer()],
        PROGRAM_ID_PUBKEY
      );

      // 4. حساب ATA للمستخدم
      const userMecoATA = await splToken.getAssociatedTokenAddress(
        MECO_MINT_PUBKEY,
        userPublicKey
      );

      // 5. إنشاء تعليمات المعاملة
      const instructions = [];

      // أ. إرسال رسوم الخدمة
      instructions.push(
        web3.SystemProgram.transfer({
          fromPubkey: userPublicKey,
          toPubkey: FEE_COLLECTOR_PUBKEY,
          lamports: serviceFeeLamports,
        })
      );

      // ب. تعليمة العقد الذكي للـ Unstake
      const unstakeInstruction = new web3.TransactionInstruction({
        programId: PROGRAM_ID_PUBKEY,
        keys: [
          { pubkey: userPublicKey, isSigner: true, isWritable: true },
          { pubkey: userMecoATA, isSigner: false, isWritable: true },
          { pubkey: stakingVaultPDA, isSigner: false, isWritable: true },
          { pubkey: stakingConfigPDA, isSigner: false, isWritable: true },
          { pubkey: stakePDA, isSigner: false, isWritable: true },
          { pubkey: stakingAuthPDA, isSigner: false, isWritable: false },
          { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.from([
          INSTRUCTION_CODES.UNSTAKE,
        ]),
      });

      instructions.push(unstakeInstruction);

      // 6. إنشاء وإرسال المعاملة
      const transaction = new web3.Transaction().add(...instructions);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userPublicKey;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.sign(keypair);

      // التحقق من التواقيع
      if (!verifyTransactionSignatures(transaction, [userPublicKey])) {
        throw new Error('فشل التحقق من توقيع معاملة إلغاء التخزين');
      }

      // محاكاة المعاملة
      try {
        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
        }
      } catch (simError) {
        console.warn('⚠️ Unstaking simulation warning:', simError.message);
      }

      // إرسال المعاملة
      const signature = await connection.sendRawTransaction(transaction.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      // تحديث البيانات
      await fetchStakingData();
      await fetchUserBalance();

      // عرض النتيجة
      const unlockDate = new Date(Date.now() + stakingData.unstakePeriod * 24 * 60 * 60 * 1000);
      const result = {
        success: true,
        signature,
        amountUnstaked: stakingData.userStaked,
        message: t('unstaking_successful'),
        unlockDate,
      };

      setTransactionResult(result);

      Alert.alert(
        t('success'),
        `${t('unstaking_success_message')}\n\n` +
        `${t('amount_unstaked')}: ${stakingData.userStaked.toLocaleString()} MECO\n` +
        `${t('service_fee')}: ${serviceFee} SOL\n` +
        `${t('unlock_date')}: ${unlockDate.toLocaleDateString()}\n` +
        `${t('transaction_id')}: ${signature.substring(0, 16)}...`,
        [
          {
            text: t('view_on_solscan'),
            onPress: () => Linking.openURL(EXTERNAL_LINKS.SOLSCAN_TX(signature)),
          },
          {
            text: t('ok'),
            onPress: () => {
              setShowUnstakeModal(false);
              setTransactionLoading(false);
              setUnstakeAmount('');
            }
          }
        ]
      );

    } catch (error) {
      console.error('❌ Unstaking error:', error);
      
      const result = {
        success: false,
        message: t('unstaking_failed'),
        error: error.message || error.toString(),
      };

      setTransactionResult(result);
      
      let errorMessage = `${t('unstaking_failed_message')}\n\n${error.message || t('error')}`;
      
      if (error.message.includes('insufficient funds')) {
        errorMessage = t('insufficient_balance_for_unstaking') || 'رصيد غير كافي لإلغاء التخزين والرسوم';
      } else if (error.message.includes('signature')) {
        errorMessage = 'فشل توقيع معاملة إلغاء التخزين.';
      }
      
      Alert.alert(
        t('error'),
        errorMessage,
        [{ text: t('ok'), onPress: () => setTransactionLoading(false) }]
      );
    }
  };

  // 🎁 سحب المكافآت
  const handleClaimRewards = async () => {
    if (!currentWallet) {
      Alert.alert(t('error'), t('wallet_not_available'));
      return;
    }

    if (stakingData.userRewards === 0) {
      Alert.alert(t('info'), t('no_rewards_to_claim'));
      return;
    }

    // التحقق من رصيد SOL للرسوم
    if (userSOLBalance < serviceFee) {
      Alert.alert(
        t('insufficient_balance'),
        `${t('insufficient_sol_for_fees')}\n\n${t('current_sol_balance')}: ${userSOLBalance.toFixed(6)} SOL\n${t('required_for_fees')}: ${serviceFee.toFixed(6)} SOL`
      );
      return;
    }

    setTransactionLoading(true);

    try {
      // 1. التحقق من المفتاح الخاص
      const keypair = await validatePrivateKey();
      if (!keypair) {
        throw new Error(t('wallet_not_connected'));
      }

      const userPublicKey = keypair.publicKey;

      // 2. حساب رسوم الخدمة
      const serviceFeeLamports = Math.floor(serviceFee * Math.pow(10, 9));

      // 3. حساب PDAs
      const [stakingConfigPDA] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(PDA_SEEDS.STAKING_CONFIG)],
        PROGRAM_ID_PUBKEY
      );

      const [rewardVaultPDA] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(PDA_SEEDS.REWARD_VAULT)],
        PROGRAM_ID_PUBKEY
      );

      const [stakingAuthPDA] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(PDA_SEEDS.STAKING_AUTH)],
        PROGRAM_ID_PUBKEY
      );

      const [stakePDA] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(PDA_SEEDS.STAKE_ACCOUNT), userPublicKey.toBuffer()],
        PROGRAM_ID_PUBKEY
      );

      // 4. حساب ATA للمستخدم
      const userMecoATA = await splToken.getAssociatedTokenAddress(
        MECO_MINT_PUBKEY,
        userPublicKey
      );

      // 5. إنشاء تعليمات المعاملة
      const instructions = [];

      // أ. إرسال رسوم الخدمة
      instructions.push(
        web3.SystemProgram.transfer({
          fromPubkey: userPublicKey,
          toPubkey: FEE_COLLECTOR_PUBKEY,
          lamports: serviceFeeLamports,
        })
      );

      // ب. تعليمة العقد الذكي لسحب المكافآت
      const claimInstruction = new web3.TransactionInstruction({
        programId: PROGRAM_ID_PUBKEY,
        keys: [
          { pubkey: userPublicKey, isSigner: true, isWritable: true },
          { pubkey: userMecoATA, isSigner: false, isWritable: true },
          { pubkey: rewardVaultPDA, isSigner: false, isWritable: true },
          { pubkey: stakingConfigPDA, isSigner: false, isWritable: true },
          { pubkey: stakePDA, isSigner: false, isWritable: true },
          { pubkey: stakingAuthPDA, isSigner: false, isWritable: false },
          { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.from([
          INSTRUCTION_CODES.CLAIM_REWARDS,
        ]),
      });

      instructions.push(claimInstruction);

      // 6. إنشاء وإرسال المعاملة
      const transaction = new web3.Transaction().add(...instructions);
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userPublicKey;
      transaction.sign(keypair);

      // التحقق من التواقيع
      if (!verifyTransactionSignatures(transaction, [userPublicKey])) {
        throw new Error('فشل التحقق من توقيع معاملة سحب المكافآت');
      }

      // محاكاة المعاملة
      try {
        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
        }
      } catch (simError) {
        console.warn('⚠️ Claim rewards simulation warning:', simError.message);
      }

      // إرسال المعاملة
      const signature = await connection.sendRawTransaction(transaction.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      // تحديث البيانات
      await fetchStakingData();
      await fetchUserBalance();

      // عرض النتيجة
      Alert.alert(
        t('success'),
        `${t('rewards_claimed_success')}\n\n` +
        `${t('amount_claimed')}: ${stakingData.userRewards.toLocaleString()} MECO\n` +
        `${t('service_fee')}: ${serviceFee} SOL\n` +
        `${t('transaction_id')}: ${signature.substring(0, 16)}...`,
        [
          {
            text: t('view_on_solscan'),
            onPress: () => Linking.openURL(EXTERNAL_LINKS.SOLSCAN_TX(signature)),
          },
          { text: t('ok'), onPress: () => setTransactionLoading(false) }
        ]
      );

    } catch (error) {
      console.error('❌ Claim rewards error:', error);
      
      Alert.alert(
        t('error'),
        `${t('claim_rewards_failed')}\n\n${error.message || t('error')}`,
        [{ text: t('ok'), onPress: () => setTransactionLoading(false) }]
      );
    }
  };

  // 🔢 تنسيق الأرقام
  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0';
    const absNum = Math.abs(num);
    if (absNum >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
    if (absNum >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (absNum >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toLocaleString('en-US', {
      maximumFractionDigits: 4,
      minimumFractionDigits: 0
    });
  };

  // 📈 حساب المكافآت اليومية
  const calculateDailyRewards = () => {
    const dailyAPR = stakingData.apr / 365;
    return (stakingData.userStaked * dailyAPR) / 100;
  };

  // 📊 حساب APY المتوقع
  const calculateEstimatedAPY = () => {
    const n = 365;
    return (Math.pow(1 + stakingData.apr / 100 / n, n) - 1) * 100;
  };

  // 📱 عرض حالة التحميل
  if (loading && !currentWallet) {
    return (
      <View style={[styles.loadingContainerFull, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={[styles.loadingTextFull, { color: colors.text }]}>
          {t('loading_data')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.info}
          colors={[colors.info]}
        />
      }
    >
      {/* 🏁 الهيدر */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="safe-square" size={48} color={primaryColor} />
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>{t('staking')}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('stake_meco_earn_rewards')}
            </Text>
          </View>
        </View>
        
        {stakingData.isActive ? (
          <View style={[styles.activeBadge, { backgroundColor: colors.success + '20' }]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={[styles.activeText, { color: colors.success }]}>
              {t('staking_active')}
            </Text>
          </View>
        ) : (
          <View style={[styles.inactiveBadge, { backgroundColor: colors.danger + '20' }]}>
            <Ionicons name="close-circle" size={16} color={colors.danger} />
            <Text style={[styles.inactiveText, { color: colors.danger }]}>
              {t('staking_inactive')}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* 💼 بطاقة الأرصدة */}
      <View style={[styles.balancesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.balanceSection}>
          <View style={styles.balanceItem}>
            <View style={[styles.balanceIcon, { backgroundColor: primaryColor + '20' }]}>
              <MaterialCommunityIcons name="wallet" size={24} color={primaryColor} />
            </View>
            <View>
              <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>
                {t('available_meco')}
              </Text>
              <Text style={[styles.balanceAmount, { color: colors.text }]}>
                {formatNumber(userMECOBalance)} MECO
              </Text>
            </View>
          </View>
          
          <View style={styles.balanceItem}>
            <View style={[styles.balanceIcon, { backgroundColor: colors.purple + '20' }]}>
              <MaterialCommunityIcons name="lock" size={24} color={colors.purple} />
            </View>
            <View>
              <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>
                {t('staked_meco')}
              </Text>
              <Text style={[styles.balanceAmount, { color: colors.text }]}>
                {formatNumber(stakingData.userStaked)} MECO
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.rewardsSection}>
          <View style={styles.rewardItem}>
            <MaterialCommunityIcons name="gift" size={20} color={colors.warning} />
            <View>
              <Text style={[styles.rewardLabel, { color: colors.textSecondary }]}>
                {t('available_rewards')}
              </Text>
              <Text style={[styles.rewardAmount, { color: colors.warning }]}>
                {formatNumber(stakingData.userRewards)} MECO
              </Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={[styles.claimButton, { backgroundColor: colors.warning + '20' }]}
            onPress={handleClaimRewards}
            disabled={transactionLoading || stakingData.userRewards === 0}
          >
            <Text style={[styles.claimButtonText, { color: colors.warning }]}>
              {t('claim_rewards')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 📊 بطاقة APR */}
      <View style={[styles.aprCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.aprHeader}>
          <MaterialCommunityIcons name="trending-up" size={24} color={colors.success} />
          <Text style={[styles.aprTitle, { color: colors.text }]}>
            {t('staking_returns')}
          </Text>
        </View>
        
        <View style={styles.aprStats}>
          <View style={styles.aprStat}>
            <Text style={[styles.aprValue, { color: colors.success }]}>
              {stakingData.apr}%
            </Text>
            <Text style={[styles.aprLabel, { color: colors.textSecondary }]}>
              {t('annual_rate')} (APR)
            </Text>
          </View>
          
          <View style={styles.aprDivider} />
          
          <View style={styles.aprStat}>
            <Text style={[styles.aprValue, { color: colors.purple }]}>
              {calculateEstimatedAPY().toFixed(2)}%
            </Text>
            <Text style={[styles.aprLabel, { color: colors.textSecondary }]}>
              {t('estimated_apy')}
            </Text>
          </View>
        </View>
        
        <View style={styles.dailyRewards}>
          <Text style={[styles.dailyLabel, { color: colors.textSecondary }]}>
            {t('estimated_daily_rewards')}:
          </Text>
          <Text style={[styles.dailyAmount, { color: colors.text }]}>
            ~{calculateDailyRewards().toFixed(4)} MECO
          </Text>
        </View>
      </View>

      {/* 📝 نموذج Staking */}
      <View style={[styles.stakingForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.formTitle, { color: colors.text }]}>
          {t('stake_meco')}
        </Text>
        
        <View style={styles.amountInput}>
          <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
            {t('amount_to_stake')}
          </Text>
          <View style={[styles.inputContainer, { borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={stakeAmount}
              onChangeText={(value) => {
                const numericValue = value.replace(/[^0-9.]/g, '');
                const parts = numericValue.split('.');
                if (parts.length > 2) {
                  setStakeAmount(parts[0] + '.' + parts.slice(1).join(''));
                } else {
                  setStakeAmount(numericValue);
                }
              }}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
            />
            <View style={styles.tokenBadge}>
              <Text style={[styles.tokenText, { color: colors.text }]}>MECO</Text>
            </View>
          </View>
          
          <View style={styles.amountButtons}>
            <TouchableOpacity
              style={[styles.amountButton, { backgroundColor: colors.background }]}
              onPress={() => setStakeAmount(stakingData.minStake.toString())}
            >
              <Text style={[styles.amountButtonText, { color: colors.textSecondary }]}>
                {t('min')}: {stakingData.minStake}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.amountButton, { backgroundColor: colors.background }]}
              onPress={() => setStakeAmount(stakingData.maxStake.toString())}
            >
              <Text style={[styles.amountButtonText, { color: colors.textSecondary }]}>
                {t('max')}: {formatNumber(stakingData.maxStake)}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.amountButton, { backgroundColor: colors.background }]}
              onPress={() => setStakeAmount(userMECOBalance.toString())}
            >
              <Text style={[styles.amountButtonText, { color: colors.textSecondary }]}>
                {t('available')}: {formatNumber(userMECOBalance)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <TouchableOpacity
          style={[
            styles.stakeButton,
            { 
              backgroundColor: stakingData.isActive ? primaryColor : colors.textSecondary,
              opacity: stakingData.isActive ? 1 : 0.6
            }
          ]}
          onPress={handleStake}
          disabled={transactionLoading || loading || !stakingData.isActive}
        >
          {transactionLoading || loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="lock" size={24} color="#FFFFFF" />
              <Text style={styles.stakeButtonText}>
                {!stakingData.isActive ? t('staking_paused') : t('stake_now')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* 📤 نموذج Unstaking */}
      <View style={[styles.unstakingForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.formTitle, { color: colors.text }]}>
          {t('unstake_meco')}
        </Text>
        
        <View style={styles.amountInput}>
          <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
            {t('amount_to_unstake')}
          </Text>
          <View style={[styles.inputContainer, { borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={unstakeAmount}
              onChangeText={(value) => {
                const numericValue = value.replace(/[^0-9.]/g, '');
                const parts = numericValue.split('.');
                if (parts.length > 2) {
                  setUnstakeAmount(parts[0] + '.' + parts.slice(1).join(''));
                } else {
                  setUnstakeAmount(numericValue);
                }
              }}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
            />
            <View style={styles.tokenBadge}>
              <Text style={[styles.tokenText, { color: colors.text }]}>MECO</Text>
            </View>
          </View>
          
          <View style={styles.amountButtons}>
            <TouchableOpacity
              style={[styles.amountButton, { backgroundColor: colors.background }]}
              onPress={() => setUnstakeAmount('1')}
            >
              <Text style={[styles.amountButtonText, { color: colors.textSecondary }]}>
                {t('min')}: 1
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.amountButton, { backgroundColor: colors.background }]}
              onPress={() => setUnstakeAmount(stakingData.userStaked.toString())}
            >
              <Text style={[styles.amountButtonText, { color: colors.textSecondary }]}>
                {t('staked')}: {formatNumber(stakingData.userStaked)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.unstakeInfo}>
          <Ionicons name="information-circle" size={16} color={colors.warning} />
          <Text style={[styles.unstakeInfoText, { color: colors.textSecondary }]}>
            {t('unstake_period_notice', { days: stakingData.unstakePeriod })}
          </Text>
        </View>
        
        <TouchableOpacity
          style={[
            styles.unstakeButton,
            { 
              backgroundColor: stakingData.isActive ? colors.danger : colors.textSecondary,
              opacity: stakingData.isActive ? 1 : 0.6
            }
          ]}
          onPress={handleUnstake}
          disabled={transactionLoading || loading || !stakingData.isActive || stakingData.userStaked === 0}
        >
          {transactionLoading || loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="lock-open" size={24} color="#FFFFFF" />
              <Text style={styles.unstakeButtonText}>
                {!stakingData.isActive ? t('staking_paused') : t('unstake_now')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* 📈 إحصائيات عامة */}
      <View style={[styles.globalStats, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.statsTitle, { color: colors.text }]}>
          {t('global_staking_stats')}
        </Text>
        
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {formatNumber(stakingData.totalStaked)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {t('total_staked')}
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {formatNumber(stakingData.totalStakers)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {t('total_stakers')}
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {stakingData.unstakePeriod}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {t('unstake_days')}
            </Text>
          </View>
        </View>
      </View>

      {/* ℹ️ معلومات هامة */}
      <View style={[styles.infoNotice, { backgroundColor: primaryColor + '10', borderColor: colors.border }]}>
        <Ionicons name="information-circle-outline" size={20} color={primaryColor} />
        <View style={styles.infoContent}>
          <Text style={[styles.infoTitle, { color: colors.text }]}>
            {t('staking_info_title')}
          </Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            {t('staking_info_description')}
          </Text>
        </View>
      </View>

      {/* ⚡ نافذة تأكيد Staking */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showStakeModal}
        onRequestClose={() => !transactionLoading && setShowStakeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <MaterialCommunityIcons
              name={transactionResult?.success ? "check-circle" : "alert-circle"}
              size={60}
              color={transactionResult?.success ? colors.success : colors.warning}
            />

            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {transactionResult ?
                (transactionResult.success ? t('staking_successful') : t('staking_failed'))
                : t('confirm_staking')}
            </Text>

            {transactionResult ? (
              <View style={styles.resultContainer}>
                <Text style={[styles.resultText, { color: colors.textSecondary }]}>
                  {transactionResult.message}
                </Text>
                {transactionResult.success && (
                  <>
                    <Text style={[styles.resultText, { color: colors.success, marginTop: 8 }]}>
                      {t('amount_staked_modal', { amount: transactionResult.amountStaked?.toLocaleString() })}
                    </Text>
                    <Text style={[styles.resultText, { color: colors.textSecondary, marginTop: 4 }]}>
                      {t('service_fee_modal', { fee: serviceFee })}
                    </Text>
                    <TouchableOpacity
                      style={[styles.solscanButton, { backgroundColor: colors.info }]}
                      onPress={() => Linking.openURL(EXTERNAL_LINKS.SOLSCAN_TX(transactionResult.signature))}
                    >
                      <Text style={styles.solscanButtonText}>{t('view_on_solscan')}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ) : (
              <>
                <Text style={[styles.modalText, { color: colors.textSecondary }]}>
                  {t('you_will_stake_amount', { amount: stakeAmount })}
                </Text>

                <View style={styles.modalDetails}>
                  <View style={styles.modalDetailRow}>
                    <Text style={[styles.modalDetailLabel, { color: colors.textSecondary }]}>
                      {t('apr')}:
                    </Text>
                    <Text style={[styles.modalDetailValue, { color: colors.success }]}>
                      {stakingData.apr}%
                    </Text>
                  </View>
                  <View style={styles.modalDetailRow}>
                    <Text style={[styles.modalDetailLabel, { color: colors.textSecondary }]}>
                      {t('estimated_daily_rewards')}:
                    </Text>
                    <Text style={[styles.modalDetailValue, { color: colors.text }]}>
                      ~{calculateDailyRewards().toFixed(4)} MECO
                    </Text>
                  </View>
                  <View style={styles.modalDetailRow}>
                    <Text style={[styles.modalDetailLabel, { color: colors.textSecondary }]}>
                      {t('unstake_period')}:
                    </Text>
                    <Text style={[styles.modalDetailValue, { color: colors.text }]}>
                      {stakingData.unstakePeriod} {t('days')}
                    </Text>
                  </View>
                  <View style={styles.modalDetailRow}>
                    <Text style={[styles.modalDetailLabel, { color: colors.textSecondary }]}>
                      {t('service_fee')}:
                    </Text>
                    <Text style={[styles.modalDetailValue, { color: colors.warning }]}>
                      {serviceFee} SOL
                    </Text>
                  </View>
                </View>

                {transactionLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={primaryColor} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                      {t('processing_staking')}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, { backgroundColor: colors.border }]}
                      onPress={() => setShowStakeModal(false)}
                      disabled={transactionLoading}
                    >
                      <Text style={[styles.modalButtonText, { color: colors.text }]}>{t('cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, { backgroundColor: primaryColor }]}
                      onPress={confirmStake}
                      disabled={transactionLoading}
                    >
                      <Text style={styles.modalButtonText}>{t('confirm_stake')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ⚡ نافذة تأكيد Unstake */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showUnstakeModal}
        onRequestClose={() => !transactionLoading && setShowUnstakeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <MaterialCommunityIcons
              name="alert-circle"
              size={60}
              color={colors.warning}
            />

            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {transactionResult ? 
                (transactionResult.success ? t('unstaking_successful') : t('unstaking_failed'))
                : t('confirm_unstaking')}
            </Text>

            {transactionResult ? (
              <View style={styles.resultContainer}>
                <Text style={[styles.resultText, { color: colors.textSecondary }]}>
                  {transactionResult.message}
                </Text>
                {transactionResult.success && (
                  <>
                    <Text style={[styles.resultText, { color: colors.success, marginTop: 8 }]}>
                      {t('amount_unstaked_modal', { amount: transactionResult.amountUnstaked?.toLocaleString() })}
                    </Text>
                    <Text style={[styles.resultText, { color: colors.textSecondary, marginTop: 4 }]}>
                      {t('service_fee_modal', { fee: serviceFee })}
                    </Text>
                    <Text style={[styles.resultText, { color: colors.textSecondary, marginTop: 8 }]}>
                      {t('unlock_date_modal', { date: transactionResult.unlockDate?.toLocaleDateString() })}
                    </Text>
                    <TouchableOpacity
                      style={[styles.solscanButton, { backgroundColor: colors.info }]}
                      onPress={() => Linking.openURL(EXTERNAL_LINKS.SOLSCAN_TX(transactionResult.signature))}
                    >
                      <Text style={styles.solscanButtonText}>{t('view_on_solscan')}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ) : (
              <>
                <Text style={[styles.modalText, { color: colors.textSecondary }]}>
                  {t('you_will_unstake_amount', { amount: unstakeAmount })}
                </Text>

                <View style={styles.modalDetails}>
                  <View style={styles.modalDetailRow}>
                    <Text style={[styles.modalDetailLabel, { color: colors.textSecondary }]}>
                      {t('unstake_period')}:
                    </Text>
                    <Text style={[styles.modalDetailValue, { color: colors.warning }]}>
                      {stakingData.unstakePeriod} {t('days')}
                    </Text>
                  </View>
                  <View style={styles.modalDetailRow}>
                    <Text style={[styles.modalDetailLabel, { color: colors.textSecondary }]}>
                      {t('estimated_unlock_date')}:
                    </Text>
                    <Text style={[styles.modalDetailValue, { color: colors.text }]}>
                      {new Date(Date.now() + stakingData.unstakePeriod * 24 * 60 * 60 * 1000).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.modalDetailRow}>
                    <Text style={[styles.modalDetailLabel, { color: colors.textSecondary }]}>
                      {t('during_unstaking_period')}:
                    </Text>
                    <Text style={[styles.modalDetailValue, { color: colors.text }]}>
                      {t('no_rewards_earned')}
                    </Text>
                  </View>
                  <View style={styles.modalDetailRow}>
                    <Text style={[styles.modalDetailLabel, { color: colors.textSecondary }]}>
                      {t('service_fee')}:
                    </Text>
                    <Text style={[styles.modalDetailValue, { color: colors.warning }]}>
                      {serviceFee} SOL
                    </Text>
                  </View>
                </View>

                {transactionLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={primaryColor} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                      {t('processing_unstaking')}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, { backgroundColor: colors.border }]}
                      onPress={() => setShowUnstakeModal(false)}
                      disabled={transactionLoading}
                    >
                      <Text style={[styles.modalButtonText, { color: colors.text }]}>{t('cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, { backgroundColor: colors.danger }]}
                      onPress={confirmUnstake}
                      disabled={transactionLoading}
                    >
                      <Text style={styles.modalButtonText}>{t('confirm_unstake')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// 🎨 الأنماط المحسنة
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 50,
  },
  loadingContainerFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingTextFull: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerText: {
    flexDirection: 'column',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
    opacity: 0.8,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  inactiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  activeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inactiveText: {
    fontSize: 12,
    fontWeight: '600',
  },
  balancesCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  balanceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  balanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  balanceIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  rewardsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rewardLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  rewardAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  claimButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  claimButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  aprCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  aprHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  aprTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  aprStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  aprStat: {
    alignItems: 'center',
    flex: 1,
  },
  aprValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  aprLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  aprDivider: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  dailyRewards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  dailyLabel: {
    fontSize: 14,
  },
  dailyAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  stakingForm: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  unstakingForm: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  amountInput: {
    marginBottom: 20,
  },
  amountLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  tokenBadge: {
    backgroundColor: '#14F19520',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tokenText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#14F195',
  },
  amountButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  amountButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  amountButtonText: {
    fontSize: 12,
  },
  stakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  stakeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  unstakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  unstakeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  unstakeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  unstakeInfoText: {
    fontSize: 12,
    flex: 1,
  },
  globalStats: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  infoNotice: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 30,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: width * 0.9,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalDetails: {
    width: '100%',
    marginBottom: 24,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalDetailLabel: {
    fontSize: 14,
  },
  modalDetailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  resultContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  resultText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  solscanButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  solscanButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
