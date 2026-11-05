"""Rebuild public/fonts/noto-sans-sc.woff2 from a local Noto Sans SC variable font.

Usage: python scripts/subset-font.py [path-to-NotoSansSC-VF.ttf]
Defaults to the copy Windows ships in C:\\Windows\\Fonts. Noto Sans SC is licensed
under the SIL Open Font License 1.1 (see public/fonts/OFL.txt); the script refuses
any source font whose name table does not say so. Needs fontTools and brotli; a
brotli copy in ../../fontdeps (next to this workspace) is used when present.
"""
from pathlib import Path
import hashlib
import json
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DEPS = ROOT.parent / 'fontdeps'
if DEPS.exists():
    sys.path.insert(0, str(DEPS))
from fontTools import subset  # noqa: E402
from fontTools.ttLib import TTFont  # noqa: E402

source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r'C:\Windows\Fonts\NotoSansSC-VF.ttf')
output = ROOT / 'public' / 'fonts' / 'noto-sans-sc.woff2'

# Every string the web app and the desktop floating widget can render.
files = sorted(p for p in (ROOT / 'src').rglob('*') if p.suffix in {'.js', '.jsx'})
files.append(ROOT / 'index.html')
floating = ROOT.parent / 'work-cheer-desktop' / 'floating-renderer.cjs'
if floating.exists():
    files.append(floating)
text = ''.join(p.read_text(encoding='utf-8') for p in files)
text += ''.join(chr(i) for i in range(32, 127))
text += '¥￥。！？，、；：（）「」“”‘’…—÷×·星期周一二三四五六日年月时分秒'
# Common words people type as their reward goal, so the goal name keeps one typeface.
text += '电影奶茶咖啡火锅旅游吃饭聚餐蛋糕零食甜品冰淇淋水果面包牛排炸鸡汉堡披萨烤肉烧烤麻辣烫螺蛳粉音乐演唱会书书籍小说买衣服裤子裙子鞋运动健身跑步球游戏手机电脑相机耳机键盘鼠标平板包口红香水护肤宠物狗猫玩具住房租房房贷旅行机票酒店车票高铁地铁公交打车家人朋友爸爸妈妈孩子健康保险生日礼物存钱储蓄基金自由开心快乐享受美好生活梦想未来早餐午餐晚餐夜宵按摩电影票大餐周末'
wanted = sorted({c for c in text if not c.isspace() or c == ' '})

font = TTFont(source)
license_text = ' '.join(str(r) for r in font['name'].names if r.nameID == 13)
assert 'Open Font License' in license_text, f'{source} is not marked as SIL OFL'
assert any(a.axisTag == 'wght' and a.minValue == 100 and a.maxValue == 900 for a in font['fvar'].axes), 'need the 100-900 variable font'

options = subset.Options()
options.flavor = 'woff2'
options.hinting = False  # Browsers ignore TrueType hints for CJK at these sizes; dropping them saves ~35%.
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=''.join(wanted))
subsetter.subset(font)
temporary = output.with_suffix('.new.woff2')
font.save(temporary)

check = TTFont(temporary)
cmap = check.getBestCmap()
missing = [c for c in wanted if ord(c) not in cmap and not c.isspace()]
assert not missing, f'Missing characters: {missing!r}'
check.close()
temporary.replace(output)
print(json.dumps({'output': str(output), 'source': str(source), 'bytes': output.stat().st_size, 'unicode_glyphs': len(cmap),
                  'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}, ensure_ascii=True))
