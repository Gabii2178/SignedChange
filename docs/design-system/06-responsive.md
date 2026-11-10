# Responsive rules

Mobile-first. Layouts are one column until the breakpoint that has a real second column. Do not scale the desktop page down.

| Name | Width | What changes |
|---|---|---|
| Small phone | 320–399 px | 16 px margin. Buttons are full width. Hero type 28 px. No side-by-side fields |
| Phone | 400–599 px | Same as small, with 16 px margin. Signature canvas height 160 px |
| Large phone | 600–767 px | Two-column field pairs (company and role). Margin 24 px. Wizard stays one column |
| Tablet | 768–1023 px | Marketing hero becomes two columns: copy left 60%, product image right 40%. App list can show status beside the title. Navigation is still the header, not a sidebar |
| Laptop | 1024–1279 px | Content width 1120 px. Optional app sidebar 240 px if the list and the wizard are not on the same screen. Tables of money lines show description, amount |
| Desktop | 1280–1535 px | Same grid. Hero image max 480 px |
| Large | 1536 px and up | Do not stretch text columns. Extra space stays in the margin |

## Navigation

- Under 768 px: wordmark plus one icon button labeled “Menu”. The panel is a full-width sheet under the 64 px header, not a tiny dropdown. Focus moves into the panel. Escape closes it.
- 768 px and up: inline links. The accent action “Create a change record” stays visible.
- The app does not use a persistent sidebar under 1024 px. A sidebar at 1024 px lists Documents, Verify, Account. It is not a second product nav.

## Forms

- One column under 600 px.
- From 600 px, short pairs share a row: company and role, currency and amount, new date and days added.
- The signature canvas is full width. Height 160 px under 600 px, 180 px above.
- The step footer is sticky to the bottom of the viewport under 768 px: Back as secondary, Continue as primary, both at least 44 px tall. Above 768 px the buttons sit in the page flow, right aligned, Continue last.

## Cards, dialogs, tables

- Pricing cards stack under 768 px and sit in a row of three from 768 px. The Lifetime card is not lifted with a shadow.
- Dialogs are full-screen sheets under 600 px and a 480 px centered dialog above that. Delete confirmation is a dialog, not `window.confirm`.
- Money lines are stacked label/value pairs under 600 px and a three-column row from 600 px. Do not use a horizontal scrolling table for the agreement.

## Signing

- Under 768 px the invited review is one column: title, parties, change, money, agreement sentence, signature, consent, primary sign button, then the decline disclosure.
- From 768 px the agreement sheet is max 720 px centered. The signature sits under the sheet, not beside it. There is no upsell column.

## Motion

Honor `prefers-reduced-motion: reduce`. Progress changes are instant. Spinners may remain but must not be the only status.
