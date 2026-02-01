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
import { getSolBalance, getTokenAccounts, getTokenBalance } from '../services/heliusService';
import { logTransaction } from '../services/transactionLogger';
import { Ionicons } from '@expo/vector-icons';
import * as web3 from '@solana/web3.js';
import bs58 from 'bs58';
import * as splToken from '@solana/spl-token';

const { width } = Dimensions.get('window');

// =============================================
// ✅ Fee Collector Wallet Address
// =============================================
const FEE_COLLECTOR_ADDRESS = 'HXkEZSKictbSYan9ZxQGaHpFrbA4eLDyNtEDxVBkdFy6';

// Dynamic network fees + service fees
let DYNAMIC_FEE = 0.001;
const SERVICE_FEE_PERCENTAGE = 0.1; // 10% of network fees go to developer

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
// ✅ CoinGecko API Functions
// =============================================
const fetchPrices = async () => {
  try {
    const coinIds = ['solana', 'tether', 'usd-coin'];
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd`
    );
    const data = await response.json();
    
    return {
      SOL: { price: data.solana?.usd || 90, source: 'CoinGecko' },
      USDT: { price: data.tether?.usd || 1, source: 'CoinGecko' },
      USDC: { price: data['usd-coin']?.usd || 1, source: 'CoinGecko' },
      MECO: { price: 0.00617, source: 'Fixed' },
    };
  } catch (error) {
    console.error('❌ Error fetching prices from CoinGecko:', error);
    return {
      SOL: { price: 90, source: 'Default' },
      USDT: { price: 1, source: 'Default' },
      USDC: { price: 1, source: 'Default' },
      MECO: { price: 0.00617, source: 'Fixed' },
    };
  }
};

const getTokens = async () => {
  return BASE_TOKENS.map(token => ({
    address: token.mint,
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
    logoURI: token.logoURI,
    mint: token.mint,
  }));
};

async function isValidSolanaAddress(address) {
  try {
    const pubKey = new web3.PublicKey(address);
    return web3.PublicKey.isOnCurve(pubKey);
  } catch {
    return false;
  }
}

// التحقق من التواقيع
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

// وظيفة التحقق من المفتاح الخاص
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
        parsedKey = Uint8Array.from(JSON.parse(secretKeyStr));
      } else {
        parsedKey = bs58.decode(secretKeyStr);
      }
    } catch (error) {
      console.error('❌ فشل في تحليل المفتاح الخاص:', error);
      return { valid: false, error: 'Invalid private key format' };
    }

    if (parsedKey.length !== 64 && parsedKey.length !== 32) {
      console.error(`❌ طول المفتاح غير صحيح: ${parsedKey.length}`);
      return { valid: false, error: 'Invalid private key length' };
    }

    let keypair;
    if (parsedKey.length === 64) {
      keypair = web3.Keypair.fromSecretKey(parsedKey);
    } else {
      keypair = web3.Keypair.fromSeed(parsedKey.slice(0, 32));
    }
    
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
  const [solBalance, setSolBalance] = useState(0); // ✅ إضافة رصيد SOL منفصل
  const [prices, setPrices] = useState({
    'SOL': 185,
    'USDT': 1,
    'USDC': 1,
    'MECO': 0.00617
  });
  const [availableTokens, setAvailableTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [networkFee, setNetworkFee] = useState(0.001);
  const [connection, setConnection] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [recipientExists, setRecipientExists] = useState(true);

  // Calculate total fees (network + service)
  const calculateTotalFee = () => {
    const serviceFee = networkFee * SERVICE_FEE_PERCENTAGE;
    return networkFee + serviceFee;
  };

  // Initialize Solana connection
  useEffect(() => {
    const initConnection = async () => {
      try {
        const endpoints = [
          'https://api.mainnet-beta.solana.com',
          'https://solana-api.projectserum.com',
          'https://rpc.ankr.com/solana'
        ];
        
        let conn;
        for (const endpoint of endpoints) {
          try {
            conn = new web3.Connection(endpoint, 'confirmed');
            await conn.getVersion();
            console.log(`✅ Connected to ${endpoint}`);
            break;
          } catch (error) {
            console.log(`❌ Failed to connect to ${endpoint}`);
            continue;
          }
        }
        
        if (!conn) {
          conn = new web3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        }
        
        setConnection(conn);
      } catch (error) {
        console.error('Failed to initialize connection:', error);
        const conn = new web3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        setConnection(conn);
      }
    };
    initConnection();
  }, []);

  // Update prices periodically
  useEffect(() => {
    const updatePrices = async () => {
      try {
        setLoadingPrices(true);
        const priceData = await fetchPrices();
        console.log('📊 Prices fetched:', priceData);
        
        if (priceData && typeof priceData === 'object') {
          const mergedPrices = {
            'SOL': 185,
            'USDT': 1,
            'USDC': 1,
            'MECO': 0.00617,
            ...priceData
          };
          const extractedPrices = {};
          Object.keys(mergedPrices).forEach(key => {
            if (mergedPrices[key] && typeof mergedPrices[key] === 'object' && 'price' in mergedPrices[key]) {
              extractedPrices[key] = mergedPrices[key].price;
            } else {
              extractedPrices[key] = mergedPrices[key];
            }
          });
          setPrices(extractedPrices);
        } else {
          console.warn('⚠️ Invalid price data received');
        }
      } catch (error) {
        console.warn('Failed to update prices:', error);
        setPrices({
          'SOL': 185,
          'USDT': 1,
          'USDC': 1,
          'MECO': 0.00617
        });
      } finally {
        setLoadingPrices(false);
      }
    };
    
    updatePrices();
    const interval = setInterval(updatePrices, 30000);
    return () => clearInterval(interval);
  }, []);

  // Update network fees periodically
  useEffect(() => {
    const updateNetworkFee = async () => {
      try {
        if (!connection) return;
        
        let fee = 0.001;
        
        try {
          const fees = await connection.getRecentPrioritizationFees?.();
          if (fees && fees.length > 0) {
            const totalFees = fees.reduce((sum, f) => sum + f.prioritizationFee, 0);
            fee = (totalFees / fees.length) / 1e9;
          }
        } catch (error) {
          console.log('⚠️ Using default network fee');
        }
        
        const minFee = 0.000005;
        const maxFee = 0.01;
        fee = Math.max(minFee, Math.min(fee, maxFee));
        
        setNetworkFee(fee);
        DYNAMIC_FEE = fee;
      } catch (error) {
        console.warn('Failed to fetch network fee:', error);
        setNetworkFee(0.001);
      }
    };
    
    updateNetworkFee();
    const interval = setInterval(updateNetworkFee, 60000);
    return () => clearInterval(interval);
  }, [connection]);

  // Check recipient account
  useEffect(() => {
    const checkRecipientAccount = async () => {
      if (recipient && connection) {
        try {
          const recipientInfo = await connection.getAccountInfo(new web3.PublicKey(recipient));
          setRecipientExists(!!recipientInfo);
          console.log(`📌 Recipient account exists: ${!!recipientInfo}`);
        } catch (error) {
          console.warn('Could not check recipient account:', error);
          setRecipientExists(true);
        }
      }
    };
    
    const timeoutId = setTimeout(checkRecipientAccount, 1000);
    return () => clearTimeout(timeoutId);
  }, [recipient, connection]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
    
    loadTokensAndPrices();
  }, []);

  // ✅ تحديث: تحميل رصيد العملة ورصيد SOL معاً
  useEffect(() => {
    if (currency) {
      loadAllBalances();
    }
  }, [currency]);

  // ✅ تحديث: تحميل جميع الأرصدة
  async function loadAllBalances() {
    try {
      // تحميل رصيد العملة المحددة
      if (currency === 'SOL') {
        const sol = await getSolBalance();
        setBalance(sol || 0);
        setSolBalance(sol || 0); // رصيد SOL هو نفسه
      } else {
        const currentToken = availableTokens.find(t => t.symbol === currency);
        if (currentToken?.mint) {
          const tokenBalance = await getTokenBalance(currentToken.mint);
          setBalance(tokenBalance || 0);
        } else {
          setBalance(0);
        }
        
        // تحميل رصيد SOL منفصل
        const sol = await getSolBalance();
        setSolBalance(sol || 0);
      }
    } catch (err) {
      console.warn('Balance load error:', err.message);
      setBalance(0);
      setSolBalance(0);
    }
  }

  async function loadTokensAndPrices() {
    try {
      setLoadingTokens(true);
      
      let tokenList = [];
      try {
        tokenList = await getTokens();
        if (!Array.isArray(tokenList)) {
          tokenList = [];
        }
      } catch (error) {
        console.log('⚠️ Using base token list');
        tokenList = [];
      }
      
      const baseSymbols = BASE_TOKENS.map(t => t.symbol);
      const existingSymbols = new Set(tokenList.map(t => t.symbol));
      
      BASE_TOKENS.forEach(baseToken => {
        if (!existingSymbols.has(baseToken.symbol)) {
          tokenList.push({
            ...baseToken,
            address: baseToken.mint,
            decimals: baseToken.decimals
          });
        }
      });
      
      const pub = await SecureStore.getItemAsync('wallet_public_key');
      let userBalances = {};
      
      if (pub) {
        try {
          const solBalance = await getSolBalance();
          userBalances.SOL = solBalance || 0;
          
          const tokens = await getTokenAccounts();
          tokens.forEach(token => {
            const baseToken = BASE_TOKENS.find(t => t.mint === token.mint);
            if (baseToken) {
              userBalances[baseToken.symbol] = token.amount;
            }
          });
          
          const mecoMint = '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i';
          const mecoBalance = await getTokenBalance(mecoMint);
          userBalances.MECO = mecoBalance || 0;
        } catch (err) {
          console.warn('Failed to load user balances:', err);
        }
      }
      
      const uniqueTokensMap = new Map();
      
      tokenList.forEach(token => {
        const uniqueKey = token.mint || `${token.symbol}_${token.name}`;
        
        if (!uniqueTokensMap.has(uniqueKey)) {
          const baseToken = BASE_TOKENS.find(t => t.symbol === token.symbol);
          const userBalance = userBalances[token.symbol] || 0;
          
          uniqueTokensMap.set(uniqueKey, {
            ...token,
            uniqueKey: uniqueKey,
            icon: baseToken?.icon || 'help-circle',
            logoURI: baseToken?.logoURI || token.logoURI,
            userBalance: userBalance,
            hasBalance: userBalance > 0
          });
        }
      });
      
      const tokensWithIcons = Array.from(uniqueTokensMap.values());
      
      setAvailableTokens(tokensWithIcons);
      
    } catch (error) {
      console.error('❌ Error loading token data:', error);
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

  const getCurrentToken = () => {
    return availableTokens.find(token => token.symbol === currency) || BASE_TOKENS[0];
  };

  const getUsdValue = (amount, symbol) => {
    const price = prices[symbol] || 0;
    const value = (parseFloat(amount || 0) * price);
    return isNaN(value) ? '0.00' : value.toFixed(2);
  };

  const handleSend = async () => {
    try {
      console.log('🔄 Starting send process...');
      
      const keyValidation = await validatePrivateKey();
      if (!keyValidation.valid) {
        Alert.alert(t('error'), t('invalid_wallet_key') || 'مفتاح المحفظة غير صالح. يرجى التحقق من الإعدادات.');
        return;
      }

      if (!recipient || !amount) {
        Alert.alert(t('error'), t('fill_fields'));
        return;
      }

      if (!(await isValidSolanaAddress(recipient))) {
        Alert.alert(t('error'), t('invalid_address'));
        return;
      }

      const myAddress = await SecureStore.getItemAsync('wallet_public_key');
      if (recipient === myAddress) {
        Alert.alert(t('error'), t('cannot_send_to_self'));
        return;
      }

      const num = parseFloat(amount);
      if (isNaN(num) || num <= 0) {
        Alert.alert(t('error'), t('amount_must_be_positive'));
        return;
      }

      // ✅ تحديث: تحميل جميع الأرصدة
      await loadAllBalances();
      
      const totalFee = calculateTotalFee();
      
      // ✅ إصلاح: حساب المبلغ الإجمالي بطريقة صحيحة
      let totalAmount = num;
      let totalSolRequired = totalFee; // المطلوب من SOL للرسوم
      
      // إضافة رسوم الرانت للحسابات الجديدة (فقط للـSOL)
      let rentExemptAmount = 0;
      if (currency === 'SOL' && !recipientExists) {
        rentExemptAmount = 0.002;
        totalAmount += rentExemptAmount;
        console.log(`📌 Adding rent exempt amount: ${rentExemptAmount} SOL`);
      }
      
      console.log('💰 Balance check:', {
        balance,
        solBalance,
        num,
        totalFee,
        rentExemptAmount,
        totalAmount,
        currency
      });
      
      // ✅ إصلاح: التحقق من الأرصدة بطريقة صحيحة
      let errorMessage = '';
      
      if (currency === 'SOL') {
        // التحقق من رصيد SOL للمبلغ والرسوم معاً
        const requiredSol = totalAmount + totalFee;
        if (requiredSol > solBalance) {
          errorMessage = `${t('insufficient_balance')}\n\n`;
          errorMessage += `${t('your_balance') || 'رصيد SOL الخاص بك'}: ${solBalance.toFixed(6)} SOL\n`;
          errorMessage += `${t('amount_to_send') || 'المبلغ المراد إرساله'}: ${num.toFixed(6)} SOL\n`;
          errorMessage += `${t('network_fee')}: ${networkFee.toFixed(6)} SOL\n`;
          errorMessage += `${t('service_fee')}: ${(networkFee * SERVICE_FEE_PERCENTAGE).toFixed(6)} SOL\n`;
          
          if (rentExemptAmount > 0) {
            errorMessage += `${t('rent_exempt_fee') || 'رسوم إنشاء الحساب'}: ${rentExemptAmount.toFixed(6)} SOL\n`;
          }
          
          errorMessage += `\n${t('total_required') || 'المطلوب إجمالاً'}: ${requiredSol.toFixed(6)} SOL`;
          
          Alert.alert(t('error'), errorMessage);
          return;
        }
      } else {
        // التحقق من رصيد العملة للمبلغ
        if (num > balance) {
          Alert.alert(t('error'), 
            `${t('insufficient_balance_for_token') || 'رصيد غير كافي'}\n\n` +
            `${t('your_balance') || 'رصيدك'}: ${balance.toFixed(6)} ${currency}\n` +
            `${t('amount_to_send') || 'المبلغ المراد إرساله'}: ${num.toFixed(6)} ${currency}`
          );
          return;
        }
        
        // ✅ إصلاح مهم: التحقق من رصيد SOL للرسوم فقط
        if (totalFee > solBalance) {
          Alert.alert(t('error'), 
            `${t('insufficient_sol_for_fees') || 'رصيد SOL غير كافي للرسوم'}\n\n` +
            `${t('required_fees') || 'الرسوم المطلوبة'}: ${totalFee.toFixed(6)} SOL\n` +
            `${t('your_sol_balance') || 'رصيد SOL الخاص بك'}: ${solBalance.toFixed(6)} SOL\n\n` +
            `${t('fees_paid_in_sol_only') || 'الرسوم تدفع فقط بعملة SOL'}`
          );
          return;
        }
      }

      setLoading(true);
      await proceedWithSend(num, totalFee, rentExemptAmount, keyValidation.keypair);
    } catch (err) {
      console.error('Send validation error:', err);
      setLoading(false);
      Alert.alert(t('error'), 'Validation error: ' + err.message);
    }
  };

  // ✅ إصلاح كامل: دالة إرسال المعاملة
  const proceedWithSend = async (num, totalFee, rentExemptAmount, keypair) => {
    try {
      console.log('🔄 بدء عملية الإرسال...');
      
      const fromPubkey = keypair.publicKey;
      const toPubkey = new web3.PublicKey(recipient);
      const feeCollectorPubkey = new web3.PublicKey(FEE_COLLECTOR_ADDRESS);
      
      if (!connection) {
        throw new Error('اتصال الشبكة غير متاح');
      }

      const storedPubkey = await SecureStore.getItemAsync('wallet_public_key');
      console.log('🔑 Public key check:', {
        stored: storedPubkey,
        calculated: fromPubkey.toBase58(),
        match: storedPubkey === fromPubkey.toBase58()
      });

      const currentToken = getCurrentToken();
      const serviceFee = networkFee * SERVICE_FEE_PERCENTAGE;

      let transactionSignature;

      if (currency === 'SOL') {
        console.log('🔄 إرسال SOL...');
        
        const lamportsToSend = Math.floor(num * 1e9);
        const serviceFeeLamports = Math.floor(serviceFee * 1e9);
        const rentExemptLamports = Math.floor(rentExemptAmount * 1e9);
        const instructions = [];

        // 1. التحويل الرئيسي
        const totalLamports = lamportsToSend + rentExemptLamports;
        if (totalLamports > 0) {
          instructions.push(
            web3.SystemProgram.transfer({
              fromPubkey: fromPubkey,
              toPubkey: toPubkey,
              lamports: totalLamports,
            })
          );
        }

        // ✅ إصلاح: رسوم الخدمة دائماً بـ SOL
        if (serviceFeeLamports > 0) {
          instructions.push(
            web3.SystemProgram.transfer({
              fromPubkey,
              toPubkey: feeCollectorPubkey,
              lamports: serviceFeeLamports,
            })
          );
        }

        if (instructions.length === 0) {
          throw new Error('لا توجد تعليمات للإرسال');
        }

        const tx = new web3.Transaction().add(...instructions);
        
        console.log('🔄 جاري الحصول على blockhash...');
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.feePayer = fromPubkey;
        tx.lastValidBlockHeight = lastValidBlockHeight;

        console.log('🔄 جاري توقيع المعاملة...');
        tx.sign(keypair);
        
        const requiredSigners = [fromPubkey];
        if (!verifyTransactionSignatures(tx, requiredSigners)) {
          throw new Error('فشل في توقيع المعاملة');
        }

        // محاكاة المعاملة أولاً
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
              throw new Error('رصيد غير كافي للرانت والرسوم');
            }
            throw new Error(`فشل المحاكاة: ${errorMsg}`);
          }
          console.log('✅ نجحت محاكاة المعاملة');
        } catch (simError) {
          console.warn('⚠️ تحذير في المحاكاة:', simError.message);
        }

        // إرسال المعاملة
        console.log('🔄 جاري إرسال المعاملة...');
        const rawTransaction = tx.serialize();
        
        try {
          transactionSignature = await connection.sendRawTransaction(rawTransaction, {
            skipPreflight: true,
            preflightCommitment: 'confirmed',
          });
          console.log('✅ تم إرسال المعاملة:', transactionSignature);
        } catch (sendError) {
          console.warn('⚠️ المحاولة الأولى فشلت، جرب طريقة بديلة...', sendError);
          
          transactionSignature = await web3.sendAndConfirmTransaction(
            connection,
            tx,
            [keypair],
            {
              commitment: 'confirmed',
              skipPreflight: true,
            }
          );
        }

        // انتظار التأكيد
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
            splToken.createAssociatedTokenAccountInstruction(fromPubkey, toATA, toPubkey, mint)
          );
        }

        // ✅ إصلاح مهم: إرسال العملة فقط للمستلم (لا رسوم بالتوكن)
        instructions.push(
          splToken.createTransferInstruction(fromATA, toATA, fromPubkey, amountToSend)
        );

        // ✅ إصلاح: رسوم الخدمة دائماً بـ SOL (ليس بالتوكن)
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

        const tx = new web3.Transaction().add(...instructions);
        
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.feePayer = fromPubkey;
        tx.lastValidBlockHeight = lastValidBlockHeight;
        
        tx.sign(keypair);

        if (!verifyTransactionSignatures(tx, [fromPubkey])) {
          throw new Error('فشل التحقق من توقيع المعاملة');
        }

        // Simulate transaction first
        try {
          const simulation = await connection.simulateTransaction(tx, {
            replaceRecentBlockhash: true,
            commitment: 'confirmed',
          });
          if (simulation.value.err) {
            throw new Error(`فشل محاكاة المعاملة: ${JSON.stringify(simulation.value.err)}`);
          }
        } catch (simError) {
          console.warn('Transaction simulation warning:', simError.message);
        }

        const rawTransaction = tx.serialize();
        transactionSignature = await connection.sendRawTransaction(rawTransaction, {
          skipPreflight: true,
          preflightCommitment: 'confirmed',
        });
        
        console.log('✅ Transaction sent, waiting for confirmation...');
        
        await connection.confirmTransaction({
          signature: transactionSignature,
          blockhash: blockhash,
          lastValidBlockHeight: lastValidBlockHeight,
        }, 'confirmed');
        
        console.log('✅ Token transfer successful:', transactionSignature);
      } else {
        throw new Error('رمز غير صالح');
      }

      // تسجيل المعاملة
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
        feeCurrency: 'SOL', // ✅ إضافة: تأكيد أن الرسوم دُفعت بـ SOL
      });

      // إظهار رسالة النجاح
      Alert.alert(
        t('success'),
        `✅ ${t('sent_successfully')}: ${num} ${currency}\n\n` +
        `${t('transaction_id') || 'رقم المعاملة'}: ${transactionSignature?.substring(0, 16)}...\n` +
        `${t('fee_details')}:\n` +
        `• ${t('network_fee')}: ${networkFee.toFixed(6)} SOL\n` +
        `• ${t('service_fee')}: ${serviceFee.toFixed(6)} SOL\n` +
        `• ${t('total')}: ${totalFee.toFixed(6)} SOL\n\n` +
        `${t('fees_paid_in_sol') || 'تم دفع الرسوم بعملة SOL'}`,
        [
          {
            text: t('ok'),
            onPress: () => {
              setRecipient('');
              setAmount('');
              setModalVisible(false);
              setLoading(false);
              loadAllBalances(); // ✅ تحديث جميع الأرصدة
            }
          }
        ]
      );

    } catch (err) {
      console.error('❌ خطأ في إرسال المعاملة:', err);
      setLoading(false);
      
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
      
      let errorMessage = `${t('send_failed')}: ${err.message}`;
      
      if (err.message.includes('insufficient funds')) {
        errorMessage = t('insufficient_balance_for_transaction') || 'رصيد غير كافي للتغطية على المبلغ والرسوم والرانت المطلوب للحساب الجديد';
      } else if (err.message.includes('Invalid private key')) {
        errorMessage = 'المفتاح الخاص غير صالح. يرجى التحقق من إعدادات المحفظة.';
      } else if (err.message.includes('signature')) {
        errorMessage = 'فشل في توقيع المعاملة. تأكد من صلاحية المفتاح الخاص.';
      } else if (err.message.includes('Blockhash')) {
        errorMessage = 'انتهت صلاحية Blockhash. يرجى إعادة المحاولة.';
      } else if (err.message.includes('network connection')) {
        errorMessage = 'فشل الاتصال بالشبكة. تحقق من اتصال الإنترنت.';
      } else if (err.message.includes('رصيد غير كافي للرانت')) {
        errorMessage = t('rent_exempt_insufficient') || 'رصيد غير كافي لمتطلبات الرانت';
      }
      
      Alert.alert(t('error'), errorMessage);
    }
  };

  const handleMaxAmount = () => {
    if (balance > 0) {
      if (currency === 'SOL') {
        const totalFee = calculateTotalFee();
        const maxAmount = Math.max(0, balance - totalFee);
        setAmount(maxAmount.toFixed(6));
      } else {
        // للعملات الأخرى، الحد الأقصى هو الرصيد الكامل (الرسوم تدفع من SOL)
        setAmount(balance.toFixed(6));
      }
    }
  };

  const handlePasteAddress = async () => {
    try {
      const { Clipboard } = await import('expo-clipboard');
      const text = await Clipboard.getStringAsync();
      if (text) {
        setRecipient(text.trim());
      }
    } catch (err) {
      console.warn('Failed to paste:', err);
    }
  };

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
              <TouchableOpacity onPress={loadAllBalances} style={styles.refreshButton}>
                <Ionicons name="refresh-outline" size={20} color={primaryColor} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.balanceAmount, { color: colors.text }]}>
              {balance?.toFixed(6)} {currency}
            </Text>
            
            <View style={styles.balanceValue}>
              {loadingPrices ? (
                <View style={styles.priceLoading}>
                  <ActivityIndicator size="small" color={primaryColor} />
                  <Text style={[styles.priceLoadingText, { color: colors.textSecondary }]}>
                    {t('calculating_value') || 'جاري حساب القيمة...'}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.usdValue, { color: colors.textSecondary }]}>
                  ≈ ${getUsdValue(balance.toString(), currency)} USD
                </Text>
              )}
            </View>
            
            {/* ✅ إضافة: عرض رصيد SOL منفصل */}
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
            {recipient && !recipientExists && currency === 'SOL' && (
              <View style={[styles.recipientWarning, { backgroundColor: colors.warning + '20' }]}>
                <Ionicons name="warning-outline" size={16} color={colors.warning} />
                <Text style={[styles.recipientWarningText, { color: colors.warning }]}>
                  ⓘ {t('new_account_warning') || 'هذا حساب جديد وسيتطلب مبلغ إضافي للرانت (حوالي 0.002 SOL)'}
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
            {amount && (
              <Text style={[styles.usdAmount, { color: colors.textSecondary }]}>
                ≈ ${getUsdValue(amount, currency)} USD
              </Text>
            )}
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
            
            {/* ✅ إضافة: تأكيد أن الرسوم تدفع بـ SOL فقط */}
            {currency !== 'SOL' && (
              <View style={[styles.feeNote, { backgroundColor: primaryColor + '10' }]}>
                <Ionicons name="information-circle" size={16} color={primaryColor} />
                <Text style={[styles.feeNoteText, { color: primaryColor }]}>
                  ⓘ {t('all_fees_paid_in_sol') || 'جميع الرسوم تدفع فقط بعملة SOL'}
                </Text>
              </View>
            )}
            
            {!recipientExists && currency === 'SOL' && (
              <View style={styles.feeRow}>
                <View style={styles.feeLabelContainer}>
                  <Text style={[styles.feeLabel, { color: colors.warning }]}>
                    {t('rent_exempt_fee') || 'رسوم إنشاء الحساب'}
                  </Text>
                  <Text style={[styles.feeSubLabel, { color: colors.warning }]}>
                    {t('for_new_account') || 'لإنشاء حساب جديد'}
                  </Text>
                </View>
                <Text style={[styles.feeValue, { color: colors.warning }]}>
                  ~0.002 SOL
                </Text>
              </View>
            )}
            
            <View style={[styles.totalFeeRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.totalFeeLabel, { color: colors.text }]}>
                {t('total_fees')}
              </Text>
              <Text style={[styles.totalAmount, { color: primaryColor }]}>
                {totalFee.toFixed(6)} SOL
              </Text>
            </View>
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
  balanceValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  usdValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  priceLoading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceLoadingText: {
    fontSize: 14,
    marginLeft: 8,
  },
  // ✅ إضافة: تنسيق رصيد SOL
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
  usdAmount: {
    fontSize: 14,
    marginTop: 8,
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
  // ✅ إضافة: ملاحظة الرسوم
  feeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
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
