import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Keypair } from '@solana/web3.js';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';

export default function CreateWalletScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const primaryColor = useAppStore((state) => state.primaryColor);

  const generateWallet = async () => {
    const mnemonic = bip39.generateMnemonic(wordlist);
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const keypair = Keypair.fromSeed(seed.slice(0, 32));

    return {
      mnemonic,
      privateKey: JSON.stringify(Array.from(keypair.secretKey)),
      publicKey: keypair.publicKey.toBase58(),
    };
  };

  const handleCreateWallet = async () => {
    try {
      const { mnemonic, privateKey, publicKey } = await generateWallet();

      await SecureStore.setItemAsync('wallet_mnemonic', mnemonic);
      await SecureStore.setItemAsync('wallet_private_key', privateKey);
      await SecureStore.setItemAsync('wallet_public_key', publicKey);
      await SecureStore.setItemAsync('wallet_initialized', 'true');

      navigation.reset({
        index: 0,
        routes: [{ name: 'Backup' }],
      });
    } catch (error) {
      Alert.alert(t('error'), error.message || 'حدث خطأ أثناء إنشاء المحفظة');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: primaryColor }]}>{t('create_wallet')}</Text>
      <Text style={styles.warning}>
        ⚠️ {t('backup_phrase')} - {t('يرجى الاحتفاظ بنسخه من المفاتيح فى مكان آمن ')}
      </Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: primaryColor }]}
        onPress={handleCreateWallet}
      >
        <Text style={styles.buttonText}>{t('create_wallet')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, textAlign: 'center', marginBottom: 20, fontWeight: 'bold' },
  warning: { color: '#e67e22', fontSize: 14, textAlign: 'center', marginBottom: 30 },
  button: { padding: 15, borderRadius: 8 },
  buttonText: { color: '#fff', textAlign: 'center', fontSize: 16, fontWeight: 'bold' },
});
