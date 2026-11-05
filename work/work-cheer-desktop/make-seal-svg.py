"""Draw assets/seal.svg, the vermilion seal used for the app icon and tray.

The character outline comes from Noto Sans SC (SIL Open Font License 1.1) at weight 700,
so the icon matches the seal in the web UI. Run once after changing the design:
    python make-seal-svg.py [path-to-NotoSansSC-VF.ttf]
"""
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
DEPS = HERE.parent / 'fontdeps'
if DEPS.exists():
    sys.path.insert(0, str(DEPS))
from fontTools import subset  # noqa: E402
from fontTools.pens.boundsPen import BoundsPen  # noqa: E402
from fontTools.pens.svgPathPen import SVGPathPen  # noqa: E402
from fontTools.pens.transformPen import TransformPen  # noqa: E402
from fontTools.ttLib import TTFont  # noqa: E402
from fontTools.varLib import instancer  # noqa: E402

CHARACTER, VERMILION, PAPER = '励', '#C8432A', '#FFFFFF'
source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r'C:\Windows\Fonts\NotoSansSC-VF.ttf')
font = TTFont(source)
assert 'Open Font License' in ' '.join(str(r) for r in font['name'].names if r.nameID == 13)
options = subset.Options()
options.layout_features = []
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=CHARACTER)
subsetter.subset(font)
font = instancer.instantiateVariableFont(font, {'wght': 700})
glyphs = font.getGlyphSet()
glyph = glyphs[font.getBestCmap()[ord(CHARACTER)]]
bounds = BoundsPen(glyphs)
glyph.draw(bounds)
x_min, y_min, x_max, y_max = bounds.bounds
scale = 132 / max(x_max - x_min, y_max - y_min)
pen = SVGPathPen(glyphs, ntos=lambda value: f'{value:.1f}'.rstrip('0').rstrip('.'))
glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, 128 - (x_min + x_max) / 2 * scale, 128 + (y_min + y_max) / 2 * scale)))
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">'
       f'<rect x="8" y="8" width="240" height="240" rx="58" fill="{VERMILION}"/>'
       f'<rect x="24" y="24" width="208" height="208" rx="44" fill="none" stroke="{PAPER}" stroke-opacity=".5" stroke-width="5"/>'
       f'<path fill="{PAPER}" d="{pen.getCommands()}"/></svg>\n')
(HERE / 'assets').mkdir(exist_ok=True)
(HERE / 'assets' / 'seal.svg').write_text(svg, encoding='utf-8')
print(f'assets/seal.svg written, {len(svg)} bytes')
