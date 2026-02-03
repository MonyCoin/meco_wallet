import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Image
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { executeRealSwap } from '../services/transactionLogger';
import { getSolBalance, getTokenBalance, getCurrentNetworkFee } from '../services/heliusService';

const { width } = Dimensions.get('window');

// القائمة الأساسية للرموز القابلة للتبادل
const BASE_SWAP_TOKENS = [
  {
    symbol: 'SOL',
    name: 'Solana',
    mint: 'So11111111111111111111111111111111111111112',
    icon: 'diamond-outline',
    decimals: 9,
    image: 'https://assets.coingecko.com/coins/images/4128/large/solana.png'
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    mint: 'Es9vMFrzaCERc8Foa8XfRduKiSfrhEL5c7qr2WXXBWY5',
    icon: 'cash-outline',
    decimals: 6,
    image: 'https://assets.coingecko.com/coins/images/325/large/Tether.png'
  },
  {
    symbol: 'MECO',
    name: 'MECO Token',
    mint: '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i',
    icon: 'rocket-outline',
    decimals: 6,
    image: 'https://raw.githubusercontent.com/saadeh73/meco-project/main/meco-logo.png'
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    icon: 'wallet-outline',
    decimals: 6,
    image: 'https://assets.coingecko.com/coins/images/6319/large/usdc.png'
  },
];

// ✅ سقف أقصى للرسوم
const MAX_NETWORK_FEE = 0.00001; // 0.00001 SOL كحد أقصى

