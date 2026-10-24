// screens/AssetDetailsScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  ScrollView, ActivityIndicator, Alert, Linking,
  Image, RefreshControl, Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAssetChart, getAssetNews, getStockProfile,
} from '../services/assetChartService';

const WATCHLIST_KEY = '@meco_watchlist';

const TIMEFRAMES = ['1D', '7D', '30D', '90D', '1Y'];

const fmtPrice = (p) => {
  if (!p && p !== 0) return '$0.00';
  if (p >= 1) return `$${p.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  if (p >= 0.001) return `$${p.toFixed(4)}`;
  const s = p.toFixed(12);
  const m = s.match(/^0\.(0+)/);
  if (m && m[1].length >= 4) {
    const subs = ['₀','₁','₂','₃','₄','₅','₆','₇','₈','₉'];
    const sub  = m[1].length.toString().split('').map(d => subs[+d]).join('');
    const sig  = s.slice(2 + m[1].length).slice(0,4).replace(/0+$/,'');
    return `$0.0${sub}${sig}`;
  }
  return `$${p.toFixed(8).replace(/\.?0+$/,'')}`;
};

const fmtBig = (n) => {
  if (!n) return 'N/A';
  if (n >= 1e12) return `$${(n/1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n/1e6).toFixed(2)}M`;
  if (n >= 1e3)  return `$${(n/1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
};

const fmtPct = (n) => `${n >= 0 ? '+' : ''}${Number(n || 0).toFixed(2)}%`;

const timeAgo = (ts, t) => {
  const n = Number(ts);
  if (!n) return '';
  const diff = Math.max(0, Date.now() - n);
  const m = Math.floor(diff / 60000);
  if (m < 1)  return t('just_now');
  if (m < 60) return t('minutes_ago', { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('hours_ago', { count: h });
  return t('days_ago', { count: Math.floor(h / 24) });
};

// رابط خبر صالح: http/https فقط
const isValidUrl = (u) => {
  if (typeof u !== 'string') return false;
  const s = u.trim();
  return /^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]{2,}$/i.test(s);
};

// تنظيف نص الموجز من HTML والكيانات
const cleanSummary = (s) => {
  if (typeof s !== 'string') return '';
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
};

export default function AssetDetailsScreen() {
  const navigation   = useNavigation();
  const insets       = useSafeAreaInsets();
  const route        = useRoute();
  const { t }        = useTranslation();
  const primaryColor = useAppStore(s => s.primaryColor || '#6C63FF');
  const { asset }    = route.params || {};

  // التطبيق يعمل بالنمط الغامق فقط
  const C = {
    bg:      '#07070F',
    card:    '#111122',
    card2:   '#171730',
    text:    '#EEEEFF',
    muted:   '#7E7EAA',
    dim:     '#505070',
    border:  '#1E1E38',
    success: '#10B981', error: '#EF4444',
    primary: primaryColor,
  };


  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartData,  setChartData]  = useState([]);
  const [stats,      setStats]      = useState({ current:0, open:0, high:0, low:0, change:0 });
  const [news,       setNews]       = useState([]);
  const [profile,    setProfile]    = useState(null);
  const [timeframe,  setTimeframe]  = useState('30D');
  const [watchlist,  setWatchlist]  = useState([]);

  if (!asset) { navigation.goBack(); return null; }

  const livePrice  = asset.current_price || 0;
  const liveChange = asset.price_change_percentage_24h || 0;
  const up = (stats.change || liveChange) >= 0;

  useEffect(() => {
    AsyncStorage.getItem(WATCHLIST_KEY)
      .then(s => { if (s) setWatchlist(JSON.parse(s)); })
      .catch(() => {});
  }, []);

  const toggleWatch = async () => {
    const upd = watchlist.includes(asset.symbol)
      ? watchlist.filter(s => s !== asset.symbol)
      : [...watchlist, asset.symbol];
    setWatchlist(upd);
    await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(upd));
  };

  const fetchAll = useCallback(async (tf, isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [chartRes, newsRes, profileRes] = await Promise.all([
        getAssetChart(asset, tf),
        getAssetNews(asset, 5),
        asset.type === 'stock' ? getStockProfile(asset.id) : Promise.resolve(null),
      ]);

      setChartData(chartRes.data || []);
      setStats({
        current: livePrice || chartRes.stats?.current || 0,
        open:    chartRes.stats?.open  || 0,
        high:    chartRes.stats?.high  || asset.high || 0,
        low:     chartRes.stats?.low   || asset.low  || 0,
        change:  liveChange || chartRes.stats?.change || 0,
      });
      setNews((newsRes || []).filter(n => n && n.headline && isValidUrl(n.url)));
      setProfile(profileRes);
    } catch (e) {
      console.warn('[AssetDetails] fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [asset.id, timeframe, livePrice, liveChange]);

  useEffect(() => { fetchAll(timeframe); }, [timeframe]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll(timeframe, true);
  }, [timeframe, fetchAll]);

  const openUrl = async (url) => {
    if (!isValidUrl(url)) {
      Alert.alert(t('error'), t('invalid_link', 'الرابط غير صالح'));
      return;
    }
    try {
      await Linking.openURL(url.trim());
    } catch (e) {
      Alert.alert(t('error'), t('invalid_link', 'تعذّر فتح الرابط'));
    }
  };

  // ─── الرسم البياني ────────────────────────────────────────────────────────
  const chartH  = 180;
  const visible = chartData.slice(-60);
  const allH    = visible.map(d => d.high);
  const allL    = visible.map(d => d.low);
  const cMax    = allH.length ? Math.max(...allH) * 1.01 : 1;
  const cMin    = allL.length ? Math.min(...allL) * 0.99 : 0;
  const cRange  = cMax - cMin || 1;

  return (
    <SafeAreaView style={[S.root, { backgroundColor: C.bg, paddingTop: Platform.OS === 'ios' ? 0 : insets.top }]}>
      <ScrollView
        contentContainerStyle={[S.scroll, { paddingBottom: Math.max(insets.bottom, 20) + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={S.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}
            style={[S.iconBtn, { backgroundColor: C.card }]}>
            <Ionicons name="arrow-back" size={18} color={C.text} />
          </TouchableOpacity>

          <View style={S.assetHead}>
            {asset.image ? (
              <Image source={{ uri: asset.image }} style={S.assetImg} />
            ) : asset.emoji ? (
              <View style={[S.assetEmojiWrap, { backgroundColor: (asset.color || '#888') + '22' }]}>
                <Text style={{ fontSize: 18 }}>{asset.emoji}</Text>
              </View>
            ) : (
              <View style={[S.assetEmojiWrap, { backgroundColor: C.card2 }]}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>{asset.symbol?.charAt(0)}</Text>
              </View>
            )}
            <View style={{ alignItems: 'flex-start' }}>
              <Text style={[S.sym, { color: C.text }]}>{asset.symbol}</Text>
              <Text style={[S.nam, { color: C.muted }]} numberOfLines={1}>
                {asset.name}
              </Text>
            </View>
          </View>

          <TouchableOpacity onPress={toggleWatch}
            style={[S.iconBtn, { backgroundColor: C.card }]}>
            <Ionicons
              name={watchlist.includes(asset.symbol) ? 'star' : 'star-outline'}
              size={18}
              color={watchlist.includes(asset.symbol) ? '#FFB800' : C.text}
            />
          </TouchableOpacity>
        </View>

        {/* ── السعر ── */}
        <View style={S.hero}>
          <Text style={[S.priceLabel, { color: C.muted }]}>{t('current_price')}</Text>
          <View style={S.priceRow}>
            <Text style={[S.price, { color: C.text }]}>{fmtPrice(stats.current)}</Text>
            <View style={[S.changePill, { backgroundColor: up ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)' }]}>
              <Ionicons name={up ? 'trending-up' : 'trending-down'} size={12} color={up ? C.success : C.error} />
              <Text style={[S.changeTxt, { color: up ? C.success : C.error }]}>{fmtPct(stats.change)}</Text>
            </View>
          </View>
        </View>

        {/* ── التبويب الزمني ── */}
        <View style={S.card}>
          <View style={S.tfRow}>
            {TIMEFRAMES.map(lbl => (
              <TouchableOpacity
                key={lbl}
                style={[S.tfBtn, timeframe === lbl && { backgroundColor: C.primary }]}
                onPress={() => setTimeframe(lbl)}
              >
                <Text style={[S.tfTxt, { color: timeframe === lbl ? '#FFF' : C.muted }]}>{lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── الرسم البياني ── */}
        <View style={[S.card, { minHeight: 220 }]}>
          {loading ? (
            <View style={S.chartLoad}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={{ fontSize: 12, marginTop: 8, color: C.muted }}>{t('loading')}</Text>
            </View>
          ) : visible.length > 0 ? (
            <View style={[S.chartArea, { height: chartH }]}>
              {visible.map((pt, i) => {
                const green = pt.close >= pt.open;
                const color = green ? C.success : C.error;
                const bTop  = chartH - ((Math.max(pt.open, pt.close) - cMin) / cRange) * chartH;
                const bH    = Math.max(((Math.abs(pt.close - pt.open)) / cRange) * chartH, 2);
                const wTop  = chartH - ((pt.high - cMin) / cRange) * chartH;
                const wH    = ((pt.high - pt.low) / cRange) * chartH;
                return (
                  <View key={i} style={S.candle}>
                    <View style={[S.wick, { top: wTop, height: Math.max(wH, 1), backgroundColor: color, opacity: 0.3 }]} />
                    <View style={[S.body, { top: bTop, height: bH, backgroundColor: color }]} />
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={S.chartLoad}>
              <ActivityIndicator color={C.primary} />
            </View>
          )}
        </View>

        {/* ── OHLC ── */}
        <View style={S.card}>
          <Text style={[S.secTitle, { color: C.text }]}>{t('ohlc_stats')}</Text>
          <View style={S.grid}>
            {[
              { k: 'ohlc_open',  v: fmtPrice(stats.open),    c: C.text    },
              { k: 'ohlc_high',  v: fmtPrice(stats.high),    c: C.success },
              { k: 'ohlc_low',   v: fmtPrice(stats.low),     c: C.error   },
              { k: 'ohlc_close', v: fmtPrice(stats.current), c: C.text    },
            ].map(item => (
              <View key={item.k} style={[S.gridItem, { backgroundColor: C.card }]}>
                <Text style={[S.gridLabel, { color: C.muted }]}>{t(item.k)}</Text>
                <Text style={[S.gridValue, { color: item.c }]}>{item.v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── إحصائيات إضافية للأسهم ── */}
        {asset.type === 'stock' && profile && (
          <View style={S.card}>
            <Text style={[S.secTitle, { color: C.text }]}>{t('market_stats')}</Text>
            <View style={S.grid}>
              {[
                { k: 'market_cap', v: fmtBig(profile.marketCap) },
                { k: 'industry',   v: profile.industry || '—' },
                { k: 'exchange',   v: profile.exchange || '—' },
                { k: 'country',    v: profile.country  || '—' },
              ].map(item => (
                <View key={item.k} style={[S.gridItem, { backgroundColor: C.card }]}>
                  <Text style={[S.gridLabel, { color: C.muted }]}>{t(item.k, item.k)}</Text>
                  <Text style={[S.gridValue, { color: C.text }]} numberOfLines={1}>{item.v}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── الأخبار ── */}
        {news.length > 0 && (
          <View style={S.card}>
            <View style={S.newsHeader}>
              <Ionicons name="newspaper-outline" size={16} color={C.primary} />
              <Text style={[S.secTitle, { color: C.text, marginBottom: 0 }]}>
                {t('latest_news')}
              </Text>
            </View>
            <View style={{ marginTop: 12, gap: 8 }}>
              {news.map((n, i) => (
                <TouchableOpacity
                  key={n.id || i}
                  style={[S.newsItem, { backgroundColor: C.card }]}
                  onPress={() => openUrl(n.url)}
                  activeOpacity={0.7}
                >
                  {n.image ? (
                    <Image source={{ uri: n.image }} style={S.newsImg} />
                  ) : (
                    <View style={[S.newsImg, { backgroundColor: C.card2, justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="newspaper-outline" size={20} color={C.dim} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[S.newsHeadline, { color: C.text }]} numberOfLines={2}>
                      {n.headline}
                    </Text>
                    {(() => {
                      const sm = cleanSummary(n.summary);
                      if (!sm || sm.toLowerCase() === cleanSummary(n.headline).toLowerCase()) return null;
                      return (
                        <Text style={[S.newsSummary, { color: C.muted }]} numberOfLines={3}>{sm}</Text>
                      );
                    })()}
                    <View style={S.newsMeta}>
                      <Text style={[S.newsSource, { color: C.muted }]} numberOfLines={1}>
                        {n.source}
                      </Text>
                      <Text style={[S.newsTime, { color: C.dim }]}>
                        {timeAgo(n.datetime, t)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── الوصف (للأسهم فقط) ── */}
        {asset.type === 'stock' && profile && (
          <View style={S.card}>
            <Text style={[S.secTitle, { color: C.text }]}>{t('about_token')}</Text>
            <Text style={[S.desc, { color: C.muted }]}>
              {profile.name} {profile.industry ? `— ${profile.industry}` : ''}
              {profile.country ? ` • ${profile.country}` : ''}
              {profile.ipo ? ` • IPO: ${profile.ipo}` : ''}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { padding: 20, paddingBottom: 60 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  assetHead: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  assetImg: { width: 34, height: 34, borderRadius: 17 },
  assetEmojiWrap: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  sym: { fontSize: 16, fontWeight: '800' },
  nam: { fontSize: 11, marginTop: 1 },

  card: { marginBottom: 22 },
  hero: { marginBottom: 18, paddingTop: 4 },

  priceLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  priceRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price:      { fontSize: 38, fontWeight: '800', letterSpacing: -0.5 },
  changePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 4 },
  changeTxt:  { fontSize: 12, fontWeight: '700' },

  secTitle: { fontSize: 20, fontWeight: '800', marginBottom: 12 },

  tfRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  tfBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 999, marginHorizontal: 2 },
  tfTxt: { fontSize: 12, fontWeight: '700' },

  chartArea: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, overflow: 'hidden' },
  chartLoad: { alignItems: 'center', justifyContent: 'center', height: 180, gap: 8 },
  candle:    { flex: 1, height: '100%', alignItems: 'center' },
  wick:      { position: 'absolute', width: 1 },
  body:      { position: 'absolute', width: '55%', borderRadius: 1 },

  grid:      { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  gridItem:  { width: '48%', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16 },
  gridLabel: { fontSize: 11, marginBottom: 4 },
  gridValue: { fontSize: 14, fontWeight: '700' },

  newsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  newsItem:   { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 16 },
  newsImg:    { width: 64, height: 64, borderRadius: 12 },
  newsSummary:{ fontSize: 12, lineHeight: 17, marginTop: 4 },
  newsHeadline: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  newsMeta:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, gap: 8 },
  newsSource: { fontSize: 11, flex: 1 },
  newsTime:   { fontSize: 11 },

  desc: { fontSize: 13, lineHeight: 18 },
});
