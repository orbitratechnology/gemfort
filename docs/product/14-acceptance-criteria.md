# ACCEPTANCE-CRITERIA.md
## Epic-Level Acceptance Criteria

---

### 14.1 Authentication Epic

```
  AC-AUTH-001
  GIVEN a new user downloads the app
  WHEN they tap Register
  THEN they can enter email, phone, and password
  AND select their role (Trader, Lapidary, Gem Lab)
  AND their user document is created with that role and verificationStatus none
  AND receive an OTP to verify their phone
  AND their user document is created in Firestore with correct defaults

  AC-AUTH-002
  GIVEN a registered user
  WHEN they log in with correct credentials
  THEN they are taken to the role-appropriate home screen
  AND their lastActiveAt timestamp is updated

  AC-AUTH-003
  GIVEN a suspended user
  WHEN they attempt to log in
  THEN they see a suspension message with the reason
  AND cannot access any app features

  AC-AUTH-004
  GIVEN a logged-in user
  WHEN they tap Forgot Password
  THEN they receive a password reset email
  AND can reset and log back in successfully
```

### 14.2 GemNet Directory Epic

```
  AC-GDIR-001
  GIVEN a guest user (no login)
  WHEN they open the Directory tab
  THEN they see all verified and active businesses
  AND can filter by type, location, and verification status
  AND can tap WhatsApp and Phone buttons to contact businesses
  AND cannot see members-only listings

  AC-GDIR-002
  GIVEN a user applies search filters
  WHEN results are returned
  THEN featured businesses appear first
  THEN full-verified businesses appear above basic-verified
  THEN unverified businesses appear last
  AND suspended businesses never appear

  AC-GDIR-003
  GIVEN a user on the directory
  WHEN they tap a business card
  THEN the business profile opens
  AND shows all 4 sections (Business, Services, Gallery, Contact)
  AND only shows contact buttons for channels the business enabled
  AND gallery photos are tappable to full-screen view

  AC-GDIR-004
  GIVEN a user taps Near Me filter
  WHEN they grant location permission
  THEN results show businesses within 25km radius
  AND are sorted by distance first, then rank score
  AND the radius can be adjusted by the user

  AC-GDIR-005
  GIVEN a user on a business profile
  WHEN they tap WhatsApp
  THEN the WhatsApp app opens with the business number pre-filled
  AND the tap is counted in the business analytics
  AND this does NOT send a notification to the business owner
```

### 14.3 Business Verification Epic

```
  AC-VERIF-001
  GIVEN a user wants to verify their business
  WHEN they submit a verification application with all documents
  THEN their application appears in the admin verification queue
  AND their status changes to "pending"
  AND they receive a notification confirming submission

  AC-VERIF-002
  GIVEN an admin reviews an application
  WHEN they approve it as Full Verified
  THEN the business verificationStatus changes to "verified"
  AND verificationTier changes to "full"
  AND the verified badge appears on their profile immediately
  AND the business appears in directory search results
  AND the applicant receives a verification_approved notification
  AND an admin_actions record is created with admin UID and timestamp

  AC-VERIF-003
  GIVEN an admin requests more information
  WHEN they submit the info request with specific text
  THEN the applicant receives a notification with the request
  AND can upload additional documents
  AND the updated application goes back to admin queue

  AC-VERIF-004
  GIVEN a verified business receives 3 confirmed fraud reports
  WHEN admin takes action to revoke verification
  THEN the verified badge is removed immediately
  AND the business drops in search ranking
  AND the business owner receives an account_action notification
  AND an audit log entry is created
```

### 14.4 Gem Listings Epic

```
  AC-LIST-001
  GIVEN a verified seller
  WHEN they create a gem listing from their GemTrack inventory
  THEN all gem properties are auto-filled from the GemTrack record
  AND they can adjust title, price, and visibility
  AND a shareable URL is generated (gemnet.app/l/[slug])
  AND the listing appears based on the visibility setting selected

  AC-LIST-002
  GIVEN a seller sets listing to Private
  WHEN the listing is published
  THEN it does NOT appear in directory search
  AND it does NOT appear in the announcements board
  AND it IS accessible via the shareable link without login
  AND the seller can share via WhatsApp from within the app

  AC-LIST-003
  GIVEN a seller marks a listing as Sold
  WHEN the action is confirmed
  THEN the listing disappears from public view immediately
  AND appears in the seller's private sold history
  AND if linked to GemTrack, the gem status updates to Sold
  AND the sold price is never visible to any other user or admin

  AC-LIST-004
  GIVEN a buyer visits a shareable listing link
  WHEN the link is opened (with or without login)
  THEN they see the full gem details, seller info, and contact buttons
  AND can tap WhatsApp to contact the seller
  AND cannot see the seller's minimum price or internal notes
  AND the view is counted in the listing analytics
```

### 14.5 GemTrack Gem Inventory Epic

