// screens/TokenDetailsScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  ScrollView, ActivityIndicator, Dimensions, Alert, Linking,
  Image, RefreshControl, Platform
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { Ionicons } from '@expo/vector-icons';
import DirIcon from '../components/DirIcon';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFullChartData } from '../services/priceChartService';
import { getSolBalance, getTokenBalance } from '../services/heliusService';
import { CORE_TOKENS } from '../services/jupiterMarketService';
import { WRAPPED_BY_COINGECKO_ID, GUARDED_TOKENS } from '../services/guardedTokens';

const { width } = Dimensions.get('window');
const WATCHLIST_KEY = '@meco_watchlist';
const FETCH_TIMEOUT = 8000;
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

const TIMEFRAMES = [
  { label:'1D',  days:1   },
  { label:'7D',  days:7   },
  { label:'30D', days:30  },
  { label:'90D', days:90  },
  { label:'1Y',  days:365 },
];

const COINGECKO_IDS = {
  SOL:'solana', USDT:'tether', USDC:'usd-coin',
  JUP:'jupiter-exchange-solana', RAY:'raydium', BONK:'bonk',
  WIF:'dogwifcoin', PYTH:'pyth-network',
  HNT:'helium', ORCA:'orca',
  BOME:'book-of-meme',
  PENGU:'pudgy-penguins',
  PUMP:'pump-fun',
  RENDER:'render-token',
};

const fetchWT = (url, ms = FETCH_TIMEOUT) => {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal:ctrl.signal, headers:{ Accept:'application/json' } })
    .finally(() => clearTimeout(timer));
};

// رابط صالح: http/https فقط
const isValidUrl = (u) => {
  if (typeof u !== 'string') return false;
  return /^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]{2,}$/i.test(u.trim());
};

