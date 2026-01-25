import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  SafeAreaView, TouchableOpacity, Dimensions, Animated,
  RefreshControl
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import {
  getTransactionLog,
  getTransactions
} from '../services/transactionLogger';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function TransactionHistoryScreen() {
  const { t, i18n } = useTranslation();
  const theme = useAppStore(state => state.theme);
  const primaryColor = useAppStore(state => state.primaryColor);
  const isDark = theme === 'dark';
  
  // Theme colors
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
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const localLog = await getTransactionLog();

      let onChain = [];
      const pub = await SecureStore.getItemAsync('wallet_public_key');
      if (pub) {
        const chainData = await getTransactions(pub);
        onChain = chainData.map(tx => ({
          type: 'onchain',
          signature: tx.signature,
          blockTime: tx.blockTime,
          slot: tx.slot,
          status: tx.status || 'confirmed',
          fee: tx.fee || 0,
          amount: tx.amount || 0,
          currency: tx.currency || 'SOL',
        }));
      }

      const all = [...localLog, ...onChain];
      all.sort((a, b) =>
        new Date(b.timestamp || b.blockTime * 1000) -
        new Date(a.timestamp || a.blockTime * 1000)
      );

      setTransactions(all);
    } catch (err) {
      console.error('❌ Error loading transactions:', err);
      setTransactions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  const getTransactionIcon = (type) => {
    switch(type) {
      case 'swap': return 'swap-horizontal';
      case 'stake': return 'trending-up';
      case 'send': return 'arrow-up';
      case 'receive': return 'arrow-down';
      case 'onchain': return 'link';
      default: return 'receipt';
    }
  };

  const getTransactionColor = (type) => {
    switch(type) {
      case 'swap': return colors.info;
      case 'stake': return colors.success;
      case 'send': return colors.error;
      case 'receive': return colors.success;
      case 'onchain': return colors.warning;
      default: return primaryColor;
    }
  };

  const getTransactionTitle = (item) => {
    switch(item.type) {
      case 'swap':
        return t('swap_transaction');
      case 'stake':
        return t('stake_transaction');
      case 'send':
        return t('send_transaction');
      case 'receive':
        return t('receive_transaction');
      case 'onchain':
        return t('onchain_transaction');
      default:
        return t('transaction');
    }
  };

  const getTransactionSubtitle = (item) => {
    const date = item.timestamp ? 
      new Date(item.timestamp) : 
      new Date((item.blockTime || 0) * 1000);
    
    // Dynamic locale based on current language
    const currentLanguage = i18n.language;
    const locale = currentLanguage === 'ar' ? 'ar-SA' : 'en-US';
    
    return date.toLocaleDateString(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFormattedAmount = (item) => {
    if (item.type === 'swap') {
      return `${item.amount || 0} ${item.from || ''} → ${item.converted || 0} ${item.to || ''}`;
    }
    if (item.type === 'stake') {
      return `${item.amount || 0} ${item.currency || ''}`;
    }
    if (item.type === 'send') {
      return `-${item.amount || 0} ${item.currency || ''}`;
    }
    if (item.type === 'receive') {
      return `+${item.amount || 0} ${item.currency || ''}`;
    }
    if (item.type === 'onchain') {
      return `${(item.fee / 1e9).toFixed(6)} SOL`;
    }
    return '';
  };

  const getStatusBadge = (status) => {
    const isSuccess = status === 'confirmed' || status === 'success';
    const isPending = status === 'pending';
    const isFailed = status === 'failed';
    
    return {
      text: status === 'confirmed' ? t('confirmed') : 
            status === 'pending' ? t('pending') : 
            status === 'failed' ? t('failed') : t('unknown'),
      color: isSuccess ? colors.success : 
             isPending ? colors.warning : 
             isFailed ? colors.error : colors.textSecondary
    };
  };

  const renderItem = ({ item, index }) => {
    const icon = getTransactionIcon(item.type);
    const color = getTransactionColor(item.type);
    const title = getTransactionTitle(item);
    const subtitle = getTransactionSubtitle(item);
    const amount = getFormattedAmount(item);
    const status = getStatusBadge(item.status || 'confirmed');
    
    const isSend = item.type === 'send';
    const isReceive = item.type === 'receive';
    
    return (
      <Animated.View 
        style={[
          styles.itemContainer,
          { 
            backgroundColor: colors.card,
            opacity: fadeAnim,
            transform: [{ 
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 30 - (index * 5)]
              }) 
            }]
          }
        ]}
      >
        <View style={styles.itemContent}>
          <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
            <Ionicons name={icon} size={24} color={color} />
          </View>
          
          <View style={styles.detailsContainer}>
            <View style={styles.detailsRow}>
              <Text style={[styles.titleText, { color: colors.text }]}>
                {title}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
                <Text style={[styles.statusText, { color: status.color }]}>
                  {status.text}
                </Text>
              </View>
            </View>
            
            <Text style={[styles.subtitleText, { color: colors.textSecondary }]}>
              {subtitle}
            </Text>
            
            {item.type === 'send' && item.to && (
              <View style={styles.addressContainer}>
                <Ionicons name="wallet-outline" size={12} color={colors.textSecondary} />
                <Text style={[styles.addressText, { color: colors.textSecondary }]}>
                  {`${item.to.substring(0, 8)}...${item.to.substring(item.to.length - 6)}`}
                </Text>
              </View>
            )}
            
            {item.type === 'onchain' && item.signature && (
              <View style={styles.addressContainer}>
                <Ionicons name="fingerprint-outline" size={12} color={colors.textSecondary} />
                <Text style={[styles.addressText, { color: colors.textSecondary }]}>
                  {`${item.signature.substring(0, 12)}...`}
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.amountContainer}>
            <Text style={[
              styles.amountText, 
              { 
                color: isSend ? colors.error : 
                       isReceive ? colors.success : 
                       colors.text 
              }
            ]}>
              {amount}
            </Text>
            
            {item.type === 'onchain' && (
              <Text style={[styles.feeText, { color: colors.textSecondary }]}>
                {t('fee')}: {(item.fee / 1e9).toFixed(6)} SOL
              </Text>
            )}
            
            {item.type === 'send' && item.networkFee && (
              <Text style={[styles.feeText, { color: colors.textSecondary }]}>
                {t('network_fee')}: {item.networkFee?.toFixed(6) || 0} SOL
              </Text>
            )}
          </View>
        </View>
        
        {index < transactions.length - 1 && (
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
        )}
      </Animated.View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}>
        <Ionicons name="receipt-outline" size={60} color={colors.textSecondary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {t('no_transactions_yet')}
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {t('your_transactions_will_appear_here')}
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.headerContent}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t('transaction_history_title')}
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          {t('all_transactions')} • {transactions.length} {t('transactions')}
        </Text>
      </View>
      <TouchableOpacity 
        style={[styles.filterButton, { backgroundColor: colors.card }]}
        onPress={onRefresh}
      >
        <Ionicons name="refresh-outline" size={20} color={primaryColor} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('loading')}...
          </Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item, index) => `${item.type}_${item.signature || item.timestamp || index}`}
          renderItem={renderItem}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[primaryColor]}
              tintColor={primaryColor}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.8,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  itemContainer: {
    borderRadius: 20,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailsContainer: {
    flex: 1,
    marginRight: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  subtitleText: {
    fontSize: 13,
    marginBottom: 8,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  addressText: {
    fontSize: 11,
    fontFamily: 'monospace',
    marginLeft: 6,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  feeText: {
    fontSize: 11,
  },
  separator: {
    height: 1,
    marginTop: 16,
    marginHorizontal: -16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
});
