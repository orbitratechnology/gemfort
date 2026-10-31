# GemFort feature audit and video marketing strategy

Audit date: 31 October 2026. Sources: this repository at commit `39e035f`, `orbitratechnology/gemfort-admin` at commit `6fbe096`, and a read-only check of the Expo build history. `orbitratechnology/Automated-Instagram-Handle` holds only a README, so there were no earlier marketing assets to reuse.

The working tool is the Google Sheets workbook **GemFort Feature CRM and Video Marketing Strategy** (owner: hello@orbitratech.net):
https://docs.google.com/spreadsheets/d/1oGJAj1HdK6A4JXu33k9JE00DxE603a2GpSqSp9_goJY/edit

This document summarises the workbook. **When the two differ, the workbook is the record that gets updated.** Code and config remain the source of truth for what the product does (see [`../README.md`](../README.md)).

## Recommended strategy in brief

- **Lead with problems every dealer already has.** These are stones given on approval (AP), post-dated cheques and the weight a stone loses during cutting. General business apps don't cover these workflows, and GemFort does.
- **Make trust the second message:**
  - every business in the Market has been approved by a GemFort admin
  - a NIC is required for every badge
  - badges show five levels
  - workspace records are private to the account
- **Launch with 16 videos over six weeks** (three a week). Then publish 16 more in weeks 7–12 and 9 in weeks 12–15: 41 videos in the first campaign, followed by about two new videos a week.
- **Film mostly screen recordings from a demo account,** with short real-world openings. One creator working about two days a week (16 hours) can deliver the plan. The workbook's Video Count Plan tab recalculates if capacity changes.
- **Narrate in Sinhala with English subtitles for local audiences,** and make English versions for buyers abroad. The app is English only, so videos must never imply a Sinhala app.
- **Until a public Google Play release is confirmed, use an early-access CTA instead of "Download".** GemFort is not on iPhone.
- **Fix the product issues listed under "Launch checks" before filming the videos they affect.**

## What GemFort can do today

The audit found 150 distinct features:

| Status | Count | Meaning |
|---|---|---|
| Implemented | 115 | The screen exists and the backend allows it |
| Partial | 18 | Works, but part is missing or unreliable |
| Planned | 12 | Described in product docs, not built |
| Blocked / Unavailable | 5 | Built but unreachable, or blocked by release or platform setup |

Highlights a customer would care about:

- **Trust network (GemNet):**
  - a verified-only directory of traders and lapidaries
  - five badge levels: Member, Identity Verified, Business Verified, Gem Verified, Recognized
  - manual document review in the admin console
  - confidential fraud reports
  - Likes from verified members
- **Certificate tools:** QR or barcode scanning, and the official verification pages of 15 labs (NGJA, GIC, CGL, AGCL, GIA, IGI, HRD Antwerp, GRS, SSEF, Gübelin, Lotus, GUILD, EGL International, EGL USA, CGL Labs). GemFort opens the lab's own page; it does not verify reports itself.
- **Private workspace (GemTrack):**
  - **Gems:** inventory and a "gem passport" per stone (state, who holds it, history)
  - **AP:** two-sided records with commission split and 8 AM reminders
  - **Lapidary jobs:** weight-loss % calculated automatically
  - **Trips:** sourcing and selling trips, with trip costs shared across the stones bought
  - **Cheques:** post-dated cheques with a maturity calendar and 47 Sri Lankan banks (3,708 branches)
  - **Bills:** with commission
  - **Money:** dashboard, PDF reports and record-sale profit preview
  - **Currencies:** 12, including TZS, MGA, THB and RMB
- **Working with WhatsApp:** one-tap WhatsApp and call buttons, and sharing photos and text from WhatsApp into GemFort.
- **Privacy:** workspace records are owner-only under the database rules (administrators excepted), there is a biometric app lock, and users can delete their account in the app.

### Full inventory

