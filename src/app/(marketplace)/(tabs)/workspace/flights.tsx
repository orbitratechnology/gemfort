import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    Pressable,
    RefreshControl,
    StyleSheet,
    Switch,
    Text,
    View,
} from "react-native";
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
    LinearTransition,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FlightDetailsSheet } from "@/components/flights/flight-details-sheet";
import { FlightHeroPattern } from "@/components/flights/flight-hero-pattern";
import { FlightOfferCard } from "@/components/flights/flight-offer-card";
import { PlaceField } from "@/components/flights/place-field";
import { Icon } from "@/components/ui/icon";
import { StackHeader } from "@/components/ui/stack-header";
import {
    FontFamily,
    Motion,
    Radius,
    Spacing,
    Typography,
} from "@/constants/design-tokens";
import {
    createFlightBookingLink,
    getFlightPriceCalendar,
    searchFlights,
    type FlightOffer,
    type FlightPlace,
    type FlightSearchCriteria,
} from "@/features/flights/flights-service";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePreferredCurrency } from "@/hooks/use-preferred-currency";
import { useReduceMotion } from "@/hooks/use-reduce-motion";
import { friendlyError } from "@/lib/errors";
import { haptics } from "@/lib/haptics";
import { useToast } from "@/providers/toast-provider";

type SortMode = "price" | "duration" | "stops";
type DatePickerTarget = "departure" | "return" | null;
type FormErrors = Partial<
  Record<"origin" | "destination" | "departure" | "return", string>
>;

function toIsoDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function fromIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function flightOfferKey(offer: FlightOffer): string {
  return [
    offer.bookingUrl ?? "",
    offer.airline ?? "",
    offer.flightNumber ?? "",
    offer.departureAt ?? "",
    offer.returnAt ?? "",
    offer.origin,
    offer.destination,
    offer.price,
  ].join("|");
}

function formatFare(value: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function DateTile({
  label,
  value,
  error,
  onPress,
}: {
  label: string;
  value: string;
  error?: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${format(fromIsoDate(value), "EEEE, MMMM d")}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.dateTile,
        {
          backgroundColor: colors.surfaceContainerLow,
          borderColor: error ? colors.error : "transparent",
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text
        selectable={false}
        style={[
          styles.tileLabel,
          { color: error ? colors.error : colors.textMuted },
        ]}
      >
        {label}
      </Text>
      <View style={styles.dateValueRow}>
        <Text
          selectable={false}
          style={[styles.tileValue, { color: colors.onSurfaceVariant }]}
        >
          {format(fromIsoDate(value), "MMM d")}
        </Text>
        <Icon name="calendar-today" size={15} color={colors.primary} />
      </View>
    </Pressable>
  );
}

function LoadingFlights() {
  const { colors } = useAppTheme();
  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.loadingCard}>
      <ActivityIndicator color={colors.primary} />
      <View style={{ gap: 3 }}>
        <Text
          selectable={false}
          style={[styles.loadingTitle, { color: colors.onSurface }]}
        >
          Searching cached fares
        </Text>
        <Text
          selectable={false}
          style={[styles.loadingCopy, { color: colors.textMuted }]}
        >
          Comparing recent Aviasales price insights…
        </Text>
      </View>
    </Animated.View>
  );
}

