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
import DirIcon from '../components/DirIcon';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getJupiterMarketData, CORE_TOKENS,
  fetchCustomTokenByMint, saveCustomToken, deleteCustomToken,
} from '../services/jupiterMarketService';
import { getGlobalMarketData } from '../services/marketOverviewService';
import { getForexRates } from '../services/marketDataService';
import { getOHLCData } from '../services/priceChartService';
import { fetchCoinsMarkets } from '../services/globalCoinsService';

const REFRESH_MS    = 60000;

const { width } = require('react-native').Dimensions.get('window');

const CARD_SIDE        = 12;   // هامش موحّد للبطاقات (مثل شاشة المحفظة)
const CARD_BREAK       = 20 - CARD_SIDE; // البطاقة تتجاوز هامش النص 20 بهذا المقدار
const EXT_CARD_PADDING = CARD_SIDE;
const EXT_CARD_GAP     = 12;
const EXT_CARD_WIDTH   = (width - EXT_CARD_PADDING * 2 - EXT_CARD_GAP) / 2;

// ✅ شريط الفوركس — حركة دائمة بلا توقف، وسلوك موحّد في اللغتين
const TICKER_ITEM_WIDTH       = 164; // خانة البطاقة = بطاقة بعرض 156 + هامش 4 على كل جانب — تبقى الحركة متصلة
const TICKER_SPEED_PX_PER_SEC = 55;

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

// ✅ أعلام عملات الفوركس — للعرض فقط داخل الشريط المتحرك
const CURRENCY_FLAGS = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', CHF: '🇨🇭',
  AUD: '🇦🇺', CAD: '🇨🇦', NZD: '🇳🇿', AED: '🇦🇪', SAR: '🇸🇦',
  EGP: '🇪🇬', TRY: '🇹🇷', INR: '🇮🇳', CNY: '🇨🇳', ZAR: '🇿🇦',
  MXN: '🇲🇽',
};
const getPairFlags = (symbol) => {
  const [base, quote] = String(symbol || '').split('/');
  return `${CURRENCY_FLAGS[base] || ''}${CURRENCY_FLAGS[quote] || ''}`;
};

// ✅ أسماء مختصرة للعملات — للسطر الثاني داخل بطاقة الزوج
const CURRENCY_NAMES = {
  en: {
    USD:'Dollar', EUR:'Euro', GBP:'Sterling', JPY:'Yen', CHF:'Franc',
    AUD:'Aussie', CAD:'Loonie', NZD:'Kiwi', AED:'Dirham', SAR:'Riyal',
    EGP:'E. Pound', TRY:'Lira', INR:'Rupee', CNY:'Yuan', ZAR:'Rand', MXN:'Peso',
  },
  ar: {
    USD:'دولار', EUR:'يورو', GBP:'إسترليني', JPY:'ين', CHF:'فرنك',
    AUD:'أسترالي', CAD:'كندي', NZD:'نيوزلندي', AED:'درهم', SAR:'ريال',
    EGP:'جنيه', TRY:'ليرة', INR:'روبية', CNY:'يوان', ZAR:'راند', MXN:'بيزو',
  },
};
const getPairNames = (symbol, lang) => {
  const [base, quote] = String(symbol || '').split('/');
  const dict = CURRENCY_NAMES[String(lang || '').startsWith('ar') ? 'ar' : 'en'];
  return `${dict[base] || base || ''} / ${dict[quote] || quote || ''}`;
};

