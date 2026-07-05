# NAVIGATION.md
## Information Architecture

---

### 4.1 GemNet App Navigation

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BOTTOM NAVIGATION BAR                           │
│                                                                     │
│         🏠 HOME          🔍 DIRECTORY         👤 PROFILE           │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 GemNet Full Screen Tree

```
  ROOT
  ├── ONBOARDING (shown once)
  │   ├── Splash Screen
  │   ├── Onboarding Slide 1 (Find verified businesses)
  │   ├── Onboarding Slide 2 (Trust through verification)
  │   ├── Onboarding Slide 3 (Close deals offline)
  │   ├── Register Screen
  │   │   ├── Role Selection (Normal / Seller / Provider)
  │   │   ├── Email + Phone + Password
  │   │   └── OTP Verification
  │   └── Login Screen
  │       └── Forgot Password
  │           └── Reset Password
  │
  ├── HOME TAB
  │   ├── Announcements Board (scrollable list)
  │   │   ├── Announcement Card (platform news)
  │   │   ├── Announcement Card (industry news)
  │   │   ├── Featured Business Card
  │   │   └── New Listing Card
  │   └── Notification Centre (bell icon, top right)
  │       └── Notification Detail
  │
  ├── DIRECTORY TAB
  │   ├── Search Bar + Filters
  │   ├── Sellers Tab
  │   │   └── Business Card List
  │   │       └── Business Profile Page
  │   │           ├── Section 1: Business
  │   │           ├── Section 2: Services
  │   │           ├── Section 3: Gallery
  │   │           │   └── Photo Full Screen View
  │   │           ├── Section 4: Contact
  │   │           └── Report Business Sheet
  │   ├── Service Providers Tab
  │   │   └── Business Card List
  │   │       └── Business Profile Page (same as above)
  │   └── Map View (optional toggle)
  │
  ├── PROFILE TAB
  │   ├── [GUEST / NORMAL USER]
  │   │   ├── Account Details
  │   │   ├── Saved Businesses
  │   │   ├── Apply for Verification
  │   │   │   └── Verification Application Form
  │   │   │       └── Document Upload
  │   │   └── Settings
  │   │       ├── Language
  │   │       ├── Notifications
  │   │       ├── Privacy
  │   │       ├── Help and Support
  │   │       └── Log Out
  │   │
  │   └── [VERIFIED SELLER / PROVIDER]
  │       ├── My Business Profile
  │       │   ├── Edit Business Info
  │       │   ├── Edit Services
  │       │   ├── Edit Gallery
  │       │   │   ├── Upload Photo
  │       │   │   └── Delete Photo
  │       │   └── Edit Contact Visibility
  │       ├── My Gem Listings (Seller only)
  │       │   ├── Create Listing
  │       │   │   ├── From GemTrack (select gem)
  │       │   │   └── Manual Entry
  │       │   ├── Listing Detail
  │       │   │   ├── Edit Listing
  │       │   │   ├── Change Visibility
  │       │   │   ├── Share Link Sheet
  │       │   │   └── Mark as Sold
  │       │   └── Sold History (private)
  │       ├── My Analytics
  │       ├── Verification Status
  │       ├── Subscription and Plan
  │       └── Settings (same as above)
  │
  └── STANDALONE (no nav bar, accessed via link)
      └── Public Listing Page (gemnet.app/l/[slug])
```

### 4.3 GemTrack App Navigation

