import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'normal_user' | 'verified_seller' | 'verified_provider' | 'admin';
export type VerificationStatus =
  | 'none'
  | 'pending'
  | 'info_requested'
  | 'under_review'
  | 'basic'
  | 'verified'
  | 'rejected'
  | 'revoked';

export type UserProfile = {
  uid: string;
  email: string;
  phone: string;
  displayName: string;
  role: UserRole;
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
  };
  phoneVerified?: boolean;
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
  updatedAt: Timestamp;
};

export type BusinessType =
  | 'seller'
  | 'cutter'
  | 'heat_treatment'
  | 'chemical_treatment'
  | 'polisher'
  | 'lab'
  | 'jewelry_maker';

export type Business = {
  id: string;
  ownerUid: string;
  businessType: BusinessType;
  businessName: string;
  ownerName: string;
  brNumber: string;
  ngjaNumber: string;
  yearEstablished: number | null;
  shortDescription: string;
  address: string;
  city: string;
  district: string;
  province: string;
  country: string;
  verificationStatus: VerificationStatus;
  verificationTier: 'none' | 'basic' | 'full';
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
    gemSpecializations: string[];
    isAcceptingOrders: boolean;
    portfolioCount: number;
  } | null;
  contacts: Record<
    string,
    { value: string; isVisible: boolean }
  >;
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
  isFeatured: boolean;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Announcement = {
  id: string;
  type: 'platform' | 'industry_news' | 'featured_spotlight' | 'new_listing';
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
  | 'rough'
  | 'with_cutter'
  | 'cut'
  | 'with_heater'
  | 'heated'
  | 'with_polisher'
  | 'polished'
  | 'certified'
  | 'ready_for_sale'
  | 'on_ap'
  | 'on_trip'
  | 'listed'
  | 'sold'
  | 'returned';

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
  providerContactId: string;
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
  status: 'given' | 'in_progress' | 'completed' | 'received_back' | 'overdue';
  finalCost: number | null;
  finalCostCurrency: string | null;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ApRecord = {
  id: string;
  ownerUid: string;
  gemId: string;
  apHolderContactId: string;
  ownerMinimumPrice: number;
  currency: string;
  dateGiven: Timestamp;
  expectedDurationDays: number;
  expectedReturnDate: Timestamp;
  agreementNotes: string | null;
  status: 'with_holder' | 'sold' | 'returned' | 'overdue' | 'disputed';
  soldPrice: number | null;
  ownerReceives: number | null;
  apHolderCommission: number | null;
  soldDate: Timestamp | null;
  paymentStatus: 'pending' | 'partial' | 'paid';
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Transaction = {
  id: string;
  ownerUid: string;
  type: 'income' | 'expense';
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
  description: string;
  dueDate: Timestamp;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
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
  description: string;
  dueDate: Timestamp;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type PaymentDirection = 'in' | 'out';

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
  gemId: string | null;
  contactId: string | null;
  transactionId: string | null;
  notes: string | null;
  paymentDate: Timestamp;
  createdAt: Timestamp;
};

export type FinancialReportType =
  | 'profit_loss'
  | 'cash_flow'
  | 'inventory_value'
  | 'outstanding_payments'
  | 'cheque_maturity';

export type ChequeDirection = 'received' | 'given';

export type ChequeStatus =
  | 'holding'
  | 'deposited'
  | 'cleared'
  | 'bounced'
  | 'replaced'
  | 'cancelled';

export type Cheque = {
  id: string;
  ownerUid: string;
  direction: ChequeDirection;
  chequeNumber: string;
  bankName: string;
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
  tripId: string | null;
  notes: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type TripType = 'sourcing' | 'selling' | 'both';

export type TripStatus = 'planning' | 'ongoing' | 'completed' | 'cancelled';

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

export type TripGemRole = 'purchase' | 'parcel';

export type TripGemStatus = 'on_trip' | 'sold' | 'returned';

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
  visibility: 'private' | 'members_only' | 'public';
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
  status: 'active' | 'reserved' | 'sold' | 'paused' | 'draft';
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
  priority?: 'high' | 'medium' | 'low';
  isRead: boolean;
  isPushSent?: boolean;
  createdAt: Timestamp;
};

export type FraudReportType =
  | 'fake_business'
  | 'scammer'
  | 'wrong_information'
  | 'fake_gems'
  | 'harassment'
  | 'other';

export type FraudReport = {
  id: string;
  reporterUid: string;
  reportedBusinessId: string;
  reportedUserUid: string | null;
  reportType: FraudReportType;
  description: string;
  evidenceUrls: string[];
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
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
  applicationType: 'seller' | 'provider';
  status: string;
  documents: {
    brNumber: string | null;
    brPhotoUrl: string | null;
    ngjaNumber: string | null;
    ngjaPhotoUrl: string | null;
    nicPhotoUrl: string | null;
    businessPhotosUrls: string[];
    addressProofUrl: string | null;
    otherDocUrls: string[];
  };
  submittedAt: Timestamp;
};
