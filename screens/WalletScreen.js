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
  Dimensions,
  Animated,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { Ionicons } from '@expo/vector-icons';
import { getSolBalance, getTokenAccounts } from '../services/heliusService';

const { width } = Dimensions.get('window');
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
  
  // ألوان ثيم داكن
  const colors = {
    background: isDark ? '#0A0A0F' : '#FFFFFF',
    card: isDark ? '#1A1A2E' : '#F8FAFD',
    text: isDark ? '#FFFFFF' : '#1A1A2E',
    textSecondary: isDark ? '#A0A0B0' : '#6B7280',
    border: isDark ? '#2A2A3E' : '#E5E7EB',
    gradientStart: primaryColor,
    gradientEnd: isDark ? '#2A2A3E' : '#FFFFFF',
  };

  const [walletAddress, setWalletAddress] = useState('');
  const [walletName, setWalletName] = useState(t('my_wallet'));
  const [currency, setCurrency] = useState('SOL');
  const [prices, setPrices] = useState({});
  const [showCurrencyList, setShowCurrencyList] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [balances, setBalances] = useState({ SOL: 0, USDT: 0, USDC: 0, MECO: 0 });
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  // تأثيرات عند التحميل
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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
    if (value == null) return '0.0000';
    return `${value.toFixed(4)} ${currency}`;
  };

  const getBalanceValue = () => {
    const value = balances[currency];
    if (!value || !prices[currency]) return '0.00';
    return (value * prices[currency]).toFixed(2);
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
      style={{ backgroundColor: colors.background, flex: 1 }}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={handleRefresh}
          tintColor={primaryColor}
          colors={[primaryColor]}
        />
      }
    >
      {/* Card الرئيسي */}
      <Animated.View 
        style={[
          styles.card, 
          { 
            backgroundColor: colors.card,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }
        ]}
      >
        {/* Header مع اسم المحفظة وأيقونة النسخ */}
        <View style={styles.headerRow}>
          <View style={styles.walletHeader}>
            <Text style={[styles.walletName, { color: colors.text }]}>{walletName}</Text>
            <TouchableOpacity 
              onPress={copyToClipboard}
              style={[styles.copyButton, { backgroundColor: isDark ? '#2A2A3E' : '#F1F5F9' }]}
            >
              <Ionicons name="copy-outline" size={18} color={primaryColor} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            onPress={() => setModalVisible(true)}
            style={[styles.iconButton, { backgroundColor: isDark ? '#2A2A3E' : '#F1F5F9' }]}
          >
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* الرصيد الرئيسي */}
        <View style={styles.balanceSection}>
          <Text style={[styles.balanceTitle, { color: colors.textSecondary }]}>
            {t('your_balance')}
          </Text>
          <Text style={[styles.balanceValue, { color: primaryColor }]}>
            {displayBalance()}
          </Text>
          <Text style={[styles.usdValue, { color: colors.textSecondary }]}>
            ≈ ${getBalanceValue()} USD
          </Text>
        </View>

        {/* محدد العملة */}
        <TouchableOpacity 
          onPress={() => setShowCurrencyList(prev => !prev)}
          style={[styles.currencySelector, { backgroundColor: isDark ? '#2A2A3E' : '#F1F5F9' }]}
        >
          <View style={[styles.currencyBadge, { backgroundColor: primaryColor }]}>
            <Text style={[styles.currencyText, { color: '#FFFFFF' }]}>{currency}</Text>
          </View>
          <View style={styles.currencyInfo}>
            <Text style={[styles.currencyLabel, { color: colors.text }]}>{t('change_currency')}</Text>
            <Ionicons 
              name={showCurrencyList ? "chevron-up" : "chevron-down"} 
              size={16} 
              color={colors.textSecondary} 
            />
          </View>
        </TouchableOpacity>

        {/* قائمة العملات المنسدلة */}
        {showCurrencyList && (
          <View style={[styles.currencyList, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {CURRENCIES.map(cur => (
              <TouchableOpacity
                key={cur}
                style={[
                  styles.currencyItem,
                  currency === cur && { backgroundColor: isDark ? '#2A2A3E' : '#F1F5F9' }
                ]}
                onPress={() => {
                  setCurrency(cur);
                  setShowCurrencyList(false);
                }}
              >
                <View style={styles.currencyItemContent}>
                  <View style={[styles.currencyBadge, { backgroundColor: primaryColor }]}>
                    <Text style={styles.currencyBadgeText}>{cur.charAt(0)}</Text>
                  </View>
                  <View style={styles.currencyInfo}>
                    <Text style={[styles.currencyName, { color: colors.text }]}>{cur}</Text>
                    <Text style={[styles.currencyAmount, { color: colors.textSecondary }]}>
                      {balances[cur]?.toFixed(4) || '0.0000'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Animated.View>

      {/* أزرار الإجراءات */}
      <View style={styles.actionsSection}>
        {[
          { icon: 'arrow-up-outline', label: t('send'), screen: 'Send' },
          { icon: 'arrow-down-outline', label: t('receive'), screen: 'Receive' },
          { icon: 'swap-horizontal', label: t('swap'), screen: 'Swap' },
        ].map((action, i) => (
          <TouchableOpacity
            key={i}
            style={styles.actionButton}
            onPress={() => navigation.navigate(action.screen)}
          >
            <View style={[styles.actionIcon, { backgroundColor: primaryColor + '20' }]}>
              <Ionicons name={action.icon} size={24} color={primaryColor} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* المعاملات الأخيرة */}
      <View style={styles.transactionsSection}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('recent_transactions')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('TransactionHistory')}>
            <Text style={[styles.viewAllText, { color: primaryColor }]}>{t('view_all')}</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.transactionsPlaceholder, { backgroundColor: colors.card }]}>
          <Ionicons name="receipt-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
            {t('no_transactions_yet')}
          </Text>
          <Text style={[styles.placeholderSubtext, { color: colors.textSecondary }]}>
            {t('your_transactions_will_appear_here')}
          </Text>
        </View>
      </View>

      {/* مودال تعديل اسم المحفظة */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.modalContainer,
              { 
                backgroundColor: colors.card,
                transform: [{ scale: fadeAnim }]
              }
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('edit_wallet_name')}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
              {t('enter_a_custom_name_for_your_wallet')}
            </Text>
            
            <TextInput
              style={[styles.input, { 
                color: colors.text, 
                borderColor: colors.border,
                backgroundColor: isDark ? '#2A2A3E' : '#F1F5F9'
              }]}
              value={walletName}
              onChangeText={setWalletName}
              placeholder={t('enter_wallet_name')}
              placeholderTextColor={colors.textSecondary}
              autoFocus
              maxLength={20}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton, { backgroundColor: primaryColor }]}
                onPress={handleSaveWalletName}
              >
                <Text style={styles.saveButtonText}>{t('save_changes')}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { 
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  walletName: {
    fontSize: 20,
    fontWeight: '700',
    marginRight: 10,
  },
  copyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceSection: {
    alignItems: 'center',
    marginVertical: 16,
  },
  balanceTitle: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  usdValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  currencySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 16,
  },
  currencyBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
    marginRight: 12,
  },
  currencyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  currencyInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currencyLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  currencyList: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    padding: 8,
  },
  currencyItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  currencyItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyBadgeText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  currencyName: {
    fontSize: 16,
    fontWeight: '600',
  },
  currencyAmount: {
    fontSize: 12,
  },
  actionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  actionButton: {
    alignItems: 'center',
    width: (width - 64) / 3,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  transactionsSection: {
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  transactionsPlaceholder: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
  placeholderSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 10,
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
  modalDescription: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
