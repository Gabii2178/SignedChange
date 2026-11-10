# Color

Values were measured for WCAG 2.2 contrast. Pairs and ratios are in [08-accessibility.md](08-accessibility.md). The strategic brief’s `#F2A900` and the live `#f6a609` are kept as the graphic amber, not as small text on white. Current site navy `#0f4c81` remains available as `--sc-blue-deep` so existing recognition is not thrown away. The official action navy is `#123B63`.

## Light theme (default)

| Token | Hex | Role |
|---|---|---|
| `--sc-navy` | `#123B63` | Brand, headings, primary button fill |
| `--sc-ink` | `#17324A` | Body text, text on amber buttons |
| `--sc-blue` | `#0F5F9E` | Links, focus ring |
| `--sc-blue-deep` | `#0F4C81` | Current-site continuity, optional pressed navy |
| `--sc-amber` | `#F0A202` | Symbol C, accent button fill, focus on navy. Not small text on white |
| `--sc-amber-ink` | `#8A5A00` | Amber text, warning text, the word “Change” on white |
| `--sc-paper` | `#F5F7FA` | Page background |
| `--sc-white` | `#FFFFFF` | Cards, inputs, the agreement sheet |
| `--sc-muted` | `#5C6B7A` | Help text, metadata |
| `--sc-line` | `#D5DEE7` | Borders, dividers |
| `--sc-success` | `#0E6B45` | Signed, success text |
| `--sc-success-bg` | `#E7F6EE` | Success surface |
| `--sc-warning` | `#8A5A00` | Waiting, expiring |
| `--sc-warning-bg` | `#FFF6E0` | Warning surface |
| `--sc-danger` | `#9E1B32` | Errors, destructive text |
| `--sc-danger-bg` | `#FDECEF` | Error surface |
| `--sc-info` | `#0F5F9E` | Informational text |
| `--sc-info-bg` | `#E7F1FA` | Informational surface |
| `--sc-disabled` | `#5C6B7A` | Disabled label |
| `--sc-disabled-bg` | `#EEF2F6` | Disabled fill |

## Where color goes

| Use | Treatment |
|---|---|
| Primary action | Navy fill, white label |
| Accent action | Amber fill, ink label. One per view: “Create a change record” on the marketing site |
| Secondary action | White fill, navy 2 px border, navy label |
| Tertiary action | No fill, navy label, underline on hover |
| Destructive | White fill, danger border, danger label. Confirm before delete |
| Links | Blue, underlined in body copy |
| Document states | See the status table in components. Always pair color with a word and an icon |
| Signature | Navy dashed frame. Signed uses success. Not yet signed uses muted |
| Payment display | Proposed cards only, inside this design system. Struck comparison in muted text with a line through it. Prominent price in navy. Amber is not a “pay” color. No PayPal button styling is changed |

## Dark theme

Used for app chrome and marketing only. The agreement being signed stays on white so it matches the PDF.

| Token | Hex | Role |
|---|---|---|
| `--sc-dark-bg` | `#0E1A27` | Page |
| `--sc-dark-surface` | `#17324A` | Cards, header |
| `--sc-dark-text` | `#F4F7FB` | Primary text |
| `--sc-dark-muted` | `#C5D0DC` | Secondary text |
| `--sc-dark-link` | `#8FB8E8` | Links |
| `--sc-amber` | `#F0A202` | Accent and the word “Change” |
| `--sc-dark-line` | `#245074` | Borders |
| `--sc-dark-danger` | `#FFB3C0` | Error text on dark |
| `--sc-dark-success` | `#8EDEBA` | Success text on dark |

Do not place `#F0A202` text on white. Do not place white text on amber. Do not use the current amber button color as a text link.
