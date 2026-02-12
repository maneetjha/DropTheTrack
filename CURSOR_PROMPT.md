# DropTheTrack -- Complete Frontend Redesign Prompt

You are redesigning the frontend of **DropTheTrack**, a collaborative music listening room app. DO NOT touch any backend logic, API routes, socket/real-time connections, YouTube integration, authentication, or database code. Only rewrite/restyle the UI components, CSS, and layout. Preserve every existing prop, callback, event handler, and data flow -- just wrap them in the new design.

---

## DESIGN SYSTEM

### Color Palette (exactly 5 colors, use CSS variables everywhere)

```
--background:        #09090b    (near-black, main background)
--surface:           #13131a    (cards, panels, elevated surfaces)
--surface-hover:     #1c1c27    (hover state for interactive surfaces)
--brand:             #7c3aed    (primary purple accent -- buttons, active states, highlights)
--brand-glow:        #7c3aed33  (purple at 20% opacity -- ambient glows, subtle fills)
--text-primary:      #f4f4f5    (main text, headings)
--text-secondary:    #a1a1aa    (subtitles, metadata, timestamps)
--text-muted:        #52525b    (hints, disabled text)
--border:            #27272a    (card borders, dividers)
--border-glow:       rgba(124, 58, 237, 0.15)  (purple-tinted glass borders)
--danger:            #ef4444    (LIVE badge)
--success:           #22c55e    (online indicator)
```

### Typography

- **Font stack:** `Inter` for body/UI, `Space Grotesk` for display headings (room name, "Up Next", "Now Playing", "Chat" titles).
- **Heading sizes:** Room name 28px/bold, Section titles ("Up Next", "Chat") 18px/semibold, Song titles 15px/medium, Body/meta 13px/regular.
- **Line height:** All body text at 1.5, headings at 1.2.
- **Letter spacing:** Section titles +0.5px tracking for that premium feel.

### Glassmorphism Recipe (use on all cards/panels)

```css
.glass-panel {
  background: rgba(19, 19, 26, 0.8);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(124, 58, 237, 0.1);
  border-radius: 16px;
}
```

### Spacing Scale

- Use 16px as the base unit.
- Panel internal padding: 20px (desktop), 16px (mobile).
- Gap between queue cards: 12px.
- Gap between chat messages: 16px.
- Section spacing (between title and content): 16px.

### Transitions

- All interactive elements: `transition: all 150ms ease`.
- Hover on cards: translate Y -1px + slightly brighter border.
- Button press: scale(0.97).

### Scrollbar (apply to all scrollable panels)

```css
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #27272a; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #7c3aed; }
```

---

## LAYOUT ARCHITECTURE

### Desktop (>= 1024px): 3-Column Grid

```
+-------------------------------------------------------+
|                    HEADER (56px)                       |
+-------------------------------------------------------+
| QUEUE PANEL  |  NOW PLAYING PANEL  |   CHAT PANEL     |
| (320px fixed)|  (flex: 1, fills)   |   (300px fixed)  |
| full height  |  full height        |   full height    |
+-------------------------------------------------------+
```

- The outer container is `height: 100vh; display: flex; flex-direction: column;`
- Below header: `display: flex; flex: 1; overflow: hidden;`
- Queue panel: `width: 320px; flex-shrink: 0;`
- Now Playing: `flex: 1; min-width: 0;`
- Chat panel: `width: 300px; flex-shrink: 0;`
- Each panel has its own internal scroll with the custom scrollbar.
- Panels are separated by a 1px `var(--border)` vertical divider.

### Tablet (768px - 1023px): 2-Column + Slide-over Chat

- Queue: 300px fixed left.
- Now Playing: flex 1 right.
- Chat: slides in as an overlay panel from the right (300px wide) triggered by a chat icon button. Has a semi-transparent dark backdrop behind it.

### Mobile (< 768px): Tab-based Full-screen

- Bottom tab bar (56px height) with 3 tabs: Queue, Player, Chat.
- Each tab takes the full viewport minus header and tab bar.
- Active tab indicator: small 3px-wide purple dot/bar under the active icon.
- Header on mobile: back arrow, room name centered, room code pill.

---

## COMPONENT SPECIFICATIONS

### 1. HEADER

```
[ Logo + "DropTheTrack" ]                    [ Username  (Avatar)  Logout ]
```

- Height: 56px.
- Background: `var(--surface)` with `border-bottom: 1px solid var(--border)`.
- Left: Music note icon (Lucide `Music` icon inside a 32x32 rounded-lg box with `var(--brand)` background) + "DropTheTrack" in Space Grotesk 20px bold white.
- Right: Username in 14px `var(--text-secondary)`, circular avatar (32x32) with user initial on `var(--brand)` background, "Logout" text button in `var(--text-muted)` that turns `var(--text-primary)` on hover.
- On mobile: hide username text, show only avatar + a hamburger or just the avatar.

