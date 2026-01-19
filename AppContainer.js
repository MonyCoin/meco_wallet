import React, { useEffect, useState } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { ActivityIndicator, View, I18nManager } from 'react-native';
import { useAppStore } from './store';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';

// Screens
import HomeScreen from './screens/HomeScreen';
import CreateWalletScreen from './screens/CreateWalletScreen';
import ImportWalletScreen from './screens/ImportWalletScreen';
import WalletScreen from './screens/WalletScreen';
import SettingsScreen from './screens/SettingsScreen';
import ReceiveScreen from './screens/ReceiveScreen';
import SendScreen from './screens/SendScreen';
import SwapScreen from './screens/SwapScreen';
import BackupScreen from './screens/BackupScreen';
import TransactionHistoryScreen from './screens/TransactionHistoryScreen';
import MecoScreen from './screens/MecoScreen';
import MarketScreen from './screens/MarketScreen';
import StakingScreen from './screens/StakingScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function BottomTabs() {
  const { t } = useTranslation();
  const primaryColor = useAppStore(state => state.primaryColor);

  return (
    <Tab.Navigator
      initialRouteName="Wallet"
      screenOptions={({ route }) => {
        const icons = {
          Settings: 'settings-outline',
          Wallet: 'wallet-outline',
          Meco: 'logo-bitcoin',
          Market: 'stats-chart-outline',
        };

        return {
          headerShown: false,
          tabBarActiveTintColor: primaryColor,
          tabBarInactiveTintColor: 'gray',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={icons[route.name]} size={size} color={color} />
          ),
        };
      }}
    >
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: t('user_settings') }} />
      <Tab.Screen name="Wallet" component={WalletScreen} options={{ tabBarLabel: t('wallet') }} />
      <Tab.Screen name="Meco" component={MecoScreen} options={{ tabBarLabel: t('meco') }} />
      <Tab.Screen name="Market" component={MarketScreen} options={{ tabBarLabel: t('market') }} />
    </Tab.Navigator>
  );
}

export default function AppContainer() {
  const theme = useAppStore(state => state.theme);
  const language = useAppStore(state => state.language);
  const primaryColor = useAppStore(state => state.primaryColor);
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    if (language) {
      i18n.changeLanguage(language);
      I18nManager.forceRTL(language === 'ar');
    }
  }, [language]);

  useEffect(() => {
    const init = async () => {
      try {
        console.log('🔄 بدء التهيئة...');
        const initialized = await SecureStore.getItemAsync('wallet_initialized');
        console.log('🧠 حالة المحفظة:', initialized);

        if (initialized === 'true') {
          const loadWallet = useAppStore.getState().loadWallet;
          const ok = await loadWallet();
          if (ok) {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const hasBiometrics = await LocalAuthentication.isEnrolledAsync();
            if (hasHardware && hasBiometrics) {
              const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'تأكيد الهوية بالبصمة',
                cancelLabel: 'إلغاء',
                disableDeviceFallback: true,
              });
              if (!result.success) {
                setInitialRoute('Home');
                return;
              }
            }
            setInitialRoute('BottomTabs');
            return;
          }
        }
        setInitialRoute('Home');
      } catch (err) {
        console.warn('⚠️ Auth error:', err.message);
        setInitialRoute('Home');
      }
    };
    init();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme === 'dark' ? '#000' : '#fff',
      }}>
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
        <Stack.Screen name="Swap" component={SwapScreen} options={{ title: 'مبادلة' }} />
        <Stack.Screen name="Staking" component={StakingScreen} options={{ title: 'Staking' }} />
        <Stack.Screen name="Backup" component={BackupScreen} options={{ title: 'نسخ احتياطي' }} />
        <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} options={{ title: 'السجل' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
