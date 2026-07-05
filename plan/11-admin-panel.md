# ADMIN-PANEL.md
## Internal Moderation Tooling

---

### 11.1 Admin Panel Overview

The admin panel is a web application accessible only to users with the admin role. It is the primary tool for platform governance.

```
  Technology:   Flutter Web or React (Phase 3)
  Access:       admin role only, verified by Firestore rules
  URL:          admin.gemfort.app (separate from main app)
  Auth:         Same Firebase Auth, role check on load
```

### 11.2 Admin Dashboard

```
  HEADER METRICS (real-time)
    Pending verifications:     12  [Review Queue →]
    Active fraud reports:       3  [View Reports →]
    New registrations today:   24
    Active businesses:        209
    Active gem listings:      387

  REVENUE SUMMARY
    This month total:    LKR 485,000
    Verification fees:   LKR 125,000
    Featured fees:       LKR 180,000
    Premium fees:        LKR 130,000
    Enterprise fees:     LKR  50,000

  ACTIVITY FEED (last 50 actions)
    Timestamped list of admin actions
    Each entry: action type, target, admin name, time
```

### 11.3 Verification Queue

```
  LIST VIEW
    Sorted: oldest submission first (FIFO)
    Each item shows:
      Business name
      Business type (seller or provider)
      Applicant name
      Submitted date
      Days waiting
      Status badge
    Filter: All / Pending / Info Requested / Under Review

  DETAIL VIEW (open individual application)
    Business name and type
    Applicant name and account details

    DOCUMENT VIEWER
      Side-by-side layout
      Left: Document list with status indicators
        BR Certificate photo
        NGJA Certificate photo
        NIC photo (front and back)
        Business photos (gallery)
        Address proof photo
      Right: Selected document preview (full resolution)
      [Zoom] [Download] [Rotate] per document

    CROSS-CHECK PANEL
      BR Number: [number]  [Copy for manual verification]
      NGJA Number: [number]  [Copy for manual verification]
      Links to relevant government verification resources

    ADMIN NOTES
      Text area for internal notes (not shown to applicant)

    ACTION BUTTONS
      [✅ Approve as FULL VERIFIED]
      [☑️ Approve as BASIC VERIFIED]
      [🔄 Request More Information]
        Opens: message field for specific request
        Sends notification to applicant
      [❌ Reject]
        Opens: rejection reason field (shown to applicant)
        Confirm dialog before action

    HISTORY
      All previous actions on this application
      With admin name and timestamp
```

### 11.4 User Management

```
  LIST VIEW
    Columns: Name, Email, Phone, Role, Verification, Joined, Last Active
    Search: by name, email, phone
    Filter: by role, by verification status, by suspension status
    Sort: by join date, last active, name

  USER DETAIL VIEW
    Account information
    Current role and verification status
    Business profile (if created) with link
    Gem listings (if any) with links
    Fraud reports involving this user (as reporter or reported)
    Audit history (all admin actions on this account)

    ADMIN ACTIONS
      [Verify Business] → goes to verification queue
      [Suspend Account]
        Duration: 7 days, 30 days, 90 days, Permanent
        Reason field (shown to user)
      [Lift Suspension]
        Confirm dialog
      [Ban Account]
        Permanent, cannot be lifted without manual process
        Reason field
      [Revoke Verification]
        Reason field (shown to user)
      [Change Role]
        Dropdown of available roles

    All actions create an admin_actions audit log entry
```

### 11.5 Fraud Report Management

```
  LIST VIEW
    Priority sort: multiple reports on same business first
    Columns: Business, Reporter, Type, Status, Submitted
    Status filter: All / Pending / Investigating / Resolved / Dismissed
    Color coding: Red = 3+ reports same business, Yellow = 2, Blue = 1

  REPORT DETAIL VIEW
    Reporter details (name, account age, previous reports submitted)
    Reported business link (opens business profile)
    Report type and description
    Evidence photos/files (if submitted)

    RELATED REPORTS
      Other reports about the same business
      Other reports by the same reporter

    ADMIN ACTIONS
      [Mark as Investigating]
      [Resolve — Warning Issued]
        Warning message field (sent to business)
      [Resolve — Suspension]
        Links to user management suspension flow
      [Resolve — Ban]
        Links to user management ban flow
      [Dismiss — No Action]
        Reason field (for audit log, not shown to reporter)
      [Resolve — No Action Found]
        Notifies reporter, no action on business

    All actions logged and reporter notified
```

### 11.6 Featured Management

```
  ACTIVE FEATURED SLOTS
    Visual grid showing current 5 slots
    Each slot: Business name, logo, expiry date, [Remove] button
    Available slots shown as empty placeholders

  ADD FEATURED
    Search businesses
    Select business
    Set duration: 1 month, 3 months, 6 months, Custom dates
    Set placement: Directory top, Announcements board, Both
    Confirm payment received (manual, no auto-billing in Phase 1)
    [Publish Featured]

  FEATURED HISTORY
    Log of all past and current featured placements
    With business, duration, admin who placed, revenue recorded
```

### 11.7 Announcement Management

```
  LIST VIEW
    All announcements with status (visible / hidden / scheduled)
    Filter by type
    [+ New Announcement] button

  CREATE / EDIT ANNOUNCEMENT
    Type selection:
      📢 Platform Announcement
      📰 Industry News
      ⭐ Featured Spotlight (select business, auto-generates card)
      💎 New Listing (auto-generated, admin cannot manually create)

    Fields by type:
      Platform: Title + Content (200 char max) + Optional CTA link
      Industry News: Title + Summary + External URL + Image (optional)
      Featured Spotlight: Select business → auto-generates card

    Scheduling:
      Publish now
      Schedule for: date/time picker

    Visibility:
      [Publish] or [Save Draft] or [Schedule]

  MANAGE EXISTING
    [Edit] — update content of unpublished or visible announcements
    [Hide] — removes from home feed immediately
    [Delete] — permanent, with confirmation
```

### 11.8 Analytics Dashboard (Admin)

```
  PLATFORM METRICS (selectable period: 7d, 30d, 90d, 1y)
    Total registered users (and growth chart)
    Verified sellers (total and growth)
    Verified providers (total and growth)
    Verification approval rate
    Average verification processing time (days)
    Active gem listings
    Total profile views
    Total WhatsApp taps (from business profiles)
    Total phone taps

  REVENUE METRICS
    Total revenue by period
    Revenue by product type (bar chart)
    Verification fee renewals due (next 30/60 days)
    Featured placement revenue
    Premium subscription revenue
    Enterprise subscription revenue

  FRAUD METRICS
    Reports submitted per period
    Report resolution rate
    Average resolution time
    Most reported businesses (admin view only)
    Accounts suspended or banned

  RETENTION
    Monthly active users (MAU)
    Weekly active users (WAU)
    Users who added gems in last 7 days
    Users who opened app 3+ times per week
```
