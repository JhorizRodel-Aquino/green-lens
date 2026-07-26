---
name: Civic Clarity
colors:
  primary:
    DEFAULT: '#16a34a' # Green
    light: '#22c55e'
    dark: '#15803d'
  secondary:
    DEFAULT: '#f59e0b' # Amber/Accent
    light: '#fbbf24'
    dark: '#d97706'
  light:
    DEFAULT: '#f8fafc'
    lighter: '#ffffff'
    dark: '#e2e8f0'
  dark:
    DEFAULT: '#0f172a'
    light: '#1e293b'
    darker: '#020617'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
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
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style

The design system is engineered for civic utility, balancing the authority of government with the accessibility of a modern consumer application. The primary goal is to foster trust and encourage civic participation by making complex data—like waste management and environmental reporting—feel manageable and transparent.

The aesthetic follows a **Corporate / Modern** direction with a focus on "Gov-Tech Modern." This means prioritizing high legibility, functional whitespace, and a systematic approach to information hierarchy. The interface avoids unnecessary decorative elements, opting instead for a clean, structured layout that feels reliable and "official" without appearing dated or bureaucratic. The emotional response should be one of confidence, efficiency, and civic pride.

## Colors

This design system utilizes a palette grounded in traditional civic colors but modernized for digital screens. 

- **Primary Green:** A vibrant, trustworthy green used for primary actions, branding, and active states. Represents environmental responsibility and civic action.
- **Secondary Amber:** An energetic accent color for notifications, highlights, and interactive elements that need to stand out without overwhelming the primary green.
- **Light Neutrals:** A range from pure white to subtle gray used for backgrounds and surfaces, maintaining a clean, professional environment.
- **Dark Neutrals:** Deep navy tones used for typography and structural elements, providing strong contrast and authoritative presence.

The color system is designed to be accessible, with strong contrast ratios that meet WCAG AA standards across all interfaces.

## Typography

The design system relies exclusively on **Inter** to ensure maximum readability and a systematic, utilitarian feel. The hierarchy is strictly enforced to help users quickly scan through lists of reports or dense data dashboards.

- **Headlines:** Use tighter letter-spacing and bold weights to establish clear section breaks.
- **Body Text:** Standard weight with generous line-height to ensure accessibility for a diverse range of citizens.
- **Labels:** Used for status badges and table headers, often paired with a slight letter-spacing increase to differentiate them from body text.

## Layout & Spacing

The system uses a **Fluid Grid** model with fixed maximum widths for desktop dashboard views to prevent line-lengths from becoming unreadable.

- **Grid:** A 12-column grid is used for desktop, 8-column for tablet, and 4-column for mobile.
- **Spacing Rhythm:** Based on a 4px baseline, with 24px (md) being the default padding for containers and cards.
- **Mapping Interface:** On the dashboard, the map should function as a "base layer" or a large-scale side panel, with reporting cards floating or docked to the side to maintain context.
- **Mobile Reflow:** In mobile views, action buttons (like "Report Trash") should be pinned to the bottom of the viewport as a floating action button or a full-width sticky footer for easy thumb access.

## Elevation & Depth

The design system uses **Tonal Layers** combined with **Ambient Shadows** to create a structured sense of depth.

- **Level 0 (Base):** The main background (`#f8fafc` - light DEFAULT).
- **Level 1 (Cards):** White background (`#ffffff` - light.lighter) with a subtle 1px border (`#e2e8f0` - light.dark) and a soft, highly diffused shadow.
- **Level 2 (Overlays/Modals):** A more pronounced shadow to indicate focus, with a backdrop blur to maintain context while minimizing distraction.
- **Interactive States:** Buttons and interactive cards use a slight vertical lift (larger shadow) on hover to provide tactile feedback.

## Shapes

The shape language is **Rounded**, reflecting a modern and approachable government service. 

- **Standard Elements:** Buttons, input fields, and cards use a 0.5rem (8px) radius.
- **Status Badges:** Use a fully rounded "pill" shape to distinguish them from interactive buttons.
- **Large Containers:** Modals or large data panels use `rounded-xl` (1.5rem/24px) to soften the overall appearance of the interface.

## Components

### Buttons
Primary buttons are solid green (`primary.DEFAULT`) with white text. Secondary buttons use the amber accent (`secondary.DEFAULT`) for important calls-to-action. Ghost buttons use subtle outlines with the primary color. All buttons maintain consistent padding and hover states.

### Status Badges
High-trust indicators are essential. Use "pill" shapes with light tinted backgrounds and dark text:
- **Resolved:** Green tint with dark green text using `primary.light` background
- **Pending:** Amber tint with dark amber text using `secondary.light` background
- **Urgent:** Red warning style for high-priority items

### Cards
Cards are the primary vehicle for trash reports. Each card must feature:
- A clear title/category.
- A status badge in the top right.
- A timestamp and location string.
- A thumbnail image (if provided by the user).

### Input Fields
Forms should be spacious. Use 16px internal padding and clear, persistent labels. Focus states should use a 2px primary green ring. Error states should use appropriate warning colors.

### Mapping Interface
The map should use a "Light" or "Muted" style to ensure the colored map pins (green for reports, amber for in-progress, dark for resolved) remain the focal point.

### Lists
For administrative views, use clean data tables with alternate row striping and high-contrast text. Each row should be tappable to open a detailed report view.

## Accessibility

The design system prioritizes accessibility at every level:
- **Color Contrast:** All combinations meet WCAG AA standards
- **Focus States:** Clear visual indicators for keyboard navigation
- **Typography:** Responsive font sizes with sufficient line heights
- **Touch Targets:** Minimum 44px touch targets for interactive elements