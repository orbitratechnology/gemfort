import { Image, type ImageSource } from "expo-image";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/icon";
import { Radius } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";

export type WorkspaceBackdropKind =
  | "cheques"
  | "bills"
  | "gems"
  | "trips"
  | "services"
  | "jobs"
  | "ap"
  | "certificates"
  | "contacts"
  | "requests"
  | "money";

const KIND_IMAGE: Partial<Record<WorkspaceBackdropKind, ImageSource>> = {
  cheques: require("@/assets/images/cheque-icon.png"),
  bills: require("@/assets/images/bill-icon.png"),
  gems: require("@/assets/images/mygems-icon.png"),
  trips: require("@/assets/images/trips-icon.png"),
  services: require("@/assets/images/lapidary-icon.png"),
  jobs: require("@/assets/images/lapidary-icon.png"),
  ap: require("@/assets/images/ap-icon.png"),
  certificates: require("@/assets/images/certificate-icon.png"),
};

const KIND_FALLBACK: Record<
  WorkspaceBackdropKind,
  { icon: IconName; satellites: IconName[] }
> = {
  cheques: {
    icon: "money-check-dollar",
    satellites: ["money-check-dollar", "money-check-dollar"],
  },
  bills: {
    icon: "receipt-long",
    satellites: ["payments", "receipt-long"],
  },
  gems: { icon: "diamond", satellites: ["diamond", "auto-awesome"] },
  trips: { icon: "flight", satellites: ["public", "luggage"] },
  services: { icon: "handyman", satellites: ["build", "schedule"] },
  jobs: { icon: "construction", satellites: ["build", "handyman"] },
  ap: { icon: "handshake", satellites: ["hourglass-empty", "handshake"] },
  certificates: {
    icon: "workspace-premium",
    satellites: ["verified", "workspace-premium"],
  },
  contacts: { icon: "contacts", satellites: ["group", "person"] },
  requests: { icon: "outgoing-mail", satellites: ["inbox", "send"] },
  money: {
    icon: "account-balance-wallet",
    satellites: ["payments", "trending-up"],
  },
};

type Props = { kind: WorkspaceBackdropKind };

/**
 * Atmospheric backdrop anchored near the bottom so list content stays clear.
 * Prefers the module's illustration image; falls back to icon motifs.
 */
export function WorkspaceScreenBackdrop({ kind }: Props) {
  const { colors, isDark } = useAppTheme();
  const { width } = useWindowDimensions();
  const image = KIND_IMAGE[kind];
  const cfg = KIND_FALLBACK[kind];

  const anchorBottom = 56;
  const heroSize = Math.min(width * 0.72, 300);

  if (image) {
    return (
      <View
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}
      >
        {/* Soft secondary ghost */}
        <Image
          source={image}
          style={[
            styles.ghost,
            {
              width: heroSize * 0.42,
              height: heroSize * 0.42,
              bottom: anchorBottom + heroSize * 0.78,
              left: width * 0.08,
              opacity: isDark ? 0.1 : 0.07,
              transform: [{ rotate: "-14deg" }],
            },
          ]}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
        <Image
          source={image}
          style={[
            styles.ghost,
            {
              width: heroSize * 0.36,
              height: heroSize * 0.36,
              bottom: anchorBottom + 12,
              right: width * 0.06,
              opacity: isDark ? 0.09 : 0.06,
              transform: [{ rotate: "12deg" }],
            },
          ]}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />

        {/* Primary illustration */}
        <Image
          source={image}
          style={[
            styles.hero,
            {
              width: heroSize,
              height: heroSize,
              bottom: anchorBottom + 28,
              left: (width - heroSize) / 2,
              opacity: isDark ? 0.28 : 0.2,
              borderRadius: Radius.xl,
            },
          ]}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }

  const ink = isDark ? colors.primary + "22" : colors.primary + "14";
  const plate = isDark
    ? colors.surfaceContainerHigh + "99"
    : colors.surfaceContainerLowest + "E6";
  const plateBorder = isDark
    ? colors.outlineVariant + "55"
    : colors.outlineVariant + "AA";

  const plateW = Math.min(width * 0.78, 320);
  const plateH = 200;

  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <View
        style={[
          styles.plateWrap,
          {
            bottom: anchorBottom + 24,
            left: (width - plateW) / 2,
            width: plateW,
            height: plateH,
          },
        ]}
      >
        <MotifPlate
          kind={kind}
          plate={plate}
          plateBorder={plateBorder}
          ink={ink}
        />
      </View>

      <View
        style={[
          styles.centerMark,
          {
            bottom: anchorBottom + 72,
            left: (width - 112) / 2,
            opacity: isDark ? 0.16 : 0.12,
          },
        ]}
      >
        <Icon name={cfg.icon} size={112} color={colors.primary} />
      </View>

      <View
        style={[
          styles.mark,
          {
            bottom: anchorBottom + 180,
            left: width * 0.1,
            opacity: isDark ? 0.1 : 0.07,
            transform: [{ rotate: "-16deg" }],
          },
        ]}
      >
        <Icon name={cfg.satellites[0]} size={48} color={colors.primary} />
      </View>
      <View
        style={[
          styles.mark,
          {
            bottom: anchorBottom + 20,
            right: width * 0.08,
            opacity: isDark ? 0.09 : 0.06,
            transform: [{ rotate: "14deg" }],
          },
        ]}
      >
        <Icon name={cfg.satellites[1]} size={56} color={colors.primary} />
      </View>
    </View>
  );
}

