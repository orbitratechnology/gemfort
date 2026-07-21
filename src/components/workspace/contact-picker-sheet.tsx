import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
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
import { ROLE_LABELS } from '@/constants/roles';
import {
  type BusinessKind,
  businessKindOf,
  filterBusinessesByKinds,
} from '@/features/workspace/contact-business-link';
import { filterContacts } from '@/features/workspace/contact-utils';
import { resolvePartyPhotoUrl } from '@/features/workspace/party-photo';
import { fetchBusinesses } from '@/features/marketplace/marketplace-service';
import { syncContactBusinessLinks } from '@/features/workspace/workspace-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import type { Business, Contact } from '@/types';

export type ContactSelection = {
  source: 'contact';
  contactId: string;
  label: string;
  linkedBusinessId?: string | null;
};

export type BusinessSelection = {
  source: 'business';
  businessId: string;
  label: string;
  businessType: string;
  linkedContactId?: string | null;
};

export type PartySelection = ContactSelection | BusinessSelection;

/** @deprecated Prefer PartySelection — kept for service form compatibility. */
export type ProviderSelection = PartySelection;

type ContactPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  contacts: Contact[];
  value: string;
  onSelect: (contact: Contact) => void;
  title?: string;
  typeFilter?: string | null;
  emptyHint?: string;
  allowCustomName?: boolean;
  customName?: string;
  onSelectCustomName?: (name: string) => void;
  customNameLabel?: string;
};

export type PartyPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  contacts: Contact[];
  value: PartySelection | null;
  onSelect: (selection: PartySelection) => void;
  title?: string;
  /** Which GemFort directory roles to show. Empty = contacts only. */
  allowedBusinessKinds?: BusinessKind[];
  contactTypeFilter?: string | null;
  emptyContactsHint?: string;
  preferBusinesses?: boolean;
};

type TabId = 'directory' | 'contacts';

function businessMatches(b: Business, q: string) {
  if (!q) return true;
  const hay = [
    b.businessName,
    b.ownerName,
    b.city,
    b.district,
    b.businessType,
    b.contacts?.phone?.value,
    b.contacts?.whatsapp?.value,
    ...(b.providerProfile?.services?.map((s) => s.name) ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

function roleLabelForBusiness(b: Business): string {
  const kind = businessKindOf(b);
  if (kind === 'labs') return ROLE_LABELS.gem_lab;
  if (kind === 'lapidaries') return ROLE_LABELS.lapidary;
  if (kind === 'traders') return ROLE_LABELS.trader;
  return b.businessType.replace(/_/g, ' ');
}

function directoryIcon(b: Business): IconName {
  const kind = businessKindOf(b);
  if (kind === 'labs') return 'workspace-premium';
  if (kind === 'lapidaries') return 'handyman';
  return 'storefront';
}

function directoryTabLabel(kinds: BusinessKind[]): string {
  if (kinds.length === 1) {
    if (kinds[0] === 'traders') return 'Traders';
    if (kinds[0] === 'lapidaries') return 'Lapidaries';
    if (kinds[0] === 'labs') return 'Labs';
  }
  return 'GemFort';
}

function directorySearchPlaceholder(kinds: BusinessKind[]): string {
  if (kinds.length === 1 && kinds[0] === 'traders') return 'Search traders…';
  if (kinds.length === 1 && kinds[0] === 'lapidaries') return 'Search lapidaries…';
  if (kinds.length === 1 && kinds[0] === 'labs') return 'Search labs…';
  return 'Search traders, labs, lapidaries…';
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
  photoUrl,
  selected,
  onPress,
}: {
  contact: Contact;
  photoUrl?: string | null;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const gemfortBadge = contact.linkedBusinessName
    ? `On GemFort · ${contact.linkedBusinessType?.replace(/_/g, ' ') ?? 'profile'}`
    : null;
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
      <ContactAvatar
        name={contact.displayName}
        photoUrl={photoUrl ?? contact.photoUrl}
        size={40}
      />
      <View style={styles.rowBody}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.onSurface, flex: 1 }]} numberOfLines={1}>
            {contact.displayName}
          </Text>
          {contact.linkedBusinessId ? (
            <Icon name="verified" size={16} color={colors.accent} />
          ) : null}
        </View>
        <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
          {gemfortBadge ??
            ([contact.companyName, contact.phone ?? contact.whatsapp]
              .filter(Boolean)
              .join(' · ') ||
              (contact.contactTypes ?? []).join(', ') ||
              'Contact')}
        </Text>
      </View>
      {selected ? <Icon name="check-circle" size={22} color={colors.primary} /> : null}
    </Pressable>
  );
}

