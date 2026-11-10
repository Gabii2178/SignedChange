# Components

Each component lists purpose, appearance, variants, interaction, responsive behavior, and accessibility. Do not invent a second style for the same job.

## Main website navigation

Purpose: move among Product, Solutions, Resources, Pricing, and About, and start a record.

Appearance: 64 px bar, navy `#123B63`, white wordmark from `horizontal-dark.svg` at 32 px tall. Links 16 px white. Current link has a 2 px amber underline, not a color-only change.

Variants: marketing only.

Interaction: current page is `aria-current="page"`. Create is the accent button.

Responsive: under 768 px, links move into the menu sheet. Create stays in the bar if it fits, otherwise it is the first item in the sheet and a full-width button.

Accessibility: menu button is “Menu”, `aria-expanded`, focus moves into the sheet.

## Application navigation

Purpose: Documents, Verify, Account. Not a marketing menu.

Appearance: under 1024 px, the same 64 px header. From 1024 px, a 240 px left column, paper background, navy text, 44 px rows. Active row is info surface plus a navy 3 px leading bar and the word of the section.

Interaction: does not sign the user out. Account holds the key backup, which is the existing bearer key, not a password.

Responsive: no sidebar under 1024 px.

Accessibility: `nav` with a name “Application”.

## Mobile navigation

Purpose: the sheet described above.

Appearance: full width, paper, 56 px rows, 1 px dividers.

Interaction: first and last item are in the tab cycle. Escape or the close button returns focus to Menu.

Responsive: only under 768 px.

Accessibility: `aria-modal` is not required if focus is moved and background is inert.

## Breadcrumbs

Purpose: only inside Resources and a document detail view. Not on the wizard.

Appearance: 14 px muted, current page is ink and not a link. Separator is “/” with `aria-hidden`.

Interaction: links go up. Document detail crumb is the title, truncated at 32 characters with the full title in `title`.

Responsive: wrap, do not scroll horizontally.

Accessibility: `nav` named “Breadcrumb”.

## Buttons

Purpose: one action.

Appearance: 44 px min height, 16 px horizontal padding, 8 px radius, 16 px bold label.

Variants:

| Variant | Fill | Label | Border |
|---|---|---|---|
| Primary | `#123B63` | white | none |
| Accent | `#F0A202` | `#17324A` | none |
| Secondary | white | `#123B63` | 2 px navy |
| Tertiary | none | `#0F5F9E` | none, underline on hover |
| Destructive | white | `#9E1B32` | 2 px danger |
| Icon | white | none visible | 1 px line, 44 px square |

Loading: label remains, spinner is extra, `aria-busy="true"`. Disabled: disabled colors, no pointer.

Interaction: one primary per view. Enter on a step submits Continue, not the whole wizard, except on the sign step.

Responsive: full width under 600 px when stacked. In the sticky footer they share the row, Continue at least half the width.

Accessibility: if the button has only an icon, `aria-label` is required. Focus ring as in the accessibility doc.

## Text input, textarea, select, date

Purpose: one field.

Appearance: 48 px height for single line, 16 px text, 16 px padding, 1 px `#D5DEE7`, 8 px radius, white fill. Textarea min height 120 px. Date uses the native control.

Variants: default, focus (2 px `#0F5F9E`), invalid (2 px `#9E1B32` plus error text), disabled.

Interaction: label is always visible. Placeholder is an example, not the label.

Responsive: 100% of the column.

Accessibility: `label for`, `aria-invalid`, `aria-describedby` for help and error. Do not rely on color.

## Checkbox and radio

Purpose: consent, signing mode, price direction when drawn as a choice.

Appearance: 24 px control, 16 px label, 8 px gap. Selected radio is navy. Selected checkbox is navy with a white check.

Interaction: the whole label is clickable. Price direction is a radio group, not a select, so the three choices are visible.

Responsive: stack.

Accessibility: `fieldset` and `legend` for the group.

## Validation, help, required

Purpose: explain the server rule before and after submit.

Appearance: help is 14 px muted, 8 px under the control. Error is 14 px `#9E1B32` with an error icon. Required is the word “Required” in the label, not only an asterisk.

Interaction: on blur, run the same check the step lists. On Continue, focus the first invalid field.

Responsive: full width under the field.

Accessibility: error is in the described-by list and is a live region `polite` if it appears after submit.

## Cards

Purpose: a group of related facts.

Appearance: white, 1 px line, 12 px radius, 16/24 px padding. No shadow.

Variants: plain, selectable (2 px navy when chosen), warning (warning surface, still with an icon and a sentence).

Interaction: if the whole card is a link, it is one tab stop.

Responsive: stack.

Accessibility: do not nest interactive controls inside a linked card.

## Badges and status

Purpose: say the server state.

Appearance: 12 px bold, 4 px 8 px padding, 6 px radius, icon plus word.

