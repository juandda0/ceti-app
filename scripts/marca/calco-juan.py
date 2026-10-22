"""Calco por capas de Juan (vista de frente de assets/brand/bocetos/juan-03-rapado-mono.jpg).

Uso: ~/.venvs/mascot/bin/python scripts/marca/calco-juan.py [salida.svg] [--sin-ajustes]


1. Recorte x SC, aplanado (mean-shift), Lab.
2. Líneas = black-hat (más oscuras que su entorno) + color de línea.
3. Rellenos = color más cercano de la paleta; mayoría; figura = lo no alcanzable desde el borde.
4. Cada píxel de línea pasa a ser el BORDE (tono más oscuro) de la región que lo "posee"
   (la de adelante según reglas por pares; p. ej. el pelo es dueño de la línea pelo/frente).
5. Partes animables por polígonos (cabeza, brazos, cuerpo) con relleno oculto debajo.
6. Cada color -> potrace; apilado: cada capa se mete un poco debajo de las de encima.
7. Ojos como círculos/elipses; sombra del piso como elipse.
"""
import json, sys
import numpy as np, cv2, potrace
from PIL import Image
from scipy import ndimage as ndi

OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else 'assets/brand/juan/juan-frente.svg'
SRC, BOX = 'assets/brand/bocetos/juan-03-rapado-mono.jpg', (120, 40, 580, 820)  # vista de frente de la hoja aprobada
SC = 4
src = Image.open(SRC).convert('RGB').crop(BOX)
im0 = np.array(src.resize((src.width * SC, src.height * SC), Image.LANCZOS))
flat = cv2.pyrMeanShiftFiltering(im0, 2 * SC, 12)
L = cv2.cvtColor(flat, cv2.COLOR_RGB2LAB).astype(np.float32)
_k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (12 * SC + 1, 12 * SC + 1))
bh = cv2.morphologyEx(L[:, :, 0], cv2.MORPH_BLACKHAT, _k)  # líneas: más oscuras que su entorno
H, W = bh.shape
yy, xx = np.mgrid[:H, :W]
X, Y = xx / SC, yy / SC  # coordenadas de la referencia

# ------------------------------------------------------------------ paleta
# nombre: (colores de referencia, relleno final, borde final)
P = {
    'fondo': (['FCE9D0', 'FBECD6'], None, None),
    'piso': (['E8B486'], 'E8BD93', None),
    'linea': (['BC8568', 'B36F5C', 'A06534', 'B47461', 'A66D39'], None, None),
    'traje': (['FDDEB7', 'FFDEB4', 'FCE2B8'], 'FDE6C2', 'E2BC92'),
    'sombra': (['D3AD90', 'DCB591', 'C4997B', 'D6AC8D'], 'DDB894', 'C99F7C'),
    'guante': (['E4BE98', 'E3BC97'], 'E5C3A1', 'C9A27F'),
    'azul': (['7CB4BC', '73ABB4', '94ACA3'], '7EC8F0', '4E9CC2'),
    'azul-osc': (['598E93', '588E94', '5D939D', '46756F', '678580'], '4E9CC2', '4E9CC2'),
    'piel': (['F0AF8F', 'F1B090', 'F2B393'], 'F4B596', 'C46F5B'),
    'rubor': (['E79176', 'E09176', 'DC8B74'], 'EC917A', 'C46F5B'),
    'pelo': (['CC985A', 'CE9C5C'], 'BA8C5E', '8C6340'),
    'blanco': (['FEFCF7', 'FFFEFC', 'FEFDFC'], 'FFFFFF', 'C46F5B'),
    'iris': (['B18334', 'B67E31', 'B97A1F'], 'C98A2E', '8E5A1F'),
    'pupila': (['6B5836', '6E542E'], '4A3A26', '4A3A26'),
    'naranja': (['F27D2B', 'ED7A2D', 'F58230'], 'FB6711', 'C9520D'),
    'pantalla': (['4F586A', '4E596B'], '3E4C5A', '2E3A46'),
    'pantalla2': (['4F7972'], '2F5A5E', '2E3A46'),
    'cian': (['B8E5E1'], 'D6F3F5', '4E9CC2'),
    'marco': (['B9C1C4', 'BBBFCA', 'B6BEC7'], 'C9DDE4', '4E9CC2'),
    'verde': (['B4E5DD', 'A6E4AC', '6CD3C0'], '8FE3D2', '4E9CC2'),
    'amarillo': (['C8FB86', 'BBF4A0'], 'C8F27A', '8FB84A'),
    'cuero': (['934E1D', '8B4A2B'], '8B4A2B', '6B3418'),
    'rojo': (['AE2527', 'AA2526'], 'D23A33', '9E1F22'),
    # clases por región (no por color)
    'oro': ([], 'C98A2E', '8E5A1F'),
    'esfera': ([], 'FFF6E2', '8E5A1F'),
    'oreja': ([], 'F4B596', 'C46F5B'),
    'oreja-int': ([], 'E8977C', 'C46F5B'),
    'nariz': ([], 'E8977E', 'C46F5B'),
    'ceja': ([], 'C69A6B', 'A87A4E'),
    'panza': ([], 'FFF1E0', 'E58A6A'),
    'cuello': ([], 'E9A585', 'C46F5B'),
}
names = list(P)
I = {n: i for i, n in enumerate(names)}


