import { Link, router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSection, ScreenInset } from "@/components/ui/form-section";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { PhoneNumberField } from "@/components/ui/phone-number-field";
import { StackHeader } from "@/components/ui/stack-header";
import { ThemedScrollView } from "@/components/ui/screen";
import { CallLogRow } from "@/components/workspace/call-log-row";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import { CONTACT_TYPES } from "@/constants/contact-types";
import {
  BrandPalette,
  Radius,
  Spacing,
  Typography,
} from "@/constants/design-tokens";
import {
  deleteContact,
  fetchContactHistory,
  fetchContacts,
  updateContact,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useMatchedCallLogs } from "@/hooks/use-matched-call-logs";
import { friendlyError } from "@/lib/errors";
import { formatRelativeTime, openPhone, openWhatsApp } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/providers/toast-provider";

export default function ContactDetailScreen() {
  const { contactId } = useLocalSearchParams<{ contactId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [contactTypes, setContactTypes] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts", user?.uid],
    queryFn: () => fetchContacts(user!.uid),
    enabled: !!user,
  });

  const { data: history } = useQuery({
    queryKey: ["contact-history", user?.uid, contactId],
    queryFn: () => fetchContactHistory(user!.uid, contactId!),
    enabled: !!user && !!contactId,
  });

  const { logs: allCallLogs } = useMatchedCallLogs({ enabled: !!user });

  const contact = contacts.find((c) => c.id === contactId);

  const contactCalls = useMemo(
    () =>
      allCallLogs.filter(
        (log) => log.partyKind === "contact" && log.partyId === contactId,
      ),
    [allCallLogs, contactId],
  );

  function startEdit() {
    if (!contact) return;
    setDisplayName(contact.displayName);
    setPhone(contact.phone ?? "");
    setWhatsapp(contact.whatsapp ?? "");
    setEmail(contact.email ?? "");
    setContactTypes(contact.contactTypes);
    setNotes(contact.notes ?? "");
    setEditing(true);
  }

  function toggleType(t: string) {
    setContactTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  async function handleSave() {
    if (!contact || !displayName.trim()) {
      toast.error("Contact name is required.");
      return;
    }
    setSaving(true);
    try {
      await updateContact(contact.id, {
        displayName: displayName.trim(),
        phone: phone || null,
        whatsapp: whatsapp || null,
        email: email || null,
        contactTypes,
        notes: notes || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact updated");
      setEditing(false);
    } catch (e) {
      toast.error(friendlyError(e, "Could not save contact."));
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!contact) return;
    Alert.alert("Delete Contact", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteContact(contact.id);
            await queryClient.invalidateQueries({ queryKey: ["contacts"] });
            toast.success("Contact deleted");
            router.back();
          } catch (e) {
            toast.error(friendlyError(e, "Could not delete contact."));
          }
        },
      },
    ]);
  }

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <StackHeader title="Contact" />
        <Text style={[styles.loading, { color: colors.textMuted }]}>
          Loading…
        </Text>
      </SafeAreaView>
    );
  }

  if (!contact) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <StackHeader title="Contact" />
        <View style={styles.center}>
          <EmptyState
            icon="person-off"
            title="Contact not found"
            subtitle="It may have been deleted."
          />
        </View>
      </SafeAreaView>
    );
  }

  if (editing) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <StackHeader
          title="Edit Contact"
          closeIcon
          onBack={() => setEditing(false)}
        />
        <ThemedScrollView contentContainerStyle={styles.content}>
          <FormSection title="Contact">
            <Input
              label="Name"
              value={displayName}
              onChangeText={setDisplayName}
              leftIcon="person"
            />
            <PhoneNumberField
              label="Phone"
              value={phone}
              onChangeText={setPhone}
            />
            <PhoneNumberField
              label="WhatsApp"
              value={whatsapp}
              onChangeText={setWhatsapp}
            />
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              leftIcon="email"
            />
          </FormSection>
          <FormSection title="Types" padded={false}>
            <View style={styles.typeChips}>
              {CONTACT_TYPES.map((t) => {
                const active = contactTypes.includes(t);
                return (
                  <Pressable
                    key={t}
                    onPress={() => toggleType(t)}
                    style={[
                      styles.chip,
                      active
                        ? {
                            backgroundColor: colors.primary,
                            borderColor: colors.primary,
                          }
                        : {
                            backgroundColor: colors.surfaceContainerLowest,
                            borderColor: colors.outlineVariant,
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
                      {t}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </FormSection>
          <FormSection title="Notes">
            <Input
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              multiline
              leftIcon="notes"
            />
          </FormSection>
          <ScreenInset>
            <Button
              title="Save Changes"
              icon="check"
              loading={saving}
              onPress={handleSave}
            />
          </ScreenInset>
        </ThemedScrollView>
      </SafeAreaView>
    );
  }

  const waNumber = contact.whatsapp || contact.phone;
  const hasCall = !!contact.phone;
  const hasWhatsApp = !!waNumber;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StackHeader
        title=""
        right={
          <View style={styles.headerActions}>
            <Pressable
              onPress={startEdit}
              hitSlop={8}
              style={styles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel="Edit contact"
            >
              <Icon name="edit" size={22} color={colors.primary} />
            </Pressable>
            <Pressable
              onPress={handleDelete}
              hitSlop={8}
              style={styles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel="Delete contact"
            >
              <Icon name="delete-outline" size={22} color={colors.error} />
            </Pressable>
          </View>
        }
      />

      <ThemedScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Link.AppleZoomTarget>
            <ContactAvatar
              name={contact.displayName}
              photoUrl={contact.photoUrl}
              size={96}
            />
          </Link.AppleZoomTarget>
          <Text
            style={[styles.name, { color: colors.onSurface }]}
            selectable
          >
            {contact.displayName}
          </Text>
          {contact.companyName ? (
            <Text
              style={[styles.company, { color: colors.textMuted }]}
              selectable
            >
              {contact.companyName}
            </Text>
          ) : null}
          {contact.contactTypes.length ? (
            <View style={styles.typeRow}>
              {contact.contactTypes.map((t) => (
                <View
                  key={t}
                  style={[
                    styles.typeBadge,
                    { backgroundColor: colors.surfaceContainerHighest },
                  ]}
                >
                  <Text
                    style={[
                      styles.typeBadgeText,
                      { color: colors.onSurfaceVariant },
                    ]}
                  >
                    {t}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {contact.deviceContactId ? (
            <Text style={[styles.synced, { color: colors.textMuted }]}>
              Synced from phone
            </Text>
          ) : null}
        </View>

        {(hasCall || hasWhatsApp) && (
          <ScreenInset>
            <View style={styles.actionRow}>
              {hasCall ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Call"
                  onPress={() =>
                    Linking.openURL(openPhone(contact.phone!))
                  }
                  style={({ pressed }) => [
                    styles.circleAction,
                    {
                      backgroundColor: colors.primaryContainer,
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <Icon name="call" size={24} color={colors.primary} />
                  <Text
                    style={[styles.circleLabel, { color: colors.primary }]}
                  >
                    call
                  </Text>
                </Pressable>
              ) : null}
              {hasWhatsApp ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="WhatsApp"
                  onPress={() =>
                    Linking.openURL(openWhatsApp(waNumber!))
                  }
                  style={({ pressed }) => [
                    styles.circleAction,
                    {
                      backgroundColor: BrandPalette.whatsapp + "22",
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <Icon
                    name="whatsapp"
                    size={24}
                    color={BrandPalette.whatsapp}
                  />
                  <Text
                    style={[
                      styles.circleLabel,
                      { color: BrandPalette.whatsapp },
                    ]}
                  >
                    message
                  </Text>
                </Pressable>
              ) : null}
              {contact.email ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Email"
                  onPress={() =>
                    Linking.openURL(`mailto:${contact.email}`)
                  }
                  style={({ pressed }) => [
                    styles.circleAction,
                    {
                      backgroundColor: colors.surfaceContainerHigh,
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <Icon name="mail-outline" size={24} color={colors.primary} />
                  <Text
                    style={[styles.circleLabel, { color: colors.primary }]}
                  >
                    mail
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </ScreenInset>
        )}

        {(contact.phone || contact.whatsapp || contact.email) && (
          <FormSection title="Contact info" padded={false}>
            {contact.phone ? (
              <Pressable
                onPress={() => Linking.openURL(openPhone(contact.phone!))}
                style={[
                  styles.infoRow,
                  {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.outlineVariant,
                  },
                ]}
              >
                <Icon name="call" size={20} color={colors.primary} />
                <View style={styles.infoBody}>
                  <Text
                    style={[styles.infoValue, { color: colors.onSurface }]}
                    selectable
                  >
                    {contact.phone}
                  </Text>
                  <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                    phone
                  </Text>
                </View>
              </Pressable>
            ) : null}
            {contact.whatsapp ? (
              <Pressable
                onPress={() =>
                  Linking.openURL(openWhatsApp(contact.whatsapp!))
                }
                style={[
                  styles.infoRow,
                  {
                    borderBottomWidth: contact.email
                      ? StyleSheet.hairlineWidth
                      : 0,
                    borderBottomColor: colors.outlineVariant,
                  },
                ]}
              >
                <Icon
                  name="whatsapp"
                  size={20}
                  color={BrandPalette.whatsapp}
                />
                <View style={styles.infoBody}>
                  <Text
                    style={[styles.infoValue, { color: colors.onSurface }]}
                    selectable
                  >
                    {contact.whatsapp}
                  </Text>
                  <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                    WhatsApp
                  </Text>
                </View>
              </Pressable>
            ) : null}
            {contact.email ? (
              <Pressable
                onPress={() => Linking.openURL(`mailto:${contact.email}`)}
                style={styles.infoRow}
              >
                <Icon name="mail-outline" size={20} color={colors.primary} />
                <View style={styles.infoBody}>
                  <Text
                    style={[styles.infoValue, { color: colors.onSurface }]}
                    selectable
                  >
                    {contact.email}
                  </Text>
                  <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                    email
                  </Text>
                </View>
              </Pressable>
            ) : null}
          </FormSection>
        )}

        {contact.notes ? (
          <FormSection title="Notes">
            <Text
              style={[styles.notes, { color: colors.onSurfaceVariant }]}
              selectable
            >
              {contact.notes}
            </Text>
          </FormSection>
        ) : null}

        <FormSection
          title="Calls"
          hint={
            contactCalls.length
              ? `${contactCalls.length} matched`
              : undefined
          }
          padded={false}
        >
          {contactCalls.length ? (
            contactCalls.slice(0, 20).map((log, index) => (
              <CallLogRow
                key={log.id}
                log={log}
                compact
                isLast={index === Math.min(contactCalls.length, 20) - 1}
                onPress={() => {
                  if (contact.phone) {
                    void Linking.openURL(openPhone(contact.phone));
                  }
                }}
              />
            ))
          ) : (
            <Text
              style={[
                styles.emptyHistory,
                {
                  color: colors.textMuted,
                  paddingHorizontal: Spacing.containerMargin,
                  paddingVertical: Spacing.md,
                },
              ]}
            >
              No matched calls with this contact yet.
            </Text>
          )}
        </FormSection>

        <FormSection title="Service history" padded={false}>
          {history?.services.length ? (
            history.services.map((s, index) => (
              <View
                key={s.id}
                style={[
                  styles.historyRow,
                  index < history.services.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.outlineVariant,
                  },
                ]}
              >
                <Icon name="handyman" size={18} color={colors.primary} />
                <View style={styles.historyBody}>
                  <Text
                    style={[styles.historyTitle, { color: colors.onSurface }]}
                  >
                    {s.serviceType.replace(/_/g, " ")}
                  </Text>
                  <Text
                    style={[styles.historyMeta, { color: colors.textMuted }]}
                  >
                    {s.status} · {formatRelativeTime(s.dateGiven)}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text
              style={[
                styles.emptyHistory,
                {
                  color: colors.textMuted,
                  paddingHorizontal: Spacing.containerMargin,
                  paddingVertical: Spacing.md,
                },
              ]}
            >
              No services linked.
            </Text>
          )}
        </FormSection>

        <FormSection title="AP history" padded={false}>
          {history?.apRecords.length ? (
            history.apRecords.map((a, index) => (
              <View
                key={a.id}
                style={[
                  styles.historyRow,
                  index < history.apRecords.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.outlineVariant,
                  },
                ]}
              >
                <Icon
                  name="hourglass-empty"
                  size={18}
                  color={colors.primary}
                />
                <View style={styles.historyBody}>
                  <Text
                    style={[styles.historyTitle, { color: colors.onSurface }]}
                  >
                    AP · {a.status}
                  </Text>
                  <Text
                    style={[styles.historyMeta, { color: colors.textMuted }]}
                  >
                    {formatRelativeTime(a.dateGiven ?? a.createdAt)}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text
              style={[
                styles.emptyHistory,
                {
                  color: colors.textMuted,
                  paddingHorizontal: Spacing.containerMargin,
                  paddingVertical: Spacing.md,
                },
              ]}
            >
              No AP records linked.
            </Text>
          )}
        </FormSection>
      </ThemedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loading: { padding: Spacing.containerMargin, ...Typography.bodyMd },
  center: {
    flex: 1,
    padding: Spacing.containerMargin,
    justifyContent: "center",
  },
  content: { gap: Spacing.md, paddingBottom: Spacing.section },

  headerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  hero: {
    alignItems: "center",
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.containerMargin,
    gap: 6,
  },
  name: {
    ...Typography.headlineSm,
    fontSize: 28,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
  },
  company: {
    ...Typography.bodyMd,
    fontSize: 16,
    textAlign: "center",
  },
  synced: {
    ...Typography.caption,
    marginTop: 2,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
    justifyContent: "center",
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  typeBadgeText: {
    ...Typography.labelMd,
    textTransform: "capitalize",
  },

  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 28,
    paddingVertical: Spacing.sm,
  },
  circleAction: {
    width: 72,
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 20,
    borderCurve: "continuous",
  },
  circleLabel: {
    ...Typography.caption,
    fontWeight: "600",
    textTransform: "lowercase",
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: 14,
    minHeight: 56,
  },
  infoBody: { flex: 1, gap: 2 },
  infoValue: { ...Typography.bodyLg, fontSize: 17 },
  infoLabel: { ...Typography.caption },
  notes: { ...Typography.bodyMd, lineHeight: 22 },

  typeChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.lg,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: 12,
    minHeight: 56,
  },
  historyBody: { flex: 1 },
  historyTitle: {
    ...Typography.bodyLg,
    textTransform: "capitalize",
  },
  historyMeta: { ...Typography.caption, marginTop: 2 },
  emptyHistory: { ...Typography.bodyMd },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipText: { ...Typography.labelMd, textTransform: "capitalize" },
});
