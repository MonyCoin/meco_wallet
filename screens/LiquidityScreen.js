// screens/LiquidityScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store';
import { getAllPoolStats, orcaPoolUrl, explorerPoolUrl } from '../services/liquidityService';
import {
  listPositions, withdrawPosition, collectPositionFees, SERVICE_FEE_SOL, FEE_COLLECTOR_ADDRESS,
} from '../services/liquidityActions';

const C = {
  bg: '#07070F', card: '#111122', card2: '#171730',
  text: '#EEEEFF', muted: '#7E7EAA', success: '#10B981', warn: '#F59E0B', error: '#EF4444',
};

const STR = {
  ar: {
    title: 'السيولة',
    pools: 'مجمعات MECO على Orca',
    feeTier: 'رسوم المجمع',
    deposit: 'إيداع عبر Orca',
    dep_how_title: 'الإيداع عبر Orca',
    dep_how_body: 'يتم الإيداع على موقع Orca الرسمي ويبقى مالك المركز أنت.\n\n1) اضغط Connect Wallet في الموقع.\n2) اختر WalletConnect ليظهر رمز QR.\n3) التقط لقطة شاشة لرمز QR، ثم اضغط أيقونة QR في شريط المتصفح، واضغط أيقونة مجلد الصور في الماسح واختر اللقطة لقراءة الرمز، ثم وافق على الاتصال.\n4) اضغط Create Position وأكمل الإيداع ووقّع.\n\nلا رسوم خدمة على الإيداع. قد تحتاج VPN.',
    unavailable: 'تعذر تحميل بيانات هذا المجمع الآن',
    mine: 'مراكزي',
    mine_none: 'لا توجد لك حصة في هذا المجمع',
    mine_fail: 'تعذر قراءة حصتك الآن',
    pos_value: 'قيمة المركز',
    pos_fees: 'رسوم متراكمة',
    collect: 'جمع الرسوم',
    withdraw: 'سحب كامل',
    dep_cancel: 'إلغاء',
    wd_ok: 'تم السحب بنجاح',
    col_ok: 'تم جمع الرسوم',
    wd_confirm_title: 'سحب كامل المركز',
    wd_confirm_body: 'سيُسحب المركز بالكامل مع الرسوم ويُغلق. تقريبًا:',
    col_confirm_title: 'جمع الرسوم',
    col_confirm_body: 'ستُنقل الرسوم المتراكمة إلى محفظتك، ويبقى المركز مفتوحًا.',
    choose_pool: 'اختر المجمع',
    go: 'متابعة',
    fail: 'فشلت العملية',
    e_INSUFFICIENT_SOL_FEES: 'تحتاج إلى SOL لرسوم الشبكة.',
    e_POSITION_NOT_FOUND: 'لم يُعثر على المركز في محفظتك.',
    e_NO_KEY: 'تعذر الوصول إلى المفتاح، أعد فتح المحفظة.',
    e_POSITION_LOCKED: 'هذا المركز مقفل بشكل دائم ولا يمكن سحبه.',
    e_TIMEOUT: 'انتهت مهلة المعاملة قبل تأكيدها. لم يُنفَّذ شيء، حاول مرة أخرى.',
    e_CANCELLED: 'أُلغيت العملية.',
    e_GENERIC: 'تعذّر تنفيذ العملية على المجمع. لم يتم خصم شيء سوى رسوم الشبكة إن وُجدت. حاول لاحقًا.',
    e_INSUFFICIENT_MECO: 'رصيد MECO غير كافٍ.',
    e_INSUFFICIENT_SOL: 'رصيد SOL غير كافٍ (يشمل احتياطي الرسوم).',
    e_INSUFFICIENT_OTHER: 'رصيد العملة المقابلة غير كافٍ.',
    e_INVALID_AMOUNT: 'أدخل مبلغًا صحيحًا.',
    e_NOT_SPLASH_POOL: 'هذا المجمع غير مدعوم داخل التطبيق.',
    locked_pos: 'مقفل نهائيًا 🔒',
    manage_note: 'قد تحتاج المراكز المقفلة إلى Orca نفسها.',
    service_fee: 'رسوم الخدمة',
    fee_wallet: 'محفظة رسوم الخدمة',
    vpn_banner: 'تعذر تحميل بيانات المجمعات. قد يكون Orca محجوبًا في منطقتك، فإن لزم شغّل VPN ثم اسحب الشاشة للتحديث. الإيداع والسحب أنفسهما يتمان عبر شبكة سولانا مباشرة.',
    vpn_hint: '(قد يتطلب VPN)',
    tvl: 'حجم المجمع',
    locked_title: 'سيولة المشروع مقفلة نهائيًا',
    locked_sub: 'لا أحد يستطيع سحبها، وتتحقق بنفسك على السلسلة.',
    verify: 'تحقق',
    vol: 'تداول 24س',
    apr: 'العائد التقريبي',
    choose_pool_sub: 'اختر مجمعًا من الأعلى لعرض تفاصيله وحصتك.',
    know_title: 'ما يجب أن تعرفه',
    know_1: 'عائدك من رسوم المتداولين الفعلية فقط، ولا يضمنه المشروع.',
    know_2: 'قد تقل قيمة حصتك عن الاحتفاظ بالعملتين إذا تحرك السعر، والعائد يتبع حجم التداول.',
    know_3: 'تسحب في أي وقت. رسوم الخدمة 0.0005 SOL على السحب فقط.',
    note: 'العائد تقدير من رسوم آخر 24 ساعة وليس وعدًا. البيانات من Orca.',
  },
  en: {
    title: 'Liquidity',
    pools: 'MECO pools on Orca',
    feeTier: 'Pool fee',
    deposit: 'Deposit via Orca',
    dep_how_title: 'Deposit via Orca',
    dep_how_body: 'The deposit is made on the official Orca site and you remain the owner of the position.\n\n1) Tap Connect Wallet on the site.\n2) Choose WalletConnect to show a QR code.\n3) Take a screenshot of the QR code, tap the QR icon in the browser bar, tap the gallery icon in the scanner and pick the screenshot to read the code, then approve the connection.\n4) Tap Create Position, complete the deposit and sign.\n\nNo service fee on deposits. A VPN may be required.',
    unavailable: 'Could not load this pool right now',
    mine: 'My positions',
    mine_none: 'You have no position in this pool',
    mine_fail: 'Could not read your position now',
    pos_value: 'Position value',
    pos_fees: 'Accrued fees',
    collect: 'Collect fees',
    withdraw: 'Withdraw all',
    dep_cancel: 'Cancel',
    wd_ok: 'Withdrawal successful',
    col_ok: 'Fees collected',
    wd_confirm_title: 'Withdraw whole position',
    wd_confirm_body: 'The whole position will be withdrawn with its fees and closed. Approximately:',
    col_confirm_title: 'Collect fees',
    col_confirm_body: 'Accrued fees will be sent to your wallet; the position stays open.',
    choose_pool: 'Choose a pool',
    go: 'Continue',
    fail: 'Operation failed',
    e_INSUFFICIENT_SOL_FEES: 'You need SOL for network fees.',
    e_POSITION_NOT_FOUND: 'Position not found in your wallet.',
    e_NO_KEY: 'Could not access the key, reopen the wallet.',
    e_POSITION_LOCKED: 'This position is permanently locked and cannot be withdrawn.',
    e_TIMEOUT: 'The transaction expired before confirmation. Nothing was executed, try again.',
    e_CANCELLED: 'Operation cancelled.',
    e_GENERIC: 'The operation could not be completed on the pool. Nothing was charged except possible network fees. Try again later.',
    e_INSUFFICIENT_MECO: 'Not enough MECO.',
    e_INSUFFICIENT_SOL: 'Not enough SOL (including the fee reserve).',
    e_INSUFFICIENT_OTHER: 'Not enough of the paired token.',
    e_INVALID_AMOUNT: 'Enter a valid amount.',
    e_NOT_SPLASH_POOL: 'This pool is not supported in the app.',
    locked_pos: 'Permanently locked 🔒',
    manage_note: 'Locked positions may need Orca itself.',
    service_fee: 'Service fee',
    fee_wallet: 'Service fee wallet',
    vpn_banner: 'Could not load pool data. Orca may be blocked in your region; if so, turn on a VPN and pull to refresh. Deposits and withdrawals themselves run directly on the Solana network.',
    vpn_hint: '(may need a VPN)',
    tvl: 'Pool size',
    locked_title: 'Project liquidity is permanently locked',
    locked_sub: 'Nobody can withdraw it. Verify it yourself on-chain.',
    verify: 'Verify',
    vol: '24h volume',
    apr: 'Est. yield',
    choose_pool_sub: 'Pick a pool above to see its details and your position.',
    know_title: 'Good to know',
    know_1: 'Your yield comes only from real trading fees; the project does not guarantee it.',
    know_2: 'Your share may be worth less than holding both tokens if the price moves, and yield follows trading volume.',
    know_3: 'Withdraw anytime. Service fee is 0.0005 SOL on withdrawals only.',
    note: 'Yield is an estimate from the last 24h of fees, not a promise. Data from Orca.',
  },
};