def lab_of(h):
    rgb = np.array([[[int(h[i:i + 2], 16) for i in (0, 2, 4)]]], np.uint8)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)[0, 0].astype(np.float32)


def poly(pts):
    z = np.zeros((H, W), np.uint8)
    cv2.fillPoly(z, [np.array([[x * SC, y * SC] for x, y in pts], np.int32)], 1)
    return z.astype(bool)


def disk(cx, cy, r):
    return (X - cx) ** 2 + (Y - cy) ** 2 <= r * r


def ell(cx, cy, rx, ry):
    return ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2 <= 1


# ------------------------------------------------------------------ 1-3 clasificación
dist = np.full((H, W), 1e9, np.float32); lab = np.zeros((H, W), np.int16)
dist_f = np.full((H, W), 1e9, np.float32); lab_f = np.zeros((H, W), np.int16)
for n in names:
    for h in P[n][0]:
        d = ((L - lab_of(h)) ** 2 * np.array([0.6, 1, 1])).sum(-1)
        m = d < dist; dist[m] = d[m]; lab[m] = I[n]
        if n != 'linea':
            m = d < dist_f; dist_f[m] = d[m]; lab_f[m] = I[n]
isl = (lab == I['linea']) & (bh < 10)
lab[isl] = lab_f[isl]
# líneas oscuras que el color no reconoce como línea (p. ej. la línea de la nariz) también cuentan
dark_line = (bh > 28) & np.isin(lab, [I['rubor'], I['iris'], I['sombra']]) & ~poly([(140, 140), (290, 140), (290, 182), (140, 182)])
lab[dark_line] = I['linea']


def majority(lb, size):
    ids = np.unique(lb)
    votes = np.stack([cv2.blur((lb == i).astype(np.float32), (size, size)) for i in ids], -1)
    return ids[votes.argmax(-1)].astype(np.int16)


lab = majority(lab, 2 * SC + 1)
line = lab == I['linea']
# figura: lo que no se alcanza desde el borde pasando por fondo/piso
bgish = np.isin(lab, [I['fondo'], I['piso']])
cc, _ = ndi.label(bgish)
edge_ids = np.unique(np.r_[cc[0], cc[-1], cc[:, 0], cc[:, -1]])
outside = np.isin(cc, edge_ids[edge_ids > 0])
fig = ~outside
fig = ndi.binary_fill_holes(fig)
# dentro de la figura, el "fondo" es traje (colores casi iguales)
lab[fig & (lab == I['fondo'])] = I['traje']
# el piso dentro de la figura: botas/guantes
lab[fig & (lab == I['piso'])] = I['guante']

