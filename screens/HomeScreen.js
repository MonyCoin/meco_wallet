import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, useColorScheme } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';

export default function HomeScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();

  // ✅ تأمين قيمة isDark لتكون Boolean حقيقية فقط
  const isDark = colorScheme === 'dark' ? true : false;
  const primary = useAppStore(state => state.primaryColor || '#00b97f');

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
      <Image source={require('../assets/logo.png')} style={styles.logo} />
      
      <Text style={[styles.title, { color: primary }]}>
        {t('welcome')}
      </Text>

      <Text style={[styles.subtitle, { color: isDark ? '#ccc' : '#333' }]}>
        {t('first_arab_wallet')}
      </Text>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: primary }]}
        onPress={() => navigation.navigate('CreateWallet')}
        activeOpacity={0.8} // ✅ تأكيد أنها Boolean وليست String
      >
        <Text style={styles.buttonText}>{t('create_wallet')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: primary }]}
        onPress={() => navigation.navigate('ImportWallet')}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>{t('import_wallet')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logo: {
    width: 180,
    height: 180,
    resizeMode: 'contain',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
    width: '100%',
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
  },
});
