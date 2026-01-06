import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import {
  getTransactionLog,
  getTransactions
} from '../services/transactionLogger';
import * as SecureStore from 'expo-secure-store';

export default function TransactionHistoryScreen() {
  const { t } = useTranslation();
  const theme = useAppStore(state => state.theme);
  const fg = theme === 'dark' ? '#fff' : '#000';
  const bg = theme === 'dark' ? '#000' : '#fff';
  const box = theme === 'dark' ? '#111' : '#f0f0f0';

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
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
            status: tx.status,
            fee: tx.fee || 0,
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
      }
    };

    load();
  }, []);

  const renderItem = ({ item }) => {
    if (item.type === 'swap') {
      return (
        <View style={[styles.item, { backgroundColor: box }]}>
          <Text style={[styles.text, { color: fg }]}>
            🔄 Swap: {item.amount} {item.from} → {item.converted} {item.to}
          </Text>
          <Text style={[styles.subtext, { color: fg }]}>
            {new Date(item.timestamp).toLocaleString()}
          </Text>
        </View>
      );
    }

    if (item.type === 'stake') {
      return (
        <View style={[styles.item, { backgroundColor: box }]}>
          <Text style={[styles.text, { color: fg }]}>
            🔐 Stake: {item.amount} {item.currency} | {item.periodDays} يوم
          </Text>
          <Text style={[styles.subtext, { color: fg }]}>
            {new Date(item.timestamp).toLocaleString()}
          </Text>
        </View>
      );
    }

    if (item.type === 'send') {
      return (
        <View style={[styles.item, { backgroundColor: box }]}>
          <Text style={[styles.text, { color: fg }]}>
            📤 Sent: {item.amount} → {item.to}
          </Text>
          <Text style={[styles.subtext, { color: fg }]}>
            {new Date(item.timestamp).toLocaleString()}
          </Text>
        </View>
      );
    }

    if (item.type === 'receive') {
      return (
        <View style={[styles.item, { backgroundColor: box }]}>
          <Text style={[styles.text, { color: fg }]}>
            📥 Received: {item.amount}
          </Text>
          <Text style={[styles.subtext, { color: fg }]}>
            {new Date(item.timestamp).toLocaleString()}
          </Text>
        </View>
      );
    }

    if (item.type === 'onchain') {
      return (
        <View style={[styles.item, { backgroundColor: box }]}>
          <Text style={[styles.text, { color: fg }]}>
            📤 Tx: {item.signature.slice(0, 8)}... | Fee: {(item.fee / 1e9).toFixed(6)} SOL
          </Text>
          <Text style={[styles.subtext, { color: fg }]}>
            {new Date((item.blockTime || 0) * 1000).toLocaleString()}
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Text style={[styles.title, { color: fg }]}>{t('transactions')}</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#ff0000" />
      ) : transactions.length === 0 ? (
        <Text style={[styles.empty, { color: fg }]}>{t('no_transactions')}</Text>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(_, index) => index.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  item: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
  },
  text: { fontSize: 16, fontWeight: '500' },
  subtext: { fontSize: 13, marginTop: 4 },
  empty: { textAlign: 'center', fontSize: 16, marginTop: 20 }
});
