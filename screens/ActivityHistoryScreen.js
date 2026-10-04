// screens/ActivityHistoryScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator, Linking,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTransactionHistory } from '../services/heliusService';

const PAGE_SIZE = 20;

export default function ActivityHistoryScreen() {
  const navigation      = useNavigation();
  const { t }           = useTranslation();
  const theme           = useAppStore(s => s.theme);
  const primaryColor    = useAppStore(s => s.primaryColor || '#6C63FF');
  const walletPublicKey = useAppStore(s => s.walletPublicKey);
  const isDark          = theme === 'dark';
  const insets          = useSafeAreaInsets();

  const colors = {
    background:    isDark ? '#07070F' : '#F4F5F9',
    card:          isDark ? '#111122' : '#FFFFFF',
    text:          isDark ? '#EEEEFF' : '#1C1C24',
    textSecondary: isDark ? '#7E7EAA' : '#8A8A9E',
    border:        isDark ? '#1E1E38' : '#E8E8F2',
    success:       '#10B981',
    error:         '#EF4444',
  };

  const [items,       setItems]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(true);

  const loadInitial = useCallback(async (isRefresh = false) => {
    if (!walletPublicKey) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const txs = await getTransactionHistory(PAGE_SIZE, walletPublicKey);
      setItems(txs || []);
      setHasMore((txs || []).length === PAGE_SIZE);
    } catch (_) {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [walletPublicKey]);

  // ✅ إعادة الجلب في كل مرة يتم فيها فتح الشاشة أو الرجوع إليها
  useFocusEffect(
    useCallback(() => {
      loadInitial();
    }, [loadInitial])
  );

  const loadMore = async () => {
    if (loadingMore || !hasMore || items.length === 0) return;
    setLoadingMore(true);
    try {
      const lastSig = items[items.length - 1].signature;
      const txs     = await getTransactionHistory(PAGE_SIZE, walletPublicKey, lastSig);
      if (!txs || txs.length === 0) {
        setHasMore(false);
      } else {
        const existing = new Set(items.map(i => i.signature));
        const unique   = txs.filter(tx => !existing.has(tx.signature));
        setItems(prev => [...prev, ...unique]);
        if (unique.length < PAGE_SIZE) setHasMore(false);
      }
    } catch (_) {}
    finally { setLoadingMore(false); }
  };

  const formatTimeAgo = (timestamp) => {
    const diff = Date.now() - (timestamp || Date.now());
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return t('activity.just_now');
    if (mins < 60) return t('activity.minutes_ago', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('activity.hours_ago', { count: hours });
    const days = Math.floor(hours / 24);
    return t('activity.days_ago', { count: days });
  };

  const openSolscan = (sig) => {
    if (sig) Linking.openURL(`https://solscan.io/tx/${sig}`);
  };

  const renderItem = ({ item: tx }) => {
    const isReceive = tx.type === 'receive';
    const iconName  = isReceive ? 'arrow-down' : 'arrow-up';
    const iconColor = isReceive ? colors.success : colors.error;
    const label     = isReceive ? t('activity.received') : t('activity.sent');

    return (
      <TouchableOpacity
        style={[S.item, { backgroundColor: colors.card, borderColor: colors.border }]}
        activeOpacity={0.7}
        onPress={() => openSolscan(tx.signature)}
      >
        <View style={[S.iconWrap, { backgroundColor: iconColor + '15' }]}>
          <Ionicons name={iconName} size={18} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[S.label, { color: colors.text }]}>
            {label} {tx.token}
          </Text>
          <Text style={[S.time, { color: colors.textSecondary }]}>
            {formatTimeAgo(tx.timestamp)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[S.amount, { color: isReceive ? colors.success : colors.text }]}>
            {isReceive ? '+' : '-'}{tx.amount.toFixed(tx.amount > 100 ? 2 : 4)}
          </Text>
          <Text style={[S.amountSub, { color: colors.textSecondary }]}>{tx.token}</Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} style={{ marginLeft: 6 }} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <View style={{ height: insets.top }} />

      <View style={[S.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[S.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={[S.title, { color: colors.text }]}>
          {t('activity.history_title')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={S.center}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item, i) => `${item.signature}_${i}`}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadInitial(true)}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={S.empty}>
              <Ionicons name="time-outline" size={40} color={colors.textSecondary} />
              <Text style={[S.emptyTxt, { color: colors.textSecondary }]}>
                {t('activity.empty')}
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                size="small"
                color={primaryColor}
                style={{ marginVertical: 16 }}
              />
            ) : (!hasMore && items.length > 0) ? (
              <Text style={[S.footerTxt, { color: colors.textSecondary }]}>
                {t('activity.no_more')}
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root:      { flex: 1 },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn:   { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  title:     { fontSize: 16, fontWeight: '800' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  item:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8, gap: 12 },
  iconWrap:  { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  label:     { fontSize: 14, fontWeight: '700' },
  time:      { fontSize: 11, marginTop: 3 },
  amount:    { fontSize: 14, fontWeight: '700' },
  amountSub: { fontSize: 11, marginTop: 2 },

  empty:     { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTxt:  { fontSize: 13, fontWeight: '600' },
  footerTxt: { textAlign: 'center', fontSize: 11, marginVertical: 16, fontWeight: '600' },
});
