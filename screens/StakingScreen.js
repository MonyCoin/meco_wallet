import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  SafeAreaView,
  Animated,
  TextInput,
  Modal,
  ActivityIndicator
} from 'react-native';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

// 🔄 SOLANA INTEGRATION
import { Connection, PublicKey, clusterApiUrl, Keypair, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';

// ✅ IMPORT CONTRACT DATA
import IDL from '../contracts/monycoin_meco.json';
const PROGRAM_ID_NEW = new PublicKey(IDL.metadata.address);

import { MECO_MINT } from '../constants';

// 🔧 Staking Configuration
const STAKING_CONFIG = {
  APR: 18.5,
  MIN_STAKE: 100,
  MAX_STAKE: 1000000,
  UNSTAKE_PERIOD: 3,
};

export default function StakingScreen() {
  const { t } = useTranslation();
  const theme = useAppStore(state => state.theme);
  const primaryColor = useAppStore(state => state.primaryColor);
  const walletAddress = useAppStore(state => state.walletPublicKey);
  const walletPrivateKey = useAppStore(state => state.walletPrivateKey);
  const isDark = theme === 'dark';

  const colors = {
    background: isDark ? '#0A0A0F' : '#F8FAFD',
    card: isDark ? '#1A1A2E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#1A1A2E',
    textSecondary: isDark ? '#A0A0B0' : '#6B7280',
    border: isDark ? '#2A2A3E' : '#E5E7EB',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  };

  // State Management
  const [balance, setBalance] = useState(0);
  const [stakedAmount, setStakedAmount] = useState(0);
  const [rewards, setRewards] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stakeModalVisible, setStakeModalVisible] = useState(false);
  const [unstakeModalVisible, setUnstakeModalVisible] = useState(false);
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));

  // Contract Connection
  const [program, setProgram] = useState(null);
  const [connection, setConnection] = useState(null);
  const [protocolPDA, setProtocolPDA] = useState(null);

  useEffect(() => {
    initSolanaConnection();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    const interval = setInterval(updateRewards, 60000);
    return () => clearInterval(interval);
  }, []);

  // إنشاء wallet من المفتاح الخاص
  const createWalletFromPrivateKey = () => {
    try {
      if (!walletPrivateKey) {
        console.warn('❌ walletPrivateKey غير موجود');
        return null;
      }

      let secretKey;
      try {
        secretKey = new Uint8Array(JSON.parse(walletPrivateKey));
      } catch (e) {
        console.warn('❌ فشل تحويل المفتاح الخاص:', e.message);
        return null;
      }

      const keypair = Keypair.fromSecretKey(secretKey);
      return keypair;
    } catch (error) {
      console.error('❌ فشل إنشاء wallet:', error);
      return null;
    }
  };

  // Initialize Solana Connection with real contract
  const initSolanaConnection = async () => {
    try {
      setLoading(true);
      console.log('🔗 بدء اتصال Solana مع العقد الحقيقي...');

      // Setup connection
      const conn = new Connection(clusterApiUrl('devnet'), 'confirmed');
      setConnection(conn);

      // Check if wallet is available
      if (!walletAddress || !walletPrivateKey) {
        console.warn('❌ Wallet not connected, loading real data only');
        setLoading(false);
        return;
      }

      // إنشاء wallet
      const userKeypair = createWalletFromPrivateKey();
      if (!userKeypair) {
        console.warn('❌ فشل إنشاء wallet، جلب بيانات للقراءة فقط');
        setLoading(false);
        return;
      }

      // إنشاء provider حقيقي
      const provider = new AnchorProvider(
        conn,
        {
          publicKey: userKeypair.publicKey,
          signTransaction: async (tx) => {
            tx.partialSign(userKeypair);
            return tx;
          },
          signAllTransactions: async (txs) => {
            return txs.map(tx => {
              tx.partialSign(userKeypair);
              return tx;
            });
          },
        },
        { commitment: 'confirmed' }
      );

      // إنشاء program من IDL الحقيقي
      const programInstance = new Program(IDL, PROGRAM_ID_NEW, provider);
      setProgram(programInstance);
      console.log('✅ Program instance جاهز - IDL حقيقي');

      // Find protocol PDA
      const [protocolPDAAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from('protocol')],
        PROGRAM_ID_NEW
      );
      setProtocolPDA(protocolPDAAddress);

      // Load real data from blockchain
      await loadStakingData(conn, userKeypair.publicKey, programInstance);

    } catch (error) {
      console.error('❌ Connection error:', error);
      // Fallback to read-only data
      await loadReadOnlyData();
    } finally {
      setLoading(false);
    }
  };

  // Load Staking Data - REAL DATA FROM BLOCKCHAIN
  const loadStakingData = async (conn, userPublicKey, programInstance) => {
    try {
      console.log('📊 جلب بيانات Staking حقيقية من البلوكشين...');

      if (!userPublicKey) {
        console.warn('❌ لا يوجد عنوان محفظة');
        await loadReadOnlyData();
        return;
      }

      // 1. جلب رصيد MECO الحقيقي
      try {
        const tokenAccounts = await conn.getParsedTokenAccountsByOwner(
          userPublicKey,
          { programId: TOKEN_PROGRAM_ID }
        );

        const mecoAccount = tokenAccounts.value.find(acc =>
          acc.account.data.parsed.info.mint === MECO_MINT
        );

        const mecoBalance = mecoAccount
          ? mecoAccount.account.data.parsed.info.tokenAmount.uiAmount
          : 0;
        setBalance(mecoBalance);
        console.log('💰 رصيد MECO حقيقي:', mecoBalance);
      } catch (error) {
        console.warn('❌ فشل جلب رصيد MECO:', error.message);
        setBalance(0);
      }

      // 2. جلب بيانات Stake من PDA
      try {
        const [stakePDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('stake'), userPublicKey.toBuffer()],
          PROGRAM_ID_NEW
        );

        // محاولة جلب حساب Stake
        const stakeAccount = await programInstance.account.stakeAccount.fetch(stakePDA);
        
        if (stakeAccount) {
          const stakedAmount = Number(stakeAccount.amount) / 1e9; // تحويل من lamports
          setStakedAmount(stakedAmount);
          console.log('🎯 Staked amount حقيقي:', stakedAmount);

          // حساب المكافآت بناءً على وقت التثبيت
          const stakeTime = Number(stakeAccount.stakeTime);
          const currentTime = Math.floor(Date.now() / 1000);
          const timeStaked = currentTime - stakeTime;
          
          if (timeStaked > 0 && stakedAmount > 0) {
            const dailyReward = (stakedAmount * STAKING_CONFIG.APR) / 365 / 100;
            const earnedRewards = dailyReward * (timeStaked / (24 * 60 * 60));
            setRewards(earnedRewards);
            console.log('🎁 المكافآت المحسوبة:', earnedRewards);
          } else {
            setRewards(0);
          }
        } else {
          setStakedAmount(0);
          setRewards(0);
        }
      } catch (e) {
        console.log('ℹ️ No staking account found - لم يسبق التثبيت');
        setStakedAmount(0);
        setRewards(0);
      }

    } catch (error) {
      console.error('❌ Load data error:', error);
      await loadReadOnlyData();
    }
  };

  // Load read-only data (when wallet not connected)
  const loadReadOnlyData = async () => {
    try {
      if (!connection) return;
      
      console.log('📊 جلب بيانات للقراءة فقط...');
      
      // يمكن إضافة جلب بيانات عامة للعقد هنا
      // For now, set minimal data
      setBalance(0);
      setStakedAmount(0);
      setRewards(0);
      
    } catch (error) {
      console.warn('❌ Error in read-only mode:', error);
    }
  };

  const updateRewards = useCallback(() => {
    if (stakedAmount > 0) {
      const dailyReward = (stakedAmount * STAKING_CONFIG.APR) / 365 / 100;
      const minuteReward = dailyReward / (24 * 60);
      setRewards(prev => prev + minuteReward);
    }
  }, [stakedAmount]);

  const calculateEstimatedRewards = (amount) => {
    const daily = (amount * STAKING_CONFIG.APR) / 365 / 100;
    const monthly = daily * 30;
    const yearly = daily * 365;

    return {
      daily: daily.toFixed(4),
      monthly: monthly.toFixed(2),
      yearly: yearly.toFixed(2)
    };
  };

  // Handle REAL Stake Transaction
  const handleStake = async () => {
    try {
      const amount = parseFloat(stakeAmount);
      if (!amount || amount <= 0) {
        Alert.alert(t('error'), t('fill_fields'));
        return;
      }

      if (amount < STAKING_CONFIG.MIN_STAKE) {
        Alert.alert(t('error'), t('minimum_stake_amount', { amount: STAKING_CONFIG.MIN_STAKE }));
        return;
      }

      if (amount > balance) {
        Alert.alert(t('error'), t('insufficient_balance'));
        return;
      }

      if (!walletAddress || !walletPrivateKey) {
        Alert.alert(t('error'), t('wallet_not_connected'));
        return;
      }

      Alert.alert(
        t('confirm_stake_title'),
        t('confirm_stake_message', { amount, apr: STAKING_CONFIG.APR }),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('confirm'),
            onPress: async () => {
              try {
                setLoading(true);

                const userKeypair = createWalletFromPrivateKey();
                if (!userKeypair || !connection || !program) {
                  throw new Error('فشل تهيئة المحفظة أو البرنامج');
                }

                // جلب PDA الحسابات
                const [protocolPDA] = PublicKey.findProgramAddressSync(
                  [Buffer.from('protocol')],
                  PROGRAM_ID_NEW
                );

                const [stakePDA] = PublicKey.findProgramAddressSync(
                  [Buffer.from('stake'), userKeypair.publicKey.toBuffer()],
                  PROGRAM_ID_NEW
                );

                const [stakingVaultPDA] = PublicKey.findProgramAddressSync(
                  [Buffer.from('staking_vault')],
                  PROGRAM_ID_NEW
                );

                const userTokenAccount = await getAssociatedTokenAddress(
                  new PublicKey(MECO_MINT),
                  userKeypair.publicKey
                );

                const amountLamports = Math.floor(amount * 1e9); // MECO has 9 decimals

                // ✅ معاملة حقيقية على البلوكشين
                console.log('🚀 إرسال معاملة Stake حقيقية...', {
                  amount: amountLamports,
                  user: userKeypair.publicKey.toBase58(),
                  stakePDA: stakePDA.toBase58()
                });

                const tx = await program.methods
                  .stake(new BN(amountLamports))
                  .accounts({
                    protocol: protocolPDA,
                    user: userKeypair.publicKey,
                    stakeAccount: stakePDA,
                    userTokenAccount: userTokenAccount,
                    stakingVault: stakingVaultPDA,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                  })
                  .signers([userKeypair])
                  .rpc();

                console.log('✅ معاملة Stake أرسلت بنجاح:', tx);
                
                // انتظار التأكيد
                await connection.confirmTransaction(tx, 'confirmed');
                console.log('✅ معاملة Stake مؤكدة');

                // تحديث البيانات المحلية فوراً
                setStakedAmount(prev => prev + amount);
                setBalance(prev => prev - amount);
                setStakeModalVisible(false);
                setStakeAmount('');

                Alert.alert(
                  t('success'),
                  `✅ تم تثبيت ${amount} MECO بنجاح!\n\nرقم المعاملة: ${tx.substring(0, 16)}...`
                );

                // إعادة تحميل البيانات من البلوكشين
                await loadStakingData(connection, userKeypair.publicKey, program);

              } catch (error) {
                console.error('❌ Stake transaction error:', error);
                Alert.alert(
                  t('error'),
                  `فشلت المعاملة: ${error.message || t('stake_transaction_failed')}`
                );
              } finally {
                setLoading(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Stake error:', error);
      Alert.alert(t('error'), t('stake_transaction_failed'));
    }
  };

  // Handle REAL Unstake Transaction
  const handleUnstake = async () => {
    try {
      const amount = parseFloat(unstakeAmount);
      if (!amount || amount <= 0) {
        Alert.alert(t('error'), t('fill_fields'));
        return;
      }

      if (amount > stakedAmount) {
        Alert.alert(t('error'), t('amount_exceeds_staked'));
        return;
      }

      if (!walletAddress || !walletPrivateKey) {
        Alert.alert(t('error'), t('wallet_not_connected'));
        return;
      }

      Alert.alert(
        t('confirm_unstake_title'),
        t('confirm_unstake_message', { amount, days: STAKING_CONFIG.UNSTAKE_PERIOD }),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('confirm'),
            onPress: async () => {
              try {
                setLoading(true);

                const userKeypair = createWalletFromPrivateKey();
                if (!userKeypair || !connection || !program) {
                  throw new Error('فشل تهيئة المحفظة أو البرنامج');
                }

                // جلب PDA الحسابات
                const [protocolPDA] = PublicKey.findProgramAddressSync(
                  [Buffer.from('protocol')],
                  PROGRAM_ID_NEW
                );

                const [stakePDA] = PublicKey.findProgramAddressSync(
                  [Buffer.from('stake'), userKeypair.publicKey.toBuffer()],
                  PROGRAM_ID_NEW
                );

                const [stakingVaultPDA] = PublicKey.findProgramAddressSync(
                  [Buffer.from('staking_vault')],
                  PROGRAM_ID_NEW
                );

                const userTokenAccount = await getAssociatedTokenAddress(
                  new PublicKey(MECO_MINT),
                  userKeypair.publicKey
                );

                const amountLamports = Math.floor(amount * 1e9);

                // ✅ معاملة حقيقية على البلوكشين
                console.log('🚀 إرسال معاملة Unstake حقيقية...');

                const tx = await program.methods
                  .unstake(new BN(amountLamports))
                  .accounts({
                    protocol: protocolPDA,
                    user: userKeypair.publicKey,
                    stakeAccount: stakePDA,
                    userTokenAccount: userTokenAccount,
                    stakingVault: stakingVaultPDA,
                    authority: protocolPDA, // سيكون مختلفاً في التطبيق الحقيقي
                    tokenProgram: TOKEN_PROGRAM_ID,
                  })
                  .signers([userKeypair])
                  .rpc();

                console.log('✅ معاملة Unstake أرسلت بنجاح:', tx);
                
                // انتظار التأكيد
                await connection.confirmTransaction(tx, 'confirmed');
                console.log('✅ معاملة Unstake مؤكدة');

                // تحديث البيانات المحلية فوراً
                setStakedAmount(prev => prev - amount);
                setBalance(prev => prev + amount);
                setUnstakeModalVisible(false);
                setUnstakeAmount('');

                Alert.alert(
                  t('success'),
                  `✅ تم إلغاء تثبيت ${amount} MECO بنجاح!\n\nسيكون الرصيد متاحاً بعد ${STAKING_CONFIG.UNSTAKE_PERIOD} أيام.\n\nرقم المعاملة: ${tx.substring(0, 16)}...`
                );

                // إعادة تحميل البيانات من البلوكشين
                await loadStakingData(connection, userKeypair.publicKey, program);

              } catch (error) {
                console.error('❌ Unstake transaction error:', error);
                Alert.alert(t('error'), error.message || t('unstake_transaction_failed'));
              } finally {
                setLoading(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Unstake error:', error);
      Alert.alert(t('error'), t('unstake_transaction_failed'));
    }
  };

  // Handle Claim Rewards (العقد لا يدعم claimRewards حالياً)
  const handleClaimRewards = async () => {
    Alert.alert(
      t('info'),
      'ميزة claimRewards غير متوفرة في العقد الحالي. المكافآت تُحول تلقائياً عند إلغاء التثبيت (unstake).'
    );
  };

  const handleMaxStake = () => setStakeAmount(balance.toString());
  const handleMaxUnstake = () => setUnstakeAmount(stakedAmount.toString());

  // Test connection to contract
  const testConnection = async () => {
    if (!connection) return;

    try {
      const version = await connection.getVersion();
      const programInfo = await connection.getAccountInfo(PROGRAM_ID_NEW);
      
      if (programInfo) {
        Alert.alert(
          '✅ اتصال ناجح',
          `العقد الذكي نشط ومتوفر على:\n${PROGRAM_ID_NEW.toBase58().substring(0, 24)}...\n\nإصدار Solana: ${version['solana-core']}`
        );
      }
    } catch (error) {
      Alert.alert('❌ خطأ في الاتصال', error.message);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          {t('loading_staking_data')}
        </Text>
        <Text style={[styles.contractInfo, { color: colors.textSecondary }]}>
          Contract: {PROGRAM_ID_NEW.toBase58().substring(0, 20)}...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="trending-up" size={32} color={primaryColor} />
            <Text style={[styles.title, { color: colors.text }]}>
              {t('stake_title')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('stake_subtitle')}
            </Text>

            <View style={[styles.contractBadge, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="checkbox" size={14} color={colors.success} />
              <Text style={[styles.contractText, { color: colors.success }]}>
                العقد الذكي متصل
              </Text>
            </View>

            {!walletAddress && (
              <View style={[styles.warningBox, { backgroundColor: colors.warning + '20', marginTop: 10 }]}>
                <Ionicons name="warning" size={16} color={colors.warning} />
                <Text style={[styles.warningText, { color: colors.warning }]}>
                  {t('connect_wallet_real_transactions')}
                </Text>
              </View>
            )}
          </View>

          {/* APR Card */}
          <View style={[styles.aprCard, { backgroundColor: primaryColor }]}>
            <Text style={styles.aprLabel}>{t('annual_percentage_rate')}</Text>
            <Text style={styles.aprValue}>{STAKING_CONFIG.APR}%</Text>
            <Text style={styles.aprDescription}>{t('apr_description')}</Text>

            <TouchableOpacity
              style={styles.testButton}
              onPress={testConnection}
            >
              <Text style={styles.testButtonText}>{t('test_connection')}</Text>
            </TouchableOpacity>

            <Text style={styles.contractId}>
              العقد: {PROGRAM_ID_NEW.toBase58().substring(0, 16)}...
            </Text>
          </View>

          {/* Staking Card */}
          <View style={[styles.stakingCard, { backgroundColor: colors.card }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t('staking_wallet')}
              </Text>
              <TouchableOpacity onPress={() => initSolanaConnection()}>
                <Ionicons name="refresh-outline" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  {t('staked_amount')}
                </Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {stakedAmount.toFixed(2)} MECO
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  {t('accumulated_rewards')}
                </Text>
                <Text style={[styles.statValue, { color: colors.success }]}>
                  {rewards.toFixed(4)} MECO
                </Text>
              </View>
            </View>

            <View style={styles.balanceInfo}>
              <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>
                {t('available_meco_balance')}:
              </Text>
              <Text style={[styles.balanceValue, { color: colors.text }]}>
                {balance.toFixed(2)} MECO
              </Text>
            </View>

            {protocolPDA && (
              <View style={[styles.connectionStatus, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={[styles.connectionText, { color: colors.success }]}>
                  {t('connected_to_smart_contract')}
                </Text>
                <Text style={[styles.connectionSubtext, { color: colors.success }]}>
                  {protocolPDA.toBase58().substring(0, 16)}...
                </Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, {
                backgroundColor: balance <= 0 ? colors.border : primaryColor,
                opacity: balance <= 0 ? 0.6 : 1
              }]}
              onPress={() => setStakeModalVisible(true)}
              disabled={balance <= 0}
            >
              <Ionicons name="arrow-up-circle" size={24} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>{t('stake_button')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, {
                backgroundColor: stakedAmount <= 0 ? colors.border : colors.card,
                borderColor: colors.border,
                opacity: stakedAmount <= 0 ? 0.6 : 1
              }]}
              onPress={() => setUnstakeModalVisible(true)}
              disabled={stakedAmount <= 0}
            >
              <Ionicons name="arrow-down-circle" size={24} color={colors.text} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>{t('unstake_button')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, {
                backgroundColor: rewards <= 0 ? colors.border : colors.warning,
                opacity: rewards <= 0 ? 0.6 : 1
              }]}
              onPress={handleClaimRewards}
              disabled={rewards <= 0}
            >
              <Ionicons name="information-circle" size={24} color={colors.text} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>{t('claim_rewards')}</Text>
            </TouchableOpacity>
          </View>

          {/* Rewards Estimation */}
          <View style={[styles.rewardsCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.rewardsTitle, { color: colors.text }]}>
              📈 {t('estimated_rewards')}
            </Text>

            <View style={styles.rewardsGrid}>
              <View style={styles.rewardItem}>
                <Text style={[styles.rewardValue, { color: colors.success }]}>
                  {calculateEstimatedRewards(stakedAmount).daily}
                </Text>
                <Text style={[styles.rewardLabel, { color: colors.textSecondary }]}>
                  MECO {t('daily')}
                </Text>
              </View>

              <View style={styles.rewardItem}>
                <Text style={[styles.rewardValue, { color: colors.success }]}>
                  {calculateEstimatedRewards(stakedAmount).monthly}
                </Text>
                <Text style={[styles.rewardLabel, { color: colors.textSecondary }]}>
                  MECO {t('monthly')}
                </Text>
              </View>

              <View style={styles.rewardItem}>
                <Text style={[styles.rewardValue, { color: colors.success }]}>
                  {calculateEstimatedRewards(stakedAmount).yearly}
                </Text>
                <Text style={[styles.rewardLabel, { color: colors.textSecondary }]}>
                  MECO {t('yearly')}
                </Text>
              </View>
            </View>
          </View>

          {/* Notes */}
          <View style={[styles.notesCard, { backgroundColor: colors.card, borderColor: colors.warning + '30' }]}>
            <View style={styles.notesHeader}>
              <Ionicons name="shield-checkmark" size={20} color={colors.warning} />
              <Text style={[styles.notesTitle, { color: colors.text }]}>
                {t('important_notes')}
              </Text>
            </View>

            <Text style={[styles.noteText, { color: colors.textSecondary }]}>
              • {t('rewards_distributed_daily')}
              {'\n'}• {t('minimum_stake_amount', { amount: STAKING_CONFIG.MIN_STAKE })}
              {'\n'}• {t('unstake_waiting_period', { days: STAKING_CONFIG.UNSTAKE_PERIOD })}
              {'\n'}• {t('need_sol_for_fees')}
              {'\n'}• {t('rates_may_change')}
              {'\n'}• {t('real_transactions_active')}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Modals */}
      <StakeModal
        visible={stakeModalVisible}
        onClose={() => setStakeModalVisible(false)}
        colors={colors}
        primaryColor={primaryColor}
        balance={balance}
        stakeAmount={stakeAmount}
        setStakeAmount={setStakeAmount}
        onStake={handleStake}
        onMax={handleMaxStake}
        calculateEstimatedRewards={calculateEstimatedRewards}
        t={t}
      />

      <UnstakeModal
        visible={unstakeModalVisible}
        onClose={() => setUnstakeModalVisible(false)}
        colors={colors}
        primaryColor={primaryColor}
        stakedAmount={stakedAmount}
        unstakeAmount={unstakeAmount}
        setUnstakeAmount={setUnstakeAmount}
        onUnstake={handleUnstake}
        onMax={handleMaxUnstake}
        unstakePeriod={STAKING_CONFIG.UNSTAKE_PERIOD}
        t={t}
      />
    </SafeAreaView>
  );
}

// Modal Components (same as before)
const StakeModal = ({ visible, onClose, colors, primaryColor, balance, stakeAmount, setStakeAmount, onStake, onMax, calculateEstimatedRewards, t }) => (
  <Modal visible={visible} transparent animationType="slide">
    <View style={styles.modalOverlay}>
      <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            {t('stake_modal_title')}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
          {t('stake_modal_description')}
        </Text>

        <View style={[styles.amountInputContainer, { backgroundColor: colors.background }]}>
          <TextInput
            style={[styles.amountInput, { color: colors.text }]}
            placeholder="0.00"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={stakeAmount}
            onChangeText={setStakeAmount}
          />
          <Text style={[styles.currencyLabel, { color: colors.textSecondary }]}>
            MECO
          </Text>
          <TouchableOpacity onPress={onMax}>
            <Text style={[styles.maxButton, { color: primaryColor }]}>
              {t('max')}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.balanceText, { color: colors.textSecondary }]}>
          {t('available_balance')}: {balance.toFixed(2)} MECO
        </Text>

        {stakeAmount && parseFloat(stakeAmount) > 0 && (
          <View style={styles.rewardsEstimation}>
            <Text style={[styles.estimationTitle, { color: colors.text }]}>
              📊 {t('estimated_rewards')}:
            </Text>
            <View style={styles.estimationRow}>
              <Text style={[styles.estimationLabel, { color: colors.textSecondary }]}>
                {t('daily')}:
              </Text>
              <Text style={[styles.estimationValue, { color: colors.success }]}>
                {calculateEstimatedRewards(parseFloat(stakeAmount)).daily} MECO
              </Text>
            </View>
            <View style={styles.estimationRow}>
              <Text style={[styles.estimationLabel, { color: colors.textSecondary }]}>
                {t('monthly')}:
              </Text>
              <Text style={[styles.estimationValue, { color: colors.success }]}>
                {calculateEstimatedRewards(parseFloat(stakeAmount)).monthly} MECO
              </Text>
            </View>
            <View style={styles.estimationRow}>
              <Text style={[styles.estimationLabel, { color: colors.textSecondary }]}>
                {t('yearly')}:
              </Text>
              <Text style={[styles.estimationValue, { color: colors.success }]}>
                {calculateEstimatedRewards(parseFloat(stakeAmount)).yearly} MECO
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.modalButton, {
            backgroundColor: parseFloat(stakeAmount) > 0 ? primaryColor : colors.border
          }]}
          onPress={onStake}
          disabled={!stakeAmount || parseFloat(stakeAmount) <= 0}
        >
          <Text style={styles.modalButtonText}>
            {t('confirm_stake_button')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const UnstakeModal = ({ visible, onClose, colors, primaryColor, stakedAmount, unstakeAmount, setUnstakeAmount, onUnstake, onMax, unstakePeriod, t }) => (
  <Modal visible={visible} transparent animationType="slide">
    <View style={styles.modalOverlay}>
      <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            {t('unstake_modal_title')}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
          {t('unstake_modal_description')}
        </Text>

        <View style={[styles.amountInputContainer, { backgroundColor: colors.background }]}>
          <TextInput
            style={[styles.amountInput, { color: colors.text }]}
            placeholder="0.00"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={unstakeAmount}
            onChangeText={setUnstakeAmount}
          />
          <Text style={[styles.currencyLabel, { color: colors.textSecondary }]}>
            MECO
          </Text>
          <TouchableOpacity onPress={onMax}>
            <Text style={[styles.maxButton, { color: primaryColor }]}>
              {t('max')}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.balanceText, { color: colors.textSecondary }]}>
          {t('staked_amount')}: {stakedAmount.toFixed(2)} MECO
        </Text>

        <View style={styles.unstakeWarning}>
          <Ionicons name="warning-outline" size={20} color={colors.warning} />
          <Text style={[styles.warningText, { color: colors.warning }]}>
            {t('unstake_warning', { days: unstakePeriod })}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.modalButton, {
            backgroundColor: parseFloat(unstakeAmount) > 0 ? colors.error : colors.border
          }]}
          onPress={onUnstake}
          disabled={!unstakeAmount || parseFloat(unstakeAmount) <= 0}
        >
          <Text style={styles.modalButtonText}>
            {t('confirm_unstake_button')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

// 🎨 Styles (same as before)
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  contractInfo: {
    marginTop: 8,
    fontSize: 12,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
  },
  contractBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
  },
  contractText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  warningText: {
    fontSize: 12,
    marginLeft: 6,
  },
  aprCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  aprLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    marginBottom: 4,
  },
  aprValue: {
    fontSize: 48,
    color: '#FFFFFF',
    fontWeight: '800',
    marginBottom: 8,
  },
  aprDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 12,
  },
  contractId: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
  },
  testButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  stakingCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
    opacity: 0.8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  balanceInfo: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  connectionText: {
    fontSize: 12,
    marginLeft: 6,
  },
  connectionSubtext: {
    fontSize: 10,
    marginLeft: 6,
    opacity: 0.8,
  },
  actionsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    color: '#FFFFFF',
  },
  rewardsCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  rewardsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  rewardsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rewardItem: {
    alignItems: 'center',
    flex: 1,
  },
  rewardValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  rewardLabel: {
    fontSize: 12,
    opacity: 0.8,
  },
  notesCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 12,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    paddingVertical: 8,
  },
  currencyLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginHorizontal: 12,
  },
  maxButton: {
    fontSize: 14,
    fontWeight: '600',
  },
  balanceText: {
    fontSize: 14,
    marginBottom: 20,
  },
  rewardsEstimation: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  estimationTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  estimationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  estimationLabel: {
    fontSize: 13,
  },
  estimationValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  unstakeWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  warningText: {
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  modalButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
