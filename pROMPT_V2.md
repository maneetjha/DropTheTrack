# DropTheTrack Landing Page - Visual Design Prompt for Cursor

You are redesigning a landing page to match the V1 Two-Column Classic layout. The mockup reference is saved at: `/vercel/share/v0-project/public/mockups/landing-v1.jpg`

## CRITICAL: Page Layout Structure (THIS IS KEY)

**DO NOT CENTER CONTENT. DO NOT STACK VERTICALLY.**

The page has THREE main sections:

### SECTION 1: Header (Always at top)
- Slim bar, full width
- Left: DropTheTrack logo + text
- Right: User name "Mj" + purple avatar circle + "Logout" button
- Height: ~60px
- Background: #09090b

### SECTION 2: Hero Section (After header, centered text)
- Large heading: "Welcome back, Mj"
- Subtitle: "Create a room or join an existing one"
- Centered on page
- Margin bottom: 48px

### SECTION 3: Action Cards (Two Side-by-Side - THIS IS CRITICAL)
- **Layout: Use Flexbox with two equal columns**
- Two cards sit HORIZONTALLY NEXT TO EACH OTHER
- Do NOT stack them vertically
- Gap between them: 24px

**LEFT CARD - Create Room:**
- Width: 50% (minus half the gap)
- Background: Glassmorphism (semi-transparent with blur)
- Border: 1px solid rgba(255,255,255,0.1)
- Border Radius: 12px
- Padding: 32px
- Icon: Purple circle (80x80) with musical note icon inside
- Title: "Create a Room" (bold white)
- Subtitle: "Start a listening session with friends" (gray)
- Input field: "Enter room name..." (dark background)
- Button: "Create Room" - Solid purple #7c3aed, full width, hover glow effect
- Accent color: PURPLE

**RIGHT CARD - Join by Code:**
- Width: 50% (minus half the gap)
- Same glassmorphism styling as left card
- Icon: Cyan circle (80x80) with door/arrow icon inside
- Title: "Join by Code" (bold white)
- Subtitle: "Jump into a room with a code" (gray)
- Input field: "Enter room code (e.g. A3F1B2)" (dark background)
- Button: "Join" - Cyan outlined style (border only), hover glow effect
- Accent color: CYAN #06b6d4

### SECTION 4: My Rooms & Recently Joined (Two Equal Columns Below)
- Margin top: 48px
- **Layout: Flexbox with two equal columns**
- Gap between columns: 24px

**LEFT COLUMN - My Rooms:**
- Width: 50%
- Card header: "My Rooms" icon (house icon) + title
- Glassmorphism card container
- Inside: Grid of room cards (if empty, show empty state with "Create your first room")
- Each room card shows: room name, listener count "2 listening", small thumbnail
- Cards have hover lift effect and subtle glow

**RIGHT COLUMN - Recently Joined:**
- Width: 50%
- Card header: "Recently Joined" icon (clock icon) + title
- Glassmorphism card container
- Inside: Grid of recently joined rooms (if empty, show "Join a room to see it here")
- Same card styling as My Rooms
- Hover effects: lift and glow

