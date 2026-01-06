import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Image, ActivityIndicator, ScrollView,
  Dimensions, Linking, TouchableOpacity
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store';
import { LineChart } from 'react-native-chart-kit';

const chartWidth = Dimensions.get('window').width - 40;

export default function TokenDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { token } = route.params;

  const theme = useAppStore(state => state.theme);
  const primaryColor = useAppStore(state => state.primaryColor);
  const isDark = theme === 'dark';
  const bg = isDark ? '#000' : '#fff';
  const fg = isDark ? '#fff' : '#000';

  const [price, setPrice] = useState(null);
  const [change24h, setChange24h] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [links, setLinks] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTokenDetails();
  }, []);

  const loadTokenDetails = async () => {
    try {
      setLoading(true);

      const symbol = token.symbol?.toUpperCase();
      const idMap = {
        SOL: 'solana',
        USDT: 'tether',
        BTC: 'bitcoin',
        ETH: 'ethereum',
        MECO: 'meco-token',
      };

      const coinId = idMap[symbol];
      if (!coinId) return;

      const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`);
      const priceJson = await priceRes.json();

      const priceUsd = priceJson?.[coinId]?.usd ?? 0;
      const change = priceJson?.[coinId]?.usd_24h_change ?? 0;

      setPrice(priceUsd);
      setChange24h(change);

      const chartRes = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=7`);
      const chartJson = await chartRes.json();
      const prices = chartJson?.prices?.map(p => p[1]) ?? [];

      setChartData(prices);

      const detailsRes = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}`);
      const detailsJson = await detailsRes.json();

      setLinks({
        homepage: detailsJson?.links?.homepage?.[0] || null,
        twitter: detailsJson?.links?.twitter_screen_name
          ? `https://twitter.com/${detailsJson.links.twitter_screen_name}`
          : null,
        coingecko: `https://www.coingecko.com/en/coins/${coinId}`,
      });
    } catch (err) {
      console.warn('❌ Error loading token details:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const getChangeColor = () => {
    if (change24h === null) return fg;
    return change24h >= 0 ? '#2ecc71' : '#e74c3c';
  };

  const openURL = (url) => {
    if (url) Linking.openURL(url).catch(() => {});
  };

  const handleSend = () => {
    navigation.navigate('Send', { preselectedToken: token.symbol });
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.centered}>
        <Image source={{ uri: token.logoURI || 'https://via.placeholder.com/72' }} style={styles.icon} />
        <Text style={[styles.symbol, { color: fg }]}>{token.symbol}</Text>
        <Text style={[styles.name, { color: fg }]}>{token.name}</Text>

        {loading ? (
          <ActivityIndicator size="small" color={primaryColor} style={{ marginTop: 10 }} />
        ) : (
          <>
            <Text style={[styles.price, { color: primaryColor }]}>${price?.toFixed(4)}</Text>
            <Text style={[styles.change, { color: getChangeColor() }]}>
              {change24h?.toFixed(2)}%
            </Text>
          </>
        )}
      </View>

      {!loading && chartData.length > 0 && (
        <LineChart
          data={{ datasets: [{ data: chartData }] }}
          width={chartWidth}
          height={220}
          withInnerLines={false}
          withOuterLines={false}
          withDots={false}
          withShadow={false}
          chartConfig={{
            backgroundGradientFrom: bg,
            backgroundGradientTo: bg,
            color: () => primaryColor,
            labelColor: () => fg,
            strokeWidth: 2,
          }}
          bezier
          style={styles.chart}
        />
      )}

      {!loading && (
        <View style={styles.linksContainer}>
          {links.homepage && (
            <TouchableOpacity onPress={() => openURL(links.homepage)}>
              <Text style={[styles.link, { color: primaryColor }]}>🌐 {links.homepage}</Text>
            </TouchableOpacity>
          )}
          {links.twitter && (
            <TouchableOpacity onPress={() => openURL(links.twitter)}>
              <Text style={[styles.link, { color: primaryColor }]}>🐦 Twitter</Text>
            </TouchableOpacity>
          )}
          {links.coingecko && (
            <TouchableOpacity onPress={() => openURL(links.coingecko)}>
              <Text style={[styles.link, { color: primaryColor }]}>📊 View on CoinGecko</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <TouchableOpacity style={[styles.sendBtn, { backgroundColor: primaryColor }]} onPress={handleSend}>
        <Text style={styles.sendText}>إرسال {token.symbol}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  centered: { alignItems: 'center', marginTop: 30 },
  icon: { width: 72, height: 72, borderRadius: 36, marginBottom: 12 },
  symbol: { fontSize: 22, fontWeight: 'bold' },
  name: { fontSize: 16, opacity: 0.8 },
  price: { fontSize: 24, fontWeight: 'bold', marginTop: 10 },
  change: { fontSize: 16, marginTop: 6 },
  chart: { marginTop: 30, borderRadius: 16 },
  linksContainer: { marginTop: 20 },
  link: { fontSize: 14, marginBottom: 10, textAlign: 'center' },
  sendBtn: {
    padding: 14,
    marginTop: 30,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
