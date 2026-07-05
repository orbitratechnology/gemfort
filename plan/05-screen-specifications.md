# SCREEN-SPECIFICATIONS.md
## Screen-by-Screen Specifications

---

### 5.1 GemNet Screens

---

#### SCREEN: Home (Announcements Board)

```
  ID              GN-SCR-001
  Route           /home
  Access          All users including guests
  Nav bar         Bottom nav: HOME selected

  LAYOUT
  Header
    App logo (left)
    Notification bell with badge (right, signed-in users only)

  Content
    Scrollable list of announcement cards
    Cards sorted by: Featured first, then chronological descending
    Pull to refresh

  CARD TYPES
  Featured Business Card
    Business logo (60x60, circular)
    ⭐ FEATURED label (gold)
    Business name
    Verification badge
    City and specializations
    [WhatsApp button]  [View Profile button]
    Background: subtle gold tint

  New Listing Card
    Seller name and verification badge
    Gem photo (16:9 ratio)
    Gem title and key specs (weight, treatment, certified)
    Price display
    [View Listing button]  [WhatsApp button]

  Industry News Card
    GemNet logo
    📰 label
    Headline (max 80 characters)
    Short summary (max 120 characters)
    [Read More →] link to external URL

  Platform Announcement Card
    GemNet logo
    📢 label
    Announcement text (max 200 characters)
    Optional [Browse Directory →] CTA

  EMPTY STATE
    Illustration of gem
    "No announcements yet"
    "Check back soon"

  BEHAVIOUR
    New listing cards auto-appear when seller publishes public listing
    Featured cards show for the duration of the paid placement
    Cards do not have like, comment, or share functionality
    External news links open in in-app browser
```

---

#### SCREEN: Directory (Search and Filter)

```
  ID              GN-SCR-002
  Route           /directory
  Access          All users including guests
  Nav bar         Bottom nav: DIRECTORY selected

  LAYOUT
  Header
    Search bar (full width)
    Placeholder: "Search businesses or services..."
    Filter row (horizontally scrollable chips)
      📍 Location ▼
      ✅ Verified Only (toggle)
      🔧 Type ▼
      More Filters (opens bottom sheet)

  Tab bar
    [💎 Sellers  142]    [🔧 Service Providers  67]
    Counts update with active filters

  Content (below tabs)
    Scrollable list of Business Cards
    Infinite scroll with pagination
    Loading skeleton on first load

  MAP VIEW TOGGLE
    Globe icon top right
    Switches to map view with business pins
    Tap pin to see mini business card
    [View Profile] button on mini card

  BUSINESS CARD STRUCTURE
    Row 1:  [Logo 48x48]  Business Name  [Verification Badge]
    Row 2:  City · District
    Row 3:  Specialization tags (up to 3, rest hidden with +N)
    Row 4:  Badge row (Since year, Repeat Business, Premium)
    Row 5:  [WhatsApp]  [Call]  [View Profile →]
    Featured card: gold left border, ⭐ FEATURED chip

  FILTER BOTTOM SHEET
    Location section
      Beruwala / Patha
      Ratnapura
      Colombo
      Galle
      Bangkok
      China
      Near Me (requests location permission)
      Other
    Verification section
      All businesses
      Verified only (BR + NGJA)
      Basic verified (ID only)
    Specialization section (Sellers)
      Ruby
      Blue Sapphire
      Yellow Sapphire
      Padparadscha
      Cat's Eye
      Star Sapphire
      Emerald
      Spinel
      Rough Stones
      All types
    Service type section (Providers)
      Cutting
      Heat Treatment
      Chemical Treatment
      Polishing
      Lab / Certification
      Jewelry Making
    [Apply Filters button]  [Reset]

  EMPTY STATE
    "No businesses match your filters"
    [Clear Filters] button
```

---

#### SCREEN: Business Profile

```
  ID              GN-SCR-003
  Route           /business/[businessId]
  Access          Verified businesses visible to all
                  Pending businesses visible to owner only
  Nav bar         Back arrow, no bottom nav

  LAYOUT
  Cover photo (full width, 16:9, optional)
  If no cover: solid brand color background

  Logo (80x80, circular, overlapping cover bottom)
  Business name (H1)
  City, District, Country
  Badge row (all earned badges inline)

  Contact buttons row
    Only buttons where isVisible == true are shown
    [📱 WhatsApp]  [📞 Call]  [📘 Facebook]  [💬 WeChat]
    Minimum: at least one contact method visible
    Buttons open native app (WhatsApp, Phone, Browser)

  Tab navigation (horizontal scroll)
    [Business]  [Services]  [Gallery]  [Contact]
    Sticky below contact buttons when scrolling

  SECTION: BUSINESS
    Short description text
    Gem specializations (for sellers)
      Displayed as chips: [Ruby] [Blue Sapphire] [Padparadscha]
    Source origins (for sellers)
      Displayed as chips: [Sri Lanka] [Tanzania] [Madagascar]
    Stone types (for sellers)
      [Rough] [Cut & Polished] [Certified]

  SECTION: SERVICES
    For sellers: price range if shared, "Contact for pricing" if not
    For providers: service list cards
      Each card:
        Icon + Service name
        Price range and unit
        Turnaround time
    Accepting orders badge (for providers)

  SECTION: GALLERY
    Grid (3 columns, square thumbnails)
    Tap to full-screen with swipe navigation
    Before / after pairs show side by side in full screen
    Max 20 photos (free) or 50 photos (premium)
    Empty state: "No gallery photos yet"

  SECTION: CONTACT
    Full contact details with copy / tap actions
    Map showing city location (not precise address)
    [🚩 Report this business] — small text link at bottom

  ACTIVE GEM LISTINGS (sellers, below sections)
    Shown only if seller has active listings
    Horizontal scroll of listing cards
    [View All Listings] link
    Each card: gem photo, title, price, [WhatsApp] button

  OWNER VIEW (only when viewing own profile)
    [Edit Profile] button top right
    Analytics strip: X views this month · X WhatsApp taps
    Draft indicator if profile is incomplete
```

