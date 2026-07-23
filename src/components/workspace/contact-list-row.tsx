import { Link, type Href } from "expo-router";
import { memo, useCallback, useRef } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { RectButton } from "react-native-gesture-handler";
import Swipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

import { Icon } from "@/components/ui/icon";
import { ContactAvatar } from "@/components/workspace/contact-avatar";
import {
  BrandPalette,
  Spacing,
  Typography,
} from "@/constants/design-tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import { friendlyError } from "@/lib/errors";
import { openPhone, openWhatsApp } from "@/lib/utils";
import { confirmDelete } from "@/providers/confirm-provider";
import { useToast } from "@/providers/toast-provider";
import type { Contact } from "@/types";

const ACTION_WIDTH = 74;

type ContactListRowProps = {
  contact: Contact;
  /** Override avatar (e.g. resolved business logo). Defaults to contact.photoUrl. */
  photoUrl?: string | null;
  isLastInSection: boolean;
  href: Href;
  onDelete: () => Promise<void>;
  onToggleFavourite: () => Promise<void>;
  onSwipeableOpen: (id: string, methods: SwipeableMethods) => void;
  onSwipeableClose: (id: string) => void;
};

function ContactListRowInner({
  contact,
  photoUrl,
  isLastInSection,
  href,
  onDelete,
  onToggleFavourite,
  onSwipeableOpen,
  onSwipeableClose,
}: ContactListRowProps) {
  const { colors } = useAppTheme();
  const toast = useToast();
  const swipeRef = useRef<SwipeableMethods | null>(null);

  const close = useCallback(() => {
    swipeRef.current?.close();
  }, []);

  const handleCall = useCallback(() => {
    close();
    if (!contact.phone) return;
    void Linking.openURL(openPhone(contact.phone));
  }, [close, contact.phone]);

  const handleMessage = useCallback(() => {
    close();
    const number = contact.whatsapp || contact.phone;
    if (!number) return;
    void Linking.openURL(openWhatsApp(number));
  }, [close, contact.phone, contact.whatsapp]);

  const handleFavourite = useCallback(() => {
    close();
    void onToggleFavourite().catch((e) => {
      console.error(e);
    });
  }, [close, onToggleFavourite]);

  const handleDelete = useCallback(() => {
    close();
    void confirmDelete(
      "Delete Contact",
      `Are you sure you want to delete ${contact.displayName}?`,
      async () => {
        try {
          await onDelete();
        } catch (e) {
          toast.error(friendlyError(e, "Couldn’t delete"));
          throw e;
        }
      },
    );
  }, [close, contact.displayName, onDelete, toast]);

  const renderLeftActions = useCallback(() => {
    return (
      <View style={styles.actionsRow}>
        <RectButton
          style={[
            styles.action,
            {
              backgroundColor: contact.isFavourite
                ? colors.outline
                : colors.warningAmber,
            },
          ]}
          onPress={handleFavourite}
          accessibilityRole="button"
          accessibilityLabel={
            contact.isFavourite ? "Remove from favourites" : "Add to favourites"
          }
        >
          <Icon
            name={contact.isFavourite ? "star" : "star-border"}
            size={22}
            color={colors.white}
          />
          <Text style={[styles.actionLabel, { color: colors.white }]}>
            {contact.isFavourite ? "Unstar" : "Favourite"}
          </Text>
        </RectButton>
      </View>
    );
  }, [colors, contact.isFavourite, handleFavourite]);

  const renderRightActions = useCallback(() => {
    const canMessage = !!(contact.whatsapp || contact.phone);
    const canCall = !!contact.phone;

    return (
      <View style={styles.actionsRow}>
        {canMessage ? (
          <RectButton
            style={[styles.action, { backgroundColor: BrandPalette.whatsapp }]}
            onPress={handleMessage}
            accessibilityRole="button"
            accessibilityLabel="Message on WhatsApp"
          >
            <Icon name="whatsapp" size={22} color={colors.white} />
            <Text style={[styles.actionLabel, { color: colors.white }]}>
              Message
            </Text>
          </RectButton>
        ) : null}
        {canCall ? (
          <RectButton
            style={[styles.action, { backgroundColor: BrandPalette.phone }]}
            onPress={handleCall}
            accessibilityRole="button"
            accessibilityLabel="Call"
          >
            <Icon name="call" size={22} color={colors.white} />
            <Text style={[styles.actionLabel, { color: colors.white }]}>
              Call
            </Text>
          </RectButton>
        ) : null}
        <RectButton
          style={[styles.action, { backgroundColor: colors.error }]}
          onPress={handleDelete}
          accessibilityRole="button"
          accessibilityLabel="Delete contact"
        >
          <Icon name="delete-outline" size={22} color={colors.onError} />
          <Text style={[styles.actionLabel, { color: colors.onError }]}>
            Delete
          </Text>
        </RectButton>
      </View>
    );
  }, [
    colors,
    contact.phone,
    contact.whatsapp,
    handleCall,
    handleDelete,
    handleMessage,
  ]);

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      overshootFriction={8}
      enableTrackpadTwoFingerGesture
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpen={() => {
        if (swipeRef.current) {
          onSwipeableOpen(contact.id, swipeRef.current);
        }
      }}
      onSwipeableClose={() => onSwipeableClose(contact.id)}
      childrenContainerStyle={styles.swipeChild}
    >
      {/* Link asChild/Slot rejects style arrays — styles live on the inner View. */}
      <Link href={href} asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={contact.displayName}
        >
          {({ pressed }) => (
            <View
              style={StyleSheet.flatten([
                styles.row,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  opacity: pressed ? 0.72 : 1,
                },
              ])}
            >
              <Link.AppleZoom>
                <ContactAvatar
                  name={contact.displayName}
                  photoUrl={photoUrl ?? contact.photoUrl}
                  size={40}
                />
              </Link.AppleZoom>
              <View
                style={StyleSheet.flatten([
                  styles.body,
                  !isLastInSection
                    ? {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.outlineVariant,
                      }
                    : null,
                ])}
              >
                <View style={styles.nameRow}>
                  <Text
                    style={[styles.name, { color: colors.onSurface }]}
                    numberOfLines={1}
                  >
                    {contact.displayName}
                  </Text>
                  {contact.isFavourite ? (
                    <Icon name="star" size={14} color={colors.warningAmber} />
                  ) : null}
                </View>
                {contact.companyName ? (
                  <Text
                    style={[styles.subtitle, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {contact.companyName}
                  </Text>
                ) : contact.contactTypes[0] ? (
                  <Text
                    style={[styles.subtitle, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {contact.contactTypes[0]}
                  </Text>
                ) : null}
              </View>
            </View>
          )}
        </Pressable>
      </Link>
    </Swipeable>
  );
}

export const ContactListRow = memo(ContactListRowInner);

const styles = StyleSheet.create({
  swipeChild: { width: "100%" },
  row: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    minHeight: 60,
    paddingLeft: Spacing.containerMargin,
    gap: 12,
  },
  body: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    paddingVertical: 10,
    paddingRight: Spacing.containerMargin,
    gap: 2,
    minHeight: 60,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    ...Typography.bodyLg,
    fontSize: 17,
    fontWeight: "400",
    flexShrink: 1,
  },
  subtitle: {
    ...Typography.bodyMd,
    fontSize: 14,
    textTransform: "capitalize",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  action: {
    width: ACTION_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  actionLabel: {
    ...Typography.caption,
    fontWeight: "600",
    fontSize: 11,
  },
});
