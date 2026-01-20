import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Share,
  Dimensions,
  RefreshControl,
  TextInput,
  Alert,
  Clipboard,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { Ionicons, FontAwesome, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { PublicKey } from '@solana/web3.js';

import {
  PRESALE_WALLET_ADDRESS,
  sendSOLTransaction,
  getSOLBalance,
  isValidSolanaAddress,
  getRealTransactionFee,
  buyMECOTransaction,
  getSolscanLink,
  getPresaleStats
} from '../services/solanaService';

const { width } = Dimensions.get('window');
const MECO_MINT = '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i';

const SOLSCAN_LINK = getSolscanLink(PRESALE_WALLET_ADDRESS);

export default function MecoScreen() {
  const { t } = useTranslation();
  const theme = useAppStore(s => s.theme);
  const primaryColor = useAppStore(state => state.primaryColor);
  const currentWallet = useAppStore(state => state.currentWallet);
  const isDark = theme === 'dark';

  const colors = {
    background: isDark ? '#0A0F1E' : '#F8FAFF',
    card: isDark ? '#1A2236' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#1A1A1A',
    textSecondary: isDark ? '#A0A0B0' : '#6B7280',
    border: isDark ? '#2D3A5E' : '#E8EDF5',
    success: '#10B981',
    danger: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
    solana: '#14F195',
  };

  const [tokenInfo, setTokenInfo] = useState({
    name: 'MECO',
    symbol: 'MECO',
    decimals: 9,
    supply: 1000000000,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [solAmount, setSolAmount] = useState('0.1');
  const [mecoAmount, setMecoAmount] = useState(25000);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [userSOLBalance, setUserSOLBalance] = useState(0);
  const [transactionFee, setTransactionFee] = useState(0.000005);
  const [transactionResult, setTransactionResult] = useState(null);

  const [presaleData, setPresaleData] = useState({
    totalTokens: 50000000,
    soldTokens: 0,
    minSOL: 0.05,
    maxSOL: 1,
    rate: 250000,
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    const rotationAnimation = Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    rotationAnimation.start();

    return () => {
      rotationAnimation.stop();
    };
  }, []);

  // حساب MECO بناءً على SOL المدخل
  const calculateMECO = (solValue) => {
    const sol = parseFloat(solValue) || 0;
    if (sol >= presaleData.minSOL && sol <= presaleData.maxSOL) {
      const calculatedMECO = sol * presaleData.rate;
      setMecoAmount(Math.floor(calculatedMECO));
    } else {
      // إذا كانت خارج الحدود، احسب مع الإشعار
      const calculatedMECO = sol * presaleData.rate;
      setMecoAmount(Math.floor(calculatedMECO));
    }
  };

  useEffect(() => {
    calculateMECO(solAmount);
  }, [solAmount]);

  useEffect(() => {
    fetchUserBalance();
    fetchTransactionFee();
    fetchPresaleData();
  }, [currentWallet]);

  const fetchUserBalance = async () => {
    const balance = await getSOLBalance(currentWallet);
    setUserSOLBalance(balance);
  };

  const fetchTransactionFee = async () => {
    const fee = await getRealTransactionFee();
    setTransactionFee(fee);
  };

  const fetchPresaleData = async () => {
    try {
      const stats = await getPresaleStats();
      setPresaleData(prev => ({
        ...prev,
        totalTokens: stats.totalTokens || 50000000,
        soldTokens: stats.soldTokens || 0,
        rate: stats.rate || 250000,
      }));
    } catch (error) {
      console.error('Error fetching presale data:', error);
      setPresaleData(prev => ({
        ...prev,
        totalTokens: 50000000,
        soldTokens: 0,
        rate: 250000,
      }));
    }
  };

  const fetchTokenInfo = async () => {
    try {
      setLoading(true);
      await fetchUserBalance();
      await fetchTransactionFee();
      await fetchPresaleData();
      setTokenInfo({
        name: 'MECO',
        symbol: 'MECO',
        decimals: 9,
        supply: 1000000000,
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching token info:', error);
      setLoading(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchTokenInfo().finally(() => {
      setRefreshing(false);
    });
  }, []);

  const openURL = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: t('share_title'),
        message: `${t('meco_token_on_solana')}\n\n${t('token_address')}: ${MECO_MINT}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const copyToClipboard = (text) => {
    Clipboard.setString(text);
    Alert.alert(t('copied'), t('address_copied'));
  };

  const handleBuyPress = () => {
    const sol = parseFloat(solAmount) || 0;
    const totalWithFee = sol + transactionFee;

    if (!currentWallet) {
      Alert.alert(t('error'), t('connect_wallet_first'));
      return;
    }

    // التحقق من الحد الأدنى (0.05 SOL)
    if (sol < 0.05) {
      Alert.alert(t('error'), `${t('minimum_amount')}: 0.05 SOL`);
      return;
    }

    // التحقق من الحد الأقصى (1 SOL)
    if (sol > 1) {
      Alert.alert(t('error'), `${t('maximum_amount')}: 1 SOL`);
      return;
    }

    if (totalWithFee > userSOLBalance) {
      Alert.alert(
        t('error'),
        `${t('insufficient_balance')}\n${t('you_need')} ${totalWithFee.toFixed(6)} SOL`
      );
      return;
    }

    if (!isValidSolanaAddress(PRESALE_WALLET_ADDRESS)) {
      Alert.alert(t('error'), t('invalid_presale_address'));
      return;
    }

    setTransactionResult(null);
    setShowConfirmModal(true);
  };

  const confirmPurchase = async () => {
    setTransactionLoading(true);

    try {
      const result = await buyMECOTransaction(
        { publicKey: new PublicKey(currentWallet) },
        parseFloat(solAmount)
      );

      setTransactionResult(result);

      if (result.success) {
        await fetchUserBalance();
        await fetchPresaleData();

        Alert.alert(
          t('success'),
          `${t('purchase_confirmed')}\n\n${t('transaction_sent')}\n\nتم شراء: ${result.mecoReceived?.toLocaleString()} MECO`,
          [
            {
              text: t('view_on_solscan'),
              onPress: () => openURL(SOLSCAN_LINK),
            },
            {
              text: t('ok'),
              onPress: () => {
                setShowConfirmModal(false);
                setTransactionLoading(false);
              }
            }
          ]
        );
      } else {
        Alert.alert(t('error'), result.message || t('transaction_failed'));
      }

    } catch (error) {
      console.error('Transaction error:', error);
      Alert.alert(t('error'), error.message || t('transaction_failed'));
    } finally {
      setTransactionLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return t('not_available');

    const absNum = Math.abs(num);
    if (absNum >= 1000000000) {
      return (num / 1000000000).toFixed(2) + 'B';
    } else if (absNum >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    } else if (absNum >= 1000) {
      return (num / 1000).toFixed(2) + 'K';
    }
    return num.toLocaleString('en-US', {
      maximumFractionDigits: 6,
      minimumFractionDigits: 0
    });
  };

  const rotatingLogo = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const progress = (presaleData.soldTokens / presaleData.totalTokens) * 100;
  const remainingTokens = presaleData.totalTokens - presaleData.soldTokens;
  const totalWithFee = (parseFloat(solAmount) || 0) + transactionFee;

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.info}
          colors={[colors.info]}
        />
      }
    >
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <View style={styles.logoContainer}>
          <Animated.View style={{ transform: [{ rotate: rotatingLogo }] }}>
            <MaterialCommunityIcons name="rocket-launch" size={48} color={primaryColor} />
          </Animated.View>
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: colors.text }]}>{tokenInfo.name}</Text>
            <Text style={[styles.symbol, { color: primaryColor }]}>${tokenInfo.symbol}</Text>
            <View style={[styles.networkBadge, { backgroundColor: colors.solana + '20' }]}>
              <MaterialCommunityIcons name="link-variant" size={12} color={colors.solana} />
              <Text style={[styles.networkText, { color: colors.solana }]}>
                {t('solana_network')}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleShare}
          style={[styles.shareButton, { backgroundColor: colors.card }]}
          activeOpacity={0.7}
        >
          <Ionicons name="share-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </Animated.View>

      {currentWallet && (
        <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.balanceHeader}>
            <MaterialCommunityIcons name="wallet" size={24} color={colors.success} />
            <Text style={[styles.balanceTitle, { color: colors.text }]}>{t('your_balance')}</Text>
          </View>
          <Text style={[styles.balanceAmount, { color: colors.text }]}>
            {formatNumber(userSOLBalance)} SOL
          </Text>
          <TouchableOpacity
            onPress={fetchUserBalance}
            style={[styles.refreshButton, { backgroundColor: colors.background }]}
          >
            <Ionicons name="refresh" size={16} color={colors.textSecondary} />
            <Text style={[styles.refreshText, { color: colors.textSecondary }]}>{t('refresh')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Animated.View style={[styles.presaleCard, {
        backgroundColor: colors.card,
        borderColor: colors.border,
        opacity: fadeAnim,
      }]}>
        <View style={styles.presaleHeader}>
          <View>
            <Text style={[styles.presaleLabel, { color: colors.text }]}>
              {t('buy_meco')}
            </Text>
            <View style={styles.sourceBadge}>
              <MaterialCommunityIcons name="sale" size={12} color={colors.success} />
              <Text style={[styles.sourceText, { color: colors.success }]}>
                {t('presale')}
              </Text>
            </View>
          </View>

          <View style={[styles.priceBadge, { backgroundColor: colors.warning + '20' }]}>
            <Text style={[styles.priceBadgeText, { color: colors.warning }]}>
              1 SOL = 250,000 MECO
            </Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressText, { color: colors.text }]}>
              {t('presale_progress')}
            </Text>
            <Text style={[styles.progressText, { color: colors.text }]}>
              {progress.toFixed(1)}%
            </Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
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
            <Text style={[styles.progressStat, { color: colors.textSecondary }]}>
              {t('sold')}: {formatNumber(presaleData.soldTokens)} MECO
            </Text>
            <Text style={[styles.progressStat, { color: colors.textSecondary }]}>
              {t('remaining')}: {formatNumber(remainingTokens)} MECO
            </Text>
          </View>
        </View>

        <View style={styles.amountSection}>
          <Text style={[styles.amountLabel, { color: colors.text }]}>
            {t('enter_sol_amount')}
          </Text>
          <View style={[styles.inputContainer, { borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={solAmount}
              onChangeText={(value) => {
                // التحقق من أن المدخل رقمي فقط
                const numericValue = value.replace(/[^0-9.]/g, '');
                // التحقق من نقطة عشرية واحدة فقط
                const parts = numericValue.split('.');
                if (parts.length > 2) {
                  setSolAmount(parts[0] + '.' + parts.slice(1).join(''));
                } else {
                  setSolAmount(numericValue);
                }
              }}
              keyboardType="decimal-pad"
              placeholder="0.1"
              placeholderTextColor={colors.textSecondary}
            />
            <View style={styles.solBadge}>
              <Text style={[styles.solText, { color: colors.text }]}>SOL</Text>
            </View>
          </View>
          <View style={styles.limitContainer}>
            <TouchableOpacity onPress={() => {
              setSolAmount('0.05');
              calculateMECO('0.05');
            }}>
              <Text style={[styles.limitText, { color: colors.textSecondary }]}>
                {t('minimum_amount')}: 0.05 SOL
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              setSolAmount('1');
              calculateMECO('1');
            }}>
              <Text style={[styles.limitText, { color: colors.textSecondary }]}>
                {t('maximum_amount')}: 1 SOL
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.calculationSection, { backgroundColor: colors.info + '10' }]}>
          <View style={styles.calculationRow}>
            <Text style={[styles.calculationLabel, { color: colors.text }]}>
              {t('you_send')}:
            </Text>
            <Text style={[styles.calculationValue, { color: colors.text }]}>
              {solAmount} SOL
            </Text>
          </View>
          <View style={styles.calculationRow}>
            <Text style={[styles.calculationLabel, { color: colors.text }]}>
              {t('transaction_fee')}:
            </Text>
            <Text style={[styles.calculationValue, { color: colors.warning }]}>
              {formatNumber(transactionFee)} SOL
            </Text>
          </View>
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <View style={styles.calculationRow}>
            <Text style={[styles.calculationLabel, { color: colors.text }]}>
              {t('you_receive')}:
            </Text>
            <Text style={[styles.calculationValue, { color: primaryColor, fontSize: 20 }]}>
              {mecoAmount.toLocaleString()} MECO
            </Text>
          </View>
          <View style={styles.calculationRow}>
            <Text style={[styles.calculationLabel, { color: colors.textSecondary, fontSize: 12 }]}>
              {t('rate')}:
            </Text>
            <Text style={[styles.calculationValue, { color: colors.textSecondary, fontSize: 12 }]}>
              1 SOL = 250,000 MECO
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.walletSection, { backgroundColor: colors.background }]}
          onPress={() => copyToClipboard(PRESALE_WALLET_ADDRESS)}
        >
          <View style={styles.walletHeader}>
            <MaterialCommunityIcons name="wallet" size={20} color={colors.textSecondary} />
            <Text style={[styles.walletTitle, { color: colors.text }]}>
              {t('presale_wallet_address')}
            </Text>
          </View>
          <Text style={[styles.walletAddress, { color: colors.textSecondary }]}>
            {PRESALE_WALLET_ADDRESS.substring(0, 20)}...
          </Text>
          <TouchableOpacity
            style={styles.verifyButton}
            onPress={() => openURL(SOLSCAN_LINK)}
          >
            <Text style={[styles.verifyButtonText, { color: colors.info }]}>
              {t('verify_on_solscan')}
            </Text>
            <Ionicons name="open-outline" size={14} color={colors.info} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.buyButton, {
            backgroundColor: currentWallet ? primaryColor : colors.textSecondary,
            opacity: currentWallet ? 1 : 0.6
          }]}
          onPress={handleBuyPress}
          disabled={!currentWallet || transactionLoading}
        >
          {transactionLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="shopping" size={24} color="#FFFFFF" />
              <Text style={styles.buyButtonText}>
                {currentWallet ? t('buy_meco_now') : t('connect_wallet_to_buy')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.statsSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('token_statistics')}
        </Text>

        <View style={styles.statsGrid}>
          <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.info + '20' }]}>
              <MaterialIcons name="account-balance-wallet" size={20} color={colors.info} />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, { color: colors.textSecondary }]}>{t('circulating_supply')}</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{formatNumber(tokenInfo.supply)}</Text>
            </View>
          </View>

          <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.warning + '20' }]}>
              <MaterialIcons name="numbers" size={20} color={colors.warning} />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, { color: colors.textSecondary }]}>{t('decimals')}</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{tokenInfo.decimals}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.linksSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('official_links')}
        </Text>

        <View style={[styles.linksCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.linkButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => openURL(`https://solscan.io/token/${MECO_MINT}`)}
            activeOpacity={0.7}
          >
            <View style={[styles.linkIconCircle, { backgroundColor: colors.solana + '20' }]}>
              <MaterialCommunityIcons name="link-variant" size={22} color={colors.solana} />
            </View>
            <View style={styles.linkContent}>
              <Text style={[styles.linkTitle, { color: colors.text }]}>{t('view_on_solscan')}</Text>
              <Text style={[styles.linkSubtitle, { color: colors.textSecondary }]}>{t('detailed_token_analysis')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => openURL('https://t.me/monycoin1')}
            activeOpacity={0.7}
          >
            <View style={[styles.linkIconCircle, { backgroundColor: '#0088cc20' }]}>
              <FontAwesome name="telegram" size={22} color="#0088cc" />
            </View>
            <View style={styles.linkContent}>
              <Text style={[styles.linkTitle, { color: colors.text }]}>{t('telegram_channel')}</Text>
              <Text style={[styles.linkSubtitle, { color: colors.textSecondary }]}>{t('official_community')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => openURL('https://x.com/MoniCoinMECO')}
            activeOpacity={0.7}
          >
            <View style={[styles.linkIconCircle, { backgroundColor: '#1DA1F220' }]}>
              <FontAwesome name="twitter" size={22} color="#1DA1F2" />
            </View>
            <View style={styles.linkContent}>
              <Text style={[styles.linkTitle, { color: colors.text }]}>{t('twitter_account')}</Text>
              <Text style={[styles.linkSubtitle, { color: colors.textSecondary }]}>{t('follow_for_updates')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => openURL('https://monycoin1.blogspot.com/')}
            activeOpacity={0.7}
          >
            <View style={[styles.linkIconCircle, { backgroundColor: primaryColor + '20' }]}>
              <FontAwesome name="globe" size={22} color={primaryColor} />
            </View>
            <View style={styles.linkContent}>
              <Text style={[styles.linkTitle, { color: colors.text }]}>{t('official_website')}</Text>
              <Text style={[styles.linkSubtitle, { color: colors.textSecondary }]}>{t('learn_more_about_meco')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => openURL('https://monycoin.github.io/meco-token/MECO_Presale_Funds.html')}
            activeOpacity={0.7}
          >
            <View style={[styles.linkIconCircle, { backgroundColor: '#33333320' }]}>
              <FontAwesome name="github" size={22} color="#333333" />
            </View>
            <View style={styles.linkContent}>
              <Text style={[styles.linkTitle, { color: colors.text }]}>{t('github_repository')}</Text>
              <Text style={[styles.linkSubtitle, { color: colors.textSecondary }]}>
                {t('presale_funds_transparency')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <Animated.View style={[styles.footer, {
        opacity: fadeAnim,
        backgroundColor: colors.card,
        borderColor: colors.border,
      }]}>
        <MaterialCommunityIcons name="shield-check" size={30} color={colors.success} />
        <Text style={[styles.footerText, { color: colors.text }]}>
          {t('official_meco_token')}
        </Text>
        <Text style={[styles.footerSubText, { color: colors.textSecondary }]}>
          {t('verified_on_solana')}
        </Text>
      </Animated.View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={showConfirmModal}
        onRequestClose={() => !transactionLoading && setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <MaterialCommunityIcons
              name={transactionResult?.success ? "check-circle" : "alert-circle"}
              size={60}
              color={transactionResult?.success ? colors.success : colors.warning}
            />

            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {transactionResult ?
                (transactionResult.success ? t('purchase_confirmed') : t('transaction_failed'))
                : t('confirm_purchase')}
            </Text>

            {transactionResult ? (
              <View style={styles.resultContainer}>
                <Text style={[styles.resultText, { color: colors.textSecondary }]}>
                  {transactionResult.message}
                </Text>
                {transactionResult.success && (
                  <Text style={[styles.resultText, { color: colors.success, marginTop: 8 }]}>
                    تم شراء: {transactionResult.mecoReceived?.toLocaleString()} MECO
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.solscanButton, { backgroundColor: colors.info }]}
                  onPress={() => openURL(SOLSCAN_LINK)}
                >
                  <Text style={styles.solscanButtonText}>{t('view_on_solscan')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={[styles.modalText, { color: colors.textSecondary }]}>
                  {t('you_will_send')} {solAmount} SOL
                </Text>

                <View style={styles.modalDetails}>
                  <View style={styles.modalDetailRow}>
                    <Text style={[styles.modalDetailLabel, { color: colors.textSecondary }]}>
                      {t('rate')}:
                    </Text>
                    <Text style={[styles.modalDetailValue, { color: colors.text }]}>
                      1 SOL = 250,000 MECO
                    </Text>
                  </View>
                  <View style={styles.modalDetailRow}>
                    <Text style={[styles.modalDetailLabel, { color: colors.textSecondary }]}>
                      {t('you_will_receive')}:
                    </Text>
                    <Text style={[styles.modalDetailValue, { color: colors.success }]}>
                      {mecoAmount.toLocaleString()} MECO
                    </Text>
                  </View>
                </View>

                {transactionLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={primaryColor} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                      {t('processing_transaction')}...
                    </Text>
                  </View>
                ) : (
                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, { backgroundColor: colors.border }]}
                      onPress={() => setShowConfirmModal(false)}
                      disabled={transactionLoading}
                    >
                      <Text style={[styles.modalButtonText, { color: colors.text }]}>{t('cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, { backgroundColor: primaryColor }]}
                      onPress={confirmPurchase}
                      disabled={transactionLoading}
                    >
                      <Text style={styles.modalButtonText}>{t('confirm_pay')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleContainer: {
    flexDirection: 'column',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  symbol: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  networkText: {
    fontSize: 10,
    fontWeight: '600',
  },
  shareButton: {
    padding: 10,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  balanceCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  balanceTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  refreshText: {
    fontSize: 12,
  },
  presaleCard: {
    width: '100%',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  presaleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  presaleLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  sourceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  priceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priceBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressSection: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressStat: {
    fontSize: 12,
  },
  amountSection: {
    marginBottom: 20,
  },
  amountLabel: {
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
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  solBadge: {
    backgroundColor: '#14F19520',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  solText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#14F195',
  },
  limitContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  limitText: {
    fontSize: 12,
  },
  calculationSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calculationLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  calculationValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  separator: {
    height: 1,
    marginVertical: 8,
  },
  walletSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  walletTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  walletAddress: {
    fontSize: 12,
    marginBottom: 12,
    fontFamily: 'monospace',
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  verifyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buyButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  statsSection: {
    marginBottom: 24,
  },
  linksSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  infoBox: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  linksCard: {
    width: '100%',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  linkIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  linkContent: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  linkSubtitle: {
    fontSize: 12,
  },
  footer: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
    marginBottom: 30,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  footerSubText: {
    fontSize: 12,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: width * 0.9,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalDetails: {
    width: '100%',
    marginBottom: 24,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalDetailLabel: {
    fontSize: 14,
  },
  modalDetailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  resultContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  resultText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  solscanButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  solscanButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
