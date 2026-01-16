import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, Modal, FlatList,
  Dimensions, Animated, ScrollView,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import { useRoute } from '@react-navigation/native';
import { getSolBalance, getTokenAccounts } from '../services/heliusService';
import { logTransaction } from '../services/transactionLogger';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const FEE_SOL = 0.001;
const DEV_ADDRESS = 'JCqDixUpY9sEM3ZCKeh8zPr2H36YPeD8n5iixrAu7xxM';

const SUPPORTED_TOKENS = {
  SOL: { name: 'Solana', symbol: 'SOL', mint: null, icon: 'diamond-outline' },
  USDT: {
    name: 'Tether USD',
    symbol: 'USDT',
    mint: 'Es9vMFrzaCERc8Foa8XfRduKiSfrhEL5c7qr2WXXBWY5',
    icon: 'cash-outline'
  },
  MECO: {
    name: 'MECO Token',
    symbol: 'MECO',
    mint: '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i',
    icon: 'rocket-outline'
  },
  USDC: {
    name: 'USD Coin',
    symbol: 'USDC',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    icon: 'wallet-outline'
  },
};

async function isValidSolanaAddress(address) {
  try {
    const web3 = await import('@solana/web3.js');
    const pubKey = new web3.PublicKey(address);
    return web3.PublicKey.isOnCurve(pubKey);
  } catch {
    return false;
  }
}

