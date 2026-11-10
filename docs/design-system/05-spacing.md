# Spacing and layout

Base unit: 4 px.

| Token | Value | Use |
|---|---|---|
| 1 | 4 px | Icon gap, focus offset |
| 2 | 8 px | Label to input, inline icon gap |
| 3 | 12 px | Related controls |
| 4 | 16 px | Card padding on mobile, form row gap |
| 5 | 24 px | Card padding on desktop, section stack inside a step |
| 6 | 32 px | Between page regions |
| 7 | 48 px | Between homepage sections on mobile |
| 8 | 64 px | Between homepage sections on desktop |

| Layout | Rule |
|---|---|
| Marketing content width | 1120 px, centered |
| Text column | 720 px for articles, FAQ, legal |
| App content | 720 px for the wizard. List may use 1120 px |
| Page margin | 16 px under 600 px, 24 px from 600 px, 32 px from 1024 px |
| Card padding | 16 px mobile, 24 px from 600 px |
| Form field gap | 16 px vertical. Label sits 8 px above the control |
| Grid | 12 columns, 16 px gutter, only from 1024 px. Below that, one column |
| Border radius | 6 px badges, 8 px inputs and buttons, 12 px cards and dialogs |
| Border thickness | 1 px default, 2 px for the selected card, the signature frame, and the focus ring |
| Shadow | One elevation only: `0 8px 24px rgba(14, 26, 39, 0.12)` on dialogs and the sticky mobile action bar. Cards are flat, separated by the border |
| Elevation | Page, then card, then dialog, then toast. Do not stack shadows |

The agreement preview is a white sheet with a 1 px `#D5DEE7` border and 24 px padding. It is not a card with a tint. The tinted card is for chrome around it.
