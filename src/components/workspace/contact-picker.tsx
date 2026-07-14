import { useState } from 'react';

import {
  ContactPickerSheet,
  PickerSelectField,
} from '@/components/workspace/contact-picker-sheet';
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
  /** Allow typing a name when the person is not in contacts. */
  allowCustomName?: boolean;
  customName?: string;
  onCustomNameChange?: (name: string) => void;
  customNameLabel?: string;
};

/**
 * Universal contact selector — opens a searchable bottom sheet.
 * Drop-in for forms across Workspace (cheques, AP, money, etc.).
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
}: ContactPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = contacts.find((c) => c.id === value) ?? null;
  const displayName = selected?.displayName ?? (customName.trim() || null);
  const isCustom = !selected && !!customName.trim();

  return (
    <>
      <PickerSelectField
        label={label}
        valueLabel={displayName}
        subtitle={
          selected
            ? [selected.companyName, selected.phone ?? selected.whatsapp].filter(Boolean).join(' · ') ||
              null
            : isCustom
              ? 'Custom buyer'
              : null
        }
        placeholder={
          allowCustomName ? 'Select contact or enter name…' : placeholder
        }
        icon="person"
        onPress={() => setOpen(true)}
        error={error}
      />
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
    </>
  );
}
