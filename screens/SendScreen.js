import React, { useState, useEffect } from 'react';
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
// ✅ الإعدادات
// =============================================
const FEE_COLLECTOR_ADDRESS = 'HXkEZSKictbSYan9ZxQGaHpFrbA4eLDyNtEDxVBkdFy6';
const SERVICE_FEE_PERCENTAGE = 0.1; // 10%
const RENT_EXEMPTION_AMOUNT = 0.00203928;

// التوكنات الأساسية
const BASE_TOKENS = [
  {
    symbol: 'SOL',
    name: 'Solana',
    mint: null,
    icon: 'diamond-outline',
    decimals: 9
  },
  {
    symbol: 'MECO',
    name: 'MECO Token',
    mint: '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i',
    icon: 'rocket-outline',
    decimals: 6
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    mint: 'Es9vMFrzaCERc8Foa8XfRduKiSfrhEL5c7qr2WXXBWY5',
    icon: 'cash-outline',
    decimals: 6
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    icon: 'wallet-outline',
    decimals: 6
  },
];

// =============================================
// ✅ دوال المساعدة
// =============================================
async function getKeypair() {
  try {
    const secretKeyStr = await SecureStore.getItemAsync('wallet_private_key');
    if (!secretKeyStr) throw new Error(t('no_public_key'));

    let secretKey;
    if (secretKeyStr.startsWith('[')) {
      secretKey = new Uint8Array(JSON.parse(secretKeyStr));
    } else {
      secretKey = bs58.decode(secretKeyStr);
    }

    if (secretKey.length !== 64) {
      throw new Error('طول المفتاح الخاص غير صحيح');
    }

    return web3.Keypair.fromSecretKey(secretKey);
  } catch (error) {
    console.error('❌ Failed to get keypair:', error);
    throw error;
  }
}

