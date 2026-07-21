import type { Timestamp } from "firebase/firestore";

export type UserRole = "trader" | "lapidary" | "gem_lab" | "admin";
export type VerificationStatus =
  | "none"
  | "pending"
  | "info_requested"
  | "under_review"
  | "basic"
  | "verified"
  | "rejected"
  | "revoked";

export type UserProfile = {
  uid: string;
  email: string;
  phone: string;
  displayName: string;
  role: UserRole;
  /** Legacy signup field; prefer `role` (set at registration). */
  roleIntent?: UserRole | string;
  verificationStatus: VerificationStatus;
  preferredCurrency: string;
  preferredLanguage: string;
  isActive: boolean;
  isSuspended: boolean;
  suspendedReason: string | null;
  suspendedAt: Timestamp | null;
  companyId: string | null;
  fcmToken: string | null;
  notificationPreferences?: {
    pushAnnouncements?: boolean;
    pushChequeAlerts?: boolean;
    pushApAlerts?: boolean;
    pushPaymentAlerts?: boolean;
    pushBillAlerts?: boolean;
  };
  phoneVerified?: boolean;
  /** ISO date `YYYY-MM-DD` — collected during verification. */
  dateOfBirth?: string | null;
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
  updatedAt: Timestamp;
};

export type BusinessType = "trader" | "lapidary" | "gem_lab" | string;

/** Priced certificate tier on a Gem Lab public profile. */
export type LabCertificateOffering = {
  id: string;
  title: string;
  description: string;
  /** Flat fee; null means inquire / not set. */
  price: number | null;
  currency: string;
  isActive: boolean;
};

