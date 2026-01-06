import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, Modal, FlatList
} from 'react-native';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import { useRoute } from '@react-navigation/native';
import { getSolBalance, getTokenAccounts } from '../services/heliusService';
import { logTransaction } from '../services/transactionLogger';

const FEE_SOL = 0.001;
const DEV_ADDRESS = 'JCqDixUpY9sEM3ZCKeh8zPr2H36YPeD8n5iixrAu7xxM';

const SUPPORTED_TOKENS = {
  SOL: { name: 'Solana', symbol: 'SOL', mint: null },
  USDT: {
    name: 'Tether USD',
    symbol: 'USDT',
    mint: 'Es9vMFrzaCERc8Foa8XfRduKiSfrhEL5c7qr2WXXBWY5',
  },
  MECO: {
    name: 'MECO Token',
    symbol: 'MECO',
    mint: '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i',
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
  const bg = isDark ? '#000' : '#fff';
  const fg = isDark ? '#fff' : '#000';

  const preselected = route?.params?.preselectedToken;
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(preselected || 'SOL');
  const [modalVisible, setModalVisible] = useState(false);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    load();
  }, [currency]);

  async function load() {
    try {
      const pub = await SecureStore.getItemAsync('wallet_public_key');
      if (!pub) return;

      if (currency === 'SOL') {
        const sol = await getSolBalance();
        setBalance(sol);
      } else {
        const tokens = await getTokenAccounts();
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
      const bs58 = await import('bs58');
      const web3 = await import('@solana/web3.js');
      const splToken = await import('@solana/spl-token');

      if (!recipient || !amount) return Alert.alert(t('error'), t('fill_fields'));
      if (!(await isValidSolanaAddress(recipient))) return Alert.alert(t('error'), t('invalid_address'));

      const num = parseFloat(amount);
      if (isNaN(num) || num <= 0) return Alert.alert(t('error'), t('amount_must_be_positive'));

      if (num > balance) return Alert.alert(t('error'), t('insufficient_after_fee'));

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

      Alert.alert(t('success'), `${t('sent')} ${num} ${currency}`);
      setRecipient('');
      setAmount('');
      setModalVisible(false);
      setTimeout(() => load(), 300);
    } catch (err) {
      console.error('Send error:', err);
      Alert.alert(t('error'), t('send_failed'));
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Text style={[styles.title, { color: fg }]}>{t('send')}</Text>

      <Text style={{ color: fg, marginBottom: 10 }}>
        {t('balance')}: {balance?.toFixed(6)} {currency}
      </Text>

      <TextInput
        style={[styles.input, { color: fg, borderColor: fg }]}
        placeholder={t('recipient_address')}
        placeholderTextColor="#888"
        value={recipient}
        onChangeText={setRecipient}
      />
      <TextInput
        style={[styles.input, { color: fg, borderColor: fg }]}
        placeholder={t('amount')}
        placeholderTextColor="#888"
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />

      <TouchableOpacity
        style={[styles.tokenSelector, { borderColor: fg }]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={{ color: fg }}>{`${t('select_token')}: ${currency} ▼`}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, { backgroundColor: primaryColor }]} onPress={handleSend}>
        <Text style={styles.buttonText}>{t('confirm_send')}</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: bg }]}>
            <FlatList
              data={Object.values(SUPPORTED_TOKENS)}
              keyExtractor={(item) => item.symbol}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.tokenItem}
                  onPress={() => {
                    setCurrency(item.symbol);
                    setModalVisible(false);
                  }}
                >
                  <Text style={{ color: fg }}>{item.name} ({item.symbol})</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: primaryColor }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={{ color: '#fff' }}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  tokenSelector: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center'
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: {
    flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', alignItems: 'center'
  },
  modalContent: {
    width: 280, maxHeight: '70%', padding: 20, borderRadius: 14
  },
  tokenItem: {
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  cancelBtn: {
    padding: 12,
    borderRadius: 10,
    marginTop: 14,
    alignItems: 'center'
  },
});