# ------------------------------------------------------------------ clases por región
head_zone = poly([(60, 0), (380, 0), (380, 230), (300, 230), (280, 266), (150, 266), (130, 230), (60, 230)])
# cejas: pelo dentro de la cara, a la altura de las cejas
brow_band = (lab == I['pelo']) & poly([(146, 114), (288, 114), (288, 145), (146, 145)])
cc_b, n_b = ndi.label(brow_band)
core = poly([(158, 120), (200, 120), (200, 140), (158, 140)]) | poly([(228, 120), (272, 120), (272, 140), (228, 140)])
keep_b = np.unique(cc_b[core & brow_band]); keep_b = keep_b[keep_b > 0]
lab[np.isin(cc_b, keep_b)] = I['ceja']
# orejas: piel fuera del óvalo de la cara
ear_l = poly([(70, 118), (147, 118), (147, 212), (70, 212)]) & ~ell(215, 160, 72, 110)
ear_r = poly([(283, 118), (360, 118), (360, 212), (283, 212)]) & ~ell(215, 160, 72, 110)
ears = ear_l | ear_r
lab[ears & np.isin(lab, [I['piel']])] = I['oreja']
lab[ears & np.isin(lab, [I['rubor'], I['sombra']])] = I['oreja-int']
# nariz
nose = ell(212.5, 185, 16, 12.5)
lab[nose & (lab == I['rubor'])] = I['nariz']
# cuello (piel bajo la barbilla, dentro del collar)
# cuello: piel separada de la cara por la línea de la barbilla (componente aparte, abajo)
skin = np.isin(lab, [I['piel'], I['rubor']]) & (Y > 200) & (Y < 272) & (X > 160) & (X < 268)
cc_s, n_s = ndi.label(skin)
face_id = np.bincount(cc_s[ell(214, 200, 40, 20) & skin]).argmax()
lab[skin & (cc_s != face_id) & (cc_s > 0) & (Y > 236)] = I['cuello']
# reloj: aro dorado y esfera
watch = disk(365.4, 471.7, 14.5) | poly([(316, 465), (358, 461.5), (358, 482.5), (316, 485)])
lab[watch & np.isin(lab, [I['iris'], I['pupila'], I['cuero'], I['naranja'], I['rojo'], I['pelo'], I['guante']])] = I['oro']
# el reloj se dibuja encima como primitiva: debajo, la muñeca (guante/traje vecinos)
lab[watch & fig] = -1
# pulsera (hilo rojo con nudo) y parche naranja del hombro: también primitivas encima
BRACELET = poly([(50, 458), (118, 462), (118, 479), (50, 479)])
lab[BRACELET & fig & (lab != I['linea'])] = -1
lab[BRACELET & fig & (lab == I['linea']) & (X > 62) & (X < 108)] = -1
PATCH = ell(84.5, 337.5, 12.5, 23.5)
lab[PATCH & fig & ~np.isin(lab, [I['linea']])] = -1
lab[poly([(58, 308), (102, 308), (102, 368), (58, 368)]) & fig & (lab == I['naranja'])] = -1
# panza de la ballena (crema dentro de la insignia)
badge = poly([(164, 320), (264, 320), (264, 385), (164, 385)])
badge_in = poly([(171, 327), (257, 327), (257, 378), (171, 378)])
belly = poly([(177, 351), (188, 357), (201, 364), (215, 369), (214, 373.5), (196, 374), (184, 367), (177, 358)])
light = np.isin(lab, [I['traje'], I['blanco'], I['piel'], I['guante'], I['sombra'], I['cian'], I['marco']])
lab[badge_in & belly & light] = I['panza']
# fuera de la panza, lo claro es halo: se reclasifica entre azul y naranja por color
halo = badge_in & ~belly & (light | np.isin(lab, [I['rubor'], I['piel']]))
if halo.any():
    Lh = L[halo]
    da_ = ((Lh - lab_of('7CB4BC')) ** 2).sum(-1); dn_ = ((Lh - lab_of('F27D2B')) ** 2).sum(-1)
    lab[halo] = np.where(da_ < dn_, I['azul'], I['naranja'])
# fuera de la cabeza no hay iris/pupila/pelo: son confusiones
not_head = ~head_zone
for wrong, right in [('pupila', 'pantalla'), ('iris', 'oro'), ('pelo', 'oro'), ('piel', 'guante'), ('rubor', 'guante')]:
    m = not_head & (lab == I[wrong])
    if wrong in ('iris', 'pelo'):
        lab[m & watch] = I['oro']
        m &= ~watch
    lab[m] = -1
# tablet: dentro de la pantalla solo pantalla y sus íconos; en el marco, marco/cian/azul oscuro
TAB_Z0 = poly([(226, 386), (402, 380), (412, 548), (226, 548)])
def hull_of(m):
    pts = np.argwhere(m)[:, ::-1].astype(np.int32)
    hm = np.zeros((H, W), np.uint8)
    cv2.fillConvexPoly(hm, cv2.convexHull(pts), 1)
    return hm.astype(bool)
scr_px = TAB_Z0 & np.isin(lab, [I['pantalla'], I['pantalla2']])
scr_px = ndi.binary_opening(scr_px, iterations=2 * SC)
SCREEN = hull_of(scr_px) & ~ndi.binary_dilation(~hull_of(scr_px), iterations=SC)
tab_px = TAB_Z0 & np.isin(lab, [I['azul-osc'], I['marco'], I['cian'], I['pantalla'], I['pantalla2']])
tab_px = ndi.binary_opening(tab_px, iterations=2 * SC)
TABLET = hull_of(tab_px)
arm_like = np.isin(lab, [I['traje'], I['guante'], I['linea'], I['cuero'], I['oro']])
for zone_, allowed, extra in ((SCREEN, ['pantalla', 'pantalla2', 'verde', 'amarillo'], {}),
                              (TABLET & ~SCREEN, ['azul-osc', 'marco', 'cian'], {'verde': 'cian', 'azul': 'azul-osc'})):
    for a, b in extra.items():
        lab[zone_ & (lab == I[a])] = I[b]
    bad_ = zone_ & ~arm_like & (lab >= 0) & ~np.isin(lab, [I[n] for n in allowed])
    # se reclasifican por color, pero solo entre las clases permitidas
    best = np.full(bad_.sum(), 1e9, np.float32); bl = np.zeros(bad_.sum(), np.int16)
    Lb = L[bad_]
    for n in allowed:
        for h in P[n][0]:
            d = ((Lb - lab_of(h)) ** 2 * np.array([0.6, 1, 1])).sum(-1)
            m = d < best; best[m] = d[m]; bl[m] = I[n]
    lab[bad_] = bl
