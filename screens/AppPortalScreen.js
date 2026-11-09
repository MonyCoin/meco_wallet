// screens/AppPortalScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, Image, Platform, ActivityIndicator,
  Modal, TextInput, Keyboard, TouchableWithoutFeedback, Animated,
} from 'react-native';
import { useNavigation, useRoute, StackActions } from '@react-navigation/native';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DappBrowserScreen from './DappBrowserScreen';
import { initWalletConnect, pairWalletConnect } from '../services/walletConnectService';

const { width } = Dimensions.get('window');
const BOOKMARKS_KEY = '@meco_bookmarks';
const HISTORY_KEY   = '@meco_browsing_history';
const BANNER_SIDE   = 12;              // هامش البطاقات (مثل المحفظة والسوق)
const BANNER_W      = width - BANNER_SIDE * 2;
const BANNER_GAP    = 10;
const BANNER_AUTO_MS  = 4000;          // مدة بقاء كل بطاقة
const BANNER_PAUSE_MS = 6000;          // مهلة التوقف بعد لمس المستخدم
const BANNER_H      = 84;              // بطاقات مضغوطة (قريبة من Solflare)

const DAPPS = [
  { id:'jupiter',  name:'Jupiter',  icon:'https://assets.coingecko.com/coins/images/34188/large/jup.png',  url:'https://jup.ag',  category:'trading', badge:'DEX',  featured:true },
  { id:'marinade', name:'Marinade', icon:'https://www.google.com/s2/favicons?domain=marinade.finance&sz=128', url:'https://app.marinade.finance/earn/liquid/', category:'staking', badge:'Staking' },
  { id:'jito',     name:'Jito',     icon:'https://assets.coingecko.com/coins/images/33228/large/jto.png',  url:'https://jito.network/staking',         category:'staking', badge:'Staking', iconBg:'#FFFFFF' },
  { id:'orca',     name:'Orca',     icon:'https://assets.coingecko.com/coins/images/17547/large/Orca_Logo.png', url:'https://www.orca.so/pools',       category:'pools',   badge:'Pools' },
  { id:'raydium', name:'Raydium', icon:'https://assets.coingecko.com/coins/images/13928/large/PSigc4ie_400x400.jpg', url:'https://raydium.io/liquidity-pools/', category:'pools', badge:'Pools' },
  { id:'meteora',  name:'Meteora',  icon:'https://assets.coingecko.com/coins/images/69110/standard/meteora.png', url:'https://app.meteora.ag',               category:'defi',    badge:'DeFi' },
  { id:'kamino',   name:'Kamino',   icon:'https://assets.coingecko.com/coins/images/35801/standard/Kamino_200x200.png', url:'https://app.kamino.finance/lend',      category:'defi',    badge:'Lending' },
  { id:'drift',    name:'Drift',    icon:'https://assets.coingecko.com/coins/images/37509/standard/DRIFT.png', url:'https://app.drift.trade',              category:'trading', badge:'Perps' },
  { id:'solend',   name:'Solend',   icon:'https://assets.coingecko.com/coins/images/19573/standard/logo.webp', url:'https://solend.fi/dashboard',          category:'defi',    badge:'Lending' },
];

// تبويبات قسم "اكتشف"
const DISCOVER_TABS = [
  { id:'featured',  labelKey:'portal_tab_featured',  def:'مميز',        apps:['jupiter', 'orca', 'jito'] },
  { id:'earn',      labelKey:'portal_tab_earn',      def:'ربح',         apps:['marinade', 'jito', 'kamino', 'solend'] },
  { id:'ecosystem', labelKey:'portal_tab_ecosystem', def:'نظام بيئي',   apps:['raydium', 'meteora', 'drift'] },
];

// تطبيقات ويب إضافية (قسم "تطبيقات ويب"): أيقونات مربعة من favicon الموقع نفسه
const favicon = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
const WEB_APPS = [
  { id:'coinfactory', name:'Coinfactory', url:'https://coinfactory.app/',     icon:favicon('coinfactory.app'), badge:'Token Tools' },
  { id:'magiceden',   name:'Magic Eden',  url:'https://magiceden.io/',        icon:favicon('magiceden.io'),    badge:'NFT' },
  { id:'tensor',      name:'Tensor',      url:'https://www.tensor.trade/',    icon:favicon('tensor.trade'),    badge:'NFT' },
  { id:'sanctum',     name:'Sanctum',     url:'https://sanctum.so/',          icon:favicon('sanctum.so'),      badge:'Staking' },
  { id:'dexscreener', name:'DEX Screener',url:'https://dexscreener.com/solana', icon:favicon('dexscreener.com'), badge:'Analytics' },
  { id:'birdeye',     name:'Birdeye',     url:'https://birdeye.so/',          icon:favicon('birdeye.so'),      badge:'Analytics' },
  { id:'solscan',     name:'Solscan',     url:'https://solscan.io/',          icon:favicon('solscan.io'),      badge:'Explorer' },
];

