import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon, type IconName } from '@/components/ui/icon';
import { ContactAvatar } from '@/components/workspace/contact-avatar';
import { Radius, Spacing, Typography } from '@/constants/design-tokens';
import { ROLE_LABELS, directoryTabFromBusinessType } from '@/constants/roles';
import { filterContacts } from '@/features/workspace/contact-utils';
import { fetchBusinesses } from '@/features/marketplace/marketplace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import type { Business, Contact } from '@/types';

export type ContactSelection = {
  source: 'contact';
  contactId: string;
  label: string;
};

export type ProviderSelection =
  | ContactSelection
  | {
      source: 'business';
      businessId: string;
      label: string;
      businessType: string;
    };

type ContactPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  contacts: Contact[];
  value: string;
  onSelect: (contact: Contact) => void;
  title?: string;
  typeFilter?: string | null;
  emptyHint?: string;
};

type ProviderPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  contacts: Contact[];
  value: ProviderSelection | null;
  onSelect: (selection: ProviderSelection) => void;
  title?: string;
  contactTypeFilter?: string | null;
  emptyContactsHint?: string;
};

function businessMatches(b: Business, q: string) {
  if (!q) return true;
  const hay = [
    b.businessName,
    b.ownerName,
    b.city,
    b.district,
    b.businessType,
    ...(b.providerProfile?.services?.map((s) => s.name) ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

function providerRoleLabel(b: Business): string {
  const tab = directoryTabFromBusinessType(b.businessType);
  if (tab === 'labs') return ROLE_LABELS.gem_lab;
  if (tab === 'lapidaries') return ROLE_LABELS.lapidary;
  return b.businessType.replace(/_/g, ' ');
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.searchBox, { backgroundColor: colors.surfaceContainerLow }]}>
      <Icon name="search" size={20} color={colors.outline} />
      <TextInput
        style={[styles.searchInput, { color: colors.onSurface }]}
        placeholder={placeholder}
        placeholderTextColor={colors.outline}
        value={value}
        onChangeText={onChange}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />
    </View>
  );
}

function ContactRow({
  contact,
  selected,
  onPress,
}: {
  contact: Contact;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected ? colors.primaryContainer : colors.surfaceContainerLow,
          borderColor: selected ? colors.primary : colors.outlineVariant,
          opacity: pressed ? 0.9 : 1,
        },
      ]}>
      <ContactAvatar name={contact.displayName} photoUrl={contact.photoUrl} size={40} />
      <View style={styles.rowBody}>
        <Text style={[styles.name, { color: colors.onSurface }]} numberOfLines={1}>
          {contact.displayName}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
          {[contact.companyName, contact.phone ?? contact.whatsapp]
            .filter(Boolean)
            .join(' · ') || (contact.contactTypes ?? []).join(', ') || 'Contact'}
        </Text>
      </View>
      {selected ? <Icon name="check-circle" size={22} color={colors.primary} /> : null}
    </Pressable>
  );
}

function ProviderRow({
  business,
  selected,
  onPress,
}: {
  business: Business;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const role = providerRoleLabel(business);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected ? colors.primaryContainer : colors.surfaceContainerLow,
          borderColor: selected ? colors.primary : colors.outlineVariant,
          opacity: pressed ? 0.9 : 1,
        },
      ]}>
      <View style={[styles.avatar, { backgroundColor: colors.surfaceContainerHigh, overflow: 'hidden' }]}>
        {business.logoUrl ? (
          <Image source={{ uri: business.logoUrl }} style={styles.avatarImg} contentFit="cover" />
        ) : (
          <Icon
            name={role === ROLE_LABELS.gem_lab ? 'workspace-premium' : 'handyman'}
            size={20}
            color={colors.primary}
          />
        )}
      </View>
      <View style={styles.rowBody}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.onSurface, flex: 1 }]} numberOfLines={1}>
            {business.businessName}
          </Text>
          {business.badges.isVerified ? (
            <Icon name="verified" size={16} color={colors.accent} />
          ) : null}
        </View>
        <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
          {role}
          {business.city ? ` · ${business.city}` : ''}
        </Text>
      </View>
      {selected ? <Icon name="check-circle" size={22} color={colors.primary} /> : null}
    </Pressable>
  );
}

/** Universal searchable contact picker (Contacts tab only). */
export function ContactPickerSheet({
  visible,
  onClose,
  contacts,
  value,
  onSelect,
  title = 'Select contact',
  typeFilter = null,
  emptyHint = 'Add a contact in Workspace → Contacts first.',
}: ContactPickerSheetProps) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => filterContacts(contacts, query, typeFilter),
    [contacts, query, typeFilter],
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        setQuery('');
        onClose();
      }}
      title={title}
      scrollable={false}>
      <SearchBox value={query} onChange={setQuery} placeholder="Search name, phone…" />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="person-search"
            title={contacts.length === 0 ? 'No contacts' : 'No matches'}
            subtitle={contacts.length === 0 ? emptyHint : 'Try a different search.'}
          />
        }
        renderItem={({ item }) => (
          <ContactRow
            contact={item}
            selected={value === item.id}
            onPress={() => {
              onSelect(item);
              setQuery('');
              onClose();
            }}
          />
        )}
      />
    </BottomSheet>
  );
}

type TabId = 'providers' | 'contacts';

