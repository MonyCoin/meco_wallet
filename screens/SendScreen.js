import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, Modal, FlatList,
  Dimensions, Animated, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import { useRoute } from '@react-navigation/native';
import { 
  getSolBalance, 
  getTokenBalance, 
  validateSolanaAddress, 
  getCurrentNetworkFee, 
  clearBalanceCache,
  delay 
} from '../services/heliusService';
import { logTransaction } from '../services/transactionLogger';
import { Ionicons } from '@expo/vector-icons';
import * as web3 from '@solana/web3.js';
import bs58 from 'bs58';
import * as splToken from '@solana/spl-token';
import * as Clipboard from 'expo-clipboard';

const { width } = Dimensions.get('window');

// =============================================
// ✅ Fee Collector Wallet Address
// =============================================
const FEE_COLLECTOR_ADDRESS = 'HXkEZSKictbSYan9ZxQGaHpFrbA4eLDyNtEDxVBkdFy6';

// Dynamic network fees + service fees
const SERVICE_FEE_PERCENTAGE = 0.1; // 10% of network fees go to developer
const RENT_EXEMPTION_AMOUNT = 0.00203928; // Minimum SOL required for new account

// Base tokens
const BASE_TOKENS = [
  {
    symbol: 'SOL',
    name: 'Solana',
    mint: null,
    icon: 'diamond-outline',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    decimals: 9
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    mint: 'Es9vMFrzaCERc8Foa8XfRduKiSfrhEL5c7qr2WXXBWY5',
    icon: 'cash-outline',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERc8Foa8XfRduKiSfrhEL5c7qr2WXXBWY5/logo.png',
    decimals: 6
  },
  {
    symbol: 'MECO',
    name: 'MECO Token',
    mint: '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i',
    icon: 'rocket-outline',
    logoURI: 'https://raw.githubusercontent.com/saadeh73/meco-project/main/meco-logo.png',
    decimals: 6
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    icon: 'wallet-outline',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    decimals: 6
  },
];

// =============================================
// ✅ Enhanced Solana Connection
// =============================================
const createConnection = async () => {
  const endpoints = [
    'https://api.mainnet-beta.solana.com',
    'https://solana-api.projectserum.com',
    'https://rpc.ankr.com/solana'
  ];

  for (const endpoint of endpoints) {
    try {
      const conn = new web3.Connection(endpoint, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
      });
      
      // Test connection
      await conn.getEpochInfo();
      console.log(`✅ Connected to ${endpoint.split('//')[1]}`);
      return conn;
    } catch (error) {
      console.warn(`❌ Failed to connect to ${endpoint}:`, error.message);
      continue;
    }
  }
  
  // Fallback to default
  console.warn('⚠️ Using default connection');
  return new web3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
};

// =============================================
// ✅ Validation Functions
// =============================================
async function isValidSolanaAddress(address) {
  return validateSolanaAddress(address);
}

