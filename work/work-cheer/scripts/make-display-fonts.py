"""Draw the two numeral fonts used by the 像素 and 液晶 themes.

Usage: python scripts/make-display-fonts.py [preview-dir]
Writes public/fonts/wc-pixel.woff2 (arcade dot-matrix numerals) and public/fonts/wc-lcd.woff2
(seven-segment numerals). Both are drawn here from scratch for this project, so they carry the
project's own licence and need no third-party notice. With a preview-dir, plain .ttf copies are
written there too (for rendering checks). Needs fontTools and brotli (../../fontdeps is used
when present, like subset-font.py).
"""
from pathlib import Path
import hashlib
import json
import math
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DEPS = ROOT.parent / 'fontdeps'
if DEPS.exists():
    sys.path.insert(0, str(DEPS))
from fontTools.fontBuilder import FontBuilder  # noqa: E402
from fontTools.pens.ttGlyphPen import TTGlyphPen  # noqa: E402

UPM = 1000
OUT = ROOT / 'public' / 'fonts'
PREVIEW = Path(sys.argv[1]) if len(sys.argv) > 1 else None

# ---------------------------------------------------------------- 像素: 7×7 arcade numerals
# One em is ten pixels (7 cap rows, 1 descender row, 2 rows of leading), so a font-size that is a
# multiple of 10px lands every dot on whole screen pixels. Stems are two dots wide, bars one.
PX = 100
PIXEL = {
    '0': ['.#####.', '##...##', '##...##', '##...##', '##...##', '##...##', '.#####.'],
    '1': ['...##..', '..###..', '.####..', '...##..', '...##..', '...##..', '.######'],
    '2': ['.#####.', '##...##', '.....##', '..####.', '.##....', '##.....', '#######'],
    '3': ['.#####.', '##...##', '.....##', '..####.', '.....##', '##...##', '.#####.'],
    '4': ['....##.', '...###.', '..####.', '.##.##.', '##..##.', '#######', '....##.'],
    '5': ['#######', '##.....', '######.', '.....##', '.....##', '##...##', '.#####.'],
    '6': ['.#####.', '##...##', '##.....', '######.', '##...##', '##...##', '.#####.'],
    '7': ['#######', '.....##', '....##.', '...##..', '..##...', '..##...', '..##...'],
    '8': ['.#####.', '##...##', '##...##', '.#####.', '##...##', '##...##', '.#####.'],
    '9': ['.#####.', '##...##', '##...##', '.######', '.....##', '##...##', '.#####.'],
    '.': ['..', '..', '..', '..', '..', '##', '##'],
    ',': ['..', '..', '..', '..', '..', '##', '##', '#.'],
    ':': ['..', '##', '##', '..', '##', '##', '..'],
    '+': ['......', '..##..', '..##..', '######', '..##..', '..##..', '......'],
    '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
    '/': ['.....##', '....##.', '...##..', '...##..', '..##...', '.##....', '##.....'],
    '%': ['.......', '##...##', '##..##.', '...##..', '..##...', '.##..##', '##...##'],
    '¥': ['##....##', '.##..##.', '..####..', '########', '...##...', '########', '...##...'],
}


def trace(rows):
    """Outline the lit dots as closed loops: shared edges cancel, so touching dots become one shape."""
    edges = set()
    for r, row in enumerate(rows):
        for c, cell in enumerate(row):
            if cell != '#':
                continue
            x0, x1, y1 = c * PX, (c + 1) * PX, (7 - r) * PX
            y0 = y1 - PX
            for edge in (((x0, y0), (x0, y1)), ((x0, y1), (x1, y1)), ((x1, y1), (x1, y0)), ((x1, y0), (x0, y0))):
                reverse = (edge[1], edge[0])
                if reverse in edges:
                    edges.remove(reverse)
                else:
                    edges.add(edge)
    following = {}
    for start, end in edges:
        following.setdefault(start, []).append(end)
    loops = []
    while following:
        start = next(iter(following))
        loop, point = [start], start
        while True:
            options = following[point]
            nxt = options.pop()
            if not options:
                del following[point]
            if nxt == start:
                break
            loop.append(nxt)
            point = nxt
        # Drop points that sit on a straight run.
        tidy = [p for i, p in enumerate(loop)
                if (loop[i - 1][0] - p[0]) * (loop[(i + 1) % len(loop)][1] - p[1]) != (loop[i - 1][1] - p[1]) * (loop[(i + 1) % len(loop)][0] - p[0])]
        loops.append(tidy)
    return loops


def glyph_from_loops(loops):
    pen = TTGlyphPen(None)
    for loop in loops:
        pen.moveTo(loop[0])
        for point in loop[1:]:
            pen.lineTo(point)
        pen.closePath()
    return pen.glyph()


