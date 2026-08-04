import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon, type IconName } from '@/components/ui/icon';
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design-tokens';
import {
  airlineLogoUrl,
  formatFlightDateTime,
  formatFlightDuration,
  type FlightOffer,
} from '@/features/flights/flights-service';
import { useAppTheme } from '@/hooks/use-app-theme';

function fare(value: number, currency: string) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.detailRow}>
      <View
        style={[
          styles.detailIcon,
          { backgroundColor: colors.surfaceContainerLow },
        ]}
      >
        <Icon name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.detailCopy}>
        <Text selectable={false} style={[styles.detailLabel, { color: colors.textMuted }]}>
          {label}
        </Text>
        <Text selectable={false} style={[styles.detailValue, { color: colors.onSurface }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export function FlightDetailsSheet({
  offer,
  currency,
  booking,
  onClose,
  onBook,
}: {
  offer: FlightOffer | null;
  currency: string;
  booking: boolean;
  onClose: () => void;
  onBook: (offer: FlightOffer) => void;
}) {
  const { colors } = useAppTheme();
  const logo = airlineLogoUrl(offer?.airline ?? null, 264, 87);

  return (
    <BottomSheet
      visible={!!offer}
      onClose={onClose}
      title="Flight details"
      footer={
        offer ? (
          <Pressable
            disabled={booking || !offer.bookingUrl}
            accessibilityRole="button"
            accessibilityLabel="View this flight on Aviasales"
            onPress={() => onBook(offer)}
            style={({ pressed }) => [
              styles.bookButton,
              { backgroundColor: colors.primary },
              (booking || !offer.bookingUrl) && { opacity: 0.5 },
              pressed && { transform: [{ scale: 0.985 }] },
            ]}
          >
            {booking ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Icon name="open-in-new" size={19} color={colors.onPrimary} />
            )}
            <Text selectable={false} style={[styles.bookText, { color: colors.onPrimary }]}>
              {booking ? 'Preparing partner link…' : 'View on Aviasales'}
            </Text>
          </Pressable>
        ) : null
      }
    >
      {offer ? (
        <View style={styles.content}>
          <View
            style={[
              styles.summary,
              { backgroundColor: colors.surfaceContainerLow },
            ]}
          >
            <View style={styles.summaryTop}>
              <View
                style={[
                  styles.logo,
                  { backgroundColor: colors.surfaceContainerLowest },
                ]}
              >
                {logo ? (
                  <Image source={logo} style={styles.logoImage} contentFit="contain" />
                ) : (
                  <Icon name="flight" size={24} color={colors.primary} />
                )}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text selectable={false} style={[styles.airline, { color: colors.onSurface }]}>
                  {offer.airline ? `Airline ${offer.airline}` : 'Airline unavailable'}
                </Text>
                <Text selectable={false} style={[styles.flight, { color: colors.textMuted }]}>
                  {offer.flightNumber ? `Flight ${offer.flightNumber}` : 'Flight number unavailable'}
                </Text>
              </View>
              <Text selectable={false} style={[styles.price, { color: colors.primary }]}>
                {fare(offer.price, currency)}
              </Text>
            </View>

            <View style={styles.route}>
              <Text selectable={false} style={[styles.routeCode, { color: colors.onSurface }]}>
                {offer.originAirport || offer.origin}
              </Text>
              <View style={styles.routeTrack}>
                <View
                  style={[
                    styles.routeRule,
                    { borderColor: colors.outlineVariant },
                  ]}
                />
                <View style={[styles.plane, { backgroundColor: colors.primary }]}>
                  <Icon name="flight" size={15} color={colors.onPrimary} />
                </View>
              </View>
              <Text selectable={false} style={[styles.routeCode, { color: colors.onSurface }]}>
                {offer.destinationAirport || offer.destination}
              </Text>
            </View>
          </View>

          <View style={styles.details}>
            <DetailRow
              icon="flight-takeoff"
              label="Departure"
              value={formatFlightDateTime(offer.departureAt)}
            />
            {offer.returnAt ? (
              <DetailRow
                icon="flight-land"
                label="Return"
                value={formatFlightDateTime(offer.returnAt)}
              />
            ) : null}
            <DetailRow
              icon="schedule"
              label="Total duration"
              value={formatFlightDuration(offer.duration)}
            />
            <DetailRow
              icon="connecting-airports"
              label="Outbound stops"
              value={
                offer.transfers === 0
                  ? 'Non-stop'
                  : `${offer.transfers} stop${offer.transfers > 1 ? 's' : ''}`
              }
            />
            {offer.returnAt ? (
              <DetailRow
                icon="connecting-airports"
                label="Return stops"
                value={
                  offer.returnTransfers === 0
                    ? 'Non-stop'
                    : `${offer.returnTransfers} stop${offer.returnTransfers > 1 ? 's' : ''}`
                }
              />
            ) : null}
            {offer.foundAt ? (
              <DetailRow
                icon="history"
                label="Fare found"
                value={formatFlightDateTime(offer.foundAt)}
              />
            ) : null}
            {offer.expiresAt ? (
              <DetailRow
                icon="event-busy"
                label="Cache expires"
                value={formatFlightDateTime(offer.expiresAt)}
              />
            ) : null}
          </View>

          <View
            style={[
              styles.notice,
              { backgroundColor: colors.surfaceContainerLow },
            ]}
          >
            <Icon name="info-outline" size={18} color={colors.onSurfaceVariant} />
            <Text selectable={false} style={[styles.noticeText, { color: colors.onSurfaceVariant }]}>
              This is a cached Aviasales fare. Availability and the final price are
              confirmed after opening the booking site.
            </Text>
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.lg },
  summary: { padding: Spacing.md, borderRadius: 20, borderCurve: 'continuous', gap: Spacing.lg },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logo: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  logoImage: { width: 42, height: 26 },
  airline: { ...Typography.bodyMd, fontFamily: FontFamily.semibold },
  flight: { ...Typography.caption },
  price: { ...Typography.bodyLg, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
  route: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  routeCode: { fontFamily: FontFamily.bold, fontSize: 22 },
  routeTrack: { flex: 1, height: 28, justifyContent: 'center', alignItems: 'center' },
  routeRule: { width: '100%', borderTopWidth: 1, borderStyle: 'dashed' },
  plane: { position: 'absolute', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '90deg' }] },
  details: { gap: Spacing.md },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  detailIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  detailCopy: { flex: 1, gap: 2 },
  detailLabel: { ...Typography.caption },
  detailValue: { ...Typography.bodyMd, fontFamily: FontFamily.medium },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, borderCurve: 'continuous' },
  noticeText: { ...Typography.bodySmall, flex: 1, lineHeight: 18 },
  bookButton: { minHeight: 52, borderRadius: Radius.lg, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  bookText: { ...Typography.button },
});
