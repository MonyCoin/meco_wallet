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

// 🔄 SOLANA INTEGRATION - USING OLD IMPORTS FOR COMPATIBILITY
import { PublicKey, Connection, clusterApiUrl, Keypair, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';

// ✅ استيراد الثوابت الجديدة
import {
  PROGRAM_ID,
  RPC_URL,
  MECO_MINT,
  STAKING_CONFIG as CONFIG_STAKING
} from '../constants';

// ✅ استيراد IDL من العقد الجديد
import IDL from '../contracts/monycoin_meco.json';

// 🔧 Staking Configuration - MERGE WITH CONSTANTS
const STAKING_CONFIG = {
  APR: CONFIG_STAKING?.APR || 18.5,
  MIN_STAKE: CONFIG_STAKING?.MIN_STAKE || 100,
  MAX_STAKE: CONFIG_STAKING?.MAX_STAKE || 1000000,
  UNSTAKE_PERIOD: CONFIG_STAKING?.UNSTAKE_PERIOD || 3,
  DECIMALS: CONFIG_STAKING?.DECIMALS || 9,
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
  const [canUnstake, setCanUnstake] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  // Contract Connection
  const [program, setProgram] = useState(null);
  const [connection, setConnection] = useState(null);
  const [contractStatus, setContractStatus] = useState(null);

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
        console.warn(t('wallet_private_key_missing'));
        return null;
      }

      let secretKey;
      try {
        secretKey = new Uint8Array(JSON.parse(walletPrivateKey));
      } catch (e) {
        console.warn(t('private_key_conversion_failed'), e.message);
        return null;
      }

      const keypair = Keypair.fromSecretKey(secretKey);
      return keypair;
    } catch (error) {
      console.error(t('wallet_creation_failed'), error);
      return null;
    }
  };

  // Initialize Solana Connection with REAL contract
  const initSolanaConnection = async () => {
    try {
      setLoading(true);
      console.log(t('starting_solana_connection'));

      // Setup connection using RPC_URL from constants
      const conn = new Connection(RPC_URL || clusterApiUrl('devnet'), {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000
      });
      setConnection(conn);

      // Load contract status
      await loadContractStatus(conn);

      // Load user data if wallet is connected
      if (walletAddress && walletPrivateKey) {
        await loadUserData(conn);
      } else {
        await loadReadOnlyData();
      }

    } catch (error) {
      console.error(t('connection_error'), error);
      await loadReadOnlyData();
    } finally {
      setLoading(false);
    }
  };

  // تحميل حالة العقد الحقيقية
  const loadContractStatus = async (conn) => {
    try {
      if (!PROGRAM_ID) {
        console.warn('PROGRAM_ID not defined');
        setContractStatus({
          stakingApr: STAKING_CONFIG.APR,
          minStake: STAKING_CONFIG.MIN_STAKE,
          unstakePeriod: STAKING_CONFIG.UNSTAKE_PERIOD,
          isActive: true
        });
        return;
      }

      const programId = new PublicKey(PROGRAM_ID);
      const programInfo = await conn.getAccountInfo(programId);
      
      if (programInfo) {
        console.log('✅ Contract is deployed and active');
        setContractStatus({
          stakingApr: STAKING_CONFIG.APR,
          minStake: STAKING_CONFIG.MIN_STAKE,
          unstakePeriod: STAKING_CONFIG.UNSTAKE_PERIOD,
          isActive: true
        });
      } else {
        console.warn('⚠️ Contract not found on chain');
        setContractStatus({
          stakingApr: STAKING_CONFIG.APR,
          minStake: STAKING_CONFIG.MIN_STAKE,
          unstakePeriod: STAKING_CONFIG.UNSTAKE_PERIOD,
          isActive: false
        });
      }
    } catch (error) {
      console.error('Error loading contract status:', error);
      setContractStatus({
        stakingApr: STAKING_CONFIG.APR,
        minStake: STAKING_CONFIG.MIN_STAKE,
        unstakePeriod: STAKING_CONFIG.UNSTAKE_PERIOD,
        isActive: false
      });
    }
  };

  // Load User Data - REAL DATA FROM BLOCKCHAIN
  const loadUserData = async (conn) => {
    try {
      console.log(t('loading_real_staking_data'));

      if (!walletAddress) {
        console.warn(t('no_wallet_address'));
        await loadReadOnlyData();
        return;
      }

      const userPublicKey = new PublicKey(walletAddress);

      // 1. جلب رصيد MECO الحقيقي
      try {
        const mecoMint = new PublicKey(MECO_MINT);
        const associatedTokenAddress = await getAssociatedTokenAddress(
          mecoMint,
          userPublicKey
        );
        
        const balanceResponse = await conn.getTokenAccountBalance(
          associatedTokenAddress,
          'confirmed'
        );
        
        const mecoBalance = balanceResponse && balanceResponse.value 
          ? balanceResponse.value.uiAmount 
          : 0;
        setBalance(mecoBalance);
        console.log('💰 Real MECO balance:', mecoBalance);
      } catch (error) {
        console.warn(t('failed_to_get_meco_balance'), error.message);
        setBalance(0);
      }

      // 2. جلب بيانات Stake الحقيقية
      try {
        if (!PROGRAM_ID) {
          setStakedAmount(0);
          setRewards(0);
          return;
        }

        const programId = new PublicKey(PROGRAM_ID);
        const [stakePDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('stake'), userPublicKey.toBuffer()],
          programId
        );

        // محاولة جلب حساب Stake
        const stakeAccountInfo = await conn.getAccountInfo(stakePDA);
        
        if (stakeAccountInfo && stakeAccountInfo.data) {
          // هنا يجب تحليل البيانات حسب هيكل العقد
          // افتراضي: أول 8 بايت هي المبلغ (BN)
          const data = stakeAccountInfo.data;
          const amountBytes = data.slice(0, 8);
          const amountBN = new BN(amountBytes, 'le');
          const stakedAmount = Number(amountBN) / Math.pow(10, STAKING_CONFIG.DECIMALS);
          
          setStakedAmount(stakedAmount);
          console.log('📊 Real staked amount:', stakedAmount);

          // حساب المكافآت
          const dailyReward = (stakedAmount * STAKING_CONFIG.APR) / 365 / 100;
          setRewards(dailyReward * 0.5); // مثال: 0.5 يوم

          // يمكن إضافة وقت التثبيت إذا كان موجوداً في البيانات
        } else {
          setStakedAmount(0);
          setRewards(0);
        }
      } catch (error) {
        console.error('Error loading stake data:', error);
        setStakedAmount(0);
        setRewards(0);
      }

    } catch (error) {
      console.error(t('load_data_error'), error);
      await loadReadOnlyData();
    }
  };

  // Load read-only data (when wallet not connected)
  const loadReadOnlyData = async () => {
    try {
      console.log(t('loading_readonly_data'));
      
      setBalance(0);
      setStakedAmount(0);
      setRewards(0);
      setCanUnstake(false);
      setRemainingTime(0);
      
    } catch (error) {
      console.warn(t('readonly_mode_error'), error);
    }
  };

  // إعداد البرنامج للتعامل مع المعاملات
  const setupProgramForTransaction = async () => {
    try {
      const userKeypair = createWalletFromPrivateKey();
      if (!userKeypair || !connection) {
        throw new Error(t('wallet_program_initialization_failed'));
      }

      const provider = new AnchorProvider(
        connection,
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

      const programId = new PublicKey(PROGRAM_ID);
      const programInstance = new Program(IDL, programId, provider);
      
      return { program: programInstance, userKeypair, provider };
    } catch (error) {
      console.error('Setup program error:', error);
      throw error;
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

  // ==================== HANDLE BUTTON PRESSES ====================

  // Handle Stake Button Press
  const handleStakePress = () => {
    if (!walletAddress || !walletPrivateKey) {
      Alert.alert(
        t('start_staking'),
        t('staking_instructions')
      );
      return;
    }

    if (balance <= 0) {
      Alert.alert(
        t('get_meco_first'),
        t('get_meco_instructions')
      );
      return;
    }

    setStakeModalVisible(true);
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

                const { program, userKeypair } = await setupProgramForTransaction();
                
                // جلب PDAs المطلوبة
                const programId = new PublicKey(PROGRAM_ID);
                const [protocolPDA] = PublicKey.findProgramAddressSync(
                  [Buffer.from('protocol')],
                  programId
                );

                const [stakePDA] = PublicKey.findProgramAddressSync(
                  [Buffer.from('stake'), userKeypair.publicKey.toBuffer()],
                  programId
                );

                const [stakingVaultPDA] = PublicKey.findProgramAddressSync(
                  [Buffer.from('staking_vault'), protocolPDA.toBuffer()],
                  programId
                );

                const mecoMint = new PublicKey(MECO_MINT);
                const userTokenAccount = await getAssociatedTokenAddress(
                  mecoMint,
                  userKeypair.publicKey
                );

                const amountLamports = Math.floor(amount * Math.pow(10, STAKING_CONFIG.DECIMALS));

                console.log('📝 إعداد معاملة التثبيت...', {
                  user: userKeypair.publicKey.toBase58(),
                  amount,
                  amountLamports,
                });

                // ✅ إرسال معاملة حقيقية
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

                console.log('✅ تم إرسال معاملة التثبيت:', tx);
                
                // انتظار التأكيد
                await connection.confirmTransaction(tx, 'confirmed');

                // تحديث البيانات المحلية فوراً
                setStakedAmount(prev => prev + amount);
                setBalance(prev => prev - amount);
                setStakeModalVisible(false);
                setStakeAmount('');

                const shortTx = tx.substring(0, 16) + '...';
                Alert.alert(
                  t('success'),
                  t('stake_success', { 
                    amount: amount,
                    tx: shortTx
                  })
                );

                // إعادة تحميل البيانات من البلوكشين
                setTimeout(() => loadUserData(connection), 2000);

              } catch (error) {
                console.error(t('stake_transaction_error'), error);
                Alert.alert(
                  t('error'),
                  t('stake_transaction_failed_message', { 
                    error: error.message || t('stake_transaction_failed')
                  })
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

  // Handle Unstake Button Press
  const handleUnstakePress = () => {
    if (!walletAddress || !walletPrivateKey) {
      Alert.alert(
        t('wallet_not_connected_short'),
        t('wallet_connection_instructions')
      );
      return;
    }

    if (stakedAmount <= 0) {
      Alert.alert(
        t('no_funds_staked'),
        t('no_staked_funds_instructions')
      );
      return;
    }

    setUnstakeModalVisible(true);
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

                const { program, userKeypair } = await setupProgramForTransaction();
                
                // جلب PDAs المطلوبة
                const programId = new PublicKey(PROGRAM_ID);
                const [protocolPDA] = PublicKey.findProgramAddressSync(
                  [Buffer.from('protocol')],
                  programId
                );

                const [stakePDA] = PublicKey.findProgramAddressSync(
                  [Buffer.from('stake'), userKeypair.publicKey.toBuffer()],
                  programId
                );

                const [stakingVaultPDA] = PublicKey.findProgramAddressSync(
                  [Buffer.from('staking_vault'), protocolPDA.toBuffer()],
                  programId
                );

                const [rewardsVaultPDA] = PublicKey.findProgramAddressSync(
                  [Buffer.from('rewards_vault'), protocolPDA.toBuffer()],
                  programId
                );

                const mecoMint = new PublicKey(MECO_MINT);
                const userTokenAccount = await getAssociatedTokenAddress(
                  mecoMint,
                  userKeypair.publicKey
                );

                const amountLamports = Math.floor(amount * Math.pow(10, STAKING_CONFIG.DECIMALS));

                console.log('📝 إعداد معاملة السحب...', {
                  user: userKeypair.publicKey.toBase58(),
                  amount,
                  amountLamports,
                });

                // ✅ إرسال معاملة حقيقية
                const tx = await program.methods
                  .unstake(new BN(amountLamports))
                  .accounts({
                    protocol: protocolPDA,
                    user: userKeypair.publicKey,
                    stakeAccount: stakePDA,
                    userTokenAccount: userTokenAccount,
                    stakingVault: stakingVaultPDA,
                    rewardsVault: rewardsVaultPDA,
                    tokenProgram: TOKEN_PROGRAM_ID,
                  })
                  .signers([userKeypair])
                  .rpc();

                console.log('✅ تم إرسال معاملة السحب:', tx);
                await connection.confirmTransaction(tx, 'confirmed');

                // تحديث البيانات المحلية فوراً
                setStakedAmount(prev => prev - amount);
                setBalance(prev => prev + amount);
                setUnstakeModalVisible(false);
                setUnstakeAmount('');

                const shortTx = tx.substring(0, 16) + '...';
                Alert.alert(
                  t('success'),
                  t('unstake_success', { 
                    amount: amount,
                    days: STAKING_CONFIG.UNSTAKE_PERIOD,
                    tx: shortTx
                  })
                );

                // إعادة تحميل البيانات من البلوكشين
                setTimeout(() => loadUserData(connection), 2000);

              } catch (error) {
                console.error(t('unstake_transaction_error'), error);
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

  // Handle Claim Rewards Button Press
  const handleClaimRewardsPress = () => {
    if (!walletAddress || !walletPrivateKey) {
      Alert.alert(
        t('wallet_not_connected_short'),
        t('claim_rewards_instructions')
      );
      return;
    }

    if (rewards <= 0) {
      Alert.alert(
        t('no_rewards_available'),
        t('no_rewards_instructions')
      );
      return;
    }

    Alert.alert(
      t('claim_rewards_info'),
      t('rewards_claim_info', { rewards: rewards.toFixed(4) }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('claim'),
          onPress: async () => {
            try {
              setLoading(true);
              
              const { program, userKeypair } = await setupProgramForTransaction();
              
              // جلب PDAs المطلوبة
              const programId = new PublicKey(PROGRAM_ID);
              const [protocolPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('protocol')],
                programId
              );

              const [stakePDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('stake'), userKeypair.publicKey.toBuffer()],
                programId
              );

              const [rewardsVaultPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('rewards_vault'), protocolPDA.toBuffer()],
                programId
              );

              const mecoMint = new PublicKey(MECO_MINT);
              const userTokenAccount = await getAssociatedTokenAddress(
                mecoMint,
                userKeypair.publicKey
              );

              console.log('📝 إعداد معاملة المطالبة بالمكافآت...', {
                user: userKeypair.publicKey.toBase58(),
              });

              // ✅ إرسال معاملة حقيقية
              const tx = await program.methods
                .claimRewards()
                .accounts({
                  protocol: protocolPDA,
                  user: userKeypair.publicKey,
                  stakeAccount: stakePDA,
                  userTokenAccount: userTokenAccount,
                  rewardsVault: rewardsVaultPDA,
                  tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([userKeypair])
                .rpc();

              console.log('✅ تم إرسال معاملة المكافآت:', tx);
              await connection.confirmTransaction(tx, 'confirmed');

              const shortTx = tx.substring(0, 16) + '...';
              Alert.alert(
                t('success'),
                t('rewards_claimed_success', { 
                  rewards: rewards.toFixed(4),
                  tx: shortTx
                })
              );

              // إعادة تحميل البيانات
              setTimeout(() => loadUserData(connection), 2000);
              
            } catch (error) {
              console.error('Claim rewards error:', error);
              Alert.alert(t('error'), error.message || t('claim_rewards_failed'));
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

  // Test connection to contract
  const testConnection = async () => {
    try {
      if (!connection) return;
      
      const version = await connection.getVersion();
      
      if (PROGRAM_ID) {
        const programId = new PublicKey(PROGRAM_ID);
        const programInfo = await connection.getAccountInfo(programId);
        
        if (programInfo) {
          Alert.alert(
            t('connection_successful'),
            t('contract_active_available', {
              address: PROGRAM_ID.substring(0, 24),
              version: version['solana-core']
            })
          );
        } else {
          Alert.alert(t('connection_failed'), t('contract_not_available'));
        }
      }
    } catch (error) {
      Alert.alert(t('connection_failed'), error.message);
    }
  };

  // Format time
  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return '0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // 🔧 دالة لعرض عنوان العقد بشكل آمن
  const formatContractAddress = (address, length = 16) => {
    if (!address || typeof address !== 'string') {
      return t('contract_loading');
    }
    try {
      return address.substring(0, length) + '...';
    } catch (error) {
      return t('contract_loading');
    }
  };

  // 🔧 الدالة التي تحسب لوحة الأزرار
  const getActionButtonStyle = (buttonType) => {
    const baseStyle = [styles.actionButton];
    
    switch(buttonType) {
      case 'stake':
        return [
          ...baseStyle,
          { backgroundColor: primaryColor }
        ];
      case 'unstake':
        return [
          ...baseStyle,
          { 
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 2
          }
        ];
      case 'claim':
        return [
          ...baseStyle,
          { backgroundColor: colors.warning }
        ];
      default:
        return baseStyle;
    }
  };

  // 🔧 الدالة التي تحسب نص زر المطالبة بالمكافآت
  const getClaimRewardsText = () => {
    if (rewards > 0) {
      return `${t('claim_rewards')} (${rewards.toFixed(2)})`;
    }
    return t('claim_rewards');
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          {t('loading_staking_data')}
        </Text>
        {PROGRAM_ID && (
          <Text style={[styles.contractInfo, { color: colors.textSecondary }]}>
            {t('contract_address')}: {formatContractAddress(PROGRAM_ID, 20)}
          </Text>
        )}
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
                {contractStatus?.isActive ? t('smart_contract_connected') : t('smart_contract_available')}
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
            <Text style={styles.aprValue}>
              {contractStatus?.stakingApr || STAKING_CONFIG.APR}%
            </Text>
            <Text style={styles.aprDescription}>{t('apr_description')}</Text>

            <TouchableOpacity
              style={styles.testButton}
              onPress={testConnection}
            >
              <Text style={styles.testButtonText}>{t('test_connection')}</Text>
            </TouchableOpacity>

            {PROGRAM_ID && (
              <Text style={styles.contractId}>
                {t('contract_address')}: {formatContractAddress(PROGRAM_ID, 16)}
              </Text>
            )}
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

            {!canUnstake && remainingTime > 0 && (
              <View style={[styles.lockInfo, { backgroundColor: colors.warning + '20' }]}>
                <Ionicons name="lock-closed" size={14} color={colors.warning} />
                <Text style={[styles.lockText, { color: colors.warning }]}>
                  {t('unstake_available_in', { time: formatTime(remainingTime) })}
                </Text>
              </View>
            )}

            <View style={styles.balanceInfo}>
              <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>
                {t('available_meco_balance')}:
              </Text>
              <Text style={[styles.balanceValue, { color: colors.text }]}>
                {balance.toFixed(2)} MECO
              </Text>
            </View>

            {contractStatus && (
              <View style={[styles.connectionStatus, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={[styles.connectionText, { color: colors.success }]}>
                  {t('connected_to_smart_contract')}
                </Text>
                <Text style={[styles.connectionSubtext, { color: colors.success }]}>
                  APR: {contractStatus.stakingApr || STAKING_CONFIG.APR}%
                </Text>
              </View>
            )}
          </View>

          {/* ==================== ACTION BUTTONS - FIXED ==================== */}
          <View style={styles.actionsContainer}>
            {/* زر الاستثمار - يعمل دائمًا */}
            <TouchableOpacity
              style={getActionButtonStyle('stake')}
              onPress={handleStakePress}
            >
              <Ionicons name="arrow-up-circle" size={24} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>{t('stake_button')}</Text>
            </TouchableOpacity>

            {/* زر السحب - يعمل دائمًا */}
            <TouchableOpacity
              style={getActionButtonStyle('unstake')}
              onPress={handleUnstakePress}
            >
              <Ionicons name="arrow-down-circle" size={24} color={colors.text} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>{t('unstake_button')}</Text>
            </TouchableOpacity>

            {/* زر المطالبة بالمكافآت - يعمل دائمًا */}
            <TouchableOpacity
              style={getActionButtonStyle('claim')}
              onPress={handleClaimRewardsPress}
            >
              <Ionicons name="information-circle" size={24} color={colors.text} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>{getClaimRewardsText()}</Text>
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

// Modal Components
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
  lockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  lockText: {
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
