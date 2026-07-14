import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
    FlatList,
    Linking,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { StackHeader } from "@/components/ui/stack-header";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { PhoneContactsImportSheet } from "@/components/workspace/phone-contacts-import-sheet";
import { CONTACT_TYPES } from "@/constants/contact-types";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { filterContacts } from "@/features/workspace/contact-utils";
import { fetchContacts } from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { openPhone, openWhatsApp } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import type { Contact } from "@/types";

export default function ContactsListScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

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
    () => filterContacts(contacts, query, typeFilter),
    [contacts, query, typeFilter],
  );

  const newThisMonth = useMemo(() => {
    const now = new Date();
    return contacts.filter((c) => {
      const d = c.createdAt?.toDate?.();
      return (
        d &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    }).length;
  }, [contacts]);

  const typeMeta = (type: string) => {
    if (/buyer|client/i.test(type))
      return { bg: colors.secondaryContainer, fg: colors.onSecondaryContainer };
    if (/broker|supplier|seller/i.test(type))
      return {
        bg: colors.surfaceContainerHighest,
        fg: colors.onSurfaceVariant,
      };
    return { bg: colors.primaryMuted, fg: colors.primary };
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader title="Contacts" />

      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={styles.statRow}>
              <View
                style={[
                  styles.statCard,
                  { backgroundColor: colors.surfaceContainerLowest },
                ]}
              >
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                  ACTIVE NETWORK
                </Text>
                <Text style={[styles.statValue, { color: colors.primary }]}>
                  {contacts.length}
                </Text>
              </View>
              <View
                style={[
                  styles.statCard,
                  { backgroundColor: colors.surfaceContainerLowest },
                ]}
              >
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                  NEW THIS MONTH
                </Text>
                <Text style={[styles.statValue, { color: colors.accent }]}>
                  +{newThisMonth}
                </Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Import contacts from phone"
              onPress={() => setImportOpen(true)}
              style={({ pressed }) => [
                styles.importBtn,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.outlineVariant,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.importIcon,
                  { backgroundColor: colors.primaryContainer },
                ]}
              >
                <Icon
                  name="contacts"
                  size={20}
                  color={colors.onPrimaryContainer}
                />
              </View>
              <View style={styles.importBody}>
                <Text style={[styles.importTitle, { color: colors.onSurface }]}>
                  Import from phone
                </Text>
                <Text style={[styles.importSub, { color: colors.textMuted }]}>
                  Sync names, numbers, and contact photos
                </Text>
              </View>
              <Icon
                name="chevron-right"
                size={22}
                color={colors.onSurfaceVariant}
              />
            </Pressable>

            <View
              style={[
                styles.searchBox,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <Icon name="search" size={22} color={colors.outline} />
              <TextInput
                style={[styles.searchInput, { color: colors.onSurface }]}
                placeholder="Search contacts..."
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
              />
            </View>

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
                        : { backgroundColor: colors.surfaceContainerHighest },
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
          <EmptyState
            icon="person"
            title={contacts.length === 0 ? "No contacts yet" : "No matches"}
            subtitle={
              contacts.length === 0
                ? "Import from your phone or add brokers and buyers manually."
                : "Try a different search or filter."
            }
          />
        }
        renderItem={({ item }: { item: Contact }) => {
          const primaryType = item.contactTypes[0] ?? "other";
          const meta = typeMeta(primaryType);
          return (
            <Pressable
              style={[
                styles.card,
                { backgroundColor: colors.surfaceContainerLowest },
              ]}
              onPress={() =>
                router.push(
                  `/(marketplace)/(tabs)/workspace/contacts/${item.id}`,
                )
              }
            >
              <ContactAvatar
                name={item.displayName}
                photoUrl={item.photoUrl}
                size={48}
              />
              <View style={styles.cardBody}>
                <View style={styles.cardNameRow}>
                  <Text
                    style={[styles.cardName, { color: colors.primary }]}
                    numberOfLines={1}
                  >
                    {item.displayName}
                  </Text>
                  <View
                    style={[styles.typeBadge, { backgroundColor: meta.bg }]}
                  >
                    <Text style={[styles.typeBadgeText, { color: meta.fg }]}>
                      {primaryType}
                    </Text>
                  </View>
                </View>
                {item.companyName ? (
                  <Text
                    style={[styles.cardCompany, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {item.companyName}
                  </Text>
                ) : null}
              </View>
              <View style={styles.cardActions}>
                {item.phone ? (
                  <Pressable
                    onPress={() => Linking.openURL(openPhone(item.phone!))}
                    style={styles.actionBtn}
                  >
                    <Icon name="call" size={20} color={colors.primary} />
                  </Pressable>
                ) : null}
                {item.whatsapp ? (
                  <Pressable
                    onPress={() =>
                      Linking.openURL(openWhatsApp(item.whatsapp!))
                    }
                    style={styles.actionBtn}
                  >
                    <Icon
                      name="chat-bubble-outline"
                      size={20}
                      color={colors.primary}
                    />
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />

      <Pressable
        style={[styles.fab, { backgroundColor: colors.accent }]}
        onPress={() =>
          router.push("/(marketplace)/(tabs)/workspace/contacts/add")
        }
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
    padding: Spacing.containerMargin,
    paddingBottom: 100,
    gap: Spacing.stackMd,
  },
  listHeader: { gap: Spacing.gutterMd, marginBottom: Spacing.stackSm },
  subtitle: { ...Typography.bodyMd },
  statRow: { flexDirection: "row", gap: Spacing.gutterMd },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },
  statLabel: {
    ...Typography.labelMd,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  statValue: { ...Typography.displayLg, fontSize: 26 },
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: 1,
    minHeight: 64,
  },
  importIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  importBody: { flex: 1, minWidth: 0, gap: 2 },
  importTitle: { ...Typography.labelMd, fontWeight: "700" },
  importSub: { ...Typography.caption },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    height: 48,
  },
  searchInput: { flex: 1, ...Typography.bodyMd },
  filterRow: { flexDirection: "row", gap: Spacing.stackSm, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  chipText: { ...Typography.labelMd, textTransform: "capitalize" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderCurve: "continuous",
    marginBottom: Spacing.stackMd,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardName: { ...Typography.bodyLg, fontWeight: "700", flexShrink: 1 },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardCompany: { ...Typography.bodyMd, marginTop: 2 },
  cardActions: { flexDirection: "row", gap: 4 },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    alignItems: "center",
    justifyContent: "center",
  },
});
