"""Build the SignedChange 2.0 logo family. Geometry is original; lettering is Noto Sans Bold converted to paths."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

OUT = Path(__file__).resolve().parent
FONT = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"
font = TTFont(FONT)
gs = font.getGlyphSet()
cmap = font.getBestCmap()
UPEM = font["head"].unitsPerEm

NAVY, FOLD, FOLD_SHADE, AMBER, INK, AMBER_INK, PAPER, WHITE = (
    "#123B63", "#E7F1FA", "#1E5F92", "#F0A202", "#17324A", "#8A5A00", "#F4F7FB", "#FFFFFF"
)

def glyph_path(ch, size, x, y):
    glyph = gs[cmap[ord(ch)]]
    pen = SVGPathPen(gs)
    scale = size / UPEM
    glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, x, y)))
    return pen.getCommands(), glyph.width * scale

def wordmark(size, x, y, signed, change, gap=0):
    cx, cmds = x, []
    for text, fill in (("Signed", signed), ("Change", change)):
        for ch in text:
            d, w = glyph_path(ch, size, cx, y)
            cmds.append(f'<path fill="{fill}" d="{d}"/>')
            cx += w
        cx += gap
    return "".join(cmds), cx - gap

def symbol(s, fold, fold_shade, c, check, check_edge):
    return f'''<g id="symbol">
  <path fill="{s}" d="M78 22c0-10-9-16-22-16-16 0-26 8-26 20 0 14 12 18 28 22 10 2 16 6 16 14 0 8-7 14-18 14-9 0-16-4-19-10l-14 6c5 14 18 22 34 22 18 0 32-10 32-26 0-14-10-22-26-26-12-3-18-6-18-13 0-6 5-10 13-10 8 0 13 3 16 8z"/>
  <path fill="{fold}" d="M36 14h13L36 25z"/>
  <path fill="{fold_shade}" d="M36 14l7 2-7 7z"/>
  <path fill="{c}" d="M108 58A28 28 0 1 1 100 114A28 28 0 1 1 108 58ZM98 70A14 14 0 1 0 94 104A14 14 0 1 0 98 70Z" fill-rule="evenodd"/>
  <path fill="{c}" d="M96 108l16 14-12-1-7-10z"/>
  <circle cx="102" cy="112" r="2.2" fill="{check_edge}"/>
  <path fill="{check_edge}" d="M40 78l10 13 26-32 8 6-34 42-18-20z"/>
  <path fill="{check}" d="M44 80l8 10 22-26 5 4-27 34-14-16z"/>
</g>'''

def svg(view, body, label):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" role="img" aria-label="{label}">{body}</svg>\n'

SYM = symbol(NAVY, FOLD, FOLD_SHADE, AMBER, WHITE, NAVY)
SYM_DARK = symbol(PAPER, "#245074", "#8FB8E8", AMBER, NAVY, PAPER)
SYM_MONO = symbol(NAVY, WHITE, "#1E5F92", NAVY, WHITE, NAVY)
SYM_MONO_REV = symbol(WHITE, NAVY, "#8FB8E8", WHITE, NAVY, WHITE)

files = {
    "symbol.svg": svg("0 0 156 136", SYM, "SignedChange symbol"),
    "symbol-dark.svg": svg("0 0 156 136", SYM_DARK, "SignedChange symbol for dark backgrounds"),
    "symbol-mono.svg": svg("0 0 156 136", SYM_MONO, "SignedChange symbol, one ink"),
    "symbol-mono-inverse.svg": svg("0 0 156 136", SYM_MONO_REV, "SignedChange symbol, reversed one ink"),
    "favicon.svg": svg("0 0 32 32", '''
      <rect width="32" height="32" rx="7" fill="#123B63"/>
      <path fill="#F0A202" d="M22 8c6 1 9 6 8 11 0 4-3 7-7 7-2 0-3-.4-4-1.2l1.6-1.6c.6.4 1.4.6 2.2.6 2.4 0 4-1.8 4-4.2 0-2.6-1.8-4.2-4.2-4.6L21 15l1-7z"/>
      <path fill="#F0A202" d="M24.5 23.2l4.2 3.4-3.2-.2-1.6-2.6z"/>
      <circle cx="25.6" cy="24.2" r=".7" fill="#123B63"/>
      <path fill="#123B63" d="M7.2 16.2l2.4 3.1 6.2-7.6 2 1.5-8.1 10-4.3-4.8z"/>
      <path fill="#FFFFFF" d="M8.2 16.6l2 2.5 5.2-6.2 1.2 1-6.4 8.1-3.4-3.8z"/>
    ''', "SignedChange favicon"),
}

def lockup(sym, signed, change, stacked=False):
    mark, end = wordmark(28 if not stacked else 22, 0, 28 if not stacked else 22, 0)
    if not stacked:
        body = f'<g transform="translate(0,0) scale(0.46)">{sym}</g>'
        body += f'<g transform="translate(84,18)">{mark}</g>'
        # end is word width at the size used inside wordmark(); wordmark uses size 28, y 28
        width = 84 + end + 8
        return svg(f"0 0 {width:.0f} 72", body, "SignedChange")
    body = f'<g transform="translate(46,0) scale(0.42)">{sym}</g>'
    mark2, end2 = wordmark(18, 0, 18, 0)
    body += f'<g transform="translate({(112 - end2)/2:.1f},78)">{mark2}</g>'
    return svg("0 0 112 104", body, "SignedChange stacked")

# wordmark() colors are arguments; lockup above ignores them. Rebuild explicitly.
def horizontal(s_fill, c_fill, check, edge, signed, change, label):
    sym = symbol(s_fill, FOLD if s_fill == NAVY else "#245074", FOLD_SHADE if s_fill == NAVY else "#8FB8E8", c_fill, check, edge)
    mark, end = wordmark(28, 0, 28, 0)
    # recolor by regenerating with requested fills
    mark, end = wordmark(28, 0, 28, 0)
    # wordmark uses the function default colors unless we pass them — fix call
    return sym, end

def make_word(size, y, signed, change):
    cx, out = 0, []
    for text, fill in (("Signed", signed), ("Change", change)):
        for ch in text:
            d, w = glyph_path(ch, size, cx, y)
            out.append(f'<path fill="{fill}" d="{d}"/>')
            cx += w
    return "".join(out), cx

def hlock(sym, signed, change, label, word=30, scale=0.48, gap=86):
    mark, end = make_word(word, word + 2, signed, change)
    body = f'<g transform="scale({scale})">{sym}</g><g transform="translate({gap},8)">{mark}</g>'
    return svg(f"0 0 {gap+end+6:.0f} {max(68, word+24):.0f}", body, label)

def slock(sym, signed, change, label):
    mark, end = make_word(20, 20, signed, change)
    scale = 0.46
    sym_w = 156 * scale
    width = max(end + 24, sym_w + 24)
    body = f'<g transform="translate({(width - sym_w)/2:.1f},0) scale({scale})">{sym}</g>'
    body += f'<g transform="translate({(width - end)/2:.1f},74)">{mark}</g>'
    return svg(f"0 0 {width:.0f} 104", body, label)

files["primary.svg"] = hlock(SYM, NAVY, AMBER_INK, "SignedChange")
files["horizontal.svg"] = hlock(SYM, NAVY, AMBER_INK, "SignedChange horizontal", word=26, scale=0.40, gap=74)
files["horizontal-dark.svg"] = hlock(SYM_DARK, PAPER, AMBER, "SignedChange on dark")
files["stacked.svg"] = slock(SYM, NAVY, AMBER_INK, "SignedChange stacked")
files["stacked-dark.svg"] = slock(SYM_DARK, PAPER, AMBER, "SignedChange stacked on dark")
files["primary-mono.svg"] = hlock(SYM_MONO, NAVY, NAVY, "SignedChange monochrome")

for name, data in files.items():
    (OUT / name).write_text(data)
    print(name, len(data))
