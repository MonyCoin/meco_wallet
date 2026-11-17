// screens/GlobalCoinsScreen.js
// شاشة "الأسواق العالمية": أكبر 100 عملة رقمية، بطلب واحد من CoinGecko.
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Image,
  FlatList, RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store';
import DirIcon from '../components/DirIcon';
import { getGlobalMarketData } from '../services/marketOverviewService';
import { WRAPPED_BY_COINGECKO_ID } from '../services/guardedTokens';
import { CORE_TOKENS } from '../services/jupiterMarketService';

// عملات سولانا الأساسية القابلة للتداول (معرّف CoinGecko) — تُعامل كالعملات المغلّفة في الشارة
const CORE_TRADABLE_IDS = new Set(CORE_TOKENS.filter(tk => tk.swapAvailable && !tk.guarded).map(tk => tk.id));
import { fetchCoinsMarkets, getCachedCoins, getCachedAt } from '../services/globalCoinsService';

const PAGE_SIZE = 15;

// الفئات (المعرّفات الرسمية في CoinGecko)
const CATEGORIES = [
  { id: 'all',                         k: 'cat_all' },
  { id: 'meme-token',                  k: 'cat_meme' },
  { id: 'layer-1',                     k: 'cat_l1' },
  { id: 'decentralized-finance-defi',  k: 'cat_defi' },
  { id: 'artificial-intelligence',     k: 'cat_ai' },
  { id: 'stablecoins',                 k: 'cat_stable' },
  { id: 'gaming',                      k: 'cat_gaming' },
  { id: 'privacy',                     k: 'cat_privacy' },
  { id: 'real-world-assets-rwa',       k: 'cat_rwa' },
  { id: 'layer-2',                     k: 'cat_l2' },
];

const C = {
  bg: '#000000', card: '#141414', card2: '#1E1E1E',
  text: '#F2F2F2', muted: '#8A8A8E', border: '#262626',
  success: '#10B981', error: '#EF4444',
};

