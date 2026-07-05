# SEARCH-AND-FILTERING.md
## Search, Filters, Geo, and Pagination

---

### 9.1 Search Architecture

GemFort uses Firestore native queries for directory search. For text search beyond exact matches, Algolia or Firebase Extensions (Typesense) is used in Phase 3.

**Phase 1 and 2:** Firestore composite index queries on businessName, city, district, businessType, verificationStatus, and gemSpecializations.

**Phase 3+:** Full-text search via Algolia with Firestore sync, enabling partial match and fuzzy search.

### 9.2 Directory Search Queries

```javascript
// Base query — all verified businesses
db.collection('businesses')
  .where('verificationStatus', '==', 'verified')
  .where('isActive', '==', true)
  .orderBy('rankScore', 'desc')
  .limit(20)

// Filter by business type
db.collection('businesses')
  .where('verificationStatus', '==', 'verified')
  .where('isActive', '==', true)
  .where('businessType', '==', 'cutter')
  .orderBy('rankScore', 'desc')
  .limit(20)

// Filter by city
db.collection('businesses')
  .where('verificationStatus', '==', 'verified')
  .where('isActive', '==', true)
  .where('city', '==', 'Beruwala')
  .orderBy('rankScore', 'desc')
  .limit(20)

// Filter by gem specialization (array-contains)
db.collection('businesses')
  .where('verificationStatus', '==', 'verified')
  .where('isActive', '==', true)
  .where('sellerProfile.gemSpecializations', 'array-contains', 'blue_sapphire')
  .orderBy('rankScore', 'desc')
  .limit(20)

// Verified only filter
db.collection('businesses')
  .where('verificationTier', '==', 'full')
  .where('isActive', '==', true)
  .orderBy('rankScore', 'desc')
  .limit(20)
```

### 9.3 Required Composite Indexes

```
  Collection: businesses
  Fields indexed:
    verificationStatus ASC, isActive ASC, rankScore DESC
    verificationStatus ASC, isActive ASC, city ASC, rankScore DESC
    verificationStatus ASC, isActive ASC, businessType ASC, rankScore DESC
    verificationStatus ASC, isActive ASC, businessType ASC, city ASC, rankScore DESC
    verificationTier ASC, isActive ASC, rankScore DESC
    isActive ASC, isFeatured ASC, rankScore DESC

  Collection: gems
    visibility ASC, status ASC, publishedAt DESC
    sellerUid ASC, status ASC, publishedAt DESC
    visibility ASC, status ASC, gemType ASC, publishedAt DESC
```

### 9.4 Geo Search

```
  IMPLEMENTATION
  GeoPoint stored on each business document.
  Geohash stored alongside GeoPoint for radius queries.
  Geoflutterfire2 package used in Flutter app.

  NEAR ME FLOW
    1. App requests location permission.
    2. Device location obtained.
    3. Geoflutterfire query for businesses within radius.
    4. Default radius: 25 km.
    5. User can adjust radius: 5 km, 10 km, 25 km, 50 km, Any.
    6. Results sorted by distance, then by rank score.

  SCHEMA ADDITION
  businesses document adds:
    geohash: string   (computed from geoPoint on write)
```

### 9.5 Pagination

```
  PAGE SIZE
    Directory list: 20 per page
    Gem listings: 12 per page
    Admin queues: 25 per page

  IMPLEMENTATION
    Firestore cursor-based pagination using startAfterDocument()
    Last document of current page stored as cursor
    "Load more" button or infinite scroll trigger
    No skip-based pagination (not supported efficiently in Firestore)

  FLUTTER IMPLEMENTATION
    ListView.builder with controller
    Controller detects scroll position
    At 80% scroll depth: trigger next page fetch
    Loading spinner at bottom while fetching
    "End of results" message when no more pages
    Cache current page data for back navigation
```

### 9.6 Filter State Management

```
  FILTER STATE OBJECT
  {
    businessType: string | null,
    city: string | null,
    verifiedOnly: boolean,
    specializations: string[],
    nearMe: boolean,
    radiusKm: number
  }

  FILTER PERSISTENCE
    Filter state persists within session
    Reset on app restart (intentional — fresh search each session)
    "Active filters" chip row shows applied filters
    Individual chips can be removed (x button)
    [Reset All] clears all filters

  FILTER COMBINATIONS
    If nearMe is true: geo query takes precedence
    city filter and nearMe are mutually exclusive
    Multiple specializations use array-contains-any (max 10)
    businessType and specialization filters combined with AND logic
```

### 9.7 GemTrack Search and Filter

```
  GEM LIST SEARCH
    Text search on: gemType, variety, originCountry, sku, notes, tags
    Implemented client-side on cached data (private data, no index needed)

  GEM LIST FILTERS
    By status (multi-select)
    By gem type (multi-select)
    By origin country
    By treatment status (natural, heated, chemical)
    By date range (acquisition date)
    By weight range (min carats, max carats)
    By current holder (select from contacts)
    By trip

  CONTACT SEARCH
    Text search on: name, companyName, city, specialization
    Filter by contact type (multi-select)
    Filter by country

  CHEQUE FILTER
    By status
    By direction (received or given)
    By maturity month
    By contact
    By amount range
```
