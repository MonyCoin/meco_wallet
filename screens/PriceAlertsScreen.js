// screens/PriceAlertsScreen.js
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, Modal, TextInput,
  Platform, KeyboardAvoidingView, Keyboard, TouchableWithoutFeedback,
  Image, ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../store';
import { getJupiterMarketData, CORE_TOKENS } from '../services/jupiterMarketService';
import {
  getAlerts,
  addAlert,
  deleteAlert,
  toggleAlert,
  formatAlertPrice,
  checkPriceAlerts,
} from '../services/priceAlertService';

export default function PriceAlertsScreen() {
  const navigation   = useNavigation();
  const route        = useRoute();
  const { t }        = useTranslation();
  const theme        = useAppStore(s => s.theme);
  const primaryColor = useAppStore(s => s.primaryColor || '#E74C3C');
  const isDark       = theme === 'dark';
  const insets       = useSafeAreaInsets();

  const C = {
    bg:      isDark ? '#07070F' : '#F4F5F9',
    card:    isDark ? '#111122' : '#FFFFFF',
    card2:   isDark ? '#171730' : '#ECECF4',
    text:    isDark ? '#EEEEFF' : '#1C1C24',
    muted:   isDark ? '#7E7EAA' : '#8A8A9E',
    border:  isDark ? '#1E1E38' : '#E8E8F2',
    success: '#10B981',
    error:   '#EF4444',
    warning: '#F59E0B',
    info:    '#3B82F6',
  };

  const [alerts,       setAlerts]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [addModal,     setAddModal]     = useState(false);
  const [checking,     setChecking]     = useState(false);

  // ─── حالة نموذج الإضافة ─────────────────────────────────────────────────
  const [tokens,       setTokens]       = useState([]);
  const [selectedToken,setSelectedToken]= useState(null);
  const [tokenModal,   setTokenModal]   = useState(false);
  const [direction,    setDirection]    = useState('above');
  const [targetPrice,  setTargetPrice]  = useState('');
  const [saving,       setSaving]       = useState(false);

  // ─── تحميل التنبيهات ────────────────────────────────────────────────────
  const loadAlerts = useCallback(async () => {
    try {
      const list = await getAlerts();
      setAlerts(list);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  // ─── فحص التنبيهات يدوياً ───────────────────────────────────────────────
  const runCheck = useCallback(async (showLoader = false) => {
    if (showLoader) setChecking(true);
    try {
      await checkPriceAlerts();
      await loadAlerts();
    } catch (_) {}
    finally { if (showLoader) setChecking(false); }
  }, [loadAlerts]);

  // ✅ عند كل زيارة للشاشة: تحميل + فحص تلقائي
  useFocusEffect(useCallback(() => {
    const init = async () => {
      await loadAlerts();
      await runCheck(false);
    };
    init();
  }, [loadAlerts, runCheck]));

  // ─── تحميل العملات ──────────────────────────────────────────────────────
  const loadTokens = useCallback(async () => {
    try {
      const data = await getJupiterMarketData();
      const filtered = data.filter(tk => CORE_TOKENS.find(c => c.mint === tk.mint));
      setTokens(filtered);

      const sol = filtered.find(tk => tk.symbol === 'SOL') || filtered[0];
      if (sol) setSelectedToken(sol);
      return filtered;
    } catch (_) {
      return [];
    }
  }, []);

  // ─── فتح نافذة الإضافة ──────────────────────────────────────────────────
  const openAddModal = useCallback(async (preselectedTokenFromRoute) => {
    setDirection('above');
    setTargetPrice('');
    setAddModal(true);

    let availableTokens = tokens;
    if (!availableTokens.length) {
      availableTokens = await loadTokens();
    }

    if (preselectedTokenFromRoute) {
      const matched = availableTokens.find(tk => tk.mint === preselectedTokenFromRoute.mint);
      if (matched) {
        setSelectedToken(matched);
      } else if (preselectedTokenFromRoute.symbol) {
        const bySymbol = availableTokens.find(tk => tk.symbol === preselectedTokenFromRoute.symbol);
        if (bySymbol) setSelectedToken(bySymbol);
        else setSelectedToken(preselectedTokenFromRoute);
      } else {
        setSelectedToken(preselectedTokenFromRoute);
      }
    } else if (!selectedToken && availableTokens.length) {
      const sol = availableTokens.find(tk => tk.symbol === 'SOL') || availableTokens[0];
      if (sol) setSelectedToken(sol);
    }
  }, [tokens, selectedToken, loadTokens]);

  // ✅ فتح نافذة الإضافة تلقائياً إذا مُرِّرت عملة من TokenDetails
  useEffect(() => {
    const preToken = route.params?.preselectedToken;
    if (preToken) {
      navigation.setParams({ preselectedToken: undefined });
      setTimeout(() => openAddModal(preToken), 300);
    }
  }, [route.params?.preselectedToken]);

  // ─── حفظ التنبيه + فحص فوري ────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedToken) {
      Alert.alert(t('error'), t('alerts.select_token'));
      return;
    }
    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert(t('error'), t('alerts.enter_valid_price'));
      return;
    }

    setSaving(true);
    try {
      await addAlert({
        symbol:       selectedToken.symbol,
        mint:         selectedToken.mint,
        image:        selectedToken.image,
        targetPrice:  price,
        direction,
        currentPrice: selectedToken.current_price || 0,
      });
      setAddModal(false);
      await loadAlerts();
      
      // ✅ فحص فوري بعد الإضافة — يُفعّل التنبيه مباشرة إن تحقق الشرط
      await runCheck(false);
      
      Alert.alert(t('success'), t('alerts.added_success', { symbol: selectedToken.symbol }));
    } catch (e) {
      Alert.alert(t('error'), e.message);
    } finally { setSaving(false); }
  };

  // ─── حذف تنبيه ──────────────────────────────────────────────────────────
  const handleDelete = (alert) => {
    Alert.alert(
      t('delete'),
      t('alerts.delete_confirm', { symbol: alert.symbol }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            const updated = await deleteAlert(alert.id);
            setAlerts(updated);
          },
        },
      ]
    );
  };

  // ─── تفعيل/تعطيل ────────────────────────────────────────────────────────
  const handleToggle = async (alert) => {
    const updated = await toggleAlert(alert.id);
    setAlerts(updated);
  };

  // ─── بطاقة تنبيه ────────────────────────────────────────────────────────
  const renderItem = ({ item }) => {
    const isAbove     = item.direction === 'above';
    const dirColor    = isAbove ? C.success : C.error;
    const dirIcon     = isAbove ? 'trending-up' : 'trending-down';
    const dirLabel    = isAbove ? t('alerts.above_label', 'يصل إلى') : t('alerts.below_label', 'ينزل إلى');

    const cardStyle   = item.triggered
      ? { backgroundColor: isDark ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.04)', borderColor: C.success + '40' }
      : !item.enabled
        ? { backgroundColor: C.card, borderColor: C.border, opacity: 0.6 }
        : { backgroundColor: C.card, borderColor: C.border };

    return (
      <View style={[S.alertCard, cardStyle]}>
        <View style={S.alertTop}>
          <View style={[S.alertIconWrap, { backgroundColor: primaryColor + '12' }]}>
            {item.image ? (
              <Image source={{ uri: item.image }} style={S.alertIcon} />
            ) : (
              <Text style={{ color: primaryColor, fontWeight: '800', fontSize: 14 }}>
                {item.symbol?.charAt(0)}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={S.alertTitleRow}>
              <Text style={[S.alertSymbol, { color: C.text }]}>{item.symbol}</Text>
              {item.triggered && (
                <View style={[S.triggeredBadge, { backgroundColor: C.success + '20' }]}>
                  <Ionicons name="checkmark-circle" size={10} color={C.success} />
                  <Text style={[S.triggeredTxt, { color: C.success }]}>
                    {t('alerts.triggered', 'تم')}
                  </Text>
                </View>
              )}
              {!item.enabled && !item.triggered && (
                <View style={[S.triggeredBadge, { backgroundColor: C.muted + '20' }]}>
                  <Text style={[S.triggeredTxt, { color: C.muted }]}>
                    {t('alerts.disabled', 'معطّل')}
                  </Text>
                </View>
              )}
            </View>
            <View style={S.alertDirRow}>
              <Ionicons name={dirIcon} size={12} color={dirColor} />
              <Text style={[S.alertDirTxt, { color: dirColor }]}>{dirLabel}</Text>
            </View>
          </View>
        </View>

        <View style={[S.alertPriceBox, { backgroundColor: C.card2, borderColor: C.border }]}>
          <View style={S.priceColumn}>
            <Text style={[S.priceLabel, { color: C.muted }]}>{t('alerts.target', 'المستهدف')}</Text>
            <Text style={[S.priceValue, { color: dirColor }]}>
              {formatAlertPrice(item.targetPrice)}
            </Text>
          </View>
          <View style={[S.priceDivider, { backgroundColor: C.border }]} />
          <View style={S.priceColumn}>
            <Text style={[S.priceLabel, { color: C.muted }]}>{t('alerts.at_create', 'عند الإنشاء')}</Text>
            <Text style={[S.priceValue, { color: C.text }]}>
              {formatAlertPrice(item.priceAtCreate)}
            </Text>
          </View>
        </View>

        <View style={S.alertActions}>
          <TouchableOpacity
            style={[S.actionBtn, { backgroundColor: primaryColor + '12', borderColor: primaryColor + '30' }]}
            onPress={() => handleToggle(item)}
          >
            <Ionicons
              name={item.triggered ? 'refresh' : item.enabled ? 'pause' : 'play'}
              size={14}
              color={primaryColor}
            />
            <Text style={[S.actionTxt, { color: primaryColor }]}>
              {item.triggered
                ? t('alerts.reactivate', 'إعادة')
                : item.enabled
                  ? t('alerts.pause', 'إيقاف')
                  : t('alerts.activate', 'تشغيل')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[S.actionBtn, { backgroundColor: C.error + '12', borderColor: C.error + '30' }]}
            onPress={() => handleDelete(item)}
          >
            <Ionicons name="trash-outline" size={14} color={C.error} />
            <Text style={[S.actionTxt, { color: C.error }]}>{t('delete')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─── Empty State ────────────────────────────────────────────────────────
  const EmptyState = () => (
    <View style={S.empty}>
      <View style={[S.emptyIcon, { backgroundColor: primaryColor + '12' }]}>
        <Ionicons name="notifications-outline" size={40} color={primaryColor} />
      </View>
      <Text style={[S.emptyTitle, { color: C.text }]}>
        {t('alerts.empty_title', 'لا توجد تنبيهات')}
      </Text>
      <Text style={[S.emptySub, { color: C.muted }]}>
        {t('alerts.empty_hint', 'أضف تنبيهاً ليصلك إشعار عند وصول السعر للمستوى المطلوب')}
      </Text>
    </View>
  );

  return (
    <View style={[S.root, { backgroundColor: C.bg }]}>

      {/* ── الهيدر ── */}
      <View style={[S.header, { backgroundColor: C.card, borderBottomColor: C.border, paddingTop: Platform.OS === 'ios' ? 12 : insets.top + 12 }]}>
        <TouchableOpacity
          style={[S.iconBtn, { backgroundColor: C.card2, borderColor: C.border }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={18} color={C.text} />
        </TouchableOpacity>

        <View style={S.headerCenter}>
          <Text style={[S.headerTitle, { color: C.text }]}>
            {t('alerts.title', 'تنبيهات الأسعار')}
          </Text>
          <Text style={[S.headerSub, { color: C.muted }]}>
            {alerts.length > 0
              ? t('alerts.count', { count: alerts.length, defaultValue: '{{count}} تنبيه' })
              : t('alerts.subtitle', 'راقب الأسعار بذكاء')}
          </Text>
        </View>

        {/* ✅ زر فحص يدوي + زر إضافة */}
        <View style={S.headerActions}>
          <TouchableOpacity
            style={[S.iconBtn, { backgroundColor: primaryColor + '12', borderColor: primaryColor + '30' }]}
            onPress={() => runCheck(true)}
            disabled={checking}
          >
            {checking
              ? <ActivityIndicator size="small" color={primaryColor} />
              : <Ionicons name="refresh" size={18} color={primaryColor} />
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[S.iconBtn, { backgroundColor: primaryColor, borderColor: primaryColor }]}
            onPress={() => openAddModal()}
          >
            <Ionicons name="add" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── القائمة ── */}
      {loading ? (
        <View style={S.loadingWrap}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <FlatList
          data={alerts}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[S.list, { paddingBottom: insets.bottom + 100 }]}
          ListEmptyComponent={EmptyState}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ═══ Modal: إضافة تنبيه ═══ */}
      <Modal visible={addModal} transparent animationType="slide" onRequestClose={() => setAddModal(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={S.modalOverlay}
          >
            <View style={[S.modalSheet, { backgroundColor: C.card }]}>
              <View style={[S.handle, { backgroundColor: C.border }]} />

              <View style={S.modalHeader}>
                <Text style={[S.modalTitle, { color: C.text }]}>
                  {t('alerts.add_title', 'إضافة تنبيه جديد')}
                </Text>
                <TouchableOpacity
                  style={[S.closeBtn, { backgroundColor: C.card2 }]}
                  onPress={() => setAddModal(false)}
                >
                  <Ionicons name="close" size={18} color={C.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                {/* اختيار العملة */}
                <Text style={[S.fieldLabel, { color: C.muted }]}>
                  {t('alerts.field_token', 'العملة')}
                </Text>
                <TouchableOpacity
                  style={[S.selectorBtn, { backgroundColor: C.card2, borderColor: C.border }]}
                  onPress={() => setTokenModal(true)}
                >
                  {selectedToken ? (
                    <>
                      {selectedToken.image && (
                        <Image source={{ uri: selectedToken.image }} style={S.selTokenIcon} />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[S.selTokenSym, { color: C.text }]}>
                          {selectedToken.symbol}
                        </Text>
                        <Text style={[S.selTokenPrice, { color: C.muted }]}>
                          {formatAlertPrice(selectedToken.current_price || 0)}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <Text style={[S.selPlaceholder, { color: C.muted }]}>
                      {t('alerts.select_token', 'اختر العملة')}
                    </Text>
                  )}
                  <Ionicons name="chevron-down" size={16} color={C.muted} />
                </TouchableOpacity>

                {/* الاتجاه */}
                <Text style={[S.fieldLabel, { color: C.muted, marginTop: 14 }]}>
                  {t('alerts.field_direction', 'اتجاه التنبيه')}
                </Text>
                <View style={[S.dirTabs, { backgroundColor: C.card2 }]}>
                  {[
                    { id:'above', icon:'trending-up',   label:t('alerts.above_short','صعود'), color:C.success },
                    { id:'below', icon:'trending-down', label:t('alerts.below_short','هبوط'), color:C.error },
                  ].map(opt => {
                    const active = direction === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[S.dirTab, active && { backgroundColor: opt.color }]}
                        onPress={() => setDirection(opt.id)}
                      >
                        <Ionicons
                          name={opt.icon}
                          size={14}
                          color={active ? '#FFF' : C.muted}
                        />
                        <Text style={[S.dirTabTxt, { color: active ? '#FFF' : C.muted }]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* السعر المستهدف */}
                <Text style={[S.fieldLabel, { color: C.muted, marginTop: 14 }]}>
                  {t('alerts.field_price', 'السعر المستهدف (USD)')}
                </Text>
                <View style={[S.inputWrap, { backgroundColor: C.card2, borderColor: C.border }]}>
                  <Text style={[S.inputPrefix, { color: C.muted }]}>$</Text>
                  <TextInput
                    style={[S.input, { color: C.text }]}
                    value={targetPrice}
                    onChangeText={setTargetPrice}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={C.muted}
                    autoCorrect={false}
                  />
                </View>

                {/* معاينة سريعة */}
                {selectedToken && targetPrice && parseFloat(targetPrice) > 0 && (
                  <View style={[S.previewBox, { backgroundColor: direction === 'above' ? C.success + '10' : C.error + '10', borderColor: direction === 'above' ? C.success + '30' : C.error + '30' }]}>
                    <Ionicons
                      name={direction === 'above' ? 'arrow-up-circle' : 'arrow-down-circle'}
                      size={16}
                      color={direction === 'above' ? C.success : C.error}
                    />
                    <Text style={[S.previewTxt, { color: C.text }]}>
                      {t('alerts.preview', {
                        symbol: selectedToken.symbol,
                        price:  formatAlertPrice(parseFloat(targetPrice) || 0),
                        defaultValue: 'سيصلك إشعار عندما يصل {{symbol}} إلى {{price}}',
                      })}
                    </Text>
                  </View>
                )}

                {/* حفظ */}
                <TouchableOpacity
                  style={[S.saveBtn, { backgroundColor: primaryColor, opacity: saving ? 0.7 : 1 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="notifications" size={18} color="#FFF" />
                      <Text style={S.saveBtnTxt}>
                        {t('alerts.save', 'حفظ التنبيه')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ═══ Modal: اختيار العملة ═══ */}
      <Modal visible={tokenModal} transparent animationType="slide" onRequestClose={() => setTokenModal(false)}>
        <View style={S.modalOverlay}>
          <View style={[S.tokenSheet, { backgroundColor: C.card }]}>
            <View style={[S.handle, { backgroundColor: C.border }]} />
            <View style={S.modalHeader}>
              <Text style={[S.modalTitle, { color: C.text }]}>
                {t('alerts.choose_token', 'اختر العملة')}
              </Text>
              <TouchableOpacity
                style={[S.closeBtn, { backgroundColor: C.card2 }]}
                onPress={() => setTokenModal(false)}
              >
                <Ionicons name="close" size={18} color={C.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={tokens}
              keyExtractor={item => item.mint}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[S.tokenItem, { backgroundColor: C.card2, borderColor: selectedToken?.mint === item.mint ? primaryColor : C.border }]}
                  onPress={() => { setSelectedToken(item); setTokenModal(false); }}
                >
                  {item.image && <Image source={{ uri: item.image }} style={S.tokenIcon} />}
                  <View style={{ flex: 1 }}>
                    <Text style={[S.tokenSymbol, { color: C.text }]}>{item.symbol}</Text>
                    <Text style={[S.tokenPrice, { color: C.muted }]}>
                      {formatAlertPrice(item.current_price || 0)}
                    </Text>
                  </View>
                  {selectedToken?.mint === item.mint && (
                    <Ionicons name="checkmark-circle" size={20} color={primaryColor} />
                  )}
                </TouchableOpacity>
              )}
              style={{ maxHeight: 380 }}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>

    </View>
  );
}

const S = StyleSheet.create({
  root:   { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1,
  },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 18, fontWeight: '800' },
  headerSub:    { fontSize: 12, marginTop: 2 },
  headerActions:{ flexDirection: 'row', gap: 8 },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:        { padding: 16 },

  alertCard: {
    backgroundColor: '#111122',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  alertTop:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  alertIconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  alertIcon:     { width: 24, height: 24, borderRadius: 12 },
  alertTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  alertSymbol:   { fontSize: 16, fontWeight: '800' },
  alertDirRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  alertDirTxt:   { fontSize: 11, fontWeight: '600' },

  triggeredBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  triggeredTxt: { fontSize: 9, fontWeight: '800' },

  alertPriceBox: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1, padding: 10, marginBottom: 10,
  },
  priceColumn: { flex: 1, alignItems: 'center' },
  priceDivider:{ width: 1, height: 30, marginHorizontal: 8 },
  priceLabel:  { fontSize: 10, fontWeight: '600', marginBottom: 3 },
  priceValue:  { fontSize: 14, fontWeight: '800' },

  alertActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, borderRadius: 10, borderWidth: 1, gap: 5,
  },
  actionTxt: { fontSize: 12, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 70, gap: 12 },
  emptyIcon: {
    width: 90, height: 90, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptySub:   { fontSize: 13, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    padding: 20, paddingTop: 12,
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  tokenSheet: {
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    padding: 20, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle:  { fontSize: 18, fontWeight: '800' },
  closeBtn:    { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8 },

  selectorBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 12, height: 56,
  },
  selTokenIcon:  { width: 28, height: 28, borderRadius: 14 },
  selTokenSym:   { fontSize: 14, fontWeight: '800' },
  selTokenPrice: { fontSize: 11, marginTop: 1 },
  selPlaceholder:{ fontSize: 13, flex: 1 },

  dirTabs: { flexDirection: 'row', borderRadius: 12, padding: 3, gap: 3 },
  dirTab:  {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 10, gap: 6,
  },
  dirTabTxt: { fontSize: 13, fontWeight: '700' },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 52,
  },
  inputPrefix: { fontSize: 18, fontWeight: '800', marginRight: 6 },
  input:       { flex: 1, fontSize: 18, fontWeight: '700', paddingVertical: 0 },

  previewBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 14,
  },
  previewTxt: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 18 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 16, borderRadius: 14, marginTop: 20, gap: 8,
  },
  saveBtnTxt: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  tokenItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8,
  },
  tokenIcon:   { width: 32, height: 32, borderRadius: 16 },
  tokenSymbol: { fontSize: 14, fontWeight: '800' },
  tokenPrice:  { fontSize: 11, marginTop: 1 },
});
