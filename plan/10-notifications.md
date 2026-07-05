# NOTIFICATIONS.md
## Notification System

---

### 10.1 Notification Types (GemNet — 4 Types)

```
  TYPE 1: VERIFICATION_STATUS_CHANGED
  Trigger:  Admin changes verification application status
  Who gets: The applicant
  When:     Immediately on admin action
  Variants:
    verification_approved
    verification_rejected
    verification_info_requested
    verification_revoked

  TYPE 2: NEW_ANNOUNCEMENT
  Trigger:  Admin posts a new announcement
  Who gets: All active users
  When:     Immediately on publish
  Variants:
    announcement_platform
    announcement_industry_news

  TYPE 3: REPORT_RESOLVED
  Trigger:  Admin resolves a fraud report
  Who gets: The reporter
  When:     When admin sets status to resolved or dismissed

  TYPE 4: ACCOUNT_ACTION
  Trigger:  Admin takes action on an account
  Who gets: The affected user
  When:     Immediately on admin action
  Variants:
    account_warning
    account_suspended
    account_reinstated
    account_banned
```

### 10.2 GemTrack Notification Types

```
  CHEQUE_MATURING_TOMORROW
  Trigger:  Cloud Function daily at 08:00 local time
  Checks:   All cheques with maturityDate == tomorrow
  Message:  "Cheque from [Name] for LKR X matures tomorrow"
  Action:   Opens cheque detail

  CHEQUE_BOUNCED
  Trigger:  User marks cheque as bounced
  Who gets: Cheque owner (confirmation / reminder)
  Message:  "Cheque from [Name] for LKR X has bounced. Take action."
  Priority: High (shown immediately)

  AP_OVERDUE
  Trigger:  Cloud Function daily at 08:00
  Checks:   AP records where status == with_holder
            AND expectedReturnDate < today
  Message:  "AP stone with [Name] is X days overdue"
  Action:   Opens AP detail

  AP_RETURN_DUE_SOON
  Trigger:  Cloud Function daily at 08:00
  Checks:   AP records where expectedReturnDate == 3 days from now
  Message:  "AP stone with [Name] due back in 3 days"

  AP_PAYMENT_OVERDUE
  Trigger:  Cloud Function daily at 08:00
  Checks:   AP records where status == sold
            AND paymentStatus in [pending, partial]
            AND soldDate < 14 days ago
  Message:  "Payment from AP sale ([Name]) is overdue"

  SERVICE_OVERDUE
  Trigger:  Cloud Function daily at 08:00
  Checks:   Service records where status == given
            AND expectedReturnDate < today
  Message:  "[Gem name] with [Provider] is X days overdue"

  PAYMENT_DUE_SOON
  Trigger:  Cloud Function daily at 08:00
  Checks:   Receivables with dueDate == 3 days from now
  Message:  "[Name] owes LKR X — due in 3 days"

  PAYMENT_OVERDUE
  Trigger:  Cloud Function daily at 08:00
  Checks:   Receivables with status == pending or partial
            AND dueDate < today
  Message:  "Payment from [Name] for LKR X is overdue"
```

### 10.3 Notification Delivery

```
  CHANNELS
    In-app notification centre (bell icon)
    Push notification via FCM (if app is backgrounded)
    No email notifications in Phase 1
    No SMS notifications in Phase 1

  FCM IMPLEMENTATION
    FCM token stored on user document on login
    Token refreshed on each app launch
    Cloud Function sends FCM to token on trigger
    If token invalid: remove from user document

  NOTIFICATION CENTRE
    Bell icon in header
    Badge count shows unread notifications
    Tapping opens notification list (modal or full screen)
    Each notification: icon, title, message, timestamp, read indicator
    Tap notification: marks read, navigates to reference
    [Mark All Read] button at top
    Notifications older than 30 days are archived

  PRIORITY LEVELS
    HIGH:    Cheque bounced, Account action
             In-app + push immediately
    MEDIUM:  AP overdue, Cheque maturing tomorrow
             In-app + push daily at 08:00
    LOW:     New announcement, AP due soon
             In-app only, or push batched
```

### 10.4 Notification Preferences

```
  Users can control (in Settings → Notifications):
    Push for new announcements        ON/OFF
    Push for cheque maturity alerts   ON/OFF
    Push for AP overdue alerts        ON/OFF
    Push for payment overdue alerts   ON/OFF

  Cannot be turned off:
    Verification status changes
    Account warnings and suspensions
    Cheque bounced alerts
    (These require action and cannot be silenced)
```

### 10.5 Cloud Function Schedule

```javascript
// Daily notification job
exports.dailyNotifications = functions.pubsub
  .schedule('0 8 * * *')
  .timeZone('Asia/Colombo')
  .onRun(async (context) => {

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Run all checks in parallel
    await Promise.all([
      checkChequesMaturing(tomorrow),
      checkApOverdue(today),
      checkApReturnDueSoon(threeDaysFromNow),
      checkApPaymentOverdue(today),
      checkServicesOverdue(today),
      checkPaymentsDueSoon(threeDaysFromNow),
      checkPaymentsOverdue(today)
    ]);
  });
```
