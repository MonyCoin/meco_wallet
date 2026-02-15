import { LogBox } from 'react-native';
LogBox.ignoreLogs(['"solana" is not a valid icon name']);

import React, { useEffect, useState } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { ActivityIndicator, View, I18nManager, Platform } from 'react-native';
// ✅ الإبقاء على إصلاح المناطق الآمنة (التصميم)
import { useSafeAreaInsets } from 'react-native-safe-area-context'; 
import { useAppStore } from './store';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';

// ✅ استيراد خدمة WalletConnect
import { initWalletConnect } from './services/walletConnectService';

// Screens
import HomeScreen from './screens/HomeScreen';
import CreateWalletScreen from './screens/CreateWalletScreen';
import ImportWalletScreen from './screens/ImportWalletScreen';
import WalletScreen from './screens/WalletScreen';
import SettingsScreen from './screens/SettingsScreen';
import ReceiveScreen from './screens/ReceiveScreen';
import SendScreen from './screens/SendScreen';
// ❌ تم حذف SwapScreen نهائياً
import BackupScreen from './screens/BackupScreen';
import TransactionHistoryScreen from './screens/TransactionHistoryScreen';
import MarketScreen from './screens/MarketScreen';
import PresaleScreen from './screens/PresaleScreen';
import MecoWorldScreen from './screens/MecoWorldScreen';
// ✅ إضافة شاشة تفاصيل العملة
import TokenDetailsScreen from './screens/TokenDetailsScreen';
// ✅ إضافة شاشة ماسح QR
import QRScannerScreen from './screens/QRScannerScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function BottomTabs() {
  const { t } = useTranslation();
  const primaryColor = useAppStore(state => state.primaryColor);
  const theme = useAppStore(state => state.theme);
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      initialRouteName="Wallet"
      screenOptions={({ route }) => {
        // ✅ تعريف الأيقونات لكل تبويب
        const icons = {
          Wallet: 'wallet-outline',
          Market: 'stats-chart-outline',
          MecoWorld: 'globe-outline',
          Settings: 'settings-outline',
        };

        return {
          headerShown: false,
          tabBarActiveTintColor: primaryColor,
          tabBarInactiveTintColor: 'gray',
          tabBarIcon: ({ color, size, focused }) => {
            let iconName;
            
            if (route.name === 'Wallet') {
              iconName = focused ? 'wallet' : 'wallet-outline';
            } else if (route.name === 'Market') {
              iconName = focused ? 'stats-chart' : 'stats-chart-outline';
            } else if (route.name === 'MecoWorld') {
              iconName = focused ? 'globe' : 'globe-outline';
            } else if (route.name === 'Settings') {
              iconName = focused ? 'settings' : 'settings-outline';
            }
            
            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarStyle: {
            backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF',
            borderTopWidth: 0,
            elevation: 10,
            shadowColor: '#000',
            shadowOpacity: 0.1,
            shadowRadius: 10,
            height: 60 + (insets.bottom > 0 ? insets.bottom : 10), 
            paddingBottom: insets.bottom > 0 ? insets.bottom : 10, 
            paddingTop: 10,
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            marginBottom: insets.bottom > 0 ? 0 : 5,
            fontWeight: '600',
          }
        };
      }}
    >
      <Tab.Screen 
        name="Wallet" 
        component={WalletScreen} 
        options={{ tabBarLabel: t('wallet') }} 
      />
      <Tab.Screen 
        name="Market" 
        component={MarketScreen} 
        options={{ tabBarLabel: t('market') }} 
      />
      {/* ✅ إضافة تبويب MecoWorld */}
      <Tab.Screen 
        name="MecoWorld" 
        component={MecoWorldScreen} 
        options={{ tabBarLabel: t('meco_world') || 'Meco World' }} 
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen} 
        options={{ tabBarLabel: t('user_settings') }} 
      />
    </Tab.Navigator>
  );
}

export default function AppContainer() {
  const theme = useAppStore(state => state.theme);
  const language = useAppStore(state => state.language);
  const primaryColor = useAppStore(state => state.primaryColor);
  const [initialRoute, setInitialRoute] = useState(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (language) {
      i18n.changeLanguage(language);
      I18nManager.forceRTL(language === 'ar');
    }
  }, [language]);

  useEffect(() => {
    const init = async () => {
      try {
        const initialized = await SecureStore.getItemAsync('wallet_initialized');
        if (initialized === 'true') {
          const loadWallet = useAppStore.getState().loadWallet;
          const ok = await loadWallet();
          if (ok) {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const hasBiometrics = await LocalAuthentication.isEnrolledAsync();
            if (hasHardware && hasBiometrics) {
              const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'تأكيد الهوية للدخول',
                cancelLabel: 'إلغاء',
                disableDeviceFallback: true,
              });
              if (!result.success) {
                setInitialRoute('Home');
                return;
              }
            }
            
            // ✅ تشغيل خدمة WalletConnect بعد تهيئة المحفظة بنجاح
            initWalletConnect();
            
            setInitialRoute('BottomTabs');
            return;
          }
        }
        setInitialRoute('Home');
      } catch (err) {
        console.warn('Init error:', err);
        setInitialRoute('Home');
      }
    };
    init();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme === 'dark' ? '#000' : '#fff' }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={theme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack.Navigator initialRouteName={initialRoute}>
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CreateWallet" component={CreateWalletScreen} options={{ title: 'إنشاء المحفظة' }} />
        <Stack.Screen name="ImportWallet" component={ImportWalletScreen} options={{ title: 'استيراد المحفظة' }} />
        
        <Stack.Screen name="BottomTabs" component={BottomTabs} options={{ headerShown: false }} />
        
        <Stack.Screen name="Send" component={SendScreen} options={{ title: 'إرسال' }} />
        <Stack.Screen name="Receive" component={ReceiveScreen} options={{ title: 'استقبال' }} />
        
        {/* ✅ شاشة تفاصيل العملة */}
        <Stack.Screen 
          name="TokenDetails" 
          component={TokenDetailsScreen} 
          options={{ 
            title: t('token_details') || 'تفاصيل العملة',
            headerBackTitle: t('back') || 'رجوع'
          }} 
        />
        
        {/* ✅ شاشة ماسح QR */}
        <Stack.Screen 
          name="QRScanner" 
          component={QRScannerScreen} 
          options={{ 
            title: t('qr_scanner.title') || 'مسح QR',
            headerBackTitle: t('back') || 'رجوع',
            headerShown: false // نخفي الهيدر لأن الشاشة لها هيدر خاص
          }} 
        />
        
        <Stack.Screen name="Presale" component={PresaleScreen} options={{ title: t('presale') + ' 🚀' }} />
        <Stack.Screen name="Backup" component={BackupScreen} options={{ title: 'نسخ احتياطي' }} />
        <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} options={{ title: 'السجل' }} />
        <Stack.Screen name="MecoWorld" component={MecoWorldScreen} options={{ title: t('meco_world') || 'Meco World' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
