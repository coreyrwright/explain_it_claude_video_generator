"""Cut-outs from illustrations on white: removes the white background that touches the image border,
softens the edge over a narrow band and un-mixes the white from edge pixels, so the result has no
light fringe on any background. Crops to the content and scales to a working size.
Usage: python cutout.py <in.png> <out.png> [max_width=1600] [--keep-holes]"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

src, dst = sys.argv[1], sys.argv[2]
maxw = int(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3].isdigit() else 1600
KEEP_HOLES = '--keep-holes' in sys.argv
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
mn = im.min(2)

# 1. background = near-white region connected to the border
near = mn > 250                                                     # the white is 251-255; light subject areas sit lower
lab, n_near = ndimage.label(near)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(border))
# enclosed background pockets (between legs, under arms): pure white regions of some size
hole_sizes = ndimage.sum(np.ones_like(mn), lab, range(1, n_near + 1))
holes = [] if KEEP_HOLES else [i for i, s in enumerate(hole_sizes, 1) if s >= 600 and i not in border]
bg |= np.isin(lab, holes)
# drop tiny opaque specks floating in the background (compression noise)
fg_lab, n = ndimage.label(~bg)
sizes = ndimage.sum(np.ones_like(mn), fg_lab, range(1, n + 1))
for i, s in enumerate(sizes, 1):
    if s < 400:
        bg[fg_lab == i] = True

# 2. soft alpha in a 3 px band outside the subject, from how far a pixel is from white
alpha = np.where(bg, 0.0, 1.0)
band = ndimage.binary_dilation(~bg, iterations=3) & bg
alpha[band] = np.clip((255 - mn[band]) / 40.0, 0, 1)
inner = ndimage.binary_erosion(~bg, iterations=1) ^ ~bg              # outermost subject pixels
alpha[inner] = np.clip((255 - mn[inner]) / 40.0, 0.35, 1)

# 3. un-mix white from partly transparent pixels
a = np.maximum(alpha, 1e-3)[..., None]
rgb = np.where(alpha[..., None] < 0.999, (im - (1 - a) * 255.0) / a, im)
rgb = np.clip(rgb, 0, 255)

# 4. crop to content with a small margin, scale
ys, xs = np.where(alpha > 0.02)
y0, y1, x0, x1 = max(0, ys.min() - 8), min(im.shape[0], ys.max() + 9), max(0, xs.min() - 8), min(im.shape[1], xs.max() + 9)
out = Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8)[y0:y1, x0:x1], 'RGBA')
if out.width > maxw:
    out = out.resize((maxw, round(out.height * maxw / out.width)), Image.LANCZOS)
out.save(dst, optimize=True)
print(f'{dst}: {out.width}x{out.height}, subject {100 * (alpha > 0.5).mean():.1f}% of source')
