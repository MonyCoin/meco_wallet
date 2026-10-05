// screens/TradeExecutionScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  SafeAreaView, ScrollView, Alert, ActivityIndicator,
  Modal, FlatList, Image, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { executeMarketSwap } from '../services/tradingService';
import { getSolBalance, getTokenBalance } from '../services/heliusService';
import { CORE_TOKENS, getJupiterMarketData } from '../services/jupiterMarketService';
import { addNotification, NOTIF_TYPES } from '../services/notificationsService';

const PLATFORM_FEE_SOL = 0.0005;

// عملات التسعير المدعومة — الصور تُحقن ديناميكيًا من getJupiterMarketData
const QUOTE_TOKENS = [
  { symbol:'USDC', mint:'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals:6, image:null },
  { symbol:'USDT', mint:'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11MeCe8BenwNYB', decimals:6, image:null },
  { symbol:'SOL',  mint:'So11111111111111111111111111111111111111112',   decimals:9, image:null },
  { symbol:'MECO', mint:'A5Ln25cfww33kfUSzBb89bMha7j1PnFQTy7H3FsQHN7W', decimals:9, image:null },
];

const SafeImage = ({ uri, size = 32 }) => {
  const [err, setErr] = useState(false);
  if (err || !uri) return <View style={{ width:size, height:size, borderRadius:size/2, backgroundColor:'rgba(0,0,0,0.1)' }} />;
  return <Image source={{ uri }} style={{ width:size, height:size, borderRadius:size/2 }} onError={() => setErr(true)} />;
};

const fmtAmount = (n) => {
  if (!n && n !== 0) return '0';
  if (n === 0) return '0';
  if (n > 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n > 1)    return n.toFixed(4);
  return n.toFixed(6);
};

export default function TradeExecutionScreen() {
  const navigation         = useNavigation();
  const route              = useRoute();
  const { t }              = useTranslation();
  const theme              = useAppStore(s => s.theme);
  const primaryColor       = useAppStore(s => s.primaryColor || '#6C63FF');
  const isDark             = theme === 'dark';
  const insets             = useSafeAreaInsets();
  const activeAccountIndex = useAppStore(s => s.activeAccountIndex);
  const walletPublicKey    = useAppStore(s => s.walletPublicKey);

  const C = {
    bg:      isDark ? '#07070F' : '#F4F5F9',
    card:    isDark ? '#111122' : '#FFFFFF',
    card2:   isDark ? '#171730' : '#ECECF4',
    text:    isDark ? '#EEEEFF' : '#1C1C24',
    muted:   isDark ? '#7E7EAA' : '#8A8A9E',
    border:  isDark ? '#1E1E38' : '#E8E8F2',
    success: '#10B981', error: '#EF4444', warning: '#F59E0B',
  };

  // ── Route Params ────────────────────────────────────────────────
  const targetToken = route.params?.token || CORE_TOKENS.find(tk => tk.symbol === 'SOL') || CORE_TOKENS[0];
  const initialSide = route.params?.side === 'sell' ? 'sell' : 'buy';

  const [side,         setSide]         = useState(initialSide);
  const [quoteTokensList, setQuoteTokensList] = useState(QUOTE_TOKENS);
  const [quoteToken,   setQuoteToken]   = useState(QUOTE_TOKENS[0]);
  const [amount,       setAmount]       = useState('');
  const [quoteModal,   setQuoteModal]   = useState(false);
  const [executing,    setExecuting]    = useState(false);
  const [baseBalance,  setBaseBalance]  = useState(0);
  const [quoteBalance, setQuoteBalance] = useState(0);
  const [tokenPrice,   setTokenPrice]   = useState(0);
  const [quoteTokenPrice, setQuoteTokenPrice] = useState(0);
  const [pricesLoading,   setPricesLoading]   = useState(true);

  const scrollRef = useRef(null);

  const inputToken  = side === 'buy' ? quoteToken : targetToken;
  const outputToken = side === 'buy' ? targetToken : quoteToken;

  const inputBalance  = side === 'buy' ? quoteBalance : baseBalance;
  const SOL_RESERVE   = 0.001;

  // ── جلب الأرصدة ────────────────────────────────────────────────
  const fetchBalances = useCallback(async () => {
    if (!walletPublicKey) return;
    try {
      const baseBal = targetToken.symbol === 'SOL'
        ? await getSolBalance(true, walletPublicKey).catch(() => 0)
        : await getTokenBalance(targetToken.mint, true, walletPublicKey).catch(() => 0);

      const quoteBal = quoteToken.symbol === 'SOL'
        ? await getSolBalance(true, walletPublicKey).catch(() => 0)
        : await getTokenBalance(quoteToken.mint, true, walletPublicKey).catch(() => 0);

      setBaseBalance(baseBal || 0);
      setQuoteBalance(quoteBal || 0);
    } catch (_) {}
  }, [walletPublicKey, targetToken, quoteToken]);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  // ── جلب الأسعار + حقن الأيقونات الديناميكية ────────────────────
  useEffect(() => {
    let mounted = true;
    setPricesLoading(true);

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('price_fetch_timeout')), 8000)
    );

    Promise.race([getJupiterMarketData(), timeoutPromise])
      .then(list => {
        if (!mounted) return;
        const targetTk = list.find(d => d.mint === targetToken.mint);
        const quoteTk  = list.find(d => d.mint === quoteToken.mint);
        const isStable = quoteToken.symbol === 'USDC' || quoteToken.symbol === 'USDT';

        setTokenPrice(targetTk?.current_price || 0);
        setQuoteTokenPrice(quoteTk?.current_price || (isStable ? 1 : 0));

        // ✅ حقن الأيقونات المُحدَّثة في قائمة عملات التسعير
        const enriched = QUOTE_TOKENS.map(qt => {
          const found = list.find(d => d.mint === qt.mint);
          return { ...qt, image: found?.image || qt.image || null };
        });
        setQuoteTokensList(enriched);

        // تحديث الـ quoteToken الحالي بنسخته المُحدَّثة (تحتوي على الصورة)
        const current = enriched.find(q => q.mint === quoteToken.mint);
        if (current) setQuoteToken(current);
      })
      .catch(() => {
        if (mounted) { setTokenPrice(0); setQuoteTokenPrice(0); }
      })
      .finally(() => { if (mounted) setPricesLoading(false); });

    return () => { mounted = false; };
  }, [targetToken.mint, quoteToken.mint, quoteToken.symbol]);

  // ── MAX ────────────────────────────────────────────────────────
  const handleMax = () => {
    let max = inputBalance;
    if (inputToken.symbol === 'SOL') max = Math.max(0, max - SOL_RESERVE);
    setAmount(max > 0 ? max.toString() : '0');
  };

  const handlePercent = (pct) => {
    let bal = inputBalance;
    if (inputToken.symbol === 'SOL') bal = Math.max(0, bal - SOL_RESERVE);
    const val = bal * pct;
    setAmount(val > 0 ? val.toFixed(6) : '0');
  };

  const pricesReady = tokenPrice > 0 && quoteTokenPrice > 0;

  const estimateOutput = () => {
    if (!pricesReady) return null;
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return 0;
    if (side === 'buy') {
      return (amt * quoteTokenPrice) / tokenPrice;
    } else {
      return (amt * tokenPrice) / quoteTokenPrice;
    }
  };

  // ── التحقق قبل التنفيذ ────────────────────────────────────────
  const validate = () => {
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) { Alert.alert(t('error'), t('trade_execution.enter_amount')); return null; }
    if (amt > inputBalance) { Alert.alert(t('error'), t('trading_errors.insufficient_balance')); return null; }
    if (!walletPublicKey)  { Alert.alert(t('error'), t('no_wallet')); return null; }
    if (inputToken.symbol === 'SOL' && amt + SOL_RESERVE > inputBalance) {
      Alert.alert(t('error'), t('trading_errors.insufficient_balance'));
      return null;
    }
    return amt;
  };

  const getFriendlyError = (rawMsg) => {
    const msg = (rawMsg || '').toString();
    if (msg === 'INSUFFICIENT_BALANCE' || msg.includes('insufficient_balance') || msg.includes('Insufficient balance')) {
      return t('trading_errors.insufficient_balance');
    }
    if (msg === 'TOKEN_NOT_TRADABLE' || msg.includes('TOKEN_NOT_TRADABLE') || msg.includes('is not tradable')) {
      return t('trading_errors.token_not_tradable');
    }
    if (msg === 'NO_ROUTE' || msg.includes('NO_ROUTES') || msg.includes('no route')) {
      return t('trading_errors.no_route');
    }
    if (msg.includes('Network') || msg.includes('timeout') || msg.includes('fetch') || msg.includes('انتهت مهلة')) {
      return t('trading_errors.network');
    }
    return t('trading_errors.general');
  };

  // ── التنفيذ ────────────────────────────────────────────────────
  const handleExecute = async () => {
    const amt = validate();
    if (!amt) return;

    const rawIn = Math.round(amt * Math.pow(10, inputToken.decimals));
    const title = side === 'buy'
      ? t('trade_execution.confirm_buy_title')
      : t('trade_execution.confirm_sell_title');

    const message = side === 'buy'
      ? t('trade_execution.confirm_buy_message', {
          inAmount:  fmtAmount(amt),
          inSymbol:  inputToken.symbol,
          outSymbol: outputToken.symbol,
        })
      : t('trade_execution.confirm_sell_message', {
          inAmount:  fmtAmount(amt),
          inSymbol:  inputToken.symbol,
          outSymbol: outputToken.symbol,
        });

    Alert.alert(title, message, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('confirm'),
        onPress: async () => {
          try {
            setExecuting(true);

            const sig = await executeMarketSwap({
              inputMint:   inputToken.mint,
              outputMint:  outputToken.mint,
              amount:      rawIn,
              walletPublicKey,
              activeIndex: activeAccountIndex,
            });

            await addNotification({
              type:       NOTIF_TYPES.SWAP,
              titleKey:   'notif_swap_title',
              messageKey: 'notif_swap_message',
              params: {
                fromAmount: fmtAmount(amt),
                fromSymbol: inputToken.symbol,
                toAmount:   '✓',
                toSymbol:   outputToken.symbol,
              },
              data: {
                signature:  sig,
                fromToken:  inputToken.symbol,
                toToken:    outputToken.symbol,
                fromAmount: amt,
                side,
              },
            });

            setAmount('');
            await fetchBalances();

            Alert.alert(
              t('success'),
              `✅ ${t('trade_success')}\n${sig.slice(0,8)}...${sig.slice(-4)}`,
              [{ text: t('ok'), onPress: () => navigation.goBack() }]
            );
          } catch (e) {
            Alert.alert(t('error'), getFriendlyError(e?.message));
          } finally {
            setExecuting(false);
          }
        },
      },
    ]);
  };

  // ── عرض ────────────────────────────────────────────────────────
  const sideColor = side === 'buy' ? C.success : C.error;
  const estimatedOutput = estimateOutput();

  return (
    <SafeAreaView style={[S.root, { backgroundColor: C.bg, paddingTop: Platform.OS === 'ios' ? 0 : insets.top }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[S.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[S.iconBtn, { backgroundColor: C.card2, borderColor: C.border, borderWidth: 1 }]}
          >
            <Ionicons name="close" size={18} color={C.text} />
          </TouchableOpacity>

          <View style={S.headerCenter}>
            <SafeImage uri={targetToken.image} size={22} />
            <Text style={[S.headerSym, { color: C.text }]}>
              {targetToken.symbol} / {quoteToken.symbol}
            </Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          {/* Tabs: Buy / Sell */}
          <View style={[S.tabsRow, { backgroundColor: C.card2, marginHorizontal: 16, marginTop: 16 }]}>
            {[
              { id:'buy',  label: t('buy'),  color: C.success, icon: 'trending-up'   },
              { id:'sell', label: t('sell'), color: C.error,   icon: 'trending-down' },
            ].map(item => {
              const active = side === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => { setSide(item.id); setAmount(''); }}
                  style={[S.tabBtn, active && { backgroundColor: item.color }]}
                >
                  <Ionicons name={item.icon} size={15} color={active ? '#FFF' : C.muted} />
                  <Text style={[S.tabTxt, { color: active ? '#FFF' : C.muted }]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Amount Card */}
          <View style={[S.amountCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={S.amountHeader}>
              <Text style={[S.amountLabel, { color: C.muted }]}>
                {side === 'buy'
                  ? t('trade_execution.amount_in_quote')
                  : t('trade_execution.amount_in_base')}
              </Text>
              <TouchableOpacity onPress={handleMax}>
                <Text style={[S.maxBtn, { color: primaryColor }]}>{t('max')}</Text>
              </TouchableOpacity>
            </View>

            <View style={S.amountRow}>
              <TextInput
                style={[S.amountInput, { color: C.text }]}
                value={amount}
                onChangeText={(txt) => setAmount(txt.replace(/,/g, '.'))}
                placeholder="0.00"
                placeholderTextColor={C.muted}
                keyboardType="decimal-pad"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[S.tokenPill, { backgroundColor: C.card2, borderColor: C.border }]}
                onPress={() => side === 'buy' ? setQuoteModal(true) : null}
                disabled={side === 'sell'}
                activeOpacity={side === 'buy' ? 0.7 : 1}
              >
                <SafeImage uri={inputToken.image} size={22} />
                <Text style={[S.tokenPillTxt, { color: C.text }]}>{inputToken.symbol}</Text>
                {side === 'buy' && <Ionicons name="chevron-down" size={13} color={C.muted} />}
              </TouchableOpacity>
            </View>

            <View style={S.balanceRow}>
              <Ionicons name="wallet-outline" size={12} color={C.muted} />
              <Text style={[S.balanceTxt, { color: C.muted }]}>
                {t('available_balance')}: {fmtAmount(inputBalance)} {inputToken.symbol}
              </Text>
            </View>
          </View>

          {/* Quick Percentages */}
          <View style={S.quickRow}>
            {[
              { label:'25%', pct:0.25 },
              { label:'50%', pct:0.50 },
              { label:'75%', pct:0.75 },
              { label: t('max'), pct:1   },
            ].map(item => (
              <TouchableOpacity
                key={item.label}
                style={[S.quickBtn, { backgroundColor: C.card, borderColor: C.border }]}
                onPress={() => handlePercent(item.pct)}
              >
                <Text style={[S.quickBtnTxt, { color: C.text }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Output Estimate */}
          <View style={[S.outputCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[S.outputLabel, { color: C.muted }]}>{t('you_receive')} ≈</Text>
            <View style={S.outputRow}>
              {pricesLoading ? (
                <ActivityIndicator size="small" color={primaryColor} />
              ) : (
                <Text style={[S.outputValue, { color: C.text }]} numberOfLines={1}>
                  {estimatedOutput === null ? '—' : fmtAmount(estimatedOutput)}
                </Text>
              )}
              <View style={[S.tokenPill, { backgroundColor: C.card2, borderColor: C.border }]}>
                <SafeImage uri={outputToken.image} size={20} />
                <Text style={[S.tokenPillTxt, { color: C.text }]}>{outputToken.symbol}</Text>
              </View>
            </View>
          </View>

          {/* Fee */}
          <View style={[S.feeRow, { borderColor: C.border }]}>
            <Text style={[S.feeLabel, { color: C.muted }]}>
              {t('platform_fee_label', { defaultValue: 'رسوم المنصة' })}
            </Text>
            <Text style={[S.feeValue, { color: C.text }]}>
              {PLATFORM_FEE_SOL} SOL
            </Text>
          </View>

          {/* Execute */}
          <TouchableOpacity
            style={[
              S.executeBtn,
              { backgroundColor: sideColor },
              (executing || !amount || parseFloat(amount) <= 0) && { opacity: 0.6 },
            ]}
            onPress={handleExecute}
            disabled={executing || !amount || parseFloat(amount) <= 0}
            activeOpacity={0.85}
          >
            {executing ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Ionicons
                  name={side === 'buy' ? 'trending-up' : 'trending-down'}
                  size={20}
                  color="#FFF"
                />
                <Text style={S.executeBtnTxt}>
                  {side === 'buy'
                    ? `${t('buy')} ${targetToken.symbol}`
                    : `${t('sell')} ${targetToken.symbol}`}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={[S.footNote, { color: C.muted }]}>{t('powered_by_jupiter')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Quote Currency Modal */}
      <Modal
        visible={quoteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setQuoteModal(false)}
      >
        <TouchableOpacity
          style={[S.modalOverlay, { paddingBottom: Math.max(insets.bottom, 20) }]}
          activeOpacity={1}
          onPress={() => setQuoteModal(false)}
        >
          <View style={[S.modalBox, { backgroundColor: C.card }]}>
            <View style={[S.modalHandle, { backgroundColor: C.border }]} />

            <View style={S.modalHeader}>
              <TouchableOpacity
                onPress={() => setQuoteModal(false)}
                style={[S.modalCloseBtn, { backgroundColor: C.card2 }]}
              >
                <Ionicons name="close" size={18} color={C.text} />
              </TouchableOpacity>
              <Text style={[S.modalTitle, { color: C.text, marginBottom: 0 }]}>
                {t('select_quote_currency')}
              </Text>
              <View style={{ width: 36 }} />
            </View>

            {quoteTokensList.map(qt => (
              <TouchableOpacity
                key={qt.symbol}
                style={[
                  S.quoteOption,
                  { borderColor: C.border },
                  qt.symbol === quoteToken.symbol && {
                    borderColor: primaryColor,
                    backgroundColor: primaryColor + '12',
                  },
                ]}
                onPress={() => {
                  setQuoteToken(qt);
                  setQuoteModal(false);
                  setAmount('');
                }}
              >
                <SafeImage uri={qt.image} size={32} />
                <Text style={[S.quoteOptionTxt, { color: C.text }]}>{qt.symbol}</Text>
                {qt.symbol === quoteToken.symbol && (
                  <Ionicons name="checkmark-circle" size={18} color={primaryColor} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root:{ flex:1 },
  header:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between',
           paddingHorizontal:16, paddingVertical:12, borderBottomWidth:1 },
  iconBtn:{ width:40, height:40, borderRadius:12, justifyContent:'center', alignItems:'center' },
  headerCenter:{ flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8 },
  headerSym:{ fontSize:16, fontWeight:'800' },

  tabsRow:{ flexDirection:'row', borderRadius:14, padding:4 },
  tabBtn:{ flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center',
           paddingVertical:10, borderRadius:10, gap:6 },
  tabTxt:{ fontSize:14, fontWeight:'800' },

  amountCard:{ margin:16, marginBottom:0, padding:16, borderRadius:18, borderWidth:1 },
  amountHeader:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  amountLabel:{ fontSize:12, fontWeight:'700' },
  maxBtn:{ fontSize:12, fontWeight:'800' },
  amountRow:{ flexDirection:'row', alignItems:'center', gap:10 },
  amountInput:{ flex:1, fontSize:28, fontWeight:'800', paddingVertical:0 },
  tokenPill:{ flexDirection:'row', alignItems:'center', paddingHorizontal:10, paddingVertical:6,
              borderRadius:14, borderWidth:1, gap:6 },
  tokenPillTxt:{ fontSize:13, fontWeight:'800' },
  balanceRow:{ flexDirection:'row', alignItems:'center', gap:5, marginTop:10 },
  balanceTxt:{ fontSize:11, fontWeight:'600' },

  quickRow:{ flexDirection:'row', gap:8, paddingHorizontal:16, marginTop:14 },
  quickBtn:{ flex:1, paddingVertical:10, borderRadius:12, borderWidth:1, alignItems:'center' },
  quickBtnTxt:{ fontSize:12, fontWeight:'700' },

  outputCard:{ margin:16, marginBottom:8, padding:16, borderRadius:18, borderWidth:1 },
  outputLabel:{ fontSize:12, fontWeight:'700', marginBottom:8 },
  outputRow:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', gap:10 },
  outputValue:{ fontSize:24, fontWeight:'800', flex:1 },

  feeRow:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center',
           marginHorizontal:16, paddingVertical:12, borderTopWidth:1 },
  feeLabel:{ fontSize:12, fontWeight:'600' },
  feeValue:{ fontSize:12, fontWeight:'800' },

  executeBtn:{ flexDirection:'row', alignItems:'center', justifyContent:'center',
               marginHorizontal:16, marginTop:12, paddingVertical:16, borderRadius:16, gap:8,
               shadowColor:'#000', shadowOpacity:0.15, shadowRadius:10, elevation:4 },
  executeBtnTxt:{ color:'#FFF', fontSize:16, fontWeight:'800' },
  footNote:{ textAlign:'center', fontSize:10, marginTop:12 },

  modalOverlay:{ flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end', paddingHorizontal:16 },
  modalBox:{ borderRadius:24, padding:20, paddingTop:12, width:'100%' },
  modalHandle:{ width:36, height:4, borderRadius:2, alignSelf:'center', marginBottom:16 },
  modalHeader:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:16 },
  modalCloseBtn:{ width:36, height:36, borderRadius:10, justifyContent:'center', alignItems:'center' },
  modalTitle:{ fontSize:18, fontWeight:'800', textAlign:'center', flex:1 },
  quoteOption:{ flexDirection:'row', alignItems:'center', padding:14, borderRadius:14,
                borderWidth:1, marginBottom:8, gap:12 },
  quoteOptionTxt:{ flex:1, fontSize:15, fontWeight:'700' },
});
