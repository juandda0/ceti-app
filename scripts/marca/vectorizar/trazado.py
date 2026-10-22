"""Máscara -> geometría SVG.

- Suavizado subpíxel: la máscara a 4x se desenfoca y se vuelve a umbralizar (quita escalones y dientes
  sin mover el borde), luego potrace (curvas Bézier con esquinas reales) y coordenadas /S.
- Primitivas: un componente que es un círculo o una elipse (ojos, brillos, botones, esferas de reloj)
  se emite como <circle>/<ellipse>; si la elipse está girada se emite como path de 4 arcos (sin transform).
"""
import cv2
import numpy as np
import potrace


def fmt(v):
    s = f'{v:.1f}'
    return s[:-2] if s.endswith('.0') else s


def suavizar(m, sigma):
    if sigma <= 0:
        return m
    f = cv2.GaussianBlur(m.astype(np.float32), (0, 0), sigma)
    return f > 0.5


def _reasignar(p, malos, validos):
    """Los píxeles `malos` toman el código del píxel `validos` más cercano."""
    if not malos.any() or not validos.any():
        return p
    from scipy import ndimage as ndi
    _, (iy, ix) = ndi.distance_transform_edt(~validos, return_indices=True)
    out = p.copy()
    out[malos] = p[iy[malos], ix[malos]]
    return out


def suavizar_conjunto(pintura, sigma, fondo=None, astillas=0, cunas=0, proteger=0.3, minimo=0.0):
    """Campo de etiquetas suavizado en conjunto (H5): fronteras compartidas.

    `pintura`: códigos >= 0 dentro de la región del grupo y -1 fuera (el exterior también es una clase, así la
    silueta se suaviza igual que las fronteras internas). Para cada código k: P_k = GaussianBlur(pintura == k, σ)
    y el resultado es argmax_k P_k, de modo que la frontera A|B es la MISMA isolínea para las dos capas.
    - `proteger`: si un código pierde más de esa fracción de sus píxeles (clases delgadas), se repone su esqueleto
      dilatado 1 px (solo donde ya era suyo).
    - `astillas` (px a escala de trabajo): las partes de menos de 2·astillas+1 de ancho del código de relleno del
      fondo dentro de la figura (halos claros entre dos colores, que se ven como rendijas) pasan al vecino más
      cercano. Los bolsillos de fondo compactos se conservan.
    - `cunas` (px² a escala de trabajo): lo que queda del fondo en componentes más chicos que esto y encajados
      entre dos o más códigos distintos (sin tocar el exterior) también pasa al vecino (esquinas de los halos).
    - `minimo` (px² a escala de trabajo): islas sueltas de cualquier código más chicas que esto pasan al vecino.
    Trazar después con sigma = 0 (el suavizado ya está hecho).
    """
    from scipy import ndimage as ndi
    p = pintura
    if astillas and fondo is not None:
        f = 2 * fondo + 1
        m = (p == f).astype(np.uint8)
        if m.any():
            r = int(round(astillas))
            disco = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1,) * 2)
            nucleo = cv2.dilate(cv2.morphologyEx(m, cv2.MORPH_OPEN, disco), disco)
            malos = (m > 0) & (nucleo == 0)
            if cunas:
                # cuñas: restos compactos pequeños del fondo encajados entre dos o más colores distintos
                # (esquinas de los halos); un hueco dentro de un solo color se conserva
                resto = (m > 0) & ~malos
                cc, n = ndi.label(resto)
                for i, s in enumerate(ndi.find_objects(cc)):
                    if s is None:
                        continue
                    y0, y1 = max(0, s[0].start - 1), s[0].stop + 1
                    x0, x1 = max(0, s[1].start - 1), s[1].stop + 1
                    comp = cc[y0:y1, x0:x1] == i + 1
                    if comp.sum() >= cunas:
                        continue
                    anillo = cv2.dilate(comp.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
                    vec = p[y0:y1, x0:x1][anillo & ~comp]
                    vec = set(np.unique(vec[vec != f]).tolist())
                    if -1 not in vec and len(vec) >= 2:
                        malos[y0:y1, x0:x1] |= comp
            p = _reasignar(p, malos, ~malos & (p != f) & (p >= 0))
    codigos = [int(c) for c in np.unique(p)]
    if sigma > 0:
        mejor = np.full(p.shape, -1.0, np.float32)
        out = p.copy()
        for k in codigos:
            P = cv2.GaussianBlur((p == k).astype(np.float32), (0, 0), sigma)
            m = P > mejor
            mejor[m] = P[m]
            out[m] = k
        if proteger:
            from skimage.morphology import skeletonize
            for k in codigos:
                if k < 0:
                    continue
                orig = p == k
                n0 = int(orig.sum())
                if n0 and (out == k).sum() < (1 - proteger) * n0:
                    esq = cv2.dilate(skeletonize(orig).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
                    out[esq & orig] = k
        p = out
    if minimo:
        malos = np.zeros(p.shape, bool)
        for k in codigos:
            if k < 0:
                continue
            cc, n = ndi.label(p == k)
            if n:
                tam = ndi.sum(np.ones_like(cc), cc, range(1, n + 1))
                chicos = np.where(tam < minimo)[0] + 1
                if len(chicos):
                    malos |= np.isin(cc, chicos)
        p = _reasignar(p, malos, ~malos)
    return p


def potrace_d(mask, S, ox=0, oy=0, turd=None, alphamax=1.0, opttol=0.6):
    if not mask.any():
        return ''
    bm = potrace.Bitmap(~mask)  # potracer: True = blanco
    plist = bm.trace(turdsize=turd if turd is not None else 4 * S * S, alphamax=alphamax, opticurve=True,
                     opttolerance=opttol)
    p = lambda q: f'{fmt((q.x + ox) / S)} {fmt((q.y + oy) / S)}'
    out = []
    for curve in plist:
        d = [f'M{p(curve.start_point)}']
        for seg in curve.segments:
            if seg.is_corner:
                d.append(f'L{p(seg.c)}L{p(seg.end_point)}')
            else:
                d.append(f'C{p(seg.c1)} {p(seg.c2)} {p(seg.end_point)}')
        out.append(''.join(d) + 'Z')
    return ''.join(out)


def iou_forma(m, dibujar):
    z = np.zeros(m.shape, np.uint8)
    dibujar(z)
    z = z > 0
    return (z & m).sum() / max(1, (z | m).sum())


# r3 integrador (pedido de capas en pedidos.md): el IoU de una primitiva se mide con margen, sin recortar la forma
# candidata al recorte del componente (una barra fina se aceptaba como elipse enorme: espiga de S2 con contención).
# Lo fija pipeline con experimentos.iou_con_margen; False = r2/r3 de curvas.
IOU_MARGEN = False


def primitiva(m, S, ox, oy, min_iou=0.955):
    """Si la máscara (un componente, sin huecos) es círculo/elipse, devuelve (tag, dict) en coordenadas finales."""
    if IOU_MARGEN:
        pad = max(m.shape) // 2 + 2
        m = np.pad(m, pad)
        ox, oy = ox - pad, oy - pad
    ys, xs = np.nonzero(m)
    if len(ys) < 30:
        return None
    cont, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cont, key=len)
    if len(c) < 8:
        return None
    (cx, cy), (w, h), ang = cv2.fitEllipse(c)
    # el contorno de findContours va por el centro de los píxeles del borde: +0.5 px de radio
    w, h = w + 1, h + 1
    def elip(z):
        cv2.ellipse(z, ((cx, cy), (w, h), ang), 1, -1)
    iou = iou_forma(m, elip)
    if iou < min_iou:
        return None
    rx, ry = w / 2, h / 2
    X, Y = (cx + ox) / S, (cy + oy) / S
    if abs(rx - ry) / max(rx, ry) < 0.06:
        return 'circle', dict(cx=X, cy=Y, r=(rx + ry) / 2 / S)
    a = ang % 180
    if min(a, 180 - a) < 3 or abs(a - 90) < 3:
        if abs(a - 90) < 3:
            rx, ry = ry, rx
        return 'ellipse', dict(cx=X, cy=Y, rx=rx / S, ry=ry / S)
    return 'path', dict(d=elipse_d(X, Y, rx / S, ry / S, ang))


def elipse_d(cx, cy, rx, ry, ang):
    k = 0.5522847498
    t = np.deg2rad(ang)
    ca, sa = np.cos(t), np.sin(t)
    P = lambda x, y: (cx + x * ca - y * sa, cy + x * sa + y * ca)
    pts = [(rx, 0), (0, ry), (-rx, 0), (0, -ry)]
    ctl = [((rx, k * ry), (k * rx, ry)), ((-k * rx, ry), (-rx, k * ry)),
           ((-rx, -k * ry), (-k * rx, -ry)), ((k * rx, -ry), (rx, -k * ry))]
    f = lambda q: f'{fmt(q[0])} {fmt(q[1])}'
    d = [f'M{f(P(*pts[0]))}']
    for i in range(4):
        (a1, a2), e = ctl[i], pts[(i + 1) % 4]
        d.append(f'C{f(P(*a1))} {f(P(*a2))} {f(P(*e))}')
    return ''.join(d) + 'Z'


def elemento(tag, at, color, extra=''):
    if tag == 'circle':
        return f'<circle{extra} cx="{fmt(at["cx"])}" cy="{fmt(at["cy"])}" r="{fmt(at["r"])}" fill="#{color}"/>'
    if tag == 'ellipse':
        return (f'<ellipse{extra} cx="{fmt(at["cx"])}" cy="{fmt(at["cy"])}" rx="{fmt(at["rx"])}" ry="{fmt(at["ry"])}" '
                f'fill="#{color}"/>')
    return f'<path{extra} d="{at["d"]}" fill="#{color}"/>'


def trazar_capa(mask, S, color, sigma, opttol, primitivas=True, max_prim=None, adaptativo=None, borde=False):
    """Una capa -> lista de elementos SVG. Los componentes con forma de círculo/elipse salen como primitivas;
    el resto va en un solo path compuesto. `adaptativo` (H13', r2): True o dict de parámetros -> ver
    `trazar_capa_adaptativa`; `borde` = la capa es un tono de borde/línea (no un relleno)."""
    if adaptativo:
        return trazar_capa_adaptativa(mask, S, color, sigma, opttol, primitivas, max_prim, borde,
                                      **(adaptativo if isinstance(adaptativo, dict) else {}))
    ys, xs = np.nonzero(mask)
    if not len(ys):
        return []
    y0, y1 = max(0, ys.min() - 4), ys.max() + 5
    x0, x1 = max(0, xs.min() - 4), xs.max() + 5
    m = suavizar(mask[y0:y1, x0:x1], sigma)
    if not m.any():
        return []
    out = []
    if primitivas:
        n, cc, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=8)
        resto = m.copy()
        for i in range(1, n):
            area = st[i, cv2.CC_STAT_AREA]
            if max_prim and area > max_prim:
                continue
            bx, by, bw, bh = st[i, :4]
            sub = cc[by:by + bh, bx:bx + bw] == i
            # con huecos no es primitiva
            if (cv2.morphologyEx(sub.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)) > 0).sum() > area * 1.02 \
                    and _tiene_huecos(sub):
                continue
            pr = primitiva(sub, S, x0 + bx, y0 + by)
            if pr:
                out.append(elemento(*pr, color))
                resto[by:by + bh, bx:bx + bw][sub] = False
        m = resto
    d = potrace_d(m, S, x0, y0, opttol=opttol)
    if d:
        out.insert(0, f'<path d="{d}" fill="#{color}"/>')
    return out


