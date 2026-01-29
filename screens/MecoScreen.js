import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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
  Clipboard,
} from 'react-native';
import { useTranslation } from 'react-i18next'; // ✅ تم استيراده
import { useAppStore } from '../store';
import { Ionicons, FontAwesome, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as web3 from '@solana/web3.js';
import bs58 from 'bs58';
import * as splToken from '@solana/spl-token';
import { BN } from 'bn.js';
import * as SecureStore from 'expo-secure-store';

import { getSolBalance, getMecoBalance } from '../services/heliusService';
import { 
  PROGRAM_ID,
  MECO_MINT,
  RPC_URL,
  PRESALE_CONFIG,
  STAKING_CONFIG,
  TOKEN_DECIMALS,
  WALLET_ADDRESSES,
  EXTERNAL_LINKS,
  TRANSACTION_FEES,
  ERROR_MESSAGES,
  TOKENS
} from '../constants';

// 🔗 إنشاء اتصالات الشبكة
const connection = new web3.Connection(RPC_URL, 'confirmed');
const PROGRAM_ID_PUBKEY = new web3.PublicKey(PROGRAM_ID);
const MECO_MINT_PUBKEY = new web3.PublicKey(MECO_MINT);

// 🏦 عناوين المحافظ المحدثة
const PRESALE_WALLET = new web3.PublicKey(WALLET_ADDRESSES.PRESALE_TREASURY);
const PROGRAM_WALLET = new web3.PublicKey(WALLET_ADDRESSES.PROGRAM_WALLET);

// 🔐 ثوابت التخزين الآمن
const SECURE_STORE_KEYS = {
  WALLET_PRIVATE_KEY: 'wallet_private_key_secure',
  LAST_TRANSACTION: 'last_transaction_time',
  USER_TRANSACTIONS: 'user_transactions'
};

// 🏦 مكون معلومات المحفظة
const WalletInfoItem = React.memo(({ label, address, color, onCopy, onView, colors }) => (
  <View style={styles.walletItem}>
    <View style={styles.walletItemHeader}>
      <View style={[styles.walletDot, { backgroundColor: color }]} />
      <Text style={[styles.walletLabel, { color: color }]}>{label}</Text>
    </View>
    
    <TouchableOpacity 
      style={styles.walletAddressContainer}
      onPress={onCopy}
      activeOpacity={0.7}
    >
      <Text style={[styles.walletAddress, { color: color }]}>
        {address.substring(0, 24)}...{address.substring(address.length - 6)}
      </Text>
      <Ionicons name="copy-outline" size={16} color={color} />
    </TouchableOpacity>
    
    <TouchableOpacity 
      style={[styles.walletActionButton, { borderColor: color }]}
      onPress={onView}
    >
      <Text style={[styles.walletActionText, { color: color }]}>{t('VIEW_ON_SOLSCAN')}</Text>
      <Ionicons name="open-outline" size={14} color={color} />
    </TouchableOpacity>
  </View>
));

// ✅ مكون نتيجة المعاملة
const TransactionResultView = React.memo(({ result, colors, primaryColor, onClose, onViewSolscan }) => {
  const { t } = useTranslation(); // ✅ إضافة استخدام الترجمة
  return (
    <>
      <MaterialCommunityIcons
        name={result.success ? "check-circle" : "alert-circle"}
        size={80}
        color={result.success ? colors.success : colors.danger}
      />
      
      <Text style={[styles.resultTitle, { color: colors.text }]}>
        {result.success ? t('SUCCESS') : t('FAILURE')}
      </Text>
      
      <Text style={[styles.resultMessage, { color: colors.textSecondary }]}>
        {result.message}
      </Text>
      
      {result.success && (
        <>
          <View style={styles.successDetails}>
            <Text style={[styles.successDetail, { color: colors.success }]}>
              🎉 {t('YOU_RECEIVED')} {result.mecoReceived?.toLocaleString()} MECO
            </Text>
            <Text style={[styles.successDetail, { color: colors.textSecondary }]}>
              🪙 {t('YOU_SENT')} {result.solSent} SOL
            </Text>
          </View>
          
          <TouchableOpacity
            style={[styles.solscanButton, { backgroundColor: colors.info }]}
            onPress={onViewSolscan}
          >
            <Text style={styles.solscanButtonText}>{t('VIEW_ON_SOLSCAN')}</Text>
          </TouchableOpacity>
        </>
      )}
      
      <TouchableOpacity
        style={[styles.closeResultButton, { backgroundColor: primaryColor }]}
        onPress={onClose}
      >
        <Text style={styles.closeResultButtonText}>{t('CONTINUE')}</Text>
      </TouchableOpacity>
    </>
  );
});

// 📊 مكون صف التفاصيل
const DetailRow = React.memo(({ label, value, valueColor, colors }) => (
  <View style={styles.detailRow}>
    <Text style={[styles.detailLabel, { color: colors?.textSecondary }]}>{label}</Text>
    <Text style={[styles.detailValue, { color: valueColor }]}>{value}</Text>
  </View>
));

// 🛒 مكون تأكيد الشراء
const PurchaseConfirmationView = React.memo(({
  solAmount,
  mecoAmount,
  transactionFee,
  presaleData,
  transactionLoading,
  colors,
  primaryColor,
  programId,
  onCancel,
  onConfirm
}) => {
  const { t } = useTranslation(); // ✅ إضافة استخدام الترجمة
  return (
    <>
      <MaterialCommunityIcons name="cart-check" size={70} color={colors.warning} />
      
      <Text style={[styles.confirmTitle, { color: colors.text }]}>
        {t('PURCHASE_CONFIRMATION')}
      </Text>
      
      <View style={styles.confirmDetails}>
        <DetailRow 
          label={t('SOL_AMOUNT')}
          value={`${solAmount} SOL`}
          valueColor={colors.text}
          colors={colors}
        />
        <DetailRow 
          label={t('TRANSACTION_FEES')}
          value={`${transactionFee.toFixed(6)} SOL`}
          valueColor={colors.warning}
          colors={colors}
        />
        <DetailRow 
          label={t('PURCHASE_PRICE')}
          value={`${presaleData.rate.toLocaleString()} MECO/SOL`}
          valueColor={colors.info}
          colors={colors}
        />
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: colors.text }]}>{t('TOTAL')}</Text>
          <Text style={[styles.totalValue, { color: primaryColor, fontSize: 22 }]}>
            {mecoAmount.toLocaleString()} MECO
          </Text>
        </View>
      </View>
      
      <View style={styles.contractInfo}>
        <Text style={[styles.contractLabel, { color: colors.textSecondary }]}>
          {t('VIA_SMART_CONTRACT')}
        </Text>
        <Text style={[styles.contractAddress, { color: colors.info, fontSize: 10 }]}>
          {programId.substring(0, 16)}...
        </Text>
      </View>
      
      {transactionLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('PROCESSING_TRANSACTION')}
          </Text>
        </View>
      ) : (
        <View style={styles.confirmButtons}>
          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: colors.border }]}
            onPress={onCancel}
          >
            <Text style={[styles.cancelButtonText, { color: colors.text }]}>{t('CANCEL')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.confirmButton, { backgroundColor: primaryColor }]}
            onPress={onConfirm}
          >
            <Text style={styles.confirmButtonText}>{t('CONFIRM_PAYMENT')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
});

