import numpy as np
from scipy import ndimage as ndi
from skimage import measure, morphology
OX, OY = 96, 150
def fit_circle(xy):
    x, y = xy[:,0], xy[:,1]
    A = np.c_[2*x, 2*y, np.ones(len(x))]; b = x**2 + y**2
    cx, cy, c = np.linalg.lstsq(A, b, rcond=None)[0]
    return cx, cy, np.sqrt(c + cx**2 + cy**2)
def boundary(m):
    return np.argwhere(m & ~ndi.binary_erosion(m))[:, ::-1].astype(float)  # (x,y)
def centerline(m, n=7, deg=3, ext=0.0):
    """Ordered smooth centerline of a thin stroke mask + mean width."""
    sk = morphology.skeletonize(m); pts = np.argwhere(sk)[:, ::-1].astype(float)
    c = pts.mean(0); u, s, vt = np.linalg.svd(pts - c); d = vt[0]
    t = (pts - c) @ d; order = np.argsort(t); pts, t = pts[order], t[order]
    # polynomial fit x(t), y(t) degree 3
    px = np.polyfit(t, pts[:,0], deg); py = np.polyfit(t, pts[:,1], deg)
    # extend to the stroke ends: half width beyond skeleton is covered by round caps
    base = np.c_[np.polyval(px, np.linspace(t.min(), t.max(), 40)), np.polyval(py, np.linspace(t.min(), t.max(), 40))]
    length = np.sum(np.hypot(*np.diff(base, axis=0).T))
    span = t.max() - t.min(); ts = np.linspace(t.min() - ext*span, t.max() + ext*span, n)
    out = np.c_[np.polyval(px, ts), np.polyval(py, ts)]
    A = m.sum(); width = (-length + np.sqrt(length**2 + 4*0.785*A)) / (2*0.785)
    return out, width
def open_path(pts):
    f = lambda v: f'{v:.1f}'; P = [(x-OX, y-OY) for x, y in pts]; n = len(P)
    d = [f'M{f(P[0][0])} {f(P[0][1])}']
    for i in range(n-1):
        p0 = P[i-1] if i > 0 else P[i]; p1, p2 = P[i], P[i+1]; p3 = P[i+2] if i+2 < n else P[i+1]
        c1 = (p1[0]+(p2[0]-p0[0])/6, p1[1]+(p2[1]-p0[1])/6); c2 = (p2[0]-(p3[0]-p1[0])/6, p2[1]-(p3[1]-p1[1])/6)
        d.append(f'C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}')
    return ' '.join(d)
