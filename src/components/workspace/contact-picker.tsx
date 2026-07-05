import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Input } from '@/components/ui/input';
import { Spacing, Typography } from '@/constants/design-tokens';
import { filterContacts } from '@/features/workspace/contact-utils';
import { useThemeStyles } from '@/hooks/use-theme-styles';
import type { Contact } from '@/types';

type ContactPickerProps = {
  label: string;
  contacts: Contact[];
  value: string;
  onChange: (contactId: string) => void;
  typeFilter?: string | null;
  emptyHint?: string;
};

export function ContactPicker({
  label,
  contacts,
  value,
  onChange,
  typeFilter = null,
  emptyHint = 'Add a contact in Workspace → Contacts first.',
}: ContactPickerProps) {
  const ts = useThemeStyles();
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => filterContacts(contacts, query, typeFilter),
    [contacts, query, typeFilter],
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.label, ts.textSecondary]}>{label}</Text>
      <Input
        label="Search contacts"
        value={query}
        onChangeText={setQuery}
        placeholder="Name, phone, or type"
      />
      {filtered.length === 0 ? (
        <Text style={[styles.empty, ts.textMuted]}>{emptyHint}</Text>
      ) : (
        <View style={styles.list}>
          {filtered.map((contact) => {
            const selected = value === contact.id;
            return (
              <Pressable
                key={contact.id}
                style={[
                  styles.row,
                  ts.border,
                  { backgroundColor: ts.colors.surface },
                  selected && { borderColor: ts.colors.primary },
                ]}
                onPress={() => onChange(contact.id)}>
                <View style={styles.rowBody}>
                  <Text
                    style={[
                      styles.name,
                      ts.text,
                      selected && { color: ts.colors.primary, fontWeight: '600' },
                    ]}>
                    {contact.displayName}
                  </Text>
                  {contact.phone ? (
                    <Text style={[styles.meta, ts.textMuted]}>{contact.phone}</Text>
                  ) : null}
                  <View style={styles.tags}>
                    {contact.contactTypes.map((type) => (
                      <Text key={type} style={[styles.tag, ts.textPrimary]}>
                        {type}
                      </Text>
                    ))}
                  </View>
                </View>
                {selected ? (
                  <Text style={[styles.check, ts.textPrimary]}>Selected</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  label: { ...Typography.label },
  empty: { ...Typography.bodySmall },
  list: { gap: Spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
  },
  rowBody: { flex: 1, gap: 2 },
  name: { ...Typography.body },
  meta: { ...Typography.caption },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  tag: {
    ...Typography.caption,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'capitalize',
  },
  check: { ...Typography.caption, marginLeft: Spacing.sm, fontWeight: '600' },
});
