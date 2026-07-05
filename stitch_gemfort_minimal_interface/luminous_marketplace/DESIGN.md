---
name: Luminous Marketplace
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#43474d'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#74777e'
  outline-variant: '#c4c6ce'
  surface-tint: '#49607c'
  primary: '#00162c'
  on-primary: '#ffffff'
  primary-container: '#122b44'
  on-primary-container: '#7b93b1'
  inverse-primary: '#b1c8e8'
  secondary: '#755b00'
  on-secondary: '#ffffff'
  secondary-container: '#fed977'
  on-secondary-container: '#785d00'
  tertiary: '#211200'
  on-tertiary: '#ffffff'
  tertiary-container: '#3c2501'
  on-tertiary-container: '#ae8b5c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d1e4ff'
  primary-fixed-dim: '#b1c8e8'
  on-primary-fixed: '#011d35'
  on-primary-fixed-variant: '#314863'
  secondary-fixed: '#ffe08f'
  secondary-fixed-dim: '#e6c364'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#584400'
  tertiary-fixed: '#ffddb4'
  tertiary-fixed-dim: '#e8c08d'
  on-tertiary-fixed: '#291800'
  on-tertiary-fixed-variant: '#5d421a'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
  surface-glass: rgba(255, 255, 255, 0.7)
  success-emerald: '#2D6A4F'
  warning-amber: '#D97706'
  text-main: '#1A1C1E'
  text-muted: '#64748B'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-md-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-margin: 20px
  gutter-md: 16px
  section-gap: 32px
  stack-sm: 8px
  stack-md: 12px
---

## Brand & Style

The design system is defined by a "Sleek Minimalist" aesthetic that balances high-end luxury with approachable utility. It focuses on clarity and premium textures to evoke trust for high-value gem transactions.

The visual narrative uses **Modern Minimalism** with a **Glassmorphic** touch. By combining heavy whitespace and expansive layouts with soft, translucent layers, the system feels airy yet grounded. The goal is to provide an eye-soothing experience that prioritizes the visual beauty of the gemstones while making technical inventory tasks feel effortless and non-intimidating.

## Colors

The palette is anchored by **Gem Blue**, a deep, sophisticated navy that provides a professional foundation. This is contrasted by **Gem Gold**, used sparingly for high-intent actions, status indicators, and premium highlights.

The background uses a soft, off-white neutral to reduce eye strain during long inventory sessions. We employ a functional naming convention for semantic clarity:
- **Primary:** Navigation headers, primary buttons, and brand moments.
- **Accent:** Verification badges, active toggles, and "Gold" tier status.
- **Neutral:** Page backgrounds and subtle borders.
- **Surface Glass:** Used for floating headers and bottom navigation bars to maintain context of the content beneath.

## Typography

This design system utilizes **Inter** exclusively to achieve a clean, systematic feel. The hierarchy relies on generous line heights and tight letter-spacing for headings to maintain a modern, "app-first" look.

- **Display & Headlines:** Used for section titles and "Workspace" headings. These use a heavier weight and slight negative letter-spacing.
- **Body:** Optimized for legibility in gem descriptions and data tables.
- **Labels:** Small, often all-caps with increased letter-spacing, used for secondary metadata (e.g., SKU numbers, weight units).

## Layout & Spacing

The layout follows a **Fixed Grid** model for mobile, utilizing a 4-column system with 20px outer margins. The philosophy is "Airy and Consistent," meaning we prioritize vertical breathing room to separate distinct gem entries.

- **Vertical Rhythm:** Use 32px to separate major sections (e.g., "Featured" vs "Nearby"). Use 12px for spacing within cards.
- **Touch Targets:** No interactive element should be smaller than 44x44px.
- **Safe Areas:** Bottom navigation is elevated with a 12px bottom margin from the home indicator to create a "floating" effect.

## Elevation & Depth

Hierarchy is established through **Ambient Shadows** and **Glassmorphism** rather than harsh lines.

- **Level 1 (Base):** Soft-grey background.
- **Level 2 (Cards):** Pure white surfaces with a very soft, diffused shadow (Blur: 15px, Opacity: 5%, Color: Gem Blue).
- **Level 3 (Navigation/Modals):** Backdrop-blur (20px) with a semi-transparent white fill (70% opacity). This creates a sense of depth where the marketplace content peeks through the interface chrome.
- **Interaction:** Buttons use a slight inner shadow on "press" to feel tactile.

## Shapes

The shape language is friendly and modern. Rounded corners are applied consistently to soften the professional tone of the blue palette.

- **Standard Cards:** 1rem (16px) corner radius.
- **Buttons & Chips:** Pill-shaped (fully rounded) to maximize touch-affordance.
- **Input Fields:** 0.75rem (12px) to differentiate from action buttons.
- **Images:** Always follow the container's 16px radius for a nested, cohesive look.

## Components

### Buttons
- **Primary:** Pill-shaped, Gem Blue background, white text. No border.
- **Secondary:** Pill-shaped, transparent background, Gem Blue 1px border.
- **Accent:** Pill-shaped, Gem Gold background, white text. Used only for "Sell" or "Verify" actions.

### Cards
- **Gem/Business Cards:** White background, 16px radius, soft ambient shadow. Images should occupy the top half or the full background for "featured" status.

### Navigation
- **Bottom Bar:** A floating pill-shaped container with `surface-glass` blur. Icons use Gem Blue for active states and Muted Slate for inactive states.

### Inputs & Chips
- **Chips:** Small pill shapes. Active chips use Gem Blue with white text; inactive chips use a very light grey fill.
- **Inputs:** Soft grey fill (`#F1F5F9`) with no border until focused, where they transition to a 1px Gem Blue stroke.

### Verification Badges
- Small, circular or pill badges using Gem Gold with a "Checkmark" icon to signify premium/trusted status.