### 2. QUEUE PANEL (Left Column)

This is the most important panel -- give it breathing room.

#### Room Info Block (top of panel)

- Room name: Space Grotesk 28px bold `var(--text-primary)`.
- Below: flex row with "X songs" in `var(--text-secondary)` 13px, a small green circle (8x8, `var(--success)`, with a CSS `animation: ping 2s infinite` pulsing ring), "X online" in `var(--text-secondary)`.
- Room code: pill badge, `var(--surface-hover)` background, `var(--border)` border, code in 13px monospace `var(--brand)`, copy icon (Lucide `Copy`) on click copies to clipboard with a brief "Copied!" tooltip.
- Optional kebab menu (3 dots) for room settings.
- Bottom margin: 20px before search.

#### Search Bar

- Full width, height 44px, rounded-xl (12px).
- Background: `var(--surface)`, border: `1px solid var(--border)`.
- On focus: border transitions to `var(--brand)` with `box-shadow: 0 0 0 3px var(--brand-glow)`.
- Magnifying glass icon (Lucide `Search`) on left in `var(--text-muted)`.
- Placeholder: "Search YouTube for a song..." in `var(--text-muted)`.
- Bottom margin: 24px.

#### Section Title: "Up Next"

- Space Grotesk 18px semibold `var(--text-primary)`, with a small 24px-wide 3px-thick purple underline accent bar beneath.
- Bottom margin: 16px.

#### Queue Song Cards

Each card is a glassmorphism card:

```
+----------------------------------------------------------+
| [Rank#]  [Thumbnail 56x56]  Title (wrapping ok)   [Vote] |
|                              added by Name  [YOU]         |
+----------------------------------------------------------+
```

- Card: `.glass-panel` styles, padding: 12px 16px, `display: flex; align-items: center; gap: 12px;`.
- **Rank number:** 20px bold `var(--text-muted)`, width 24px, centered.
- **Thumbnail:** 56x56, rounded-lg (8px), `object-fit: cover`. If the currently playing song, overlay a small animated equalizer icon (3 bars animating height) in the bottom-right corner of the thumbnail.
- **Text area** (flex: 1, min-width: 0):
  - Song title: 14px medium `var(--text-primary)`, allow wrapping to 2 lines max, `line-clamp: 2`.
  - Below: flex row, "added by [Name]" in 12px `var(--text-secondary)`, and if the current user added it, a small "YOU" pill badge: `var(--brand)` background, white 10px bold text, rounded-full, padding 2px 8px.
- **Vote section** (flex-shrink: 0, flex column, items-center):
  - Upvote arrow icon (Lucide `ChevronUp`), 20px, `var(--text-muted)` default, `var(--brand)` when voted.
  - Vote count: 13px `var(--text-secondary)`.
  - Clicking should call your existing upvote handler.
