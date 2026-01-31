import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// بيانات العملات مع CoinGecko IDs
const TOKEN_LIST = [
  // Solana Tokens (متاحة للتبادل)
  {
    id: 'solana',
    symbol: 'SOL',
    name: 'Solana',
    image: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
    mint: 'So11111111111111111111111111111111111111112',
    decimals: 9,
    swapAvailable: true
  },
  {
    id: 'tether',
    symbol: 'USDT',
    name: 'Tether',
    image: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
    mint: 'Es9vMFrzaCERc8Foa8XfRduKiSfrhEL5c7qr2WXXBWY5',
    decimals: 6,
    swapAvailable: true
  },
  {
    id: 'usd-coin',
    symbol: 'USDC',
    name: 'USD Coin',
    image: 'https://assets.coingecko.com/coins/images/6319/large/usdc.png',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    swapAvailable: true
  },
  {
    id: 'meco-token',
    symbol: 'MECO',
    name: 'MECO Token',
    image: 'https://raw.githubusercontent.com/saadeh73/meco-project/main/meco-logo.png',
    mint: '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i',
    decimals: 6,
    swapAvailable: true
  },
  // Other major tokens (قد تكون غير متاحة للتبادل المباشر)
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    image: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    mint: null,
    decimals: 18,
    swapAvailable: false
  },
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    image: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
    mint: null,
    decimals: 8,
    swapAvailable: false
  },
  {
    id: 'binancecoin',
    symbol: 'BNB',
    name: 'Binance Coin',
    image: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
    mint: null,
    decimals: 18,
    swapAvailable: false
  },
  {
    id: 'cardano',
    symbol: 'ADA',
    name: 'Cardano',
    image: 'https://assets.coingecko.com/coins/images/975/large/cardano.png',
    mint: null,
    decimals: 6,
    swapAvailable: false
  },
  {
    id: 'dogecoin',
    symbol: 'DOGE',
    name: 'Dogecoin',
    image: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png',
    mint: null,
    decimals: 8,
    swapAvailable: false
  },
  {
    id: 'ripple',
    symbol: 'XRP',
    name: 'XRP',
    image: 'https://assets.coingecko.com/coins/images/44/large/xrp.png',
    mint: null,
    decimals: 6,
    swapAvailable: false
  },
  {
    id: 'avalanche-2',
    symbol: 'AVAX',
    name: 'Avalanche',
    image: 'https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png',
    mint: null,
    decimals: 18,
    swapAvailable: false
  },
  {
    id: 'polygon-pos',
    symbol: 'MATIC',
    name: 'Polygon',
    image: 'https://assets.coingecko.com/coins/images/4713/large/polygon.png',
    mint: null,
    decimals: 18,
    swapAvailable: false
  },
  {
    id: 'polkadot',
    symbol: 'DOT',
    name: 'Polkadot',
    image: 'https://assets.coingecko.com/coins/images/12171/large/polkadot.png',
    mint: null,
    decimals: 10,
    swapAvailable: false
  },
  {
    id: 'chainlink',
    symbol: 'LINK',
    name: 'Chainlink',
    image: 'https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png',
    mint: null,
    decimals: 18,
    swapAvailable: false
  },
  {
    id: 'stellar',
    symbol: 'XLM',
    name: 'Stellar',
    image: 'https://assets.coingecko.com/coins/images/100/large/Stellar_symbol_black_RGB.png',
    mint: null,
    decimals: 7,
    swapAvailable: false
  },
  {
    id: 'uniswap',
    symbol: 'UNI',
    name: 'Uniswap',
    image: 'https://assets.coingecko.com/coins/images/12504/large/uniswap.jpg',
    mint: null,
    decimals: 18,
    swapAvailable: false
  },
];

