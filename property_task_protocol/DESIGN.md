---
name: Property Task Protocol
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#0058be'
  on-secondary: '#ffffff'
  secondary-container: '#2170e4'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#002113'
  on-tertiary-container: '#009668'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  h1:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  h2:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  h3:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
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
  label-bold:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 0.25rem
  sm: 0.5rem
  md: 1rem
  lg: 1.5rem
  xl: 2rem
  gutter: 1rem
  margin: 2rem
---

## Brand & Style

This design system is engineered for the high-stakes environment of property management, where clarity and reliability are paramount. The brand personality is **Professional, Systematic, and Efficient**, designed to reduce the cognitive load of operations managers and field staff. 

The aesthetic follows a **Modern Corporate** direction—a refinement of functionalism that prioritizes data density without sacrificing airiness. It utilizes a structured visual hierarchy to ensure that urgent tasks are immediately identifiable while maintaining a calm, organized interface for daily operations. The UI should evoke a sense of "controlled momentum," giving users confidence that every cleaning, check-in, and maintenance request is accounted for.

## Colors

The palette is anchored by a deep Slate primary for text and navigation, providing a grounded, authoritative feel. A vibrant Blue serves as the secondary action color, guiding users toward primary interactions.

A specialized semantic palette is used for task categorization:
- **Indigo (#6366F1):** Reserved for Check-ins/Check-outs, representing guest transitions.
- **Amber (#F59E0B):** Dedicated to Cleanings, evoking freshness and attention.
- **Red (#EF4444):** Urgent Maintenance or blocked tasks.
- **Violet (#8B5CF6):** Quality inspections and administrative reviews.

The background is a clean, slightly cool white (#F8FAFC) to differentiate from the pure white (#FFFFFF) of the task cards, creating subtle depth.

## Typography

This design system uses a dual-font approach to balance character with utility. **Manrope** is used for headings and dashboard stats to provide a modern, refined touch. **Inter** is the workhorse for all functional text, chosen for its exceptional legibility in dense task lists and tabular data.

- **Headlines:** Use Manrope with tighter letter spacing for a compact, professional look.
- **Task Titles:** Use `body-lg` in semi-bold for card titles to ensure they stand out.
- **Metadata:** Use `label-bold` for dates, times, and property IDs to maintain a clear information hierarchy.

## Layout & Spacing

The system employs a **12-column Fluid Grid** for high-level dashboard views, transitioning to a **Fixed Kanban Model** for task boards. The spacing rhythm is based on a 4px baseline, ensuring all elements align to a predictable vertical and horizontal scale.

Task boards should feature horizontally scrollable columns with a fixed width of 320px. Gutters between columns are set to `md` (16px) to maximize screen real estate while preventing visual clutter. Padding inside task cards is strictly defined at `md` to maintain consistent density.

## Elevation & Depth

To emphasize the "board" metaphor, this design system uses **Ambient Shadows** and **Tonal Layers**. Depth is used purposefully to indicate interactivity and status:

- **Level 0 (Background):** Surface color #F8FAFC, no shadow.
- **Level 1 (Default Card):** White background (#FFFFFF) with a very soft, multi-layered shadow: `0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)`.
- **Level 2 (Hover/Active):** Lifted state with a more pronounced shadow to indicate it is being dragged or focused: `0 10px 15px -3px rgba(15, 23, 42, 0.1)`.
- **In-set:** Form inputs and progress tracks use a subtle inner border rather than shadows to remain grounded.

## Shapes

The shape language is **Soft (0.25rem)**. This provides a professional, geometric feel that maximizes space for text and data while removing the harshness of sharp corners. 

- **Cards & Inputs:** Use the base `0.25rem` (4px) radius.
- **Buttons:** Use `rounded-lg` (8px) to make them more distinct and tactile.
- **Status Chips:** Use a full pill-shape (999px) to contrast against the rectangular nature of the cards, making them instantly recognizable as status indicators.

## Components

### Buttons
Primary buttons use the secondary color (#3B82F6) with white text. Ghost buttons are used for secondary actions within a card (e.g., "Add Comment") to keep the interface clean.

### Task Cards
The most critical component. Every card must feature:
- A colored left-border (3px) corresponding to the task type.
- A high-contrast title.
- A footer with an avatar for the assigned staff member and a clear deadline label.

### Status Chips
Pill-shaped badges with a 10% opacity background of the category color and 100% opacity text for maximum readability.

### Input Fields
Border-based inputs using Neutral-300 (#D1D5DB). On focus, the border shifts to Primary-Blue with a 2px outer glow (ring).

### Additional Components
- **Priority Indicator:** A small, filled circle (High = Red, Medium = Amber, Low = Gray) placed next to the task title.
- **Progress Micro-bar:** A thin 2px bar at the bottom of cards to show completion of sub-tasks.