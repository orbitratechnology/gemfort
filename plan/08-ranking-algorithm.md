# RANKING-ALGORITHM.md
## Trust and Discovery Scoring

---

### 8.1 Philosophy

GemFort does not expose a trust score to users. Scores cause arguments. Instead, the ranking system operates silently behind search results. Users see badges, not numbers.

### 8.2 Directory Search Ranking

When a user searches or browses the directory, results are sorted by a computed rank. This rank is never shown.

```
  RANK COMPONENTS (weighted)

  Component                           Weight
  ─────────────────────────────────────────
  Is featured (paid)                   +200 pts  (always top)
  Is full verified (BR + NGJA)          +80 pts
  Is basic verified (ID only)           +40 pts
  Has NGJA badge                        +20 pts
  Subscription: Premium                 +30 pts
  Years verified on GemNet              +5 pts per year (max 25)
  Endorsement count                     +2 pts per endorsement (max 20)
  Has repeat business badge             +15 pts
  Listing milestone 100+                +10 pts
  Listing milestone 50+                 +5 pts
  Profile completeness (90%+)           +10 pts
  Has gallery photos (10+)              +5 pts
  Has gallery photos (1+)               +3 pts
  Profile views (top quartile)          +5 pts  (recalculated monthly)
  Contact tap rate (top quartile)       +5 pts  (recalculated monthly)
  Active listings (1 or more)           +10 pts
  Account age (1+ year)                 +5 pts
  No fraud reports                       0 pts
  One unresolved fraud report           -50 pts
  Suspended (should not appear)        -999 pts
```

### 8.3 Ranking Recalculation

```
  Triggered immediately on:
    Verification status change
    Featured status change
    Subscription change
    Suspension

  Recalculated daily by Cloud Function:
    Endorsement count update
    Profile completeness check
    Listing count update
    Analytics quartile recalculation

  Stored as:
    businesses.rankScore (number, never shown to user)
    businesses.rankUpdatedAt (timestamp)
```

### 8.4 Featured Slot Behavior

```
  Up to 5 featured slots exist in the directory at any time.
  Featured businesses always appear at the top of results
  regardless of their organic rank.
  Multiple featured businesses within a category are ordered
  by their organic rank score amongst themselves.
  Featured businesses in the announcements board appear
  in a separate highlighted card above organic results.
```

### 8.5 Search Result Ordering Rules

```
  Rule 1:   Featured businesses first (sorted by rank score)
  Rule 2:   Full verified businesses (sorted by rank score)
  Rule 3:   Basic verified businesses (sorted by rank score)
  Rule 4:   Unverified businesses (sorted by account age)
  Rule 5:   Suspended businesses never appear in results
  Rule 6:   Businesses with active fraud reports are deprioritised
  Rule 7:   Filter by location narrows pool before ranking applies
  Rule 8:   Filter by type narrows pool before ranking applies
  Rule 9:   Text search match boosts rank by +50 pts (name match)
             and +25 pts (specialization tag match)
```

### 8.6 Gem Listing Ordering

```
  Within the announcements board:
    New listings appear in chronological order (newest first)

  Within a seller's profile:
    Active listings first, then paused
    Within active: sorted by publish date (newest first)

  In directory search results showing listings:
    Certified listings first
    Then by recency
```
