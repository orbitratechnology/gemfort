import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import {
  fetchDeviceContacts,
  normalizePhoneKey,
  openContactsSettings,
  presentLimitedAccessPicker,
  type DeviceContact,
} from '@/features/workspace/device-contacts-service';
import { importDeviceContactsBatch } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { friendlyError } from '@/lib/errors';
import { useToast } from '@/providers/toast-provider';
import type { Contact } from '@/types';

type PhoneContactsImportSheetProps = {
  visible: boolean;
  onClose: () => void;
  ownerUid: string;
  existingContacts: Contact[];
  onImported: () => void;
};

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function PhoneContactsImportSheet({
  visible,
  onClose,
  ownerUid,
  existingContacts,
  onImported,
}: PhoneContactsImportSheetProps) {
  const { colors } = useAppTheme();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [denied, setDenied] = useState(false);
  const [deviceContacts, setDeviceContacts] = useState<DeviceContact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const existingDeviceIds = useMemo(
    () => new Set(existingContacts.map((c) => c.deviceContactId).filter(Boolean) as string[]),
    [existingContacts],
  );
  const existingPhoneKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const c of existingContacts) {
      const k = normalizePhoneKey(c.phone) ?? normalizePhoneKey(c.whatsapp);
      if (k) keys.add(k);
    }
    return keys;
  }, [existingContacts]);

  const load = useCallback(async () => {
    setLoading(true);
    setDenied(false);
    try {
      const list = await fetchDeviceContacts();
      setDeviceContacts(list);
    } catch (e) {
      setDenied(true);
      setDeviceContacts([]);
      toast.error(friendlyError(e, 'Could not read phone contacts.'));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (!visible) {
      setQuery('');
      setSelected(new Set());
    }
  }

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [visible, load]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return deviceContacts;
    return deviceContacts.filter((c) => {
      const hay = [c.displayName, c.companyName, c.phone, c.email].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [deviceContacts, debouncedQuery]);

  function isAlreadyInWorkspace(c: DeviceContact): boolean {
    if (existingDeviceIds.has(c.id)) return true;
    const key = normalizePhoneKey(c.phone);
    return !!key && existingPhoneKeys.has(key);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllNew() {
    const next = new Set<string>();
    for (const c of filtered) {
      if (!isAlreadyInWorkspace(c)) next.add(c.id);
    }
    setSelected(next);
  }

  async function handleImport() {
    const toImport = deviceContacts.filter((c) => selected.has(c.id));
    if (!toImport.length) {
      toast.error('Select at least one contact.');
      return;
    }
    setImporting(true);
    try {
      const { created, linked } = await importDeviceContactsBatch(ownerUid, toImport);
      toast.success(
        created
          ? `Imported ${created} contact${created === 1 ? '' : 's'}${linked ? ` · ${linked} already linked` : ''}.`
          : linked
            ? `Linked ${linked} existing contact${linked === 1 ? '' : 's'}.`
            : 'Nothing new to import.',
      );
      onImported();
      onClose();
    } catch (e) {
      toast.error(friendlyError(e, 'Could not import contacts.'));
    } finally {
      setImporting(false);
    }
  }

  async function handleLimitedAccess() {
    try {
      const more = await presentLimitedAccessPicker();
      if (!more.length) return;
      setDeviceContacts((prev) => {
        const map = new Map(prev.map((c) => [c.id, c]));
        for (const c of more) map.set(c.id, c);
        return [...map.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
      });
    } catch (e) {
      toast.error(friendlyError(e, 'Could not open contact access picker.'));
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Import from phone"
      scrollable={false}>
      {denied ? (
        <View style={styles.denied}>
          <EmptyState
            icon="contacts"
            title="Contacts access needed"
            subtitle="Allow GemFort to read your phone contacts, then try again."
          />
          <Pressable
            onPress={() => void openContactsSettings()}
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.primaryBtnText, { color: colors.onPrimary }]}>Open Settings</Text>
          </Pressable>
          <Pressable onPress={() => void load()} style={styles.linkBtn}>
            <Text style={[styles.linkText, { color: colors.primary }]}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={[styles.searchBox, { backgroundColor: colors.surfaceContainerLow }]}>
            <Icon name="search" size={20} color={colors.outline} />
            <TextInput
              style={[styles.searchInput, { color: colors.onSurface }]}
              placeholder="Search phone contacts…"
              placeholderTextColor={colors.outline}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>

          <View style={styles.toolbar}>
            <Text style={[styles.count, { color: colors.textMuted }]}>
              {selected.size} selected · {filtered.length} shown
            </Text>
            <View style={styles.toolbarActions}>
              <Pressable onPress={selectAllNew} hitSlop={8}>
                <Text style={[styles.linkText, { color: colors.primary }]}>Select new</Text>
              </Pressable>
              <Pressable onPress={handleLimitedAccess} hitSlop={8}>
                <Text style={[styles.linkText, { color: colors.primary }]}>More access</Text>
              </Pressable>
            </View>
          </View>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <EmptyState
                  icon="contacts"
                  title="No phone contacts"
                  subtitle="Your address book looks empty, or access is limited."
                />
              }
              renderItem={({ item }) => {
                const already = isAlreadyInWorkspace(item);
                const isSelected = selected.has(item.id);
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected, disabled: already }}
                    disabled={already}
                    onPress={() => toggle(item.id)}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        backgroundColor: isSelected
                          ? colors.primaryContainer
                          : colors.surfaceContainerLow,
                        borderColor: isSelected ? colors.primary : colors.outlineVariant,
                        opacity: already ? 0.55 : pressed ? 0.9 : 1,
                      },
                    ]}>
                    {item.imageUri ? (
                      <Image
                        source={{ uri: item.imageUri }}
                        style={styles.avatar}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.avatarFallback, { backgroundColor: colors.primaryMuted }]}>
                        <Text style={[styles.avatarText, { color: colors.primary }]}>
                          {initials(item.displayName)}
                        </Text>
                      </View>
                    )}
                    <View style={styles.rowBody}>
                      <Text style={[styles.name, { color: colors.onSurface }]} numberOfLines={1}>
                        {item.displayName}
                      </Text>
                      <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
                        {already
                          ? 'Already in GemFort'
                          : [item.phone, item.companyName].filter(Boolean).join(' · ') || 'No phone'}
                      </Text>
                    </View>
                    {already ? (
                      <Icon name="check-circle" size={22} color={colors.outline} />
                    ) : isSelected ? (
                      <Icon name="check-circle" size={22} color={colors.primary} />
                    ) : (
                      <Icon name="radio-button-unchecked" size={22} color={colors.outline} />
                    )}
                  </Pressable>
                );
              }}
            />
          )}

          <Pressable
            disabled={importing || selected.size === 0}
            onPress={() => void handleImport()}
            style={[
              styles.primaryBtn,
              {
                backgroundColor: colors.primary,
                opacity: importing || selected.size === 0 ? 0.5 : 1,
              },
            ]}>
            {importing ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={[styles.primaryBtnText, { color: colors.onPrimary }]}>
                Import {selected.size || ''}
              </Text>
            )}
          </Pressable>
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    marginBottom: Spacing.stackSm,
  },
  searchInput: { flex: 1, ...Typography.bodyMd, paddingVertical: 0 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.stackSm,
    gap: 8,
  },
  toolbarActions: { flexDirection: 'row', gap: 14 },
  count: { ...Typography.caption },
  linkText: { ...Typography.labelMd, fontWeight: '600' },
  list: { flex: 1 },
  listContent: { gap: Spacing.sm, paddingBottom: Spacing.md, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    minHeight: 64,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...Typography.labelMd, fontWeight: '700' },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...Typography.labelMd, fontWeight: '700' },
  meta: { ...Typography.caption },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 160 },
  denied: { gap: Spacing.md, paddingVertical: Spacing.md },
  primaryBtn: {
    minHeight: 52,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  primaryBtnText: { ...Typography.labelMd, fontWeight: '700' },
  linkBtn: { alignItems: 'center', paddingVertical: 8 },
});
