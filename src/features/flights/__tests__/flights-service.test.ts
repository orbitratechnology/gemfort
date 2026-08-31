import {
  createFlightBookingLink,
  getFlightPriceCalendar,
  searchFlights,
  type FlightSearchCriteria,
} from '../flights-service';
import { callApi } from '@/lib/api/api-client';
import { callFunction } from '@/lib/firebase/call-function';

jest.mock('@/lib/api/api-client', () => ({
  callApi: jest.fn(),
  isGemfortApiCanaryEnabled: jest.fn(
    () => process.env.EXPO_PUBLIC_GEMFORT_API_CANARY === 'true',
  ),
}));

jest.mock('@/lib/firebase/call-function', () => ({
  callFunction: jest.fn(),
}));

const criteria: FlightSearchCriteria = {
  origin: 'CMB',
  destination: 'LHR',
  departureAt: '2026-08-20',
  oneWay: true,
  direct: false,
  currency: 'USD',
};

describe('flight API canary routing', () => {
  const previousFlag = process.env.EXPO_PUBLIC_GEMFORT_API_CANARY;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (previousFlag === undefined) {
      delete process.env.EXPO_PUBLIC_GEMFORT_API_CANARY;
    } else {
      process.env.EXPO_PUBLIC_GEMFORT_API_CANARY = previousFlag;
    }
  });

  it('uses the Hono routes only when the canary flag is explicitly enabled', async () => {
    process.env.EXPO_PUBLIC_GEMFORT_API_CANARY = 'true';

    await searchFlights(criteria);
    await getFlightPriceCalendar(criteria);
    await createFlightBookingLink('https://www.aviasales.com/search/CMB2008LHR1');

    expect(callApi).toHaveBeenNthCalledWith(
      1,
      '/v1/flights/search',
      criteria,
      { retryAuthOn401: true },
    );
    expect(callApi).toHaveBeenNthCalledWith(
      2,
      '/v1/flights/calendar',
      criteria,
      { retryAuthOn401: true },
    );
    expect(callApi).toHaveBeenNthCalledWith(
      3,
      '/v1/flights/booking-link',
      { url: 'https://www.aviasales.com/search/CMB2008LHR1' },
      { retryAuthOn401: true },
    );
    expect(callFunction).not.toHaveBeenCalled();
  });

  it('keeps the legacy callable transport as the default rollback path', async () => {
    process.env.EXPO_PUBLIC_GEMFORT_API_CANARY = 'false';

    await searchFlights(criteria);
    await getFlightPriceCalendar(criteria);
    await createFlightBookingLink('https://www.aviasales.com/search/CMB2008LHR1');

    expect(callApi).not.toHaveBeenCalled();
    expect(callFunction).toHaveBeenNthCalledWith(1, 'searchFlights', criteria);
    expect(callFunction).toHaveBeenNthCalledWith(2, 'getFlightPriceCalendar', criteria);
    expect(callFunction).toHaveBeenNthCalledWith(
      3,
      'createFlightBookingLink',
      { url: 'https://www.aviasales.com/search/CMB2008LHR1' },
    );
  });
});
