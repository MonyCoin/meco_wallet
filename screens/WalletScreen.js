import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { Ionicons } from '@expo/vector-icons';
import { getSolBalance, getTokenAccounts } from '../services/heliusService';

const CURRENCIES = ['SOL', 'USDT', 'USDC', 'MECO'];
const CG_IDS = { SOL: 'solana', USDT: 'tether', USDC: 'usd-coin', MECO: null };

const TOKEN_MINTS = {
  'Es9vMFrzaCERc8Foa8XfRduKiSfrhEL5c7qr2WXXBWY5': 'USDT',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
  '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i': 'MECO',
};

export default function WalletScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const theme = useAppStore(state => state.theme);
  const primaryColor = useAppStore(state => state.primaryColor);
  const isDark = theme === 'dark';
  const bg = isDark ? '#000' : '#fff';
  const fg = isDark ? '#fff' : '#000';

  const [walletAddress, setWalletAddress] = useState('');
  const [walletName, setWalletName] = useState('');
  const [currency, setCurrency] = useState('SOL');
  const [prices, setPrices] = useState({});
  const [showCurrencyList, setShowCurrencyList] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [balances, setBalances] = useState({ SOL: 0, USDT: 0, USDC: 0, MECO: 0 });

  const loadPrices = async () => {
    try {
      const ids = Object.values(CG_IDS).filter(Boolean).join(',');
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
      const data = await res.json();
      const p = {};
      for (let cur of CURRENCIES) {
        if (CG_IDS[cur] && data[CG_IDS[cur]]) {
          p[cur] = data[CG_IDS[cur]].usd;
        } else if (cur === 'MECO') {
          p[cur] = 0.002;
        }
      }
      setPrices(p);
    } catch {}
  };

  const loadWalletInfo = async () => {
    try {
      const addr = await SecureStore.getItemAsync('wallet_public_key');
      const name = await AsyncStorage.getItem('wallet_name');

      if (addr) {
        setWalletAddress(addr);
        const sol = await getSolBalance(addr);
        const tokens = await getTokenAccounts(addr);

        const balancesObj = { SOL: sol, USDT: 0, USDC: 0, MECO: 0 };
        tokens.forEach((token) => {
          const symbol = TOKEN_MINTS[token.mint];
          if (symbol) {
            balancesObj[symbol] = token.amount;
          }
        });

        setBalances(balancesObj);
      }

      if (name) setWalletName(name);
    } catch (err) {
      console.warn('Wallet info load error:', err.message);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadPrices(), loadWalletInfo()]);
    setRefreshing(false);
  };

  const displayBalance = () => {
    const value = balances[currency];
    if (value == null) return '...';
    return `${value.toFixed(4)} ${currency}`;
  };

  const copyToClipboard = () => {
    if (walletAddress) {
      Clipboard.setStringAsync(walletAddress);
      Alert.alert(t('copied'), t('wallet_address_copied'));
    }
  };

  const handleSaveWalletName = async () => {
    await AsyncStorage.setItem('wallet_name', walletName);
    setModalVisible(false);
  };

  useEffect(() => {
    handleRefresh();
  }, []);

  return (
    <ScrollView
      style={{ backgroundColor: bg, flex: 1 }}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <View style={[styles.card, { backgroundColor: isDark ? '#1e1e1e' : '#f5f5f5' }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: fg }]}>{t('balance')}</Text>
          <TouchableOpacity onPress={() => setModalVisible(true)}>
            <Ionicons name="ellipsis-vertical" size={22} color={fg} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.balanceValue, { color: primaryColor }]}>
          {displayBalance()}
        </Text>

        <View style={styles.currencyRow}>
          <TouchableOpacity onPress={() => setShowCurrencyList(prev => !prev)}>
            <Ionicons name="chevron-down-circle-outline" size={20} color={fg} />
          </TouchableOpacity>
          <Text style={[styles.currencyLabel, { color: fg }]}>{currency}</Text>
        </View>

        {showCurrencyList && (
          <View style={[styles.currencyList, { backgroundColor: isDark ? '#1e1e1e' : '#eee' }]}>
            {CURRENCIES.map(cur => (
              <TouchableOpacity
                key={cur}
                style={styles.currencyItem}
                onPress={() => {
                  setCurrency(cur);
                  setShowCurrencyList(false);
                }}
              >
                <Text style={[styles.currencyText, { color: fg }]}>{cur}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.walletInfo}>
          <Text style={[styles.walletName, { color: fg }]}>{walletName || t('my_wallet')}</Text>
          {walletAddress && (
            <TouchableOpacity onPress={copyToClipboard} style={{ marginLeft: 6 }}>
              <Ionicons name="copy-outline" size={18} color={primaryColor} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        {['Send', 'Receive', 'Swap'].map((screen, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.squareButton, { backgroundColor: primaryColor }]}
            onPress={() => navigation.navigate(screen)}
          >
            <Ionicons
              name={screen === 'Send' ? 'arrow-up' : screen === 'Receive' ? 'arrow-down' : 'swap-horizontal'}
              size={26}
              color="#fff"
            />
            <Text style={styles.actionText}>{t(screen.toLowerCase())}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1e1e1e' : '#fff' }]}>
            <Text style={{ marginBottom: 10, color: fg }}>{t('enter_wallet_name')}</Text>
            <TextInput
              style={[styles.input, { color: fg, borderColor: fg }]}
              value={walletName}
              onChangeText={setWalletName}
              placeholder={t('wallet_name_placeholder') || 'My Wallet'}
              placeholderTextColor="#888"
            />
            <TouchableOpacity style={[styles.modalButton, { backgroundColor: primaryColor }]} onPress={handleSaveWalletName}>
              <Text style={{ color: '#fff' }}>{t('save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 20, paddingBottom: 40, alignItems: 'center' },
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: 'bold' },
  balanceValue: { fontSize: 28, fontWeight: 'bold', marginVertical: 12 },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  currencyLabel: { fontSize: 16, marginLeft: 6 },
  currencyList: {
    width: '60%',
    borderRadius: 8,
    marginBottom: 12,
  },
  currencyItem: {
    padding: 8,
    alignItems: 'center',
  },
  currencyText: { fontSize: 14 },
  walletInfo: { flexDirection: 'row', alignItems: 'center' },
  walletName: { fontSize: 16, fontWeight: 'bold' },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  squareButton: {
    width: 80,
    height: 80,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  actionText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
    marginTop: 4,
  },

  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#000000aa',
    padding: 20,
  },
  modalContent: {
    padding: 20,
    borderRadius: 12,
  },
  input: {
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  modalButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
});