```
  AC-GEM-001
  GIVEN a user adds a new gem
  WHEN they complete all steps and confirm
  THEN a gem document is created in gemtrack_gems
  AND an SKU is auto-generated (GF-YYYY-NNNNN)
  AND the initial status is set to "rough" if rough weight only
  AND an initial gem_events record is created
  AND the gem appears in their inventory list immediately

  AC-GEM-002
  GIVEN a gem has been through cutting and received back
  WHEN the user records the return with new weight
  THEN the gem status updates to "cut"
  AND the weight_after is recorded on the service record
  AND the weight_loss_percentage is calculated and stored
  AND a gem_events record is created with the weight change
  AND the cutting cost is added to gemtrack_gem_costs
  AND the gem's totalCost is recalculated

  AC-GEM-003
  GIVEN a user views a gem's profit calculator
  WHEN all costs have been recorded
  THEN they see each cost line with type, amount, and date
  AND the total cost is the sum of all cost lines
  AND if a selling price or asking price is set
  THEN the net profit and ROI percentage are shown
  AND the minimum price is visible only to the owner

  AC-GEM-004
  GIVEN a gem has been through multiple service providers
  WHEN the user views the lifecycle timeline
  THEN they see a chronological list of all events
  AND each event shows status change, date, weight, and any photo
  AND events are in correct chronological order
  AND no events can be deleted (immutable history)
```

### 14.6 AP Stone Epic

```
  AC-AP-001
  GIVEN a user gives a gem on AP to a broker
  WHEN they complete the AP record
  THEN the gem status updates to "on_ap"
  AND currentHolderContactId is set to the broker's contact ID
  AND the AP record is created with minimum price and expected return date
  AND the gem no longer appears as available to give on AP again

  AC-AP-002
  GIVEN an AP stone is overdue (past expectedReturnDate)
  WHEN the daily Cloud Function runs
  THEN the user receives an AP_OVERDUE notification
  AND the AP record on the dashboard shows an overdue indicator
  AND this continues daily until status changes

  AC-AP-003
  GIVEN an AP broker sells the gem for more than the minimum price
  WHEN the user records the sale in the AP record
  THEN soldPrice is stored
  AND ownerReceives is set to ownerMinimumPrice (automatically)
  AND apHolderCommission is calculated as soldPrice minus ownerMinimumPrice
  AND the gem status updates to "sold"
  AND a profit calculation is available using ownerReceives as revenue

  AC-AP-004
  GIVEN a payment for an AP sale is recorded as a cheque
  WHEN the cheque is added
  THEN the AP payment record links to the cheque ID
  AND the cheque appears in the cheque tracker
  AND the AP paymentStatus shows "partial" until cheque clears
  AND when cheque status changes to cleared
  THEN the AP paymentStatus updates to "paid"
```

### 14.7 Cheque Tracker Epic

```
  AC-CHQ-001
  GIVEN a user receives a post-dated cheque from a buyer
  WHEN they add the cheque with all details including maturity date
  THEN the cheque appears in the cheque list with status "holding"
  AND appears on the cheque calendar on its maturity date
  AND a photo of the cheque can be captured and stored

  AC-CHQ-002
  GIVEN a cheque is maturing tomorrow
  WHEN the daily Cloud Function runs at 08:00 local time
  THEN the cheque owner receives a CHEQUE_MATURING_TOMORROW notification
  AND the notification includes the amount and the issuer's name

  AC-CHQ-003
  GIVEN a user marks a cheque as bounced
  WHEN the action is confirmed with a bounce reason
  THEN the cheque status changes to "bounced"
  AND a high-priority CHEQUE_BOUNCED notification is sent
  AND the cheque appears highlighted in red on the dashboard
  AND a [Mark Replaced] action is available

  AC-CHQ-004
  GIVEN the cheque calendar is viewed
  THEN every date with maturing cheques shows the total amount for that day
  AND tapping a date shows the list of cheques maturing on that day
  AND the monthly total of all incoming cheques is shown at the top
```

### 14.8 Admin Epic

```
  AC-ADMIN-001
  GIVEN an admin takes any action (approve, suspend, ban, feature, etc.)
  THEN an admin_actions document is created immediately
  AND contains: adminUid, actionType, targetType, targetId, reason, timestamp
  AND this document can never be updated or deleted by any user including admin

  AC-ADMIN-002
  GIVEN a business has 3 or more active fraud reports
  WHEN admin views the fraud report list
  THEN the business is highlighted with the highest priority flag
  AND the business's rankScore is reduced immediately (deprioritised)
  AND the business does NOT auto-suspend (admin must confirm action)

  AC-ADMIN-003
  GIVEN admin posts a new announcement
  WHEN it is published
  THEN it appears on all users' home screens immediately
  AND users with push notifications enabled receive a notification
  AND admin can edit or hide the announcement at any time

  AC-ADMIN-004
  GIVEN a user is suspended
  WHEN they attempt to create, update, or delete any document
  THEN the Firestore security rule rejects the operation
  AND the user sees an appropriate message in the app
  AND they can still read their own data (GemTrack)
```

### 14.9 Notifications Epic

```
  AC-NOTIF-001
  GIVEN a user has notifications enabled
  WHEN a relevant trigger occurs
  THEN they receive an in-app notification
  AND a push notification (if app is in background)
  AND the notification badge count increments on the bell icon

  AC-NOTIF-002
  GIVEN a user taps a notification
  THEN the notification is marked as read
  AND the app navigates to the relevant screen
  (e.g., AP overdue → opens AP detail for that stone)

  AC-NOTIF-003
  GIVEN a user has disabled push for a specific notification type
  WHEN that trigger fires
  THEN the in-app notification IS created
  AND the push notification is NOT sent
  AND the bell badge still increments

  AC-NOTIF-004
  GIVEN verification status changes to info_requested
  WHEN the user receives the notification
  THEN tapping it opens their verification application
  AND shows the specific information requested by admin
  AND shows the resubmit document upload flow
```
