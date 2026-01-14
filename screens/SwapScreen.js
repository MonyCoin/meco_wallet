import React, { useEffect, useState } from 'react';
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

  const isDark = theme === 'dark';
  const bg = isDark ? '#121212' : '#F9F9F9';
  const fg = isDark ? '#FFF' : '#111';
  const selBg = isDark ? '#1E1E1E' : '#EEEEEE';

  const [tokens, setTokens] = useState([]);
  const [filteredTokens, setFilteredTokens] = useState([]);

  const [fromToken, setFromToken] = useState(null);
  const [toToken, setToToken] = useState(null);

  const [amount, setAmount] = useState('');
  const [expectedAmount, setExpectedAmount] = useState(null);

  const [loadingQuote, setLoadingQuote] = useState(false);
  const [loadingSwap, setLoadingSwap] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [selecting, setSelecting] = useState('from');
  const [searchText, setSearchText] = useState('');

  /* =========================
     تحميل العملات
  ========================= */
  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    try {
      const list = await getJupiterTokens();
      setTokens(list);
      setFilteredTokens(list);

      // لو جاي من Market
      if (route.params?.fromToken) {
        setFromToken(route.params.fromToken);
      }
    } catch {
      Alert.alert('⚠️', 'تعذر جلب العملات');
    }
  };

  const getToken = address =>
    tokens.find(t => t.address === address);

  /* =========================
     تحديث السعر (Quote)
  ========================= */
  useEffect(() => {
    if (fromToken && toToken && Number(amount) > 0) {
      updateExpectedAmount();
    } else {
      setExpectedAmount(null);
    }
  }, [fromToken, toToken, amount]);

  const updateExpectedAmount = async () => {
    try {
      setLoadingQuote(true);

      const from = getToken(fromToken);
      const to = getToken(toToken);
      if (!from || !to) return;

      const baseAmount = amountToBaseUnits(
        Number(amount),
        from.decimals
      );

      const quote = await fetchQuoteViaRest(
        fromToken,
        toToken,
        baseAmount
      );

      const out = baseUnitsToAmount(
        Number(quote.outAmount),
        to.decimals
      );

      setExpectedAmount(out);
    } catch {
      setExpectedAmount(null);
    } finally {
      setLoadingQuote(false);
    }
  };

  /* =========================
     تنفيذ السواب
  ========================= */
  const signAndSend = async txBuffer => {
    const web3 = await import('@solana/web3.js');
    const secret = await SecureStore.getItemAsync('wallet_private_key');

    const keypair = web3.Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(secret))
    );

    const connection = new web3.Connection(RPC);
    const tx = web3.Transaction.from(txBuffer);

    tx.partialSign(keypair);
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig, 'confirmed');

    return sig;
  };

  const handleSwap = async () => {
    try {
      if (!fromToken || !toToken || !amount)
        return Alert.alert('خطأ', 'أكمل جميع الحقول');

      setLoadingSwap(true);

      const from = getToken(fromToken);
      const baseAmount = amountToBaseUnits(
        Number(amount),
        from.decimals
      );

      const quote = await fetchQuoteViaRest(
        fromToken,
        toToken,
        baseAmount
      );

      const pub = await SecureStore.getItemAsync('wallet_public_key');
      const res = await executeSwapViaRest(
        quote,
        pub,
        signAndSend
      );

      if (!res.success) throw new Error(res.error);

      Alert.alert('✅ تم تنفيذ السواب', res.txid);
      setAmount('');
      setExpectedAmount(null);
    } catch (e) {
      Alert.alert('خطأ', e.message);
    } finally {
      setLoadingSwap(false);
    }
  };

  /* =========================
     اختيار العملات
  ========================= */
  const openSelector = target => {
    setSelecting(target);
    setSearchText('');
    setFilteredTokens(tokens);
    setModalVisible(true);
  };

  const selectToken = address => {
    selecting === 'from'
      ? setFromToken(address)
      : setToToken(address);

    setModalVisible(false);
  };

  const swapTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setAmount('');
    setExpectedAmount(null);
  };

  /* =========================
     UI
  ========================= */
  return (
    <ScrollView style={{ backgroundColor: bg }} contentContainerStyle={styles.container}>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.box, { backgroundColor: selBg }]}
          onPress={() => openSelector('from')}
        >
          <Text style={{ color: fg }}>
            {getToken(fromToken)?.symbol || t('select_token')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={swapTokens}>
          <Ionicons name="swap-horizontal" size={32} color={primaryColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.box, { backgroundColor: selBg }]}
          onPress={() => openSelector('to')}
        >
          <Text style={{ color: fg }}>
            {getToken(toToken)?.symbol || t('select_token')}
          </Text>
        </TouchableOpacity>
      </View>

      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder={t('enter_amount')}
        keyboardType="numeric"
        style={[styles.input, { color: fg }]}
      />

      {loadingQuote && <ActivityIndicator color={primaryColor} />}
      {expectedAmount !== null && (
        <Text style={{ color: fg, marginBottom: 10 }}>
          {t('expected_output')}: {expectedAmount.toFixed(6)}
        </Text>
      )}

      <TouchableOpacity
        style={[styles.button, { backgroundColor: primaryColor }]}
        onPress={handleSwap}
        disabled={loadingSwap}
      >
        {loadingSwap ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{t('execute_swap')}</Text>
        )}
      </TouchableOpacity>

      {/* ===== Modal ===== */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.listContainer, { backgroundColor: bg }]}>
            <Text style={[styles.title, { color: fg }]}>
              {selecting === 'from' ? t('from') : t('to')}
            </Text>

            <TextInput
              placeholder={t('search')}
              value={searchText}
              onChangeText={text => {
                setSearchText(text);
                setFilteredTokens(
                  tokens.filter(
                    t =>
                      t.symbol.toLowerCase().includes(text.toLowerCase()) ||
                      t.name.toLowerCase().includes(text.toLowerCase())
                  )
                );
              }}
              style={[styles.search, { color: fg }]}
            />

            <FlatList
              data={filteredTokens}
              keyExtractor={item => item.address}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.item}
                  onPress={() => selectToken(item.address)}
                >
                  <Image source={{ uri: item.logoURI }} style={styles.icon} />
                  <Text style={{ color: fg }}>{item.symbol}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

/* =========================
   Styles
========================= */
const styles = StyleSheet.create({
  container: { padding: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  box: {
    padding: 14,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    padding: 14,
    borderRadius: 8,
    marginVertical: 12,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000080',
    justifyContent: 'center',
  },
  listContainer: {
    margin: 20,
    borderRadius: 12,
    padding: 12,
    maxHeight: '70%',
  },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  search: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  icon: { width: 28, height: 28, marginRight: 10 },
});
