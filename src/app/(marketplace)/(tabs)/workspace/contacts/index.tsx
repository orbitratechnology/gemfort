import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
    Pressable,
    RefreshControl,
    ScrollView,
    SectionList,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/ui/empty-state";
import { ScreenInset } from "@/components/ui/form-section";
import { Icon } from "@/components/ui/icon";
import { StackHeader } from "@/components/ui/stack-header";
import { ContactListRow } from "@/components/workspace/contact-list-row";
import { ContactsHubTabs } from "@/components/workspace/contacts-hub-tabs";
import { PhoneContactsImportSheet } from "@/components/workspace/phone-contacts-import-sheet";
import { CONTACT_TYPES } from "@/constants/contact-types";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { countMissedCalls } from "@/features/workspace/call-logs-service";
import {
    filterContacts,
    groupContactsByLetter,
} from "@/features/workspace/contact-utils";
import {
    deleteContact,
    fetchContacts,
    updateContact,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useMatchedCallLogs } from "@/hooks/use-matched-call-logs";
import { friendlyError } from "@/lib/errors";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";
import type { Contact } from "@/types";

export default function ContactsListScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const { logs: callLogs } = useMatchedCallLogs({ enabled: !!user });
  const missedCount = countMissedCalls(callLogs);
  const openSwipeRef = useRef<{
    id: string;
    methods: SwipeableMethods;
  } | null>(null);

  const {
    data: contacts = [],
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["contacts", user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    enabled: !!user,
  });

  const filtered = useMemo(
    () => filterContacts(contacts, debouncedQuery, typeFilter),
    [contacts, debouncedQuery, typeFilter],
  );

  const sections = useMemo(() => groupContactsByLetter(filtered), [filtered]);

  const handleSwipeableOpen = useCallback(
    (id: string, methods: SwipeableMethods) => {
      const prev = openSwipeRef.current;
      if (prev && prev.id !== id) {
        prev.methods.close();
      }
      openSwipeRef.current = { id, methods };
    },
    [],
  );

  const handleSwipeableClose = useCallback((id: string) => {
    if (openSwipeRef.current?.id === id) {
      openSwipeRef.current = null;
    }
  }, []);

  const invalidateContacts = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["contacts"] });
  }, [queryClient]);

  const handleDelete = useCallback(
    async (contact: Contact) => {
      try {
        await deleteContact(contact.id);
        await invalidateContacts();
        toast.success("Contact deleted");
      } catch (e) {
        toast.error(friendlyError(e, "Could not delete contact."));
        throw e;
      }
    },
    [invalidateContacts, toast],
  );

  const handleToggleFavourite = useCallback(
    async (contact: Contact) => {
      try {
        await updateContact(contact.id, {
          isFavourite: !contact.isFavourite,
        });
        await invalidateContacts();
        toast.success(
          contact.isFavourite
            ? "Removed from favourites"
            : "Added to favourites",
        );
      } catch (e) {
        toast.error(friendlyError(e, "Could not update contact."));
        throw e;
      }
    },
    [invalidateContacts, toast],
  );

  const renderItem = useCallback(
    ({
      item,
      index,
      section,
    }: {
      item: Contact;
      index: number;
      section: { data: Contact[] };
    }) => (
      <ContactListRow
        contact={item}
        isLastInSection={index === section.data.length - 1}
        onPress={() =>
          router.push(`/(marketplace)/(tabs)/workspace/contacts/${item.id}`)
        }
        onDelete={() => handleDelete(item)}
        onToggleFavourite={() => handleToggleFavourite(item)}
        onSwipeableOpen={handleSwipeableOpen}
        onSwipeableClose={handleSwipeableClose}
      />
    ),
    [
      handleDelete,
      handleSwipeableClose,
      handleSwipeableOpen,
      handleToggleFavourite,
    ],
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader
        title="Contacts"
        right={
          <Pressable
            onPress={() => setImportOpen(true)}
            style={styles.headerBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Import contacts from phone"
          >
            <Icon name="people" size={24} color={colors.primary} />
          </Pressable>
        }
      />
      <ContactsHubTabs active="contacts" missedCount={missedCount} />

      <SectionList
        sections={sections}
        keyExtractor={(c) => c.id}
        stickySectionHeadersEnabled
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <ScreenInset>
              <View
                style={[
                  styles.searchBox,
                  { backgroundColor: colors.surfaceContainerHigh },
                ]}
              >
                <Icon name="search" size={20} color={colors.outline} />
                <TextInput
                  style={[styles.searchInput, { color: colors.onSurface }]}
                  placeholder="Search"
                  placeholderTextColor={colors.textMuted}
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {query.length > 0 ? (
                  <Pressable
                    onPress={() => setQuery("")}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                  >
                    <Icon
                      name="cancel"
                      size={18}
                      color={colors.onSurfaceVariant}
                    />
                  </Pressable>
                ) : null}
              </View>
            </ScreenInset>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              <Pressable
                onPress={() => setTypeFilter(null)}
                style={[
                  styles.chip,
                  typeFilter === null
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.surfaceContainerHighest },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color:
                        typeFilter === null
                          ? colors.onPrimary
                          : colors.onSurfaceVariant,
                    },
                  ]}
                >
                  All
                </Text>
              </Pressable>
              {CONTACT_TYPES.map((type) => {
                const active = typeFilter === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => setTypeFilter(active ? null : type)}
                    style={[
                      styles.chip,
                      active
                        ? { backgroundColor: colors.primary }
                        : {
                            backgroundColor: colors.surfaceContainerHighest,
                          },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: active
                            ? colors.onPrimary
                            : colors.onSurfaceVariant,
                        },
                      ]}
                    >
                      {type}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <ScreenInset style={styles.empty}>
            <EmptyState
              icon="person"
              title={contacts.length === 0 ? "No Contacts" : "No Results"}
              subtitle={
                contacts.length === 0
                  ? "Import from your phone or tap + to add a contact."
                  : "Try a different search or filter."
              }
            />
          </ScreenInset>
        }
        renderSectionHeader={({ section: { title } }) => (
          <View
            style={[
              styles.sectionHeader,
              { backgroundColor: colors.surfaceContainerLow },
            ]}
          >
            <Text
              style={[styles.sectionTitle, { color: colors.onSurfaceVariant }]}
            >
              {title}
            </Text>
          </View>
        )}
        renderItem={renderItem}
      />

      <Pressable
        style={[styles.fab, { backgroundColor: colors.accent }]}
        onPress={() =>
          router.push("/(marketplace)/(tabs)/workspace/contacts/add")
        }
        accessibilityRole="button"
        accessibilityLabel="Add contact"
      >
        <Icon name="person-add" size={26} color={colors.onSecondary} />
      </Pressable>

      {user ? (
        <PhoneContactsImportSheet
          visible={importOpen}
          onClose={() => setImportOpen(false)}
          ownerUid={user.uid}
          existingContacts={contacts}
          onImported={() => {
            void queryClient.invalidateQueries({ queryKey: ["contacts"] });
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingBottom: 100,
    flexGrow: 1,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 18,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  listHeader: {
    gap: Spacing.stackMd,
    marginBottom: Spacing.stackMd,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyMd,
    fontSize: 16,
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.stackSm,
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.full,
    minHeight: 40,
    justifyContent: "center",
  },
  chipText: {
    ...Typography.labelMd,
    fontSize: 14,
    textTransform: "capitalize",
  },
  sectionHeader: {
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: 6,
  },
  sectionTitle: {
    ...Typography.labelMd,
    fontWeight: "700",
    fontSize: 16,
  },
  empty: {
    paddingTop: 48,
  },
});
