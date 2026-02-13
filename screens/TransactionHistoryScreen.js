import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  SafeAreaView, TouchableOpacity, Dimensions, Animated,
  RefreshControl, Linking, Alert, Modal
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { getTransactionHistory } from '../services/heliusService'; 
import { getTransactionLog } from '../services/transactionLogger';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function TransactionHistoryScreen() {
  const { t } = useTranslation();
  const theme = useAppStore(state => state.theme);
  const primaryColor = useAppStore(state => state.primaryColor || '#6C63FF');
  const publicKey = useAppStore(state => state.publicKey);
  const isDark = theme === 'dark';
  
  const colors = {
    background: isDark ? '#0A0A0F' : '#F8FAFD',
    card: isDark ? '#1A1A2E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#1A1A2E',
    textSecondary: isDark ? '#A0A0B0' : '#6B7280',
    border: isDark ? '#2A2A3E' : '#E5E7EB',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
  };

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [stats, setStats] = useState({
    totalSent: 0,
    totalReceived: 0,
    totalFees: 0,
    count: 0
  });

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const localLog = await getTransactionLog();
      let onChain = [];
      const chainData = await getTransactionHistory(20);
      
      if (chainData && chainData.length > 0) {
        onChain = chainData.map(tx => ({
          type: 'onchain',
          signature: tx.signature,
          blockTime: tx.blockTime,
          slot: tx.slot,
          status: tx.confirmationStatus === 'finalized' ? 'confirmed' : tx.confirmationStatus,
          err: tx.err,
          fee: tx.fee,
          amount: tx.amount,
          from: tx.from,
          to: tx.to,
          token: tx.token
        }));
      }

      const mergedMap = new Map();
      onChain.forEach(tx => mergedMap.set(tx.signature, tx));
      localLog.forEach(tx => {
        if (tx.transactionSignature) {
          mergedMap.set(tx.transactionSignature, { 
            ...mergedMap.get(tx.transactionSignature), 
            ...tx,
            // تحديد نوع المعاملة بناءً على عنوان المستخدم
            type: tx.from === publicKey ? 'send' : 
                  tx.to === publicKey ? 'receive' : 
                  tx.type || 'onchain'
          });
        }
      });

      const all = Array.from(mergedMap.values());
      all.sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : (a.blockTime * 1000);
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : (b.blockTime * 1000);
        return timeB - timeA;
      });

      // حساب الإحصائيات
      const sent = all.filter(tx => tx.type === 'send').reduce((sum, tx) => sum + (tx.amount || 0), 0);
      const received = all.filter(tx => tx.type === 'receive').reduce((sum, tx) => sum + (tx.amount || 0), 0);
      const fees = all.reduce((sum, tx) => sum + (tx.fee || 0), 0);

      setStats({
        totalSent: sent,
        totalReceived: received,
        totalFees: fees,
        count: all.length
      });

      setTransactions(all);
    } catch (err) {
      console.error('Error loading transactions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  const openExplorer = async (signature) => {
    if (!signature) {
      Alert.alert(t('error'), t('no_transaction_id'));
      return;
    }
    const url = `https://solscan.io/tx/${signature}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(t('error'), t('cannot_open_link'));
      }
    } catch (error) {
      Alert.alert(t('error'), t('unexpected_error'));
    }
  };

  const copyToClipboard = async (text, message) => {
    if (text) {
      await Clipboard.setStringAsync(text);
      Alert.alert(t('success'), message || t('copied_to_clipboard'));
    }
  };

  const formatDate = (timestamp, blockTime) => {
    try {
      const date = new Date(timestamp || blockTime * 1000);
      const now = new Date();
      const diff = now - date;
      
      if (diff < 60 * 1000) return t('just_now');
      if (diff < 60 * 60 * 1000) {
        const mins = Math.floor(diff / (60 * 1000));
        return t('minutes_ago', { count: mins });
      }
      if (diff < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(diff / (60 * 60 * 1000));
        return t('hours_ago', { count: hours });
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return t('unknown_date');
    }
  };

  const formatAmount = (amount, token = 'SOL') => {
    if (!amount) return '0 ' + token;
    return `${amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${token}`;
  };

  const getTransactionType = (tx) => {
    if (tx.type === 'send') return { icon: 'arrow-up', color: colors.error, label: t('sent') };
    if (tx.type === 'receive') return { icon: 'arrow-down', color: colors.success, label: t('received') };
    if (tx.type === 'swap') return { icon: 'swap-horizontal', color: colors.info, label: t('swapped') };
    if (tx.type === 'presale') return { icon: 'rocket', color: colors.warning, label: t('presale') };
    return { icon: 'receipt', color: colors.textSecondary, label: t('transaction') };
  };

  const renderTransactionModal = () => (
    <Modal
      visible={modalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t('transaction_details')}
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {selectedTx && (
            <>
              {/* نوع المعاملة والمبلغ */}
              <View style={styles.modalTypeContainer}>
                <View style={[styles.modalIcon, { backgroundColor: getTransactionType(selectedTx).color + '20' }]}>
                  <Ionicons 
                    name={getTransactionType(selectedTx).icon} 
                    size={32} 
                    color={getTransactionType(selectedTx).color} 
                  />
                </View>
                <Text style={[styles.modalAmount, { color: colors.text }]}>
                  {formatAmount(selectedTx.amount, selectedTx.currency)}
                </Text>
                <Text style={[styles.modalType, { color: getTransactionType(selectedTx).color }]}>
                  {getTransactionType(selectedTx).label}
                </Text>
              </View>

              {/* تفاصيل المعاملة */}
              <View style={styles.modalDetails}>
                
                {/* توقيع المعاملة */}
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('signature')}</Text>
                  <View style={styles.detailValueContainer}>
                    <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={1}>
                      {selectedTx.signature?.slice(0, 20)}...
                    </Text>
                    <TouchableOpacity onPress={() => copyToClipboard(selectedTx.signature, t('signature_copied'))}>
                      <Ionicons name="copy-outline" size={18} color={primaryColor} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* عنوان المرسل */}
                {selectedTx.from && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('from')}</Text>
                    <View style={styles.detailValueContainer}>
                      <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={1}>
                        {selectedTx.from.slice(0, 20)}...
                      </Text>
                      <TouchableOpacity onPress={() => copyToClipboard(selectedTx.from, t('address_copied'))}>
                        <Ionicons name="copy-outline" size={18} color={primaryColor} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* عنوان المستلم */}
                {selectedTx.to && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('to')}</Text>
                    <View style={styles.detailValueContainer}>
                      <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={1}>
                        {selectedTx.to.slice(0, 20)}...
                      </Text>
                      <TouchableOpacity onPress={() => copyToClipboard(selectedTx.to, t('address_copied'))}>
                        <Ionicons name="copy-outline" size={18} color={primaryColor} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* الوقت */}
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('time')}</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {new Date(selectedTx.blockTime * 1000).toLocaleString()}
                  </Text>
                </View>

                {/* الحالة */}
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('status')}</Text>
                  <View style={[styles.statusBadge, { 
                    backgroundColor: selectedTx.err ? colors.error + '20' : colors.success + '20' 
                  }]}>
                    <Text style={{ 
                      color: selectedTx.err ? colors.error : colors.success,
                      fontWeight: '600',
                      fontSize: 12
                    }}>
                      {selectedTx.err ? t('failed') : t('confirmed')}
                    </Text>
                  </View>
                </View>

                {/* الرسوم */}
                {selectedTx.fee && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{t('fee')}</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {selectedTx.fee.toFixed(6)} SOL
                    </Text>
                  </View>
                )}

              </View>

              {/* أزرار الإجراءات */}
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={[styles.modalButton, { backgroundColor: primaryColor }]}
                  onPress={() => openExplorer(selectedTx.signature)}
                >
                  <Ionicons name="open-outline" size={20} color="#FFF" />
                  <Text style={styles.modalButtonText}>{t('view_on_solscan')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderStats = () => (
    <View style={styles.statsContainer}>
      <View style={[styles.statCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('total_sent')}</Text>
        <Text style={[styles.statValue, { color: colors.error }]}>{stats.totalSent.toFixed(4)} SOL</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('total_received')}</Text>
        <Text style={[styles.statValue, { color: colors.success }]}>{stats.totalReceived.toFixed(4)} SOL</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('total_fees')}</Text>
        <Text style={[styles.statValue, { color: colors.warning }]}>{stats.totalFees.toFixed(6)} SOL</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('total_transactions')}</Text>
        <Text style={[styles.statValue, { color: colors.text }]}>{stats.count}</Text>
      </View>
    </View>
  );

  const renderItem = ({ item }) => {
    const txType = getTransactionType(item);
    const dateText = formatDate(item.timestamp, item.blockTime);
    const statusColor = item.err ? colors.error : colors.success;
    const isPending = !item.signature && !item.transactionSignature;

    return (
      <TouchableOpacity 
        style={[styles.itemContainer, { backgroundColor: colors.card }]}
        onPress={() => {
          setSelectedTx(item);
          setModalVisible(true);
        }}
        activeOpacity={0.7}
        disabled={isPending}
      >
        {/* الأيقونة */}
        <View style={[styles.iconContainer, { backgroundColor: txType.color + '15' }]}>
          <Ionicons name={txType.icon} size={24} color={txType.color} />
        </View>
        
        {/* التفاصيل */}
        <View style={styles.detailsContainer}>
          <View style={styles.row}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {txType.label}
            </Text>
            {item.amount && (
              <Text style={[styles.amount, { color: colors.text }]}>
                {formatAmount(item.amount, item.currency)}
              </Text>
            )}
          </View>
          
          <View style={styles.row}>
            <Text style={[styles.date, { color: colors.textSecondary }]}>
              {dateText}
            </Text>
            <View style={styles.statusContainer}>
              {isPending ? (
                <>
                  <ActivityIndicator size="small" color={colors.warning} style={{marginRight: 4}} />
                  <Text style={{fontSize: 11, color: colors.warning}}>{t('pending')}</Text>
                </>
              ) : (
                <>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {item.err ? t('failed') : t('confirmed')}
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* السهم للتفاصيل */}
        {!isPending && (
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('transaction_analytics')}</Text>
        <TouchableOpacity onPress={onRefresh} style={[styles.refreshBtn, { backgroundColor: colors.card }]}>
          <Ionicons name="refresh" size={20} color={primaryColor} />
        </TouchableOpacity>
      </View>

      {/* إحصائيات سريعة */}
      {!loading && transactions.length > 0 && renderStats()}
      
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('loading_transactions')}</Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item, i) => item.signature || item.transactionSignature || `tx_${i}`}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('recent_activity')}</Text>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}>
                <Ionicons name="analytics-outline" size={48} color={colors.textSecondary + '80'} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('no_activity_yet')}</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {t('transactions_will_appear_here')}
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
        />
      )}

      {/* مودال تفاصيل المعاملة */}
      {renderTransactionModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  
  // إحصائيات
  statsContainer: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 20, marginBottom: 20,
    gap: 10
  },
  statCard: {
    width: (width - 50) / 2,
    padding: 16,
    borderRadius: 16,
    elevation: 2
  },
  statLabel: { fontSize: 12, marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: 'bold' },

  list: { padding: 20, paddingTop: 0, paddingBottom: 100 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, marginTop: 10 },
  
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14 },
  
  itemContainer: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderRadius: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2
  },
  iconContainer: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', marginRight: 12
  },
  detailsContainer: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '600' },
  amount: { fontSize: 14, fontWeight: '500' },
  date: { fontSize: 12 },
  statusContainer: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  statusText: { fontSize: 11, fontWeight: '500' },

  // مودال
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalTypeContainer: { alignItems: 'center', marginBottom: 24 },
  modalIcon: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  modalAmount: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  modalType: { fontSize: 16, fontWeight: '500' },
  modalDetails: { marginBottom: 20 },
  detailRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)'
  },
  detailLabel: { fontSize: 14, flex: 1 },
  detailValueContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
    flex: 2,
    justifyContent: 'flex-end'
  },
  detailValue: { fontSize: 14, fontWeight: '500' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  modalActions: { marginTop: 10 },
  modalButton: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8
  },
  modalButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

  // شاشة فارغة
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 }
});