// البطاقات المميزة القابلة للتمرير
const BANNERS = [
  { id:'jupiter',  app:'jupiter',  colors:['#3B2FB8', '#241C86'], tKey:'portal_b1_title', sKey:'portal_b1_sub', tDef:'تداول بأفضل سعر',       sDef:'مبادلة فورية عبر Jupiter' },
  { id:'marinade', app:'marinade', colors:['#0E7A6B', '#0A4F47'], tKey:'portal_b2_title', sKey:'portal_b2_sub', tDef:'اربح من SOL',           sDef:'تخزين سائل مع Marinade' },
  { id:'orca',     app:'orca',     colors:['#B4325F', '#7A1F40'], tKey:'portal_b3_title', sKey:'portal_b3_sub', tDef:'وفّر السيولة واربح',    sDef:'مجمعات السيولة على Orca' },
  { id:'drift',    app:'drift',    colors:['#5B3BC4', '#33217D'], tKey:'portal_b4_title', sKey:'portal_b4_sub', tDef:'تداول العقود الدائمة',  sDef:'منصة Drift اللامركزية' },
  { id:'kamino',   app:'kamino',   colors:['#1F5FBF', '#143F80'], tKey:'portal_b5_title', sKey:'portal_b5_sub', tDef:'أقرض واقترض',           sDef:'إقراض لامركزي مع Kamino' },
  { id:'jito',     app:'jito',     colors:['#2F7D32', '#1B4D1E'], tKey:'portal_b6_title', sKey:'portal_b6_sub', tDef:'خزّن SOL مع Jito',       sDef:'عوائد تخزين مع JitoSOL' },
  { id:'coinfactory', app:'coinfactory', colors:['#C2570C', '#8A3C06'], tKey:'portal_b7_title', sKey:'portal_b7_sub', tDef:'أنشئ رمزك',        sDef:'أدوات رموز SPL مع Coinfactory' },
];

