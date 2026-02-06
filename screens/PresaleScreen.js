import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store'; // تأكد من مسار الستور
import { useTranslation } from 'react-i18next'; // تأكد من إعداد الترجمة
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import * as web3 from '@solana/web3.js';
import bs58 from 'bs58';
import { getSolBalance, getCurrentNetworkFee } from '../services/heliusService'; // تأكد من المسار

const { width } = Dimensions.get('window');

// =============================================
// ⚙️ إعدادات البيع المسبق (Presale Config)
// =============================================

// ⚠️ هام: ضع عنوان محفظة استلام الـ SOL هنا
const PRESALE_WALLET_ADDRESS = 'E9repjjKBq3RVLw1qckrG15gKth63fe98AHCSgXZzKvY'; 

const RATE_MECO_PER_SOL = 125000; // 1 SOL = 125,000 MECO
const MIN_BUY_SOL = 0.03;
const MAX_BUY_SOL = 2.0;
const TOTAL_SUPPLY = 50000000; // للعرض فقط

export default function PresaleScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const theme = useAppStore(state => state.theme);
  const primaryColor = useAppStore(state => state.primaryColor || '#6C63FF');
  const isDark = theme === 'dark';

  const colors = {
    background: isDark ? '#0A0A0F' : '#FFFFFF',
    card: isDark ? '#1A1A2E' : '#F8FAFD',
    text: isDark ? '#FFFFFF' : '#1A1A2E',
    textSecondary: isDark ? '#A0A0B0' : '#6B7280',
    border: isDark ? '#2A2A3E' : '#E5E7EB',
    inputBackground: isDark ? '#2A2A3E' : '#FFFFFF',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
  };

  const [amountSol, setAmountSol] = useState('');
  const [amountMeco, setAmountMeco] = useState('0');
  const [loading, setLoading] = useState(false);
  const [balanceSol, setBalanceSol] = useState(0);
  const [networkFee, setNetworkFee] = useState(0.000005);

  // تحديث البيانات عند فتح الشاشة
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const bal = await getSolBalance();
      setBalanceSol(bal);
      const fee = await getCurrentNetworkFee();
      setNetworkFee(fee);
    } catch (error) {
      console.log('Error loading data', error);
    }
  };

  // التعامل مع تغيير المدخلات والحساب التلقائي
  const handleSolChange = (text) => {
    // السماح فقط بالأرقام والنقطة
    const cleaned = text.replace(/[^0-9.]/g, '');
    
    // منع تكرار النقطة
    const parts = cleaned.split('.');
    if (parts.length > 2) return;

    setAmountSol(cleaned);

    const val = parseFloat(cleaned);
    if (!isNaN(val)) {
      // حساب كمية MECO
      const mecoVal = val * RATE_MECO_PER_SOL;
      // تنسيق الرقم (بدون كسور عشرية لـ MECO إذا رغبت، أو 2)
      setAmountMeco(mecoVal.toLocaleString('en-US')); 
    } else {
      setAmountMeco('0');
    }
  };

  const handleMax = () => {
    // الحد الأقصى هو الأقل بين (رصيد المستخدم - الرسوم) و (الحد الأقصى للمشروع 2 SOL)
    const maxUserCanPay = Math.max(0, balanceSol - networkFee - 0.002); // 0.002 هامش أمان
    const finalMax = Math.min(maxUserCanPay, MAX_BUY_SOL);
    
    if (finalMax <= 0) {
      Alert.alert(
        t('presale_alert'), 
        t('presale_insufficient_balance')
      );
      return;
    }

    handleSolChange(finalMax.toFixed(4));
  };

  const handleBuyPresale = async () => {
    const solAmount = parseFloat(amountSol);

    // 1. التحققات المنطقية
    if (isNaN(solAmount) || solAmount <= 0) {
      Alert.alert(
        t('presale_error'), 
        t('presale_enter_valid_amount')
      );
      return;
    }

    if (solAmount < MIN_BUY_SOL) {
      Alert.alert(
        t('presale_error'), 
        t('presale_minimum_purchase', { min: MIN_BUY_SOL })
      );
      return;
    }

    if (solAmount > MAX_BUY_SOL) {
      Alert.alert(
        t('presale_error'), 
        t('presale_maximum_purchase', { max: MAX_BUY_SOL })
      );
      return;
    }

    if (solAmount + networkFee > balanceSol) {
      Alert.alert(
        t('presale_error'), 
        t('presale_insufficient_sol')
      );
      return;
    }

    // التحقق من أن المطور وضع عنوان المحفظة
    if (PRESALE_WALLET_ADDRESS === 'PUT_YOUR_PROJECT_WALLET_ADDRESS_HERE') {
      Alert.alert(
        t('presale_error'), 
        t('presale_developer_error')
      );
      return;
    }

    setLoading(true);

    try {
      // 2. تجهيز المعاملة
      const secretKeyStr = await SecureStore.getItemAsync('wallet_private_key');
      if (!secretKeyStr) throw new Error('Private key not found');

      let secretKey;
      if (secretKeyStr.startsWith('[')) {
        secretKey = new Uint8Array(JSON.parse(secretKeyStr));
      } else {
        secretKey = bs58.decode(secretKeyStr);
      }
      const keypair = web3.Keypair.fromSecretKey(secretKey);

      const connection = new web3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      const transaction = new web3.Transaction();

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = keypair.publicKey;

      // تعليمة تحويل SOL إلى محفظة المشروع
      transaction.add(
        web3.SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: new web3.PublicKey(PRESALE_WALLET_ADDRESS),
          lamports: Math.floor(solAmount * web3.LAMPORTS_PER_SOL),
        })
      );

      // 3. الإرسال
      const signature = await web3.sendAndConfirmTransaction(
        connection,
        transaction,
        [keypair]
      );

      console.log('Transaction Success:', signature);

      // 4. رسالة النجاح
      Alert.alert(
        t('presale_success_title'),
        t('presale_success_message', { 
          solAmount: solAmount, 
          mecoAmount: amountMeco 
        }),
        [{ 
          text: t('presale_ok'), 
          onPress: () => {
            setAmountSol('');
            setAmountMeco('0');
            loadUserData(); // تحديث الرصيد
            navigation.navigate('Wallet'); // أو البقاء في نفس الشاشة
          } 
        }]
      );

    } catch (error) {
      console.error('Presale Error:', error);
      Alert.alert(
        t('presale_transaction_failed'), 
        error.message || t('presale_unexpected_error')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('presale_title')}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: primaryColor }]}>
          <Text style={styles.infoTitle}>
            {t('presale_exclusive_offer')}
          </Text>
          <Text style={styles.infoRate}>
            {t('presale_rate')}
          </Text>
          <View style={styles.limitsContainer}>
             <View style={styles.limitBadge}>
               <Text style={styles.limitText}>
                 {t('presale_min_limit', { min: MIN_BUY_SOL })}
               </Text>
             </View>
             <View style={styles.limitBadge}>
               <Text style={styles.limitText}>
                 {t('presale_max_limit', { max: MAX_BUY_SOL })}
               </Text>
             </View>
          </View>
        </View>

        {/* Input Section */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {t('presale_you_pay')}
          </Text>
          
          <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
            <Image 
              source={{ uri: 'https://assets.coingecko.com/coins/images/4128/large/solana.png' }} 
              style={styles.coinIcon} 
            />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={amountSol}
              onChangeText={handleSolChange}
            />
            <TouchableOpacity onPress={handleMax}>
              <Text style={[styles.maxBtn, { color: primaryColor }]}>
                {t('presale_max_button')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.balanceContainer}>
            <Text style={[styles.balanceText, { color: colors.textSecondary }]}>
              {t('presale_your_balance', { balance: balanceSol.toFixed(4) })}
            </Text>
          </View>

          {/* Icon Divider */}
          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <View style={[styles.arrowIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="arrow-down" size={20} color={primaryColor} />
            </View>
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {t('presale_you_receive')}
          </Text>
          
          <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
             {/* استبدل الرابط أدناه بشعار MECO الحقيقي إذا توفر */}
            <Image 
              source={{ uri: 'https://raw.githubusercontent.com/saadeh73/meco-project/main/meco-logo.png' }} 
              style={styles.coinIcon} 
            />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={amountMeco}
              editable={false} // للقراءة فقط
            />
            <Text style={[styles.tickerText, { color: colors.textSecondary }]}>
              {t('presale_ticker_meco')}
            </Text>
          </View>

          <Text style={[styles.noteText, { color: colors.textSecondary }]}>
            {t('presale_note')}
          </Text>

        </View>

        {/* Buy Button */}
        <TouchableOpacity
          style={[
            styles.buyButton,
            { 
              backgroundColor: (!amountSol || loading) ? colors.border : primaryColor,
              opacity: (!amountSol || loading) ? 0.7 : 1
            }
          ]}
          disabled={!amountSol || loading}
          onPress={handleBuyPresale}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buyButtonText}>
              {t('presale_buy_now')}
            </Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// =============================================
// 🎨 Styles (نفسها بدون تغيير)
// =============================================
const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  backButton: {
    padding: 8,
  },
  infoCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  infoTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.9,
  },
  infoRate: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  limitsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  limitBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  limitText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 60,
  },
  coinIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    height: '100%',
  },
  maxBtn: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  tickerText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  balanceContainer: {
    alignItems: 'flex-end',
    marginTop: 8,
    marginRight: 4,
  },
  balanceText: {
    fontSize: 12,
  },
  dividerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    marginVertical: 4,
  },
  dividerLine: {
    width: '100%',
    height: 1,
    position: 'absolute',
  },
  arrowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    zIndex: 1,
  },
  noteText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
  buyButton: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  buyButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