# el tono verdoso de la pantalla solo existe dentro del medidor circular
lab[(lab == I['pantalla2']) & ~disk(323, 462, 23)] = I['pantalla']
# en la cabeza no hay azules del traje (comisuras de la boca, brillos)
lab[head_zone & (Y < 228) & np.isin(lab, [I['azul'], I['azul-osc'], I['marco'], I['verde'], I['naranja'], I['pantalla']])] = -1
# huecos (-1) -> vecino más cercano válido
bad = lab < 0
if bad.any():
    _, (iy, ix) = ndi.distance_transform_edt(bad, return_indices=True)
    lab[bad] = lab[iy[bad], ix[bad]]

# manchas oscuras dentro de botas y guantes
lab[((Y > 640) | poly([(40, 470), (130, 470), (130, 560), (40, 560)]) | poly([(300, 480), (380, 480), (380, 560), (300, 560)])) & (lab == I['sombra'])] = I['guante']
# islas pequeñas -> la clase que las rodea (motas de las botas, ruido del JPEG)
MIN_AREA = {'default': 14 * SC * SC}
KEEP_SMALL = {I['cian'], I['pupila'], I['blanco'], I['esfera'], I['amarillo'], I['verde'], I['linea'], I['cuero'], I['oro'], I['iris']}
for _ in range(2):
    for i in np.unique(lab):
        if i in KEEP_SMALL or i < 0:
            continue
        cc_i, n_i = ndi.label(lab == i)
        if n_i == 0:
            continue
        areas = ndi.sum(np.ones_like(cc_i), cc_i, index=np.arange(1, n_i + 1))
        small = np.isin(cc_i, np.nonzero(areas < MIN_AREA['default'])[0] + 1)
        lab[small] = -1
    bad = lab < 0
    if bad.any():
        _, (iy, ix) = ndi.distance_transform_edt(bad, return_indices=True)
        lab[bad] = lab[iy[bad], ix[bad]]

# ------------------------------------------------------------------ retoques acordados con Juan (sutiles)
AJUSTES = '--sin-ajustes' not in sys.argv
if AJUSTES:
    mx = xx.astype(np.float32); my = yy.astype(np.float32)
    # a) entrada más redondeada: el centro de la línea del pelo sube un poco (la M se suaviza)
    lift = 3.2 * np.exp(-((X - 212) / 24) ** 2) * np.clip(1 - np.abs(Y - 76) / 26, 0, 1)
    my = my + (lift * SC).astype(np.float32)
    # b) cara un poco más ovalada: la mandíbula se estrecha hacia la barbilla
    t = np.clip((Y - 192) / (262 - 192), 0, 1) * (Y < 268)
    k = 1 - 0.06 * t ** 1.3
    cxp = 214 * SC
    mx = (cxp + (xx - cxp) / k).astype(np.float32)
    wl = cv2.remap(lab.astype(np.float32), mx, my, cv2.INTER_NEAREST, borderMode=cv2.BORDER_REPLICATE).astype(np.int16)
    wf = cv2.remap(fig.astype(np.uint8), mx, my, cv2.INTER_NEAREST, borderMode=cv2.BORDER_REPLICATE).astype(bool)
    # solo la cara y la línea del pelo (el collar y los hombros no se tocan)
    fz = (ell(214, 200, 80, 70) & (Y > 190)) | (poly([(150, 40), (275, 40), (275, 104), (150, 104)]))
    lab = np.where(fz, wl, lab); fig = np.where(fz, wf, fig)

# ------------------------------------------------------------------ 4. dueño de cada línea
FILL_IDS = [I[n] for n in names if P[n][1] and n not in ('piso',)]
line = (lab == I['linea']) & fig
dists = {}
for i in FILL_IDS:
    m = (lab == i) & fig
    if m.any():
        dists[i] = ndi.distance_transform_edt(~m)
# reglas: (a, b) -> dueño cuando la línea separa a y b
FRONT = ['esfera', 'oro', 'cuero', 'rojo', 'amarillo', 'verde', 'pantalla2', 'pantalla', 'cian', 'marco', 'azul-osc', 'naranja', 'panza',
         'guante', 'azul', 'ceja', 'blanco', 'nariz', 'oreja-int', 'pelo', 'piel', 'oreja', 'rubor', 'cuello', 'sombra', 'traje']
rank = {I[n]: k for k, n in enumerate(FRONT)}
PAIR = {frozenset([I['oreja'], I['pelo']]): I['oreja'], frozenset([I['oreja'], I['piel']]): I['piel'],
        frozenset([I['pelo'], I['piel']]): I['pelo'], frozenset([I['traje'], I['guante']]): I['guante'],
        frozenset([I['piel'], I['sombra']]): I['piel'], frozenset([I['piel'], I['traje']]): I['piel'],
        frozenset([I['cuello'], I['sombra']]): I['sombra'], frozenset([I['cuello'], I['piel']]): I['piel'],
        frozenset([I['azul'], I['traje']]): I['traje']}
