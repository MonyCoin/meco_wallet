import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, Modal, FlatList,
  Dimensions, Animated, ScrollView,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import { useRoute } from '@react-navigation/native';
import { getSolBalance, getTokenAccounts, getMecoBalance } from '../services/heliusService';
import { getTokens, fetchPrices } from '../services/jupiterService';
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

async function isValidSolanaAddress(address) {
  try {
    const pubKey = new web3.PublicKey(address);
    return web3.PublicKey.isOnCurve(pubKey);
  } catch {
    return false;
  }
}

// التحقق من التواقيع قبل الإرسال
const verifySignatures = (tx, fromPubkey) => {
  try {
    const signatures = tx.signatures;
    console.log(`📌 عدد التواقيع: ${signatures.length}`);
    
    // التحقق من وجود توقيع المرسل
    const senderSignature = signatures.find(sig => 
      sig.publicKey.toBase58() === fromPubkey.toBase58()
    );
    
    if (!senderSignature || senderSignature.signature === null) {
      console.error('❌ لم يتم توقيع المعاملة من قبل المرسل');
      return false;
    }
    
    console.log('✅ تم توقيع المعاملة بنجاح');
    return true;
  } catch (error) {
    console.error('❌ خطأ في التحقق من التواقيع:', error);
    return false;
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
  };

  const preselected = route?.params?.preselectedToken;
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(preselected || 'SOL');
  const [modalVisible, setModalVisible] = useState(false);
  const [balance, setBalance] = useState(0);
  const [prices, setPrices] = useState({});
  const [availableTokens, setAvailableTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [networkFee, setNetworkFee] = useState(0.001);
  const [connection, setConnection] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));

  // Calculate total fees (network + service)
  const calculateTotalFee = () => {
    const serviceFee = networkFee * SERVICE_FEE_PERCENTAGE;
    return networkFee + serviceFee;
  };

  // Initialize Solana connection
  useEffect(() => {
    const initConnection = async () => {
      try {
        const conn = new web3.Connection('https://api.mainnet-beta.solana.com');
        setConnection(conn);
      } catch (error) {
        console.error('Failed to initialize connection:', error);
      }
    };
    initConnection();
  }, []);

  // Update prices periodically
  useEffect(() => {
    const updatePrices = async () => {
      try {
        const priceData = await fetchPrices();
        setPrices(priceData);
      } catch (error) {
        console.warn('Failed to update prices:', error);
        // Default prices in case of failure
        setPrices({
          'SOL': 185,
          'USDT': 1,
          'USDC': 1,
          'MECO': 0.00617
        });
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
        
        const fees = await connection.getRecentPrioritizationFees?.();
        let fee = 0.001; // Default value
        
        if (fees && fees.length > 0) {
          // Calculate average fees
          const totalFees = fees.reduce((sum, f) => sum + f.prioritizationFee, 0);
          fee = (totalFees / fees.length) / 1e9;
        }
        
        // Minimum 0.000005 SOL and maximum 0.01 SOL
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

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
    
    loadTokensAndPrices();
  }, []);

  useEffect(() => {
    if (currency) {
      loadBalance();
    }
  }, [currency]);

  async function loadTokensAndPrices() {
    try {
      setLoadingTokens(true);
      
      // 1. Fetch tokens from Jupiter
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
      
      // 2. Add base tokens if not present
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
      
      // 3. Fetch user balances to filter tokens
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
          
          // Add MECO balance specifically
          const mecoBalance = await getMecoBalance();
          userBalances.MECO = mecoBalance || 0;
        } catch (err) {
          console.warn('Failed to load user balances:', err);
        }
      }
      
      // 4. Merge data and remove duplicates
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

  async function loadBalance() {
    try {
      if (currency === 'SOL') {
        const sol = await getSolBalance();
        setBalance(sol || 0);
      } else if (currency === 'MECO') {
        const meco = await getMecoBalance();
        setBalance(meco || 0);
      } else {
        const tokens = await getTokenAccounts();
        const currentToken = availableTokens.find(t => t.symbol === currency);
        if (currentToken?.mint) {
          const token = tokens.find(t => t.mint === currentToken.mint);
          setBalance(token?.amount || 0);
        } else {
          setBalance(0);
        }
      }
    } catch (err) {
      console.warn('Balance load error:', err.message);
      setBalance(0);
    }
  }

  const getCurrentToken = () => {
    return availableTokens.find(token => token.symbol === currency) || BASE_TOKENS[0];
  };

  const getUsdValue = (amount, symbol) => {
    const price = prices[symbol] || 0;
    return (parseFloat(amount || 0) * price).toFixed(2);
  };

  const handleSend = async () => {
    try {
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

      // Check if recipient account exists
      let recipientExists = false;
      if (connection) {
        try {
          const recipientInfo = await connection.getAccountInfo(new web3.PublicKey(recipient));
          recipientExists = !!recipientInfo;
        } catch (error) {
          console.warn('Could not check recipient account:', error);
        }
      }

      const totalFee = calculateTotalFee();
      let totalAmount = currency === 'SOL' ? num + totalFee : num;
      
      // For SOL, check if we need to add rent exempt amount for new accounts
      if (currency === 'SOL' && !recipientExists) {
        try {
          const rentExemptAmount = await connection.getMinimumBalanceForRentExemption(0) / 1e9;
          totalAmount += rentExemptAmount;
          console.log(`📌 Adding rent exempt amount: ${rentExemptAmount} SOL`);
        } catch (error) {
          console.warn('Could not calculate rent exempt amount:', error);
        }
      }
      
      if (totalAmount > balance) {
        let errorMessage = t('insufficient_balance');
        if (currency === 'SOL' && !recipientExists) {
          errorMessage += `\n\n${t('new_account_requires_rent')}`;
        }
        Alert.alert(t('error'), errorMessage);
        return;
      }

      setLoading(true);
      await proceedWithSend(num, totalFee, recipientExists);
    } catch (err) {
      console.error('Send validation error:', err);
      setLoading(false);
      Alert.alert(t('error'), 'Validation error: ' + err.message);
    }
  };

  const proceedWithSend = async (num, totalFee, recipientExists) => {
    try {
      const secretKeyStr = await SecureStore.getItemAsync('wallet_private_key');
      if (!secretKeyStr) throw new Error('Missing key');

      let parsedKey;
      try {
        parsedKey = Uint8Array.from(JSON.parse(secretKeyStr));
      } catch {
        parsedKey = bs58.decode(secretKeyStr);
      }

      const keypair = web3.Keypair.fromSecretKey(parsedKey);
      const fromPubkey = keypair.publicKey;
      const toPubkey = new web3.PublicKey(recipient);
      const feeCollectorPubkey = new web3.PublicKey(FEE_COLLECTOR_ADDRESS);
      
      if (!connection) {
        throw new Error('Network connection not available');
      }

      // التحقق من المفتاح الخاص والمفتاح العام
      console.log('🔄 التحقق من المفتاح الخاص...');
      console.log('📌 المفتاح العام:', fromPubkey.toBase58());
      console.log('📌 المفتاح العام المتوقع:', await SecureStore.getItemAsync('wallet_public_key'));

      const currentToken = getCurrentToken();
      const serviceFee = networkFee * SERVICE_FEE_PERCENTAGE;

      if (currency === 'SOL') {
        const lamportsToSend = Math.floor(num * 1e9);
        const instructions = [];

        // Check rent exempt amount for new accounts
        if (!recipientExists) {
          try {
            const rentExemptAmount = await connection.getMinimumBalanceForRentExemption(0);
            console.log(`📌 Rent exempt amount needed: ${rentExemptAmount / 1e9} SOL`);
            
            // إضافة تعليمات التحويل للرانت مع المبلغ الرئيسي
            instructions.push(
              web3.SystemProgram.transfer({
                fromPubkey: fromPubkey,
                toPubkey: toPubkey,
                lamports: rentExemptAmount + lamportsToSend,
              })
            );
            
            console.log(`✅ Total transfer (rent + amount): ${(rentExemptAmount + lamportsToSend) / 1e9} SOL`);
          } catch (error) {
            console.warn('⚠️ Rent calculation error:', error);
            // استمرار بدون رانت في حالة الخطأ
            instructions.push(
              web3.SystemProgram.transfer({
                fromPubkey: fromPubkey,
                toPubkey: toPubkey,
                lamports: lamportsToSend,
              })
            );
          }
        } else {
          // الحساب موجود بالفعل، أرسل المبلغ فقط
          instructions.push(
            web3.SystemProgram.transfer({
              fromPubkey: fromPubkey,
              toPubkey: toPubkey,
              lamports: lamportsToSend,
            })
          );
        }

        // Send service fee to developer wallet
        instructions.push(
          web3.SystemProgram.transfer({
            fromPubkey,
            toPubkey: feeCollectorPubkey,
            lamports: Math.floor(serviceFee * 1e9),
          })
        );

        const tx = new web3.Transaction().add(...instructions);
        
        const { blockhash } = await connection.getRecentBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = fromPubkey;

        // توقيع المعاملة
        tx.sign(keypair);

        // التحقق من التواقيع قبل الإرسال
        if (!verifySignatures(tx, fromPubkey)) {
          throw new Error('فشل التحقق من توقيع المعاملة');
        }

        // Simulate transaction first
        try {
          const simulation = await connection.simulateTransaction(tx);
          if (simulation.value.err) {
            throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
          }
        } catch (simError) {
          console.warn('Transaction simulation warning:', simError.message);
        }

        // إرسال المعاملة باستخدام connection.sendTransaction
        const sig = await connection.sendTransaction(tx, [keypair], {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        });
        
        console.log('✅ Transaction sent, waiting for confirmation...');
        
        // انتظار تأكيد المعاملة
        await connection.confirmTransaction(sig, 'confirmed');
        
        console.log('✅ SOL transfer successful:', sig);
      } else if (currentToken.mint) {
        const mint = new web3.PublicKey(currentToken.mint);
        const fromATA = await splToken.getAssociatedTokenAddress(mint, fromPubkey);
        const toATA = await splToken.getAssociatedTokenAddress(mint, toPubkey);
        const feeCollectorATA = await splToken.getAssociatedTokenAddress(mint, feeCollectorPubkey);

        const mintInfo = await splToken.getMint(connection, mint);
        const decimals = mintInfo.decimals || 6;
        const amountToSend = BigInt(Math.floor(num * Math.pow(10, decimals)));
        const serviceFeeAmount = BigInt(Math.floor(serviceFee * Math.pow(10, decimals)));

        const instructions = [];

        // Check and create recipient ATA if needed
        const toATAInfo = await connection.getAccountInfo(toATA);
        if (!toATAInfo) {
          instructions.push(
            splToken.createAssociatedTokenAccountInstruction(fromPubkey, toATA, toPubkey, mint)
          );
        }

        // Check and create fee collector ATA if needed
        const feeCollectorATAInfo = await connection.getAccountInfo(feeCollectorATA);
        if (!feeCollectorATAInfo) {
          instructions.push(
            splToken.createAssociatedTokenAccountInstruction(fromPubkey, feeCollectorATA, feeCollectorPubkey, mint)
          );
        }

        // Send amount to recipient
        instructions.push(
          splToken.createTransferInstruction(fromATA, toATA, fromPubkey, amountToSend)
        );

        // Send service fee to developer wallet
        instructions.push(
          splToken.createTransferInstruction(fromATA, feeCollectorATA, fromPubkey, serviceFeeAmount)
        );

        const tx = new web3.Transaction().add(...instructions);
        
        // توقيع المعاملة
        tx.sign(keypair);

        // التحقق من التواقيع قبل الإرسال
        if (!verifySignatures(tx, fromPubkey)) {
          throw new Error('فشل التحقق من توقيع المعاملة');
        }

        // Simulate transaction first
        try {
          const simulation = await connection.simulateTransaction(tx);
          if (simulation.value.err) {
            throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
          }
        } catch (simError) {
          console.warn('Transaction simulation warning:', simError.message);
        }

        // إرسال المعاملة باستخدام connection.sendTransaction
        const sig = await connection.sendTransaction(tx, [keypair], {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        });
        
        console.log('✅ Transaction sent, waiting for confirmation...');
        
        // انتظار تأكيد المعاملة
        await connection.confirmTransaction(sig, 'confirmed');
        
        console.log('✅ Token transfer successful:', sig);
      } else {
        throw new Error('Invalid token');
      }

      await logTransaction({
        type: 'send',
        to: recipient,
        amount: num,
        currency,
        networkFee: networkFee,
        serviceFee: serviceFee,
        totalFee: totalFee,
        feeCollectorAddress: FEE_COLLECTOR_ADDRESS,
        timestamp: new Date().toISOString(),
      });

      Alert.alert(
        t('success'),
        `✅ ${t('sent_successfully')}: ${num} ${currency}\n\n` +
        `${t('fee_details')}:\n` +
        `• ${t('network_fee')}: ${networkFee.toFixed(6)} SOL\n` +
        `• ${t('service_fee')}: ${serviceFee.toFixed(6)} SOL\n` +
        `• ${t('total')}: ${totalFee.toFixed(6)} SOL`,
        [
          {
            text: t('ok'),
            onPress: () => {
              setRecipient('');
              setAmount('');
              setModalVisible(false);
              setLoading(false);
              loadBalance();
            }
          }
        ]
      );
    } catch (err) {
      console.error('❌ Send transaction error:', err);
      setLoading(false);
      
      let errorMessage = `${t('send_failed')}: ${err.message}`;
      
      // تقديم رسائل خطأ أكثر تحديداً
      if (err.message.includes('insufficient funds for rent')) {
        errorMessage = `${t('rent_exempt_insufficient')}\n\n${t('new_account_requires_rent')}`;
      } else if (err.message.includes('insufficient funds')) {
        errorMessage = t('insufficient_balance_for_transaction');
      } else if (err.message.includes('Account does not exist')) {
        errorMessage = `${t('recipient_account_not_found')}\n\n${t('make_sure_address_correct')}`;
      } else if (err.message.includes('signature verification')) {
        errorMessage = 'فشل التحقق من التوقيع. يرجى التحقق من المفتاح الخاص وإعادة المحاولة.';
      } else if (err.message.includes('Blockhash not found')) {
        errorMessage = 'انتهت صلاحية Blockhash. يرجى إعادة المحاولة.';
      } else if (err.message.includes('Invalid public key')) {
        errorMessage = 'عنوان المستلم غير صالح.';
      }
      
      Alert.alert(t('error'), errorMessage);
    }
  };

  const handleMaxAmount = () => {
    if (balance > 0) {
      const totalFee = calculateTotalFee();
      const maxAmount = currency === 'SOL' ? Math.max(0, balance - totalFee) : balance;
      setAmount(maxAmount.toFixed(6));
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
  
  // Filter tokens: priority for user's tokens
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
              <TouchableOpacity onPress={loadBalance} style={styles.refreshButton}>
                <Ionicons name="refresh-outline" size={20} color={primaryColor} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.balanceAmount, { color: colors.text }]}>
              {balance?.toFixed(6)} {currency}
            </Text>
            
            <View style={styles.balanceValue}>
              <Text style={[styles.usdValue, { color: colors.textSecondary }]}>
                ≈ ${getUsdValue(balance.toString(), currency)} USD
              </Text>
            </View>
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
                <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
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
                <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
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
  loadingText: {
    fontSize: 14,
    marginLeft: 12,
    marginTop: 20,
    textAlign: 'center',
  },
});
