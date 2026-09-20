// screens/AddressBookScreen.js
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Modal, Alert, ActivityIndicator,
  Platform, KeyboardAvoidingView, Keyboard, TouchableWithoutFeedback,
  Image, ScrollView,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useAppStore } from '../store';
import { validateSolanaAddress } from '../services/heliusService';

// ─── التصنيفات ──────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'all',       icon: 'apps-outline',         color: '#6C63FF', labelKey: 'all'       },
  { id: 'family',    icon: 'people-outline',       color: '#EF4444', labelKey: 'family'    },
  { id: 'work',      icon: 'briefcase-outline',    color: '#3B82F6', labelKey: 'work'      },
  { id: 'friends',   icon: 'heart-outline',        color: '#EC4899', labelKey: 'friends'   },
  { id: 'platforms', icon: 'business-outline',     color: '#10B981', labelKey: 'platforms' },
  { id: 'other',     icon: 'star-outline',         color: '#F59E0B', labelKey: 'other'     },
];

const getCategoryInfo = (id) =>
  CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

// ─── الترتيب ────────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { id: 'recent',   icon: 'time-outline',         labelKey: 'recent'   },
  { id: 'alpha',    icon: 'text-outline',         labelKey: 'alpha'    },
  { id: 'used',     icon: 'trending-up-outline',  labelKey: 'most_used'},
];

