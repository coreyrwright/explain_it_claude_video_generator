"""Storyboard sheets: stills in a grid, each captioned with its beat and the words spoken.
Usage: python contact.py <storyboard dir> <out prefix> [per_sheet=6] [cols=2] [width=800]"""
import json, os, sys, textwrap
from PIL import Image, ImageDraw, ImageFont

d, prefix = sys.argv[1], sys.argv[2]
per, cols, fw = (int(sys.argv[3]) if len(sys.argv) > 3 else 6), (int(sys.argv[4]) if len(sys.argv) > 4 else 2), (int(sys.argv[5]) if len(sys.argv) > 5 else 800)
fh = fw * 9 // 16
fonts = os.path.join(os.path.dirname(__file__), '..', 'fonts')
fb = ImageFont.truetype(os.path.join(fonts, 'Inter-Bold.ttf'), 22)
fr = ImageFont.truetype(os.path.join(fonts, 'Inter-Regular.ttf'), 18)
frames = json.load(open(os.path.join(d, 'frames.json')))
pad, cap = 24, 96
for s in range(0, len(frames), per):
    chunk = frames[s:s + per]
    rows = (len(chunk) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * fw + (cols + 1) * pad, rows * (fh + cap) + (rows + 1) * pad), '#20242B')
    dr = ImageDraw.Draw(sheet)
    for i, f in enumerate(chunk):
        x, y = pad + (i % cols) * (fw + pad), pad + (i // cols) * (fh + cap + pad)
        sheet.paste(Image.open(os.path.join(d, f['file'])).resize((fw, fh), Image.LANCZOS), (x, y))
        dr.text((x, y + fh + 10), f"{f['n']}. {f['label']}  ({f['t']:.1f} s)", font=fb, fill='#FFFFFF')
        words = textwrap.shorten('"... ' + f['words'] + '"', width=int(fw / 9.5), placeholder=' ..."')
        dr.text((x, y + fh + 44), words, font=fr, fill='#D5DAE6')
    out = f'{prefix}{s // per + 1}.jpg'
    sheet.save(out, quality=88)
    print(out)
