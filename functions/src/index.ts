import './config';

export { dailyGemTrackNotifications } from './gemtrack/daily';
export { syncExchangeRates } from './gemtrack/exchange-rates';
export { onChequeBounced } from './gemtrack/cheque-bounced';

export { onAnnouncementPublished } from './gemnet/announcement';
export {
  onBusinessProfileChanged,
  onVerificationStatusChanged,
} from './gemnet/verification';
export { syncPublicBusinessProjection } from './gemnet/public-businesses';
export { onReportResolved } from './gemnet/report-resolved';
export { onUserAccountAction } from './gemnet/account-action';
export {
  onServiceRequestCreated,
  onServiceRequestUpdated,
} from './gemnet/requests';
export { onListingOfferCreated } from './gemnet/listing-offers';
export { onLikeCreated } from './gemnet/likes';

export { onNotificationCreated } from './notifications/on-created';

// Auth account deletion and phone profile synchronization are handled through gemfortApi;
// retain the Auth trigger as the server-side cleanup safety net.
export { onAuthUserDeleted } from './account/delete-account';

// The consolidated API is the only client-facing callable/API boundary.
export { gemfortApi } from './api/entry';