// ─── شريط الفوركس المتحرك — حركة دائمة بلا ومضة ───────────────────────────────
const ForexTicker = ({ data, isDark }) => {
  const { i18n } = useTranslation();
  const C = {
    text: isDark?'#F2F2F2':'#1C1C24',
    muted: isDark?'#8A8A8E':'#8A8A9E',
    success:'#10B981', error:'#EF4444',
    card:   isDark?'#141414':'#FFFFFF',
    border: isDark?'#262626':'#E8E8F2',
    flagBg: isDark?'#262626':'#EEF0F6',
  };

  const scrollX = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);
  const lenRef  = useRef(0);

  const dataLength = data?.length || 0;
  const totalWidth = dataLength * TICKER_ITEM_WIDTH;
  const fullDuration = totalWidth > 0
    ? (totalWidth / TICKER_SPEED_PX_PER_SEC) * 1000
    : 0;

  // ✅ لا يُعاد تشغيل الأنيميشن عند تحديث الأسعار (نفس عدد الأزواج) — فقط عند تغيّر فعلي
  useEffect(() => {
    if (!dataLength || fullDuration <= 0) return;
    if (lenRef.current === dataLength && animRef.current) return;
    lenRef.current = dataLength;

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
  }, [dataLength, fullDuration, scrollX]);

  if (!dataLength) return null;

  const translateX = scrollX.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, -totalWidth],
  });

  const loopData = [...data, ...data, ...data, ...data, ...data, ...data];

  return (
    <View style={S.tickerWrap}>
      <Animated.View style={[S.tickerRow, { transform: [{ translateX }] }]}>
        {loopData.map((item, i) => {
          const up = (item.price_change_percentage_24h || 0) >= 0;
          const digits = item.digits ?? 4;
          return (
            <View key={`${item.id}-${i}`} style={S.tickerItem}>
              <View style={[S.tickerCard, { backgroundColor: C.card }]}>
                {/* الأعلام: دائرتان متداخلتان */}
                <View style={S.fxFlagsWrap}>
                  <View style={[S.fxFlagCircle, { backgroundColor: C.flagBg, borderColor: C.card }]}>
                    <Text style={S.fxFlagTxt}>{CURRENCY_FLAGS[String(item.symbol || '').split('/')[0]] || ''}</Text>
                  </View>
                  <View style={[S.fxFlagCircle, S.fxFlagCircle2, { backgroundColor: C.flagBg, borderColor: C.card }]}>
                    <Text style={S.fxFlagTxt}>{CURRENCY_FLAGS[String(item.symbol || '').split('/')[1]] || ''}</Text>
                  </View>
                </View>

                {/* الجانب الأول: رمز الزوج + أسماء العملتين */}
                <View style={S.fxLeft}>
                  <Text style={[S.fxSymbol, { color: C.text }]} numberOfLines={1}>
                    {item.symbol}
                  </Text>
                  <Text
                    style={[S.fxNames, { color: C.muted }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {getPairNames(item.symbol, i18n.language)}
                  </Text>
                </View>

                {/* الجانب الثاني: السعر + نسبة التغير */}
                <View style={S.fxRight}>
                  <Text
                    style={[S.fxPrice, { color: C.text }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {Number(item.current_price || 0).toFixed(digits)}
                  </Text>
                  <View style={[S.fxChgChip, { backgroundColor: (up ? C.success : C.error) + '1F' }]}>
                    <Text style={[S.fxChgTxt, { color: up ? C.success : C.error }]}>
                      {up ? '▲' : '▼'} {Math.abs(item.price_change_percentage_24h || 0).toFixed(2)}%
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ✅ بانر MECO المباشر — رسوم متحركة بالكود (SVG + Animated الأصلي بمحرك native)
// المنحنى مبني من شموع MECO الحقيقية لآخر 24 ساعة (نفس مصدر شاشة التفاصيل)؛ إن تعذّر جلبها يُخفى المنحنى ولا يُرسم بديل وهمي
// ═════════════════════════════════════════════════════════════════════════════
const MECO_MINT_ADDR = 'A5Ln25cfww33kfUSzBb89bMha7j1PnFQTy7H3FsQHN7W';
const HERO_W      = width - CARD_SIDE * 2; // عرض البانر: هامش البطاقات 12 على الجانبين
const HERO_H      = 196;
const HERO_N      = 48;                    // عدد نقاط المنحنى
const HERO_GREEN  = '#10B981';
const HERO_RED    = '#EF4444';

const heroPointsFromCloses = (closes) => {
  // إعادة أخذ عينات إلى HERO_N+1 نقطة، ثم تحويل السعر إلى إحداثي رأسي ضمن نطاق البانر
  const n = closes.length;
  const sampled = [];
  for (let i = 0; i <= HERO_N; i++) {
    sampled.push(closes[Math.min(n - 1, Math.round((i / HERO_N) * (n - 1)))]);
  }
  const lo = Math.min(...sampled), hi = Math.max(...sampled);
  const span = hi - lo;
  return sampled.map((c, i) => {
    const v = span > 0 ? 0.05 + ((c - lo) / span) * 0.9 : 0.5;
    return { x: (i / HERO_N) * HERO_W, y: 186 - v * 48 };
  });
};

const buildHeroCurve = (closes) => {
  const real = Array.isArray(closes) && closes.length >= 2;
  const pts = real
    ? heroPointsFromCloses(closes)
    : Array.from({ length: HERO_N + 1 }, (_, i) => ({ x: (i / HERO_N) * HERO_W, y: 186 }));
  // مسار سلس عبر نقاط المنتصف (Quadratic)
  let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    line += ` Q ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  line += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  const area = `${line} L ${HERO_W} ${HERO_H} L 0 ${HERO_H} Z`;
  return { pts, line, area, real };
};

const MarketHeroBanner = React.memo(({ token, primaryColor, onPress, onTrade }) => {
  const { t } = useTranslation();
  const price  = token?.current_price || 0;
  const [candles, setCandles] = useState(null);   // شموع حقيقية (24 ساعة) أو null إن تعذّرت
  useEffect(() => {
    let alive = true;
    getOHLCData('MECO', 1)
      .then(r => { if (alive) setCandles(r && Array.isArray(r.data) && r.data.length >= 2 ? r.data : null); })
      .catch(() => { if (alive) setCandles(null); });
    return () => { alive = false; };
  }, [price]);

  // التغير واللون من الشموع نفسها حين تتوفر، حتى يتطابق البانر مع شاشة التفاصيل
  const candleChange = candles && candles[0].open > 0
    ? ((candles[candles.length - 1].close - candles[0].open) / candles[0].open) * 100
    : null;
  const change = candleChange !== null ? candleChange : (token?.price_change_percentage_24h || 0);
  const up     = change >= 0;
  const accent = up ? HERO_GREEN : HERO_RED;

  const curve = useMemo(() => buildHeroCurve(candles ? candles.map(c => c.close) : null), [candles]);

  const drift  = useRef(new Animated.Value(0)).current;
  const travel = useRef(new Animated.Value(0)).current;
  const pulse  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a1 = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 7000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(drift, { toValue: 0, duration: 7000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const a2 = Animated.loop(
      Animated.timing(travel, { toValue: 1, duration: 7500, easing: Easing.linear, useNativeDriver: true })
    );
    const a3 = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true })
    );
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [drift, travel, pulse]);

  const inputRange = useMemo(() => curve.pts.map((_, i) => i / HERO_N), [curve]);
  const dotX = useMemo(
    () => travel.interpolate({ inputRange, outputRange: curve.pts.map(p => p.x - 7) }),
    [travel, inputRange, curve]
  );
  const dotY = useMemo(
    () => travel.interpolate({ inputRange, outputRange: curve.pts.map(p => p.y - 7) }),
    [travel, inputRange, curve]
  );

  const orb1X = drift.interpolate({ inputRange: [0, 1], outputRange: [-14, 26] });
  const orb1Y = drift.interpolate({ inputRange: [0, 1], outputRange: [0, 14] });
  const orb2X = drift.interpolate({ inputRange: [0, 1], outputRange: [18, -22] });
  const orb2Y = drift.interpolate({ inputRange: [0, 1], outputRange: [10, -8] });
  const ringScale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
  const liveOpacity = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.35, 1] });

  return (
    <TouchableOpacity activeOpacity={0.94} onPress={onPress} style={S.hero}>
      {/* الخلفية: تدرج داكن */}
      <Svg width={HERO_W} height={HERO_H} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="heroBg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#1C1C1C" />
            <Stop offset="1" stopColor="#0A0A0A" />
          </LinearGradient>
          <LinearGradient id="heroArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={accent} stopOpacity="0.28" />
            <Stop offset="1" stopColor={accent} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="heroLine" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={accent} stopOpacity="0.15" />
            <Stop offset="0.5" stopColor={accent} stopOpacity="0.95" />
            <Stop offset="1" stopColor={accent} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Path d={`M 0 0 L ${HERO_W} 0 L ${HERO_W} ${HERO_H} L 0 ${HERO_H} Z`} fill="url(#heroBg)" />
      </Svg>

      {/* بقع ضوء تتحرك ببطء */}
      <Animated.View pointerEvents="none" style={[S.heroOrb, { top: -70, right: -50, transform: [{ translateX: orb1X }, { translateY: orb1Y }] }]}>
        <Svg width={220} height={220}>
          <Defs>
            <RadialGradient id="heroOrb1" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={primaryColor} stopOpacity="0.45" />
              <Stop offset="1" stopColor={primaryColor} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="110" cy="110" r="110" fill="url(#heroOrb1)" />
        </Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[S.heroOrb, { bottom: -90, left: -60, transform: [{ translateX: orb2X }, { translateY: orb2Y }] }]}>
        <Svg width={220} height={220}>
          <Defs>
            <RadialGradient id="heroOrb2" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={accent} stopOpacity="0.28" />
              <Stop offset="1" stopColor={accent} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="110" cy="110" r="110" fill="url(#heroOrb2)" />
        </Svg>
      </Animated.View>

      {/* المنحنى */}
      <Svg width={HERO_W} height={HERO_H} style={StyleSheet.absoluteFill} pointerEvents="none">
        {curve.real && <Path d={curve.area} fill="url(#heroArea)" />}
        {curve.real && <Path d={curve.line} fill="none" stroke="url(#heroLine)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />}
      </Svg>

      {/* نقطة مضيئة تسير على المنحنى */}
      {curve.real && <Animated.View pointerEvents="none" style={[S.heroDotWrap, { transform: [{ translateX: dotX }, { translateY: dotY }] }]}>
        <Animated.View style={[S.heroDotRing, { backgroundColor: accent, opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
        <View style={[S.heroDotCore, { backgroundColor: accent, shadowColor: accent }]} />
      </Animated.View>}

      {/* المحتوى */}
      <View style={S.heroTop}>
        <View style={S.heroTitleRow}>
          <TokenIconImg uri={token?.image} size={26} symbol="M" bg="rgba(255,255,255,0.08)" color="#FFF" />
          <Text style={S.heroTitle}>MECO</Text>
          <Text style={S.heroTitleSub}>/ USD</Text>
          <View style={S.heroLivePill}>
            <Animated.View style={[S.heroLiveDot, { opacity: liveOpacity }]} />
            <Text style={S.heroLiveTxt}>{t('market_hero_live', 'مباشر')}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[S.heroCta, { backgroundColor: primaryColor }]}
          onPress={onTrade}
          activeOpacity={0.85}
        >
          <Text style={S.heroCtaTxt}>{t('market_hero_trade', 'تداول MECO')}</Text>
          <DirIcon name="arrow-forward" size={13} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={S.heroBottom}>
        <Text style={S.heroPrice} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {price > 0 ? fmtPrice(price) : '—'}
        </Text>
        {price > 0 && (
          <View style={[S.heroChgChip, { backgroundColor: accent + '26' }]}>
            <Ionicons name={up ? 'caret-up' : 'caret-down'} size={10} color={accent} />
            <Text style={[S.heroChgTxt, { color: accent }]}>{Math.abs(change).toFixed(2)}%</Text>
            <Text style={S.heroChgSub}>{t('time_24h')}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

const MarketOverviewCard = React.memo(({ data, isDark, primaryColor }) => {
  const { t } = useTranslation();
  const C = {
    text: isDark?'#F2F2F2':'#1C1C24',
    muted: isDark?'#8A8A8E':'#8A8A9E',
    success:'#10B981', error:'#EF4444',
    border: isDark?'#262626':'#E8E8F2',
    card: isDark?'#141414':'#FFFFFF',
  };
  const up = (data?.marketCapChange24h || 0) >= 0;
  return (
    <View style={[S.overviewCard, { backgroundColor:C.card }]}>
      <View style={S.overviewRow}>
        {[
          { k:'market_cap_label', v: data?.totalMarketCapFormatted || 'N/A' },
          { k:'market_volume',    v: data?.totalVolume24hFormatted  || 'N/A' },
          { k:'btc_dominance',    v: `${data?.btcDominance?.toFixed(1)||'0'}%` },
        ].map((item, i) => (
          <View key={item.k} style={S.overviewItem}>
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
    text: isDark?'#F2F2F2':'#1C1C24',
    muted: isDark?'#8A8A8E':'#8A8A9E',
    success:'#10B981', error:'#EF4444',
    border: isDark?'#262626':'#E8E8F2',
    iconBg: isDark?'#1E1E1E':'#ECECF4',
  };
  const up = (token.price_change_percentage_24h || 0) >= 0;
  return (
    <TouchableOpacity
      style={S.tokenRow}
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
    card: isDark?'#141414':'#FFFFFF',
    text: isDark?'#F2F2F2':'#1C1C24',
    border: isDark?'#262626':'#E8E8F2',
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
      style={[S.extCard, { backgroundColor: C.card }]}
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

// بطاقة "عرض المزيد" في نهاية الصفوف الأفقية: دائرة بسهم في منتصف ارتفاع البطاقات
const MoreCard = ({ onPress, primaryColor, isDark, t }) => (
  <TouchableOpacity style={S.moreCard} onPress={onPress} activeOpacity={0.7}>
    <View style={[S.moreCircle, { backgroundColor: isDark ? '#1E1E1E' : '#ECECF4' }]}>
      <DirIcon name="chevron-forward" size={18} color={primaryColor} />
    </View>
    <Text style={[S.moreCardTxt, { color: primaryColor }]} numberOfLines={1}>{t('global_more_title')}</Text>
  </TouchableOpacity>
);

// رابط نصي (عرض كل العملات) أسفل معاينة الأسواق العالمية
const MoreCoinsLink = ({ onPress, primaryColor, label }) => (
  <TouchableOpacity style={S.extMoreLink} onPress={onPress} activeOpacity={0.7}>
    <Text style={[S.extMoreTxt, { color: primaryColor }]} numberOfLines={1}>{label}</Text>
    <DirIcon name="chevron-forward" size={14} color={primaryColor} />
  </TouchableOpacity>
);

// صف عملة (معاينة الأسواق العالمية)
const CoinRow = React.memo(({ item, onPress, C }) => {
  const change = item.price_change_percentage_24h || 0;
  const up = change >= 0;
  return (
    <TouchableOpacity style={[S.coinRow, { borderBottomColor: C.border }]} onPress={() => onPress(item)} activeOpacity={0.7}>
      <Text style={[S.coinRank, { color: C.muted }]}>{item.rank || ''}</Text>
      <TokenIconImg uri={item.image} size={36} symbol={item.symbol} bg={C.border} color={C.text} />
      <View style={{ flex: 1 }}>
        <Text style={[S.coinSym, { color: C.text }]} numberOfLines={1}>{item.symbol}</Text>
        <Text style={[S.coinName, { color: C.muted }]} numberOfLines={1}>{item.name}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[S.coinPrice, { color: C.text }]}>{fmtPrice(item.current_price)}</Text>
        <Text style={[S.coinChg, { color: up ? C.success : C.error }]}>{`${up ? '+' : ''}${change.toFixed(2)}%`}</Text>
      </View>
    </TouchableOpacity>
  );
});

// بطاقة عملة قابلة للتداول مع زر "تداول"
const TradableCard = ({ token, isDark, primaryColor, onPress, onTrade, t }) => {
  const C = { card: isDark?'#141414':'#FFFFFF', text: isDark?'#F2F2F2':'#1C1C24', muted: isDark?'#8A8A8E':'#8A8A9E', border: isDark?'#262626':'#E8E8F2', success:'#10B981', error:'#EF4444' };
  const change = token.price_change_percentage_24h || 0;
  const up = change >= 0;
  return (
    <TouchableOpacity style={[S.tradeCard, { backgroundColor: C.card }]} onPress={onPress} activeOpacity={0.85}>
      <View style={S.tradeTop}>
        <TokenIconImg uri={token.image} size={32} symbol={token.symbol} bg={C.border} color={C.text} />
        <Text style={[S.tradeChg, { color: up ? C.success : C.error }]}>{`${up ? '+' : ''}${change.toFixed(2)}%`}</Text>
      </View>
      <Text style={[S.extSym, { color: C.text }]} numberOfLines={1}>{token.symbol}</Text>
      <Text style={[S.tradeName, { color: C.muted }]} numberOfLines={1}>{token.name}</Text>
      <Text style={[S.tradePrice, { color: C.text }]} numberOfLines={1}>{fmtPrice(token.current_price || 0)}</Text>
      <TouchableOpacity style={[S.tradeBtn, { backgroundColor: primaryColor + '26' }]} onPress={onTrade} activeOpacity={0.8}>
        <Text style={[S.tradeBtnTxt, { color: primaryColor }]}>{t('wrapped_trade_btn')}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const HorizontalMarketSection = ({ titleKey, descKey, data, isDark, primaryColor, onPressItem, t, footer, headerRight, renderCard }) => {
  const C = {
    text: isDark?'#F2F2F2':'#1C1C24',
    muted: isDark?'#8A8A8E':'#8A8A9E',
  };
  if (!data || data.length === 0) return null;
  return (
    <View style={S.extSection}>
      <View style={S.extHeader}>
        <View style={[S.extHeaderDot, { backgroundColor:primaryColor }]} />
        <Text style={[S.extHeaderTitle, { color:C.text }]}>{t(titleKey)}</Text>
        <View style={{ flex: 1 }} />
        {headerRight || null}
      </View>
      {descKey ? <Text style={[S.extHeaderSub, { color:C.muted }]}>{t(descKey)}</Text> : <View style={{ height: 10 }} />}
      <FlatList
        data={data}
        keyExtractor={item => item.id || item.mint || item.symbol}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -CARD_BREAK }}
        contentContainerStyle={S.extList}
        decelerationRate="normal"
        ListFooterComponent={footer || null}
        renderItem={({ item }) => (
          renderCard
            ? renderCard(item)
            : <GlobalMarketCard item={item} isDark={isDark} onPress={() => onPressItem(item)} />
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
    bg:     isDark?'#000000':'#F4F5F9',
    card:   isDark?'#141414':'#FFFFFF',
    text:   isDark?'#F2F2F2':'#1C1C24',
    muted:  isDark?'#8A8A8E':'#8A8A9E',
    border: isDark?'#262626':'#E8E8F2',
    success:'#10B981', error:'#EF4444',
  };

  const [tokens,       setTokens]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [overview,     setOverview]     = useState(null);
  const [showAll,      setShowAll]      = useState(false);
  const [addModal,     setAddModal]     = useState(false);
  const [mintInput,    setMintInput]    = useState('');
  const [fetching,     setFetching]     = useState(false);
  const [previewToken, setPreviewToken] = useState(null);
  const [fetchErr,     setFetchErr]     = useState('');
  const [globalTop,    setGlobalTop]    = useState([]);
  const [rails,        setRails]        = useState({ meme: [], ai: [] });
  const [moversDir,    setMoversDir]    = useState('up');
  const [updatedAt,    setUpdatedAt]    = useState(null);

  const [forex,        setForex]        = useState([]);

  const firstLoad = useRef(true);

  // العملات العالمية (معاينة + صفوف التصنيفات) — طلبات مخزّنة مؤقتاً ومتتابعة لتخفيف الضغط على CoinGecko
  const fetchGlobal = async () => {
    try {
      const rows = await fetchCoinsMarkets('all', 150);
      setGlobalTop(rows.slice(0, 5));
    } catch (_) {}
    try {
      const meme = await fetchCoinsMarkets('meme-token', 8);
      setRails(r => ({ ...r, meme }));
    } catch (_) {}
    try {
      const ai = await fetchCoinsMarkets('artificial-intelligence', 8);
      setRails(r => ({ ...r, ai }));
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
      setUpdatedAt(new Date());
      fetchGlobal();

      getForexRates().catch(() => []).then(fx => setForex(fx || []));
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

  // ✅ توجيه ذكي: TokenDetails لعملات Solana الحقيقية — AssetDetails للأصول الخارجية
  const handleExtPress = (item) => {
    const isRealSolana = item.mint && !String(item.mint).startsWith('external:') && !item.isExternal;
    if (isRealSolana) {
      navigation.navigate('TokenDetails', { token: item });
    } else {
      navigation.navigate('AssetDetails', { asset: item });
    }
  };

  const mecoToken = useMemo(() => tokens.find(tk => tk.mint === MECO_MINT_ADDR) || null, [tokens]);

  const filtered = useMemo(() => {
    let list = tokens.filter(tk => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!tk.symbol?.toLowerCase().includes(q) && !tk.name?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    list.sort((a,b) => (a.rank||999) - (b.rank||999));
    return list;
  }, [tokens, searchQuery]);

  const stableLike = (tk) => tk.current_price > 0.97 && tk.current_price < 1.03 && Math.abs(tk.price_change_percentage_24h || 0) < 1;

  // الأكثر حركة: من العملات القابلة للتداول داخل التطبيق فقط
  const movers = useMemo(() => {
    const pool = tokens.filter(tk =>
      tk.swapAvailable !== false && tk.mint !== MECO_MINT_ADDR && tk.current_price > 0 && !stableLike(tk));
    const sorted = [...pool].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
    return moversDir === 'up' ? sorted.slice(0, 8) : sorted.slice(-8).reverse();
  }, [tokens, moversDir]);

  // عملات الإضافة القابلة للتداول (مغلّفة/مجسّرة/أصلية) مع زر تداول
  const tradables = useMemo(() => tokens.filter(tk => tk.guarded && tk.current_price > 0), [tokens]);

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
        </View>
        <TouchableOpacity
          style={[S.headerBtn, { backgroundColor:C.card, opacity: searchActive ? 0 : 1 }]}
          onPress={() => setSearchActive(true)}
          disabled={searchActive}
        >
          <Ionicons name="search" size={18} color={C.text} />
        </TouchableOpacity>
      </View>

      <ForexTicker data={forex} isDark={isDark} />

      {searchActive && (
        <View style={S.searchRow}>
          <View style={[S.searchWrap, { backgroundColor:C.card }]}>
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
          <>
            <MarketOverviewCard data={overview} isDark={isDark} primaryColor={primaryColor} />
            {updatedAt && (
              <Text style={[S.updatedTxt, { color:C.muted }]}>
                {t('market_updated', { time: updatedAt.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) })}
              </Text>
            )}
            <MarketHeroBanner
              token={mecoToken}
              primaryColor={primaryColor}
              onPress={() => mecoToken && navigation.navigate('TokenDetails', { token: mecoToken })}
              onTrade={() => mecoToken && navigation.navigate('TradeExecution', { token: mecoToken, side: 'buy' })}
            />

            <HorizontalMarketSection
              titleKey="movers_title"
              data={movers}
              isDark={isDark}
              primaryColor={primaryColor}
              onPressItem={tk => navigation.navigate('TokenDetails', { token: tk })}
              t={t}
              headerRight={
                <View style={[S.seg, { backgroundColor: C.card }]}>
                  {[['up','movers_up'],['down','movers_down']].map(([k, label]) => (
                    <TouchableOpacity
                      key={k}
                      style={[S.segBtn, moversDir === k && { backgroundColor: isDark ? '#262626' : '#E8E8F2' }]}
                      onPress={() => setMoversDir(k)}
                      activeOpacity={0.8}
                    >
                      <Text style={[S.segTxt, { color: moversDir === k ? C.text : C.muted }]}>{t(label)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              }
            />

            {globalTop.length > 0 && (
              <View style={S.extSection}>
                <View style={[S.extHeader, { marginBottom: 10 }]}>
                  <View style={[S.extHeaderDot, { backgroundColor: primaryColor }]} />
                  <Text style={[S.extHeaderTitle, { color:C.text }]}>{t('global_markets')}</Text>
                </View>
                <View style={[S.coinGroup, { backgroundColor:C.card }]}>
                  {globalTop.map(item => (
                    <CoinRow key={item.id} item={item} C={C} onPress={handleExtPress} />
                  ))}
                  <MoreCoinsLink
                    label={t('global_see_all')}
                    onPress={() => navigation.navigate('GlobalCoins')}
                    primaryColor={primaryColor}
                  />
                </View>
              </View>
            )}

            {[['meme', 'rail_meme', 'meme-token'], ['ai', 'rail_ai', 'artificial-intelligence']].map(([k, titleKey, cat]) => (
              <HorizontalMarketSection
                key={k}
                titleKey={titleKey}
                data={rails[k]}
                isDark={isDark}
                primaryColor={primaryColor}
                onPressItem={handleExtPress}
                t={t}
                footer={
                  <MoreCard
                    onPress={() => navigation.navigate('GlobalCoins', { category: cat })}
                    primaryColor={primaryColor}
                    isDark={isDark}
                    t={t}
                  />
                }
              />
            ))}

            <HorizontalMarketSection
              titleKey="tradable_title"
              data={tradables}
              isDark={isDark}
              primaryColor={primaryColor}
              onPressItem={tk => navigation.navigate('TokenDetails', { token: tk })}
              t={t}
              renderCard={tk => (
                <TradableCard
                  token={tk}
                  isDark={isDark}
                  primaryColor={primaryColor}
                  t={t}
                  onPress={() => navigation.navigate('TokenDetails', { token: tk })}
                  onTrade={() => navigation.navigate('TradeExecution', { token: tk, side: 'buy' })}
                />
              )}
            />
          </>
        )}

        <View style={[S.extHeader, { marginBottom: 12 }]}>
          <View style={[S.extHeaderDot, { backgroundColor: primaryColor }]} />
          <Text style={[S.extHeaderTitle, { color:C.text }]}>{t('all_tokens')}</Text>
        </View>

        <View style={S.listFlat}>
          {filtered.length === 0 ? (
            <View style={S.empty}>
              <Ionicons name="search-outline" size={36} color={C.muted} />
              <Text style={[S.emptyTxt, { color:C.muted }]}>
                {t('no_results')}
              </Text>
            </View>
          ) : (showAll || searchQuery ? filtered : filtered.slice(0, 5)).map(token => (
            <TokenListItem
              key={token.mint||token.id}
              token={token}
              isDark={isDark}
              primaryColor={primaryColor}
              onPress={tk => navigation.navigate('TokenDetails', { token:tk })}
              onLongPress={tk => { if (tk.isCustom) handleDelete(tk); }}
            />
          ))}
          {!searchQuery && filtered.length > 5 && (
            <TouchableOpacity style={S.showMoreBtn} onPress={() => setShowAll(v => !v)} activeOpacity={0.7}>
              <Ionicons name={showAll ? 'chevron-up' : 'chevron-down'} size={14} color={C.muted} />
              <Text style={[S.showMoreTxt, { color:C.muted }]}>
                {showAll ? t('market_show_less', 'عرض أقل') : t('market_show_more', 'عرض المزيد من العملات')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>

      <Modal visible={addModal} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={S.modalOverlay}>
          <View style={[
            S.modalBox,
            {
              backgroundColor: C.card,
              paddingBottom: Math.max(insets.bottom, 20) + 12,
            },
          ]}>
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
  headerBtn:   { width:40, height:40, borderRadius:12, justifyContent:'center',
                 alignItems:'center' },

  tickerWrap: {
    height: 54,
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
    paddingHorizontal: 4,
    direction: 'ltr',
  },
  tickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 6,
    direction: 'ltr',
  },
  fxFlagsWrap:   { width: 32, height: 22, marginRight: 4 },
  fxFlagCircle:  { position: 'absolute', left: 0, top: 1, width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  fxFlagCircle2: { left: 12 },
  fxFlagTxt:     { fontSize: 10 },
  fxLeft:        { flex: 1, justifyContent: 'center' },
  fxSymbol:      { fontSize: 11.5, fontWeight: '800', textAlign: 'left' },
  fxNames:       { fontSize: 9, fontWeight: '600', marginTop: 1, textAlign: 'left' },
  fxRight:       { alignItems: 'flex-end', justifyContent: 'center', marginLeft: 4, minWidth: 50 },
  fxPrice:       { fontSize: 12.5, fontWeight: '800', textAlign: 'right' },
  fxChgChip:     { marginTop: 2, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999 },
  fxChgTxt:      { fontSize: 9, fontWeight: '800' },

  searchRow:   { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingTop:12, paddingBottom:12 },
  searchWrap:  { flex:1, flexDirection:'row', alignItems:'center', borderRadius:12, height:44 },
  searchInput: { flex:1, paddingHorizontal:10, fontSize:14, paddingVertical:0 },
  addBtn:      { width:32, height:32, borderRadius:8, justifyContent:'center', alignItems:'center', marginRight:4 },
  cancelBtn:   { paddingLeft:12, paddingVertical:10 },

  scroll:      { paddingHorizontal:20 },

  hero:          { height:HERO_H, borderRadius:22, overflow:'hidden', marginBottom:16, marginHorizontal:-CARD_BREAK, direction:'ltr' },
  heroOrb:       { position:'absolute', width:220, height:220 },
  heroDotWrap:   { position:'absolute', left:0, top:0, width:14, height:14, alignItems:'center', justifyContent:'center' },
  heroDotRing:   { position:'absolute', width:14, height:14, borderRadius:7 },
  heroDotCore:   { width:9, height:9, borderRadius:4.5, shadowOpacity:0.9, shadowRadius:6, shadowOffset:{ width:0, height:0 }, elevation:6 },
  heroTop:       { position:'absolute', top:14, left:16, right:14, flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  heroTitleRow:  { flexDirection:'row', alignItems:'center', gap:7 },
  heroTitle:     { color:'#FFFFFF', fontSize:16, fontWeight:'800' },
  heroTitleSub:  { color:'rgba(255,255,255,0.45)', fontSize:12, fontWeight:'600', marginLeft:-3 },
  heroLivePill:  { flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'rgba(16,185,129,0.14)', paddingHorizontal:8, paddingVertical:3, borderRadius:999, marginLeft:4 },
  heroLiveDot:   { width:6, height:6, borderRadius:3, backgroundColor:'#10B981' },
  heroLiveTxt:   { color:'#10B981', fontSize:10, fontWeight:'800' },
  heroCta:       { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:12, paddingVertical:7, borderRadius:999 },
  heroCtaTxt:    { color:'#FFFFFF', fontSize:12, fontWeight:'800' },
  heroBottom:    { position:'absolute', top:52, left:16, right:16 },
  heroPrice:     { color:'#FFFFFF', fontSize:32, fontWeight:'800', letterSpacing:-0.5, maxWidth:'70%' },
  heroChgChip:   { flexDirection:'row', alignItems:'center', gap:4, alignSelf:'flex-start', paddingHorizontal:9, paddingVertical:3, borderRadius:999, marginTop:10 },
  heroChgTxt:    { fontSize:12, fontWeight:'800' },
  heroChgSub:    { color:'rgba(255,255,255,0.5)', fontSize:10, fontWeight:'600', marginLeft:2 },

  overviewCard:  { borderRadius:18, padding:16, marginBottom:14, marginHorizontal:-CARD_BREAK },
  overviewRow:   { flexDirection:'row', justifyContent:'space-between' },
  overviewItem:  { flex:1, alignItems:'center' },
  overviewLabel: { fontSize:11, marginBottom:4 },
  overviewValue: { fontSize:15, fontWeight:'700' },
  overviewBar:   { flexDirection:'row', alignItems:'center', justifyContent:'center',
                   marginTop:12, paddingVertical:6, borderRadius:12, gap:6 },
  overviewBarTxt:{ fontSize:13, fontWeight:'600' },



  listFlat:    { marginBottom:20 },
  showMoreBtn: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, paddingVertical:14 },
  showMoreTxt: { fontSize:13, fontWeight:'600' },
  tokenRow:    { flexDirection:'row', alignItems:'center', paddingVertical:13, paddingHorizontal:2 },
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
  extList:       { paddingHorizontal: CARD_BREAK, gap: EXT_CARD_GAP },
  updatedTxt:    { fontSize: 10, textAlign: 'center', marginTop: -6, marginBottom: 12 },
  seg:           { flexDirection: 'row', borderRadius: 10, padding: 3, gap: 2 },
  segBtn:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  segTxt:        { fontSize: 11, fontWeight: '700' },
  coinGroup:     { borderRadius: 16, paddingHorizontal: 12, marginHorizontal: -CARD_BREAK, overflow: 'hidden' },
  coinRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  coinRank:      { width: 20, fontSize: 12, textAlign: 'center' },
  coinSym:       { fontSize: 14, fontWeight: '800' },
  coinName:      { fontSize: 11, marginTop: 2 },
  coinPrice:     { fontSize: 14, fontWeight: '700' },
  coinChg:       { fontSize: 12, fontWeight: '700', marginTop: 2 },
  moreCard:      { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', gap: 8, width: 84, paddingHorizontal: 6 },
  moreCircle:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  moreCardTxt:   { fontSize: 12, fontWeight: '700' },
  tradeCard:     { width: 132, padding: 12, borderRadius: 18, gap: 3 },
  tradeTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  tradeChg:      { fontSize: 11, fontWeight: '700' },
  tradeName:     { fontSize: 11 },
  tradePrice:    { fontSize: 13, fontWeight: '700', marginTop: 6, marginBottom: 8 },
  tradeBtn:      { paddingVertical: 7, borderRadius: 10, alignItems: 'center' },
  tradeBtnTxt:   { fontSize: 12, fontWeight: '800' },
  extMoreLink:   { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 10 },
  extMoreTxt:    { fontSize: 14, fontWeight: '700' },
  extCard: {
    width: EXT_CARD_WIDTH,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
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
  modalBox:    { borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, paddingTop:12 },
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
