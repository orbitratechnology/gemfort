# DEVELOPMENT-ROADMAP.md
## Phased Build Plan

---

### 13.1 Phase 1 — MVP (Months 1 to 3)
**Theme: Track my gems and money**

```
  SPRINT note (roles): Trader / Lapidary / Gem Lab registration assigns role immediately (unverified).
  Directory tabs: Traders, Lapidaries, Gem Labs. Lapidary Jobs + Gem Lab Certificates + public verify.
  ─────────────────────────────────
  Firebase project setup
  Firestore collections created
  Security rules (Phase 1 scope)
  Flutter project setup
  Design system implemented (colors, typography, components)
  Authentication screens (register, login, forgot password, OTP)
  User document creation on registration
  Bottom navigation scaffold (GemTrack tabs)
  Basic GemNet directory (read-only, no auth required)

  SPRINT 2 (Weeks 3–4): Gem Inventory Core
  ──────────────────────────────────────────
  Add gem flow (multi-step form)
  Gem list screen (list and grid toggle)
  Gem detail screen (view all properties)
  Gem status update (manual status change)
  Photo upload to Firebase Storage
  Gem search (client-side on cached list)
  Gem filter (status, type)
  Dashboard with gem status summary

  SPRINT 3 (Weeks 5–6): Service Tracking + AP Basic
  ───────────────────────────────────────────────────
  Add service record flow
  Service list screen (grouped by type)
  Service detail screen
  Mark service complete (record weight after, add cost)
  Service overdue detection (client-side)
  Add AP record flow
  AP list screen (grouped by holder)
  AP detail screen
  Record AP sale or return

  SPRINT 4 (Weeks 7–8): Money Tracker Core
  ──────────────────────────────────────────
  Add transaction (income or expense)
  Transaction list
  Link transaction to gem
  Per-gem cost accumulation (automatic on service complete)
  Per-gem profit calculator screen
  Financial dashboard (totals only)
  Add receivable / payable (basic)

  SPRINT 5 (Weeks 9–10): Contacts + GemNet Basic
  ─────────────────────────────────────────────────
  Contact CRUD
  Contact type tagging
  Link contacts to service records, AP records
  GemNet directory (read-only browsing, no login)
  Business card and basic profile display
  Public listing page (shareable URL)

  SPRINT 6 (Weeks 11–12): Admin + Polish
  ────────────────────────────────────────
  Admin panel (web): user list, basic user management
  Verification application submission (user side)
  Admin verification queue (basic approve / reject)
  Push notification setup (FCM token storage)
  4 notification types implemented
  Bug fixes, performance, crash testing
  TestFlight / Play Store internal testing release

  PHASE 1 DELIVERABLE
  ─────────────────────
  Working Flutter app (iOS + Android)
  GemTrack: Gems, Services, AP, Basic Money, Contacts
  GemNet: Read-only directory + public listing view
  Admin: Basic user and verification management
  Target: 500 beta users from Beruwala gem community
```

### 13.2 Phase 2 — Core Completeness (Months 4 to 6)
**Theme: Track my money properly**