---

#### SCREEN: Public Listing Page (Shareable)

```
  ID              GN-SCR-004
  Route           gemnet.app/l/[slug]
  Access          Anyone with the link, no login required
  Nav bar         None (standalone page)

  LAYOUT
  GemNet header bar (logo + "Find on GemNet" link)

  Photo carousel (full width, swipeable)
    Up to 10 photos
    Dot indicator at bottom

  Gem title (H1)
  Certification badge row
    ✅ GRS Certified  or  📋 No Certificate
    Treatment badge: Natural / Heated / Chemical etc.

  Properties grid (2 columns)
    Weight: 3.45 ct
    Shape: Oval
    Color: Royal Blue
    Clarity: VS
    Origin: Sri Lanka
    Cut: Brilliant

  Price section
    Price display (USD 2,000 – 2,500)
    Or "Contact for Price" if price hidden

  Divider

  Seller section
    Seller logo + name
    Verification badge
    City
    Badge row (Since year, Premium, etc.)

  CTA buttons (sticky at bottom)
    [📱 WhatsApp to Inquire]  (primary, full width)
    [📞 Call]  [View Seller Profile]  (secondary row)

  Footer
    Powered by GemNet — gemnet.app
    [Find More Gems on GemNet]

  STATUS STATES
    Active:   Full page as above
    Sold:     Overlay "This gem has been sold"
              "Browse more gems on GemNet" CTA
    Paused:   "This listing is not currently available"
    Expired:  "This listing has expired"
```

---

#### SCREEN: Create Gem Listing

```
  ID              GN-SCR-005
  Route           /listings/create
  Access          Verified sellers only

  STEP 1: SOURCE
    From GemTrack inventory
      List of ready-for-sale gems from GemTrack
      Select one gem → auto-fills all fields
    Manual entry → proceed to step 2

  STEP 2: DETAILS
    Title (auto-generated from gem type + weight, editable)
    Gem type (dropdown)
    Carat weight (number input)
    Color (text input)
    Clarity (dropdown: IF, VVS, VS, SI, I)
    Shape (dropdown)
    Origin (dropdown)
    Treatment (dropdown)
    Is certified? (toggle)
    If certified: Lab name + Certificate number

  STEP 3: PHOTOS
    Upload up to 10 photos
    Drag to reorder
    First photo is the listing cover

  STEP 4: PRICING
    Show price? (toggle)
    If yes: Price range (min and max) + currency
    If no: "Contact for price" shown to viewers

  STEP 5: VISIBILITY
    🔒 Private (link only)
    👥 Members Only
    🌐 Public
    Explanation text for each option

  STEP 6: REVIEW
    Preview of the shareable listing card
    [Publish] button
    [Save as Draft] button

  POST-PUBLISH
    Success screen with shareable link
    [Copy Link] [Share on WhatsApp] [Share] buttons
    [View Listing] button
```

---

### 5.2 GemTrack Screens

---

#### SCREEN: GemTrack Dashboard

```
  ID              GT-SCR-001
  Route           /track/dashboard
  Access          All GemTrack users

  LAYOUT
  Header: "Good morning, [Name]" + date

  ALERT CARDS (shown only if relevant, dismissible)
    🔴 Red:   Cheque bounced — action required
    🔴 Red:   AP stone overdue — [contact holder name]
    🟡 Yellow: Cheque maturing tomorrow — LKR X from [name]
    🟡 Yellow: Service overdue — [stone name] with [provider]
    🟡 Yellow: Payment overdue — [person] owes LKR X
    🔵 Blue:  Cheque maturing this week — [count] cheques
    🔵 Blue:  AP payment pending — [count] outstanding

  SUMMARY CARDS (2x2 grid)
    Total Gems in Inventory
    Gems Out (services + AP + trips combined)
    This Month Income (LKR)
    This Month Profit (LKR)

  WHERE ARE MY GEMS (bar chart by status)
    Horizontal bars showing count per status
    Tap bar to filter gem list to that status

  UPCOMING CHEQUES (mini calendar strip)
    Horizontal scroll showing next 7 days
    Each day shows total amount if cheques maturing
    Tap to open cheque calendar

  QUICK ACTIONS
    [+ Add Gem]  [+ Record Service]  [+ AP Stone]  [+ Cheque]
```

