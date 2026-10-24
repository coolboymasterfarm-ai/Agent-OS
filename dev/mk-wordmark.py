#!/usr/bin/env python3
"""dev/mk-wordmark.py — regenerate the AGENT OS wordmark assets.

The chrome mark and the title-screen logo are the app's own letterforms: the "AGENT OS"
glyphs are pulled straight out of frontend/assets/fonts/vt323.woff2 (the single font the
station renders in), leaned over, and emitted as SVG paths. That is why the mark matches the
boot type exactly, why it can be masked and re-tinted per theme (currentColor), and why it
never needs a bitmap at any DPR.

    python3 dev/mk-wordmark.py

Writes:
  frontend/assets/brand/agent-os-wordmark.svg   currentColor — used as a CSS mask (.logo-img)
                                                and the managed-provider row's brand mark
  frontend/assets/brand/agent-os-logo.svg       baked amber — the title-screen <img>

Requires fontTools + brotli (pip install fonttools brotli). Run from the repo root. The
viewBox ratio is copied into .logo-img's aspect-ratio in frontend/css/style.css — if you
change TRACK/SLANT/TEXT, update that ratio too.
"""
import pathlib

from fontTools.misc.transform import Transform
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONT = ROOT / 'frontend/assets/fonts/vt323.woff2'
OUT = ROOT / 'frontend/assets/brand'

TEXT = 'AGENT OS'
TRACK = 0.22    # letter gap, in em
SLANT = 0.11    # italic lean (x += y * SLANT)
PHOSPHOR = '#ffb347'   # the title-screen bake; the masked mark takes var(--ph) instead


def main():
    font = TTFont(str(FONT))
    upm = font['head'].unitsPerEm
    glyphs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font['hmtx']
    track = int(upm * TRACK)

    parts, x = [], 0
    minx = miny = 1e9
    maxx = maxy = -1e9
    for ch in TEXT:
        name = cmap[ord(ch)]
        T = Transform(1, 0, -SLANT, 1, x, 0)
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(TransformPen(pen, T))
        if pen.getCommands():
            parts.append(pen.getCommands())
        bp = BoundsPen(glyphs)
        glyphs[name].draw(TransformPen(bp, T))
        if bp.bounds:
            a, b, c, d = bp.bounds
            minx, miny = min(minx, a), min(miny, b)
            maxx, maxy = max(maxx, c), max(maxy, d)
        x += hmtx[name][0] + track

    width, height = maxx - minx, maxy - miny
    path = ' '.join(parts)

    def svg(fill):
        # viewBox is normalised to 0 0 w h: a mask has no use for the glyph's left bearing,
        # and .logo-img's aspect-ratio is the only thing that needs the numbers.
        return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %.2f %.2f" '
                'role="img" aria-label="AGENT OS"><title>AGENT OS</title>'
                '<g transform="translate(%.2f,%.2f) scale(1,-1)">'
                '<path fill="%s" d="%s"/></g></svg>\n'
                ) % (width, height, -minx, maxy, fill, path)

    OUT.joinpath('agent-os-wordmark.svg').write_text(svg('currentColor'), encoding='utf-8')
    OUT.joinpath('agent-os-logo.svg').write_text(svg(PHOSPHOR), encoding='utf-8')
    print('wrote agent-os-wordmark.svg / agent-os-logo.svg  viewBox %.2f x %.2f (ratio %.4f)'
          % (width, height, width / height))


if __name__ == '__main__':
    main()
