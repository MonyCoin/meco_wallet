import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
  RefreshControl,
  Linking,
} from 'react-native';

import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store';
import { useRoute } from '@react-navigation/native';

import {
  fetchQuoteViaRest,
  executeSwapViaRest,
  amountToBaseUnits,
  baseUnitsToAmount,
  getJupiterTokens,
} from '../services/jupiterService';

const RPC = 'https://rpc.ankr.com/solana';

export default function SwapScreen() {
  const { t } = useTranslation();
  const route = useRoute();

  const theme = useAppStore(s => s.theme);
  const primaryColor = useAppStore(s => s.primaryColor);
  const publicKey = useAppStore(s => s.publicKey);
  const walletBalances = useAppStore(s => s.balances);

  const isDark = theme === 'dark';
  const bg = isDark ? '#121212' : '#F9F9F9';
  const fg = isDark ? '#FFF' : '#111';
  const selBg = isDark ? '#1E1E1E' : '#EEEEEE';

  const [tokens, setTokens] = useState([]);
  const [filteredTokens, setFilteredTokens] = useState([]);
  const [tokenPrices, setTokenPrices] = useState({});

  const [fromToken, setFromToken] = useState(null);
  const [toToken, setToToken] = useState(null);

  const [amount, setAmount] = useState('');
  const [expectedAmount, setExpectedAmount] = useState(null);
  const [swapQuote, setSwapQuote] = useState(null);
  const [swapFee, setSwapFee] = useState(0);
  const [priceImpact, setPriceImpact] = useState(0);
  const [slippage, setSlippage] = useState(0.5);
  const [quoteExpiry, setQuoteExpiry] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(0);
  const [minimumReceived, setMinimumReceived] = useState(0);

  const [loadingQuote, setLoadingQuote] = useState(false);
  const [loadingSwap, setLoadingSwap] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [selecting, setSelecting] = useState('from');
  const [searchText, setSearchText] = useState('');

  const quoteTimeoutRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    loadTokens();
    
    return () => {
      mountedRef.current = false;
      if (quoteTimeoutRef.current) clearTimeout(quoteTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (quoteTimeoutRef.current) {
      clearTimeout(quoteTimeoutRef.current);
    }

    if (fromToken && toToken && amount && Number(amount) > 0) {
      quoteTimeoutRef.current = setTimeout(() => {
        updateExpectedAmount();
      }, 800);
    } else {
      setExpectedAmount(null);
      setSwapQuote(null);
      setExchangeRate(0);
      setPriceImpact(0);
      setMinimumReceived(0);
    }
  }, [fromToken, toToken, amount, slippage]);

  const loadTokens = async () => {
    try {
      const list = await getJupiterTokens();
      
      if (!mountedRef.current) return;
      
      // تصفية العملات المشهورة أولاً
      const popularTokens = ['SOL', 'USDC', 'USDT', 'BONK', 'JUP', 'RAY', 'WSOL'];
      const sortedList = list.sort((a, b) => {
        const aPopular = popularTokens.includes(a.symbol);
        const bPopular = popularTokens.includes(b.symbol);
        if (aPopular && !bPopular) return -1;
        if (!aPopular && bPopular) return 1;
        if (a.symbol === 'SOL') return -1;
        if (b.symbol === 'SOL') return 1;
        return a.symbol.localeCompare(b.symbol);
      });

      setTokens(sortedList);
      setFilteredTokens(sortedList);

      if (route.params?.fromToken) {
        setFromToken(route.params.fromToken);
      } else {
        const solToken = sortedList.find(t => t.symbol === 'SOL');
        if (solToken) {
          setFromToken(solToken.address);
          const usdcToken = sortedList.find(t => t.symbol === 'USDC');
          if (usdcToken) {
            setToToken(usdcToken.address);
          }
        }
      }
    } catch (error) {
      console.error('Error loading tokens:', error);
      Alert.alert('⚠️', 'تعذر جلب العملات، تحقق من اتصالك بالإنترنت');
    }
  };

  const getToken = address =>
    tokens.find(t => t.address === address);

  const getTokenBalance = useCallback((tokenAddress) => {
    if (!publicKey || !tokenAddress) return 0;
    const token = getToken(tokenAddress);
    const balance = walletBalances?.[tokenAddress] || 0;
    return balance / Math.pow(10, token?.decimals || 9);
  }, [publicKey, walletBalances, tokens]);

  const updateExpectedAmount = async () => {
    try {
      if (!fromToken || !toToken || !amount || Number(amount) <= 0) {
        setExpectedAmount(null);
        setSwapQuote(null);
        setExchangeRate(0);
        setPriceImpact(0);
        setMinimumReceived(0);
        return;
      }

      setLoadingQuote(true);
      setSwapQuote(null);
      setExchangeRate(0);
      setPriceImpact(0);
      setMinimumReceived(0);

      const from = getToken(fromToken);
      const to = getToken(toToken);
      
      if (!from || !to) {
        setLoadingQuote(false);
        return;
      }

      const baseAmount = amountToBaseUnits(Number(amount), from.decimals);
      
      if (baseAmount <= 0) {
        setLoadingQuote(false);
        return;
      }

      const slippageBps = Math.floor(slippage * 100);
      
      console.log('🔄 جاري جلب السعر من Jupiter...', {
        from: from.symbol,
        to: to.symbol,
        amount: amount,
        baseAmount: baseAmount,
        slippage: slippage
      });

      const quote = await fetchQuoteViaRest(
        fromToken,
        toToken,
        baseAmount,
        slippageBps
      );

      if (!quote || !quote.outAmount || Number(quote.outAmount) <= 0) {
        throw new Error('لا يوجد سيولة كافية لهذه العملية');
      }

      const out = baseUnitsToAmount(Number(quote.outAmount), to.decimals);
      const fee = quote.feeAmount ? baseUnitsToAmount(Number(quote.feeAmount), from.decimals) : 0;
      
      // حساب معدل التحويل
      const rate = out / Number(amount);
      setExchangeRate(rate);

      // حساب الحد الأدنى المستلم بناء على slippage
      const minReceived = out * (1 - (slippage / 100));
      setMinimumReceived(minReceived);

      // حساب تأثير السعر من data الحقيقية من API
      if (quote.priceImpactPct) {
        const impact = Math.abs(Number(quote.priceImpactPct) * 100);
        setPriceImpact(impact);
      } else if (quote.otherAmountThreshold) {
        // حساب تقريبي لتأثير السعر
        const otherAmount = baseUnitsToAmount(Number(quote.otherAmountThreshold), to.decimals);
        const impact = Math.abs((1 - (otherAmount / out)) * 100);
        setPriceImpact(impact);
      }

      setExpectedAmount(out);
      setSwapFee(fee);
      setSwapQuote(quote);
      setQuoteExpiry(new Date(Date.now() + 30000)); // 30 ثانية صلاحية
      
      console.log('✅ تم الحصول على السعر الحقيقي:', {
        from: from.symbol,
        to: to.symbol,
        amount: amount,
        expected: out,
        rate: rate,
        fee: fee,
        priceImpact: priceImpact,
        minReceived: minReceived
      });
      
    } catch (error) {
      console.error('❌ خطأ في جلب السعر الحقيقي:', error.message || error);
      
      // إعادة تعيين القيم
      setExpectedAmount(null);
      setSwapQuote(null);
      setExchangeRate(0);
      setPriceImpact(0);
      setMinimumReceived(0);
      
      // عرض رسالة خطأ مناسبة
      let errorMessage = 'تعذر حساب السعر';
      
      if (error.message && error.message.includes('liquidity')) {
        errorMessage = 'لا يوجد سيولة كافية لهذه العملية، جرب مبلغًا أصغر أو عملة أخرى';
      } else if (error.message && error.message.includes('network')) {
        errorMessage = 'خطأ في الاتصال بالشبكة، تحقق من اتصالك بالإنترنت';
      } else if (error.message && error.message.includes('amount')) {
        errorMessage = 'المبلغ المدخل غير صالح';
      } else if (error.message && error.message.includes('Quote not found')) {
        errorMessage = 'لم يتم العثور على سعر لهذه العملة، جرب عملة أخرى';
      } else {
        errorMessage = `خطأ في السعر: ${error.message || 'غير معروف'}`;
      }
      
      if (mountedRef.current) {
        Alert.alert('⚠️', errorMessage);
      }
      
    } finally {
      if (mountedRef.current) {
        setLoadingQuote(false);
      }
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadTokens();
      if (fromToken && toToken && Number(amount) > 0) {
        await updateExpectedAmount();
      }
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [fromToken, toToken, amount]);

  const signAndSend = async (txBuffer) => {
    try {
      const web3 = await import('@solana/web3.js');
      const secret = await SecureStore.getItemAsync('wallet_private_key');
      if (!secret) {
        throw new Error('لا يوجد مفتاح خاص');
      }
      
      const keypair = web3.Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(secret))
      );
      
      const connection = new web3.Connection(RPC, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
      });
      
      const transaction = web3.Transaction.from(txBuffer);
      transaction.partialSign(keypair);
      
      const signature = await connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        }
      );
      
      const confirmation = await connection.confirmTransaction({
        signature: signature,
        blockhash: transaction.recentBlockhash,
        lastValidBlockHeight: transaction.lastValidBlockHeight,
      });
      
      if (confirmation.value.err) {
        throw new Error(`فشل المعاملة: ${confirmation.value.err.toString()}`);
      }
      
      return signature;
    } catch (error) {
      console.error('❌ خطأ في signAndSend:', error);
      throw error;
    }
  };

  const handleSwap = async () => {
    try {
      if (!fromToken || !toToken || !amount || Number(amount) <= 0) {
        Alert.alert('خطأ', 'أكمل جميع الحقول بشكل صحيح');
        return;
      }

      const from = getToken(fromToken);
      if (!from) {
        Alert.alert('خطأ', 'العملة المصدر غير صالحة');
        return;
      }

      // التحقق من الرصيد
      const balance = getTokenBalance(fromToken);
      if (Number(amount) > balance) {
        Alert.alert('رصيد غير كافي', `رصيدك: ${balance.toFixed(4)} ${from.symbol}`);
        return;
      }

      // التحقق من صلاحية الاقتباس
      if (quoteExpiry && new Date() > quoteExpiry) {
        Alert.alert('⚠️ السعر منتهي', 'انتهت صلاحية السعر، جاري تحديثه...', [
          {
            text: 'تحديث',
            onPress: async () => {
              await updateExpectedAmount();
              setTimeout(() => {
                if (expectedAmount) {
                  setConfirmModal(true);
                }
              }, 1000);
            }
          },
          { text: 'إلغاء', style: 'cancel' }
        ]);
        return;
      }

      if (!swapQuote || !expectedAmount) {
        Alert.alert('خطأ', 'يجب حساب السعر أولاً');
        return;
      }

      setConfirmModal(true);
      
    } catch (error) {
      console.error('Swap error:', error);
      Alert.alert('خطأ', error.message || 'حدث خطأ غير متوقع');
    }
  };

  const executeConfirmedSwap = async () => {
    setConfirmModal(false);
    setLoadingSwap(true);
    
    try {
      const from = getToken(fromToken);
      const baseAmount = amountToBaseUnits(Number(amount), from.decimals);
      const slippageBps = Math.floor(slippage * 100);
      
      console.log('🔄 جاري إعادة حساب السعر قبل التنفيذ...');
      const freshQuote = await fetchQuoteViaRest(
        fromToken,
        toToken,
        baseAmount,
        slippageBps
      );

      if (!freshQuote || !freshQuote.outAmount) {
        throw new Error('فشل في الحصول على سعر جديد للمعاملات');
      }

      const currentTime = new Date();
      console.log('🕒 وقت التنفيذ:', currentTime.toLocaleTimeString());

      const res = await executeSwapViaRest(freshQuote, publicKey, signAndSend);

      if (!res.success) {
        throw new Error(res.error || 'فشل تنفيذ المبادلة');
      }

      console.log('✅ تم تنفيذ المبادلة بنجاح، المعاملة:', res.txid);
      
      // عرض تفاصيل المعاملة
      showTransactionDetails(res.txid);
      
      // إعادة تعيين الحقول
      setAmount('');
      setExpectedAmount(null);
      setSwapQuote(null);
      setExchangeRate(0);
      setPriceImpact(0);
      setMinimumReceived(0);
      
      // تحديث الأرصدة بعد 3 ثواني
      setTimeout(() => {
        Alert.alert('✅', 'تمت المبادلة بنجاح! سيتم تحديث رصيدك قريبًا.');
      }, 3000);
      
    } catch (error) {
      console.error('❌ Execute swap error:', error);
      
      let errorMessage = error.message;
      if (errorMessage.includes('0x0')) {
        errorMessage = 'فشل المعاملة: رصيد غير كافي أو رسوم معالجة';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'انتهت مهلة المعاملة، جرب مرة أخرى';
      } else if (errorMessage.includes('slippage')) {
        errorMessage = 'تغير السعر كثيراً، جرب مع slippage أعلى';
      } else if (errorMessage.includes('Blockhash')) {
        errorMessage = 'انتهت صلاحية blockhash، جرب مرة أخرى';
      }
      
      Alert.alert('❌ فشل التنفيذ', errorMessage);
    } finally {
      setLoadingSwap(false);
    }
  };

  const showTransactionDetails = (txid) => {
    const from = getToken(fromToken);
    const to = getToken(toToken);
    
    Alert.alert(
      '✅ تم تنفيذ المبادلة بنجاح',
      `المعاملة: ${txid.substring(0, 20)}...\n\n` +
      `التحويل: ${Number(amount).toFixed(4)} ${from?.symbol} → ${expectedAmount?.toFixed(4)} ${to?.symbol}\n` +
      `السعر: 1 ${from?.symbol} = ${exchangeRate.toFixed(6)} ${to?.symbol}\n` +
      `تأثير السعر: ${priceImpact.toFixed(2)}%\n` +
      `الحد الأدنى: ${minimumReceived.toFixed(4)} ${to?.symbol}\n` +
      `Slippage: ${slippage}%`,
      [
        { 
          text: 'مشاهدة المعاملة', 
          onPress: () => {
            Linking.openURL(`https://solscan.io/tx/${txid}`);
          }
        },
        { text: 'تم', style: 'cancel' }
      ]
    );
  };

  const swapTokens = () => {
    if (!fromToken || !toToken) return;
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setAmount('');
    setExpectedAmount(null);
    setSwapQuote(null);
    setExchangeRate(0);
    setPriceImpact(0);
    setMinimumReceived(0);
  };

  const setMaxAmount = () => {
    if (!fromToken) return;
    const balance = getTokenBalance(fromToken);
    const token = getToken(fromToken);
    
    let maxAmount = balance;
    if (token?.symbol === 'SOL') {
      // ترك 0.001 SOL للرسوم
      maxAmount = Math.max(0, balance - 0.001);
    }
    
    if (maxAmount > 0) {
      setAmount(maxAmount.toFixed(token?.decimals > 6 ? 6 : token?.decimals));
    }
  };

  const openSelector = target => {
    setSelecting(target);
    setSearchText('');
    setFilteredTokens(tokens);
    setModalVisible(true);
  };

  const selectToken = address => {
    if (selecting === 'from') {
      setFromToken(address);
    } else {
      setToToken(address);
    }
    setModalVisible(false);
  };

  const formatNumber = (num, decimals = 6) => {
    if (num === null || num === undefined || isNaN(num)) return '0';
    const number = Number(num);
    
    if (number === 0) return '0';
    
    if (number < 0.000001) {
      return number.toExponential(4);
    }
    
    if (number < 1) {
      return number.toFixed(Math.min(decimals, 6));
    }
    
    if (number < 1000) {
      return number.toFixed(Math.min(decimals, 4));
    }
    
    return number.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  const getPriceImpactColor = () => {
    if (priceImpact < 0.5) return '#4CAF50';
    if (priceImpact < 2) return '#FF9800';
    return '#F44336';
  };

  // حساب القيمة بالدولار (تقريبي)
  const calculateUSDValue = (amount, tokenAddress) => {
    // هذا تقدير تقريبي - في التطبيق الحقيقي ستجلب الأسعار من API
    const token = getToken(tokenAddress);
    if (!token) return 0;
    
    // أسعار تقريبية للعملات المشهورة
    const priceMap = {
      'SOL': 180,
      'USDC': 1,
      'USDT': 1,
      'BONK': 0.00002,
      'JUP': 0.8,
      'RAY': 1.5,
    };
    
    const price = priceMap[token.symbol] || 0;
    return Number(amount) * price;
  };

  return (
    <ScrollView 
      style={{ backgroundColor: bg, flex: 1 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[primaryColor]}
          tintColor={primaryColor}
        />
      }
    >
      <View style={styles.container}>
        {/* From Token Section */}
        <View style={styles.tokenSection}>
          <View style={styles.tokenHeader}>
            <Text style={[styles.sectionLabel, { color: fg }]}>من</Text>
            {fromToken && (
              <TouchableOpacity onPress={setMaxAmount}>
                <Text style={[styles.balanceText, { color: primaryColor }]}>
                  الرصيد: {formatNumber(getTokenBalance(fromToken))}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.tokenInputContainer}>
            <TouchableOpacity
              style={[styles.tokenSelector, { backgroundColor: selBg }]}
              onPress={() => openSelector('from')}
            >
              {fromToken ? (
                <>
                  <Image 
                    source={{ uri: getToken(fromToken)?.logoURI }} 
                    style={styles.tokenIcon} 
                  />
                  <Text style={[styles.tokenSymbol, { color: fg }]}>
                    {getToken(fromToken)?.symbol}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={fg} />
                </>
              ) : (
                <Text style={[styles.tokenSymbol, { color: fg }]}>
                  اختر عملة
                </Text>
              )}
            </TouchableOpacity>
            
            <View style={styles.amountContainer}>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0.0"
                placeholderTextColor={isDark ? '#666' : '#999'}
                keyboardType="decimal-pad"
                style={[styles.amountInput, { color: fg }]}
                editable={!!fromToken}
              />
              
              {fromToken && (
                <TouchableOpacity 
                  style={styles.maxButton}
                  onPress={setMaxAmount}
                >
                  <Text style={[styles.maxButtonText, { color: primaryColor }]}>
                    MAX
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          {fromToken && Number(amount) > 0 && (
            <Text style={[styles.usdValue, { color: isDark ? '#AAA' : '#666' }]}>
              ≈ ${formatNumber(calculateUSDValue(amount, fromToken), 2)}
            </Text>
          )}
        </View>

        {/* Swap Button */}
        <TouchableOpacity 
          style={[styles.swapButton, { backgroundColor: selBg }]}
          onPress={swapTokens}
          disabled={!fromToken || !toToken}
        >
          <Ionicons 
            name="swap-vertical" 
            size={24} 
            color={!fromToken || !toToken ? (isDark ? '#666' : '#999') : primaryColor} 
          />
        </TouchableOpacity>

        {/* To Token Section */}
        <View style={styles.tokenSection}>
          <View style={styles.tokenHeader}>
            <Text style={[styles.sectionLabel, { color: fg }]}>إلى</Text>
            {toToken && (
              <TouchableOpacity onPress={() => openSelector('to')}>
                <Text style={[styles.balanceText, { color: primaryColor }]}>
                  الرصيد: {formatNumber(getTokenBalance(toToken))}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity
            style={[styles.tokenSelector, { backgroundColor: selBg }]}
            onPress={() => openSelector('to')}
          >
            {toToken ? (
              <>
                <Image 
                  source={{ uri: getToken(toToken)?.logoURI }} 
                  style={styles.tokenIcon} 
                />
                <Text style={[styles.tokenSymbol, { color: fg }]}>
                  {getToken(toToken)?.symbol}
                </Text>
                <Ionicons name="chevron-down" size={20} color={fg} />
              </>
            ) : (
              <Text style={[styles.tokenSymbol, { color: fg }]}>
                اختر عملة
              </Text>
            )}
          </TouchableOpacity>
          
          {loadingQuote ? (
            <View style={styles.quoteLoading}>
              <ActivityIndicator size="small" color={primaryColor} />
              <Text style={[styles.quoteLoadingText, { color: fg }]}>
                جاري حساب السعر...
              </Text>
            </View>
          ) : expectedAmount !== null ? (
            <View style={styles.receivedAmountContainer}>
              <Text style={[styles.receivedAmount, { color: fg }]}>
                {formatNumber(expectedAmount)}
              </Text>
              
              {toToken && expectedAmount > 0 && (
                <Text style={[styles.usdValue, { color: isDark ? '#AAA' : '#666' }]}>
                  ≈ ${formatNumber(calculateUSDValue(expectedAmount, toToken), 2)}
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.receivedAmountContainer}>
              <Text style={[styles.amountPlaceholder, { color: isDark ? '#666' : '#999' }]}>
                0.0
              </Text>
            </View>
          )}
        </View>

        {/* Quote Details */}
        {expectedAmount !== null && swapQuote && !loadingQuote && (
          <View style={[styles.quoteDetails, { backgroundColor: isDark ? '#1A1A1A' : '#FFF' }]}>
            <View style={styles.quoteRow}>
              <Text style={[styles.quoteLabel, { color: isDark ? '#AAA' : '#666' }]}>
                معدل التحويل
              </Text>
              <Text style={[styles.quoteValue, { color: fg }]}>
                1 {getToken(fromToken)?.symbol} = {exchangeRate.toFixed(6)} {getToken(toToken)?.symbol}
              </Text>
            </View>
            
            <View style={styles.quoteRow}>
              <Text style={[styles.quoteLabel, { color: isDark ? '#AAA' : '#666' }]}>
                تأثير السعر
              </Text>
              <Text style={[styles.quoteValue, { color: getPriceImpactColor() }]}>
                {priceImpact.toFixed(2)}%
              </Text>
            </View>
            
            <View style={styles.quoteRow}>
              <Text style={[styles.quoteLabel, { color: isDark ? '#AAA' : '#666' }]}>
                الحد الأدنى المستلم
              </Text>
              <Text style={[styles.quoteValue, { color: fg }]}>
                {formatNumber(minimumReceived)} {getToken(toToken)?.symbol}
              </Text>
            </View>
            
            {swapFee > 0 && (
              <View style={styles.quoteRow}>
                <Text style={[styles.quoteLabel, { color: isDark ? '#AAA' : '#666' }]}>
                  رسوم المنصة
                </Text>
                <Text style={[styles.quoteValue, { color: fg }]}>
                  {swapFee.toFixed(6)} {getToken(fromToken)?.symbol}
                </Text>
              </View>
            )}
            
            {quoteExpiry && (
              <View style={styles.quoteRow}>
                <Text style={[styles.quoteLabel, { color: isDark ? '#AAA' : '#666' }]}>
                  صلاحية السعر
                </Text>
                <Text style={[styles.quoteValue, { color: fg }]}>
                  {Math.max(0, Math.floor((quoteExpiry - new Date()) / 1000))} ثانية
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Slippage Settings */}
        <View style={styles.settingsSection}>
          <Text style={[styles.settingsLabel, { color: fg }]}>تفاوت السعر (Slippage)</Text>
          <View style={styles.slippageContainer}>
            {[0.1, 0.5, 1.0, 2.0].map(value => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.slippageButton,
                  { 
                    backgroundColor: slippage === value ? primaryColor : 'transparent',
                    borderColor: slippage === value ? primaryColor : (isDark ? '#444' : '#CCC')
                  }
                ]}
                onPress={() => setSlippage(value)}
              >
                <Text style={[
                  styles.slippageButtonText,
                  { color: slippage === value ? '#fff' : fg }
                ]}>
                  {value}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.slippageNote, { color: isDark ? '#AAA' : '#666' }]}>
            زيادة Slippage تساعد في تنفيذ المعاملة بسرعة لكن قد تقلل من الكمية المستلمة
          </Text>
        </View>

        {/* Execute Swap Button */}
        <TouchableOpacity
          style={[
            styles.executeButton,
            { 
              backgroundColor: (!fromToken || !toToken || !amount || Number(amount) <= 0 || !expectedAmount) 
                ? (isDark ? '#333' : '#DDD') 
                : primaryColor,
              opacity: (!fromToken || !toToken || !amount || Number(amount) <= 0 || !expectedAmount) ? 0.5 : 1
            }
          ]}
          onPress={handleSwap}
          disabled={!fromToken || !toToken || !amount || Number(amount) <= 0 || !expectedAmount || loadingSwap}
        >
          {loadingSwap ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.executeButtonText}>
              {!fromToken || !toToken ? 'اختر العملات' : 
               !amount || Number(amount) <= 0 ? 'أدخل المبلغ' : 
               !expectedAmount ? 'جاري حساب السعر...' : 
               `مبادلة ${getToken(fromToken)?.symbol} → ${getToken(toToken)?.symbol}`}
            </Text>
          )}
        </TouchableOpacity>

        {/* Token Selection Modal */}
        <Modal visible={modalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { backgroundColor: bg }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: fg }]}>
                  اختر {selecting === 'from' ? 'العملة المصدر' : 'العملة الهدف'}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={fg} />
                </TouchableOpacity>
              </View>

              <TextInput
                placeholder="ابحث عن عملة..."
                placeholderTextColor={isDark ? '#666' : '#999'}
                value={searchText}
                onChangeText={(text) => {
                  setSearchText(text);
                  setFilteredTokens(
                    tokens.filter(
                      t =>
                        t.symbol.toLowerCase().includes(text.toLowerCase()) ||
                        t.name.toLowerCase().includes(text.toLowerCase()) ||
                        t.address.toLowerCase().includes(text.toLowerCase())
                    )
                  );
                }}
                style={[
                  styles.searchInput,
                  { 
                    backgroundColor: isDark ? '#1E1E1E' : '#F0F0F0',
                    color: fg 
                  }
                ]}
              />

              <FlatList
                data={filteredTokens}
                keyExtractor={item => item.address}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.tokenItem,
                      { 
                        backgroundColor: (selecting === 'from' ? fromToken : toToken) === item.address 
                          ? primaryColor + '20' 
                          : 'transparent'
                      }
                    ]}
                    onPress={() => selectToken(item.address)}
                  >
                    <Image 
                      source={{ uri: item.logoURI }} 
                      style={styles.tokenItemIcon} 
                    />
                    <View style={styles.tokenInfo}>
                      <Text style={[styles.tokenItemSymbol, { color: fg }]}>
                        {item.symbol}
                      </Text>
                      <Text style={[styles.tokenItemName, { color: isDark ? '#AAA' : '#666' }]}>
                        {item.name}
                      </Text>
                    </View>
                    <View style={styles.tokenBalance}>
                      <Text style={[styles.tokenBalanceText, { color: fg }]}>
                        {formatNumber(getTokenBalance(item.address))}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyList}>
                    <Text style={[styles.emptyText, { color: fg }]}>
                      لا توجد عملات مطابقة
                    </Text>
                  </View>
                }
              />
            </View>
          </View>
        </Modal>

        {/* Confirmation Modal */}
        {confirmModal && swapQuote && (
          <Modal visible={confirmModal} transparent animationType="fade">
            <View style={styles.confirmOverlay}>
              <View style={[styles.confirmContainer, { backgroundColor: bg }]}>
                <Text style={[styles.confirmTitle, { color: fg }]}>
                  تأكيد المبادلة
                </Text>
                
                <View style={styles.confirmDetails}>
                  <View style={styles.confirmTokenRow}>
                    <View style={styles.confirmToken}>
                      <Image 
                        source={{ uri: getToken(fromToken)?.logoURI }} 
                        style={styles.confirmTokenIcon} 
                      />
                      <Text style={[styles.confirmTokenAmount, { color: fg }]}>
                        {formatNumber(amount)} {getToken(fromToken)?.symbol}
                      </Text>
                    </View>
                    
                    <Ionicons name="arrow-forward" size={20} color={primaryColor} />
                    
                    <View style={styles.confirmToken}>
                      <Image 
                        source={{ uri: getToken(toToken)?.logoURI }} 
                        style={styles.confirmTokenIcon} 
                      />
                      <Text style={[styles.confirmTokenAmount, { color: fg }]}>
                        {formatNumber(expectedAmount)} {getToken(toToken)?.symbol}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.confirmInfo}>
                    <View style={styles.confirmInfoRow}>
                      <Text style={[styles.confirmInfoLabel, { color: isDark ? '#AAA' : '#666' }]}>
                        السعر
                      </Text>
                      <Text style={[styles.confirmInfoValue, { color: fg }]}>
                        1 {getToken(fromToken)?.symbol} = {exchangeRate.toFixed(6)} {getToken(toToken)?.symbol}
                      </Text>
                    </View>
                    
                    <View style={styles.confirmInfoRow}>
                      <Text style={[styles.confirmInfoLabel, { color: isDark ? '#AAA' : '#666' }]}>
                        تأثير السعر
                      </Text>
                      <Text style={[styles.confirmInfoValue, { color: getPriceImpactColor() }]}>
                        {priceImpact.toFixed(2)}%
                      </Text>
                    </View>
                    
                    <View style={styles.confirmInfoRow}>
                      <Text style={[styles.confirmInfoLabel, { color: isDark ? '#AAA' : '#666' }]}>
                        الحد الأدنى المستلم
                      </Text>
                      <Text style={[styles.confirmInfoValue, { color: fg }]}>
                        {formatNumber(minimumReceived)} {getToken(toToken)?.symbol}
                      </Text>
                    </View>
                    
                    {swapFee > 0 && (
                      <View style={styles.confirmInfoRow}>
                        <Text style={[styles.confirmInfoLabel, { color: isDark ? '#AAA' : '#666' }]}>
                          رسوم المنصة
                        </Text>
                        <Text style={[styles.confirmInfoValue, { color: fg }]}>
                          {swapFee.toFixed(6)} {getToken(fromToken)?.symbol}
                        </Text>
                      </View>
                    )}
                    
                    <View style={styles.confirmInfoRow}>
                      <Text style={[styles.confirmInfoLabel, { color: isDark ? '#AAA' : '#666' }]}>
                        Slippage
                      </Text>
                      <Text style={[styles.confirmInfoValue, { color: fg }]}>
                        {slippage}%
                      </Text>
                    </View>
                    
                    {quoteExpiry && (
                      <View style={styles.confirmInfoRow}>
                        <Text style={[styles.confirmInfoLabel, { color: isDark ? '#AAA' : '#666' }]}>
                          صلاحية السعر
                        </Text>
                        <Text style={[styles.confirmInfoValue, { color: fg }]}>
                          {Math.max(0, Math.floor((quoteExpiry - new Date()) / 1000))} ثانية
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                
                <View style={styles.confirmButtons}>
                  <TouchableOpacity 
                    style={[
                      styles.confirmButton,
                      styles.cancelButton,
                      { borderColor: isDark ? '#444' : '#CCC' }
                    ]}
                    onPress={() => setConfirmModal(false)}
                  >
                    <Text style={[styles.cancelButtonText, { color: fg }]}>
                      إلغاء
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.confirmButton,
                      { backgroundColor: primaryColor }
                    ]}
                    onPress={executeConfirmedSwap}
                    disabled={loadingSwap}
                  >
                    {loadingSwap ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.confirmButtonText}>
                        تأكيد المبادلة
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
    flex: 1,
  },
  tokenSection: {
    marginBottom: 20,
  },
  tokenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  balanceText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tokenInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tokenSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 120,
  },
  tokenIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  amountContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '600',
    paddingVertical: 8,
    minHeight: 50,
  },
  maxButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  maxButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  usdValue: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 12,
  },
  swapButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 8,
  },
  receivedAmountContainer: {
    marginTop: 12,
  },
  receivedAmount: {
    fontSize: 32,
    fontWeight: '600',
    paddingVertical: 8,
  },
  amountPlaceholder: {
    fontSize: 32,
    fontWeight: '300',
    paddingVertical: 8,
  },
  quoteLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  quoteLoadingText: {
    fontSize: 14,
  },
  settingsSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  settingsLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  slippageContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slippageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 60,
    alignItems: 'center',
  },
  slippageButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  slippageNote: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  quoteDetails: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  quoteLabel: {
    fontSize: 14,
  },
  quoteValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  executeButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  executeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    flex: 1,
    marginTop: 100,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  searchInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  tokenItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  tokenItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenItemSymbol: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  tokenItemName: {
    fontSize: 12,
  },
  tokenBalance: {
    alignItems: 'flex-end',
  },
  tokenBalanceText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  emptyList: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmDetails: {
    marginBottom: 24,
  },
  confirmTokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  confirmToken: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  confirmTokenIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  confirmTokenAmount: {
    fontSize: 20,
    fontWeight: '600',
  },
  confirmInfo: {
    gap: 12,
  },
  confirmInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmInfoLabel: {
    fontSize: 14,
  },
  confirmInfoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