def _tiene_huecos(sub):
    from scipy import ndimage as ndi
    return (ndi.binary_fill_holes(sub) & ~sub).sum() > 4


# ============================================================================ H13' (r2): trazado adaptativo
def _offset_poligono(P, d):
    """Desplaza un polígono cerrado (N×2, coordenadas continuas) `d` px hacia afuera (inglete limitado a 2d)."""
    n = len(P)
    area = 0.5 * np.sum(P[:, 0] * np.roll(P[:, 1], -1) - np.roll(P[:, 0], -1) * P[:, 1])
    s = 1.0 if area > 0 else -1.0  # con y hacia abajo, area > 0 = horario en pantalla
    out = []
    for i in range(n):
        a, b, c = P[i - 1], P[i], P[(i + 1) % n]
        e1, e2 = b - a, c - b
        n1 = s * np.array([e1[1], -e1[0]]) / max(1e-9, np.hypot(*e1))
        n2 = s * np.array([e2[1], -e2[0]]) / max(1e-9, np.hypot(*e2))
        m = n1 + n2
        k = 1 + float(n1 @ n2)
        v = m / k if k > 0.25 else m / max(1e-9, np.hypot(*m)) * 2
        out.append(b + d * v)
    out = np.array(out)
    # comprobar que salió hacia afuera (si no, el signo era al revés)
    a2 = 0.5 * np.sum(out[:, 0] * np.roll(out[:, 1], -1) - np.roll(out[:, 0], -1) * out[:, 1])
    if abs(a2) < abs(area):
        out = 2 * P - out
    return out