// 🔗 مكون زر الرابط
const LinkButton = React.memo(({ icon, iconColor, title, subtitle, onPress, iconType = 'material', colors }) => (
  <TouchableOpacity
    style={styles.linkButton}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[styles.linkIconCircle, { backgroundColor: iconColor + '20' }]}>
      {iconType === 'fontawesome' ? (
        <FontAwesome name={icon} size={22} color={iconColor} />
      ) : (
        <MaterialCommunityIcons name={icon} size={22} color={iconColor} />
      )}
    </View>
    
    <View style={styles.linkContent}>
      <Text style={[styles.linkTitle, { color: colors?.text }]}>{title}</Text>
      <Text style={[styles.linkSubtitle, { color: colors?.textSecondary }]}>{subtitle}</Text>
    </View>
    
    <Ionicons name="chevron-forward" size={24} color={colors?.textSecondary} />
  </TouchableOpacity>
));

// 🎯 المكون الرئيسي
const MecoScreen = () => {
  const { t } = useTranslation(); // ✅ تم استيراده
  const theme = useAppStore(s => s.theme);
  const primaryColor = useAppStore(state => state.primaryColor);
  const currentWallet = useAppStore(state => state.currentWallet);
  const setWalletPrivateKey = useAppStore(state => state.setWalletPrivateKey);

  const isDark = theme === 'dark';

  // 🎨 ألوان الوضع الداكن/الفاتح
  const colors = useMemo(() => ({
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
    purple: '#8B5CF6',
    pink: '#EC4899',
  }), [isDark]);

  // 🗂️ الحالات
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [solAmount, setSolAmount] = useState('0.1');
  const [mecoAmount, setMecoAmount] = useState(25000);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [userSOLBalance, setUserSOLBalance] = useState(0);
  const [userMECOBalance, setUserMECOBalance] = useState(0);
  const [transactionFee, setTransactionFee] = useState(TRANSACTION_FEES.DEFAULT);
  const [transactionResult, setTransactionResult] = useState(null);
  const [lastTransactionTime, setLastTransactionTime] = useState(0);
  const [presaleData, setPresaleData] = useState({
    totalTokens: PRESALE_CONFIG.TOTAL_TOKENS,
    soldTokens: 0,
    minSOL: PRESALE_CONFIG.MIN_SOL,
    maxSOL: PRESALE_CONFIG.MAX_SOL,
    rate: PRESALE_CONFIG.RATE,
    isActive: PRESALE_CONFIG.IS_ACTIVE,
  });

  // 🎬 الرسوم المتحركة
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(300)).current;

  // 📱 تأثيرات الدخول
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.back(1.2)),
      })
    ]).start();

    const rotationAnimation = Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 15000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotationAnimation.start();
    
    return () => rotationAnimation.stop();
  }, []);

  // 🔄 حساب كمية MECO بناءً على SOL
  useEffect(() => {
    if (presaleData.rate > 0) {
      const sol = parseFloat(solAmount) || 0;
      const calculatedMECO = sol * presaleData.rate;
      setMecoAmount(Math.floor(calculatedMECO));
    }
  }, [solAmount, presaleData.rate]);

  // 📊 جلب البيانات عند تحميل الشاشة
  useEffect(() => {
    if (currentWallet) {
      fetchInitialData();
      loadLastTransactionTime();
    }
  }, [currentWallet]);

  // 🔐 تحسين: تحميل وقت آخر معاملة
  const loadLastTransactionTime = useCallback(async () => {
    try {
      const lastTx = await SecureStore.getItemAsync(SECURE_STORE_KEYS.LAST_TRANSACTION);
      if (lastTx) {
        setLastTransactionTime(parseInt(lastTx));
      }
    } catch (error) {
      console.warn('⚠️ Error loading last transaction time:', error);
    }
  }, []);

  // 🔐 تحسين: حفظ وقت المعاملة
  const saveLastTransactionTime = useCallback(async () => {
    try {
      const now = Date.now();
      await SecureStore.setItemAsync(SECURE_STORE_KEYS.LAST_TRANSACTION, now.toString());
      setLastTransactionTime(now);
    } catch (error) {
      console.warn('⚠️ Error saving transaction time:', error);
    }
  }, []);

  // 🔐 تحسين: حفظ المعاملة في السجل
  const saveTransactionToHistory = useCallback(async (txData) => {
    try {
      const existing = await SecureStore.getItemAsync(SECURE_STORE_KEYS.USER_TRANSACTIONS);
      const transactions = existing ? JSON.parse(existing) : [];
      
      transactions.unshift({
        ...txData,
        id: Date.now().toString(),
        timestamp: new Date().toISOString()
      });
      
      // حفظ آخر 100 معاملة فقط
      const limitedTransactions = transactions.slice(0, 100);
      await SecureStore.setItemAsync(
        SECURE_STORE_KEYS.USER_TRANSACTIONS,
        JSON.stringify(limitedTransactions)
      );
    } catch (error) {
      console.warn('⚠️ Error saving transaction history:', error);
    }
  }, []);

  // 📊 تحسين: جلب البيانات الأولية
  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchUserBalance(),
        fetchPresaleData(),
        fetchTransactionFee(),
      ]);
    } catch (error) {
      console.error('❌ Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 🔐 تحسين: إنشاء wallet من المفتاح الخاص (مع التخزين الآمن)
  const createWalletFromPrivateKey = useCallback(async () => {
    try {
      let secretKey;
      
      // محاولة القراءة من SecureStore أولاً
      try {
        const secureKey = await SecureStore.getItemAsync(SECURE_STORE_KEYS.WALLET_PRIVATE_KEY);
        if (secureKey) {
          secretKey = Uint8Array.from(JSON.parse(secureKey));
        }
      } catch (secureError) {
        console.warn('⚠️ Error reading key from SecureStore:', secureError);
      }
      
      // إذا لم يوجد في SecureStore، استخدم state (للتوافق مع الكود القديم)
      if (!secretKey) {
        const walletPrivateKey = useAppStore.getState().walletPrivateKey;
        if (!walletPrivateKey) {
          console.warn('⚠️ No wallet private key found');
          return null;
        }
        
        try {
          secretKey = Uint8Array.from(JSON.parse(walletPrivateKey));
        } catch {
          secretKey = bs58.decode(walletPrivateKey);
        }
        
        // حفظ في SecureStore للمرة القادمة
        try {
          await SecureStore.setItemAsync(
            SECURE_STORE_KEYS.WALLET_PRIVATE_KEY,
            JSON.stringify(Array.from(secretKey))
          );
        } catch (saveError) {
          console.warn('⚠️ Error saving key to SecureStore:', saveError);
        }
      }
      
      if (secretKey?.length === 64) {
        return web3.Keypair.fromSecretKey(secretKey);
      }
      
      console.error('❌ Invalid private key length');
      return null;
    } catch (error) {
      console.error('❌ Failed to create wallet:', error);
      return null;
    }
  }, []);

  // 💰 جلب أرصدة المستخدم
  const fetchUserBalance = useCallback(async () => {
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
      console.error('❌ Error fetching balances:', error);
      setUserSOLBalance(0);
      setUserMECOBalance(0);
    }
  }, [currentWallet]);

  // 💸 جلب رسوم المعاملات الحالية
  const fetchTransactionFee = useCallback(async () => {
    try {
      const fee = await connection.getRecentPrioritizationFees();
      if (fee && fee.length > 0) {
        const avgFee = fee.reduce((sum, f) => sum + f.prioritizationFee, 0) / fee.length;
        const feeInSOL = Math.max(
          TRANSACTION_FEES.DEFAULT,
          Math.min(avgFee / 1e9, TRANSACTION_FEES.MAX)
        );
        setTransactionFee(feeInSOL);
      }
    } catch (error) {
      console.warn('⚠️ Using default transaction fee');
      setTransactionFee(TRANSACTION_FEES.DEFAULT);
    }
  }, []);

  // 📈 جلب بيانات البيع المسبق - محسّن لجلب البيانات الفعلية
  const fetchPresaleData = useCallback(async () => {
    try {
      // محاولة جلب البيانات الفعلية من العقد الذكي
      const [presaleConfigPDA] = await web3.PublicKey.findProgramAddress(
        [Buffer.from('config')],
        PROGRAM_ID_PUBKEY
      );
      
      let realSoldTokens = 0;
      let isActive = true;
      
      try {
        const accountInfo = await connection.getAccountInfo(presaleConfigPDA);
        if (accountInfo && accountInfo.data.length >= 8) {
          // قراءة حالة البيع المسبق من البيانات
          isActive = accountInfo.data[0] === 1;
          
          // محاولة حساب الرموز المباعة (يمكن تعديل هذا بناءً على هيكل العقد الذكي)
          try {
            const [presaleStatePDA] = await web3.PublicKey.findProgramAddress(
              [Buffer.from('presale_state')],
              PROGRAM_ID_PUBKEY
            );
            
            const stateInfo = await connection.getAccountInfo(presaleStatePDA);
            if (stateInfo && stateInfo.data.length >= 16) {
              // افتراض أن الرموز المباعة مخزنة في أول 8 بايت
              const soldTokensBuffer = stateInfo.data.slice(0, 8);
              realSoldTokens = new BN(soldTokensBuffer, 'le').toNumber();
            }
          } catch (stateError) {
            console.log('⚠️ Presale state account not found:', stateError.message);
          }
        }
      } catch (configError) {
        console.log('⚠️ Presale config not initialized yet:', configError.message);
      }
      
      // البيانات الفعلية أو الافتراضية
      const soldTokens = realSoldTokens > 0 ? realSoldTokens : Math.floor(PRESALE_CONFIG.TOTAL_TOKENS * 0.35);
      
      const presaleStats = {
        totalTokens: PRESALE_CONFIG.TOTAL_TOKENS,
        soldTokens: soldTokens,
        minSOL: PRESALE_CONFIG.MIN_SOL,
        maxSOL: PRESALE_CONFIG.MAX_SOL,
        rate: PRESALE_CONFIG.RATE,
        isActive: isActive,
      };
      
      console.log('📊 Presale data loaded:', presaleStats);
      setPresaleData(presaleStats);
      
    } catch (error) {
      console.error('❌ Error fetching presale data:', error);
      setPresaleData({
        totalTokens: PRESALE_CONFIG.TOTAL_TOKENS,
        soldTokens: Math.floor(PRESALE_CONFIG.TOTAL_TOKENS * 0.35),
        minSOL: PRESALE_CONFIG.MIN_SOL,
        maxSOL: PRESALE_CONFIG.MAX_SOL,
        rate: PRESALE_CONFIG.RATE,
        isActive: true,
      });
    }
  }, []);

  // 🔄 تحديث البيانات
  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchUserBalance(),
        fetchPresaleData(),
        fetchTransactionFee(),
      ]);
    } catch (error) {
      console.error('❌ Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchUserBalance, fetchPresaleData, fetchTransactionFee]);

  const onRefresh = useCallback(() => {
    refreshData();
  }, [refreshData]);

  // 🔗 فتح الروابط
  const openURL = useCallback(async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(t('ERROR'), t('CANNOT_OPEN_LINK'));
      }
    } catch (error) {
      console.error('❌ Error opening URL:', error);
      Alert.alert(t('ERROR'), t('ERROR_OCCURRED'));
    }
  }, []);

  // 📤 مشاركة الرمز
  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        title: 'MECO Token',
        message: t('MONYCOIN_MECO_TOKEN') + `\n\n` + t('CONTRACT') + ` ${MECO_MINT}\n` + t('PRESALE_RATE') + ` ${PRESALE_CONFIG.RATE} ` + t('MECO_PER_SOL') + `\n` + t('WEBSITE') + ` ${EXTERNAL_LINKS.WEBSITE}`,
      });
    } catch (error) {
      console.error('❌ Error sharing:', error);
    }
  }, []);

  // 📋 نسخ النص
  const copyToClipboard = useCallback((text, label = 'Address') => {
    Clipboard.setString(text);
    Alert.alert(t('COPY'), `${label} ` + t('COPIED'));
  }, []);

  // 🔄 تحسين: التحقق من وقت الانتظار بين المعاملات
  const checkTransactionCooldown = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTx = now - lastTransactionTime;
    const COOLDOWN_PERIOD = 30000; // 30 ثانية

    if (timeSinceLastTx < COOLDOWN_PERIOD) {
      const remainingTime = Math.ceil((COOLDOWN_PERIOD - timeSinceLastTx) / 1000);
      Alert.alert(
        t('PLEASE_WAIT'),
        t('PLEASE_WAIT_SECONDS', { time: remainingTime })
      );
      return false;
    }
    return true;
  }, [lastTransactionTime]);

  // 💳 معالجة ضغط شراء مع التحسينات
  const handleBuyPress = useCallback(() => {
    // التحقق من وقت الانتظار
    if (!checkTransactionCooldown()) {
      return;
    }

    const sol = parseFloat(solAmount) || 0;
    const totalWithFee = sol + transactionFee;

    // التحقق من المحفظة
    if (!currentWallet) {
      Alert.alert(t('ERROR'), t('WALLET_NOT_CONNECTED'));
      return;
    }

    // التحقق من الحد الأدنى
    if (sol < presaleData.minSOL) {
      Alert.alert(t('ERROR'), `${t('MINIMUM_AMOUNT')} ${presaleData.minSOL} SOL`);
      return;
    }

    // التحقق من الحد الأقصى
    if (sol > presaleData.maxSOL) {
      Alert.alert(t('ERROR'), `${t('MAXIMUM_AMOUNT')} ${presaleData.maxSOL} SOL`);
      return;
    }

    // التحقق من الرصيد مع هامش أمان
    const requiredBalance = totalWithFee * 1.01; // إضافة 1% هامش أمان
    if (requiredBalance > userSOLBalance) {
      Alert.alert(
        t('INSUFFICIENT_BALANCE'),
        `${t('YOU_NEED')} ${requiredBalance.toFixed(6)} SOL (${t('INCLUDING_FEES')})\n` + `${t('YOUR_CURRENT_BALANCE')}: ${userSOLBalance.toFixed(6)} SOL`
      );
      return;
    }

    // التحقق من حالة البيع المسبق
    if (!presaleData.isActive) {
      Alert.alert(t('PRESALE_INACTIVE'), t('PRESALE_CURRENTLY_INACTIVE'));
      return;
    }

    setTransactionResult(null);
    setShowConfirmModal(true);
  }, [
    solAmount,
    transactionFee,
    currentWallet,
    presaleData,
    userSOLBalance,
    checkTransactionCooldown
  ]);

  // 🛒 تأكيد عملية الشراء مع التحسينات
  const confirmPurchase = useCallback(async () => {
    setTransactionLoading(true);

    try {
      const sol = parseFloat(solAmount) || 0;
      
      // 1. التحقق من المفتاح الخاص
      const keypair = await createWalletFromPrivateKey();
      if (!keypair) {
        throw new Error('Wallet not connected');
      }

      const userPublicKey = keypair.publicKey;

      // 2. حساب المبالغ
      const solAmountLamports = Math.floor(sol * web3.LAMPORTS_PER_SOL);
      const mecoToReceive = Math.floor(sol * presaleData.rate);
      const mecoDecimals = TOKEN_DECIMALS[MECO_MINT] || 6;
      const mecoAmountLamports = mecoToReceive * Math.pow(10, mecoDecimals);

      // 3. التحقق من رصيد SOL قبل المعاملة
      const balance = await connection.getBalance(userPublicKey);
      const requiredBalance = solAmountLamports + (5000 * web3.LAMPORTS_PER_SOL); // + رسوم إضافية

      if (balance < requiredBalance) {
        throw new Error(`Insufficient balance. Required: ${(requiredBalance/web3.LAMPORTS_PER_SOL).toFixed(6)} SOL`);
      }

      // 4. حساب PDA للـ Presale Config
      const [presaleConfigPDA] = await web3.PublicKey.findProgramAddress(
        [Buffer.from('config')],
        PROGRAM_ID_PUBKEY
      );

      // 5. حساب PDA للـ Presale Vault Authority
      const [presaleVaultAuthPDA] = await web3.PublicKey.findProgramAddress(
        [Buffer.from('presale_vault_auth')],
        PROGRAM_ID_PUBKEY
      );

      // 6. حساب عناوين الحسابات المرتبطة بالرمز (ATA)
      const [userMecoATA, presaleMecoATA] = await Promise.all([
        splToken.getAssociatedTokenAddress(MECO_MINT_PUBKEY, userPublicKey),
        splToken.getAssociatedTokenAddress(MECO_MINT_PUBKEY, PRESALE_WALLET)
      ]);

      // 7. إنشاء التعليمات
      const instructions = [];

      // إنشاء حساب ATA للمستخدم إذا لم يكن موجوداً
      const [userAtaInfo] = await Promise.all([
        connection.getAccountInfo(userMecoATA)
      ]);

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

      // 8. إنشاء تعليمة العقد الذكي للشراء
      const instruction = new web3.TransactionInstruction({
        programId: PROGRAM_ID_PUBKEY,
        keys: [
          { pubkey: userPublicKey, isSigner: true, isWritable: true },
          { pubkey: presaleConfigPDA, isSigner: false, isWritable: false },
          { pubkey: PRESALE_WALLET, isSigner: false, isWritable: true },
          { pubkey: presaleMecoATA, isSigner: false, isWritable: true },
          { pubkey: userMecoATA, isSigner: false, isWritable: true },
          { pubkey: presaleVaultAuthPDA, isSigner: false, isWritable: false },
          { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.from([
          1,
          ...new BN(solAmountLamports).toArray('le', 8)
        ]),
      });

      instructions.push(instruction);

      // 9. إنشاء وإعداد المعاملة
      const transaction = new web3.Transaction().add(...instructions);
      
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userPublicKey;

      // 10. توقيع المعاملة
      transaction.sign(keypair);

      // 11. محاكاة المعاملة
      try {
        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
        }
      } catch (simError) {
        console.warn('⚠️ Simulation warning:', simError.message);
      }

      // 12. إرسال المعاملة
      const signature = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      // 13. تأكيد المعاملة
      const confirmation = await connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature,
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction confirmation failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      // 14. حفظ وقت المعاملة
      await saveLastTransactionTime();

      // 15. حفظ المعاملة في السجل
      await saveTransactionToHistory({
        type: 'PRESALE_PURCHASE',
        solAmount: sol,
        mecoAmount: mecoToReceive,
        signature,
        timestamp: new Date().toISOString(),
        success: true
      });

      // 16. تحديث الأرصدة
      await Promise.all([
        fetchUserBalance(),
        fetchPresaleData(), // تحديث بيانات البيع المسبق
      ]);

      // 17. عرض النتيجة
      const result = {
        success: true,
        signature,
        mecoReceived: mecoToReceive,
        solSent: sol,
        message: t('PURCHASE_SUCCESSFUL'),
      };

      setTransactionResult(result);

      Alert.alert(
        t('SUCCESS'),
        t('SUCCESSFULLY_PURCHASED') + ` ${mecoToReceive.toLocaleString()} MECO!\n\n` +
        t('YOU_SENT') + `: ${sol} SOL\n` +
        t('YOU_RECEIVED') + `: ${mecoToReceive.toLocaleString()} MECO`,
        [
          {
            text: t('VIEW_ON_SOLSCAN'),
            onPress: () => openURL(EXTERNAL_LINKS.SOLSCAN_TX(signature)),
            style: 'default',
          },
          {
            text: t('OK'),
            onPress: () => {
              setShowConfirmModal(false);
              setTransactionLoading(false);
              setSolAmount('0.1');
            },
            style: 'cancel',
          }
        ]
      );

    } catch (error) {
      console.error('❌ Error in purchase process:', error);
      
      // معالجة الأخطاء المفصلة
      let errorMessage = t('TRANSACTION_FAILED');
      
      if (error.message.includes('insufficient funds')) {
        errorMessage = t('INSUFFICIENT_BALANCE_TRANSACTION');
      } else if (error.message.includes('user rejected')) {
        errorMessage = t('TRANSACTION_REJECTED');
      } else if (error.message.includes('timeout')) {
        errorMessage = t('TRANSACTION_TIMEOUT');
      } else if (error.message.includes('Blockhash not found')) {
        errorMessage = t('BLOCKHASH_EXPIRED');
      }

      const result = {
        success: false,
        message: errorMessage,
        error: error.message || error.toString(),
      };

      setTransactionResult(result);
      
      Alert.alert(
        t('ERROR'),
        errorMessage,
        [{ 
          text: t('OK'), 
          onPress: () => setTransactionLoading(false) 
        }]
      );
    }
  }, [
    solAmount,
    presaleData.rate,
    createWalletFromPrivateKey,
    saveLastTransactionTime,
    saveTransactionToHistory,
    fetchUserBalance,
    fetchPresaleData,
    openURL
  ]);

  // 🔢 تنسيق الأرقام
  const formatNumber = useCallback((num) => {
    if (num === null || num === undefined) return '0';
    
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
  }, []);

  // 🎯 التحويلات الرسومية
  const rotatingLogo = useMemo(() => 
    rotationAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg']
    }), [rotationAnim]
  );

  // 📊 حسابات التقدم
  const { progress, remainingTokens, totalWithFee } = useMemo(() => {
    const progressValue = presaleData.totalTokens > 0 
      ? (presaleData.soldTokens / presaleData.totalTokens) * 100 
      : 0;
    
    const remainingTokensValue = presaleData.totalTokens - presaleData.soldTokens;
    const totalWithFeeValue = (parseFloat(solAmount) || 0) + transactionFee;
    
    return {
      progress: progressValue,
      remainingTokens: remainingTokensValue,
      totalWithFee: totalWithFeeValue
    };
  }, [presaleData, solAmount, transactionFee]);

  // 🎨 تنسيق المبالغ السريعة
  const quickAmounts = useMemo(() => [0.05, 0.1, 0.5, 1], []);

  // 📱 عرض حالة التحميل
  if (loading && !currentWallet) {
    return (
      <View style={[styles.loadingContainerFull, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={[styles.loadingTextFull, { color: colors.text }]}>
          {t('LOADING_DATA')}
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
          progressBackgroundColor={colors.card}
        />
      }
    >
      {/* 🏁 الهيدر */}
      <Animated.View style={[styles.header, { 
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }]}>
        <View style={styles.logoContainer}>
          <Animated.View style={{ 
            transform: [{ rotate: rotatingLogo }],
            shadowColor: primaryColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 10,
          }}>
            <MaterialCommunityIcons name="rocket-launch" size={52} color={primaryColor} />
          </Animated.View>
          <View style={styles.titleContainer}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.text }]}>{t('TITLE')}</Text>
              <View style={[styles.liveBadge, { backgroundColor: colors.success }]}>
                <View style={[styles.liveDot, { backgroundColor: '#FFFFFF' }]} />
                <Text style={styles.liveText}>{t('LIVE')}</Text>
              </View>
            </View>
            <Text style={[styles.symbol, { color: primaryColor }]}>{t('SYMBOL')}</Text>
            
            <View style={styles.badgesRow}>
              <View style={[styles.contractBadge, { backgroundColor: colors.success + '20' }]}>
                <MaterialCommunityIcons name="link-variant" size={12} color={colors.success} />
                <Text style={[styles.contractText, { color: colors.success }]}>
                  {t('SMART_CONTRACT')}
                </Text>
              </View>
              
              <TouchableOpacity 
                style={[styles.networkBadge, { backgroundColor: colors.solana + '20' }]}
                onPress={() => openURL(EXTERNAL_LINKS.SOLSCAN_PROGRAM)}
              >
                <MaterialCommunityIcons name="link-variant" size={12} color={colors.solana} />
                <Text style={[styles.networkText, { color: colors.solana }]}>
                  {t('DEVNET')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.headerButtons}>
          {/* تم حذف أيقونة المحفظة لأنها لا تحتوي على رابط */}
          
          <TouchableOpacity
            onPress={handleShare}
            style={[styles.iconButton, { backgroundColor: colors.card }]}
            activeOpacity={0.7}
          >
            <Ionicons name="share-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* 📋 معلومات العقد الذكي */}
      <Animated.View style={[styles.contractInfoCard, { 
        backgroundColor: colors.card, 
        borderColor: colors.border,
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }]}>
        <View style={styles.contractInfoHeader}>
          <MaterialCommunityIcons name="cube-send" size={24} color={primaryColor} />
          <Text style={[styles.contractInfoTitle, { color: colors.text }]}>
            {t('SMART_CONTRACT_INFO')}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.contractAddressRow}
          onPress={() => copyToClipboard(PROGRAM_ID, 'Contract address')}
          activeOpacity={0.7}
        >
          <Text style={[styles.contractAddress, { color: colors.textSecondary }]}>
            {PROGRAM_ID.substring(0, 20)}...{PROGRAM_ID.substring(PROGRAM_ID.length - 6)}
          </Text>
          <Ionicons name="copy-outline" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
        
        <View style={styles.contractStatusRow}>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { 
              backgroundColor: presaleData.isActive ? colors.success : colors.danger 
            }]} />
            <Text style={[styles.contractStatus, { 
              color: presaleData.isActive ? colors.success : colors.danger 
            }]}>
              {presaleData.isActive ? t('ACTIVE') : t('INACTIVE')}
            </Text>
          </View>
          
          <Text style={[styles.contractRate, { color: colors.info }]}>
            {t('PRICE_PER_SOL', { rate: presaleData.rate.toLocaleString() })}
          </Text>
        </View>
        
        <View style={styles.verifyButtons}>
          <TouchableOpacity 
            style={[styles.verifyButton, { borderColor: colors.info }]}
            onPress={() => openURL(EXTERNAL_LINKS.SOLSCAN_PROGRAM)}
          >
            <Text style={[styles.verifyButtonText, { color: colors.info }]}>{t('VERIFY_ON_SOLSCAN')}</Text>
            <Ionicons name="open-outline" size={14} color={colors.info} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.verifyButton, { borderColor: colors.warning }]}
            onPress={() => openURL(EXTERNAL_LINKS.RUGCHECK)}
          >
            <Text style={[styles.verifyButtonText, { color: colors.warning }]}>{t('SECURITY_CHECK')}</Text>
            <MaterialCommunityIcons name="shield-check" size={14} color={colors.warning} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* 💼 رصيد المستخدم */}
      {currentWallet && (
        <Animated.View style={[styles.balanceCard, { 
          backgroundColor: colors.card, 
          borderColor: colors.border,
          opacity: fadeAnim,
        }]}>
          <View style={styles.balanceHeader}>
            <MaterialCommunityIcons 
              name="wallet" 
              size={24} 
              color={userSOLBalance > 0 ? colors.success : colors.danger} 
            />
            <Text style={[styles.balanceTitle, { color: colors.text }]}>{t('YOUR_BALANCE')}</Text>
          </View>
          
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <View style={styles.balanceIconContainer}>
                <MaterialCommunityIcons name="diamond" size={20} color={colors.solana} />
              </View>
              <View style={styles.balanceTextContainer}>
                <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>SOL</Text>
                <Text style={[styles.balanceAmount, { color: userSOLBalance > 0 ? colors.success : colors.danger }]}>
                  {userSOLBalance.toFixed(6)} SOL
                </Text>
              </View>
            </View>
            
            <View style={styles.balanceSeparator} />
            
            <View style={styles.balanceItem}>
              <View style={styles.balanceIconContainer}>
                <MaterialCommunityIcons name="rocket" size={20} color={primaryColor} />
              </View>
              <View style={styles.balanceTextContainer}>
                <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>MECO</Text>
                <Text style={[styles.balanceAmount, { color: primaryColor }]}>
                  {userMECOBalance.toFixed(4)} MECO
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.balanceFooter}>
            <Text style={[styles.balanceSubtext, { color: colors.textSecondary }]}>
              {userSOLBalance >= totalWithFee 
                ? `${t('SUFFICIENT_FOR_PURCHASE')} ${totalWithFee.toFixed(6)} SOL)`
                : `${t('INSUFFICIENT_FOR_PURCHASE')} ${totalWithFee.toFixed(6)} SOL)`}
            </Text>
            
            <TouchableOpacity
              onPress={refreshData}
              style={[styles.refreshButton, { backgroundColor: colors.background }]}
              disabled={refreshing}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={colors.info} />
              ) : (
                <>
                  <Ionicons name="refresh" size={16} color={colors.textSecondary} />
                  <Text style={[styles.refreshText, { color: colors.textSecondary }]}>{t('REFRESH')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* 🏪 بطاقة البيع المسبق */}
      <Animated.View style={[styles.presaleCard, {
        backgroundColor: colors.card,
        borderColor: colors.border,
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }]}>
        {/* العنوان */}
        <View style={styles.presaleHeader}>
          <View>
            <Text style={[styles.presaleLabel, { color: colors.text }]}>
              {t('PURCHASE_MECO')}
            </Text>
            <View style={styles.sourceBadge}>
              <MaterialCommunityIcons name="sale" size={12} color={colors.success} />
              <Text style={[styles.sourceText, { color: colors.success }]}>
                {t('EXCLUSIVE_PRESALE')}
              </Text>
            </View>
          </View>

          <View style={[styles.priceBadge, { backgroundColor: colors.warning + '20' }]}>
            <MaterialCommunityIcons name="tag" size={16} color={colors.warning} />
            <Text style={[styles.priceBadgeText, { color: colors.warning }]}>
              {formatNumber(presaleData.rate)} MECO/SOL
            </Text>
          </View>
        </View>

        {/* شريط التقدم */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressText, { color: colors.text }]}>
              {t('PRESALE_PROGRESS')}
            </Text>
            <Text style={[styles.progressText, { color: colors.text }]}>
              {progress.toFixed(1)}%
            </Text>
          </View>
          
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <Animated.View
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
            <View style={styles.progressStat}>
              <Text style={[styles.progressStatLabel, { color: colors.textSecondary }]}>{t('SOLD')}</Text>
              <Text style={[styles.progressStatValue, { color: colors.text }]}>
                {formatNumber(presaleData.soldTokens)} MECO
              </Text>
            </View>
            
            <View style={styles.progressStat}>
              <Text style={[styles.progressStatLabel, { color: colors.textSecondary }]}>{t('REMAINING')}</Text>
              <Text style={[styles.progressStatValue, { color: colors.success }]}>
                {formatNumber(remainingTokens)} MECO
              </Text>
            </View>
          </View>
          
          <Text style={[styles.progressNote, { color: colors.textSecondary }]}>
            {t('TOTAL')}: {formatNumber(presaleData.totalTokens)} MECO
          </Text>
        </View>

        {/* إدخال المبلغ */}
        <View style={styles.amountSection}>
          <Text style={[styles.amountLabel, { color: colors.text }]}>
            {t('ENTER_SOL_AMOUNT')}
          </Text>
          
          <View style={[styles.inputContainer, { borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={solAmount}
              onChangeText={(text) => {
                const cleanText = text.replace(/[^0-9.]/g, '');
                const parts = cleanText.split('.');
                if (parts.length <= 2) {
                  setSolAmount(cleanText);
                }
              }}
              keyboardType="decimal-pad"
              placeholder="0.1"
              placeholderTextColor={colors.textSecondary}
              selectionColor={primaryColor}
            />
            <View style={styles.solBadge}>
              <MaterialCommunityIcons name="diamond" size={16} color={colors.solana} />
              <Text style={[styles.solText, { color: colors.solana }]}>{t('SOL')}</Text>
            </View>
          </View>
          
          <View style={styles.quickAmounts}>
            {quickAmounts.map((amount) => (
              <TouchableOpacity
                key={amount}
                style={[
                  styles.quickAmountButton,
                  { 
                    backgroundColor: parseFloat(solAmount) === amount ? primaryColor + '20' : colors.background,
                    borderColor: parseFloat(solAmount) === amount ? primaryColor : colors.border
                  }
                ]}
                onPress={() => setSolAmount(amount.toString())}
              >
                <Text style={[
                  styles.quickAmountText,
                  { color: parseFloat(solAmount) === amount ? primaryColor : colors.text }
                ]}>
                  {amount} SOL
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.limitContainer}>
            <TouchableOpacity onPress={() => setSolAmount(presaleData.minSOL.toString())}>
              <Text style={[styles.limitText, { color: colors.textSecondary }]}>
                {t('MINIMUM')}: {presaleData.minSOL} SOL
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSolAmount(presaleData.maxSOL.toString())}>
              <Text style={[styles.limitText, { color: colors.textSecondary }]}>
                {t('MAXIMUM')}: {presaleData.maxSOL} SOL
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* الحسابات */}
        <View style={[styles.calculationSection, { backgroundColor: colors.info + '10' }]}>
          <View style={styles.calculationRow}>
            <View style={styles.calculationLabelContainer}>
              <MaterialCommunityIcons name="arrow-up" size={16} color={colors.danger} />
              <Text style={[styles.calculationLabel, { color: colors.text, marginLeft: 6 }]}>
                {t('YOU_WILL_SEND')}
              </Text>
            </View>
            <Text style={[styles.calculationValue, { color: colors.text }]}>
              {solAmount} SOL
            </Text>
          </View>
          
          <View style={styles.calculationRow}>
            <View style={styles.calculationLabelContainer}>
              <MaterialCommunityIcons name="cash" size={16} color={colors.warning} />
              <Text style={[styles.calculationLabel, { color: colors.text, marginLeft: 6 }]}>
                {t('TRANSACTION_FEE')}
              </Text>
            </View>
            <Text style={[styles.calculationValue, { color: colors.warning }]}>
              {transactionFee.toFixed(6)} SOL
            </Text>
          </View>
          
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          
          <View style={styles.calculationRow}>
            <View style={styles.calculationLabelContainer}>
              <MaterialCommunityIcons name="arrow-down" size={20} color={colors.success} />
              <Text style={[styles.calculationLabel, { color: colors.text, marginLeft: 6, fontSize: 16 }]}>
                {t('YOU_WILL_RECEIVE')}
              </Text>
            </View>
            <View style={styles.receiveContainer}>
              <Text style={[styles.receiveAmount, { color: primaryColor }]}>
                {mecoAmount.toLocaleString()}
              </Text>
              <Text style={[styles.receiveCurrency, { color: primaryColor }]}>
                MECO
              </Text>
            </View>
          </View>
          
          <View style={styles.rateInfo}>
            <Text style={[styles.rateText, { color: colors.textSecondary }]}>
              {t('PRICE_PER_SOL', { rate: formatNumber(presaleData.rate) })}
            </Text>
          </View>
        </View>

        {/* زر الشراء */}
        <TouchableOpacity
          style={[
            styles.buyButton,
            {
              backgroundColor: presaleData.isActive ? primaryColor : colors.textSecondary,
              opacity: (transactionLoading || !presaleData.isActive) ? 0.7 : 1,
              transform: [{ scale: transactionLoading ? 0.98 : 1 }]
            }
          ]}
          onPress={handleBuyPress}
          disabled={transactionLoading || !presaleData.isActive}
          activeOpacity={0.8}
        >
          {transactionLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <MaterialCommunityIcons name="shopping" size={24} color="#FFFFFF" />
              <Text style={styles.buyButtonText}>
                {!presaleData.isActive ? t('PRESALE_PAUSED') : t('BUY_NOW')}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* معلومات الأمان */}
        <View style={styles.securityInfo}>
          <MaterialCommunityIcons name="shield-check" size={16} color={colors.success} />
          <Text style={[styles.securityText, { color: colors.textSecondary }]}>
            {t('SECURE_TRANSACTION')}
          </Text>
        </View>
      </Animated.View>

      {/* 📊 إحصائيات الرمز */}
      <View style={styles.statsSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('TOKEN_STATISTICS')}
        </Text>
        
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: colors.info + '20' }]}>
              <MaterialCommunityIcons name="chart-line" size={24} color={colors.info} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {formatNumber(TOKENS.MECO.supply)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Total Supply
            </Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: colors.success + '20' }]}>
              <MaterialCommunityIcons name="account-multiple" size={24} color={colors.success} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {formatNumber(presaleData.soldTokens)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Tokens Sold
            </Text>
          </View>
        </View>
      </View>

      {/* 🔗 الروابط الرسمية */}
      <View style={styles.linksSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('OFFICIAL_LINKS')}
        </Text>
        
        <View style={[styles.linksCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <LinkButton
            icon="link-variant"
            iconColor={colors.solana}
            title={t('VIEW_ON_SOLSCAN')}
            subtitle={t('TOKEN_ANALYSIS')}
            onPress={() => openURL(EXTERNAL_LINKS.SOLSCAN_TOKEN)}
            colors={colors}
          />
          
          <LinkButton
            icon="telegram"
            iconColor="#0088cc"
            title={t('TELEGRAM_CHANNEL')}
            subtitle={t('OFFICIAL_COMMUNITY')}
            onPress={() => openURL(EXTERNAL_LINKS.TELEGRAM)}
            iconType="fontawesome"
            colors={colors}
          />
          
          <LinkButton
            icon="twitter"
            iconColor="#1DA1F2"
            title={t('TWITTER_ACCOUNT')}
            subtitle={t('FOLLOW_FOR_NEWS')}
            onPress={() => openURL(EXTERNAL_LINKS.TWITTER)}
            iconType="fontawesome"
            colors={colors}
          />
          
          <LinkButton
            icon="globe"
            iconColor={primaryColor}
            title={t('OFFICIAL_WEBSITE')}
            subtitle={t('LEARN_ABOUT_MECO')}
            onPress={() => openURL(EXTERNAL_LINKS.WEBSITE)}
            iconType="fontawesome"
            colors={colors}
          />
          
          <LinkButton
            icon="github"
            iconColor="#333333"
            title={t('SOURCE_CODE')}
            subtitle={t('SOURCE_CODE')}
            onPress={() => openURL(EXTERNAL_LINKS.GITHUB)}
            iconType="fontawesome"
            colors={colors}
          />
        </View>
      </View>

      {/* 🦶 الفوتر */}
      <Animated.View style={[styles.footer, {
        opacity: fadeAnim,
        backgroundColor: colors.card,
        borderColor: colors.border,
      }]}>
        <MaterialCommunityIcons name="shield-check" size={40} color={colors.success} />
        <Text style={[styles.footerText, { color: colors.text }]}>
          {t('MECO_OFFICIAL_TOKEN')}
        </Text>
        <Text style={[styles.footerSubText, { color: colors.textSecondary }]}>
          {t('SECURE_SMART_CONTRACT')}
        </Text>
      </Animated.View>

      {/* ⚡ نافذة تأكيد الشراء */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showConfirmModal}
        onRequestClose={() => !transactionLoading && setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.purchaseModal, { 
            backgroundColor: colors.card,
            opacity: fadeAnim,
            transform: [{ scale: fadeAnim }]
          }]}>
            {transactionResult ? (
              <TransactionResultView
                result={transactionResult}
                colors={colors}
                primaryColor={primaryColor}
                onClose={() => {
                  setShowConfirmModal(false);
                  setTransactionLoading(false);
                  setSolAmount('0.1');
                }}
                onViewSolscan={() => openURL(EXTERNAL_LINKS.SOLSCAN_TX(transactionResult.signature))}
              />
            ) : (
              <PurchaseConfirmationView
                solAmount={solAmount}
                mecoAmount={mecoAmount}
                transactionFee={transactionFee}
                presaleData={presaleData}
                transactionLoading={transactionLoading}
                colors={colors}
                primaryColor={primaryColor}
                programId={PROGRAM_ID}
                onCancel={() => setShowConfirmModal(false)}
                onConfirm={confirmPurchase}
              />
            )}
          </Animated.View>
        </View>
      </Modal>
    </ScrollView>
  );
};

