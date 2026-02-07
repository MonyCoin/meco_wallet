import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Modal,
  ScrollView, Dimensions, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
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
const SLIPPAGE_BPS = 50; // 0.5%
const SERVICE_FEE_SOL = 0.0005; 

// قائمة العملات الافتراضية للتبادل
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
    decimals: 9, 
    image: 'https://raw.githubusercontent.com/MonyCoin/meco-token/refs/heads/main/meco-logo.png'
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
  
  // الوضع الافتراضي: إذا لم يتم تمرير عملة، نستخدم القائمة الأساسية
  const selectedTokenParam = route.params?.selectedToken;

  const [swapTokens, setSwapTokens] = useState(() => {
    if (!selectedTokenParam) return BASE_SWAP_TOKENS;
    
    // إذا تم تمرير عملة من Market، نضيفها للقائمة إذا لم تكن موجودة
    const exists = BASE_SWAP_TOKENS.find(t => t.symbol === selectedTokenParam.symbol);
    if (exists) return BASE_SWAP_TOKENS;

    return [...BASE_SWAP_TOKENS, {
      symbol: selectedTokenParam.symbol,
      name: selectedTokenParam.name,
      mint: selectedTokenParam.mint,
      icon: 'star-outline',
      decimals: selectedTokenParam.decimals || 6,
      image: selectedTokenParam.image
    }];
  });

  const isMounted = useRef(true);
  
  // الألوان (يمكنك استبدالها بـ useAppStore)
  const colors = {
    background: '#0A0A0F', // Dark Theme Default
    card: '#1A1A2E',
    text: '#FFFFFF',
    textSecondary: '#A0A0B0',
    border: '#2A2A3E',
    inputBackground: '#2A2A3E',
    primary: '#6C63FF',
    error: '#EF4444',
  };

  // الحالة الأولية:
  // إذا جئنا من Market، نضع العملة المختارة في "إلى" (Receive)
  // وإلا، الافتراضي هو SOL -> MECO
  const [fromToken, setFromToken] = useState('SOL');
  const [toToken, setToToken] = useState(() => {
    if (selectedTokenParam?.symbol && selectedTokenParam.symbol !== 'SOL') {
      return selectedTokenParam.symbol;
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
  const [networkFee, setNetworkFee] = useState(0.000005);
  
  const quoteTimeoutRef = useRef(null);

  // تحميل الأرصدة والرسوم
  const loadData = useCallback(async () => {
    try {
      const fee = await getCurrentNetworkFee();
      if (isMounted.current) setNetworkFee(fee);

      const solBalance = await getSolBalance();
      const balancesObj = { SOL: solBalance || 0 };

      for (const token of swapTokens) {
        if (token.symbol !== 'SOL' && token.mint) {
          try {
            const bal = await getTokenBalance(token.mint);
            balancesObj[token.symbol] = bal || 0;
          } catch (e) {
            balancesObj[token.symbol] = 0;
          }
        }
      }
      if (isMounted.current) setBalances(balancesObj);
    } catch (error) {
      console.log('Error loading swap data');
    }
  }, [swapTokens]);

  useEffect(() => {
    isMounted.current = true;
    loadData();
    return () => { 
      isMounted.current = false; 
      if (quoteTimeoutRef.current) clearTimeout(quoteTimeoutRef.current);
    };
  }, [loadData]);

  // جلب السعر من Jupiter
  const getJupiterQuote = async (inputSymbol, outputSymbol, amount) => {
    const inputToken = swapTokens.find(t => t.symbol === inputSymbol);
    const outputToken = swapTokens.find(t => t.symbol === outputSymbol);

    if (!inputToken?.mint || !outputToken?.mint) throw new Error('Invalid token pair');

    const amountInSmallestUnit = Math.round(amount * Math.pow(10, inputToken.decimals));
    const url = `${JUPITER_QUOTE_API}?inputMint=${inputToken.mint}&outputMint=${outputToken.mint}&amount=${amountInSmallestUnit}&slippageBps=${SLIPPAGE_BPS}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (!data || !data.outAmount) throw new Error('No route found');

      const outAmountNum = Number(data.outAmount) / Math.pow(10, outputToken.decimals);
      return { ...data, outputAmountUI: outAmountNum, rate: outAmountNum / amount };
    } catch (error) {
      throw error;
    }
  };

  // مراقبة الكتابة (Debounce)
  useEffect(() => {
    if (quoteTimeoutRef.current) clearTimeout(quoteTimeoutRef.current);
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setToAmount('');
      setQuote(null);
      return;
    }

    setLoadingQuote(true);
    quoteTimeoutRef.current = setTimeout(async () => {
      try {
        const q = await getJupiterQuote(fromToken, toToken, parseFloat(fromAmount));
        if (isMounted.current) {
          setQuote(q);
          setToAmount(q.outputAmountUI.toFixed(6));
        }
      } catch (err) {
        if (isMounted.current) { setQuote(null); setToAmount(''); }
      } finally {
        if (isMounted.current) setLoadingQuote(false);
      }
    }, 600);
  }, [fromAmount, fromToken, toToken]);

  const handleMaxAmount = () => {
    const balance = balances[fromToken] || 0;
    let maxVal = balance;
    if (fromToken === 'SOL') {
      maxVal = Math.max(0, balance - SERVICE_FEE_SOL - networkFee - 0.00001);
    }
    setFromAmount(maxVal > 0 ? maxVal.toFixed(6) : '0');
  };

  const handleSwitchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount('');
    setToAmount('');
    setQuote(null);
  };

  const handleSwap = async () => {
    if (!quote) return;
    setLoading(true);
    try {
      const walletPublicKey = await SecureStore.getItemAsync('wallet_public_key');
      const result = await executeRealSwap({
        quoteResponse: quote,
        walletPublicKey,
        fromToken,
        toToken,
        amount: parseFloat(fromAmount),
        networkFee,
        serviceFee: SERVICE_FEE_SOL
      });

      if (result.success) {
        Alert.alert(t('swap_successful'), `Swapped ${fromAmount} ${fromToken} to ${toToken}`, [{
          text: 'OK', onPress: () => {
            setFromAmount(''); setToAmount(''); setQuote(null); loadData(); navigation.goBack();
          }
        }]);
      } else {
        throw new Error(result.error);
      }
    } catch (e) {
      Alert.alert(t('error'), e.message || t('swap_failed'));
    } finally {
      setLoading(false);
    }
  };

  const renderTokenModalItem = (token, isFrom) => (
    <TouchableOpacity
      key={token.symbol}
      style={[styles.tokenItem, { borderColor: colors.border }]}
      onPress={() => {
        if (isFrom) {
          setFromToken(token.symbol);
          setShowFromModal(false);
        } else {
          setToToken(token.symbol);
          setShowToModal(false);
        }
      }}
    >
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <Image source={{ uri: token.image }} style={styles.tokenImage} />
        <View style={{marginLeft: 12}}>
          <Text style={{color: colors.text, fontWeight: 'bold'}}>{token.symbol}</Text>
          <Text style={{color: colors.textSecondary, fontSize: 12}}>{token.name}</Text>
        </View>
      </View>
      <Text style={{color: colors.text}}>{(balances[token.symbol] || 0).toFixed(4)}</Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{t('swap_title')}</Text>
          <View style={{width: 24}}/>
        </View>

        {/* Swap Card */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          
          {/* FROM */}
          <View style={styles.section}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8}}>
              <Text style={{color: colors.textSecondary}}>{t('swap_pay')}</Text>
              <Text style={{color: colors.textSecondary}}>{t('balance')}: {(balances[fromToken]||0).toFixed(4)}</Text>
            </View>
            <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground }]}>
              <TouchableOpacity style={styles.tokenSelect} onPress={() => setShowFromModal(true)}>
                <Image source={{ uri: swapTokens.find(t=>t.symbol===fromToken)?.image }} style={styles.smallIcon} />
                <Text style={{color: colors.text, fontWeight: 'bold', marginHorizontal: 8}}>{fromToken}</Text>
                <Ionicons name="chevron-down" color={colors.textSecondary} size={16} />
              </TouchableOpacity>
              <TextInput 
                style={[styles.input, { color: colors.text }]} 
                placeholder="0.0" 
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={fromAmount}
                onChangeText={(t) => setFromAmount(t.replace(/,/g, '.'))}
              />
            </View>
            <TouchableOpacity onPress={handleMaxAmount} style={{alignSelf: 'flex-end', marginTop: 4}}>
              <Text style={{color: colors.primary, fontWeight: 'bold', fontSize: 12}}>MAX</Text>
            </TouchableOpacity>
          </View>

          {/* Switcher */}
          <View style={{alignItems: 'center', marginVertical: -10, zIndex: 10}}>
            <TouchableOpacity style={[styles.switchBtn, { backgroundColor: colors.primary }]} onPress={handleSwitchTokens}>
              <Ionicons name="swap-vertical" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* TO */}
          <View style={styles.section}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8}}>
              <Text style={{color: colors.textSecondary}}>{t('swap_receive')}</Text>
              <Text style={{color: colors.textSecondary}}>{t('balance')}: {(balances[toToken]||0).toFixed(4)}</Text>
            </View>
            <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground }]}>
              <TouchableOpacity style={styles.tokenSelect} onPress={() => setShowToModal(true)}>
                <Image source={{ uri: swapTokens.find(t=>t.symbol===toToken)?.image }} style={styles.smallIcon} />
                <Text style={{color: colors.text, fontWeight: 'bold', marginHorizontal: 8}}>{toToken}</Text>
                <Ionicons name="chevron-down" color={colors.textSecondary} size={16} />
              </TouchableOpacity>
              <View style={{flex: 1, alignItems: 'flex-end'}}>
                {loadingQuote ? <ActivityIndicator size="small" color={colors.primary} /> : 
                  <Text style={{color: colors.text, fontSize: 18, fontWeight: 'bold'}}>{toAmount || '0.0'}</Text>
                }
              </View>
            </View>
          </View>

          {/* Info */}
          {quote && (
            <View style={[styles.infoBox, { backgroundColor: colors.primary + '15' }]}>
              <Text style={{color: colors.text, fontSize: 12}}>Rate: 1 {fromToken} ≈ {quote.rate.toFixed(4)} {toToken}</Text>
              <Text style={{color: colors.text, fontSize: 12}}>Fee: ~{(networkFee + SERVICE_FEE_SOL).toFixed(5)} SOL</Text>
            </View>
          )}

          {/* Button */}
          <TouchableOpacity 
            style={[styles.btn, { backgroundColor: (!quote || loading) ? colors.border : colors.primary }]}
            disabled={!quote || loading}
            onPress={handleSwap}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>{t('swap_now')}</Text>}
          </TouchableOpacity>

        </View>
      </ScrollView>

      {/* Modals */}
      <Modal visible={showFromModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={{color: colors.text, fontSize: 18, fontWeight: 'bold'}}>{t('swap_pay_with')}</Text>
              <TouchableOpacity onPress={() => setShowFromModal(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
            </View>
            <ScrollView>{swapTokens.map(t => renderTokenModalItem(t, true))}</ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showToModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={{color: colors.text, fontSize: 18, fontWeight: 'bold'}}>{t('swap_receive_token')}</Text>
              <TouchableOpacity onPress={() => setShowToModal(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
            </View>
            <ScrollView>{swapTokens.map(t => renderTokenModalItem(t, false))}</ScrollView>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 },
  title: { fontSize: 20, fontWeight: 'bold' },
  card: { borderRadius: 20, padding: 20 },
  section: { marginBottom: 12 },
  inputContainer: { flexDirection: 'row', borderRadius: 12, padding: 12, alignItems: 'center', height: 60 },
  tokenSelect: { flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  smallIcon: { width: 24, height: 24, borderRadius: 12 },
  input: { flex: 1, fontSize: 20, fontWeight: 'bold', textAlign: 'right' },
  switchBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#1A1A2E' },
  infoBox: { padding: 12, borderRadius: 8, marginBottom: 16, gap: 4 },
  btn: { height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  tokenItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  tokenImage: { width: 32, height: 32, borderRadius: 16 }
});
