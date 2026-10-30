import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { Accent } from '@/components/ui/detail-kit';
import { Icon } from '@/components/ui/icon';
import { FontFamily, Radius, Spacing } from '@/constants/design-tokens';
import {
  airlineLogoUrl,
  formatFlightDuration,
  type FlightOffer,
} from '@/features/flights/flights-service';
import { useAppTheme } from '@/hooks/use-app-theme';

const timeFormatter = new Intl.DateTimeFormat('en', {
  hour: '2-digit',
  minute: '2-digit',
});
const dateFormatter = new Intl.DateTimeFormat('en', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

function parse(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? null : d;
}

function time(d: Date | null) {
  return d ? timeFormatter.format(d) : '--:--';
}

function fare(value: number, currency: string) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Notch diameter for the perforated tear line between ticket and stub. */
const NOTCH = 22;

/**
 * Cached fare drawn as a boarding pass: airline and fare, big IATA codes with
 * times and the route, a perforated tear line, then a stub of flight facts.
 * `notchColor` must match the surface behind the card so the notches read as
 * cut-outs.
 */
export function FlightOfferCard({
  offer,
  currency,
  index,
  reduceMotion,
  onPress,
  notchColor,
}: {
  offer: FlightOffer;
  currency: string;
  index: number;
  reduceMotion: boolean;
  onPress: () => void;
  notchColor?: string;
}) {
  const { colors, isDark } = useAppTheme();
  const logo = airlineLogoUrl(offer.airline, 176, 59);
  const departs = parse(offer.departureAt);
  const arrives =
    departs && offer.duration ? new Date(departs.getTime() + offer.duration * 60_000) : null;
  const returns = parse(offer.returnAt);
  const direct = offer.transfers === 0;
  const stopsLabel = direct ? 'Direct' : `${offer.transfers} stop${offer.transfers === 1 ? '' : 's'}`;
  const stopsAccent = direct ? Accent.emerald : Accent.amber;
  const flightCode = offer.flightNumber ? `${offer.airline ?? ''}${offer.flightNumber}` : null;
  const from = offer.originAirport || offer.origin;
  const to = offer.destinationAirport || offer.destination;
  const ticketBg = colors.surfaceContainerLowest;
  const cutout = notchColor ?? colors.background;

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInUp.delay(index * 45).duration(240)}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${from} to ${to}, ${departs ? dateFormatter.format(departs) : ''} ${time(departs)}, ${stopsLabel}, ${fare(offer.price, currency)}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.ticket,
          {
            backgroundColor: ticketBg,
            boxShadow: isDark
              ? '0 1px 2px rgba(0,0,0,0.4), 0 8px 20px rgba(0,0,0,0.28)'
              : '0 1px 2px rgba(15,23,42,0.06), 0 8px 20px rgba(15,23,42,0.07)',
          },
          pressed && { transform: [{ scale: 0.985 }], opacity: 0.95 },
        ]}
      >
        {/* Main */}
        <View style={styles.main}>
          <View style={styles.headerRow}>
            <View style={[styles.logo, { backgroundColor: colors.surfaceContainerLow }]}>
              {logo ? (
                <Image source={logo} style={styles.logoImage} contentFit="contain" />
              ) : (
                <Icon name="flight" size={18} color={colors.onSurfaceVariant} />
              )}
            </View>
            <View style={styles.airlineCopy}>
              <Text selectable={false} numberOfLines={1} style={[styles.airline, { color: colors.onSurface }]}>
                {flightCode ?? offer.airline ?? 'Flight'}
              </Text>
              <Text selectable={false} style={[styles.caption, { color: colors.textMuted }]}>
                {offer.airline ? `Airline ${offer.airline}` : 'Airline unavailable'}
              </Text>
            </View>
            <View style={styles.priceWrap}>
              <Text selectable={false} style={[styles.price, { color: colors.onSurface }]}>
                {fare(offer.price, currency)}
              </Text>
              <Text selectable={false} style={[styles.caption, { color: colors.textMuted }]}>
                cached fare
              </Text>
            </View>
          </View>

          <View style={styles.route}>
            <View style={styles.endpoint}>
              <Text selectable={false} style={[styles.code, { color: colors.onSurface }]}>
                {from}
              </Text>
              <Text selectable={false} style={[styles.time, { color: colors.onSurfaceVariant }]}>
                {time(departs)}
              </Text>
            </View>

            <View style={styles.path}>
              <Text selectable={false} style={[styles.caption, { color: colors.textMuted }]}>
                {formatFlightDuration(offer.duration)}
              </Text>
              <View style={styles.pathLine}>
                <View style={[styles.pathDot, { borderColor: colors.outline }]} />
                <View style={[styles.dash, { borderColor: colors.outlineVariant }]} />
                <View style={[styles.plane, { backgroundColor: ticketBg }]}>
                  <Icon name="flight" size={18} color={colors.onSurface} />
                </View>
                <View style={[styles.dash, { borderColor: colors.outlineVariant }]} />
                <View style={[styles.pathDot, { borderColor: colors.outline, backgroundColor: colors.outline }]} />
              </View>
              <View style={[styles.stopsChip, { backgroundColor: `${stopsAccent}1A` }]}>
                <Text selectable={false} style={[styles.stopsText, { color: stopsAccent }]}>
                  {stopsLabel}
                </Text>
              </View>
            </View>

            <View style={[styles.endpoint, styles.endpointRight]}>
              <Text selectable={false} style={[styles.code, { color: colors.onSurface }]}>
                {to}
              </Text>
              <Text selectable={false} style={[styles.time, { color: colors.onSurfaceVariant }]}>
                {time(arrives)}
              </Text>
            </View>
          </View>
        </View>

        {/* Perforation */}
        <View style={styles.tear} pointerEvents="none">
          <View style={[styles.notch, styles.notchLeft, { backgroundColor: cutout }]} />
          <View style={[styles.perforation, { borderColor: colors.outlineVariant }]} />
          <View style={[styles.notch, styles.notchRight, { backgroundColor: cutout }]} />
        </View>

        {/* Stub */}
        <View style={styles.stub}>
          {[
            { label: 'Departs', value: departs ? dateFormatter.format(departs) : '—' },
            { label: 'Arrives', value: arrives ? dateFormatter.format(arrives) : '—' },
            { label: 'Trip', value: returns ? `Return ${dateFormatter.format(returns)}` : 'One way' },
          ].map((cell) => (
            <View key={cell.label} style={styles.stubCell}>
              <Text selectable={false} style={[styles.stubLabel, { color: colors.textMuted }]}>
                {cell.label}
              </Text>
              <Text
                selectable={false}
                numberOfLines={1}
                style={[styles.stubValue, { color: colors.onSurface }]}
              >
                {cell.value}
              </Text>
            </View>
          ))}
          <Icon name="chevron-right" size={20} color={colors.outline} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const text = { includeFontPadding: false } as const;

