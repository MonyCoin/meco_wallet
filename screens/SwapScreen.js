import React, { useState, useEffect, useCallback, useRef } from 'react';
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

// =============================================
// ⚙️ إعدادات التبادل
// =============================================
const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote';
const SLIPPAGE_BPS = 50; // 0.5% Slippage (قياسي)
const MIN_SOL_FOR_GAS = 0.002; // الحد الأدنى من SOL الذي يجب بقاؤه في المحفظة للأمان

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

export default function SwapScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const theme = useAppStore(state => state.theme);
  const primaryColor = useAppStore(state => state.primaryColor);
  const isDark = theme === 'dark';
  const isMounted = useRef(true);

  // استلام الرمز المختار
  const selectedToken = route.params?.selectedToken;

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
    if (selectedToken?.swapAvailable) return selectedToken.symbol;
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
  const [networkFee, setNetworkFee] = useState(0.000005);
  const [error, setError] = useState(null);
  
  // Ref لـ Timeout لمنع التحديث المتكرر
  const quoteTimeoutRef = useRef(null);

  // تحديث الرسوم
  const updateNetworkFee = useCallback(async () => {
    try {
      let fee = await getCurrentNetworkFee();
      // سقف منطقي للرسوم لتجنب الأرقام الفلكية في العرض، لكن التنفيذ الفعلي يعتمد على الشبكة
      if (fee > 0.0001) fee = 0.0001; 
      if (isMounted.current) setNetworkFee(fee);
    } catch (error) {
      if (isMounted.current) setNetworkFee(0.000005);
    }
  }, []);

  // تحميل الأرصدة
  const loadBalances = useCallback(async () => {
    try {
      const solBalance = await getSolBalance();
      const balancesObj = { SOL: solBalance || 0 };

      for (const token of swapTokens) {
        if (token.symbol !== 'SOL' && token.mint) {
          try {
            const balance = await getTokenBalance(token.mint);
            balancesObj[token.symbol] = balance || 0;
          } catch (e) {
            balancesObj[token.symbol] = 0;
          }
        }
      }
      
      if (isMounted.current) setBalances(balancesObj);
    } catch (error) {
      console.error('Balance load failed', error);
    }
  }, [swapTokens]);

  useEffect(() => {
    isMounted.current = true;
    loadBalances();
    updateNetworkFee();
    return () => { 
      isMounted.current = false; 
      if (quoteTimeoutRef.current) clearTimeout(quoteTimeoutRef.current);
    };
  }, [loadBalances, updateNetworkFee]);

  // helper للحصول على معلومات التوكن
  const getTokenInfo = (symbol) => swapTokens.find(t => t.symbol === symbol);

  // ✅ دالة جلب السعر من Jupiter (الأكثر أهمية)
  const getJupiterQuote = async (inputSymbol, outputSymbol, amount) => {
    const inputToken = getTokenInfo(inputSymbol);
    const outputToken = getTokenInfo(outputSymbol);

    if (!inputToken?.mint || !outputToken?.mint) {
      throw new Error(t('swap_invalid_token_selection'));
    }

    // تحويل المبلغ لأصغر وحدة (Lamports/Decimals)
    // استخدام Math.round لتفادي الكسور الناتجة عن ضرب الفلوت
    const amountInSmallestUnit = Math.round(amount * Math.pow(10, inputToken.decimals));

    const url = `${JUPITER_QUOTE_API}?inputMint=${inputToken.mint}&outputMint=${outputToken.mint}&amount=${amountInSmallestUnit}&slippageBps=${SLIPPAGE_BPS}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Jupiter API Error');
      
      const data = await response.json();
      
      if (!data || !data.outAmount) {
        throw new Error('No route found');
      }

      const outAmountNum = Number(data.outAmount) / Math.pow(10, outputToken.decimals);
      
      return {
        ...data, // نعيد كامل الاوبجكت لأننا نحتاجه للتنفيذ
        outputAmountUI: outAmountNum,
        rate: outAmountNum / amount
      };
    } catch (error) {
      console.warn('Jupiter Quote Failed:', error);
      throw error; // نرمي الخطأ ليعالجه الـ UI
    }
  };

  // مراقبة المدخلات لتحديث السعر
  useEffect(() => {
    if (quoteTimeoutRef.current) clearTimeout(quoteTimeoutRef.current);

    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setToAmount('');
      setQuote(null);
      return;
    }

    quoteTimeoutRef.current = setTimeout(async () => {
      try {
        setLoadingQuote(true);
        setError(null);
        
        const quoteData = await getJupiterQuote(fromToken, toToken, parseFloat(fromAmount));
        
        if (isMounted.current) {
          setQuote(quoteData);
          setToAmount(quoteData.outputAmountUI.toFixed(6));
        }
      } catch (err) {
        if (isMounted.current) {
          setQuote(null);
          setToAmount('');
          // لا نعرض الخطأ كنص أحمر مزعج فوراً إلا إذا كان خطأ اتصال، يمكن الاكتفاء بتعطيل الزر
        }
      } finally {
        if (isMounted.current) setLoadingQuote(false);
      }
    }, 600); // 600ms Debounce

  }, [fromToken, toToken, fromAmount]);

  // زر التبديل (قلب العملات)
  const handleSwitchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount('');
    setToAmount('');
    setQuote(null);
  };

  // زر Max
  const handleMaxAmount = () => {
    const balance = balances[fromToken] || 0;
    let maxVal = balance;

    if (fromToken === 'SOL') {
      // إذا كان SOL، نترك مبلغ للغاز
      maxVal = Math.max(0, balance - MIN_SOL_FOR_GAS - networkFee);
    }
    
    // تنسيق الرقم لـ 6 خانات عشرية كحد أقصى للنص
    setFromAmount(maxVal > 0 ? maxVal.toFixed(6) : '0');
  };

  // ✅ تنفيذ التبادل
  const handleSwap = async () => {
    const amount = parseFloat(fromAmount);
    
    // 1. التحقق من المدخلات
    if (!amount || amount <= 0) {
      Alert.alert(t('error'), t('swap_amount_must_be_positive'));
      return;
    }

    // 2. التحقق من رصيد العملة المراد إرسالها
    const tokenBalance = balances[fromToken] || 0;
    if (amount > tokenBalance) {
      Alert.alert(t('error'), t('swap_insufficient_balance'));
      return;
    }

    // 3. ✅ التحقق الحرج: هل يوجد رصيد SOL كافٍ للرسوم؟ (مهما كانت العملة المرسلة)
    const solBalance = balances.SOL || 0;
    const estimatedFee = networkFee * 1.5; // هامش أمان

    if (fromToken === 'SOL') {
      if (amount + estimatedFee > solBalance) {
        Alert.alert(t('error'), t('swap_insufficient_sol_gas'));
        return;
      }
    } else {
      // إذا كنا نرسل توكن، يجب أن يكون لدينا SOL منفصل للغاز
      if (solBalance < estimatedFee) {
        Alert.alert(t('error'), `${t('swap_insufficient_sol_gas')} (~${estimatedFee.toFixed(5)} SOL)`);
        return;
      }
    }

    // 4. التحقق من وجود عرض سعر حقيقي
    if (!quote || !quote.outAmount) {
      Alert.alert(t('error'), t('swap_no_route_found'));
      return;
    }

    // البدء
    setLoading(true);
    try {
      const walletPublicKey = await SecureStore.getItemAsync('wallet_public_key');
      
      const result = await executeRealSwap({
        quoteResponse: quote, // نمرر الرد الأصلي من Jupiter
        walletPublicKey,
        fromToken,
        toToken,
        amount,
        networkFee
      });

      if (result.success) {
        Alert.alert(
          t('swap_successful'),
          `${t('swap_swapped')} ${amount} ${fromToken} ➝ ${result.outputAmount || toAmount} ${toToken}`,
          [{ 
            text: t('ok'), 
            onPress: () => {
              setFromAmount('');
              setToAmount('');
              setQuote(null);
              loadBalances();
              navigation.goBack();
            }
          }]
        );
      } else {
        throw new Error(result.error || 'Swap Failed');
      }

    } catch (error) {
      console.error('Swap execution error:', error);
      Alert.alert(t('error'), error.message || t('swap_failed'));
    } finally {
      setLoading(false);
    }
  };

  // مكون فرعي لعنصر القائمة
  const renderTokenItem = (token, isFrom) => {
    const tokenInfo = getTokenInfo(token.symbol);
    const balance = balances[token.symbol] || 0;
    const isSelected = isFrom ? fromToken === token.symbol : toToken === token.symbol;

    return (
      <TouchableOpacity
        key={`${token.symbol}_${isFrom ? 'from' : 'to'}`}
        style={[styles.tokenItem, { backgroundColor: colors.card, opacity: tokenInfo.mint ? 1 : 0.5 }]}
        onPress={() => {
          if (!tokenInfo.mint && token.symbol !== 'SOL') return;
          if (isFrom) {
            if (token.symbol === toToken) handleSwitchTokens();
            else setFromToken(token.symbol);
            setShowFromModal(false);
          } else {
            if (token.symbol === fromToken) handleSwitchTokens();
            else setToToken(token.symbol);
            setShowToModal(false);
          }
        }}
      >
        <View style={styles.tokenItemLeft}>
           {token.image ? (
              <Image source={{ uri: token.image }} style={styles.tokenImage} />
            ) : (
              <View style={[styles.tokenIconPlaceholder, { backgroundColor: primaryColor + '20' }]}>
                <Ionicons name={token.icon} size={20} color={primaryColor} />
              </View>
            )}
           <View style={{marginLeft: 12}}>
             <Text style={[styles.tokenSymbolText, { color: colors.text }]}>{token.symbol}</Text>
             <Text style={[styles.tokenNameText, { color: colors.textSecondary }]}>{token.name}</Text>
           </View>
        </View>
        <View>
          <Text style={[styles.tokenBalanceText, { color: colors.text }]}>{balance > 0 ? balance.toFixed(4) : '0'}</Text>
          {isSelected && <Ionicons name="checkmark" size={16} color={primaryColor} style={{alignSelf:'flex-end'}}/>}
        </View>
      </TouchableOpacity>
    );
  };

  const currentFromToken = getTokenInfo(fromToken);
  const currentToToken = getTokenInfo(toToken);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>{t('swap_title')}</Text>
            <View style={{ width: 40 }} /> 
          </View>

          {/* Swap Card */}
          <View style={[styles.swapCard, { backgroundColor: colors.card }]}>
            
            {/* FROM Section */}
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('swap_pay')}</Text>
                <Text style={[styles.balanceSmall, { color: colors.textSecondary }]}>
                  {t('swap_balance')}: {(balances[fromToken] || 0).toFixed(4)}
                </Text>
              </View>
              
              <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground }]}>
                 <TouchableOpacity style={styles.tokenSelectBtn} onPress={() => setShowFromModal(true)}>
                    {currentFromToken?.image && <Image source={{uri: currentFromToken.image}} style={styles.smallTokenIcon}/>}
                    <Text style={[styles.tokenBtnText, {color: colors.text}]}>{fromToken}</Text>
                    <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                 </TouchableOpacity>

                 <TextInput 
                    style={[styles.input, { color: colors.text }]}
                    placeholder="0.0"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    value={fromAmount}
                    onChangeText={(t) => setFromAmount(t.replace(/,/g, '.'))} // Fix commas
                 />
              </View>
              
              {/* Max & Fee Hint */}
              <View style={styles.helpersRow}>
                <TouchableOpacity onPress={handleMaxAmount}>
                  <Text style={[styles.maxBtn, { color: primaryColor }]}>MAX</Text>
                </TouchableOpacity>
                {fromToken === 'SOL' && (
                  <Text style={[styles.feeHint, { color: colors.warning }]}>
                    {t('swap_gas_reserved')}
                  </Text>
                )}
              </View>
            </View>

            {/* Switcher */}
            <View style={styles.switcherContainer}>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <TouchableOpacity 
                style={[styles.switchBtn, { backgroundColor: primaryColor, borderColor: colors.card }]} 
                onPress={handleSwitchTokens}
                activeOpacity={0.8}
              >
                <Ionicons name="swap-vertical" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* TO Section */}
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('swap_receive')}</Text>
                <Text style={[styles.balanceSmall, { color: colors.textSecondary }]}>
                  {t('swap_balance')}: {(balances[toToken] || 0).toFixed(4)}
                </Text>
              </View>

              <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground }]}>
                 <TouchableOpacity style={styles.tokenSelectBtn} onPress={() => setShowToModal(true)}>
                    {currentToToken?.image && <Image source={{uri: currentToToken.image}} style={styles.smallTokenIcon}/>}
                    <Text style={[styles.tokenBtnText, {color: colors.text}]}>{toToken}</Text>
                    <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                 </TouchableOpacity>

                 <View style={styles.outputArea}>
                    {loadingQuote ? (
                      <ActivityIndicator size="small" color={primaryColor} />
                    ) : (
                      <Text style={[styles.outputText, { color: toAmount ? colors.text : colors.textSecondary }]}>
                        {toAmount || '0.00'}
                      </Text>
                    )}
                 </View>
              </View>
            </View>

            {/* Quote Info */}
            {quote && (
              <View style={[styles.infoBox, { backgroundColor: primaryColor + '10' }]}>
                <View style={styles.infoRow}>
                   <Text style={[styles.infoLabel, {color: colors.textSecondary}]}>{t('swap_rate')}</Text>
                   <Text style={[styles.infoValue, {color: colors.text}]}>
                     1 {fromToken} ≈ {quote.rate.toFixed(4)} {toToken}
                   </Text>
                </View>
                <View style={styles.infoRow}>
                   <Text style={[styles.infoLabel, {color: colors.textSecondary}]}>{t('swap_est_fee')}</Text>
                   <Text style={[styles.infoValue, {color: colors.text}]}>~{networkFee.toFixed(6)} SOL</Text>
                </View>
              </View>
            )}

            {/* Main Action Button */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                { 
                  backgroundColor: (!fromAmount || loading || loadingQuote || !quote) ? colors.border : primaryColor 
                }
              ]}
              disabled={!fromAmount || loading || loadingQuote || !quote}
              onPress={handleSwap}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.actionBtnText}>
                   {!fromAmount ? t('swap_enter_amount') : 
                    loadingQuote ? t('swap_fetching_quote') : 
                    !quote ? t('swap_no_route') : 
                    t('swap_confirm')}
                </Text>
              )}
            </TouchableOpacity>

          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      <Modal visible={showFromModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
           <View style={[styles.modalBody, { backgroundColor: colors.background }]}>
              <View style={styles.modalHeader}>
                 <Text style={[styles.modalTitle, {color: colors.text}]}>{t('swap_pay_with')}</Text>
                 <TouchableOpacity onPress={() => setShowFromModal(false)}>
                   <Ionicons name="close" size={24} color={colors.text} />
                 </TouchableOpacity>
              </View>
              <ScrollView>
                 {swapTokens.map(t => renderTokenItem(t, true))}
              </ScrollView>
           </View>
        </View>
      </Modal>

      <Modal visible={showToModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
           <View style={[styles.modalBody, { backgroundColor: colors.background }]}>
              <View style={styles.modalHeader}>
                 <Text style={[styles.modalTitle, {color: colors.text}]}>{t('swap_receive_token')}</Text>
                 <TouchableOpacity onPress={() => setShowToModal(false)}>
                   <Ionicons name="close" size={24} color={colors.text} />
                 </TouchableOpacity>
              </View>
              <ScrollView>
                 {swapTokens.map(t => renderTokenItem(t, false))}
              </ScrollView>
           </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

// =============================================
// 🎨 Styles
// =============================================
const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1 },
  container: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  title: { fontSize: 20, fontWeight: '700' },
  swapCard: { borderRadius: 24, padding: 20, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  section: { marginBottom: 10 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600' },
  balanceSmall: { fontSize: 12 },
  inputWrapper: { flexDirection: 'row', borderRadius: 16, height: 60, alignItems: 'center', paddingHorizontal: 12 },
  tokenSelectBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  smallTokenIcon: { width: 24, height: 24, borderRadius: 12, marginRight: 6 },
  tokenBtnText: { fontSize: 16, fontWeight: '700', marginRight: 4 },
  input: { flex: 1, fontSize: 20, fontWeight: '600', textAlign: 'right' },
  outputArea: { flex: 1, alignItems: 'flex-end', justifyContent: 'center' },
  outputText: { fontSize: 20, fontWeight: '600' },
  helpersRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, minHeight: 20 },
  maxBtn: { fontSize: 12, fontWeight: '700' },
  feeHint: { fontSize: 10 },
  switcherContainer: { height: 20, justifyContent: 'center', alignItems: 'center', zIndex: 10, marginVertical: -10 },
  divider: { width: '100%', height: 1 },
  switchBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 4 },
  infoBox: { padding: 12, borderRadius: 12, marginTop: 10, marginBottom: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  infoLabel: { fontSize: 12 },
  infoValue: { fontSize: 12, fontWeight: '600' },
  actionButton: { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  actionBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBody: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, height: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  tokenItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderRadius: 12, marginBottom: 8 },
  tokenItemLeft: { flexDirection: 'row', alignItems: 'center' },
  tokenImage: { width: 36, height: 36, borderRadius: 18 },
  tokenIconPlaceholder: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  tokenSymbolText: { fontSize: 16, fontWeight: '700' },
  tokenNameText: { fontSize: 12 },
  tokenBalanceText: { fontSize: 16, fontWeight: '600' },
});
