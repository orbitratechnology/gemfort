import {
  createFlightBookingLink,
  getFlightPriceCalendar,
  searchFlights,
  type FlightSearchCriteria,
} from '../flights-service';
import { callApi } from '@/lib/api/api-client';

jest.mock('@/lib/api/api-client', () => ({
  callApi: jest.fn(),
}));

const criteria: FlightSearchCriteria = {
  origin: 'CMB',
  destination: 'LHR',
  departureAt: '2026-08-20',
  oneWay: true,
  direct: false,
  currency: 'USD',
};

describe('flight API transport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the Hono routes for every flight operation', async () => {
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
  });
});