| State | Words | Surface | Text | Icon |
|---|---|---|---|---|
| Browser draft | Draft on this device | warning | `#8A5A00` | pencil |
| Pending | Waiting for signature | info | `#0F5F9E` | clock |
| Signed | Signed | success | `#0E6B45` | check |
| Declined | Declined | danger | `#9E1B32` | hand |
| Cancelled | Cancelled | disabled | `#5C6B7A` | slash |
| Deleted | Not shown in the list | | | |
| Unavailable | Can’t confirm yet | warning | `#8A5A00` | alert |

“Draft” is only the `localStorage` draft. It is not `doc.status`. Pending is the server status before a terminal `life` record. Do not invent “Awaiting review” or “Invitation sent” as server states. The product can say “Link copied on this device.”

Interaction: status is not a button unless the row itself opens the document.

Responsive: the word does not truncate to the icon.

Accessibility: the icon is `aria-hidden`. The word is the name.

## Alerts

Purpose: a sentence the user must notice.

Appearance: the status surfaces, 16 px padding, icon, 16 px text. Error alerts use `role="alert"`.

Variants: error, warning, success, info.

Interaction: dismiss is optional and is a tertiary button.

Responsive: full width of the column.

Accessibility: do not auto-dismiss an error.

## Tooltips

Purpose: a short definition, such as “CO number is assigned when you create the record.”

Appearance: ink background, paper text, 12 px, max 240 px.

Interaction: hover and focus. Not for required instructions.

Responsive: on touch, use help text under the field instead.

Accessibility: `aria-describedby`, not title-only.

## Modals

Purpose: destructive confirm, key backup warning.

Appearance: 480 px, or full screen under 600 px. Title is H2. Primary and secondary in the footer.

Interaction: focus trap, Escape cancels, focus returns.

Responsive: sheet.

Accessibility: `aria-modal="true"`, labelled by the title.

## Dropdowns

Purpose: account menu only. Template choice is a select, not a custom dropdown.

Appearance: paper panel, 1 px line, 44 px items.

Interaction: arrow keys move, Enter chooses, Escape closes.

Responsive: same.

Accessibility: listbox or menu pattern. Do not build a new one if `select` works.

## Empty, loading, error

Purpose: the list and the verify page when there is nothing or the coordinator is down.

Appearance: empty is an H2, one sentence, and a primary button. Loading is a spinner plus “Loading document”. Error for 503 is “We can’t confirm this document right now” and a Retry button. Error for 409 is “This copy doesn’t match the stored record. Reload and try again.”

Interaction: Retry repeats the same request. It does not create a document.

Responsive: centered in the column, max 420 px.

Accessibility: loading uses `aria-busy`. Error uses `role="alert"`.

## Document summary

Purpose: title, CO number if the server returned one, date, status.

Appearance: H1 or H3, then the status badge, then muted date.

Interaction: none.

Responsive: title wraps.

Accessibility: status text is in the heading’s following element, not only color.

## Party information

Purpose: show `biz`, optional company and role, contact, and the same for `client`.

Appearance: two definition lists. “From” and “Other party”.

Interaction: on the creator review, Edit returns to step 2 without losing other steps.

Responsive: stack.

Accessibility: `dl` with `dt`/`dd`.

## Document preview

Purpose: the words that will be hashed.

Appearance: white sheet, document body type, the agreement sentence in the info surface.

Interaction: read only.

Responsive: padding 16 px under 600 px, 24 px above.

Accessibility: the agreement sentence is normal text, not an image.

## Signature capture

Purpose: produce the PNG the API already accepts.

Appearance: full-width canvas, 2 px dashed navy, white. Buttons “Type my name instead” and “Clear”.

Interaction: pointer draw. Type paints the name into the canvas, as `site/app.js` and `site/sign.js` do now. Creator typed signatures are not stored as `signerTyped`. Only the invited signer sends `typed: true`. Do not claim otherwise.

Responsive: height 160 / 180 px as in the responsive doc.

Accessibility: the type action is the keyboard path. The canvas has a label.

## Review confirmation

Purpose: the creator or signer says they have read the sheet.

Appearance: checkbox, 16 px label.

Interaction: Continue or Sign stays disabled until it is checked. For in-person, the checkbox is a UI gate only. `POST /doc/create` does not currently require `agree` for in-person. Milestone 4 must not add a new required API field. Remote `POST /doc/sign` does require `agree: true`.

Responsive: the label wraps beside the 24 px box.

Accessibility: the checkbox name includes “I agree”.

## Activity list

Purpose: show what the API actually returns on `/account/me`.

Appearance: rows with title, other party, money, date, status, and the server `declineReason` when present. Pagination uses `limit` and `cursor`. Show `nextCursor` as a “Next” button. Do not draw an audit timeline of “viewed” or “invited”. Those events are not stored.

Interaction: row opens detail. Delete and cancel stay on the detail view, not as icon-only row actions.

Responsive: one column. Status under the title under 600 px.

Accessibility: the list is a `ul`. Next is a button, not an infinite scroll.
