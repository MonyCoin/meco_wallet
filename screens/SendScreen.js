import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, Modal, FlatList,
  Dimensions, Animated, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import { useRoute } from '@react-navigation/native';
// تأكد من أن هذه المسارات صحيحة في مشروعك
import { 
  getSolBalance, 
  getTokenBalance, 
  validateSolanaAddress, 
  getCurrentNetworkFee,
  getLatestBlockhash,
  clearBalanceCache
} from '../services/heliusService';
import { logTransaction } from '../services/transactionLogger';
import { Ionicons } from '@expo/vector-icons';
import * as web3 from '@solana/web3.js';
import bs58 from 'bs58';
import * as splToken from '@solana/spl-token';
import * as Clipboard from 'expo-clipboard';

const { width } = Dimensions.get('window');

// =============================================
// ⚙️ إعدادات التطبيق
// =============================================
const FEE_COLLECTOR_ADDRESS = 'HXkEZSKictbSYan9ZxQGaHpFrbA4eLDyNtEDxVBkdFy6';
const SERVICE_FEE_PERCENTAGE = 0.1; // 10%
const MAX_NETWORK_FEE = 0.00001;
const MIN_SOL_AMOUNT = 0.000001; // تم تقليل الحد الأدنى للسماح بالمعاملات الصغيرة
const MIN_TOKEN_AMOUNT = 0.000001;
const ATA_RENT_COST = 0.00203928; // تكلفة إنشاء حساب توكن جديد (Rent)

// التوكنات الأساسية
const BASE_TOKENS = [
  {
    symbol: 'SOL',
    name: 'Solana',
    mint: null,
    icon: 'diamond-outline',
    decimals: 9,
    priority: 1
  },
  {
    symbol: 'MECO',
    name: 'MECO Token',
    mint: '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i',
    icon: 'rocket-outline',
    decimals: 6,
    priority: 2
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    mint: 'Es9vMFrzaCERc8Foa8XfRduKiSfrhEL5c7qr2WXXBWY5',
    icon: 'cash-outline',
    decimals: 6,
    priority: 3
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    icon: 'wallet-outline',
    decimals: 6,
    priority: 4
  },
];

// =============================================
// 🛠️ دوال المساعدة
// =============================================

async function getKeypair(t) {
  try {
    const secretKeyStr = await SecureStore.getItemAsync('wallet_private_key');
    if (!secretKeyStr) {
      throw new Error(t('sendScreen.errors.privateKeyNotFound') || 'Private Key not found');
    }

    let secretKey;
    if (secretKeyStr.startsWith('[')) {
      secretKey = new Uint8Array(JSON.parse(secretKeyStr));
    } else {
      secretKey = bs58.decode(secretKeyStr);
    }

    if (secretKey.length !== 64) {
      throw new Error(t('sendScreen.errors.invalidKeyLength') || 'Invalid key length');
    }

    return web3.Keypair.fromSecretKey(secretKey);
  } catch (error) {
    console.error('❌ Keypair Error:', error);
    throw error;
  }
}

