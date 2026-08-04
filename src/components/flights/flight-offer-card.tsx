import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { Icon } from '@/components/ui/icon';
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design-tokens';
import {
  airlineLogoUrl,
  formatFlightDuration,
  type FlightOffer,
} from '@/features/flights/flights-service';
import { useAppTheme } from '@/hooks/use-app-theme';

function time(value: string | null) {
  if (!value) return '--:--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return '--:--';
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function fare(value: number, currency: string) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function FlightOfferCard({
  offer,
  currency,
  index,
  reduceMotion,
  onPress,
}: {
  offer: FlightOffer;
  currency: string;
  index: number;
  reduceMotion: boolean;
  onPress: () => void;
}) {
  const { colors, isDark } = useAppTheme();
  const logo = airlineLogoUrl(offer.airline, 176, 59);

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInUp.delay(index * 45).duration(240)}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${offer.originAirport} to ${offer.destinationAirport}, ${fare(offer.price, currency)}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderColor: colors.outlineVariant,
            boxShadow: isDark
              ? '0 10px 28px rgba(0,0,0,0.26)'
              : '0 10px 30px rgba(27,39,69,0.07)',
          },
          pressed && { transform: [{ scale: 0.985 }], opacity: 0.94 },
        ]}
      >
        <View style={styles.airlineRow}>
          <View
            style={[
              styles.logo,
              { backgroundColor: colors.surfaceContainerLow },
            ]}
          >
            {logo ? (
              <Image source={logo} style={styles.logoImage} contentFit="contain" />
            ) : (
              <Icon name="flight" size={21} color={colors.primary} />
            )}
          </View>
          <View style={styles.airlineCopy}>
            <Text
              selectable={false}
              numberOfLines={1}
              style={[styles.airline, { color: colors.onSurface }]}
            >
              {offer.airline ? `Airline ${offer.airline}` : 'Airline'}
            </Text>
            <Text selectable={false} style={[styles.flightNo, { color: colors.textMuted }]}>
              {offer.flightNumber ? `Flight ${offer.flightNumber}` : 'Flight number unavailable'}
            </Text>
          </View>
          <View style={styles.priceWrap}>
            <Text selectable={false} style={[styles.price, { color: colors.primary }]}>
              {fare(offer.price, currency)}
            </Text>
            <Text selectable={false} style={[styles.cached, { color: colors.textMuted }]}>
              cached fare
            </Text>
          </View>
        </View>

        <View style={styles.timeline}>
          <View style={styles.endpoint}>
            <Text selectable={false} style={[styles.time, { color: colors.textMuted }]}>
              {time(offer.departureAt)}
            </Text>
            <Text selectable={false} style={[styles.code, { color: colors.onSurface }]}>
              {offer.originAirport || offer.origin}
            </Text>
            <Text selectable={false} style={[styles.city, { color: colors.onSurfaceVariant }]}>
              Departure
            </Text>
          </View>

          <View style={styles.routeLineWrap}>
            <View style={[styles.routeLine, { borderColor: colors.outlineVariant }]} />
            <View style={[styles.planeDot, { backgroundColor: colors.primary }]}>
              <Icon name="flight" size={14} color={colors.onPrimary} />
            </View>
            <Text selectable={false} style={[styles.duration, { color: colors.textMuted }]}>
              {formatFlightDuration(offer.duration)}
            </Text>
          </View>

          <View style={[styles.endpoint, styles.endpointRight]}>
            <Text selectable={false} style={[styles.time, { color: colors.textMuted }]}>
              {offer.duration && offer.departureAt
                ? time(
                    new Date(
                      new Date(offer.departureAt).getTime() + offer.duration * 60_000,
                    ).toISOString(),
                  )
                : '--:--'}
            </Text>
            <Text selectable={false} style={[styles.code, { color: colors.onSurface }]}>
              {offer.destinationAirport || offer.destination}
            </Text>
            <Text selectable={false} style={[styles.city, { color: colors.onSurfaceVariant }]}>
              Arrival
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.metaStrip,
            { backgroundColor: colors.surfaceContainerLow },
          ]}
        >
          <View style={styles.metaCell}>
            <Text selectable={false} style={[styles.metaLabel, { color: colors.textMuted }]}>Airline</Text>
            <Text selectable={false} style={[styles.metaValue, { color: colors.onSurfaceVariant }]}>
              {offer.airline ?? '—'}
            </Text>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: colors.outlineVariant }]} />
          <View style={styles.metaCell}>
            <Text selectable={false} style={[styles.metaLabel, { color: colors.textMuted }]}>Flight</Text>
            <Text selectable={false} style={[styles.metaValue, { color: colors.onSurfaceVariant }]}>
              {offer.flightNumber ?? '—'}
            </Text>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: colors.outlineVariant }]} />
          <View style={styles.metaCell}>
            <Text selectable={false} style={[styles.metaLabel, { color: colors.textMuted }]}>Stops</Text>
            <Text selectable={false} style={[styles.metaValue, { color: colors.onSurfaceVariant }]}>
              {offer.transfers === 0 ? 'Direct' : String(offer.transfers)}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  airlineRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: { width: 38, height: 24 },
  airlineCopy: { flex: 1, minWidth: 0, gap: 1 },
  airline: { ...Typography.bodyMd, fontFamily: FontFamily.semibold },
  flightNo: { ...Typography.caption },
  priceWrap: { alignItems: 'flex-end', gap: 1 },
  price: {
    ...Typography.bodyMd,
    fontFamily: FontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
  cached: { ...Typography.caption, fontSize: 9 },
  timeline: { flexDirection: 'row', alignItems: 'flex-start' },
  endpoint: { width: 74, gap: 1 },
  endpointRight: { alignItems: 'flex-end' },
  time: { ...Typography.caption, fontVariant: ['tabular-nums'] },
  code: { fontFamily: FontFamily.bold, fontSize: 18, lineHeight: 23 },
  city: { ...Typography.caption },
  routeLineWrap: {
    flex: 1,
    height: 58,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 27,
  },
  routeLine: { width: '100%', borderTopWidth: 1, borderStyle: 'dashed' },
  planeDot: {
    position: 'absolute',
    top: 16,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '90deg' }],
  },
  duration: { ...Typography.caption, position: 'absolute', top: 43 },
  metaStrip: {
    flexDirection: 'row',
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    paddingVertical: 10,
  },
  metaCell: { flex: 1, alignItems: 'center', gap: 2 },
  metaLabel: { ...Typography.caption, fontSize: 9 },
  metaValue: { ...Typography.caption, fontFamily: FontFamily.semibold },
  metaDivider: { width: StyleSheet.hairlineWidth },
});