### SECTION 5: Footer
- Margin top: 48px
- Centered text: "Ready to listen together? Create or join a room to get started"
- Muted gray text (#6b7280)
- Padding bottom: 24px

---

## Color Palette (Copy EXACTLY)

```
Background: #09090b
Card Background: rgba(15, 15, 19, 0.8) or semi-transparent
Text Primary: #ffffff
Text Secondary: #6b7280
Purple Accent: #7c3aed (Create Room button, accents)
Cyan Accent: #06b6d4 (Join by Code button, accents)
Border: rgba(255, 255, 255, 0.1)
Green (live): #10b981
```

---

## Typography (Use Inter font)

- **Hero Heading** ("Welcome back, Mj"): 48px bold
- **Hero Subtitle**: 16px gray
- **Card Titles** ("Create a Room", "Join by Code"): 20px bold white
- **Card Subtitles**: 14px gray
- **Labels/Input**: 14px
- **Button text**: 16px bold
- All headings: font-weight 600-700
- Line height: 1.5

---

## Glassmorphism (Used on ALL Cards)

Every card uses this effect:
```
background: rgba(255, 255, 255, 0.05)
backdrop-filter: blur(10px)
border: 1px solid rgba(255, 255, 255, 0.1)
border-radius: 12px
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1)
```

On hover, cards should:
- Lift up slightly (transform: translateY(-4px))
- Add subtle glow around border
- Increase backdrop blur slightly

---

## Buttons

**Purple "Create Room" Button:**
- Background: solid #7c3aed
- Text: white bold
- Padding: 12px 32px
- Border radius: 8px
- Hover: Add glow effect (box-shadow: 0 0 20px rgba(124, 58, 237, 0.6))
- Full width on cards

**Cyan "Join" Button (Outlined):**
- Background: transparent
- Border: 2px solid #06b6d4
- Text: #06b6d4 bold
- Padding: 12px 32px
- Border radius: 8px
- Hover: Add glow effect (box-shadow: 0 0 20px rgba(6, 182, 212, 0.4))
- Full width on cards

**"Enter Room" Button (in room cards):**
- Same as "Create Room" button (purple solid)

---

## Room Cards (Inside My Rooms & Recently Joined)

Each room card shows:
- Small thumbnail/image (80x80 or similar)
- Room name (white, bold, 16px)
- "X listening" or "X people" count (small gray text, 12px)
- Optional: "Enter Room" button at bottom (purple solid)

Cards have:
- Border radius: 8px
- Glassmorphism effect (optional, can be simpler than main cards)
- Hover: lift and glow

---

## Icons

Use simple line icons or SVG icons:
- Musical note (for Create Room)
- Door/entry arrow (for Join by Code)
- House (for My Rooms)
- Clock (for Recently Joined)

Icon circles: 80x80 background circles with icons centered inside
- Purple circle for Create Room
- Cyan circle for Join by Code
- Optional glow effect on hover

---

## Responsive Design (Mobile)

On screens < 768px:
- Stack the two action cards VERTICALLY (one above the other)
- Stack My Rooms & Recently Joined sections VERTICALLY
- Reduce padding to 24px
- Reduce hero heading size to 32px
- Full width inputs and buttons
- Maintain all spacing ratios

---

## Key Points to Remember

1. **TWO-COLUMN layout for action cards** - NOT centered, NOT stacked
2. **TWO-COLUMN layout for My Rooms + Recently Joined** - NOT stacked
3. **Glassmorphism on EVERY card** - blur, semi-transparent, subtle border
4. **Buttons have glow effects** - subtle but visible on hover
5. **Preserve all form functionality** - backend logic stays the same
6. **No gradients** - use solid colors only
7. **Generous spacing** - 32px padding, 24-48px gaps between sections
8. **Smooth animations** - hover effects should be smooth, not jarring

---

## Implementation Checklist

- [ ] Page uses flexbox for layout (NOT centering in a flex column by default)
- [ ] Action cards are in a two-column layout (side by side on desktop)
- [ ] My Rooms & Recently Joined are in a two-column layout (side by side on desktop)
- [ ] All cards have glassmorphism styling applied
- [ ] Icons are displayed correctly (musical note, door, house, clock)
- [ ] Purple button on Create Room card works
- [ ] Cyan button on Join Code card works
- [ ] Form inputs are styled correctly
- [ ] Mobile layout stacks sections vertically and looks good
- [ ] Hover effects work (lift, glow)
- [ ] Colors match the palette exactly
- [ ] Typography sizes match
- [ ] All spacing is consistent (32px padding, 24px gaps)
- [ ] Empty states show appropriate messages
- [ ] Room cards display correctly with listener counts

---

## Reference Files

- Mockup: `/vercel/share/v0-project/public/mockups/landing-v1.jpg`
- Existing globals.css has theme colors defined
- Use Tailwind classes where possible, add custom CSS for glassmorphism

Good luck! Make it look premium, sleek, and organized. The two-column layout is the most important thing to get right.
