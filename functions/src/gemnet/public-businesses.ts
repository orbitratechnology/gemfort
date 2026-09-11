import { onDocumentWritten } from 'firebase-functions/v2/firestore';

import { db } from '../admin';
import { REGION } from '../config';
import { buildPublicBusinessProjection } from './public-business-projection';

/** Keep the public mirror synchronized without exposing the private source document. */
export const syncPublicBusinessProjection = onDocumentWritten(
  {
    document: 'businesses/{businessId}',
    region: REGION,
    retry: true,
  },
  async (event) => {
    const publicRef = db.collection('public_businesses').doc(event.params.businessId);
    const after = event.data?.after;

    if (!after?.exists) {
      await publicRef.delete();
      return;
    }

    const afterData = after.data();
    if (!afterData) {
      await publicRef.delete();
      return;
    }

    const projection = buildPublicBusinessProjection(afterData);
    if (!projection) {
      await publicRef.delete();
      return;
    }

    await publicRef.set(projection);
  },
);
