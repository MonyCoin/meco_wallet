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
import DirIcon from '../components/DirIcon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAssetChart,
} from '../services/assetChartService';
import { getCoinInfo } from '../services/coinInfoService';
import { WRAPPED_BY_COINGECKO_ID, GUARDED_TOKENS } from '../services/guardedTokens';

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

const fmtPct = (n) => `${n >= 0 ? '+' : ''}${Number(n || 0).toFixed(2)}%`;

// رابط صالح: http/https فقط
const isValidUrl = (u) => {
  if (typeof u !== 'string') return false;
  const s = u.trim();
  return /^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]{2,}$/i.test(s);
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
    bg:      '#000000',
    card:    '#141414',
    card2:   '#1E1E1E',
    text:    '#F2F2F2',
    muted:   '#8A8A8E',
    dim:     '#5A5A5E',
    border:  '#262626',
    success: '#10B981', error: '#EF4444',
    primary: primaryColor,
  };


  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartData,  setChartData]  = useState([]);
  const [stats,      setStats]      = useState({ current:0, open:0, high:0, low:0, change:0 });
  const [coinInfo,   setCoinInfo]   = useState(null);
  const isCrypto = asset?.type === 'external_crypto';
  const [timeframe,  setTimeframe]  = useState('30D');
  const [watchlist,  setWatchlist]  = useState([]);

  if (!asset) { navigation.goBack(); return null; }

  const wrappedList = WRAPPED_BY_COINGECKO_ID[asset.coingeckoId || asset.id] || [];

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
      const chartRes = await getAssetChart(asset, tf);

      setChartData(chartRes.data || []);
      setStats({
        current: livePrice || chartRes.stats?.current || 0,
        open:    chartRes.stats?.open  || 0,
        high:    chartRes.stats?.high  || asset.high || 0,
        low:     chartRes.stats?.low   || asset.low  || 0,
        change:  liveChange || chartRes.stats?.change || 0,
      });
    } catch (e) {
      console.warn('[AssetDetails] fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [asset.id, timeframe, livePrice, liveChange]);

  useEffect(() => { fetchAll(timeframe); }, [timeframe]);

  useEffect(() => {
    if (!isCrypto) return;
    let alive = true;
    getCoinInfo(asset.coingeckoId || asset.id).then(d => { if (alive) setCoinInfo(d); });
    return () => { alive = false; };
  }, [asset.id]);

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
            <DirIcon name="arrow-back" size={18} color={C.text} />
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

        {/* ── التداول على سولانا (نسخة مغلّفة موثّقة) ── */}
        {wrappedList.length > 0 && (
          <View style={[S.tradeCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={S.tradeHead}>
              <Text style={[S.tradeTitle, { color: C.text }]}>{t('wrapped_trade_title')}</Text>
              <View style={[S.tradeBadge, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                <Text style={[S.tradeBadgeTxt, { color: C.success }]}>{t('wrapped_badge')}</Text>
              </View>
            </View>
            {!wrappedList.every(sym => GUARDED_TOKENS.find(g => g.symbol === sym)?.native) && (
              <Text style={[S.tradeNote, { color: C.muted }]}>
                {t('wrapped_trade_note', { coin: asset.symbol })}
              </Text>
            )}
            {wrappedList.map(sym => (
              <TouchableOpacity
                key={sym}
                style={[S.tradeBtn, { backgroundColor: C.primary }]}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('Swap', { toToken: sym })}
              >
                <Text style={S.tradeBtnTxt} numberOfLines={1}>
                  {t('wrapped_trade_btn')} · {t('wrapped_trade_label', { coin: asset.symbol, wrapped: sym })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

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
        <View style={[S.card, { minHeight: 200 }]}>
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
              <View key={item.k} style={S.gridItem}>
                <Text style={[S.gridLabel, { color: C.muted }]}>{t(item.k)}</Text>
                <Text style={[S.gridValue, { color: item.c }]}>{item.v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── معلومات العملة الرقمية ── */}
        {isCrypto && coinInfo && (coinInfo.description || coinInfo.website || coinInfo.twitter || coinInfo.telegram || coinInfo.reddit) && (
          <View style={S.card}>
            <Text style={[S.secTitle, { color: C.text }]}>{t('coin_info_title')}</Text>
            {coinInfo.categories.length > 0 && (
              <View style={S.catRow}>
                {coinInfo.categories.map(c => (
                  <View key={c} style={[S.catChip, { backgroundColor: C.card2 }]}>
                    <Text style={[S.catTxt, { color: C.muted }]} numberOfLines={1}>{c}</Text>
                  </View>
                ))}
              </View>
            )}
            {!!coinInfo.description && (
              <Text style={[S.desc, { color: C.muted }]}>{coinInfo.description}</Text>
            )}
            <View style={S.linkRow}>
              {[
                { u: coinInfo.website,  icon: 'globe-outline',     k: 'coin_link_website'  },
                { u: coinInfo.twitter,  icon: 'logo-twitter',      k: 'coin_link_x'        },
                { u: coinInfo.telegram, icon: 'paper-plane-outline', k: 'coin_link_telegram' },
                { u: coinInfo.reddit,   icon: 'logo-reddit',       k: 'coin_link_reddit'   },
              ].filter(l => l.u).map(l => (
                <TouchableOpacity key={l.k} style={[S.linkBtn, { backgroundColor: C.card }]} activeOpacity={0.7} onPress={() => openUrl(l.u)}>
                  <Ionicons name={l.icon} size={14} color={C.primary} />
                  <Text style={[S.linkTxt, { color: C.text }]}>{t(l.k)}</Text>
                </TouchableOpacity>
              ))}
            </View>
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
    justifyContent: 'space-between', marginBottom: 12,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  assetHead: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  assetImg: { width: 34, height: 34, borderRadius: 17 },
  assetEmojiWrap: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  sym: { fontSize: 16, fontWeight: '800' },
  nam: { fontSize: 11, marginTop: 1 },

  card: { marginBottom: 16 },
  hero: { marginBottom: 12, paddingTop: 2 },

  priceLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  priceRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price:      { fontSize: 28, fontWeight: '800', letterSpacing: -0.3 },
  changePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 3 },
  changeTxt:  { fontSize: 11, fontWeight: '700' },

  tradeCard:  { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 16 },
  tradeHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  tradeTitle: { fontSize: 14, fontWeight: '700' },
  tradeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tradeBadgeTxt: { fontSize: 11, fontWeight: '700' },
  tradeNote:  { fontSize: 12, lineHeight: 18, marginBottom: 10 },
  tradeBtn:   { paddingVertical: 11, borderRadius: 12, alignItems: 'center', marginTop: 6 },
  tradeBtnTxt:{ color: '#FFF', fontSize: 13, fontWeight: '700' },

  secTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },

  tfRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  tfBtn: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 999, marginHorizontal: 2 },
  tfTxt: { fontSize: 12, fontWeight: '700' },

  chartArea: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, overflow: 'hidden' },
  chartLoad: { alignItems: 'center', justifyContent: 'center', height: 180, gap: 8 },
  candle:    { flex: 1, height: '100%', alignItems: 'center' },
  wick:      { position: 'absolute', width: 1 },
  body:      { position: 'absolute', width: '55%', borderRadius: 1 },

  grid:      { },
  gridItem:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#262626' },
  gridLabel: { fontSize: 13 },
  gridValue: { fontSize: 13, fontWeight: '700' },


  desc: { fontSize: 13, lineHeight: 19 },
  catRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  catChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  catTxt:  { fontSize: 11, fontWeight: '600' },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#262626' },
  linkTxt: { fontSize: 12, fontWeight: '600' },
});