export default function FlightsScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const toast = useToast();
  const preferredCurrency = usePreferredCurrency();
  const today = useMemo(() => new Date(), []);

  const [origin, setOrigin] = useState<FlightPlace | null>(null);
  const [destination, setDestination] = useState<FlightPlace | null>(null);
  const [departureAt, setDepartureAt] = useState(() => toIsoDate(today));
  const [returnAt, setReturnAt] = useState(() => toIsoDate(addDays(today, 7)));
  const [oneWay, setOneWay] = useState(true);
  const [direct, setDirect] = useState(false);
  const [sort, setSort] = useState<SortMode>("price");
  const [datePicker, setDatePicker] = useState<DatePickerTarget>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [criteria, setCriteria] = useState<FlightSearchCriteria | null>(null);
  const [selected, setSelected] = useState<FlightOffer | null>(null);
  const [booking, setBooking] = useState(false);
  const swapRotation = useSharedValue(0);

  const search = useQuery({
    queryKey: ["flight-search", criteria],
    queryFn: () => searchFlights(criteria!),
    enabled: !!criteria,
    staleTime: 60_000,
    retry: 1,
  });
  const calendar = useQuery({
    queryKey: ["flight-calendar", criteria],
    queryFn: () => getFlightPriceCalendar(criteria!),
    enabled: !!criteria,
    staleTime: 60_000,
    retry: 1,
  });

  const offers = useMemo(
    () =>
      [...(search.data?.offers ?? [])].sort((a, b) => {
        if (sort === "duration") {
          return (
            (a.duration ?? Number.MAX_SAFE_INTEGER) -
            (b.duration ?? Number.MAX_SAFE_INTEGER)
          );
        }
        if (sort === "stops") {
          return a.transfers - b.transfers || a.price - b.price;
        }
        return a.price - b.price;
      }),
    [search.data, sort],
  );

  const swapStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${swapRotation.value}deg` }],
  }));

  const resultsBackground = isDark ? "#111214" : "#F6F7FB";
  const searchError = search.error
    ? friendlyError(search.error, "Could not load flight fares.")
    : null;
  const currency =
    search.data?.currency ??
    (preferredCurrency === "RMB" ? "CNY" : preferredCurrency);

  function selectOrigin(place: FlightPlace | null) {
    setOrigin(place);
    setErrors((current) => ({ ...current, origin: undefined }));
  }

  function selectDestination(place: FlightPlace | null) {
    setDestination(place);
    setErrors((current) => ({ ...current, destination: undefined }));
  }

  function swapPlaces() {
    haptics.selection();
    setOrigin(destination);
    setDestination(origin);
    setErrors((current) => ({
      ...current,
      origin: undefined,
      destination: undefined,
    }));
    if (!reduceMotion) {
      swapRotation.value = withSpring(swapRotation.value + 180, Motion.spring);
    }
  }

  function validate() {
    const next: FormErrors = {};
    const todayIso = toIsoDate(new Date());
    if (!origin?.code) next.origin = "Choose where you are flying from.";
    if (!destination?.code)
      next.destination = "Choose where you are flying to.";
    if (origin?.code && destination?.code && origin.code === destination.code) {
      next.destination = "Origin and destination must be different.";
    }
    if (departureAt < todayIso)
      next.departure = "Departure cannot be in the past.";
    if (!oneWay && returnAt < departureAt) {
      next.return = "Return must be on or after departure.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      haptics.error();
      toast.error(Object.values(next)[0] ?? "Check your flight search.");
      return false;
    }
    return true;
  }

  function submit() {
    if (!validate() || !origin || !destination) return;
    haptics.commit();
    setCriteria({
      origin: origin.code,
      destination: destination.code,
      departureAt,
      ...(oneWay ? {} : { returnAt }),
      oneWay,
      direct,
      currency: preferredCurrency === "RMB" ? "CNY" : preferredCurrency,
      limit: 20,
      page: 1,
    });
  }

  function pickDate(
    target: Exclude<DatePickerTarget, null>,
    selectedDate: Date,
  ) {
    const value = toIsoDate(selectedDate);
    if (target === "departure") {
      setDepartureAt(value);
      if (!oneWay && returnAt < value) setReturnAt(value);
      setErrors((current) => ({
        ...current,
        departure: undefined,
        return: undefined,
      }));
    } else {
      setReturnAt(value);
      setErrors((current) => ({ ...current, return: undefined }));
    }
  }

  async function openOffer(offer: FlightOffer) {
    if (!offer.bookingUrl || booking) {
      if (!offer.bookingUrl)
        toast.error("A booking link is unavailable for this cached fare.");
      return;
    }
    setBooking(true);
    try {
      const result = await createFlightBookingLink(offer.bookingUrl);
      await WebBrowser.openBrowserAsync(result.bookingUrl);
    } catch (error) {
      toast.error(
        friendlyError(error, "Could not create your affiliate booking link."),
      );
    } finally {
      setBooking(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Animated.ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          criteria ? (
            <RefreshControl
              refreshing={search.isRefetching || calendar.isRefetching}
              tintColor="#FFFFFF"
              onRefresh={() => {
                void search.refetch();
                void calendar.refetch();
              }}
            />
          ) : undefined
        }
      >
    <View style={[styles.hero, { paddingTop: insets.top }]}>
      <Image
        source={require("@/assets/images/trips-icon.png")}
        style={styles.heroFlightImage}
        contentFit="contain"
        pointerEvents="none"
        accessibilityElementsHidden
        accessibilityIgnoresInvertColors
      />
      <FlightHeroPattern />
          <Animated.View
            entering={reduceMotion ? undefined : FadeInDown.duration(240)}
          >
            <StackHeader
              title="Flights"
              tintColor="#FFFFFF"
              right={
                <View style={styles.headerGlyph}>
                  <Icon name="flight" size={19} color="#FFFFFF" />
                </View>
              }
            />
          </Animated.View>

          <Animated.View
            entering={
              reduceMotion ? undefined : FadeInDown.delay(60).duration(260)
            }
            style={styles.heroCopy}
          >
            <View style={styles.dateLine}>
              <Icon name="calendar-today" size={14} color="#9EA0A7" />
              <Text selectable={false} style={styles.dateLineText}>
                {format(new Date(), "EEEE, MMMM d")}
              </Text>
            </View>
            <Text selectable={false} style={styles.heroTitle}>
              Discover a new place.
            </Text>
            <Text selectable={false} style={styles.heroSubtitle}>
              Explore, journey, discover, adventure.
            </Text>
          </Animated.View>
        </View>

        <Animated.View
          entering={
            reduceMotion ? undefined : FadeInUp.delay(110).duration(280)
          }
          layout={reduceMotion ? undefined : LinearTransition.duration(180)}
          style={[
            styles.searchCard,
            {
              backgroundColor: colors.surfaceContainerLowest,
              boxShadow: isDark
                ? "0 18px 42px rgba(0,0,0,0.38)"
                : "0 18px 42px rgba(0,0,0,0.14)",
            },
          ]}
        >
          <View style={styles.searchTopRow}>
            <View
              style={[
                styles.tripSegment,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              {[
                { label: "One-way", value: true },
                { label: "Round trip", value: false },
              ].map((option) => {
                const active = oneWay === option.value;
                return (
                  <Pressable
                    key={option.label}
                    onPress={haptics.wrap("selection", () => {
                      setOneWay(option.value);
                      setErrors((current) => ({
                        ...current,
                        return: undefined,
                      }));
                    })}
                    style={[
                      styles.segmentButton,
                      active && {
                        backgroundColor: colors.surfaceContainerHighest,
                      },
                    ]}
                  >
                    <Text
                      selectable={false}
                      style={[
                        styles.segmentText,
                        {
                          color: active ? colors.onSurface : colors.textMuted,
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.routeFields}>
            <PlaceField
              label="From"
              value={origin}
              error={!!errors.origin}
              onSelect={selectOrigin}
            />
            <PlaceField
              label="To"
              value={destination}
              error={!!errors.destination}
              onSelect={selectDestination}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Swap origin and destination"
              onPress={swapPlaces}
              style={[styles.swapButton, { backgroundColor: colors.primary }]}
            >
              <Animated.View style={swapStyle}>
                <Icon name="swap-horiz" size={17} color={colors.onPrimary} />
              </Animated.View>
            </Pressable>
          </View>

          <View style={styles.dateFields}>
            <DateTile
              label="Departure"
              value={departureAt}
              error={!!errors.departure}
              onPress={() => setDatePicker("departure")}
            />
            {!oneWay ? (
              <DateTile
                label="Return"
                value={returnAt}
                error={!!errors.return}
                onPress={() => setDatePicker("return")}
              />
            ) : (
              <View
                style={[
                  styles.oneWayTile,
                  { backgroundColor: colors.surfaceContainerLow },
                ]}
              >
                <Icon name="arrow-forward" size={18} color={colors.primary} />
                <Text
                  selectable={false}
                  style={[
                    styles.oneWayText,
                    { color: colors.onSurfaceVariant },
                  ]}
                >
                  No return
                </Text>
              </View>
            )}
          </View>

          <View style={styles.directRow}>
            <View style={styles.directCopy}>
              <Icon name="flight" size={17} color={colors.primary} />
              <Text
                selectable={false}
                style={[styles.directText, { color: colors.onSurfaceVariant }]}
              >
                Non-stop only
              </Text>
            </View>
            <Switch value={direct} onValueChange={setDirect} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search flights"
            onPress={submit}
            style={({ pressed }) => [
              styles.searchButton,
              { backgroundColor: colors.primary },
              pressed && { transform: [{ scale: 0.985 }], opacity: 0.94 },
            ]}
          >
            <Icon name="search" size={19} color={colors.onPrimary} />
            <Text
              selectable={false}
              style={[styles.searchButtonText, { color: colors.onPrimary }]}
            >
              Search flights
            </Text>
          </Pressable>
        </Animated.View>

        <Animated.View
          layout={reduceMotion ? undefined : LinearTransition.duration(220)}
          style={[
            styles.resultsSurface,
            {
              backgroundColor: resultsBackground,
              paddingBottom: insets.bottom + 96,
            },
          ]}
        >
          {calendar.data?.days.length ? (
            <Animated.View
              entering={reduceMotion ? undefined : FadeInUp.duration(220)}
              style={styles.calendarSection}
            >
              <View style={styles.sectionHeader}>
                <Text
                  selectable={false}
                  style={[styles.sectionTitle, { color: colors.onSurface }]}
                >
                  Flexible dates
                </Text>
                <Text
                  selectable={false}
                  style={[styles.sectionHint, { color: colors.textMuted }]}
                >
                  7-day view
                </Text>
              </View>
              <Animated.ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.calendarRow}
              >
                {calendar.data.days.slice(0, 7).map((day) => (
                  <View
                    key={day.date}
                    style={[
                      styles.dayCard,
                      { backgroundColor: colors.surfaceContainerLowest },
                    ]}
                  >
                    <Text
                      selectable={false}
                      style={[styles.dayDate, { color: colors.textMuted }]}
                    >
                      {format(fromIsoDate(day.date), "EEE, MMM d")}
                    </Text>
                    <Text
                      selectable={false}
                      style={[styles.dayPrice, { color: colors.onSurface }]}
                    >
                      {formatFare(day.price, calendar.data.currency)}
                    </Text>
                    <Text
                      selectable={false}
                      style={[
                        styles.dayStops,
                        { color: colors.onSurfaceVariant },
                      ]}
                    >
                      {day.stops === 0
                        ? "Non-stop"
                        : `${day.stops} stop${day.stops > 1 ? "s" : ""}`}
                    </Text>
                  </View>
                ))}
              </Animated.ScrollView>
            </Animated.View>
          ) : null}

          <View style={styles.resultsHeader}>
            <View>
              <Text
                selectable={false}
                style={[styles.resultsTitle, { color: colors.onSurface }]}
              >
                {criteria ? "Result flights" : "Explore flights"}
              </Text>
              <Text
                selectable={false}
                style={[styles.resultsSubtitle, { color: colors.textMuted }]}
              >
                {criteria
                  ? `${offers.length} cached fare${offers.length === 1 ? "" : "s"}`
                  : "Search a route to reveal recent fare insights"}
              </Text>
            </View>
            {offers.length > 1 ? (
              <View style={styles.sortRow}>
                {(["price", "duration", "stops"] as const).map((option) => (
                  <Pressable
                    key={option}
                    onPress={haptics.wrap("selection", () => setSort(option))}
                    style={[
                      styles.sortChip,
                      {
                        backgroundColor:
                          sort === option
                            ? colors.primary
                            : colors.surfaceContainerLowest,
                      },
                    ]}
                  >
                    <Text
                      selectable={false}
                      style={[
                        styles.sortText,
                        {
                          color:
                            sort === option
                              ? colors.onPrimary
                              : colors.onSurfaceVariant,
                        },
                      ]}
                    >
                      {option === "price"
                        ? "Price"
                        : option === "duration"
                          ? "Fast"
                          : "Stops"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          {criteria ? (
            <View
              style={[
                styles.disclaimer,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <Icon
                name="info-outline"
                size={17}
                color={colors.onSurfaceVariant}
              />
              <Text
                selectable={false}
                style={[
                  styles.disclaimerText,
                  { color: colors.onSurfaceVariant },
                ]}
              >
                Prices are cached insights, not live availability. Confirm the
                final fare on Aviasales.
              </Text>
            </View>
          ) : null}

          {search.isLoading ? <LoadingFlights /> : null}

          {searchError ? (
            <Animated.View
              entering={reduceMotion ? undefined : FadeInUp.duration(200)}
              style={[
                styles.stateCard,
                { backgroundColor: colors.errorContainer },
              ]}
            >
              <View style={styles.stateIcon}>
                <Icon name="cloud-off" size={27} color={colors.error} />
              </View>
              <Text
                selectable={false}
                style={[styles.stateTitle, { color: colors.onErrorContainer }]}
              >
                Flight search unavailable
              </Text>
              <Text
                selectable={false}
                style={[styles.stateCopy, { color: colors.onErrorContainer }]}
              >
                {searchError}
              </Text>
              <Pressable
                onPress={() => void search.refetch()}
                style={[styles.retryButton, { borderColor: colors.error }]}
              >
                <Text
                  selectable={false}
                  style={[styles.retryText, { color: colors.error }]}
                >
                  Try again
                </Text>
              </Pressable>
            </Animated.View>
          ) : null}

          {!criteria ? (
            <Animated.View
              entering={
                reduceMotion ? undefined : FadeInUp.delay(170).duration(260)
              }
              style={styles.emptyState}
            >
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: colors.surfaceContainerLowest },
                ]}
              >
                <Icon name="travel-explore" size={32} color={colors.primary} />
              </View>
              <Text
                selectable={false}
                style={[styles.emptyTitle, { color: colors.onSurface }]}
              >
                Your next route starts here
              </Text>
              <Text
                selectable={false}
                style={[styles.emptyCopy, { color: colors.textMuted }]}
              >
                Choose two places and travel dates to explore the latest cached
                flight prices.
              </Text>
            </Animated.View>
          ) : null}

          {criteria &&
          !search.isLoading &&
          !searchError &&
          offers.length === 0 ? (
            <Animated.View
              entering={reduceMotion ? undefined : FadeInUp.duration(220)}
              style={styles.emptyState}
            >
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: colors.surfaceContainerLowest },
                ]}
              >
                <Icon name="flight" size={30} color={colors.primary} />
              </View>
              <Text
                selectable={false}
                style={[styles.emptyTitle, { color: colors.onSurface }]}
              >
                No cached fares found
              </Text>
              <Text
                selectable={false}
                style={[styles.emptyCopy, { color: colors.textMuted }]}
              >
                Try nearby dates, another airport, or turn off the non-stop
                filter.
              </Text>
            </Animated.View>
          ) : null}

          {offers.length > 0 ? (
            <View style={styles.offerList}>
              {offers.map((offer, index) => (
                <FlightOfferCard
                  key={flightOfferKey(offer)}
                  offer={offer}
                  currency={currency}
                  index={index}
                  reduceMotion={reduceMotion}
                  onPress={() => {
                    haptics.sheetOpen();
                    setSelected(offer);
                  }}
                />
              ))}
            </View>
          ) : null}
        </Animated.View>
      </Animated.ScrollView>

      {datePicker ? (
        <DateTimePicker
          value={fromIsoDate(
            datePicker === "departure" ? departureAt : returnAt,
          )}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          presentation="dialog"
          minimumDate={
            datePicker === "return"
              ? fromIsoDate(departureAt)
              : new Date(new Date().setHours(0, 0, 0, 0))
          }
          onValueChange={(_event, selectedDate) => {
            if (selectedDate) pickDate(datePicker, selectedDate);
            setDatePicker(null);
          }}
          onDismiss={() => setDatePicker(null)}
        />
      ) : null}

      <FlightDetailsSheet
        offer={selected}
        currency={currency}
        booking={booking}
        onClose={() => setSelected(null)}
        onBook={(offer) => void openOffer(offer)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080808" },
  scroll: { flex: 1, backgroundColor: "#080808" },
  hero: {
    backgroundColor: "#080808",
    paddingBottom: 30,
    overflow: "hidden",
    zIndex: 1,
  },
  heroFlightImage: {
    position: "absolute",
    width: 300,
    height: 220,
    right: -96,
    bottom: -38,
    opacity: 0.26,
    transform: [{ rotate: "-8deg" }],
  },
  headerGlyph: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.sm,
    gap: 4,
  },
  dateLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  dateLineText: { ...Typography.caption, color: "#A4A5AA" },
  heroTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: 27,
    lineHeight: 34,
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  heroSubtitle: { ...Typography.bodyMd, color: "#A4A5AA" },
  searchCard: {
    marginHorizontal: Spacing.containerMargin,
    marginTop: -8,
    padding: Spacing.md,
    gap: Spacing.md,
    borderRadius: 24,
    borderCurve: "continuous",
    position: "relative",
    zIndex: 3,
  },
  searchTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  tripSegment: { flexDirection: "row", padding: 3, borderRadius: Radius.lg },
  segmentButton: {
    paddingHorizontal: 12,
    minHeight: 32,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: { ...Typography.caption, fontFamily: FontFamily.semibold },
  cacheBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: Radius.md,
    minHeight: 32,
    paddingHorizontal: 9,
  },
  cacheText: { ...Typography.caption, fontFamily: FontFamily.semibold },
  routeFields: { flexDirection: "row", gap: 6, position: "relative" },
  swapButton: {
    position: "absolute",
    zIndex: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    left: "50%",
    top: 15,
    marginLeft: -14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  dateFields: { flexDirection: "row", gap: 6 },
  dateTile: {
    flex: 1,
    minHeight: 58,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    borderWidth: 1,
    justifyContent: "center",
    gap: 3,
  },
  tileLabel: { ...Typography.caption, fontSize: 9 },
  tileValue: { ...Typography.bodySmall, fontFamily: FontFamily.semibold },
  dateValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
  },
  oneWayTile: {
    flex: 1,
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },
  oneWayText: { ...Typography.bodySmall, fontFamily: FontFamily.medium },
  directRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 38,
  },
  directCopy: { flexDirection: "row", alignItems: "center", gap: 7 },
  directText: { ...Typography.bodySmall, fontFamily: FontFamily.medium },
  searchButton: {
    minHeight: 50,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  searchButtonText: { ...Typography.button },
  resultsSurface: {
    marginTop: -42,
    minHeight: 520,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderCurve: "continuous",
    paddingTop: 68,
    paddingHorizontal: Spacing.containerMargin,
    gap: Spacing.lg,
    position: "relative",
    zIndex: 1,
  },
  calendarSection: { gap: Spacing.sm },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { ...Typography.bodyLg, fontFamily: FontFamily.semibold },
  sectionHint: { ...Typography.caption },
  calendarRow: { gap: Spacing.sm, paddingRight: Spacing.containerMargin },
  dayCard: {
    width: 118,
    padding: Spacing.md,
    gap: 4,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },
  dayDate: { ...Typography.caption },
  dayPrice: {
    ...Typography.bodySmall,
    fontFamily: FontFamily.bold,
    fontVariant: ["tabular-nums"],
  },
  dayStops: { ...Typography.caption, fontSize: 9 },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  resultsTitle: {
    ...Typography.headlineSmMobile,
    fontFamily: FontFamily.semibold,
  },
  resultsSubtitle: { ...Typography.caption, marginTop: 2 },
  sortRow: { flexDirection: "row", gap: 4 },
  sortChip: {
    minHeight: 30,
    paddingHorizontal: 9,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  sortText: {
    ...Typography.caption,
    fontFamily: FontFamily.semibold,
    fontSize: 9,
  },
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: "continuous",
  },
  disclaimerText: { ...Typography.bodySmall, lineHeight: 18, flex: 1 },
  loadingCard: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: Spacing.md,
  },
  loadingTitle: { ...Typography.bodyMd, fontFamily: FontFamily.semibold },
  loadingCopy: { ...Typography.caption },
  stateCard: {
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.xl,
    borderRadius: 24,
    borderCurve: "continuous",
  },
  stateIcon: { minHeight: 36, justifyContent: "center" },
  stateTitle: {
    ...Typography.bodyLg,
    fontFamily: FontFamily.semibold,
    textAlign: "center",
  },
  stateCopy: { ...Typography.bodySmall, textAlign: "center", lineHeight: 18 },
  retryButton: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
    marginTop: 4,
  },
  retryText: { ...Typography.caption, fontFamily: FontFamily.semibold },
  emptyState: {
    minHeight: 230,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    ...Typography.bodyLg,
    fontFamily: FontFamily.semibold,
    textAlign: "center",
  },
  emptyCopy: {
    ...Typography.bodySmall,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 280,
  },
  offerList: { gap: Spacing.md },
});
