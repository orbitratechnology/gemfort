import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import {
  ContactPickerSheet,
  PartyPickerSheet,
  PickerSelectField,
  type PartySelection,
} from '@/components/workspace/contact-picker-sheet';
import type { BusinessKind } from '@/features/workspace/contact-business-link';
import { fetchBusinesses } from '@/features/marketplace/marketplace-service';
import { ensureContactForBusiness } from '@/features/workspace/workspace-service';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { useAuth } from '@/providers/auth-provider';
import type { Contact } from '@/types';

type ContactPickerProps = {
  label: string;
  contacts: Contact[];
  value: string;
  onChange: (contactId: string) => void;
  typeFilter?: string | null;
  emptyHint?: string;
  error?: string;
  placeholder?: string;
  allowCustomName?: boolean;
  customName?: string;
  onCustomNameChange?: (name: string) => void;
  customNameLabel?: string;
  /**
   * When set, opens the unified GemFort + Contacts sheet filtered to these roles.
   * Selecting a business creates/links a contact (1:1 by phone) and returns its id.
   */
  allowedBusinessKinds?: BusinessKind[];
};

/**
 * Universal party selector — contacts, optionally with GemFort directory profiles.
 */
export function ContactPicker({
  label,
  contacts,
  value,
  onChange,
  typeFilter = null,
  emptyHint = 'Add a contact in Workspace → Contacts first.',
  error,
  placeholder = 'Search contacts…',
  allowCustomName = false,
  customName = '',
  onCustomNameChange,
  customNameLabel = 'Use this name',
  allowedBusinessKinds,
}: ContactPickerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const selected = contacts.find((c) => c.id === value) ?? null;
  const displayName = selected?.displayName ?? (customName.trim() || null);
  const isCustom = !selected && !!customName.trim();
  const usePartySheet = (allowedBusinessKinds?.length ?? 0) > 0;

  const partyValue: PartySelection | null = useMemo(() => {
    if (!value) return null;
    if (selected?.linkedBusinessId) {
      return {
        source: 'contact',
        contactId: selected.id,
        label: selected.displayName,
        linkedBusinessId: selected.linkedBusinessId,
      };
    }
    return value
      ? { source: 'contact', contactId: value, label: displayName ?? 'Contact' }
      : null;
  }, [value, selected, displayName]);

  const { data: businesses = [] } = useQuery({
    queryKey: ['party-picker-businesses-resolve'],
    queryFn: () => fetchBusinesses(),
    enabled: usePartySheet && open && isFirebaseConfigured,
  });

  async function handlePartySelect(selection: PartySelection) {
    if (!user) return;
    if (selection.source === 'contact') {
      onChange(selection.contactId);
      onCustomNameChange?.('');
      return;
    }

    setResolving(true);
    try {
      const business =
        businesses.find((b) => b.id === selection.businessId) ??
        (await fetchBusinesses()).find((b) => b.id === selection.businessId);
      if (!business) {
        onChange('');
        return;
      }
      const { contactId } = await ensureContactForBusiness(
        user.uid,
        business,
        contacts,
      );
      await queryClient.invalidateQueries({ queryKey: ['contacts', user.uid] });
      onChange(contactId);
      onCustomNameChange?.('');
    } finally {
      setResolving(false);
    }
  }

  const subtitle = selected
    ? selected.linkedBusinessName
      ? `On GemFort · ${selected.linkedBusinessType?.replace(/_/g, ' ') ?? 'profile'}`
      : [selected.companyName, selected.phone ?? selected.whatsapp]
          .filter(Boolean)
          .join(' · ') || null
    : isCustom
      ? 'Custom buyer'
      : resolving
        ? 'Linking profile…'
        : null;

  return (
    <>
      <PickerSelectField
        label={label}
        valueLabel={displayName}
        subtitle={subtitle}
        placeholder={
          usePartySheet
            ? 'Search GemFort profiles or contacts…'
            : allowCustomName
              ? 'Select contact or enter name…'
              : placeholder
        }
        icon="person"
        onPress={() => setOpen(true)}
        error={error}
      />
      {usePartySheet ? (
        <PartyPickerSheet
          visible={open}
          onClose={() => setOpen(false)}
          contacts={contacts}
          value={partyValue}
          title={label}
          allowedBusinessKinds={allowedBusinessKinds}
          contactTypeFilter={typeFilter}
          emptyContactsHint={emptyHint}
          onSelect={(selection) => {
            void handlePartySelect(selection);
          }}
        />
      ) : (
        <ContactPickerSheet
          visible={open}
          onClose={() => setOpen(false)}
          contacts={contacts}
          value={value}
          typeFilter={typeFilter}
          emptyHint={emptyHint}
          title={label}
          allowCustomName={allowCustomName}
          customName={customName}
          customNameLabel={customNameLabel}
          onSelect={(contact) => {
            onChange(contact.id);
            onCustomNameChange?.('');
          }}
          onSelectCustomName={
            allowCustomName && onCustomNameChange
              ? (name) => {
                  onChange('');
                  onCustomNameChange(name);
                }
              : undefined
          }
        />
      )}
    </>
  );
}
