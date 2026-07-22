import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";

import { SignInPrompt } from "@/components/auth/sign-in-prompt";
import { Icon, type IconName } from "@/components/ui/icon";
import { ThemedScrollView } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { ActiveProgressStrip } from "@/components/workspace/active-progress-strip";
import { CallLogRow } from "@/components/workspace/call-log-row";
import { WorkspaceModules } from "@/components/workspace/workspace-modules";
import type { ThemeColors } from "@/constants/design-tokens";
import { Radius, Spacing, Typography } from "@/constants/design-tokens";
import { canAccessModule, resolveProfileRole } from "@/constants/roles";
import { fetchBusinesses } from "@/features/marketplace/marketplace-service";
import {
    fetchIncomingServiceRequests,
    fetchLabCertificates,
    fetchLapidaryJobs,
} from "@/features/marketplace/request-service";
import {
    detectBillsDueToday,
    getBillSummary,
} from "@/features/workspace/bill-utils";
import { countMissedCalls } from "@/features/workspace/call-logs-service";
import {
    detectChequesMaturingTomorrow,
    getChequeSummary,
} from "@/features/workspace/cheque-utils";
import { getMonthTotals } from "@/features/workspace/money-utils";
import {
    resolveBusinessPhotoById,
    resolveBusinessPhotoByOwnerUid,
    resolvePartyPhotoUrl,
} from "@/features/workspace/party-photo";
import { getTripsByStatus } from "@/features/workspace/trip-utils";
import {
    detectOverdueAp,
    detectOverdueServices,
    fetchApRecords,
    fetchBills,
    fetchCheques,
    fetchContacts,
    fetchGems,
    fetchServices,
    fetchTransactions,
    fetchTrips,
} from "@/features/workspace/workspace-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useMatchedCallLogs } from "@/hooks/use-matched-call-logs";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

const WORKSPACE = "/(marketplace)/(tabs)/workspace";

type ModuleGroupId = "inventory" | "money" | "people";

type ModuleItem = {
  label: string;
  value: number;
  icon: IconName;
  route: string;
  group: ModuleGroupId;
  hint?: string;
  /** Red badge count on the module icon (e.g. missed calls). */
  badgeCount?: number;
};

const MODULE_GROUPS: { id: ModuleGroupId; title: string }[] = [
  { id: "inventory", title: "Inventory & work" },
  { id: "money", title: "Money" },
  { id: "people", title: "People" },
];

type AlertItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: IconName;
  tone: "critical" | "warning" | "info" | "success";
  route: string;
};

function toneColors(tone: AlertItem["tone"], colors: ThemeColors) {
  switch (tone) {
    case "critical":
      return { fg: colors.error, bg: colors.error + "14" };
    case "warning":
      return { fg: colors.warningAmber, bg: colors.warningAmber + "18" };
    case "success":
      return { fg: colors.successEmerald, bg: colors.successEmerald + "18" };
    default:
      return { fg: colors.primary, bg: colors.primary + "14" };
  }
}