// 🎨 الأنماط المحسنة مع تحسينات التنسيق
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    paddingTop: 60,
    minHeight: Dimensions.get('window').height,
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
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleContainer: {
    flexDirection: 'column',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  symbol: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  contractBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
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
  },
  networkText: {
    fontSize: 10,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
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
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  contractInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  contractInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  contractAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    marginBottom: 12,
  },
  contractAddress: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  contractStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  contractStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  contractRate: {
    fontSize: 14,
    fontWeight: '600',
  },
  verifyButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
  verifyButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 20,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  walletsList: {
    maxHeight: 400,
  },
  walletItem: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  walletItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  walletDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  walletLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  walletAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 8,
  },
  walletAddress: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  walletActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  walletActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  balanceCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  balanceTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  balanceIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  balanceTextContainer: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  balanceSeparator: {
    width: 1,
    height: 40,
    backgroundColor: '#E8EDF5',
    marginHorizontal: 16,
  },
  balanceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  balanceSubtext: {
    fontSize: 12,
    flex: 1,
    marginRight: 12,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '600',
  },
  presaleCard: {
    width: '100%',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  presaleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  presaleLabel: {
    fontSize: 20,
    fontWeight: '700',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  sourceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    marginBottom: 12,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    marginBottom: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressStat: {
    alignItems: 'center',
    flex: 1,
  },
  progressStatLabel: {
    fontSize: 11,
    marginBottom: 4,
    textAlign: 'center',
  },
  progressStatValue: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  progressNote: {
    fontSize: 12,
    textAlign: 'center',
  },
  amountSection: {
    marginBottom: 20,
  },
  amountLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  input: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    padding: 0,
    minHeight: 40,
  },
  solBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#14F19520',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  solText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  quickAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAmountButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: '22%',
    alignItems: 'center',
  },
  quickAmountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  limitContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  limitText: {
    fontSize: 12,
    fontWeight: '500',
  },
  calculationSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.1)',
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calculationLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginVertical: 12,
    backgroundColor: '#E8EDF5',
  },
  receiveContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  receiveAmount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  receiveCurrency: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  rateInfo: {
    marginTop: 8,
  },
  rateText: {
    fontSize: 12,
    textAlign: 'center',
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 16,
    paddingVertical: 18,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  buyButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  securityText: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    flex: 1,
  },
  statsSection: {
    marginBottom: 20,
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
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  linksSection: {
    marginBottom: 20,
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
  },
  linkIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
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
    marginBottom: 20,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  footerText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  footerSubText: {
    fontSize: 14,
    textAlign: 'center',
  },
  purchaseModal: {
    width: Dimensions.get('window').width * 0.85,
    maxWidth: 400,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
  },
  resultMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  successDetails: {
    width: '100%',
    marginBottom: 20,
  },
  successDetail: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  solscanButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  solscanButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  closeResultButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  closeResultButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 20,
  },
  confirmDetails: {
    width: '100%',
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  totalValue: {
    fontWeight: 'bold',
  },
  contractInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  contractLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  contractAddress: {
    fontFamily: 'monospace',
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 16,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default MecoScreen;
