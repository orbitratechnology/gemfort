import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBookingUrl, normalizeFlightOffer } from './flights-utils';

test('buildBookingUrl expands a relative Aviasales result link', () => {
  const url = buildBookingUrl('/search/CMB0101BKK0501?foo=bar');
  assert.equal(url, 'https://www.aviasales.com/search/CMB0101BKK0501?foo=bar');
});

test('buildBookingUrl rejects an untrusted booking host', () => {
  assert.equal(buildBookingUrl('https://example.com/search'), null);
});

test('normalizeFlightOffer maps cached fare fields without exposing upstream token data', () => {
  const offer = normalizeFlightOffer({ origin: 'CMB', destination: 'BKK', origin_airport: 'CMB', destination_airport: 'BKK', price: 320, airline: 'UL', flight_number: '402', transfers: 0, duration: 210, link: '/search/CMB' });
  assert.deepEqual(offer, { origin: 'CMB', destination: 'BKK', originAirport: 'CMB', destinationAirport: 'BKK', price: 320, airline: 'UL', flightNumber: '402', departureAt: null, returnAt: null, transfers: 0, returnTransfers: 0, duration: 210, expiresAt: null, foundAt: null, bookingUrl: 'https://www.aviasales.com/search/CMB' });
});