export default function AddressBookScreen() {
  const navigation   = useNavigation();
  const route        = useRoute();
  const { t }        = useTranslation();
  const theme        = useAppStore(s => s.theme);
  const primaryColor = useAppStore(s => s.primaryColor || '#E74C3C');
  const isDark       = theme === 'dark';
  const insets       = useSafeAreaInsets();

  const addressBook       = useAppStore(s => s.addressBook);
  const loadAddressBook   = useAppStore(s => s.loadAddressBook);
  const saveAddress       = useAppStore(s => s.saveAddress);
  const updateAddress     = useAppStore(s => s.updateAddress);
  const deleteAddressById = useAppStore(s => s.deleteAddressById);

  const mode            = route.params?.mode || 'manage';
  const returnScreen    = route.params?.returnScreen;
  const isSelectionMode = mode === 'select';

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
  };

  const [activeCategory, setActiveCategory] = useState('all');
  const [sortBy,         setSortBy]         = useState('recent');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [searchVisible,  setSearchVisible]  = useState(false);

  const [formModal,      setFormModal]      = useState(false);
  const [editingItem,    setEditingItem]    = useState(null);
  const [formName,       setFormName]       = useState('');
  const [formAddress,    setFormAddress]    = useState('');
  const [formCategory,   setFormCategory]   = useState('other');
  const [formNote,       setFormNote]       = useState('');
  const [formError,      setFormError]      = useState('');
  const [saving,         setSaving]         = useState(false);

  useFocusEffect(useCallback(() => {
    loadAddressBook();
  }, [loadAddressBook]));

  const displayedAddresses = useMemo(() => {
    let list = [...addressBook];

    if (activeCategory !== 'all') {
      list = list.filter(a => (a.category || 'other') === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(a =>
        (a.name    && a.name.toLowerCase().includes(q)) ||
        (a.address && a.address.toLowerCase().includes(q)) ||
        (a.note    && a.note.toLowerCase().includes(q))
      );
    }

    if (sortBy === 'recent') {
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } else if (sortBy === 'alpha') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
    } else if (sortBy === 'used') {
      list.sort((a, b) => (b.useCount || 0) - (a.useCount || 0));
    }

    return list;
  }, [addressBook, activeCategory, searchQuery, sortBy]);

  const categoryCounts = useMemo(() => {
    const counts = { all: addressBook.length };
    CATEGORIES.forEach(cat => {
      if (cat.id === 'all') return;
      counts[cat.id] = addressBook.filter(a => (a.category || 'other') === cat.id).length;
    });
    return counts;
  }, [addressBook]);

  const openAddModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormAddress('');
    setFormCategory('other');
    setFormNote('');
    setFormError('');
    setFormModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormName(item.name || '');
    setFormAddress(item.address || '');
    setFormCategory(item.category || 'other');
    setFormNote(item.note || '');
    setFormError('');
    setFormModal(true);
  };

  const pasteAddress = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setFormAddress(text.trim());
        setFormError('');
      }
    } catch (_) {}
  };

  const handleSave = async () => {
    setFormError('');

    if (!formName.trim()) {
      setFormError(t('address_book.errors.name_required'));
      return;
    }

    if (!formAddress.trim()) {
      setFormError(t('address_book.errors.address_required'));
      return;
    }

    const validation = await validateSolanaAddress(formAddress.trim());
    if (!validation.isValid) {
      setFormError(t('address_book.errors.invalid_address'));
      return;
    }

    if (!editingItem) {
      const exists = addressBook.find(
        a => a.address === formAddress.trim() && a.id !== editingItem?.id
      );
      if (exists) {
        setFormError(t('address_book.errors.already_exists'));
        return;
      }
    }

    setSaving(true);
    try {
      if (editingItem) {
        await updateAddress(editingItem.id, {
          name:     formName.trim(),
          address:  formAddress.trim(),
          category: formCategory,
          note:     formNote.trim(),
        });
      } else {
        await saveAddress(
          formName.trim(),
          formAddress.trim(),
          formCategory,
          formNote.trim()
        );
      }
      setFormModal(false);
      await loadAddressBook();
    } catch (e) {
      setFormError(e.message || t('error'));
    } finally { setSaving(false); }
  };

  const handleDelete = (item) => {
    Alert.alert(
      t('address_book.delete_title'),
      t('address_book.delete_confirm', { name: item.name }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteAddressById(item.id);
            await loadAddressBook();
          },
        },
      ]
    );
  };

  // ✅ التعديل: popTo بدل navigate للعودة بضغطة واحدة
  const handleSelect = (item) => {
    if (isSelectionMode) {
      navigation.popTo(returnScreen || 'Send', {
        selectedAddress: item.address,
      });
    } else {
      openEditModal(item);
    }
  };

  const renderItem = ({ item }) => {
    const cat = getCategoryInfo(item.category || 'other');

    return (
      <TouchableOpacity
        style={[S.itemCard, { backgroundColor: C.card, borderColor: C.border }]}
        onPress={() => handleSelect(item)}
        onLongPress={() => !isSelectionMode && handleDelete(item)}
        delayLongPress={500}
        activeOpacity={0.7}
      >
        <View style={[S.itemIcon, { backgroundColor: cat.color + '18' }]}>
          <Text style={[S.itemIconTxt, { color: cat.color }]}>
            {item.name?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <View style={S.itemTopRow}>
            <Text style={[S.itemName, { color: C.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={[S.catBadge, { backgroundColor: cat.color + '15' }]}>
              <Ionicons name={cat.icon} size={9} color={cat.color} />
            </View>
          </View>
          <Text style={[S.itemAddress, { color: C.muted }]} numberOfLines={1}>
            {item.address?.slice(0, 10)}...{item.address?.slice(-6)}
          </Text>
          {item.note ? (
            <Text style={[S.itemNote, { color: C.muted }]} numberOfLines={1}>
              {item.note}
            </Text>
          ) : null}
        </View>

        <View style={S.itemRight}>
          {item.useCount > 0 && (
            <View style={[S.useBadge, { backgroundColor: primaryColor + '12' }]}>
              <Ionicons name="flash" size={9} color={primaryColor} />
              <Text style={[S.useTxt, { color: primaryColor }]}>
                {item.useCount}
              </Text>
            </View>
          )}
          {isSelectionMode
            ? <Ionicons name="chevron-forward" size={16} color={C.muted} />
            : <Ionicons name="create-outline" size={16} color={C.muted} />
          }
        </View>
      </TouchableOpacity>
    );
  };

  const EmptyState = () => (
    <View style={S.empty}>
      <View style={[S.emptyIcon, { backgroundColor: primaryColor + '12' }]}>
        <Ionicons name="book-outline" size={40} color={primaryColor} />
      </View>
      <Text style={[S.emptyTitle, { color: C.text }]}>
        {searchQuery || activeCategory !== 'all'
          ? t('address_book.no_results')
          : t('address_book.empty_title')}
      </Text>
      <Text style={[S.emptySub, { color: C.muted }]}>
        {searchQuery || activeCategory !== 'all'
          ? t('address_book.no_results_hint')
          : t('address_book.empty_hint')}
      </Text>
    </View>
  );

  return (
    <View style={[S.root, { backgroundColor: C.bg }]}>

      <View style={[S.header, { backgroundColor: C.card, borderBottomColor: C.border, paddingTop: Platform.OS === 'ios' ? 12 : insets.top + 12 }]}>
        <TouchableOpacity
          style={[S.iconBtn, { backgroundColor: C.card2, borderColor: C.border }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={18} color={C.text} />
        </TouchableOpacity>

        <View style={S.headerCenter}>
          <Text style={[S.headerTitle, { color: C.text }]}>
            {t('address_book.title')}
          </Text>
          <Text style={[S.headerSub, { color: C.muted }]}>
            {addressBook.length > 0
              ? t('address_book.count', { count: addressBook.length })
              : t('address_book.subtitle')}
          </Text>
        </View>

        <View style={S.headerActions}>
          <TouchableOpacity
            style={[S.iconBtn, { backgroundColor: C.card2, borderColor: C.border }]}
            onPress={() => setSearchVisible(v => !v)}
          >
            <Ionicons name={searchVisible ? 'close' : 'search'} size={18} color={C.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[S.iconBtn, { backgroundColor: primaryColor, borderColor: primaryColor }]}
            onPress={openAddModal}
          >
            <Ionicons name="add" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {searchVisible && (
        <View style={[S.searchWrap, { backgroundColor: C.card, borderBottomColor: C.border }]}>
          <View style={[S.searchBar, { backgroundColor: C.card2, borderColor: C.border }]}>
            <Ionicons name="search" size={15} color={C.muted} />
            <TextInput
              style={[S.searchInput, { color: C.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('address_book.search_placeholder')}
              placeholderTextColor={C.muted}
              autoCorrect={false}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={C.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <View style={[S.filtersWrap, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={S.filtersContent}
        >
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.id;
            const count    = categoryCounts[cat.id] || 0;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  S.filterChip,
                  {
                    backgroundColor: isActive ? cat.color : C.card2,
                    borderColor:     isActive ? cat.color : C.border,
                  },
                ]}
                onPress={() => setActiveCategory(cat.id)}
              >
                <Ionicons
                  name={cat.icon}
                  size={12}
                  color={isActive ? '#FFF' : cat.color}
                />
                <Text style={[S.filterChipTxt, { color: isActive ? '#FFF' : C.text }]}>
                  {t(`address_book.categories.${cat.labelKey}`)}
                </Text>
                {count > 0 && (
                  <View style={[S.filterCount, { backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : cat.color + '20' }]}>
                    <Text style={[S.filterCountTxt, { color: isActive ? '#FFF' : cat.color }]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={[S.sortWrap, { backgroundColor: C.bg }]}>
        {SORT_OPTIONS.map(opt => {
          const isActive = sortBy === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[
                S.sortBtn,
                {
                  backgroundColor: isActive ? primaryColor + '15' : C.card,
                  borderColor:     isActive ? primaryColor + '35' : C.border,
                },
              ]}
              onPress={() => setSortBy(opt.id)}
            >
              <Ionicons name={opt.icon} size={12} color={isActive ? primaryColor : C.muted} />
              <Text style={[S.sortBtnTxt, { color: isActive ? primaryColor : C.muted }]}>
                {t(`address_book.sorts.${opt.labelKey}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={displayedAddresses}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={[S.list, { paddingBottom: insets.bottom + 100 }]}
        ListEmptyComponent={EmptyState}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      <Modal visible={formModal} transparent animationType="slide" onRequestClose={() => setFormModal(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={S.modalOverlay}
          >
            <View style={[S.modalSheet, { backgroundColor: C.card }]}>
              <View style={[S.handle, { backgroundColor: C.border }]} />

              <View style={S.modalHeader}>
                <Text style={[S.modalTitle, { color: C.text }]}>
                  {editingItem
                    ? t('address_book.edit_title')
                    : t('address_book.add_title')}
                </Text>
                <TouchableOpacity
                  style={[S.closeBtn, { backgroundColor: C.card2 }]}
                  onPress={() => setFormModal(false)}
                >
                  <Ionicons name="close" size={18} color={C.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                <Text style={[S.fieldLabel, { color: C.muted }]}>
                  {t('address_book.fields.name')}
                </Text>
                <View style={[S.inputWrap, { backgroundColor: C.card2, borderColor: C.border }]}>
                  <Ionicons name="person-outline" size={16} color={C.muted} />
                  <TextInput
                    style={[S.input, { color: C.text }]}
                    value={formName}
                    onChangeText={v => { setFormName(v); setFormError(''); }}
                    placeholder={t('address_book.fields.name_placeholder')}
                    placeholderTextColor={C.muted}
                    autoCorrect={false}
                  />
                </View>

                <Text style={[S.fieldLabel, { color: C.muted, marginTop: 14 }]}>
                  {t('address_book.fields.address')}
                </Text>
                <View style={[S.inputWrap, { backgroundColor: C.card2, borderColor: C.border }]}>
                  <Ionicons name="link-outline" size={16} color={C.muted} />
                  <TextInput
                    style={[S.input, { color: C.text, fontFamily: 'monospace', fontSize: 12 }]}
                    value={formAddress}
                    onChangeText={v => { setFormAddress(v); setFormError(''); }}
                    placeholder={t('address_book.fields.address_placeholder')}
                    placeholderTextColor={C.muted}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={pasteAddress} style={[S.pasteBtn, { backgroundColor: primaryColor + '15' }]}>
                    <Ionicons name="clipboard-outline" size={13} color={primaryColor} />
                  </TouchableOpacity>
                </View>

                <Text style={[S.fieldLabel, { color: C.muted, marginTop: 14 }]}>
                  {t('address_book.fields.category')}
                </Text>
                <View style={S.catGrid}>
                  {CATEGORIES.filter(c => c.id !== 'all').map(cat => {
                    const isActive = formCategory === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          S.catOption,
                          {
                            backgroundColor: isActive ? cat.color + '20' : C.card2,
                            borderColor:     isActive ? cat.color : C.border,
                          },
                        ]}
                        onPress={() => setFormCategory(cat.id)}
                      >
                        <Ionicons
                          name={cat.icon}
                          size={16}
                          color={isActive ? cat.color : C.muted}
                        />
                        <Text style={[S.catOptionTxt, { color: isActive ? cat.color : C.text }]}>
                          {t(`address_book.categories.${cat.labelKey}`)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[S.fieldLabel, { color: C.muted, marginTop: 14 }]}>
                  {t('address_book.fields.note')}
                </Text>
                <View style={[S.inputWrap, { backgroundColor: C.card2, borderColor: C.border, height: 46 }]}>
                  <Ionicons name="create-outline" size={16} color={C.muted} />
                  <TextInput
                    style={[S.input, { color: C.text }]}
                    value={formNote}
                    onChangeText={setFormNote}
                    placeholder={t('address_book.fields.note_placeholder')}
                    placeholderTextColor={C.muted}
                    autoCorrect={false}
                    maxLength={60}
                  />
                </View>

                {formError ? (
                  <View style={[S.errorBox, { backgroundColor: C.error + '12', borderColor: C.error + '30' }]}>
                    <Ionicons name="alert-circle" size={14} color={C.error} />
                    <Text style={[S.errorTxt, { color: C.error }]}>{formError}</Text>
                  </View>
                ) : null}

                <View style={S.actionRow}>
                  <TouchableOpacity
                    style={[S.cancelBtn, { backgroundColor: C.card2, borderColor: C.border }]}
                    onPress={() => setFormModal(false)}
                  >
                    <Text style={[S.cancelBtnTxt, { color: C.text }]}>{t('cancel')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[S.saveBtn, { backgroundColor: primaryColor, opacity: saving ? 0.7 : 1 }]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name={editingItem ? 'checkmark' : 'add'} size={16} color="#FFF" />
                        <Text style={S.saveBtnTxt}>
                          {editingItem ? t('save') : t('address_book.add_btn')}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {editingItem && (
                  <TouchableOpacity
                    style={[S.deleteBtn, { borderColor: C.error + '30' }]}
                    onPress={() => { setFormModal(false); setTimeout(() => handleDelete(editingItem), 300); }}
                  >
                    <Ionicons name="trash-outline" size={14} color={C.error} />
                    <Text style={[S.deleteBtnTxt, { color: C.error }]}>
                      {t('address_book.delete_btn')}
                    </Text>
                  </TouchableOpacity>
                )}

              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
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
  headerCenter:  { flex: 1 },
  headerTitle:   { fontSize: 18, fontWeight: '800' },
  headerSub:     { fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },

  searchWrap: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  searchBar:  {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 12, height: 44, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },

  filtersWrap:    { borderBottomWidth: 1 },
  filtersContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, gap: 5,
  },
  filterChipTxt:  { fontSize: 12, fontWeight: '700' },
  filterCount: {
    minWidth: 20, height: 18, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 5, marginLeft: 2,
  },
  filterCountTxt: { fontSize: 10, fontWeight: '800' },

  sortWrap: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, gap: 8 },
  sortBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1, gap: 4,
  },
  sortBtnTxt: { fontSize: 11, fontWeight: '700' },

  list: { padding: 16 },
  itemCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderRadius: 14, borderWidth: 1,
    marginBottom: 10, gap: 12,
  },
  itemIcon:    { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  itemIconTxt: { fontSize: 18, fontWeight: '800' },
  itemTopRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  itemName:    { fontSize: 14, fontWeight: '800', flexShrink: 1 },
  catBadge:    { width: 18, height: 18, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  itemAddress: { fontSize: 11, fontFamily: 'monospace', marginBottom: 2 },
  itemNote:    { fontSize: 10, fontStyle: 'italic' },
  itemRight:   { alignItems: 'flex-end', gap: 6 },
  useBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 8, gap: 2,
  },
  useTxt: { fontSize: 10, fontWeight: '800' },

  empty:      { alignItems: 'center', paddingVertical: 70, gap: 12 },
  emptyIcon:  { width: 90, height: 90, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptySub:   { fontSize: 13, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    padding: 20, paddingTop: 12, maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle:  { fontSize: 18, fontWeight: '800' },
  closeBtn:    { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8 },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 12, height: 52, gap: 8,
  },
  input:    { flex: 1, fontSize: 14, paddingVertical: 0 },
  pasteBtn: {
    width: 32, height: 32, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 12, borderWidth: 1, gap: 6,
  },
  catOptionTxt: { fontSize: 12, fontWeight: '700' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center',
    padding: 10, borderRadius: 10, borderWidth: 1,
    marginTop: 14, gap: 8,
  },
  errorTxt: { flex: 1, fontSize: 12, fontWeight: '600' },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1, paddingVertical: 14,
    borderRadius: 12, alignItems: 'center', borderWidth: 1,
  },
  cancelBtnTxt: { fontSize: 14, fontWeight: '800' },
  saveBtn: {
    flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, gap: 6,
  },
  saveBtnTxt: { color: '#FFF', fontSize: 14, fontWeight: '800' },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, borderWidth: 1,
    marginTop: 12, gap: 6,
  },
  deleteBtnTxt: { fontSize: 13, fontWeight: '700' },
});
