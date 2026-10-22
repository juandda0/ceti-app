import numpy as np, json, sys
from scipy import ndimage as ndi
from skimage import measure, morphology
from PIL import Image
import cairosvg
from fitlib import *
lab = np.load('lab.npy'); M = np.load('front_mask.npy')
N = ['bg','ground','body','shade','cream','groove','maroon','white','blush']
L = {n:(lab==i) for i,n in enumerate(N)}
IMG = np.asarray(Image.open('/home/juan/Desktop/Me/ceti/assets/brand/bocetos/ceti-05-hoja-modelo.jpg').convert('RGB'))
C = dict(body='#FB6711', shade='#C24C10', cream='#F7E0AD', groove='#E6B17E', maroon='#732C30', white='#FFFFFF', ground='#EDC795')
def catmull(pts):
    n = len(pts); f = lambda v: f'{v:.1f}'
    d = [f'M{f(pts[0][0])} {f(pts[0][1])}']
    for i in range(n):
        p0, p1, p2, p3 = pts[i-1], pts[i], pts[(i+1)%n], pts[(i+2)%n]
        c1 = (p1[0]+(p2[0]-p0[0])/6, p1[1]+(p2[1]-p0[1])/6); c2 = (p2[0]-(p3[0]-p1[0])/6, p2[1]-(p3[1]-p1[1])/6)
        d.append(f'C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}')
    return ' '.join(d) + ' Z'
def fourier(c, k):
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(c, axis=0).T))]; n = 512
    s = np.linspace(0, d[-1], n, endpoint=False)
    z = np.interp(s, d, c[:,1]) + 1j * np.interp(s, d, c[:,0])
    F = np.fft.fft(z); F[k+1:n-k] = 0; z = np.fft.ifft(F)
    return np.c_[z.imag, z.real]
def path_varsig(m, s_top, s_bot, y_split, tol=0.3):
    m = np.pad(m, 2); out = []
    for c in measure.find_contours(m.astype(float), 0.5):
        if len(c) < 50: continue
        c = c - 2
        f = fourier(c, s_top)
        # fourier() returns (x, y); resample lo onto the same 512 points
        d = np.r_[0, np.cumsum(np.hypot(*np.diff(c, axis=0).T))]; s = np.linspace(0, d[-1], 512, endpoint=False)
        c = np.c_[np.interp(s, d, c[:,0]), np.interp(s, d, c[:,1])]
        hi = f
        lo = np.stack([ndi.gaussian_filter1d(c[:,0], s_bot, mode='wrap'), ndi.gaussian_filter1d(c[:,1], s_bot, mode='wrap')], 1)
        w = np.clip((y_split - c[:,0]) / 40 + 0.5, 0, 1)[:, None]
        c = w * hi + (1 - w) * lo
        p = measure.approximate_polygon(c, tol)
        if (p[0]==p[-1]).all(): p = p[:-1]
        out.append(catmull([(x-OX, y-OY) for y, x in p]))
    return ' '.join(out)
def path(m, tol=0.6, sigma=3.0, min_len=12, k=None):
    m = np.pad(m, 2); out = []
    for c in measure.find_contours(m.astype(float), 0.5):
        if len(c) < min_len: continue
        c = c - 2
        if k: c = fourier(c, k)
        elif sigma: c = np.stack([ndi.gaussian_filter1d(c[:,0], sigma, mode='wrap'), ndi.gaussian_filter1d(c[:,1], sigma, mode='wrap')], 1)
        p = measure.approximate_polygon(c, tol)
        if (p[0]==p[-1]).all(): p = p[:-1]
        if len(p) >= 3: out.append(catmull([(x-OX, y-OY) for y, x in p]))
    return ' '.join(out)
def comps(m, minsize=15):
    cc, n = ndi.label(m); out = []
    for i in range(1, n+1):
        mm = cc == i
        if mm.sum() >= minsize:
            yy, xx = np.where(mm); out.append(dict(x=xx.mean(), y=yy.mean(), n=int(mm.sum()), m=mm))
    return out
smooth = lambda m, r: ndi.binary_closing(ndi.binary_opening(m, structure=morphology.disk(r)), structure=morphology.disk(r))