function BusinessRow({
  business,
  selected,
  onPress,
  linkedContact,
}: {
  business: Business;
  selected: boolean;
  onPress: () => void;
  linkedContact?: Contact | null;
}) {
  const { colors } = useAppTheme();
  const role = roleLabelForBusiness(business);
  const phone =
    business.contacts?.phone?.value ?? business.contacts?.whatsapp?.value ?? null;
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
      <View
        style={[
          styles.avatar,
          { backgroundColor: colors.surfaceContainerHigh, overflow: 'hidden' },
        ]}>
        {business.logoUrl ? (
          <Image source={{ uri: business.logoUrl }} style={styles.avatarImg} contentFit="cover" />
        ) : (
          <Icon name={directoryIcon(business)} size={20} color={colors.primary} />
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
          {linkedContact ? ' · in Contacts' : phone ? ` · ${phone}` : ''}
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
  allowCustomName = false,
  customName = '',
  onSelectCustomName,
  customNameLabel = 'Use this name',
}: ContactPickerSheetProps) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const filtered = useMemo(
    () => filterContacts(contacts, debouncedQuery, typeFilter),
    [contacts, debouncedQuery, typeFilter],
  );
  const trimmed = query.trim();
  const canUseCustom = allowCustomName && !!onSelectCustomName && trimmed.length > 0;

  function closeSheet() {
    setQuery('');
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={closeSheet} title={title} scrollable={false}>
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder={allowCustomName ? 'Search or type a name…' : 'Search name, phone…'}
      />
      {canUseCustom ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${customNameLabel}: ${trimmed}`}
          onPress={() => {
            onSelectCustomName(trimmed);
            closeSheet();
          }}
          style={({ pressed }) => [
            styles.customRow,
            {
              backgroundColor: colors.primaryContainer,
              opacity: pressed ? 0.9 : 1,
            },
          ]}>
          <View style={[styles.fieldIcon, { backgroundColor: colors.primary }]}>
            <Icon name="person-add" size={18} color={colors.onPrimary} />
          </View>
          <View style={styles.fieldBody}>
            <Text style={[styles.name, { color: colors.onPrimaryContainer }]} numberOfLines={1}>
              {trimmed}
            </Text>
            <Text style={[styles.meta, { color: colors.onPrimaryContainer + 'AA' }]}>
              {customNameLabel} · not in contacts
            </Text>
          </View>
          {customName.trim().toLowerCase() === trimmed.toLowerCase() ? (
            <Icon name="check-circle" size={22} color={colors.primary} />
          ) : (
            <Icon name="arrow-forward" size={20} color={colors.onPrimaryContainer} />
          )}
        </Pressable>
      ) : null}
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
            subtitle={
              allowCustomName
                ? contacts.length === 0
                  ? 'Type a name above, then tap to use it.'
                  : 'Try another search, or use the typed name above.'
                : contacts.length === 0
                  ? emptyHint
                  : 'Try a different search.'
            }
          />
        }
        renderItem={({ item }) => (
          <ContactRow
            contact={item}
            selected={value === item.id}
            onPress={() => {
              onSelect(item);
              closeSheet();
            }}
          />
        )}
      />
    </BottomSheet>
  );
}

/**
 * Unified party picker: GemFort directory (traders / labs / lapidaries)
 * + local Contacts. Directory kinds are filtered per flow.
 */
export function PartyPickerSheet({
  visible,
  onClose,
  contacts: contactsProp,
  value,
  onSelect,
  title = 'Select',
  allowedBusinessKinds = [],
  contactTypeFilter = null,
  emptyContactsHint = 'Add a contact in Workspace → Contacts.',
  preferBusinesses = true,
}: PartyPickerSheetProps) {
  const { colors } = useAppTheme();
  const showDirectory = allowedBusinessKinds.length > 0;
  const [tab, setTab] = useState<TabId>(
    showDirectory && preferBusinesses ? 'directory' : 'contacts',
  );
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState(contactsProp);
  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    setContacts(contactsProp);
  }, [contactsProp]);

  useEffect(() => {
    if (visible && showDirectory) {
      setTab(preferBusinesses ? 'directory' : 'contacts');
    } else if (visible) {
      setTab('contacts');
    }
  }, [visible, showDirectory, preferBusinesses]);

  const { data: directoryBusinesses = [], isLoading } = useQuery({
    queryKey: ['party-picker-businesses', allowedBusinessKinds.join(',')],
    queryFn: async () => {
      if (!isFirebaseConfigured) return [];
      const all = await fetchBusinesses();
      return filterBusinessesByKinds(all, allowedBusinessKinds);
    },
    enabled: visible,
  });

  // Full directory for contact logo fallback (not filtered by picker kinds).
  const { data: allBusinesses = [] } = useQuery({
    queryKey: ['home-businesses'],
    queryFn: () => fetchBusinesses(),
    enabled: visible && isFirebaseConfigured,
  });

  const businesses = directoryBusinesses;

  useEffect(() => {
    if (!visible || allBusinesses.length === 0) return;
    let cancelled = false;
    void (async () => {
      const synced = await syncContactBusinessLinks(contactsProp, allBusinesses);
      if (!cancelled) setContacts(synced);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, allBusinesses, contactsProp]);

  const filteredBusinesses = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return businesses.filter((b) => businessMatches(b, q));
  }, [businesses, debouncedQuery]);

  const filteredContacts = useMemo(
    () => filterContacts(contacts, debouncedQuery, contactTypeFilter),
    [contacts, debouncedQuery, contactTypeFilter],
  );

  const contactByBusinessId = useMemo(() => {
    const map = new Map<string, Contact>();
    for (const c of contacts) {
      if (c.linkedBusinessId) map.set(c.linkedBusinessId, c);
    }
    return map;
  }, [contacts]);

  const tabs: { id: TabId; label: string; icon: IconName }[] = showDirectory
    ? [
        {
          id: 'directory',
          label: directoryTabLabel(allowedBusinessKinds),
          icon: 'storefront',
        },
        { id: 'contacts', label: 'Contacts', icon: 'contacts' },
      ]
    : [{ id: 'contacts', label: 'Contacts', icon: 'contacts' }];

  function closeSheet() {
    setQuery('');
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={closeSheet} title={title} scrollable={false}>
      {showDirectory ? (
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
      ) : null}

      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder={
          tab === 'directory'
            ? directorySearchPlaceholder(allowedBusinessKinds)
            : 'Search your contacts…'
        }
      />

      {tab === 'directory' && showDirectory ? (
        <FlatList
          data={filteredBusinesses}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="storefront"
              title={
                isLoading
                  ? 'Loading…'
                  : businesses.length === 0
                    ? 'No profiles yet'
                    : 'No matches'
              }
              subtitle={
                isLoading
                  ? 'Fetching verified GemFort profiles.'
                  : 'Verified profiles appear here. Matched 1:1 with contacts by phone.'
              }
            />
          }
          renderItem={({ item }) => {
            const linked = contactByBusinessId.get(item.id) ?? null;
            return (
              <BusinessRow
                business={item}
                linkedContact={linked}
                selected={value?.source === 'business' && value.businessId === item.id}
                onPress={() => {
                  onSelect({
                    source: 'business',
                    businessId: item.id,
                    label: item.businessName,
                    businessType: item.businessType,
                    linkedContactId: linked?.id ?? null,
                  });
                  closeSheet();
                }}
              />
            );
          }}
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
              photoUrl={resolvePartyPhotoUrl(item, allBusinesses)}
              selected={value?.source === 'contact' && value.contactId === item.id}
              onPress={() => {
                onSelect({
                  source: 'contact',
                  contactId: item.id,
                  label: item.displayName,
                  linkedBusinessId: item.linkedBusinessId,
                });
                closeSheet();
              }}
            />
          )}
        />
      )}
    </BottomSheet>
  );
}

/** Alias — services use lapidaries + contacts by default. */
export function ProviderPickerSheet(
  props: Omit<PartyPickerSheetProps, 'allowedBusinessKinds'> & {
    allowedBusinessKinds?: BusinessKind[];
  },
) {
  return (
    <PartyPickerSheet
      {...props}
      allowedBusinessKinds={props.allowedBusinessKinds ?? ['lapidaries']}
      title={props.title ?? 'Select provider'}
    />
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
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.lg,
    marginBottom: Spacing.stackMd,
    minHeight: 56,
  },
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
