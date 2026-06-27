# Announcement Module — Visual Architecture

## 1. Page Structure (2 entry points)

### A) Public Landing Page (`landing/src/pages/announcements.tsx`)
- **Layout:** `max-w-7xl mx-auto px-4` with a 2-column grid `lg:grid-cols-[1fr_480px]`
- **Left column (editor):** Messages list → Channel picker → Message editor (Content/Embed/Components tabs)
- **Right column (preview):** `DiscordMessagePreview` (inline component) → Presets panel → Dashboard CTA button
- **All components are inline** — no shared component library, everything in one file
- **Theme:** `#000000` background for editor, `#2b2d31` for preview, accent color `#06b6d4` (cyan)
- **State:** `AnnouncementForm { channel_ids[], entries[] }` — stored locally, no backend calls
- **Presets:** Saved to local state array only (no persistence)

### B) Dashboard Guild Page (`landing/src/pages/dashboard/guild/[guildId]/announcements.tsx`)
- **Layout:** Full-height flex split `h-[calc(100%_-_3rem)] flex`
  - Left (50%): `w-1/2`, scrollable, contains all editors/controls
  - Right (50%): `w-1/2`, bg `EMBED_BG` (#2b2d31), scrollable, contains `DiscordPreview[]`
- **Components:** Uses the full shared component library (30 files under `components/announcements/`)
- **Data flow:** `QueryData { version, messages[], targets[] }` — single state object, deep-cloned via `cloneQueryData`
- **Backend integration:** Fetches guild/channels/emojis on mount, presets saved via `PUT /api/backend/modules/:guildId/announcements`, send via `POST /api/backend/guilds/:guildId/announcements`

## 2. Component Tree (Dashboard Page)

```
GuildAnnouncementsPage (page component)
├── DashboardLayout (wrapper with sidebar)
├── CodeGenerator (modal) — discord.js/discord.py code generation
├── ComponentEditModal (modal) — full button/select menu editor
│
├── LEFT COLUMN (w-1/2, py-4 px-4, overflow-y-scroll)
│   ├── StatusBanner — success/error/info/sending notifications
│   ├── Action Bar — Share, Presets, Generate Code, Reset buttons
│   ├── Webhook Targets — text input + target list with remove
│   ├── Channel Picker — #channel pills with All/None toggle
│   │   Visual: selected = "border-primary/50 bg-primary/10 text-primary"
│   │          unselected = "border-zinc-800 text-zinc-500"
│   ├── Send Button — full width, cyan bg (#06b6d4), "Sending..." pulse when active
│   ├── MessageEditorCard[] (one per message) — the core editor
│   │   ├── Header: up/down move, duplicate, remove, collapse toggle
│   │   │   - Selected state: "border-primary/40 bg-primary/5"
│   │   │   - Unselected: "border-zinc-800 bg-black"
│   │   │   - V2 badge: "rounded bg-primary/10 px-1 py-0.5 text-[9px] text-primary"
│   │   ├── Tab bar: Content | Embeds | Files | Components | JSON
│   │   │   Visual: "rounded-lg border border-zinc-800 bg-black p-0.5"
│   │   │   Active tab: "bg-primary/15 text-primary"
│   │   │   Inactive: "text-zinc-500"
│   │   ├── Warnings — red border boxes for limit violations
│   │   ├── Content tab: textarea (maxLength=2000), 0/2000 counter
│   │   │   Counter: green < 1800, yellow >= 1800, red at 2000
│   │   ├── Embeds tab: EmbedEditor[] + Add Embed button
│   │   │   Empty state: dashed border with FileText icon
│   │   │   Limit warning bar when > 6000 chars
│   │   ├── Files tab: FileAttachmentEditor
│   │   │   Drop zone: dashed border, changes to "border-primary bg-primary/10" on drag
│   │   │   File rows: icon + filename + size + imgbb badge + "in use" tag + copy URI + edit + delete
│   │   ├── Components tab: ComponentEditorForMessage
│   │   │   V1: Action Rows with +Btn/+Sel buttons, inline component chips
│   │   │   V2: Container list with Text/Divider/Media/Thumb/File/Section buttons
│   │   └── Flags row: Suppress Embeds | Suppress Notifications | Allow Mentions checkboxes
│   │
│   ├── Add Message button — dashed border, opens dropdown (Standard | Components V2)
│   └── Presets panel — collapsible section with save/load/delete
│       Save as "Draft" (amber) or "Template" (violet)
│
└── RIGHT COLUMN (w-1/2, EMBED_BG bg, overflow-y-scroll)
    └── DiscordPreview[] (one per message)
        ├── Empty state: animated SVG eye (mouse-following pupil, click-to-spin)
        ├── Thread header: icon + name + thumbnail + MessageDivider
        ├── Avatar row: avatar image + "APP" badge + "V2" badge + timestamp
        ├── Markdown content (full Discord syntax renderer)
        ├── Gallery (media grid: 1-10 items, auto-layouts)
        ├── FileAttachment (image cards, voice memo, generic file cards)
        ├── Embed (author, title, desc, fields, images/video, footer, timestamp)
        ├── ActionRow (Button/Select previews) OR Container (V2 accent bar)
        └── Compact mode for multi-message display
```

## 3. All 31 Files with Roles

### Page Files (2)
| File | Lines | Role |
|------|-------|------|
| `landing/src/pages/announcements.tsx` | 1040 | Public tool page — standalone, all inline |
| `landing/src/pages/dashboard/guild/[guildId]/announcements.tsx` | 572 | Dashboard page — uses shared library |

### Type Definitions (2)
| File | Lines | Role |
|------|-------|------|
| `components/announcements/types.ts` | 177 | All TS interfaces: Discord API types, V2 types, DraftFile, QueryData, FlowAction, Token |
| `components/announcements/constants.ts` | 65 | ACCENT, EMBED_BG, BUTTON_STYLES (6 styles), EMBED_PRESETS (10), 1850+ Unicode emojis, DISCORD_LIMITS |

### State/Data Flow
| File | Lines | Role |
|------|-------|------|
| `components/announcements/utils/message.ts` | 90 | createMessage, cloneQueryData, isComponentsV2, hasFlag, getMessageLimitWarnings |
| `components/announcements/utils/files.ts` | 46 | File URI resolution, imgbb badge logic, fileSize formatting |
| `components/announcements/utils/color.ts` | 44 | intToHex, hexToInt, hexToHsv, hsvToHex, decimalToRgb |
| `components/announcements/utils/codegen.ts` | 163 | generateDiscordJs, generateDiscordPy |
| `components/announcements/utils/markdown.tsx` | 513 | Full Discord markdown parser — custom rule-based parser (no lib), renders headings/code/blocks/mentions/timestamps/emojis |

### Editor Components (7)
| File | Lines | Role |
|------|-------|------|
| `editor/MessageEditorCard.tsx` | 488 | Main editor card — 5 tabs, warnings, flags, collapsible header |
| `editor/EmbedEditor.tsx` | 631 | Embed composer — collapsible sections: Author, Body, Fields, Images, Footer+Timestamp |
| `editor/FileAttachmentEditor.tsx` | 345 | File upload — drag/drop/paste, file list, edit modal, imgbb badges |
| `editor/ComponentEditorForMessage.tsx` | 139 | V1 action rows or V2 containers management |
| `editor/V2ContainerEditor.tsx` | 91 | V2 Container builder — add/remove/move children, accent color |
| `editor/V2ChildEditor.tsx` | 188 | V2 child editors — text, thumb, media, file, divider, section with accessory |
| `editor/JsonEditor.tsx` | 112 | Raw JSON editor with Zod validation against messageDataSchema |

### Preview Components (8)
| File | Lines | Role |
|------|-------|------|
| `preview/DiscordPreview.tsx` | 305 | Main preview — empty state (animated eye), thread header, avatar, content, gallery, embeds, components |
| `preview/Embed.tsx` | 197 | Rich embed — provider, author, title, desc, fields grid, images, video, thumbnail, footer, relative timestamp |
| `preview/Gallery.tsx` | 178 | Media grid — 10 layouts (1-10 items), YouTube/Vimeo thumbnails, Tenor GIF→MP4 |
| `preview/Container.tsx` | 115 | V2 container — accent bar, text, thumb, media gallery, file, divider, section with accessory |
| `preview/ActionRow.tsx` | 110 | Button/Select previews — 6 button styles, select with dropdown options |
| `preview/FileAttachment.tsx` | 114 | File cards — image with metadata, voice memo waveform, generic file card |
| `preview/UnifiedPreview.tsx` | 46 | Multi-message container — hover/selected states, selection indicator |
| `preview/MessageDivider.tsx` | 9 | Horizontal divider with centered date text |

### Modals (2)
| File | Lines | Role |
|------|-------|------|
| `modals/ComponentEditModal.tsx` | 342 | Button/Select editor — emoji picker, style selector, options list, preview, FlowAction editor |
| `modals/CodeGenerator.tsx` | 55 | Code snippet viewer — discord.js/discord.py tab, copy button |

### Pickers (2)
| File | Lines | Role |
|------|-------|------|
| `pickers/EmojiPickerPopover.tsx` | 103 | Emoji picker — Unicode by category, server emojis, search, custom ID input |
| `pickers/ColorSwatch.tsx` | 147 | HSV color picker — hue slider, sat/value 2D picker, hex input, no-color, portal popover |

### Other UI (2)
| File | Lines | Role |
|------|-------|------|
| `StatusBanner.tsx` | 12 | Colored status bar — success(emerald), error(red), info(sky), sending(amber) |
| `FlowActionEditor.tsx` | 91 | Flow actions — add_role, remove_role, send_message, create_thread, custom |

### Library (1)
| File | Lines | Role |
|------|-------|------|
| `lib/backend.ts` | 46 | getBackendApiUrl, getFrontendAppUrl — env var resolution |

## 4. Visual Style Tokens

### Colors
```
Accent:     #06b6d4 (cyan)           — buttons, active states, badges
Embed BG:   #2b2d31 (dark grey)      — preview background
Message BG: #313338 (slightly lighter) — message background
Text:       #dbdee1 (off-white)      — message content
Editor BG:  #000000                  — left column background
Border:     zinc-800 (#27272a)       — default borders
            zinc-700 (#3f3f46)       — hover/input borders
            zinc-600 (#52525b)       — focus borders
Primary:    #5865f2 (Discord blurple) — selected card borders
```

### Button Styles (discord-like)
```
Style 1 (Primary):   bg #5865f2, text #fff
Style 2 (Secondary): bg #4e5058, text #dbdee1
Style 3 (Success):   bg #248046, text #fff
Style 4 (Danger):    bg #da373c, text #fff
Style 5 (Link):      bg transparent, text #00a8fc, border #00a8fc
Style 6 (Premium):   bg #9b59b6, text #fff
```

### Spacing
```
Page padding:      px-4 py-8 (sm: px-6 sm:py-12)
Card padding:      px-3 py-2 (headers), px-3 py-3 (bodies)
Section gap:       space-y-3
Message gap:       space-y-2
Editor/preview:    gap-6 on lg grid
Tab bar:           p-0.5 rounded-lg
Channel pills:     px-2 py-0.5 rounded border
```

### Typography
```
Page heading:      text-5xl sm:text-6xl lg:text-7xl leading-[1.05]
Section heading:   text-sm uppercase tracking-wider text-[#8a8a8a]
Message content:   text-[15px] font-medium leading-[1.25]
Embed title:       text-lg font-semibold
Field name:        text-xs font-semibold
Field value:       text-xs
Small text:        text-[10px] or text-[9px]
Font:              font-discord (custom), font-mono for code
```

### Interactive States
```
Button hover:     hover:brightness-110
Button active:    active:brightness-90
Disabled button:  disabled:cursor-not-allowed disabled:opacity-50
Card hover:       hover:border-zinc-700
Card selected:    border-primary/40 bg-primary/5
Input focus:      focus:border-zinc-600 focus:outline-none
Hover reveal:     opacity-0 group-hover:opacity-100 (for move/delete buttons)
Tab active:       bg-primary/15 text-primary
Tab inactive:     text-zinc-500 hover:text-zinc-300
Tag selected:     border-primary/50 bg-primary/10 text-primary
Tag unselected:   border-zinc-800 text-zinc-500 hover:border-zinc-600
```

## 5. Key Visual Patterns

### Card Pattern (used everywhere)
```tsx
"rounded-lg border border-zinc-800 bg-black p-3"
// Selected variant:
"border-primary/40 bg-primary/5"
```

### Tab Bar Pattern
```tsx
"flex gap-1 rounded-lg border border-zinc-800 bg-black p-0.5"
// Tab items:
"flex-1 rounded px-2 py-1 text-[10px] font-medium transition-colors"
// Active: "bg-primary/15 text-primary"
// Inactive: "text-zinc-500 hover:text-zinc-300"
```

### Dashed Add Button Pattern
```tsx
"flex w-full items-center justify-center gap-1 rounded-lg border-2 border-dashed border-zinc-700 py-2.5 text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
```

### Input Field Pattern
```tsx
"w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600"
```

### Inline Tag Pattern (channels, status)
```tsx
"inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
```

## 6. Data Flow Diagram

```
User Action → State Update → Re-renders
──────────────────────────────────────────
Edit content      → updateMessageData({ content }) → DiscordPreview re-renders
Edit embed field  → updateEmbed(ei, { title })     → EmbedPreview re-renders
Add file          → addFiles(FileList)             → FileAttachmentEditor + DiscordPreview
Edit component    → open ComponentEditModal         → Save → updateMessageData({ components })
Add message       → addMessage(isV2)               → new MessageEditorCard + DiscordPreview
Send              → POST to backend                  → JSON or FormData

State (QueryData):
{
  version: "d2",
  messages: [{
    _id: string,
    data: {
      content?: string,
      embeds?: APIEmbed[],
      components?: APITopLevelComponent[],
      flags?: number,
      thread_name?: string,
      allowed_mentions?: APIAllowedMentions
    },
    reference?: string (message link for edits)
  }],
  targets?: [{ type: TargetType.Webhook|Bot, url?: string }]
}
```

## 7. File Attachment Flow

```
User drops/pastes file → DraftFile[] (local state, per message)
  → ImgBB check (mimetype in IMG_HOST_MIMETYPES list)
    → If compatible: shows green "imgbb" badge
  → "in use" tag if URI matches any embed field
  → On Send: files attached to FormData or JSON

File metadata: { id, file?: File, url?, name, size, spoiler, description?, content_type? }
```

## 8. Critical UX Rules

1. **Empty state:** Every section shows a meaningful placeholder (eye SVG, "No embeds yet", "No messages", dashed borders with icons)
2. **Limit enforcement:** Counters show green→yellow→red progression; warnings shown in red bordered boxes; disabled buttons when hitting limits
3. **V1 vs V2 mode:** Determined by `flags & (1<<15)`. V1 shows action rows with 5-button limit. V2 shows containers with accent bars
4. **Selected message:** Only one message can be editing at a time; editing state global in page
5. **Presets:** Saved per-guild via backend API; two tiers — Draft (amber) and Template (violet)
6. **Errors:** Only first failure message surfaced; rest silently dropped
7. **Sleep:** Hardcoded 250ms between sends, 500ms between channels
