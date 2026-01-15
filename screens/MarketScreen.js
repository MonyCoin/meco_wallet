import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, RefreshControl, Image, TouchableOpacity
} from 'react-native';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import { getJupiterTokens } from '../services/jupiterService';
import { useNavigation } from '@react-navigation/native';

// عملات نريد عرض أسعارها
const TARGET_TOKENS = [
  { 
    address: 'So11111111111111111111111111111111111111112', 
    symbol: 'SOL', 
    decimals: 9,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
  },
  { 
    address: '7hBNyFfwYTv65z3ZudMAyKBw3BLMKxyKXsr5xM51Za4i', 
    symbol: 'MECO', 
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/saadeh73/meco-project/main/meco-logo.png'
  },
  { 
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 
    symbol: 'USDC', 
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
  },
  { 
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 
    symbol: 'USDT', 
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg'
  },
];

export default function MarketScreen() {
  const { t } = useTranslation();
  const theme = useAppStore(s => s.theme);
  const primaryColor = useAppStore(s => s.primaryColor);
  const isDark = theme === 'dark';
  const bg = isDark ? '#000' : '#fff';
  const fg = isDark ? '#fff' : '#000';
  const navigation = useNavigation();

  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // دالة لجلب الأسعار الحقيقية من Jupiter Price API
  const fetchRealTimePrices = async () => {
    try {
      // 1. بناء قائمة عناوين العملات
      const tokenIds = TARGET_TOKENS.map(token => token.address).join(',');
      
      // 2. جلب الأسعار من Jupiter Price API
      const priceResponse = await fetch(
        `https://price.jup.ag/v4/price?ids=${tokenIds}`
      );
      
      if (!priceResponse.ok) {
        throw new Error(`HTTP ${priceResponse.status}`);
      }
      
      const priceData = await priceResponse.json();
      
      // 3. دمج الأسعار مع معلومات العملات
      const tokensWithPrices = TARGET_TOKENS.map(token => {
        const priceInfo = priceData.data?.[token.address];
        
        return {
          address: token.address,
          symbol: token.symbol,
          name: getTokenName(token.symbol),
          logoURI: token.logoURI,
          decimals: token.decimals,
          price: priceInfo?.price || 0,
          priceChange24h: priceInfo?.priceChange24h || 0
        };
      });
      
      setTokens(tokensWithPrices);
      
    } catch (error) {
      console.warn('❌ فشل جلب الأسعار الحقيقية:', error.message);
      // 4. إذا فشل API، جرب البديل (CoinGecko)
      await fetchPricesFromCoinGecko();
    }
  };

  // دالة بديلة لجلب الأسعار من CoinGecko
  const fetchPricesFromCoinGecko = async () => {
    try {
      // رموز CoinGecko المقابلة للعملات
      const geckoIds = {
        'SOL': 'solana',
        'MECO': 'monycoin', // قد تحتاج لتعديل هذا
        'USDC': 'usd-coin',
        'USDT': 'tether'
      };
      
      const ids = Object.values(geckoIds).join(',');
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24h_change=true`
      );
      
      if (!response.ok) throw new Error('فشل CoinGecko');
      
      const data = await response.json();
      
      const tokensWithPrices = TARGET_TOKENS.map(token => {
        const geckoId = geckoIds[token.symbol];
        const priceData = data[geckoId];
        
        return {
          address: token.address,
          symbol: token.symbol,
          name: getTokenName(token.symbol),
          logoURI: token.logoURI,
          decimals: token.decimals,
          price: priceData?.usd || 0,
          priceChange24h: priceData?.usd_24h_change || 0
        };
      });
      
      setTokens(tokensWithPrices);
      
    } catch (geckoError) {
      console.warn('❌ فشل CoinGecko أيضاً:', geckoError.message);
      // 5. إذا فشل كل شيء، استخدم بيانات افتراضية
      setTokens(getFallbackTokens());
    }
  };

  // دالة مساعدة للحصول على اسم العملة
  const getTokenName = (symbol) => {
    const names = {
      'SOL': 'Solana',
      'MECO': 'MonyCoin',
      'USDC': 'USD Coin',
      'USDT': 'Tether'
    };
    return names[symbol] || symbol;
  };

  // بيانات احتياطية
  const getFallbackTokens = () => {
    return TARGET_TOKENS.map(token => ({
      ...token,
      name: getTokenName(token.symbol),
      price: 0,
      priceChange24h: 0
    }));
  };

  const fetchMarket = async () => {
    try {
      setLoading(true);
      await fetchRealTimePrices();
    } catch (e) {
      console.warn('Market error:', e.message);
      setTokens(getFallbackTokens());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarket();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMarket();
    setRefreshing(false);
  };

  const renderItem = ({ item }) => {
    const isPositive = item.priceChange24h >= 0;
    
    return (
      <TouchableOpacity
        onPress={() =>
          navigation.navigate('Swap', {
            fromToken: item.address,
          })
        }
        style={[styles.item, { backgroundColor: isDark ? '#111' : '#f2f2f2' }]}
      >
        <Image 
          source={{ uri: item.logoURI }} 
          style={styles.icon} 
        />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={[styles.symbol, { color: fg }]}>{item.symbol}</Text>
          <Text style={[styles.name, { color: fg }]}>{item.name}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.price, { color: fg }]}>
            ${item.price > 0 ? item.price.toFixed(4) : '—'}
          </Text>
          <Text style={[
            styles.change, 
            { color: isPositive ? '#4CAF50' : '#F44336' }
          ]}>
            {item.priceChange24h ? 
              `${isPositive ? '+' : ''}${item.priceChange24h.toFixed(2)}%` : 
              '0.00%'
            }
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Text style={[styles.header, { color: fg }]}>{t('market') || 'السوق'}</Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={[styles.loadingText, { color: fg }]}>
            جاري تحميل الأسعار الحية...
          </Text>
        </View>
      ) : (
        <FlatList
          data={tokens}
          keyExtractor={item => item.address}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={[primaryColor]}
            />
          }
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={{ color: fg }}>لا توجد بيانات للأسعار</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 20, 
    textAlign: 'center' 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40
  },
  item: { 
    flexDirection: 'row', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 10,
    alignItems: 'center'
  },
  icon: { 
    width: 40, 
    height: 40, 
    borderRadius: 20 
  },
  symbol: { 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  name: { 
    fontSize: 12, 
    opacity: 0.7,
    marginTop: 2 
  },
  price: { 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  change: { 
    fontSize: 12, 
    marginTop: 2,
    fontWeight: '500'
  },
});
