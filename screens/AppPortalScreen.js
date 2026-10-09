// screens/AppPortalScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, Image, Platform, ActivityIndicator,
  Modal, TextInput, Keyboard, TouchableWithoutFeedback, Animated,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { initWalletConnect, pairWalletConnect } from '../services/walletConnectService';

const { width } = Dimensions.get('window');
const BOOKMARKS_KEY = '@meco_bookmarks';
const HISTORY_KEY   = '@meco_browsing_history';
const GAP     = 12;
const CARD_W  = (width - 40 - GAP) / 2;

const DAPPS = [
  { id:'jupiter',  name:'Jupiter',  icon:'https://assets.coingecko.com/coins/images/34188/large/jup.png',  url:'https://jup.ag',                       category:'trading', badge:'DEX',      featured:true, desc:'أفضل أسعار التبادل على Solana' },
  { id:'marinade', name:'Marinade', icon:'https://assets.coingecko.com/coins/images/18612/large/mnde.png', url:'https://marinade.finance/app/staking', category:'staking', badge:'8.5% APY' },
  { id:'jito',     name:'Jito',     icon:'https://assets.coingecko.com/coins/images/33228/large/jto.png',  url:'https://jito.network/staking',         category:'staking', badge:'9.2% APY' },
  { id:'orca',     name:'Orca',     icon:'https://assets.coingecko.com/coins/images/17547/large/Orca_Logo.png', url:'https://www.orca.so/pools',       category:'pools',   badge:'Pools' },
  { id:'raydium', name:'Raydium', icon:'https://assets.coingecko.com/coins/images/13928/large/PSigc4ie_400x400.jpg', url:'https://raydium.io/liquidity-pools/', category:'pools', badge:'15.5% APY' },
  { id:'meteora',  name:'Meteora',  icon:'https://www.meteora.ag/favicon.ico',                              url:'https://app.meteora.ag',               category:'defi',    badge:'20% APY' },
  { id:'kamino',   name:'Kamino',   icon:'https://www.kamino.finance/favicon.ico',                          url:'https://app.kamino.finance/lend',      category:'defi',    badge:'8% APY' },
  { id:'drift',    name:'Drift',    icon:'https://www.drift.trade/favicon.ico',                              url:'https://app.drift.trade',              category:'trading', badge:'Perps' },
  { id:'solend',   name:'Solend',   icon:'https://solend.fi/favicon.ico',                                    url:'https://solend.fi/dashboard',          category:'defi',    badge:'5% APY' },
];

const CAT_COLOR = {
  staking: '#3B82F6',
  defi:    '#8B5CF6',
  trading: '#10B981',
  pools:   '#F59E0B',
};

const SafeImg = ({ uri, size, radiusRatio = 0.28 }) => {
  const [err, setErr] = useState(false);
  if (err || !uri) return (
    <View style={{ width:size, height:size, borderRadius:size*radiusRatio,
      backgroundColor:'rgba(100,100,160,0.08)', justifyContent:'center', alignItems:'center' }}>
      <Ionicons name="globe-outline" size={size*0.45} color="rgba(100,100,160,0.35)" />
    </View>
  );
  return (
    <Image source={{ uri }}
      style={{ width:size, height:size, borderRadius:size*radiusRatio }}
      onError={() => setErr(true)} />
  );
};