const fmtPrice = (p) => {
  if (!p) return '$0.00';
  if (p >= 1) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (p >= 0.001) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(8).replace(/\.?0+$/, '')}`;
};
const fmtPct = (n) => `${n >= 0 ? '+' : ''}${Number(n || 0).toFixed(2)}%`;

const isStable = (c) => c.current_price > 0.97 && c.current_price < 1.03 && Math.abs(c.price_change_percentage_24h) < 1;

const CoinLogo = ({ uri, symbol, size }) => {
  const [failed, setFailed] = useState(false);
  if (failed || !uri) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.card2, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: size * 0.42, fontWeight: '800', color: C.muted }}>{symbol?.charAt(0) || '?'}</Text>
      </View>
    );
  }
  return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} onError={() => setFailed(true)} />;
};

const MoverCard = React.memo(({ coin, onPress }) => {
  const up = coin.price_change_percentage_24h >= 0;
  return (
    <TouchableOpacity style={[S.moverCard, { backgroundColor: C.card }]} activeOpacity={0.75} onPress={() => onPress(coin)}>
      <CoinLogo uri={coin.image} symbol={coin.symbol} size={30} />
      <Text style={[S.moverSym, { color: C.text }]} numberOfLines={1}>{coin.symbol}</Text>
      <Text style={[S.moverPct, { color: up ? C.success : C.error }]}>{fmtPct(coin.price_change_percentage_24h)}</Text>
    </TouchableOpacity>
  );
});

const CoinRow = React.memo(({ coin, onPress, t }) => {
  const up = coin.price_change_percentage_24h >= 0;
  const tradable = !!WRAPPED_BY_COINGECKO_ID[coin.id] || CORE_TRADABLE_IDS.has(coin.id);
  return (
    <TouchableOpacity style={S.row} activeOpacity={0.7} onPress={() => onPress(coin)}>
      <Text style={[S.rank, { color: C.muted }]}>{coin.rank || ''}</Text>
      <CoinLogo uri={coin.image} symbol={coin.symbol} size={36} />
      <View style={S.rowInfo}>
        <Text style={[S.rowSym, { color: C.text }]} numberOfLines={1}>{coin.symbol}</Text>
        <View style={S.rowSubLine}>
          <Text style={[S.rowName, { color: C.muted }]} numberOfLines={1}>{coin.name}</Text>
          {tradable && (
            <View style={S.tradableBadge}>
              <Text style={S.tradableTxt}>{t('wrapped_badge')}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={S.rowEnd}>
        <Text style={[S.rowPrice, { color: C.text }]}>{fmtPrice(coin.current_price)}</Text>
        <Text style={[S.rowPct, { color: up ? C.success : C.error }]}>{fmtPct(coin.price_change_percentage_24h)}</Text>
      </View>
    </TouchableOpacity>
  );
});

export default function GlobalCoinsScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const insets     = useSafeAreaInsets();
  const { t }      = useTranslation();
  const primary    = useAppStore(s => s.primaryColor || '#6C63FF');

  const [coins,      setCoins]      = useState([]);
  const [overview,   setOverview]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(false);
  const [query,      setQuery]      = useState('');
  const [cat,        setCat]        = useState(route.params?.category || 'all');
  const [visible,    setVisible]    = useState(PAGE_SIZE);
  const [topCoins,   setTopCoins]   = useState([]);
  const [updatedAt,  setUpdatedAt]  = useState(null);
  const mounted = useRef(true);
  const catRef  = useRef(route.params?.category || 'all');   // الفئة الحالية — لتجاهل ردود الفئات السابقة المتأخرة

  const load = useCallback(async (force = false, category = 'all') => {
    try {
      const rows = await fetchCoinsMarkets(category, 150, force);
      if (!mounted.current || catRef.current !== category) return;
      setCoins(rows);
      if (category === 'all') setTopCoins(rows);
      setUpdatedAt(getCachedAt(category, 150) || new Date());
      setError(false);
    } catch (_) {
      if (mounted.current && catRef.current === category) { setError(true); if (!getCachedCoins(category, 150)) setCoins([]); }
    }
    if (category === 'all') {
      try {
        const ov = await getGlobalMarketData();
        if (mounted.current) setOverview(ov);
      } catch (_) {}
    }
    if (mounted.current && catRef.current === category) { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    catRef.current = cat;
    setVisible(PAGE_SIZE);
    setError(false);
    const cached = getCachedCoins(cat, 150);
    if (cached) { setCoins(cached); } else { setCoins([]); setLoading(true); }   // لا تُعرض أبداً عملات فئة أخرى
    load(false, cat);
  }, [cat, load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(true, cat); }, [load, cat]);

  const openCoin = useCallback((coin) => {
    navigation.navigate('AssetDetails', { asset: coin });
  }, [navigation]);

  const { gainers, losers } = useMemo(() => {
    const pool = topCoins.slice(0, 100).filter(c => !isStable(c));
    const sorted = [...pool].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
    return { gainers: sorted.slice(0, 3), losers: sorted.slice(-3).reverse() };
  }, [topCoins]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return coins;
    return coins.filter(c => c.symbol.toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q));
  }, [coins, query]);

  const shown = useMemo(
    () => (query.trim() ? filtered : filtered.slice(0, visible)),
    [filtered, visible, query],
  );
  const hasMore = !query.trim() && filtered.length > visible;

  const up = (overview?.marketCapChange24h || 0) >= 0;
  const searching = query.trim().length > 0;

  const Header = (
    <View>
      <View style={S.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[S.backBtn, { backgroundColor: C.card }]}>
          <DirIcon name="arrow-back" size={18} color={C.text} />
        </TouchableOpacity>
        <View style={S.titleWrap}>
          <Text style={[S.title, { color: C.text }]}>{t('gc_title')}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={[S.searchBox, { backgroundColor: C.card }]}>
        <Ionicons name="search" size={16} color={C.muted} />
        <TextInput
          style={[S.searchInput, { color: C.text }]}
          value={query}
          onChangeText={setQuery}
          placeholder={t('gc_search')}
          placeholderTextColor={C.muted}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searching && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={C.muted} />
          </TouchableOpacity>
        )}
      </View>

      {!searching && cat === 'all' && topCoins.length > 0 && (
        <>
          <View style={[S.overview, { backgroundColor: C.card }]}>
            <View style={S.overviewRow}>
              {[
                { k: 'market_cap_label', v: overview?.totalMarketCapFormatted || 'N/A' },
                { k: 'market_volume',    v: overview?.totalVolume24hFormatted || 'N/A' },
                { k: 'btc_dominance',    v: `${overview?.btcDominance?.toFixed(1) || '0'}%` },
              ].map(item => (
                <View key={item.k} style={S.overviewItem}>
                  <Text style={[S.overviewLabel, { color: C.muted }]}>{t(item.k)}</Text>
                  <Text style={[S.overviewValue, { color: C.text }]}>{item.v}</Text>
                </View>
              ))}
            </View>
            <View style={[S.overviewBar, { backgroundColor: up ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)' }]}>
              <Ionicons name={up ? 'trending-up' : 'trending-down'} size={13} color={up ? C.success : C.error} />
              <Text style={[S.overviewBarTxt, { color: up ? C.success : C.error }]}>
                {overview?.marketCapChangeFormatted || '0%'} {t('time_24h')}
              </Text>
            </View>
          </View>

          <Text style={[S.section, { color: C.text }]}>{t('gc_top_gainers')}</Text>
          <View style={S.moverRow}>
            {gainers.map(c => <MoverCard key={c.id} coin={c} onPress={openCoin} />)}
          </View>

          <Text style={[S.section, { color: C.text }]}>{t('gc_top_losers')}</Text>
          <View style={S.moverRow}>
            {losers.map(c => <MoverCard key={c.id} coin={c} onPress={openCoin} />)}
          </View>
        </>
      )}

      <FlatList
        data={CATEGORIES}
        keyExtractor={c => c.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 16, marginHorizontal: -16 }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        renderItem={({ item }) => {
          const on = item.id === cat;
          return (
            <TouchableOpacity
              style={[S.chip, { backgroundColor: on ? primary : C.card }]}
              activeOpacity={0.8}
              onPress={() => setCat(item.id)}
            >
              <Text style={[S.chipTxt, { color: on ? '#FFF' : C.muted }]}>{t(item.k)}</Text>
            </TouchableOpacity>
          );
        }}
      />
      {coins.length > 0 && <Text style={[S.section, { color: C.text }]}>{t('gc_all')}</Text>}
    </View>
  );

  const Footer = coins.length > 0 ? (
    <View style={S.footer}>
      {hasMore && (
        <TouchableOpacity style={S.moreBtn} activeOpacity={0.7} onPress={() => setVisible(v => v + PAGE_SIZE)}>
          <Text style={[S.moreTxt, { color: primary }]}>{t('global_more_title')}</Text>
          <Ionicons name="chevron-down" size={14} color={primary} />
        </TouchableOpacity>
      )}
      <Text style={[S.footerTxt, { color: C.muted }]}>
        {t('gc_source', { time: updatedAt ? updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '' })}
      </Text>
      <Text style={[S.footerTxt, { color: C.muted }]}>{t('gc_disclaimer')}</Text>
    </View>
  ) : null;

  return (
    <View style={[S.root, { backgroundColor: C.bg, paddingTop: Platform.OS === 'ios' ? insets.top : insets.top }]}>
      {true && (
        <FlatList
          data={shown}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <CoinRow coin={item} onPress={openCoin} t={t} />}
          ListHeaderComponent={Header}
          ListFooterComponent={Footer}
          ListEmptyComponent={
            <View style={S.center}>
              {loading ? (
                <ActivityIndicator size="large" color={primary} />
              ) : (
                <Text style={{ color: C.muted, fontSize: 13, textAlign: 'center', paddingHorizontal: 30 }}>
                  {error ? t('gc_error') : t('no_results')}
                </Text>
              )}
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 20) + 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          initialNumToRender={14}
          windowSize={8}
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },

  topBar:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, marginBottom: 14 },
  backBtn:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  titleWrap:{ flex: 1, alignItems: 'center' },
  title:    { fontSize: 17, fontWeight: '800' },

  searchBox:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 12, height: 42, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },

  overview:       { borderRadius: 16, padding: 14, marginBottom: 6 },
  overviewRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  overviewItem:   { flex: 1, alignItems: 'center' },
  overviewLabel:  { fontSize: 11, marginBottom: 4 },
  overviewValue:  { fontSize: 14, fontWeight: '800' },
  overviewBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, paddingVertical: 6, marginTop: 12 },
  overviewBarTxt: { fontSize: 12, fontWeight: '700' },

  section: { fontSize: 15, fontWeight: '800', marginTop: 18, marginBottom: 10 },

  moverRow:  { flexDirection: 'row', gap: 10 },
  moverCard: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', gap: 6 },
  moverSym:  { fontSize: 13, fontWeight: '800' },
  moverPct:  { fontSize: 12, fontWeight: '700' },

  row:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  rank:       { width: 22, fontSize: 12, textAlign: 'center' },
  rowInfo:    { flex: 1 },
  rowSym:     { fontSize: 14, fontWeight: '800' },
  rowSubLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  rowName:    { fontSize: 11, flexShrink: 1 },
  tradableBadge: { backgroundColor: 'rgba(16,185,129,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tradableTxt:   { color: C.success, fontSize: 10, fontWeight: '700' },
  rowEnd:     { alignItems: 'flex-end' },
  rowPrice:   { fontSize: 14, fontWeight: '700' },
  rowPct:     { fontSize: 12, fontWeight: '700', marginTop: 2 },

  chip:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  chipTxt: { fontSize: 12, fontWeight: '700' },
  moreBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, marginBottom: 6 },
  moreTxt: { fontSize: 13, fontWeight: '700' },

  footer:    { alignItems: 'center', gap: 4, paddingTop: 20 },
  footerTxt: { fontSize: 11, textAlign: 'center' },
});
