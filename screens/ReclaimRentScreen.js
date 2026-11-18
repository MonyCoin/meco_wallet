// screens/ReclaimRentScreen.js
// استرداد إيجار سولانا: إغلاق حسابات العملات الفارغة وإعادة إيجارها إلى المحفظة (بلا رسوم منصة).
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as web3 from '@solana/web3.js';
import bs58 from 'bs58';
import { useAppStore } from '../store';
import DirIcon from '../components/DirIcon';
import { requireAuth } from '../services/appLock';
import { getSolBalance, clearBalanceCache } from '../services/heliusService';
import { CORE_TOKENS, getSolPriceUsd } from '../services/jupiterMarketService';
import { findReclaimableAccounts, closeEmptyAccounts, estimateFeeLamports } from '../services/rentReclaimService';

const SHOW_MAX = 6;
const shortMint = (m) => (m ? `${m.slice(0, 4)}…${m.slice(-4)}` : '');

function keypairFromStore(pk) {
  if (!pk) throw new Error('No private key in store');
  const secret = pk.startsWith('[') ? new Uint8Array(JSON.parse(pk)) : bs58.decode(pk);
  return web3.Keypair.fromSecretKey(secret);
}

export default function ReclaimRentScreen() {
  const navigation      = useNavigation();
  const { t }           = useTranslation();
  const insets          = useSafeAreaInsets();
  const primaryColor    = useAppStore(s => s.primaryColor || '#6C63FF');
  const walletPublicKey = useAppStore(s => s.walletPublicKey);

  const C = {
    bg: '#000000', card: '#141414', card2: '#1E1E1E', text: '#F2F2F2',
    muted: '#8A8A8E', border: '#262626', success: '#10B981', error: '#EF4444',
  };

  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(false);
  const [accounts,  setAccounts]  = useState([]);
  const [totalLam,  setTotalLam]  = useState(0);
  const [solPrice,  setSolPrice]  = useState(0);
  const [solBal,    setSolBal]    = useState(0);
  const [working,   setWorking]   = useState(false);
  const [progress,  setProgress]  = useState({ done: 0, total: 0 });
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async () => {
    if (!walletPublicKey) return;
    setLoading(true); setError(false);
    try {
      const [res, price, bal] = await Promise.all([
        findReclaimableAccounts(walletPublicKey),
        getSolPriceUsd().catch(() => 0),
        getSolBalance(true, walletPublicKey).catch(() => 0),
      ]);
      if (!mounted.current) return;
      setAccounts(res.accounts); setTotalLam(res.totalLamports);
      setSolPrice(price || 0);   setSolBal(bal || 0);
    } catch (_) {
      if (mounted.current) setError(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [walletPublicKey]);

  useEffect(() => { load(); }, [load]);

  const totalSol = totalLam / web3.LAMPORTS_PER_SOL;
  const feeSol   = estimateFeeLamports(accounts.length) / web3.LAMPORTS_PER_SOL;

  const nameOf = (a) => {
    const tk = CORE_TOKENS.find(x => x.mint === a.mint);
    return tk ? { sym: tk.symbol, name: tk.name } : { sym: shortMint(a.mint), name: shortMint(a.mint) };
  };

  const doReclaim = async () => {
    if (accounts.length === 0 || working) return;
    if (solBal < feeSol) {
      return Alert.alert(t('error'), t('reclaim.need_sol', { fee: feeSol.toFixed(5) }));
    }
    Alert.alert(
      t('reclaim.confirm_title'),
      t('reclaim.confirm_msg', { count: accounts.length, sol: totalSol.toFixed(4) }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('confirm'),
          onPress: async () => {
            if (!(await requireAuth())) return;
            try {
              setWorking(true); setProgress({ done: 0, total: accounts.length });
              const keypair = keypairFromStore(useAppStore.getState().walletPrivateKey);
              const r = await closeEmptyAccounts(keypair, accounts, (done, total) => {
                if (mounted.current) setProgress({ done, total });
              });
              clearBalanceCache();
              const gotSol = (r.reclaimedLamports / web3.LAMPORTS_PER_SOL).toFixed(4);
              if (r.closed === 0) {
                Alert.alert(t('error'), t('reclaim.failed'));
              } else if (r.failed > 0) {
                Alert.alert(t('reclaim.success_title'), t('reclaim.partial_msg', { done: r.closed, total: accounts.length, sol: gotSol }));
              } else {
                Alert.alert(t('reclaim.success_title'), t('reclaim.success_msg', { sol: gotSol, count: r.closed }));
              }
              if (mounted.current) await load();
            } catch (_) {
              Alert.alert(t('error'), t('reclaim.failed'));
            } finally {
              if (mounted.current) setWorking(false);
            }
          },
        },
      ],
    );
  };

  const shown = accounts.slice(0, SHOW_MAX);
  const more  = accounts.length - shown.length;

  return (
    <View style={[S.root, { backgroundColor: C.bg }]}>
      <View style={{ height: insets.top }} />
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn}>
          <DirIcon name="arrow-back" size={18} color={C.text} />
        </TouchableOpacity>
        <Text style={[S.title, { color: C.text }]}>{t('reclaim.screen_title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={S.center}><ActivityIndicator size="large" color={primaryColor} /></View>
      ) : error ? (
        <View style={S.center}>
          <Text style={[S.muted, { color: C.muted }]}>{t('reclaim.load_error')}</Text>
          <TouchableOpacity onPress={load} style={[S.retry, { backgroundColor: primaryColor + '15' }]}>
            <Text style={{ color: primaryColor, fontWeight: '700' }}>{t('reclaim.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : accounts.length === 0 ? (
        <View style={S.center}><Text style={[S.muted, { color: C.muted }]}>{t('reclaim.none')}</Text></View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
            <View style={S.big}>
              <Text style={[S.muted, { color: C.muted }]}>{t('reclaim.can_reclaim')}</Text>
              <Text style={[S.bigNum, { color: C.success }]}>{totalSol.toFixed(4)} SOL</Text>
              <Text style={[S.muted, { color: C.muted }]}>
                {(solPrice > 0 ? `≈ $${(totalSol * solPrice).toFixed(2)} · ` : '') + t('reclaim.from_accounts', { count: accounts.length })}
              </Text>
            </View>

            <View style={[S.note, { backgroundColor: C.card2 }]}>
              <Text style={[S.noteTxt, { color: C.muted }]}>{t('reclaim.explain')}</Text>
            </View>

            <View style={[S.list, { backgroundColor: C.card }]}>
              {shown.map((a, i) => {
                const n = nameOf(a);
                return (
                  <View key={a.pubkey} style={[S.acc, i < shown.length - 1 || more > 0 ? { borderBottomColor: C.card2, borderBottomWidth: 1 } : null]}>
                    <View style={S.accLeft}>
                      <View style={[S.logo, { backgroundColor: C.card2 }]}>
                        <Text style={[S.logoTxt, { color: C.muted }]} numberOfLines={1}>{n.sym.slice(0, 4)}</Text>
                      </View>
                      <Text style={[S.accName, { color: C.text }]} numberOfLines={1}>{n.name}</Text>
                    </View>
                    <Text style={[S.accAmt, { color: C.success }]}>+{(a.lamports / web3.LAMPORTS_PER_SOL).toFixed(5)}</Text>
                  </View>
                );
              })}
              {more > 0 && (
                <View style={S.acc}>
                  <Text style={[S.muted, { color: C.muted, width: '100%', textAlign: 'center' }]}>
                    {t('reclaim.and_more', { count: more })}
                  </Text>
                </View>
              )}
            </View>

            <View style={S.sumRow}>
              <Text style={[S.sumLbl, { color: C.muted }]}>{t('reclaim.platform_fee')}</Text>
              <Text style={[S.sumVal, { color: C.success }]}>{t('reclaim.free')}</Text>
            </View>
            <View style={S.sumRow}>
              <Text style={[S.sumLbl, { color: C.muted }]}>{t('reclaim.network_fee')}</Text>
              <Text style={[S.sumVal, { color: C.text }]}>≈ {feeSol.toFixed(5)} SOL</Text>
            </View>
          </ScrollView>

          <View style={[S.footer, { paddingBottom: insets.bottom + 14 }]}>
            <TouchableOpacity
              style={[S.btn, { backgroundColor: primaryColor, opacity: working ? 0.7 : 1 }]}
              onPress={doReclaim}
              disabled={working}
              activeOpacity={0.85}
            >
              {working ? (
                <View style={S.workRow}>
                  <ActivityIndicator color="#fff" />
                  <Text style={S.btnTxt}>{t('reclaim.working')} {progress.done}/{progress.total}</Text>
                </View>
              ) : (
                <Text style={S.btnTxt}>{t('reclaim.button', { sol: totalSol.toFixed(4) })}</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root:    { flex: 1 },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  title:   { fontSize: 16, fontWeight: '800' },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 14 },
  muted:   { fontSize: 12, textAlign: 'center' },
  retry:   { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10 },
  big:     { alignItems: 'center', marginTop: 8, marginBottom: 6 },
  bigNum:  { fontSize: 34, fontWeight: '800', marginVertical: 4 },
  note:    { borderRadius: 12, padding: 12, marginVertical: 12 },
  noteTxt: { fontSize: 11.5, lineHeight: 20 },
  list:    { borderRadius: 16, paddingHorizontal: 14 },
  acc:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11 },
  accLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  logo:    { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  logoTxt: { fontSize: 9, fontWeight: '800' },
  accName: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  accAmt:  { fontSize: 12, fontWeight: '700' },
  sumRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 4, marginTop: 4 },
  sumLbl:  { fontSize: 12 },
  sumVal:  { fontSize: 12, fontWeight: '700' },
  footer:  { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, backgroundColor: '#000000' },
  btn:     { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  btnTxt:  { color: '#fff', fontSize: 14, fontWeight: '800' },
  workRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