function MotifPlate({
  kind,
  plate,
  plateBorder,
  ink,
}: {
  kind: WorkspaceBackdropKind;
  plate: string;
  plateBorder: string;
  ink: string;
}) {
  if (kind === "contacts") {
    return (
      <View style={styles.contactsMotif}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.avatarDot,
              {
                backgroundColor: i === 1 ? ink : plate,
                borderColor: plateBorder,
                marginLeft: i === 0 ? 0 : -18,
                zIndex: 3 - i,
              },
            ]}
          />
        ))}
      </View>
    );
  }

  if (kind === "requests") {
    return (
      <View
        style={[
          styles.envelope,
          { backgroundColor: plate, borderColor: plateBorder },
        ]}
      >
        <View style={[styles.envelopeFlap, { borderBottomColor: ink }]} />
      </View>
    );
  }

  // money
  return (
    <View style={styles.moneyStack}>
      <View
        style={[
          styles.walletCard,
          styles.walletBack,
          { backgroundColor: ink, borderColor: plateBorder },
        ]}
      />
      <View
        style={[
          styles.walletCard,
          { backgroundColor: plate, borderColor: plateBorder },
        ]}
      >
        <View style={[styles.walletChip, { backgroundColor: ink }]} />
      </View>
    </View>
  );
}

/** @deprecated Prefer WorkspaceScreenBackdrop kind="cheques" */
export function ChequeScreenBackdrop() {
  return <WorkspaceScreenBackdrop kind="cheques" />;
}

const styles = StyleSheet.create({
  hero: {
    position: "absolute",
    borderCurve: "continuous",
  },
  ghost: {
    position: "absolute",
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },
  plateWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  centerMark: {
    position: "absolute",
    width: 112,
    height: 112,
    alignItems: "center",
    justifyContent: "center",
  },
  mark: { position: "absolute" },

  contactsMotif: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 120,
  },
  avatarDot: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: StyleSheet.hairlineWidth,
  },

  envelope: {
    width: 200,
    height: 140,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    transform: [{ rotate: "-5deg" }],
  },
  envelopeFlap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    borderLeftWidth: 100,
    borderRightWidth: 100,
    borderBottomWidth: 70,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },

  moneyStack: {
    width: 220,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
  },
  walletCard: {
    width: 200,
    height: 118,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  walletBack: {
    position: "absolute",
    top: 8,
    transform: [{ rotate: "8deg" }, { scale: 0.94 }],
  },
  walletChip: {
    width: 36,
    height: 28,
    borderRadius: 6,
    opacity: 0.7,
  },
});
