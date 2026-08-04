import { callFunction } from '@/lib/firebase/call-function';

export type FlightPlace = {
  type: 'city' | 'airport' | 'country';
  code: string;
  name: string;
  countryCode: string;
  countryName: string;
  cityCode?: string | null;
  cityName?: string | null;
  mainAirportName?: string | null;
};

export type FlightSearchCriteria = {
  origin: string;
  destination: string;
  departureAt: string;
  returnAt?: string;
  oneWay: boolean;
  direct: boolean;
  currency: string;
  limit?: number;
  page?: number;
};

export type FlightOffer = {
  origin: string; destination: string; originAirport: string; destinationAirport: string;
  price: number; airline: string | null; flightNumber: string | null;
  departureAt: string | null; returnAt: string | null; transfers: number; returnTransfers: number;
  duration: number | null; expiresAt: string | null; foundAt: string | null; bookingUrl: string | null;
};

export type FlightCalendarDay = { date: string; price: number; stops: number; actual: boolean };
export type FlightSearchResult = { currency: string; offers: FlightOffer[] };
export type FlightCalendarResult = { currency: string; days: FlightCalendarDay[] };

type AutocompleteResponse = {
  type?: FlightPlace['type']; code?: string; name?: string; country_code?: string; country_name?: string;
  city_code?: string | null; city_name?: string | null; main_airport_name?: string | null;
}[];

export async function autocompletePlaces(term: string): Promise<FlightPlace[]> {
  const query = term.trim();
  if (query.length < 2) return [];
  const url = new URL('https://autocomplete.travelpayouts.com/places2');
  url.searchParams.set('term', query);
  url.searchParams.set('locale', 'en');
  url.searchParams.append('types[]', 'city');
  url.searchParams.append('types[]', 'airport');
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not load airports.');
  const text = await response.text();
  let data: AutocompleteResponse;
  try {
    data = JSON.parse(text) as AutocompleteResponse;
  } catch {
    throw new Error('Airport search returned an unexpected response. Please try again.');
  }
  if (!Array.isArray(data)) throw new Error('Airport search returned an unexpected response. Please try again.');
  return data
    .filter((place) => place.code && place.name && (place.type === 'city' || place.type === 'airport'))
    .slice(0, 8)
    .map((place) => ({
      type: place.type!, code: place.code!, name: place.name!, countryCode: place.country_code ?? '',
      countryName: place.country_name ?? '', cityCode: place.city_code, cityName: place.city_name,
      mainAirportName: place.main_airport_name,
    }));
}

export function searchFlights(criteria: FlightSearchCriteria) {
  return callFunction<FlightSearchResult, FlightSearchCriteria>('searchFlights', criteria);
}

export function getFlightPriceCalendar(criteria: FlightSearchCriteria) {
  return callFunction<FlightCalendarResult, FlightSearchCriteria>('getFlightPriceCalendar', criteria);
}

export function createFlightBookingLink(url: string) {
  return callFunction<{ bookingUrl: string }, { url: string }>('createFlightBookingLink', { url });
}

export function airlineLogoUrl(iata: string | null, width = 132, height = 44) {
  return iata ? `https://pics.avs.io/${width}/${height}/${encodeURIComponent(iata)}.png` : null;
}

export function formatFlightDuration(minutes: number | null) {
  if (!minutes || minutes < 1) return 'Duration unavailable';
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function formatFlightDateTime(value: string | null) {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(date);
}
