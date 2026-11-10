# Accessibility and contrast

Target: WCAG 2.2 AA. Ratios below were measured with the relative-luminance formula. “AA” means at least 4.5:1 for normal text. “Large” means at least 3:1, which also covers UI boundaries.

## Measured pairs

| Ratio | Pair | Use | Result |
|---|---|---|---|
| 13.19 | `#17324A` on `#FFFFFF` | Body text | AA |
| 12.29 | `#17324A` on `#F5F7FA` | Body on paper | AA |
| 11.47 | `#123B63` on `#FFFFFF` | Headings, primary button label | AA |
| 11.47 | `#FFFFFF` on `#123B63` | Label on primary button | AA |
| 10.68 | `#123B63` on `#F5F7FA` | Headings on page | AA |
| 8.86 | `#0F4C81` on `#FFFFFF` | Legacy navy, still legal for text | AA |
| 6.66 | `#0F5F9E` on `#FFFFFF` | Links and focus | AA |
| 6.20 | `#17324A` on `#F0A202` | Label on accent button | AA |
| 5.93 | `#8A5A00` on `#FFFFFF` | Word “Change”, warning text | AA |
| 5.51 | `#8A5A00` on `#FFF6E0` | Warning on its surface | AA |
| 5.47 | `#5C6B7A` on `#FFFFFF` | Muted text, disabled text | AA |
| 5.10 | `#5C6B7A` on `#F5F7FA` | Muted on page | AA |
| 4.86 | `#5C6B7A` on `#EEF2F6` | Disabled control | AA |
| 7.90 | `#9E1B32` on `#FFFFFF` | Error text | AA |
| 6.93 | `#9E1B32` on `#FDECEF` | Error on its surface | AA |
| 6.55 | `#0E6B45` on `#FFFFFF` | Success text | AA |
| 5.87 | `#0E6B45` on `#E7F6EE` | Success on its surface | AA |
| 5.83 | `#0F5F9E` on `#E7F1FA` | Info on its surface | AA |
| 16.34 | `#F4F7FB` on `#0E1A27` | Dark theme body | AA |
| 12.28 | `#F4F7FB` on `#17324A` | Dark card text | AA |
| 11.23 | `#C5D0DC` on `#0E1A27` | Dark muted | AA |
| 8.52 | `#8FB8E8` on `#0E1A27` | Dark links | AA |
| 8.26 | `#F0A202` on `#0E1A27` | Amber wordmark on dark | AA |
| 2.13 | `#F0A202` on `#FFFFFF` | Bright amber as text | Fail. Do not use |
| 2.02 | `#F6A609` on `#FFFFFF` | Current site amber as text | Fail. Current button uses black text, which passes |

Disabled controls keep 4.86:1 so the label can still be read. They are not a second status color. The control is also `aria-disabled` or `disabled`, and it does not receive pointer activation.

Focus: 2 px solid `#0F5F9E`, offset 2 px. On a navy button the ring is `#F0A202`, which is 5.39:1 against `#123B63`. Never remove the outline without replacing it.

## Interaction

- Every control has a visible name. Icon buttons include `aria-label`.
- Hit target is at least 24 by 24 px for WCAG 2.2, and 44 px tall for primary, secondary, and destructive buttons.
- Tab order follows the visual order. The wizard does not trap focus except inside a dialog.
- Escape closes the menu and dialogs.
- The signature canvas is not the only way to sign. “Type my name instead” remains, producing the same PNG the API already accepts.
- Status uses a word plus an icon. Color is extra.
- Errors use `aria-invalid` and `aria-describedby`, matching the pattern already in `site/app.js`.
- `prefers-reduced-motion: reduce` disables non-essential transitions.
- The cookie dialog is not a substitute for a focus trap on destructive confirms.

Do not claim a certification. These are build rules for Milestone 4.