Every feature's description, customer problem, benefit, how it works, evidence and limitations are in the workbook's **Product Feature CRM** tab. The list below gives the ID, name, category, status and marketing priority.

| ID | Feature | Category | Status | Priority |
|---|---|---|---|---|
| F-001 | Business verification application | Trust & Verification | Implemented | P1 Hero |
| F-002 | Five-level trust badges | Trust & Verification | Implemented | P1 Hero |
| F-003 | Promote your verification | Trust & Verification | Implemented | P3 Supporting |
| F-004 | Verified-only public directory | Trust & Verification | Implemented | P1 Hero |
| F-005 | Confidential fraud reporting | Trust & Verification | Partial | P3 Supporting |
| F-006 | Account suspension and badge removal | Trust & Verification | Implemented | P4 Mention only |
| F-007 | Likes from verified members | Trust & Verification | Implemented | P3 Supporting |
| F-008 | Verification status alerts | Trust & Verification | Implemented | P4 Mention only |
| F-009 | Certificate verification portals (15 labs) | Certificates | Implemented | P1 Hero |
| F-010 | Certificate QR and barcode scanner | Certificates | Implemented | P1 Hero |
| F-011 | Certificate attached to each stone | Certificates | Implemented | P2 Core |
| F-012 | Home feed | Marketplace (GemNet) | Implemented | P2 Core |
| F-013 | Home promo banners | Marketplace (GemNet) | Implemented | P4 Mention only |
| F-014 | Popular traders and lapidaries | Marketplace (GemNet) | Partial | P3 Supporting |
| F-015 | Browse gem listings | Marketplace (GemNet) | Implemented | P2 Core |
| F-016 | Verified traders and lapidaries directory | Marketplace (GemNet) | Implemented | P1 Hero |
| F-017 | Unified search | Marketplace (GemNet) | Partial | Do not promote |
| F-018 | Public gem listing page | Marketplace (GemNet) | Implemented | P2 Core |
| F-019 | Sell on Market from inventory | Marketplace (GemNet) | Implemented | P1 Hero |
| F-020 | Listing visibility (Public or Contacts) | Marketplace (GemNet) | Partial | Do not promote |
| F-021 | Remove from Market | Marketplace (GemNet) | Implemented | P4 Mention only |
| F-022 | Make an offer | Marketplace (GemNet) | Implemented | P2 Core |
| F-023 | Offers inbox | Marketplace (GemNet) | Partial | P3 Supporting |
| F-024 | One-tap WhatsApp and call | Marketplace (GemNet) | Implemented | P2 Core |
| F-025 | Public business profile | Business Profile | Implemented | P1 Hero |
| F-026 | Business profile editor | Business Profile | Implemented | P2 Core |
| F-027 | Lapidary services and starting prices | Business Profile | Implemented | P2 Core |
| F-028 | Business photo gallery | Business Profile | Implemented | P3 Supporting |
| F-029 | Website, social links, WeChat and map pin | Business Profile | Implemented | P3 Supporting |
| F-030 | Business setup wizard | Business Profile | Blocked / Unavailable | Do not promote |
| F-031 | Profile view and tap counters | Business Profile | Partial | Do not promote |
| F-032 | Platform announcements | Marketplace (GemNet) | Partial | Do not promote |
| F-033 | Welcome story onboarding | Account & Onboarding | Implemented | P4 Mention only |
| F-034 | Browse as a guest | Account & Onboarding | Implemented | P2 Core |
| F-035 | Sign up with your trade role | Account & Onboarding | Implemented | P1 Hero |
| F-036 | Continue with Google | Account & Onboarding | Implemented | P3 Supporting |
| F-037 | Sign in with Apple | Account & Onboarding | Blocked / Unavailable | Do not promote |
| F-038 | Email sign-in and password reset | Account & Onboarding | Implemented | P4 Mention only |
| F-039 | Account settings | Account & Onboarding | Implemented | P4 Mention only |
| F-040 | Delete your account | Account & Onboarding | Implemented | P3 Supporting |
| F-041 | Guided app tours | Account & Onboarding | Implemented | P4 Mention only |
| F-042 | Role-based workspace (GemTrack) | Workspace Hub | Implemented | P1 Hero |
| F-043 | Inventory value snapshot | Workspace Hub | Implemented | P2 Core |
| F-044 | Needs-attention list | Workspace Hub | Implemented | P2 Core |
| F-045 | Active progress strip | Workspace Hub | Implemented | P3 Supporting |
| F-046 | Quick-add button | Workspace Hub | Implemented | P3 Supporting |
| F-047 | Add a gem | Gem Inventory | Implemented | P1 Hero |
| F-048 | Gem photo album | Gem Inventory | Implemented | P3 Supporting |
| F-049 | Inventory list with search and filter | Gem Inventory | Implemented | P3 Supporting |
| F-050 | Gem passport | Gem Inventory | Implemented | P1 Hero |
| F-051 | Stone status and custody locks | Gem Inventory | Implemented | P2 Core |
| F-052 | Next-step gem actions | Gem Inventory | Implemented | P4 Mention only |
| F-053 | Gem history timeline | Gem Inventory | Partial | P3 Supporting |
| F-054 | Automatic cost build-up per stone | Gem Inventory | Partial | P2 Core |
| F-055 | Estimated profit and ROI per stone | Gem Inventory | Partial | P3 Supporting |
| F-056 | Edit, delete and sold archive | Gem Inventory | Implemented | P4 Mention only |
| F-057 | Share a gem | Gem Inventory | Implemented | P4 Mention only |
| F-058 | Sell to a GemFort trader (ownership transfer) | Gem Sales & Transfer | Implemented | P2 Core |
| F-059 | Record a sale to any contact | Gem Sales & Transfer | Implemented | P3 Supporting |
| F-060 | Record a sale with profit preview | Gem Sales & Transfer | Implemented | P1 Hero |
| F-061 | Give stones on AP | Stones on Approval (AP) | Implemented | P1 Hero |
| F-062 | Holder accepts or rejects the AP | Stones on Approval (AP) | Implemented | P1 Hero |
| F-063 | Stones on AP are locked | Stones on Approval (AP) | Implemented | P2 Core |
| F-064 | AP sale with commission split | Stones on Approval (AP) | Implemented | P1 Hero |
| F-065 | Sell some stones, return others | Stones on Approval (AP) | Implemented | P2 Core |
| F-066 | AP payment and settlement | Stones on Approval (AP) | Partial | P2 Core |
| F-067 | AP cancellation by agreement | Stones on Approval (AP) | Implemented | P3 Supporting |
| F-068 | AP overdue reminders | Stones on Approval (AP) | Implemented | P1 Hero |
| F-069 | AP dashboard (Given and Taken) | Stones on Approval (AP) | Implemented | P2 Core |
| F-070 | Service record with any cutter | Lapidary Services & Jobs | Implemented | P1 Hero |
| F-071 | Request a service from a GemFort lapidary | Lapidary Services & Jobs | Implemented | P1 Hero |
| F-072 | Automatic weight-loss % | Lapidary Services & Jobs | Implemented | P1 Hero |
| F-073 | Service list and detail | Lapidary Services & Jobs | Implemented | P3 Supporting |
| F-074 | Lapidary job inbox | Lapidary Services & Jobs | Implemented | P1 Hero |
| F-075 | Job progress and completion details | Lapidary Services & Jobs | Implemented | P1 Hero |
| F-076 | Job fee to bill in one tap | Lapidary Services & Jobs | Implemented | P2 Core |
| F-077 | Jobs list management | Lapidary Services & Jobs | Implemented | P3 Supporting |
| F-078 | Plan a trip | Trips & Travel | Implemented | P2 Core |
| F-079 | Trip budget tracking | Trips & Travel | Implemented | P3 Supporting |
| F-080 | Trip expenses with receipts | Trips & Travel | Implemented | P2 Core |
| F-081 | Stones bought on a trip | Trips & Travel | Implemented | P2 Core |
| F-082 | Selling-trip parcel | Trips & Travel | Partial | P3 Supporting |
| F-083 | Trip overhead spread across stones | Trips & Travel | Implemented | P2 Core |
| F-084 | Flight fare search | Trips & Travel | Implemented | P4 Mention only |
| F-085 | Book a fare on Aviasales | Trips & Travel | Implemented | Do not promote |
| F-086 | Money dashboard | Money & Reports | Implemented | P1 Hero |
| F-087 | Period and date-range filter | Money & Reports | Implemented | P4 Mention only |
| F-088 | Interactive cash-flow chart | Money & Reports | Implemented | P3 Supporting |
| F-089 | Transactions ledger | Money & Reports | Implemented | P3 Supporting |
| F-090 | Manual income and expense | Money & Reports | Implemented | P4 Mention only |
| F-091 | Automatic bookkeeping | Money & Reports | Implemented | P2 Core |
| F-092 | To collect and To pay | Money & Reports | Implemented | P2 Core |
| F-093 | Full and partial payments | Money & Reports | Implemented | P3 Supporting |
| F-094 | Payment history | Money & Reports | Implemented | P4 Mention only |
| F-095 | PDF reports | Money & Reports | Implemented | P2 Core |
| F-096 | Amounts in 12 currencies | Currency | Implemented | P2 Core |
| F-097 | Display currency preference | Currency | Implemented | P3 Supporting |
| F-098 | Live exchange rates | Currency | Implemented | P3 Supporting |
| F-099 | Post-dated cheque tracker | Cheques | Implemented | P1 Hero |
| F-100 | Sri Lankan bank and branch picker | Cheques | Implemented | P3 Supporting |
| F-101 | Cheque list (Given and Taken) | Cheques | Implemented | P2 Core |
| F-102 | Cheque maturity calendar | Cheques | Implemented | P1 Hero |
| F-103 | Cheque status tracking | Cheques | Implemented | P2 Core |
| F-104 | Bounced cheque handling | Cheques | Partial | P1 Hero |
| F-105 | Pay a bill or AP by cheque | Cheques | Implemented | P3 Supporting |
| F-106 | Bills with commission and linked stones | Bills | Implemented | P2 Core |
| F-107 | Bill payments | Bills | Implemented | P3 Supporting |
| F-108 | Trade contacts book | Contacts | Implemented | P3 Supporting |
| F-109 | Import contacts from your phone | Contacts | Implemented | P3 Supporting |
| F-110 | See which contacts are verified on GemFort | Contacts | Implemented | P2 Core |
| F-111 | Pick GemFort businesses as counterparties | Contacts | Implemented | P3 Supporting |
| F-112 | Contact history | Contacts | Partial | P4 Mention only |
| F-113 | Daily 8 AM business alerts | Alerts & Reminders | Implemented | P1 Hero |
| F-114 | Urgent bounced-cheque alert | Alerts & Reminders | Implemented | P3 Supporting |
| F-115 | Push notifications | Alerts & Reminders | Implemented | P4 Mention only |
| F-116 | Rich notifications | Alerts & Reminders | Implemented | P4 Mention only |
| F-117 | Action buttons on notifications | Alerts & Reminders | Implemented | P3 Supporting |
| F-118 | Notification inbox | Alerts & Reminders | Implemented | P4 Mention only |
| F-119 | Add dates to your phone calendar | Alerts & Reminders | Implemented | P2 Core |
| F-120 | iPhone Reminders | Alerts & Reminders | Blocked / Unavailable | Do not promote |
| F-121 | Share into GemFort | App Experience & Security | Implemented | P2 Core |
| F-122 | Share links to stones and profiles | App Experience & Security | Partial | P3 Supporting |
| F-123 | Biometric app lock | App Experience & Security | Implemented | P2 Core |
| F-124 | Private workspace records | App Experience & Security | Implemented | P1 Hero |
| F-125 | Works with weak signal | App Experience & Security | Partial | P3 Supporting |
| F-126 | Home-screen shortcuts | App Experience & Security | Implemented | P4 Mention only |
| F-127 | Light and dark mode | App Experience & Security | Implemented | P4 Mention only |
| F-128 | Receipt attachments | App Experience & Security | Implemented | P3 Supporting |
| F-129 | Legal, support and app info | App Experience & Security | Implemented | Do not promote |
| F-130 | Verification review desk | Admin Console (internal) | Implemented | P3 Supporting |
| F-131 | Member management | Admin Console (internal) | Implemented | Do not promote |
| F-132 | Recognized badge assignment | Admin Console (internal) | Implemented | P4 Mention only |
| F-133 | Fraud report inbox | Admin Console (internal) | Partial | Do not promote |
| F-134 | Gem Shows content studio | Admin Console (internal) | Partial | Do not promote |
| F-135 | Admin audit log | Admin Console (internal) | Implemented | P4 Mention only |
| F-136 | Admin overview and secure access | Admin Console (internal) | Implemented | Do not promote |
| F-137 | Gem Lab accounts and certificate publishing | Certificates | Planned | Do not promote |
| F-138 | Certificate lookup by report number in GemFort | Certificates | Planned | Do not promote |
| F-139 | NGJA document check and NGJA badge | Trust & Verification | Planned | Do not promote |
| F-140 | Paid featured and premium placement | Marketplace (GemNet) | Planned | Do not promote |
| F-141 | Sinhala and Tamil languages | App Experience & Security | Planned | Do not promote |
| F-142 | Accept, decline or counter offers | Marketplace (GemNet) | Planned | Do not promote |
| F-143 | Near-me business search | Marketplace (GemNet) | Planned | Do not promote |
| F-144 | Gem profit calculator screen | Gem Inventory | Planned | Do not promote |
| F-145 | AP instalments and holder totals | Stones on Approval (AP) | Planned | Do not promote |
| F-146 | Hide-amounts privacy mode | App Experience & Security | Planned | Do not promote |
| F-147 | Weighted directory ranking | Marketplace (GemNet) | Planned | Do not promote |
| F-148 | Gem Shows in the app | Marketplace (GemNet) | Planned | Do not promote |
| F-149 | iPhone app (App Store) | App Experience & Security | Blocked / Unavailable | Do not promote |
| F-150 | Public Google Play release | App Experience & Security | Blocked / Unavailable | Do not promote |