def poligono_recto(sub, S, ancho=3.0, eps=0.75, max_v=8, min_iou=0.95, alargado=4.0, max_desvio=0.15):
    """Si la componente `sub` (bool, sin huecos) es una franja fina y recta, devuelve sus vértices (N×2, coordenadas
    continuas del recorte, esquina del píxel = entero) para emitirla como polígono de segmentos rectos; si no, None.
    Fina: ancho medio por EDT sobre el esqueleto ≤ ancho·S. Recta: el esqueleto se aparta de su recta ajustada
    ≤ eps·S y el contorno se aproxima (approxPolyDP, ε = eps·S) con ≤ max_v vértices e IoU ≥ min_iou."""
    from skimage.morphology import skeletonize
    h, w = sub.shape
    if sub.sum() < 4 * S * S:
        return None
    pad = np.pad(sub, 1).astype(np.uint8)
    cont, _ = cv2.findContours(pad, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cont, key=len)
    (_, _), (rw, rh), _ = cv2.minAreaRect(c)
    if min(rw, rh) <= 0 or max(rw, rh) / min(rw, rh) < alargado:
        return None
    dt = cv2.distanceTransform(pad, cv2.DIST_L2, 5)
    esq = skeletonize(pad > 0)
    if esq.sum() < 3:
        return None
    anch = 2 * float(dt[esq].mean()) - 1
    if anch > ancho * S:
        return None
    ys, xs = np.nonzero(esq)
    pts = np.c_[xs, ys].astype(np.float32)
    vx, vy, x0, y0 = cv2.fitLine(pts, cv2.DIST_L2, 0, 0.01, 0.01).ravel()
    dev = np.abs((pts[:, 0] - x0) * vy - (pts[:, 1] - y0) * vx)
    if dev.max() > eps * S + 1:
        return None
    # candidatos: rectángulo mínimo (franja recta con extremos planos) y approxPolyDP con ε decreciente;
    # gana el de menos vértices con IoU ≥ min_iou (IoU a 4×: fillPoly incluye los píxeles del borde)
    f = 4
    sb = np.repeat(np.repeat(sub, f, 0), f, 1)
    cands = [cv2.boxPoints(cv2.minAreaRect(c)).astype(np.float64) - 1 + 0.5]
    for e in (eps, eps * 0.66, eps * 0.45):
        ap = cv2.approxPolyDP(c, e * S, True).reshape(-1, 2).astype(np.float64)
        if 3 <= len(ap) <= max_v:
            cands.append(_offset_poligono(ap - 1 + 0.5, 0.5))
    mejor = None
    for P in cands:
        z = np.zeros((h * f, w * f), np.uint8)
        cv2.fillPoly(z, [np.round((P * f - 0.5) * 8).astype(np.int32)], 1, lineType=cv2.LINE_8, shift=3)
        z = z > 0
        iou = (z & sb).sum() / max(1, (z | sb).sum())
        # desvío medio del borde (área de la diferencia / perímetro, px de trabajo): en franjas finas el IoU
        # castiga de más un error de medio píxel
        desvio = (z ^ sb).sum() / (f * f) / max(1.0, cv2.arcLength(P.astype(np.float32).reshape(-1, 1, 2), True))
        if iou >= min_iou or desvio <= max_desvio * S:
            clave = (len(P), desvio)
            if mejor is None or clave < mejor[0]:
                mejor = (clave, P)
    return None if mejor is None else mejor[1]


def trazar_capa_adaptativa(mask, S, color, sigma, opttol, primitivas=True, max_prim=None, borde=False,
                           rectas=True, ancho=3.0, eps=0.75, max_v=8, min_iou=0.95, alargado=4.0,
                           grande=40, f_grande=1.6, pequena=8, f_pequena=0.6,
                           alpha_relleno=1.1, alpha_borde=1.0, sigma_g=1.0, sigma_n=0.5, esc=1.0, hueco_max=20,
                           prim_v2=None):
    """H13': como `trazar_capa`, pero por componente:
    - primitivas círculo/elipse igual que v1;
    - franjas finas y rectas -> polígono de segmentos rectos (`poligono_recto`);
    - el resto con potrace, opttolerance según el área de la componente (×f_grande si área > (grande·S)²,
      ×f_pequena si área < (pequena·S)²) y alphamax alpha_relleno en rellenos grandes / alpha_borde en bordes;
    - suavizado extra antes de potrace: σ = sigma_g·S·esc en las componentes grandes y sigma_n·S·esc en las
      medianas (las pequeñas no se tocan). Quita la ondulación del borde (cada inflexión es un nodo más de potrace)
      sin mover el borde; `esc` = tamaño del personaje (√área de la figura / S / 400, en [0.3, 1]) para que una
      miniatura no pierda detalle.
    Todo de la capa sale en un solo path compuesto (más las primitivas)."""
    ys, xs = np.nonzero(mask)
    if not len(ys):
        return []
    y0, y1 = max(0, ys.min() - 4), ys.max() + 5
    x0, x1 = max(0, xs.min() - 4), xs.max() + 5
    m = suavizar(mask[y0:y1, x0:x1], sigma)
    if not m.any():
        return []
    out = []
    n, cc, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=8)
    cubeta = {'g': np.zeros_like(m), 'n': np.zeros_like(m), 'p': np.zeros_like(m)}
    polis = []
    extra_d = []
    barras = []
    for i in range(1, n):
        area = st[i, cv2.CC_STAT_AREA]
        bx, by, bw, bh = st[i, :4]
        sub = cc[by:by + bh, bx:bx + bw] == i
        huecos = None
        if primitivas and prim_v2 is not None:
            # H20 (r3): barra, píldora, elipse/disco grande e intersección de dos discos
            huecos = _tiene_huecos(sub)
            if not huecos:
                pv = primitiva_v2(sub, S, x0 + bx, y0 + by, area_max=max_prim, o=prim_v2)
                if pv:
                    if pv[0] == 'el':
                        out.append(pv[1].replace('{C}', color))
                    elif pv[0] == 'barra':
                        barras.append(pv[2])
                    else:
                        extra_d.append(pv[1])
                    continue
        elif primitivas and not (max_prim and area > max_prim):
            huecos = _tiene_huecos(sub)
            cerr = (cv2.morphologyEx(sub.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)) > 0).sum()
            if not (cerr > area * 1.02 and huecos):
                pr = primitiva(sub, S, x0 + bx, y0 + by)
                if pr:
                    out.append(elemento(*pr, color))
                    continue
        if rectas and area <= (ancho * S) * (bw + bh) * 1.5:
            if huecos is None:
                huecos = _tiene_huecos(sub)
            P = None if huecos else poligono_recto(sub, S, ancho, eps, max_v, min_iou, alargado)
            if P is not None:
                polis.append(P + [x0 + bx, y0 + by])
                continue
        k = 'g' if area > (grande * S) ** 2 else ('p' if area < (pequena * S) ** 2 else 'n')
        cubeta[k][by:by + bh, bx:bx + bw] |= sub
    d = []
    for k, f in (('g', f_grande), ('n', 1.0), ('p', f_pequena)):
        if not cubeta[k].any():
            continue
        am = alpha_borde if borde else (alpha_relleno if k == 'g' else 1.0)
        se = {'g': sigma_g, 'n': sigma_n}.get(k, 0.0)
        mk = cubeta[k]
        if se > 0:
            sm = suavizar(mk, se * S * esc)
            if k == 'g' and hueco_max:
                # los huecos chicos de una componente grande son detalle (estrellas recortadas en un fondo, botones):
                # no se suavizan, para no redondear sus puntas
                from scipy import ndimage as ndi
                hu = ndi.binary_fill_holes(mk) & ~mk
                if hu.any():
                    nh, ch, sth, _ = cv2.connectedComponentsWithStats(hu.astype(np.uint8), connectivity=4)
                    chicos = np.where(sth[1:, cv2.CC_STAT_AREA] < (hueco_max * S * esc) ** 2)[0] + 1
                    if len(chicos):
                        hc = np.isin(ch, chicos)
                        anillo = cv2.dilate(hc.astype(np.uint8), np.ones((3, 3), np.uint8),
                                            iterations=max(1, int(round(2 * se * S * esc)))) > 0
                        sm = np.where(anillo, mk, sm)
            mk = sm
        d.append(potrace_d(mk, S, x0, y0, alphamax=am, opttol=opttol * f))
    for P in polis:
        q = lambda v: f'{fmt(v[0] / S)} {fmt(v[1] / S)}'
        d.append(f'M{q(P[0])}' + ''.join(f'L{q(v)}' for v in P[1:]) + 'Z')
    if barras:
        o2 = {**PRIMITIVAS_V2, **(prim_v2 or {})}
        for (c, eu, ev, a, b) in fusionar_barras(barras, S, o2['fusion_hueco'], o2['fusion_angulo']):
            ini, seg = _rr_segmentos(c, eu, ev, a, b, 0)
            extra_d.append(_d_segmentos(ini, seg, S, 0, 0))
    d = ''.join(d + extra_d)
    if d:
        out.insert(0, f'<path d="{d}" fill="#{color}"/>')
    return out


