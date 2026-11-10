# Decisions

| Decision | Choice | Why |
|---|---|---|
| Which logo to evolve | `site/logo.png` and `site/logo-full.png` | They are the SC, fold, nib, and check. The SVG tile is a different drawing |
| Flat color | No gradients in the new family | The strategic brief asked for a flat mark that survives small sizes |
| Amber text | `#8A5A00` on white, `#F0A202` only as a shape or on navy | Measured contrast. Bright amber on white is 2.13:1 |
| UI font | Noto Sans | Free, installed, and the wordmark outlines come from the same Bold file |
| Primary button | Navy, not amber | Amber stays the single accent so it is not on every control |
| Light default | Yes, plus dark chrome | The agreement stays white so it matches the PDF |
| “Sign in” | The existing key screen | The brief’s nav label is not approval for passwords |
| In-person consent | Checkbox in the UI only | The create API does not require `agree` for in-person. Do not invent a field |
| Status names | The server statuses plus one local draft label | There is no review event, invite event, or audit timeline API |
| Verify when the coordinator is down | `503`, not the KV body | Milestone 2 removed that fallback |
| Prices | $0 / $9 / $49 as they are | Payment is frozen |
| New public origin in copy | `https://signedchange.com` | Owner direction. Do not retarget PayPal URLs as part of branding |
| Favicon | Simplified tile | The pen nib and S counter do not survive at 16 px. The check and amber on navy do |

Unresolved on purpose: the exact product screenshot in the hero does not exist yet. Milestone 4 uses a designed sheet, not a fake customer document. Whether dark chrome ships in the same release as the light pages is an implementation slice, not a brand change. The wordmark has no space between Signed and Change, matching the current PNG.
