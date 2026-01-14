import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, RefreshControl, Image, TouchableOpacity
} from 'react-native';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import { getJupiterTokens, fetchQuoteViaRest, baseUnitsToAmount } from '../services/jupiterService';
import { useNavigation } from '@react-navigation/native';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

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

  const fetchMarket = async () => {
    try {
      setLoading(true);
      const list = await getJupiterTokens();

      const baseList = list
        .filter(t => t.address && t.decimals != null)
        .slice(0, 30); // مهم: لا تسعّر 500 عملة

      const priced = [];

      for (const token of baseList) {
        try {
          const amount = Math.pow(10, token.decimals);
          const quote = await fetchQuoteViaRest(
            token.address,
            USDC_MINT,
            amount
          );

          const price = baseUnitsToAmount(
            Number(quote.outAmount),
            6
          );

          priced.push({ ...token, price });
        } catch {
          priced.push({ ...token, price: 0 });
        }
      }

      setTokens(priced);
    } catch (e) {
      console.warn('Market error:', e.message);
      setTokens([]);
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

  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate('Swap', {
          fromToken: item.address,
        })
      }
      style={[styles.item, { backgroundColor: isDark ? '#111' : '#f2f2f2' }]}
    >
      <Image source={{ uri: item.logoURI }} style={styles.icon} />
      <View style={{ marginLeft: 12 }}>
        <Text style={[styles.symbol, { color: fg }]}>{item.symbol}</Text>
        <Text style={[styles.price, { color: primaryColor }]}>
          ${item.price ? item.price.toFixed(4) : '—'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Text style={[styles.header, { color: fg }]}>{t('market') || 'السوق'}</Text>

      {loading ? (
        <ActivityIndicator size="large" color={primaryColor} />
      ) : (
        <FlatList
          data={tokens}
          keyExtractor={i => i.address}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 14, textAlign: 'center' },
  item: { flexDirection: 'row', padding: 14, borderRadius: 10, marginBottom: 10 },
  icon: { width: 36, height: 36, borderRadius: 18 },
  symbol: { fontSize: 16, fontWeight: 'bold' },
  price: { marginTop: 4, fontSize: 14 },
});
