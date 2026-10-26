import './config';

export { onChequeBounced } from './gemtrack/cheque-bounced';
export { dailyGemTrackNotifications } from './gemtrack/daily';
export { syncExchangeRates } from './gemtrack/exchange-rates';

export { onUserAccountAction } from './gemnet/account-action';
export { onAnnouncementPublished } from './gemnet/announcement';
export { onLikeCreated } from './gemnet/likes';
export { onListingOfferCreated } from './gemnet/listing-offers';
export { syncPublicBusinessProjection } from './gemnet/public-businesses';
export { onReportResolved } from './gemnet/report-resolved';
export {
    onServiceRequestCreated,
    onServiceRequestUpdated
} from './gemnet/requests';
export {
    onBusinessProfileChanged,
    onVerificationStatusChanged
} from './gemnet/verification';

export { onNotificationCreated } from './notifications/on-created';

// Auth account deletion is handled through gemfortApi;
// retain the Auth trigger as the server-side cleanup safety net.
export { onAuthUserDeleted } from './account/delete-account';

// The consolidated API is the only client-facing callable/API boundary.
export { gemfortApi } from './api/entry';