export default function AppPortalScreen() {
  const { t }        = useTranslation();
  const navigation   = useNavigation();
  const route        = useRoute();
  const theme        = useAppStore(s => s.theme);
  const primaryColor = useAppStore(s => s.primaryColor || '#6C63FF');
  const isDark       = theme === 'dark';
  const insets       = useSafeAreaInsets();

  const C = {
    bg:      isDark ? '#07070F' : '#F2F3F7',
    card:    isDark ? '#0F0F1E' : '#FFFFFF',
    card2:   isDark ? '#171730' : '#ECECF4',
    text:    isDark ? '#EEEEFF' : '#0D0D1A',
    muted:   isDark ? '#6E6EA0' : '#9090A8',
    border:  isDark ? '#1E1E38' : '#E4E4F0',
    accent:  primaryColor,
    inputBg: isDark ? '#13132A' : '#EDEDF6',
    danger:  '#EF4444',
  };

  const FILTERS = [
    { id:'all',     label: t('all', 'الكل') },
    { id:'staking', label: t('category_staking', 'Staking') },
    { id:'defi',    label: t('category_defi', 'DeFi') },
    { id:'trading', label: t('category_trading', 'Trading') },
    { id:'pools',   label: t('category_pools', 'Pools') },
  ];

  const [filter,      setFilter]      = useState('all');
  const [view,        setView]        = useState('explore');
  const [search,      setSearch]      = useState('');
  const [bookmarks,   setBookmarks]   = useState([]);
  const [bmLoading,   setBmLoading]   = useState(true);
  const [addVisible,  setAddVisible]  = useState(false);
  const [newBm,       setNewBm]       = useState({ name:'', url:'' });
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
    navigation.navigate('DappBrowser', { url, name });
  }, [navigation]);

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

  const filtered    = filter === 'all' ? DAPPS : DAPPS.filter(d => d.category === filter);
  const heroApp     = filter === 'all' ? DAPPS.find(d => d.featured) : null;
  const gridApps    = heroApp ? filtered.filter(d => d.id !== heroApp.id) : filtered;
  const padTop      = Platform.OS === 'ios' ? insets.top + 10 : insets.top + 18;
  const padBot      = insets.bottom + 80;

  const fmtHistoryTime = (ts) => {
    if (!ts) return '';
    const diffMin = Math.floor((Date.now() - ts) / 60000);
    if (diffMin < 1)   return t('just_now', 'الآن');
    if (diffMin < 60)  return t('minutes_ago', { count: diffMin, defaultValue: `منذ ${diffMin} دقيقة` });
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24)    return t('hours_ago', { count: diffH, defaultValue: `منذ ${diffH} ساعة` });
    return new Date(ts).toLocaleDateString();
  };

  // ── Hero Card ─────────────────────────────────────────────────────────────
  const HeroCard = ({ item }) => {
    const color = CAT_COLOR[item.category] || C.accent;
    return (
      <TouchableOpacity
        style={[S.hero, { backgroundColor:C.card, borderColor:C.border }]}
        onPress={() => openUrl(item.url, item.name)}
        activeOpacity={0.85}
      >
        <View style={[S.heroStripe, { backgroundColor:color }]} />
        <View style={[S.heroIcon, { backgroundColor:color + '14', borderColor:color + '30' }]}>
          <SafeImg uri={item.icon} size={52} radiusRatio={0.28} />
        </View>
        <View style={{ flex:1 }}>
          <View style={S.heroTitleRow}>
            <Text style={[S.heroName, { color:C.text }]}>{item.name}</Text>
            <View style={[S.heroBadge, { backgroundColor:color + '20' }]}>
              <Text style={[S.heroBadgeTxt, { color }]}>{item.badge}</Text>
            </View>
          </View>
          <Text style={[S.heroDesc, { color:C.muted }]} numberOfLines={1}>
            {item.desc || t('featured_app', 'تطبيق مميز')}
          </Text>
          <View style={S.heroOpen}>
            <Text style={[S.heroOpenTxt, { color }]}>
              {t('portal_open_app', 'افتح التطبيق')}
            </Text>
            <Ionicons name="arrow-forward" size={13} color={color} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Dapp Grid Card ────────────────────────────────────────────────────────
  const DappCard = ({ item }) => {
    const color = CAT_COLOR[item.category] || C.accent;
    return (
      <TouchableOpacity
        style={[S.card, { backgroundColor:C.card, borderColor:C.border, width:CARD_W }]}
        onPress={() => openUrl(item.url, item.name)}
        activeOpacity={0.75}
      >
        <View style={[S.iconRing, { borderColor:color + '30', backgroundColor:color + '10' }]}>
          <SafeImg uri={item.icon} size={44} radiusRatio={0.28} />
        </View>
        <Text style={[S.cardName, { color:C.text }]} numberOfLines={1}>{item.name}</Text>
        <View style={[S.cardBadge, { backgroundColor:color + '18' }]}>
          <Text style={[S.cardBadgeTxt, { color }]}>{item.badge}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Bookmark Row ──────────────────────────────────────────────────────────
  const BmRow = ({ item }) => (
    <TouchableOpacity
      style={[S.bmRow, { backgroundColor:C.card, borderColor:C.border }]}
      onPress={() => openUrl(item.url, item.name)}
      onLongPress={() => saveBm(bookmarks.filter(b => b.id !== item.id))}
      delayLongPress={600}
      activeOpacity={0.75}
    >
      <View style={[S.bmIco, { backgroundColor:C.accent + '18' }]}>
        <Ionicons name="globe-outline" size={20} color={C.accent} />
      </View>
      <View style={{ flex:1 }}>
        <Text style={[S.bmName, { color:C.text }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[S.bmUrl, { color:C.muted }]} numberOfLines={1}>
          {item.url.replace(/^https?:\/\//, '')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={C.muted} />
    </TouchableOpacity>
  );

  return (
    <View style={[S.root, { backgroundColor:C.bg, paddingTop:padTop }]}>

      <Animated.View style={{ opacity:fadeAnim, transform:[{ translateY:slideAnim }] }}>
        {/* ── Header ── */}
        <View style={S.headerRow}>
          <View style={{ flex:1 }}>
            <Text style={[S.headerTitle, { color:C.text }]}>
              {t('explore_web3', 'استكشف Web3')}
            </Text>
            <Text style={[S.headerSub, { color:C.muted }]}>
              {t('explore_desc', 'أفضل التطبيقات اللامركزية بين يديك')}
            </Text>
          </View>
        </View>

        {/* ── Search ── */}
        <View style={[S.searchBar, { backgroundColor:C.card, borderColor:C.border }]}>
          <Ionicons name="search-outline" size={16} color={C.muted} style={{ marginLeft:14 }} />
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
            <TouchableOpacity onPress={() => setSearch('')} style={{ paddingHorizontal:8 }}>
              <Ionicons name="close-circle" size={16} color={C.muted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setHistoryOpen(true)}
            style={[S.searchHistoryBtn, { borderLeftColor:C.border }]}
          >
            <Ionicons name="time-outline" size={17} color={C.muted} />
          </TouchableOpacity>
        </View>

        {/* ── Segmented Tabs ── */}
        <View style={[S.segment, { backgroundColor:C.card, borderColor:C.border }]}>
          {[
            { id:'explore',   label: t('discover', 'اكتشف')    },
            { id:'bookmarks', label: t('bookmarks', 'المفضلة') },
          ].map(tab => {
            const on = view === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[S.segBtn, on && { backgroundColor:C.accent }]}
                onPress={() => setView(tab.id)}
                activeOpacity={0.85}
              >
                <Text style={[S.segTxt, { color: on ? '#FFF' : C.muted }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>

      {view === 'explore' ? (
        <Animated.View style={{ flex:1, opacity:fadeAnim }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[S.scrollContent, { paddingBottom: padBot }]}
            keyboardShouldPersistTaps="handled"
          >
            {/* Hero */}
            {heroApp && (
              <View style={{ marginBottom:16 }}>
                <HeroCard item={heroApp} />
              </View>
            )}

            {/* Filters */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={S.filterRow}
              style={{ marginBottom:14 }}
            >
              {FILTERS.map(f => {
                const on = filter === f.id;
                const dotColor = CAT_COLOR[f.id];
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[S.filterBtn, {
                      backgroundColor: on ? C.accent : C.card,
                      borderColor:     on ? C.accent : C.border,
                    }]}
                    onPress={() => setFilter(f.id)}
                    activeOpacity={0.8}
                  >
                    {dotColor && (
                      <View style={[S.filterDot, { backgroundColor: on ? '#FFF' : dotColor }]} />
                    )}
                    <Text style={[S.filterTxt, { color: on ? '#FFF' : C.muted }]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Grid */}
            <View style={S.gridWrap}>
              {gridApps.map(item => <DappCard key={item.id} item={item} />)}
              {gridApps.length % 2 !== 0 && <View style={{ width:CARD_W }} />}
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
          <TouchableOpacity
            style={[S.addBmBtn, { borderColor:C.accent + '40', backgroundColor:C.card }]}
            onPress={() => { setNewBm({ name:'', url:'' }); setAddVisible(true); }}
          >
            <View style={[S.addBmIco, { backgroundColor:C.accent + '18' }]}>
              <Ionicons name="add" size={20} color={C.accent} />
            </View>
            <Text style={[S.addBmTxt, { color:C.accent }]}>
              {t('add_bookmark', 'إضافة مفضلة')}
            </Text>
          </TouchableOpacity>

          {bmLoading
            ? <ActivityIndicator color={C.accent} style={{ marginTop:40 }} />
            : bookmarks.length
              ? bookmarks.map(b => <BmRow key={b.id} item={b} />)
              : (
                <View style={[S.empty, { backgroundColor:C.card, borderColor:C.border }]}>
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

      {/* History Modal */}
      <Modal visible={historyOpen} transparent animationType="slide"
        onRequestClose={() => setHistoryOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setHistoryOpen(false)}>
          <View style={S.overlay}>
            <TouchableWithoutFeedback>
              <View style={[S.sheet, { backgroundColor:C.card, maxHeight:'75%' }]}>
                <View style={[S.handle, { backgroundColor:C.border }]} />
                <View style={S.historyHeader}>
                  <Text style={[S.sheetTitle, { color:C.text, marginBottom:0 }]}>
                    {t('browsing_history', 'سجل التصفح')}
                  </Text>
                  {history.length > 0 && (
                    <TouchableOpacity onPress={clearHistory}>
                      <Text style={[S.clearHistoryTxt, { color:C.danger }]}>
                        {t('clear_history', 'مسح الكل')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop:10 }}>
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
            <View style={[S.sheet, { backgroundColor:C.card }]}>
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
  scrollContent:{ paddingHorizontal:20 },

  // Header
  headerRow:   { flexDirection:'row', alignItems:'flex-start', paddingHorizontal:20, marginBottom:14 },
  headerTitle: { fontSize:24, fontWeight:'800', letterSpacing:-0.4 },
  headerSub:   { fontSize:12, marginTop:3 },

  // Search
  searchBar:   { flexDirection:'row', alignItems:'center', borderRadius:14, borderWidth:1,
                 height:48, marginHorizontal:20, marginBottom:12 },
  searchInput: { flex:1, fontSize:14, height:'100%', paddingHorizontal:10 },
  searchHistoryBtn:{ width:42, height:'100%', justifyContent:'center', alignItems:'center', borderLeftWidth:1 },

  // Segment
  segment:     { flexDirection:'row', marginHorizontal:20, borderRadius:14, borderWidth:1,
                 padding:3, marginBottom:16, gap:3 },
  segBtn:      { flex:1, paddingVertical:10, borderRadius:11, alignItems:'center', justifyContent:'center' },
  segTxt:      { fontSize:13, fontWeight:'700' },

  // Hero
  hero:        { flexDirection:'row', alignItems:'center', padding:16, borderRadius:20,
                 borderWidth:1, gap:14, overflow:'hidden',
                 shadowColor:'#000', shadowOffset:{width:0,height:3},
                 shadowOpacity:0.06, shadowRadius:8, elevation:3 },
  heroStripe:  { position:'absolute', top:0, left:0, bottom:0, width:4 },
  heroIcon:    { width:64, height:64, borderRadius:18, borderWidth:1.5,
                 justifyContent:'center', alignItems:'center' },
  heroTitleRow:{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:4 },
  heroName:    { fontSize:18, fontWeight:'800' },
  heroBadge:   { paddingHorizontal:8, paddingVertical:2, borderRadius:8 },
  heroBadgeTxt:{ fontSize:10, fontWeight:'800' },
  heroDesc:    { fontSize:12, marginBottom:8 },
  heroOpen:    { flexDirection:'row', alignItems:'center', gap:4 },
  heroOpenTxt: { fontSize:12, fontWeight:'800' },

  // Filters
  filterRow:   { paddingRight:20, gap:8, alignItems:'center' },
  filterBtn:   { flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:7,
                 borderRadius:20, borderWidth:1.5, gap:6 },
  filterDot:   { width:6, height:6, borderRadius:3 },
  filterTxt:   { fontSize:12, fontWeight:'700' },

  // Grid
  gridWrap:    { flexDirection:'row', flexWrap:'wrap', gap:GAP },
  card:        { alignItems:'center', paddingVertical:18, paddingHorizontal:10,
                 borderRadius:18, borderWidth:1, gap:10,
                 shadowColor:'#000', shadowOffset:{width:0,height:2},
                 shadowOpacity:0.04, shadowRadius:6, elevation:2 },
  iconRing:    { width:56, height:56, borderRadius:18, borderWidth:1.5,
                 justifyContent:'center', alignItems:'center' },
  cardName:    { fontSize:13, fontWeight:'700', textAlign:'center' },
  cardBadge:   { paddingHorizontal:9, paddingVertical:3, borderRadius:8 },
  cardBadgeTxt:{ fontSize:10, fontWeight:'800' },

  // Bookmarks
  bmList:      { paddingHorizontal:20, paddingTop:4 },
  addBmBtn:    { flexDirection:'row', alignItems:'center', padding:14, borderRadius:16,
                 marginBottom:14, borderWidth:1.5, borderStyle:'dashed', gap:10 },
  addBmIco:    { width:34, height:34, borderRadius:10, justifyContent:'center', alignItems:'center' },
  addBmTxt:    { fontSize:14, fontWeight:'700' },
  bmRow:       { flexDirection:'row', alignItems:'center', padding:14, borderRadius:16,
                 marginBottom:10, borderWidth:1, gap:12 },
  bmIco:       { width:42, height:42, borderRadius:13, justifyContent:'center', alignItems:'center' },
  bmName:      { fontSize:14, fontWeight:'700', marginBottom:2 },
  bmUrl:       { fontSize:11 },
  empty:       { alignItems:'center', padding:32, borderRadius:20, borderWidth:1, marginTop:10, gap:10 },
  emptyIco:    { width:58, height:58, borderRadius:17, justifyContent:'center', alignItems:'center' },
  emptyTitle:  { fontSize:16, fontWeight:'800' },
  emptySub:    { fontSize:12, textAlign:'center', lineHeight:18 },

  // Modal
  overlay:     { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' },
  sheet:       { borderTopLeftRadius:24, borderTopRightRadius:24, padding:22,
                 paddingBottom:Platform.OS==='ios'?38:22 },
  handle:      { width:36, height:4, borderRadius:2, alignSelf:'center', marginBottom:16 },
  sheetTitle:  { fontSize:18, fontWeight:'800', textAlign:'center', marginBottom:16 },
  historyHeader:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  clearHistoryTxt:{ fontSize:13, fontWeight:'700' },
  inp:         { flexDirection:'row', alignItems:'center', borderRadius:12, borderWidth:1,
                 marginBottom:10, height:46 },
  inpTxt:      { flex:1, paddingHorizontal:10, fontSize:14, height:'100%' },
  sheetBtns:   { flexDirection:'row', gap:10, marginTop:6 },
  sheetBtn:    { flex:1, flexDirection:'row', justifyContent:'center', alignItems:'center',
                 paddingVertical:14, borderRadius:12 },
  sheetBtnTxt: { fontSize:14, fontWeight:'800' },
});