---

#### SCREEN: Gem Detail

```
  ID              GT-SCR-002
  Route           /track/gems/[gemId]
  Access          Owner only

  LAYOUT
  Header: SKU number + status badge + [Edit] button + [⋮ More]

  Photo carousel (swipeable, tap to full screen)
  Add photo button (overlay on last photo)

  STATUS TIMELINE BAR
    Visual progress showing current position in lifecycle
    Tap to see full timeline

  PROPERTIES SECTION (expandable)
    Type, Variety, Origin, Mine
    Current weight · Rough weight · Weight loss %
    Color · Clarity · Shape · Cut type
    Treatment status · Treatment details
    Dimensions

  COST BREAKDOWN (expandable)
    Each cost line with type, amount, and date
    Running total at bottom
    Asking price (if set)
    Minimum price (private, only owner sees)
    Calculated profit (if sold or if asking price set)
    ROI percentage

  CERTIFICATES (expandable)
    Each certificate card: Lab, cert number, date, [View PDF]
    [+ Add Certificate] button

  LIFECYCLE TIMELINE (expandable, full history)
    Chronological events
    Each event: date, status change, weight at time,
    cost added, photo thumbnail if available

  CURRENT LOCATION
    Status label
    If with someone: [Contact Name] + contact buttons
    Days since last status change

  ACTION BUTTONS (contextual based on status)
    If Rough:     [Record Cutting] [Add to Trip]
    If Cut:       [Record Heat] [Record Polish] [Give on AP]
    If Ready:     [Give on AP] [Add to Trip] [List on GemNet]
    If On AP:     [View AP Record]
    If On Trip:   [View Trip]
    If Listed:    [View GemNet Listing]
    Always:       [Edit] [Add Cost] [Add Photo]
```

---

#### SCREEN: AP Stone Dashboard

```
  ID              GT-SCR-003
  Route           /track/ap
  Access          Owner only

  LAYOUT
  Header: "AP Stones"
  Summary strip: [Total Out: 12] [Total Value: LKR 18M]
                 [Overdue: 2] [Pending Payment: LKR 4.5M]

  FILTER TABS
    [All]  [With Holder]  [Sold]  [Returned]  [Overdue]

  GROUPED LIST (by AP Holder)
    Holder name + trust rating (private stars)
    Gems with this holder count
    Total minimum value with this holder

    Each gem card:
      Gem photo thumbnail (40x40)
      Gem name and weight
      Minimum price
      Date given · Expected return date
      Status badge
      Days since given
      Overdue indicator if applicable

    [📞 Contact] button on holder group header

  PERFORMANCE SECTION (bottom, collapsible)
    Table: Holder | Given | Sold | Returned | Rate | Avg Days
```

---

#### SCREEN: Cheque Calendar

```
  ID              GT-SCR-004
  Route           /track/cheques/calendar
  Access          Owner only

  LAYOUT
  Header: "Cheque Calendar"

  SUMMARY STRIP
    Holding: 8 cheques · LKR 6.2M
    Clearing this month: LKR 4.1M
    Bounced: 1 ⚠️

  CALENDAR (monthly view)
    Standard month grid
    Dates with maturing cheques show:
      Colored dot (green = received, red = given)
      Amount total for that day
    Tap date: shows list of cheques for that day

  UPCOMING LIST (below calendar)
    Chronological list of all pending cheques
    Sorted by maturity date
    Each item:
      Cheque number · Bank
      Amount · Currency
      From / To: [Contact name]
      Maturity date · Days until maturity
      Status badge
      [📸 View Cheque Photo]
      [Update Status] quick action

  BOUNCED SECTION (if any)
    Highlighted in red
    Each item shows bounce reason
    [Mark Replaced] [Contact] quick actions
```

---

#### SCREEN: Per-Gem Profit Calculator

```
  ID              GT-SCR-005
  Route           /track/gems/[gemId]/profit
  Access          Owner only

  LAYOUT
  Gem photo + name + SKU + weight

  COST BREAKDOWN TABLE
    Row per cost item:
      Type label (icon + name)
      Provider or source
      Date
      Amount (with currency)
    Subtotal line
    ────────────────────
    TOTAL COST (bold)

  REVENUE SECTION
    [Input or autofill] Selling price / Owner minimum (AP)
    AP Commission (calculated automatically if AP sold)
    Owner receives (if AP)

  RESULT SECTION (green or red card)
    Net Profit: LKR X
    ROI: X%
    Cost per carat: LKR X
    Profit per carat: LKR X
    Holding period: X days

  PAYMENT STATUS (if sold)
    Paid: LKR X
    Pending: LKR X (cheque / credit)
    Progress bar

  SCENARIO TOOL
    "What if I sell for..." input
    Shows projected profit in real time
```
