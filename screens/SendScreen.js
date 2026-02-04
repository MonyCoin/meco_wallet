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
// ⚙️ إعدادات التطبيق - مضبوطة للإنتاج ✅
// =============================================
const FEE_COLLECTOR_ADDRESS = 'HXkEZSKictbSYan9ZxQGaHpFrbA4eLDyNtEDxVBkdFy6';
const SERVICE_FEE_PERCENTAGE = 0.1; // 10% من رسوم الشبكة فقط ✅
const MAX_NETWORK_FEE = 0.00001; // سقف أقصى لرسوم الشبكة
const MIN_SOL_AMOUNT = 0.0001; // الحد الأدنى لإرسال SOL (≈ $0.02) ✅
const MIN_TOKEN_AMOUNT = 0.0001; // الحد الأدنى لإرسال التوكنات ✅
const CACHE_DURATION = 60000; // 1 دقيقة للتخزين المؤقت

// التوكنات الأساسية المدعومة
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
// 🛠️ دوال المساعدة المحسنة
// =============================================

async function getKeypair() {
  try {
    const secretKeyStr = await SecureStore.getItemAsync('wallet_private_key');
    if (!secretKeyStr) {
      throw new Error(t('sendScreen.errors.privateKeyNotFound'));
    }

    let secretKey;
    if (secretKeyStr.startsWith('[')) {
      secretKey = new Uint8Array(JSON.parse(secretKeyStr));
    } else {
      secretKey = bs58.decode(secretKeyStr);
    }

    if (secretKey.length !== 64) {
      throw new Error(t('sendScreen.errors.invalidKeyLength'));
    }

    return web3.Keypair.fromSecretKey(secretKey);
  } catch (error) {
    console.error('❌', t('sendScreen.errors.keyRetrievalFailed'), error);
    throw error;
  }
}