def build(family, glyphs, metrics, cmap, ascent, descent, filename):
    order = ['.notdef'] + [name for name in glyphs if name != '.notdef']
    builder = FontBuilder(UPM, isTTF=True)
    builder.setupGlyphOrder(order)
    builder.setupCharacterMap(cmap)
    builder.setupGlyf(glyphs)
    builder.setupHorizontalMetrics(metrics)
    builder.setupHorizontalHeader(ascent=ascent, descent=-descent)
    builder.setupNameTable({'familyName': family, 'styleName': 'Regular'})
    builder.setupOS2(sTypoAscender=ascent, sTypoDescender=-descent, sTypoLineGap=0, usWinAscent=ascent, usWinDescent=descent)
    builder.setupPost()
    # A fixed timestamp keeps the output byte-identical between runs.
    builder.updateHead(created=3876595200, modified=3876595200)
    builder.font.recalcTimestamp = False
    if PREVIEW:
        PREVIEW.mkdir(parents=True, exist_ok=True)
        builder.font.save(PREVIEW / (filename + '.ttf'))
    builder.font.flavor = 'woff2'
    target = OUT / (filename + '.woff2')
    builder.font.save(target)
    return {'file': str(target), 'bytes': target.stat().st_size, 'glyphs': len(order) - 1,
            'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}


def empty():
    return TTGlyphPen(None).glyph()


def pixel_font():
    glyphs, metrics, cmap = {'.notdef': empty(), 'space': empty()}, {'.notdef': (500, 0), 'space': (400, 0)}, {0x20: 'space', 0xA0: 'space'}
    for index, (char, rows) in enumerate(PIXEL.items()):
        name = 'px%02d' % index
        glyphs[name] = glyph_from_loops(trace(rows))
        metrics[name] = ((len(rows[0]) + 1) * PX, 0)
        cmap[ord(char)] = name
    cmap[0xFFE5] = cmap[0xA5]  # fullwidth yen
    return build('Work Cheer Pixel', glyphs, metrics, cmap, 800, 200, 'wc-pixel')


# ---------------------------------------------------------------- 液晶: seven-segment numerals
W, H, T, GAP, SHEAR, LSB, ADVANCE = 400, 720, 92, 9, 0.1, 62, 560
SEGMENTS = {'0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgecd', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g'}


def lean(points):
    return [(round(LSB + x + y * SHEAR), round(y)) for x, y in points]


def bar(y):
    t, left, right = T / 2, T / 2 + GAP, W - T / 2 - GAP
    return lean([(left, y), (left + t, y + t), (right - t, y + t), (right, y), (right - t, y - t), (left + t, y - t)])


def stem(x, low, high):
    t = T / 2
    low, high = low + GAP, high - GAP
    return lean([(x, low), (x - t, low + t), (x - t, high - t), (x, high), (x + t, high - t), (x + t, low + t)])


def dot(x, y):
    t = T / 2
    return lean([(x - t, y - t), (x - t, y + t), (x + t, y + t), (x + t, y - t)])


def lcd_font():
    t, mid = T / 2, H / 2
    parts = {'a': bar(H - t), 'g': bar(mid), 'd': bar(t), 'f': stem(t, mid, H - t), 'b': stem(W - t, mid, H - t),
             'e': stem(t, t, mid), 'c': stem(W - t, t, mid)}
    glyphs, metrics, cmap = {'.notdef': empty(), 'space': empty()}, {'.notdef': (ADVANCE, 0), 'space': (ADVANCE, 0)}, {0x20: 'space', 0xA0: 'space'}
    for index, (char, lit) in enumerate(SEGMENTS.items()):
        name = 'seg%02d' % index
        glyphs[name] = glyph_from_loops([parts[key] for key in lit])
        metrics[name] = (ADVANCE, 0)
        cmap[ord(char)] = name
    # Points sit between digits on a real display, so they take a narrow cell of their own; the
    # decimal point leans back towards the digit it belongs to.
    for name, char, loops, advance, shift in (('point', '.', [dot(t, t)], 110, -30), ('colon', ':', [dot(t, H * .3), dot(t, H * .7)], 190, 32)):
        glyphs[name] = glyph_from_loops([[(x - LSB + shift, y) for x, y in loop] for loop in loops])
        metrics[name] = (advance, shift)
        cmap[ord(char)] = name
    return build('Work Cheer LCD', glyphs, metrics, cmap, 800, 200, 'wc-lcd')


if __name__ == '__main__':
    assert abs(math.tan(math.radians(5.7)) - SHEAR) < .01
    print(json.dumps([pixel_font(), lcd_font()], ensure_ascii=True))
