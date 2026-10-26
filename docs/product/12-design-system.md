# DESIGN-SYSTEM.md
## Visual Design System

---

### 12.1 Brand Identity

```
  Product Name     GemFort
  Sub-products     GemNet · GemTrack
  Brand Feeling    Trustworthy · Professional · Simple · Fast
  Not             Flashy · Busy · Social · Consumer-app-like
```

### 12.2 Color Palette

```
  PRIMARY COLORS
  ─────────────────────────────────────────────────────────────
  Gem Blue         #1A3A5C    Dark navy — primary brand color
  Gem Gold         #C9A84C    Gold — premium, featured, badges
  Pure White       #FFFFFF    Backgrounds, cards

  VERIFICATION BADGE COLORS
  ─────────────────────────────────────────────────────────────
  Verified Green   #2D7D46    Full verified badge
  Basic Blue       #2B6CB0    Basic verified badge
  Pending Amber    #B7791F    Pending badge
  Revoked Red      #C53030    Revoked / suspended

  FUNCTIONAL COLORS
  ─────────────────────────────────────────────────────────────
  Success          #2D7D46
  Warning          #B7791F
  Error            #C53030
  Info             #2B6CB0

  ALERT COLORS (GemTrack dashboard)
  ─────────────────────────────────────────────────────────────
  Critical Red     #FED7D7    Background  /  #C53030  Text
  Warning Amber    #FEFCBF    Background  /  #7B341E  Text
  Info Blue        #BEE3F8    Background  /  #2A4365  Text

  NEUTRAL PALETTE
  ─────────────────────────────────────────────────────────────
  Gray 900         #1A202C    Primary text
  Gray 700         #4A5568    Secondary text
  Gray 500         #718096    Placeholder text
  Gray 300         #E2E8F0    Borders, dividers
  Gray 100         #F7FAFC    Page backgrounds
  Gray 50          #FAFAFA    Card backgrounds

  DARK MODE (Phase 3)
  ─────────────────────────────────────────────────────────────
  Background       #0D1117
  Surface          #161B22
  Border           #30363D
  Primary text     #E6EDF3
  Secondary text   #8B949E
```

### 12.3 Typography

```
  FONT FAMILY
  Primary:    Inter (Google Fonts)
  Fallback:   System UI, sans-serif
  For Sinhala: Noto Sans Sinhala (Google Fonts)
  For Tamil:   Noto Sans Tamil (Google Fonts)

  TYPE SCALE
  ─────────────────────────────────────────────────────────────
  Display       32px / 40px line height / Bold (700)
  H1            24px / 32px line height / SemiBold (600)
  H2            20px / 28px line height / SemiBold (600)
  H3            18px / 24px line height / Medium (500)
  Body Large    16px / 24px line height / Regular (400)
  Body          14px / 20px line height / Regular (400)
  Body Small    12px / 16px line height / Regular (400)
  Caption       11px / 16px line height / Regular (400)
  Button        14px / 20px line height / SemiBold (600)
  Label         12px / 16px line height / Medium (500)
```

### 12.4 Spacing System

```
  Base unit: 4px

  4px    (1)   — micro gaps, inline spacing
  8px    (2)   — tight component spacing
  12px   (3)   — compact spacing within components
  16px   (4)   — standard internal padding
  20px   (5)   — section internal spacing
  24px   (6)   — component separation
  32px   (8)   — section separation
  40px   (10)  — major section breaks
  48px   (12)  — screen top/bottom padding
  64px   (16)  — hero section spacing
```

### 12.5 Component Specifications

#### Button

```
  PRIMARY BUTTON
    Background:     Gem Blue #1A3A5C
    Text:           White, 14px SemiBold
    Height:         48px (touch target)
    Border radius:  8px
    Padding:        16px horizontal
    States:
      Default:      as above
      Pressed:      background opacity 80%
      Disabled:     Gray 300 background, Gray 500 text
      Loading:      spinner replaces text

  SECONDARY BUTTON
    Background:     White
    Border:         1.5px Gem Blue
    Text:           Gem Blue, 14px SemiBold
    Height:         48px

  GHOST BUTTON
    Background:     Transparent
    Text:           Gem Blue, 14px SemiBold
    Height:         44px
    (used for destructive or low-priority actions)

  CONTACT BUTTONS (WhatsApp, Call, etc.)
    WhatsApp:       #25D366 background, white text
    Phone:          #2B6CB0 background, white text
    Facebook:       #1877F2 background, white text
    WeChat:         #07C160 background, white text
    Height:         44px
    Border radius:  8px
    Icon + Label layout
```

#### Cards

