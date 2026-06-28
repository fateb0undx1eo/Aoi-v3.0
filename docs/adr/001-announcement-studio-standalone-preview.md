# Announcement Studio — Standalone Preview (Session Context)

**Status**: active  
**Context**: Working on the Announcements page at `landing/src/pages/dashboard/guild/[guildId]/announcements.tsx`. We converted it from a dashboard-authenticated page to a standalone preview that works without Discord login/backend.

## Changes Made

### 1. Removed DashboardLayout wrapper (line 4, 757, 1162)
- Stripped the `DashboardLayout` import and wrapper so the page renders standalone
- Changed container height from `calc(100vh - 120px)` to `100vh` to fill viewport properly

### 2. ToolbarButton component (line ~47)
- Removed glow (`boxShadow`) on hover
- Removed colored semi-transparent borders/backgrounds
- Removed `pulse` dot (Send button indicator)
- Now uses `translateY(-2px)` pop-up on hover instead of border
- Tooltip moved below button (`top: calc(100% + 4px)`)

### 3. Toolbar Icons
- Reset: `RefreshCw` (circular arrows)
- Undo: `CornerUpLeft`
- Redo: `CornerUpRight`
- Presets: `Save` (floppy disk)
- Send: `SendHorizonal` (horizontal paper plane)
- All icons flat white on hover, muted by default

### 4. Wordmark icon (line ~833)
- Removed `boxShadow` glow
- Changed from gradient background to solid `C.burg`

### 5. "Studio" text gradient (line ~851)
- Changed from burgundy-to-pink to subtle burgundy-to-wine-red diagonal gradient

### 6. Cleaned up unused imports
- Removed `ACCENT` color constants
- Removed unused icon imports (`Wand2`, `LayoutTemplate`, `Rocket`)

### 7. Tightened spacing
- Header padding: `10px 14px 8px` → `8px 12px 6px`
- Title row margin: `10px` → `6px`
- Button gap: `5px` → `2px`
- Button size: `30x30` → `26x26`, radius `8` → `6`
- Icon size: `13px` → `14px`

## Next Steps (heavier logic)
The user wants to continue with the functional/logic work in a new session. Things likely to work on:
- History/undo-redo system refinement
- Message CRUD (add/remove/clone messages)
- Embed editor functionality
- Component editor (buttons, selects, V2)
- File attachments
- Send flow / webhook integration
- Preset save/load
- State persistence
