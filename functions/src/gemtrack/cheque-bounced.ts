import { logger } from 'firebase-functions';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';

import { REGION } from '../config';
import { createNotificationDoc, formatCurrency } from '../notifications/create';
import { db } from '../admin';

/** High-priority alert when a cheque is marked bounced. */
export const onChequeBounced = onDocumentUpdated(
  {
    document: 'gemtrack_cheques/{chequeId}',
    region: REGION,
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    if (before.status === after.status || after.status !== 'bounced') return;

    const ownerUid = after.ownerUid as string;
    const chequeId = event.params.chequeId;
    let counterpartyName = (after.issuedBy as string) ?? 'Unknown';

    if (after.counterpartyContactId) {
      const contact = await db
        .collection('gemtrack_contacts')
        .doc(after.counterpartyContactId as string)
        .get();
      if (contact.exists) {
        counterpartyName = (contact.data()?.displayName as string) ?? counterpartyName;
      }
    }

    const id = await createNotificationDoc({
      recipientUid: ownerUid,
      type: 'cheque_bounced',
      title: 'Cheque bounced',
      message: `Cheque from ${counterpartyName} for ${formatCurrency(after.amount as number, (after.currency as string) ?? 'LKR')} has bounced. Take action.`,
      referenceType: 'cheque',
      referenceId: chequeId,
      priority: 'high',
    });

    logger.info('Cheque bounced notification', { chequeId, ownerUid, created: !!id });
  },
);
