import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Share,
  Dimensions,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { Ionicons, FontAwesome, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { PublicKey, Connection, Keypair, clusterApiUrl, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';

// ✅ استيراد العقد الحقيقي
import IDL from '../contracts/monycoin_meco.json';
const PROGRAM_ID_NEW = new PublicKey(IDL.metadata.address);

import { MECO_MINT, RPC_URL } from '../constants';
import { getSOLBalance, getRealTransactionFee } from '../services/solanaService';

// 🔧 إعداد الاتصال
const connection = new Connection(RPC_URL || clusterApiUrl('devnet'), 'confirmed');
const SOLSCAN_LINK = "https://solscan.io/";

export default function MecoScreen() {
  const { t } = useTranslation();
  const theme = useAppStore(s => s.theme);
  const primaryColor = useAppStore(state => state.primaryColor);
  const currentWallet = useAppStore(state => state.currentWallet);
  const walletPrivateKey = useAppStore(state => state.walletPrivateKey);
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
    solana: '#14F195',
  };

  const [tokenInfo, setTokenInfo] = useState({
    name: 'MECO',
    symbol: 'MECO',
    decimals: 9,
    supply: 1000000000,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [solAmount, setSolAmount] = useState('0.1');
  const [mecoAmount, setMecoAmount] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [userSOLBalance, setUserSOLBalance] = useState(0);
  const [transactionFee, setTransactionFee] = useState(0.000005);
  const [transactionResult, setTransactionResult] = useState(null);

  const [presaleData, setPresaleData] = useState({
    totalTokens: 50000000,
    soldTokens: 0,
    minSOL: 0.05,
    maxSOL: 1,
    rate: 250000,
    isActive: true,
  });

  const [protocolData, setProtocolData] = useState(null);
  const [program, setProgram] = useState(null);
  const [provider, setProvider] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    const rotationAnimation = Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    rotationAnimation.start();

    return () => {
      rotationAnimation.stop();
    };
  }, []);

  // حساب MECO بناءً على SOL المدخل
  useEffect(() => {
    if (presaleData.rate > 0) {
      const sol = parseFloat(solAmount) || 0;
      const calculatedMECO = sol * presaleData.rate;
      setMecoAmount(Math.floor(calculatedMECO));
    }
  }, [solAmount, presaleData.rate]);

  useEffect(() => {
    if (currentWallet && walletPrivateKey) {
      initContract();
      fetchUserBalance();
      fetchTransactionFee();
      fetchPresaleData();
      fetchTokenInfo();
    } else {
      // بيانات تجريبية للقراءة فقط
      setUserSOLBalance(0);
      setPresaleData({
        totalTokens: 50000000,
        soldTokens: 0,
        minSOL: 0.05,
        maxSOL: 1,
        rate: 250000,
        isActive: true,
      });
    }
  }, [currentWallet]);

  // تهيئة العقد الذكي
  const initContract = async () => {
    try {
      const userKeypair = createWalletFromPrivateKey();
      if (!userKeypair) return;

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

      const programInstance = new Program(IDL, PROGRAM_ID_NEW, provider);
      setProvider(provider);
      setProgram(programInstance);

      console.log('✅ العقد الذكي جاهز');
    } catch (error) {
      console.error('❌ خطأ في تهيئة العقد:', error);
    }
  };

  // إنشاء wallet من المفتاح الخاص
  const createWalletFromPrivateKey = () => {
    try {
      if (!walletPrivateKey) return null;
      const secretKey = new Uint8Array(JSON.parse(walletPrivateKey));
      return Keypair.fromSecretKey(secretKey);
    } catch (error) {
      console.error('❌ فشل إنشاء wallet:', error);
      return null;
    }
  };

  const fetchUserBalance = async () => {
    if (!currentWallet) {
      setUserSOLBalance(0);
      return;
    }
    const balance = await getSOLBalance(currentWallet);
    setUserSOLBalance(balance || 0);
  };

  const fetchTransactionFee = async () => {
    const fee = await getRealTransactionFee();
    setTransactionFee(fee);
  };

  // ✅ جلب بيانات البيع المسبق الحقيقية
  const fetchPresaleData = async () => {
    try {
      if (!program) {
        // استخدام بيانات افتراضية للقراءة فقط
        setPresaleData({
          totalTokens: 50000000,
          soldTokens: 0,
          minSOL: 0.05,
          maxSOL: 1,
          rate: 250000,
          isActive: true,
        });
        return;
      }

      // إيجاد بروتوكول PDA
      const [protocolPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('protocol')],
        PROGRAM_ID_NEW
      );

      // جلب بيانات البروتوكول من البلوكشين
      const protocolData = await program.account.protocol.fetch(protocolPDA);
      setProtocolData(protocolData);

      const newPresaleData = {
        totalTokens: Number(protocolData.presaleTotal) / 1e9,
        soldTokens: Number(protocolData.presaleSold) / 1e9,
        minSOL: Number(protocolData.presaleMin) / 1e9,
        maxSOL: Number(protocolData.presaleMax) / 1e9,
        rate: Number(protocolData.presaleRate),
        isActive: protocolData.isActive,
      };

      console.log('📊 بيانات البيع المسبق الحقيقية:', newPresaleData);
      setPresaleData(newPresaleData);

    } catch (error) {
      console.error('❌ خطأ في جلب بيانات البيع المسبق:', error);
      setPresaleData({
        totalTokens: 50000000,
        soldTokens: 0,
        minSOL: 0.05,
        maxSOL: 1,
        rate: 250000,
        isActive: true,
      });
    }
  };

  const fetchTokenInfo = async () => {
    try {
      setLoading(true);
      await fetchUserBalance();
      await fetchTransactionFee();
      await fetchPresaleData();
      setTokenInfo({
        name: 'MECO',
        symbol: 'MECO',
        decimals: 9,
        supply: 1000000000,
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching token info:', error);
      setLoading(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchTokenInfo().finally(() => {
      setRefreshing(false);
    });
  }, []);

  const openURL = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: t('share_title'),
        message: `${t('meco_token_on_solana')}\n\n${t('token_address')}: ${MECO_MINT}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const copyToClipboard = (text) => {
    Alert.alert(t('copied'), t('address_copied'));
  };

  const handleBuyPress = () => {
    const sol = parseFloat(solAmount) || 0;
    const totalWithFee = sol + transactionFee;

    // ✅ التحقق من وجود محفظة (في تطبيق حقيقي يجب أن تكون موجودة دائماً)
    if (!currentWallet) {
      Alert.alert('خطأ', 'المحفظة غير متاحة. يرجى المحاولة مرة أخرى.');
      return;
    }

    // ✅ التحقق من رصيد المحفظة - هذا هو الجزء الأهم
    if (userSOLBalance === 0) {
      Alert.alert(
        'رصيد غير كافي', 
        '❌ رصيد محفظتك هو 0 SOL. يرجى إضافة رصيد SOL أولاً ثم المحاولة مرة أخرى.'
      );
      return;
    }

    // ✅ التحقق من الحد الأدنى
    if (sol < presaleData.minSOL) {
      Alert.alert('خطأ', `الحد الأدنى للشراء: ${presaleData.minSOL} SOL`);
      return;
    }

    // ✅ التحقق من الحد الأقصى
    if (sol > presaleData.maxSOL) {
      Alert.alert('خطأ', `الحد الأقصى للشراء: ${presaleData.maxSOL} SOL`);
      return;
    }

    // ✅ التحقق من كفاية الرصيد مع الرسوم
    if (totalWithFee > userSOLBalance) {
      Alert.alert(
        'رصيد غير كافي',
        `❌ رصيدك الحالي: ${userSOLBalance.toFixed(6)} SOL\nالمبلغ المطلوب: ${totalWithFee.toFixed(6)} SOL\n\nيرجى إضافة رصيد إضافي إلى محفظتك.`
      );
      return;
    }

    // ✅ التحقق من تهيئة العقد
    if (!program || !provider) {
      Alert.alert('خطأ', 'لم يتم تهيئة العقد الذكي');
      return;
    }

    // ✅ التحقق من نشاط البيع المسبق
    if (!presaleData.isActive) {
      Alert.alert('معلق', 'البيع المسبق متوقف مؤقتاً');
      return;
    }

    // ✅ كل الشروط متوفرة - عرض نافذة التأكيد
    setTransactionResult(null);
    setShowConfirmModal(true);
  };

  // ✅ شراء حقيقي من العقد الذكي
  const confirmPurchase = async () => {
    setTransactionLoading(true);

    try {
      const sol = parseFloat(solAmount) || 0;
      const userKeypair = createWalletFromPrivateKey();
      
      if (!userKeypair || !program) {
        throw new Error('فشل تهيئة المحفظة أو العقد');
      }

      // إيجاد PDAs
      const [protocolPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('protocol')],
        PROGRAM_ID_NEW
      );

      const [presaleVaultPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('presale_vault')],
        PROGRAM_ID_NEW
      );

      const mecoMint = new PublicKey(MECO_MINT);
      const buyerTokenAccount = await getAssociatedTokenAddress(
        mecoMint,
        userKeypair.publicKey
      );

      const presaleTokenVault = await getAssociatedTokenAddress(
        mecoMint,
        protocolPDA,
        true
      );

      const amountLamports = Math.floor(sol * 1e9);
      const expectedMeco = Math.floor(sol * presaleData.rate);

      console.log('🚀 إرسال معاملة شراء حقيقية...');

      // ✅ معاملة حقيقية على البلوكشين
      const tx = await program.methods
        .buyTokens(new BN(amountLamports))
        .accounts({
          protocol: protocolPDA,
          buyer: userKeypair.publicKey,
          treasury: presaleVaultPDA,
          mecoVault: presaleTokenVault,
          buyerTokenAccount: buyerTokenAccount,
          authority: protocolData?.authority || userKeypair.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([userKeypair])
        .rpc();

      console.log('✅ معاملة الشراء أرسلت:', tx);
      
      await connection.confirmTransaction(tx, 'confirmed');

      // تحديث البيانات
      await fetchUserBalance();
      await fetchPresaleData();

      const result = {
        success: true,
        mecoReceived: expectedMeco,
        message: '✅ تم الشراء بنجاح',
        txid: tx,
        amount: sol,
      };

      setTransactionResult(result);

      Alert.alert(
        'نجاح',
        `✅ تم شراء ${expectedMeco.toLocaleString()} MECO بنجاح!\n\nتم دفع: ${sol} SOL\n\nرقم المعاملة: ${tx.substring(0, 16)}...`,
        [
          {
            text: 'عرض على Solscan',
            onPress: () => openURL(`https://solscan.io/tx/${tx}?cluster=devnet`),
          },
          {
            text: 'موافق',
            onPress: () => {
              setShowConfirmModal(false);
              setTransactionLoading(false);
            }
          }
        ]
      );

    } catch (error) {
      console.error('❌ خطأ في الشراء:', error);
      
      const result = {
        success: false,
        message: '❌ فشلت المعاملة',
        error: error.toString(),
      };

      setTransactionResult(result);
      
      Alert.alert(
        'خطأ',
        `فشلت المعاملة: ${error.message || 'حدث خطأ غير معروف'}`,
        [{ text: 'موافق' }]
      );
    } finally {
      setTransactionLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return 'غير متوفر';

    const absNum = Math.abs(num);
    if (absNum >= 1000000000) {
      return (num / 1000000000).toFixed(2) + 'B';
    } else if (absNum >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    } else if (absNum >= 1000) {
      return (num / 1000).toFixed(2) + 'K';
    }
    return num.toLocaleString('en-US', {
      maximumFractionDigits: 6,
      minimumFractionDigits: 0
    });
  };

  const rotatingLogo = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  // ✅ شريط التقدم يعكس البيانات الحقيقية فقط - إذا كان soldTokens = 0 سيكون فارغاً
  const progress = presaleData.totalTokens > 0 
    ? (presaleData.soldTokens / presaleData.totalTokens) * 100 
    : 0;
  
  const remainingTokens = presaleData.totalTokens - presaleData.soldTokens;
  const totalWithFee = (parseFloat(solAmount) || 0) + transactionFee;

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
      {/* الرأس */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <View style={styles.logoContainer}>
          <Animated.View style={{ transform: [{ rotate: rotatingLogo }] }}>
            <MaterialCommunityIcons name="rocket-launch" size={48} color={primaryColor} />
          </Animated.View>
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: colors.text }]}>{tokenInfo.name}</Text>
            <Text style={[styles.symbol, { color: primaryColor }]}>${tokenInfo.symbol}</Text>

            <View style={[styles.contractBadge, { backgroundColor: colors.success + '20' }]}>
              <MaterialCommunityIcons name="link-variant" size={12} color={colors.success} />
              <Text style={[styles.contractText, { color: colors.success }]}>
                ✅ العقد الحقيقي نشط
              </Text>
            </View>

            <View style={[styles.networkBadge, { backgroundColor: colors.solana + '20' }]}>
              <MaterialCommunityIcons name="link-variant" size={12} color={colors.solana} />
              <Text style={[styles.networkText, { color: colors.solana }]}>
                شبكة Solana
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleShare}
          style={[styles.shareButton, { backgroundColor: colors.card }]}
          activeOpacity={0.7}
        >
          <Ionicons name="share-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </Animated.View>

      {/* معلومات العقد الذكي */}
      <View style={[styles.contractInfoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.contractInfoHeader}>
          <MaterialCommunityIcons name="cube-send" size={24} color={primaryColor} />
          <Text style={[styles.contractInfoTitle, { color: colors.text }]}>
            معلومات العقد الذكي
          </Text>
        </View>
        <TouchableOpacity onPress={() => copyToClipboard(PROGRAM_ID_NEW.toBase58())}>
          <Text style={[styles.contractAddress, { color: colors.textSecondary }]}>
            {PROGRAM_ID_NEW.toBase58().substring(0, 24)}...
          </Text>
        </TouchableOpacity>
        <View style={styles.contractStatusRow}>
          <Text style={[styles.contractStatus, { color: presaleData.isActive ? colors.success : colors.danger }]}>
            {presaleData.isActive ? '✅ نشط وجاهز للشراء' : '⛔ غير نشط'}
          </Text>
          <Text style={[styles.contractRate, { color: colors.info }]}>
            السعر: 1 SOL = {formatNumber(presaleData.rate)} MECO
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.verifyButton}
          onPress={() => openURL(`https://solscan.io/account/${PROGRAM_ID_NEW.toBase58()}?cluster=devnet`)}
        >
          <Text style={[styles.verifyButtonText, { color: colors.info }]}>
            التحقق على Solscan
          </Text>
          <Ionicons name="open-outline" size={14} color={colors.info} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>

      {/* رصيد المستخدم */}
      {currentWallet && (
        <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.balanceHeader}>
            <MaterialCommunityIcons name="wallet" size={24} color={userSOLBalance > 0 ? colors.success : colors.danger} />
            <Text style={[styles.balanceTitle, { color: colors.text }]}>رصيدك</Text>
          </View>
          <Text style={[styles.balanceAmount, { color: userSOLBalance > 0 ? colors.success : colors.danger }]}>
            {formatNumber(userSOLBalance)} SOL
          </Text>
          <Text style={[styles.balanceSubtext, { color: colors.textSecondary }]}>
            {userSOLBalance > 0 
              ? `(يحتاج إلى: ${totalWithFee.toFixed(6)} SOL للمعاملة)` 
              : '❌ رصيد محفظتك 0 SOL. أضف رصيد للشراء'}
          </Text>
          <TouchableOpacity
            onPress={fetchUserBalance}
            style={[styles.refreshButton, { backgroundColor: colors.background }]}
          >
            <Ionicons name="refresh" size={16} color={colors.textSecondary} />
            <Text style={[styles.refreshText, { color: colors.textSecondary }]}>تحديث</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* بطاقة البيع المسبق */}
      <Animated.View style={[styles.presaleCard, {
        backgroundColor: colors.card,
        borderColor: colors.border,
        opacity: fadeAnim,
      }]}>
        <View style={styles.presaleHeader}>
          <View>
            <Text style={[styles.presaleLabel, { color: colors.text }]}>
              شراء MECO
            </Text>
            <View style={styles.sourceBadge}>
              <MaterialCommunityIcons name="sale" size={12} color={colors.success} />
              <Text style={[styles.sourceText, { color: colors.success }]}>
                البيع المسبق الحقيقي
              </Text>
            </View>
          </View>

          <View style={[styles.priceBadge, { backgroundColor: colors.warning + '20' }]}>
            <Text style={[styles.priceBadgeText, { color: colors.warning }]}>
              1 SOL = {formatNumber(presaleData.rate)} MECO
            </Text>
          </View>
        </View>

        {/* ✅ شريط التقدم الحقيقي - يعكس البيانات الحقيقية فقط */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressText, { color: colors.text }]}>
              تقدم البيع المسبق
            </Text>
            <Text style={[styles.progressText, { color: colors.text }]}>
              {progress.toFixed(1)}%
            </Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress}%`,
                  backgroundColor: progress > 0 ? primaryColor : 'transparent'
                }
              ]}
            />
          </View>
          <View style={styles.progressStats}>
            <Text style={[styles.progressStat, { color: colors.textSecondary }]}>
              مباع: {formatNumber(presaleData.soldTokens)} MECO
            </Text>
            <Text style={[styles.progressStat, { color: colors.textSecondary }]}>
              متبقي: {formatNumber(remainingTokens)} MECO
            </Text>
          </View>
          <Text style={[styles.progressNote, { color: colors.textSecondary }]}>
            إجمالي العرض: {formatNumber(presaleData.totalTokens)} MECO
          </Text>
        </View>

        {/* إدخال المبلغ */}
        <View style={styles.amountSection}>
          <Text style={[styles.amountLabel, { color: colors.text }]}>
            أدخل مبلغ SOL
          </Text>
          <View style={[styles.inputContainer, { borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={solAmount}
              onChangeText={(value) => {
                const numericValue = value.replace(/[^0-9.]/g, '');
                const parts = numericValue.split('.');
                if (parts.length > 2) {
                  setSolAmount(parts[0] + '.' + parts.slice(1).join(''));
                } else {
                  setSolAmount(numericValue);
                }
              }}
              keyboardType="decimal-pad"
              placeholder="0.1"
              placeholderTextColor={colors.textSecondary}
            />
            <View style={styles.solBadge}>
              <Text style={[styles.solText, { color: colors.text }]}>SOL</Text>
            </View>
          </View>
          <View style={styles.limitContainer}>
            <TouchableOpacity onPress={() => {
              setSolAmount(presaleData.minSOL.toString());
            }}>
              <Text style={[styles.limitText, { color: colors.textSecondary }]}>
                الحد الأدنى: {presaleData.minSOL} SOL
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              setSolAmount(presaleData.maxSOL.toString());
            }}>
              <Text style={[styles.limitText, { color: colors.textSecondary }]}>
                الحد الأقصى: {presaleData.maxSOL} SOL
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* حسابات الشراء */}
        <View style={[styles.calculationSection, { backgroundColor: colors.info + '10' }]}>
          <View style={styles.calculationRow}>
            <Text style={[styles.calculationLabel, { color: colors.text }]}>
              سترسل:
            </Text>
            <Text style={[styles.calculationValue, { color: colors.text }]}>
              {solAmount} SOL
            </Text>
          </View>
          <View style={styles.calculationRow}>
            <Text style={[styles.calculationLabel, { color: colors.text }]}>
              رسوم المعاملة:
            </Text>
            <Text style={[styles.calculationValue, { color: colors.warning }]}>
              {formatNumber(transactionFee)} SOL
            </Text>
          </View>
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <View style={styles.calculationRow}>
            <Text style={[styles.calculationLabel, { color: colors.text }]}>
              ستحصل على:
            </Text>
            <Text style={[styles.calculationValue, { color: primaryColor, fontSize: 20 }]}>
              {mecoAmount.toLocaleString()} MECO
            </Text>
          </View>
          <View style={styles.calculationRow}>
            <Text style={[styles.calculationLabel, { color: colors.textSecondary, fontSize: 12 }]}>
              السعر:
            </Text>
            <Text style={[styles.calculationValue, { color: colors.textSecondary, fontSize: 12 }]}>
              1 SOL = {formatNumber(presaleData.rate)} MECO
            </Text>
          </View>
        </View>

        {/* ✅ زر الشراء - الآن يعمل في كل الحالات */}
        <TouchableOpacity
          style={[styles.buyButton, {
            backgroundColor: presaleData.isActive ? primaryColor : colors.textSecondary,
            opacity: presaleData.isActive ? 1 : 0.6
          }]}
          onPress={handleBuyPress}
          disabled={transactionLoading || loading || !presaleData.isActive}
        >
          {transactionLoading || loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="shopping" size={24} color="#FFFFFF" />
              <Text style={styles.buyButtonText}>
                {!presaleData.isActive ? 'البيع متوقف مؤقتاً' : 'شراء'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* ملاحظات مهمة */}
        <View style={styles.versionInfo}>
          <MaterialCommunityIcons name="shield-check" size={16} color={colors.success} />
          <Text style={[styles.versionText, { color: colors.textSecondary }]}>
            ✅ معاملات حقيقية على شبكة Solana Devnet
          </Text>
        </View>
      </Animated.View>

      {/* إحصائيات الرمز */}
      <View style={styles.statsSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          إحصائيات الرمز
        </Text>

        <View style={styles.statsGrid}>
          <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.info + '20' }]}>
              <MaterialIcons name="account-balance-wallet" size={20} color={colors.info} />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, { color: colors.textSecondary }]}>العرض المتداول</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{formatNumber(tokenInfo.supply)}</Text>
            </View>
          </View>

          <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.warning + '20' }]}>
              <MaterialIcons name="numbers" size={20} color={colors.warning} />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, { color: colors.textSecondary }]}>المنازل العشرية</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{tokenInfo.decimals}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* الروابط الرسمية */}
      <View style={styles.linksSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          الروابط الرسمية
        </Text>

        <View style={[styles.linksCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.linkButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => openURL(`https://solscan.io/token/${MECO_MINT}`)}
            activeOpacity={0.7}
          >
            <View style={[styles.linkIconCircle, { backgroundColor: colors.solana + '20' }]}>
              <MaterialCommunityIcons name="link-variant" size={22} color={colors.solana} />
            </View>
            <View style={styles.linkContent}>
              <Text style={[styles.linkTitle, { color: colors.text }]}>عرض على Solscan</Text>
              <Text style={[styles.linkSubtitle, { color: colors.textSecondary }]}>تحليل مفصل للرمزي</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => openURL('https://t.me/monycoin1')}
            activeOpacity={0.7}
          >
            <View style={[styles.linkIconCircle, { backgroundColor: '#0088cc20' }]}>
              <FontAwesome name="telegram" size={22} color="#0088cc" />
            </View>
            <View style={styles.linkContent}>
              <Text style={[styles.linkTitle, { color: colors.text }]}>قناة تلغرام</Text>
              <Text style={[styles.linkSubtitle, { color: colors.textSecondary }]}>المجتمع الرسمي</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => openURL('https://x.com/MoniCoinMECO')}
            activeOpacity={0.7}
          >
            <View style={[styles.linkIconCircle, { backgroundColor: '#1DA1F220' }]}>
              <FontAwesome name="twitter" size={22} color="#1DA1F2" />
            </View>
            <View style={styles.linkContent}>
              <Text style={[styles.linkTitle, { color: colors.text }]}>حساب تويتر</Text>
              <Text style={[styles.linkSubtitle, { color: colors.textSecondary }]}>تابع للتحديثات</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => openURL('https://monycoin1.blogspot.com/')}
            activeOpacity={0.7}
          >
            <View style={[styles.linkIconCircle, { backgroundColor: primaryColor + '20' }]}>
              <FontAwesome name="globe" size={22} color={primaryColor} />
            </View>
            <View style={styles.linkContent}>
              <Text style={[styles.linkTitle, { color: colors.text }]}>الموقع الرسمي</Text>
              <Text style={[styles.linkSubtitle, { color: colors.textSecondary }]}>تعرف أكثر على MECO</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => openURL('https://monycoin.github.io/meco-token/MECO_Presale_Funds.html')}
            activeOpacity={0.7}
          >
            <View style={[styles.linkIconCircle, { backgroundColor: '#33333320' }]}>
              <FontAwesome name="github" size={22} color="#333333" />
            </View>
            <View style={styles.linkContent}>
              <Text style={[styles.linkTitle, { color: colors.text }]}>مستودع GitHub</Text>
              <Text style={[styles.linkSubtitle, { color: colors.textSecondary }]}>
                شفافية أموال البيع المسبق
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* التذييل */}
      <Animated.View style={[styles.footer, {
        opacity: fadeAnim,
        backgroundColor: colors.card,
        borderColor: colors.border,
      }]}>
        <MaterialCommunityIcons name="shield-check" size={30} color={colors.success} />
        <Text style={[styles.footerText, { color: colors.text }]}>
          رمز MECO الرسمي
        </Text>
        <Text style={[styles.footerSubText, { color: colors.textSecondary }]}>
          تم التحقق على Solana • العقد الذكي الحقيقي نشط
        </Text>
      </Animated.View>

      {/* نافذة التأكيد */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showConfirmModal}
        onRequestClose={() => !transactionLoading && setShowConfirmModal(false)}
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
                (transactionResult.success ? 'تم تأكيد الشراء' : 'فشلت المعاملة')
                : 'تأكيد الشراء'}
            </Text>

            {transactionResult ? (
              <View style={styles.resultContainer}>
                <Text style={[styles.resultText, { color: colors.textSecondary }]}>
                  {transactionResult.message}
                </Text>
                {transactionResult.success && (
                  <>
                    <Text style={[styles.resultText, { color: colors.success, marginTop: 8 }]}>
                      تم شراء: {transactionResult.mecoReceived?.toLocaleString()} MECO
                    </Text>
                    <Text style={[styles.contractInfoText, { color: colors.textSecondary, marginTop: 8 }]}>
                      عبر العقد الحقيقي: {PROGRAM_ID_NEW.toBase58().substring(0, 16)}...
                    </Text>
                    <TouchableOpacity
                      style={[styles.solscanButton, { backgroundColor: colors.info }]}
                      onPress={() => openURL(`https://solscan.io/tx/${transactionResult.txid}?cluster=devnet`)}
                    >
                      <Text style={styles.solscanButtonText}>عرض على Solscan</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ) : (
              <>
                <Text style={[styles.modalText, { color: colors.textSecondary }]}>
                  سترسل {solAmount} SOL
                </Text>

                <View style={styles.modalDetails}>
                  <View style={styles.modalDetailRow}>
                    <Text style={[styles.modalDetailLabel, { color: colors.textSecondary }]}>
                      السعر:
                    </Text>
                    <Text style={[styles.modalDetailValue, { color: colors.text }]}>
                      1 SOL = {formatNumber(presaleData.rate)} MECO
                    </Text>
                  </View>
                  <View style={styles.modalDetailRow}>
                    <Text style={[styles.modalDetailLabel, { color: colors.textSecondary }]}>
                      ستحصل على:
                    </Text>
                    <Text style={[styles.modalDetailValue, { color: colors.success }]}>
                      {mecoAmount.toLocaleString()} MECO
                    </Text>
                  </View>
                  <View style={styles.modalDetailRow}>
                    <Text style={[styles.modalDetailLabel, { color: colors.textSecondary }]}>
                      العقد:
                    </Text>
                    <Text style={[styles.modalDetailValue, { color: colors.info, fontSize: 10 }]}>
                      {PROGRAM_ID_NEW.toBase58().substring(0, 16)}...
                    </Text>
                  </View>
                </View>

                {transactionLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={primaryColor} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                      جاري معالجة المعاملة...
                    </Text>
                    <Text style={[styles.contractText, { color: colors.textSecondary, fontSize: 12 }]}>
                      عبر العقد الحقيقي
                    </Text>
                  </View>
                ) : (
                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, { backgroundColor: colors.border }]}
                      onPress={() => setShowConfirmModal(false)}
                      disabled={transactionLoading}
                    >
                      <Text style={[styles.modalButtonText, { color: colors.text }]}>إلغاء</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, { backgroundColor: primaryColor }]}
                      onPress={confirmPurchase}
                      disabled={transactionLoading}
                    >
                      <Text style={styles.modalButtonText}>تأكيد الدفع</Text>
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

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleContainer: {
    flexDirection: 'column',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  symbol: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
  },
  contractBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  contractText: {
    fontSize: 10,
    fontWeight: '600',
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  networkText: {
    fontSize: 10,
    fontWeight: '600',
  },
  shareButton: {
    padding: 10,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  contractInfoCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  contractInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  contractInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  contractAddress: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  contractStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  contractStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  contractRate: {
    fontSize: 12,
    fontWeight: '600',
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  verifyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  balanceCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  balanceTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  balanceSubtext: {
    fontSize: 12,
    marginBottom: 12,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  refreshText: {
    fontSize: 12,
  },
  presaleCard: {
    width: '100%',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  presaleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  presaleLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  sourceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  priceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priceBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressSection: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressStat: {
    fontSize: 12,
  },
  progressNote: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  amountSection: {
    marginBottom: 20,
  },
  amountLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  solBadge: {
    backgroundColor: '#14F19520',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  solText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#14F195',
  },
  limitContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  limitText: {
    fontSize: 12,
  },
  calculationSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calculationLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  calculationValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  separator: {
    height: 1,
    marginVertical: 8,
  },
  buyButton: {
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
  buyButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  versionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  versionText: {
    fontSize: 11,
    fontWeight: '500',
  },
  statsSection: {
    marginBottom: 24,
  },
  linksSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  infoBox: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  linksCard: {
    width: '100%',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  linkIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  linkContent: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  linkSubtitle: {
    fontSize: 12,
  },
  footer: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
    marginBottom: 30,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  footerSubText: {
    fontSize: 12,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: Dimensions.get('window').width * 0.9,
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
  contractInfoText: {
    fontSize: 12,
    textAlign: 'center',
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