# ---------- silhouette parts ----------
widths = {y: M[y].sum() for y in range(560, 700)}; ycut = min(widths, key=widths.get)
from scipy.interpolate import UnivariateSpline
rows = np.where(M.any(1))[0]; ytop = rows.min()
ys_all = np.arange(ytop, ycut + 1)
eL = np.array([np.argmax(M[y]) for y in ys_all], float)
eR = np.array([M.shape[1] - 1 - np.argmax(M[y][::-1]) for y in ys_all], float)
zone = (ys_all >= OY + 205) & (ys_all <= OY + 430)
def interp(e):
    sp = UnivariateSpline(ys_all[~zone], e[~zone], s=len(ys_all) * 0.6)
    out = e.copy(); out[zone] = sp(ys_all[zone]); return out
bL, bR = interp(eL), interp(eR)
bodyest = np.zeros_like(M)
for y, l, r in zip(ys_all, bL, bR): bodyest[y, int(np.ceil(l)):int(np.floor(r)) + 1] = True
bodyest &= ndi.binary_dilation(M, iterations=1) | bodyest
bopen = bodyest
finsraw = M & ~bodyest; finsraw[ycut-40:] = False
finsraw = ndi.binary_opening(finsraw, iterations=2)
cs = sorted(comps(finsraw, 500), key=lambda c: -c['n'])[:2]
fins = []
for c in sorted(cs, key=lambda c: c['x']):
    f = ndi.binary_fill_holes(c['m'])
    root = L['shade'] & bodyest & ndi.binary_dilation(f, structure=morphology.disk(18))
    root = smooth(root, 2)
    hidden = ndi.binary_dilation(f, structure=morphology.disk(26)) & bodyest   # tucked behind the body
    full = ndi.binary_fill_holes(smooth(f | hidden, 3))
    light = smooth((L['body'] & f) | (hidden & ~ndi.binary_dilation(root, iterations=2)), 3)
    light = max(comps(light, 200), key=lambda c: c['n'])['m']
    fins.append(dict(full=full, light=light, root=root))
body = bodyest.copy(); body[ycut+1:] = False
xs_neck = np.where(M[ycut])[0]
neck = np.zeros_like(M); neck[ycut:ycut+14, :] = True
body = ndi.binary_fill_holes(ndi.binary_opening(body | (neck & M), structure=morphology.disk(5)))
tail = M.copy(); tail[:ycut+2] = False; tail = smooth(tail, 4)
tail_light = smooth(L['body'] & tail, 4); tail_light = max(comps(tail_light, 200), key=lambda c: c['n'])['m']
_top = tail.copy(); _top[ycut+18:] = False
tail_light = ndi.binary_dilation(smooth(tail_light | _top, 3), iterations=2) & tail
cream = ndi.binary_fill_holes(ndi.binary_closing(ndi.binary_opening((L['cream'] | L['groove']) & ndi.binary_erosion(body), iterations=2), structure=morphology.disk(4)))
cream = max(comps(ndi.binary_opening(cream, structure=morphology.disk(9)), 100), key=lambda c: c['n'])['m']

# ---------- strokes: grooves, smile, brows ----------
def stroke_parts(mask, minsize, n=7, deg=3, ext=0.0):
    out = []
    for c in comps(mask, minsize):
        pts, w = centerline(c['m'], n, deg, ext); out.append((open_path(pts), w, c))
    return out
grooves = stroke_parts(ndi.binary_opening(L['groove'] & cream, iterations=1), 40, 10, 4, 0.12)
mouth_zone = np.zeros_like(M); mouth_zone[OY+190:OY+270, OX+180:OX+470] = True
smile = stroke_parts(smooth(L['shade'] & mouth_zone, 1), 200, 9)
brows = stroke_parts(smooth(L['maroon'] & M, 1) & (np.arange(M.shape[0])[:, None] < OY+150), 150, 6)

