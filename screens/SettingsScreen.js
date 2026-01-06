import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Linking from 'expo-linking';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();

  const theme = useAppStore((state) => state.theme);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const logout = useAppStore((state) => state.logout);
  const accent = useAppStore((state) => state.primaryColor);

  const isDark = theme === 'dark';
  const bg = isDark ? '#000' : '#fff';
  const fg = isDark ? '#fff' : '#000';

  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language]);

  const handleBiometrics = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();

    if (compatible && enrolled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('confirm_send'),
      });

      Alert.alert(
        result.success ? t('success') : t('error'),
        result.success ? t('authenticated') : t('auth_failed')
      );
    } else {
      Alert.alert(t('error'), t('biometric_not_supported'));
    }
  };

  const handleSupport = () => {
    Linking.openURL('mailto:mecowallet@gmail.com');
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('wallet_private_key');
      await AsyncStorage.removeItem('wallet_public_key');
      logout();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error) {
      Alert.alert(t('error'), 'فشل في تسجيل الخروج');
    }
  };

  const toggleLanguage = () => {
    const nextLang = language === 'ar' ? 'en' : 'ar';
    setLanguage(nextLang);
    setTimeout(() => {
      i18n.changeLanguage(nextLang);
    }, 100);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: bg }]}>
      <Text style={[styles.title, { color: fg }]}>{t('user_settings')}</Text>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: accent }]}
        onPress={() => navigation.navigate('TransactionHistory')}
      >
        <Ionicons name="list-outline" size={18} color="#fff" style={styles.icon} />
        <Text style={styles.buttonText}>{t('transactions')}</Text>
      </TouchableOpacity>

      <View style={styles.switchRow}>
        <Ionicons name="language-outline" size={20} color={fg} style={styles.icon} />
        <Text style={[styles.switchLabel, { color: fg }]}>{t('change_language')}</Text>
        <Switch
          value={language === 'en'}
          onValueChange={toggleLanguage}
          thumbColor={accent}
        />
      </View>

      <View style={styles.switchRow}>
        <Ionicons name="color-palette-outline" size={20} color={fg} style={styles.icon} />
        <Text style={[styles.switchLabel, { color: fg }]}>{t('toggle_theme')}</Text>
        <Switch
          value={theme === 'dark'}
          onValueChange={toggleTheme}
          thumbColor={accent}
        />
      </View>

      <TouchableOpacity style={[styles.button, { backgroundColor: accent }]} onPress={handleBiometrics}>
        <MaterialIcons name="fingerprint" size={18} color="#fff" style={styles.icon} />
        <Text style={styles.buttonText}>{t('biometric')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, { backgroundColor: accent }]} onPress={handleSupport}>
        <Feather name="mail" size={18} color="#fff" style={styles.icon} />
        <Text style={styles.buttonText}>{t('contact_support')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, { backgroundColor: accent }]} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color="#fff" style={styles.icon} />
        <Text style={styles.buttonText}>{t('logout')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    marginBottom: 12,
  },
  icon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  switchLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
});
