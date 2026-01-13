import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Clipboard
} from 'react-native';

import * as SecureStore from 'expo-secure-store';
import { Keypair } from '@solana/web3.js';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { useAppStore } from '../store';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

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

      if (!bip39.validateMnemonic(cleanedMnemonic, wordlist)) {
        Alert.alert('❌ عبارة الاسترداد غير صحيحة');
        return;
      }

      const seed = await bip39.mnemonicToSeed(cleanedMnemonic);
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

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setMnemonic(text);
  };

  const wordCount = mnemonic.trim().split(/\s+/).filter(Boolean).length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: primaryColor }]}>
        استيراد المحفظة
      </Text>

      <View style={styles.warningCard}>
        <Ionicons name="warning-outline" size={24} color="#FFA500" />
        <Text style={styles.warningText}>
          ⚠️ احتفظ بالكلمات في مكان آمن. لا يمكن استعادة المحفظة بدونها.
        </Text>
      </View>

      <View style={styles.mnemonicCard}>
        <TextInput
          style={styles.input}
          placeholder="أدخل 12 كلمة مفصولة بمسافة"
          placeholderTextColor="#999"
          multiline
          value={mnemonic}
          onChangeText={setMnemonic}
          textAlign="right"
        />
        <View style={styles.wordCountRow}>
          <Text style={styles.wordCountText}>{wordCount} / 12 كلمات</Text>
          <TouchableOpacity onPress={handlePaste} style={styles.pasteButton}>
            <Text style={{ color: primaryColor }}>لصق</Text>
          </TouchableOpacity>
        </View>
      </View>

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
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
  },
  warningText: {
    marginLeft: 8,
    color: '#856404',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  mnemonicCard: {
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  input: {
    fontSize: 16,
    lineHeight: 22,
    minHeight: 100,
  },
  wordCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  wordCountText: {
    fontSize: 14,
    color: '#555',
  },
  pasteButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