// =============================================
// 🎯 المكون الرئيسي
// =============================================
export default function SendScreen() {
  const { t } = useTranslation();
  const route = useRoute();
  const theme = useAppStore(state => state.theme);
  const primaryColor = useAppStore(state => state.primaryColor);
  const isDark = theme === 'dark';
  const isMounted = useRef(true); // ✅ لحل مشكلة تحديث الحالة بعد الخروج
  
  const colors = {
    background: isDark ? '#0A0A0F' : '#FFFFFF',
    card: isDark ? '#1A1A2E' : '#F8FAFD',
    text: isDark ? '#FFFFFF' : '#1A1A2E',
    textSecondary: isDark ? '#A0A0B0' : '#6B7280',
    border: isDark ? '#2A2A3E' : '#E5E7EB',
    inputBackground: isDark ? '#2A2A3E' : '#FFFFFF',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    info: primaryColor,
  };

  const [state, setState] = useState({
    recipient: '',
    amount: '',
    currency: route?.params?.preselectedToken || 'SOL',
    modalVisible: false,
    loading: false,
    loadingTokens: false,
    networkFee: 0.000005,
    recipientExists: null,
    recipientHasTokenAccount: true, // افتراضياً نعم لتجنب حساب الرسوم الزائدة إلا بعد التحقق
    lastBalanceUpdate: Date.now(),
    transactionInProgress: false
  });

  const [balances, setBalances] = useState({
    sol: 0,
    tokens: {},
    lastUpdated: 0
  });

  const [fadeAnim] = useState(new Animated.Value(0));
  const validationTimeoutRef = useRef(null);

  // حساب التوكن الحالي
  const currentToken = useMemo(() => {
    return BASE_TOKENS.find(t => t.symbol === state.currency) || BASE_TOKENS[0];
  }, [state.currency]);

  // حساب رسوم الخدمة
  const serviceFee = useMemo(() => {
    // ⚠️ تصحيح المنطق: إذا كانت النسبة من رسوم الشبكة، فالناتج ضئيل جداً
    // سيتم تجاهله في التنفيذ إذا كان أقل من الحد المسموح (Dust)
    return state.networkFee * SERVICE_FEE_PERCENTAGE; 
  }, [state.networkFee]);

  // الرصيد الحالي للعملة المختارة
  const currentBalance = useMemo(() => {
    if (state.currency === 'SOL') {
      return balances.sol || 0;
    }
    return balances.tokens[state.currency] || 0;
  }, [state.currency, balances]);

  const minimumAmount = useMemo(() => {
    return state.currency === 'SOL' ? MIN_SOL_AMOUNT : MIN_TOKEN_AMOUNT;
  }, [state.currency]);

  // تقدير الرسوم الكلية المطلوبة من SOL
  const estimatedTotalSolFees = useMemo(() => {
    let fees = state.networkFee + serviceFee;
    
    // إذا كان توكن (ليس SOL) والمستلم لا يملك حساباً لهذا التوكن، نضيف تكلفة الـ Rent
    if (state.currency !== 'SOL' && state.recipientHasTokenAccount === false) {
      fees += ATA_RENT_COST;
    }
    return fees;
  }, [state.networkFee, serviceFee, state.currency, state.recipientHasTokenAccount]);

  // تحديث رسوم الشبكة
  const updateNetworkFee = useCallback(async () => {
    try {
      if (!isMounted.current) return;
      const fee = await getCurrentNetworkFee();
      setState(prev => ({ ...prev, networkFee: Math.min(fee, MAX_NETWORK_FEE) }));
    } catch (error) {
      console.log('Network fee fallback');
    }
  }, []);

  // تحميل الأرصدة
  const loadBalances = useCallback(async (forceRefresh = false) => {
    try {
      if (!isMounted.current) return;
      setState(prev => ({ ...prev, loadingTokens: true }));
      
      const solBalance = await getSolBalance(forceRefresh);
      
      const tokenPromises = BASE_TOKENS.filter(t => t.mint)
        .map(async (token) => {
          const balance = await getTokenBalance(token.mint, forceRefresh);
          return { symbol: token.symbol, balance };
        });
      
      const tokenResults = await Promise.allSettled(tokenPromises);
      const tokenBalances = {};
      
      tokenResults.forEach(result => {
        if (result.status === 'fulfilled') {
          tokenBalances[result.value.symbol] = result.value.balance;
        }
      });
      
      if (isMounted.current) {
        setBalances({
          sol: solBalance,
          tokens: tokenBalances,
          lastUpdated: Date.now()
        });
        setState(prev => ({ ...prev, loadingTokens: false }));
      }
      
    } catch (error) {
      console.error('Balance Load Error:', error);
      if (isMounted.current) setState(prev => ({ ...prev, loadingTokens: false }));
    }
  }, []);

  // ✅ التحقق من العنوان وحالة حساب التوكن للمستلم
  const validateRecipient = useCallback(async (address, tokenMint) => {
    if (!address || address.length < 32) {
      setState(prev => ({ ...prev, recipientExists: null, recipientHasTokenAccount: true }));
      return;
    }
    
    try {
      // 1. التحقق من صحة العنوان
      const validation = await validateSolanaAddress(address);
      let hasTokenAcc = true;

      // 2. إذا كان العنوان صحيحاً ونرسل توكن (وليس SOL)، نتحقق هل يحتاج لإنشاء ATA
      if (validation.isValid && tokenMint) {
        try {
          const connection = new web3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
          const mintKey = new web3.PublicKey(tokenMint);
          const ownerKey = new web3.PublicKey(address);
          const ata = await splToken.getAssociatedTokenAddress(mintKey, ownerKey);
          const info = await connection.getAccountInfo(ata);
          hasTokenAcc = (info !== null);
        } catch (e) {
          console.log('Error checking ATA:', e);
          // نفترض أنه موجود لتجنب الرسوم الزائدة بالخطأ، أو يمكن افتراض العكس حسب السياسة
          hasTokenAcc = false; 
        }
      }

      if (isMounted.current) {
        setState(prev => ({ 
          ...prev, 
          recipientExists: validation.isValid,
          recipientHasTokenAccount: hasTokenAcc
        }));
      }
    } catch (error) {
      if (isMounted.current) setState(prev => ({ ...prev, recipientExists: null }));
    }
  }, []);

  // دالة الإرسال الرئيسية
  const handleSend = useCallback(async () => {
    const amountNum = parseFloat(state.amount) || 0;
    const recipient = state.recipient.trim();

    // 1. التحقق من المدخلات الأساسية
    if (!recipient) {
      Alert.alert(t('sendScreen.alerts.error'), t('sendScreen.warnings.enterRecipient') || 'Please enter recipient address');
      return;
    }
    if (amountNum <= 0) {
      Alert.alert(t('sendScreen.alerts.error'), t('sendScreen.warnings.enterAmount') || 'Please enter a valid amount');
      return;
    }

    // 2. التحقق من صحة العنوان
    if (state.recipientExists === false) {
      Alert.alert(t('sendScreen.alerts.error'), t('sendScreen.alerts.invalidAddress') || 'Invalid Solana address');
      return;
    }

    // 3. التحقق من الحد الأدنى
    if (amountNum < minimumAmount) {
      Alert.alert(t('sendScreen.alerts.error'), `${t('sendScreen.inputs.minimum')} ${minimumAmount} ${state.currency}`);
      return;
    }

    // 4. التحقق من رصيد العملة المرسلة
    if (amountNum > currentBalance) {
      Alert.alert(t('sendScreen.alerts.error'), t('sendScreen.alerts.insufficientBalance') || 'Insufficient balance');
      return;
    }

    // 5. ✅ التحقق الحرج: هل يوجد رصيد SOL كافٍ لدفع الرسوم (Network + Service + Rent)
    // إذا كنا نرسل SOL، يجب أن يكون الرصيد > المبلغ + الرسوم
    // إذا كنا نرسل توكن، يجب أن يكون رصيد SOL > الرسوم فقط
    const requiredSol = state.currency === 'SOL' 
      ? amountNum + estimatedTotalSolFees 
      : estimatedTotalSolFees;

    if (balances.sol < requiredSol) {
      let errorMsg = t('sendScreen.alerts.insufficientSolForFees') || 'Insufficient SOL for fees';
      
      // توضيح إضافي إذا كان السبب هو تكلفة إنشاء الحساب
      if (state.currency !== 'SOL' && !state.recipientHasTokenAccount) {
        errorMsg += `\n(+ ~0.002 SOL for new Token Account)`;
      }

      Alert.alert(
        t('sendScreen.alerts.error'),
        `${errorMsg}\nRequired: ${requiredSol.toFixed(6)} SOL\nAvailable: ${balances.sol.toFixed(6)} SOL`
      );
      return;
    }

    // 6. التحقق من الإرسال للنفس
    try {
      const myAddress = await SecureStore.getItemAsync('wallet_public_key');
      if (recipient === myAddress) {
        Alert.alert(t('sendScreen.alerts.error'), t('sendScreen.alerts.selfTransfer') || 'Cannot send to yourself');
        return;
      }
    } catch (e) {}

    // ✅ البدء في التنفيذ
    setState(prev => ({ ...prev, loading: true, transactionInProgress: true }));
    
    try {
      await executeTransaction(amountNum, recipient, currentToken);
    } catch (error) {
      console.error('Send Error:', error);
      Alert.alert(t('sendScreen.alerts.error'), error.message || 'Transaction failed');
    } finally {
      if (isMounted.current) {
        setState(prev => ({ ...prev, loading: false, transactionInProgress: false }));
      }
    }
  }, [state, currentBalance, balances.sol, estimatedTotalSolFees, minimumAmount, currentToken, t]);

  const executeTransaction = useCallback(async (amount, recipient, token) => {
    try {
      const keypair = await getKeypair(t);
      const fromPubkey = keypair.publicKey;
      const toPubkey = new web3.PublicKey(recipient);
      const feeCollectorPubkey = new web3.PublicKey(FEE_COLLECTOR_ADDRESS);
      
      const connection = new web3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      const { blockhash, lastValidBlockHeight } = await getLatestBlockhash();
      
      const transaction = new web3.Transaction();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      // حساب رسوم الخدمة (Lamports)
      const serviceLamports = Math.floor(serviceFee * web3.LAMPORTS_PER_SOL);
      
      // ✅ إصلاح منطق إرسال رسوم الخدمة: تجاهل إذا كان المبلغ "غبار" (Dust)
      // أقل من 0.000001 قد يسبب فشل المعاملة
      const shouldCollectFee = serviceLamports > 1000; 

      if (token.symbol === 'SOL') {
        // === إرسال SOL ===
        const lamportsToSend = Math.floor(amount * web3.LAMPORTS_PER_SOL);
        
        transaction.add(
          web3.SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports: lamportsToSend,
          })
        );
        
        if (shouldCollectFee) {
          transaction.add(
            web3.SystemProgram.transfer({
              fromPubkey,
              toPubkey: feeCollectorPubkey,
              lamports: serviceLamports,
            })
          );
        }
        
      } else if (token.mint) {
        // === إرسال توكن ===
        const mint = new web3.PublicKey(token.mint);
        const fromATA = await splToken.getAssociatedTokenAddress(mint, fromPubkey);
        const toATA = await splToken.getAssociatedTokenAddress(mint, toPubkey);
        
        // التحقق من أن حساب التوكن للمرسل موجود
        const fromAccountInfo = await connection.getAccountInfo(fromATA);
        if (!fromAccountInfo) {
          throw new Error('Your token account does not exist or has no balance.');
        }

        // ✅ إنشاء حساب للمستلم إذا لم يكن موجوداً (يدفعه المرسل)
        const toAccountInfo = await connection.getAccountInfo(toATA);
        if (!toAccountInfo) {
          transaction.add(
            splToken.createAssociatedTokenAccountInstruction(
              fromPubkey, // Payer (Sender)
              toATA,
              toPubkey,
              mint
            )
          );
        }
        
        // حساب المبلغ بدقة للتوكن
        // ✅ استخدام BigInt لتفادي أخطاء التقريب
        const amountBigInt = BigInt(Math.round(amount * Math.pow(10, token.decimals)));
        
        transaction.add(
          splToken.createTransferInstruction(
            fromATA,
            toATA,
            fromPubkey,
            amountBigInt
          )
        );
        
        // رسوم الخدمة (تدفع دائماً بـ SOL)
        if (shouldCollectFee) {
          transaction.add(
            web3.SystemProgram.transfer({
              fromPubkey,
              toPubkey: feeCollectorPubkey,
              lamports: serviceLamports,
            })
          );
        }
      }
      
      // التوقيع والإرسال
      const signature = await web3.sendAndConfirmTransaction(
        connection,
        transaction,
        [keypair],
        {
          commitment: 'confirmed',
          preflightCommitment: 'confirmed',
          maxRetries: 3
        }
      );
      
      // تسجيل المعاملة
      await logTransaction({
        type: 'send',
        to: recipient,
        amount,
        currency: token.symbol,
        networkFee: state.networkFee,
        serviceFee: shouldCollectFee ? serviceFee : 0,
        transactionSignature: signature,
        timestamp: new Date().toISOString(),
        status: 'completed'
      });
      
      // تحديث الواجهة
      await loadBalances(true);
      clearBalanceCache();
      
      Alert.alert(
        t('sendScreen.alerts.success'),
        `${t('sendScreen.alerts.sent')} ${amount} ${token.symbol}`,
        [{
          text: t('sendScreen.alerts.done'),
          onPress: () => {
            if (isMounted.current) {
              setState(prev => ({ ...prev, recipient: '', amount: '' }));
            }
          }
        }]
      );
      
    } catch (error) {
      console.error('Execute Transaction Failed:', error);
      throw error;
    }
  }, [state.networkFee, serviceFee, loadBalances, t]);

  const handleMaxAmount = useCallback(() => {
    // 1. حساب الرصيد القابل للاستخدام
    let maxAmount = 0;

    if (state.currency === 'SOL') {
      // إذا كان SOL، نخصم الرسوم المقدرة
      maxAmount = currentBalance - estimatedTotalSolFees;
      // ترك هامش أمان صغير جداً لتجنب أخطاء التقريب
      maxAmount -= 0.000001; 
    } else {
      // إذا كان توكن، الرصيد بالكامل متاح (لأن الرسوم تدفع من SOL)
      maxAmount = currentBalance;
    }
    
    if (maxAmount <= 0) {
      Alert.alert(t('sendScreen.alerts.info'), t('sendScreen.alerts.noBalance') || 'No available balance to send after fees.');
      return;
    }
    
    // تقريب الرقم حسب عدد الخانات العشرية للعملة
    const decimals = currentToken.decimals || 6;
    // استخدام regex أو toFixed لتنسيق الرقم كنص
    const formattedAmount = (Math.floor(maxAmount * Math.pow(10, decimals)) / Math.pow(10, decimals)).toString();

    setState(prev => ({ ...prev, amount: formattedAmount }));
  }, [currentBalance, state.currency, estimatedTotalSolFees, currentToken, t]);

  const handlePasteAddress = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        const trimmedText = text.trim();
        setState(prev => ({ ...prev, recipient: trimmedText }));
      }
    } catch (error) {
      console.warn('Clipboard Error', error);
    }
  }, []);

  // إدارة دورة الحياة (Mount/Unmount)
  useEffect(() => {
    isMounted.current = true;
    
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    const init = async () => {
      await updateNetworkFee();
      await loadBalances();
    };
    init();

    return () => {
      isMounted.current = false;
      if (validationTimeoutRef.current) clearTimeout(validationTimeoutRef.current);
    };
  }, []);

  // مراقبة تغيير العنوان للتحقق منه (Debounce)
  useEffect(() => {
    if (validationTimeoutRef.current) clearTimeout(validationTimeoutRef.current);
    
    // التحقق فقط إذا كان العنوان طويلاً بما يكفي
    if (state.recipient.length >= 32) {
      validationTimeoutRef.current = setTimeout(() => {
        validateRecipient(state.recipient, currentToken.mint);
      }, 800);
    } else {
      setState(prev => ({ ...prev, recipientExists: null }));
    }
  }, [state.recipient, currentToken.mint, validateRecipient]);

  // تحديث دوري للبيانات
  useEffect(() => {
    const interval = setInterval(() => {
      if (!state.loading && !state.transactionInProgress && isMounted.current) {
        // تحديث هادئ بدون Loading Spinner
        getSolBalance().then(bal => {
           if(isMounted.current) setBalances(prev => ({...prev, sol: bal}));
        });
        updateNetworkFee();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [state.loading, state.transactionInProgress, updateNetworkFee]);

  const renderTokenItem = useCallback(({ item }) => {
    const isSelected = state.currency === item.symbol;
    const balance = item.symbol === 'SOL' ? balances.sol : balances.tokens[item.symbol] || 0;
    
    return (
      <TouchableOpacity
        style={[
          styles.tokenItem,
          { 
            backgroundColor: colors.card,
            borderColor: isSelected ? primaryColor : 'transparent',
          }
        ]}
        onPress={() => setState(prev => ({ ...prev, currency: item.symbol, modalVisible: false, amount: '' }))}
      >
        <View style={styles.tokenItemContent}>
          <View style={[styles.tokenIcon, { backgroundColor: primaryColor + '20' }]}>
            <Ionicons name={item.icon} size={24} color={primaryColor} />
          </View>
          <View style={styles.tokenDetails}>
            <Text style={[styles.tokenItemName, { color: colors.text }]}>{item.symbol}</Text>
            <Text style={[styles.tokenBalance, { color: colors.textSecondary }]}>
              {balance > 0 ? `${balance.toFixed(4)}` : '0.00'}
            </Text>
          </View>
          {isSelected && <Ionicons name="checkmark-circle" size={24} color={primaryColor} />}
        </View>
      </TouchableOpacity>
    );
  }, [state.currency, colors, primaryColor, balances]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{t('sendScreen.title')}</Text>
          </View>

          {/* Balance Card */}
          <View style={[styles.balanceCard, { backgroundColor: colors.card }]}>
            <View style={styles.balanceHeader}>
              <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>
                {t('sendScreen.balance.available')}
              </Text>
              <TouchableOpacity onPress={() => loadBalances(true)} disabled={state.loadingTokens}>
                <Ionicons name="refresh-outline" size={20} color={state.loadingTokens ? colors.textSecondary : primaryColor} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.balanceAmount, { color: colors.text }]}>
              {currentBalance.toFixed(6)} {state.currency}
            </Text>
          </View>

          {/* Token Selector */}
          <TouchableOpacity
            style={[styles.tokenSelector, { backgroundColor: colors.card }]}
            onPress={() => setState(prev => ({ ...prev, modalVisible: true }))}
          >
            <View style={styles.tokenSelectorContent}>
              <View style={styles.tokenInfo}>
                <View style={[styles.tokenIcon, { backgroundColor: primaryColor + '20' }]}>
                  <Ionicons name={currentToken.icon} size={24} color={primaryColor} />
                </View>
                <View>
                  <Text style={[styles.tokenName, { color: colors.text }]}>{currentToken.symbol}</Text>
                </View>
              </View>
              <Ionicons name="chevron-down" size={24} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          {/* Recipient Input */}
          <View style={styles.inputSection}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>{t('sendScreen.inputs.recipient')}</Text>
            <View style={[styles.inputContainer, { 
              backgroundColor: colors.inputBackground, 
              borderColor: state.recipientExists === false ? colors.error : colors.border 
            }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={t('sendScreen.inputs.recipientPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                value={state.recipient}
                onChangeText={(text) => setState(prev => ({ ...prev, recipient: text }))}
                autoCapitalize="none"
              />
              {state.recipient ? (
                <TouchableOpacity onPress={() => setState(prev => ({ ...prev, recipient: '' }))}>
                  <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handlePasteAddress}>
                  <Ionicons name="clipboard-outline" size={20} color={primaryColor} />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Warning for new token account creation */}
            {state.recipientExists && state.currency !== 'SOL' && !state.recipientHasTokenAccount && (
               <Text style={[styles.warningText, { color: colors.warning }]}>
                 ⚠️ Recipient needs a Token Account (~0.002 SOL fee)
               </Text>
            )}
          </View>

          {/* Amount Input */}
          <View style={styles.inputSection}>
            <View style={styles.amountHeader}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>{t('sendScreen.inputs.amount')}</Text>
              <TouchableOpacity onPress={handleMaxAmount}>
                <Text style={[styles.maxButton, { color: primaryColor }]}>{t('sendScreen.inputs.maxButton')}</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.text, flex: 1 }]}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={state.amount}
                onChangeText={(text) => setState(prev => ({ ...prev, amount: text.replace(/,/g, '.') }))} // تبديل الفاصلة بنقطة
              />
              <Text style={[styles.currencyLabel, { color: colors.textSecondary }]}>{state.currency}</Text>
            </View>
          </View>

          {/* Fees Display */}
          <View style={[styles.simpleFeeRow, { backgroundColor: colors.card }]}>
            <Text style={[styles.simpleFeeText, { color: colors.textSecondary }]}>
              {t('sendScreen.fees.networkFee') || 'Est. Fee'}
            </Text>
            <Text style={[styles.simpleFeeAmount, { color: colors.text }]}>
              ≈ {estimatedTotalSolFees.toFixed(6)} SOL
            </Text>
          </View>

          {/* Send Button */}
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: primaryColor }]}
            onPress={handleSend}
            disabled={state.loading}
            activeOpacity={0.8}
          >
            {state.loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="paper-plane-outline" size={20} color="#FFFFFF" />
                <Text style={styles.sendButtonText}>{t('sendScreen.buttons.send')}</Text>
              </>
            )}
          </TouchableOpacity>

        </Animated.View>
      </ScrollView>

      {/* Modal Code */}
      <Modal 
        visible={state.modalVisible} 
        transparent 
        animationType="slide"
        onRequestClose={() => setState(prev => ({ ...prev, modalVisible: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('sendScreen.modals.chooseCurrency')}</Text>
              <TouchableOpacity onPress={() => setState(prev => ({ ...prev, modalVisible: false }))}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={BASE_TOKENS}
              keyExtractor={(item) => item.symbol}
              renderItem={renderTokenItem}
              contentContainerStyle={styles.tokenList}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// =============================================
// 🎨 الأنماط
// =============================================
const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  container: { flex: 1 },
  header: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  balanceCard: { borderRadius: 16, padding: 20, marginBottom: 20, elevation: 4 },
  balanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  balanceLabel: { fontSize: 14, fontWeight: '500' },
  balanceAmount: { fontSize: 32, fontWeight: '700' },
  tokenSelector: { borderRadius: 16, padding: 16, marginBottom: 20, elevation: 4 },
  tokenSelectorContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tokenInfo: { flexDirection: 'row', alignItems: 'center' },
  tokenIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  tokenName: { fontSize: 16, fontWeight: '600' },
  inputSection: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  currencyLabel: { fontSize: 16, fontWeight: '600', marginLeft: 8 },
  amountHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  maxButton: { fontSize: 14, fontWeight: '600' },
  simpleFeeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, padding: 16, marginBottom: 20 },
  simpleFeeText: { fontSize: 14, fontWeight: '500' },
  simpleFeeAmount: { fontSize: 15, fontWeight: '600' },
  sendButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 16, paddingVertical: 18, elevation: 6 },
  sendButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  warningText: { fontSize: 12, marginTop: 4, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 24, maxHeight: '80%', paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  tokenList: { paddingHorizontal: 20 },
  tokenItem: { borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1 },
  tokenItemContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tokenDetails: { flex: 1, marginLeft: 12 },
  tokenItemName: { fontSize: 16, fontWeight: '600' },
  tokenBalance: { fontSize: 12, marginTop: 2 },
});
