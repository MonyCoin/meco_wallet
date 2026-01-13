import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';

import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import { Keypair } from '@solana/web3.js';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { useAppStore } from '../store';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export default function CreateWalletScreen() {
  const [mnemonic, setMnemonic] = useState('');
  const navigation = useNavigation();
  const primaryColor = useAppStore(state => state.primaryColor);

  useEffect(() => {
    generateWallet();
  }, []);

  const generateWallet = async () => {
    try {
      const generatedMnemonic = bip39.generateMnemonic(wordlist);

      const cleanedMnemonic = generatedMnemonic
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');

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

      setMnemonic(cleanedMnemonic);
    } catch (err) {
      console.error('Create wallet error:', err);
      Alert.alert('خطأ', 'فشل في إنشاء المحفظة');
    }
  };

  const copyMnemonic = async () => {
    await Clipboard.setStringAsync(mnemonic);
    Alert.alert('📋 تم النسخ', 'تم نسخ عبارة الاسترداد بنجاح');
  };

  const handleContinue = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'BottomTabs' }],
    });
  };

  const words = mnemonic.split(' ');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: primaryColor }]}>
        عبارة الاسترداد
      </Text>

      {/* تحذير أمني */}
      <View style={styles.warningBox}>
        <Ionicons name="warning-outline" size={22} color="#c0392b" />
        <Text style={styles.warningText}>
          احتفظ بهذه الكلمات في مكان آمن.  
          لا يمكن استعادة محفظتك بدونها.
        </Text>
      </View>

      {/* كرت الكلمات */}
      <View style={styles.mnemonicCard}>
        <View style={styles.wordsGrid}>
          {words.map((word, index) => (
            <View key={`${word}-${index}`} style={styles.wordItem}>
              <Text style={styles.wordIndex}>{index + 1}</Text>
              <Text style={styles.wordText}>{word}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* زر النسخ */}
      <TouchableOpacity
        style={[styles.copyButton, { borderColor: primaryColor }]}
        onPress={copyMnemonic}
      >
        <Ionicons name="copy-outline" size={18} color={primaryColor} />
        <Text style={[styles.copyText, { color: primaryColor }]}>
          نسخ عبارة الاسترداد
        </Text>
      </TouchableOpacity>

      {/* متابعة */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: primaryColor }]}
        onPress={handleContinue}
      >
        <Text style={styles.buttonText}>لقد حفظت الكلمات</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdecea',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
  },
  warningText: {
    marginLeft: 10,
    color: '#c0392b',
    fontSize: 14,
    flex: 1,
  },
  mnemonicCard: {
    backgroundColor: '#f7f7f7',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  wordItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  wordIndex: {
    fontSize: 12,
    color: '#999',
    marginRight: 6,
  },
  wordText: {
    fontSize: 15,
    fontWeight: '500',
  },
  copyButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
  },
  copyText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '600',
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
