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
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { Ionicons, FontAwesome, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const MECO_MINT = '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i';

export default function MecoScreen() {
  const { t } = useTranslation();
  const theme = useAppStore(s => s.theme);
  const primaryColor = useAppStore(state => state.primaryColor);
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

  const fetchTokenInfo = async () => {
    try {
      setLoading(true);
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
      } else {
        console.error(`Cannot open URL: ${url}`);
      }
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: t('share_title'),
        message: `${t('meco_token_on_solana')}\n\n${t('token_address')}: ${MECO_MINT}\n${t('trade_on')}: https://www.dextools.io/app/solana/pair-explorer/7RLEub4zyQBkrbwXCnwSEttCKE2mX4ssh8GJotgucNL8`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const rotatingLogo = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

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
      maximumFractionDigits: 2,
      minimumFractionDigits: 0 
    });
  };

  const InfoBox = ({ title, value, icon, color = colors.info }) => (
    <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
        {icon}
      </View>
      <View style={styles.infoContent}>
        <Text style={[styles.infoTitle, { color: colors.textSecondary }]}>{title}</Text>
        <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );

  const LinkButton = ({ icon, title, subtitle, onPress, color = colors.info }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.linkButton, { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.7}
    >
      <View style={[styles.linkIconCircle, { backgroundColor: color + '20' }]}>
        {icon}
      </View>
      <View style={styles.linkContent}>
        <Text style={[styles.linkTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.linkSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
    </TouchableOpacity>
  );

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

      {/* Trade Card */}
      <Animated.View style={[styles.tradeCard, {
        backgroundColor: colors.card,
        borderColor: colors.border,
        opacity: fadeAnim,
      }]}>
        <View style={styles.tradeHeader}>
          <View>
            <Text style={[styles.tradeLabel, { color: colors.text }]}>
              {t('trade_meco')}
            </Text>
            <View style={styles.sourceBadge}>
              <MaterialCommunityIcons name="chart-line" size={12} color={colors.success} />
              <Text style={[styles.sourceText, { color: colors.success }]}>
                {t('live_charts')}
              </Text>
            </View>
          </View>

          <View style={[styles.priceChange, { backgroundColor: colors.success + '20' }]}>
            <Text style={[styles.priceChangeText, { color: colors.success }]}>
              📊 {t('advanced_charts')}
            </Text>
          </View>
        </View>

        <Text style={[styles.tradeTitle, { color: colors.text }]}>
          {t('analyze_on_dextools')}
        </Text>

        <View style={styles.tradeDetails}>
          <View style={styles.tradeDetail}>
            <MaterialCommunityIcons name="chart-timeline" size={20} color={colors.solana} />
            <Text style={[styles.tradeDetailText, { color: colors.textSecondary }]}>
              {t('live_trading_charts')}
            </Text>
          </View>
          <View style={styles.tradeDetail}>
            <MaterialIcons name="analytics" size={20} color={colors.success} />
            <Text style={[styles.tradeDetailText, { color: colors.textSecondary }]}>
              {t('market_analysis')}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.tradeButton, { backgroundColor: '#FF6B35' }]}
          onPress={() => openURL('https://www.dextools.io/app/solana/pair-explorer/7RLEub4zyQBkrbwXCnwSEttCKE2mX4ssh8GJotgucNL8')}
        >
          <MaterialCommunityIcons name="chart-box" size={24} color="#FFFFFF" />
          <Text style={styles.tradeButtonText}>{t('view_on_dextools')}</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Token Statistics */}
      <View style={styles.statsSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('token_statistics')}
        </Text>
        
        <View style={styles.statsGrid}>
          <InfoBox
            title={t('circulating_supply')}
            value={formatNumber(tokenInfo.supply)}
            icon={<MaterialIcons name="account-balance-wallet" size={20} color={colors.info} />}
            color={colors.info}
          />
          <InfoBox
            title={t('decimals')}
            value={tokenInfo.decimals.toString()}
            icon={<MaterialIcons name="numbers" size={20} color={colors.warning} />}
            color={colors.warning}
          />
        </View>

        <View style={styles.statsGrid}>
          <InfoBox
            title={t('token_address')}
            value={`${MECO_MINT.substring(0, 8)}...`}
            icon={<MaterialCommunityIcons name="key" size={20} color={colors.success} />}
            color={colors.success}
          />
          <InfoBox
            title={t('network')}
            value="Solana"
            icon={<MaterialCommunityIcons name="link" size={20} color={primaryColor} />}
            color={primaryColor}
          />
        </View>
      </View>

      {/* Official Links */}
      <View style={styles.linksSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('official_links')}
        </Text>

        <View style={[styles.linksCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <LinkButton
            icon={<MaterialCommunityIcons name="solana" size={22} color={colors.solana} />}
            title={t('view_on_solscan')}
            subtitle={t('detailed_token_analysis')}
            onPress={() => openURL(`https://solscan.io/token/${MECO_MINT}`)}
            color={colors.solana}
          />

          <LinkButton
            icon={<FontAwesome name="telegram" size={22} color="#0088cc" />}
            title={t('telegram_channel')}
            subtitle={t('official_community')}
            onPress={() => openURL('https://t.me/monycoin1')}
            color="#0088cc"
          />

          <LinkButton
            icon={<FontAwesome name="twitter" size={22} color="#1DA1F2" />}
            title={t('twitter_account')}
            subtitle={t('follow_for_updates')}
            onPress={() => openURL('https://x.com/MoniCoinMECO')}
            color="#1DA1F2"
          />

          <LinkButton
            icon={<FontAwesome name="facebook" size={22} color="#1877F2" />}
            title={t('facebook_page')}
            subtitle={t('connect_on_facebook')}
            onPress={() => openURL('https://www.facebook.com/MonyCoim?mibextid=ZbWKwL')}
            color="#1877F2"
          />

          <LinkButton
            icon={<FontAwesome name="globe" size={22} color={primaryColor} />}
            title={t('official_website')}
            subtitle={t('learn_more_about_meco')}
            onPress={() => openURL('https://monycoin1.blogspot.com/')}
            color={primaryColor}
          />
        </View>
      </View>

      {/* Footer */}
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
  tradeCard: {
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
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  tradeLabel: {
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
  priceChange: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priceChangeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  tradeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  tradeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  tradeDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tradeDetailText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tradeButton: {
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
  tradeButtonText: {
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
});
