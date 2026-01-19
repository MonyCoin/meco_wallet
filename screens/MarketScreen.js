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
  Linking,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { 
  getTokens,
  fetchPrices
} from '../services/jupiterService';

const { width } = Dimensions.get('window');

// بيانات MECO الثابتة
const MECO_TOKEN = {
  address: '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyK3rKZK7ytfqcJm7So',
  symbol: 'MECO',
  name: 'MonyCoin',
  decimals: 6,
  logoURI: 'https://raw.githubusercontent.com/saadeh73/meco-project/main/meco-logo.png',
  currentPrice: 0.00617 // السعر الحقيقي
};

export default function MarketScreen() {
  const { t } = useTranslation();
  const theme = useAppStore(s => s.theme);
  const primaryColor = useAppStore(s => s.primaryColor);
  const walletBalances = useAppStore(s => s.balances);
  
  const [tokens, setTokens] = useState([]);
  const [prices, setPrices] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  const isDark = theme === 'dark';
  const bg = isDark ? '#0A0A0A' : '#F8F9FA';
  const cardBg = isDark ? '#1A1A1A' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#000000';
  const secondaryText = isDark ? '#AAAAAA' : '#666666';
  const borderColor = isDark ? '#333333' : '#E0E0E0';

  useEffect(() => {
    loadMarketData();
  }, []);

  const loadMarketData = async () => {
    try {
      setLoading(true);
      
      // 1. جلب قائمة العملات
      let tokenList = [];
      try {
        tokenList = await getTokens();
        if (!Array.isArray(tokenList)) {
          tokenList = [];
        }
      } catch (error) {
        console.log('⚠️ استخدام قائمة العملات الافتراضية');
        tokenList = [];
      }
      
      // 2. إضافة MECO للقائمة إذا لم تكن موجودة
      const hasMeco = tokenList.some(t => t.symbol === 'MECO');
      if (!hasMeco) {
        tokenList = [MECO_TOKEN, ...tokenList];
      }
      
      // 3. جلب الأسعار الحقيقية
      let priceData = {};
      try {
        priceData = await fetchPrices();
      } catch (error) {
        console.log('⚠️ استخدام الأسعار الافتراضية');
        priceData = {
          'MECO': { price: 0.00617, source: 'Fixed', updated: Date.now() },
          'SOL': { price: 185, source: 'Fixed', updated: Date.now() },
          'USDC': { price: 1, source: 'Fixed', updated: Date.now() },
          'USDT': { price: 1, source: 'Fixed', updated: Date.now() }
        };
      }
      
      // 4. تأكد من وجود سعر MECO
      if (!priceData['MECO']) {
        priceData['MECO'] = { price: 0.00617, source: 'Fixed', updated: Date.now() };
      }
      
      // 5. دمج البيانات
      const tokensWithPrices = tokenList.slice(0, 15).map(token => {
        const symbol = token.symbol;
        const priceInfo = priceData[symbol] || { price: 0, source: 'Unknown' };
        
        // بيانات افتراضية للتغيرات
        let change24h = 0;
        if (symbol === 'MECO') {
          change24h = 0.5; // +0.5% لـ MECO
        } else if (symbol === 'SOL') {
          change24h = Math.random() * 6 - 3; // بين -3% و +3%
        } else if (symbol === 'USDC' || symbol === 'USDT') {
          change24h = 0;
        } else {
          change24h = Math.random() * 10 - 5; // بين -5% و +5%
        }
        
        return {
          ...token,
          currentPrice: priceInfo.price,
          priceSource: priceInfo.source,
          change24h: change24h,
          marketCap: priceInfo.price * (Math.random() * 1000000000 + 1000000),
          volume24h: priceInfo.price * (Math.random() * 10000000 + 100000)
        };
      });
      
      // 6. ترتيب العملات حسب القيمة السوقية
      tokensWithPrices.sort((a, b) => b.marketCap - a.marketCap);
      
      setTokens(tokensWithPrices);
      setPrices(priceData);
      
    } catch (error) {
      console.error('❌ خطأ في تحميل بيانات السوق:', error);
      
      // بيانات افتراضية في حالة الخطأ
      const defaultTokens = [
        {
          ...MECO_TOKEN,
          currentPrice: 0.00617,
          priceSource: 'Fixed',
          change24h: 0.5,
          marketCap: 61700,
          volume24h: 12340
        },
        {
          address: 'So11111111111111111111111111111111111111112',
          symbol: 'SOL',
          name: 'Solana',
          decimals: 9,
          logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
          currentPrice: 185,
          priceSource: 'Fixed',
          change24h: -1.2,
          marketCap: 85000000000,
          volume24h: 2500000000
        },
        {
          address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
          currentPrice: 1,
          priceSource: 'Fixed',
          change24h: 0,
          marketCap: 30000000000,
          volume24h: 4500000000
        }
      ];
      
      setTokens(defaultTokens);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMarketData();
    setRefreshing(false);
  };

  const openWebsite = (url) => {
    if (url) {
      Linking.openURL(url);
    }
  };

  const renderTokenItem = (token, index) => {
    const isPositive = token.change24h >= 0;
    const balance = walletBalances?.[token.address] || 0;
    const tokenBalance = balance / Math.pow(10, token.decimals || 9);
    const usdValue = tokenBalance * token.currentPrice;
    
    // تحديد عدد الكسور بناءً على السعر
    const decimals = token.currentPrice < 0.01 ? 6 : 
                    token.currentPrice < 1 ? 4 : 2;

    return (
      <TouchableOpacity 
        key={`${token.symbol}-${index}`}
        style={[styles.tokenCard, { backgroundColor: cardBg, borderColor }]}
      >
        <View style={styles.tokenRow}>
          <View style={styles.tokenInfo}>
            <Text style={[styles.rank, { color: secondaryText }]}>
              {index + 1}
            </Text>
            <Image 
              source={{ uri: token.logoURI }} 
              style={styles.tokenLogo}
              defaultSource={{ uri: 'https://via.placeholder.com/40' }}
            />
            <View style={styles.tokenDetails}>
              <View style={styles.symbolRow}>
                <Text style={[styles.tokenSymbol, { color: textColor }]}>
                  {token.symbol}
                </Text>
                {token.symbol === 'MECO' && (
                  <View style={styles.mecoBadge}>
                    <Text style={styles.mecoBadgeText}>MECO</Text>
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
                  {isPositive ? '+' : ''}{token.change24h.toFixed(2)}%
                </Text>
              </View>
            </View>
          </View>
        </View>
        
        <View style={[styles.tokenFooter, { borderTopColor: borderColor }]}>
          <View style={styles.sourceContainer}>
            <Ionicons name="information-circle-outline" size={12} color={secondaryText} />
            <Text style={[styles.sourceText, { color: secondaryText }]}>
              {token.priceSource || 'Unknown'}
            </Text>
          </View>
          
          {tokenBalance > 0 && (
            <View style={styles.balanceContainer}>
              <Text style={[styles.balanceText, { color: textColor }]}>
                {t('your_balance')}: {tokenBalance.toFixed(4)}
              </Text>
              <Text style={[styles.balanceValue, { color: secondaryText }]}>
                ≈ ${usdValue.toFixed(2)}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderTabs = () => {
    const tabs = [
      { id: 'all', label: t('all_tokens') },
      { id: 'solana', label: t('solana_tokens') },
      { id: 'stable', label: t('stablecoins') },
      { id: 'gainers', label: t('gainers') },
      { id: 'trending', label: t('trending') }
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

  const filteredTokens = tokens.filter(token => {
    if (activeTab === 'solana') return true; // كل العملات على سولانا
    if (activeTab === 'stable') return ['USDC', 'USDT'].includes(token.symbol);
    if (activeTab === 'gainers') return token.change24h > 0;
    if (activeTab === 'trending') return Math.abs(token.change24h) > 3;
    return true; // 'all'
  });

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
            <Text style={[styles.title, { color: textColor }]}>{t('market')}</Text>
            <Text style={[styles.subtitle, { color: secondaryText }]}>
              {t('market_subtitle')}
            </Text>
          </View>
          <View style={styles.headerStats}>
            <Text style={[styles.statsText, { color: secondaryText }]}>
              {t('tokens_count', { count: tokens.length })}
            </Text>
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

        {/* قائمة العملات */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            {t('current_prices')}
          </Text>
        </View>

        <View style={styles.tokensList}>
          {filteredTokens.map(renderTokenItem)}
        </View>

        {/* ملاحظة أسفل الشاشة */}
        <View style={[styles.noteCard, { backgroundColor: primaryColor + '10', borderColor }]}>
          <Ionicons name="alert-circle-outline" size={20} color={primaryColor} />
          <View style={styles.noteContent}>
            <Text style={[styles.noteTitle, { color: textColor }]}>
              {t('important_note')}
            </Text>
            <Text style={[styles.noteText, { color: secondaryText }]}>
              {t('prices_auto_updated')}
              {'\n'}
              <Text style={{ color: primaryColor, fontWeight: 'bold' }}>
                {t('meco_price_note', { price: MECO_TOKEN.currentPrice })}
              </Text>
            </Text>
          </View>
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
  },
  statsText: {
    fontSize: 12,
    marginBottom: 8,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
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
  mecoLink: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
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
    width: 24,
    fontSize: 14,
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
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  mecoBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#FF6B6B20',
  },
  mecoBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  tokenName: {
    fontSize: 12,
    opacity: 0.7,
  },
  tokenStats: {
    alignItems: 'flex-end',
  },
  tokenPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
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
  sourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceText: {
    fontSize: 10,
    marginLeft: 4,
  },
  balanceContainer: {
    alignItems: 'flex-end',
  },
  balanceText: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  balanceValue: {
    fontSize: 10,
  },
  noteCard: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  noteContent: {
    flex: 1,
    marginLeft: 12,
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
