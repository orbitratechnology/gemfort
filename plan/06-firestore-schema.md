# FIRESTORE-SCHEMA.md
## Data Model

---

### 6.1 Collection Index

```
  PUBLIC COLLECTIONS (GemNet)
  ├── users
  ├── businesses
  ├── gems                     (GemNet listings only)
  ├── announcements
  ├── endorsements
  ├── reports
  ├── verification_applications
  ├── notifications
  └── admin_actions

  PRIVATE COLLECTIONS (GemTrack)
  ├── gemtrack_gems
  ├── gemtrack_gem_costs
  ├── gemtrack_gem_events      (lifecycle timeline)
  ├── gemtrack_services
  ├── gemtrack_ap_records
  ├── gemtrack_ap_payments
  ├── gemtrack_cheques
  ├── gemtrack_payments
  ├── gemtrack_receivables
  ├── gemtrack_payables
  ├── gemtrack_transactions
  ├── gemtrack_trips
  ├── gemtrack_trip_expenses
  ├── gemtrack_trip_gems
  ├── gemtrack_contacts
  └── gemtrack_certificates

  ENTERPRISE COLLECTIONS
  ├── companies
  ├── company_members
  ├── company_approvals
  └── company_audit_logs
```

### 6.2 Full Schema Definitions

```javascript
// ═══════════════════════════════════════
// users
// ═══════════════════════════════════════
{
  uid:                    string,      // Firebase Auth UID (document ID)
  email:                  string,
  phone:                  string,
  displayName:            string,
  role:                   string,
  // "trader" | "lapidary" | "gem_lab" | "admin"
  verificationStatus:     string,
  // "none" | "pending" | "info_requested" | "under_review"
  // "basic" | "verified" | "rejected" | "revoked"
  preferredCurrency:      string,      // "LKR" | "USD" | "THB" | "CNY"
  preferredLanguage:      string,      // "en" | "si" | "ta"
  isActive:               boolean,
  isSuspended:            boolean,
  suspendedReason:        string | null,
  suspendedAt:            timestamp | null,
  companyId:              string | null,
  fcmToken:               string | null,  // for push notifications
  createdAt:              timestamp,
  lastActiveAt:           timestamp,
  updatedAt:              timestamp
}

// ═══════════════════════════════════════
// businesses
// ═══════════════════════════════════════
{
  id:                     string,      // auto-generated document ID
  ownerUid:               string,
  businessType:           string,
  // "trader" | "lapidary" | "gem_lab"
  // "polisher" | "lab" | "jewelry_maker"

  // IDENTITY
  businessName:           string,
  ownerName:              string,
  brNumber:               string,
  ngjaNumber:             string,
  yearEstablished:        number | null,
  shortDescription:       string,      // max 200 characters

  // LOCATION
  address:                string,
  city:                   string,
  district:               string,
  province:               string,
  country:                string,
  geoPoint:               GeoPoint,

  // VERIFICATION
  verificationStatus:     string,
  // "none" | "pending" | "info_requested" | "under_review"
  // "basic" | "verified" | "rejected" | "revoked"
  verificationTier:       string,      // "none" | "basic" | "full"
  verifiedAt:             timestamp | null,
  verifiedByAdminUid:     string | null,
  lastVerificationCheck:  timestamp | null,

  verificationDocuments: {
    brPhotoUrl:           string | null,
    ngjaPhotoUrl:         string | null,
    nicPhotoUrl:          string | null,
    businessPhotosUrls:   string[],
    addressProofUrl:      string | null,
    otherDocUrls:         string[]
  },

  // BADGES (system-maintained, not user-editable)
  badges: {
    isVerified:           boolean,
    isBasicVerified:      boolean,
    isNgjaRegistered:     boolean,
    isPremium:            boolean,
    verifiedSinceYear:    number | null,
    yearsActive:          number,
    hasRepeatBusiness:    boolean,
    listingMilestone:     number,      // 0 | 10 | 50 | 100 | 500
    endorsementCount:     number
  },

  // SELLER PROFILE (null for providers)
  sellerProfile: {
    gemSpecializations:   string[],
    // ["ruby","blue_sapphire","padparadscha","emerald",
    //  "cat_eye","star_sapphire","spinel","garnet",
    //  "tourmaline","rough_stones","other"]
    sourceOrigins:        string[],
    // ["sri_lanka","tanzania","madagascar","burma","other"]
    stoneTypes:           string[],
    // ["rough","cut_polished","certified","lots"]
    priceRangeMin:        number | null,
    priceRangeMax:        number | null,
    preferredCurrencies:  string[]
  } | null,

  // PROVIDER PROFILE (null for sellers)
  providerProfile: {
    services: [
      {
        serviceId:        string,      // uuid
        name:             string,
        category:         string,
        // "cutting" | "heat_treatment" | "chemical_treatment"
        // "polishing" | "lab_certification" | "jewelry_making"
        pricingType:      string,      // "per_carat" | "per_stone" | "fixed"
        priceMin:         number,
        priceMax:         number,
        currency:         string,
        turnaroundDaysMin: number,
        turnaroundDaysMax: number,
        description:      string,
        isActive:         boolean
      }
    ],
    gemSpecializations:   string[],
    isAcceptingOrders:    boolean,
    portfolioCount:       number
  } | null,

  // CONTACT (user controls visibility of each)
  contacts: {
    whatsapp:    { value: string, isVisible: boolean },
    phone:       { value: string, isVisible: boolean },
    phone2:      { value: string, isVisible: boolean },
    facebook:    { value: string, isVisible: boolean },
    instagram:   { value: string, isVisible: boolean },
    wechat:      { value: string, isVisible: boolean },
    email:       { value: string, isVisible: boolean }
  },

  // MEDIA
  logoUrl:                string | null,
  coverPhotoUrl:          string | null,
  galleryPhotos: [
    {
      photoId:            string,
      url:                string,
      type:               string,      // "single" | "before_after"
      beforeUrl:          string | null,
      afterUrl:           string | null,
      caption:            string | null,
      uploadedAt:         timestamp
    }
  ],

  // ANALYTICS (Cloud Functions maintain this)
  analytics: {
    profileViewsTotal:        number,
    profileViewsThisMonth:    number,
    profileViewsLastMonth:    number,
    whatsappTapsTotal:        number,
    whatsappTapsThisMonth:    number,
    phoneTapsTotal:           number,
    phoneTapsThisMonth:       number,
    facebookTapsThisMonth:    number,
    wechatTapsThisMonth:      number,
    activeListingsCount:      number,
    totalListingsEver:        number,
    analyticsMonth:           string    // "2025-01"
  },

  // FEATURED (admin controlled)
  isFeatured:             boolean,
  featuredUntil:          timestamp | null,
  featuredByAdminUid:     string | null,
  featuredPaidUntil:      timestamp | null,

  // SUBSCRIPTION
  subscriptionPlan:       string,
  // "free" | "premium" | "enterprise"
  subscriptionExpiry:     timestamp | null,

  isActive:               boolean,
  createdAt:              timestamp,
  updatedAt:              timestamp
}

// ═══════════════════════════════════════
// gems  (GemNet public listings only)
// ═══════════════════════════════════════
{
  id:                     string,
  sellerUid:              string,
  businessId:             string,
  gemTrackId:             string | null,   // linked GemTrack gem

  title:                  string,
  description:            string | null,
  visibility:             string,
  // "private" | "members_only" | "public"

  // GEM PROPERTIES
  gemType:                string,
  variety:                string | null,
  caratWeight:            number,
  color:                  string,
  clarity:                string | null,
  shape:                  string | null,
  cutType:                string | null,
  origin:                 string,
  treatmentStatus:        string,
  // "natural" | "heated" | "heated_chemical" | "chemical"
  // "filled" | "diffused" | "other"
  isCertified:            boolean,
  certifyingLab:          string | null,
  certificateNumber:      string | null,

  // PRICING
  showPrice:              boolean,
  priceDisplay:           string | null,   // "USD 2,000 – 2,500"
  priceMin:               number | null,
  priceMax:               number | null,
  currency:               string,

  // MEDIA
  photoUrls:              string[],        // max 10
  videoUrl:               string | null,

  // STATUS
  status:                 string,
  // "active" | "reserved" | "sold" | "paused" | "draft"
  soldAt:                 timestamp | null,
  soldPrice:              number | null,   // PRIVATE: never shown to others

  // ANALYTICS (Cloud Functions only)
  analytics: {
    totalViews:           number,
    uniqueViews:          number,
    whatsappTaps:         number,
    phoneTaps:            number,
    linkOpens:            number
  },

  // SHARING
  shareableSlug:          string,          // "GN-00345"
  shareableUrl:           string,          // "gemnet.app/l/GN-00345"

  createdAt:              timestamp,
  updatedAt:              timestamp,
  publishedAt:            timestamp | null
}

// ═══════════════════════════════════════
// announcements
// ═══════════════════════════════════════
{
  id:                     string,
  type:                   string,
  // "platform" | "industry_news" | "featured_spotlight" | "new_listing"
  title:                  string,
  content:                string | null,
  externalUrl:            string | null,
  linkedBusinessId:       string | null,
  linkedGemId:            string | null,
  imageUrl:               string | null,
  isVisible:              boolean,
  publishedAt:            timestamp | null,
  expiresAt:              timestamp | null,
  createdByAdminUid:      string,
  createdAt:              timestamp
}

// ═══════════════════════════════════════
// endorsements
// ═══════════════════════════════════════
{
  id:                     string,
  fromBusinessId:         string,
  toBusinessId:           string,
  fromUid:                string,          // stored, never shown publicly
  createdAt:              timestamp
}

// ═══════════════════════════════════════
// reports
// ═══════════════════════════════════════
{
  id:                     string,
  reporterUid:            string,
  reportedBusinessId:     string,
  reportedUserUid:        string | null,
  reportType:             string,
  // "fake_business" | "scammer" | "wrong_information"
  // "fake_gems" | "harassment" | "other"
  description:            string,
  evidenceUrls:           string[],
  status:                 string,
  // "pending" | "investigating" | "resolved" | "dismissed"
  adminUid:               string | null,
  adminNotes:             string | null,
  resolution:             string | null,
  actionTaken:            string | null,
  // "warning" | "suspension" | "ban" | "no_action"
  createdAt:              timestamp,
  updatedAt:              timestamp,
  resolvedAt:             timestamp | null
}

// ═══════════════════════════════════════
// verification_applications
// ═══════════════════════════════════════
{
  id:                     string,
  applicantUid:           string,
  businessId:             string,
  applicationType:        string,          // "trader" | "lapidary" | "gem_lab"
  servicesOffered:        string[],        // required for lapidary
  documents: {
    // + gemLicenseNumber, gemLicensePhotoUrl, tinNumber for trader/gem_lab
  status:                 string,
  // "pending" | "under_review" | "info_requested" | "approved" | "rejected"
  documents: {
    brNumber:             string | null,
    brPhotoUrl:           string | null,
    ngjaNumber:           string | null,
    ngjaPhotoUrl:         string | null,
    nicPhotoUrl:          string | null,
    businessPhotosUrls:   string[],
    addressProofUrl:      string | null,
    otherDocUrls:         string[]
  },
  adminUid:               string | null,
  adminNotes:             string,
  infoRequested:          string | null,   // specific request text
  rejectionReason:        string | null,
  submittedAt:            timestamp,
  reviewedAt:             timestamp | null,
  resolvedAt:             timestamp | null,
  resubmittedAt:          timestamp | null
}

// ═══════════════════════════════════════
// notifications
// ═══════════════════════════════════════
{
  id:                     string,
  recipientUid:           string,
  type:                   string,
  // "verification_approved" | "verification_rejected"
  // "verification_info_requested" | "new_announcement"
  // "report_resolved" | "account_warning" | "account_suspended"
  title:                  string,
  message:                string,
  referenceType:          string | null,
  referenceId:            string | null,
  isRead:                 boolean,
  isPushSent:             boolean,
  createdAt:              timestamp
}

// ═══════════════════════════════════════
// admin_actions  (immutable audit log)
// ═══════════════════════════════════════
{
  id:                     string,
  adminUid:               string,
  actionType:             string,
  // "verify_business" | "reject_business" | "revoke_verification"
  // "suspend_user" | "ban_user" | "reinstate_user"
  // "feature_business" | "remove_feature"
  // "resolve_report" | "dismiss_report"
  // "post_announcement" | "delete_announcement"
  // "delete_listing"
  targetType:             string,          // "user" | "business" | "listing"
  targetId:               string,
  reason:                 string,
  metadata:               object,          // additional context
  createdAt:              timestamp
}

// ═══════════════════════════════════════
// gemtrack_gems
// ═══════════════════════════════════════
{
  id:                     string,
  ownerUid:               string,
  companyId:              string | null,
  sku:                    string,          // "GF-2025-00345"

  // ORIGIN
  gemType:                string,
  variety:                string | null,
  originCountry:          string,
  originMine:             string | null,
  sourcingTripId:         string | null,
  acquiredFromContactId:  string | null,
  acquisitionType:        string,
  // "mined" | "purchased" | "traded" | "gift"
  acquisitionDate:        timestamp,
  acquisitionCost:        number,
  acquisitionCurrency:    string,
  acquisitionCostBase:    number,          // converted to base currency

  // PHYSICAL
  roughWeight:            number,          // carats
  currentWeight:          number,
  dimensionsL:            number | null,
  dimensionsW:            number | null,
  dimensionsH:            number | null,
  colorPrimary:           string | null,
  colorSecondary:         string | null,
  colorTone:              string | null,
  colorSaturation:        string | null,
  clarity:                string | null,
  cutType:                string | null,
  shape:                  string | null,

  // TREATMENT
  isNatural:              boolean,
  treatmentStatus:        string,
  treatmentDetails:       string | null,

  // STATUS
  status:                 string,
  // (see full status list in Section 7.10)
  currentLocation:        string | null,
  currentHolderContactId: string | null,

  // COSTS (totalCost maintained by Cloud Function)
  totalCost:              number,
  totalCostCurrency:      string,

  // PRICING
  askingPrice:            number | null,
  askingPriceCurrency:    string | null,
  minimumPrice:           number | null,   // PRIVATE
  minimumPriceCurrency:   string | null,

  // SALE
  soldPrice:              number | null,
  soldPriceCurrency:      string | null,
  soldDate:               timestamp | null,
  soldToContactId:        string | null,

  // MEDIA
  photoUrls:              string[],
  videoUrls:              string[],
  qrCodeUrl:              string | null,

  // GEMNET LINK
  isListedOnGemNet:       boolean,
  gemNetListingId:        string | null,

  notes:                  string | null,
  tags:                   string[],
  createdAt:              timestamp,
  updatedAt:              timestamp
}

// ═══════════════════════════════════════
// gemtrack_gem_costs
// ═══════════════════════════════════════
{
  id:                     string,
  gemId:                  string,
  ownerUid:               string,
  costType:               string,
  // "acquisition" | "cutting" | "heat_treatment"
  // "chemical_treatment" | "polishing" | "lab_certification"
  // "trip_overhead" | "transport" | "insurance"
  // "commission" | "other"
  description:            string | null,
  amount:                 number,
  currency:               string,
  amountBase:             number,          // converted to base currency
  serviceRecordId:        string | null,
  tripId:                 string | null,
  paidToContactId:        string | null,
  date:                   timestamp,
  createdAt:              timestamp
}

// ═══════════════════════════════════════
// gemtrack_gem_events  (lifecycle timeline)
// ═══════════════════════════════════════
{
  id:                     string,
  gemId:                  string,
  ownerUid:               string,
  eventType:              string,
  // "status_change" | "cost_added" | "photo_added"
  // "certificate_added" | "weight_updated" | "note_added"
  fromStatus:             string | null,
  toStatus:               string | null,
  description:            string,
  weightAtEvent:          number | null,
  photoUrl:               string | null,
  costAdded:              number | null,
  relatedServiceId:       string | null,
  relatedApId:            string | null,
  relatedDealId:          string | null,
  createdByUid:           string,
  createdAt:              timestamp
}

// ═══════════════════════════════════════
// gemtrack_services
// ═══════════════════════════════════════
{
  id:                     string,
  ownerUid:               string,
  gemId:                  string,
  serviceType:            string,
  // "cutting" | "re_cutting" | "heat_treatment" | "chemical_treatment"
  // "polishing" | "lab_certification" | "other"
  providerContactId:      string,
  providerUserId:         string | null,
  providerBusinessId:     string | null,

  // BEFORE
  dateGiven:              timestamp,
  expectedReturnDate:     timestamp,
  weightBefore:           number,
  photoBeforeUrls:        string[],
  instructions:           string | null,
  agreedPrice:            number | null,
  agreedPriceCurrency:    string | null,
  advancePaid:            number,

  // AFTER
  dateReturned:           timestamp | null,
  weightAfter:            number | null,
  weightLossPercent:      number | null,   // auto-calculated
  photoAfterUrls:         string[],
  resultNotes:            string | null,
  qualityRating:          number | null,   // 1-5, private

  // STATUS AND PAYMENT
  status:                 string,
  // "given" | "in_progress" | "completed" | "received_back" | "overdue"
  finalCost:              number | null,
  finalCostCurrency:      string | null,
  paymentStatus:          string,
  // "unpaid" | "partial" | "paid"
  paymentMethod:          string | null,
  paymentDate:            timestamp | null,

  certificateId:          string | null,

  createdAt:              timestamp,
  updatedAt:              timestamp
}

// ═══════════════════════════════════════
// gemtrack_ap_records
// ═══════════════════════════════════════
{
  id:                     string,
  ownerUid:               string,
  gemId:                  string,
  apHolderContactId:      string,
  apHolderUserId:         string | null,

  // TERMS
  ownerMinimumPrice:      number,
  currency:               string,
  dateGiven:              timestamp,
  expectedDurationDays:   number,
  expectedReturnDate:     timestamp,
  agreementNotes:         string | null,
  photoAtGivingUrl:       string | null,

  // OUTCOME
  status:                 string,
  // "with_holder" | "sold" | "returned" | "overdue" | "disputed"
  soldPrice:              number | null,
  ownerReceives:          number | null,   // = ownerMinimumPrice
  apHolderCommission:     number | null,   // = soldPrice - ownerMinimumPrice
  soldDate:               timestamp | null,
  buyerContactId:         string | null,
  buyerDetails:           string | null,
  returnDate:             timestamp | null,
  returnCondition:        string | null,

  // PAYMENT
  paymentStatus:          string,
  // "pending" | "partial" | "paid" | "overdue"
  totalPaid:              number,
  balanceDue:             number,

  tripId:                 string | null,   // if given on selling trip

  createdAt:              timestamp,
  updatedAt:              timestamp
}

// ═══════════════════════════════════════
// gemtrack_ap_payments
// ═══════════════════════════════════════
{
  id:                     string,
  apRecordId:             string,
  ownerUid:               string,
  amount:                 number,
  currency:               string,
  paymentMethod:          string,
  // "cash" | "cheque" | "bank_transfer" | "other"
  chequeId:               string | null,
  paymentDate:            timestamp,
  notes:                  string | null,
  createdAt:              timestamp
}

// ═══════════════════════════════════════
// gemtrack_cheques
// ═══════════════════════════════════════
{
  id:                     string,
  ownerUid:               string,
  direction:              string,          // "received" | "given"
  chequeNumber:           string,
  bankName:               string,
  branch:                 string | null,
  amount:                 number,
  currency:               string,
  amountBase:             number,
  counterpartyContactId:  string,
  issuedBy:               string,          // name for display
  issueDate:              timestamp,
  maturityDate:           timestamp,
  depositedDate:          timestamp | null,
  clearedDate:            timestamp | null,
  status:                 string,
  // "received" | "holding" | "deposited"
  // "cleared" | "bounced" | "replaced" | "cancelled"
  bouncedReason:          string | null,
  replacementChequeId:    string | null,
  photoUrl:               string | null,
  dealId:                 string | null,
  gemId:                  string | null,
  apRecordId:             string | null,
  tripId:                 string | null,
  notes:                  string | null,
  createdAt:              timestamp,
  updatedAt:              timestamp
}

// ═══════════════════════════════════════
// gemtrack_trips
// ═══════════════════════════════════════
{
  id:                     string,
  ownerUid:               string,
  companyId:              string | null,
  tripName:               string,
  tripType:               string,          // "sourcing" | "selling" | "both"
  destinationCountry:     string,
  destinationCity:        string,
  startDate:              timestamp,
  expectedEndDate:        timestamp,
  actualEndDate:          timestamp | null,
  budget:                 number,
  budgetCurrency:         string,
  cashCarried:            number,
  status:                 string,
  // "planning" | "ongoing" | "completed" | "cancelled"

  // COMPUTED SUMMARY (Cloud Function maintained)
  summary: {
    totalExpenses:        number,
    totalGemsPurchased:   number,
    totalGemsSold:        number,
    totalRevenue:         number,
    netResult:            number,
    gemsOnAp:             number,
    gemsReturned:         number
  },

  notes:                  string | null,
  createdAt:              timestamp,
  updatedAt:              timestamp
}

// ═══════════════════════════════════════
// gemtrack_trip_expenses
// ═══════════════════════════════════════
{
  id:                     string,
  tripId:                 string,
  ownerUid:               string,
  date:                   timestamp,
  category:               string,
  // "flight" | "accommodation" | "food" | "transport"
  // "guide_fee" | "mine_visit" | "communication" | "medical"
  // "shipping" | "exhibition" | "entertainment" | "equipment" | "other"
  description:            string | null,
  amount:                 number,
  currency:               string,
  amountBase:             number,
  paymentMethod:          string | null,
  receiptPhotoUrl:        string | null,
  createdAt:              timestamp
}

// ═══════════════════════════════════════
// gemtrack_contacts
// ═══════════════════════════════════════
{
  id:                     string,
  ownerUid:               string,
  name:                   string,
  companyName:            string | null,
  phones:                 string[],
  whatsapp:               string | null,
  email:                  string | null,
  address:                string | null,
  city:                   string | null,
  country:                string | null,
  contactTypes:           string[],
  // ["mine_owner","dealer","cutter","heater","chemical_treatment",
  //  "polisher","lab","broker","ap_holder","buyer","exporter",
  //  "guide","jewelry_maker","other"]
  specialization:         string | null,
  trustLevel:             number | null,   // 1-5, private
  personalNotes:          string | null,   // private
  photoUrl:               string | null,
  isAppUser:              boolean,
  linkedUserId:           string | null,
  linkedBusinessId:       string | null,

  // COMPUTED STATS (Cloud Function maintained)
  stats: {
    totalDealsWithThem:     number,
    totalGemsBoughtFrom:    number,
    totalGemsSoldTo:        number,
    totalServicesUsed:      number,
    totalApGiven:           number,
    apSuccessRate:          number,
    outstandingReceivable:  number,
    outstandingPayable:     number,
    bouncedChequesCount:    number,
    lastInteractionDate:    timestamp | null
  },

  createdAt:              timestamp,
  updatedAt:              timestamp
}

// ═══════════════════════════════════════
// gemtrack_transactions  (ledger)
// ═══════════════════════════════════════
{
  id:                     string,
  ownerUid:               string,
  companyId:              string | null,
  type:                   string,          // "income" | "expense"
  category:               string,
  // INCOME: "gem_sale" | "ap_income" | "commission_earned"
  //         "service_income" | "other_income"
  // EXPENSE: "gem_purchase" | "cutting_fee" | "heat_treatment_fee"
  //          "chemical_treatment_fee" | "polishing_fee"
  //          "lab_certification_fee" | "trip_expense" | "transport"
  //          "insurance" | "commission_paid" | "broker_fee"
  //          "rent" | "salary" | "marketing" | "equipment"
  //          "office" | "tax" | "other_expense"
  amount:                 number,
  currency:               string,
  amountBase:             number,
  description:            string | null,
  transactionDate:        timestamp,
  gemId:                  string | null,
  apRecordId:             string | null,
  serviceRecordId:        string | null,
  tripId:                 string | null,
  chequeId:               string | null,
  contactId:              string | null,
  paymentMethod:          string | null,
  receiptUrl:             string | null,
  notes:                  string | null,
  isAutoGenerated:        boolean,
  createdAt:              timestamp
}

// ═══════════════════════════════════════
// gemtrack_receivables
// ═══════════════════════════════════════
{
  id:                     string,
  ownerUid:               string,
  debtorContactId:        string,
  totalAmount:            number,
  paidAmount:             number,
  balance:                number,          // totalAmount - paidAmount
  currency:               string,
  dueDate:                timestamp | null,
  status:                 string,
  // "pending" | "partial" | "paid" | "overdue" | "written_off"
  gemId:                  string | null,
  apRecordId:             string | null,
  tripId:                 string | null,
  description:            string | null,
  notes:                  string | null,
  reminderSentAt:         timestamp | null,
  createdAt:              timestamp,
  updatedAt:              timestamp
}

// ═══════════════════════════════════════
// gemtrack_payables
// ═══════════════════════════════════════
{
  id:                     string,
  ownerUid:               string,
  creditorContactId:      string,
  totalAmount:            number,
  paidAmount:             number,
  balance:                number,
  currency:               string,
  dueDate:                timestamp | null,
  status:                 string,
  // "pending" | "partial" | "paid" | "overdue"
  gemId:                  string | null,
  serviceRecordId:        string | null,
  description:            string | null,
  notes:                  string | null,
  createdAt:              timestamp,
  updatedAt:              timestamp
}

// ═══════════════════════════════════════
// gemtrack_certificates
// ═══════════════════════════════════════
{
  id:                     string,
  gemId:                  string,
  ownerUid:               string,
  labName:                string,
  // "GRS" | "GIA" | "AGL" | "SSL" | "GIT" | "other"
  certificateNumber:      string,
  certificateDate:        timestamp,
  fileUrl:                string,
  fileType:               string,          // "pdf" | "image"
  reportType:             string,
  // "full" | "brief" | "origin" | "memo" | "appraisal"
  resultsSummary: {
    weight:               string | null,
    color:                string | null,
    origin:               string | null,
    treatment:            string | null,
    clarity:              string | null
  },
  cost:                   number | null,
  verificationCode:       string | null,   // for QR verification
  serviceRecordId:        string | null,
  createdAt:              timestamp
}

// ═══════════════════════════════════════
// companies  (enterprise)
// ═══════════════════════════════════════
{
  id:                     string,
  name:                   string,
  registrationNumber:     string,
  ownerUid:               string,
  address:                string,
  city:                   string,
  country:                string,
  logoUrl:                string | null,
  subscriptionPlan:       string,          // "enterprise_10" | "enterprise_unlimited"
  subscriptionExpiry:     timestamp,
  maxUsers:               number | null,   // null = unlimited
  isActive:               boolean,
  createdAt:              timestamp,
  updatedAt:              timestamp
}

// ═══════════════════════════════════════
// company_members  (enterprise)
// ═══════════════════════════════════════
{
  id:                     string,
  companyId:              string,
  userUid:                string,
  subRole:                string,
  // "owner" | "manager" | "accountant" | "sales" | "viewer"
  permissions: {
    canViewAllGems:       boolean,
    canEditGems:          boolean,
    canViewFinancials:    boolean,
    canEditFinancials:    boolean,
    canManageAP:          boolean,
    canViewReports:       boolean,
    canExportReports:     boolean,
    canManageUsers:       boolean,
    canApproveActions:    boolean
  },
  invitedAt:              timestamp,
  acceptedAt:             timestamp | null,
  isActive:               boolean,
  createdAt:              timestamp
}
```