```
  BUSINESS CARD
    Background:     White
    Border:         1px Gray 300
    Border radius:  12px
    Shadow:         0 1px 3px rgba(0,0,0,0.08)
    Padding:        16px
    Featured card:  left border 3px Gem Gold
                    subtle gold background tint #FFFFF0

  GEM LISTING CARD
    Background:     White
    Border:         1px Gray 300
    Border radius:  12px
    Photo:          16:9 ratio, full width, rounded top corners
    Content:        16px padding

  ALERT CARD (GemTrack)
    Border radius:  8px
    Left border:    4px color based on severity
    Padding:        12px 16px
    Icon:           24px on left
    Dismiss button: X on right (optional)
```

#### Badge Chips

```
  VERIFIED BADGE
    Background:     #2D7D46
    Text:           White, 11px Medium
    Icon:           ✅ (or custom checkmark)
    Padding:        4px 8px
    Border radius:  4px

  BASIC VERIFIED
    Background:     #2B6CB0
    Text:           White, 11px Medium

  NGJA BADGE
    Background:     #44337A (deep purple)
    Text:           White, 11px Medium
    Label:          "NGJA"

  SINCE YEAR BADGE
    Background:     Gray 100
    Text:           Gray 700, 11px Medium
    Border:         1px Gray 300
    Label:          "Since 2022"

  PREMIUM BADGE
    Background:     Gem Gold #C9A84C
    Text:           White, 11px Medium
    Label:          "⭐ Premium"

  FEATURED BADGE
    Background:     Gem Gold
    Text:           White, 11px Bold
    Label:          "⭐ FEATURED"
```

### 12.6 Navigation

```
  BOTTOM NAVIGATION BAR
    Height:         60px + safe area
    Background:     White
    Border top:     1px Gray 300
    Active icon:    Gem Blue, filled
    Inactive icon:  Gray 500, outlined
    Label:          12px Medium, matching icon color
    Active indicator: Gem Blue dot above icon (2px circle)

  TAB BAR (within screens)
    Height:         44px
    Style:          Underline tabs
    Active:         Gem Blue underline 2px, text Gem Blue SemiBold
    Inactive:       Gray 500 text, no underline
    Background:     White, sticky on scroll
```

### 12.7 Iconography

```
  ICON LIBRARY   Material Symbols (Google)
  STYLE          Rounded variant
  DEFAULT SIZE   24px (touch areas padded to 44px minimum)
  COLOR          Inherits from context (brand or gray)

  CUSTOM ICONS (designed for GemFort)
    Gem icon (for GemTrack tab and listings)
    AP Stone icon (hand holding gem)
    Cheque icon
    Mine/Rough stone icon
```

### 12.8 Photography and Illustrations

```
  GEM PHOTOS
    Required aspect ratios: 1:1 (grid), 16:9 (card), 4:3 (detail)
    Auto-cropped on upload with user preview and adjust
    Minimum resolution: 800x600px
    Maximum file size: 10MB per photo
    Formats: JPG, PNG, WebP
    Compression: applied on upload to optimise delivery

  ILLUSTRATIONS (empty states and onboarding)
    Style: Simple, flat, gem-themed
    Colors: From brand palette only
    Format: SVG (scalable)

  BUSINESS LOGOS
    Displayed: 48x48 (card), 80x80 (profile)
    Circular crop applied
    Minimum: 200x200px source
    Fallback: Business name initials on brand color background
```

### 12.9 Motion and Animation

```
  PHILOSOPHY
    Functional animation only. No decorative motion.
    Every animation serves to orient or inform.

  TRANSITIONS
    Screen push:    Slide from right, 250ms ease-out
    Screen pop:     Slide to right, 200ms ease-in
    Modal open:     Slide up from bottom, 300ms ease-out
    Modal close:    Slide down, 200ms ease-in

  MICRO-INTERACTIONS
    Button press:   Scale to 0.97, 80ms
    Card tap:       Ripple effect (Material)
    Toggle switch:  200ms slide
    Badge appear:   Fade in, 150ms

  LOADING STATES
    Skeleton screens (not spinners) for list loading
    Spinner only for action confirmations (button submitting)
    Skeleton color: Gray 100 to Gray 200 shimmer
```

### 12.10 Accessibility

```
  Touch targets:    Minimum 44x44 points for all interactive elements
  Color contrast:   Minimum 4.5:1 for body text
                    Minimum 3:1 for large text and icons
  Text scaling:     App supports iOS and Android text size settings
  Screen readers:   Semantic labels on all icons and images
  Focus order:      Logical top-to-bottom, left-to-right
  Error states:     Never indicated by color alone — always with text
```
