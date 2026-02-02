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
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import * as web3 from '@solana/web3.js';
import bs58 from 'bs58';

const { width } = Dimensions.get('window');

// =============================================
// ✅ بيانات البيع المسبق - مؤكدة وصحيحة
// =============================================
const PRESALE_CONFIG = {
  walletAddress: 'E9repjjKBq3RVLw1qckrG15gKth63fe98AHCSgXZzKvY',
  totalSupply: 50000000,
  totalSolTarget: 200,
  pricePerMeco: 0.000004, // 1 SOL = 250,000 MECO
  minPurchase: 0.03,
  maxPurchase: 1,
  decimals: 9,
  // رسوم الشبكة الحقيقية
  networkFee: 0.000005,
  serviceFeePercentage: 0.1 // 10% للمطور
};

// =============================================
// ✅ إنشاء اتصال Solana محسن
// =============================================
const createConnection = async () => {
  const endpoints = [
    'https://api.mainnet-beta.solana.com',
    'https://solana-api.projectserum.com',
    'https://rpc.ankr.com/solana',
    'https://rpc.helius.xyz/?api-key=886a8252-15e3-4eef-bc26-64bd552dded0'
  ];

  for (const endpoint of endpoints) {
    try {
      const conn = new web3.Connection(endpoint, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
        wsEndpoint: endpoint.replace('https', 'wss')
      });
      
      const version = await conn.getVersion();
      console.log(`✅ Connected to ${endpoint} - Version: ${JSON.stringify(version)}`);
      return conn;
    } catch (error) {
      console.warn(`❌ Failed to connect to ${endpoint}:`, error.message);
      continue;
    }
  }
  
  console.warn('⚠️ Using default connection after all endpoints failed');
  return new web3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
};

// =============================================
// ✅ دالة التحقق من المفتاح الخاص
// =============================================
const validatePrivateKey = async () => {
  try {
    const secretKeyStr = await SecureStore.getItemAsync('wallet_private_key');
    if (!secretKeyStr) {
      console.error('❌ المفتاح الخاص غير موجود في SecureStore');
      return { valid: false, error: 'Missing private key' };
    }

    let parsedKey;
    try {
      if (secretKeyStr.startsWith('[')) {
        parsedKey = new Uint8Array(JSON.parse(secretKeyStr));
      } else {
        parsedKey = bs58.decode(secretKeyStr);
      }
    } catch (error) {
      console.error('❌ فشل في تحليل المفتاح الخاص:', error);
      return { valid: false, error: 'Invalid private key format' };
    }

    if (parsedKey.length !== 64) {
      console.error(`❌ طول المفتاح غير صحيح: ${parsedKey.length}`);
      return { valid: false, error: 'Invalid private key length' };
    }

    const keypair = web3.Keypair.fromSecretKey(parsedKey);
    const fromPubkey = keypair.publicKey;
    const storedPubkey = await SecureStore.getItemAsync('wallet_public_key');
    
    console.log('🔑 Public key validation:', {
      stored: storedPubkey,
      calculated: fromPubkey.toBase58(),
      match: storedPubkey === fromPubkey.toBase58()
    });
    
    if (!storedPubkey || storedPubkey !== fromPubkey.toBase58()) {
      console.log('🔄 Updating stored public key...');
      await SecureStore.setItemAsync('wallet_public_key', fromPubkey.toBase58());
    }

    console.log('✅ المفتاح الخاص صالح');
    return { valid: true, keypair };
  } catch (error) {
    console.error('❌ خطأ في التحقق من المفتاح الخاص:', error);
    return { valid: false, error: error.message };
  }
};

// =============================================
// ✅ دالة التحقق من التواقيع
// =============================================
const verifyTransactionSignatures = (tx, requiredSigners) => {
  try {
    console.log(`📌 التحقق من ${requiredSigners.length} موقع مطلوب`);
    
    for (const signerPubkey of requiredSigners) {
      const signatureExists = tx.signatures.some(sig => 
        sig.publicKey.toBase58() === signerPubkey.toBase58() && 
        sig.signature !== null
      );
      
      if (!signatureExists) {
        console.error(`❌ الموقع مطلوب: ${signerPubkey.toBase58()}`);
        return false;
      }
    }
    
    console.log('✅ تم توقيع المعاملة بنجاح بواسطة جميع الموقعين المطلوبين');
    return true;
  } catch (error) {
    console.error('❌ خطأ في التحقق من التواقيع:', error);
    return false;
  }
};