export default function SendScreen() {
  const { t } = useTranslation();
  const route = useRoute();
  const theme = useAppStore(state => state.theme);
  const primaryColor = useAppStore(state => state.primaryColor);
  const isDark = theme === 'dark';
  
  // ألوان متناسقة مع الثيم
  const colors = {
    background: isDark ? '#0A0A0F' : '#FFFFFF',
    card: isDark ? '#1A1A2E' : '#F8FAFD',
    text: isDark ? '#FFFFFF' : '#1A1A2E',
    textSecondary: isDark ? '#A0A0B0' : '#6B7280',
    border: isDark ? '#2A2A3E' : '#E5E7EB',
    inputBackground: isDark ? '#2A2A3E' : '#FFFFFF',
    error: '#EF4444',
    success: '#10B981',
  };

  const preselected = route?.params?.preselectedToken;
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(preselected || 'SOL');
  const [modalVisible, setModalVisible] = useState(false);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
    
    loadBalance();
  }, [currency]);

  async function loadBalance() {
    try {
      const pub = await SecureStore.getItemAsync('wallet_public_key');
      if (!pub) return;

      if (currency === 'SOL') {
        const sol = await getSolBalance(pub);
        setBalance(sol || 0);
      } else {
        const tokens = await getTokenAccounts(pub);
        const token = tokens.find(t => t.mint === SUPPORTED_TOKENS[currency]?.mint);
        setBalance(token?.amount || 0);
      }
    } catch (err) {
      console.warn('Balance load error:', err.message);
      setBalance(0);
    }
  }

  const handleSend = async () => {
    try {
      if (!recipient || !amount) {
        Alert.alert(t('error'), t('fill_fields'));
        return;
      }

      if (!(await isValidSolanaAddress(recipient))) {
        Alert.alert(t('error'), t('invalid_address'));
        return;
      }

      const myAddress = await SecureStore.getItemAsync('wallet_public_key');
      if (recipient === myAddress) {
        Alert.alert(t('error'), t('cannot_send_to_self'));
        return;
      }

      const num = parseFloat(amount);
      if (isNaN(num) || num <= 0) {
        Alert.alert(t('error'), t('amount_must_be_positive'));
        return;
      }

      const totalAmount = currency === 'SOL' ? num + FEE_SOL : num;
      if (totalAmount > balance) {
        Alert.alert(t('error'), t('insufficient_balance'));
        return;
      }

      setLoading(true);

      const bs58 = await import('bs58');
      const web3 = await import('@solana/web3.js');
      const splToken = await import('@solana/spl-token');

      const secretKeyStr = await SecureStore.getItemAsync('wallet_private_key');
      if (!secretKeyStr) throw new Error('Missing key');

      let parsedKey;
      try {
        parsedKey = Uint8Array.from(JSON.parse(secretKeyStr));
      } catch {
        parsedKey = bs58.default.decode(secretKeyStr);
      }

      const keypair = web3.Keypair.fromSecretKey(parsedKey);
      const fromPubkey = keypair.publicKey;
      const toPubkey = new web3.PublicKey(recipient);
      const devPubkey = new web3.PublicKey(DEV_ADDRESS);
      const connection = new web3.Connection('https://api.mainnet-beta.solana.com');

      if (currency === 'SOL') {
        const tx = new web3.Transaction().add(
          web3.SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports: Math.floor(num * 1e9),
          }),
          web3.SystemProgram.transfer({
            fromPubkey,
            toPubkey: devPubkey,
            lamports: Math.floor(FEE_SOL * 1e9),
          })
        );

        const sig = await connection.sendTransaction(tx, [keypair]);
        await connection.confirmTransaction(sig, 'confirmed');
      } else {
        const mint = new web3.PublicKey(SUPPORTED_TOKENS[currency].mint);
        const fromATA = await splToken.getAssociatedTokenAddress(mint, fromPubkey);
        const toATA = await splToken.getAssociatedTokenAddress(mint, toPubkey);
        const devATA = await splToken.getAssociatedTokenAddress(mint, devPubkey);

        const mintInfo = await splToken.getMint(connection, mint);
        const decimals = mintInfo.decimals || 6;
        const amountToSend = BigInt(Math.floor(num * Math.pow(10, decimals)));
        const devFeeAmount = BigInt(Math.floor(FEE_SOL * Math.pow(10, decimals)));

        const instructions = [];

        const toATAInfo = await connection.getAccountInfo(toATA);
        if (!toATAInfo) {
          instructions.push(
            splToken.createAssociatedTokenAccountInstruction(fromPubkey, toATA, toPubkey, mint)
          );
        }

        const devATAInfo = await connection.getAccountInfo(devATA);
        if (!devATAInfo) {
          instructions.push(
            splToken.createAssociatedTokenAccountInstruction(fromPubkey, devATA, devPubkey, mint)
          );
        }

        instructions.push(
          splToken.createTransferInstruction(fromATA, toATA, fromPubkey, amountToSend),
          splToken.createTransferInstruction(fromATA, devATA, fromPubkey, devFeeAmount)
        );

        const tx = new web3.Transaction().add(...instructions);
        const sig = await connection.sendTransaction(tx, [keypair]);
        await connection.confirmTransaction(sig, 'confirmed');
      }

      await logTransaction({
        type: 'send',
        to: recipient,
        amount: num,
        currency,
        fee: FEE_SOL,
        timestamp: new Date().toISOString(),
      });

      Alert.alert(
        t('success'),
        t('sent_successfully', { amount: num, currency }),
        [
          {
            text: t('ok'),
            onPress: () => {
              setRecipient('');
              setAmount('');
              setModalVisible(false);
              setLoading(false);
              loadBalance();
            }
          }
        ]
      );
    } catch (err) {
      console.error('Send error:', err);
      setLoading(false);
      Alert.alert(t('error'), t('send_failed'));
    }
  };

  const handleMaxAmount = () => {
    if (balance > 0) {
      const maxAmount = currency === 'SOL' ? Math.max(0, balance - FEE_SOL) : balance;
      setAmount(maxAmount.toFixed(6));
    }
  };

  const handlePasteAddress = async () => {
    try {
      const { Clipboard } = await import('expo-clipboard');
      const text = await Clipboard.getStringAsync();
      if (text) {
        setRecipient(text.trim());
      }
    } catch (err) {
      console.warn('Failed to paste:', err);
    }
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
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{t('send')}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('transfer_to_another_wallet')}
            </Text>
          </View>

          {/* Balance Card */}
          <View style={[styles.balanceCard, { backgroundColor: colors.card }]}>
            <View style={styles.balanceHeader}>
              <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>
                {t('available_balance')}
              </Text>
              <TouchableOpacity onPress={loadBalance} style={styles.refreshButton}>
                <Ionicons name="refresh-outline" size={20} color={primaryColor} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.balanceAmount, { color: colors.text }]}>
              {balance?.toFixed(6)} {currency}
            </Text>
            
            <View style={styles.balanceValue}>
              <Text style={[styles.usdValue, { color: colors.textSecondary }]}>
                ≈ ${(balance * 100).toFixed(2)} USD
              </Text>
            </View>
          </View>

          {/* Token Selector */}
          <TouchableOpacity
            style={[styles.tokenSelector, { backgroundColor: colors.card }]}
            onPress={() => setModalVisible(true)}
          >
            <View style={styles.tokenSelectorContent}>
              <View style={styles.tokenInfo}>
                <View style={[styles.tokenIcon, { backgroundColor: primaryColor + '20' }]}>
                  <Ionicons 
                    name={SUPPORTED_TOKENS[currency]?.icon || 'help-circle'} 
                    size={24} 
                    color={primaryColor} 
                  />
                </View>
                <View>
                  <Text style={[styles.tokenName, { color: colors.text }]}>
                    {t(currency.toLowerCase())}
                  </Text>
                  <Text style={[styles.tokenSymbol, { color: colors.textSecondary }]}>
                    {currency}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-down" size={24} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          {/* Recipient Input */}
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
          </View>

          {/* Amount Input */}
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
            {amount && (
              <Text style={[styles.usdAmount, { color: colors.textSecondary }]}>
                ≈ ${(parseFloat(amount || 0) * 100).toFixed(2)} USD
              </Text>
            )}
          </View>

          {/* Fee Info */}
          <View style={[styles.feeCard, { backgroundColor: colors.card }]}>
            <View style={styles.feeRow}>
              <Text style={[styles.feeLabel, { color: colors.textSecondary }]}>
                {t('network_fee')}
              </Text>
              <Text style={[styles.feeValue, { color: colors.text }]}>
                {FEE_SOL} SOL
              </Text>
            </View>
            <View style={styles.feeRow}>
              <Text style={[styles.feeLabel, { color: colors.textSecondary }]}>
                {t('total_amount')}
              </Text>
              <Text style={[styles.totalAmount, { color: colors.text }]}>
                {parseFloat(amount || 0) + (currency === 'SOL' ? FEE_SOL : 0)} {currency}
              </Text>
            </View>
          </View>

          {/* Send Button */}
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
                <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
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

          {/* Security Notice */}
          <View style={styles.securityNotice}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.securityText, { color: colors.textSecondary }]}>
              {t('verify_address_before_sending')}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Token Selection Modal */}
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

            <FlatList
              data={Object.values(SUPPORTED_TOKENS)}
              keyExtractor={(item) => item.symbol}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.tokenItem,
                    { 
                      backgroundColor: colors.card,
                      borderColor: currency === item.symbol ? primaryColor : 'transparent'
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
                        {t(item.symbol.toLowerCase())}
                      </Text>
                      <Text style={[styles.tokenItemSymbol, { color: colors.textSecondary }]}>
                        {item.symbol}
                      </Text>
                    </View>
                    {currency === item.symbol && (
                      <Ionicons name="checkmark-circle" size={24} color={primaryColor} />
                    )}
                  </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.tokenList}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

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
  balanceValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  usdValue: {
    fontSize: 16,
    fontWeight: '500',
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
  usdAmount: {
    fontSize: 14,
    marginTop: 8,
  },
  feeCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  feeLabel: {
    fontSize: 14,
  },
  feeValue: {
    fontSize: 14,
    fontWeight: '500',
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
    marginBottom: 20,
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
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
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
});
