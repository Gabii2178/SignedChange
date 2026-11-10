# Typography

Face: Noto Sans. It is a free face already present on this build environment (`NotoSans-Regular.ttf`, `NotoSans-Bold.ttf`). Do not add Inter, Manrope, or a paid font. The strategic brief allowed Inter or Manrope as a starting idea. Noto Sans is the portable choice and the wordmark outlines were taken from Noto Sans Bold so the logo and the UI match.

Fallback stack: `"Noto Sans", "Segoe UI", Helvetica, Arial, sans-serif`.

Numbers and money: the same face with `font-variant-numeric: tabular-nums`. Document metadata and fingerprints: `ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace` at 12 px, line-height 1.45.

The agreement sheet inside the product uses the same sans. Do not imitate a legal serif. The PDF generator still uses Helvetica inside the Worker. Milestone 4 does not change PDF fonts.

| Role | Size | Weight | Line height | Notes |
|---|---|---|---|---|
| Display | 40 px | 700 | 1.15 | Desktop hero only. Mobile hero is 32 px |
| H1 | 32 px | 700 | 1.2 | Page title. Mobile 28 px |
| H2 | 24 px | 700 | 1.25 | Section. Mobile 22 px |
| H3 | 18 px | 700 | 1.35 | Card title |
| Body | 16 px | 400 | 1.5 | Minimum for product text |
| Body strong | 16 px | 700 | 1.5 | |
| Lead | 18 px | 400 | 1.45 | Homepage intro. Mobile 16 px |
| Label | 14 px | 600 | 1.3 | Above inputs. Never below 14 px |
| Help | 14 px | 400 | 1.4 | Muted color |
| Button | 16 px | 700 | 1 | |
| Badge | 12 px | 700 | 1.2 | Uppercase not required |
| Document body | 16 px | 400 | 1.5 | The words being signed |
| Money | 20 px | 700 | 1.2 | Tabular numbers |

Do not use the current `clamp` hero if it drops below 28 px. Do not use `.small` at 0.88 rem for anything the user must read in order to sign. Agreement text is body size.