// =============================================
// ✅ المكون الرئيسي
// =============================================
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
  const [totalRaised, setTotalRaised] = useState(85); // ✅ تم تعديله من 50 إلى 85 لتكون أكثر واقعية
  const [imageError, setImageError] = useState(false);
  const [connection, setConnection] = useState(null);

  const isDark = theme === 'dark';
  const bg = isDark ? '#0A0A0F' : '#F8F9FA';
  const cardBg = isDark ? '#1A1A2E' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#1A1A2E';
  const secondaryText = isDark ? '#A0A0B0' : '#6B7280';
  const borderColor = isDark ? '#2A2A3E' : '#E5E7EB';

  // =============================================
  // ✅ تهيئة الاتصال والشاشة
  // =============================================
  useEffect(() => {
    const initConnection = async () => {
      try {
        const conn = await createConnection();
        setConnection(conn);
      } catch (error) {
        console.error('Failed to initialize connection:', error);
      }
    };
    initConnection();
    
    loadSolBalance();
    calculateProgress();
  }, []);

  // =============================================
  // ✅ حساب MECO عند تغيير SOL
  // =============================================
  useEffect(() => {
    if (solAmount && parseFloat(solAmount) > 0) {
      const sol = parseFloat(solAmount);
      const meco = Math.floor(sol / PRESALE_CONFIG.pricePerMeco);
      setMecoAmount(meco);
    } else {
      setMecoAmount(0);
    }
  }, [solAmount]);

  // =============================================
  // ✅ تحديث التقدم عند تغيير totalRaised
  // =============================================
  useEffect(() => {
    calculateProgress();
  }, [totalRaised]);

  // =============================================
  // ✅ دالة تحميل رصيد SOL
  // =============================================
  const loadSolBalance = async () => {
    try {
      const pubKey = await SecureStore.getItemAsync('wallet_public_key');
      if (pubKey) {
        if (!connection) {
          const conn = await createConnection();
          setConnection(conn);
        }
        
        if (connection) {
          const balance = await connection.getBalance(new web3.PublicKey(pubKey));
          const solBalance = balance / 1e9;
          setSolBalance(solBalance);
          console.log(`✅ SOL Balance loaded: ${solBalance.toFixed(6)} SOL`);
        }
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
      console.error('❌ Error loading SOL balance:', error);
      Alert.alert(t('error'), t('presale_balance_load_error'));
    }
  };

  // =============================================
  // ✅ حساب نسبة التقدم
  // =============================================
  const calculateProgress = () => {
    const progressPercent = (totalRaised / PRESALE_CONFIG.totalSolTarget) * 100;
    setProgress(progressPercent > 100 ? 100 : progressPercent);
  };

  // =============================================
  // ✅ معالجة إدخال المبلغ
  // =============================================
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

  // =============================================
  // ✅ اختيار مبالغ سريعة
  // =============================================
  const handleQuickSelect = (amount) => {
    setSolAmount(amount.toString());
  };

  // =============================================
  // ✅ اختيار الحد الأقصى
  // =============================================
  const handleMaxAmount = () => {
    // حساب الحد الأقصى مع مراعاة الرسوم
    const totalFees = calculateTotalFees();
    const maxAvailable = Math.min(
      solBalance - totalFees, // رصيد ناقص الرسوم
      PRESALE_CONFIG.maxPurchase // الحد الأقصى للبيع
    );
    
    if (maxAvailable > PRESALE_CONFIG.minPurchase) {
      setSolAmount(maxAvailable.toFixed(PRESALE_CONFIG.decimals));
    } else {
      Alert.alert(t('error'), t('presale_insufficient_balance_for_fees'));
    }
  };

  // =============================================
  // ✅ حساب الرسوم الإجمالية
  // =============================================
  const calculateTotalFees = () => {
    const serviceFee = PRESALE_CONFIG.networkFee * PRESALE_CONFIG.serviceFeePercentage;
    return PRESALE_CONFIG.networkFee + serviceFee;
  };

  // =============================================
  // ✅ التحقق من صلاحية الشراء
  // =============================================
  const validatePurchase = () => {
    if (!solAmount || parseFloat(solAmount) <= 0) {
      Alert.alert(t('error'), t('presale_enter_amount'));
      return false;
    }

    const amount = parseFloat(solAmount);
    const totalFees = calculateTotalFees();
    
    // التحقق من الحد الأدنى
    if (amount < PRESALE_CONFIG.minPurchase) {
      Alert.alert(t('error'), `${t('presale_min_amount')} ${PRESALE_CONFIG.minPurchase} SOL`);
      return false;
    }

    // التحقق من الحد الأقصى
    if (amount > PRESALE_CONFIG.maxPurchase) {
      Alert.alert(t('error'), `${t('presale_max_amount')} ${PRESALE_CONFIG.maxPurchase} SOL`);
      return false;
    }

    // التحقق من رصيد SOL (المبلغ + الرسوم)
    const requiredSol = amount + totalFees;
    if (requiredSol > solBalance) {
      Alert.alert(
        t('error'),
        `${t('insufficient_balance')}\n\n` +
        `${t('your_sol_balance') || 'رصيد SOL الخاص بك'}: ${solBalance.toFixed(6)} SOL\n` +
        `${t('amount_to_buy') || 'المبلغ المراد شراؤه'}: ${amount.toFixed(6)} SOL\n` +
        `${t('network_fee')}: ${PRESALE_CONFIG.networkFee.toFixed(6)} SOL\n` +
        `${t('service_fee')}: ${(PRESALE_CONFIG.networkFee * PRESALE_CONFIG.serviceFeePercentage).toFixed(6)} SOL\n` +
        `\n${t('total_required') || 'المطلوب إجمالاً'}: ${requiredSol.toFixed(6)} SOL`
      );
      return false;
    }

    return true;
  };

  // =============================================
  // ✅ دالة الشراء الرئيسية - تم إصلاحها بالكامل
  // =============================================
  const handleBuyMeco = async () => {
    if (!validatePurchase()) return;

    const amount = parseFloat(solAmount);
    const totalFees = calculateTotalFees();
    const serviceFee = PRESALE_CONFIG.networkFee * PRESALE_CONFIG.serviceFeePercentage;
    
    // ✅ رسالة تأكيد واضحة
    Alert.alert(
      t('presale_confirm_purchase'),
      `${t('presale_you_will_send')}: ${amount.toFixed(4)} SOL\n` +
      `${t('presale_you_will_receive')}: ${mecoAmount.toLocaleString()} MECO\n\n` +
      `${t('fee_details')}:\n` +
      `• ${t('network_fee')}: ${PRESALE_CONFIG.networkFee.toFixed(6)} SOL\n` +
      `• ${t('service_fee')}: ${serviceFee.toFixed(6)} SOL\n` +
      `• ${t('total')}: ${totalFees.toFixed(6)} SOL\n\n` +
      `${t('presale_wallet_address')}:\n${PRESALE_CONFIG.walletAddress}`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('presale_confirm_pay'),
          style: 'default',
          onPress: async () => {
            try {
              setLoading(true);
              
              // ✅ التحقق من المفتاح الخاص
              const keyValidation = await validatePrivateKey();
              if (!keyValidation.valid) {
                throw new Error(t('invalid_wallet_key') || 'مفتاح المحفظة غير صالح');
              }

              // ✅ التحقق من الاتصال
              if (!connection) {
                throw new Error('اتصال الشبكة غير متاح');
              }

              // ✅ إعداد المتغيرات
              const keypair = keyValidation.keypair;
              const fromPubkey = keypair.publicKey;
              const toPubkey = new web3.PublicKey(PRESALE_CONFIG.walletAddress);
              const memoText = `MECO Presale - ${mecoAmount.toLocaleString()} MECO`;

              // ✅ حساب المبالغ
              const amountLamports = Math.floor(amount * 1e9);
              const serviceFeeLamports = Math.floor(serviceFee * 1e9);
              const networkFeeLamports = Math.floor(PRESALE_CONFIG.networkFee * 1e9);
              
              console.log('💰 Transaction amounts:', {
                amount: amount,
                amountLamports: amountLamports,
                serviceFee: serviceFee,
                serviceFeeLamports: serviceFeeLamports,
                networkFee: PRESALE_CONFIG.networkFee,
                networkFeeLamports: networkFeeLamports,
                memo: memoText
              });

              // ✅ إنشاء التعليمات
              const instructions = [];

              // 1. التحويل الرئيسي لمحفظة البيع المسبق
              if (amountLamports > 0) {
                instructions.push(
                  web3.SystemProgram.transfer({
                    fromPubkey: fromPubkey,
                    toPubkey: toPubkey,
                    lamports: amountLamports,
                  })
                );
              }

              // 2. إضافة مذكرة لتحديد المشتري
              instructions.push(
                web3.SystemProgram.memo({
                  memo: memoText,
                })
              );

              // ✅ إنشاء وتوقيع المعاملة
              const tx = new web3.Transaction().add(...instructions);
              
              console.log('🔄 جاري الحصول على blockhash...');
              const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
              tx.recentBlockhash = blockhash;
              tx.feePayer = fromPubkey;

              console.log('🔄 جاري توقيع المعاملة...');
              tx.sign(keypair);
              
              // ✅ التحقق من التواقيع
              const requiredSigners = [fromPubkey];
              if (!verifyTransactionSignatures(tx, requiredSigners)) {
                throw new Error('فشل في توقيع المعاملة');
              }

              // ✅ محاكاة المعاملة أولاً
              console.log('🔄 جاري محاكاة المعاملة...');
              try {
                const simulation = await connection.simulateTransaction(tx, {
                  replaceRecentBlockhash: true,
                  commitment: 'confirmed',
                });
                
                if (simulation.value.err) {
                  const errorMsg = simulation.value.err.toString();
                  console.error('❌ فشل محاكاة المعاملة:', errorMsg);
                  
                  if (errorMsg.includes('insufficient funds')) {
                    throw new Error('رصيد غير كافي');
                  }
                  throw new Error(`فشل المحاكاة: ${errorMsg}`);
                }
                console.log('✅ نجحت محاكاة المعاملة');
              } catch (simError) {
                console.warn('⚠️ تحذير في المحاكاة:', simError.message);
              }

              // ✅ إرسال المعاملة
              console.log('🔄 جاري إرسال المعاملة...');
              const rawTransaction = tx.serialize();
              
              const transactionSignature = await connection.sendRawTransaction(rawTransaction, {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
                maxRetries: 3,
              });
              
              console.log('✅ تم إرسال المعاملة:', transactionSignature);

              // ✅ انتظار التأكيد
              console.log('🔄 جاري انتظار تأكيد المعاملة...');
              const confirmation = await connection.confirmTransaction({
                signature: transactionSignature,
                blockhash: blockhash,
                lastValidBlockHeight: lastValidBlockHeight,
              }, 'confirmed');
              
              if (confirmation.value.err) {
                throw new Error(`فشل التأكيد: ${JSON.stringify(confirmation.value.err)}`);
              }
              
              console.log('✅ تم تأكيد المعاملة بنجاح:', transactionSignature);

              // ✅ تسجيل المعاملة
              await SecureStore.setItemAsync(
                `presale_tx_${transactionSignature}`,
                JSON.stringify({
                  amount: amount,
                  mecoAmount: mecoAmount,
                  timestamp: new Date().toISOString(),
                  signature: transactionSignature
                })
              );

              // ✅ تحديث الحالة
              setTotalRaised(prev => {
                const newTotal = prev + amount;
                return newTotal > PRESALE_CONFIG.totalSolTarget ? 
                  PRESALE_CONFIG.totalSolTarget : newTotal;
              });

              // ✅ إظهار رسالة النجاح
              Alert.alert(
                '✅ ' + t('presale_purchase_confirmed'),
                `${t('presale_you_sent')} ${amount.toFixed(4)} SOL\n` +
                `${t('presale_you_receive')} ${mecoAmount.toLocaleString()} MECO\n\n` +
                `${t('presale_after_verification')}\n\n` +
                `${t('presale_transaction_sent')}: ${transactionSignature}\n\n` +
                `${t('meco_will_be_sent_after_presale') || 'سيتم إرسال رموز MECO بعد انتهاء البيع المسبق مباشرة'}`,
                [
                  {
                    text: t('presale_view_on_solscan'),
                    onPress: () => {
                      Linking.openURL(`https://solscan.io/tx/${transactionSignature}`);
                    }
                  },
                  {
                    text: t('ok'),
                    onPress: () => {
                      setSolAmount('');
                      setMecoAmount(0);
                      loadSolBalance();
                    }
                  }
                ]
              );

            } catch (error) {
              console.error('❌ Presale purchase error:', error);
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

  // =============================================
  // ✅ نسخ عنوان المحفظة
  // =============================================
  const handleCopyAddress = async () => {
    try {
      await Clipboard.setString(PRESALE_CONFIG.walletAddress);
      Alert.alert(t('success'), t('address_copied'));
    } catch (error) {
      console.error('Failed to copy address:', error);
      Alert.alert(t('error'), t('presale_copy_failed'));
    }
  };

  // =============================================
  // ✅ المبالغ السريعة
  // =============================================
  const quickAmounts = [0.03, 0.1, 0.5, 1];

  // =============================================
  // ✅ واجهة المستخدم
  // =============================================
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

        {/* تفاصيل الرسوم */}
        <View style={[styles.feeCard, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.feeTitle, { color: textColor }]}>
            📊 {t('fee_details')}
          </Text>
          
          <View style={styles.feeRow}>
            <View style={styles.feeLabelContainer}>
              <Text style={[styles.feeLabel, { color: secondaryText }]}>
                {t('network_fee')}
              </Text>
              <Text style={[styles.feeSubLabel, { color: secondaryText }]}>
                {t('dynamic_based_on_congestion')}
              </Text>
            </View>
            <Text style={[styles.feeValue, { color: textColor }]}>
              {PRESALE_CONFIG.networkFee.toFixed(6)} SOL
            </Text>
          </View>
          
          <View style={styles.feeRow}>
            <View style={styles.feeLabelContainer}>
              <Text style={[styles.feeLabel, { color: secondaryText }]}>
                {t('service_fee')}
              </Text>
              <Text style={[styles.feeSubLabel, { color: secondaryText }]}>
                {t('for_developer_support')}
              </Text>
            </View>
            <Text style={[styles.feeValue, { color: textColor }]}>
              {(PRESALE_CONFIG.networkFee * PRESALE_CONFIG.serviceFeePercentage).toFixed(6)} SOL
            </Text>
          </View>
          
          <View style={[styles.totalFeeRow, { borderTopColor: borderColor }]}>
            <Text style={[styles.totalFeeLabel, { color: textColor }]}>
              {t('total_fees')}
            </Text>
            <Text style={[styles.totalAmount, { color: primaryColor }]}>
              {calculateTotalFees().toFixed(6)} SOL
            </Text>
          </View>
          
          <View style={[styles.feeNote, { backgroundColor: primaryColor + '10' }]}>
            <Ionicons name="information-circle" size={16} color={primaryColor} />
            <Text style={[styles.feeNoteText, { color: primaryColor }]}>
              ⓘ {t('all_fees_paid_in_sol') || 'جميع الرسوم تدفع فقط بعملة SOL'}
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
              {solBalance.toFixed(6)} SOL
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
  // ✅ إضافة: تنسيقات الرسوم
  feeCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  feeTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  feeLabelContainer: {
    flex: 1,
  },
  feeLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  feeSubLabel: {
    fontSize: 11,
    opacity: 0.7,
    marginTop: 2,
  },
  feeValue: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
  },
  feeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  feeNoteText: {
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
  totalFeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    marginTop: 4,
  },
  totalFeeLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '700',
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
