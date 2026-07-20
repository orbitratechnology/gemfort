/**
 * Firestore event webhooks.
 *
 * These endpoints replicate the logic of the original Cloud Functions Firestore
 * triggers. They are called by Google Cloud Eventarc (or another eventing
 * system) and are authenticated via a shared WEBHOOK_SECRET.
 *
 * Each handler receives the document data in the request body. The payload
 * shape follows the Eventarc CloudEvents format but we accept a simpler custom
 * JSON format to keep the implementation self-contained and easy to test.
 *
 * Payload shape for "updated" events:
 *   { documentId: string, before: object, after: object }
 *
 * Payload shape for "created" events:
 *   { documentId: string, data: object }
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { requireWebhookSecret } from '../../middleware/webhook-guard.js';
import { db, messaging } from '../../firebase.js';
import { logger } from '../../lib/logger.js';
import { createNotificationDoc, createNotificationsBatch } from '../../services/notifications/create.js';
import { sendPushForNotification } from '../../services/notifications/push.js';
import type { NotificationType, StoredNotification } from '../../services/notifications/types.js';

const webhooks = new Hono();

webhooks.use('*', requireWebhookSecret);

// ─── Shared schemas ───────────────────────────────────────────────────────────

const createdPayload = z.object({
  documentId: z.string(),
  data: z.record(z.unknown()),
});

const updatedPayload = z.object({
  documentId: z.string(),
  before: z.record(z.unknown()),
  after: z.record(z.unknown()),
});

// ─── /webhooks/firestore/announcement-published ───────────────────────────────

webhooks.post(
  '/announcement-published',
  zValidator('json', createdPayload),
  async (c) => {
    const { documentId, data } = c.req.valid('json');
    if (!data.isVisible) return c.json({ ok: true, skipped: true });

    const type =
      data.type === 'industry_news' ? 'announcement_industry_news' : 'announcement_platform';

    const usersSnap = await db.collection('users').where('isActive', '==', true).get();
    const inputs = usersSnap.docs
      .filter((d) => d.data().isSuspended !== true)
      .map((d) => ({
        recipientUid: d.id,
        type: type as 'announcement_platform' | 'announcement_industry_news',
        title: data.title as string,
        message: ((data.content as string) ?? '').slice(0, 200) || 'New announcement from GemFort.',
        referenceType: 'announcement',
        referenceId: documentId,
      }));

    const created = await createNotificationsBatch(inputs);
    logger.info('Announcement notifications sent', { documentId, created });
    return c.json({ ok: true, created });
  },
);

// ─── /webhooks/firestore/verification-status-changed ─────────────────────────

const STATUS_MESSAGES: Record<string, { type: string; title: string; message: string }> = {
  approved: {
    type: 'verification_approved',
    title: 'Verification approved',
    message: 'Your business verification has been approved. You can now access verified features.',
  },
  rejected: {
    type: 'verification_rejected',
    title: 'Verification rejected',
    message: 'Your verification application was not approved. Check your application for details.',
  },
  info_requested: {
    type: 'verification_info_requested',
    title: 'More information needed',
    message: 'We need additional information to complete your verification review.',
  },
};

webhooks.post(
  '/verification-status-changed',
  zValidator('json', updatedPayload),
  async (c) => {
    const { documentId, before, after } = c.req.valid('json');
    if (before.status === after.status) return c.json({ ok: true, skipped: true });

    const mapping = STATUS_MESSAGES[after.status as string];
    if (!mapping) return c.json({ ok: true, skipped: true });

    await createNotificationDoc({
      recipientUid: after.applicantUid as string,
      type: mapping.type as 'verification_approved',
      title: mapping.title,
      message: mapping.message,
      referenceType: 'verification',
      referenceId: documentId,
    });

    logger.info('Verification notification', { documentId, status: after.status });
    return c.json({ ok: true });
  },
);

// ─── /webhooks/firestore/report-resolved ────────────────────────────────────

webhooks.post(
  '/report-resolved',
  zValidator('json', updatedPayload),
  async (c) => {
    const { documentId, before, after } = c.req.valid('json');
    if (before.status === after.status) return c.json({ ok: true, skipped: true });
    if (after.status !== 'resolved' && after.status !== 'dismissed') {
      return c.json({ ok: true, skipped: true });
    }

    const type = after.status === 'resolved' ? 'report_resolved' : 'report_dismissed';
    const title = after.status === 'resolved' ? 'Report resolved' : 'Report dismissed';
    const message =
      after.status === 'resolved'
        ? 'Your report has been reviewed and resolved.'
        : 'Your report has been reviewed and dismissed.';

    await createNotificationDoc({
      recipientUid: after.reporterUid as string,
      type,
      title,
      message,
      referenceType: 'report',
      referenceId: documentId,
    });

    logger.info('Report resolved notification', { documentId, status: after.status });
    return c.json({ ok: true });
  },
);

// ─── /webhooks/firestore/user-account-action ────────────────────────────────

webhooks.post(
  '/user-account-action',
  zValidator('json', updatedPayload),
  async (c) => {
    const { documentId: userId, before, after } = c.req.valid('json');

    if (before.isSuspended !== after.isSuspended) {
      if (after.isSuspended === true) {
        await createNotificationDoc({
          recipientUid: userId,
          type: 'account_suspended',
          title: 'Account suspended',
          message:
            (after.suspendedReason as string | undefined) ||
            'Your account has been suspended. Contact GemFort support for help.',
          referenceType: 'account',
          referenceId: userId,
          priority: 'high',
        });
      } else {
        await createNotificationDoc({
          recipientUid: userId,
          type: 'account_reinstated',
          title: 'Account reinstated',
          message: 'Your account access has been restored.',
          referenceType: 'account',
          referenceId: userId,
        });
      }
      logger.info('Account suspension notification', { userId, suspended: after.isSuspended });
      return c.json({ ok: true });
    }

    if (
      before.verificationStatus !== after.verificationStatus &&
      after.verificationStatus === 'revoked'
    ) {
      await createNotificationDoc({
        recipientUid: userId,
        type: 'verification_revoked',
        title: 'Verification revoked',
        message: 'Your verified status has been revoked. Contact GemFort support if you have questions.',
        referenceType: 'verification',
        referenceId: userId,
        priority: 'high',
      });
      logger.info('Verification revoked notification', { userId });
    }

    return c.json({ ok: true });
  },
);

// ─── /webhooks/firestore/cheque-bounced ─────────────────────────────────────

webhooks.post(
  '/cheque-bounced',
  zValidator('json', updatedPayload),
  async (c) => {
    const { documentId: chequeId, before, after } = c.req.valid('json');
    if (before.status === after.status) return c.json({ ok: true, skipped: true });
    if (after.status !== 'bounced') return c.json({ ok: true, skipped: true });

    const ownerUid = after.ownerUid as string;
    let counterpartyName = 'Unknown';
    if (after.counterpartyContactId) {
      const contactSnap = await db
        .collection('gemtrack_contacts')
        .doc(after.counterpartyContactId as string)
        .get();
      counterpartyName = (contactSnap.data()?.displayName as string | undefined) ?? 'Unknown';
    }

    const amount = after.amount as number;
    const currency = (after.currency as string | undefined) ?? 'LKR';
    const formatted = `${currency} ${amount.toLocaleString('en-LK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    await createNotificationDoc({
      recipientUid: ownerUid,
      type: 'cheque_bounced',
      title: 'Cheque bounced',
      message: `Cheque from ${counterpartyName} for ${formatted} has bounced. Take action.`,
      referenceType: 'cheque',
      referenceId: chequeId,
      priority: 'high',
    });

    logger.info('Cheque bounced notification', { chequeId, ownerUid });
    return c.json({ ok: true });
  },
);

// ─── /webhooks/firestore/service-request-created ────────────────────────────

webhooks.post(
  '/service-request-created',
  zValidator('json', createdPayload),
  async (c) => {
    const { documentId, data } = c.req.valid('json');

    await createNotificationDoc({
      recipientUid: data.lapidaryUid as string,
      type: 'service_request_received',
      title: 'New service request',
      message: `A trader requested ${((data.serviceTypes as string[]) || []).join(', ') || 'service'} for ${data.gemName ?? 'a gem'}.`,
      referenceType: 'service_request',
      referenceId: documentId,
    });

    logger.info('service_request_received notified', { id: documentId });
    return c.json({ ok: true });
  },
);

// ─── /webhooks/firestore/service-request-updated ────────────────────────────

webhooks.post(
  '/service-request-updated',
  zValidator('json', updatedPayload),
  async (c) => {
    const { documentId, before, after } = c.req.valid('json');
    if (before.status === after.status) return c.json({ ok: true, skipped: true });

    if (after.status === 'accepted' || after.status === 'rejected') {
      await createNotificationDoc({
        recipientUid: after.traderUid as string,
        type: after.status === 'accepted' ? 'service_request_accepted' : 'service_request_rejected',
        title: after.status === 'accepted' ? 'Service request accepted' : 'Service request declined',
        message:
          after.status === 'accepted'
            ? 'Your lapidary accepted the job. Tracking is synced.'
            : 'Your lapidary declined this service request.',
        referenceType: 'service_request',
        referenceId: documentId,
      });
    }

    return c.json({ ok: true });
  },
);

// ─── /webhooks/firestore/cert-request-created ───────────────────────────────

webhooks.post(
  '/cert-request-created',
  zValidator('json', createdPayload),
  async (c) => {
    const { documentId, data } = c.req.valid('json');

    await createNotificationDoc({
      recipientUid: data.labUid as string,
      type: 'cert_request_received',
      title: 'New certification request',
      message: `A trader requested a ${data.reportType ?? ''} report for ${data.gemName ?? 'a gem'}.`,
      referenceType: 'certification_request',
      referenceId: documentId,
    });

    return c.json({ ok: true });
  },
);

// ─── /webhooks/firestore/cert-request-updated ───────────────────────────────

webhooks.post(
  '/cert-request-updated',
  zValidator('json', updatedPayload),
  async (c) => {
    const { documentId, before, after } = c.req.valid('json');
    if (before.status === after.status) return c.json({ ok: true, skipped: true });

    if (after.status === 'accepted' || after.status === 'rejected') {
      await createNotificationDoc({
        recipientUid: after.traderUid as string,
        type: after.status === 'accepted' ? 'cert_request_accepted' : 'cert_request_rejected',
        title: after.status === 'accepted' ? 'Certification accepted' : 'Certification declined',
        message:
          after.status === 'accepted'
            ? 'The gem lab accepted your request.'
            : 'The gem lab declined your request.',
        referenceType: 'certification_request',
        referenceId: documentId,
      });
    }

    if (after.status === 'completed' && after.certificateId) {
      await createNotificationDoc({
        recipientUid: after.traderUid as string,
        type: 'cert_ready',
        title: 'Certificate ready',
        message: 'Your gem certificate is published and verifiable.',
        referenceType: 'certificate',
        referenceId: after.certificateId as string,
      });
    }

    return c.json({ ok: true });
  },
);

// ─── /webhooks/firestore/notification-created ───────────────────────────────

webhooks.post(
  '/notification-created',
  zValidator('json', createdPayload),
  async (c) => {
    const { documentId, data } = c.req.valid('json');

    if (data.isPushSent) return c.json({ ok: true, skipped: true });

    const notification = data as unknown as StoredNotification;
    const sent = await sendPushForNotification(notification.recipientUid, {
      type: notification.type as NotificationType,
      title: notification.title,
      message: notification.message,
      referenceType: notification.referenceType ?? null,
      referenceId: notification.referenceId ?? null,
      priority: notification.priority ?? 'medium',
    });

    // Update the notification doc to record push dispatch result.
    await db.collection('notifications').doc(documentId).update({ isPushSent: sent });

    logger.info('Push dispatch', { notifId: documentId, type: notification.type, sent });
    return c.json({ ok: true, sent });
  },
);

export default webhooks;
