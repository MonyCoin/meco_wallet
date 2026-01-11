import React, { useState, useEffect } from 'react';
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
import { fetchQuoteViaRest, executeSwapViaRest } from '../services/jupiterService';

const RPC = 'https://api.mainnet-beta.solana.com';
const MECO_ADDRESS = '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i';
const MECO_LOGO =
  'https://raw.githubusercontent.com/saadeh73/meco-project/main/meco-logo.png';
const TOKENS_API_URL = 'https://quote-api.jup.ag/v6/tokens';

export default function SwapScreen() {
  const { t } = useTranslation();
  const theme = useAppStore(s => s.theme);
  const primaryColor = useAppStore(s => s.primaryColor);

  const isDark = theme === 'dark';
  const bg = isDark ? '#121212' : '#F9F9F9';
  const fg = isDark ? '#FFF' : '#111';
  const selBg = isDark ? '#1E1E1E' : '#EEEEEE';

  const [fromToken, setFromToken] = useState(null);
  const [toToken, setToToken] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [filteredTokens, setFilteredTokens] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selecting, setSelecting] = useState('from');
  const [amount, setAmount] = useState('');
  const [expectedAmount, setExpectedAmount] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadTokens();
  }, []);

  useEffect(() => {
    if (fromToken && toToken && Number(amount) > 0) {
      updateExpectedAmount();
    } else {
      setExpectedAmount(null);
      setQuoteError(null);
    }
  }, [fromToken, toToken, amount]);

  /* ================= TOKENS ================= */

  const loadTokens = async () => {
    try {
      const res = await fetch(TOKENS_API_URL);
      const data = await res.json();
      let list = Array.isArray(data) ? data : [];

      if (!list.find(t => t.address === MECO_ADDRESS)) {
        list.unshift({
          address: MECO_ADDRESS,
          symbol: 'MECO',
          name: 'MonyCoin',
          logoURI: MECO_LOGO,
          decimals: 6,
        });
      }

      setTokens(list);
      setFilteredTokens(list);
    } catch (e) {
      Alert.alert('⚠️', 'تعذر جلب العملات');
    }
  };

  const getToken = address => tokens.find(t => t.address === address);

  /* ================= SELECTOR ================= */

  const openSelector = target => {
    setSelecting(target);
    setSearchText('');
    setFilteredTokens(tokens);
    setModalVisible(true);
  };

  const selectToken = address => {
    selecting === 'from' ? setFromToken(address) : setToToken(address);
    setModalVisible(false);
  };

  const swapTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setExpectedAmount(null);
    setAmount('');
  };

  /* ================= QUOTE ================= */

  const updateExpectedAmount = async () => {
    try {
      setQuoteLoading(true);
      setQuoteError(null);

      const from = getToken(fromToken);
      const to = getToken(toToken);
      if (!from || !to) return;

      const amountBaseUnits = Math.floor(
        Number(amount) * Math.pow(10, from.decimals)
      );

      if (amountBaseUnits <= 0) return;

      const quote = await fetchQuoteViaRest(
        fromToken,
        toToken,
        amountBaseUnits
      );

      if (!quote?.outAmount) {
        setExpectedAmount(null);
        setQuoteError(t('no_valid_route'));
        return;
      }

      const out =
        Number(quote.outAmount) / Math.pow(10, to.decimals);

      setExpectedAmount(out);
    } catch (e) {
      setExpectedAmount(null);
      setQuoteError(t('no_valid_route'));
    } finally {
      setQuoteLoading(false);
    }
  };

  /* ================= SWAP ================= */

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
        return Alert.alert('Error', 'Fill all fields');

      setLoading(true);

      const from = getToken(fromToken);
      const amountBaseUnits = Math.floor(
        Number(amount) * Math.pow(10, from.decimals)
      );

      const quote = await fetchQuoteViaRest(
        fromToken,
        toToken,
        amountBaseUnits
      );

      const pub = await SecureStore.getItemAsync('wallet_public_key');
      const res = await executeSwapViaRest(quote, pub, signAndSend);

      if (!res.success) throw new Error(res.error);

      Alert.alert('✅ Swap Successful', res.txid);
      setAmount('');
      setExpectedAmount(null);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ================= UI ================= */

  const renderSelector = () => (
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
                <Image
                  source={{ uri: item.logoURI || MECO_LOGO }}
                  style={styles.icon}
                />
                <Text style={{ color: fg }}>
                  {item.symbol}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  return (
    <ScrollView style={{ backgroundColor: bg }} contentContainerStyle={styles.container}>
      <View style={styles.row}>
        <TouchableOpacity style={[styles.box, { backgroundColor: selBg }]} onPress={() => openSelector('from')}>
          <Text style={{ color: fg }}>
            {getToken(fromToken)?.symbol || t('select_token')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={swapTokens}>
          <Ionicons name="swap-horizontal" size={32} color={primaryColor} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.box, { backgroundColor: selBg }]} onPress={() => openSelector('to')}>
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

      {quoteLoading && <ActivityIndicator color={primaryColor} />}
      {expectedAmount !== null && (
        <Text style={{ color: fg, marginBottom: 10 }}>
          {t('expected_output')}: {expectedAmount.toFixed(6)}
        </Text>
      )}

      <TouchableOpacity style={[styles.button, { backgroundColor: primaryColor }]} onPress={handleSwap}>
        <Text style={styles.buttonText}>{t('execute_swap')}</Text>
      </TouchableOpacity>

      {renderSelector()}
    </ScrollView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { padding: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  box: { padding: 14, borderRadius: 8, flex: 1, alignItems: 'center' },
  input: { borderWidth: 1, padding: 14, borderRadius: 8, marginVertical: 12 },
  button: { padding: 16, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: '#00000080', justifyContent: 'center' },
  listContainer: { margin: 20, borderRadius: 12, padding: 12, maxHeight: '70%' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  search: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  icon: { width: 28, height: 28, marginRight: 10 },
});