## Release status and what marketing can claim

- **Android:**
  - Store builds exist for the Play internal, closed and beta testing tracks (`eas.json`, [`../ops/PLAY_STORE_TRACKS.md`](../ops/PLAY_STORE_TRACKS.md)).
  - There is no evidence of a public production release.
- **iPhone:**
  - There is no App Store or TestFlight build.
  - Apple sign-in setup is pending ([`../ops/GOOGLE_AUTH_HANDOFF.md`](../ops/GOOGLE_AUTH_HANDOFF.md)).
- **Pricing:**
  - Nothing is charged in the app.
  - The draft Terms say the commercial model is not yet confirmed, so "free" needs management sign-off.
- **Legal:**
  - The Terms and Privacy Policy in `docs/legal/` are drafts.
  - Do not claim PDPA compliance.

**Safe claims:**
- every Market business is reviewed by the GemFort team
- a NIC is required for every badge
- five badge levels
- workspace records are private to the account
- GemFort takes no part in payments between users
- 15 lab portals
- 47 banks and 3,708 branches
- 8 AM alerts (Sri Lanka time)
- 12 currencies
- five PDF report types
- automatic weight-loss %
- no star ratings

**Claims to avoid:**
- "Download on Google Play" or "App Store"
- "GemFort verifies certificates"
- NGJA-verified badges
- Gem Labs as members
- a Sinhala or Tamil app
- PDPA compliance
- "free" (before sign-off)
- "works fully offline"
- accepting offers in the app
- featured or premium placement
- "not even GemFort can see your data"
- store ratings
- untimed speed claims
- Gem Shows in the app
- `gemfort.app` links

