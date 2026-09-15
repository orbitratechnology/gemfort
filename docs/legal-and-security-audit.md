# GemFort legal and security audit

**Audit date:** 15 September 2026  
**Scope:** repository source and configuration, Firebase CLI, Google Cloud CLI, account deletion, device permissions, public data projections, Firestore and Storage rules, and the Sri Lankan gem-trade context.

## Audit result

**Status: NOT READY FOR FINAL LEGAL PUBLICATION or unrestricted Play release.**

The repository contains substantive draft documents in [privacy-policy.md](./privacy-policy.md) and [terms-and-conditions.md](./terms-and-conditions.md). They are intentionally still marked as drafts because the operator’s legal identity, registered address, official privacy/support contact, age rule, governing law, dispute process, fees, and liability position are not established in the codebase. Those facts must not be guessed.

The currently verifiable account-deletion URL is [https://gemfort.web.app/delete-account](https://gemfort.web.app/delete-account), which returned HTTP 200 during the audit. The custom `gemfort.app` domain was not DNS-resolvable from the audit environment. The Hono endpoint is an authenticated, App Check-protected API route and is not a valid Google Play web deletion resource:

`DELETE https://asia-south1-gemfort.cloudfunctions.net/gemfortApi/v1/account`

## Product and data map

GemFort has two connected surfaces:

- **GemNet:** public business discovery, verified business profiles, public gem listings, announcements, service requests, offers, likes, reports, certificate-portal links, and external contact/share links.
- **GemTrack:** private operational records for gemstone inventory and the gemstone lifecycle from acquisition through custody, cutting/heating/polishing, AP placement, trips, listing, sale, return, and related payments, cheques, bills, costs, services, receipts, contacts, and expenses.

The app supports email/password, Google, Apple, and phone verification flows; manual identity/business verification; selected-contact import; foreground location; photos/files; push notifications; local biometric app lock; and flight search/affiliate links. It does not provide in-app user-to-user payments, custody of money or stones, shipping, gem grading, or a public auction service.

## Live Firebase and Google Cloud evidence

- Firebase project: `gemfort`; Firestore database: Native mode, `asia-south1`, point-in-time recovery enabled, delete protection enabled.
- Firebase Hosting site `gemfort`: live URL `https://gemfort.web.app`; deletion page returned HTTP 200.
- Main Storage bucket: `gemfort.firebasestorage.app`, private ACL posture, public-access prevention inherited, seven-day soft-delete retention.
- Cloud Logging: `_Default` bucket retains 30 days; locked `_Required` bucket retains 400 days.
- Active Cloud Functions include the Hono API, account deletion safety net, public-business projection, verification, reports, notifications, service, offer, cheque, like, exchange-rate, and daily-notification workflows.
- No secret values were read. Travelpayouts secret names were inventoried only.

## High-priority findings

The security review score is **3/5 (moderate; remediation required)**.

1. **High — legacy private listing reads.** `firestore.rules` allows active `private` and `members_only` `gems` documents to be read by link. This conflicts with a reasonable privacy expectation. Remove that rule, migrate/audit existing records, and add negative access tests.
2. **High — public listing overexposure.** Public `gems` reads return the listing document, which currently includes identifiers such as `sellerUid`, `businessId`, `workspaceGemId`, analytics, and media references. Create a server-maintained public listing projection or a strict allowlist that excludes private/workspace identifiers and internal analytics.
3. **High — legacy service update integrity.** Participant update rules for `service_requests` and `lapidary_jobs` do not sufficiently restrict changed fields, identity fields, or status transitions. Move these mutations behind the authenticated API or add field-level and state-transition validation.
4. **Medium — unauthenticated business analytics writes.** The verified-business analytics update condition does not require a signed-in user. Require authentication and consider server-side counters/rate limiting.
5. **Medium — owner-write schema integrity.** Several owner-controlled financial, contact, trip, and expense collections rely mainly on ownership checks and do not constrain types, sizes, immutable owner identity, or allowed fields. This is primarily an integrity and resource-abuse risk, but it can corrupt important records.
6. **Medium — deletion depends on triggers for projections.** The deletion worker covers the `receipts` Storage prefix and the main owned collections, but `public_businesses` cleanup is trigger-dependent. Add an explicit idempotent projection cleanup and a post-deletion verification/monitoring path.
7. **Medium — public location and contact disclosure.** The app can publish exact coordinates and visible phone, WhatsApp, or email values. The product must warn users at the point of publishing and the policy must keep this disclosure prominent.

## Permission and service audit

The static source/configuration audit found contacts, foreground location, photos/files, notifications, biometric authentication, secure local storage, Firebase Auth/Firestore/Storage/App Check, Google/Apple sign-in, MapLibre/OpenStreetMap tiles, Travelpayouts/Aviasales flight search, Open ER API exchange rates, and external certificate portals. It found no GemFort application logic for microphone recording, call-log access, overlay, or writing contacts. A generated release manifest and device test remain required; static source inspection is not proof of the final APK/AAB permission set.

## Sri Lankan context used for drafting

The [Sri Lanka Data Protection Authority](https://www.dpa.gov.lk/est.php) states the Personal Data Protection Act implementation dates and identifies the DPA as the regulator. The DPA’s [official Acts and guidelines page](https://www.dpa.gov.lk/guidelines.php) should be used for the current Act, amendments, and any regulations that become applicable; draft consultation materials should not be described as binding law without legal confirmation.

For industry wording, the [National Gem and Jewellery Authority gem-dealer licensing process](https://ngja.gov.lk/business_services/gem-dealer-licence-process/) identifies business, identity, residence, tax, and company information relevant to licensing. The [Export Development Board gem, diamond, and jewellery industry report](https://www.srilankabusiness.com/ebooks/industry-capability-report-diamonds-gems-jewellery-2025.pdf) describes the local value chain from mining and dealing/exporting through lapidary, jewellery manufacture, and retailing. Its [export procedure guidance](https://www.srilankabusiness.com/gem-diamond-and-jewellery/exporter-information/gem-export-procedure-sri-lanka.html) confirms that NGJA and Customs processes apply to exports. These sources inform the product description and risk language; they do not replace legal advice or make GemFort a regulator, certifier, broker, exporter, or payment intermediary.

## Publication checklist

- Confirm legal entity name, registered address, privacy email, support email, age threshold, governing law, venue/dispute process, fees, and liability wording.
- Publish reviewed Privacy Policy and Terms at stable HTTPS URLs and place those URLs in the app and Play Console.
- Fix the high-priority Firestore findings and verify them with authenticated/unauthenticated negative tests.
- Verify deletion of live records, public projections, Storage objects, receipts, shared records, logs, backups, and third-party copies against the final retention schedule.
- Generate and inspect the signed release manifest/AAB; verify every Play permission and data-safety declaration on a real device.
- Resolve and verify `gemfort.app` DNS/hosting before using it for public listing/share links or legal pages.
- Use the Google Play deletion requirements as a final submission check: [Google Play account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111).