- **Currently playing card** (the #1 or active song): add a `border-left: 3px solid var(--brand)` and a subtle `background: var(--brand-glow)` fill. The rank number turns `var(--brand)` color. Add a subtle `box-shadow: inset 0 0 20px var(--brand-glow)`.
- **Gap between cards:** 12px.
- **Hover on non-active cards:** `background: var(--surface-hover)`, border brightens slightly.

### 3. NOW PLAYING PANEL (Center Column)

This panel is centered and breathable.

#### Layout

- Flex column, items centered, justify center.
- Padding: 32px top/bottom, 40px left/right.
- Overflow-y auto for very small screens.

#### LIVE Badge

- At the top: flex row, a pulsing red dot (8x8, `var(--danger)`, `animation: pulse 2s infinite`), "LIVE" text in 12px bold uppercase `var(--danger)`, tracking +1px.
- Margin bottom: 16px.

#### Album Art / Video Thumbnail

- Max-width: 100%, aspect-ratio: 16/9, rounded-xl (16px), `object-fit: cover`.
- **Ambient glow:** Apply `box-shadow: 0 0 80px 20px var(--brand-glow), 0 0 160px 60px rgba(124, 58, 237, 0.08)` to create a purple halo bleeding outward.
- If you can extract a dominant color from the thumbnail, use that instead of purple for the glow. Otherwise, default to brand purple.
- Margin bottom: 24px.

#### Song Info

- Song title: Space Grotesk 22px bold `var(--text-primary)`, text-center, `text-balance`.
- "added by [Name]": 14px `var(--text-secondary)`, text-center.
- Margin bottom: 24px.

#### Progress Bar

- Full width of content area (capped at 500px, centered).
- Track: 4px height, rounded-full, `var(--surface-hover)` background.
- Fill: `var(--brand)` background, rounded-full, width = currentTime/duration %.
- Handle: 14px circle, `var(--brand)` fill, white 2px border, absolute positioned at the fill edge. Only visible on hover (opacity transition). Has `box-shadow: 0 0 8px var(--brand-glow)`.
- Draggable -- connect to your existing seek handler.
- Below the bar: flex row justify-between, current time left and total time right, both 12px `var(--text-muted)`.
- Margin bottom: 24px.

#### Playback Controls

- Centered row, gap: 24px, items-center.
- **Skip Back** (Lucide `SkipBack`): 24px icon, `var(--text-secondary)`, hover `var(--text-primary)`.
- **Play/Pause** (main button): 56px circle, `var(--brand)` background, white icon (Lucide `Play` or `Pause`), 24px icon size. Hover: slightly brighter purple, `box-shadow: 0 0 16px var(--brand-glow)`. Active/press: `scale(0.95)`.
- **Skip Forward** (Lucide `SkipForward`): same as skip back.
- Margin bottom: 16px.

#### Volume Control

- Flex row centered, gap: 12px, max-width: 200px.
- Speaker icon (Lucide `Volume2`): 18px, `var(--text-secondary)`.
- Slider: same style as progress bar but smaller (3px track height, 12px handle). Fill color: `var(--text-secondary)` (not purple, to visually differentiate from progress).
- Volume number: 13px `var(--text-muted)`.
- Margin bottom: 8px.

#### Subtitle

- "Play/pause controls the room for everyone" in 11px `var(--text-muted)`, text-center, italic.

### 4. CHAT PANEL (Right Column -- DEDICATED, ALWAYS VISIBLE ON DESKTOP)

This is a full-height panel, not an overlay. It must feel like a real messaging app.

#### Layout

- Flex column, full height.
- Header at top, message list (flex: 1, overflow-y: auto), input at bottom.

#### Chat Header

- Height: 48px, flex row, items-center, padding: 0 16px.
- "Chat" in Space Grotesk 16px semibold `var(--text-primary)`.
- Right side: message count or online avatars stacked (small 20px circles overlapping by 6px).
- Border-bottom: `1px solid var(--border)`.

#### Message List

- Padding: 16px.
- Gap between messages: 16px.
- Scroll to bottom on new messages (auto-scroll, but stop if user has scrolled up).

##### Other User's Message (left-aligned):

```
(Avatar 28px)  Username        timestamp
               [message bubble                ]
```

- Avatar: 28x28 circle, user initial, random muted color or `var(--brand)` bg, white text 12px.
- Username: 13px semibold `var(--brand)` (purple to make usernames pop).
- Timestamp: 11px `var(--text-muted)`, right-aligned or after username.
- Message bubble: `var(--surface)` background, `border: 1px solid var(--border)`, rounded-xl but with `border-top-left-radius: 4px` (chat bubble style). Padding: 10px 14px. Text: 14px `var(--text-primary)`, line-height 1.5.

##### Own Message (right-aligned):

```
                          timestamp
[message bubble with purple tint    ]
```

- Bubble: `background: rgba(124, 58, 237, 0.15)`, `border: 1px solid rgba(124, 58, 237, 0.2)`, rounded-xl but `border-bottom-right-radius: 4px`. Text: 14px `var(--text-primary)`.
- No avatar needed. Timestamp below in 11px `var(--text-muted)`, right-aligned.

##### System Message (centered):

- For events like "Mj added Sugar to the queue".
- Centered, 12px `var(--text-muted)`, with a small music note icon inline.
- Optional: wrap in a pill with `var(--surface)` background, rounded-full, padding 4px 12px.

#### Chat Input

- Sticky at bottom, padding: 12px 16px, `border-top: 1px solid var(--border)`, background: `var(--surface)`.
- Flex row, gap: 8px.
- Text input: flex 1, height 40px, rounded-full (20px), `var(--background)` bg, `1px solid var(--border)` border, padding: 0 16px, 14px text. Focus: border turns `var(--brand)`, `box-shadow: 0 0 0 3px var(--brand-glow)`.
- Send button: 40x40 circle, `var(--brand)` bg, white arrow-up icon (Lucide `SendHorizontal`), 18px. Hover: brighter. Disabled state (empty input): `var(--surface-hover)` bg, `var(--text-muted)` icon.

---

## AMBIENT BACKGROUND EFFECT

Behind the entire app (z-index: 0, fixed position, pointer-events: none), add 2-3 large soft blurred circles to create a subtle ambient atmosphere:

```css
.ambient-orb-1 {
  position: fixed;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  background: rgba(124, 58, 237, 0.06);
  filter: blur(100px);
  top: 20%;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 0;
}

.ambient-orb-2 {
  position: fixed;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: rgba(124, 58, 237, 0.04);
  filter: blur(80px);
  bottom: 10%;
  right: 10%;
  pointer-events: none;
  z-index: 0;
}
```

These should be very subtle -- barely noticeable -- just to add depth. The main content sits on top.

---

## ANIMATIONS & MICRO-INTERACTIONS

### Equalizer Bars (for LIVE/now-playing indicator)

```css
@keyframes equalizer-1 { 0%, 100% { height: 4px; } 50% { height: 16px; } }
@keyframes equalizer-2 { 0%, 100% { height: 8px; } 50% { height: 12px; } }
@keyframes equalizer-3 { 0%, 100% { height: 12px; } 50% { height: 4px; } }

.equalizer {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 16px;
}
.equalizer span {
  width: 3px;
  border-radius: 1px;
  background: var(--brand);
}
.equalizer span:nth-child(1) { animation: equalizer-1 0.8s ease infinite; }
.equalizer span:nth-child(2) { animation: equalizer-2 0.6s ease infinite; }
.equalizer span:nth-child(3) { animation: equalizer-3 0.7s ease infinite; }
```

Use this in:
- Header (next to logo when music is playing).
- Currently playing song card thumbnail overlay.
- LIVE badge area.

### Ping (for online indicator)

```css
@keyframes ping {
  0% { transform: scale(1); opacity: 1; }
  75%, 100% { transform: scale(2); opacity: 0; }
}
.online-dot::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--success);
  animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
}
```

### Button Hover Glow

For the main play/pause button and send button:
```css
.glow-button:hover {
  box-shadow: 0 0 20px var(--brand-glow), 0 0 40px rgba(124, 58, 237, 0.1);
}
```

### Card Hover Lift

```css
.queue-card:hover {
  transform: translateY(-1px);
  border-color: rgba(124, 58, 237, 0.2);
  background: var(--surface-hover);
}
```

### Smooth Panel Transitions (mobile tab switching)

When switching tabs on mobile, use a `transition: opacity 150ms ease, transform 150ms ease` for a subtle fade+slide effect, or use framer-motion's `AnimatePresence` if already in the project.

---

## MOBILE-SPECIFIC DETAILS

### Bottom Tab Bar

```
+----------------------------------------------+
|   (Queue icon)   (Player icon)   (Chat icon)  |
|    Queue           Player          Chat        |
+----------------------------------------------+
```

- Height: 56px + safe area bottom padding.
- Background: `var(--surface)`, `border-top: 1px solid var(--border)`.
- Each tab: flex column, items-center, gap: 4px.
- Icon: Lucide `ListMusic` (queue), `Disc3` (player), `MessageCircle` (chat). 20px size.
- Label: 11px.
- Inactive: `var(--text-muted)`.
- Active: `var(--brand)` with a 3px-wide purple dot beneath the icon.
- If chat has unread messages, show a small red dot (6x6) on the chat icon's top-right.

### Mobile Header

- Height: 48px.
- Left: back arrow (Lucide `ChevronLeft`), tapping calls your existing "leave room" handler.
- Center: Room name in 16px semibold.
- Right: Room code pill (compact), or online count.

### Mobile Player Tab

- Album art takes ~60% of available height.
- Controls are more spaced out vertically.
- Add a small "3 new messages" notification bar at the very bottom (above the tab bar) linking to chat tab -- a thin glass bar, 36px height, with chat icon + "X new messages" text, tappable.

---

## RESPONSIVE BREAKPOINTS SUMMARY

| Breakpoint | Layout | Chat |
|---|---|---|
| >= 1024px | 3 columns (Queue 320px, Player flex, Chat 300px) | Always visible right column |
| 768-1023px | 2 columns (Queue 300px, Player flex) | Slide-over overlay from right |
| < 768px | Single column, tab-based | Dedicated Chat tab |

---

## IMPORTANT RULES

1. **DO NOT** modify any backend, API, socket, or database code.
2. **DO NOT** change any data fetching logic, state management patterns, or business logic.
3. **PRESERVE** every existing prop, callback, event handler, and data shape.
4. **USE** the exact CSS variable names above -- define them in `:root` or your global CSS.
5. **USE** Lucide React icons (`lucide-react` package) for all icons.
6. **USE** `Inter` and `Space Grotesk` from Google Fonts (next/font/google if Next.js).
7. **EVERY** interactive element needs hover, focus, and active states.
8. **EVERY** color must come from CSS variables -- no hardcoded hex in components.
9. **TEST** at 1440px, 1024px, 768px, and 390px widths.
10. Queue cards MUST have generous spacing -- this is a social feature, not a cramped list.
11. Chat MUST be a first-class dedicated panel on desktop, not hidden behind a toggle.
12. All images must have alt text for accessibility.
13. Use semantic HTML: `<main>`, `<nav>`, `<aside>`, `<header>`, `<section>`.
14. All focus states should have a visible purple ring: `outline: 2px solid var(--brand); outline-offset: 2px;`.
