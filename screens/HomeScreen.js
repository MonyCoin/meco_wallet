import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  SafeAreaView, Modal
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

// شعار التطبيق داخل دائرة (الصورة الأصلية بخلفية بيضاء، فنقصّها بقناع دائري)
const AppLogo = ({ size }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
    <Image
      source={require('../assets/logo.png')}
      style={{ position: 'absolute', width: size * 1.1, height: size * 1.1, left: -size * 0.05, top: -size * 0.05 }}
    />
  </View>
);

export default function HomeScreen() {
  const navigation = useNavigation();
  const { t, i18n } = useTranslation();
  const primaryColor = useAppStore(state => state.primaryColor || '#6C63FF');
  // ✅ محتاجينها عشان نحفظ اختيار اللغة صح (زي SettingsScreen بالظبط)
  const setLanguage = useAppStore(state => state.setLanguage);

  const [langModalVisible, setLangModalVisible] = useState(false);

  const LANGUAGES = [
    { code: 'ar', name: 'العربية' },
    { code: 'en', name: 'English' },
  ];

  const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  // التطبيق يعمل بالنمط الغامق فقط
  const colors = {
    background: '#07070F',
    text: '#EEEEFF',
    textSecondary: '#7E7EAA',
    card: '#111122',
    border: '#1E1E38',
  };

  // ✅ بنحفظ الاختيار فى الـ store (بيتخزن فى AsyncStorage ويتزامن مع باقي
  // التطبيق) قبل ما نطبقه على i18next مباشرة — نفس ترتيب SettingsScreen.toggleLanguage
  const changeLanguage = (langCode) => {
    setLanguage(langCode);
    i18n.changeLanguage(langCode);
    setLangModalVisible(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        
        {/* Header with Language Button */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <AppLogo size={34} />
            <Text style={[styles.appName, { color: colors.text }]}>MECO Wallet</Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.langButton, { backgroundColor: colors.card }]}
            onPress={() => setLangModalVisible(true)}
          >
            <Text style={[styles.langText, { color: colors.text }]}>{currentLang.name}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Logo Section */}
        <View style={styles.logoContainer}>
          <View style={styles.glow} pointerEvents="none">
            <Svg width={300} height={300}>
              <Defs>
                <RadialGradient id="homeGlow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={primaryColor} stopOpacity="0.32" />
                  <Stop offset="1" stopColor={primaryColor} stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Circle cx="150" cy="150" r="150" fill="url(#homeGlow)" />
            </Svg>
          </View>
          <AppLogo size={136} />
        </View>

        {/* Welcome Text */}
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('welcome')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('first_arab_wallet')}
          </Text>
        </View>

        {/* Buttons Section */}
        <View style={styles.buttonsContainer}>
          
          {/* Create Wallet Button */}
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('CreateWallet')}
            activeOpacity={0.8}
          >
            <View style={[styles.primaryButton, { backgroundColor: primaryColor }]}>
              <View style={styles.buttonContent}>
                <Ionicons name="add-circle-outline" size={24} color="#FFF" />
                <Text style={styles.primaryButtonText}>{t('create_wallet')}</Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ opacity: 0.9 }} />
            </View>
          </TouchableOpacity>

          {/* Import Wallet Button */}
          <TouchableOpacity
            style={[styles.button, { marginTop: 12 }]}
            onPress={() => navigation.navigate('ImportWallet')}
            activeOpacity={0.8}
          >
            <View style={[styles.importButton, { backgroundColor: colors.card }]}>
              <View style={styles.buttonContent}>
                <Ionicons name="download-outline" size={24} color={primaryColor} />
                <Text style={[styles.importButtonText, { color: colors.text }]}>
                  {t('import_wallet')}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <Ionicons name="shield-checkmark" size={20} color={primaryColor} />
            <Text style={[styles.featureText, { color: colors.textSecondary }]}>
              {t('secure_and_encrypted')}
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="flash" size={20} color={primaryColor} />
            <Text style={[styles.featureText, { color: colors.textSecondary }]}>
              {t('fast_transactions')}
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="globe" size={20} color={primaryColor} />
            <Text style={[styles.featureText, { color: colors.textSecondary }]}>
              {t('multi_language_support')}
            </Text>
          </View>
        </View>

      </View>

      {/* Language Selection Modal */}
      <Modal
        visible={langModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t('choose_language')}
              </Text>
              <TouchableOpacity onPress={() => setLangModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={styles.langItem}
                onPress={() => changeLanguage(lang.code)}
              >
                <Text style={[styles.langItemName, { color: colors.text }]}>
                  {lang.name}
                </Text>
                {lang.code === i18n.language && (
                  <Ionicons name="checkmark-circle" size={24} color={primaryColor} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 4,
  },
  langText: {
    fontSize: 14,
    fontWeight: '500',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    position: 'relative',
  },
  glow: { position: 'absolute' },
  textContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonsContainer: {
    marginBottom: 30,
  },
  button: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  primaryButton: {
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderRadius: 999,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  importButton: {
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderRadius: 999,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  importButtonText: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  featuresContainer: {
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  featureItem: {
    alignItems: 'center',
    flex: 1,
  },
  featureText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  langItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  langItemName: {
    fontSize: 16,
    fontWeight: '500',
  },
});
