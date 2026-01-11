import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';

import * as SecureStore from 'expo-secure-store';
import { Keypair } from '@solana/web3.js';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { useAppStore } from '../store';
import { useNavigation } from '@react-navigation/native';

export default function ImportWalletScreen() {
  const [mnemonic, setMnemonic] = useState('');
  const navigation = useNavigation();
  const primaryColor = useAppStore(state => state.primaryColor);

  const handleImport = async () => {
    try {
      const cleanedMnemonic = mnemonic
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');

      // ✅ تحقق صحيح مع wordlist
      if (!bip39.validateMnemonic(cleanedMnemonic, wordlist)) {
        Alert.alert('❌ عبارة الاسترداد غير صحيحة');
        return;
      }

      // ✅ توليد Seed
      const seed = await bip39.mnemonicToSeed(cleanedMnemonic);

      // ✅ Solana-compatible deterministic key
      const keypair = Keypair.fromSeed(seed.slice(0, 32));

      await SecureStore.setItemAsync('wallet_mnemonic', cleanedMnemonic);
      await SecureStore.setItemAsync(
        'wallet_private_key',
        JSON.stringify(Array.from(keypair.secretKey))
      );
      await SecureStore.setItemAsync(
        'wallet_public_key',
        keypair.publicKey.toBase58()
      );
      await SecureStore.setItemAsync('wallet_initialized', 'true');

      Alert.alert('✅ تم استيراد المحفظة بنجاح');

      navigation.reset({
        index: 0,
        routes: [{ name: 'BottomTabs' }],
      });
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert('خطأ', 'فشل في استيراد المحفظة');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: primaryColor }]}>
        استيراد المحفظة
      </Text>

      <TextInput
        style={styles.input}
        placeholder="أدخل 12 كلمة مفصولة بمسافة"
        placeholderTextColor="#999"
        multiline
        value={mnemonic}
        onChangeText={setMnemonic}
        textAlign="right"
      />

      <TouchableOpacity
        style={[styles.button, { backgroundColor: primaryColor }]}
        onPress={handleImport}
      >
        <Text style={styles.buttonText}>استيراد</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#f2f2f2',
    padding: 14,
    borderRadius: 10,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    padding: 14,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