ids = np.array(list(dists))
stack = np.stack([dists[i] for i in ids], -1)
ly, lx = np.nonzero(line)
dv = stack[ly, lx]  # (n, k)
order = np.argsort(dv, 1)
first, second = ids[order[:, 0]], ids[order[:, 1]]
d1, d2 = dv[np.arange(len(ly)), order[:, 0]], dv[np.arange(len(ly)), order[:, 1]]
LW = 7 * SC  # ancho de línea + margen
owner = first.copy()
two = d1 + d2 < np.where(head_zone[ly, lx] & (Y[ly, lx] < 236), 8.5, 6.5) * SC
for k in np.nonzero(two)[0]:
    a, b = first[k], second[k]
    key = frozenset([a, b])
    if key in PAIR:
        owner[k] = PAIR[key]
    else:
        owner[k] = a if rank.get(a, 99) <= rank.get(b, 99) else b
# sobre la tablet, el brazo y la mano van adelante: sus contornos son suyos
TAB_Z = poly([(226, 386), (402, 380), (412, 548), (226, 548)])
ARM_SET = [I[n] for n in ('traje', 'guante')]
inz = TAB_Z[ly, lx]
arm_ids = [k for k, i in enumerate(ids) if i in ARM_SET]
if arm_ids:
    da = dv[:, arm_ids]
    near_arm = da.min(1) < 5.5 * SC
    sel = inz & near_arm
    owner[sel] = ids[np.array(arm_ids)][da[sel].argmin(1)]
# filtro de moda a lo largo de las líneas: sin picos donde cambia el dueño
own = np.full((H, W), -1, np.int32); own[ly, lx] = owner
cand = np.unique(owner)
win = 9 * SC
votes = np.stack([cv2.blur(((own == c) & line).astype(np.float32), (win, win)) for c in cand], -1)
body_line = (Y[ly, lx] > 236) | ~head_zone[ly, lx]
owner = np.where(body_line, cand[votes[ly, lx].argmax(-1)], owner)
win = 3 * SC
own = np.full((H, W), -1, np.int32); own[ly, lx] = owner
votes = np.stack([cv2.blur(((own == c) & line).astype(np.float32), (win, win)) for c in cand], -1)
owner = np.where(~body_line, cand[votes[ly, lx].argmax(-1)], owner)
# color final por píxel: índice de "pintura" = (clase, es_borde)
paint = np.full((H, W), -1, np.int32)
fillm = fig & ~line
paint[fillm] = lab[fillm] * 2
paint[ly, lx] = owner * 2 + 1

