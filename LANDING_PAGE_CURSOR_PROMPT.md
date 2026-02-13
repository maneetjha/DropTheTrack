# DropTheTrack Landing Page - Premium Redesign Prompt for Cursor

## Overview
Redesign the landing/dashboard page to match the V1 Classic Two-Column layout mockup. The current page is functional but needs a complete visual overhaul to premium dark theme with glassmorphism, proper spacing, and an organized layout. Preserve all backend logic, form functionality, and state management—only change the UI/styling.

## Design System

### Color Palette (Solid Colors Only - No Gradients)
```
Primary Black: #09090b (background)
Deep Black: #0f0f13 (cards, overlays)
Medium Gray: #1a1a24 (borders, subtle elements)
Muted Gray: #6b7280 (text, secondary info)
White/Light: #ffffff (primary text)
Purple/Primary Accent: #7c3aed (buttons, glows, highlights)
Cyan/Secondary Accent: #06b6d4 (alternative buttons, accents)
Success Green: #10b981 (live indicators, positive states)
Red/Alert: #ef4444 (errors, important alerts)
```

### Typography
- **Display Font**: Inter Bold (600-700 weight) for headings
- **Body Font**: Inter Regular (400-500 weight)
- **Sizes**:
  - Hero Heading: 48px (desktop), 32px (mobile)
  - Section Headers: 24px (desktop), 20px (mobile)
  - Card Titles: 18px
  - Body Text: 16px
  - Labels/Secondary: 14px
  - Small Text: 12px
- **Line Height**: 1.5 for body, 1.3 for headings

### Spacing System (Tailwind)
- Card Padding: 32px (desktop), 24px (mobile)
- Section Gap: 32px vertical
- Card Gap: 16px horizontal
- Small Gap: 8px
- Container Max Width: 1440px (desktop)

### Glassmorphism Style
- Background: rgba(255, 255, 255, 0.05) or rgba(124, 58, 237, 0.08)
- Backdrop Filter: blur(10px)
- Border: 1px solid rgba(255, 255, 255, 0.1)
- Border Radius: 12px for cards
- Box Shadow: 0 8px 32px rgba(0, 0, 0, 0.1) (subtle)

---

## Page Layout Structure

### Desktop (1440px+)
```
┌─────────────────────────────────────────┐
│ [Logo] [Spacer]    [User] [Logout]     │ (Header)
├─────────────────────────────────────────┤
│                                         │
│         Welcome back, Mj                │ (Hero Section - Center)
│    Create a room or join an existing one│
│                                         │
├──────────────┬──────────────────────────┤
│              │                          │
│  CREATE A    │    JOIN BY CODE          │ (Action Cards - Side by Side)
│  ROOM        │                          │
│              │                          │
├──────────────┴──────────────────────────┤
│                                         │
│  MY ROOMS          RECENTLY JOINED      │ (Grid Cards Section - 2 Column)
│                                         │
├─────────────────────────────────────────┤
│   Footer text centered                  │
└─────────────────────────────────────────┘
```

### Mobile (< 768px)
All sections stack vertically, full width with horizontal padding. Single column layout. Hero, Create, Join, My Rooms, Recently Joined all stack in order.

---

## Component Specifications

