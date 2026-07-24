import { setGlobalOptions } from 'firebase-functions/v2';

/** Match Firestore region (asia-south1). */
export const REGION = 'asia-south1';

export const AP_PAYMENT_OVERDUE_DAYS = 14;
export const DUE_SOON_DAYS = 3;

// asia-south1 Cloud Run CPU quota is 20 vCPU; default Gen2 1 CPU/instance
// blows that during parallel deploys. gcf_gen1 uses fractional CPU from memory.
setGlobalOptions({
  region: REGION,
  cpu: 'gcf_gen1',
  maxInstances: 10,
});