# ================================================================== 5. ojos (medidos antes de borrarlos)
def fit_eye(x0, x1, y0, y1):
    z = poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])
    ball = z & np.isin(lab, [I['blanco'], I['iris'], I['pupila']])
    ball = ndi.binary_fill_holes(ndi.binary_closing(ball, iterations=SC))
    cc_, n_ = ndi.label(ball)
    k = np.argmax(ndi.sum(ball, cc_, range(1, n_ + 1))) + 1
    ball = cc_ == k
    cnts, _ = cv2.findContours(ball.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    (ex, ey), (ew, eh), ang = cv2.fitEllipse(max(cnts, key=len))
    eye = dict(cx=ex / SC, cy=ey / SC, rx=max(ew, eh) / 2 / SC, ry=min(ew, eh) / 2 / SC)
    # iris: círculo ajustado al borde del iris+pupila (sin la parte de arriba, tapada por el párpado)
    ir = z & np.isin(lab, [I['iris'], I['pupila']])
    ir = ndi.binary_fill_holes(ndi.binary_closing(ir, iterations=SC))
    cc_, n_ = ndi.label(ir); k = np.argmax(ndi.sum(ir, cc_, range(1, n_ + 1))) + 1; ir = cc_ == k
    cnts, _ = cv2.findContours(ir.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    pts = max(cnts, key=len)[:, 0, :].astype(float) / SC
    A = np.c_[2 * pts[:, 0], 2 * pts[:, 1], np.ones(len(pts))]
    icx, icy, c = np.linalg.lstsq(A, (pts ** 2).sum(1), rcond=None)[0]
    eye['iris'] = (icx, icy, np.sqrt(c + icx ** 2 + icy ** 2))
    pu = z & (lab == I['pupila'])
    py_, px_ = np.nonzero(pu)
    eye['pupila'] = (px_.mean() / SC, py_.mean() / SC, np.sqrt(pu.sum() / np.pi) / SC)
    hl = z & (lab == I['blanco']) & disk(icx, icy, eye['iris'][2] * 0.95)
    hy_, hx_ = np.nonzero(hl)
    eye['brillo'] = (hx_.mean() / SC, hy_.mean() / SC, np.sqrt(hl.sum() / np.pi) / SC)
    # párpado: línea gruesa encima del ojo
    lid = z & line & (Y < eye['cy'] - eye['ry'] * 0.25)
    lyy, lxx = np.nonzero(lid)
    eye['lid'] = (lxx.min() / SC, lxx.max() / SC, lyy.min() / SC)
    return eye


EYES = {'izq': fit_eye(145, 205, 136, 186), 'der': fit_eye(228, 290, 136, 186)}

# los ojos se dibujan como primitivas: debajo queda piel
for e in EYES.values():
    z = ell(e['cx'], e['cy'], e['rx'] + 3.2, e['ry'] + 3.2) | (poly([(e['lid'][0] - 1, e['lid'][2] - 1), (e['lid'][1] + 1, e['lid'][2] - 1),
                                                                   (e['lid'][1] + 1, e['cy']), (e['lid'][0] - 1, e['cy'])]) & (paint % 2 == 1))
    lidbox = poly([(e['cx'] - e['rx'] - 4, e['lid'][2] - 4), (e['cx'] + e['rx'] + 4, e['lid'][2] - 4),
                   (e['cx'] + e['rx'] + 4, e['cy']), (e['cx'] - e['rx'] - 4, e['cy'])])
    z |= lidbox & ~np.isin(paint // 2, [I['ceja']])
    z &= fig
    paint[z] = I['piel'] * 2

# ================================================================== 6. partes animables
cls_of = paint // 2
HEAD_CLS = [I[n] for n in ('pelo', 'piel', 'oreja', 'oreja-int', 'nariz', 'ceja', 'rubor', 'blanco', 'iris', 'pupila')]
head = fig & head_zone & np.isin(cls_of, HEAD_CLS) & (paint >= 0)
cc_, n_ = ndi.label(head)
k = np.argmax(ndi.sum(head, cc_, range(1, n_ + 1))) + 1
head = ndi.binary_fill_holes(cc_ == k)
ARM_L = poly([(96, 268), (134, 372), (130, 470), (126, 570), (20, 570), (20, 320)])
ARM_R = poly([(330, 268), (294, 372), (296, 398), (228, 398), (224, 548), (415, 548), (415, 320)])
arm_l = fig & ARM_L & ~head
arm_r = fig & ARM_R & ~head
torso_behind_tablet = poly([(222, 380), (299, 380), (301, 552), (222, 552)]) & (cls_of == I['traje']) & (paint % 2 == 0)
arm_r &= ~torso_behind_tablet
# la línea del costado del torso (detrás de la tablet) también es del cuerpo
arm_r &= ~(poly([(222, 380), (301, 380), (303, 552), (222, 552)]) & (cls_of == I['traje']))
body = fig & ~head & ~arm_l & ~arm_r


def inpaint_under(mask_part, band, allowed):
    """Lo que el cuerpo tiene debajo de una parte: el vecino más cercano del cuerpo (solo clases 'allowed')."""
    src = body & np.isin(cls_of, allowed)
    _, (iy, ix) = ndi.distance_transform_edt(~src, return_indices=True)
    tgt = band & ~body
    out = paint.copy()
    out[tgt] = paint[iy[tgt], ix[tgt]]
    return tgt, out


body_paint = paint.copy()
# bajo la barbilla: collar por dentro y cuello
under_chin = head & (Y > 196) & ell(214, 250, 90, 40)
tgt, p2 = inpaint_under(head, under_chin, [I['sombra'], I['cuello'], I['traje']])
body_paint[tgt] = p2[tgt]; body |= tgt
# collar por dentro, dibujado limpio (la referencia ahí es borrosa): abertura con sombra, cuello y sus dos líneas
OPEN = (214, 225, 82, 43)
op_out = ell(OPEN[0], OPEN[1], OPEN[2] + 1.6, OPEN[3] + 1.6)
op_in = ell(OPEN[0], OPEN[1], OPEN[2] - 1.6, OPEN[3] - 1.6)
suitish = np.isin(body_paint // 2, [I['traje'], I['sombra'], I['cuello'], I['piel'], I['guante']]) & body
zone = op_out & (suitish | head) & (Y > 200)
body_paint[zone] = I['sombra'] * 2 + 1
body_paint[zone & op_in] = I['sombra'] * 2
neck = op_in & (X > 180) & (X < 253) & (Y > 232)
body_paint[neck & zone] = I['cuello'] * 2
ticks = neck & ((X < 183.6) | (X > 249.4)) & (Y > 246)
body_paint[ticks & zone] = I['cuello'] * 2 + 1
body |= zone
# bajo los brazos: suit hacia adentro, sin borde
for arm, piv in ((arm_l, (113, 302)), (arm_r, (313, 302))):
    near = arm & ndi.binary_dilation(body, iterations=10 * SC) & (Y < 470)
    body_paint[near & ~body] = I['traje'] * 2
    body |= near
# detrás de la tablet y la mano: torso
tab_zone = arm_r & poly([(222, 380), (304, 380), (304, 552), (222, 552)])
tgt, p2 = inpaint_under(arm_r, tab_zone, [I['traje'], I['sombra'], I['azul']])
body_paint[tgt] = p2[tgt]; body |= tgt

# ================================================================== 7. trazado
def potrace_path(mask, turd):
    if not mask.any():
        return ''
    bm = potrace.Bitmap(~mask)
    plist = bm.trace(turdsize=turd, alphamax=1.0, opticurve=True, opttolerance=0.2)
    f = lambda p: f'{p.x / SC:.2f} {p.y / SC:.2f}'
    out = []
    for curve in plist:
        d = [f'M{f(curve.start_point)}']
        for seg in curve.segments:
            d.append(f'L{f(seg.c)} L{f(seg.end_point)}' if seg.is_corner else f'C{f(seg.c1)} {f(seg.c2)} {f(seg.end_point)}')
        out.append(' '.join(d) + ' Z')
    return ' '.join(out)


ORDER = ['traje', 'sombra', 'cuello', 'guante', 'azul-osc', 'azul', 'marco', 'cian', 'pantalla', 'pantalla2', 'verde', 'amarillo', 'panza', 'naranja',
         'cuero', 'oro', 'esfera', 'rojo', 'pelo', 'oreja', 'oreja-int', 'piel', 'rubor', 'nariz', 'ceja', 'blanco', 'iris', 'pupila']
PAINT_ORDER = [I[n] * 2 + b for n in ORDER for b in (1, 0)]
hexc = lambda pid: P[names[pid // 2]][2 if pid % 2 else 1]


def trace_part(pmask, pp, under=1.5):
    out = []
    present = [pid for pid in PAINT_ORDER if ((pp == pid) & pmask).any()]
    regions = {pid: (pp == pid) & pmask for pid in present}
    above = np.zeros_like(pmask)
    masks = {}
    for pid in reversed(present):
        m = regions[pid]
        masks[pid] = m | (ndi.binary_dilation(m, iterations=int(under * SC)) & above)
        above |= regions[pid]
    for pid in present:
        d = potrace_path(masks[pid], 3 * SC * SC)
        if d:
            out.append(f'<path d="{d}" fill="#{hexc(pid)}" fill-rule="evenodd"/>')
    return ''.join(out)


f2 = lambda v: f'{v:.2f}'
def arc(cx, cy, rx, ry, t0, t1, n=4, move=True):
    """Arco de elipse como cúbicas (ángulos en grados, y hacia abajo)."""
    ts = np.radians(np.linspace(t0, t1, n + 1))
    P_ = lambda t: (cx + rx * np.cos(t), cy + ry * np.sin(t))
    p0 = P_(ts[0])
    d = f'M{f2(p0[0])} {f2(p0[1])}' if move else ''
    for u0, u1 in zip(ts[:-1], ts[1:]):
        k = 4 / 3 * np.tan((u1 - u0) / 4)
        a0, a3 = P_(u0), P_(u1)
        c1 = (a0[0] - k * rx * np.sin(u0), a0[1] + k * ry * np.cos(u0))
        c2 = (a3[0] + k * rx * np.sin(u1), a3[1] - k * ry * np.cos(u1))
        d += f' C{f2(c1[0])} {f2(c1[1])} {f2(c2[0])} {f2(c2[1])} {f2(a3[0])} {f2(a3[1])}'
    return d


def eye_shape(cx, cy, rx, ryt, ryb):
    # arriba más plano (lo aplasta el párpado), abajo redondo
    return arc(cx, cy, rx, ryt, 180, 360, 2) + arc(cx, cy, rx, ryb, 0, 180, 2, move=False) + ' Z'


def eye_svg(e, s):
    cx, cy, rx, ry = e['cx'], e['cy'], e['rx'], e['ry']
    ryt = ry * 0.97
    icx, icy, ir = e['iris']
    ir *= 1.08
    bx, by, br = e['brillo']
    # párpado: medialuna rellena, más gruesa en el centro y afinada en las esquinas
    outer = arc(cx, cy + 0.4, rx + 2.4, ryt + 4.3, 186, 354, 4)
    inner = arc(cx, cy + 0.4, rx + 0.3, ryt + 0.1, 354, 186, 4, move=False)
    t_ = np.radians(354)
    lid = (f'<path d="{outer} L{f2(cx + (rx + 0.3) * np.cos(t_))} {f2(cy + 0.4 + (ryt + 0.1) * np.sin(t_))}{inner} Z" '
           f'fill="#9E5546"/>')
    return (f'<g id="ojo-{s}" class="ojo" data-centro="{f2(cx)} {f2(cy)}" data-radio="{f2(rx)}">'
            f'<path d="{eye_shape(cx, cy, rx + 1.1, ryt + 1.1, ry + 1.1)}" fill="#D27F69"/>'
            f'<path d="{eye_shape(cx, cy, rx, ryt, ry)}" fill="#FFFFFF"/>'
            f'<circle cx="{f2(icx)}" cy="{f2(icy)}" r="{f2(ir)}" fill="#5B6530"/>'
            f'<circle cx="{f2(icx)}" cy="{f2(icy)}" r="{f2(ir - 1.8)}" fill="#8FA545"/>'
            f'<circle cx="{f2(icx)}" cy="{f2(icy)}" r="{f2(ir * 0.68)}" fill="#D29A36"/>'
            f'<circle cx="{f2(icx)}" cy="{f2(icy)}" r="{f2(ir * 0.52)}" fill="#3B2C1F"/>'
            f'<circle cx="{f2(bx)}" cy="{f2(by)}" r="{f2(br)}" fill="#FFFFFF"/>'
            f'{lid}</g>')


# sombra del piso
floor = ~fig & (lab == I['piso']) & (Y > 690)
floor = ndi.binary_opening(floor, iterations=2 * SC)
cnts, _ = cv2.findContours(floor.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
allpts = np.vstack([c for c in cnts if len(c) > 50])
(fx, fy), (fw, fh), _ = cv2.fitEllipse(allpts)
fx, fy, frx, fry = fx / SC, fy / SC, max(fw, fh) / 2 / SC, min(fw, fh) / 2 / SC

PULSERA = ('<g id="pulsera" fill="none" stroke-linecap="round" stroke-linejoin="round">'
           '<path d="M56.8 472.4 C66 471.6 80 471 92 471 C100 471 107 471.4 112.6 471.9" stroke="#9E1F22" stroke-width="6.6"/>'
           '<path d="M57.6 463.9 C63 463.4 70 466.4 77.5 470.6" stroke="#9E1F22" stroke-width="6.0"/>'
           '<path d="M56.8 472.4 C66 471.6 80 471 92 471 C100 471 107 471.4 112.6 471.9" stroke="#D23A33" stroke-width="4.2"/>'
           '<path d="M57.6 463.9 C63 463.4 70 466.4 77.5 470.6" stroke="#D23A33" stroke-width="3.7"/>'
           '</g>')
PARCHE = ('<g id="parche">'
          '<ellipse cx="84.6" cy="337.4" rx="9.6" ry="21.4" transform="rotate(16 84.6 337.4)" fill="#C9520D"/>'
          '<ellipse cx="85.2" cy="337.2" rx="7.9" ry="19.6" transform="rotate(16 85.2 337.2)" fill="#FB6711"/>'
          '</g>')
sys.path.insert(0, 'scripts/marca')
from calco import aplanar_svg  # rect/elipse rotada -> path sin transform (para el generador de Lottie)
PARCHE = '<g id="parche">' + aplanar_svg(PARCHE[len('<g id="parche">'):-len('</g>')]) + '</g>'
RELOJ = ('<g id="reloj">'
         '<path d="M319.4 468.4 C331 467.4 343 465.8 356 464.6 L356.4 479.4 C344 480 331 481 319.8 482.2 Z" fill="#8B4A2B"/>'
         '<path d="M320 476.6 C332 475.6 344 474.6 356 473.8 L356.2 479.4 C344 480 331 481 319.8 482.2 Z" fill="#6B3418"/>'
         '<circle cx="365.4" cy="471.8" r="13.5" fill="#A86E1E"/>'
         '<circle cx="365.4" cy="471.8" r="11.9" fill="#C98A2E"/>'
         '<circle cx="365.4" cy="471.8" r="7.9" fill="#FFF6E2"/>'
         '<circle cx="362.6" cy="468.8" r="2.4" fill="#FFFFFF"/>'
         '</g>')
PIV = {'cabeza': (213, 252), 'brazo-izq': (113, 302), 'brazo-der': (313, 302)}
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W // SC} {H // SC}">',
       f'<ellipse id="sombra-piso" cx="{f2(fx)}" cy="{f2(fy)}" rx="{f2(frx)}" ry="{f2(fry)}" fill="#E8BD93"/>',
       f'<g id="cuerpo">{trace_part(body, body_paint)}</g>',
       f'<g id="cabeza" data-pivote="{PIV["cabeza"][0]} {PIV["cabeza"][1]}">{trace_part(head, paint)}'
       f'{eye_svg(EYES["izq"], "izq")}{eye_svg(EYES["der"], "der")}</g>',
       f'<g id="brazo-izq" data-pivote="{PIV["brazo-izq"][0]} {PIV["brazo-izq"][1]}">{trace_part(arm_l, paint)}{PULSERA}{PARCHE}</g>',
       f'<g id="brazo-der" data-pivote="{PIV["brazo-der"][0]} {PIV["brazo-der"][1]}">{trace_part(arm_r, paint)}{RELOJ}</g>',
       '</svg>']
open(OUT, 'w').write(''.join(svg))
print('svg', OUT, sum(len(s) for s in svg) // 1024, 'KB')