const styles = StyleSheet.create({
  ticket: {
    borderRadius: Radius.xl + 4,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  main: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.lg,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: { width: 32, height: 20 },
  airlineCopy: { flex: 1, minWidth: 0, gap: 1 },
  airline: { ...text, fontFamily: FontFamily.semibold, fontSize: 15, lineHeight: 20 },
  caption: { ...text, fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 16 },
  priceWrap: { alignItems: 'flex-end', gap: 1 },
  price: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 18,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
  },

  route: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  endpoint: { minWidth: 72, gap: 2 },
  endpointRight: { alignItems: 'flex-end' },
  code: {
    ...text,
    fontFamily: FontFamily.semibold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: 0.5,
  },
  time: {
    ...text,
    fontFamily: FontFamily.medium,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  path: { flex: 1, alignItems: 'center', gap: 6 },
  pathLine: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  pathDot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.5 },
  dash: { flex: 1, borderTopWidth: 1.5, borderStyle: 'dashed' },
  plane: {
    paddingHorizontal: 4,
    transform: [{ rotate: '90deg' }],
  },
  stopsChip: {
    height: 20,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
    justifyContent: 'center',
  },
  stopsText: { ...text, fontFamily: FontFamily.semibold, fontSize: 11 },

  tear: { height: NOTCH, flexDirection: 'row', alignItems: 'center' },
  notch: { width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2 },
  notchLeft: { marginLeft: -NOTCH / 2 },
  notchRight: { marginRight: -NOTCH / 2 },
  perforation: {
    flex: 1,
    marginHorizontal: 6,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
  },

  stub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  stubCell: { flex: 1, minWidth: 0, gap: 2 },
  stubLabel: {
    ...text,
    fontFamily: FontFamily.medium,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  stubValue: { ...text, fontFamily: FontFamily.semibold, fontSize: 13, lineHeight: 18 },
});
