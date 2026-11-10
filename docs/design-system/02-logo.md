# Logo evolution

## What is actually in the repo

Two identities exist. They are not the same drawing.

The PNG files `site/logo.png` and `site/logo-full.png` are the recognizable brand: a navy S whose top-left corner is a folded page, an amber C that ends in a pen nib, a white check across both letters, and the wordmark SIGNED in navy and CHANGE in amber. That matches the historical description and the check the strategic brief asks to keep.

The SVG files `site/logo.svg`, `site/favicon.svg`, `site/wordmark.svg`, and `site/wordmark-dark.svg` are a different mark. They are a rounded navy tile with three stroked letterforms and a small amber arc. The SVG `aria-label` says “SNc logo”. They use gradients (`#1565a8` to `#0a2f52`, `#ffc23d` to `#f08c00`). They do not show a folded S, a pen-nib C, or a check.

Milestone 3 evolves the PNG identity. It does not evolve the mismatched SVG tile, and it does not overwrite any file in `site/`.

## Direction

Keep SC, the check, the folded corner, the pen nib, and blue against amber. Remove the gradient, the soft shadow, and the tiny details that disappear under 24 px. Draw with flat fills so the mark still reads in one ink.

The folded corner is a small light triangle on the top of the S, with a darker navy underside. It is a page curl, not a separate arrow. The C is an open amber ring; its lower end is a nib with a navy ink dot. The check is white with a navy edge so it stays visible on both letters.

Bright amber `#F0A202` is a shape color. It fails WCAG text contrast on white (2.13:1). The word “Change” in the lockup uses `#8A5A00` (5.93:1 on white), which is the text-safe amber. On a dark ground, “Change” can return to `#F0A202` because that pair is 8.26:1 on `#0E1A27`.

Lettering is Noto Sans Bold converted to paths, so the SVG does not depend on a paid font or on the viewer having Inter installed. Noto Sans is the UI face as well.

## Family

| File | Use |
|---|---|
| `logo/primary.svg` | Master lockup, symbol plus wordmark, light ground |
| `logo/horizontal.svg` | Same lockup, slightly smaller, for a 64 px header |
| `logo/stacked.svg` | Symbol above the wordmark, for square spaces |
| `logo/symbol.svg` | Symbol only, light ground |
| `logo/symbol-dark.svg` | Light S, amber C, for navy grounds |
| `logo/symbol-mono.svg` | One navy ink |
| `logo/symbol-mono-inverse.svg` | One white ink |
| `logo/primary-mono.svg` | One-ink lockup |
| `logo/horizontal-dark.svg` | Header on navy |
| `logo/stacked-dark.svg` | Stacked on navy |
| `logo/favicon.svg` | 32 px tile: navy field, white check, amber nib. The full pen geometry is not readable at 16 px, so the favicon keeps the colors and the check and drops the inner S counter. |

Clear space: 16 px around the lockup at header size, or one-quarter of the symbol height, whichever is larger. Minimum symbol size in the interface is 24 px. Minimum favicon tile is 16 px. Do not recolor the check to amber. Do not set the wordmark in a second typeface. Do not put a gradient back.