The **Claims and Launch Checks** tab gives the evidence for each.

## How many videos, and why

| Question | Number | Reasoning |
|---|---|---|
| Initial awareness campaign | 16 | Each journey stage once, using the fewest videos. Details below the table. |
| Major feature categories | 10 | 2 role tours (trader, lapidary) and 8 capability areas. Bills, contacts and alerts appear inside other videos. |
| Individual features and use cases | 11 | 8 short demos of high-demand or visual features, and 3 scenarios: a trader's day, a sourcing trip, a workshop week. |
| Trust, verification and onboarding | 9 | 4 trust videos (verification, privacy, reporting, the team) and 5 onboarding tutorials. |
| Common objections | 5 | Commission, WhatsApp, documents before use, no signal, phones and languages. The last one waits for release decisions. |
| Ongoing formats | 5 | Money tips, lab-report guides, monthly update, customer stories, flights (gated). About two new videos a week after the campaign. |

The 16 launch videos break down as:
- a hero film and an explainer
- 3 problem shorts: AP, cheques and cutting weight
- 2 role tours
- 4 capability videos: directory, AP, cheques and certificates
- 3 trust and objection videos
- 2 onboarding tutorials

Stage 1 holds 7 problem and introduction videos; 5 of them are in the launch set. The library has **47 ideas**:
- 16 at P1 (launch)
- 16 at P2 (weeks 7–12)
- 9 at P3 (weeks 12–15)
- 6 at P4 (ongoing or gated)

