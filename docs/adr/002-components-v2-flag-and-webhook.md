# Components V2 Flag — Irreversibility and Webhook Behavior

**Status:** accepted  
**Context:** Discord's `IS_COMPONENTS_V2` message flag (`1 << 15`) enables container-based (V2) message layouts. Two important constraints were discovered from Discord docs:

1. **The flag is irreversible** — once set on a sent message, it cannot be removed via edit.
2. **Webhooks require `?with_components=true`** — when sending V2 components via a webhook, the query parameter `with_components=true` must be appended to the URL, otherwise components are silently ignored.

**Decision:**
- Added a yellow warning to the "Components-based Message" option in `AddMessagePopover` noting that the V2 flag cannot be reverted on edit.
- Added `hasV2Components()` check in `executeWebhook` and `updateWebhookMessage` — if the payload contains any V2 component types (9, 10, 11, 12, 13, 14, 17), `?with_components=true` is appended to the webhook URL.

**Rationale:**
- Prevents user confusion about why they can't edit a V2 message back to standard.
- Ensures webhook-delivered V2 messages actually render components.

**Consequences:**
- Users are warned upfront before choosing V2.
- Webhook send/edit calls automatically include the required param when V2 components are present — no manual action needed.

**Files:**
- `src/components/announcements/utils/discord.ts` — `hasV2Components`, updated `executeWebhook`, `updateWebhookMessage`
- `src/pages/dashboard/guild/[guildId]/announcements.tsx` — warning in `AddMessagePopover`

---

# Session 2026-06-29 — ComponentEditorForMessage Overhaul

## Changes
1. **Removed `serverEmojis` prop** from `ComponentEditorForMessage` — unused internally. Updated both callers (`announcements.tsx`, `MessageEditorCard.tsx`).
2. **XOR enforcement for V1 Action Rows**:
   - When buttons exist, select adders hidden.
   - When a select exists, button adders hidden.
   - Select type dropdown (`+Select...`) renders only when row is empty — offers String/User/Role/Mentionable/Channel.
3. **Bare V2 top-level components**: Users can now add Text Display, Separator, Media Gallery, File, Section, and Action Row directly as top-level components (not wrapped in Container). A separate purple "+ Container" button creates an empty container. Both bare and container components are rendered inline with move/remove controls.
4. **Recursive V2 total component count**: `totalComponentCount()` counts containers as `1 + children.length`. Header shows `Components (N/40)`.
5. **Recursive custom_id re-ID in duplicate**: `reIdComponent()` traverses nested `components` arrays to re-randomize all `custom_id` fields on clones.
6. **Unused imports cleaned up**: removed `APIStringSelectComponent`, `APIV2TextDisplay`, `ButtonStyle`.

**Files modified:**
- `landing/src/components/announcements/editor/ComponentEditorForMessage.tsx`
- `landing/src/components/announcements/editor/V2ChildEditor.tsx` (type cast fix)
- `landing/src/pages/dashboard/guild/[guildId]/announcements.tsx` (removed `serverEmojis` prop)
- `landing/src/components/announcements/editor/MessageEditorCard.tsx` (removed `serverEmojis` prop)

**Pre-existing errors (unchanged):**
- `MessageEditorCard.tsx:364` — `embedIndex` prop not accepted by `EmbedEditor`
- `announcements.tsx:1699+` — action row component type literals (`number` vs literal `2`/`3`/`8`)

---

# Session 2026-06-29 (part 2) — Field Completeness Pass

## Changes

### V2ChildEditor.tsx
- **Premium button (style 6)**: When style is 6, shows `sku_id` input and hides label, emoji, custom_id/url, disabled fields. Added `+Premium` add button.
- **String Select options editor**: Full sub-editor for `APISelectOption[]` — label, value, description, emoji, default checkbox. Add/remove/25 limit.
- **All selects**: Added `min_values`, `max_values` number inputs, `disabled` and `required` checkboxes.
- **Non-String selects (5-8)**: Added `default_values` editor with add/remove of `{id, type}` entries (User/Role/Channel).
- **Section**: Prevents removal of the last text block (`textChildren.length <= 1` guard + hidden X button).
- **Container (type 17)**: Added to `TYPE_LABELS` for completeness.

### ComponentEditModal.tsx
- **Premium button (style 6)**: Shows SKU ID input, hides emoji picker, label, custom_id/url inputs. Style grid now always shows all 6 styles.
- **String Select options**: Added emoji field to each option.
- **All selects**: Added `required` checkbox with "(modals only)" note.
- **Non-String selects (5-8)**: Added `default_values` editor with add/remove.

### MessageEditorCard.tsx
- **Embed tab hidden in V2 mode**: Filtered from tab bar when `isV2` is true.
- **V2 warnings**: Yellow warning banners on Content tab ("content field is ignored by Discord, use Text Display instead") and Embed tab ("embeds are ignored by Discord").

**Files modified:**
- `landing/src/components/announcements/editor/V2ChildEditor.tsx`
- `landing/src/components/announcements/modals/ComponentEditModal.tsx`
- `landing/src/components/announcements/editor/MessageEditorCard.tsx`

**Pre-existing errors (unchanged):**
- `MessageEditorCard.tsx:376` (was 364) — `embedIndex` prop not accepted by `EmbedEditor`
- `announcements.tsx:1699+` — action row component type literals (`number` vs literal `2`/`3`/`8`)