const fmtPrice = (p) => {
  if (p === undefined || p === null || p === 0) return '$0.00';
  if (p >= 1) return `$${p.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  if (p >= 0.001) return `$${p.toLocaleString('en-US', { minimumFractionDigits:4, maximumFractionDigits:4 })}`;
  const pStr = p.toFixed(12);
  const leadingZerosMatch = pStr.match(/^0\.(0+)/);
  if (leadingZerosMatch) {
    const zeroCount = leadingZerosMatch[1].length;
    if (zeroCount >= 4) {
      const subscripts = ['₀','₁','₂','₃','₄','₅','₆','₇','₈','₉'];
      const subStr = zeroCount.toString().split('').map(d => subscripts[parseInt(d)]).join('');
      const significantPart = pStr.slice(2 + zeroCount).slice(0, 4).replace(/0+$/, '');
      return `$0.0${subStr}${significantPart}`;
    }
  }
  return `$${p.toFixed(8).replace(/\.?0+$/, '')}`;
};

export default function TokenDetailsScreen() {
  const navigation   = useNavigation();
  const route        = useRoute();
  const { t }        = useTranslation();
  const insets       = useSafeAreaInsets();
  const primaryColor = useAppStore(s => s.primaryColor || '#6C63FF');
  const walletPublicKey = useAppStore(s => s.walletPublicKey);
  // الشاشة موحّدة: تُفتح بعملة سولانا (token) أو بعملة عالمية (asset)
  const { token: tokenParam, asset } = route.params || {};
  const globalId = asset ? (asset.coingeckoId || asset.id) : null;
  // العملة القابلة للتداول داخل التطبيق (إن وُجدت): نسخة سولانا للعملة العالمية، أو العملة نفسها
  const tradeToken = asset
    ? (CORE_TOKENS.find(x => x.symbol === (WRAPPED_BY_COINGECKO_ID[globalId] || [])[0])
        || CORE_TOKENS.find(x => x.symbol === Object.keys(COINGECKO_IDS).find(k => COINGECKO_IDS[k] === globalId))
        || null)
    : (tokenParam ? (CORE_TOKENS.find(x => x.mint === tokenParam.mint) || (tokenParam.swapAvailable !== false ? tokenParam : null)) : null);
  const token = tokenParam || (asset ? { ...asset } : null);
  // عملة سولانا التي يُقرأ رصيدها ويُضبط تنبيه سعرها
  const solToken = tradeToken || (token && token.mint && !token.isExternal ? token : null);
  const wrappedTk = tradeToken ? GUARDED_TOKENS.find(g => g.symbol === tradeToken.symbol && g.cg && !g.native) : null;

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
  const [descOpen,   setDescOpen]   = useState(false);
  const [tipOpen,    setTipOpen]    = useState(false);
  const [balance,    setBalance]    = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [chartData,  setChartData]  = useState([]);
  const [sparkline,  setSparkline]  = useState([]);
  const [timeframe,  setTimeframe]  = useState(TIMEFRAMES[0]);
  const [metadata,   setMetadata]   = useState(null);
  const [watchlist,  setWatchlist]  = useState([]);
  const [stats,      setStats]      = useState({
    current:0, change:0, high:0, low:0, open:0,
    volume:0, cap:0, supply:0, maxSupply:0, ath:0, athChg:0, atl:0,
  });

  if (!token) { navigation.goBack(); return null; }

  const up = stats.change >= 0;

  useEffect(() => {
    AsyncStorage.getItem(WATCHLIST_KEY)
      .then(s => { if (s) setWatchlist(JSON.parse(s)); })
      .catch(() => {});
  }, []);

  const loadBalance = useCallback(async () => {
    if (!walletPublicKey || !solToken) { setBalance(0); return; }
    try {
      const b = solToken.symbol === 'SOL'
        ? await getSolBalance(true, walletPublicKey)
        : await getTokenBalance(solToken.mint, true, walletPublicKey);
      setBalance(Number(b) || 0);
    } catch (_) { setBalance(0); }
  }, [walletPublicKey, solToken?.mint, solToken?.symbol]);

  useEffect(() => {
    loadBalance();
    const unsub = navigation.addListener('focus', loadBalance);
    return unsub;
  }, [loadBalance]);

  const toggleWatch = async () => {
    const upd = watchlist.includes(token.symbol)
      ? watchlist.filter(s => s !== token.symbol)
      : [...watchlist, token.symbol];
    setWatchlist(upd);
    await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(upd));
  };

  const fetchCoinMeta = async (symbol) => {
    const coinId = token.coingeckoId || COINGECKO_IDS[symbol];
    if (!coinId) {
      return {
        description: symbol === 'MECO' ? t('meco_description') : (token.description || ''),
        links: symbol === 'MECO' ? {
          website:'https://monycoin.github.io/meco_web/',
          twitter:'https://twitter.com/MoniCoinMECO',
          telegram:'https://t.me/monycoin1',
        } : {},
        rank:'N/A', cap:token?.market_cap||0, volume:0, high:0, low:0,
        ath:0, athChg:0, atl:0,
        supply:   symbol==='MECO'?1_000_000_000:0,
        maxSupply:symbol==='MECO'?1_000_000_000:0,
      };
    }
    try {
      const res = await fetchWT(
        `${COINGECKO_API}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d  = await res.json();
      const md = d.market_data || {};
      return {
        description: d.description?.en || '',
        links: {
          website:  d.links?.homepage?.[0] || null,
          twitter:  d.links?.twitter_screen_name ? `https://twitter.com/${d.links.twitter_screen_name}` : null,
          telegram: d.links?.telegram_channel_identifier ? `https://t.me/${d.links.telegram_channel_identifier}` : null,
        },
        rank:     d.market_cap_rank            || 'N/A',
        cap:      md.market_cap?.usd           || 0,
        volume:   md.total_volume?.usd         || 0,
        high:     md.high_24h?.usd             || 0,
        low:      md.low_24h?.usd              || 0,
        ath:      md.ath?.usd                  || 0,
        athChg:   md.ath_change_percentage?.usd|| 0,
        atl:      md.atl?.usd                  || 0,
        supply:   md.circulating_supply        || 0,
        maxSupply:md.max_supply                || 0,
      };
    } catch (e) {
      console.warn(`[TokenDetails] Meta failed for ${symbol}:`, e.message);
      return null;
    }
  };

  const fetchAll = async (tf, isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [chartResult, meta] = await Promise.all([
        getFullChartData(token.symbol, tf.days, token.mint, token.coingeckoId),
        fetchCoinMeta(token.symbol),
      ]);
      setMetadata(meta);
      const realPrice  = token?.current_price               || 0;
      const realChange = token?.price_change_percentage_24h || 0;
      if (chartResult?.data?.length > 0) {
        setChartData(chartResult.data);
        setSparkline(chartResult.sparklineData || []);
        setStats({
          current:   realPrice > 0 ? realPrice : (chartResult.stats?.currentPrice || 0),
          change:    realChange !== 0 ? realChange : (chartResult.stats?.periodChange || 0),
          open:      chartResult.stats?.openPrice || 0,
          high:      meta?.high   || chartResult.stats?.high      || 0,
          low:       meta?.low    || chartResult.stats?.low       || 0,
          volume:    meta?.volume || chartResult.stats?.volume24h || 0,
          cap:       meta?.cap    || 0,
          supply:    meta?.supply    || 0,
          maxSupply: meta?.maxSupply || 0,
          ath:       meta?.ath    || 0,
          athChg:    meta?.athChg || 0,
          atl:       meta?.atl    || 0,
        });
      } else {
        setChartData([]);
        setSparkline([]);
        setStats({
          current:realPrice, change:realChange,
          open:0, high:meta?.high||0, low:meta?.low||0,
          volume:meta?.volume||0, cap:meta?.cap||0,
          supply:meta?.supply||0, maxSupply:meta?.maxSupply||0,
          ath:meta?.ath||0, athChg:meta?.athChg||0, atl:meta?.atl||0,
        });
      }
    } catch (e) {
      console.warn('fetchAll error:', e.message);
    } finally {
      if (!isRefresh) setLoading(false);
      else setRefreshing(false);
    }
  };

  useEffect(() => { if (token?.symbol) fetchAll(timeframe); }, [timeframe, token?.symbol]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll(timeframe, true);
  }, [timeframe]);

  const copy    = async () => {
    if (token.mint && !token.isExternal) { await Clipboard.setStringAsync(token.mint); Alert.alert(t('success'), t('copied_to_clipboard')); }
  };
  const openExp = () => { if (token.mint && !token.isExternal) Linking.openURL(`https://solscan.io/token/${token.mint}`); };
  const openUrl = (url) => { if (isValidUrl(url)) Linking.openURL(url.trim()).catch(() => {}); };

  const fmtBig = (n) => {
    if (!n) return 'N/A';
    if (n>=1e12) return `$${(n/1e12).toFixed(2)}T`;
    if (n>=1e9)  return `$${(n/1e9).toFixed(2)}B`;
    if (n>=1e6)  return `$${(n/1e6).toFixed(2)}M`;
    if (n>=1e3)  return `$${(n/1e3).toFixed(2)}K`;
    return `$${n.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  };
  const fmtPct = (n) => {
    if (!n && n !== 0) return '0%';
    return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
  };
  const fmtSupply = (n) => {
    if (!n) return 'N/A';
    if (n>=1e9) return `${(n/1e9).toFixed(2)}B`;
    if (n>=1e6) return `${(n/1e6).toFixed(2)}M`;
    return n.toLocaleString();
  };

  const chartH  = 180;
  const visible = chartData.slice(-60);
  const allH    = visible.map(d => d.high);
  const allL    = visible.map(d => d.low);
  const cMax    = allH.length ? Math.max(...allH) * 1.01 : 1;
  const cMin    = allL.length ? Math.min(...allL) * 0.99 : 0;
  const cRange  = cMax - cMin || 1;

  return (
    <SafeAreaView style={[S.root, { backgroundColor:C.bg, paddingTop: Platform.OS === 'ios' ? 0 : insets.top }]}>
      <ScrollView
        contentContainerStyle={[S.scroll, { paddingBottom: Math.max(insets.bottom, 20) + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={S.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[S.iconBtn, { backgroundColor:C.card }]}>
            <DirIcon name="arrow-back" size={18} color={C.text} />
          </TouchableOpacity>
          <View style={S.tokenHead}>
            {token.image ? (
              <Image source={{ uri:token.image }} style={S.tokenImg} />
            ) : (
              <View style={[S.tokenImg, { backgroundColor:C.card2, alignItems:'center', justifyContent:'center' }]}>
                <Text style={{ color:C.text, fontSize:14, fontWeight:'800' }}>{String(token.symbol || '?').charAt(0)}</Text>
              </View>
            )}
            <View style={{ alignItems:'flex-start', flexShrink:1 }}>
              <Text style={[S.sym, { color:C.text }]}>{token.symbol}</Text>
              <Text style={[S.nam, { color:C.muted }]} numberOfLines={1}>{token.name}</Text>
            </View>
          </View>
          <View style={{ flexDirection:'row', gap:8 }}>
            <TouchableOpacity onPress={toggleWatch}
              style={[S.iconBtn, { backgroundColor:C.card }]}>
              <Ionicons
                name={watchlist.includes(token.symbol) ? 'star' : 'star-outline'}
                size={18}
                color={watchlist.includes(token.symbol) ? '#FFB800' : C.text}
              />
            </TouchableOpacity>
            {!!solToken && (
              <TouchableOpacity
                onPress={() => navigation.navigate('PriceAlerts', { preselectedToken: solToken })}
                style={[S.iconBtn, { backgroundColor:C.card }]}>
                <Ionicons name="notifications-outline" size={18} color={C.text} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── السعر ── */}
        <View style={S.hero}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <Text style={[S.priceLabel, { color:C.muted }]}>{t('current_price')}</Text>
            <Text style={[S.rankTxt, { color:C.dim }]}>#{metadata?.rank || token.rank || 'N/A'}</Text>
          </View>
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
            <Text style={[S.price, { color:C.text }]}>{fmtPrice(stats.current)}</Text>
            <View style={[S.changePill, { backgroundColor: up?'rgba(16,185,129,0.08)':'rgba(239,68,68,0.08)' }]}>
              <Ionicons name={up?'trending-up':'trending-down'} size={12} color={up?C.success:C.error} />
              <Text style={[S.changeTxt, { color: up?C.success:C.error }]}>{fmtPct(stats.change)}</Text>
            </View>
          </View>
        </View>

        {/* ── شراء / بيع ── */}
        {tradeToken ? (
          <View style={{ marginBottom:12 }}>
            <View style={S.actions}>
              <TouchableOpacity
                style={[S.actionBtn, { backgroundColor:C.success }]}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('TradeExecution', { token: tradeToken, side:'buy' })}
              >
                <Text style={S.actionTxt}>{t('buy')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[S.actionBtn, { backgroundColor:C.error }]}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('TradeExecution', { token: tradeToken, side:'sell' })}
              >
                <Text style={S.actionTxt}>{t('sell')}</Text>
              </TouchableOpacity>
            </View>
            <View style={S.availRow}>
              <View style={[S.availDot, { backgroundColor:C.success }]} />
              <Text style={[S.availTxt, { color:C.success }]}>{t('wrapped_avail')}</Text>
              {!!wrappedTk && (
                <TouchableOpacity
                  style={[S.infoBtn, { borderColor:C.muted }]}
                  hitSlop={{ top:8, bottom:8, left:8, right:8 }}
                  onPress={() => setTipOpen(v => !v)}
                >
                  <Text style={{ color:C.muted, fontSize:10, fontWeight:'700' }}>i</Text>
                </TouchableOpacity>
              )}
            </View>
            {tipOpen && !!wrappedTk && (
              <Text style={[S.tipTxt, { color:C.muted, backgroundColor:C.card2 }]}>{t('wrapped_trade_note')}</Text>
            )}
          </View>
        ) : (
          <View style={[S.followBox, { backgroundColor:C.card, borderColor:C.border }]}>
            <Text style={[S.followTxt, { color:C.muted }]}>{t('follow_only')}</Text>
          </View>
        )}

        {/* ── رصيدك ── */}
        {balance > 0 && !!solToken && (
          <View style={[S.balCard, { backgroundColor:C.card, borderColor:C.border }]}>
            <View>
              <Text style={[S.balLabel, { color:C.muted }]}>{t('coin_your_balance')}</Text>
              <Text style={[S.balValue, { color:C.text }]}>
                {balance.toLocaleString('en-US', { maximumFractionDigits: 6 })} {solToken.symbol}
              </Text>
            </View>
            {stats.current > 0 && (
              <Text style={[S.balUsd, { color:C.muted }]}>≈ {fmtBig(balance * stats.current)}</Text>
            )}
          </View>
        )}

        {/* ── التبويب الزمني ── */}
        <View style={S.card}>
          <View style={S.tfRow}>
            {TIMEFRAMES.map(tf => (
              <TouchableOpacity
                key={tf.label}
                style={[S.tfBtn, timeframe.label===tf.label && { backgroundColor:C.primary }]}
                onPress={() => setTimeframe(tf)}
              >
                <Text style={[S.tfTxt, { color: timeframe.label===tf.label?'#FFF':C.muted }]}>{tf.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── الرسم البياني ── */}
        <View style={[S.card, { minHeight:200 }]}>
          {loading ? (
            <View style={S.chartLoad}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={[{ fontSize:12, marginTop:8 }, { color:C.muted }]}>{t('loading')}</Text>
            </View>
          ) : chartData.length > 0 ? (
            <View style={[S.chartArea, { height:chartH }]}>
              {visible.map((pt, i) => {
                const green = pt.close >= pt.open;
                const color = green ? C.success : C.error;
                const bTop  = chartH - ((Math.max(pt.open,pt.close) - cMin)/cRange)*chartH;
                const bH    = Math.max(((Math.abs(pt.close-pt.open))/cRange)*chartH, 2);
                const wTop  = chartH - ((pt.high - cMin)/cRange)*chartH;
                const wH    = ((pt.high - pt.low)/cRange)*chartH;
                return (
                  <View key={i} style={S.candle}>
                    <View style={[S.wick, { top:wTop, height:Math.max(wH,1), backgroundColor:color, opacity:0.3 }]} />
                    <View style={[S.body, { top:bTop, height:bH, backgroundColor:color }]} />
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={S.chartLoad}>
              <Ionicons name="analytics-outline" size={36} color={C.dim} />
              <Text style={[{ fontSize:13, marginTop:8 }, { color:C.muted }]}>{t('no_chart_data')}</Text>
            </View>
          )}
        </View>

        {/* ── OHLC ── */}
        <View style={S.card}>
          <Text style={[S.secTitle, { color:C.text }]}>{t('ohlc_stats')}</Text>
          <View style={S.tileGrid}>
            {[
              { k:'ohlc_open',  v:fmtPrice(stats.open),    c:C.text    },
              { k:'ohlc_high',  v:fmtPrice(stats.high),    c:C.success },
              { k:'ohlc_low',   v:fmtPrice(stats.low),     c:C.error   },
              { k:'ohlc_close', v:fmtPrice(stats.current), c:C.text    },
            ].map(item => (
              <View key={item.k} style={[S.tile, { backgroundColor:C.card, borderColor:C.border }]}>
                <Text style={[S.tileLabel, { color:C.muted }]} numberOfLines={1}>{t(item.k)}</Text>
                <Text style={[S.tileValue, { color:item.c }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{item.v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── إحصائيات السوق ── */}
        {(stats.cap > 0 || stats.volume > 0 || stats.supply > 0) && (
          <View style={S.card}>
            <Text style={[S.secTitle, { color:C.text }]}>{t('market_stats')}</Text>
            <View style={S.tileGrid}>
              {[
                { k:'tile_cap',    v:fmtBig(stats.cap),       c:C.text },
                { k:'tile_vol',    v:fmtBig(stats.volume),    c:C.text },
                { k:'tile_supply', v:fmtSupply(stats.supply), c:C.text },
                { k:'tile_max',    v:stats.maxSupply>0 ? fmtSupply(stats.maxSupply) : '∞', c:C.text },
                ...((stats.ath > 0 || stats.atl > 0) ? [
                  { k:'tile_ath',      v:stats.ath > 0 ? fmtPrice(stats.ath) : 'N/A', c:C.text },
                  { k:'tile_atl',      v:stats.atl > 0 ? fmtPrice(stats.atl) : 'N/A', c:C.text },
                ] : []),
              ].map(item => (
                <View key={item.k} style={[S.tile, { backgroundColor:C.card, borderColor:C.border }]}>
                  <Text style={[S.tileLabel, { color:C.muted }]} numberOfLines={1}>{t(item.k)}</Text>
                  <Text style={[S.tileValue, { color:item.c }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{item.v}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── الوصف ── */}
        {(metadata?.description || token.description) && (
          <View style={S.card}>
            <Text style={[S.secTitle, { color:C.text }]}>{t('about_token')}</Text>
            <Text style={[S.desc, { color:C.muted }]} numberOfLines={descOpen ? undefined : 3}>
              {(metadata?.description || token.description || '').replace(/<[^>]+>/g,'').slice(0,400)}
              {(metadata?.description||'').length > 400 ? '...' : ''}
            </Text>
            <TouchableOpacity onPress={() => setDescOpen(v => !v)} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
              <Text style={{ color:C.primary, fontSize:12, fontWeight:'700', marginTop:6 }}>
                {descOpen ? t('market_show_less') : t('show_more_text')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── الروابط ── */}
        {metadata?.links && Object.values(metadata.links).some(Boolean) && (
          <View style={S.card}>
            <Text style={[S.secTitle, { color:C.text }]}>{t('official_links')}</Text>
            <View style={S.links}>
              {[
                { key:'website', icon:'globe-outline',       color:C.text,    label:t('website')  },
                { key:'twitter', icon:'logo-twitter',        color:'#1DA1F2', label:t('twitter')  },
                { key:'telegram',icon:'paper-plane-outline', color:'#0088CC', label:t('telegram') },
              ].filter(l => metadata.links[l.key]).map(l => (
                <TouchableOpacity key={l.key}
                  style={[S.linkBtn, { backgroundColor:C.card }]}
                  onPress={() => openUrl(metadata.links[l.key])}>
                  <Ionicons name={l.icon} size={14} color={l.color} />
                  <Text style={[S.linkTxt, { color:C.text }]}>{l.label}</Text>
                </TouchableOpacity>
              ))}
              {!token.isExternal && (
                <TouchableOpacity style={[S.linkBtn, { backgroundColor:C.card }]} onPress={openExp}>
                  <Ionicons name="bar-chart-outline" size={14} color={C.primary} />
                  <Text style={[S.linkTxt, { color:C.text }]}>Solscan</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── عنوان العقد (غير معروض للعملات الخارجية) ── */}
        {token.mint && !token.isExternal && (
          <View style={S.card}>
            <Text style={[S.mintLabel, { color:C.muted }]}>{t('contract_address')}</Text>
            <View style={[S.mintRow, { backgroundColor:C.card }]}>
              <Text style={[S.mintAddr, { color:C.text }]} numberOfLines={1}>{token.mint}</Text>
              <TouchableOpacity onPress={copy}
                style={[S.copyIconWrap, { backgroundColor:C.card2 }]}>
                <Ionicons name="copy" size={14} color={C.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root:       { flex:1 },
  scroll:     { padding:20, paddingBottom:60 },
  header:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 },
  iconBtn:    { width:36, height:36, borderRadius:18, justifyContent:'center', alignItems:'center' },
  tokenHead:  { flex:1, flexDirection:'row', alignItems:'center', gap:10, paddingHorizontal:12 },
  tokenImg:   { width:34, height:34, borderRadius:17 },
  sym:        { fontSize:16, fontWeight:'800' },
  nam:        { fontSize:11, marginTop:1 },
  card:       { marginBottom:16 },
  hero:       { marginBottom:12, paddingTop:2 },
  priceLabel: { fontSize:12, fontWeight:'600' },
  rankTxt:    { fontSize:11, fontWeight:'600' },
  price:      { fontSize:28, fontWeight:'800', letterSpacing:-0.3 },
  changePill: { flexDirection:'row', alignItems:'center', paddingHorizontal:8, paddingVertical:4, borderRadius:10, gap:3 },
  changeTxt:  { fontSize:11, fontWeight:'700' },

  actions:    { flexDirection:'row', gap:10 },
  actionBtn:  { flex:1, alignItems:'center', justifyContent:'center', paddingVertical:12, borderRadius:12 },
  actionTxt:  { fontSize:14, fontWeight:'700', color:'#FFF' },
  availRow:   { flexDirection:'row', alignItems:'center', gap:6, marginTop:8, marginHorizontal:2 },
  availDot:   { width:6, height:6, borderRadius:3 },
  availTxt:   { fontSize:11, fontWeight:'700' },
  infoBtn:    { width:18, height:18, borderRadius:9, borderWidth:1.5, alignItems:'center', justifyContent:'center', marginHorizontal:4 },
  tipTxt:     { fontSize:11, lineHeight:18, marginTop:8, padding:9, borderRadius:10, overflow:'hidden' },
  followBox:  { borderWidth:1, borderRadius:12, paddingVertical:12, paddingHorizontal:12, marginBottom:12, alignItems:'center' },
  followTxt:  { fontSize:12, fontWeight:'600', textAlign:'center' },
  balCard:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderWidth:1, borderRadius:14, padding:12, marginBottom:12 },
  balLabel:   { fontSize:11, marginBottom:2 },
  balValue:   { fontSize:14, fontWeight:'700' },
  balUsd:     { fontSize:13 },
  secTitle:   { fontSize:15, fontWeight:'700', marginBottom:8 },
  tfRow:      { flexDirection:'row', justifyContent:'space-between', width:'100%' },
  tfBtn:      { flex:1, paddingVertical:6, alignItems:'center', borderRadius:999, marginHorizontal:2 },
  tfTxt:      { fontSize:12, fontWeight:'700' },
  chartArea:  { flexDirection:'row', justifyContent:'space-between', paddingHorizontal:4, overflow:'hidden', direction:'ltr' },   // الزمن دائمًا من اليسار (الأقدم) إلى اليمين (الأحدث) حتى في الواجهة العربية
  chartLoad:  { alignItems:'center', justifyContent:'center', height:180, gap:8 },
  candle:     { flex:1, height:'100%', alignItems:'center' },
  wick:       { position:'absolute', width:1 },
  body:       { position:'absolute', width:'55%', borderRadius:1 },
  grid:       { },
  gridItem:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:11, borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:'#262626' },
  gridLabel:  { fontSize:13 },
  gridValue:  { fontSize:13, fontWeight:'700' },
  tileGrid:   { flexDirection:'row', flexWrap:'wrap', gap:8 },
  tile:       { width:'48.5%', flexGrow:1, minWidth:0, height:44, borderWidth:1, borderRadius:12, paddingHorizontal:10, flexDirection:'row', alignItems:'center', justifyContent:'space-between', gap:6 },
  tileLabel:  { fontSize:10.5 },
  tileValue:  { fontSize:12.5, fontWeight:'800', flexShrink:1, textAlign:'left' },
  desc:       { fontSize:13, lineHeight:18 },
  links:      { flexDirection:'row', flexWrap:'wrap', gap:8 },
  linkBtn:    { flexDirection:'row', alignItems:'center', paddingHorizontal:12, paddingVertical:9, borderRadius:999, gap:6 },
  linkTxt:    { fontSize:12, fontWeight:'600' },
  mintLabel:  { fontSize:11, marginBottom:6, fontWeight:'600' },
  mintRow:    { flexDirection:'row', alignItems:'center', gap:8, borderRadius:16, paddingVertical:10, paddingHorizontal:14 },
  mintAddr:   { flex:1, fontSize:11, fontFamily:'monospace' },
  copyIconWrap:{ width:32, height:32, borderRadius:16, justifyContent:'center', alignItems:'center' },
});
