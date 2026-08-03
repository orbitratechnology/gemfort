export type TravelpayoutsOffer = {
  origin: string; destination: string; originAirport: string; destinationAirport: string;
  price: number; airline: string | null; flightNumber: string | null; departureAt: string | null;
  returnAt: string | null; transfers: number; returnTransfers: number; duration: number | null;
  expiresAt: string | null; foundAt: string | null; bookingUrl: string | null;
};

export function buildBookingUrl(link: string | undefined, marker: string): string | null {
  if (!link) return null;
  try {
    const url = new URL(link, 'https://www.aviasales.com');
    if (url.hostname !== 'www.aviasales.com' && url.hostname !== 'aviasales.com') return null;
    url.searchParams.set('marker', marker);
    return url.toString();
  } catch { return null; }
}

export function normalizeFlightOffer(raw: Record<string, unknown>, marker: string): TravelpayoutsOffer {
  return {
    origin: String(raw.origin ?? ''), destination: String(raw.destination ?? ''),
    originAirport: String(raw.origin_airport ?? raw.origin ?? ''), destinationAirport: String(raw.destination_airport ?? raw.destination ?? ''),
    price: Number(raw.price ?? raw.value ?? 0), airline: typeof raw.airline === 'string' ? raw.airline : null,
    flightNumber: typeof raw.flight_number === 'string' ? raw.flight_number : null,
    departureAt: typeof raw.departure_at === 'string' ? raw.departure_at : null,
    returnAt: typeof raw.return_at === 'string' ? raw.return_at : null,
    transfers: Number(raw.transfers ?? raw.number_of_changes ?? 0), returnTransfers: Number(raw.return_transfers ?? 0),
    duration: typeof raw.duration === 'number' ? raw.duration : null,
    expiresAt: typeof raw.expires_at === 'string' ? raw.expires_at : null,
    foundAt: typeof raw.found_at === 'string' ? raw.found_at : null,
    bookingUrl: buildBookingUrl(typeof raw.link === 'string' ? raw.link : undefined, marker),
  };
}
