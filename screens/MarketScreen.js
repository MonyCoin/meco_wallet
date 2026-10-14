// screens/MarketScreen.js
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, RefreshControl, ActivityIndicator,
  TextInput, Modal, Alert, Platform, FlatList, Animated, Easing,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getJupiterMarketData, CORE_TOKENS,
  fetchCustomTokenByMint, saveCustomToken, deleteCustomToken,
} from '../services/jupiterMarketService';
import { getGlobalMarketData, getTopMovers } from '../services/marketOverviewService';
import { getCommodities, getUSStocks, getForexRates } from '../services/marketDataService';

const WATCHLIST_KEY = '@meco_watchlist';
const REFRESH_MS    = 60000;

const { width } = require('react-native').Dimensions.get('window');

const EXT_CARD_PADDING = 20;
const EXT_CARD_GAP     = 20;
const EXT_CARD_WIDTH   = (width - EXT_CARD_PADDING * 2 - EXT_CARD_GAP) / 2;

// ✅ شريط الفوركس — حركة دائمة بلا توقف، وسلوك موحّد في اللغتين
const TICKER_ITEM_WIDTH       = 160;
const TICKER_SPEED_PX_PER_SEC = 55;

const EXTERNAL_TOKENS = [
  { id:'bitcoin',    symbol:'BTC',  name:'Bitcoin',  image:'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',                           coingeckoId:'bitcoin',    mint:'external:bitcoin',    swapAvailable:false },
  { id:'ethereum',   symbol:'ETH',  name:'Ethereum', image:'https://assets.coingecko.com/coins/images/279/large/ethereum.png',                        coingeckoId:'ethereum',   mint:'external:ethereum',   swapAvailable:false },
  { id:'binancecoin',symbol:'BNB',  name:'BNB',      image:'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',                    coingeckoId:'binancecoin',mint:'external:binancecoin',swapAvailable:false },
  { id:'ripple',     symbol:'XRP',  name:'XRP',      image:'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png',              coingeckoId:'ripple',     mint:'external:ripple',     swapAvailable:false },
  { id:'cardano',    symbol:'ADA',  name:'Cardano',  image:'https://assets.coingecko.com/coins/images/975/large/cardano.png',                          coingeckoId:'cardano',    mint:'external:cardano',    swapAvailable:false },
  { id:'avalanche-2',symbol:'AVAX', name:'Avalanche',image:'https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png',coingeckoId:'avalanche-2',mint:'external:avax',       swapAvailable:false },
  { id:'dogecoin',   symbol:'DOGE', name:'Dogecoin', image:'https://assets.coingecko.com/coins/images/5/large/dogecoin.png',                           coingeckoId:'dogecoin',   mint:'external:dogecoin',   swapAvailable:false },
  { id:'tron',       symbol:'TRX',  name:'TRON',     image:'https://assets.coingecko.com/coins/images/1094/large/photo_2026-04-13_09-59-16.png',       coingeckoId:'tron',       mint:'external:tron',       swapAvailable:false },
  { id:'chainlink',  symbol:'LINK', name:'Chainlink',image:'https://assets.coingecko.com/coins/images/877/large/Chainlink_Logo_500.png',               coingeckoId:'chainlink',  mint:'external:chainlink',  swapAvailable:false },
  { id:'polkadot',   symbol:'DOT',  name:'Polkadot', image:'https://assets.coingecko.com/coins/images/12171/large/polkadot.jpg',                       coingeckoId:'polkadot',   mint:'external:polkadot',   swapAvailable:false },
];

