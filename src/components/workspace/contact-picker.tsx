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
}: ContactPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = contacts.find((c) => c.id === value) ?? null;

  return (
    <>
      <PickerSelectField
        label={label}
        valueLabel={selected?.displayName ?? null}
        subtitle={
          selected
            ? [selected.companyName, selected.phone ?? selected.whatsapp].filter(Boolean).join(' · ') ||
              null
            : null
        }
        placeholder={placeholder}
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
        onSelect={(contact) => onChange(contact.id)}
      />
    </>
  );
}