def simplificar_ocultas(mascaras, S, margen=1.5, cierre=2.0, sigma=2.0, min_trozo=6.0):
    """H13'b (r2): simplifica lo que de cada capa queda TAPADO por las capas de encima del mismo grupo.

    `mascaras`: lista de máscaras bool del mismo tamaño, de abajo hacia arriba (orden de `capas.apilar`).
    De arriba hacia abajo, con `cub` = unión de las capas ya resueltas de encima y `oculto` = cub erosionado
    `margen`·S (lo que queda tapado aunque el trazado de encima se mueva un poco):
        nueva_k = (m_k fuera de oculto) ∪ (suave(m_k) dentro de oculto) ∪ (huecos de nueva_k dentro de oculto)
    con suave = cierre con disco de `cierre`·S y desenfoque σ = `sigma`·S umbralizado a 0.5. Lo visible no cambia
    (por inducción, el color de arriba en cada píxel sigue siendo el mismo que antes), y las extensiones ocultas,
    que potrace trazaba con todos sus dientes, quedan lisas y se funden (p. ej. el fondo de un panel de franjas).
    La solapa con la capa de encima se conserva en una banda de `margen`·S."""
    n = len(mascaras)
    if n < 2:
        return list(mascaras)
    out = [None] * n
    cub = np.zeros_like(mascaras[0], dtype=bool)
    r_m = max(1, int(round(margen * S)))
    k_m = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r_m + 1,) * 2)
    r_c = max(1, int(round(cierre * S)))
    k_c = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r_c + 1,) * 2)
    from scipy import ndimage as ndi
    for k in range(n - 1, -1, -1):
        m = mascaras[k]
        if cub.any() and m.any():
            oculto = cv2.erode(cub.astype(np.uint8), k_m) > 0
            if (m & oculto).any():
                sm = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, k_c) > 0
                sm = suavizar(sm, sigma * S)
                # lo visible y su solapa (banda de `margen` bajo la capa de encima, pegada a lo visible); lo tapado
                # que no está junto a lo visible solo queda si cae en `oculto` (así no quedan astillas en los bordes
                # del grupo, donde la erosión no llega)
                vis = (m & ~cub).astype(np.uint8)
                m2 = (m & (cv2.dilate(vis, k_m) > 0)) | (sm & oculto)
                m2 |= ndi.binary_fill_holes(m2) & oculto
                # un trozo visible que se quedó aislado y diminuto (antes iba unido a su extensión oculta) sería
                # una mota: se le devuelve su componente original
                nc, cc2, st2, _ = cv2.connectedComponentsWithStats(m2.astype(np.uint8), connectivity=8)
                chicos = list(np.where(st2[1:, cv2.CC_STAT_AREA] < min_trozo * S * S)[0] + 1)
                # y los trozos finos (astillas visibles de menos de 2 px de ancho) de tamaño medio
                medios = np.where((st2[1:, cv2.CC_STAT_AREA] >= min_trozo * S * S)
                                  & (st2[1:, cv2.CC_STAT_AREA] < 10 * min_trozo * S * S))[0] + 1
                if len(medios):
                    dt = cv2.distanceTransform(m2.astype(np.uint8), cv2.DIST_L2, 3)
                    mx = ndi.maximum(dt, cc2, medios)
                    chicos += [int(j) for j, v in zip(medios, mx) if v < S]
                if len(chicos):
                    ch = np.isin(cc2, chicos)
                    co, cco = cv2.connectedComponents(m.astype(np.uint8), connectivity=8)
                    ids = np.unique(cco[ch & m])
                    m2 |= np.isin(cco, ids[ids > 0])
                m = m2
        out[k] = m
        cub |= m
    return out


# ============================================================================ H20 (r3): primitivas v2
# Formas regulares por componente: barra recta (rectángulo), píldora / rectángulo redondeado, disco grande e
# intersección de dos discos (anillos de un degradado radial recortados por el círculo exterior). Todo en
# coordenadas continuas del recorte (el píxel i cubre [i, i+1]) y se emite como path absoluto (contrato ok).
PRIMITIVAS_V2 = {
    'rect_iou': 0.90, 'rect_aspecto': 3.0, 'rect_desvio': 0.25, 'rect_iou_fino': 0.8,  # barra: (IoU ≥ rect_iou o lado corto ≤ 3·S) y desvío ≤ rect_desvio·S
    'pildora_iou': 0.92, 'pildora_aspecto': 1.4, 'pildora_margen': 0.01, 'pildora_desvio': 0.3,  # píldora frente a la elipse
    'disco_iou': 0.985,                                         # disco/elipse más grande que max_prim
    'lente_iou': 0.97, 'lente_min': 12,                         # dos discos; lente_min = lado mínimo (·S)
    'lente_tol': 0.6, 'lente_cobertura': 0.9,                   # RANSAC de los dos discos (·S; fracción del contorno)
    'radial_disco_iou': 0.97, 'radial_lente_iou': 0.96, 'radial_tol': 1.0,  # dentro de una familia radial anidada
    'fusion_hueco': 1.0, 'fusion_angulo': 3.0,                  # guiones colineales separados < fusion_hueco·S
    'inv_huecos': 8,                                            # invertir_agujereadas: mínimo de huecos (0 = no)
    'radiales': True,                                           # anidar_radiales (anillos de degradado radial)
}