export default function WorkspaceHub() {
  const { user, profile } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [chromeHeight, setChromeHeight] = useState(0);
  const userId = user?.uid;
  const role = resolveProfileRole(profile);

  const { data: gems = [] } = useQuery({
    queryKey: ["gems", userId],
    queryFn: () => fetchGems(userId!),
    enabled: !!userId && canAccessModule(role, "gems"),
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services", userId],
    queryFn: () => fetchServices(userId!),
    enabled: !!userId && canAccessModule(role, "services"),
  });

  const { data: apRecords = [] } = useQuery({
    queryKey: ["ap", userId],
    queryFn: () => fetchApRecords(userId!),
    enabled: !!userId && canAccessModule(role, "ap"),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", userId],
    queryFn: () => fetchContacts(userId!),
    enabled: !!userId,
  });

  const { data: businesses = [] } = useQuery({
    queryKey: ["home-businesses"],
    queryFn: () => fetchBusinesses(),
    enabled: !!userId,
  });

  const contactPhoto = useMemo(
    () => (id: string | null | undefined) => {
      if (!id) return null;
      const contact = contacts.find((c) => c.id === id);
      return resolvePartyPhotoUrl(contact, businesses);
    },
    [contacts, businesses],
  );

  const businessPhoto = useMemo(
    () => (id: string | null | undefined) =>
      resolveBusinessPhotoById(id, businesses),
    [businesses],
  );

  const ownerBusinessPhoto = useMemo(
    () => (uid: string | null | undefined) =>
      resolveBusinessPhotoByOwnerUid(uid, businesses),
    [businesses],
  );

  const apImage = useMemo(
    () => (record: (typeof apRecords)[number]) => {
      const isTaken = !!userId && record.receiverUid === userId;
      if (isTaken) {
        return {
          url: ownerBusinessPhoto(record.senderUid),
          shape: "circle" as const,
        };
      }
      const partyId = record.receiverContactId || record.apHolderContactId;
      const url =
        contactPhoto(partyId) || businessPhoto(record.receiverBusinessId);
      return { url, shape: "circle" as const };
    },
    [userId, contactPhoto, businessPhoto, ownerBusinessPhoto],
  );

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions", userId],
    queryFn: () => fetchTransactions(userId!),
    enabled: !!userId && canAccessModule(role, "money"),
  });

  const { data: cheques = [] } = useQuery({
    queryKey: ["cheques", userId],
    queryFn: () => fetchCheques(userId!),
    enabled: !!userId && canAccessModule(role, "cheques"),
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["bills", userId],
    queryFn: () => fetchBills(userId!),
    enabled: !!userId && canAccessModule(role, "bills"),
  });

  const { data: trips = [] } = useQuery({
    queryKey: ["trips", userId],
    queryFn: () => fetchTrips(userId!),
    enabled: !!userId && canAccessModule(role, "trips"),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["lapidary-jobs", userId],
    queryFn: () => fetchLapidaryJobs(userId!),
    enabled: !!userId && canAccessModule(role, "jobs"),
  });

  const { data: certificates = [] } = useQuery({
    queryKey: ["lab-certificates", userId],
    queryFn: () => fetchLabCertificates(userId!),
    enabled: !!userId && canAccessModule(role, "certificates"),
  });

  const { data: incomingServiceRequests = [] } = useQuery({
    queryKey: ["incoming-service-requests", userId],
    queryFn: () => fetchIncomingServiceRequests(userId!),
    enabled: !!userId && role === "lapidary",
  });

  const showContacts = role === "trader" || role === "admin";
  const { logs: recentCalls } = useMatchedCallLogs({
    enabled: !!userId && showContacts,
  });
  const recentCallPreview = recentCalls.slice(0, 5);
  const missedCallCount = countMissedCalls(recentCalls);

  if (!user) {
    return (
      <SignInPrompt
        title="Your workspace"
        message="Sign in to manage your private gem inventory, services, and finances."
      />
    );
  }

  // Avoid flashing trader inventory while the Firestore profile is still loading.
  if (!profile) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: colors.textMuted }}>Loading workspace…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const overdueServices = detectOverdueServices(services);
  const overdueAp = detectOverdueAp(apRecords);
  const maturingCheques = detectChequesMaturingTomorrow(cheques);
  const chequeSummary = getChequeSummary(cheques);
  const billsDueToday = detectBillsDueToday(bills);
  const billSummary = getBillSummary(bills);
  const { active: activeTrips } = getTripsByStatus(trips);
  const ongoingTrips = trips.filter((t) => t.status === "ongoing");
  const takenPendingAp = apRecords.filter(
    (a) => a.status === "pending" && a.receiverUid === userId,
  );
  const givenPaymentSentAp = apRecords.filter(
    (a) => a.status === "payment_sent" && a.senderUid === userId,
  );

  const { income: monthIncome, expense: monthExpense } =
    getMonthTotals(transactions);
  const monthNet = monthIncome - monthExpense;
  const totalInventoryValue = gems.reduce(
    (sum, g) => sum + (g.acquisitionCost || 0),
    0,
  );
  const flowTotal = monthIncome + monthExpense;
  const incomePct =
    flowTotal > 0 ? Math.max(6, (monthIncome / flowTotal) * 100) : 0;
  const expensePct =
    flowTotal > 0 ? Math.max(6, (monthExpense / flowTotal) * 100) : 0;

  const readyGems = gems.filter((g) =>
    ["ready_for_sale", "certified", "polished", "listed"].includes(g.status),
  ).length;
  const inService = gems.filter((g) =>
    ["with_cutter", "with_heater", "with_polisher"].includes(g.status),
  ).length;

  const allModules: ModuleItem[] = [
    {
      label: "Gems",
      value: gems.length,
      icon: "diamond",
      route: `${WORKSPACE}/gems`,
      group: "inventory",
      hint: readyGems > 0 ? `${readyGems} ready` : undefined,
    },
    {
      label: "Jobs",
      value: jobs.length,
      icon: "construction",
      route: `${WORKSPACE}/jobs`,
      group: "inventory",
      hint:
        incomingServiceRequests.filter((r) => r.status === "pending").length > 0
          ? `${incomingServiceRequests.filter((r) => r.status === "pending").length} new`
          : undefined,
    },
    {
      label: "Services",
      value: services.length,
      icon: "handyman",
      route: `${WORKSPACE}/services`,
      group: "inventory",
      hint: inService > 0 ? `${inService} out` : undefined,
    },
    {
      label: "Certificates",
      value: certificates.length,
      icon: "workspace-premium",
      route: `${WORKSPACE}/certificates`,
      group: "inventory",
    },
    {
      label: "Trips",
      value: activeTrips.length,
      icon: "flight",
      route: `${WORKSPACE}/trips`,
      group: "inventory",
      hint: ongoingTrips.length > 0 ? `${ongoingTrips.length} live` : undefined,
    },
    {
      label: "AP",
      value: apRecords.length,
      icon: "hourglass-empty",
      route: `${WORKSPACE}/ap`,
      group: "money",
      hint:
        takenPendingAp.length > 0
          ? `${takenPendingAp.length} to accept`
          : givenPaymentSentAp.length > 0
            ? `${givenPaymentSentAp.length} to confirm`
            : overdueAp.length > 0
              ? `${overdueAp.length} overdue`
              : undefined,
    },
    {
      label: "Cheques",
      value: chequeSummary.holdingCount,
      icon: "money-check-dollar",
      route: `${WORKSPACE}/cheques`,
      group: "money",
      hint:
        maturingCheques.length > 0
          ? `${maturingCheques.length} due`
          : undefined,
    },
    {
      label: "Bills",
      value: billSummary.openCount,
      icon: "receipt-long",
      route: `${WORKSPACE}/bills`,
      group: "money",
      hint:
        billsDueToday.length > 0
          ? `${billsDueToday.length} due today`
          : undefined,
    },
    {
      label: "Contacts",
      value: contacts.length,
      icon: "group",
      route: `${WORKSPACE}/contacts`,
      group: "people",
      hint: missedCallCount > 0 ? `${missedCallCount} missed` : undefined,
      badgeCount: missedCallCount > 0 ? missedCallCount : undefined,
    },
  ];

  const modules = allModules.filter((m) => {
    if (m.label === "Jobs") return canAccessModule(role, "jobs");
    if (m.label === "Certificates")
      return canAccessModule(role, "certificates");
    if (m.label === "Gems") return canAccessModule(role, "gems");
    if (m.label === "Services")
      return canAccessModule(role, "services") || role === "lapidary";
    if (m.label === "Trips") return canAccessModule(role, "trips");
    if (m.label === "AP") return canAccessModule(role, "ap");
    if (m.label === "Cheques") return canAccessModule(role, "cheques");
    if (m.label === "Bills") return canAccessModule(role, "bills");
    if (m.label === "Contacts") return role === "trader" || role === "admin";
    return true;
  });

  const moduleGroups = MODULE_GROUPS.map((g) => ({
    ...g,
    items: modules.filter((m) => m.group === g.id),
  })).filter((g) => g.items.length > 0);

  const actions: {
    label: string;
    icon: IconName;
    route: string;
    primary?: boolean;
  }[] =
    role === "gem_lab"
      ? [
          {
            label: "Add certificate",
            icon: "workspace-premium",
            route: `${WORKSPACE}/certificates?add=1`,
            primary: true,
          },
          {
            label: "Verify",
            icon: "verified",
            route: "/verify-certificate",
          },
        ]
      : role === "lapidary"
        ? [
            {
              label: "Jobs",
              icon: "construction",
              route: `${WORKSPACE}/jobs`,
              primary: true,
            },
            {
              label: "Services",
              icon: "handyman",
              route: `${WORKSPACE}/services`,
            },
          ]
        : [
            {
              label: "Add gem",
              icon: "add",
              route: `${WORKSPACE}/gems/add`,
              primary: true,
            },
            {
              label: "Plan trip",
              icon: "flight-takeoff",
              route: `${WORKSPACE}/trips/add`,
            },
            {
              label: "Cheque",
              icon: "money-check-dollar",
              route: `${WORKSPACE}/cheques/add`,
            },
            {
              label: "Bill",
              icon: "receipt-long",
              route: `${WORKSPACE}/bills/add`,
            },
            {
              label: "Sale",
              icon: "sell",
              route: `${WORKSPACE}/money/record-sale`,
            },
          ];

  const alerts: AlertItem[] = [
    ...takenPendingAp.map((a) => ({
      id: `ap-pending-${a.id}`,
      title: "AP request to accept",
      subtitle: `From ${a.senderName} · ${a.items?.length || 1} gem(s)`,
      icon: "hourglass-empty" as const,
      tone: "warning" as const,
      route: `${WORKSPACE}/ap/${a.id}`,
    })),
    ...givenPaymentSentAp.map((a) => ({
      id: `ap-pay-${a.id}`,
      title: "Confirm AP payment",
      subtitle: `From ${a.receiverName} · #${a.id.slice(0, 6)}`,
      icon: "payments" as const,
      tone: "info" as const,
      route: `${WORKSPACE}/ap/${a.id}`,
    })),
    ...overdueAp.map((a) => ({
      id: `ap-${a.id}`,
      title: "AP stone overdue",
      subtitle: `Past expected return · #${a.id.slice(0, 6)}`,
      icon: "hourglass-empty" as const,
      tone: "critical" as const,
      route: `${WORKSPACE}/ap/${a.id}`,
    })),
    ...overdueServices.map((s) => ({
      id: `svc-${s.id}`,
      title: "Service overdue",
      subtitle: `With provider · #${s.id.slice(0, 6)}`,
      icon: "handyman" as const,
      tone: "warning" as const,
      route: `${WORKSPACE}/services/${s.id}`,
    })),
    ...maturingCheques.map((c) => ({
      id: `chq-${c.id}`,
      title: "Cheque matures tomorrow",
      subtitle: `${c.chequeNumber} · ${formatCurrency(c.amount)}`,
      icon: "money-check-dollar" as const,
      tone: "info" as const,
      route: `${WORKSPACE}/cheques/${c.id}`,
    })),
    ...billsDueToday.map((b) => ({
      id: `bill-${b.id}`,
      title: "Bill due today",
      subtitle: `${formatCurrency(b.amount - b.amountSettled, b.currency)}`,
      icon: "receipt-long" as const,
      tone: "warning" as const,
      route: `${WORKSPACE}/bills/${b.id}`,
    })),
  ];

  const showRequests = canAccessModule(role, "requests");
  const showNeedsAttention = alerts.length > 0;
  const showGemsHero = canAccessModule(role, "gems");
  const showJobsHero = canAccessModule(role, "jobs");
  const showCertsHero = canAccessModule(role, "certificates");
  const showTripsOverview = canAccessModule(role, "trips");
  const showChequesOverview = canAccessModule(role, "cheques");

  const heroTitle = showGemsHero
    ? "Inventory value"
    : showJobsHero
      ? "Workshop jobs"
      : showCertsHero
        ? "Certificates published"
        : "Workspace";
  const heroValue = showGemsHero
    ? formatCurrency(totalInventoryValue)
    : showJobsHero
      ? String(jobs.length)
      : showCertsHero
        ? String(certificates.length)
        : formatCurrency(monthNet);
  const heroRoute = showGemsHero
    ? `${WORKSPACE}/gems`
    : showJobsHero
      ? `${WORKSPACE}/jobs`
      : showCertsHero
        ? `${WORKSPACE}/certificates`
        : `${WORKSPACE}/money`;
  const heroLink = showGemsHero
    ? "Open inventory"
    : showJobsHero
      ? "Open jobs"
      : showCertsHero
        ? "Open certificates"
        : "Open money";
  const heroIcon: IconName = showGemsHero
    ? "diamond"
    : showJobsHero
      ? "construction"
      : showCertsHero
        ? "workspace-premium"
        : "account-balance-wallet";

  // Estimate until onLayout (header ~56 + optional strip).
  const topPad =
    (chromeHeight > 0 ? chromeHeight : insets.top + 56) + Spacing.stackSm;

  return (
    <View
      collapsable={false}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      {/* First descendant must be ScrollView for NativeTabs scroll-to-top. */}
      <ThemedScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Pressable
          onPress={() => router.push(heroRoute as never)}
          style={({ pressed }) => [
            styles.hero,
            { backgroundColor: colors.primary, opacity: pressed ? 0.96 : 1 },
          ]}
        >
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Text
                style={[styles.heroLabel, { color: colors.onPrimary + "B3" }]}
              >
                {heroTitle}
              </Text>
              <Text
                style={[styles.heroValue, { color: colors.onPrimary }]}
                selectable
              >
                {heroValue}
              </Text>
            </View>
            <View
              style={[
                styles.heroBadge,
                { backgroundColor: colors.onPrimary + "1F" },
              ]}
            >
              <Icon name={heroIcon} size={22} color={colors.onPrimary} />
            </View>
          </View>

          <View style={styles.heroMetaRow}>
            {showGemsHero ? (
              <>
                <View
                  style={[
                    styles.heroPill,
                    { backgroundColor: colors.onPrimary + "1A" },
                  ]}
                >
                  <Text
                    style={[styles.heroPillText, { color: colors.onPrimary }]}
                  >
                    {gems.length} {gems.length === 1 ? "gem" : "gems"}
                  </Text>
                </View>
                {readyGems > 0 ? (
                  <View
                    style={[
                      styles.heroPill,
                      { backgroundColor: colors.onPrimary + "1A" },
                    ]}
                  >
                    <Text
                      style={[styles.heroPillText, { color: colors.onPrimary }]}
                    >
                      {readyGems} ready to sell
                    </Text>
                  </View>
                ) : null}
                {inService > 0 ? (
                  <View
                    style={[
                      styles.heroPill,
                      { backgroundColor: colors.onPrimary + "1A" },
                    ]}
                  >
                    <Text
                      style={[styles.heroPillText, { color: colors.onPrimary }]}
                    >
                      {inService} in service
                    </Text>
                  </View>
                ) : null}
              </>
            ) : null}
            {showJobsHero ? (
              <View
                style={[
                  styles.heroPill,
                  { backgroundColor: colors.onPrimary + "1A" },
                ]}
              >
                <Text
                  style={[styles.heroPillText, { color: colors.onPrimary }]}
                >
                  {
                    incomingServiceRequests.filter(
                      (r) => r.status === "pending",
                    ).length
                  }{" "}
                  pending requests
                </Text>
              </View>
            ) : null}
            {showCertsHero ? (
              <View
                style={[
                  styles.heroPill,
                  { backgroundColor: colors.onPrimary + "1A" },
                ]}
              >
                <Text
                  style={[styles.heroPillText, { color: colors.onPrimary }]}
                >
                  Public verification
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.heroFooter}>
            <Text style={[styles.heroLink, { color: colors.onPrimary + "CC" }]}>
              {heroLink}
            </Text>
            <Icon
              name="chevron-right"
              size={18}
              color={colors.onPrimary + "CC"}
            />
          </View>
        </Pressable>

        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
            Quick actions
          </Text>
          <View
            style={[
              styles.actionsCard,
              { backgroundColor: colors.surfaceContainerLowest },
            ]}
          >
            {actions.map((a, index) => (
              <Pressable
                key={a.label}
                onPress={() => router.push(a.route as never)}
                style={({ pressed }) => [
                  styles.actionItem,
                  index < actions.length - 1 && {
                    borderRightWidth: StyleSheet.hairlineWidth,
                    borderRightColor: colors.outlineVariant,
                  },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <View
                  style={[
                    styles.actionIcon,
                    a.primary
                      ? { backgroundColor: colors.primary }
                      : { backgroundColor: colors.primaryContainer },
                  ]}
                >
                  <Icon
                    name={a.icon}
                    size={20}
                    color={
                      a.primary ? colors.onPrimary : colors.onPrimaryContainer
                    }
                  />
                </View>
                <Text
                  style={[
                    styles.actionLabel,
                    { color: colors.onSurfaceVariant },
                  ]}
                  numberOfLines={1}
                >
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Needs attention — above Inventory */}
        {showNeedsAttention ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: colors.onSurface, marginBottom: 0 },
                ]}
              >
                Needs attention
              </Text>
              <View
                style={[
                  styles.countPill,
                  { backgroundColor: colors.errorContainer },
                ]}
              >
                <Text
                  style={[
                    styles.countPillText,
                    { color: colors.onErrorContainer },
                  ]}
                >
                  {alerts.length}
                </Text>
              </View>
            </View>
            <View style={styles.alertList}>
              {alerts.map((alert) => {
                const tone = toneColors(alert.tone, colors);
                return (
                  <Pressable
                    key={alert.id}
                    onPress={() => router.push(alert.route as never)}
                    style={({ pressed }) => [
                      styles.alertRow,
                      {
                        backgroundColor: pressed
                          ? colors.surfaceContainerLow
                          : colors.surfaceContainerLowest,
                        transform: [{ scale: pressed ? 0.985 : 1 }],
                        boxShadow: pressed
                          ? "0 1px 4px rgba(0, 0, 0, 0.04)"
                          : "0 2px 12px rgba(0, 0, 0, 0.06)",
                      },
                    ]}
                  >
                    <View
                      style={[styles.alertIcon, { backgroundColor: tone.bg }]}
                    >
                      <Icon name={alert.icon} size={18} color={tone.fg} />
                    </View>
                    <View style={styles.alertText}>
                      <Text
                        style={[styles.alertTitle, { color: colors.onSurface }]}
                      >
                        {alert.title}
                      </Text>
                      <Text
                        style={[styles.alertSub, { color: colors.textMuted }]}
                        numberOfLines={1}
                      >
                        {alert.subtitle}
                      </Text>
                    </View>
                    <Icon
                      name="chevron-right"
                      size={20}
                      color={colors.outline}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Modules — gradient group panels + tiles */}
        <WorkspaceModules groups={moduleGroups} colors={colors} />

        {/* Operations overview */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
            Overview
          </Text>
          <View style={styles.overviewGrid}>
            <Pressable
              onPress={() => router.push(`${WORKSPACE}/money` as never)}
              style={({ pressed }) => [
                styles.overviewWide,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  opacity: pressed ? 0.94 : 1,
                },
              ]}
            >
              <View style={styles.overviewHeader}>
                <Text
                  style={[styles.overviewCaption, { color: colors.textMuted }]}
                >
                  This month
                </Text>
                <Icon
                  name="account-balance-wallet"
                  size={18}
                  color={colors.primary}
                />
              </View>
              <Text
                style={[
                  styles.overviewNet,
                  {
                    color: monthNet >= 0 ? colors.successEmerald : colors.error,
                  },
                ]}
                selectable
              >
                {monthNet >= 0 ? "+" : "-"}
                {formatCurrency(Math.abs(monthNet))}
              </Text>
              <Text
                style={[styles.overviewSub, { color: colors.onSurfaceVariant }]}
              >
                Net cashflow
              </Text>

              <View style={styles.flowBlock}>
                <View style={styles.flowRow}>
                  <Text
                    style={[
                      styles.flowLabel,
                      { color: colors.onSurfaceVariant },
                    ]}
                  >
                    Income
                  </Text>
                  <Text
                    style={[
                      styles.flowAmount,
                      { color: colors.successEmerald },
                    ]}
                  >
                    {formatCurrency(monthIncome)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.track,
                    { backgroundColor: colors.surfaceContainerHigh },
                  ]}
                >
                  <View
                    style={[
                      styles.fill,
                      {
                        backgroundColor: colors.successEmerald,
                        width: `${incomePct}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.flowBlock}>
                <View style={styles.flowRow}>
                  <Text
                    style={[
                      styles.flowLabel,
                      { color: colors.onSurfaceVariant },
                    ]}
                  >
                    Expenses
                  </Text>
                  <Text style={[styles.flowAmount, { color: colors.error }]}>
                    {formatCurrency(monthExpense)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.track,
                    { backgroundColor: colors.surfaceContainerHigh },
                  ]}
                >
                  <View
                    style={[
                      styles.fill,
                      {
                        backgroundColor: colors.error,
                        width: `${expensePct}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            </Pressable>

            <View style={styles.overviewSide}>
              {showTripsOverview ? (
                <Pressable
                  onPress={() => router.push(`${WORKSPACE}/trips` as never)}
                  style={({ pressed }) => [
                    styles.overviewHalf,
                    {
                      backgroundColor: colors.surfaceContainerLowest,
                      opacity: pressed ? 0.94 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.miniIcon,
                      { backgroundColor: colors.primaryContainer },
                    ]}
                  >
                    <Icon
                      name="flight"
                      size={16}
                      color={colors.onPrimaryContainer}
                    />
                  </View>
                  <Text style={[styles.miniValue, { color: colors.onSurface }]}>
                    {activeTrips.length}
                  </Text>
                  <Text style={[styles.miniLabel, { color: colors.textMuted }]}>
                    Active trips
                  </Text>
                  <Text
                    style={[
                      styles.miniHint,
                      { color: colors.onSurfaceVariant },
                    ]}
                    numberOfLines={1}
                  >
                    {ongoingTrips[0]?.tripName ?? "No live trips"}
                  </Text>
                </Pressable>
              ) : showJobsHero ? (
                <Pressable
                  onPress={() => router.push(`${WORKSPACE}/jobs` as never)}
                  style={({ pressed }) => [
                    styles.overviewHalf,
                    {
                      backgroundColor: colors.surfaceContainerLowest,
                      opacity: pressed ? 0.94 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.miniIcon,
                      { backgroundColor: colors.primaryContainer },
                    ]}
                  >
                    <Icon
                      name="construction"
                      size={16}
                      color={colors.onPrimaryContainer}
                    />
                  </View>
                  <Text style={[styles.miniValue, { color: colors.onSurface }]}>
                    {jobs.length}
                  </Text>
                  <Text style={[styles.miniLabel, { color: colors.textMuted }]}>
                    Active jobs
                  </Text>
                  <Text
                    style={[
                      styles.miniHint,
                      { color: colors.onSurfaceVariant },
                    ]}
                    numberOfLines={1}
                  >
                    Workshop queue
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() =>
                    router.push(`${WORKSPACE}/certificates` as never)
                  }
                  style={({ pressed }) => [
                    styles.overviewHalf,
                    {
                      backgroundColor: colors.surfaceContainerLowest,
                      opacity: pressed ? 0.94 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.miniIcon,
                      { backgroundColor: colors.primaryContainer },
                    ]}
                  >
                    <Icon
                      name="workspace-premium"
                      size={16}
                      color={colors.onPrimaryContainer}
                    />
                  </View>
                  <Text style={[styles.miniValue, { color: colors.onSurface }]}>
                    {certificates.length}
                  </Text>
                  <Text style={[styles.miniLabel, { color: colors.textMuted }]}>
                    Certificates
                  </Text>
                  <Text
                    style={[
                      styles.miniHint,
                      { color: colors.onSurfaceVariant },
                    ]}
                    numberOfLines={1}
                  >
                    Published reports
                  </Text>
                </Pressable>
              )}

              {showChequesOverview ? (
                <Pressable
                  onPress={() => router.push(`${WORKSPACE}/cheques` as never)}
                  style={({ pressed }) => [
                    styles.overviewHalf,
                    {
                      backgroundColor: colors.surfaceContainerLowest,
                      opacity: pressed ? 0.94 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.miniIcon,
                      { backgroundColor: colors.secondaryContainer },
                    ]}
                  >
                    <Icon
                      name="money-check-dollar"
                      size={16}
                      color={colors.onSecondaryContainer}
                    />
                  </View>
                  <Text style={[styles.miniValue, { color: colors.onSurface }]}>
                    {chequeSummary.holdingCount}
                  </Text>
                  <Text style={[styles.miniLabel, { color: colors.textMuted }]}>
                    Cheques held
                  </Text>
                  <Text
                    style={[
                      styles.miniHint,
                      { color: colors.onSurfaceVariant },
                    ]}
                    numberOfLines={1}
                  >
                    {formatCurrency(chequeSummary.clearingThisMonth)} clearing
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => router.push(`${WORKSPACE}/money` as never)}
                  style={({ pressed }) => [
                    styles.overviewHalf,
                    {
                      backgroundColor: colors.surfaceContainerLowest,
                      opacity: pressed ? 0.94 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.miniIcon,
                      { backgroundColor: colors.secondaryContainer },
                    ]}
                  >
                    <Icon
                      name="account-balance-wallet"
                      size={16}
                      color={colors.onSecondaryContainer}
                    />
                  </View>
                  <Text style={[styles.miniValue, { color: colors.onSurface }]}>
                    {formatCurrency(monthNet)}
                  </Text>
                  <Text style={[styles.miniLabel, { color: colors.textMuted }]}>
                    This month
                  </Text>
                  <Text
                    style={[
                      styles.miniHint,
                      { color: colors.onSurfaceVariant },
                    ]}
                    numberOfLines={1}
                  >
                    Money overview
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {/* Recent calls (matched to contacts / businesses) */}
        {showContacts && recentCallPreview.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: colors.onSurface, marginBottom: 0 },
                ]}
              >
                Recent calls
              </Text>
              <Pressable
                onPress={() =>
                  router.push(`${WORKSPACE}/contacts/calls` as never)
                }
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="See all calls"
              >
                <Text style={[styles.seeAll, { color: colors.primary }]}>
                  See all
                </Text>
              </Pressable>
            </View>
            <View
              style={[
                styles.recentCallsList,
                { backgroundColor: colors.surfaceContainerLowest },
              ]}
            >
              {recentCallPreview.map((log, index) => (
                <CallLogRow
                  key={log.id}
                  log={log}
                  isLast={index === recentCallPreview.length - 1}
                  onPress={() => router.push(log.href as never)}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ThemedScrollView>

      <View
        pointerEvents="box-none"
        style={[styles.chrome, { backgroundColor: colors.background }]}
        onLayout={(e) => setChromeHeight(e.nativeEvent.layout.height)}
      >
        <SafeAreaView edges={["top"]}>
          <StackHeader
            title="Workspace"
            showBack={false}
            right={
              showRequests ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Requests"
                  onPress={() => router.push(`${WORKSPACE}/requests` as never)}
                  style={({ pressed }) => [
                    styles.headerIconBtn,
                    {
                      backgroundColor: colors.surfaceContainerLowest,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Icon
                    name="outgoing-mail"
                    size={20}
                    color={colors.onSurfaceVariant}
                  />
                </Pressable>
              ) : null
            }
          />
          <ActiveProgressStrip
            trips={trips}
            apRecords={apRecords}
            cheques={cheques}
            bills={bills}
            services={services}
            currentUid={userId}
            contactName={(id) =>
              contacts.find((c) => c.id === id)?.displayName ?? "Contact"
            }
            contactPhoto={contactPhoto}
            businessPhoto={businessPhoto}
            ownerBusinessPhoto={ownerBusinessPhoto}
            apImage={apImage}
            limit={4}
            compact
            style={styles.headerTripWrap}
          />
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  chrome: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 12px rgba(0, 0, 0, 0.06)",
  },
  headerTripWrap: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.stackMd,
  },
  content: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 120,
    gap: Spacing.sectionGap,
  },

  hero: {
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    padding: Spacing.containerMargin,
    gap: 14,
    boxShadow: "0 10px 28px rgba(12, 67, 60, 0.22)",
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroCopy: { flex: 1, gap: 4, paddingRight: 12 },
  heroLabel: { ...Typography.labelMd, letterSpacing: 0.4 },
  heroValue: {
    ...Typography.displayLg,
    fontVariant: ["tabular-nums"],
  },
  heroBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  heroMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  heroPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  heroPillText: { ...Typography.caption, fontWeight: "600" },
  heroFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 2,
  },
  heroLink: { ...Typography.labelMd },

  section: { gap: Spacing.stackMd },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { ...Typography.headlineSmMobile },
  seeAll: { ...Typography.labelMd, fontWeight: "600" },
  recentCallsList: {
    marginHorizontal: -Spacing.containerMargin,
    overflow: "hidden",
  },
  countPill: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  countPillText: { ...Typography.caption, fontWeight: "700" },

  actionsCard: {
    flexDirection: "row",
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    paddingVertical: 14,
    boxShadow: "0 2px 12px rgba(0, 0, 0, 0.06)",
  },
  actionItem: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    ...Typography.caption,
    fontWeight: "600",
    textAlign: "center",
  },

  alertList: { gap: Spacing.stackSm },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.stackMd,
    padding: 14,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    boxShadow: "0 2px 12px rgba(0, 0, 0, 0.06)",
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  alertText: { flex: 1, gap: 2, minWidth: 0 },
  alertTitle: { ...Typography.bodyLg, fontWeight: "600" },
  alertSub: { ...Typography.bodyMd },

  overviewGrid: {
    flexDirection: "row",
    gap: Spacing.stackMd,
    alignItems: "stretch",
  },
  overviewWide: {
    flex: 1.35,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    padding: 16,
    gap: 10,
    boxShadow: "0 2px 12px rgba(0, 0, 0, 0.06)",
  },
  overviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  overviewCaption: { ...Typography.labelMd },
  overviewNet: {
    ...Typography.headlineMd,
    fontVariant: ["tabular-nums"],
  },
  overviewSub: { ...Typography.caption, marginTop: -4 },
  flowBlock: { gap: 6, marginTop: 4 },
  flowRow: { flexDirection: "row", justifyContent: "space-between" },
  flowLabel: { ...Typography.caption, fontWeight: "600" },
  flowAmount: {
    ...Typography.caption,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  track: { height: 6, borderRadius: 3, overflow: "hidden", width: "100%" },
  fill: { height: "100%", borderRadius: 3 },

  overviewSide: { flex: 1, gap: Spacing.stackMd },
  overviewHalf: {
    flex: 1,
    borderRadius: Radius.xl,
    borderCurve: "continuous",
    padding: 14,
    gap: 4,
    boxShadow: "0 2px 12px rgba(0, 0, 0, 0.06)",
  },
  miniIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  miniValue: {
    ...Typography.headlineSm,
    fontVariant: ["tabular-nums"],
  },
  miniLabel: { ...Typography.caption, fontWeight: "600" },
  miniHint: { ...Typography.caption },
});