export default function MarketScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const theme = useAppStore(s => s.theme);
  const primaryColor = useAppStore(s => s.primaryColor);
  const walletBalances = useAppStore(s => s.balances);

  const [tokens, setTokens] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [lastUpdate, setLastUpdate] = useState(null);

  const isDark = theme === 'dark';
  const bg = isDark ? '#0A0A0F' : '#F8F9FA';
  const cardBg = isDark ? '#1A1A2E' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#1A1A2E';
  const secondaryText = isDark ? '#A0A0B0' : '#6B7280';
  const borderColor = isDark ? '#2A2A3E' : '#E5E7EB';

  const fetchMarketData = async () => {
    try {
      const ids = TOKEN_LIST.map(token => token.id).join(',');
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h`;

      console.log('📊 Fetching market data from CoinGecko...');
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // تنسيق البيانات
      const formattedTokens = data.map(item => {
        const tokenInfo = TOKEN_LIST.find(t => t.id === item.id) || TOKEN_LIST[0];
        return {
          id: item.id,
          symbol: item.symbol.toUpperCase(),
          name: item.name,
          currentPrice: item.current_price,
          priceChange24h: item.price_change_percentage_24h,
          marketCap: item.market_cap,
          totalVolume: item.total_volume,
          image: item.image,
          lastUpdated: item.last_updated,
          rank: item.market_cap_rank,
          high24h: item.high_24h,
          low24h: item.low_24h,
          mint: tokenInfo.mint,
          decimals: tokenInfo.decimals,
          swapAvailable: tokenInfo.swapAvailable,
          balance: walletBalances?.[tokenInfo.symbol] || 0
        };
      });

      // ترتيب حسب القيمة السوقية
      formattedTokens.sort((a, b) => a.rank - b.rank);

      setTokens(formattedTokens);
      setLastUpdate(new Date());
      console.log('✅ Market data loaded successfully');

    } catch (error) {
      console.error('❌ Error fetching market data:', error);
      // بيانات طوارئ
      setTokens(getFallbackData());
      setLastUpdate(new Date());
    }
  };

  const getFallbackData = () => {
    return TOKEN_LIST.map((token, index) => ({
      id: token.id,
      symbol: token.symbol.toUpperCase(),
      name: token.name,
      currentPrice: getRandomPrice(token.symbol),
      priceChange24h: (Math.random() * 10 - 5),
      marketCap: Math.random() * 100000000000,
      totalVolume: Math.random() * 10000000000,
      image: token.image,
      lastUpdated: new Date().toISOString(),
      rank: index + 1,
      high24h: 0,
      low24h: 0,
      mint: token.mint,
      decimals: token.decimals,
      swapAvailable: token.swapAvailable,
      balance: walletBalances?.[token.symbol] || 0
    })).sort((a, b) => a.rank - b.rank);
  };

  const getRandomPrice = (symbol) => {
    const prices = {
      'SOL': 90 + Math.random() * 20,
      'BTC': 40000 + Math.random() * 10000,
      'ETH': 2500 + Math.random() * 500,
      'USDT': 1,
      'USDC': 1,
      'MECO': 0.09 + Math.random() * 0.02,
      'BNB': 300 + Math.random() * 50,
      'ADA': 0.5 + Math.random() * 0.2,
      'DOGE': 0.08 + Math.random() * 0.04,
      'XRP': 0.6 + Math.random() * 0.2,
      'AVAX': 35 + Math.random() * 10,
      'MATIC': 0.8 + Math.random() * 0.3,
      'DOT': 7 + Math.random() * 3,
      'LINK': 14 + Math.random() * 5,
      'XLM': 0.12 + Math.random() * 0.05,
      'UNI': 7 + Math.random() * 3,
    };
    return prices[symbol] || 1;
  };

  const loadMarketData = async () => {
    try {
      setLoading(true);
      await fetchMarketData();
    } catch (error) {
      console.error('❌ خطأ في تحميل بيانات السوق:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMarketData();
    // تحديث الأسعار كل دقيقة
    const interval = setInterval(() => {
      fetchMarketData();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMarketData();
    setRefreshing(false);
  };

  const handleTokenPress = (token) => {
    // التحقق من توفر الرمز للتبادل
    if (!token.swapAvailable) {
      Alert.alert(
        t('swap_token_not_available'),
        `${token.name} ${t('swap_token_not_available_message')}`,
        [{ text: t('ok') }]
      );
      return;
    }

    if (!token.mint && token.symbol !== 'SOL') {
      Alert.alert(
        t('swap_token_not_available'),
        `${token.name} ${t('swap_token_unavailable_solana')}`,
        [{ text: t('ok') }]
      );
      return;
    }

    // الانتقال إلى شاشة Swap مع بيانات الرمز المختار
    navigation.navigate('Swap', {
      selectedToken: {
        symbol: token.symbol,
        name: token.name,
        mint: token.mint || 'So11111111111111111111111111111111111111112',
        decimals: token.decimals || 6,
        image: token.image,
        price: token.currentPrice,
        balance: token.balance || 0,
        swapAvailable: token.swapAvailable || false
      }
    });
  };

  const renderTokenItem = (token, index) => {
    const isPositive = token.priceChange24h >= 0;

    // تحديد عدد الكسور بناءً على السعر
    const decimals = token.currentPrice < 0.01 ? 6 :
                    token.currentPrice < 1 ? 4 : 2;

    return (
      <TouchableOpacity
        key={`${token.symbol}-${index}`}
        style={[styles.tokenCard, {
          backgroundColor: cardBg,
          borderColor,
          opacity: token.swapAvailable ? 1 : 0.7
        }]}
        onPress={() => handleTokenPress(token)}
      >
        <View style={styles.tokenRow}>
          <View style={styles.tokenInfo}>
            <Text style={[styles.rank, { color: secondaryText }]}>
              #{token.rank || index + 1}
            </Text>
            <Image
              source={{ uri: token.image }}
              style={styles.tokenLogo}
              defaultSource={{ uri: 'https://via.placeholder.com/40' }}
            />
            <View style={styles.tokenDetails}>
              <View style={styles.symbolRow}>
                <Text style={[styles.tokenSymbol, { color: textColor }]}>
                  {token.symbol}
                </Text>
                {!token.swapAvailable && (
                  <View style={[styles.notAvailableBadge, { backgroundColor: '#F59E0B20' }]}>
                    <Text style={[styles.notAvailableText, { color: '#F59E0B' }]}>
                      {t('market_unavailable')}
                    </Text>
                  </View>
                )}
                {token.balance > 0 && (
                  <View style={[styles.balanceBadge, { backgroundColor: primaryColor + '20' }]}>
                    <Text style={[styles.balanceText, { color: primaryColor }]}>
                      {token.balance.toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tokenName, { color: secondaryText }]} numberOfLines={1}>
                {token.name}
              </Text>
            </View>
          </View>

          <View style={styles.tokenStats}>
            <Text style={[styles.tokenPrice, { color: textColor }]}>
              ${token.currentPrice.toFixed(decimals)}
            </Text>
            <View style={styles.changeContainer}>
              <View style={[
                styles.changePill,
                { backgroundColor: isPositive ? '#10B98120' : '#EF444420' }
              ]}>
                <Ionicons
                  name={isPositive ? 'caret-up' : 'caret-down'}
                  size={12}
                  color={isPositive ? '#10B981' : '#EF4444'}
                />
                <Text style={[
                  styles.changeText,
                  { color: isPositive ? '#10B981' : '#EF4444' }
                ]}>
                  {isPositive ? '+' : ''}{token.priceChange24h.toFixed(2)}%
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.tokenFooter, { borderTopColor: borderColor }]}>
          <View style={styles.marketStats}>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: secondaryText }]}>
                {t('market_market_cap')}
              </Text>
              <Text style={[styles.statValue, { color: textColor }]}>
                ${formatNumber(token.marketCap)}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: secondaryText }]}>
                {t('market_24h_volume')}
              </Text>
              <Text style={[styles.statValue, { color: textColor }]}>
                ${formatNumber(token.totalVolume)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const formatNumber = (num) => {
    if (num >= 1e9) {
      return (num / 1e9).toFixed(2) + 'B';
    } else if (num >= 1e6) {
      return (num / 1e6).toFixed(2) + 'M';
    } else if (num >= 1e3) {
      return (num / 1e3).toFixed(2) + 'K';
    }
    return num.toFixed(2);
  };

  const renderTabs = () => {
    const tabs = [
      { id: 'all', label: t('market_all_coins') },
      { id: 'solana', label: t('market_solana_tokens') },
      { id: 'stable', label: t('market_stablecoins') },
      { id: 'gainers', label: t('market_top_gainers') },
    ];

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
      >
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tabButton,
              activeTab === tab.id && [styles.activeTab, { backgroundColor: primaryColor }]
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === tab.id ? '#FFFFFF' : secondaryText }
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const filteredTokens = tokens.filter(token => {
    if (activeTab === 'solana') return token.swapAvailable;
    if (activeTab === 'stable') return ['USDT', 'USDC'].includes(token.symbol);
    if (activeTab === 'gainers') return token.priceChange24h > 0;
    return true; // 'all'
  });

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={[styles.loadingText, { color: textColor }]}>
          {t('loading_market_data')}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[primaryColor]}
            tintColor={primaryColor}
          />
        }
      >
        {/* الهيدر */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: textColor }]}>{t('market_title')}</Text>
            <Text style={[styles.subtitle, { color: secondaryText }]}>
              {t('market_track_prices')}
            </Text>
          </View>
          <View style={styles.headerStats}>
            {lastUpdate && (
              <Text style={[styles.statsText, { color: secondaryText }]}>
                {t('market_last_update')}: {lastUpdate.toLocaleTimeString('ar-SA', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            )}
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={onRefresh}
            >
              <Ionicons name="refresh" size={20} color={primaryColor} />
            </TouchableOpacity>
          </View>
        </View>

        {/* التبويبات */}
        {renderTabs()}

        {/* إعلان */}
        <View style={[styles.infoCard, { backgroundColor: primaryColor + '10', borderColor }]}>
          <Ionicons name="information-circle" size={24} color={primaryColor} />
          <View style={styles.infoContent}>
            <Text style={[styles.infoTitle, { color: textColor }]}>
              {t('market_press_to_swap')}
            </Text>
            <Text style={[styles.infoText, { color: secondaryText }]}>
              {t('market_swap_available')}
            </Text>
          </View>
        </View>

        {/* قائمة العملات */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            {activeTab === 'solana' ? t('market_available_for_swap') : t('market_prices')}
          </Text>
          <Text style={[styles.sectionCount, { color: secondaryText }]}>
            {t('tokens_count', { count: filteredTokens.length })}
          </Text>
        </View>

        <View style={styles.tokensList}>
          {filteredTokens.map(renderTokenItem)}
        </View>

        {/* ملاحظة */}
        <View style={[styles.noteCard, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.noteTitle, { color: textColor }]}>
            {t('important_note')}:
          </Text>
          <Text style={[styles.noteText, { color: secondaryText }]}>
            {t('market_prices_note')}
          </Text>
        </View>

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
    opacity: 0.8,
  },
  headerStats: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
  },
  statsText: {
    fontSize: 12,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 16,
  },
  tabsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  tabButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionCount: {
    fontSize: 14,
  },
  tokensList: {
    paddingHorizontal: 20,
  },
  tokenCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  tokenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rank: {
    width: 32,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  tokenLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 12,
  },
  tokenDetails: {
    flex: 1,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    flexWrap: 'wrap',
    gap: 6,
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  notAvailableBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  notAvailableText: {
    fontSize: 9,
    fontWeight: '600',
  },
  balanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  balanceText: {
    fontSize: 10,
    fontWeight: '600',
  },
  tokenName: {
    fontSize: 12,
    opacity: 0.7,
  },
  tokenStats: {
    alignItems: 'flex-end',
    minWidth: 100,
  },
  tokenPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'right',
  },
  changeContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  tokenFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  marketStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  noteCard: {
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 20,
    borderWidth: 1,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 18,
  },
  spacer: {
    height: 40,
  },
});