// =============================================
// ✅ المكون الرئيسي
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
  };

  const preselected = route?.params?.preselectedToken;
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(preselected || 'SOL');
  const [modalVisible, setModalVisible] = useState(false);
  const [balance, setBalance] = useState(0);
  const [solBalance, setSolBalance] = useState(0);
  const [availableTokens, setAvailableTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [networkFee, setNetworkFee] = useState(0.000005);
  const [recipientExists, setRecipientExists] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));

  // حساب الرسوم الكلية
  const calculateTotalFee = () => {
    return networkFee + (networkFee * SERVICE_FEE_PERCENTAGE);
  };

  // التهيئة
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    loadInitialData();
    
    // تحديث الرسوم كل 60 ثانية
    const interval = setInterval(() => {
      updateNetworkFee();
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // تحميل البيانات الأولية
  const loadInitialData = async () => {
    await updateNetworkFee();
    await loadTokens();
  };

  // تحديث رسوم الشبكة
  const updateNetworkFee = async () => {
    try {
      const fee = await getCurrentNetworkFee();
      setNetworkFee(fee);
    } catch (error) {
      console.warn('Failed to update network fee:', error);
    }
  };

  // تحميل التوكنات والأرصدة
  const loadTokens = async () => {
    try {
      setLoadingTokens(true);
      
      const tokensWithBalances = await Promise.all(
        BASE_TOKENS.map(async (token) => {
          let userBalance = 0;
          
          if (token.symbol === 'SOL') {
            userBalance = await getSolBalance();
          } else if (token.mint) {
            userBalance = await getTokenBalance(token.mint);
          }
          
          return {
            ...token,
            userBalance,
            hasBalance: userBalance > 0,
            uniqueKey: token.mint || `base_${token.symbol}`
          };
        })
      );
      
      setAvailableTokens(tokensWithBalances);
      
      // تعيين الرصيد الحالي
      const currentToken = tokensWithBalances.find(t => t.symbol === currency);
      if (currentToken) {
        setBalance(currentToken.userBalance || 0);
        
        // جلب رصيد SOL منفصل للرسوم
        if (currency !== 'SOL') {
          const sol = await getSolBalance();
          setSolBalance(sol || 0);
        } else {
          setSolBalance(currentToken.userBalance || 0);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to load tokens:', error);
      setAvailableTokens(BASE_TOKENS.map(t => ({ ...t, userBalance: 0, hasBalance: false })));
    } finally {
      setLoadingTokens(false);
    }
  };

  // عند تغيير العملة
  useEffect(() => {
    const updateBalanceForCurrency = async () => {
      const token = availableTokens.find(t => t.symbol === currency);
      if (token) {
        setBalance(token.userBalance || 0);
        
        if (currency === 'SOL') {
          setSolBalance(token.userBalance || 0);
        } else {
          const sol = await getSolBalance();
          setSolBalance(sol || 0);
        }
      }
    };
    
    updateBalanceForCurrency();
  }, [currency, availableTokens]);

  // التحقق من العنوان المستقبل
  useEffect(() => {
    const checkRecipient = async () => {
      if (!recipient || recipient.length < 32) {
        setRecipientExists(null);
        return;
      }
      
      try {
        const validation = await validateSolanaAddress(recipient);
        setRecipientExists(validation.exists);
      } catch (error) {
        setRecipientExists(null);
      }
    };
    
    const timeout = setTimeout(checkRecipient, 1000);
    return () => clearTimeout(timeout);
  }, [recipient]);

  // الحصول على التوكن الحالي
  const getCurrentToken = () => {
    return availableTokens.find(token => token.symbol === currency) || BASE_TOKENS[0];
  };

  // معالجة زر الإرسال - الإصدار المصحح
  const handleSend = async () => {
    try {
      console.log('🔄 بدء عملية الإرسال...');
      
      // التحقق الأساسي
      if (!recipient || !amount) {
        Alert.alert(t('error'), t('fill_fields'));
        return;
      }
      
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        Alert.alert(t('error'), t('amount_must_be_positive'));
        return;
      }
      
      // التحقق من العنوان
      const addressCheck = await validateSolanaAddress(recipient);
      if (!addressCheck.isValid) {
        Alert.alert(t('error'), t('invalid_address'));
        return;
      }
      
      // التحقق من عدم الإرسال للنفس
      const myAddress = await SecureStore.getItemAsync('wallet_public_key');
      if (recipient === myAddress) {
        Alert.alert(t('error'), t('cannot_send_to_self'));
        return;
      }
      
      // تحديث الأرصدة
      await loadTokens();
      
      const totalFee = calculateTotalFee();
      const serviceFee = networkFee * SERVICE_FEE_PERCENTAGE;
      const currentToken = getCurrentToken();
      
      console.log('💰 التحقق من الأرصدة:', {
        currency,
        amount: numAmount,
        balance,
        solBalance,
        totalFee,
        rentExemption: recipientExists === false && currency === 'SOL' ? RENT_EXEMPTION_AMOUNT : 0
      });
      
      // ✅ التحقق من الأرصدة - الإصدار المصحح
      if (currency === 'SOL') {
        const requiredTotal = numAmount + totalFee + 
          (recipientExists === false ? RENT_EXEMPTION_AMOUNT : 0);
        
        if (requiredTotal > solBalance) {
          Alert.alert(
            t('error'),
            `${t('insufficient_balance')}\n\n` +
            `${t('your_sol_balance')}: ${solBalance.toFixed(6)} SOL\n` +
            `${t('amount_to_send')}: ${numAmount.toFixed(6)} SOL\n` +
            `${t('network_fee')}: ${networkFee.toFixed(6)} SOL\n` +
            `${t('service_fee')}: ${serviceFee.toFixed(6)} SOL\n` +
            (recipientExists === false ? `${t('rent_exempt_fee')}: ${RENT_EXEMPTION_AMOUNT.toFixed(6)} SOL\n` : '') +
            `\n${t('total_required')}: ${requiredTotal.toFixed(6)} SOL`
          );
          return;
        }
      } else {
        // التحقق من رصيد التوكن
        if (numAmount > balance) {
          Alert.alert(
            t('error'),
            `${t('insufficient_token_balance')}\n\n` +
            `${t('balance')} ${currency}: ${balance.toFixed(6)}\n` +
            `${t('amount_to_send')}: ${numAmount.toFixed(6)}`
          );
          return;
        }
        
        // التحقق من رصيد SOL للرسوم
        if (totalFee > solBalance) {
          Alert.alert(
            t('error'),
            `${t('insufficient_sol_for_fees')}\n\n` +
            `${t('required_fees')}: ${totalFee.toFixed(6)} SOL\n` +
            `${t('your_sol_balance')}: ${solBalance.toFixed(6)} SOL`
          );
          return;
        }
      }
      
      // المتابعة للإرسال
      setLoading(true);
      await proceedWithSend(numAmount, totalFee, currentToken);
      
    } catch (error) {
      console.error('❌ Send validation error:', error);
      setLoading(false);
      Alert.alert(
        t('error'),
        error.message || t('insufficient_balance_for_transaction')
      );
    }
  };

  // متابعة الإرسال
  const proceedWithSend = async (amount, totalFee, token) => {
    try {
      const keypair = await getKeypair();
      const fromPubkey = keypair.publicKey;
      const toPubkey = new web3.PublicKey(recipient);
      const feeCollectorPubkey = new web3.PublicKey(FEE_COLLECTOR_ADDRESS);
      
      // إنشاء اتصال
      const connection = new web3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      const { blockhash, lastValidBlockHeight } = await getLatestBlockhash();
      
      let transactionSignature;
      const serviceFee = networkFee * SERVICE_FEE_PERCENTAGE;
      
      if (token.symbol === 'SOL') {
        console.log('🔄 إرسال SOL...');
        
        const instructions = [];
        const lamportsToSend = Math.floor(amount * web3.LAMPORTS_PER_SOL);
        
        // التحويل الرئيسي
        instructions.push(
          web3.SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports: lamportsToSend,
          })
        );
        
        // إضافة رسوم الإيجار للحساب الجديد
        if (recipientExists === false) {
          const rentLamports = Math.floor(RENT_EXEMPTION_AMOUNT * web3.LAMPORTS_PER_SOL);
          instructions.push(
            web3.SystemProgram.transfer({
              fromPubkey,
              toPubkey,
              lamports: rentLamports,
            })
          );
        }
        
        // رسوم الخدمة
        const serviceLamports = Math.floor(serviceFee * web3.LAMPORTS_PER_SOL);
        if (serviceLamports > 0) {
          instructions.push(
            web3.SystemProgram.transfer({
              fromPubkey,
              toPubkey: feeCollectorPubkey,
              lamports: serviceLamports,
            })
          );
        }
        
        // إنشاء المعاملة
        const transaction = new web3.Transaction();
        transaction.add(...instructions);
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPubkey;
        
        // التوقيع والإرسال
        transactionSignature = await web3.sendAndConfirmTransaction(
          connection,
          transaction,
          [keypair],
          {
            skipPreflight: false,
            commitment: 'confirmed',
            preflightCommitment: 'confirmed'
          }
        );
        
      } else if (token.mint) {
        console.log(`🔄 إرسال ${token.symbol}...`);
        
        const mint = new web3.PublicKey(token.mint);
        const fromATA = await splToken.getAssociatedTokenAddress(mint, fromPubkey);
        const toATA = await splToken.getAssociatedTokenAddress(mint, toPubkey);
        
        const mintInfo = await splToken.getMint(connection, mint);
        const amountRaw = BigInt(Math.floor(amount * Math.pow(10, mintInfo.decimals)));
        
        const instructions = [];
        
        // إنشاء حساب التوكن للمستقبل إذا لزم
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
        
        // تحويل التوكن
        instructions.push(
          splToken.createTransferInstruction(
            fromATA,
            toATA,
            fromPubkey,
            amountRaw
          )
        );
        
        // رسوم الخدمة في SOL
        const serviceLamports = Math.floor(serviceFee * web3.LAMPORTS_PER_SOL);
        if (serviceLamports > 0) {
          instructions.push(
            web3.SystemProgram.transfer({
              fromPubkey,
              toPubkey: feeCollectorPubkey,
              lamports: serviceLamports,
            })
          );
        }
        
        // إنشاء المعاملة
        const transaction = new web3.Transaction();
        transaction.add(...instructions);
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPubkey;
        
        // التوقيع والإرسال
        transactionSignature = await web3.sendAndConfirmTransaction(
          connection,
          transaction,
          [keypair],
          {
            skipPreflight: false,
            commitment: 'confirmed'
          }
        );
      }
      
      console.log('✅ Transaction successful:', transactionSignature);
      
      // تسجيل المعاملة
      await logTransaction({
        type: 'send',
        to: recipient,
        amount: amount,
        currency: token.symbol,
        networkFee: networkFee,
        serviceFee: serviceFee,
        totalFee: totalFee,
        transactionSignature,
        timestamp: new Date().toISOString(),
        status: 'completed'
      });
      
      // رسالة النجاح
      Alert.alert(
        t('success'),
        `✅ ${t('sent_successfully')}: ${amount} ${token.symbol}\n\n` +
        `${t('transaction_id')}: ${transactionSignature?.substring(0, 16)}...\n` +
        `${t('fee_details_label')}:\n` +
        `• ${t('network_fee')}: ${networkFee.toFixed(6)} SOL\n` +
        `• ${t('service_fee')}: ${serviceFee.toFixed(6)} SOL\n` +
        `• ${t('total')}: ${totalFee.toFixed(6)} SOL\n\n` +
        (recipientExists === false && currency === 'SOL' 
          ? `${t('rent_exempt_fee')}: ${RENT_EXEMPTION_AMOUNT.toFixed(6)} SOL\n\n`
          : '') +
        `${t('fees_paid_in_sol')}`,
        [{
          text: t('ok'),
          onPress: () => {
            setRecipient('');
            setAmount('');
            setLoading(false);
            clearBalanceCache();
            loadTokens();
          }
        }]
      );
      
    } catch (err) {
      console.error('❌ Transaction failed:', err);
      setLoading(false);
      
      // تسجيل الفشل
      await logTransaction({
        type: 'send',
        to: recipient,
        amount: amount,
        currency: token.symbol,
        networkFee: networkFee,
        serviceFee: networkFee * SERVICE_FEE_PERCENTAGE,
        totalFee: calculateTotalFee(),
        timestamp: new Date().toISOString(),
        status: 'failed',
        error: err.message,
      });
      
      // رسالة الخطأ
      let errorMessage = `${t('send_failed')}: ${err.message}`;
      
      if (err.message.includes('insufficient funds')) {
        errorMessage = t('insufficient_balance_for_transaction');
      } else if (err.message.includes('Invalid private key')) {
        errorMessage = t('invalid_wallet_key');
      } else if (err.message.includes('signature')) {
        errorMessage = 'فشل في توقيع المعاملة. تأكد من صلاحية المفتاح الخاص.';
      } else if (err.message.includes('Blockhash')) {
        errorMessage = 'انتهت صلاحية Blockhash. يرجى إعادة المحاولة.';
      } else if (err.message.includes('network connection')) {
        errorMessage = 'فشل الاتصال بالشبكة. تحقق من اتصال الإنترنت.';
      }
      
      Alert.alert(t('error'), errorMessage);
    }
  };

  // تحديد أقصى مبلغ
  const handleMaxAmount = () => {
    if (balance <= 0) return;
    
    const currentToken = getCurrentToken();
    const totalFee = calculateTotalFee();
    
    if (currentToken.symbol === 'SOL') {
      const rentExemption = recipientExists === false ? RENT_EXEMPTION_AMOUNT : 0;
      const maxAvailable = balance - totalFee - rentExemption;
      const safeMax = Math.max(0, maxAvailable);
      setAmount(safeMax.toFixed(currentToken.decimals || 6));
    } else {
      setAmount(balance.toFixed(currentToken.decimals || 6));
    }
  };

  // لصق العنوان
  const handlePasteAddress = async () => {
    try {
      const text = await Clipboard.getString();
      if (text) {
        setRecipient(text.trim());
      }
    } catch (error) {
      console.warn('Failed to paste:', error);
    }
  };

  // عرض عنصر التوكن
  const renderTokenItem = ({ item }) => {
    const isSelected = currency === item.symbol;
    
    return (
      <TouchableOpacity
        style={[
          styles.tokenItem,
          { 
            backgroundColor: colors.card,
            borderColor: isSelected ? primaryColor : 'transparent',
          }
        ]}
        onPress={() => {
          setCurrency(item.symbol);
          setModalVisible(false);
        }}
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
              {item.name}
            </Text>
            {item.userBalance > 0 && (
              <Text style={[styles.tokenBalance, { color: colors.textSecondary }]}>
                {t('balance')}: {item.userBalance.toFixed(4)}
              </Text>
            )}
          </View>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={24} color={primaryColor} />
          )}
          {!item.hasBalance && !isSelected && (
            <Text style={[styles.noBalanceText, { color: colors.textSecondary }]}>
              {t('no_balance')}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const currentToken = getCurrentToken();
  const totalFee = calculateTotalFee();
  const serviceFee = networkFee * SERVICE_FEE_PERCENTAGE;

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
          
          {/* العنوان */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{t('send')}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('transfer_to_another_wallet')}
            </Text>
          </View>

          {/* بطاقة الرصيد */}
          <View style={[styles.balanceCard, { backgroundColor: colors.card }]}>
            <View style={styles.balanceHeader}>
              <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>
                {t('available_balance')}
              </Text>
              <TouchableOpacity 
                onPress={loadTokens} 
                style={styles.refreshButton}
                disabled={loadingTokens}
              >
                <Ionicons 
                  name="refresh-outline" 
                  size={20} 
                  color={loadingTokens ? colors.textSecondary : primaryColor} 
                />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.balanceAmount, { color: colors.text }]}>
              {balance.toFixed(6)} {currency}
            </Text>
            
            {/* رصيد SOL للرسوم */}
            {currency !== 'SOL' && (
              <View style={styles.solBalanceContainer}>
                <Text style={[styles.solBalanceLabel, { color: colors.textSecondary }]}>
                  {t('your_sol_balance')}:
                </Text>
                <Text style={[styles.solBalanceAmount, { color: solBalance >= totalFee ? colors.success : colors.warning }]}>
                  {solBalance.toFixed(6)} SOL
                </Text>
              </View>
            )}
          </View>

          {/* اختيار التوكن */}
          <TouchableOpacity
            style={[styles.tokenSelector, { backgroundColor: colors.card }]}
            onPress={() => setModalVisible(true)}
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
                    {currentToken.name}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-down" size={24} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          {/* حقل العنوان المستقبل */}
          <View style={styles.inputSection}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              {t('recipient_address')}
            </Text>
            <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={t('enter_recipient_address')}
                placeholderTextColor={colors.textSecondary}
                value={recipient}
                onChangeText={setRecipient}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {recipient ? (
                <TouchableOpacity onPress={() => setRecipient('')}>
                  <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handlePasteAddress}>
                  <Ionicons name="clipboard-outline" size={20} color={primaryColor} />
                </TouchableOpacity>
              )}
            </View>
            
            {/* رسائل التحقق */}
            {recipient && recipientExists === false && currency === 'SOL' && (
              <View style={[styles.recipientWarning, { backgroundColor: colors.warning + '20' }]}>
                <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
                <Text style={[styles.recipientWarningText, { color: colors.warning }]}>
                  ⓘ {t('new_account_warning', { rent: RENT_EXEMPTION_AMOUNT })}
                </Text>
              </View>
            )}
            
            {recipient && recipientExists === false && currency !== 'SOL' && (
              <View style={[styles.recipientWarning, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="information-circle-outline" size={16} color={colors.success} />
                <Text style={[styles.recipientWarningText, { color: colors.success }]}>
                  ⓘ {t('token_account_warning')}
                </Text>
              </View>
            )}
          </View>

          {/* حقل المبلغ */}
          <View style={styles.inputSection}>
            <View style={styles.amountHeader}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                {t('amount')}
              </Text>
              <TouchableOpacity onPress={handleMaxAmount}>
                <Text style={[styles.maxButton, { color: primaryColor }]}>
                  {t('max')}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.text, flex: 1 }]}
                placeholder={t('enter_amount')}
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
              <Text style={[styles.currencyLabel, { color: colors.textSecondary }]}>
                {currency}
              </Text>
            </View>
          </View>

          {/* معلومات الرسوم */}
          <View style={[styles.feeCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.feeCardTitle, { color: colors.text }]}>
              📊 {t('fee_details')}
            </Text>
            
            <View style={styles.feeRow}>
              <View style={styles.feeLabelContainer}>
                <Text style={[styles.feeLabel, { color: colors.textSecondary }]}>
                  {t('network_fee')}
                </Text>
                <Text style={[styles.feeSubLabel, { color: colors.textSecondary }]}>
                  {t('dynamic_based_on_congestion')}
                </Text>
              </View>
              <Text style={[styles.feeValue, { color: colors.text }]}>
                {networkFee.toFixed(6)} SOL
              </Text>
            </View>
            
            <View style={styles.feeRow}>
              <View style={styles.feeLabelContainer}>
                <Text style={[styles.feeLabel, { color: colors.textSecondary }]}>
                  {t('service_fee')}
                </Text>
                <Text style={[styles.feeSubLabel, { color: colors.textSecondary }]}>
                  {t('for_developer_support')}
                </Text>
              </View>
              <Text style={[styles.feeValue, { color: colors.text }]}>
                {serviceFee.toFixed(6)} SOL
              </Text>
            </View>
            
            {/* رسوم الإيجار للحسابات الجديدة */}
            {recipientExists === false && currency === 'SOL' && (
              <View style={styles.feeRow}>
                <View style={styles.feeLabelContainer}>
                  <Text style={[styles.feeLabel, { color: colors.warning }]}>
                    {t('rent_exempt_fee')}
                  </Text>
                  <Text style={[styles.feeSubLabel, { color: colors.warning }]}>
                    {t('for_new_account')}
                  </Text>
                </View>
                <Text style={[styles.feeValue, { color: colors.warning }]}>
                  {RENT_EXEMPTION_AMOUNT.toFixed(6)} SOL
                </Text>
              </View>
            )}
            
            <View style={[styles.totalFeeRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.totalFeeLabel, { color: colors.text }]}>
                {t('total_fees')}
              </Text>
              <Text style={[styles.totalAmount, { color: primaryColor }]}>
                {(
                  totalFee + 
                  (recipientExists === false && currency === 'SOL' ? RENT_EXEMPTION_AMOUNT : 0)
                ).toFixed(6)} SOL
              </Text>
            </View>
            
            {/* ملاحظة */}
            {currency !== 'SOL' && (
              <View style={[styles.feeNote, { backgroundColor: primaryColor + '10' }]}>
                <Ionicons name="information-circle" size={16} color={primaryColor} />
                <Text style={[styles.feeNoteText, { color: primaryColor }]}>
                  ⓘ {t('all_fees_paid_in_sol')}
                </Text>
              </View>
            )}
          </View>

          {/* زر الإرسال */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              { 
                backgroundColor: primaryColor,
                opacity: (!recipient || !amount || loading) ? 0.6 : 1
              }
            ]}
            onPress={handleSend}
            disabled={!recipient || !amount || loading}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={[styles.loadingText, { color: '#FFFFFF', marginLeft: 8 }]}>
                  {t('sending')}
                </Text>
              </View>
            ) : (
              <>
                <Ionicons name="paper-plane-outline" size={20} color="#FFFFFF" />
                <Text style={styles.sendButtonText}>
                  {t('confirm_send')}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* ملاحظات */}
          <View style={[styles.infoNotice, { backgroundColor: primaryColor + '10', borderColor: primaryColor + '30' }]}>
            <Ionicons name="information-circle-outline" size={16} color={primaryColor} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              ⓘ {t('fee_developer_notice')}
            </Text>
          </View>
          
          <View style={styles.securityNotice}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.securityText, { color: colors.textSecondary }]}>
              {t('verify_address_before_sending')}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* نافذة اختيار التوكن */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t('select_token')}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {loadingTokens ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={primaryColor} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  {t('loading_tokens')}
                </Text>
              </View>
            ) : (
              <FlatList
                data={availableTokens}
                keyExtractor={(item) => item.uniqueKey}
                renderItem={renderTokenItem}
                contentContainerStyle={styles.tokenList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// الأنماط (نفسها بدون تغيير)
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
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
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
  recipientWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  recipientWarningText: {
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
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
  feeCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  feeCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  feeLabelContainer: {
    flex: 1,
  },
  feeLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  feeSubLabel: {
    fontSize: 11,
    opacity: 0.7,
    marginTop: 2,
  },
  feeValue: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
  },
  feeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  feeNoteText: {
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
  totalFeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    marginTop: 4,
  },
  totalFeeLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '700',
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
  infoNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
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
  noBalanceText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