const fmtPrice = (p) => {
  if (!p) return '$0.00';
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
  if (!n) return '$0';
  if (n>=1e12) return `$${(n/1e12).toFixed(2)}T`;
  if (n>=1e9)  return `$${(n/1e9).toFixed(2)}B`;
  if (n>=1e6)  return `$${(n/1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
};

// ─── شريط الفوركس المتحرك — حركة دائمة، لا يتوقف، سلوك ثابت في كل اللغات ───
const ForexTicker = ({ data, isDark }) => {
  const { i18n } = useTranslation();
  const language = i18n.language;

  const C = {
    text: isDark?'#EEEEFF':'#1C1C24',
    muted: isDark?'#7E7EAA':'#8A8A9E',
    success:'#10B981', error:'#EF4444',
    sep: 'rgba(128,128,128,0.3)',
  };

  const scrollX = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);

  const dataLength = data?.length || 0;
  const totalWidth = dataLength * TICKER_ITEM_WIDTH;
  const fullDuration = totalWidth > 0
    ? (totalWidth / TICKER_SPEED_PX_PER_SEC) * 1000
    : 0;

  // إعادة بناء اللوب بالكامل عند تغيّر اللغة أو البيانات
  // → القيمة تُصفّر وتنطلق الدورة من جديد، فلا قفزات ولا فجوات
  useEffect(() => {
    if (!dataLength || fullDuration <= 0) return;

    animRef.current?.stop();
    scrollX.setValue(0);

    animRef.current = Animated.loop(
      Animated.timing(scrollX, {
        toValue: 1,
        duration: fullDuration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animRef.current.start();

    return () => animRef.current?.stop();
  }, [dataLength, fullDuration, language, scrollX]);

  if (!dataLength) return null;

  const translateX = scrollX.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, -totalWidth],
  });

  // نسخ متعددة لضمان لوب متصل بلا فجوات
  const loopData = [...data, ...data, ...data, ...data, ...data, ...data];

  return (
    <View style={S.tickerWrap}>
      <Animated.View style={[S.tickerRow, { transform: [{ translateX }] }]}>
        {loopData.map((item, i) => {
          const up = (item.price_change_percentage_24h || 0) >= 0;
          const digits = item.digits ?? 4;
          return (
            <View key={`${item.id}-${i}`} style={S.tickerItem}>
              <Text style={[S.tickerPair, { color: C.muted }]} numberOfLines={1}>
                {item.symbol}
              </Text>
              <Text style={[S.tickerPrice, { color: C.text }]} numberOfLines={1}>
                {Number(item.current_price || 0).toFixed(digits)}
              </Text>
              <Text style={[S.tickerChg, { color: up ? C.success : C.error }]}>
                {up ? '▲' : '▼'} {Math.abs(item.price_change_percentage_24h || 0).toFixed(2)}%
              </Text>
              <View style={[S.tickerSep, { backgroundColor: C.sep }]} />
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
};

const MarketOverviewCard = React.memo(({ data, isDark, primaryColor }) => {
  const { t } = useTranslation();
  const C = {
    text: isDark?'#EEEEFF':'#1C1C24',
    muted: isDark?'#7E7EAA':'#8A8A9E',
    success:'#10B981', error:'#EF4444',
    border: isDark?'#1E1E38':'#E8E8F2',
    card: isDark?'#111122':'#FFFFFF',
  };
  const up = (data?.marketCapChange24h || 0) >= 0;
  return (
    <View style={[S.overviewCard, { backgroundColor:C.card, borderColor:C.border }]}>
      <View style={S.overviewRow}>
        {[
          { k:'market_cap_label', v: data?.totalMarketCapFormatted || 'N/A' },
          { k:'market_volume',    v: data?.totalVolume24hFormatted  || 'N/A' },
          { k:'btc_dominance',    v: `${data?.btcDominance?.toFixed(1)||'0'}%` },
        ].map((item, i) => (
          <View key={item.k} style={[S.overviewItem, i===1 && { borderLeftWidth:1, borderRightWidth:1, borderColor:C.border }]}>
            <Text style={[S.overviewLabel, { color:C.muted }]}>{t(item.k)}</Text>
            <Text style={[S.overviewValue, { color:C.text }]}>{item.v}</Text>
          </View>
        ))}
      </View>
      <View style={[S.overviewBar, { backgroundColor: up?'rgba(16,185,129,0.08)':'rgba(239,68,68,0.08)' }]}>
        <Ionicons name={up?'trending-up':'trending-down'} size={13} color={up?C.success:C.error} />
        <Text style={[S.overviewBarTxt, { color: up?C.success:C.error }]}>
          {data?.marketCapChangeFormatted||'0%'} {t('time_24h')}
        </Text>
      </View>
    </View>
  );
});

const TokenIconImg = ({ uri, size, symbol, bg, color }) => {
  const [failed, setFailed] = useState(false);
  if (failed || !uri) {
    return (
      <View style={{
        width:size, height:size, borderRadius:size/2,
        backgroundColor:bg||'rgba(128,128,128,0.15)',
        justifyContent:'center', alignItems:'center',
      }}>
        <Text style={{ fontSize:size*0.42, fontWeight:'bold', color:color||'#888' }}>
          {symbol?.charAt(0) || '?'}
        </Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={{ width:size, height:size, borderRadius:size/2 }}
      onError={() => setFailed(true)}
    />
  );
};

const TokenListItem = React.memo(({ token, onPress, onLongPress, isDark, primaryColor }) => {
  const C = {
    text: isDark?'#EEEEFF':'#1C1C24',
    muted: isDark?'#7E7EAA':'#8A8A9E',
    success:'#10B981', error:'#EF4444',
    border: isDark?'#1E1E38':'#E8E8F2',
    iconBg: isDark?'#171730':'#ECECF4',
  };
  const up = (token.price_change_percentage_24h || 0) >= 0;
  return (
    <TouchableOpacity
      style={[S.tokenRow, { borderBottomColor:C.border }]}
      onPress={() => onPress(token)}
      onLongPress={() => onLongPress(token)}
      activeOpacity={0.7}
    >
      <View style={S.tokenLeft}>
        <View style={[S.tokenIcon, { backgroundColor:C.iconBg }]}>
          <TokenIconImg uri={token.image} size={36} symbol={token.symbol} bg={C.iconBg} color={primaryColor} />
        </View>
        <View>
          <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
            <Text style={[S.tokenSym, { color:C.text }]}>{token.symbol}</Text>
            {token.isCustom && (
              <View style={[S.customBadge, { backgroundColor:primaryColor+'18' }]}>
                <Text style={[S.customBadgeTxt, { color:primaryColor }]}>+</Text>
              </View>
            )}
          </View>
          <Text style={[S.tokenName, { color:C.muted }]} numberOfLines={1}>{token.name}</Text>
        </View>
      </View>
      <View style={S.tokenRight}>
        <Text style={[S.tokenPrice, { color:C.text }]}>{fmtPrice(token.current_price)}</Text>
        <View style={S.pctRow}>
          <Ionicons name={up?'caret-up':'caret-down'} size={8} color={up?C.success:C.error} />
          <Text style={[S.pctTxt, { color: up?C.success:C.error }]}>
            {Math.abs(token.price_change_percentage_24h||0).toFixed(2)}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const GlobalMarketCard = ({ item, isDark, onPress }) => {
  const C = {
    card: isDark?'#111122':'#FFFFFF',
    text: isDark?'#EEEEFF':'#1C1C24',
    border: isDark?'#1E1E38':'#E8E8F2',
    success:'#10B981', error:'#EF4444',
  };
  const price  = item.current_price || 0;
  const change = item.price_change_percentage_24h || 0;
  const up     = change >= 0;

  const renderIcon = () => {
    if (item.image) {
      return <TokenIconImg uri={item.image} size={32} symbol={item.symbol} bg={C.border} color={C.text} />;
    }
    if (item.emoji) {
      return (
        <View style={[S.extEmojiIcon, { backgroundColor: (item.color || '#888') + '22' }]}>
          <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
        </View>
      );
    }
    return (
      <View style={[S.extEmojiIcon, { backgroundColor: C.border }]}>
        <Text style={{ fontSize: 14, fontWeight:'800', color: C.text }}>
          {item.symbol?.charAt(0) || '?'}
        </Text>
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={[S.extCard, { backgroundColor: C.card, borderColor: C.border }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {renderIcon()}
      <Text style={[S.extSym, { color: C.text }]} numberOfLines={1}>{item.symbol}</Text>
      <View style={S.extBottomRow}>
        <Text style={[S.extPrice, { color: C.text }]} numberOfLines={1}>{fmtPrice(price)}</Text>
        <View style={S.extChg}>
          <Ionicons name={up?'trending-up':'trending-down'} size={12} color={up?C.success:C.error} />
          <Text style={[S.extChgTxt, { color: up?C.success:C.error }]}>
            {Math.abs(change).toFixed(2)}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const HorizontalMarketSection = ({ titleKey, descKey, data, isDark, primaryColor, onPressItem, t }) => {
  const C = {
    text: isDark?'#EEEEFF':'#1C1C24',
    muted: isDark?'#7E7EAA':'#8A8A9E',
  };
  if (!data || data.length === 0) return null;
  return (
    <View style={S.extSection}>
      <View style={S.extHeader}>
        <View style={[S.extHeaderDot, { backgroundColor:primaryColor }]} />
        <Text style={[S.extHeaderTitle, { color:C.text }]}>{t(titleKey)}</Text>
        <Ionicons name="chevron-forward" size={16} color={C.muted} />
      </View>
      <Text style={[S.extHeaderSub, { color:C.muted }]}>{t(descKey)}</Text>
      <FlatList
        data={data}
        keyExtractor={item => item.id || item.mint || item.symbol}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.extList}
        snapToInterval={EXT_CARD_WIDTH + EXT_CARD_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        renderItem={({ item }) => (
          <GlobalMarketCard item={item} isDark={isDark} onPress={() => onPressItem(item)} />
        )}
      />
    </View>
  );
};

export default function MarketScreen() {
  const navigation   = useNavigation();
  const { t }        = useTranslation();
  const theme        = useAppStore(s => s.theme);
  const primaryColor = useAppStore(s => s.primaryColor || '#6C63FF');
  const isDark       = theme === 'dark';
  const insets       = useSafeAreaInsets();

  const C = {
    bg:     isDark?'#07070F':'#F4F5F9',
    card:   isDark?'#111122':'#FFFFFF',
    text:   isDark?'#EEEEFF':'#1C1C24',
    muted:  isDark?'#7E7EAA':'#8A8A9E',
    border: isDark?'#1E1E38':'#E8E8F2',
    success:'#10B981', error:'#EF4444',
  };

  const [tokens,       setTokens]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [activeTab,    setActiveTab]    = useState('all');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [watchlist,    setWatchlist]    = useState([]);
  const [overview,     setOverview]     = useState(null);
  const [sortBy,       setSortBy]       = useState('rank');
  const [addModal,     setAddModal]     = useState(false);
  const [mintInput,    setMintInput]    = useState('');
  const [fetching,     setFetching]     = useState(false);
  const [previewToken, setPreviewToken] = useState(null);
  const [fetchErr,     setFetchErr]     = useState('');
  const [extPrices,    setExtPrices]    = useState({});

  const [gainers,      setGainers]      = useState([]);
  const [losers,       setLosers]       = useState([]);
  const [commodities,  setCommodities]  = useState([]);
  const [stocks,       setStocks]       = useState([]);
  const [forex,        setForex]        = useState([]);

  const firstLoad = useRef(true);

  useEffect(() => {
    AsyncStorage.getItem(WATCHLIST_KEY)
      .then(s => { if (s) setWatchlist(JSON.parse(s)); })
      .catch(() => {});
  }, []);

  const fetchExtPrices = async () => {
    try {
      const ids = EXTERNAL_TOKENS.map(t => t.coingeckoId).join(',');
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
      );
      if (res.ok) setExtPrices(await res.json());
    } catch (_) {}
  };

  const fetchAll = useCallback(async () => {
    try {
      const [tokenData, ovData] = await Promise.all([
        getJupiterMarketData(),
        getGlobalMarketData(),
      ]);
      setTokens(tokenData);
      setOverview(ovData);
      fetchExtPrices();

      const normalizeMover = (m) => ({
        id:                          m.id,
        symbol:                      m.symbol,
        name:                        m.name,
        image:                       m.image,
        current_price:               m.price     || 0,
        price_change_percentage_24h: m.change24h || 0,
      });

      Promise.all([
        getTopMovers(5).catch(() => ({ gainers: [], losers: [] })),
        getCommodities().catch(() => []),
        getUSStocks().catch(() => []),
        getForexRates().catch(() => []),
      ]).then(([movers, comm, stk, fx]) => {
        setGainers((movers?.gainers || []).map(normalizeMover));
        setLosers((movers?.losers  || []).map(normalizeMover));
        setCommodities(comm || []);
        setStocks(stk || []);
        setForex(fx || []);
      });
    } catch (err) {
      if (!tokens.length)
        setTokens(CORE_TOKENS.map((tk, i) => ({ ...tk, current_price:0, price_change_percentage_24h:0, rank:i+1 })));
    }
  }, []);

  useEffect(() => {
    fetchAll().finally(() => setLoading(false));
    const iv = setInterval(fetchAll, REFRESH_MS);
    return () => clearInterval(iv);
  }, []);

  useFocusEffect(useCallback(() => {
    if (firstLoad.current) { firstLoad.current = false; return; }
    fetchAll();
  }, [fetchAll]));

  const onRefresh = async () => { setRefreshing(true); await fetchAll(); setRefreshing(false); };

  const toggleWatch = async (token) => {
    const upd = watchlist.includes(token.symbol)
      ? watchlist.filter(s => s !== token.symbol)
      : [...watchlist, token.symbol];
    setWatchlist(upd);
    await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(upd));
  };

  const handleFetch = async () => {
    if (!mintInput.trim()) return;
    setFetching(true); setFetchErr(''); setPreviewToken(null);
    try {
      setPreviewToken(await fetchCustomTokenByMint(mintInput.trim()));
    } catch (e) {
      setFetchErr(
        e.message?.includes('not found')  ? t('token_not_found')       :
        e.message?.includes('Invalid')    ? t('invalid_contract_address') :
        e.message || t('error')
      );
    } finally { setFetching(false); }
  };

  const handleSave = async () => {
    if (!previewToken) return;
    try {
      await saveCustomToken(previewToken);
      closeModal();
      await fetchAll();
      Alert.alert(t('success'), t('token_added_success', { symbol:previewToken.symbol }));
    } catch (e) {
      setFetchErr(e.message?.includes('already') ? t('token_already_added') : e.message);
    }
  };

  const handleDelete = (token) => {
    Alert.alert(t('delete'), t('delete_token_confirm', { symbol:token.symbol }), [
      { text:t('cancel'), style:'cancel' },
      { text:t('delete'), style:'destructive',
        onPress: async () => { await deleteCustomToken(token.mint); await fetchAll(); } },
    ]);
  };

  const closeModal = () => { setAddModal(false); setMintInput(''); setPreviewToken(null); setFetchErr(''); };

  const handleExtPress = (extToken) => {
    navigation.navigate('TokenDetails', { token: extToken });
  };

  const filtered = useMemo(() => {
    let list = tokens.filter(tk => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!tk.symbol?.toLowerCase().includes(q) && !tk.name?.toLowerCase().includes(q)) return false;
      }
      if (activeTab === 'watchlist') return watchlist.includes(tk.symbol);
      if (activeTab === 'gainers')   return (tk.price_change_percentage_24h||0) > 0;
      if (activeTab === 'losers')    return (tk.price_change_percentage_24h||0) < 0;
      return true;
    });
    list.sort((a,b) => {
      if (sortBy === 'price')  return (b.current_price||0) - (a.current_price||0);
      if (sortBy === 'change') return (b.price_change_percentage_24h||0) - (a.price_change_percentage_24h||0);
      return (a.rank||999) - (b.rank||999);
    });
    return list;
  }, [tokens, searchQuery, activeTab, watchlist, sortBy]);

  const normalizedExternal = useMemo(() => (
    EXTERNAL_TOKENS.map(item => {
      const data = extPrices[item.coingeckoId];
      return {
        id:     item.id,
        symbol: item.symbol,
        name:   item.name,
        image:  item.image,
        mint:   item.mint,
        isExternal: true,
        current_price:               data?.usd            || 0,
        price_change_percentage_24h: data?.usd_24h_change || 0,
      };
    })
  ), [extPrices]);

  const TABS  = [
    { id:'all',       labelKey:'all_tokens'    },
    { id:'watchlist', labelKey:'watchlist'     },
    { id:'gainers',   labelKey:'gainers'       },
    { id:'losers',    labelKey:'market_losers' },
  ];
  const SORTS = [
    { id:'rank',   labelKey:'rank'   },
    { id:'price',  labelKey:'price'  },
    { id:'change', labelKey:'change' },
  ];

  if (loading) return (
    <View style={[S.root, { backgroundColor:C.bg, paddingTop: insets.top }]}>
      <View style={S.loadWrap}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={[S.loadTxt, { color:C.muted }]}>{t('loading')}</Text>
      </View>
    </View>
  );

  return (
    <View style={[S.root, { backgroundColor:C.bg }]}>

      <View style={[S.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={[S.headerTitle, { color:C.text }]}>{t('market_title')}</Text>
          <Text style={[S.headerSub,   { color:C.muted }]}>{t('market_subtitle')}</Text>
        </View>
        <TouchableOpacity
          style={[S.headerBtn, { backgroundColor:C.card, borderColor:C.border }]}
          onPress={() => setSearchActive(v => !v)}
        >
          <Ionicons name={searchActive?'close':'search'} size={18} color={C.text} />
        </TouchableOpacity>
      </View>

      <ForexTicker data={forex} isDark={isDark} />

      {searchActive && (
        <View style={S.searchRow}>
          <View style={[S.searchWrap, { backgroundColor:C.card, borderColor:C.border }]}>
            <Ionicons name="search" size={14} color={C.muted} style={{ marginLeft:12 }} />
            <TextInput
              style={[S.searchInput, { color:C.text }]}
              placeholder={t('market_search_placeholder')}
              placeholderTextColor={C.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding:10 }}>
                <Ionicons name="close-circle" size={14} color={C.muted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[S.addBtn, { backgroundColor:primaryColor }]}
              onPress={() => setAddModal(true)}
            >
              <Ionicons name="add" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchActive(false); }} style={S.cancelBtn}>
            <Text style={{ color:primaryColor, fontWeight:'600', fontSize:13 }}>{t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[S.scroll, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} colors={[primaryColor]} />}
        showsVerticalScrollIndicator={false}
      >
        {!searchActive && (
          <MarketOverviewCard data={overview} isDark={isDark} primaryColor={primaryColor} />
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:6, paddingBottom:12 }}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[S.tab, {
                backgroundColor: activeTab===tab.id ? primaryColor : C.card,
                borderColor: C.border,
              }]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={[S.tabTxt, { color: activeTab===tab.id?'#FFF':C.muted }]}>
                {t(tab.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={S.sortRow}>
          {SORTS.map(opt => (
            <TouchableOpacity
              key={opt.id}
              style={[S.sortBtn, {
                backgroundColor: sortBy===opt.id ? primaryColor+'15' : 'transparent',
                borderColor:     sortBy===opt.id ? primaryColor+'35' : 'transparent',
              }]}
              onPress={() => setSortBy(opt.id)}
            >
              <Text style={[S.sortTxt, { color: sortBy===opt.id ? primaryColor : C.muted }]}>
                {t(opt.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[S.listContainer, { backgroundColor:C.card, borderColor:C.border }]}>
          {filtered.length === 0 ? (
            <View style={S.empty}>
              <Ionicons name="search-outline" size={36} color={C.muted} />
              <Text style={[S.emptyTxt, { color:C.muted }]}>
                {activeTab==='watchlist' ? t('watchlist_empty') : t('no_results')}
              </Text>
            </View>
          ) : filtered.map(token => (
            <TokenListItem
              key={token.mint||token.id}
              token={token}
              isDark={isDark}
              primaryColor={primaryColor}
              onPress={tk => navigation.navigate('TokenDetails', { token:tk })}
              onLongPress={tk => tk.isCustom ? handleDelete(tk) : toggleWatch(tk)}
            />
          ))}
        </View>

        {!searchQuery && (
          <>
            <HorizontalMarketSection
              titleKey="global_markets"
              descKey="global_markets_desc"
              data={normalizedExternal}
              isDark={isDark}
              primaryColor={primaryColor}
              onPressItem={handleExtPress}
              t={t}
            />

            <HorizontalMarketSection
              titleKey="top_gainers_section_title"
              descKey="top_gainers_section_desc"
              data={gainers}
              isDark={isDark}
              primaryColor={primaryColor}
              onPressItem={handleExtPress}
              t={t}
            />

            <HorizontalMarketSection
              titleKey="top_losers_section_title"
              descKey="top_losers_section_desc"
              data={losers}
              isDark={isDark}
              primaryColor={primaryColor}
              onPressItem={handleExtPress}
              t={t}
            />

            <HorizontalMarketSection
              titleKey="commodities_section_title"
              descKey="commodities_section_desc"
              data={commodities}
              isDark={isDark}
              primaryColor={primaryColor}
              onPressItem={handleExtPress}
              t={t}
            />

            <HorizontalMarketSection
              titleKey="us_stocks_section_title"
              descKey="us_stocks_section_desc"
              data={stocks}
              isDark={isDark}
              primaryColor={primaryColor}
              onPressItem={handleExtPress}
              t={t}
            />
          </>
        )}
      </ScrollView>

      <Modal visible={addModal} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={S.modalOverlay}>
          <View style={[S.modalBox, { backgroundColor:C.card }]}>
            <View style={[S.modalHandle, { backgroundColor:C.border }]} />
            <View style={S.modalHeader}>
              <Text style={[S.modalTitle, { color:C.text }]}>{t('add_custom_token')}</Text>
              <TouchableOpacity onPress={closeModal} style={[S.modalClose, { backgroundColor:C.bg }]}>
                <Ionicons name="close" size={18} color={C.muted} />
              </TouchableOpacity>
            </View>
            <Text style={[S.modalLabel, { color:C.muted }]}>{t('custom_token_address')}</Text>
            <View style={[S.modalInput, { backgroundColor:C.bg, borderColor:C.border }]}>
              <TextInput
                style={{ flex:1, color:C.text, fontSize:14, paddingVertical:0 }}
                placeholder={t('custom_token_placeholder')}
                placeholderTextColor={C.muted}
                value={mintInput}
                onChangeText={v => { setMintInput(v); setPreviewToken(null); setFetchErr(''); }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {!!fetchErr && <Text style={[S.fetchErr, { color:C.error }]}>{fetchErr}</Text>}
            {!previewToken && (
              <TouchableOpacity
                style={[S.fetchBtn, { backgroundColor:primaryColor, opacity:(fetching||!mintInput.trim())?0.6:1 }]}
                onPress={handleFetch}
                disabled={fetching||!mintInput.trim()}
              >
                {fetching
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <><Ionicons name="search" size={16} color="#FFF" /><Text style={S.fetchBtnTxt}>{t('fetch_token_data')}</Text></>
                }
              </TouchableOpacity>
            )}
            {previewToken && (
              <View style={[S.preview, { backgroundColor:C.bg, borderColor:C.border }]}>
                <View style={S.previewTop}>
                  <View style={[S.previewIcon, { backgroundColor:primaryColor+'15' }]}>
                    <TokenIconImg uri={previewToken.image} size={40} symbol={previewToken.symbol} bg={primaryColor+'15'} color={primaryColor} />
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={[S.previewSym,  { color:C.text }]}>{previewToken.symbol}</Text>
                    <Text style={[S.previewName, { color:C.muted }]}>{previewToken.name}</Text>
                  </View>
                  <View style={{ alignItems:'flex-end' }}>
                    <Text style={[S.previewPrice, { color:C.text }]}>{fmtPrice(previewToken.current_price)}</Text>
                    <Text style={{ color:(previewToken.price_change_percentage_24h||0)>=0?C.success:C.error, fontSize:12, fontWeight:'600', marginTop:2 }}>
                      {(previewToken.price_change_percentage_24h||0)>=0?'+':''}{(previewToken.price_change_percentage_24h||0).toFixed(2)}%
                    </Text>
                  </View>
                </View>
                <View style={S.previewBtns}>
                  <TouchableOpacity style={[S.previewCancel, { borderColor:C.border }]} onPress={() => { setPreviewToken(null); setMintInput(''); }}>
                    <Text style={{ color:C.muted, fontWeight:'600' }}>{t('research')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[S.previewAdd, { backgroundColor:primaryColor }]} onPress={handleSave}>
                    <Ionicons name="add-circle" size={18} color="#FFF" />
                    <Text style={S.previewAddTxt}>{t('add_custom_token')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  root:        { flex:1 },
  loadWrap:    { flex:1, justifyContent:'center', alignItems:'center', gap:12 },
  loadTxt:     { fontSize:14 },

  header:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center',
                 paddingHorizontal:20, paddingBottom:14 },
  headerTitle: { fontSize:28, fontWeight:'800', letterSpacing:-0.5 },
  headerSub:   { fontSize:13, marginTop:2 },
  headerBtn:   { width:40, height:40, borderRadius:12, justifyContent:'center',
                 alignItems:'center', borderWidth:1 },

  // ✅ شريط الفوركس — نثبّت الاتجاه LTR حتى لا يقلبه RTL عند تغيير اللغة
  tickerWrap: {
    height: 32,
    overflow: 'hidden',
    justifyContent: 'center',
    marginBottom: 10,
    direction: 'ltr',
  },
  tickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    direction: 'ltr',
  },
  tickerItem: {
    width: TICKER_ITEM_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    direction: 'ltr',
  },
  tickerPair:  { fontSize: 11, fontWeight: '700', width: 60, textAlign: 'left' },
  tickerPrice: { fontSize: 12, fontWeight: '800', marginHorizontal: 4, flex: 1, textAlign: 'left' },
  tickerChg:   { fontSize: 11, fontWeight: '700', marginLeft: 2, textAlign: 'left' },
  tickerSep:   { position:'absolute', right:0, top:6, bottom:6, width:1, opacity:0.3 },

  searchRow:   { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingTop:12, paddingBottom:12 },
  searchWrap:  { flex:1, flexDirection:'row', alignItems:'center', borderWidth:1, borderRadius:12, height:44 },
  searchInput: { flex:1, paddingHorizontal:10, fontSize:14, paddingVertical:0 },
  addBtn:      { width:32, height:32, borderRadius:8, justifyContent:'center', alignItems:'center', marginRight:4 },
  cancelBtn:   { paddingLeft:12, paddingVertical:10 },

  scroll:      { paddingHorizontal:20 },

  overviewCard:  { borderRadius:18, padding:16, marginBottom:14, borderWidth:1 },
  overviewRow:   { flexDirection:'row', justifyContent:'space-between' },
  overviewItem:  { flex:1, alignItems:'center' },
  overviewLabel: { fontSize:11, marginBottom:4 },
  overviewValue: { fontSize:15, fontWeight:'700' },
  overviewBar:   { flexDirection:'row', alignItems:'center', justifyContent:'center',
                   marginTop:12, paddingVertical:6, borderRadius:12, gap:6 },
  overviewBarTxt:{ fontSize:13, fontWeight:'600' },

  tab:         { paddingHorizontal:14, paddingVertical:6, borderRadius:12, borderWidth:1 },
  tabTxt:      { fontSize:13, fontWeight:'600' },

  sortRow:     { flexDirection:'row', marginBottom:12, gap:6 },
  sortBtn:     { paddingHorizontal:10, paddingVertical:5, borderRadius:8, borderWidth:1 },
  sortTxt:     { fontSize:12, fontWeight:'600' },

  listContainer:{ borderRadius:18, borderWidth:1, overflow:'hidden', paddingVertical:4, marginBottom:20 },
  tokenRow:    { flexDirection:'row', alignItems:'center', padding:12, borderBottomWidth:1 },
  tokenLeft:   { flexDirection:'row', alignItems:'center', flex:1, gap:10 },
  tokenIcon:   { width:36, height:36, borderRadius:18, justifyContent:'center', alignItems:'center' },
  tokenIconImg:{ width:36, height:36, borderRadius:18 },
  tokenIconTxt:{ fontSize:14, fontWeight:'bold' },
  tokenSym:    { fontSize:14, fontWeight:'700' },
  tokenName:   { fontSize:11, marginTop:1 },
  customBadge: { paddingHorizontal:5, paddingVertical:1, borderRadius:4 },
  customBadgeTxt:{ fontSize:9, fontWeight:'800' },
  tokenRight:  { alignItems:'flex-end' },
  tokenPrice:  { fontSize:14, fontWeight:'700' },
  pctRow:      { flexDirection:'row', alignItems:'center', marginTop:2, gap:2 },
  pctTxt:      { fontSize:11, fontWeight:'600' },
  empty:       { alignItems:'center', justifyContent:'center', paddingVertical:40, gap:8 },
  emptyTxt:    { fontSize:14 },

  extSection:    { marginBottom:16 },
  extHeader:     { flexDirection:'row', alignItems:'center', gap:8, marginBottom:4 },
  extHeaderDot:  { width:6, height:6, borderRadius:3 },
  extHeaderTitle:{ fontSize:16, fontWeight:'800' },
  extHeaderSub:  { fontSize:12, marginBottom:12 },
  extList:       { paddingHorizontal: EXT_CARD_PADDING - 20, gap: EXT_CARD_GAP },
  extCard: {
    width: EXT_CARD_WIDTH,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
  },
  extEmojiIcon: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  extSym:        { fontSize: 15, fontWeight: '800', textAlign: 'left' },
  extBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  extPrice:      { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  extChg:        { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0 },
  extChgTxt:     { fontSize: 11, fontWeight: '700' },

  modalOverlay:{ flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' },
  modalBox:    { borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, paddingTop:12,
                 paddingBottom:Platform.OS==='ios'?36:20 },
  modalHandle: { width:36, height:4, borderRadius:2, alignSelf:'center', marginBottom:16 },
  modalHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16 },
  modalTitle:  { fontSize:18, fontWeight:'800' },
  modalClose:  { width:36, height:36, borderRadius:11, justifyContent:'center', alignItems:'center' },
  modalLabel:  { fontSize:12, fontWeight:'600', marginBottom:8 },
  modalInput:  { flexDirection:'row', alignItems:'center', borderWidth:1, borderRadius:12,
                 paddingHorizontal:12, height:46, marginBottom:10 },
  fetchErr:    { fontSize:12, marginBottom:10, textAlign:'center' },
  fetchBtn:    { flexDirection:'row', alignItems:'center', justifyContent:'center',
                 padding:14, borderRadius:12, gap:6, marginBottom:14 },
  fetchBtnTxt: { color:'#FFF', fontSize:15, fontWeight:'700' },
  preview:     { borderWidth:1, borderRadius:14, padding:14, marginBottom:14 },
  previewTop:  { flexDirection:'row', alignItems:'center', gap:10, marginBottom:12 },
  previewIcon: { width:40, height:40, borderRadius:20, justifyContent:'center', alignItems:'center' },
  previewSym:  { fontSize:15, fontWeight:'800' },
  previewName: { fontSize:11, marginTop:2 },
  previewPrice:{ fontSize:15, fontWeight:'700' },
  previewBtns: { flexDirection:'row', gap:10 },
  previewCancel:{ flex:1, padding:12, borderRadius:10, alignItems:'center', borderWidth:1 },
  previewAdd:  { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center',
                 padding:12, borderRadius:10, gap:6 },
  previewAddTxt:{ color:'#FFF', fontSize:14, fontWeight:'700' },
});
