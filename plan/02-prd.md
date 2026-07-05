# PRD.md
## Full Product Requirements Document

---

### 2.1 Product Overview

GemFort is a mobile-first platform for the gemstone industry built around two products. GemNet is a verified business directory and trust network. GemTrack is a private business management tool for individual gem traders and companies.

### 2.2 Problem Statement

Gem businessmen in Sri Lanka and across trading hubs in Bangkok and China manage their operations entirely through memory, physical notebooks, and informal WhatsApp messages. There is no digital tool built for the specific workflows of the gem industry — AP stones, post-dated cheques, rough-to-cut weight tracking, sourcing trips, and selling trips.

At any moment a gem businessman does not know:
- Which of his stones are with which person
- Which cheques are maturing and when
- Whether a specific gem is profitable after all processing costs
- Who is a verified, trustworthy cutter or lab in Beruwala

### 2.3 Goals

```
┌─────────────────────────────────────────────────────────────────────┐
│  GOAL 1   Give every gem trader a free tool to track               │
│           their gems and money with zero barrier to entry.         │
│                                                                     │
│  GOAL 2   Build the largest verified directory of gem              │
│           businesses in Sri Lanka and connected markets.           │
│                                                                     │
│  GOAL 3   Create a trust network where verification,              │
│           visibility, and reputation are the paid products.        │
│                                                                     │
│  GOAL 4   Serve the industry as it actually works —               │
│           offline deals, AP stones, post-dated cheques,           │
│           sourcing trips, and selling trips.                        │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.4 Non-Goals

```
  The platform will NOT handle payments between users
  The platform will NOT manage physical shipping or logistics
  The platform will NOT grade or certify gems
  The platform will NOT operate as a public auction house
  The platform will NOT provide star ratings or public reviews
  The platform will NOT build social networking features
  The platform will NOT process financial transactions
```

### 2.5 User Personas

**Persona 1 — The Individual Trader (Primary)**
Mahesh is a gem dealer in Beruwala. He buys rough stones from Ratnapura and Tanzania, sends them to cutters and heaters, and sells finished gems through brokers in Patha and on selling trips to Bangkok. He has 12 stones out with different people right now and holds 7 post-dated cheques. He tracks everything in a notebook.

**Persona 2 — The Service Provider**
Kamal runs a gem cutting workshop in Beruwala. He cuts sapphires for 15 regular clients. He needs clients to find him, trust his work, and send him stones consistently. He has no online presence.

**Persona 3 — The Company Manager**
Priya manages a gem trading company with 8 employees. She needs to see what every employee is doing, approve major deals, and produce financial reports for the company accountant. She cannot afford enterprise software built for another industry.

**Persona 4 — The Buyer (Guest)**
Ahmed is a gem buyer from Dubai visiting Beruwala. He needs to find verified sapphire dealers quickly, see their work, and get a WhatsApp number to contact them before his visit.

### 2.6 Functional Requirements

#### GemNet Requirements

```
  GN-FR-001   Users can browse the directory without logging in
  GN-FR-002   Directory shows verified sellers and service providers
  GN-FR-003   Businesses can be filtered by type, location, and
              verification status
  GN-FR-004   Business profiles show 4 sections only
  GN-FR-005   Contact channels are individually toggled by owner
  GN-FR-006   Verified sellers can create gem listings
  GN-FR-007   Gem listings have 3 visibility levels
  GN-FR-008   Listings generate a shareable public link
  GN-FR-009   Announcements board shows 4 content types
  GN-FR-010   Only admin can post to announcements board
  GN-FR-011   Businesses can be endorsed by verified members
  GN-FR-012   Endorsement count shown publicly, names never shown
  GN-FR-013   Any signed-in user can submit a fraud report
  GN-FR-014   Admin reviews and resolves fraud reports
  GN-FR-015   Verification requires BR and NGJA document submission
  GN-FR-016   Admin manually approves all verifications
  GN-FR-017   Verified badge appears on profiles and listings
  GN-FR-018   Shareable listing card works without login
```

#### GemTrack Requirements

```
  GT-FR-001   Users can add gems with full property details
  GT-FR-002   Gem status progresses through defined lifecycle stages
  GT-FR-003   Every status change is recorded in a timeline
  GT-FR-004   All costs associated with a gem accumulate automatically
  GT-FR-005   Per-gem profit is calculated automatically
  GT-FR-006   Service records track stones given to providers
  GT-FR-007   Weight before and after service is recorded
  GT-FR-008   Weight loss percentage is calculated automatically
  GT-FR-009   AP stone records track the full AP workflow
  GT-FR-010   AP records track payment status independently
  GT-FR-011   Cheques are tracked with maturity dates
  GT-FR-012   A cheque calendar shows upcoming maturities
  GT-FR-013   Cheque bounce and replacement are tracked
  GT-FR-014   Sourcing trips record expenses and purchases
  GT-FR-015   Trip overhead distributes across gems purchased
  GT-FR-016   Selling trips track gems taken, sold, and returned
  GT-FR-017   Financial dashboard shows income, expenses, profit
  GT-FR-018   Contacts store relationship history automatically
  GT-FR-019   Reports can be exported as PDF
  GT-FR-020   Multi-currency support with base currency conversion
```

### 2.7 Non-Functional Requirements

```
  Performance    App loads under 2 seconds on 4G connection
  Performance    Directory search returns results under 1 second
  Availability   99.5% uptime target
  Security       All data encrypted in transit and at rest
  Security       Role-based access enforced at database level
  Privacy        PDPA No. 9 of 2022 (Sri Lanka) compliant
  Scalability    Architecture supports 100,000 users without redesign
  Offline        GemTrack core functions work with cached data
               when offline and sync on reconnect
  Accessibility  Minimum tap target 44x44 points
  Localisation   Sinhala, Tamil, and English language support
               planned for Phase 2
```

### 2.8 Assumptions and Constraints

```
  Most users are on Android devices with mid-range specifications
  Internet connectivity may be intermittent in some sourcing locations
  Many users prefer Sinhala as their primary language
  The gem trade is relationship-based and privacy-sensitive
  Manual verification is intentional and will not be automated
  Payments between users will never be processed in the app
  The platform launches in Beruwala first before expanding
```
