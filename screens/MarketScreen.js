import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, RefreshControl, Image, TouchableOpacity
} from 'react-native';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import { getJupiterTokens } from '../services/jupiterService';
import { useNavigation } from '@react-navigation/native';

export default function MarketScreen() {
  const { t } = useTranslation();
  const theme = useAppStore((state) => state.theme);
  const primaryColor = useAppStore((state) => state.primaryColor);
  const isDark = theme === 'dark';
  const bg = isDark ? '#000' : '#fff';
  const fg = isDark ? '#fff' : '#000';
  const navigation = useNavigation();

  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const mapSymbolsToGeckoIds = async (tokenList) => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/coins/list');
      const geckoList = await response.json();

      return tokenList.map(token => {
        const found = geckoList.find(
          g => g.symbol.toLowerCase() === token.symbol.toLowerCase()
        );
        return {
          ...token,
          geckoId: found?.id || null,
        };
      });
    } catch (err) {
      console.warn('❌ mapSymbolsToGeckoIds error:', err.message);
      return tokenList.map(token => ({ ...token, geckoId: null }));
    }
  };

  const fetchMarketData = async () => {
    try {
      setLoading(true);
      const list = await getJupiterTokens();

      const cleanedList = list.filter(t =>
        t.symbol && t.name && t.address && typeof t.decimals === 'number'
      );

      const withIds = await mapSymbolsToGeckoIds(cleanedList);
      const ids = withIds.map(t => t.geckoId).filter(Boolean);

      const prices = {};
      if (ids.length > 0) {
        const priceRes = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`
        );
        const priceJson = await priceRes.json();

        ids.forEach(id => {
          prices[id] = priceJson[id]?.usd ?? 0;
        });
      }

      const tokensWithPrices = withIds.map(token => ({
        ...token,
        price: token.geckoId ? prices[token.geckoId] || 0 : 0,
      }));

      setTokens(tokensWithPrices);
    } catch (err) {
      console.warn('📉 Market fetch error:', err.message);
      setTokens([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMarketData();
    setRefreshing(false);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('TokenDetails', { token: item })}
      style={[styles.item, { backgroundColor: isDark ? '#111' : '#f2f2f2' }]}
    >
      <Image
        source={{ uri: item.logoURI || 'https://via.placeholder.com/36' }}
        style={styles.icon}
      />
      <View style={{ marginLeft: 12 }}>
        <Text style={[styles.symbol, { color: fg }]}>{item.symbol}</Text>
        <Text style={[styles.name, { color: fg }]}>{item.name}</Text>
        <Text style={[styles.price, { color: primaryColor }]}>
          ${typeof item.price === 'number' ? item.price.toFixed(4) : '0.0000'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Text style={[styles.header, { color: fg }]}>{t('market') || 'السوق'}</Text>

      {loading ? (
        <ActivityIndicator size="large" color={primaryColor} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={tokens}
          keyExtractor={(item) => item.address}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 14, textAlign: 'center' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ccc',
  },
  symbol: { fontSize: 16, fontWeight: 'bold' },
  name: { fontSize: 14, opacity: 0.8 },
  price: { fontSize: 16, fontWeight: 'bold', marginTop: 4 },
});
