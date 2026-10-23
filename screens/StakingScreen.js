// screens/StakingScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  SafeAreaView, ScrollView, Alert, ActivityIndicator, Linking
} from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { checkBalance } from '../services/swapService';
import { stakeMeco, unstakeMeco, getUserStakingData } from '../services/stakingService';
import { getSolPriceUsd } from '../services/jupiterMarketService';
import { addNotification, NOTIF_TYPES } from '../services/notificationsService';   // ✅ جديد

const STAKING_PLANS = [
  { id: 'flex', nameKey: 'plan_flex', apy: 15, durationKey: 'plan_flex_duration' },
  { id: '30d',  nameKey: 'plan_30d',  apy: 25, durationKey: 'plan_30d_duration'  },
  { id: '60d',  nameKey: 'plan_60d',  apy: 40, durationKey: 'plan_60d_duration'  },
];

const STAKING_TREASURY_ADDRESS = 'FoNBts4U25jm1YbZ3siT5hHzCmfuvrkzsRRJ4MWQkMQs';
const PLATFORM_FEE_SOL = 0.0005;

export default function StakingScreen() {
  const navigation   = useNavigation();
  const insets       = useSafeAreaInsets();
  const { t }        = useTranslation();
  const primaryColor = useAppStore(state => state.primaryColor || '#6C63FF');
  const isMounted    = useRef(true);

  const activeAccount = useAppStore(state => {
    const accounts = state.accounts;
    const idx      = state.activeAccountIndex;
    return accounts.length > 0 ? accounts[idx] : null;
  });
  const walletPrivateKey = useAppStore(state => state.walletPrivateKey);

  // التطبيق يعمل بالنمط الغامق فقط
  const colors = {
    background:    '#07070F',
    card:          '#111122',
    text:          '#EEEEFF',
    textSecondary: '#7E7EAA',
    border:        '#1E1E38',
    error:         '#EF4444',
    success:       '#10B981',
    info:          '#3B82F6',
  };

  const [activeTab,    setActiveTab]    = useState('stake');
  const [selectedPlan, setSelectedPlan] = useState(STAKING_PLANS[1]);
  const [mecoBalance,  setMecoBalance]  = useState(0);
  const [amount,       setAmount]       = useState('');
  const [loading,      setLoading]      = useState(false);
  const [stakingData,  setStakingData]  = useState({ stakedAmount: 0, pendingRewards: 0 });
  const [solPriceUsd,  setSolPriceUsd]  = useState(0);

  useEffect(() => {
    getSolPriceUsd().then(p => setSolPriceUsd(p || 0)).catch(() => {});
  }, []);

  useEffect(() => {
    isMounted.current = true;
    loadData();
    const interval = setInterval(async () => {
      if (activeAccount?.publicKey) {
        try {
          const data = await getUserStakingData(activeAccount.publicKey);
          if (isMounted.current) setStakingData(data);
        } catch (_) {}
      }
    }, 30000);
    return () => { isMounted.current = false; clearInterval(interval); };
  }, [activeAccount?.publicKey]);

  const loadData = async () => {
    if (!activeAccount?.publicKey) return;
    try {
      const [mecoBal, sData] = await Promise.all([
        checkBalance('MECO', 0, activeAccount.publicKey),
        getUserStakingData(activeAccount.publicKey),
      ]);
      if (isMounted.current) {
        setMecoBalance(mecoBal.balance || 0);
        setStakingData(sData);
      }
    } catch (_) { console.warn('Failed to load staking data'); }
  };

  const getFeeNotice = () => {
    const feeUsdText = solPriceUsd > 0 ? ` (≈ $${(PLATFORM_FEE_SOL * solPriceUsd).toFixed(2)})` : '';
    return t('staking.platform_fee_notice', {
      fee: PLATFORM_FEE_SOL,
      feeUsd: feeUsdText,
      defaultValue: `رسوم المنصة: {{fee}} SOL{{feeUsd}} بالإضافة إلى رسوم شبكة سولانا`,
    });
  };

  const handleStake = async () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return Alert.alert(t('staking.error'), t('staking.enter_valid_amount'));
    if (val > mecoBalance)       return Alert.alert(t('staking.error'), t('staking.insufficient_balance'));

    Alert.alert(
      t('staking.confirm_stake'),
      `${t('staking.stake_confirmation_message', { val, planName: t(`staking.${selectedPlan.nameKey}`) })}\n\n${getFeeNotice()}`,
      [
        { text: t('staking.cancel'), style: 'cancel' },
        { text: t('staking.confirm'), onPress: async () => {
            setLoading(true);
            try {
              const privateKey = await useAppStore.getState().getPrivateKeyForAccount(activeAccount?.index);
              if (!privateKey) {
                Alert.alert(t('staking.error'), t('staking.wallet_not_connected'));
                return;
              }

              const res = await stakeMeco(privateKey, val, selectedPlan.apy, selectedPlan.id);
              if (res.success) {
                // ✅ إشعار محلي بعد نجاح التخزين
                await addNotification({
                  type:       NOTIF_TYPES.STAKING,
                  titleKey:   'notif_stake_title',
                  messageKey: 'notif_stake_message',
                  params:     {
                    amount:   val,
                    planName: t(`staking.${selectedPlan.nameKey}`),
                    apy:      selectedPlan.apy,
                  },
                  data: {
                    amount:   val,
                    planId:   selectedPlan.id,
                    planName: selectedPlan.nameKey,
                    apy:      selectedPlan.apy,
                    txid:     res.txid || res.signature,
                  },
                });

                Alert.alert(t('staking.success'), t('staking.stake_success'));
                setAmount('');
                loadData();
              } else {
                Alert.alert(t('staking.failed'), res.errorKey ? t(res.errorKey) : res.error);
              }
            } catch (err) {
              Alert.alert(t('staking.error'), err.message || t('unexpected_error'));
            }
            finally { if (isMounted.current) setLoading(false); }
        }},
      ]
    );
  };

  const handleUnstake = async () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0)         return Alert.alert(t('staking.error'), t('staking.enter_valid_amount'));
    if (val > stakingData.stakedAmount) return Alert.alert(t('staking.error'), t('staking.insufficient_balance'));

    Alert.alert(
      t('staking.request_unstake'),
      `${t('staking.unstake_confirmation_message', { val })}\n\n${getFeeNotice()}`,
      [
        { text: t('staking.cancel'), style: 'cancel' },
        { text: t('staking.confirm'), onPress: async () => {
            setLoading(true);
            try {
              const privateKey = await useAppStore.getState().getPrivateKeyForAccount(activeAccount?.index);
              if (!privateKey) {
                Alert.alert(t('staking.error'), t('staking.wallet_not_connected'));
                return;
              }

              const res = await unstakeMeco(privateKey, val);
              if (res.success) {
                // ✅ إشعار محلي بعد نجاح طلب سحب التخزين
                await addNotification({
                  type:       NOTIF_TYPES.UNSTAKING,
                  titleKey:   'notif_unstake_title',
                  messageKey: 'notif_unstake_message',
                  params:     { amount: val },
                  data: {
                    amount: val,
                    txid:   res.txid || res.signature,
                  },
                });

                Alert.alert(t('staking.request_sent'), res.message);
                setAmount('');
                loadData();
              } else {
                Alert.alert(t('staking.failed'), res.errorKey ? t(res.errorKey) : res.error);
              }
            } catch (err) {
              Alert.alert(t('staking.error'), err.message || t('unexpected_error'));
            }
            finally { if (isMounted.current) setLoading(false); }
        }},
      ]
    );
  };

  const isStake = activeTab === 'stake';
  const parsedAmt = parseFloat(amount);
  const estYearly = isStake && !isNaN(parsedAmt) && parsedAmt > 0 ? (parsedAmt * selectedPlan.apy) / 100 : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── الهيدر ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{t('staking.title')}</Text>
          <View style={{ width: 34 }} />
        </View>

        {/* ── الملخص: المخزَّن حاليًا (بلا بطاقة) ── */}
        <View style={styles.hero}>
          <View style={styles.heroGlow} pointerEvents="none">
            <Svg width={320} height={220}>
              <Defs>
                <RadialGradient id="stkGlow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={primaryColor} stopOpacity="0.30" />
                  <Stop offset="1" stopColor={primaryColor} stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Circle cx="160" cy="110" r="160" fill="url(#stkGlow)" />
            </Svg>
          </View>
          <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>{t('staking.currently_staked')}</Text>
          <View style={styles.heroValueRow}>
            <Text style={[styles.heroValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {stakingData.stakedAmount.toFixed(2)}
            </Text>
            <Text style={[styles.heroUnit, { color: primaryColor }]}>MECO</Text>
          </View>
          <View style={[styles.rewardsPill, { backgroundColor: colors.success + '1F' }]}>
            <Ionicons name="gift" size={14} color={colors.success} />
            <Text style={[styles.rewardsPillTxt, { color: colors.success }]}>
              {t('staking.accumulated_rewards')}: {t('staking.rewards_value', { rewards: stakingData.pendingRewards.toFixed(6) })}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>{t('staking.available_to_stake')}</Text>
            <Text style={[styles.metaValue, { color: colors.text }]}>{mecoBalance.toFixed(2)} <Text style={styles.metaUnit}>MECO</Text></Text>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
          <View style={styles.metaCol}>
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>{t('portal_apy_label', 'سنوياً')}</Text>
            <Text style={[styles.metaValue, { color: colors.success }]}>{isStake ? selectedPlan.apy : '—'}{isStake ? '%' : ''} <Text style={styles.metaUnit}>APY</Text></Text>
          </View>
        </View>

        {/* ── تبويبات: تخزين / سحب ── */}
        <View style={styles.tabsRow}>
          {[{ id: 'stake', key: 'staking.stake_tab' }, { id: 'unstake', key: 'staking.unstake_tab' }].map(tab => {
            const on = activeTab === tab.id;
            return (
              <TouchableOpacity key={tab.id} style={styles.tabBtn} onPress={() => { setActiveTab(tab.id); setAmount(''); }} activeOpacity={0.8}>
                <Text style={[styles.tabText, { color: on ? colors.text : colors.textSecondary, fontWeight: on ? '800' : '600' }]}>{t(tab.key)}</Text>
                <View style={[styles.tabLine, { backgroundColor: on ? primaryColor : 'transparent' }]} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── الخطط ── */}
        {isStake && (
          <View style={styles.plansRow}>
            {STAKING_PLANS.map(plan => {
              const sel = selectedPlan.id === plan.id;
              return (
                <TouchableOpacity
                  key={plan.id}
                  style={[styles.planItem, { backgroundColor: sel ? primaryColor + '1F' : 'transparent', borderColor: sel ? primaryColor : colors.border }]}
                  onPress={() => setSelectedPlan(plan)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.planApy, { color: sel ? primaryColor : colors.success }]}>{plan.apy}%</Text>
                  <Text style={[styles.planName, { color: colors.text }]} numberOfLines={1}>{t(`staking.${plan.nameKey}`)}</Text>
                  <Text style={[styles.planDuration, { color: colors.textSecondary }]} numberOfLines={1}>{t(`staking.${plan.durationKey}`)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── المبلغ ── */}
        <View style={styles.amountBlock}>
          <View style={styles.inputHeader}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('staking.amount_label')}</Text>
            <TouchableOpacity
              onPress={() => setAmount(isStake ? mecoBalance.toString() : stakingData.stakedAmount.toString())}
              style={[styles.maxPill, { backgroundColor: primaryColor + '22' }]}
            >
              <Text style={[styles.maxText, { color: primaryColor }]}>{t('staking.max')}</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.inputBox, { borderBottomColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            <Text style={[styles.currencyLabel, { color: colors.textSecondary }]}>MECO</Text>
          </View>
          {estYearly > 0 && (
            <Text style={[styles.estimate, { color: colors.success }]}>
              ≈ +{estYearly.toFixed(2)} MECO / {t('portal_apy_label', 'سنوياً')}
            </Text>
          )}
          <Text style={[styles.feeHintText, { color: colors.textSecondary }]}>
            {t('staking.platform_fee_label', { defaultValue: 'رسوم المنصة' })}: {PLATFORM_FEE_SOL} SOL
            {solPriceUsd > 0 ? ` (≈ $${(PLATFORM_FEE_SOL * solPriceUsd).toFixed(2)})` : ''}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: primaryColor, opacity: loading ? 0.7 : 1 }]}
          onPress={isStake ? handleStake : handleUnstake}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.actionBtnText}>{isStake ? t('staking.confirm_stake') : t('staking.request_unstake')}</Text>}
        </TouchableOpacity>

        {/* ── الشفافية (قسم مسطح) ── */}
        <View style={[styles.transparency, { borderTopColor: colors.border }]}>
          <View style={styles.transparencyHeader}>
            <Ionicons name="shield-checkmark" size={20} color={primaryColor} />
            <Text style={[styles.transparencyTitle, { color: colors.text }]}>{t('staking.vip_title')}</Text>
          </View>
          <Text style={[styles.transparencyText, { color: colors.textSecondary }]}>{t('staking.vip_description')}</Text>
          <View style={styles.treasuryRow}>
            <Text style={[styles.treasuryAddressText, { color: colors.textSecondary }]} numberOfLines={1} ellipsizeMode="middle">
              {STAKING_TREASURY_ADDRESS}
            </Text>
            <TouchableOpacity onPress={() => { Clipboard.setStringAsync(STAKING_TREASURY_ADDRESS); Alert.alert(t('success'), t('copied_to_clipboard')); }} style={styles.iconBtn}>
              <Ionicons name="copy-outline" size={18} color={primaryColor} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL(`https://solscan.io/account/${STAKING_TREASURY_ADDRESS}`)} style={styles.iconBtn}>
              <Ionicons name="open-outline" size={18} color={primaryColor} />
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  content:         { paddingHorizontal: 20, paddingTop: 8 },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  backBtn:         { padding: 5 },
  title:           { fontSize: 20, fontWeight: '800' },

  hero:            { alignItems: 'center', paddingTop: 18, paddingBottom: 18, overflow: 'visible' },
  heroGlow:        { position: 'absolute', top: -30, alignSelf: 'center' },
  heroLabel:       { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  heroValueRow:    { flexDirection: 'row', alignItems: 'baseline', gap: 8, maxWidth: '100%' },
  heroValue:       { fontSize: 44, fontWeight: '800', letterSpacing: -1, flexShrink: 1 },
  heroUnit:        { fontSize: 16, fontWeight: '800' },
  rewardsPill:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginTop: 12 },
  rewardsPillTxt:  { fontSize: 12, fontWeight: '700' },

  metaRow:         { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 22 },
  metaCol:         { flex: 1, alignItems: 'center' },
  metaDivider:     { width: 1, height: 34 },
  metaLabel:       { fontSize: 12, marginBottom: 5 },
  metaValue:       { fontSize: 17, fontWeight: '800' },
  metaUnit:        { fontSize: 11, fontWeight: '700', opacity: 0.7 },

  tabsRow:         { flexDirection: 'row', gap: 26, marginBottom: 18 },
  tabBtn:          { paddingTop: 4, alignItems: 'center' },
  tabText:         { fontSize: 16 },
  tabLine:         { height: 2.5, borderRadius: 2, alignSelf: 'stretch', marginTop: 7 },

  plansRow:        { flexDirection: 'row', gap: 10, marginBottom: 22 },
  planItem:        { flex: 1, paddingVertical: 14, paddingHorizontal: 6, borderRadius: 16, borderWidth: 1.5, alignItems: 'center' },
  planApy:         { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  planName:        { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  planDuration:    { fontSize: 11 },

  amountBlock:     { marginBottom: 22 },
  inputHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  inputLabel:      { fontSize: 13, fontWeight: '600' },
  maxPill:         { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  maxText:         { fontSize: 12, fontWeight: '800' },
  inputBox:        { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  input:           { flex: 1, height: 64, fontSize: 32, fontWeight: '800' },
  currencyLabel:   { fontSize: 16, fontWeight: '800', marginLeft: 10 },
  estimate:        { fontSize: 12, fontWeight: '700', marginTop: 10 },
  feeHintText:     { fontSize: 11, marginTop: 10, fontWeight: '600' },

  actionBtn:       { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  actionBtnText:   { color: '#FFF', fontSize: 17, fontWeight: '800' },

  transparency:    { marginTop: 32, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth },
  transparencyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  transparencyTitle:  { fontSize: 15, fontWeight: '800' },
  transparencyText:   { fontSize: 12.5, lineHeight: 21, marginBottom: 12 },
  treasuryRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  treasuryAddressText: { flex: 1, fontSize: 12 },
  iconBtn:         { padding: 6 },
});