// =============================================
// 🎯 المكون الرئيسي المحسن
// =============================================
export default function SendScreen() {
  const { t } = useTranslation();
  const route = useRoute();
  const theme = useAppStore(state => state.theme);
  const primaryColor = useAppStore(state => state.primaryColor);
  const isDark = theme === 'dark';
  
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
    lastBalanceUpdate: Date.now(),
    transactionInProgress: false
  });

  const [balances, setBalances] = useState({
    sol: 0,
    tokens: {},
    lastUpdated: 0
  });

  const [fadeAnim] = useState(new Animated.Value(0));
  const loadTimeoutRef = useRef(null);
  const validationTimeoutRef = useRef(null);

  const currentToken = useMemo(() => {
    return BASE_TOKENS.find(t => t.symbol === state.currency) || BASE_TOKENS[0];
  }, [state.currency]);

  const serviceFee = useMemo(() => {
    return state.networkFee * SERVICE_FEE_PERCENTAGE;
  }, [state.networkFee]);

  const totalFees = useMemo(() => {
    return state.networkFee + serviceFee;
  }, [state.networkFee, serviceFee]);

  const currentBalance = useMemo(() => {
    if (state.currency === 'SOL') {
      return balances.sol || 0;
    }
    return balances.tokens[state.currency] || 0;
  }, [state.currency, balances]);

  const minimumAmount = useMemo(() => {
    return state.currency === 'SOL' ? MIN_SOL_AMOUNT : MIN_TOKEN_AMOUNT;
  }, [state.currency]);

  // ✅ الإصلاح: زر الإرسال يعمل دائمًا، التحقق يكون في handleSend
  const canShowSendButton = useMemo(() => {
    const hasRecipient = state.recipient && state.recipient.length >= 32;
    const amountNum = parseFloat(state.amount) || 0;
    const hasAmount = amountNum > 0;
    const meetsMinimum = amountNum >= minimumAmount;
    const notLoading = !state.loading && !state.transactionInProgress;
    
    return hasRecipient && hasAmount && meetsMinimum && notLoading;
  }, [state.recipient, state.amount, state.loading, state.transactionInProgress, minimumAmount]);

  const updateNetworkFee = useCallback(async () => {
    try {
      const now = Date.now();
      const lastUpdate = state.lastBalanceUpdate;
      
      if (now - lastUpdate < 30000 && state.networkFee > 0) {
        return;
      }
      
      let fee = await getCurrentNetworkFee();
      
      if (fee > MAX_NETWORK_FEE) {
        fee = MAX_NETWORK_FEE;
      }
      
      setState(prev => ({
        ...prev,
        networkFee: fee,
        lastBalanceUpdate: now
      }));
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        networkFee: 0.000005
      }));
    }
  }, [state.lastBalanceUpdate, state.networkFee]);

  const loadBalances = useCallback(async (forceRefresh = false) => {
    try {
      setState(prev => ({ ...prev, loadingTokens: true }));
      
      const now = Date.now();
      const solBalance = await getSolBalance(forceRefresh);
      
      const tokenPromises = BASE_TOKENS.filter(t => t.mint)
        .slice(0, 5)
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
      
      setBalances({
        sol: solBalance,
        tokens: tokenBalances,
        lastUpdated: now
      });
      
    } catch (error) {
      console.error('❌', t('sendScreen.errors.balanceLoadFailed'), error);
    } finally {
      setState(prev => ({ ...prev, loadingTokens: false }));
    }
  }, [t]);

  const validateRecipient = useCallback(async (address) => {
    if (!address || address.length < 32) {
      setState(prev => ({ ...prev, recipientExists: null }));
      return;
    }
    
    try {
      const validation = await validateSolanaAddress(address);
      setState(prev => ({ ...prev, recipientExists: validation.exists }));
    } catch (error) {
      setState(prev => ({ ...prev, recipientExists: null }));
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!canShowSendButton) {
      Alert.alert(
        t('sendScreen.alerts.error'),
        t('sendScreen.alerts.incompleteData')
      );
      return;
    }
    
    try {
      const amount = parseFloat(state.amount);
      const recipient = state.recipient.trim();
      
      // ✅ التحقق من الحد الأدنى
      if (amount < minimumAmount) {
        Alert.alert(
          t('sendScreen.alerts.error'),
          t('sendScreen.alerts.minimumAmount', { 
            amount: minimumAmount, 
            currency: state.currency 
          })
        );
        return;
      }
      
      // ✅ التحقق من الرصيد
      if (amount > currentBalance) {
        Alert.alert(
          t('sendScreen.alerts.error'),
          t('sendScreen.alerts.insufficientBalance') + ` ${currentBalance.toFixed(6)} ${state.currency}`
        );
        return;
      }
      
      // ✅ التحقق من رصيد SOL للرسوم
      if (totalFees > balances.sol) {
        Alert.alert(
          t('sendScreen.alerts.error'),
          t('sendScreen.alerts.insufficientSolForFees', { 
            needed: totalFees.toFixed(6), 
            balance: balances.sol.toFixed(6) 
          })
        );
        return;
      }
      
      // التحقق من العنوان
      const addressCheck = await validateSolanaAddress(recipient);
      if (!addressCheck.isValid) {
        Alert.alert(
          t('sendScreen.alerts.error'),
          t('sendScreen.alerts.invalidAddress')
        );
        return;
      }
      
      const myAddress = await SecureStore.getItemAsync('wallet_public_key');
      if (recipient === myAddress) {
        Alert.alert(
          t('sendScreen.alerts.error'),
          t('sendScreen.alerts.selfTransfer')
        );
        return;
      }
      
      // كل التحققات صحيحة - المتابعة
      setState(prev => ({ ...prev, loading: true, transactionInProgress: true }));
      
      await executeTransaction(amount, recipient, currentToken);
      
    } catch (error) {
      console.error('❌', t('sendScreen.alerts.sendFailed'), error);
      await logTransaction({
        type: 'send',
        to: state.recipient,
        amount: parseFloat(state.amount),
        currency: state.currency,
        networkFee: state.networkFee,
        serviceFee,
        totalFee: totalFees,
        timestamp: new Date().toISOString(),
        status: 'failed',
        error: error.message,
      });
      
      Alert.alert(
        t('sendScreen.alerts.sendFailed'),
        error.message || t('sendScreen.alerts.unexpectedError')
      );
      
    } finally {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        transactionInProgress: false 
      }));
    }
  }, [canShowSendButton, state, currentToken, currentBalance, balances.sol, totalFees, serviceFee, minimumAmount, t]);

  const executeTransaction = useCallback(async (amount, recipient, token) => {
    try {
      const keypair = await getKeypair();
      const fromPubkey = keypair.publicKey;
      const toPubkey = new web3.PublicKey(recipient);
      const feeCollectorPubkey = new web3.PublicKey(FEE_COLLECTOR_ADDRESS);
      
      const connection = new web3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      const { blockhash } = await getLatestBlockhash();
      
      let transactionSignature;
      const instructions = [];
      const serviceLamports = Math.floor(serviceFee * web3.LAMPORTS_PER_SOL);
      
      if (token.symbol === 'SOL') {
        const lamportsToSend = Math.floor(amount * web3.LAMPORTS_PER_SOL);
        
        instructions.push(
          web3.SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports: lamportsToSend,
          })
        );
        
        if (serviceLamports > 0) {
          instructions.push(
            web3.SystemProgram.transfer({
              fromPubkey,
              toPubkey: feeCollectorPubkey,
              lamports: serviceLamports,
            })
          );
        }
        
      } else if (token.mint) {
        const mint = new web3.PublicKey(token.mint);
        const fromATA = await splToken.getAssociatedTokenAddress(mint, fromPubkey);
        const toATA = await splToken.getAssociatedTokenAddress(mint, toPubkey);
        
        const mintInfo = await splToken.getMint(connection, mint);
        const amountRaw = BigInt(Math.floor(amount * Math.pow(10, mintInfo.decimals)));
        
        if (amountRaw === 0n) {
          throw new Error(t('sendScreen.alerts.amountTooSmall'));
        }
        
        const toAccountInfo = await connection.getAccountInfo(toATA);
        if (!toAccountInfo) {
          instructions.push(
            splToken.createAssociatedTokenAccountInstruction(
              fromPubkey,
              toATA,
              toPubkey,
              mint
            )
          );
        }
        
        instructions.push(
          splToken.createTransferInstruction(
            fromATA,
            toATA,
            fromPubkey,
            amountRaw
          )
        );
        
        if (serviceLamports > 0) {
          instructions.push(
            web3.SystemProgram.transfer({
              fromPubkey,
              toPubkey: feeCollectorPubkey,
              lamports: serviceLamports,
            })
          );
        }
      }
      
      const transaction = new web3.Transaction();
      transaction.add(...instructions);
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;
      
      transactionSignature = await web3.sendAndConfirmTransaction(
        connection,
        transaction,
        [keypair],
        {
          skipPreflight: false,
          commitment: 'confirmed',
          preflightCommitment: 'confirmed',
          maxRetries: 3
        }
      );
      
      await logTransaction({
        type: 'send',
        to: recipient,
        amount,
        currency: token.symbol,
        networkFee: state.networkFee,
        serviceFee,
        totalFee: totalFees,
        transactionSignature,
        timestamp: new Date().toISOString(),
        status: 'completed'
      });
      
      await loadBalances(true);
      clearBalanceCache();
      
      Alert.alert(
        t('sendScreen.alerts.success'),
        `${t('sendScreen.alerts.sent')} ${amount} ${token.symbol}\n` +
        `${t('sendScreen.alerts.to')} ${recipient.substring(0, 8)}...\n\n` +
        `${t('sendScreen.alerts.fees')} ${totalFees.toFixed(6)} SOL\n` +
        `${t('sendScreen.alerts.transactionHash')} ${transactionSignature.substring(0, 16)}...`,
        [{
          text: t('sendScreen.alerts.done'),
          onPress: () => {
            setState(prev => ({ 
              ...prev, 
              recipient: '', 
              amount: '' 
            }));
          }
        }]
      );
      
    } catch (error) {
      console.error('❌', t('sendScreen.alerts.sendFailed'), error);
      throw error;
    }
  }, [state.networkFee, serviceFee, totalFees, loadBalances, t]);

  const handleMaxAmount = useCallback(() => {
    if (currentBalance <= 0) {
      Alert.alert(
        t('sendScreen.alerts.info'),
        t('sendScreen.alerts.noBalance')
      );
      return;
    }
    
    let maxAmount;
    if (state.currency === 'SOL') {
      maxAmount = Math.max(0, currentBalance - totalFees);
    } else {
      maxAmount = currentBalance;
    }
    
    if (maxAmount < minimumAmount) {
      Alert.alert(
        t('sendScreen.alerts.unavailable'),
        t('sendScreen.alerts.balanceBelowMinimum')
      );
      return;
    }
    
    if (maxAmount > 0) {
      const decimals = currentToken.decimals || 6;
      setState(prev => ({ 
        ...prev, 
        amount: maxAmount.toFixed(decimals) 
      }));
    }
  }, [currentBalance, state.currency, totalFees, currentToken, minimumAmount, t]);

  const handlePasteAddress = useCallback(async () => {
    try {
      const text = await Clipboard.getString();
      if (text) {
        const trimmedText = text.trim();
        setState(prev => ({ ...prev, recipient: trimmedText }));
      }
    } catch (error) {
      console.warn(t('sendScreen.errors.copyFailed'), error);
    }
  }, [t]);

  useEffect(() => {
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
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      if (validationTimeoutRef.current) clearTimeout(validationTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }
    
    validationTimeoutRef.current = setTimeout(() => {
      validateRecipient(state.recipient);
    }, 1000);
    
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, [state.recipient, validateRecipient]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!state.loading && !state.transactionInProgress) {
        loadBalances();
        updateNetworkFee();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [state.loading, state.transactionInProgress, loadBalances, updateNetworkFee]);

  // ✅ الإصلاح: دالة عرض التوكنات تسمح باختيار أي توكن
  const renderTokenItem = useCallback(({ item }) => {
    const isSelected = state.currency === item.symbol;
    const balance = item.symbol === 'SOL' ? balances.sol : balances.tokens[item.symbol] || 0;
    const hasBalance = balance > 0;
    
    // استخدام الترجمات لأسماء التوكنات
    const tokenName = t(`sendScreen.tokens.${item.symbol.toLowerCase()}Token`, { defaultValue: item.name });
    
    return (
      <TouchableOpacity
        style={[
          styles.tokenItem,
          { 
            backgroundColor: colors.card,
            borderColor: isSelected ? primaryColor : 'transparent',
            opacity: hasBalance ? 1 : 0.7, // ✅ توضيح للرصيد الصفري
          }
        ]}
        onPress={() => {
          setState(prev => ({ ...prev, currency: item.symbol, modalVisible: false }));
        }}
        activeOpacity={0.7}
      >
        <View style={styles.tokenItemContent}>
          <View style={[styles.tokenIcon, { backgroundColor: primaryColor + '20' }]}>
            <Ionicons name={item.icon} size={24} color={primaryColor} />
          </View>
          <View style={styles.tokenDetails}>
            <Text style={[styles.tokenItemName, { color: colors.text }]}>
              {item.symbol}
            </Text>
            <Text style={[styles.tokenItemSymbol, { color: colors.textSecondary }]}>
              {tokenName}
            </Text>
            <Text style={[
              styles.tokenBalance, 
              { color: hasBalance ? colors.textSecondary : colors.textSecondary + '80' }
            ]}>
              {hasBalance ? `${t('sendScreen.tokens.balance')} ${balance.toFixed(4)}` : t('sendScreen.tokens.noBalance')}
            </Text>
          </View>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={24} color={primaryColor} />
          )}
        </View>
      </TouchableOpacity>
    );
  }, [state.currency, colors, primaryColor, balances, t]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('sendScreen.title')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('sendScreen.subtitle')}
            </Text>
          </View>

          <View style={[styles.balanceCard, { backgroundColor: colors.card }]}>
            <View style={styles.balanceHeader}>
              <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>
                {t('sendScreen.balance.available')}
              </Text>
              <TouchableOpacity 
                onPress={() => loadBalances(true)} 
                style={styles.refreshButton}
                disabled={state.loadingTokens}
              >
                <Ionicons 
                  name="refresh-outline" 
                  size={20} 
                  color={state.loadingTokens ? colors.textSecondary : primaryColor} 
                />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.balanceAmount, { color: colors.text }]}>
              {currentBalance.toFixed(6)} {state.currency}
            </Text>
            
            {state.currency !== 'SOL' && (
              <View style={styles.solBalanceContainer}>
                <Text style={[styles.solBalanceLabel, { color: colors.textSecondary }]}>
                  {t('sendScreen.balance.solForFees')}
                </Text>
                <Text style={[styles.solBalanceAmount, { 
                  color: balances.sol >= totalFees ? colors.success : colors.warning 
                }]}>
                  {balances.sol.toFixed(6)} SOL
                </Text>
              </View>
            )}
          </View>

          {/* اختيار التوكن - يعمل دائمًا */}
          <TouchableOpacity
            style={[styles.tokenSelector, { backgroundColor: colors.card }]}
            onPress={() => setState(prev => ({ ...prev, modalVisible: true }))}
            activeOpacity={0.7}
          >
            <View style={styles.tokenSelectorContent}>
              <View style={styles.tokenInfo}>
                <View style={[styles.tokenIcon, { backgroundColor: primaryColor + '20' }]}>
                  <Ionicons 
                    name={currentToken.icon} 
                    size={24} 
                    color={primaryColor} 
                  />
                </View>
                <View>
                  <Text style={[styles.tokenName, { color: colors.text }]}>
                    {currentToken.symbol}
                  </Text>
                  <Text style={[styles.tokenSymbol, { color: colors.textSecondary }]}>
                    {t(`sendScreen.tokens.${currentToken.symbol.toLowerCase()}Token`, { defaultValue: currentToken.name })}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-down" size={24} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <View style={styles.inputSection}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              {t('sendScreen.inputs.recipient')}
            </Text>
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
                autoCorrect={false}
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
            {state.recipientExists === false && (
              <Text style={[styles.warningText, { color: colors.warning }]}>
                {t('sendScreen.warnings.inactiveAddress')}
              </Text>
            )}
          </View>

          <View style={styles.inputSection}>
            <View style={styles.amountHeader}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                {t('sendScreen.inputs.amount')}
              </Text>
              <TouchableOpacity onPress={handleMaxAmount}>
                <Text style={[styles.maxButton, { color: primaryColor }]}>
                  {t('sendScreen.inputs.maxButton')}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.text, flex: 1 }]}
                placeholder={t('sendScreen.inputs.amountPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={state.amount}
                onChangeText={(text) => setState(prev => ({ ...prev, amount: text }))}
              />
              <Text style={[styles.currencyLabel, { color: colors.textSecondary }]}>
                {state.currency}
              </Text>
            </View>
            <Text style={[styles.minimumText, { color: colors.textSecondary }]}>
              {t('sendScreen.inputs.minimum')} {minimumAmount} {state.currency}
            </Text>
          </View>

          {/* رسوم بسيطة */}
          <View style={[styles.simpleFeeRow, { backgroundColor: colors.card }]}>
            <Text style={[styles.simpleFeeText, { color: colors.textSecondary }]}>
              {t('sendScreen.fees.networkFee')}
            </Text>
            <Text style={[styles.simpleFeeAmount, { color: colors.text }]}>
              {totalFees.toFixed(6)} SOL
            </Text>
          </View>

          {/* ✅ زر الإرسال - يعمل دائمًا مع رسائل خطأ واضحة */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              { 
                backgroundColor: canShowSendButton ? primaryColor : colors.textSecondary,
                opacity: canShowSendButton ? 1 : 0.5
              }
            ]}
            onPress={handleSend}
            disabled={!canShowSendButton || state.loading}
          >
            {state.loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={[styles.loadingText, { color: '#FFFFFF', marginLeft: 8 }]}>
                  {t('sendScreen.buttons.sending')}
                </Text>
              </View>
            ) : (
              <>
                <Ionicons name="paper-plane-outline" size={20} color="#FFFFFF" />
                <Text style={styles.sendButtonText}>
                  {t('sendScreen.buttons.send')}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* رسالة توضيحية عند تعطيل الزر */}
          {!canShowSendButton && (
            <View style={styles.hintContainer}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                {!state.recipient ? t('sendScreen.warnings.enterRecipient') : 
                 !state.amount ? t('sendScreen.warnings.enterAmount') : 
                 parseFloat(state.amount || 0) < minimumAmount ? 
                   `${t('sendScreen.inputs.minimum')} ${minimumAmount} ${state.currency}` : 
                 t('sendScreen.warnings.availableToSend')}
              </Text>
            </View>
          )}

          <View style={styles.securityNotice}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.securityText, { color: colors.textSecondary }]}>
              {t('sendScreen.warnings.verifyAddress')}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* نافذة اختيار التوكن - تعمل دائمًا */}
      <Modal 
        visible={state.modalVisible} 
        transparent 
        animationType="slide"
        onRequestClose={() => setState(prev => ({ ...prev, modalVisible: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t('sendScreen.modals.chooseCurrency')}
              </Text>
              <TouchableOpacity onPress={() => setState(prev => ({ ...prev, modalVisible: false }))}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {state.loadingTokens ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={primaryColor} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  {t('sendScreen.modals.loadingBalances')}
                </Text>
              </View>
            ) : (
              <FlatList
                data={BASE_TOKENS}
                keyExtractor={(item) => item.mint || item.symbol}
                renderItem={renderTokenItem}
                contentContainerStyle={styles.tokenList}
                showsVerticalScrollIndicator={false}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
              />
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// =============================================
// 🎨 الأنماط المحسنة
// =============================================
const styles = StyleSheet.create({
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
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  balanceCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  refreshButton: {
    padding: 4,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  solBalanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  solBalanceLabel: {
    fontSize: 14,
  },
  solBalanceAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  tokenSelector: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tokenSelectorContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tokenName: {
    fontSize: 16,
    fontWeight: '600',
  },
  tokenSymbol: {
    fontSize: 14,
    marginTop: 2,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  amountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  maxButton: {
    fontSize: 14,
    fontWeight: '600',
  },
  minimumText: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  currencyLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  simpleFeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  simpleFeeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  simpleFeeAmount: {
    fontSize: 15,
    fontWeight: '600',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    marginBottom: 12,
  },
  hintText: {
    fontSize: 12,
    marginLeft: 8,
    textAlign: 'center',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  securityText: {
    fontSize: 12,
    marginLeft: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  tokenList: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  tokenItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
  },
  tokenItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tokenDetails: {
    flex: 1,
    marginLeft: 12,
  },
  tokenItemName: {
    fontSize: 16,
    fontWeight: '600',
  },
  tokenItemSymbol: {
    fontSize: 14,
    marginTop: 2,
  },
  tokenBalance: {
    fontSize: 12,
    marginTop: 2,
  },
});