### Header
- **Height**: 60px
- **Background**: Deep black (#0f0f13) or transparent with subtle top border
- **Content**: 
  - Left: DropTheTrack logo (music note icon + text) in white
  - Right: User name "Mj" in muted gray, purple avatar circle (36px), "Logout" button (outlined purple)
- **Sticky**: Yes, stays at top on scroll
- **Padding**: 16px horizontal

### Hero Section
- **Background**: Transparent, sits on main black background
- **Padding**: 64px top, 48px bottom (desktop); 40px top, 32px bottom (mobile)
- **Text Alignment**: Center
- **Heading**: "Welcome back, [Username]" 
  - Font: Bold, 48px (desktop), 32px (mobile)
  - Color: White
  - Font Family: Display (Inter Bold)
- **Subheading**: "Create a room or join an existing one"
  - Font: Regular, 16px
  - Color: Muted gray
  - Margin Top: 12px

### Action Cards Section
**Layout**: Two equal-width cards side by side (desktop), stacked full-width (mobile)
**Gap**: 24px between cards (desktop), 16px (mobile)
**Padding**: 48px horizontal on container (desktop), 16px (mobile)

#### CREATE A ROOM Card
- **Background**: Glassmorphism (purple-tinted, rgba(124, 58, 237, 0.08))
- **Border**: 1px solid rgba(124, 58, 237, 0.2)
- **Padding**: 32px
- **Border Radius**: 12px
- **Content**:
  - **Icon**: Large purple circle (64px diameter) at top, music note icon inside (white, 36px)
  - **Title**: "Create a Room" (bold, 20px, white)
  - **Subtitle**: "Start a listening session with friends" (gray, 14px)
  - **Spacing**: 16px below icon, 8px below subtitle
  - **Input Field**: 
    - Placeholder: "Enter room name..."
    - Background: rgba(0, 0, 0, 0.3)
    - Border: 1px solid rgba(255, 255, 255, 0.1)
    - Padding: 14px 16px
    - Border Radius: 8px
    - Text Color: White
    - Focus: Purple border glow
    - Margin Top: 20px
  - **Button**: 
    - Text: "Create Room"
    - Background: Solid purple (#7c3aed)
    - Color: White
    - Padding: 12px 32px
    - Border Radius: 8px
    - Font: Bold
    - Margin Top: 16px
    - Hover: Add glow shadow (0 0 20px rgba(124, 58, 237, 0.6))
    - Cursor: Pointer
- **Hover**: Subtle lift (transform: translateY(-2px)), enhanced glow

#### JOIN BY CODE Card
- **Background**: Glassmorphism (cyan-tinted, rgba(6, 182, 212, 0.08))
- **Border**: 1px solid rgba(6, 182, 212, 0.2)
- **Padding**: 32px
- **Border Radius**: 12px
- **Content**:
  - **Icon**: Large cyan circle (64px), door/entry icon inside (white, 36px)
  - **Title**: "Join by Code" (bold, 20px, white)
  - **Subtitle**: "Jump into a room with a code" (gray, 14px)
  - **Spacing**: 16px below icon, 8px below subtitle
  - **Input Field**:
    - Placeholder: "Enter room code (e.g. A3F1B2)"
    - Background: rgba(0, 0, 0, 0.3)
    - Border: 1px solid rgba(255, 255, 255, 0.1)
    - Padding: 14px 16px
    - Border Radius: 8px
    - Text Color: White
    - Focus: Cyan border glow
    - Margin Top: 20px
  - **Button**:
    - Text: "Join"
    - Background: Transparent
    - Border: 2px solid cyan (#06b6d4)
    - Color: Cyan
    - Padding: 10px 32px
    - Border Radius: 8px
    - Font: Bold
    - Margin Top: 16px
    - Hover: Fill background with cyan, text to black; glow effect
    - Cursor: Pointer
- **Hover**: Subtle lift, cyan glow

### My Rooms Section
- **Header**: 
  - Icon: House/home icon in purple (20px)
  - Title: "My Rooms" (bold, 24px, white)
  - Margin Bottom: 24px
- **Grid**: 2-3 columns (desktop), 1 column (mobile)
- **Card Width**: Full available width / number of columns
- **Gap**: 16px
- **Empty State**: 
  - Large plus icon (60px, muted gray)
  - Text: "You haven't created any rooms yet"
  - Subtext: "Create one above to get started"
  - Text alignment: Center
  - Background: Glassmorphism card
  - Padding: 48px
  - Border Dashed: 1px dashed rgba(255, 255, 255, 0.2)

#### Room Card (My Rooms & Recently Joined)
- **Background**: Glassmorphism (rgba(255, 255, 255, 0.05))
- **Border**: 1px solid rgba(255, 255, 255, 0.1)
- **Padding**: 16px
- **Border Radius**: 12px
- **Content**:
  - **Room Thumbnail**: 
    - Width: Full width of card
    - Height: 120px (auto aspect ratio 16:9 if image)
    - Background: Gradient placeholder (purple to darker purple) if no image
    - Border Radius: 8px
    - Margin Bottom: 12px
  - **Room Name**: Bold, 16px, white
  - **Status Line**: "2 listening" or "Added 3 days ago" in purple (14px)
  - **Margin Bottom**: 12px
  - **Action Button**: 
    - Text: "Enter Room" or "Join"
    - Background: Purple with hover glow
    - Padding: 10px 16px
    - Font: Bold, 14px
    - Full width
    - Border Radius: 6px
- **Hover**: 
  - Lift effect (transform: translateY(-4px))
  - Background glow intensifies
  - Button glow activates

### Recently Joined Section
- **Header**:
  - Icon: Clock icon in cyan (20px)
  - Title: "Recently Joined" (bold, 24px, white)
  - Margin Bottom: 24px
- **Grid**: Same as My Rooms
- **Empty State**: 
  - Clock icon (60px, muted gray)
  - Text: "Join a room using a code to see it here"
  - Background: Glassmorphism card
  - Padding: 48px
  - Border Dashed

### Footer
- **Text**: "Create a room above or join one with a code to get started!"
- **Color**: Muted gray
- **Font**: 14px
- **Alignment**: Center
- **Padding**: 32px top, 24px bottom
- **Border Top**: 1px solid rgba(255, 255, 255, 0.05)

---

## Responsive Breakpoints

### Desktop (1440px+)
- Two-column action cards side by side
- 2-3 column grid for room cards
- Full hero text sizing
- Horizontal padding: 48px

### Tablet (768px - 1023px)
- Two-column action cards still side by side (may be narrower)
- 2 column grid for room cards
- Reduced hero text sizing
- Horizontal padding: 32px

### Mobile (< 768px)
- Action cards stack vertically, full width
- 1 column grid for room cards
- Hero text: 32px
- Horizontal padding: 16px
- Vertical spacing reduced proportionally
- Bottom safe area padding for devices with notches

---

## Animations & Interactions

### Button Interactions
- **Hover State**: 
  - Glow shadow (0 0 20px rgba(color, 0.6))
  - Slight lift (transform: translateY(-2px))
  - Smooth transition: 200ms ease-out
- **Active/Pressed**: 
  - transform: scale(0.98)
  - Transition: 100ms ease-out
- **Disabled**: 
  - Opacity: 0.5
  - Cursor: not-allowed

### Card Interactions
- **Hover**: 
  - transform: translateY(-4px)
  - box-shadow intensifies
  - Transition: 300ms ease-out
  - Cursor: pointer (for clickable cards)
- **Focus** (keyboard navigation): 
  - Purple outline: 2px solid purple, 4px offset
  - Transition: 150ms ease-out

### Input Fields
- **Focus State**: 
  - Border color matches card accent (purple or cyan)
  - Glow shadow: 0 0 12px rgba(accent-color, 0.4)
  - Background slightly lighter
  - Transition: 200ms ease-out
- **Error State**: 
  - Border: Red (#ef4444)
  - Glow: Red shadow
  - Error message below input in red

### Page Load
- Hero section: Fade in + slide down (200ms)
- Action cards: Stagger fade-in (300ms delay between each, 200ms duration)
- Room cards: Stagger fade-in (400ms delay, 200ms duration)
- Transition timing function: ease-out

---

## Form Behavior & Validation

### Create Room Form
- **Input Validation**: 
  - Required field
  - Min 3 characters, max 30 characters
  - Real-time validation feedback
  - On blur or while typing show/hide error
- **Button State**: 
  - Disabled if input empty or invalid
  - Disabled with spinner while submitting
  - Success feedback: Redirect to room or show success toast
  - Error handling: Show error message below input

### Join by Code Form
- **Input Validation**:
  - Required field
  - Uppercase format (6 alphanumeric)
  - Real-time feedback
  - Show "Invalid code" if not found
- **Button State**:
  - Disabled if input empty or invalid
  - Loading spinner while validating
  - Error: Show "Room not found" or validation error
  - Success: Navigate to room

---

## CSS Architecture

### CSS Variables (Define in globals.css or Tailwind Config)
```css
/* Colors */
--bg-primary: #09090b;
--bg-secondary: #0f0f13;
--bg-tertiary: #1a1a24;
--text-primary: #ffffff;
--text-secondary: #6b7280;
--accent-purple: #7c3aed;
--accent-cyan: #06b6d4;

/* Spacing */
--spacing-xs: 8px;
--spacing-sm: 12px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;
--spacing-2xl: 48px;

/* Border Radius */
--radius-sm: 8px;
--radius-md: 12px;

/* Shadows */
--shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.1);
--shadow-md: 0 8px 32px rgba(0, 0, 0, 0.1);
--shadow-glow-purple: 0 0 20px rgba(124, 58, 237, 0.6);
--shadow-glow-cyan: 0 0 20px rgba(6, 182, 212, 0.6);

/* Glass Effect */
--glass-bg: rgba(255, 255, 255, 0.05);
--glass-bg-accent: rgba(124, 58, 237, 0.08);
--glass-border: 1px solid rgba(255, 255, 255, 0.1);
--glass-backdrop: backdrop-filter: blur(10px);
```

### Utility Classes to Create
```css
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(10px);
  border: var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
}

.glass-card-purple {
  background: var(--glass-bg-accent);
  border: 1px solid rgba(124, 58, 237, 0.2);
}

.btn-primary {
  background: var(--accent-purple);
  color: white;
  padding: 12px 32px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms ease-out;
}

.btn-primary:hover {
  box-shadow: var(--shadow-glow-purple);
  transform: translateY(-2px);
}

.btn-outline {
  background: transparent;
  border: 2px solid var(--accent-cyan);
  color: var(--accent-cyan);
  padding: 10px 32px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms ease-out;
}

.btn-outline:hover {
  background: var(--accent-cyan);
  color: black;
  box-shadow: var(--shadow-glow-cyan);
}

.icon-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.icon-circle-purple {
  background: var(--accent-purple);
}

.icon-circle-cyan {
  background: var(--accent-cyan);
}

.hover-lift {
  transition: transform 300ms ease-out;
}

.hover-lift:hover {
  transform: translateY(-4px);
}
```

---

## Implementation Checklist

- [ ] Update globals.css with new CSS variables and utility classes
- [ ] Update layout.tsx metadata (title, description)
- [ ] Create/update Header component with logo, user info, logout button
- [ ] Create/update Hero section component
- [ ] Create Action Cards components (Create Room & Join by Code)
- [ ] Create Room Card component (for grid display)
- [ ] Create My Rooms section with grid layout
- [ ] Create Recently Joined section with grid layout
- [ ] Create Footer section
- [ ] Add form validation and error handling
- [ ] Implement all hover/focus states
- [ ] Implement page load animations
- [ ] Test responsive design at all breakpoints (mobile: 375px, tablet: 768px, desktop: 1440px)
- [ ] Ensure accessibility: ARIA labels, keyboard navigation, color contrast
- [ ] Test form submissions and API calls (preserve existing backend logic)
- [ ] Performance: Optimize images, lazy load room cards if list is long
- [ ] Test on real devices (mobile, tablet, desktop)

---

## Notes

- **Preserve Functionality**: All backend logic, API calls, state management, form submissions must remain unchanged. Only the visual presentation is being redesigned.
- **No Breaking Changes**: Ensure all existing features (creating rooms, joining by code, viewing room lists) continue to work exactly as before.
- **Performance**: Keep animations smooth at 60fps, avoid heavy reflows during interactions.
- **Accessibility**: All interactive elements must be keyboard accessible, form fields must have labels, buttons must have descriptive text.
- **Testing**: Test all user flows: create room, join by code, view My Rooms, view Recently Joined, logout.

---

## Reference Mockup
Refer to `/public/mockups/landing-v1.jpg` for the complete visual design reference. This prompt describes the technical implementation of that design.
