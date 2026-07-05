# USER-ROLES.md
## Roles, Permissions, and Verification

---

### 3.1 Role Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  ROLE               │  ACCESS LEVEL    │  VERIFICATION REQUIRED    │
├─────────────────────┼──────────────────┼───────────────────────────┤
│  Admin              │  Full platform   │  Assigned by system       │
│  Company Owner      │  Enterprise full │  BR + NGJA + Admin        │
│  Verified Seller    │  GemNet + Track  │  BR + NGJA + Admin        │
│  Verified Provider  │  GemNet + Track  │  ID + Admin               │
│  Normal User        │  GemNet read     │  Email only               │
│  Guest              │  GemNet public   │  None                     │
└─────────────────────┴──────────────────┴───────────────────────────┘
```

### 3.2 Permission Matrix

```
┌──────────────────────────────────────────────────────────────────────────┐
│  PERMISSION                          │ Guest │ User │ Seller │ Prov │ Admin│
├──────────────────────────────────────┼───────┼──────┼────────┼──────┼─────┤
│  Browse directory                    │  ✅   │  ✅  │  ✅   │  ✅  │  ✅ │
│  View verified profiles              │  ✅   │  ✅  │  ✅   │  ✅  │  ✅ │
│  View public listings                │  ✅   │  ✅  │  ✅   │  ✅  │  ✅ │
│  View members-only listings          │  ❌   │  ✅  │  ✅   │  ✅  │  ✅ │
│  View private listings (link)        │  ✅   │  ✅  │  ✅   │  ✅  │  ✅ │
│  Tap contact buttons                 │  ✅   │  ✅  │  ✅   │  ✅  │  ✅ │
│  Read announcements                  │  ✅   │  ✅  │  ✅   │  ✅  │  ✅ │
│  Submit fraud report                 │  ❌   │  ✅  │  ✅   │  ✅  │  ✅ │
│  Endorse a business                  │  ❌   │  ❌  │  ✅   │  ✅  │  ✅ │
│  Create business profile             │  ❌   │  ❌  │  ✅   │  ✅  │  ✅ │
│  Create gem listings                 │  ❌   │  ❌  │  ✅   │  ❌  │  ✅ │
│  Create service profile              │  ❌   │  ❌  │  ❌   │  ✅  │  ✅ │
│  Post announcements                  │  ❌   │  ❌  │  ❌   │  ❌  │  ✅ │
│  Verify businesses                   │  ❌   │  ❌  │  ❌   │  ❌  │  ✅ │
│  Suspend users                       │  ❌   │  ❌  │  ❌   │  ❌  │  ✅ │
│  Access GemTrack                     │  ❌   │  ❌  │  ✅   │  ✅  │  ✅ │
│  Access enterprise features          │  ❌   │  ❌  │  ❌   │  ❌  │  ✅*│
└──────────────────────────────────────┴───────┴──────┴────────┴──────┴─────┘
  * Enterprise features available to Company role, not standard admin
```

### 3.3 Company Sub-Roles (Enterprise Only)

```
┌─────────────────────────────────────────────────────────────────────┐
│  SUB-ROLE      │  PERMISSIONS                                       │
├────────────────┼────────────────────────────────────────────────────┤
│  Owner         │  Full access including billing and user management │
│  Manager       │  Full GemTrack access, cannot manage billing       │
│  Accountant    │  Finance module only, no gem editing               │
│  Sales         │  Deals and AP only, no financial reports           │
│  Viewer        │  Read-only across all modules                      │
└────────────────┴────────────────────────────────────────────────────┘
```

### 3.4 Verification Flow Detail

```
  STATE 1 — NONE
  User has not applied for verification.
  No badge shown. Cannot create business profile.

  STATE 2 — PENDING
  User submitted application with documents.
  Yellow pending indicator shown only to the user.
  Admin receives alert in verification queue.

  STATE 3 — INFO REQUESTED
  Admin reviewed and requires additional documents.
  User receives notification with specific request.
  User can upload additional documents and resubmit.

  STATE 4 — UNDER REVIEW
  Admin is actively reviewing the resubmission.

  STATE 5 — BASIC VERIFIED
  Identity confirmed. BR or NGJA not applicable.
  Blue verified badge. Standard search placement.

  STATE 6 — FULL VERIFIED
  BR confirmed. NGJA confirmed. ID confirmed.
  Green verified badge. Priority search placement.

  STATE 7 — REJECTED
  Application rejected. Reason provided to user.
  User can reapply after 30 days.

  STATE 8 — REVOKED
  Verification removed due to fraud or misrepresentation.
  User notified. Can appeal to admin.
```

### 3.5 Verification Documents Required

```
  REQUIRED FOR ALL
  National Identity Card (NIC) — front and back photo
  Profile photo of business owner
  Business address proof (utility bill or lease agreement)

  REQUIRED FOR SELLERS
  Business Registration (BR) certificate photo
  BR number (for admin to verify against government records)
  NGJA registration certificate photo
  NGJA member number

  REQUIRED FOR SERVICE PROVIDERS
  NIC as above
  Proof of service (workshop photos, equipment photos)
  Any professional certifications held
  NGJA membership if applicable (not mandatory for providers)

  OPTIONAL BUT RECOMMENDED
  Business photos (interior and exterior of shop or workshop)
  Reference from existing verified GemNet member
```

### 3.6 Role Transition Rules

```
  Normal User → Verified Seller       Apply for verification, admin approves
  Normal User → Verified Provider     Apply for verification, admin approves
  Verified Seller → Company Owner     Upgrade plan, admin confirms company
  Any role → Suspended                Admin action only
  Any role → Banned                   Admin action only, irreversible
  Suspended → Reinstated              Admin action only
  Verified → Revoked                  Admin action, fraud confirmed
```
