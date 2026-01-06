import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store';

export default function BackupScreen() {
  const [mnemonic, setMnemonic] = useState('');
  const { t } = useTranslation();
  const navigation = useNavigation();
  const primaryColor = useAppStore(state => state.primaryColor);

  useEffect(() => {
    (async () => {
      try {
        const storedMnemonic = await SecureStore.getItemAsync('wallet_mnemonic');
        if (storedMnemonic) setMnemonic(storedMnemonic);
        else Alert.alert(t('error'), 'عبارة الاسترداد غير موجودة');
      } catch (error) {
        Alert.alert(t('error'), 'حدث خطأ عند تحميل عبارة الاسترداد');
      }
    })();
  }, []);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(mnemonic);
    Alert.alert(t('copied'), t('wallet_address_copied'));
  };

  const handleProceed = async () => {
    try {
      const isAvailable = await LocalAuthentication.hasHardwareAsync();
      const supported = await LocalAuthentication.supportedAuthenticationTypesAsync();

      if (!isAvailable || supported.length === 0) {
        Alert.alert(t('error'), 'جهازك لا يدعم المصادقة الحيوية');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'تأكيد الدخول إلى المحفظة',
        fallbackLabel: 'أدخل رمز الهاتف',
      });

      if (result.success) {
        navigation.replace('BottomTabs');
      } else {
        Alert.alert(t('error'), 'فشل التحقق بالبصمة');
      }
    } catch (error) {
      Alert.alert(t('error'), 'حدث خطأ في التحقق بالبصمة');
    }
  };

  if (!mnemonic) return null;

  const words = mnemonic.split(' ');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: primaryColor }]}>{t('backup_phrase')}</Text>

      <View style={styles.wordsContainer}>
        {words.map((word, index) => (
          <View key={index} style={styles.wordBox}>
            <Text style={styles.wordIndex}>{index + 1}.</Text>
            <Text style={styles.word}>{word}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={[styles.copyButton, { backgroundColor: primaryColor }]} onPress={handleCopy}>
        <Text style={styles.copyButtonText}>{t('copy_address')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.proceedButton} onPress={handleProceed}>
        <Text style={styles.proceedButtonText}>التالي</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff', flexGrow: 1, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  wordsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 30 },
  wordBox: { backgroundColor: '#f2f2f2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, margin: 6, flexDirection: 'row', alignItems: 'center' },
  wordIndex: { fontWeight: 'bold', marginRight: 5, fontSize: 14 },
  word: { fontSize: 14 },
  copyButton: { padding: 15, borderRadius: 8, marginBottom: 15 },
  copyButtonText: { color: '#fff', textAlign: 'center', fontSize: 16 },
  proceedButton: { backgroundColor: '#000', padding: 15, borderRadius: 8 },
  proceedButtonText: { color: '#fff', textAlign: 'center', fontSize: 16 },
});
