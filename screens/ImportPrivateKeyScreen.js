import React, { useState, useLayoutEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useAppStore } from '../store';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import DirIcon from '../components/DirIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const C = {
  bg: '#000000', card: '#141414', card2: '#1E1E1E', border: '#262626',
  text: '#F2F2F2', muted: '#8A8A8E', warnBg: 'rgba(245,158,11,0.12)', warnTxt: '#FCD34D',
};

export default function ImportPrivateKeyScreen() {
  const [privateKey, setPrivateKey]   = useState('');
  const [accountName, setAccountName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const primaryColor = useAppStore(state => state.primaryColor || '#6C63FF');
  const addAccountFromPrivateKey = useAppStore(state => state.addAccountFromPrivateKey);

  // الترويسة مرسومة داخل الشاشة نفسها (بنفس أسلوب شاشة الحسابات)
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const canImport = privateKey.trim().length > 0 && !isImporting;

  const handleImport = async () => {
    if (isImporting) return;
    if (!privateKey.trim()) {
      Alert.alert(t('error'), t('import_private_key.enter_key_error'));
      return;
    }

    setIsImporting(true);
    try {
      const name = accountName.trim() || t('import_private_key.default_account_name');
      await addAccountFromPrivateKey(name, privateKey.trim());
      Alert.alert(t('success'), t('import_private_key.success'));
      navigation.goBack();
    } catch (error) {
      Alert.alert(t('error'), error.message || t('import_private_key.failed'));
    } finally {
      setIsImporting(false);
    }
  };

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setPrivateKey(text);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <DirIcon name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('import_private_key.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.warnBox}>
            <Ionicons name="warning" size={18} color={C.warnTxt} />
            <View style={{ flex: 1 }}>
              <Text style={styles.warnTxt}>{t('import_private_key.warning')}</Text>
              <Text style={[styles.warnTxt, { marginTop: 6 }]}>{t('import_private_key.warning_not_recoverable')}</Text>
            </View>
          </View>

          <Text style={styles.label}>{t('import_private_key.account_name_label')}</Text>
          <TextInput
            style={styles.input}
            value={accountName}
            onChangeText={setAccountName}
            placeholder={t('import_private_key.account_name_placeholder')}
            placeholderTextColor={C.muted}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>{t('import_private_key.private_key_label')}</Text>
          <View style={styles.keyBox}>
            <TextInput
              style={styles.keyInput}
              value={privateKey}
              onChangeText={setPrivateKey}
              placeholder={t('import_private_key.private_key_placeholder')}
              placeholderTextColor={C.muted}
              multiline
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <TouchableOpacity onPress={handlePaste} style={styles.pasteBtn} activeOpacity={0.8} accessibilityLabel={t('import_private_key.paste')}>
              <Ionicons name="clipboard-outline" size={18} color={C.text} />
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[styles.importBtn, { backgroundColor: primaryColor, opacity: canImport ? 1 : 0.4 }]}
            onPress={handleImport}
            disabled={!canImport}
            activeOpacity={0.85}
          >
            {isImporting
              ? <ActivityIndicator size="small" color="#FFF" />
              : <>
                  <Ionicons name="key" size={18} color="#FFF" />
                  <Text style={styles.importTxt}>{t('import_private_key.import_button')}</Text>
                </>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  backBtn:   { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  title:     { color: C.text, fontSize: 18, fontWeight: '800' },
  content:   { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },

  warnBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: C.warnBg, borderRadius: 14, padding: 12, marginBottom: 20 },
  warnTxt: { color: C.warnTxt, fontSize: 12.5, lineHeight: 19 },

  label: { color: C.muted, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: { backgroundColor: C.card, color: C.text, borderRadius: 14, paddingHorizontal: 14, height: 48, fontSize: 15 },

  keyBox:   { backgroundColor: C.card, borderRadius: 14 },
  keyInput: { color: C.text, fontSize: 14, lineHeight: 20, minHeight: 104, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, paddingRight: 56, textAlignVertical: 'top' },
  pasteBtn: { position: 'absolute', top: 8, right: 8, width: 36, height: 36, borderRadius: 18, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },

  footer:    { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  importBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 999 },
  importTxt: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