```
┌─────────────────────────────────────────────────────────────────────┐
│              BOTTOM NAVIGATION BAR (GemTrack)                      │
│                                                                     │
│   💎 GEMS    💰 MONEY    📋 AP    🏦 CHEQUES    👤 MORE           │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.4 GemTrack Full Screen Tree

```
  ROOT
  ├── DASHBOARD (default home within More tab)
  │   ├── Gem Status Summary Cards
  │   ├── Financial Summary Cards
  │   ├── Alert Cards (overdue, maturing, etc.)
  │   └── Quick Action Buttons
  │
  ├── GEMS TAB
  │   ├── Gem List (grid / list toggle)
  │   │   ├── Filter and Search Bar
  │   │   └── Gem Card
  │   │       └── Gem Detail Screen
  │   │           ├── Gem Photos (carousel)
  │   │           ├── Properties Section
  │   │           ├── Cost Breakdown Section
  │   │           ├── Lifecycle Timeline Section
  │   │           ├── Certificates Section
  │   │           ├── Edit Gem
  │   │           ├── Add Service Record (quick)
  │   │           ├── Give on AP (quick)
  │   │           └── Push to GemNet Listing
  │   └── Add Gem (FAB button)
  │       ├── Basic Info Step
  │       ├── Physical Properties Step
  │       ├── Treatment Step
  │       ├── Cost Step
  │       ├── Photos Step
  │       └── Confirm Step
  │
  ├── MONEY TAB
  │   ├── Financial Dashboard
  │   ├── Transactions
  │   │   ├── Transaction List
  │   │   └── Add Transaction
  │   ├── Receivables
  │   │   ├── Receivables List
  │   │   ├── Add Receivable
  │   │   └── Receivable Detail
  │   ├── Payables
  │   │   ├── Payables List
  │   │   ├── Add Payable
  │   │   └── Payable Detail
  │   └── Reports
  │       ├── Report Type Selection
  │       ├── Date Range Selection
  │       └── Report View + Export
  │
  ├── AP TAB
  │   ├── AP Dashboard (grouped by holder)
  │   ├── Create AP Record
  │   │   ├── Select Gem
  │   │   ├── Select Holder (from contacts)
  │   │   ├── Set Terms
  │   │   └── Confirm
  │   ├── AP Detail
  │   │   ├── Record Sale
  │   │   ├── Record Return
  │   │   └── Add Payment
  │   └── AP Performance Summary
  │
  ├── CHEQUES TAB
  │   ├── Cheque Dashboard (by status)
  │   ├── Cheque Calendar View
  │   ├── Add Cheque
  │   ├── Cheque Detail
  │   │   ├── Update Status
  │   │   ├── Mark Bounced
  │   │   └── Link Replacement
  │   └── Cheque History
  │
  └── MORE TAB
      ├── Dashboard (main)
      ├── Service Records
      │   ├── Active Services (by type)
      │   ├── Add Service Record
      │   │   ├── Select Gem
      │   │   ├── Select Provider (from contacts)
      │   │   ├── Set Details
      │   │   └── Confirm
      │   └── Service Detail
      │       ├── Update Status
      │       ├── Record Return
      │       └── Upload Result Photo
      ├── Trips
      │   ├── Trip List
      │   ├── Create Trip (sourcing or selling)
      │   ├── Trip Detail
      │   │   ├── Expenses Tab
      │   │   │   └── Add Expense
      │   │   ├── Gems Tab (purchases or travel parcel)
      │   │   │   ├── Add Purchase (sourcing)
      │   │   │   └── Select Gems for Trip (selling)
      │   │   ├── Sales Tab (selling trip)
      │   │   └── Summary Tab
      │   └── Distribute Overhead
      ├── Contacts
      │   ├── Contact List (searchable)
      │   ├── Add Contact
      │   ├── Contact Detail
      │   │   ├── Activity History
      │   │   ├── Outstanding Balance
      │   │   └── Edit Contact
      │   └── Contact Type Filter
      └── Settings (same as GemNet profile settings)
```

### 4.5 Admin Panel Navigation (Web)

```
  ADMIN SIDEBAR
  ├── Dashboard
  ├── Verification Queue
  ├── Users
  ├── Businesses
  ├── Fraud Reports
  ├── Featured Management
  ├── Announcements
  ├── Analytics
  ├── Revenue
  └── Audit Log
```