# ---------- eyes: sclera circle, lower lid circle, pupil & twinkle ----------
eyes = []
for p in sorted([c for c in comps(L['maroon'] & M, 300) if c['y'] > OY+150], key=lambda c: c['x']):
    hull = morphology.convex_hull_image(p['m'])
    tw = max(comps(hull & ~p['m'] & (L['white'] | L['cream']), 5), key=lambda c: c['n'])['m']
    cx, cy = p['x'], p['y']
    box = np.zeros_like(M); box[int(cy-60):int(cy+60), int(cx-60):int(cx+60)] = True
    vis = ndi.binary_fill_holes(ndi.binary_closing((L['white'] | L['maroon'] | L['cream'] | L['bg']) & box & M, structure=morphology.disk(3)))
    vis = max(comps(vis, 200), key=lambda c: c['n'])['m']
    b = boundary(vis); vc = b.mean(0)
    sc = fit_circle(b[b[:,1] < vc[1] - 2])            # upper arc -> sclera circle
    yy, xx = np.mgrid[:M.shape[0], :M.shape[1]]
    inside = (xx - sc[0])**2 + (yy - sc[1])**2 <= (sc[2] - 1)**2
    lidreg = inside & ~vis
    lidreg = max(comps(lidreg, 20), key=lambda c: c['n'])['m']
    lb = boundary(lidreg)
    lb = lb[np.hypot(lb[:,0]-sc[0], lb[:,1]-sc[1]) < sc[2] - 2.5]   # only the lid edge, not the sclera rim
    xs_c = np.arange(int(sc[0] - sc[2] * 0.85), int(sc[0] + sc[2] * 0.85))
    pts_l = []
    for xc in xs_c:
        col = np.where(vis[:, xc])[0]
        if not len(col): continue
        circ_bottom = sc[1] + np.sqrt(max(sc[2]**2 - (xc - sc[0])**2, 0))
        if circ_bottom - col.max() > 2.5: pts_l.append((xc, col.max() + 0.5))
    pts_l = np.array(pts_l, float)
    a_, b_ = np.polyfit(pts_l[:,0], pts_l[:,1], 1)
    q_ = np.polyfit(pts_l[:,0], pts_l[:,1], 2)
    lb = pts_l
    lc = (a_, b_, 0); lid_inside = True
    print('lid line slope', round(a_,3), 'points', len(lb))
    pb = boundary(ndi.binary_fill_holes(p['m'] | tw)); pc = fit_circle(pb)
    tb = boundary(tw); tcc = fit_circle(tb) if len(tb) > 8 else (*tb.mean(0), 4)
    eyes.append(dict(sc=sc, lc=lc, q=q_, pc=pc, tc=tcc, vis=vis, lid_inside=lid_inside))
    print('eye', [round(v,1) for v in sc], 'lid', [round(v,1) for v in lc], 'pupil', [round(v,1) for v in pc], 'tw', [round(v,1) for v in tcc])

g = L['ground'].copy(); g[:, :OX+20] = False; g[:, OX+620:] = False; g[:OY+530] = False; g[OY+620:] = False
g = ndi.binary_opening(g, iterations=2); gy, gx = np.where(g); gb = [gx.min()-OX, gy.min()-OY, gx.max()-OX, gy.max()-OY]
bm = ndi.binary_erosion(L['blush'] & body, iterations=3); blush_col = '#%02X%02X%02X' % tuple(int(v) for v in IMG[bm].mean(0))
blowhole = [c for c in comps(L['shade'] & body, 30) if c['y'] < OY + 80]

