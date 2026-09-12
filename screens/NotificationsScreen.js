// screens/NotificationsScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Platform, Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  getNotifColor,
  formatTimeAgo,
} from '../services/notificationsService';

export default function NotificationsScreen() {
  const navigation   = useNavigation();
  const { t }        = useTranslation();
  const theme        = useAppStore(s => s.theme);
  const primaryColor = useAppStore(s => s.primaryColor || '#E74C3C');
  const isDark       = theme === 'dark';
  const insets       = useSafeAreaInsets();

  const [notifications, setNotifications] = useState([]);

  const C = {
    bg:       isDark ? '#07070F' : '#F4F5F9',
    card:     isDark ? '#111122' : '#FFFFFF',
    text:     isDark ? '#EEEEFF' : '#1C1C24',
    muted:    isDark ? '#7E7EAA' : '#8A8A9E',
    border:   isDark ? '#1E1E38' : '#E8E8F2',
    unreadBg: isDark ? 'rgba(231,76,60,0.06)' : 'rgba(231,76,60,0.04)',
  };

  const loadNotifications = async () => {
    const data = await getNotifications();
    setNotifications(data);
  };

  useFocusEffect(useCallback(() => {
    loadNotifications();
  }, []));

  const handlePress = async (notif) => {
    if (!notif.read) {
      const updated = await markAsRead(notif.id);
      setNotifications(updated);
    }
  };

  const handleDelete = (notif) => {
    Alert.alert(
      t('delete', 'حذف'),
      t('delete_notification_confirm', 'هل تريد حذف هذا الإشعار؟'),
      [
        { text: t('cancel', 'إلغاء'), style: 'cancel' },
        {
          text: t('delete', 'حذف'),
          style: 'destructive',
          onPress: async () => {
            const updated = await deleteNotification(notif.id);
            setNotifications(updated);
          },
        },
      ]
    );
  };

  const handleMarkAllRead = async () => {
    const updated = await markAllAsRead();
    setNotifications(updated);
  };

  const handleClearAll = () => {
    Alert.alert(
      t('clear_all', 'مسح الكل'),
      t('clear_all_confirm', 'هل تريد مسح جميع الإشعارات؟'),
      [
        { text: t('cancel', 'إلغاء'), style: 'cancel' },
        {
          text: t('clear_all', 'مسح الكل'),
          style: 'destructive',
          onPress: async () => {
            await clearAllNotifications();
            setNotifications([]);
          },
        },
      ]
    );
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const renderItem = ({ item }) => {
    const color = getNotifColor(item.type, primaryColor);
    return (
      <TouchableOpacity
        style={[
          S.notifCard,
          {
            backgroundColor: item.read ? C.card : C.unreadBg,
            borderColor:     C.border,
            borderRightColor: item.read ? C.border : color,
          }
        ]}
        onPress={() => handlePress(item)}
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.75}
      >
        <View style={[S.iconWrap, { backgroundColor: color + '18' }]}>
          <Text style={S.iconEmoji}>{item.icon}</Text>
        </View>
        <View style={S.notifContent}>
          <View style={S.notifTop}>
            <Text style={[S.notifTitle, { color: C.text }]} numberOfLines={1}>
              {t(item.titleKey, { ...item.params, defaultValue: item.titleKey })}
            </Text>
            {!item.read && <View style={[S.unreadDot, { backgroundColor: color }]} />}
          </View>
          <Text style={[S.notifMessage, { color: C.muted }]} numberOfLines={2}>
            {t(item.messageKey, { ...item.params, defaultValue: item.messageKey })}
          </Text>
          <Text style={[S.notifTime, { color: C.muted }]}>
            {formatTimeAgo(item.createdAt, t)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const EmptyState = () => (
    <View style={S.empty}>
      <View style={[S.emptyIcon, { backgroundColor: primaryColor + '12' }]}>
        <Ionicons name="notifications-off-outline" size={40} color={primaryColor} />
      </View>
      <Text style={[S.emptyTitle, { color: C.text }]}>
        {t('no_notifications', 'لا توجد إشعارات')}
      </Text>
      <Text style={[S.emptySub, { color: C.muted }]}>
        {t('no_notifications_hint', 'ستظهر هنا إشعارات عملياتك')}
      </Text>
    </View>
  );

  return (
    <View style={[S.root, { backgroundColor: C.bg, paddingTop: Platform.OS === 'ios' ? insets.top : 0 }]}>
      {/* ── Header ── */}
      <View style={[S.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[S.iconBtn, { backgroundColor: C.bg }]}
        >
          <Ionicons name="arrow-back" size={18} color={C.text} />
        </TouchableOpacity>
        <View style={S.headerCenter}>
          <Text style={[S.headerTitle, { color: C.text }]}>
            {t('notifications', 'الإشعارات')}
          </Text>
          {unreadCount > 0 && (
            <View style={[S.headerBadge, { backgroundColor: primaryColor }]}>
              <Text style={S.headerBadgeTxt}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {notifications.length > 0 ? (
          <TouchableOpacity
            onPress={handleMarkAllRead}
            style={[S.iconBtn, { backgroundColor: C.bg }]}
          >
            <Ionicons name="checkmark-done" size={18} color={primaryColor} />
          </TouchableOpacity>
        ) : <View style={S.iconBtn} />}
      </View>

      {/* ── أزرار الإجراءات ── */}
      {notifications.length > 0 && (
        <View style={S.actionsRow}>
          <TouchableOpacity
            onPress={handleMarkAllRead}
            style={[S.actionBtn, { borderColor: C.border }]}
          >
            <Ionicons name="checkmark-done-outline" size={14} color={primaryColor} />
            <Text style={[S.actionTxt, { color: primaryColor }]}>
              {t('mark_all_read', 'تعليم الكل كمقروء')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleClearAll}
            style={[S.actionBtn, { borderColor: C.border }]}
          >
            <Ionicons name="trash-outline" size={14} color="#EF4444" />
            <Text style={[S.actionTxt, { color: '#EF4444' }]}>
              {t('clear_all', 'مسح الكل')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── قائمة الإشعارات ── */}
      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={[S.list, { paddingBottom: insets.bottom + 30 }]}
        ListEmptyComponent={<EmptyState />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    paddingTop: Platform.OS === 'android' ? 40 : 12,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: 8,
  },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerBadge: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10, minWidth: 22, alignItems: 'center',
  },
  headerBadgeTxt: { color: '#FFF', fontSize: 11, fontWeight: '800' },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1,
  },
  actionTxt: { fontSize: 12, fontWeight: '700' },

  list: { paddingHorizontal: 16, paddingTop: 4 },

  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderRightWidth: 3,
    marginBottom: 10,
  },
  iconWrap: {
    width: 42, height: 42, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  iconEmoji: { fontSize: 20 },
  notifContent: { flex: 1 },
  notifTop: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, marginBottom: 4,
  },
  notifTitle: { fontSize: 14, fontWeight: '800', flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  notifMessage: { fontSize: 12.5, lineHeight: 18, marginBottom: 6 },
  notifTime: { fontSize: 11, fontWeight: '600' },

  empty: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 80, gap: 12,
  },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
});