export type Business = {
  id: string;
  ownerUid: string;
  businessType: BusinessType;
  businessName: string;
  ownerName: string;
  brNumber: string;
  ngjaNumber: string;
  gemLicenseNumber?: string;
  tinNumber?: string;
  yearEstablished: number | null;
  shortDescription: string;
  address: string;
  city: string;
  district: string;
  province: string;
  country: string;
  verificationStatus: VerificationStatus;
  verificationTier: "none" | "basic" | "full";
  badges: {
    isVerified: boolean;
    isBasicVerified: boolean;
    isNgjaRegistered: boolean;
    isPremium: boolean;
    verifiedSinceYear: number | null;
    yearsActive: number;
    hasRepeatBusiness: boolean;
    listingMilestone: number;
    endorsementCount: number;
  };
  sellerProfile: {
    gemSpecializations: string[];
    sourceOrigins: string[];
    stoneTypes: string[];
    priceRangeMin: number | null;
    priceRangeMax: number | null;
    preferredCurrencies: string[];
  } | null;
  providerProfile: {
    services: {
      serviceId: string;
      name: string;
      category: string;
      pricingType: string;
      priceMin: number;
      priceMax: number;
      currency: string;
      turnaroundDaysMin: number;
      turnaroundDaysMax: number;
      description: string;
      isActive: boolean;
    }[];
    servicesOffered?: string[];
    gemSpecializations: string[];
    isAcceptingOrders: boolean;
    portfolioCount: number;
  } | null;
  labProfile?: {
    accreditations: string[];
    /** @deprecated Prefer certificateOfferings; kept for directory chips / legacy. */
    reportTypes: string[];
    /** Public certificate menu with prices — edited by the lab. */
    certificateOfferings?: LabCertificateOffering[];
    isAcceptingOrders: boolean;
    certificatesIssued: number;
  } | null;
  contacts: Record<string, { value: string; isVisible: boolean }>;
  /** Public social / web presence — empty string means not set. */
  socialLinks?: {
    website?: string;
    instagram?: string;
    tiktok?: string;
    facebook?: string;
    wechat?: string;
  };
  logoUrl: string | null;
  coverPhotoUrl: string | null;
  galleryPhotos: {
    photoId: string;
    url: string;
    type: string;
    beforeUrl: string | null;
    afterUrl: string | null;
    caption: string | null;
    uploadedAt: Timestamp;
  }[];
  analytics?: {
    profileViewsTotal: number;
    listingViewsTotal: number;
    whatsappTapsTotal: number;
    phoneTapsTotal: number;
  };
  isFeatured: boolean;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Announcement = {
  id: string;
  type: "platform" | "industry_news" | "featured_spotlight" | "new_listing";
  title: string;
  content: string | null;
  externalUrl: string | null;
  linkedBusinessId: string | null;
  linkedGemId: string | null;
  imageUrl: string | null;
  isVisible: boolean;
  publishedAt: Timestamp | null;
  expiresAt: Timestamp | null;
  createdAt: Timestamp;
};

export type GemStatus =
  | "rough"
  | "with_cutter"
  | "cut"
  | "with_heater"
  | "heated"
  | "with_polisher"
  | "polished"
  | "certified"
  | "ready_for_sale"
  | "on_ap"
  | "on_trip"
  | "listed"
  | "sold"
  | "returned";

export type WorkspaceGem = {
  id: string;
  ownerUid: string;
  companyId: string | null;
  sku: string;
  gemType: string;
  variety: string | null;
  originCountry: string;
  originMine: string | null;
  acquisitionType: string;
  acquisitionDate: Timestamp;
  acquisitionCost: number;
  acquisitionCurrency: string;
  acquisitionCostBase: number;
  roughWeight: number;
  currentWeight: number;
  colorPrimary: string | null;
  clarity: string | null;
  cutType: string | null;
  shape: string | null;
  isNatural: boolean;
  treatmentStatus: string;
  treatmentDetails: string | null;
  status: GemStatus;
  currentLocation: string | null;
  currentHolderContactId: string | null;
  totalCost: number;
  totalCostCurrency: string;
  askingPrice: number | null;
  askingPriceCurrency: string | null;
  minimumPrice: number | null;
  minimumPriceCurrency: string | null;
  soldPrice: number | null;
  soldPriceCurrency: string | null;
  soldDate: Timestamp | null;
  photoUrls: string[];
  isListedOnMarketplace: boolean;
  marketplaceListingId: string | null;
  notes: string | null;
  tags: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type GemEvent = {
  id: string;
  gemId: string;
  ownerUid: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  description: string;
  weightAtEvent: number | null;
  photoUrl: string | null;
  costAdded: number | null;
  relatedServiceId: string | null;
  relatedApId: string | null;
  createdByUid: string;
  createdAt: Timestamp;
};

export type GemCost = {
  id: string;
  gemId: string;
  ownerUid: string;
  costType: string;
  description: string | null;
  amount: number;
  currency: string;
  amountBase: number;
  serviceRecordId: string | null;
  date: Timestamp;
  createdAt: Timestamp;
};

export type ServiceRecord = {
  id: string;
  ownerUid: string;
  gemId: string;
  serviceType: string;
  /** Local saved contact (Workspace → Contacts). Empty when provider is a GemFort business. */
  providerContactId: string;
  /** Verified GemFort lapidary / gem lab business, when selected from Providers tab. */
  providerBusinessId?: string | null;
  /** Denormalized display name for list/detail screens. */
  providerName?: string | null;
  dateGiven: Timestamp;
  expectedReturnDate: Timestamp;
  weightBefore: number;
  photoBeforeUrls: string[];
  instructions: string | null;
  agreedPrice: number | null;
  agreedPriceCurrency: string | null;
  advancePaid: number;
  dateReturned: Timestamp | null;
  weightAfter: number | null;
  weightLossPercent: number | null;
  photoAfterUrls: string[];
  resultNotes: string | null;
  status: "given" | "in_progress" | "completed" | "received_back" | "overdue";
  finalCost: number | null;
  finalCostCurrency: string | null;
  paymentStatus: "unpaid" | "partial" | "paid";
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ApLifecycleStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "payment_sent"
  | "done"
  /** @deprecated Legacy single-gem statuses — normalized on read */
  | "with_holder"
  | "sold"
  | "returned"
  | "overdue"
  | "disputed";

export type ApGemLineStatus = "held" | "sold" | "returned";

export type ApPaymentMethod = "cash" | "transfer" | "cheque";

export type ApGemLine = {
  gemId: string;
  gemLabel: string;
  agreedPrice: number;
  currency: string;
  lineStatus: ApGemLineStatus;
  soldPrice: number | null;
  soldToName: string | null;
  soldDate: Timestamp | null;
  ownerReceives: number | null;
  commission: number | null;
  paymentDueDate: Timestamp | null;
};

export type ApRecord = {
  id: string;
  /** Alias of senderUid — kept for wipe scripts & legacy queries */
  ownerUid: string;
  senderUid: string;
  receiverUid: string;
  receiverContactId: string;
  receiverBusinessId: string | null;
  receiverName: string;
  senderName: string;
  items: ApGemLine[];
  status: ApLifecycleStatus;
  expectedReturnDate: Timestamp;
  expectedDurationDays: number;
  dateGiven: Timestamp | null;
  agreementNotes: string | null;
  paymentMethod: ApPaymentMethod | null;
  paymentAmount: number | null;
  paymentSentAt: Timestamp | null;
  paymentReceivedAt: Timestamp | null;
  paymentChequeId: string | null;
  rejectionReason: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // ── Legacy single-gem fields (optional; used for migration on read) ──
  gemId?: string;
  apHolderContactId?: string;
  ownerMinimumPrice?: number;
  currency?: string;
  soldPrice?: number | null;
  ownerReceives?: number | null;
  apHolderCommission?: number | null;
  soldDate?: Timestamp | null;
  paymentStatus?: "pending" | "partial" | "paid";
};

export type Contact = {
  id: string;
  ownerUid: string;
  displayName: string;
  companyName: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  contactTypes: string[];
  notes: string | null;
  isFavourite: boolean;
  /** Firebase Storage download URL for contact photo */
  photoUrl: string | null;
  /** Device address-book ID when imported from phone contacts */
  deviceContactId: string | null;
  /** GemFort business profile matched 1:1 by phone (trader / lapidary / lab). */
  linkedBusinessId: string | null;
  linkedBusinessName: string | null;
  linkedBusinessType: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Transaction = {
  id: string;
  ownerUid: string;
  type: "income" | "expense";
  amount: number;
  currency: string;
  amountBase: number;
  category: string;
  description: string;
  gemId: string | null;
  contactId: string | null;
  date: Timestamp;
  createdAt: Timestamp;
};

export type Receivable = {
  id: string;
  ownerUid: string;
  contactId: string;
  amount: number;
  amountReceived: number;
  currency: string;
  /** LKR equivalent of `amount` at create/update time. */
  amountBase?: number;
  description: string;
  dueDate: Timestamp;
  status: "pending" | "partial" | "paid" | "overdue";
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Payable = {
  id: string;
  ownerUid: string;
  contactId: string;
  amount: number;
  amountPaid: number;
  currency: string;
  /** LKR equivalent of `amount` at create/update time. */
  amountBase?: number;
  description: string;
  dueDate: Timestamp;
  status: "pending" | "partial" | "paid" | "overdue";
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type PaymentDirection = "in" | "out";

export type Payment = {
  id: string;
  ownerUid: string;
  direction: PaymentDirection;
  amount: number;
  currency: string;
  amountBase: number;
  paymentMethod: string | null;
  commission: number | null;
  receivableId: string | null;
  payableId: string | null;
  billId: string | null;
  gemId: string | null;
  contactId: string | null;
  transactionId: string | null;
  notes: string | null;
  paymentDate: Timestamp;
  createdAt: Timestamp;
};

export type FinancialReportType =
  | "profit_loss"
  | "cash_flow"
  | "inventory_value"
  | "outstanding_payments"
  | "cheque_maturity";

export type ChequeDirection = "received" | "given";

export type BillDirection = "payable" | "receivable";

export type BillStatus =
  | "open"
  | "partial"
  | "paid"
  | "cancelled"
  | "overdue";

export type Bill = {
  id: string;
  ownerUid: string;
  direction: BillDirection;
  amount: number;
  currency: string;
  amountBase: number;
  /** Paid or received so far */
  amountSettled: number;
  /**
   * Percent of each settlement taken as commission from the face amount
   * (owner's private books only — never paid out or notified externally).
   * Payable → commission is income for the bill owner.
   * Receivable → commission is tracked as the counterparty's cut on your books.
   */
  commissionPercent: number | null;
  counterpartyContactId: string;
  dueDate: Timestamp;
  status: BillStatus;
  /** Primary / legacy single gem link (first of `gemIds` when set). */
  gemId: string | null;
  /** Linked stones for this bill (optional). */
  gemIds: string[];
  notes: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ChequeStatus =
  | "holding"
  | "deposited"
  | "cleared"
  | "bounced"
  | "replaced"
  | "cancelled";

export type Cheque = {
  id: string;
  ownerUid: string;
  direction: ChequeDirection;
  chequeNumber: string;
  bankName: string;
  /** LankaClear / CEFTS bank code when selected from directory */
  bankCode?: string | null;
  branch: string | null;
  amount: number;
  currency: string;
  amountBase: number;
  counterpartyContactId: string;
  issuedBy: string;
  issueDate: Timestamp;
  maturityDate: Timestamp;
  depositedDate: Timestamp | null;
  clearedDate: Timestamp | null;
  status: ChequeStatus;
  bouncedReason: string | null;
  replacementChequeId: string | null;
  photoUrl: string | null;
  gemId: string | null;
  apRecordId: string | null;
  /** Linked bill when cheque settles / records a bill payment */
  billId: string | null;
  tripId: string | null;
  notes: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type TripType = "sourcing" | "selling" | "both";

export type TripStatus = "planning" | "ongoing" | "completed" | "cancelled";

export type Trip = {
  id: string;
  ownerUid: string;
  companyId: string | null;
  tripName: string;
  tripType: TripType;
  destinationCountry: string;
  destinationCity: string;
  startDate: Timestamp;
  expectedEndDate: Timestamp;
  actualEndDate: Timestamp | null;
  budget: number;
  budgetCurrency: string;
  cashCarried: number;
  status: TripStatus;
  summary: {
    totalExpenses: number;
    totalGemsPurchased: number;
    totalGemsSold: number;
    totalRevenue: number;
    netResult: number;
    gemsOnAp: number;
    gemsReturned: number;
  };
  notes: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type TripGemRole = "purchase" | "parcel";

export type TripGemStatus = "on_trip" | "sold" | "returned";

export type TripGem = {
  id: string;
  tripId: string;
  ownerUid: string;
  gemId: string;
  role: TripGemRole;
  purchaseCost: number | null;
  salePrice: number | null;
  saleDate: Timestamp | null;
  status: TripGemStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type TripExpense = {
  id: string;
  tripId: string;
  ownerUid: string;
  date: Timestamp;
  category: string;
  description: string | null;
  amount: number;
  currency: string;
  amountBase: number;
  paymentMethod: string | null;
  receiptPhotoUrl: string | null;
  createdAt: Timestamp;
};

export type MarketplaceListing = {
  id: string;
  sellerUid: string;
  businessId: string;
  workspaceGemId: string | null;
  title: string;
  description: string | null;
  visibility: "private" | "members_only" | "public";
  gemType: string;
  caratWeight: number;
  color: string;
  clarity: string | null;
  shape: string | null;
  origin: string;
  treatmentStatus: string;
  isCertified: boolean;
  certifyingLab: string | null;
  certificateNumber: string | null;
  showPrice: boolean;
  priceMin: number | null;
  priceMax: number | null;
  currency: string;
  photoUrls: string[];
  status: "active" | "reserved" | "sold" | "paused" | "draft";
  shareableSlug: string;
  shareableUrl: string;
  analytics: { totalViews: number; whatsappTaps: number };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt: Timestamp | null;
};

export type AppNotification = {
  id: string;
  recipientUid: string;
  type: string;
  title: string;
  message: string;
  referenceType: string | null;
  referenceId: string | null;
  priority?: "high" | "medium" | "low";
  isRead: boolean;
  isPushSent?: boolean;
  createdAt: Timestamp;
};

export type FraudReportType =
  | "fake_business"
  | "scammer"
  | "wrong_information"
  | "fake_gems"
  | "harassment"
  | "other";

export type FraudReport = {
  id: string;
  reporterUid: string;
  reportedBusinessId: string;
  reportedUserUid: string | null;
  reportType: FraudReportType;
  description: string;
  evidenceUrls: string[];
  status: "pending" | "investigating" | "resolved" | "dismissed";
  adminUid: string | null;
  adminNotes: string | null;
  resolution: string | null;
  actionTaken: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  resolvedAt: Timestamp | null;
};

export type Endorsement = {
  id: string;
  fromBusinessId: string;
  toBusinessId: string;
  fromUid: string;
  createdAt: Timestamp;
};

export type VerificationApplication = {
  id: string;
  applicantUid: string;
  businessId: string;
  applicationType: "trader" | "lapidary" | "gem_lab" | string;
  status: string;
  /** ISO date `YYYY-MM-DD` — required for KYC. */
  dateOfBirth: string;
  /** Legal business / company name — required for KYC. */
  businessName: string;
  servicesOffered?: string[];
  documents: {
    brNumber: string | null;
    brPhotoUrl: string | null;
    ngjaNumber: string | null;
    ngjaPhotoUrl: string | null;
    nicPhotoUrl: string | null;
    gemLicenseNumber?: string | null;
    gemLicensePhotoUrl?: string | null;
    tinNumber?: string | null;
    businessPhotosUrls: string[];
    addressProofUrl: string | null;
    otherDocUrls: string[];
  };
  submittedAt: Timestamp;
};

export type RequestStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "completed";

export type ServiceRequest = {
  id: string;
  traderUid: string;
  traderBusinessId: string | null;
  lapidaryUid: string;
  lapidaryBusinessId: string;
  gemId: string;
  gemName: string;
  serviceTypes: string[];
  notes: string | null;
  status: RequestStatus;
  jobId: string | null;
  serviceRecordId: string | null;
  rejectReason: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  respondedAt: Timestamp | null;
};

export type LapidaryJob = {
  id: string;
  serviceRequestId: string;
  lapidaryUid: string;
  lapidaryBusinessId: string;
  traderUid: string;
  gemId: string;
  gemName: string;
  serviceTypes: string[];
  status: "queued" | "in_progress" | "ready" | "returned" | "cancelled";
  notes: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type CertificationRequest = {
  id: string;
  traderUid: string;
  traderBusinessId: string | null;
  labUid: string;
  labBusinessId: string;
  gemId: string;
  gemName: string;
  reportType: string;
  notes: string | null;
  status: RequestStatus;
  certificateId: string | null;
  rejectReason: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  respondedAt: Timestamp | null;
};

export type PublicCertificate = {
  id: string;
  labUid: string;
  labBusinessId: string;
  labName: string;
  certificateNumber: string;
  verificationCode: string | null;
  reportType: string;
  certificateDate: Timestamp | null;
  fileUrl: string;
  fileType: string;
  gemId: string | null;
  gemName: string | null;
  traderUid: string | null;
  certificationRequestId: string | null;
  resultsSummary: {
    weight: string | null;
    color: string | null;
    origin: string | null;
    treatment: string | null;
    clarity: string | null;
  };
  visibility: "public";
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// ─── Gem News & Exhibitions ───────────────────────

export type NewsRegion = "local" | "global";

export type NewsTopic =
  | "market"
  | "trade_policy"
  | "regulation"
  | "exhibitions"
  | "industry"
  | "sri_lanka";

export type GemNewsArticle = {
  id: string;
  title: string;
  summary: string;
  url: string;
  canonicalUrl: string;
  source: string;
  sourceId: string;
  region: NewsRegion;
  topics: NewsTopic[];
  publishedAt: Timestamp;
  scrapedAt: Timestamp;
  updatedAt: Timestamp;
  imageUrl: string | null;
  language: string;
  isVisible: boolean;
};

export type GemExhibition = {
  id: string;
  title: string;
  venue: string;
  city: string | null;
  country: string | null;
  startDate: Timestamp;
  endDate: Timestamp;
  updatedAt: Timestamp;
  region: NewsRegion;
  sourceUrl: string;
  sourceId: string;
  isVisible: boolean;
};