const validatePrivateKey = async () => {
  try {
    const secretKeyStr = await SecureStore.getItemAsync('wallet_private_key');
    if (!secretKeyStr) {
      console.error('❌ المفتاح الخاص غير موجود');
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
// ✅ Transaction Verification
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
    
    console.log('✅ تم توقيع المعاملة بنجاح');
    return true;
  } catch (error) {
    console.error('❌ خطأ في التحقق من التواقيع:', error);
    return false;
  }
};

// =============================================
// ✅ Main Component
// =============================================
export default function SendScreen() {
  const { t } = useTranslation();
  const route = useRoute();
  const theme = useAppStore(state => state.theme);
  const primaryColor = useAppStore(state => state.primaryColor);
  const isDark = theme === 'dark';
  
  // Theme colors
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

  const preselected = route?.params?.preselectedToken;
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(preselected || 'SOL');
  const [modalVisible, setModalVisible] = useState(false);
  const [balance, setBalance] = useState(0);
  const [solBalance, setSolBalance] = useState(0);
  const [availableTokens, setAvailableTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [networkFee, setNetworkFee] = useState(0.000005);
  const [connection, setConnection] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [recipientExists, setRecipientExists] = useState(null);

  // Calculate total fees
  const calculateTotalFee = () => {
    const serviceFee = networkFee * SERVICE_FEE_PERCENTAGE;
    return networkFee + serviceFee;
  };

  // Initialize Solana connection
  useEffect(() => {
    const initConnection = async () => {
      try {
        const conn = await createConnection();
        setConnection(conn);
        
        // تحديث رسوم الشبكة
        const currentFee = await getCurrentNetworkFee();
        setNetworkFee(currentFee);
      } catch (error) {
        console.error('Failed to initialize connection:', error);
      }
    };
    initConnection();
  }, []);

  // Check recipient account
  useEffect(() => {
    const checkRecipientAccount = async () => {
      if (!recipient || !connection) {
        setRecipientExists(null);
        return;
      }

      try {
        const validation = await validateSolanaAddress(recipient);
        if (!validation.isValid) {
          setRecipientExists(false);
          return;
        }
        
        setRecipientExists(validation.exists);
        console.log(`📌 Recipient exists: ${validation.exists}`);
      } catch (error) {
        console.warn('Could not check recipient:', error);
        setRecipientExists(null);
      }
    };

    const timeoutId = setTimeout(checkRecipientAccount, 1000);
    return () => clearTimeout(timeoutId);
  }, [recipient, connection]);

  // Initialize component
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
    
    loadTokensAndPrices();
    
    // تحديث رسوم الشبكة كل 60 ثانية
    const feeInterval = setInterval(async () => {
      const currentFee = await getCurrentNetworkFee();
      setNetworkFee(currentFee);
    }, 60000);
    
    return () => clearInterval(feeInterval);
  }, []);

  // Load balances when currency changes
  useEffect(() => {
    const loadBalanceWithDelay = async () => {
      if (currency) {
        await delay(500); // تأخير لتجنب Rate Limiting
        await loadAllBalances();
      }
    };
    
    loadBalanceWithDelay();
  }, [currency]);

  // Load all balances - الإصدار المحسن
  async function loadAllBalances() {
    try {
      console.log('🔄 Loading balances for:', currency);
      
      if (currency === 'SOL') {
        const sol = await getSolBalance();
        setBalance(sol || 0);
        setSolBalance(sol || 0);
        console.log(`✅ SOL balance loaded: ${sol}`);
      } else {
        // تأخير قبل جلب التوكنات
        console.log(`⏳ Delaying before loading ${currency}...`);
        await delay(2000);
        
        const currentToken = availableTokens.find(t => t.symbol === currency);
        if (currentToken?.mint) {
          console.log(`🔄 Loading ${currency} balance...`);
          const tokenBalance = await getTokenBalance(currentToken.mint);
          setBalance(tokenBalance || 0);
          console.log(`✅ ${currency} balance: ${tokenBalance}`);
        } else {
          setBalance(0);
        }
        
        // SOL للرسوم
        await delay(1000);
        const sol = await getSolBalance();
        setSolBalance(sol || 0);
      }
    } catch (err) {
      console.warn('Balance load error:', err.message);
      // لا نقوم بمسح القيم القديمة
    }
  }

  // Load tokens and prices - الإصدار المبسط جداً
  async function loadTokensAndPrices() {
    try {
      setLoadingTokens(true);
      
      // بيانات ثابتة بدون طلبات متعددة
      const tokensWithIcons = BASE_TOKENS.map(t => ({ 
        ...t, 
        uniqueKey: t.mint || `base_${t.symbol}`,
        userBalance: 0,
        hasBalance: false 
      }));
      
      const pub = await SecureStore.getItemAsync('wallet_public_key');
      if (pub) {
        try {
          // ✅ جلب SOL فقط مع تأخير
          console.log('🔄 Loading SOL balance only...');
          await delay(1000);
          
          const solBalance = await getSolBalance();
          const solIndex = tokensWithIcons.findIndex(t => t.symbol === 'SOL');
          if (solIndex !== -1) {
            tokensWithIcons[solIndex].userBalance = solBalance || 0;
            tokensWithIcons[solIndex].hasBalance = (solBalance || 0) > 0;
            console.log(`✅ SOL loaded: ${solBalance}`);
          }
          
        } catch (err) {
          console.warn('Balance load warning:', err.message);
        }
      }
      
      setAvailableTokens(tokensWithIcons);
      
    } catch (error) {
      console.error('❌ Error loading tokens:', error);
      setAvailableTokens(BASE_TOKENS.map(t => ({ 
        ...t, 
        uniqueKey: t.mint || `base_${t.symbol}`,
        userBalance: 0, 
        hasBalance: false 
      })));
    } finally {
      setLoadingTokens(false);
    }
  }

  // Get current token
  const getCurrentToken = () => {
    return availableTokens.find(token => token.symbol === currency) || BASE_TOKENS[0];
  };

  // Handle send button press
  const handleSend = async () => {
    try {
      console.log('🔄 Starting send process...');
      
      // Validate private key
      const keyValidation = await validatePrivateKey();
      if (!keyValidation.valid) {
        Alert.alert(t('error'), t('invalid_wallet_key') || 'مفتاح المحفظة غير صالح');
        return;
      }

      // Basic validation
      if (!recipient || !amount) {
        Alert.alert(t('error'), t('fill_fields'));
        return;
      }

      // Validate recipient address
      const addressValidation = await validateSolanaAddress(recipient);
      if (!addressValidation.isValid) {
        Alert.alert(t('error'), t('invalid_address'));
        return;
      }

      // Check if sending to self
      const myAddress = await SecureStore.getItemAsync('wallet_public_key');
      if (recipient === myAddress) {
        Alert.alert(t('error'), t('cannot_send_to_self'));
        return;
      }

      // Validate amount
      const num = parseFloat(amount);
      if (isNaN(num) || num <= 0) {
        Alert.alert(t('error'), t('amount_must_be_positive'));
        return;
      }

      // Refresh balances
      await loadAllBalances();
      
      const totalFee = calculateTotalFee();
      const serviceFee = networkFee * SERVICE_FEE_PERCENTAGE;
      
      // Calculate required amounts
      let requiredSol = totalFee;
      let totalRequired = num;
      
      // If sending SOL to new account, add rent exemption
      if (currency === 'SOL' && recipientExists === false) {
        totalRequired += RENT_EXEMPTION_AMOUNT;
        requiredSol += RENT_EXEMPTION_AMOUNT;
      }

      console.log('💰 Balance check:', {
        currency,
        amount: num,
        balance,
        solBalance,
        totalFee,
        requiredSol
      });

      // Check balances
      if (currency === 'SOL') {
        if (totalRequired + totalFee > solBalance) {
          Alert.alert(
            t('error'),
            `${t('insufficient_balance')}\n\n` +
            `${t('your_sol_balance') || 'رصيد SOL الخاص بك'}: ${solBalance.toFixed(6)} SOL\n` +
            `${t('amount_to_send') || 'المبلغ المراد إرساله'}: ${num.toFixed(6)} SOL\n` +
            `${t('network_fee')}: ${networkFee.toFixed(6)} SOL\n` +
            `${t('service_fee')}: ${serviceFee.toFixed(6)} SOL\n` +
            (recipientExists === false ? `${t('rent_exempt_fee') || 'رسوم إنشاء الحساب'}: ${RENT_EXEMPTION_AMOUNT.toFixed(6)} SOL\n` : '') +
            `\n${t('total_required') || 'المطلوب إجمالاً'}: ${(totalRequired + totalFee).toFixed(6)} SOL`
          );
          return;
        }
      } else {
        // Check token balance
        if (num > balance) {
          Alert.alert(
            t('error'),
            `${t('insufficient_balance_for_token') || 'رصيد غير كافي'}\n\n` +
            `${t('your_balance') || 'رصيدك'}: ${balance.toFixed(6)} ${currency}\n` +
            `${t('amount_to_send') || 'المبلغ المراد إرساله'}: ${num.toFixed(6)} ${currency}`
          );
          return;
        }

        // Check SOL balance for fees
        if (totalFee > solBalance) {
          Alert.alert(
            t('error'),
            `${t('insufficient_sol_for_fees') || 'رصيد SOL غير كافي للرسوم'}\n\n` +
            `${t('required_fees') || 'الرسوم المطلوبة'}: ${totalFee.toFixed(6)} SOL\n` +
            `${t('your_sol_balance') || 'رصيد SOL الخاص بك'}: ${solBalance.toFixed(6)} SOL`
          );
          return;
        }
      }

      setLoading(true);
      await proceedWithSend(num, totalFee, keyValidation.keypair);
    } catch (err) {
      console.error('Send validation error:', err);
      setLoading(false);
      Alert.alert(t('error'), 'Validation error: ' + err.message);
    }
  };

  // Main send function
  const proceedWithSend = async (num, totalFee, keypair) => {
    try {
      console.log('🔄 بدء عملية الإرسال...');
      
      const fromPubkey = keypair.publicKey;
      const toPubkey = new web3.PublicKey(recipient);
      const feeCollectorPubkey = new web3.PublicKey(FEE_COLLECTOR_ADDRESS);
      
      if (!connection) {
        throw new Error('اتصال الشبكة غير متاح');
      }

      const currentToken = getCurrentToken();
      const serviceFee = networkFee * SERVICE_FEE_PERCENTAGE;
      let transactionSignature;

      if (currency === 'SOL') {
        console.log('🔄 إرسال SOL...');
        
        // Calculate lamports
        const lamportsToSend = Math.floor(num * 1e9);
        const serviceFeeLamports = Math.floor(serviceFee * 1e9);
        const rentExemptLamports = recipientExists === false ? Math.floor(RENT_EXEMPTION_AMOUNT * 1e9) : 0;
        
        const instructions = [];

        // Main transfer
        if (lamportsToSend > 0) {
          instructions.push(
            web3.SystemProgram.transfer({
              fromPubkey: fromPubkey,
              toPubkey: toPubkey,
              lamports: lamportsToSend,
            })
          );
        }

        // Add rent exemption if needed
        if (rentExemptLamports > 0) {
          instructions.push(
            web3.SystemProgram.transfer({
              fromPubkey: fromPubkey,
              toPubkey: toPubkey,
              lamports: rentExemptLamports,
            })
          );
        }

        // Service fee
        if (serviceFeeLamports > 0) {
          instructions.push(
            web3.SystemProgram.transfer({
              fromPubkey,
              toPubkey: feeCollectorPubkey,
              lamports: serviceFeeLamports,
            })
          );
        }

        // Create transaction
        const tx = new web3.Transaction().add(...instructions);
        
        // Get latest blockhash
        console.log('🔄 جاري الحصول على blockhash...');
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.feePayer = fromPubkey;

        // Sign transaction
        console.log('🔄 جاري توقيع المعاملة...');
        tx.sign(keypair);
        
        // Verify signatures
        const requiredSigners = [fromPubkey];
        if (!verifyTransactionSignatures(tx, requiredSigners)) {
          throw new Error('فشل في توقيع المعاملة');
        }

        // Send transaction
        console.log('🔄 جاري إرسال المعاملة...');
        const rawTransaction = tx.serialize();
        
        transactionSignature = await connection.sendRawTransaction(rawTransaction, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });
        
        console.log('✅ تم إرسال المعاملة:', transactionSignature);

        // Confirm transaction
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

      } else if (currentToken.mint) {
        console.log('🔄 إرسال توكن:', currentToken.symbol);
        
        const mint = new web3.PublicKey(currentToken.mint);
        const fromATA = await splToken.getAssociatedTokenAddress(mint, fromPubkey);
        const toATA = await splToken.getAssociatedTokenAddress(mint, toPubkey);

        const mintInfo = await splToken.getMint(connection, mint);
        const decimals = mintInfo.decimals || 6;
        const amountToSend = BigInt(Math.floor(num * Math.pow(10, decimals)));

        const instructions = [];

        // Check and create recipient ATA if needed
        const toATAInfo = await connection.getAccountInfo(toATA);
        if (!toATAInfo) {
          instructions.push(
            splToken.createAssociatedTokenAccountInstruction(
              fromPubkey, 
              toATA, 
              toPubkey, 
              mint
            )
          );
        }

        // Transfer token
        instructions.push(
          splToken.createTransferInstruction(
            fromATA, 
            toATA, 
            fromPubkey, 
            amountToSend
          )
        );

        // Service fee in SOL
        const serviceFeeLamports = Math.floor(serviceFee * 1e9);
        if (serviceFeeLamports > 0) {
          instructions.push(
            web3.SystemProgram.transfer({
              fromPubkey,
              toPubkey: feeCollectorPubkey,
              lamports: serviceFeeLamports,
            })
          );
        }

        // Create transaction
        const tx = new web3.Transaction().add(...instructions);
        
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.feePayer = fromPubkey;
        
        // Sign transaction
        tx.sign(keypair);

        // Send transaction
        const rawTransaction = tx.serialize();
        transactionSignature = await connection.sendRawTransaction(rawTransaction, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });
        
        console.log('✅ Transaction sent, waiting for confirmation...');
        
        // Confirm transaction
        await connection.confirmTransaction({
          signature: transactionSignature,
          blockhash: blockhash,
          lastValidBlockHeight: lastValidBlockHeight,
        }, 'confirmed');
        
        console.log('✅ Token transfer successful:', transactionSignature);
      } else {
        throw new Error('رمز غير صالح');
      }

      // Log transaction
      await logTransaction({
        type: 'send',
        to: recipient,
        amount: num,
        currency,
        networkFee: networkFee,
        serviceFee: serviceFee,
        totalFee: totalFee,
        feeCollectorAddress: FEE_COLLECTOR_ADDRESS,
        transactionSignature: transactionSignature,
        timestamp: new Date().toISOString(),
        status: 'completed',
        feeCurrency: 'SOL',
      });

      // Show success message
      Alert.alert(
        t('success'),
        `✅ ${t('sent_successfully')}: ${num} ${currency}\n\n` +
        `${t('transaction_id') || 'رقم المعاملة'}: ${transactionSignature?.substring(0, 16)}...\n` +
        `${t('fee_details')}:\n` +
        `• ${t('network_fee')}: ${networkFee.toFixed(6)} SOL\n` +
        `• ${t('service_fee')}: ${serviceFee.toFixed(6)} SOL\n` +
        `• ${t('total')}: ${totalFee.toFixed(6)} SOL\n\n` +
        (recipientExists === false && currency === 'SOL' 
          ? `${t('rent_exempt_fee') || 'رسوم إنشاء الحساب'}: ${RENT_EXEMPTION_AMOUNT.toFixed(6)} SOL\n\n`
          : '') +
        `${t('fees_paid_in_sol') || 'تم دفع الرسوم بعملة SOL'}`,
        [
          {
            text: t('ok'),
            onPress: () => {
              setRecipient('');
              setAmount('');
              setModalVisible(false);
              setLoading(false);
              clearBalanceCache();
              loadAllBalances();
            }
          }
        ]
      );

    } catch (err) {
      console.error('❌ خطأ في إرسال المعاملة:', err);
      setLoading(false);
      
      // Log failed transaction
      try {
        await logTransaction({
          type: 'send',
          to: recipient,
          amount: num,
          currency,
          networkFee: networkFee,
          serviceFee: networkFee * SERVICE_FEE_PERCENTAGE,
          totalFee: calculateTotalFee(),
          feeCollectorAddress: FEE_COLLECTOR_ADDRESS,
          timestamp: new Date().toISOString(),
          status: 'failed',
          error: err.message,
        });
      } catch (logError) {
        console.error('❌ فشل في تسجيل المعاملة:', logError);
      }
      
      // Show error message
      let errorMessage = `${t('send_failed')}: ${err.message}`;
      
      if (err.message.includes('insufficient funds')) {
        errorMessage = t('insufficient_balance_for_transaction') || 'رصيد غير كافي';
      } else if (err.message.includes('Invalid private key')) {
        errorMessage = 'المفتاح الخاص غير صالح. يرجى التحقق من إعدادات المحفظة.';
      } else if (err.message.includes('signature')) {
        errorMessage = 'فشل في توقيع المعاملة. تأكد من صلاحية المفتاح الخاص.';
      } else if (err.message.includes('Blockhash')) {
        errorMessage = 'انتهت صلاحية Blockhash. يرجى إعادة المحاولة.';
      } else if (err.message.includes('network connection')) {
        errorMessage = 'فشل الاتصال بالشبكة. تحقق من اتصال الإنترنت.';
      }
      
      Alert.alert(t('error'), errorMessage);
    }
  };

  // Handle max amount - الإصدار المصحح
  const handleMaxAmount = () => {
    if (!balance || balance <= 0) return;
    
    const currentToken = getCurrentToken();
    const totalFee = calculateTotalFee();
    
    if (currentToken.symbol === 'SOL') {
      const rentExemption = (recipientExists === false) ? RENT_EXEMPTION_AMOUNT : 0;
      const maxAvailable = balance - totalFee - rentExemption;
      const safeMax = Math.max(0, maxAvailable);
      setAmount(safeMax.toFixed(6));
      console.log(`💰 Max SOL: ${balance} - ${totalFee} - ${rentExemption} = ${safeMax}`);
    } else {
      setAmount(balance.toFixed(currentToken.decimals || 6));
      console.log(`💰 Max Token: ${balance} ${currentToken.symbol}`);
    }
  };

  // Handle paste address
  const handlePasteAddress = async () => {
    try {
      const text = await Clipboard.getString();
      if (text) {
        const trimmed = text.trim();
        setRecipient(trimmed);
        console.log(`📋 Pasted address: ${trimmed.substring(0, 10)}...`);
      }
    } catch (err) {
      console.warn('Failed to paste:', err);
    }
  };

  // Render token item
  const renderTokenItem = ({ item }) => {
    const isSelected = currency === item.symbol;
    const hasBalance = item.hasBalance || item.userBalance > 0;
    
    return (
      <TouchableOpacity
        style={[
          styles.tokenItem,
          { 
            backgroundColor: colors.card,
            borderColor: isSelected ? primaryColor : 'transparent',
            opacity: 1
          }
        ]}
        onPress={() => {
          setCurrency(item.symbol);
          setModalVisible(false);
        }}
      >
        <View style={styles.tokenItemContent}>
          <View style={[styles.tokenIcon, { backgroundColor: primaryColor + '20' }]}>
            <Ionicons name={item.icon} size={24} color={primaryColor} />
          </View>
          <View style={styles.tokenDetails}>
            <View style={styles.tokenHeaderRow}>
              <Text style={[styles.tokenItemName, { color: colors.text }]}>
                {item.symbol}
              </Text>
              {hasBalance && (
                <Text style={[styles.tokenBalanceBadge, { color: primaryColor }]}>
                  ●
                </Text>
              )}
            </View>
            <Text style={[styles.tokenItemSymbol, { color: colors.textSecondary }]}>
              {item.name}
            </Text>
            {item.userBalance > 0 && (
              <Text style={[styles.tokenBalance, { color: colors.textSecondary }]}>
                {t('balance')}: {item.userBalance.toFixed(4)}
              </Text>
            )}
          </View>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={24} color={primaryColor} />
          )}
          {!hasBalance && !isSelected && (
            <Text style={[styles.noBalanceText, { color: colors.textSecondary }]}>
              {t('no_balance')}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const currentToken = getCurrentToken();
  const totalFee = calculateTotalFee();
  const serviceFee = networkFee * SERVICE_FEE_PERCENTAGE;
  
  const filteredTokens = availableTokens.sort((a, b) => {
    if (a.hasBalance && !b.hasBalance) return -1;
    if (!a.hasBalance && b.hasBalance) return 1;
    return 0;
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{t('send')}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('transfer_to_another_wallet')}
            </Text>
          </View>

          {/* Balance Card */}
          <View style={[styles.balanceCard, { backgroundColor: colors.card }]}>
            <View style={styles.balanceHeader}>
              <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>
                {t('available_balance')}
              </Text>
              <TouchableOpacity onPress={() => {
                clearBalanceCache();
                loadAllBalances();
              }} style={styles.refreshButton}>
                <Ionicons name="refresh-outline" size={20} color={primaryColor} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.balanceAmount, { color: colors.text }]}>
              {balance?.toFixed(6)} {currency}
            </Text>
            
            {/* SOL Balance */}
            {currency !== 'SOL' && (
              <View style={styles.solBalanceContainer}>
                <Text style={[styles.solBalanceLabel, { color: colors.textSecondary }]}>
                  {t('your_sol_balance') || 'رصيد SOL الخاص بك'}:
                </Text>
                <Text style={[styles.solBalanceAmount, { color: colors.warning }]}>
                  {solBalance.toFixed(6)} SOL
                </Text>
              </View>
            )}
          </View>

          {/* Token Selector */}
          <TouchableOpacity
            style={[styles.tokenSelector, { backgroundColor: colors.card }]}
            onPress={() => setModalVisible(true)}
          >
            <View style={styles.tokenSelectorContent}>
              <View style={styles.tokenInfo}>
                <View style={[styles.tokenIcon, { backgroundColor: primaryColor + '20' }]}>
                  <Ionicons 
                    name={currentToken.icon} 
                    size={24} 
                    color={primaryColor} 
                  />
                </View>
                <View>
                  <Text style={[styles.tokenName, { color: colors.text }]}>
                    {currentToken.symbol}
                  </Text>
                  <Text style={[styles.tokenSymbol, { color: colors.textSecondary }]}>
                    {currentToken.name}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-down" size={24} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          {/* Recipient Input */}
          <View style={styles.inputSection}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              {t('recipient_address')}
            </Text>
            <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={t('enter_recipient_address')}
                placeholderTextColor={colors.textSecondary}
                value={recipient}
                onChangeText={setRecipient}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {recipient ? (
                <TouchableOpacity onPress={() => setRecipient('')}>
                  <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handlePasteAddress}>
                  <Ionicons name="clipboard-outline" size={20} color={primaryColor} />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Address validation messages */}
            {recipient && recipientExists === false && currency === 'SOL' && (
              <View style={[styles.recipientWarning, { backgroundColor: colors.warning + '20' }]}>
                <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
                <Text style={[styles.recipientWarningText, { color: colors.warning }]}>
                  ⓘ {t('new_account_warning') || 'هذا حساب جديد وسيتطلب مبلغ إضافي للرانت (0.00203928 SOL)'}
                </Text>
              </View>
            )}
            
            {recipient && recipientExists === false && currency !== 'SOL' && (
              <View style={[styles.recipientWarning, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="information-circle-outline" size={16} color={colors.success} />
                <Text style={[styles.recipientWarningText, { color: colors.success }]}>
                  ⓘ {t('new_token_account_warning') || 'سيتم إنشاء حساب توكن للمستقبل (لا يلزم رصيد إضافي)'}
                </Text>
              </View>
            )}
          </View>

          {/* Amount Input */}
          <View style={styles.inputSection}>
            <View style={styles.amountHeader}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                {t('amount')}
              </Text>
              <TouchableOpacity onPress={handleMaxAmount}>
                <Text style={[styles.maxButton, { color: primaryColor }]}>
                  {t('max')}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.text, flex: 1 }]}
                placeholder={t('enter_amount')}
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
              <Text style={[styles.currencyLabel, { color: colors.textSecondary }]}>
                {currency}
              </Text>
            </View>
          </View>

          {/* Fee Info */}
          <View style={[styles.feeCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.feeCardTitle, { color: colors.text }]}>
              📊 {t('fee_details')}
            </Text>
            
            <View style={styles.feeRow}>
              <View style={styles.feeLabelContainer}>
                <Text style={[styles.feeLabel, { color: colors.textSecondary }]}>
                  {t('network_fee')}
                </Text>
                <Text style={[styles.feeSubLabel, { color: colors.textSecondary }]}>
                  {t('dynamic_based_on_congestion')}
                </Text>
              </View>
              <Text style={[styles.feeValue, { color: colors.text }]}>
                {networkFee.toFixed(6)} SOL
              </Text>
            </View>
            
            <View style={styles.feeRow}>
              <View style={styles.feeLabelContainer}>
                <Text style={[styles.feeLabel, { color: colors.textSecondary }]}>
                  {t('service_fee')}
                </Text>
                <Text style={[styles.feeSubLabel, { color: colors.textSecondary }]}>
                  {t('for_developer_support')}
                </Text>
              </View>
              <Text style={[styles.feeValue, { color: colors.text }]}>
                {serviceFee.toFixed(6)} SOL
              </Text>
            </View>
            
            {/* Rent exemption for new SOL accounts */}
            {recipientExists === false && currency === 'SOL' && (
              <View style={styles.feeRow}>
                <View style={styles.feeLabelContainer}>
                  <Text style={[styles.feeLabel, { color: colors.warning }]}>
                    {t('rent_exempt_fee') || 'رسوم إنشاء الحساب'}
                  </Text>
                  <Text style={[styles.feeSubLabel, { color: colors.warning }]}>
                    {t('for_new_account') || 'لإنشاء حساب جديد (مرة واحدة)'}
                  </Text>
                </View>
                <Text style={[styles.feeValue, { color: colors.warning }]}>
                  {RENT_EXEMPTION_AMOUNT.toFixed(6)} SOL
                </Text>
              </View>
            )}
            
            <View style={[styles.totalFeeRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.totalFeeLabel, { color: colors.text }]}>
                {t('total_fees')}
              </Text>
              <Text style={[styles.totalAmount, { color: primaryColor }]}>
                {(totalFee + (recipientExists === false && currency === 'SOL' ? RENT_EXEMPTION_AMOUNT : 0)).toFixed(6)} SOL
              </Text>
            </View>
            
            {/* Fee payment notice */}
            {currency !== 'SOL' && (
              <View style={[styles.feeNote, { backgroundColor: primaryColor + '10' }]}>
                <Ionicons name="information-circle" size={16} color={primaryColor} />
                <Text style={[styles.feeNoteText, { color: primaryColor }]}>
                  ⓘ {t('all_fees_paid_in_sol') || 'جميع الرسوم تدفع فقط بعملة SOL'}
                </Text>
              </View>
            )}
          </View>

          {/* Send Button */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              { 
                backgroundColor: primaryColor,
                opacity: (!recipient || !amount || loading) ? 0.6 : 1
              }
            ]}
            onPress={handleSend}
            disabled={!recipient || !amount || loading}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={[styles.loadingText, { color: '#FFFFFF', marginLeft: 8 }]}>
                  {t('sending') || 'جاري الإرسال...'}
                </Text>
              </View>
            ) : (
              <>
                <Ionicons name="paper-plane-outline" size={20} color="#FFFFFF" />
                <Text style={styles.sendButtonText}>
                  {t('confirm_send')}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Info Notice */}
          <View style={[styles.infoNotice, { backgroundColor: primaryColor + '10', borderColor: primaryColor + '30' }]}>
            <Ionicons name="information-circle-outline" size={16} color={primaryColor} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              ⓘ {t('fee_developer_notice')}
            </Text>
          </View>

          {/* Security Notice */}
          <View style={styles.securityNotice}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.securityText, { color: colors.textSecondary }]}>
              {t('verify_address_before_sending')}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Token Selection Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t('select_token')}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {loadingTokens ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={primaryColor} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  {t('loading_tokens')}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredTokens}
                keyExtractor={(item) => item.uniqueKey || item.symbol}
                renderItem={renderTokenItem}
                contentContainerStyle={styles.tokenList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  balanceCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  refreshButton: {
    padding: 4,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  solBalanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  solBalanceLabel: {
    fontSize: 14,
  },
  solBalanceAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  tokenSelector: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tokenSelectorContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tokenName: {
    fontSize: 16,
    fontWeight: '600',
  },
  tokenSymbol: {
    fontSize: 14,
    marginTop: 2,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  recipientWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  recipientWarningText: {
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
  },
  amountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  maxButton: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  currencyLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  feeCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  feeCardTitle: {
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
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
    textAlign: 'center',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  securityText: {
    fontSize: 12,
    marginLeft: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  tokenList: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  tokenItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
  },
  tokenItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tokenDetails: {
    flex: 1,
    marginLeft: 12,
  },
  tokenHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenItemName: {
    fontSize: 16,
    fontWeight: '600',
  },
  tokenBalanceBadge: {
    fontSize: 8,
    marginLeft: 6,
  },
  tokenItemSymbol: {
    fontSize: 14,
    marginTop: 2,
  },
  tokenBalance: {
    fontSize: 12,
    marginTop: 2,
  },
  noBalanceText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
