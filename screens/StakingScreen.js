import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Animated,
  TextInput,
  Modal,
  ActivityIndicator
} from 'react-native';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

// 🔄 SOLANA/ANCHOR INTEGRATION - UPDATED IMPORTS
import { Connection, PublicKey, clusterApiUrl, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider, web3 } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

// ✅ IMPORT IDL FILE
import MECO_STAKING_IDL from '../contracts/meco_staking_idl.json';

// 🔧 Configuration
const { width } = Dimensions.get('window');
const PROGRAM_ID = 'HQdvKi4Kk5kqo7FmcpWLU7qmrLUC2tXPTNDvEyKz55Z';
const MECO_MINT = '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i';
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

  // Anchor Program Instance
  const [program, setProgram] = useState(null);
  const [connection, setConnection] = useState(null);
  const [stakingPDA, setStakingPDA] = useState(null);
  const [userStakePDA, setUserStakePDA] = useState(null);

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
        // محاولة تحويل المفتاح من JSON string
        secretKey = Uint8Array.from(JSON.parse(walletPrivateKey));
      } catch (e) {
        console.warn('❌ فشل تحويل المفتاح الخاص:', e.message);
        return null;
      }

      const keypair = Keypair.fromSecretKey(secretKey);
      
      console.log('✅ Wallet created successfully:', {
        publicKey: keypair.publicKey.toBase58(),
        secretKeyLength: secretKey.length
      });

      return {
        publicKey: keypair.publicKey,
        signTransaction: async (tx) => {
          tx.partialSign(keypair);
          return tx;
        },
        signAllTransactions: async (txs) => {
          return txs.map(tx => {
            tx.partialSign(keypair);
            return tx;
          });
        },
      };
    } catch (error) {
      console.error('❌ فشل إنشاء wallet:', error);
      return null;
    }
  };

  // Initialize Solana Connection
  const initSolanaConnection = async () => {
    try {
      setLoading(true);
      console.log('🔗 بدء اتصال Solana...');

      // Setup connection (Devnet for now)
      const conn = new Connection(clusterApiUrl('devnet'), 'confirmed');
      setConnection(conn);
      console.log('✅ اتصال Solana جاهز');

      // Check if wallet is available
      if (!walletAddress || !walletPrivateKey) {
        console.warn('❌ Wallet not connected, using mock data');
        setBalance(1000);
        setStakedAmount(500);
        setRewards(25.5);
        setLoading(false);
        return;
      }

      console.log('👛 معلومات المحفظة:', {
        walletAddress,
        walletPrivateKeyExists: !!walletPrivateKey
      });

      // إنشاء wallet
      const userWallet = createWalletFromPrivateKey();

      if (!userWallet) {
        console.warn('❌ فشل إنشاء wallet، استخدام بيانات تجريبية');
        setBalance(1000);
        setStakedAmount(500);
        setRewards(25.5);
        setLoading(false);
        return;
      }

      // Create provider
      const provider = new AnchorProvider(
        conn,
        userWallet,
        { commitment: 'confirmed' }
      );

      console.log('✅ AnchorProvider جاهز');

      // Create program instance with IDL
      const programId = new PublicKey(PROGRAM_ID);
      const prog = new Program(MECO_STAKING_IDL, programId, provider);
      setProgram(prog);

      console.log('✅ Program instance جاهز');

      // Find PDAs
      const [poolPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('staking-pool')],
        programId
      );

      const [userPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('stake-account'), new PublicKey(walletAddress).toBuffer()],
        programId
      );

      setStakingPDA(poolPDA);
      setUserStakePDA(userPDA);

      console.log('📍 PDAs:', {
        poolPDA: poolPDA.toBase58(),
        userPDA: userPDA.toBase58()
      });

      // Load real data from blockchain
      await loadStakingData(conn, prog, poolPDA, userPDA);

    } catch (error) {
      console.error('❌ Connection error:', error);
      // Fallback to mock data
      setBalance(1000);
      setStakedAmount(500);
      setRewards(25.5);
      Alert.alert(t('info'), t('using_demo_mode'));
    } finally {
      setLoading(false);
    }
  };

  // Load Staking Data from Blockchain
  const loadStakingData = async (conn, prog, poolPDA, userPDA) => {
    try {
      console.log('📊 جلب بيانات Staking...');

      // 1. Get MECO balance
      const tokenAccounts = await conn.getParsedTokenAccountsByOwner(
        new PublicKey(walletAddress),
        { programId: TOKEN_PROGRAM_ID }
      );

      const mecoAccount = tokenAccounts.value.find(acc =>
        acc.account.data.parsed.info.mint === MECO_MINT
      );

      const mecoBalance = mecoAccount
        ? mecoAccount.account.data.parsed.info.tokenAmount.uiAmount
        : 0;
      setBalance(mecoBalance);
      console.log('💰 رصيد MECO:', mecoBalance);

      // 2. Get staking pool data
      try {
        const poolData = await prog.account.stakingPool.fetch(poolPDA);
        const totalStaked = Number(poolData.totalStaked) / 1e9;
        setStakedAmount(totalStaked);
        console.log('🏦 إجمالي Staked:', totalStaked);

        // 3. Get user stake data
        const userStakeData = await prog.account.stakeAccount.fetch(userPDA);
        const userAmount = Number(userStakeData.amount) / 1e9;
        console.log('👤 مبلغ المستخدم Staked:', userAmount);

        // Calculate rewards
        const timeStaked = Math.floor(Date.now() / 1000) - Number(userStakeData.stakeTime);
        const dailyReward = (userAmount * STAKING_CONFIG.APR) / 365 / 100;
        const earnedRewards = dailyReward * (timeStaked / (24 * 60 * 60));
        setRewards(earnedRewards);
        console.log('🎁 المكافآت المحسوبة:', earnedRewards);

      } catch (e) {
        console.log('ℹ️ No staking data found:', e.message);
        setStakedAmount(0);
        setRewards(0);
      }

    } catch (error) {
      console.error('❌ Load data error:', error);
      // Use mock data as fallback
      setBalance(1000);
      setStakedAmount(500);
      setRewards(25.5);
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

      if (!program || !userStakePDA || !stakingPDA || !walletAddress) {
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

                const amountLamports = Math.floor(amount * 1e9);
                const tx = await program.methods
                  .stake(new web3.BN(amountLamports))
                  .accounts({
                    stakeAccount: userStakePDA,
                    user: new PublicKey(walletAddress),
                    stakingPool: stakingPDA,
                    systemProgram: web3.SystemProgram.programId,
                  })
                  .rpc();

                console.log('✅ Stake TX:', tx);

                // Update UI state
                setStakedAmount(prev => prev + amount);
                setBalance(prev => prev - amount);
                setStakeModalVisible(false);
                setStakeAmount('');

                Alert.alert(
                  t('success'),
                  t('stake_success', { amount, tx: tx.slice(0, 10) })
                );

                // Refresh data
                await loadStakingData(connection, program, stakingPDA, userStakePDA);

              } catch (error) {
                console.error('❌ Stake transaction error:', error);
                Alert.alert(
                  t('error'),
                  error.message?.includes('insufficient funds')
                    ? t('insufficient_sol_for_fee')
                    : t('stake_transaction_failed')
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

      if (!program || !userStakePDA || !stakingPDA || !walletAddress) {
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

                const amountLamports = Math.floor(amount * 1e9);
                const tx = await program.methods
                  .unstake(new web3.BN(amountLamports))
                  .accounts({
                    stakeAccount: userStakePDA,
                    user: new PublicKey(walletAddress),
                    stakingPool: stakingPDA,
                  })
                  .rpc();

                console.log('✅ Unstake TX:', tx);

                // Update UI state
                setStakedAmount(prev => prev - amount);
                setBalance(prev => prev + amount);
                setUnstakeModalVisible(false);
                setUnstakeAmount('');

                Alert.alert(
                  t('success'),
                  t('unstake_success', { amount, days: STAKING_CONFIG.UNSTAKE_PERIOD, tx: tx.slice(0, 10) })
                );

                // Refresh data
                await loadStakingData(connection, program, stakingPDA, userStakePDA);

              } catch (error) {
                console.error('❌ Unstake transaction error:', error);
                if (error.message?.includes('UnstakePeriod')) {
                  Alert.alert(
                    t('warning'),
                    t('unstake_period_not_passed', { days: STAKING_CONFIG.UNSTAKE_PERIOD })
                  );
                } else if (error.message?.includes('insufficient funds')) {
                  Alert.alert(t('error'), t('insufficient_sol_for_fee'));
                } else {
                  Alert.alert(t('error'), t('unstake_transaction_failed'));
                }
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

  const handleClaimRewards = async () => {
    if (rewards <= 0) {
      Alert.alert(t('warning'), t('no_rewards_to_claim'));
      return;
    }

    if (!program || !userStakePDA || !walletAddress) {
      Alert.alert(t('error'), t('wallet_not_connected'));
      return;
    }

    Alert.alert(
      t('claim_rewards_title'),
      t('claim_rewards_message', { amount: rewards.toFixed(4) }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('claim'),
          onPress: async () => {
            try {
              setLoading(true);

              const tx = await program.methods
                .claimRewards()
                .accounts({
                  stakeAccount: userStakePDA,
                  user: new PublicKey(walletAddress),
                })
                .rpc();

              console.log('✅ Claim TX:', tx);

              const claimed = rewards;
              setBalance(prev => prev + claimed);
              setRewards(0);

              Alert.alert(
                t('success'),
                t('claim_success', { amount: claimed.toFixed(4), tx: tx.slice(0, 10) })
              );

            } catch (error) {
              console.error('❌ Claim error:', error);
              if (error.message?.includes('insufficient funds')) {
                Alert.alert(t('error'), t('insufficient_sol_for_fee'));
              } else {
                Alert.alert(t('error'), t('claim_transaction_failed'));
              }
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleMaxStake = () => setStakeAmount(balance.toString());
  const handleMaxUnstake = () => setUnstakeAmount(stakedAmount.toString());

  // Test connection function
  const testConnection = async () => {
    if (!connection) return;

    try {
      const version = await connection.getVersion();
      console.log('✅ Solana Connection:', version);

      const programId = new PublicKey(PROGRAM_ID);
      const programInfo = await connection.getAccountInfo(programId);
      console.log('✅ Program Exists:', programInfo !== null);

      return programInfo !== null;
    } catch (error) {
      console.error('❌ Test connection error:', error);
      return false;
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          {t('loading_staking_data')}
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
          <View style={styles.header}>
            <Ionicons name="trending-up" size={32} color={primaryColor} />
            <Text style={[styles.title, { color: colors.text }]}>
              {t('stake_title')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('stake_subtitle')}
            </Text>

            {!walletAddress && (
              <View style={[styles.warningBox, { backgroundColor: colors.warning + '20', marginTop: 10 }]}>
                <Ionicons name="warning" size={16} color={colors.warning} />
                <Text style={[styles.warningText, { color: colors.warning }]}>
                  {t('connect_wallet_real_transactions')}
                </Text>
              </View>
            )}
          </View>

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
          </View>

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

            {program && (
              <View style={[styles.connectionStatus, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={[styles.connectionText, { color: colors.success }]}>
                  {t('connected_to_smart_contract')}
                </Text>
              </View>
            )}
          </View>

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
                backgroundColor: rewards <= 0 ? colors.border : colors.success,
                opacity: rewards <= 0 ? 0.6 : 1
              }]}
              onPress={handleClaimRewards}
              disabled={rewards <= 0}
            >
              <Ionicons name="gift" size={24} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>{t('claim_rewards')}</Text>
            </TouchableOpacity>
          </View>

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

// 🪟 Stake Modal Component
const StakeModal = ({
  visible, onClose, colors, primaryColor, balance,
  stakeAmount, setStakeAmount, onStake, onMax, calculateEstimatedRewards, t
}) => (
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

// 🪟 Unstake Modal Component
const UnstakeModal = ({
  visible, onClose, colors, primaryColor, stakedAmount,
  unstakeAmount, setUnstakeAmount, onUnstake, onMax, unstakePeriod, t
}) => (
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

// 🎨 Styles
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