def P(d, fill, id=None, extra=''): return f'<path{f" id=\"{id}\"" if id else ""} d="{d}" fill="{fill}"{extra}/>' if d else ''
def S(d, col, w, id=None): return f'<path{f" id=\"{id}\"" if id else ""} d="{d}" fill="none" stroke="{col}" stroke-width="{w:.1f}" stroke-linecap="round" stroke-linejoin="round"/>'
f1 = lambda v: f'{v:.1f}'
eyes_svg = ''
for e, s in zip(eyes, ['izq', 'der']):
    (sx, sy, sr), (px, py, pr), (tx, ty, tr) = e['sc'], e['pc'], e['tc']
    sx, sy, px, py, tx, ty = sx-OX, sy-OY, px-OX, py-OY, tx-OX, ty-OY
    dx, dy = tx - px, ty - py; dd = np.hypot(dx, dy); tr = 6.3
    tx, ty = px + dx / dd * (pr - 2.0), py + dy / dd * (pr - 2.0)
    xs_l = np.linspace(sx + OX - sr - 4, sx + OX + sr + 4, 9)
    top = np.c_[xs_l, np.polyval(e['q'], xs_l)]
    lidpath = open_path(top) + f' L{f1(xs_l[-1]-OX)} {f1(sy+60)} L{f1(xs_l[0]-OX)} {f1(sy+60)} Z'
    lidrule = ''
    eyes_svg += (f'<g id="ojo-{s}">'
        f'<clipPath id="clip-ojo-{s}"><circle cx="{f1(sx)}" cy="{f1(sy)}" r="{f1(sr+2)}"/></clipPath>'
        f'<circle id="aro-{s}" cx="{f1(sx)}" cy="{f1(sy)}" r="{f1(sr+1.1)}" fill="#D9581A"/>'
        f'<circle id="esclera-{s}" cx="{f1(sx)}" cy="{f1(sy)}" r="{f1(sr)}" fill="{C["white"]}"/>'
        f'<g clip-path="url(#clip-ojo-{s})">'
        f'<circle id="pupila-{s}" cx="{f1(px)}" cy="{f1(py)}" r="{f1(pr)}" fill="{C["maroon"]}"/>'
        f'<circle id="brillo-{s}" cx="{f1(tx)}" cy="{f1(ty)}" r="{f1(tr)}" fill="{C["white"]}"/>'
        f'<path id="parpado-{s}" d="{lidpath}" fill="{C["body"]}"{lidrule}/></g></g>')
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 620">
<ellipse id="sombra-piso" cx="{(gb[0]+gb[2])/2:.1f}" cy="{(gb[1]+gb[3])/2:.1f}" rx="{(gb[2]-gb[0])/2:.1f}" ry="{(gb[3]-gb[1])/2:.1f}" fill="{C['ground']}"/>
<g id="cola">{P(path(tail, 0.3, sigma=3), C['shade'])}{P(path(tail_light, 0.3, sigma=3), C['body'], 'cola-luz')}</g>
<g id="aleta-izq">{P(path(fins[0]['full'], 0.3, k=24), C['shade'])}{P(path(fins[0]['light'], 0.3, k=18), C['body'], 'aleta-izq-luz')}</g>
<g id="aleta-der">{P(path(fins[1]['full'], 0.3, k=24), C['shade'])}{P(path(fins[1]['light'], 0.3, k=18), C['body'], 'aleta-der-luz')}</g>
<g id="cuerpo">{P(path_varsig(body, 28, 4, OY + 400), C['body'])}{''.join(P(path(c['m'], 0.5, 1.5), C['shade'], 'espiraculo') for c in blowhole)}</g>
<g id="aleta-izq-raiz">{P(path(fins[0]['root'], 0.3, k=12), C['shade'])}</g>
<g id="aleta-der-raiz">{P(path(fins[1]['root'], 0.3, k=12), C['shade'])}</g>
<g id="panza"><clipPath id="clip-panza"><path d="{path(cream, 0.3, k=14)}"/></clipPath>{P(path(cream, 0.3, k=14), C['cream'])}<g id="surcos" clip-path="url(#clip-panza)">{''.join(S(d, C['groove'], w) for d, w, _ in grooves)}</g></g>
{''.join(S(d, C['shade'], w, 'boca') for d, w, _ in smile)}
<g id="rubor">{''.join(P(path(c['m'], 0.6, 2.5), blush_col) for c in comps(ndi.binary_opening(L['blush'] & body & ~cream, iterations=1), 40))}</g>
{eyes_svg}
<g id="cejas">{''.join(S(d, C['maroon'], w) for d, w, _ in brows)}</g>
</svg>'''
open('ceti-trace3.svg', 'w').write(svg)
cairosvg.svg2png(bytestring=svg.encode(), write_to='ceti-trace3.png', output_width=640, background_color='#F9F3E1')
print(len(svg)//1024, 'KB', 'grooves', len(grooves), [round(w,1) for _, w, _ in grooves], 'smile', [round(w,1) for _, w, _ in smile], 'brows', [round(w,1) for _, w, _ in brows])
if '--debug' in sys.argv:
    dbg = np.zeros(M.shape + (3,), np.uint8) + 240
    dbg[fins[0]['full']] = [194, 76, 16]; dbg[fins[0]['light']] = [251, 103, 17]
    dbg[fins[0]['root']] = [100, 100, 255]
    Image.fromarray(dbg[OY+180:OY+420, OX+0:OX+260]).resize((520, 480), Image.NEAREST).save('dbg-fin.png')
    print('fin full px', fins[0]['full'].sum(), 'light', fins[0]['light'].sum(), 'finsraw', cs[0]['n'])
