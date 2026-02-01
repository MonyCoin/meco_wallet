import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Clipboard
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store'; // ✅ من الجذر
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { getSolBalance, sendSolTransaction } from '../services/heliusService'; // ✅ من الجذر

const { width } = Dimensions.get('window');

// بيانات البيع المسبق
const PRESALE_CONFIG = {
  walletAddress: 'E9repjjKBq3RVLw1qckrG15gKth63fe98AHCSgXZzKvY',
  totalSupply: 50000000, // 50 مليون MECO
  totalSolTarget: 200, // 200 SOL هدف
  pricePerMeco: 0.000004, // 1 SOL = 250,000 MECO
  minPurchase: 0.03, // الحد الأدنى
  maxPurchase: 1, // الحد الأقصى
  decimals: 9 // دقة SOL
};

export default function PresaleScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const theme = useAppStore(s => s.theme);
  const primaryColor = useAppStore(s => s.primaryColor);
  const [solAmount, setSolAmount] = useState('');
  const [mecoAmount, setMecoAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [solBalance, setSolBalance] = useState(0);
  const [totalRaised, setTotalRaised] = useState(50); // مثال: 50 SOL محصل فعلياً
  const [imageError, setImageError] = useState(false); // حالة لتحميل الصورة

  const isDark = theme === 'dark';
  const bg = isDark ? '#0A0A0F' : '#F8F9FA';
  const cardBg = isDark ? '#1A1A2E' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#1A1A2E';
  const secondaryText = isDark ? '#A0A0B0' : '#6B7280';
  const borderColor = isDark ? '#2A2A3E' : '#E5E7EB';

  // تحميل رصيد SOL
  useEffect(() => {
    loadSolBalance();
    calculateProgress();
  }, []);

  // حساب MECO عند تغيير SOL
  useEffect(() => {
    if (solAmount && parseFloat(solAmount) > 0) {
      const sol = parseFloat(solAmount);
      const meco = Math.floor(sol / PRESALE_CONFIG.pricePerMeco);
      setMecoAmount(meco);
    } else {
      setMecoAmount(0);
    }
  }, [solAmount]);

  // تحديث التقدم عند تغيير totalRaised
  useEffect(() => {
    calculateProgress();
  }, [totalRaised]);

  const loadSolBalance = async () => {
    try {
      const pubKey = await SecureStore.getItemAsync('wallet_public_key');
      if (pubKey) {
        const balance = await getSolBalance(pubKey);
        setSolBalance(balance || 0);
      } else {
        Alert.alert(
          t('error'),
          t('connect_wallet_first'),
          [
            {
              text: t('connect_wallet'),
              onPress: () => navigation.navigate('Wallet')
            },
            { text: t('cancel'), style: 'cancel' }
          ]
        );
      }
    } catch (error) {
      console.error('Error loading SOL balance:', error);
      Alert.alert(t('error'), t('presale_balance_load_error'));
    }
  };

  const calculateProgress = () => {
    const progressPercent = (totalRaised / PRESALE_CONFIG.totalSolTarget) * 100;
    setProgress(progressPercent > 100 ? 100 : progressPercent);
  };

  const handleQuickSelect = (amount) => {
    setSolAmount(amount.toString());
  };

  const handleMaxAmount = () => {
    const maxAvailable = Math.min(solBalance, PRESALE_CONFIG.maxPurchase);
    setSolAmount(maxAvailable.toFixed(PRESALE_CONFIG.decimals));
  };

  const validatePurchase = () => {
    if (!solAmount || parseFloat(solAmount) <= 0) {
      Alert.alert(t('error'), t('presale_enter_amount'));
      return false;
    }

    const amount = parseFloat(solAmount);
    
    if (amount < PRESALE_CONFIG.minPurchase) {
      Alert.alert(t('error'), `${t('presale_min_amount')} ${PRESALE_CONFIG.minPurchase} SOL`);
      return false;
    }

    if (amount > PRESALE_CONFIG.maxPurchase) {
      Alert.alert(t('error'), `${t('presale_max_amount')} ${PRESALE_CONFIG.maxPurchase} SOL`);
      return false;
    }

    if (amount > solBalance) {
      Alert.alert(t('error'), t('presale_insufficient_balance'));
      return false;
    }

    return true;
  };

  const handleBuyMeco = async () => {
    if (!validatePurchase()) return;

    const amount = parseFloat(solAmount);
    
    Alert.alert(
      t('presale_confirm_purchase'),
      `${t('presale_you_will_send')}: ${amount.toFixed(4)} SOL\n${t('presale_you_will_receive')}: ${mecoAmount.toLocaleString()} MECO\n\n${t('presale_wallet_address')}:\n${PRESALE_CONFIG.walletAddress}`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('presale_confirm_pay'),
          style: 'default',
          onPress: async () => {
            try {
              setLoading(true);
              const pubKey = await SecureStore.getItemAsync('wallet_public_key');
              
              if (!pubKey) {
                throw new Error(t('connect_wallet_first'));
              }

              // إرسال SOL إلى محفظة البيع المسبق
              const result = await sendSolTransaction({
                fromPubKey: pubKey,
                toPubKey: PRESALE_CONFIG.walletAddress,
                amount: amount,
                memo: `MECO Presale - ${mecoAmount} MECO`
              });

              if (result.success) {
                Alert.alert(
                  '✅ ' + t('presale_purchase_confirmed'),
                  `${t('presale_you_sent')} ${amount.toFixed(4)} SOL\n${t('presale_you_receive')} ${mecoAmount.toLocaleString()} MECO ${t('presale_after_verification')}\n\n${t('presale_transaction_sent')}: ${result.signature}`,
                  [
                    {
                      text: t('presale_view_on_solscan'),
                      onPress: () => {
                        if (result.signature) {
                          Linking.openURL(`https://solscan.io/tx/${result.signature}`);
                        }
                      }
                    },
                    {
                      text: t('ok'),
                      onPress: () => {
                        setSolAmount('');
                        setMecoAmount(0);
                        loadSolBalance();
                        // تحديث المبلغ المحصل
                        setTotalRaised(prev => {
                          const newTotal = prev + amount;
                          return newTotal > PRESALE_CONFIG.totalSolTarget ? 
                            PRESALE_CONFIG.totalSolTarget : newTotal;
                        });
                      }
                    }
                  ]
                );
              } else {
                throw new Error(result.error || t('presale_transaction_failed'));
              }
            } catch (error) {
              console.error('Presale purchase error:', error);
              Alert.alert(
                '❌ ' + t('presale_transaction_failed'),
                error.message || t('presale_transaction_failed_message'),
                [{ text: t('ok') }]
              );
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleCopyAddress = async () => {
    try {
      await Clipboard.setString(PRESALE_CONFIG.walletAddress);
      Alert.alert(t('success'), t('address_copied'));
    } catch (error) {
      console.error('Failed to copy address:', error);
      Alert.alert(t('error'), t('presale_copy_failed'));
    }
  };

  const quickAmounts = [0.03, 0.1, 0.5, 1];

  const handleAmountChange = (text) => {
    // السماح فقط بالأرقام والنقطة
    const cleaned = text.replace(/[^0-9.]/g, '');
    
    // منع أكثر من نقطة واحدة
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    
    // تحديد الحد الأقصى للكسور العشرية
    if (parts[1] && parts[1].length > PRESALE_CONFIG.decimals) {
      return;
    }
    
    // منع القيم السالبة
    if (cleaned.startsWith('-')) return;
    
    setSolAmount(cleaned);
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: bg }]}
      showsVerticalScrollIndicator={false}
    >
      {/* الهيدر */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.title, { color: textColor }]}>
            {t('presale')} MECO
          </Text>
          <Text style={[styles.subtitle, { color: secondaryText }]}>
            {t('presale_progress')}
          </Text>
        </View>
      </View>

      {/* بطاقة التقدم */}
      <View style={[styles.progressCard, { backgroundColor: cardBg, borderColor }]}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressTitle, { color: textColor }]}>
            🚀 {t('presale_progress')}
          </Text>
          <Text style={[styles.progressAmount, { color: primaryColor }]}>
            {totalRaised.toFixed(2)} / {PRESALE_CONFIG.totalSolTarget} SOL
          </Text>
        </View>
        
        {/* شريط التقدم */}
        <View style={[styles.progressBar, { backgroundColor: borderColor }]}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: `${progress}%`,
                backgroundColor: primaryColor
              }
            ]} 
          />
        </View>
        
        <View style={styles.progressStats}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: secondaryText }]}>
              {t('presale_sold')}
            </Text>
            <Text style={[styles.statValue, { color: textColor }]}>
              {totalRaised.toFixed(2)} SOL
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: secondaryText }]}>
              {t('presale_remaining')}
            </Text>
            <Text style={[styles.statValue, { color: textColor }]}>
              {(PRESALE_CONFIG.totalSolTarget - totalRaised).toFixed(2)} SOL
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: secondaryText }]}>
              {t('presale_completion')}
            </Text>
            <Text style={[styles.statValue, { color: textColor }]}>
              {progress.toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>

      {/* بطاقة الشراء */}
      <View style={[styles.buyCard, { backgroundColor: cardBg, borderColor }]}>
        <View style={styles.buyHeader}>
          <View style={styles.tokenLogoContainer}>
            {imageError ? (
              <View style={[styles.tokenLogo, { backgroundColor: primaryColor + '20', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: primaryColor, fontWeight: 'bold', fontSize: 16 }}>MECO</Text>
              </View>
            ) : (
              <Image
                source={{ uri: 'https://raw.githubusercontent.com/saadeh73/meco-project/main/meco-logo.png' }}
                style={styles.tokenLogo}
                onError={() => setImageError(true)}
              />
            )}
          </View>
          <View style={styles.tokenInfo}>
            <Text style={[styles.tokenSymbol, { color: textColor }]}>MECO</Text>
            <Text style={[styles.tokenName, { color: secondaryText }]}>
              {t('official_meco_token')}
            </Text>
          </View>
        </View>

        {/* إدخال المبلغ */}
        <View style={styles.amountSection}>
          <Text style={[styles.sectionLabel, { color: secondaryText }]}>
            {t('presale_enter_sol_amount')}
          </Text>
          
          <View style={[styles.inputContainer, { borderColor, backgroundColor: isDark ? '#2A2A3E' : '#F8FAFD' }]}>
            <View style={styles.currencyLabel}>
              <Text style={[styles.currencyText, { color: textColor }]}>SOL</Text>
            </View>
            <TextInput
              style={[styles.amountInput, { color: textColor }]}
              placeholder="0.0"
              placeholderTextColor={secondaryText}
              keyboardType="decimal-pad"
              value={solAmount}
              onChangeText={handleAmountChange}
              returnKeyType="done"
              editable={!loading}
            />
            <TouchableOpacity onPress={handleMaxAmount} disabled={loading}>
              <Text style={[styles.maxButton, { color: primaryColor, opacity: loading ? 0.5 : 1 }]}>
                {t('max')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* أزرار سريعة */}
          <View style={styles.quickButtons}>
            {quickAmounts.map((amount) => (
              <TouchableOpacity
                key={amount}
                style={[
                  styles.quickButton, 
                  { 
                    backgroundColor: primaryColor + '20', 
                    borderColor: primaryColor + '40',
                    opacity: loading ? 0.5 : 1
                  }
                ]}
                onPress={() => handleQuickSelect(amount)}
                disabled={loading}
              >
                <Text style={[styles.quickButtonText, { color: primaryColor }]}>
                  {amount} SOL
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* سعر التحويل */}
        <View style={styles.conversionSection}>
          <View style={styles.conversionRow}>
            <Text style={[styles.conversionLabel, { color: secondaryText }]}>
              {t('presale_you_send')}
            </Text>
            <Text style={[styles.conversionValue, { color: textColor }]}>
              {solAmount || '0'} SOL
            </Text>
          </View>
          
          <View style={styles.arrowContainer}>
            <Ionicons name="arrow-down" size={20} color={primaryColor} />
          </View>
          
          <View style={styles.conversionRow}>
            <Text style={[styles.conversionLabel, { color: secondaryText }]}>
              {t('presale_you_receive')}
            </Text>
            <Text style={[styles.conversionValue, { color: primaryColor, fontWeight: 'bold' }]}>
              {mecoAmount.toLocaleString()} MECO
            </Text>
          </View>

          {/* سعر الصرف */}
          <View style={styles.rateCard}>
            <Text style={[styles.rateText, { color: secondaryText }]}>
              💎 {t('presale_rate')}: 1 SOL = {(1 / PRESALE_CONFIG.pricePerMeco).toLocaleString()} MECO
            </Text>
          </View>
        </View>

        {/* الحدود */}
        <View style={styles.limitsCard}>
          <View style={styles.limitItem}>
            <Ionicons name="arrow-down-circle" size={16} color="#10B981" />
            <Text style={[styles.limitText, { color: secondaryText }]}>
              {t('presale_min_amount')}: {PRESALE_CONFIG.minPurchase} SOL
            </Text>
          </View>
          <View style={styles.limitItem}>
            <Ionicons name="arrow-up-circle" size={16} color="#EF4444" />
            <Text style={[styles.limitText, { color: secondaryText }]}>
              {t('presale_max_amount')}: {PRESALE_CONFIG.maxPurchase} SOL
            </Text>
          </View>
        </View>

        {/* زر الشراء */}
        <TouchableOpacity
          style={[
            styles.buyButton,
            { 
              backgroundColor: primaryColor,
              opacity: (!solAmount || parseFloat(solAmount) < PRESALE_CONFIG.minPurchase || loading) ? 0.5 : 1
            }
          ]}
          onPress={handleBuyMeco}
          disabled={!solAmount || parseFloat(solAmount) < PRESALE_CONFIG.minPurchase || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="cart" size={20} color="#FFFFFF" />
              <Text style={styles.buyButtonText}>
                {t('presale_buy_meco_now')}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* رصيد SOL */}
        <View style={styles.balanceRow}>
          <Text style={[styles.balanceLabel, { color: secondaryText }]}>
            {t('presale_your_sol_balance')}:
          </Text>
          <TouchableOpacity onPress={loadSolBalance} disabled={loading}>
            <Text style={[styles.balanceValue, { color: textColor }]}>
              {solBalance.toFixed(4)} SOL
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* معلومات المحفظة */}
      <View style={[styles.walletCard, { backgroundColor: cardBg, borderColor }]}>
        <Text style={[styles.walletTitle, { color: textColor }]}>
          {t('presale_wallet_address')}
        </Text>
        <Text style={[styles.walletAddress, { color: secondaryText }]}>
          {PRESALE_CONFIG.walletAddress}
        </Text>
        <View style={styles.walletButtons}>
          <TouchableOpacity
            style={[styles.walletButton, { backgroundColor: primaryColor + '20' }]}
            onPress={handleCopyAddress}
          >
            <Ionicons name="copy" size={16} color={primaryColor} />
            <Text style={[styles.walletButtonText, { color: primaryColor }]}>
              {t('copy_address')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.walletButton, { backgroundColor: primaryColor + '20' }]}
            onPress={() => {
              Linking.openURL(`https://solscan.io/account/${PRESALE_CONFIG.walletAddress}`);
            }}
          >
            <Ionicons name="eye" size={16} color={primaryColor} />
            <Text style={[styles.walletButtonText, { color: primaryColor }]}>
              {t('presale_verify_on_solscan')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* معلومات مهمة */}
      <View style={[styles.infoCard, { backgroundColor: cardBg, borderColor }]}>
        <Ionicons name="information-circle" size={24} color={primaryColor} />
        <View style={styles.infoContent}>
          <Text style={[styles.infoTitle, { color: textColor }]}>
            ℹ️ {t('presale_important_info')}
          </Text>
          <Text style={[styles.infoText, { color: secondaryText }]}>
            • {t('presale_info_1')}
            {'\n'}• {t('presale_info_2')}
            {'\n'}• {t('presale_info_3')}
            {'\n'}• {t('presale_info_4')}
          </Text>
        </View>
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.8,
  },
  progressCard: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  progressAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  buyCard: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  buyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  tokenLogoContainer: {
    marginRight: 12,
  },
  tokenLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenSymbol: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  tokenName: {
    fontSize: 14,
  },
  amountSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    height: 60,
  },
  currencyLabel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    marginRight: 12,
  },
  currencyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    paddingHorizontal: 12,
  },
  maxButton: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 12,
  },
  quickButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  quickButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  conversionSection: {
    marginBottom: 24,
  },
  conversionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  conversionLabel: {
    fontSize: 14,
  },
  conversionValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  arrowContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  rateCard: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  rateText: {
    fontSize: 14,
    textAlign: 'center',
  },
  limitsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  limitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  limitText: {
    fontSize: 12,
    marginLeft: 6,
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 18,
    marginBottom: 16,
  },
  buyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  walletCard: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  walletTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  walletAddress: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 16,
    lineHeight: 18,
  },
  walletButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  walletButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 4,
    justifyContent: 'center',
  },
  walletButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  infoCard: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
  },
  spacer: {
    height: 40,
  },
});