const getHost = (url) => {
  try { return url.replace(/^https?:\/\//, '').split('/')[0]; } catch (_) { return ''; }
};

// bg: خلفية فاتحة للشعارات الداكنة (مثل Jito) — label: حرف بديل إن فشل تحميل الصورة
const SafeImg = ({ uri, size, radiusRatio = 0.28, bg, label }) => {
  const [err, setErr] = useState(false);
  const radius = size * radiusRatio;
  if (err || !uri) return (
    <View style={{ width:size, height:size, borderRadius:radius,
      backgroundColor:'rgba(100,100,160,0.18)', justifyContent:'center', alignItems:'center' }}>
      {label
        ? <Text style={{ color:'#FFFFFF', fontSize:size*0.42, fontWeight:'800' }}>{String(label).trim().charAt(0).toUpperCase()}</Text>
        : <Ionicons name="globe-outline" size={size*0.45} color="rgba(140,140,200,0.5)" />}
    </View>
  );
  if (bg) return (
    <View style={{ width:size, height:size, borderRadius:radius, backgroundColor:bg, justifyContent:'center', alignItems:'center' }}>
      <Image source={{ uri }} style={{ width:size*0.72, height:size*0.72, borderRadius:radius*0.6 }} onError={() => setErr(true)} />
    </View>
  );
  return (
    <Image source={{ uri }}
      style={{ width:size, height:size, borderRadius:radius }}
      onError={() => setErr(true)} />
  );
};

export default function AppPortalScreen() {
  const { t }        = useTranslation();
  const navigation   = useNavigation();
  const route        = useRoute();
  const primaryColor = useAppStore(s => s.primaryColor || '#6C63FF');
  const accounts     = useAppStore(s => s.accounts);
  const activeIdx    = useAppStore(s => s.activeAccountIndex);
  const walletName   = useAppStore(s => s.walletName);
  const insets       = useSafeAreaInsets();

  const C = {
    bg:      '#000000',
    card:    '#141414',
    card2:   '#1E1E1E',
    text:    '#F2F2F2',
    muted:   '#8A8A8E',
    border:  '#262626',
    accent:  primaryColor,
    inputBg: '#1E1E1E',
    danger:  '#EF4444',
  };

  const [tab,         setTab]         = useState('featured');
  const [view,        setView]        = useState('explore');
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [bannerIdx,   setBannerIdx]   = useState(0);
  const bannerRef        = useRef(null);
  const bannerIdxRef     = useRef(0);
  const bannerPauseUntil = useRef(0);
  const [search,      setSearch]      = useState('');
  const [bookmarks,   setBookmarks]   = useState([]);
  const [bmLoading,   setBmLoading]   = useState(true);
  const [addVisible,  setAddVisible]  = useState(false);
  const [newBm,       setNewBm]       = useState({ name:'', url:'' });
  const [browserReq,  setBrowserReq]  = useState(null);
  const [browserFrom, setBrowserFrom] = useState(null);
  const [history,     setHistory]     = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue:1, duration:420, useNativeDriver:true }),
      Animated.timing(slideAnim, { toValue:0, duration:420, useNativeDriver:true }),
    ]).start();
    loadBm();
    loadHistory();
    initWalletConnect().catch(() => {});
  }, []);

  useEffect(() => {
    const scanned = route.params?.scannedAddress;
    if (scanned?.startsWith('wc:')) {
      navigation.setParams({ scannedAddress: undefined });
      pairWalletConnect(scanned);
    }
  }, [route.params?.scannedAddress]);

  const loadBm = async () => {
    try {
      const s = await AsyncStorage.getItem(BOOKMARKS_KEY);
      if (s) setBookmarks(JSON.parse(s));
    } catch (_) {} finally { setBmLoading(false); }
  };

  const loadHistory = async () => {
    try {
      const s = await AsyncStorage.getItem(HISTORY_KEY);
      if (s) setHistory(JSON.parse(s));
    } catch (_) {}
  };

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { loadBm(); loadHistory(); });
    return unsub;
  }, [navigation]);

  const saveBm = async (list) => {
    try {
      await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list));
      setBookmarks(list);
    } catch (_) {}
  };

  const addBm = async () => {
    if (!newBm.name.trim() || !newBm.url.trim()) return;
    let url = newBm.url.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    await saveBm([{ id: Date.now().toString(), name: newBm.name.trim(), url }, ...bookmarks]);
    setNewBm({ name:'', url:'' });
    setAddVisible(false);
  };

  const removeHistoryItem = async (id) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated)).catch(() => {});
  };

  const clearHistory = async () => {
    setHistory([]);
    await AsyncStorage.removeItem(HISTORY_KEY).catch(() => {});
  };

  const openUrl = useCallback((url, name) => {
    setHistoryOpen(false);
    setBrowserReq({ id: Date.now() + Math.random(), url, name });
  }, []);

  // فتح رابط من شاشة أخرى (مثل السيولة) داخل المتصفح المدمج
  useEffect(() => {
    const req = route.params?.openUrl;
    if (req?.url) {
      navigation.setParams({ openUrl: undefined });
      openUrl(req.url, req.name);
      setBrowserFrom(req.from || null);
    }
  }, [route.params?.openUrl]);

  // إغلاق المتصفح: إن فُتح من شاشة أخرى (السيولة) نعود إليها، وإلا نعود لواجهة الاستكشاف
  const closeBrowser = useCallback(() => {
    setBrowserReq(null);
    if (browserFrom) {
      const target = browserFrom;
      setBrowserFrom(null);
      // الرجوع إلى تبويب (المحفظة) أو إلى شاشة في الـ Stack (السيولة)
      if (target === 'Wallet') { try { navigation.navigate('Wallet'); } catch (_) {} return; }
      try { navigation.dispatch(StackActions.popTo(target)); } catch (_) { try { navigation.getParent()?.goBack(); } catch (_e) {} }
    }
  }, [browserFrom, navigation]);

  const handleSearch = () => {
    const q = search.trim();
    if (!q) return;
    let url = q;
    if (!url.startsWith('http') && !url.includes('.'))
      url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
    else if (!url.startsWith('http'))
      url = `https://${url}`;
    setSearch('');
    Keyboard.dismiss();
    openUrl(url, 'Web3');
  };

  const avatarLetter = ((accounts?.[activeIdx]?.name || walletName || 'M').trim().charAt(0) || 'M').toUpperCase();
  const padTop = Platform.OS === 'ios' ? insets.top + 10 : insets.top + 18;
  const padBot = insets.bottom + 80;

  const appById = (id) => DAPPS.find(d => d.id === id) || WEB_APPS.find(d => d.id === id);
  const activeTab = DISCOVER_TABS.find(x => x.id === tab) || DISCOVER_TABS[0];
  const discoverApps = activeTab.apps.map(appById).filter(Boolean);
  // المفضلة: مواقع المستخدم المحفوظة، وإن لم توجد تظهر التطبيقات الأساسية
  const favItems = bookmarks.length > 0
    ? bookmarks.map(b => ({ id:b.id, name:b.name, url:b.url, icon: b.iconUrl || `https://www.google.com/s2/favicons?domain=${getHost(b.url)}&sz=128`, removable:true }))
    : ['jupiter', 'orca', 'raydium', 'marinade'].map(appById).filter(Boolean);

  const fmtHistoryTime = (ts) => {
    if (!ts) return '';
    const diffMin = Math.floor((Date.now() - ts) / 60000);
    if (diffMin < 1)   return t('just_now', 'الآن');
    if (diffMin < 60)  return t('minutes_ago', { count: diffMin, defaultValue: `منذ ${diffMin} دقيقة` });
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24)    return t('hours_ago', { count: diffH, defaultValue: `منذ ${diffH} ساعة` });
    return new Date(ts).toLocaleDateString();
  };

  const onBannerScroll = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / (BANNER_W + BANNER_GAP));
    bannerIdxRef.current = i;
    if (i !== bannerIdx) setBannerIdx(i);
  };
  const pauseBanner = () => { bannerPauseUntil.current = Date.now() + BANNER_PAUSE_MS; };

  // حركة تلقائية للبطاقات: كل 4 ثوانٍ تنتقل للتالية وتعود للأولى بعد الأخيرة.
  // تتوقف عند لمس المستخدم وعند فتح المتصفح أو شاشة المفضلة.
  useEffect(() => {
    if (browserReq || view !== 'explore') return undefined;
    bannerIdxRef.current = 0;
    setBannerIdx(0);
    const timer = setInterval(() => {
      if (Date.now() < bannerPauseUntil.current) return;
      const next = (bannerIdxRef.current + 1) % BANNERS.length;
      if (bannerRef.current) bannerRef.current.scrollTo({ x: next * (BANNER_W + BANNER_GAP), animated: true });
    }, BANNER_AUTO_MS);
    return () => clearInterval(timer);
  }, [browserReq, view]);

  const menuItems = [
    { icon:'time-outline',     label: t('browsing_history', 'سجل التصفح'), action: () => setHistoryOpen(true) },
    { icon:'bookmark-outline', label: t('bookmarks', 'المفضلة'),            action: () => setView('bookmarks') },
    { icon:'add-circle-outline', label: t('add_bookmark', 'إضافة مفضلة'),   action: () => { setNewBm({ name:'', url:'' }); setAddVisible(true); } },
    { icon:'qr-code-outline',  label: t('portal_menu_scan', 'مسح QR للاتصال'), action: () => navigation.navigate('QRScanner', { returnTo:'AppPortal' }) },
  ];

  if (browserReq) {
    return <DappBrowserScreen request={browserReq} onClose={closeBrowser} />;
  }

  return (
    <View style={[S.root, { backgroundColor:C.bg, paddingTop:padTop }]}>

      {/* ── Header: حساب + بحث + قائمة ── */}
      <Animated.View style={{ opacity:fadeAnim, transform:[{ translateY:slideAnim }] }}>
        <View style={S.headerRow}>
          <View style={[S.avatar, { backgroundColor:C.card2, borderColor:C.border }]}>
            <Text style={[S.avatarTxt, { color:C.text }]}>{avatarLetter}</Text>
          </View>
          <View style={[S.searchBar, { backgroundColor:C.bg, borderColor:C.border }]}>
            <TextInput
              style={[S.searchInput, { color:C.text }]}
              placeholder={t('browser_search_placeholder', 'ابحث أو أدخل رابطاً...')}
              placeholderTextColor={C.muted}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={handleSearch}
              returnKeyType="go"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={{ paddingHorizontal:6 }}>
                <Ionicons name="close-circle" size={16} color={C.muted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setMenuOpen(true)} style={S.dotsBtn} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
              <Ionicons name="ellipsis-vertical" size={18} color={C.text} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {view === 'explore' ? (
        <Animated.View style={{ flex:1, opacity:fadeAnim }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: padBot }}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── بطاقات مميزة ── */}
            <ScrollView
              horizontal
              pagingEnabled={false}
              snapToInterval={BANNER_W + BANNER_GAP}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal:BANNER_SIDE, gap:BANNER_GAP }}
              ref={bannerRef}
              onScroll={onBannerScroll}
              onScrollBeginDrag={pauseBanner}
              onMomentumScrollEnd={pauseBanner}
              scrollEventThrottle={16}
              style={{ direction:'ltr' }}
            >
              {BANNERS.map(b => {
                const app = appById(b.app);
                return (
                  <TouchableOpacity
                    key={b.id}
                    activeOpacity={0.9}
                    style={[S.banner, { backgroundColor:b.colors[0] }]}
                    onPress={() => app && openUrl(app.url, app.name)}
                  >
                    <View style={[S.bannerOrb, { backgroundColor:b.colors[1], top:-34, right:-24, width:130, height:130, borderRadius:65 }]} />
                    <View style={[S.bannerOrb, { backgroundColor:'rgba(255,255,255,0.07)', bottom:-44, left:-16, width:90, height:90, borderRadius:45 }]} />
                    <View style={{ flex:1, paddingRight:12 }}>
                      <Text style={S.bannerTitle} numberOfLines={2}>{t(b.tKey, b.tDef)}</Text>
                      <Text style={S.bannerSub} numberOfLines={2}>{t(b.sKey, b.sDef)}</Text>
                    </View>
                    <View style={S.bannerIconWrap}>
                      <SafeImg uri={app?.icon} size={44} radiusRatio={0.3} bg={app?.iconBg} label={app?.name} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={S.dotsRow}>
              {BANNERS.map((b, i) => (
                <View key={b.id} style={[S.dot, { backgroundColor: i === bannerIdx ? '#FFFFFF' : 'rgba(255,255,255,0.22)' }]} />
              ))}
            </View>

            {/* ── التطبيقات المفضلة ── */}
            <TouchableOpacity style={S.sectionHead} onPress={() => setView('bookmarks')} activeOpacity={0.7}>
              <Text style={[S.sectionTitle, { color:C.text }]}>{t('portal_favorite_apps', 'التطبيقات المفضلة')}</Text>
              <Ionicons name="chevron-forward" size={18} color={C.text} />
            </TouchableOpacity>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={S.favRow}
              keyboardShouldPersistTaps="handled"
            >
              {favItems.map(f => (
                <TouchableOpacity
                  key={f.id}
                  style={S.favItem}
                  activeOpacity={0.75}
                  onPress={() => openUrl(f.url, f.name)}
                  onLongPress={f.removable ? () => saveBm(bookmarks.filter(b => b.id !== f.id)) : undefined}
                  delayLongPress={600}
                >
                  <SafeImg uri={f.icon} size={58} radiusRatio={0.3} bg={f.iconBg} label={f.name} />
                  <Text style={[S.favName, { color:C.text }]} numberOfLines={1}>{f.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* ── اكتشف ── */}
            <View style={[S.sectionHead, { marginTop:26 }]}>
              <Text style={[S.sectionTitle, { color:C.text }]}>{t('discover', 'اكتشف')}</Text>
            </View>
            <View style={S.tabsRow}>
              {DISCOVER_TABS.map(x => {
                const on = tab === x.id;
                return (
                  <TouchableOpacity key={x.id} style={S.tabBtn} onPress={() => setTab(x.id)} activeOpacity={0.8}>
                    <Text style={[S.tabTxt, { color: on ? C.text : C.muted, fontWeight: on ? '800' : '600' }]}>
                      {t(x.labelKey, x.def)}
                    </Text>
                    <View style={[S.tabLine, { backgroundColor: on ? C.accent : 'transparent' }]} />
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ paddingHorizontal:20 }}>
              {discoverApps.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={S.appRow}
                  activeOpacity={0.75}
                  onPress={() => openUrl(item.url, item.name)}
                >
                  <SafeImg uri={item.icon} size={44} radiusRatio={0.26} bg={item.iconBg} label={item.name} />
                  <View style={{ flex:1 }}>
                    <Text style={[S.appName, { color:C.text }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[S.appDesc, { color:C.muted }]} numberOfLines={1}>
                      {t(`desc_${item.id}`, { defaultValue: item.badge })}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── تطبيقات ويب (أيقونات مربعة، عنوان واحد) ── */}
            <View style={[S.sectionHead, { marginTop:26 }]}>
              <Text style={[S.sectionTitle, { color:C.text }]}>{t('portal_web_apps', 'تطبيقات ويب')}</Text>
            </View>
            <View style={{ paddingHorizontal:20 }}>
              {WEB_APPS.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={S.webRow}
                  activeOpacity={0.75}
                  onPress={() => openUrl(item.url, item.name)}
                >
                  <View style={[S.webIcon, { backgroundColor:C.card }]}>
                    <SafeImg uri={item.icon} size={40} radiusRatio={0.12} label={item.name} />
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={[S.appName, { color:C.text }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[S.appDesc, { color:C.muted }]} numberOfLines={2}>
                      {t(`web_desc_${item.id}`, { defaultValue: item.badge })}
                    </Text>
                    <View style={[S.webChip, { backgroundColor:C.card }]}>
                      <Text style={[S.webChipTxt, { color:C.muted }]}>{item.badge}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </Animated.View>
      ) : (
        <Animated.ScrollView
          style={{ flex:1, opacity:fadeAnim }}
          contentContainerStyle={[S.bmList, { paddingBottom: padBot }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={S.bmHeader}>
            <TouchableOpacity onPress={() => setView('explore')} hitSlop={{ top:10, bottom:10, left:10, right:10 }} style={{ marginRight:10 }}>
              <Ionicons name="arrow-back" size={22} color={C.text} />
            </TouchableOpacity>
            <Text style={[S.sectionTitle, { color:C.text, flex:1 }]}>{t('bookmarks', 'المفضلة')}</Text>
            <TouchableOpacity onPress={() => { setNewBm({ name:'', url:'' }); setAddVisible(true); }} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
              <Ionicons name="add-circle-outline" size={24} color={C.accent} />
            </TouchableOpacity>
          </View>

          {bmLoading
            ? <ActivityIndicator color={C.accent} style={{ marginTop:40 }} />
            : bookmarks.length
              ? bookmarks.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={S.appRow}
                    onPress={() => openUrl(item.url, item.name)}
                    onLongPress={() => saveBm(bookmarks.filter(b => b.id !== item.id))}
                    delayLongPress={600}
                    activeOpacity={0.75}
                  >
                    <SafeImg uri={item.iconUrl || `https://www.google.com/s2/favicons?domain=${getHost(item.url)}&sz=128`} size={44} radiusRatio={0.26} />
                    <View style={{ flex:1 }}>
                      <Text style={[S.appName, { color:C.text }]} numberOfLines={1}>{item.name}</Text>
                      <Text style={[S.appDesc, { color:C.muted }]} numberOfLines={1}>{getHost(item.url)}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              : (
                <View style={S.empty}>
                  <View style={[S.emptyIco, { backgroundColor:C.accent + '18' }]}>
                    <Ionicons name="bookmark-outline" size={30} color={C.accent} />
                  </View>
                  <Text style={[S.emptyTitle, { color:C.text }]}>
                    {t('no_bookmarks_yet', 'لا توجد مفضلة')}
                  </Text>
                  <Text style={[S.emptySub, { color:C.muted }]}>
                    {t('portal_no_bookmarks_hint', 'احفظ المواقع من المتصفح')}
                  </Text>
                </View>
              )
          }
        </Animated.ScrollView>
      )}

      {/* قائمة النقاط الثلاث */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setMenuOpen(false)}>
          <View style={{ flex:1 }}>
            <View style={[S.menu, { top: padTop + 56, backgroundColor:C.card2, borderColor:C.border }]}>
              {menuItems.map((m, i) => (
                <TouchableOpacity
                  key={m.icon}
                  style={[S.menuRow, i > 0 && { borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:C.border }]}
                  activeOpacity={0.7}
                  onPress={() => { setMenuOpen(false); m.action(); }}
                >
                  <Ionicons name={m.icon} size={18} color={C.text} />
                  <Text style={[S.menuTxt, { color:C.text }]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* History Modal */}
      <Modal visible={historyOpen} transparent animationType="slide"
        onRequestClose={() => setHistoryOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setHistoryOpen(false)}>
          <View style={S.overlay}>
            <TouchableWithoutFeedback>
              <View style={[
                S.sheet,
                {
                  backgroundColor: C.card,
                  maxHeight: '75%',
                  paddingBottom: Math.max(insets.bottom, 20) + 12,
                },
              ]}>
                <View style={[S.handle, { backgroundColor:C.border }]} />
                <View style={S.historyHeader}>
                  <Text style={[S.sheetTitle, { color:C.text, marginBottom:0 }]}>
                    {t('browsing_history', 'سجل التصفح')}
                  </Text>
                  <View style={S.historyHeaderActions}>
                    {history.length > 0 && (
                      <TouchableOpacity onPress={clearHistory}>
                        <Text style={[S.clearHistoryTxt, { color:C.danger }]}>
                          {t('clear_history', 'مسح الكل')}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => setHistoryOpen(false)}
                      style={[S.closeBtn, { backgroundColor:C.inputBg }]}
                      hitSlop={{ top:8, bottom:8, left:8, right:8 }}
                    >
                      <Ionicons name="close" size={16} color={C.muted} />
                    </TouchableOpacity>
                  </View>
                </View>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={{ marginTop:10 }}
                  contentContainerStyle={{ paddingBottom: 8 }}
                >
                  {history.length === 0 ? (
                    <View style={[S.empty, { backgroundColor:C.inputBg, borderColor:C.border, marginTop:4 }]}>
                      <View style={[S.emptyIco, { backgroundColor:C.accent + '18' }]}>
                        <Ionicons name="time-outline" size={28} color={C.accent} />
                      </View>
                      <Text style={[S.emptyTitle, { color:C.text }]}>
                        {t('no_history_yet', 'لا يوجد سجل تصفح بعد')}
                      </Text>
                      <Text style={[S.emptySub, { color:C.muted }]}>
                        {t('history_hint', 'ستظهر هنا المواقع التي تزورها')}
                      </Text>
                    </View>
                  ) : history.map(h => (
                    <TouchableOpacity
                      key={h.id}
                      style={[S.bmRow, { backgroundColor:C.inputBg, borderColor:C.border }]}
                      onPress={() => openUrl(h.url, h.name)}
                      onLongPress={() => removeHistoryItem(h.id)}
                      delayLongPress={500}
                      activeOpacity={0.75}
                    >
                      <View style={[S.bmIco, { backgroundColor:C.accent + '18' }]}>
                        <Ionicons name="time-outline" size={18} color={C.accent} />
                      </View>
                      <View style={{ flex:1 }}>
                        <Text style={[S.bmName, { color:C.text }]} numberOfLines={1}>{h.name || h.url}</Text>
                        <Text style={[S.bmUrl, { color:C.muted }]} numberOfLines={1}>
                          {h.url.replace(/^https?:\/\//, '')} · {fmtHistoryTime(h.visitedAt)}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => removeHistoryItem(h.id)} style={{ padding:4 }}>
                        <Ionicons name="close" size={16} color={C.muted} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Add Bookmark Modal */}
      <Modal visible={addVisible} transparent animationType="slide"
        onRequestClose={() => setAddVisible(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={S.overlay}>
            <View style={[
              S.sheet,
              {
                backgroundColor: C.card,
                paddingBottom: Math.max(insets.bottom, 20) + 12,
              },
            ]}>
              <View style={[S.handle, { backgroundColor:C.border }]} />
              <Text style={[S.sheetTitle, { color:C.text }]}>
                {t('add_bookmark', 'إضافة مفضلة')}
              </Text>
              {[
                { field:'name', icon:'text-outline', ph: t('bookmark_name_placeholder','الاسم'),   kb:'default' },
                { field:'url',  icon:'link-outline', ph: t('bookmark_url_placeholder', 'الرابط'), kb:'url'     },
              ].map(f => (
                <View key={f.field} style={[S.inp, { backgroundColor:C.inputBg, borderColor:C.border }]}>
                  <Ionicons name={f.icon} size={15} color={C.muted} style={{ marginLeft:14 }} />
                  <TextInput
                    style={[S.inpTxt, { color:C.text }]}
                    placeholder={f.ph}
                    placeholderTextColor={C.muted}
                    value={newBm[f.field]}
                    onChangeText={v => setNewBm(p => ({ ...p, [f.field]:v }))}
                    keyboardType={f.kb}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              ))}
              <View style={S.sheetBtns}>
                <TouchableOpacity
                  style={[S.sheetBtn, { backgroundColor:C.inputBg }]}
                  onPress={() => setAddVisible(false)}>
                  <Text style={[S.sheetBtnTxt, { color:C.muted }]}>{t('cancel','إلغاء')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[S.sheetBtn, { backgroundColor:C.accent }]}
                  onPress={addBm}>
                  <Ionicons name="bookmark" size={14} color="#FFF" style={{ marginRight:6 }} />
                  <Text style={[S.sheetBtnTxt, { color:'#FFF' }]}>{t('save','حفظ')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  root:        { flex:1 },

  // Header
  headerRow:   { flexDirection:'row', alignItems:'center', paddingHorizontal:20, marginBottom:18, gap:10 },
  avatar:      { width:44, height:44, borderRadius:22, borderWidth:1, justifyContent:'center', alignItems:'center' },
  avatarTxt:   { fontSize:16, fontWeight:'800' },
  searchBar:   { flex:1, flexDirection:'row', alignItems:'center', borderRadius:24, borderWidth:1, height:46, paddingLeft:16 },
  searchInput: { flex:1, fontSize:14, height:'100%' },
  dotsBtn:     { width:42, height:'100%', justifyContent:'center', alignItems:'center' },

  // Banners
  banner:      { width:BANNER_W, height:BANNER_H, borderRadius:20, overflow:'hidden', flexDirection:'row',
                 alignItems:'center', paddingHorizontal:16 },
  bannerOrb:   { position:'absolute' },
  bannerTitle: { color:'#FFFFFF', fontSize:16, fontWeight:'800', marginBottom:3 },
  bannerSub:   { color:'rgba(255,255,255,0.78)', fontSize:12, lineHeight:16 },
  bannerIconWrap:{ width:52, height:52, justifyContent:'center', alignItems:'center' },
  dotsRow:     { flexDirection:'row', justifyContent:'center', gap:7, marginTop:10 },
  dot:         { width:7, height:7, borderRadius:3.5 },

  // Sections
  sectionHead: { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:20, marginTop:24, marginBottom:14 },
  sectionTitle:{ fontSize:22, fontWeight:'800', letterSpacing:-0.3 },

  // Favorites
  favRow:      { paddingHorizontal:20, gap:18 },
  favItem:     { width:74, alignItems:'center', gap:8 },
  favName:     { fontSize:13, fontWeight:'600', textAlign:'center' },

  // Discover tabs
  tabsRow:     { flexDirection:'row', paddingHorizontal:20, gap:22, marginBottom:8 },
  tabBtn:      { paddingTop:6, alignItems:'center' },
  tabTxt:      { fontSize:15 },
  tabLine:     { height:2.5, borderRadius:2, alignSelf:'stretch', marginTop:6 },

  // Flat rows
  appRow:      { flexDirection:'row', alignItems:'center', gap:14, paddingVertical:11 },
  appName:     { fontSize:16, fontWeight:'700' },
  appDesc:     { fontSize:13, marginTop:2 },

  // Web apps (أيقونات مربعة)
  webRow:      { flexDirection:'row', alignItems:'center', gap:14, paddingVertical:10 },
  webIcon:     { width:64, height:64, borderRadius:14, justifyContent:'center', alignItems:'center' },
  webChip:     { alignSelf:'flex-start', paddingHorizontal:9, paddingVertical:3, borderRadius:8, marginTop:6 },
  webChipTxt:  { fontSize:11, fontWeight:'600' },

  // Bookmarks view
  bmList:      { paddingHorizontal:20, paddingTop:4 },
  bmHeader:    { flexDirection:'row', alignItems:'center', marginBottom:12 },
  bmRow:       { flexDirection:'row', alignItems:'center', padding:14, borderRadius:16,
                 marginBottom:10, borderWidth:1, gap:12 },
  bmIco:       { width:42, height:42, borderRadius:13, justifyContent:'center', alignItems:'center' },
  bmName:      { fontSize:14, fontWeight:'700', marginBottom:2 },
  bmUrl:       { fontSize:11 },
  empty:       { alignItems:'center', padding:32, borderRadius:20, borderWidth:1, marginTop:10, gap:10 },
  emptyIco:    { width:58, height:58, borderRadius:17, justifyContent:'center', alignItems:'center' },
  emptyTitle:  { fontSize:16, fontWeight:'800' },
  emptySub:    { fontSize:12, textAlign:'center', lineHeight:18 },

  // Menu
  menu:        { position:'absolute', right:20, minWidth:210, borderRadius:16, borderWidth:1, overflow:'hidden',
                 elevation:12, shadowColor:'#000', shadowOpacity:0.4, shadowRadius:12, shadowOffset:{ width:0, height:6 } },
  menuRow:     { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:14, paddingHorizontal:16 },
  menuTxt:     { fontSize:14, fontWeight:'600' },

  // Modal
  overlay:     { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' },
  sheet:       { borderTopLeftRadius:24, borderTopRightRadius:24, padding:22 },
  handle:      { width:36, height:4, borderRadius:2, alignSelf:'center', marginBottom:16 },
  sheetTitle:  { fontSize:18, fontWeight:'800', textAlign:'center', marginBottom:16 },
  historyHeader:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  historyHeaderActions:{ flexDirection:'row', alignItems:'center', gap:12 },
  clearHistoryTxt:{ fontSize:13, fontWeight:'700' },
  closeBtn:    { width:28, height:28, borderRadius:14, justifyContent:'center', alignItems:'center' },
  inp:         { flexDirection:'row', alignItems:'center', borderRadius:12, borderWidth:1,
                 marginBottom:10, height:46 },
  inpTxt:      { flex:1, paddingHorizontal:10, fontSize:14, height:'100%' },
  sheetBtns:   { flexDirection:'row', gap:10, marginTop:6 },
  sheetBtn:    { flex:1, flexDirection:'row', justifyContent:'center', alignItems:'center',
                 paddingVertical:14, borderRadius:12 },
  sheetBtnTxt: { fontSize:14, fontWeight:'800' },
});