/** Provider picker: GemFort Labs/Lapidaries + saved Contacts. */
export function ProviderPickerSheet({
  visible,
  onClose,
  contacts,
  value,
  onSelect,
  title = 'Select provider',
  contactTypeFilter = null,
  emptyContactsHint = 'Add a provider contact in Workspace → Contacts.',
}: ProviderPickerSheetProps) {
  const { colors } = useAppTheme();
  const [tab, setTab] = useState<TabId>('providers');
  const [query, setQuery] = useState('');

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['service-providers'],
    queryFn: async () => {
      if (!isFirebaseConfigured) return [];
      const all = await fetchBusinesses();
      return all.filter((b) => {
        const tabKind = directoryTabFromBusinessType(b.businessType);
        return tabKind === 'lapidaries' || tabKind === 'labs' || !!b.providerProfile || !!b.labProfile;
      });
    },
    enabled: visible,
  });

  const filteredProviders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return providers.filter((b) => businessMatches(b, q));
  }, [providers, query]);

  const filteredContacts = useMemo(
    () => filterContacts(contacts, query, contactTypeFilter),
    [contacts, query, contactTypeFilter],
  );

  const tabs: { id: TabId; label: string; icon: IconName }[] = [
    { id: 'providers', label: 'Providers', icon: 'storefront' },
    { id: 'contacts', label: 'Contacts', icon: 'contacts' },
  ];

  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        setQuery('');
        onClose();
      }}
      title={title}
      scrollable={false}>
      <View style={[styles.tabs, { backgroundColor: colors.surfaceContainerLow }]}>
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={[styles.tabBtn, active && { backgroundColor: colors.primary }]}>
              <Icon
                name={t.icon}
                size={16}
                color={active ? colors.onPrimary : colors.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: active ? colors.onPrimary : colors.onSurfaceVariant },
                ]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder={
          tab === 'providers' ? 'Search labs & lapidaries…' : 'Search your contacts…'
        }
      />

      {tab === 'providers' ? (
        <FlatList
          data={filteredProviders}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="storefront"
              title={isLoading ? 'Loading…' : providers.length === 0 ? 'No providers yet' : 'No matches'}
              subtitle={
                isLoading
                  ? 'Fetching verified labs and lapidaries.'
                  : 'Verified GemFort labs and lapidaries appear here.'
              }
            />
          }
          renderItem={({ item }) => (
            <ProviderRow
              business={item}
              selected={value?.source === 'business' && value.businessId === item.id}
              onPress={() => {
                onSelect({
                  source: 'business',
                  businessId: item.id,
                  label: item.businessName,
                  businessType: item.businessType,
                });
                setQuery('');
                onClose();
              }}
            />
          )}
        />
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="person-search"
              title={contacts.length === 0 ? 'No contacts' : 'No matches'}
              subtitle={contacts.length === 0 ? emptyContactsHint : 'Try a different search.'}
            />
          }
          renderItem={({ item }) => (
            <ContactRow
              contact={item}
              selected={value?.source === 'contact' && value.contactId === item.id}
              onPress={() => {
                onSelect({
                  source: 'contact',
                  contactId: item.id,
                  label: item.displayName,
                });
                setQuery('');
                onClose();
              }}
            />
          )}
        />
      )}
    </BottomSheet>
  );
}

type SelectFieldProps = {
  label: string;
  valueLabel: string | null;
  subtitle?: string | null;
  placeholder?: string;
  icon?: IconName;
  onPress: () => void;
  error?: string;
};

/** Shared trigger field for opening picker sheets. */
export function PickerSelectField({
  label,
  valueLabel,
  subtitle,
  placeholder = 'Search and select',
  icon = 'search',
  onPress,
  error,
}: SelectFieldProps) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={valueLabel ?? placeholder}
        onPress={onPress}
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderColor: error ? colors.error : colors.outlineVariant,
            opacity: pressed ? 0.92 : 1,
          },
        ]}>
        <View style={[styles.fieldIcon, { backgroundColor: colors.surfaceContainerHigh }]}>
          <Icon name={icon} size={18} color={valueLabel ? colors.primary : colors.outline} />
        </View>
        <View style={styles.fieldBody}>
          {valueLabel ? (
            <>
              <Text style={[styles.name, { color: colors.onSurface }]} numberOfLines={1}>
                {valueLabel}
              </Text>
              {subtitle ? (
                <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={[styles.placeholder, { color: colors.outline }]}>{placeholder}</Text>
          )}
        </View>
        <Icon name="expand-more" size={22} color={colors.onSurfaceVariant} />
      </Pressable>
      {error ? (
        <Text style={[styles.error, { color: colors.error }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
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
    marginBottom: Spacing.stackMd,
  },
  searchInput: { flex: 1, ...Typography.bodyMd, paddingVertical: 0 },
  tabs: {
    flexDirection: 'row',
    borderRadius: Radius.full,
    padding: 4,
    gap: 4,
    marginBottom: Spacing.stackMd,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: Radius.full,
    minHeight: 40,
  },
  tabText: { ...Typography.labelMd, fontWeight: '600' },
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { ...Typography.labelMd, fontWeight: '700' },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { ...Typography.labelMd, fontWeight: '700' },
  meta: { ...Typography.caption },

  fieldWrap: { gap: Spacing.stackSm },
  fieldLabel: { ...Typography.labelMd, letterSpacing: 0.4, textTransform: 'uppercase' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 64,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  fieldIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldBody: { flex: 1, minWidth: 0, gap: 2 },
  placeholder: { ...Typography.bodyMd },
  error: { ...Typography.bodySmall },
});
