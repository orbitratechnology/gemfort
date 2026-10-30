import { StyleSheet, Text, View } from "react-native";

import { SHEET_CLOSE_MS } from "@/components/scan/scan-to-add-row";
import { ActionTile, ActionTileGrid } from "@/components/ui/action-tile";
import { Accent } from "@/components/ui/detail-kit";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Spacing, Typography } from "@/constants/design-tokens";
import { WORKSPACE_ENTITY_IMAGES } from "@/constants/workspace-entity-images";
import { useAppTheme } from "@/hooks/use-app-theme";

export type TripScanKind = "visa" | "ticket";

/**
 * Floating "Trip actions" sheet on the trip detail screen: record gems and
 * expenses, and scan a visa or ticket straight into travel documents.
 * Each action closes the sheet first so the next screen or camera opens
 * cleanly.
 */
export function TripActionsSheet({
  visible,
  onClose,
  showAddGem,
  showAddGems,
  showDocuments,
  scanBusy,
  onAddGem,
  onAddGems,
  onAddExpense,
  onScan,
}: {
  visible: boolean;
  onClose: () => void;
  /** Sourcing trips: record a gem bought on the trip. */
  showAddGem: boolean;
  /** Selling trips: add inventory to the parcel. */
  showAddGems: boolean;
  /** Owner only — travel documents are private. */
  showDocuments: boolean;
  scanBusy: boolean;
  onAddGem: () => void;
  onAddGems: () => void;
  onAddExpense: () => void;
  onScan: (kind: TripScanKind) => void;
}) {
  const { colors } = useAppTheme();

  function run(action: () => void) {
    onClose();
    // Let the sheet finish dismissing before a screen or the camera opens.
    setTimeout(action, SHEET_CLOSE_MS);
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Trip actions" fitToContents>
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Record</Text>
        <ActionTileGrid>
          {showAddGem ? (
            <ActionTile
              label="Add gem"
              hint="Record a gem bought on this trip"
              icon="diamond"
              image={require("@/assets/images/mygems-icon.png")}
              accent={colors.primary}
              onPress={() => run(onAddGem)}
            />
          ) : null}
          {showAddGems ? (
            <ActionTile
              label={showAddGem ? "Add to parcel" : "Add gems"}
              hint="Add gems from inventory to the parcel you're carrying"
              icon="inventory-2"
              accent={colors.primary}
              onPress={() => run(onAddGems)}
            />
          ) : null}
          <ActionTile
            label="Expense"
            hint="Log a flight, stay or other trip cost"
            icon="receipt"
            image={WORKSPACE_ENTITY_IMAGES.bill}
            accent={colors.primary}
            onPress={() => run(onAddExpense)}
          />
        </ActionTileGrid>
      </View>

      {showDocuments ? (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            Scan travel documents
          </Text>
          <ActionTileGrid>
            <ActionTile
              label="Visa"
              accessibilityLabel="Scan visa"
              hint="Adds it to this trip's private travel documents"
              icon="fact-check"
              accent={Accent.teal}
              disabled={scanBusy}
              onPress={() => run(() => onScan("visa"))}
            />
            <ActionTile
              label="Ticket"
              accessibilityLabel="Scan ticket"
              hint="Adds it to this trip's private travel documents"
              icon="airplane-ticket"
              image={WORKSPACE_ENTITY_IMAGES.trip}
              accent={Accent.teal}
              disabled={scanBusy}
              onPress={() => run(() => onScan("ticket"))}
            />
          </ActionTileGrid>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  sectionLabel: {
    ...Typography.labelMd,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