export default function SwapScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const theme = useAppStore(state => state.theme);
  const primaryColor = useAppStore(state => state.primaryColor);
  const isDark = theme === 'dark';

  // الحصول على الرمز المختار من شاشة Market
  const selectedToken = route.params?.selectedToken;

  // إضافة الرمز المختار إلى قائمة التبادل إذا لم يكن موجوداً
  const [swapTokens, setSwapTokens] = useState(() => {
    if (!selectedToken) return BASE_SWAP_TOKENS;

    const existingToken = BASE_SWAP_TOKENS.find(t => t.symbol === selectedToken.symbol);
    if (existingToken) return BASE_SWAP_TOKENS;

    return [
      ...BASE_SWAP_TOKENS,
      {
        symbol: selectedToken.symbol,
        name: selectedToken.name,
        mint: selectedToken.mint,
        icon: 'star-outline',
        decimals: selectedToken.decimals || 6,
        image: selectedToken.image
      }
    ];
  });

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

  const [fromToken, setFromToken] = useState('SOL');
  const [toToken, setToToken] = useState(() => {
    if (selectedToken?.swapAvailable) {
      return selectedToken.symbol;
    }
    return 'MECO';
  });
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [showFromModal, setShowFromModal] = useState(false);
  const [showToModal, setShowToModal] = useState(false);
  const [quote, setQuote] = useState(null);
  const [balances, setBalances] = useState({});
  const [networkFee, setNetworkFee] = useState(0.000005); // ✅ قيمة آمنة بدءية
  const [error, setError] = useState(null);
  const [tokenPrice, setTokenPrice] = useState(null);
  const [realSolPrice, setRealSolPrice] = useState(115);

  // ✅ تحديث رسوم الشبكة مع سقف أقصى
  const updateNetworkFee = async () => {
    try {
      let fee = await getCurrentNetworkFee();
      
      if (fee > MAX_NETWORK_FEE) {
        console.warn(`⚠️ رسوم الشبكة مرتفعة ${fee.toFixed(6)}، تم تحديدها إلى ${MAX_NETWORK_FEE.toFixed(6)} SOL`);
        fee = MAX_NETWORK_FEE;
      }
      
      setNetworkFee(fee);
      console.log(`💰 رسوم الشبكة في Swap: ${fee.toFixed(6)} SOL`);
    } catch (error) {
      console.warn('⚠️ Failed to update network fee, using safe value:', error.message);
      setNetworkFee(0.000005);
    }
  };

  // 🔧 جلب سعر SOL الحقيقي
  useEffect(() => {
    const fetchRealSolPrice = async () => {
      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
          { timeout: 10000 }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.solana && data.solana.usd) {
            setRealSolPrice(data.solana.usd);
          }
        }
      } catch (error) {
        console.warn('⚠️ خطأ في جلب سعر SOL، استخدام القيمة الافتراضية:', realSolPrice);
      }
    };

    fetchRealSolPrice();
    updateNetworkFee();
  }, []);

  // معالجة الرمز المختار عند تحميل الشاشة
  useEffect(() => {
    if (selectedToken) {
      if (selectedToken.price) {
        setTokenPrice(selectedToken.price);
      }

      if (!selectedToken.swapAvailable) {
        Alert.alert(
          t('swap_token_not_available'),
          `${selectedToken.name} ${t('swap_token_not_available_message')}`,
          [{
            text: t('ok'),
            onPress: () => {
              if (!selectedToken.swapAvailable) {
                setToToken('MECO');
              }
            }
          }]
        );
      }
    }
  }, [selectedToken]);

  // ✅ تحميل الأرصدة - نسخة مبسطة وموثوقة
  useEffect(() => {
    loadBalances();
  }, []);

  const loadBalances = async () => {
    try {
      console.log('🔄 جاري تحميل الأرصدة لـ Swap...');
      
      // جلب رصيد SOL
      const solBalance = await getSolBalance();
      const balancesObj = { SOL: solBalance || 0 };
      
      console.log(`✅ رصيد SOL: ${solBalance.toFixed(6)}`);

      // جلب أرصدة التوكنات الأخرى
      for (const token of swapTokens) {
        if (token.symbol !== 'SOL' && token.mint) {
          try {
            const balance = await getTokenBalance(token.mint);
            balancesObj[token.symbol] = balance || 0;
            console.log(`✅ رصيد ${token.symbol}: ${balance}`);
          } catch (error) {
            console.warn(`❌ فشل تحميل رصيد ${token.symbol}:`, error.message);
            balancesObj[token.symbol] = 0;
          }
        }
      }
      
      setBalances(balancesObj);
    } catch (error) {
      console.error('❌ Load balances error:', error);
      setBalances({ SOL: 0 });
    }
  };

  // الحصول على معلومات الرمز
  const getTokenInfo = (symbol) => {
    return swapTokens.find(t => t.symbol === symbol) || swapTokens[0];
  };

  // تحديث السعر عند تغيير المدخلات
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (fromAmount && parseFloat(fromAmount) > 0) {
        updateQuote();
      } else {
        setToAmount('');
        setQuote(null);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [fromToken, toToken, fromAmount]);

  // ✅ دالة Jupiter API - نسخة مبسطة وموثوقة
  const getJupiterQuote = async (inputTokenSymbol, outputTokenSymbol, amount) => {
    try {
      const inputTokenInfo = getTokenInfo(inputTokenSymbol);
      const outputTokenInfo = getTokenInfo(outputTokenSymbol);

      if (!inputTokenInfo || !outputTokenInfo) {
        throw new Error(t('swap_invalid_token_selection'));
      }

      // إذا كان أحد الرموز لا يحتوي على mint
      if (!inputTokenInfo.mint || !outputTokenInfo.mint) {
        throw new Error(t('swap_token_unavailable_solana'));
      }

      const amountInSmallestUnit = Math.floor(amount * Math.pow(10, inputTokenInfo.decimals));

      // ✅ إصلاح: استخدام URL صحيح مع وقت انتظار مناسب
      const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputTokenInfo.mint}&outputMint=${outputTokenInfo.mint}&amount=${amountInSmallestUnit}&slippageBps=50`;

      console.log('🔄 طلب السعر من Jupiter:', {
        input: inputTokenSymbol,
        output: outputTokenSymbol,
        amount: amount,
        url: url
      });

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`${t('swap_network_error')}: ${response.status}`);
      }

      const data = await response.json();

      if (!data || data.error || !data.outAmount) {
        throw new Error(t('swap_invalid_quote_response'));
      }

      const outputAmount = Number(data.outAmount) / Math.pow(10, outputTokenInfo.decimals);
      const rate = outputAmount / amount;

      console.log('✅ حصلنا على سعر من Jupiter:', {
        input: amount,
        output: outputAmount,
        rate: rate
      });

      return {
        inputAmount: amount,
        outputAmount,
        rate,
        priceImpact: data.priceImpactPct || '0',
        swapMode: data.swapMode || 'fixed',
        quoteId: data.quoteId,
        inAmount: data.inAmount,
        outAmount: data.outAmount,
      };
    } catch (error) {
      console.warn('⚠️ Jupiter quote error, using fallback:', error.message);
      
      // ✅ استخدام سعر افتراضي بسيط
      const tokenPrices = {
        'SOL': realSolPrice,
        'USDT': 1.00,
        'USDC': 1.00,
        'MECO': 0.09,
      };

      const fromPrice = tokenPrices[inputTokenSymbol] || 1;
      const toPrice = tokenPrices[outputTokenSymbol] || 1;
      const realRate = fromPrice / toPrice;
      const outputAmount = amount * realRate;

      return {
        inputAmount: amount,
        outputAmount: outputAmount,
        rate: realRate,
        priceImpact: '0.5',
        swapMode: 'fixed',
        isFallback: true
      };
    }
  };

  const updateQuote = async () => {
    try {
      const amount = parseFloat(fromAmount);
      if (!amount || amount <= 0) {
        setQuote(null);
        return;
      }

      // ✅ التحقق من الرصيد بطريقة مبسطة
      const balance = balances[fromToken] || 0;
      if (amount > balance) {
        setError(t('swap_insufficient_balance'));
        setQuote(null);
        setToAmount('');
        return;
      }

      setLoadingQuote(true);
      setError(null);

      const quoteData = await getJupiterQuote(fromToken, toToken, amount);

      if (quoteData) {
        setQuote(quoteData);
        setToAmount(quoteData.outputAmount.toFixed(6));
      } else {
        setToAmount('');
        setQuote(null);
      }
    } catch (error) {
      console.error('Quote error:', error);
      setError(`${t('swap_failed_to_get_price')}: ${error.message}`);
      setQuote(null);
      setToAmount('');
    } finally {
      setLoadingQuote(false);
    }
  };

  const handleSwapTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount || '');
    setQuote(null);
    setError(null);
  };

  // ✅ تحديد أقصى مبلغ - نسخة مصححة
  const handleMaxAmount = () => {
    const balance = balances[fromToken] || 0;
    let maxAmount = balance;
    
    // إذا كان الرمز المرسل هو SOL، نخصم الرسوم
    if (fromToken === 'SOL') {
      const fee = networkFee * 1.1; // ✅ الرسوم الكلية (شبكة + خدمة)
      maxAmount = Math.max(0, balance - fee - (balance * 0.001)); // هامش أمان صغير
    }
    
    setFromAmount(maxAmount.toFixed(6));
    console.log(`💰 الحد الأقصى لـ ${fromToken}: ${balance} - الرسوم = ${maxAmount}`);
  };

  // ✅ معالجة التبادل - نسخة مصححة ومضمونة
  const handleSwap = async () => {
    try {
      if (!fromAmount || !toAmount) {
        Alert.alert(t('error'), t('swap_enter_amount'));
        return;
      }

      const amount = parseFloat(fromAmount);
      if (amount <= 0) {
        Alert.alert(t('error'), t('swap_amount_must_be_positive'));
        return;
      }

      // ✅ التحقق البسيط من الرصيد
      const balance = balances[fromToken] || 0;
      if (amount > balance) {
        Alert.alert(
          t('error'),
          `${t('swap_insufficient_balance_for')} ${fromToken}\n\n` +
          `${t('swap_available')}: ${balance.toFixed(6)} ${fromToken}\n` +
          `${t('swap_enter_amount')}: ${amount.toFixed(6)} ${fromToken}`
        );
        return;
      }

      // ✅ إذا كان الرمز المرسل هو SOL، تحقق من الرصيد للرسوم
      if (fromToken === 'SOL') {
        const totalFee = networkFee * 1.1;
        const totalRequired = amount + totalFee;
        
        if (totalRequired > balance) {
          Alert.alert(
            t('error'),
            `${t('swap_insufficient_balance')}\n\n` +
            `${t('swap_balance')}: ${balance.toFixed(6)} SOL\n` +
            `${t('swap_enter_amount')}: ${amount.toFixed(6)} SOL\n` +
            `${t('swap_network_fee')}: ${totalFee.toFixed(6)} SOL\n` +
            `\n${t('swap_available')}: ${totalRequired.toFixed(6)} SOL`
          );
          return;
        }
      }

      // ✅ التحقق من توفر الرمز للتبادل
      const toTokenInfo = getTokenInfo(toToken);
      if (!toTokenInfo.mint) {
        Alert.alert(t('error'), `${toToken} ${t('swap_token_unavailable_solana')}`);
        return;
      }

      setLoading(true);
      setError(null);

      const walletPublicKey = await SecureStore.getItemAsync('wallet_public_key');
      if (!walletPublicKey) {
        throw new Error(t('swap_wallet_not_found'));
      }

      // ✅ تنفيذ التبادل الفعلي
      const swapResult = await executeRealSwap({
        fromToken,
        toToken,
        fromAmount: amount,
        quote,
        walletPublicKey,
        networkFee, // ✅ إرسال قيمة networkFee الحقيقية
      });

      if (swapResult.success) {
        Alert.alert(
          `✅ ${t('swap_successful')}`,
          `${t('swap_success_message', { 
            amount: amount, 
            fromToken: fromToken, 
            outputAmount: swapResult.outputAmount?.toFixed(6) || toAmount, 
            toToken: toToken 
          })}\n\n` +
          `${t('swap_network_fee')}: ${networkFee.toFixed(6)} SOL`,
          [
            {
              text: t('swap_view_transaction'),
              style: 'default',
              onPress: () => {
                if (swapResult.explorerUrl) {
                  Linking.openURL(swapResult.explorerUrl);
                }
              }
            },
            {
              text: t('ok'),
              style: 'cancel',
              onPress: () => {
                setFromAmount('');
                setToAmount('');
                setQuote(null);
                loadBalances();
                setLoading(false);
                navigation.navigate('Market');
              }
            }
          ]
        );
      } else {
        throw new Error(swapResult.error || t('swap_failed'));
      }

    } catch (error) {
      console.error('❌ Swap error:', error);
      setError(error.message || t('swap_failed_try_again'));
      Alert.alert(
        `❌ ${t('swap_failed')}`,
        error.message || t('swap_could_not_complete'),
        [{ text: t('ok') }]
      );
      setLoading(false);
    }
  };

  const renderTokenItem = (token, isFrom, index) => {
    const tokenInfo = getTokenInfo(token.symbol);
    return (
      <TouchableOpacity
        key={`${token.symbol}-${index}-${isFrom ? 'from' : 'to'}`}
        style={[styles.tokenItem, {
          backgroundColor: colors.card,
          opacity: tokenInfo.mint ? 1 : 0.6
        }]}
        onPress={() => {
          if (!tokenInfo.mint && token.symbol !== 'SOL') {
            Alert.alert(t('swap_unavailable'), t('swap_token_unavailable_solana'));
            return;
          }

          isFrom ? setShowFromModal(false) : setShowToModal(false);
          if (isFrom) {
            setFromToken(token.symbol);
          } else {
            setToToken(token.symbol);
          }
          setError(null);
        }}
      >
        <View style={styles.tokenItemContent}>
          <View style={styles.tokenIconContainer}>
            {token.image ? (
              <Image
                source={{ uri: token.image }}
                style={styles.tokenImage}
                defaultSource={{ uri: 'https://via.placeholder.com/40' }}
              />
            ) : (
              <View style={[styles.tokenIcon, { backgroundColor: primaryColor + '20' }]}>
                <Ionicons name={token.icon} size={24} color={primaryColor} />
              </View>
            )}
          </View>
          <View style={styles.tokenDetails}>
            <View style={styles.tokenHeader}>
              <Text style={[styles.tokenSymbol, { color: colors.text }]}>{token.symbol}</Text>
              {!tokenInfo.mint && token.symbol !== 'SOL' && (
                <View style={[styles.notAvailableBadge, { backgroundColor: colors.warning + '20' }]}>
                  <Text style={[styles.notAvailableText, { color: colors.warning }]}>
                    {t('swap_not_available')}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.tokenName, { color: colors.textSecondary }]} numberOfLines={1}>
              {token.name}
            </Text>
          </View>
          <View style={styles.tokenBalanceContainer}>
            <Text style={[styles.tokenBalance, { color: colors.textSecondary }]}>
              {(balances[token.symbol] || 0).toFixed(4)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // الحصول على صورة الرمز المختار
  const getSelectedTokenImage = () => {
    const token = swapTokens.find(t => t.symbol === toToken);
    return token?.image;
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>

          {/* الهيدر مع زر العودة */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={[styles.title, { color: colors.text }]}>{t('swap_title')}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {selectedToken ? `${t('swap_to')} ${selectedToken.name}` : t('swap_subtitle')}
              </Text>
            </View>
          </View>

          {/* رسالة الخطأ */}
          {error && (
            <View style={[styles.errorCard, { backgroundColor: colors.error + '20' }]}>
              <Ionicons name="alert-circle" size={20} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          )}

          {/* بطاقة التبادل */}
          <View style={[styles.swapCard, { backgroundColor: colors.card }]}>

            {/* من قسم */}
            <View style={styles.swapSection}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                {t('swap_pay')}
              </Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.tokenSelector}
                  onPress={() => setShowFromModal(true)}
                >
                  <View style={[styles.selectedTokenBadge, { backgroundColor: primaryColor }]}>
                    <Text style={styles.selectedTokenText}>{fromToken}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={20} color={colors.text} />
                </TouchableOpacity>
                <TextInput
                  style={[styles.amountInput, { color: colors.text }]}
                  placeholder="0.0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                  value={fromAmount}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    const parts = cleaned.split('.');
                    if (parts.length > 2) return;
                    if (parts[1] && parts[1].length > 6) return;
                    setFromAmount(cleaned);
                  }}
                  editable={!loading}
                />
                <TouchableOpacity onPress={handleMaxAmount}>
                  <Text style={[styles.maxButton, { color: primaryColor }]}>{t('swap_max')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.balanceRow}>
                <Text style={[styles.balanceText, { color: colors.textSecondary }]}>
                  {t('swap_balance')}: {(balances[fromToken] || 0).toFixed(4)} {fromToken}
                </Text>
                {fromToken === 'SOL' && (
                  <Text style={[styles.feeText, { color: colors.warning }]}>
                    ({t('swap_network_fee')}: {(networkFee * 1.1).toFixed(6)} SOL)
                  </Text>
                )}
              </View>
            </View>

            {/* زر تبديل الرموز */}
            <TouchableOpacity
              style={[styles.swapButton, { backgroundColor: primaryColor }]}
              onPress={handleSwapTokens}
              disabled={loading}
            >
              <Ionicons name="swap-vertical" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            {/* إلى قسم */}
            <View style={styles.swapSection}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                {t('swap_receive')}
              </Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.tokenSelector}
                  onPress={() => setShowToModal(true)}
                  disabled={loading}
                >
                  <View style={styles.selectedTokenInfo}>
                    {getSelectedTokenImage() && (
                      <Image
                        source={{ uri: getSelectedTokenImage() }}
                        style={styles.selectedTokenImage}
                      />
                    )}
                    <View style={[styles.selectedTokenBadge, { backgroundColor: primaryColor }]}>
                      <Text style={styles.selectedTokenText}>{toToken}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-down" size={20} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.amountContainer}>
                  {loadingQuote ? (
                    <ActivityIndicator size="small" color={primaryColor} />
                  ) : (
                    <Text style={[styles.amountText, { color: colors.text }]}>
                      {toAmount || '0.0'}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.balanceRow}>
                <Text style={[styles.balanceText, { color: colors.textSecondary }]}>
                  {t('swap_balance')}: {(balances[toToken] || 0).toFixed(4)} {toToken}
                </Text>
                {selectedToken?.price && toToken === selectedToken.symbol && (
                  <Text style={[styles.priceText, { color: colors.success }]}>
                    ${selectedToken.price.toFixed(2)}
                  </Text>
                )}
              </View>
            </View>

            {/* معلومات السعر */}
            {quote && (
              <View style={[styles.quoteCard, { backgroundColor: primaryColor + '10' }]}>
                <View style={styles.quoteRow}>
                  <Text style={[styles.quoteLabel, { color: colors.textSecondary }]}>{t('swap_price')}</Text>
                  <Text style={[styles.quoteValue, { color: colors.text }]}>
                    1 {fromToken} = {quote.rate.toFixed(6)} {toToken}
                  </Text>
                </View>
                
                <View style={styles.quoteRow}>
                  <Text style={[styles.quoteLabel, { color: colors.textSecondary }]}>{t('swap_network_fee')}</Text>
                  <Text style={[styles.quoteValue, { color: colors.text }]}>
                    {(networkFee * 1.1).toFixed(6)} SOL
                  </Text>
                </View>
                {quote.isFallback && (
                  <View style={styles.quoteRow}>
                    <Text style={[styles.quoteLabel, { color: colors.warning }]}>{t('swap_note')}</Text>
                    <Text style={[styles.quoteValue, { color: colors.warning }]}>
                      {t('swap_using_market_price')}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* زر التبادل */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: primaryColor,
                  opacity: (!fromAmount || !toAmount || loading || loadingQuote) ? 0.5 : 1
                }
              ]}
              onPress={handleSwap}
              disabled={!fromAmount || !toAmount || loading || loadingQuote}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="swap-horizontal" size={20} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>
                    {loadingQuote ? t('swap_getting_price') : t('swap_now')}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* ملاحظة معلومات */}
            <View style={[styles.infoNotice, { backgroundColor: primaryColor + '10', borderColor: primaryColor + '30' }]}>
              <Ionicons name="information-circle-outline" size={16} color={primaryColor} />
              <Text style={[styles.infoText, { color: colors.text }]}>
                ⓘ {t('swap_info_note')}
              </Text>
            </View>

          </View>

          {/* تعليمات الأمان */}
          <View style={[styles.securityCard, { backgroundColor: colors.card }]}>
            <Ionicons name="shield-checkmark" size={24} color={colors.success} />
            <View style={styles.securityContent}>
              <Text style={[styles.securityTitle, { color: colors.text }]}>
                {t('swap_security_title')}
              </Text>
              <Text style={[styles.securityText, { color: colors.textSecondary }]}>
                • {t('swap_security_point1')}
                {'\n'}• {t('swap_security_point2')}
                {'\n'}• {t('swap_security_point3')}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* مودال اختيار الرمز للدفع */}
      <Modal visible={showFromModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('swap_select_token_pay')}</Text>
              <TouchableOpacity onPress={() => setShowFromModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {swapTokens.filter(token => token.mint || token.symbol === 'SOL').map((token, index) =>
                renderTokenItem(token, true, index)
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* مودال اختيار الرمز للاستلام */}
      <Modal visible={showToModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('swap_select_token_receive')}</Text>
              <TouchableOpacity onPress={() => setShowToModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {swapTokens.filter(token => token.mint || token.symbol === 'SOL').map((token, index) =>
                renderTokenItem(token, false, index)
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
  swapCard: {
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  swapSection: {
    marginBottom: 20,
  },
  sectionLabel: {
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
    paddingVertical: 8,
    minHeight: 60,
  },
  tokenSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  selectedTokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedTokenImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  selectedTokenBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  selectedTokenText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: 12,
    textAlign: 'center',
  },
  amountContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  amountText: {
    fontSize: 18,
    fontWeight: '600',
  },
  maxButton: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  balanceText: {
    fontSize: 12,
  },
  feeText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  priceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  swapButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  quoteCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quoteLabel: {
    fontSize: 14,
  },
  quoteValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 18,
    marginBottom: 16,
  },
  actionButtonText: {
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
  },
  infoText: {
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
    textAlign: 'center',
  },
  securityCard: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
  },
  securityContent: {
    flex: 1,
    marginLeft: 12,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  securityText: {
    fontSize: 12,
    lineHeight: 18,
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
  tokenItem: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  tokenItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tokenIconContainer: {
    marginRight: 12,
  },
  tokenIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  tokenDetails: {
    flex: 1,
  },
  tokenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  notAvailableBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  notAvailableText: {
    fontSize: 10,
    fontWeight: '600',
  },
  tokenName: {
    fontSize: 12,
  },
  tokenBalanceContainer: {
    alignItems: 'flex-end',
  },
  tokenBalance: {
    fontSize: 12,
  },
});