def fusionar_barras(barras, S, hueco=1.0, angulo=3.0):
    """Une guiones colineales (mismo ángulo ± `angulo`°, ancho parecido, ejes a < 0.5·ancho) separados por menos
    de `hueco`·S a lo largo del eje. barras: [(centro, eu, ev, largo, ancho)] en coordenadas de trabajo."""
    n = len(barras)
    if n < 2 or hueco <= 0:
        return barras
    padre = list(range(n))

    def raiz(i):
        while padre[i] != i:
            padre[i] = padre[padre[i]]
            i = padre[i]
        return i
    for i in range(n):
        ci, ui, vi, ai, bi = barras[i]
        for j in range(i + 1, n):
            cj, uj, vj, aj, bj = barras[j]
            if abs(float(ui @ uj)) < np.cos(np.deg2rad(angulo)):
                continue
            if max(bi, bj) > 1.5 * min(bi, bj):
                continue
            dv = abs(float((cj - ci) @ vi))
            if dv > 0.5 * max(bi, bj):
                continue
            du = abs(float((cj - ci) @ ui))
            if du - (ai + aj) / 2 > hueco * S:
                continue
            padre[raiz(j)] = raiz(i)
    grupos = {}
    for i in range(n):
        grupos.setdefault(raiz(i), []).append(i)
    out = []
    for ids in grupos.values():
        if len(ids) == 1:
            out.append(barras[ids[0]])
            continue
        c0, u0, v0, _, _ = barras[ids[0]]
        ts, vs, ws, bs = [], [], [], []
        for i in ids:
            c, u, v, a, b = barras[i]
            t = float((c - c0) @ u0)
            ts += [t - a / 2, t + a / 2]
            vs.append(float((c - c0) @ v0))
            ws.append(a)
            bs.append(b)
        ws = np.array(ws)
        t0, t1 = min(ts), max(ts)
        voff = float(np.average(vs, weights=ws))
        b = float(np.average(bs, weights=ws))
        c = c0 + u0 * (t0 + t1) / 2 + v0 * voff
        out.append((c, u0, v0, t1 - t0, b))
    return out


def _sobremuestreo(sub, f=4):
    return np.repeat(np.repeat(sub, f, 0), f, 1)


def _iou_poli(sb, P, f=4):
    """IoU entre la máscara sobremuestreada `sb` (f×) y el polígono P (coordenadas continuas del recorte)."""
    Q = np.asarray(P, np.float64) * f - 0.5
    if IOU_MARGEN:
        # la forma candidata entera cuenta: se amplía el lienzo lo que haga falta
        h, w = sb.shape
        px0 = max(0, int(np.ceil(-Q[:, 0].min())) + 1)
        py0 = max(0, int(np.ceil(-Q[:, 1].min())) + 1)
        px1 = max(0, int(np.ceil(Q[:, 0].max())) - w + 2)
        py1 = max(0, int(np.ceil(Q[:, 1].max())) - h + 2)
        if px0 or py0 or px1 or py1:
            sb = np.pad(sb, ((py0, py1), (px0, px1)))
            Q = Q + [px0, py0]
    h, w = sb.shape
    z = np.zeros((h, w), np.uint8)
    cv2.fillPoly(z, [np.round(Q * 8).astype(np.int32)], 1, lineType=cv2.LINE_8, shift=3)
    z = z > 0
    return (z & sb).sum() / max(1, (z | sb).sum()), (z ^ sb).sum() / (f * f)


def _rect_local(cx, cy, w, h, ang):
    """Ejes del rectángulo: u = lado largo, v = corto. Devuelve (centro, eu, ev, largo, corto)."""
    t = np.deg2rad(ang)
    e1 = np.array([np.cos(t), np.sin(t)])
    e2 = np.array([-np.sin(t), np.cos(t)])
    if w >= h:
        return np.array([cx, cy]), e1, e2, w, h
    return np.array([cx, cy]), e2, e1, h, w


def _rr_segmentos(c, eu, ev, a, b, r):
    """Contorno de un rectángulo redondeado (largo a, corto b, radio r ≤ b/2): lista de segmentos
    ('L', p) / ('C', c1, c2, p) desde un punto inicial; arcos de 90° con k = 0.5523."""
    k = 0.5522847498
    P = lambda u, v: c + u * eu + v * ev
    ha, hb = a / 2, b / 2
    r = float(np.clip(r, 0, hb))
    ini = P(-ha + r, -hb)
    seg = []
    # (esquina, dirección de entrada, dirección de salida) en sentido horario de pantalla: arriba, derecha, abajo, izq.
    esquinas = [((ha, -hb), (1, 0), (0, 1)), ((ha, hb), (0, 1), (-1, 0)),
                ((-ha, hb), (-1, 0), (0, -1)), ((-ha, -hb), (0, -1), (1, 0))]
    for (qu, qv), (du, dv), (su, sv) in esquinas:
        a0 = (qu - du * r, qv - dv * r)  # fin del lado recto antes de la esquina
        a1 = (qu + su * r, qv + sv * r)  # inicio del lado siguiente
        seg.append(('L', P(*a0)))
        if r > 1e-6:
            seg.append(('C', P(a0[0] + du * k * r, a0[1] + dv * k * r), P(a1[0] - su * k * r, a1[1] - sv * k * r),
                        P(*a1)))
    # quitar rectas de largo nulo (píldora: los lados cortos desaparecen)
    out, prev = [], ini
    for s in seg:
        if s[0] == 'L' and np.hypot(*(s[1] - prev)) < 1e-6:
            continue
        out.append(s)
        prev = s[-1]
    return ini, out