```
  SPRINT 7–8: Cheque Tracker (Full)
  ────────────────────────────────────
  Cheque CRUD (add, edit, update status)
  Cheque calendar view
  Maturity date alerts (Cloud Function daily job)
  Bounced cheque flow
  Replacement cheque linking
  Cheque photo capture and storage
  Link cheques to AP records, gem deals

  SPRINT 9–10: Trips
  ────────────────────────────────────
  Sourcing trip CRUD
  Trip expense tracking
  Quick gem purchase during trip (creates gem record)
  Trip overhead distribution to gems
  Selling trip CRUD
  Travel parcel creation (select gems for trip)
  Sales during selling trip
  Trip summary screen

  SPRINT 11: Advanced Money + Reports
  ────────────────────────────────────
  Payment tracker (partial payments, commission)
  Receivables dashboard (total, overdue highlights)
  Payables dashboard
  Multi-currency support + exchange rate API
  Financial report generation (PDF)
  Report types: P&L, Cash Flow, Inventory Value,
  Outstanding Payments, Cheque Maturity

  SPRINT 12: Polish + GemNet Enhancements ✅
  ────────────────────────────────────────
  Full GemTrack notification types (all 8 types) — Cloud Functions Gen 2 daily job
  Push via FCM — onNotificationCreated trigger + @react-native-firebase/messaging
  GemNet triggers: announcements, verification, reports, account actions
  Offline mode — Firestore native persistence + React Query offlineFirst
  GemNet: Fraud reporting submission
  GemNet: Endorsement sending
  Performance optimization (staleTime, gcTime, refetch tuning)

  PHASE 2 DELIVERABLE
  ─────────────────────
  Complete GemTrack feature set for individuals
  Full cheque tracking with calendar
  Sourcing and selling trip modules
  PDF report export
  Public app launch
  Target: 2,000 active users
```

### 13.3 Phase 3 — GemNet Launch (Months 7 to 9)
**Theme: Connect with verified businesses**

```
  SPRINT 13–14: Business Profiles (Full)
  ────────────────────────────────────────
  Create and edit business profile (all 4 sections)
  Gallery upload and management
  Contact visibility controls
  Service catalog for providers
  Profile analytics (views, taps — Cloud Function)
  Verification application submission (full document upload)

  SPRINT 15–16: Admin Panel (Full)
  ────────────────────────────────────
  Admin web panel (Flutter Web or React)
  Verification queue with document viewer
  User management (suspend, ban, reinstate)
  Fraud report management
  Featured management
  Announcement creation and management
  Analytics dashboard
  Revenue dashboard
  Audit log viewer

  SPRINT 17: Gem Listings + Trust Badges
  ────────────────────────────────────────
  Verified seller gem listing creation
  3 visibility levels
  Shareable listing link generation
  Listing analytics (Cloud Function)
  Listing-to-GemTrack sync (push gem to GemNet)
  Mark listing sold (GemNet ↔ GemTrack sync)
  Trust badge computation (Cloud Function)
  Endorsement count update (Cloud Function)
  Ranking score computation (Cloud Function)

  SPRINT 18: Revenue Products + Polish
  ────────────────────────────────────────
  Verification fee collection (manual, admin records)
  Premium profile upgrade flow
  Featured placement (admin-managed)
  Search placement (admin-managed)
  Algolia integration for full-text search
  Geo search (Near Me)
  Sinhala language support

  PHASE 3 DELIVERABLE
  ─────────────────────
  Full GemNet public launch
  Verification products live
  Revenue flowing
  Full admin panel operational
  Target: 200 verified businesses, first LKR 100K revenue
```

### 13.4 Phase 4 — Growth (Months 10 to 12)
**Theme: Scale and improve**

```
  SPRINT 19–20: Enterprise
  ────────────────────────────────────
  Company account creation
  Employee invitation and role management
  Company-wide dashboard
  Internal approval workflows
  Company audit logs
  Advanced reporting (Excel export)
  API endpoints for enterprise data export
  Dedicated support flow

  SPRINT 21: Optimisation
  ────────────────────────────────────
  Performance profiling and optimisation
  Image optimisation and CDN setup
  Query optimization (index review)
  Offline mode improvement
  Battery usage optimisation
  App size reduction

  SPRINT 22: Expansion
  ────────────────────────────────────
  Tamil language support
  Thai Baht and Chinese Yuan currency display
  Bangkok and China location expansion
  SEO optimisation for public listing pages
  Marketing landing page (gemfort.app)
  App Store Optimisation (ASO)
  QR verification for certificates
  Jewelry module (Phase 4 addition for large companies)

  PHASE 4 DELIVERABLE
  ─────────────────────
  Enterprise accounts live
  10+ enterprise clients
  LKR 500,000+ monthly revenue
  Expansion to Bangkok and China markets
  Target: 5,000 active users
```
