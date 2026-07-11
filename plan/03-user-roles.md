# USER-ROLES.md
## Roles, Permissions, and Verification

---

### 3.1 Role Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  ROLE               │  ACCESS LEVEL    │  VERIFICATION REQUIRED    │
├─────────────────────┼──────────────────┼───────────────────────────┤
│  Admin              │  Full platform   │  Assigned by system       │
│  Trader             │  GemNet + Track  │  NIC+BR+GemLicense+TIN    │
│  Lapidary           │  GemNet + Track  │  Services + identity docs │
│  Gem Lab            │  GemNet + Certs  │  NIC+BR+GemLicense+TIN    │
│  Guest              │  GemNet public   │  None                     │
└─────────────────────┴──────────────────┴───────────────────────────┘
```

Registration assigns `role` immediately (`trader` | `lapidary` | `gem_lab`) with `verificationStatus: none`.
Users remain unverified **in that role** until admin approval. Role is not re-selected on the verification form.

### 3.2 Permission Matrix

```
┌──────────────────────────────────────────────────────────────────────────┐
│  PERMISSION                          │ Guest │ Trader │ Lapid │ Lab │ Adm │
├──────────────────────────────────────┼───────┼────────┼───────┼─────┼─────┤
│  Browse directory                    │  ✅   │  ✅   │  ✅  │ ✅ │ ✅ │
│  Public certificate verify           │  ✅   │  ✅   │  ✅  │ ✅ │ ✅ │
│  Create business profile             │  ❌   │  ✅   │  ✅  │ ✅ │ ✅ │
│  Create gem listings                 │  ❌   │  ✅*  │  ❌  │ ❌ │ ✅ │
│  Offer lapidary services             │  ❌   │  ❌   │  ✅* │ ❌ │ ✅ │
│  Publish certificates                │  ❌   │  ❌   │  ❌  │ ✅*│ ✅ │
│  Request service / certification     │  ❌   │  ✅*  │  ❌  │ ❌ │ ✅ │
│  Accept/reject requests              │  ❌   │  ❌   │  ✅* │ ✅*│ ✅ │
│  Workspace: Gems/Trips/AP            │  ❌   │  ✅*  │  ❌  │ ❌ │ ✅ │
│  Workspace: Jobs (workshop)          │  ❌   │  ❌   │  ✅* │ ❌ │ ✅ │
│  Workspace: Certificates             │  ❌   │  ❌   │  ❌  │ ✅*│ ✅ │
│  Access GemTrack money               │  ❌   │  ✅*  │  ✅* │ ✅*│ ✅ │
└──────────────────────────────────────────────────────────────────────────┘
  * Requires verificationStatus == verified
```

### 3.3 Cores

- **Trader:** buy/sell and track stones (Gems core). Can request services from Lapidaries and certificates from Gem Labs.
- **Lapidary:** services (cutting, heat, polish, shaping, …). No Trips/AP/Trader inventory. Dedicated **Jobs** for trader stones in workshop.
- **Gem Lab:** certificates/reports. No Trips/Services catalog/AP. Dedicated **Certificates** screen; reports are public for verify.

### 3.4 Verification Documents

```
  TRADER + GEM LAB
  NIC photos, BR number + photo, Gem License number + photo, TIN

  LAPIDARY
  Multi-select services offered (required)
  NIC photo
  Optional BR / workshop proof
```

### 3.5 Role Transition Rules

```
  Register as Trader/Lapidary/Gem Lab → role set, verificationStatus none
  Apply for verification → pending (role unchanged)
  Admin approves → verificationStatus verified (role unchanged)
  Admin rejects/revokes → status updated; role stays
```