Estimated production effort is 107 hours for the launch set and 254 hours for all of P1 to P3. At 16 hours a week this fits the 16-week plan: two weeks of pre-production and 14 publishing weeks.

## Staged roadmap

1. **Stage 1, introduce the problem and GemFort (weeks 1–2).** V-01 → V-03 → V-04 → V-07 → V-02. Wave 2 adds V-05 and V-06.
2. **Stage 2, demonstrate the product (weeks 2–6).** V-17 → V-08 → V-09 → V-10 → V-12 → V-13. Wave 2 adds V-11, V-16, V-14 and V-15.
3. **Stage 3, practical workflows (weeks 7–14).** V-19 → V-23 → V-22 → V-18 → V-26 → V-20 → V-21 → V-24 → V-25 → V-28 → V-27.
4. **Stage 4, trust and concerns (weeks 4–14, alternating with Stages 2 and 3).** V-29 → V-30 → V-33, then V-35 → V-34 → V-32 → V-36 → V-31.
5. **Stage 5, registration and adoption (from the confirmed public Play release).** V-38 → V-39 → V-40 (traders) and V-41 (lapidaries) → V-42.
6. **Ongoing (week 15 onward).** V-43, V-44, V-45, V-46, V-47, plus cutdowns of earlier videos.

## Videos to produce first