const usd = (v) => {
  if (v === null || v === undefined) return '—';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(2) + 'K';
  return '$' + v.toFixed(2);
};
const pct = (v, d = 2) => (v === null || v === undefined) ? '—' : v.toFixed(d) + '%';
const amt = (v, d = 4) => (v === null || v === undefined) ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: d });

function errText(S, e) {
  const code = String((e && e.message) || e || '');
  const known = S['e_' + code];
  if (known) return known;
  // رسائل الشبكة الخام: لا تُعرض للمستخدم
  if (/locked/i.test(code)) return S.e_POSITION_LOCKED;
  if (/insufficient lamports|insufficient funds|Attempt to debit/i.test(code)) return S.e_INSUFFICIENT_SOL_FEES;
  if (/blockhash|block height exceeded|expired/i.test(code)) return S.e_TIMEOUT;
  if (/User rejected|cancel/i.test(code)) return S.e_CANCELLED;
  if (/Simulation failed|custom program error|Transaction simulation|failed to send/i.test(code)) {
    const m = code.match(/custom program error: (0x[0-9a-f]+)/i);
    // اسم الخطأ كما تسجله الشبكة (للتشخيص)
    const nm = code.match(/Error Code: (\w+)/);
    const ms = code.match(/Error Message: ([^."\\]+)/);
    return S.e_GENERIC + (m ? ` (${m[1]})` : '') + (nm ? `\n${nm[1]}` : '') + (ms ? ` — ${ms[1].trim()}` : '');
  }
  return `${S.fail}\n${code.slice(0, 140)}`;
}

export default function LiquidityScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();
  const primary = useAppStore(s => s.primaryColor || '#6C63FF');
  const privateKey = useAppStore(s => s.walletPrivateKey);
  const S = (i18n.language || 'ar').startsWith('ar') ? STR.ar : STR.en;

  const [pools, setPools] = useState([]);
  const [positions, setPositions] = useState(null);   // null=لم يُحمّل، 'error'، أو مصفوفة
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState(null);
  const [tab, setTab] = useState(null);   // لا مجمع افتراضي: يختار المستخدم
  const mounted = useRef(true);

  const owner = useAppStore(s => {
    const acc = s.accounts && s.accounts[s.activeAccountIndex];
    return acc ? acc.publicKey : null;
  });

  useEffect(() => { navigation.setOptions({ title: S.title }); }, [navigation, S.title]);

  const loadPositions = useCallback(async () => {
    if (!owner) { setPositions([]); return; }
    try {
      const list = await listPositions(owner, true);
      if (mounted.current) setPositions(list);
    } catch (e) {
      if (mounted.current) setPositions('error');
    }
  }, [owner]);

  const load = useCallback(async () => {
    const data = await getAllPoolStats(true);
    if (mounted.current) { setPools(data); setLoading(false); setRefreshing(false); }
    await loadPositions();
  }, [loadPositions]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => { mounted.current = false; };
  }, [load]);

  const openUrl = (url, name) => navigation.navigate('DappBrowser', { url, name });

  const runAction = (key, fn, okTitle) => {
    setBusyKey(key);
    fn()
      .then(() => {
        Alert.alert(okTitle);
        setTimeout(() => { loadPositions(); }, 2500);
      })
      .catch(e => Alert.alert(S.fail, errText(S, e)))
      .finally(() => { if (mounted.current) setBusyKey(null); });
  };

  const onDeposit = (pool) => {
    Alert.alert(S.dep_how_title, S.dep_how_body, [
      { text: S.dep_cancel, style: 'cancel' },
      { text: S.go, onPress: () => openUrl(orcaPoolUrl(pool.address), 'Orca') },
    ]);
  };

  const onWithdraw = (pos) => {
    Alert.alert(
      S.wd_confirm_title,
      `${S.wd_confirm_body}\n${amt(pos.mecoAmount)} MECO + ${amt(pos.otherAmount)} ${pos.otherSymbol}` +
      (pos.feeMeco !== null ? `\n${S.pos_fees}: ${amt(pos.feeMeco)} MECO + ${amt(pos.feeOther)} ${pos.otherSymbol}` : '') +
      `\n${S.service_fee}: ${SERVICE_FEE_SOL} SOL` +
      `\n\n${S.manage_note}`,
      [
        { text: S.dep_cancel, style: 'cancel' },
        { text: S.go, style: 'destructive', onPress: () => runAction('w' + pos.address, () => withdrawPosition({ privateKey, positionAddress: pos.address }), S.wd_ok) },
      ],
    );
  };

  const onCollect = (pos) => {
    Alert.alert(S.col_confirm_title, S.col_confirm_body, [
      { text: S.dep_cancel, style: 'cancel' },
      { text: S.go, onPress: () => runAction('c' + pos.address, () => collectPositionFees({ privateKey, positionAddress: pos.address }), S.col_ok) },
    ]);
  };

  const Stat = ({ label, value, color }) => (
    <View style={st.stat}>
      <Text style={[st.statVal, color && { color }]} numberOfLines={1}>{value}</Text>
      <Text style={st.statLbl} numberOfLines={1}>{label}</Text>
    </View>
  );

  const Row = ({ label, value, color }) => (
    <View style={st.row}>
      <Text style={st.rowLabel}>{label}</Text>
      <Text style={[st.rowValue, color && { color }]}>{value}</Text>
    </View>
  );

  const renderMine = (p) => {
    let body;
    if (positions === null) body = <ActivityIndicator color={primary} style={{ marginVertical: 8 }} />;
    else if (positions === 'error') body = <Text style={st.unavailable}>{S.mine_fail}</Text>;
    else {
      const mine = positions.filter(x => x.poolId === p.id);
      if (mine.length === 0) body = <Text style={st.unavailable}>{S.mine_none}</Text>;
      else body = mine.map(pos => (
        <View key={pos.address} style={st.posBox}>
          <Row label={S.pos_value} value={`${amt(pos.mecoAmount)} MECO + ${amt(pos.otherAmount)} ${pos.otherSymbol}`} />
          {pos.feeMeco !== null && (
            <Row label={S.pos_fees} value={`${amt(pos.feeMeco)} MECO + ${amt(pos.feeOther, 6)} ${pos.otherSymbol}`} color={C.success} />
          )}
          <View style={st.posBtns}>
            <TouchableOpacity style={[st.smallBtn, { backgroundColor: C.card }]} disabled={!!busyKey}
              onPress={() => onCollect(pos)}>
              {busyKey === 'c' + pos.address
                ? <ActivityIndicator size="small" color={primary} />
                : <Text style={[st.smallTxt, { color: primary }]}>{S.collect}</Text>}
            </TouchableOpacity>
            {pos.locked ? (
              <View style={[st.smallBtn, { backgroundColor: C.card }]}>
                <Text style={[st.smallTxt, { color: C.muted }]}>{S.locked_pos}</Text>
              </View>
            ) : (
              <TouchableOpacity style={[st.smallBtn, { backgroundColor: C.card }]} disabled={!!busyKey}
                onPress={() => onWithdraw(pos)}>
                {busyKey === 'w' + pos.address
                  ? <ActivityIndicator size="small" color={C.error} />
                  : <Text style={[st.smallTxt, { color: C.error }]}>{S.withdraw}</Text>}
              </TouchableOpacity>
            )}
          </View>
        </View>
      ));
    }
    return (
      <View style={st.mine}>
        <Text style={st.mineTitle}>{S.mine}</Text>
        {body}
      </View>
    );
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={primary}
          onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={st.card}>
          <View style={st.lockHead}>
            <View style={st.lockIcon}><Ionicons name="lock-closed" size={18} color={C.success} /></View>
            <View style={{ flex: 1 }}>
              <Text style={st.lockTitle}>{S.locked_title}</Text>
              <Text style={st.lockSub}>{S.locked_sub}</Text>
            </View>
          </View>
          <View style={st.chips}>
            {pools.map(p => (
              <TouchableOpacity key={p.id} style={st.chip} onPress={() => openUrl(explorerPoolUrl(p.address), p.label)}>
                <Ionicons name="shield-checkmark-outline" size={14} color={primary} />
                <Text style={[st.chipTxt, { color: primary }]}>{S.verify} · {p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {!loading && pools.length > 0 && pools.every(p => p.error) && (
          <View style={st.banner}>
            <Ionicons name="information-circle-outline" size={18} color={C.warn} />
            <Text style={st.bannerTxt}>{S.vpn_banner}</Text>
          </View>
        )}

        <View style={st.tabs}>
          {[{ id: 'sol', label: 'MECO/SOL' }, { id: 'usdt', label: 'MECO/USDT' }].map(tb => (
            <TouchableOpacity key={tb.id} style={[st.tab, tab === tb.id && { backgroundColor: primary }]}
              onPress={() => setTab(tb.id)} activeOpacity={0.8}>
              <Text style={[st.tabTxt, tab === tb.id && { color: '#fff' }]}>{tb.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={primary} style={{ marginVertical: 40 }} />
        ) : !tab ? (
          <View style={st.card}>
            <Text style={st.poolTitle}>{S.choose_pool}</Text>
            <Text style={st.body}>{S.choose_pool_sub}</Text>
          </View>
        ) : pools.filter(p => p.id === tab).map(p => (
          <View key={p.id} style={st.card}>
            <View style={st.poolHead}>
              <Text style={st.poolTitle}>{p.pair || p.label}</Text>
              {!p.error && p.feePct !== null && p.feePct !== undefined && (
                <Text style={st.poolSub}>{S.feeTier} {pct(p.feePct)}</Text>
              )}
            </View>
            {p.error ? (
              <Text style={st.unavailable}>{S.unavailable}</Text>
            ) : (
              <View style={st.stats}>
                <Stat label={S.tvl} value={usd(p.tvl)} />
                <Stat label={S.vol} value={usd(p.volume24h)} />
                <Stat label={S.apr} value={pct(p.aprPct)} color={p.aprPct ? C.success : undefined} />
              </View>
            )}

            {renderMine(p)}

            <View style={st.actions}>
              <TouchableOpacity style={[st.addBtn, { backgroundColor: primary }]} disabled={!!busyKey}
                onPress={() => onDeposit(p)}>
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <Text style={st.addTxt}>{S.deposit}</Text>
              </TouchableOpacity>
              <Text style={st.hint}>{S.vpn_hint}</Text>
            </View>
          </View>
        ))}

        <View style={st.card}>
          <Text style={st.poolTitle}>{S.know_title}</Text>
          <Text style={st.body}>• {S.know_1}</Text>
          <Text style={st.body}>• {S.know_2}</Text>
          <Text style={st.body}>• {S.know_3}</Text>
          <TouchableOpacity style={st.linkBtn} onPress={() => openUrl(`https://solscan.io/account/${FEE_COLLECTOR_ADDRESS}`, 'Solscan')}>
            <Ionicons name="wallet-outline" size={16} color={primary} />
            <Text style={[st.linkTxt, { color: primary }]}>{S.fee_wallet}</Text>
          </TouchableOpacity>
        </View>

        <Text style={st.footer}>{S.note}</Text>
      </ScrollView>

    </>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12 },
  lockHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lockIcon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(16,185,129,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card2, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  chipTxt: { fontSize: 12, fontWeight: '700' },
  poolHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  poolSub: { color: C.muted, fontSize: 12 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: C.card2, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center' },
  statVal: { color: C.text, fontSize: 15, fontWeight: '800' },
  statLbl: { color: C.muted, fontSize: 11, marginTop: 4 },
  lockTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  lockSub: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  linkTxt: { fontSize: 13, fontWeight: '600' },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 20, alignItems: 'center' },
  tabTxt: { color: C.muted, fontSize: 13, fontWeight: '700' },
  poolTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, gap: 10 },
  rowLabel: { color: C.muted, fontSize: 13 },
  rowValue: { color: C.text, fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  unavailable: { color: C.muted, fontSize: 13, paddingVertical: 8 },
  mine: { backgroundColor: C.card2, borderRadius: 12, padding: 12, marginTop: 10 },
  mineTitle: { color: C.text, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  posBox: { marginTop: 6 },
  posBtns: { flexDirection: 'row', gap: 8, marginTop: 8 },
  smallBtn: { flex: 1, borderRadius: 20, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  smallTxt: { fontSize: 13, fontWeight: '700' },
  actions: { marginTop: 12 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 24, paddingVertical: 12,
  },
  addTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  body: { color: C.muted, fontSize: 13, lineHeight: 21, marginTop: 4 },
  footer: { color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 8, lineHeight: 17 },
  banner: { flexDirection: 'row', gap: 10, backgroundColor: 'rgba(245,158,11,0.10)', borderRadius: 14, padding: 12, marginBottom: 12 },
  bannerTxt: { flex: 1, color: C.warn, fontSize: 12, lineHeight: 18 },
  hint: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
});
