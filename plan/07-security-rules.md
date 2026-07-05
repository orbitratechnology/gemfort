# SECURITY-RULES.md
## Firestore Security Rules

---

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ═══════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════

    function isSignedIn() {
      return request.auth != null;
    }

    function uid() {
      return request.auth.uid;
    }

    function isOwner(ownerUid) {
      return isSignedIn() && uid() == ownerUid;
    }

    function getUserData() {
      return get(/databases/$(database)/documents/users/$(uid())).data;
    }

    function getUserRole() {
      return getUserData().role;
    }

    function isNotSuspended() {
      return getUserData().isSuspended == false;
    }

    function isAdmin() {
      return isSignedIn() && getUserRole() == 'admin';
    }

    function isVerifiedSeller() {
      return isSignedIn()
        && getUserRole() == 'verified_seller'
        && getUserData().verificationStatus == 'verified'
        && isNotSuspended();
    }

    function isVerifiedProvider() {
      return isSignedIn()
        && getUserRole() == 'verified_provider'
        && getUserData().verificationStatus == 'verified'
        && isNotSuspended();
    }

    function isVerifiedMember() {
      return isVerifiedSeller() || isVerifiedProvider();
    }

    function isAnySignedIn() {
      return isSignedIn() && isNotSuspended();
    }

    function isBusinessOwner(businessData) {
      return isSignedIn() && uid() == businessData.ownerUid;
    }

    function isGemOwner(gemData) {
      return isSignedIn() && uid() == gemData.ownerUid;
    }

    // Fields that only admin can change on businesses
    function isProtectedBusinessField(fieldName) {
      return fieldName in [
        'verificationStatus', 'verificationTier',
        'verifiedAt', 'verifiedByAdminUid',
        'isFeatured', 'featuredUntil', 'featuredByAdminUid',
        'badges.isVerified', 'badges.isNgjaRegistered',
        'analytics', 'isActive', 'subscriptionPlan',
        'subscriptionExpiry'
      ];
    }

    // ═══════════════════════════════════════════════
    // USERS
    // ═══════════════════════════════════════════════

    match /users/{userId} {

      allow read: if isOwner(userId) || isAdmin();

      allow create: if isOwner(userId)
        && request.resource.data.role == 'normal_user'
        && request.resource.data.isSuspended == false
        && request.resource.data.verificationStatus == 'none';

      allow update: if isOwner(userId)
        && isNotSuspended()
        && !request.resource.data.diff(resource.data)
           .affectedKeys().hasAny([
             'role', 'verificationStatus', 'isSuspended',
             'isActive', 'suspendedReason', 'suspendedAt'
           ]);

      allow update: if isAdmin();

      allow delete: if isAdmin();
    }

    // ═══════════════════════════════════════════════
    // BUSINESSES
    // ═══════════════════════════════════════════════

    match /businesses/{businessId} {

      // Verified + active businesses are public
      allow read: if resource.data.verificationStatus == 'verified'
                  && resource.data.isActive == true;

      // Owner reads own (even pending)
      allow read: if isSignedIn()
                  && isBusinessOwner(resource.data);

      // Admin reads all
      allow read: if isAdmin();

      // Verified members can create business profile
      allow create: if isAnySignedIn()
        && isOwner(request.resource.data.ownerUid)
        && request.resource.data.verificationStatus == 'none'
        && request.resource.data.isActive == true
        && request.resource.data.isFeatured == false
        && request.resource.data.badges.isVerified == false
        && request.resource.data.badges.endorsementCount == 0
        && request.resource.data.analytics.profileViewsTotal == 0;

      // Owner updates own (not protected fields)
      allow update: if isAnySignedIn()
        && isBusinessOwner(resource.data)
        && !request.resource.data.diff(resource.data)
           .affectedKeys().hasAny([
             'verificationStatus', 'verificationTier',
             'verifiedAt', 'verifiedByAdminUid',
             'isFeatured', 'featuredUntil', 'featuredByAdminUid',
             'badges', 'analytics', 'isActive',
             'subscriptionPlan', 'subscriptionExpiry',
             'ownerUid'
           ]);

      // Admin controls all fields
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }

    // ═══════════════════════════════════════════════
    // GEMS (GemNet listings)
    // ═══════════════════════════════════════════════

    match /gems/{gemId} {

      // Public listings visible to all
      allow read: if resource.data.visibility == 'public'
                  && resource.data.status == 'active';

      // Shareable link — private listings accessible via direct read
      // (enforced by slug-based lookup, not security rule)
      allow read: if resource.data.visibility == 'private'
                  && isOwner(resource.data.sellerUid);

      // Members-only listings
      allow read: if resource.data.visibility == 'members_only'
                  && isAnySignedIn();

      // Owner reads all their own listings
      allow read: if isOwner(resource.data.sellerUid);

      // Admin reads all
      allow read: if isAdmin();

      // Only verified sellers create listings
      allow create: if isVerifiedSeller()
        && isOwner(request.resource.data.sellerUid)
        && request.resource.data.soldAt == null
        && request.resource.data.soldPrice == null
        && request.resource.data.analytics.totalViews == 0
        && request.resource.data.analytics.whatsappTaps == 0;

      // Owner updates own (analytics via Cloud Functions only)
      allow update: if isOwner(resource.data.sellerUid)
        && isNotSuspended()
        && !request.resource.data.diff(resource.data)
           .affectedKeys().hasAny([
             'analytics', 'shareableSlug', 'shareableUrl',
             'sellerUid', 'businessId'
           ]);

      allow delete: if isOwner(resource.data.sellerUid)
                    || isAdmin();
    }

    // ═══════════════════════════════════════════════
    // ANNOUNCEMENTS
    // ═══════════════════════════════════════════════

    match /announcements/{announcementId} {
      allow read: if resource.data.isVisible == true;
      allow read: if isAdmin();
      allow write: if isAdmin();
    }

    // ═══════════════════════════════════════════════
    // ENDORSEMENTS
    // ═══════════════════════════════════════════════

    match /endorsements/{endorsementId} {

      // Only admin reads individual endorsements (privacy)
      allow read: if isAdmin();

      // Verified members can endorse others
      allow create: if isVerifiedMember()
        && isOwner(request.resource.data.fromUid)
        // Cannot endorse self
        && request.resource.data.fromBusinessId
           != request.resource.data.toBusinessId
        // Cannot update existing endorsements
        && !exists(/databases/$(database)/documents/endorsements/
             $(request.resource.data.fromBusinessId +
               '_' + request.resource.data.toBusinessId));

      // Endorsements are permanent (no update or user delete)
      allow update: if false;
      allow delete: if isAdmin();
    }

    // ═══════════════════════════════════════════════
    // REPORTS
    // ═══════════════════════════════════════════════

    match /reports/{reportId} {
      allow read: if isOwner(resource.data.reporterUid);
      allow read: if isAdmin();

      allow create: if isAnySignedIn()
        && isOwner(request.resource.data.reporterUid)
        && request.resource.data.status == 'pending'
        && request.resource.data.adminUid == null;

      allow update: if isAdmin();
      allow delete: if isAdmin();
    }

    // ═══════════════════════════════════════════════
    // VERIFICATION APPLICATIONS
    // ═══════════════════════════════════════════════

    match /verification_applications/{appId} {
      allow read: if isOwner(resource.data.applicantUid);
      allow read: if isAdmin();

      allow create: if isAnySignedIn()
        && isOwner(request.resource.data.applicantUid)
        && request.resource.data.status == 'pending'
        && request.resource.data.adminUid == null;

      // Applicant can resubmit when info requested
      allow update: if isOwner(resource.data.applicantUid)
        && resource.data.status == 'info_requested'
        && !request.resource.data.diff(resource.data)
           .affectedKeys().hasAny([
             'status', 'adminUid', 'adminNotes',
             'rejectionReason', 'resolvedAt', 'reviewedAt'
           ]);

      allow update: if isAdmin();
      allow delete: if isAdmin();
    }

    // ═══════════════════════════════════════════════
    // NOTIFICATIONS
    // ═══════════════════════════════════════════════

    match /notifications/{notifId} {
      allow read: if isOwner(resource.data.recipientUid);

      // User can only mark as read
      allow update: if isOwner(resource.data.recipientUid)
        && request.resource.data.diff(resource.data)
           .affectedKeys().hasOnly(['isRead']);

      // Created by Cloud Functions (admin token)
      allow create: if isAdmin();
      allow delete: if isOwner(resource.data.recipientUid)
                    || isAdmin();
    }

    // ═══════════════════════════════════════════════
    // ADMIN ACTIONS (immutable audit log)
    // ═══════════════════════════════════════════════

    match /admin_actions/{actionId} {
      allow read: if isAdmin();
      allow create: if isAdmin();
      // Immutable — no updates or deletes ever
      allow update: if false;
      allow delete: if false;
    }

    // ═══════════════════════════════════════════════
    // GEMTRACK — ALL COLLECTIONS ARE PRIVATE
    // Pattern: ownerUid must match auth uid
    // ═══════════════════════════════════════════════

    match /gemtrack_gems/{docId} {
      allow read, write: if isOwner(resource.data.ownerUid)
                         && isNotSuspended();
      allow create: if isAnySignedIn()
        && isOwner(request.resource.data.ownerUid);
      allow read, write: if isAdmin();
    }

    match /gemtrack_gem_costs/{docId} {
      allow read, write: if isOwner(resource.data.ownerUid)
                         && isNotSuspended();
      allow create: if isAnySignedIn()
        && isOwner(request.resource.data.ownerUid);
      allow read, write: if isAdmin();
    }

    match /gemtrack_gem_events/{docId} {
      allow read: if isOwner(resource.data.ownerUid);
      allow create: if isAnySignedIn()
        && isOwner(request.resource.data.ownerUid);
      // Events are immutable once created
      allow update: if false;
      allow delete: if isAdmin();
      allow read, write: if isAdmin();
    }

    match /gemtrack_services/{docId} {
      allow read, write: if isOwner(resource.data.ownerUid)
                         && isNotSuspended();
      allow create: if isAnySignedIn()
        && isOwner(request.resource.data.ownerUid);
      allow read, write: if isAdmin();
    }

    match /gemtrack_ap_records/{docId} {
      allow read, write: if isOwner(resource.data.ownerUid)
                         && isNotSuspended();
      allow create: if isAnySignedIn()
        && isOwner(request.resource.data.ownerUid);
      allow read, write: if isAdmin();
    }

    match /gemtrack_ap_payments/{docId} {
      allow read, write: if isOwner(resource.data.ownerUid)
                         && isNotSuspended();
      allow create: if isAnySignedIn()
        && isOwner(request.resource.data.ownerUid);
      allow read, write: if isAdmin();
    }

    match /gemtrack_cheques/{docId} {
      allow read, write: if isOwner(resource.data.ownerUid)
                         && isNotSuspended();
      allow create: if isAnySignedIn()
        && isOwner(request.resource.data.ownerUid);
      allow read, write: if isAdmin();
    }

    match /gemtrack_payments/{docId} {
      allow read, write: if isOwner(resource.data.ownerUid)
                         && isNotSuspended();
      allow create: if isAnySignedIn()
        && isOwner(request.resource.data.ownerUid);
      allow read, write: if isAdmin();
    }

    match /gemtrack_receivables/{docId} {
      allow read, write: if isOwner(resource.data.ownerUid)
                         && isNotSuspended();
      allow create: if isAnySignedIn()
        && isOwner(request.resource.data.ownerUid);
      allow read, write: if isAdmin();
    }

    match /gemtrack_payables/{docId} {
      allow read, write: if isOwner(resource.data.ownerUid)
                         && isNotSuspended();
      allow create: if isAnySignedIn()
        && isOwner(request.resource.data.ownerUid);
      allow read, write: if isAdmin();
    }

    match /gemtrack_transactions/{docId} {
      allow read, write: if isOwner(resource.data.ownerUid)
                         && isNotSuspended();
      allow create: if isAnySignedIn()
        && isOwner(request.resource.data.ownerUid);
      allow read, write: if isAdmin();
    }

    match /gemtrack_trips/{docId} {
      allow read, write: if isOwner(resource.data.ownerUid)
                         && isNotSuspended();
      allow create: if isAnySignedIn()
        && isOwner(request.resource.data.ownerUid);
      allow read, write: if isAdmin();
    }

    match /gemtrack_trip_expenses/{docId} {
      allow read, write: if isOwner(resource.data.ownerUid)
                         && isNotSuspended();
      allow create: if isAnySignedIn()
        && isOwner(request.resource.data.ownerUid);
      allow read, write: if isAdmin();
    }

    match /gemtrack_contacts/{docId} {
      allow read, write: if isOwner(resource.data.ownerUid)
                         && isNotSuspended();
      allow create: if isAnySignedIn()
        && isOwner(request.resource.data.ownerUid);
      allow read, write: if isAdmin();
    }

    match /gemtrack_certificates/{docId} {
      allow read, write: if isOwner(resource.data.ownerUid)
                         && isNotSuspended();
      allow create: if isAnySignedIn()
        && isOwner(request.resource.data.ownerUid);
      allow read, write: if isAdmin();
    }

    // ═══════════════════════════════════════════════
    // ENTERPRISE COLLECTIONS
    // ═══════════════════════════════════════════════

    match /companies/{companyId} {
      allow read: if isAdmin()
        || get(/databases/$(database)/documents/
           company_members/$(companyId + '_' + uid())).data.isActive == true;
      allow write: if isAdmin();
    }

    match /company_members/{memberId} {
      allow read: if isAdmin()
        || resource.data.userUid == uid();
      allow write: if isAdmin();
    }

    match /company_approvals/{approvalId} {
      allow read: if isAdmin()
        || resource.data.requestedByUid == uid()
        || resource.data.approverUid == uid();
      allow create: if isAnySignedIn();
      allow update: if isAdmin()
        || resource.data.approverUid == uid();
      allow delete: if isAdmin();
    }

    match /company_audit_logs/{logId} {
      allow read: if isAdmin()
        || get(/databases/$(database)/documents/
           company_members/$(resource.data.companyId +
           '_' + uid())).data.subRole in ['owner', 'manager'];
      allow create: if isAnySignedIn();
      // Immutable
      allow update: if false;
      allow delete: if false;
    }
  }
}
```