| Order | ID | Title | Campaign day |
|---|---|---|---|
| 1 | V-01 | Where are your stones right now? | 1 |
| 2 | V-03 | The stone you gave on AP three weeks ago | 3 |
| 3 | V-04 | The cheque that matures tomorrow | 5 |
| 4 | V-07 | The stone came back lighter. Can you prove the weight? | 8 |
| 5 | V-02 | GemFort in 60 seconds: GemNet and GemTrack | 10 |
| 6 | V-17 | Check a gem certificate in seconds | 12 |
| 7 | V-08 | GemFort for traders: the 90-second tour | 15 |
| 8 | V-09 | GemFort for lapidaries: your workshop job book | 17 |
| 9 | V-10 | Find verified traders and lapidaries | 19 |
| 10 | V-12 | Stones on AP, done properly | 22 |
| 11 | V-29 | How GemFort verification works | 24 |
| 12 | V-13 | Every post-dated cheque in one calendar | 26 |
| 13 | V-30 | Your books stay private | 29 |
| 14 | V-33 | Does GemFort take a cut of your deals? | 31 |
| 15 | V-38 | How to sign up: pick Trader or Lapidary | 33 |
| 16 | V-39 | Set up your business profile and apply for verification | 36 |

Each video's hook, concept, demonstration, narration, CTA, key message and viewer takeaway are in the **Video Content Ideas** tab.

