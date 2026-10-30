/**
 * Travel documents on trips (passport, visa, ticket…): kind metadata, the
 * "what did you scan?" sheet, a thumbnail, a busy-aware band link and a
 * full-screen in-app viewer. Documents are owner-only — callers must not
 * render any of this for non-owners, and URLs must never be logged.
 */
import { Image } from "expo-image";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  ChoiceTileGrid,
  type ChoiceTileOption,
} from "@/components/ui/choice-tile-grid";
import { BandLink } from "@/components/ui/detail-kit";
import { Icon, type IconName } from "@/components/ui/icon";
import { FontFamily, Radius, Spacing } from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { TripDocumentKind } from "@/types";

export const TRIP_DOCUMENT_KINDS: {
  value: TripDocumentKind;
  label: string;
  icon: IconName;
}[] = [
  { value: "passport", label: "Passport", icon: "badge" },
  { value: "visa", label: "Visa", icon: "fact-check" },
  { value: "ticket", label: "Ticket", icon: "airplane-ticket" },
  { value: "other", label: "Other", icon: "description" },
];

export function isTripDocumentKind(value: unknown): value is TripDocumentKind {
  return TRIP_DOCUMENT_KINDS.some((k) => k.value === value);
}

export function tripDocumentKindLabel(kind: TripDocumentKind): string {
  return TRIP_DOCUMENT_KINDS.find((k) => k.value === kind)?.label ?? "Document";
}

export function tripDocumentKindIcon(kind: TripDocumentKind): IconName {
  return TRIP_DOCUMENT_KINDS.find((k) => k.value === kind)?.icon ?? "description";
}

const KIND_OPTIONS: ChoiceTileOption<TripDocumentKind>[] = TRIP_DOCUMENT_KINDS.map(
  (k) => ({ value: k.value, label: k.label, icon: k.icon }),
);

/** Bottom sheet asking which kind of document was just scanned. */
export function TripDocumentKindSheet({
  visible,
  onClose,
  onSelect,
  pageCount,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (kind: TripDocumentKind) => void;
  pageCount: number;
}) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={pageCount > 1 ? `What are these ${pageCount} pages?` : "What did you scan?"}
      fitToContents
    >
      <ChoiceTileGrid
        layout="grid"
        options={KIND_OPTIONS}
        value={null}
        onChange={onSelect}
      />
    </BottomSheet>
  );
}

/** Square thumbnail for a document row (local or remote uri). */
export function TripDocumentThumb({ uri, size = 44 }: { uri: string; size?: number }) {
  const { colors } = useAppTheme();
  return (
    <Image
      source={{ uri }}
      style={[
        styles.thumb,
        { width: size, height: size, backgroundColor: colors.surfaceContainerHigh },
      ]}
      contentFit="cover"
      recyclingKey={uri}
      accessibilityIgnoresInvertColors
    />
  );
}

/** Band-header "Scan" link that turns into a spinner while uploading. */
export function TripDocumentsScanLink({
  busy,
  onPress,
}: {
  busy: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  if (busy) {
    return (
      <View
        style={styles.busy}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Uploading documents"
      >
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.busyText, { color: colors.textMuted }]}>Uploading…</Text>
      </View>
    );
  }
  return <BandLink label="Scan" onPress={onPress} />;
}

/** Full-screen in-app viewer, so passport URLs never reach the browser history. */
export function TripDocumentViewer({
  uri,
  title,
  onClose,
}: {
  uri: string | null;
  title?: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={!!uri}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.viewer}>
        {uri ? (
          <Image
            source={{ uri }}
            style={styles.viewerImage}
            contentFit="contain"
            recyclingKey={`full-${uri}`}
            accessibilityIgnoresInvertColors
            accessibilityLabel={title}
          />
        ) : null}
        {title ? (
          <Text style={[styles.viewerTitle, { top: insets.top + 14 }]} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close document"
          hitSlop={12}
          style={[styles.closeBtn, { top: insets.top + 8, right: Math.max(insets.right, 16) }]}
        >
          <Icon name="close" size={26} color="#FFFFFF" />
        </Pressable>
      </View>
    </Modal>
  );
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  thumb: {
    borderRadius: Radius.md,
    borderCurve: "continuous",
  },
  busy: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  busyText: { ...text, fontFamily: FontFamily.medium, fontSize: 14 },
  viewer: { flex: 1, backgroundColor: "#000000" },
  viewerImage: { width: "100%", height: "100%" },
  viewerTitle: {
    ...text,
    position: "absolute",
    left: 64,
    right: 64,
    textAlign: "center",
    fontFamily: FontFamily.medium,
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
  },
  closeBtn: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
});