def _rr_poligono(c, eu, ev, a, b, r, n=6):
    """Polígono denso del rectángulo redondeado (para medir el IoU)."""
    ini, seg = _rr_segmentos(c, eu, ev, a, b, r)
    pts, prev = [ini], ini
    for s in seg:
        if s[0] == 'L':
            pts.append(s[1])
        else:
            p0, c1, c2, p3 = prev, s[1], s[2], s[3]
            for t in np.linspace(0, 1, n + 1)[1:]:
                pts.append((1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * c1 + 3 * (1 - t) * t * t * c2 + t ** 3 * p3)
        prev = s[-1]
    return np.array(pts)


def _d_segmentos(ini, seg, S, ox, oy):
    q = lambda p: f'{fmt((p[0] + ox) / S)} {fmt((p[1] + oy) / S)}'
    d = [f'M{q(ini)}']
    for s in seg:
        d.append(f'L{q(s[1])}' if s[0] == 'L' else f'C{q(s[1])} {q(s[2])} {q(s[3])}')
    return ''.join(d) + 'Z'


def _circulo_ls(p):
    """Círculo por mínimos cuadrados (Kasa). p: N×2. Devuelve (cx, cy, r) o None."""
    if len(p) < 3:
        return None
    A = np.c_[2 * p, np.ones(len(p))]
    bb = (p ** 2).sum(1)
    try:
        sol, *_ = np.linalg.lstsq(A, bb, rcond=None)
    except np.linalg.LinAlgError:
        return None
    cx, cy, k = sol
    r2 = k + cx * cx + cy * cy
    return None if r2 <= 0 else (cx, cy, float(np.sqrt(r2)))


def _ransac_circulo(p, tol, it=150, rng=None):
    rng = rng or np.random.default_rng(0)
    mejor, ins = None, None
    n = len(p)
    if n < 10:
        return None, None
    for _ in range(it):
        c = _circulo_ls(p[rng.choice(n, 3, replace=False)])
        if c is None:
            continue
        e = np.abs(np.hypot(p[:, 0] - c[0], p[:, 1] - c[1]) - c[2])
        m = e < tol
        if ins is None or m.sum() > ins.sum():
            mejor, ins = c, m
    if mejor is None:
        return None, None
    c = _circulo_ls(p[ins])
    if c is None:
        return None, None
    e = np.abs(np.hypot(p[:, 0] - c[0], p[:, 1] - c[1]) - c[2])
    return c, e < tol


def _arco(c, r, t0, t1):
    """Arco de circunferencia de t0 a t1 (radianes, con signo) en tramos ≤ 90°: lista de ('C', c1, c2, p)."""
    n = max(1, int(np.ceil(abs(t1 - t0) / (np.pi / 2) - 1e-9)))
    dt = (t1 - t0) / n
    k = 4 / 3 * np.tan(dt / 4)
    c = np.asarray(c, float)
    out = []
    for i in range(n):
        a, b = t0 + i * dt, t0 + (i + 1) * dt
        pa = c + r * np.array([np.cos(a), np.sin(a)])
        pb = c + r * np.array([np.cos(b), np.sin(b)])
        ta = np.array([-np.sin(a), np.cos(a)])
        tb = np.array([-np.sin(b), np.cos(b)])
        out.append(('C', pa + k * r * ta, pb - k * r * tb, pb))
    return out


def _lente(A, B):
    """Contorno de la intersección de los discos A y B (cx, cy, r) que se cortan: (ini, segmentos) o None."""
    (ax, ay, ar), (bx, by, br) = A, B
    d = np.hypot(bx - ax, by - ay)
    if d <= abs(ar - br) or d >= ar + br or d < 1e-6:
        return None
    a = (ar * ar - br * br + d * d) / (2 * d)
    h = np.sqrt(max(0.0, ar * ar - a * a))
    ex, ey = (bx - ax) / d, (by - ay) / d
    mx, my = ax + a * ex, ay + a * ey
    p1 = np.array([mx - h * ey, my + h * ex])
    p2 = np.array([mx + h * ey, my - h * ex])

    def arco_dentro(c, r, pi, pf, otro):
        t0 = np.arctan2(pi[1] - c[1], pi[0] - c[0])
        t1 = np.arctan2(pf[1] - c[1], pf[0] - c[0])
        for s in (1, -1):
            dt = (t1 - t0) % (2 * np.pi) if s > 0 else -((t0 - t1) % (2 * np.pi))
            tm = t0 + dt / 2
            pm = (c[0] + r * np.cos(tm), c[1] + r * np.sin(tm))
            if np.hypot(pm[0] - otro[0], pm[1] - otro[1]) <= otro[2] + 1e-6:
                return _arco(c, r, t0, t0 + dt)
        return None
    s1 = arco_dentro((ax, ay), ar, p1, p2, B)
    s2 = arco_dentro((bx, by), br, p2, p1, A)
    if s1 is None or s2 is None:
        return None
    return p1, s1 + s2


def _poli_de_segmentos(ini, seg, n=8):
    pts, prev = [ini], ini
    for s in seg:
        if s[0] == 'L':
            pts.append(s[1])
        else:
            p0, c1, c2, p3 = prev, s[1], s[2], s[3]
            for t in np.linspace(0, 1, n + 1)[1:]:
                pts.append((1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * c1 + 3 * (1 - t) * t * t * c2 + t ** 3 * p3)
        prev = s[-1]
    return np.array(pts)


def primitiva_v2(sub, S, ox, oy, area_max=None, o=None):
    """H20: prueba, para una componente sin huecos, barra recta, píldora/rectángulo redondeado, elipse/disco
    (también por encima de `area_max` si el ajuste es casi exacto) e intersección de dos discos. Devuelve un
    elemento SVG (str) o None. `o`: parámetros (ver PRIMITIVAS_V2)."""
    o = {**PRIMITIVAS_V2, **(o or {})}
    area = int(sub.sum())
    if area < 30:
        return None
    pad = np.pad(sub, 1).astype(np.uint8)
    cont, _ = cv2.findContours(pad, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cont, key=len)
    if len(c) < 8:
        return None
    f = 4 if area < 40000 else (2 if area < 250000 else 1)
    sb = _sobremuestreo(sub, f)
    (rx, ry), (rw, rh), rang = cv2.minAreaRect(c)
    # contorno por el centro de los píxeles del borde: +1 de lado; -1 del pad, +0.5 al centro del píxel
    cen, eu, ev, a, b = _rect_local(rx - 0.5, ry - 0.5, rw + 1, rh + 1, rang)
    cands = []  # (iou, nodos, desvio, elemento)
    # 1) barra recta (rectángulo de aspecto ≥ rect_aspecto)
    if b > 0 and a / b >= o['rect_aspecto']:
        P = _rr_poligono(cen, eu, ev, a, b, 0)
        iou, dif = _iou_poli(sb, P, f) if f else (0, 0)
        desvio = dif / max(1.0, 2 * (a + b))
        # desvío medio del borde (área de la diferencia / perímetro): en barras finas el IoU castiga de más medio píxel,
        # en formas grandes un IoU de 0.9 deja pasar ondas reales (bandas onduladas de S4): se exigen los dos
        if (iou >= o['rect_iou'] or (b <= 3 * S and iou >= o['rect_iou_fino'])) and desvio <= o['rect_desvio'] * S:
            ini, seg = _rr_segmentos(cen, eu, ev, a, b, 0)
            cands.append((iou, 5, desvio, 'path', _d_segmentos(ini, seg, S, ox, oy),
                          (cen + [ox, oy], eu, ev, a, b), P))
    # 2) píldora (radio = corto/2)
    if b > 2 * S and a / b >= o['pildora_aspecto']:
        P = _rr_poligono(cen, eu, ev, a, b, b / 2)
        iou, dif = _iou_poli(sb, P, f)
        # extremos redondeados: si la píldora ajusta al menos igual que el rectángulo, no hay esquinas que poner
        cands = [x for x in cands if not (x[1] == 5 and x[0] <= iou)]
        desvio = dif / max(1.0, 2 * (a - b) + np.pi * b)
        if iou >= o['pildora_iou'] and desvio <= o['pildora_desvio'] * S:
            ini, seg = _rr_segmentos(cen, eu, ev, a, b, b / 2)
            cands.append((iou, 7, desvio, 'path', _d_segmentos(ini, seg, S, ox, oy), None, P))
    # 3) elipse (como primitiva v1, con IoU medido igual que los demás candidatos)
    if len(c) >= 8:
        (ex, ey), (ew, eh), eang = cv2.fitEllipse(c)
        ex, ey, ew, eh = ex - 0.5, ey - 0.5, ew + 1, eh + 1
        t = np.linspace(0, 2 * np.pi, 72, endpoint=False)
        tt = np.deg2rad(eang)
        P = np.c_[ex + ew / 2 * np.cos(t) * np.cos(tt) - eh / 2 * np.sin(t) * np.sin(tt),
                  ey + ew / 2 * np.cos(t) * np.sin(tt) + eh / 2 * np.sin(t) * np.cos(tt)]
        iou, dif = _iou_poli(sb, P, f)
        grande = area_max and area > area_max
        if iou >= (o['disco_iou'] if grande else 0.955):
            X, Y = (ex + ox) / S, (ey + oy) / S
            erx, ery = ew / 2, eh / 2
            if abs(erx - ery) / max(erx, ery) < 0.06:
                el = elemento('circle', dict(cx=X, cy=Y, r=(erx + ery) / 2 / S), '{C}')
            else:
                a_ = eang % 180
                if min(a_, 180 - a_) < 3 or abs(a_ - 90) < 3:
                    if abs(a_ - 90) < 3:
                        erx, ery = ery, erx
                    el = elemento('ellipse', dict(cx=X, cy=Y, rx=erx / S, ry=ery / S), '{C}')
                else:
                    el = elemento('path', dict(d=elipse_d(X, Y, erx / S, ery / S, eang)), '{C}')
            cands.append((iou, 4, dif / max(1.0, np.pi * (ew + eh) / 2), 'el', el, None, P))
    # 4) intersección de dos discos (anillo de degradado radial recortado por el círculo exterior)
    if (not cands or o.get('_lente_siempre')) and min(a, b) >= o['lente_min'] * S:
        p = c.reshape(-1, 2).astype(np.float64) - 0.5  # coordenadas continuas (centro del píxel, sin pad)
        p = p[:: max(1, len(p) // 600)]
        tol = o['lente_tol'] * S
        A, inA = _ransac_circulo(p, tol)
        if A is not None and 0.25 < inA.mean() < 0.97 and (~inA).sum() >= 10:
            B, inB = _ransac_circulo(p[~inA], tol)
            if B is not None and (inA.sum() + inB.sum()) >= o.get('lente_cobertura', 0.95) * len(p):
                L = _lente(A, B)
                if L is not None:
                    ini, seg = L
                    PL = _poli_de_segmentos(ini, seg)
                    iou, dif = _iou_poli(sb, PL, f)
                    if iou >= o['lente_iou']:
                        cands.append((iou, 1 + 3 * len(seg), 0, 'path', _d_segmentos(ini, seg, S, ox, oy), None, PL))
    if not cands:
        return None
    # la píldora le gana a la elipse solo si su IoU es claramente mejor (T9); si no, gana el de mayor IoU
    pil = [x for x in cands if x[1] == 7]
    eli = [x for x in cands if x[3] == 'el']
    if pil and eli:
        if pil[0][0] >= eli[0][0] + o['pildora_margen']:
            cands.remove(eli[0])
        else:
            cands.remove(pil[0])
    best = max(cands, key=lambda x: x[0])
    if o.get('_poligono'):
        return best[6]
    if best[1] == 5:
        return ('barra', best[4], best[5])
    return ('el' if best[3] == 'el' else 'path', best[4])


def invertir_agujereadas(mascaras, S, min_huecos=8, min_frac=0.03, min_hueco=1.0, cierre=2.5, alargados=0.6):
    """H20b (r3): reescritura del apilado, equivalente píxel a píxel, para una capa con muchos huecos rellenos por
    capas de DEBAJO (orden z invertido: p. ej. el claro de un panel de franjas encima de las franjas).

    `mascaras`: máscaras bool de abajo hacia arriba. Para cada capa T (de arriba hacia abajo) con ≥ `min_huecos`
    huecos de área ≥ (min_hueco·S)² que suman ≥ `min_frac` de T y que están cubiertos por las capas de debajo
    (hueco = agujero cerrado o muesca de menos de 2·`cierre`·S de ancho: lo que llena un cierre morfológico):
      - T se rellena (T ∪ Hc, Hc = huecos cubiertos) y se queda en su sitio;
      - encima de T se ponen copias de las capas de debajo recortadas a Hc, en el mismo orden (así se ve lo mismo);
      - en cada hueco, la copia más baja presente ocupa el hueco entero (las demás quedan encima, igual que antes).
    Las capas de debajo no cambian (quedan tapadas en Hc; `simplificar_ocultas` las alisa después).
    Devuelve una lista de (índice de la capa original, máscara): las copias repiten el índice (mismo color).
    Sin capas así, devuelve la pila tal cual."""
    from scipy import ndimage as ndi
    pila = [(i, m) for i, m in enumerate(mascaras)]
    if len(pila) < 2:
        return pila
    k = len(pila) - 1
    while k >= 1:
        i, T = pila[k]
        if not T.any():
            k -= 1
            continue
        H = ndi.binary_fill_holes(T)
        if cierre:
            r = max(1, int(round(cierre * S)))
            disco = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1,) * 2)
            H |= cv2.morphologyEx(np.pad(T, r).astype(np.uint8), cv2.MORPH_CLOSE, disco)[r:-r, r:-r] > 0
        H &= ~T
        if not H.any():
            k -= 1
            continue
        abajo = np.zeros_like(T)
        for _, m in pila[:k]:
            abajo |= m
        Hc = H & abajo
        nh, ch, sth, _ = cv2.connectedComponentsWithStats(Hc.astype(np.uint8), connectivity=8)
        grandes = np.where(sth[1:, cv2.CC_STAT_AREA] >= (min_hueco * S) ** 2)[0] + 1
        if len(grandes) < min_huecos or Hc.sum() < min_frac * T.sum():
            k -= 1
            continue
        # solo tramas: la mayoría de los huecos son guiones alargados (aspecto ≥ 3), que luego salen como barras;
        # los huecos de un personaje (bocas, botones, entrantes) no se tocan
        n_al = 0
        for g in grandes:
            pts = np.c_[np.nonzero(ch == g)][:, ::-1].astype(np.float32)
            (_, _), (w_, h_), _ = cv2.minAreaRect(pts)
            n_al += max(w_, h_) + 1 >= 3 * (min(w_, h_) + 1)
        if n_al < alargados * len(grandes):
            k -= 1
            continue
        # color visible de cada píxel de Hc (la capa de debajo más alta presente)
        vis = np.full(T.shape, -1, np.int32)
        for p_, (j, m) in enumerate(pila[:k]):
            vis[m & Hc] = p_
        # cada hueco lo ocupa entero su color dominante (base); los trozos visibles de los demás colores van encima
        dom = np.full(nh, -1, np.int32)
        sel = Hc & (vis >= 0)
        if sel.any():
            cnt = np.zeros((nh, k), np.int64)
            np.add.at(cnt, (ch[sel], vis[sel]), 1)
            dom = cnt.argmax(1)
            dom[cnt.sum(1) == 0] = -1
        dom[0] = -1
        base, trozos = [], []
        for p_, (j, m) in enumerate(pila[:k]):
            ids = np.nonzero(dom == p_)[0]
            if len(ids):
                base.append((j, np.isin(ch, ids)))
            t = (vis == p_) & Hc & ~np.isin(ch, ids) if len(ids) else (vis == p_) & Hc
            if t.any():
                trozos.append((j, t))
        copias = base + trozos
        pila = pila[:k] + [(i, T | Hc)] + copias + pila[k + 1:]
        k -= 1
    return pila


def anidar_radiales(mascaras, S, min_colores=3, tol_hueco=2.0, min_prim=0.75, area_max=None, o=None):
    """H20c (r3): anillos concéntricos (degradado radial cuantizado). Para cada componente conexa Q de la región del
    grupo cuyos colores visibles forman una familia anidada (ordenados de dentro hacia fuera por su profundidad
    media en Q, cada unión acumulada D_k = colores ≤ k es una sola mancha sin huecos), reemplaza esos trozos por
    las uniones D_k apiladas de mayor a menor (encima de todo): el raster es el mismo y cada D_k es un disco o la
    intersección de dos discos, que `primitiva_v2` emite con ≤ 13 nodos en vez de un anillo dentado. Solo se
    aplica si al menos `min_prim` de las D_k salen como primitivas (si no, son capas anidadas normales: borde y
    relleno de una aleta, etc., y se dejan como estaban).
    `mascaras`: de abajo hacia arriba. Devuelve [(índice de la capa original, máscara)]."""
    from scipy import ndimage as ndi
    n = len(mascaras)
    pila = [(i, m) for i, m in enumerate(mascaras)]
    if n < min_colores:
        return pila
    vis = np.full(mascaras[0].shape, -1, np.int32)
    for i, m in enumerate(mascaras):
        vis[m] = i
    region = vis >= 0
    nq, cq, stq, _ = cv2.connectedComponentsWithStats(region.astype(np.uint8), connectivity=8)
    nuevas = []
    quitar = np.zeros_like(region)
    for q in range(1, nq):
        bx, by, bw, bh = stq[q, :4]
        if stq[q, cv2.CC_STAT_AREA] < (8 * S) ** 2:
            continue
        sl = (slice(max(0, by - 2), by + bh + 2), slice(max(0, bx - 2), bx + bw + 2))
        Q = cq[sl] == q
        v = vis[sl]
        cols, cnt = np.unique(v[Q], return_counts=True)
        cols = cols[cnt >= (tol_hueco * S) ** 2]
        if len(cols) < min_colores:
            continue
        prof = cv2.distanceTransform(np.pad(Q, 1).astype(np.uint8), cv2.DIST_L2, 5)[1:-1, 1:-1]
        orden = sorted(cols, key=lambda c: -float(prof[Q & (v == c)].mean()))
        acum = np.zeros_like(Q)
        Ds = []
        ok = True
        for c in orden:
            acum = acum | (Q & (v == c))
            D = ndi.binary_fill_holes(acum)
            hueco = (D & ~acum).sum()
            nc = cv2.connectedComponents(D.astype(np.uint8), connectivity=8)[0] - 1
            if nc != 1 or hueco > (tol_hueco * S) ** 2:
                ok = False
                break
            Ds.append((c, D))
        if not ok:
            continue
        # cada D_k se ajusta con umbrales algo más laxos (la familia anidada ya es evidencia de un degradado radial)
        # y, si ajusta, se redibuja como su primitiva (el trazado normal la reconoce luego con IoU ≈ 1)
        o2 = {**PRIMITIVAS_V2, **(o or {})}
        o2.update(disco_iou=o2['radial_disco_iou'], lente_iou=o2['radial_lente_iou'], lente_tol=o2['radial_tol'],
                  _poligono=True, _lente_siempre=True, lente_cobertura=0.88)
        Ds = Ds[:-1] + [(Ds[-1][0], ndi.binary_fill_holes(Q))]
        n_prim = 0
        limpias = []
        tope = ndi.binary_dilation(Q, iterations=S)
        for c, D in reversed(Ds):  # de fuera hacia dentro: cada D_k queda dentro de la de fuera ya ajustada
            ys, xs = np.nonzero(D)
            y0, x0 = ys.min(), xs.min()
            P = primitiva_v2(D[y0:ys.max() + 1, x0:xs.max() + 1], S, 0, 0, area_max=area_max, o=o2)
            if P is not None:
                n_prim += 1
                z = np.zeros(D.shape, np.uint8)
                cv2.fillPoly(z, [np.round((np.asarray(P) + [x0, y0] - 0.5) * 8).astype(np.int32)], 1,
                             lineType=cv2.LINE_8, shift=3)
                D = (z > 0) & tope
            if c == Ds[-1][0]:
                tope = D
            limpias.append((c, D))
        if n_prim < min_prim * len(Ds):
            continue
        Ds = limpias[::-1]
        full = lambda D: _pegar(D, sl, region.shape)
        for c, D in reversed(Ds):
            nuevas.append((int(c), full(D)))
        quitar |= full(Q)
    if not nuevas:
        return pila
    pila = [(i, m & ~quitar) for i, m in pila]
    return pila + nuevas


def _pegar(D, sl, shape):
    z = np.zeros(shape, bool)
    z[sl] = D
    return z