**Full scripts** for these 16 videos are in the Google Doc **GemFort Launch Video Scripts**. Each has a shot-by-shot table (time, visuals, voiceover, on-screen text), a post caption and production notes:
https://docs.google.com/document/d/1URn-t4Hn22XhXSdPZJPdFKiekKkJljdim90kVhJmQ6I/edit

**Motion-graphic drafts** of V-03, V-04, V-07 and V-33 are in the `orbitratechnology/Automated-Instagram-Handle` repository under `video-drafts/`, with their HTML source and render script. They recreate app screens with the app's own wording and demo data. Final videos should use real screen recordings.

## Launch checks before filming

These come from reading the code; they have not been reproduced in a running app. Test each one before filming the affected video.

1. **No public Google Play release confirmed.** Affects every "download" CTA.
2. **Listing link numbers can collide.** Listing slugs are numbered per seller (`GF-L-00001` in `createListing`), so two sellers can share a link and a shared link can open the wrong stone. Affects V-18.
3. **Listing may not link back to the inventory gem.** The write-back from a new listing to its inventory gem sets `title` and `askingPrice*`. Neither `gemtrack_gems` update rule allows those fields together with `outcome`, so the update is probably rejected silently. Affects V-18 and V-11.
4. **Trip overhead can be counted twice.** It can be distributed twice, and stones stay "on trip" after a trip is completed. Affects V-15 and V-27.
5. **AP stones may stay locked after payment.** Stones still held when an AP payment is made may stay locked. Affects V-12.
6. **Fraud reports cannot be resolved.** The admin console can view reports but not resolve them. Affects V-31.
7. **Business and legal sign-off.** Final Terms and Privacy Policy, the commercial model, a single support contact (`README.md` and `src/constants/legal.ts` differ), a working public link domain, Google sign-in on the release build, and Travelpayouts keys for flights.
8. **Demo data and consent.** A demo account with fictional data, written consent from everyone filmed, and blurred NICs and cheque numbers.

## Customer journey gaps

- **J1, not aware:** one hero film. Reach depends on distribution: WhatsApp Status cutdowns, Sinhala voiceover, gem associations, Beruwala market-day demos.
- **J6, trust:** no independent proof before launch. Make customer stories (V-46) a priority after launch, and publish the final legal pages first.
- **J7, getting started:** no public install path until the Play release. Use an early-access form.
- **J8, adoption:** AP and service requests need both sides on GemFort, but nothing helps users invite partners. Provide a WhatsApp invitation message now, and make an invite video only once an invite flow exists in the app.

## Method

- Four parallel code reviews covered:
  - GemNet, account and trust
  - inventory, AP, services and trips
  - money, cheques, bills, contacts, notifications and flights
  - the admin console and release status
- Key findings were spot-checked against the source, for example:
  - the tab layout
  - the portal list
  - the 8 AM schedule
  - NGJA fields being null
  - Gem Shows having no mobile reader
  - the AP holder rule
  - the listing write-back rule
- Feature statuses follow the rule in [`../README.md`](../README.md): code and config win over prose.
