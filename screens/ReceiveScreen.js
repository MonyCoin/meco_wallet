import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-styled';
import { logTransaction } from '../services/transactionLogger';

export default function ReceiveScreen() {
  const { theme } = useAppStore();
  const { t } = useTranslation();
  const [walletAddress, setWalletAddress] = useState('');
  const [logged, setLogged] = useState(false);

  const isDark = theme === 'dark';
  const bg = isDark ? '#000' : '#fff';
  const fg = isDark ? '#fff' : '#000';

  useEffect(() => {
    SecureStore.getItemAsync('wallet_public_key')
      .then(async (addr) => {
        if (addr) {
          setWalletAddress(addr);

          if (!logged) {
            await logTransaction({
              type: 'receive',
              to: addr,
              timestamp: Date.now(),
            });
            setLogged(true);
          }
        }
      })
      .catch(console.log);
  }, [logged]);

  const copyToClipboard = () => {
    if (!walletAddress) return;
    Clipboard.setStringAsync(walletAddress);
    Alert.alert(t('copied'), t('wallet_address_copied'));
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Text style={[styles.title, { color: fg }]}>{t('receive')}</Text>

      {walletAddress ? (
        <View style={styles.qrContainer}>
          <Text style={[styles.warning, { color: 'red', marginBottom: 10 }]}></Text>
          <QRCode
            data={walletAddress}
            size={200}
            color={fg}
            bgColor={bg}
            padding={10}
            pieceSize={10}
          />
        </View>
      ) : (
        <Text style={[styles.address, { color: fg }]}>...{t('loading')}</Text>
      )}

      <Text style={[styles.address, { color: fg }]}>
        {walletAddress || '...'}
      </Text>

      <TouchableOpacity onPress={copyToClipboard}>
        <Text style={[styles.copy, { color: fg }]}>{t('copy_address')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  qrContainer: { marginBottom: 20, alignItems: 'center' },
  warning: { fontSize: 16, fontWeight: 'bold', color: 'red', textAlign: 'center' },
  address: { fontSize: 16, marginBottom: 20 },
  copy: { textDecorationLine: 'underline' },
});
