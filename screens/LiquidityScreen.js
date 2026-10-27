// screens/LiquidityScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
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
    locked_title: 'السيولة مقفلة نهائيًا',
    locked_sub: 'سيولة MECO في المجمعين مقفلة بشكل دائم ولا يستطيع أحد سحبها، ويمكنك التحقق من ذلك بنفسك على السلسلة.',
    verify: 'تحقق على السلسلة',
    pools: 'مجمعات MECO على Orca',
    tvl: 'حجم المجمع', vol: 'التداول (24س)', fees: 'الرسوم (24س)', apr: 'عائد الرسوم التقريبي',
    feeTier: 'رسوم المجمع',
    apr_note: 'تقدير سنوي محسوب من رسوم آخر 24 ساعة، ويتغير مع حجم التداول وليس وعدًا بعائد.',
    deposit: 'إيداع عبر Orca', open_orca: 'فتح على Orca',
    dep_how_title: 'الإيداع عبر Orca',
    dep_how_body: 'يتم الإيداع على موقع Orca الرسمي ويبقى مالك المركز أنت.\n\n1) اضغط Connect Wallet في الموقع.\n2) اختر WalletConnect ليظهر رمز QR.\n3) اضغط أيقونة QR في شريط المتصفح وامسح الرمز ثم وافق على الاتصال.\n4) اضغط Create Position وأكمل الإيداع ووقّع.\n\nلا رسوم خدمة على الإيداع. قد تحتاج VPN.',
    unavailable: 'تعذر تحميل بيانات هذا المجمع الآن',
    mine: 'مراكزي', mine_none: 'لا توجد لك حصة في هذا المجمع', mine_fail: 'تعذر قراءة حصتك الآن',
    pos_value: 'قيمة المركز', pos_fees: 'رسوم متراكمة', collect: 'جمع الرسوم', withdraw: 'سحب كامل',
    how_title: 'كيف يعمل؟',
    how_1: 'تضع MECO مع العملة المقابلة في المجمع، فتحصل على حصة من رسوم كل عملية تداول تجري فيه.',
    how_2: 'العائد يأتي من رسوم المتداولين الفعلية فقط، ولا يحدده المشروع ولا يضمنه.',
    risk_title: 'مخاطر يجب معرفتها',
    risk_1: 'الخسارة المؤقتة: عند تحرك السعر قد تتغير نسبة MECO إلى العملة الأخرى في حصتك، وقد تقل قيمتها مقارنة بالاحتفاظ بالعملتين.',
    risk_2: 'العائد يتناسب مع حجم التداول، فإذا قل التداول قل العائد.',
    risk_3: 'يمكنك سحب حصتك في أي وقت، لكن قيمتها حينها تتبع سعر السوق.',
    footer: 'البيانات من Orca (وGeckoTerminal عند تعذرها)، وتُحدَّث عند السحب للأسفل.',
    // الإيداع
    dep_title: 'إيداع في مجمع', dep_amount: 'مبلغ MECO', dep_max: 'الأقصى',
    dep_balance: 'رصيدك', dep_need: 'ستحتاج إلى', dep_need_max: 'الحد الأقصى بعد الانزلاق',
    dep_fees_note: 'تكلفة الشبكة وإيجار حساب المركز يُدفعان من SOL (نحو 0.01).',
    dep_confirm: 'تأكيد الإيداع', dep_cancel: 'إلغاء', dep_calc: 'جارٍ الحساب...',
    dep_confirm_title: 'تأكيد الإيداع',
    dep_ok: 'تم الإيداع بنجاح', wd_ok: 'تم السحب بنجاح', col_ok: 'تم جمع الرسوم',
    wd_confirm_title: 'سحب كامل المركز',
    wd_confirm_body: 'سيُسحب المركز بالكامل مع الرسوم ويُغلق. تقريبًا:',
    col_confirm_title: 'جمع الرسوم',
    col_confirm_body: 'ستُنقل الرسوم المتراكمة إلى محفظتك، ويبقى المركز مفتوحًا.',
    choose_pool: 'اختر المجمع', choose_pool_sub: 'اختر MECO/SOL أو MECO/USDT من الأعلى لعرض تفاصيله وحصتك وإضافة السيولة.',
    go: 'متابعة', fail: 'فشلت العملية',
    e_INSUFFICIENT_MECO: 'رصيد MECO غير كافٍ.',
    e_INSUFFICIENT_SOL: 'رصيد SOL غير كافٍ (يشمل احتياطي الرسوم).',
    e_INSUFFICIENT_OTHER: 'رصيد العملة المقابلة غير كافٍ.',
    e_INSUFFICIENT_SOL_FEES: 'تحتاج إلى SOL لرسوم الشبكة.',
    e_INVALID_AMOUNT: 'أدخل مبلغًا صحيحًا.',
    e_NOT_SPLASH_POOL: 'هذا المجمع غير مدعوم داخل التطبيق.',
    e_POSITION_NOT_FOUND: 'لم يُعثر على المركز في محفظتك.',
    e_NO_KEY: 'تعذر الوصول إلى المفتاح، أعد فتح المحفظة.',
    e_POSITION_LOCKED: 'هذا المركز مقفل بشكل دائم ولا يمكن سحبه.',
    e_TIMEOUT: 'انتهت مهلة المعاملة قبل تأكيدها. لم يُنفَّذ شيء، حاول مرة أخرى.',
    e_CANCELLED: 'أُلغيت العملية.',
    e_GENERIC: 'تعذّر تنفيذ العملية على المجمع. لم يتم خصم شيء سوى رسوم الشبكة إن وُجدت. حاول لاحقًا.',
    locked_pos: 'مقفل نهائيًا 🔒',
    manage_note: 'قد تحتاج المراكز المقفلة إلى Orca نفسها.',
    service_fee: 'رسوم الخدمة',
    fee_info: 'رسوم خدمة التطبيق 0.0005 SOL على السحب فقط (لا رسوم على الإيداع ولا على جمع الرسوم). تُجمع في محفظة معلنة وتُضاف إلى دعم المشروع وسيولته.',
    fee_wallet: 'محفظة رسوم الخدمة',
    vpn_banner: 'تعذر تحميل بيانات المجمعات. قد يكون Orca محجوبًا في منطقتك، فإن لزم شغّل VPN ثم اسحب الشاشة للتحديث. الإيداع والسحب أنفسهما يتمان عبر شبكة سولانا مباشرة.',
    vpn_hint: '(قد يتطلب VPN)',
    f_meco: 'MECO', f_meco_sub: 'أنت تدخل المبلغ',
    f_other_sub: 'يُحسب تلقائيًا بسعر المجمع',
    f_fee: 'رسوم الخدمة',
  },
  en: {
    title: 'Liquidity',
    locked_title: 'Liquidity is permanently locked',
    locked_sub: 'MECO liquidity in both pools is locked for good and nobody can withdraw it. You can verify this yourself on-chain.',
    verify: 'Verify on-chain',
    pools: 'MECO pools on Orca',
    tvl: 'Pool size', vol: 'Volume (24h)', fees: 'Fees (24h)', apr: 'Approx. fee yield',
    feeTier: 'Pool fee',
    apr_note: 'Yearly estimate based on the last 24h of fees. It changes with trading volume and is not a promised return.',
    deposit: 'Deposit via Orca', open_orca: 'Open on Orca',
    dep_how_title: 'Deposit via Orca',
    dep_how_body: 'The deposit is made on the official Orca site and you remain the owner of the position.\n\n1) Tap Connect Wallet on the site.\n2) Choose WalletConnect to show a QR code.\n3) Tap the QR icon in the browser bar, scan the code and approve the connection.\n4) Tap Create Position, complete the deposit and sign.\n\nNo service fee on deposits. A VPN may be required.',
    unavailable: 'Could not load this pool right now',
    mine: 'My positions', mine_none: 'You have no position in this pool', mine_fail: 'Could not read your position now',
    pos_value: 'Position value', pos_fees: 'Accrued fees', collect: 'Collect fees', withdraw: 'Withdraw all',
    how_title: 'How it works',
    how_1: 'You deposit MECO with the paired token and earn a share of the fees from every trade in the pool.',
    how_2: 'Yield comes only from real trading fees. The project neither sets nor guarantees it.',
    risk_title: 'Risks to know',
    risk_1: 'Impermanent loss: when the price moves, your MECO/other-token mix changes and may be worth less than simply holding both.',
    risk_2: 'Yield follows trading volume; lower volume means lower yield.',
    risk_3: 'You can withdraw anytime, but the value then follows the market price.',
    footer: 'Data from Orca (GeckoTerminal as fallback). Pull down to refresh.',
    dep_title: 'Deposit into pool', dep_amount: 'MECO amount', dep_max: 'Max',
    dep_balance: 'Balance', dep_need: 'You will need', dep_need_max: 'Maximum after slippage',
    dep_fees_note: 'Network fee and position account rent are paid in SOL (about 0.01).',
    dep_confirm: 'Confirm deposit', dep_cancel: 'Cancel', dep_calc: 'Calculating...',
    dep_confirm_title: 'Confirm deposit',
    dep_ok: 'Deposit successful', wd_ok: 'Withdrawal successful', col_ok: 'Fees collected',
    wd_confirm_title: 'Withdraw whole position',
    wd_confirm_body: 'The whole position will be withdrawn with its fees and closed. Approximately:',
    col_confirm_title: 'Collect fees',
    col_confirm_body: 'Accrued fees will be sent to your wallet; the position stays open.',
    choose_pool: 'Choose a pool', choose_pool_sub: 'Pick MECO/SOL or MECO/USDT above to see its details, your position and add liquidity.',
    go: 'Continue', fail: 'Operation failed',
    e_INSUFFICIENT_MECO: 'Not enough MECO.',
    e_INSUFFICIENT_SOL: 'Not enough SOL (including the fee reserve).',
    e_INSUFFICIENT_OTHER: 'Not enough of the paired token.',
    e_INSUFFICIENT_SOL_FEES: 'You need SOL for network fees.',
    e_INVALID_AMOUNT: 'Enter a valid amount.',
    e_NOT_SPLASH_POOL: 'This pool is not supported in the app.',
    e_POSITION_NOT_FOUND: 'Position not found in your wallet.',
    e_NO_KEY: 'Could not access the key, reopen the wallet.',
    e_POSITION_LOCKED: 'This position is permanently locked and cannot be withdrawn.',
    e_TIMEOUT: 'The transaction expired before confirmation. Nothing was executed, try again.',
    e_CANCELLED: 'Operation cancelled.',
    e_GENERIC: 'The operation could not be completed on the pool. Nothing was charged except possible network fees. Try again later.',
    locked_pos: 'Permanently locked 🔒',
    manage_note: 'Locked positions may need Orca itself.',
    service_fee: 'Service fee',
    fee_info: 'App service fee of 0.0005 SOL on withdrawals only (no fee on deposits or on collecting fees). It goes to a public wallet that supports the project and its liquidity.',
    fee_wallet: 'Service fee wallet',
    vpn_banner: 'Could not load pool data. Orca may be blocked in your region; if so, turn on a VPN and pull to refresh. Deposits and withdrawals themselves run directly on the Solana network.',
    vpn_hint: '(may need a VPN)',
    f_meco: 'MECO', f_meco_sub: 'You enter the amount',
    f_other_sub: 'Calculated automatically at the pool price',
    f_fee: 'Service fee',
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
  const [posDebug, setPosDebug] = useState('');
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
      if (mounted.current) { setPositions(list); setPosDebug(list.debug || ''); }
    } catch (e) {
      if (mounted.current) { setPositions('error'); setPosDebug(String((e && e.message) || e).slice(0, 160)); }
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

  const Row = ({ label, value, color }) => (
    <View style={st.row}>
      <Text style={st.rowLabel}>{label}</Text>
      <Text style={[st.rowValue, color && { color }]}>{value}</Text>
    </View>
  );

  const renderMine = (p) => {
    let body;
    if (positions === null) body = <ActivityIndicator color={primary} style={{ marginVertical: 8 }} />;
    else if (positions === 'error') body = <><Text style={st.unavailable}>{S.mine_fail}</Text><Text style={[st.unavailable, { fontSize: 10 }]}>{posDebug}</Text></>;
    else {
      const mine = positions.filter(x => x.poolId === p.id);
      if (mine.length === 0) body = <><Text style={st.unavailable}>{S.mine_none}</Text><Text style={[st.unavailable, { fontSize: 10 }]}>{posDebug}</Text></>;
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
        <View style={[st.card, { backgroundColor: C.card2 }]}>
          <View style={st.lockIcon}><Ionicons name="lock-closed" size={22} color={C.success} /></View>
          <Text style={st.lockTitle}>{S.locked_title}</Text>
          <Text style={st.lockSub}>{S.locked_sub}</Text>
          {pools.map(p => (
            <TouchableOpacity key={p.id} style={st.linkBtn} onPress={() => openUrl(explorerPoolUrl(p.address), p.label)}>
              <Ionicons name="shield-checkmark-outline" size={16} color={primary} />
              <Text style={[st.linkTxt, { color: primary }]}>{S.verify} · {p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={st.section}>{S.pools}</Text>

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
            <Text style={st.poolTitle}>{p.pair || p.label}</Text>
            {p.error ? (
              <Text style={st.unavailable}>{S.unavailable}</Text>
            ) : (
              <>
                <Row label={S.tvl} value={usd(p.tvl)} />
                <Row label={S.vol} value={usd(p.volume24h)} />
                <Row label={S.fees} value={usd(p.fees24h)} />
                {p.feePct !== null && <Row label={S.feeTier} value={pct(p.feePct)} />}
                <Row label={S.apr} value={pct(p.aprPct)} color={p.aprPct ? C.success : undefined} />
              </>
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

        <Text style={st.note}>{S.apr_note}</Text>

        <View style={st.card}>
          <Text style={st.poolTitle}>{S.how_title}</Text>
          <Text style={st.body}>• {S.how_1}</Text>
          <Text style={st.body}>• {S.how_2}</Text>
          <Text style={st.body}>• {S.fee_info}</Text>
          <TouchableOpacity style={st.linkBtn} onPress={() => openUrl(`https://solscan.io/account/${FEE_COLLECTOR_ADDRESS}`, 'Solscan')}>
            <Ionicons name="wallet-outline" size={16} color={primary} />
            <Text style={[st.linkTxt, { color: primary }]}>{S.fee_wallet}</Text>
          </TouchableOpacity>
        </View>

        <View style={st.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="warning-outline" size={18} color={C.warn} />
            <Text style={st.poolTitle}>{S.risk_title}</Text>
          </View>
          <Text style={st.body}>• {S.risk_1}</Text>
          <Text style={st.body}>• {S.risk_2}</Text>
          <Text style={st.body}>• {S.risk_3}</Text>
        </View>

        <Text style={st.footer}>{S.footer}</Text>
      </ScrollView>

    </>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12 },
  lockIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(16,185,129,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  lockTitle: { color: C.text, fontSize: 17, fontWeight: '700', marginBottom: 6 },
  lockSub: { color: C.muted, fontSize: 13, lineHeight: 20, marginBottom: 6 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  linkTxt: { fontSize: 13, fontWeight: '600' },
  tabs: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 24, padding: 4, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 20, alignItems: 'center' },
  tabTxt: { color: C.muted, fontSize: 13, fontWeight: '700' },
  section: { color: C.muted, fontSize: 12, fontWeight: '700', marginVertical: 8, marginHorizontal: 4 },
  poolTitle: { color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
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
  orcaBtn: { alignItems: 'center', paddingVertical: 10 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 24, paddingVertical: 12,
  },
  addTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  note: { color: C.muted, fontSize: 12, lineHeight: 18, marginHorizontal: 4, marginBottom: 12 },
  body: { color: C.muted, fontSize: 13, lineHeight: 21, marginTop: 4 },
  footer: { color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 8, lineHeight: 17 },
  // مودال الإيداع
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 10 },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', backgroundColor: C.card2, marginBottom: 14 },
  sheetTitle: { color: C.text, fontSize: 17, fontWeight: '700', marginBottom: 14 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card2, borderRadius: 14, paddingHorizontal: 14, marginTop: 6 },
  input: { flex: 1, color: C.text, fontSize: 22, fontWeight: '700', paddingVertical: 12 },
  banner: { flexDirection: 'row', gap: 10, backgroundColor: 'rgba(245,158,11,0.10)', borderRadius: 14, padding: 12, marginBottom: 12 },
  bannerTxt: { flex: 1, color: C.warn, fontSize: 12, lineHeight: 18 },
  fieldHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 },
  fieldName: { color: C.text, fontSize: 15, fontWeight: '800' },
  hint: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  previewBox: { backgroundColor: C.card2, borderRadius: 14, padding: 14, marginTop: 12 },
  previewVal: { color: C.text, fontSize: 16, fontWeight: '700', marginTop: 4 },
});
