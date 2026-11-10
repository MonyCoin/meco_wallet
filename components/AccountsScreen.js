// components/AccountsScreen.js
// شاشة الحسابات (ملء الشاشة) — تُفتح من شاشة المحفظة.
//  • الحساب المفعّل في بطاقة، والباقي مسطح على خلفية سوداء
//  • سحب لليمين: تعديل الاسم — سحب لليسار: نسخ العنوان
//  • أسفل الشاشة زران: Add wallet (إضافة/استيراد) و Manage (حذف/تصدير)
//  • الحذف والتصدير يمرّان بقفل الهاتف، والمفتاح الخاص مخفي افتراضياً مع Show/Hide ونسخ
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, ActivityIndicator,
  TextInput, Alert, Pressable, AppState, KeyboardAvoidingView, Platform,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { copySensitive } from '../services/secureClipboard';
import { protectScreen, unprotectScreen } from '../services/screenGuard';

const C = {
  bg: '#000000', card: '#141414', card2: '#1E1E1E', border: '#262626',
  text: '#F2F2F2', muted: '#8A8A8E', error: '#EF4444', success: '#10B981', warn: '#F59E0B',
};

export default function AccountsScreen({
  visible, onClose, accounts, activeAccountIndex, balances, loading, hideBalance, emojis,
  primaryColor, adding, onSwitch, onCopy, onRename, onAdd, onImport, onDelete, getPrivateKey,
}) {
  const { t }   = useTranslation();
  const insets  = useSafeAreaInsets();

  const [sheet,     setSheet]     = useState(null);   // add | manage | pick | confirmDelete | export | rename
  const [pickMode,  setPickMode]  = useState('export');
  const [target,    setTarget]    = useState(null);
  const [secret,    setSecret]    = useState('');
  const [reveal,    setReveal]    = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [busy,      setBusy]      = useState(false);
  const swipeRefs = useRef({});

  const closeSheet = () => {
    unprotectScreen('key');
    setSecret('');
    setReveal(false);
    setTarget(null);
    setSheet(null);
  };

  // إغلاق كل شيء عند إخفاء الشاشة
  useEffect(() => { if (!visible) closeSheet(); }, [visible]);

  // المفتاح الخاص لا يبقى ظاهراً إذا خرج المستخدم من التطبيق
  useEffect(() => {
    if (sheet !== 'export') return undefined;
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') closeSheet(); });
    return () => sub.remove();
  }, [sheet]);

  const auth = async (prompt) => {
    try {
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: prompt, disableDeviceFallback: false, fallbackLabel: t('use_phone_passcode'),
      });
      return !!r.success;
    } catch (_) { return false; }
  };

  // ───── خطوات الإدارة ─────
  const openPick = (mode) => { setPickMode(mode); setSheet('pick'); };

  const onPickAccount = async (acc) => {
    if (pickMode === 'delete') { setTarget(acc); setSheet('confirmDelete'); return; }
    if (busy) return;
    setBusy(true);
    try {
      const ok = await auth(t('passcode_prompt'));
      if (!ok) { Alert.alert(t('error'), t('auth_failed')); return; }
      const key = await getPrivateKey(acc.index);
      if (!key) { Alert.alert(t('error'), t('private_key_not_found')); return; }
      protectScreen('key');
      setTarget(acc);
      setSecret(key);
      setReveal(false);
      setSheet('export');
    } catch (_) {
      Alert.alert(t('error'), t('unexpected_error'));
    } finally { setBusy(false); }
  };

  const onConfirmDelete = async () => {
    if (!target || busy) return;
    setBusy(true);
    try {
      const ok = await auth(t('acc.delete_auth'));
      if (!ok) { Alert.alert(t('error'), t('auth_failed')); return; }
      await onDelete(target.index);
      closeSheet();
    } catch (_) {
      Alert.alert(t('error'), t('unexpected_error'));
    } finally { setBusy(false); }
  };

  const onCopyKey = async () => {
    await copySensitive(secret);
    Alert.alert(t('success'), t('copied'));
  };

  const onSaveName = async () => {
    const name = nameDraft.trim();
    if (target && name) await onRename(target.index, name);
    closeSheet();
  };

  const onAddAccount = async () => {
    await onAdd();
    closeSheet();
  };

  const deletable = accounts.length > 1 ? accounts.filter(a => a.index !== activeAccountIndex) : [];

  // ───── صف الحساب ─────
  const renderEditAction = (item) => (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[st.swipeBtn, { backgroundColor: '#6366F1', marginRight: 8 }]}
      onPress={() => {
        swipeRefs.current[item.index]?.close();
        setTarget(item);
        setNameDraft(item.name);
        setSheet('rename');
      }}
    >
      <Ionicons name="pencil" size={18} color="#FFF" />
      <Text style={st.swipeTxt}>{t('edit')}</Text>
    </TouchableOpacity>
  );

  const renderCopyAction = (item) => (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[st.swipeBtn, { backgroundColor: C.success, marginLeft: 8 }]}
      onPress={() => { swipeRefs.current[item.index]?.close(); onCopy(item.publicKey); }}
    >
      <Ionicons name="copy" size={18} color="#FFF" />
      <Text style={st.swipeTxt}>{t('copy')}</Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }) => {
    const isActive = item.index === activeAccountIndex;
    const usd      = balances[item.publicKey];
    const isLoad   = loading && usd === undefined;
    const emoji    = emojis[item.publicKey];
    return (
      <View style={{ marginBottom: 8 }}>
        <Swipeable
          ref={ref => (swipeRefs.current[item.index] = ref)}
          friction={1} leftThreshold={36} rightThreshold={36}
          overshootLeft={false} overshootRight={false}
          renderLeftActions={() => renderEditAction(item)}
          renderRightActions={() => renderCopyAction(item)}
          onSwipeableWillOpen={() => {
            Object.keys(swipeRefs.current).forEach(k => {
              if (k !== String(item.index)) swipeRefs.current[k]?.close?.();
            });
          }}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            style={[st.row, { backgroundColor: isActive ? C.card : C.bg }]}
            onPress={() => onSwitch(item.index)}
          >
            <View style={[st.avatar, { backgroundColor: primaryColor + (isActive ? '30' : '18') }]}>
              <Text style={emoji ? st.avatarEmoji : [st.avatarTxt, { color: primaryColor }]}>
                {emoji || item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.name} numberOfLines={1}>{item.name}</Text>
              <Text style={st.addr}>{item.publicKey.slice(0, 6)}...{item.publicKey.slice(-4)}</Text>
            </View>
            <View style={st.balWrap}>
              {isActive && <Ionicons name="checkmark-circle" size={18} color={primaryColor} style={{ marginHorizontal: 8 }} />}
              {isLoad
                ? <ActivityIndicator size="small" color={primaryColor} />
                : <Text style={st.bal}>
                    {hideBalance ? '•••••' : `$${(usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </Text>}
            </View>
          </TouchableOpacity>
        </Swipeable>
      </View>
    );
  };

  // ───── النوافذ السفلية ─────
  const Option = ({ icon, color, title, desc, onPress, disabled }) => (
    <TouchableOpacity
      activeOpacity={0.8} disabled={disabled} onPress={onPress}
      style={[st.option, disabled && { opacity: 0.4 }]}
    >
      <View style={[st.optionIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.optionTitle}>{title}</Text>
        {!!desc && <Text style={st.optionDesc}>{desc}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.muted} />
    </TouchableOpacity>
  );

  const renderSheetBody = () => {
    switch (sheet) {
      case 'add':
        return (
          <>
            <Text style={st.sheetTitle}>{t('acc.add_wallet')}</Text>
            <Option
              icon="add-circle-outline" color={primaryColor}
              title={t('add_account')} desc={t('acc.add_new_desc')}
              onPress={onAddAccount} disabled={adding}
            />
            <Option
              icon="key-outline" color={C.warn}
              title={t('acc.import_account')} desc={t('acc.import_desc')}
              onPress={() => { closeSheet(); onImport(); }}
            />
          </>
        );
      case 'manage':
        return (
          <>
            <Text style={st.sheetTitle}>{t('acc.manage')}</Text>
            <Option
              icon="key-outline" color={C.warn}
              title={t('acc.export_account')} desc={t('acc.export_desc')}
              onPress={() => openPick('export')}
            />
            <Option
              icon="trash-outline" color={C.error}
              title={t('acc.delete_account')} desc={t('acc.delete_desc')}
              onPress={() => openPick('delete')}
            />
          </>
        );
      case 'pick': {
        const list = pickMode === 'delete' ? deletable : accounts;
        return (
          <>
            <Text style={st.sheetTitle}>{pickMode === 'delete' ? t('acc.pick_delete') : t('acc.pick_export')}</Text>
            {list.length === 0
              ? <Text style={st.sheetNote}>{t('acc.delete_none')}</Text>
              : list.map(a => (
                <TouchableOpacity key={a.index} activeOpacity={0.8} style={st.pickRow} onPress={() => onPickAccount(a)} disabled={busy}>
                  <View style={[st.avatarSm, { backgroundColor: primaryColor + '22' }]}>
                    <Text style={a && emojis[a.publicKey] ? st.avatarEmoji : [st.avatarTxt, { color: primaryColor }]}>
                      {emojis[a.publicKey] || a.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.name} numberOfLines={1}>{a.name}</Text>
                    <Text style={st.addr}>{a.publicKey.slice(0, 6)}...{a.publicKey.slice(-4)}</Text>
                  </View>
                  {busy ? <ActivityIndicator size="small" color={primaryColor} /> : <Ionicons name="chevron-forward" size={16} color={C.muted} />}
                </TouchableOpacity>
              ))}
          </>
        );
      }
      case 'confirmDelete':
        return (
          <>
            <Text style={st.sheetTitle}>{t('acc.delete_account')}</Text>
            <View style={st.warnBox}>
              <Ionicons name="warning" size={20} color={C.error} />
              <Text style={[st.warnTxt, { color: '#FCA5A5' }]}>
                {t('acc.delete_warning', { name: target ? target.name : '' })}
              </Text>
            </View>
            <TouchableOpacity activeOpacity={0.85} style={[st.bigBtn, { backgroundColor: C.error, opacity: busy ? 0.6 : 1 }]} onPress={onConfirmDelete} disabled={busy}>
              {busy ? <ActivityIndicator color="#FFF" /> : <Text style={st.bigBtnTxt}>{t('acc.delete_confirm')}</Text>}
            </TouchableOpacity>
          </>
        );
      case 'export':
        return (
          <>
            <Text style={st.sheetTitle}>{t('acc.export_title', { name: target ? target.name : '' })}</Text>
            <View style={[st.warnBox, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
              <Ionicons name="warning" size={20} color={C.warn} />
              <Text style={[st.warnTxt, { color: '#FCD34D' }]}>{t('acc.export_warning')}</Text>
            </View>
            <View style={st.keyBox}>
              <Text style={st.keyTxt} selectable={false}>
                {reveal ? secret : '•'.repeat(Math.min(secret.length, 44))}
              </Text>
            </View>
            <View style={st.keyActions}>
              <TouchableOpacity activeOpacity={0.85} style={[st.keyBtn, { backgroundColor: C.card2 }]} onPress={() => setReveal(v => !v)}>
                <Ionicons name={reveal ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.text} />
                <Text style={st.keyBtnTxt}>{reveal ? t('acc.hide') : t('acc.show')}</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.85} style={[st.keyBtn, { backgroundColor: primaryColor }]} onPress={onCopyKey}>
                <Ionicons name="copy-outline" size={18} color="#FFF" />
                <Text style={[st.keyBtnTxt, { color: '#FFF' }]}>{t('copy_key')}</Text>
              </TouchableOpacity>
            </View>
          </>
        );
      case 'rename':
        return (
          <>
            <Text style={st.sheetTitle}>{t('edit_wallet_name')}</Text>
            <TextInput
              style={st.input}
              value={nameDraft} onChangeText={setNameDraft}
              autoFocus autoCorrect={false}
              placeholder={t('enter_wallet_name')} placeholderTextColor={C.muted}
            />
            <View style={st.keyActions}>
              <TouchableOpacity activeOpacity={0.85} style={[st.keyBtn, { backgroundColor: C.card2 }]} onPress={closeSheet}>
                <Text style={st.keyBtnTxt}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.85} style={[st.keyBtn, { backgroundColor: primaryColor }]} onPress={onSaveName}>
                <Text style={[st.keyBtnTxt, { color: '#FFF' }]}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => { if (sheet) closeSheet(); else onClose(); }} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={[st.screen, { paddingTop: insets.top + 8 }]}>
          <View style={st.header}>
            <TouchableOpacity onPress={onClose} style={st.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="arrow-back" size={22} color={C.text} />
            </TouchableOpacity>
            <Text style={st.title}>{t('accounts')}</Text>
            <View style={{ width: 40 }} />
          </View>
          <Text style={st.hint}>{t('acc.hint')}</Text>

          <FlatList
            data={accounts}
            renderItem={renderItem}
            keyExtractor={item => String(item.index)}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
          />

          <View style={[st.footer, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity activeOpacity={0.85} style={[st.footBtn, { backgroundColor: primaryColor }]} onPress={() => setSheet('add')}>
              <Ionicons name="add-circle-outline" size={20} color="#FFF" />
              <Text style={[st.footTxt, { color: '#FFF' }]}>{t('acc.add_wallet')}</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.85} style={[st.footBtn, { backgroundColor: C.card }]} onPress={() => setSheet('manage')}>
              <Ionicons name="settings-outline" size={20} color={C.text} />
              <Text style={[st.footTxt, { color: C.text }]}>{t('acc.manage')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* النوافذ السفلية: داخل نفس الشاشة (بلا Modal متداخل) */}
        {sheet && (
          <View style={StyleSheet.absoluteFill}>
            <Pressable style={st.backdrop} onPress={closeSheet} />
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={st.sheetWrap} pointerEvents="box-none"
            >
              <View style={[st.sheet, { paddingBottom: insets.bottom + 20 }]}>
                <View style={st.handle} />
                <TouchableOpacity onPress={closeSheet} style={st.sheetClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={18} color={C.text} />
                </TouchableOpacity>
                {renderSheetBody()}
              </View>
            </KeyboardAvoidingView>
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

const st = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: C.bg },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 6 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  title:   { color: C.text, fontSize: 18, fontWeight: '800' },
  hint:    { color: C.muted, fontSize: 12, textAlign: 'center', marginBottom: 10, paddingHorizontal: 16 },

  row:      { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, gap: 12 },
  avatar:   { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarSm: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:   { fontSize: 18, fontWeight: '800' },
  avatarEmoji: { fontSize: 22 },
  name:     { color: C.text, fontSize: 15, fontWeight: '700' },
  addr:     { color: C.muted, fontSize: 12, marginTop: 2 },
  balWrap:  { flexDirection: 'row', alignItems: 'center' },
  bal:      { color: C.text, fontSize: 14, fontWeight: '700' },

  swipeBtn: { width: 76, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 4 },
  swipeTxt: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  footer:   { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  footBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 999 },
  footTxt:  { fontSize: 15, fontWeight: '700' },

  backdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet:     { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 10 },
  handle:    { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 14 },
  sheetClose:{ position: 'absolute', top: 12, right: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  sheetTitle:{ color: C.text, fontSize: 17, fontWeight: '800', marginBottom: 14, textAlign: 'center', paddingHorizontal: 36 },
  sheetNote: { color: C.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', paddingVertical: 12 },

  option:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card2, borderRadius: 16, padding: 14, marginBottom: 10 },
  optionIcon:  { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  optionDesc:  { color: C.muted, fontSize: 12, marginTop: 2 },

  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card2, borderRadius: 16, padding: 12, marginBottom: 8 },

  warnBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 14, padding: 14, marginBottom: 16 },
  warnTxt: { flex: 1, fontSize: 13, lineHeight: 20 },
  bigBtn:  { alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 999 },
  bigBtnTxt: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  keyBox:  { backgroundColor: C.bg, borderRadius: 14, padding: 14, marginBottom: 14, minHeight: 72, justifyContent: 'center' },
  keyTxt:  { color: C.text, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  keyActions: { flexDirection: 'row', gap: 12 },
  keyBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 999 },
  keyBtnTxt: { color: C.text, fontSize: 14, fontWeight: '700' },

  input: { backgroundColor: C.bg, color: C.text, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 14 },
});
