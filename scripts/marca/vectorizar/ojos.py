"""Ojos como primitivas: aro (borde), esclera, iris, pupila y brillos; debajo queda piel lisa.

Detección automática: componentes claros (esclera) casi elípticos que contienen una mancha oscura (iris).
Se ajusta cada pieza (círculo/elipse) y el ojo se emite como <g id="ojo-izq|der" data-centro data-radio>,
compatible con scripts/lottie/humano-personaje.mjs (parpadeo escalando el grupo).
"""
import cv2
import numpy as np
from scipy import ndimage as ndi

from . import trazado
from .capas import mayor
from .trazado import fmt


def _elipse(m):
    cont, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cont, key=len)
    if len(c) < 6:
        return None
    (cx, cy), (w, h), a = cv2.fitEllipse(c)
    return cx, cy, (w + 1) / 2, (h + 1) / 2, a


def _mask_elipse(shape, e, extra=0.0):
    cx, cy, rx, ry, a = e
    z = np.zeros(shape, np.uint8)
    cv2.ellipse(z, ((cx, cy), (2 * (rx + extra), 2 * (ry + extra)), a), 1, -1)
    return z > 0


def _iou(a, b):
    return (a & b).sum() / max(1, (a | b).sum())


def _prim(e, S, color, idattr=''):
    cx, cy, rx, ry, a = e
    if abs(rx - ry) / max(rx, ry) < 0.07:
        return f'<circle{idattr} cx="{fmt(cx / S)}" cy="{fmt(cy / S)}" r="{fmt((rx + ry) / 2 / S)}" fill="#{color}"/>'
    a %= 180
    if min(a, 180 - a) < 4 or abs(a - 90) < 4:
        if abs(a - 90) < 4:
            rx, ry = ry, rx
        return (f'<ellipse{idattr} cx="{fmt(cx / S)}" cy="{fmt(cy / S)}" rx="{fmt(rx / S)}" ry="{fmt(ry / S)}" '
                f'fill="#{color}"/>')
    return f'<path{idattr} d="{trazado.elipse_d(cx / S, cy / S, rx / S, ry / S, a)}" fill="#{color}"/>'


def _circulo_ransac(vis, S, it=300):
    """Círculo que mejor explica el borde de la parte visible del ojo (el tramo tapado es una cuerda)."""
    cont, _ = cv2.findContours(vis.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not cont:
        return None
    P = max(cont, key=len)[:, 0].astype(float)
    if len(P) < 12:
        return None
    rng = np.random.default_rng(0)
    tol = max(0.75 * S, 0.04 * np.sqrt(vis.sum() / np.pi))
    best, bi = None, None
    for _ in range(it):
        a, b, c = P[rng.choice(len(P), 3, replace=False)]
        d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]))
        if abs(d) < 1e-6:
            continue
        ux = ((a @ a) * (b[1] - c[1]) + (b @ b) * (c[1] - a[1]) + (c @ c) * (a[1] - b[1])) / d
        uy = ((a @ a) * (c[0] - b[0]) + (b @ b) * (a[0] - c[0]) + (c @ c) * (b[0] - a[0])) / d
        r = np.hypot(a[0] - ux, a[1] - uy)
        if r > 0.75 * max(vis.shape) or r < 2 * S:
            continue
        inl = np.abs(np.hypot(P[:, 0] - ux, P[:, 1] - uy) - r) < tol
        if best is None or inl.sum() > best:
            best, bi = inl.sum(), inl
    if best is None or best < 0.4 * len(P):
        return None
    Q = P[bi]
    A = np.c_[2 * Q[:, 0], 2 * Q[:, 1], np.ones(len(Q))]
    cx, cy, k = np.linalg.lstsq(A, (Q ** 2).sum(1), rcond=None)[0]
    r = np.sqrt(k + cx ** 2 + cy ** 2) + 0.5
    return cx, cy, r, r, 0.0


def _candidatos_v2(blanco, oscuro, fill, cls, oscuras, fig, S, pintura, rmax=25):
    """Candidatos a ojo con umbrales relativos (compuertas v2).

    - área mínima 0.0004·área de la figura (en vez de (3S)²·3, pensada para la hoja a tamaño completo);
    - el ojo es la esclera MÁS el iris de relleno que la toca (en recortes reducidos el iris y el contorno
      marrón muerden la esclera y su casco convexo deja de ser una elipse): unión, cierre de 1·S y casco;
    - el contorno del ojo se ajusta con un círculo RANSAC (la parte tapada por el párpado o el cachete es
      una cuerda que no cuenta); lo tapado se redibuja encima como "párpado" con los colores de la referencia;
    - se descartan los candidatos contenidos en otro.
    """
    H, W = blanco.shape
    area_fig = max(1, int(fig.sum()))
    amin = max(0.0004 * area_fig, (1.5 * S) ** 2 * 3)
    amax = min((40 * S) ** 2 * 3, 0.03 * area_fig)
    iris_fill = np.isin(cls, oscuras) & fill
    disco = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * S + 1,) * 2)
    cc, n = ndi.label(blanco)
    cands = []
    for i in range(1, n + 1):
        m = cc == i
        a = m.sum()
        if a < amin or a > amax:
            continue
        ys, xs = np.nonzero(m)
        r = int(max(S, 0.5 * np.sqrt(a / np.pi)))
        pad = int(2.2 * np.sqrt(a / np.pi)) + 6 * S  # el círculo (con lo tapado) y su anillo caben en el recorte
        y0, y1 = max(0, ys.min() - pad), min(H, ys.max() + 1 + pad)
        x0, x1 = max(0, xs.min() - pad), min(W, xs.max() + 1 + pad)
        sub = m[y0:y1, x0:x1]
        cerca = ndi.binary_dilation(sub, iterations=r)
        u = sub | (iris_fill[y0:y1, x0:x1] & cerca)
        u = cv2.morphologyEx(u.astype(np.uint8), cv2.MORPH_CLOSE, disco) > 0
        lab_u, _ = ndi.label(u)
        u = lab_u == np.bincount(lab_u[sub]).argmax()
        if u.sum() > 3 * a:  # el "iris" es una mancha oscura grande: no es un ojo
            continue
        vis = ndi.binary_fill_holes(u)
        osc = oscuro[y0:y1, x0:x1] & vis
        if osc.sum() < 0.08 * vis.sum():
            continue
        e = _circulo_ransac(vis, S)
        # v2 es para ojos pequeños (recortes reducidos), donde fallan los umbrales absolutos de v1; los
        # grandes que v1 no acepta suelen ser no circulares (ojo de huevo de ceti-04) y el trazado los copia mejor
        if e is None or e[2] > rmax * S:
            continue
        disco_e = _mask_elipse(vis.shape, e)
        # la parte visible cabe en el círculo y es al menos ~media circunferencia (el resto lo tapa
        # un párpado o el cachete, que se redibuja encima)
        if (vis & ~_mask_elipse(vis.shape, e, S)).sum() > 0.05 * vis.sum():
            continue
        if vis.sum() < 0.45 * disco_e.sum():
            continue
        # lo que tapa el ojo (párpado, cachete, contorno de la cara): códigos del entorno del círculo
        # conectados con el exterior. El ojo es el círculo menos eso; lo tapado se redibuja encima.
        psub = pintura[y0:y1, x0:x1]
        dentro = _mask_elipse(vis.shape, e, 0.5 * S)
        # el anillo de muestreo (1.5S..3S) da los colores del entorno; el de conexión llega hasta el círculo
        anillo = _mask_elipse(vis.shape, e, 3 * S) & ~_mask_elipse(vis.shape, e, 1.5 * S) & (psub >= 0)
        puente = _mask_elipse(vis.shape, e, 3 * S) & ~disco_e & (psub >= 0)
        occ = np.zeros(vis.shape, bool)
        if anillo.any():
            vals, cnt = np.unique(psub[anillo], return_counts=True)
            sur = [int(v) for v, nn in zip(vals, cnt) if nn >= 0.1 * anillo.sum()]
            cand = np.isin(psub, sur) & dentro & ~sub & ~iris_fill[y0:y1, x0:x1]
            lab_o, _ = ndi.label(cand | (puente & np.isin(psub, sur)))
            toca = np.unique(lab_o[anillo])
            occ = np.isin(lab_o, toca[toca > 0]) & cand
        # sin bordes finos de piel en el canto del círculo: solo lo que tapa de verdad
        occ = ndi.binary_opening(occ, iterations=S) & occ
        if (occ & disco_e).sum() < 0.015 * disco_e.sum():
            occ[:] = False
        E = disco_e & ~occ
        if occ.any():
            E = mayor(ndi.binary_opening(E, iterations=S))
        E = ndi.binary_fill_holes(E)
        if occ.any():
            # todo lo del círculo que no es ojo se redibuja (sin rendijas blancas entre piezas)
            occ = (occ | (disco_e & ~E)) & ~E
        cands.append(dict(box=(y0, y1, x0, x1), E=E, e=e, area=int(disco_e.sum()), occ=occ))
    # sin duplicados: un candidato cuyo centro cae dentro de otro mayor es el mismo ojo
    cands.sort(key=lambda c: -c['area'])
    out = []
    for c in cands:
        cy, cx = c['box'][0] + c['e'][1], c['box'][2] + c['e'][0]
        if any(o['box'][0] <= cy < o['box'][1] and o['box'][2] <= cx < o['box'][3]
               and o['E'][int(cy) - o['box'][0], int(cx) - o['box'][2]] for o in out):
            continue
        out.append(c)
    return out


def _parpado(sub, occ, e, t, S, hex_codigo, y0, x0, H, W, crece=0):
    """Lo que tapa el círculo del ojo (párpado, cachete), con los colores de la referencia, encima del ojo.

    Las piezas diminutas se funden con el código vecino más cercano (sin motas ni rendijas); cada pieza se
    mete un poco bajo las siguientes, de mayor a menor."""
    # el borde del círculo junto a lo que tapa también se cubre (si no, asoma una astilla blanca)
    # (v3, crece > 0: el anillo del canto solo junto a la tapa, sin uña naranja que suba por el borde del ojo)
    tapa = ndi.binary_dilation(occ, iterations=S if crece else 2 * S) & _mask_elipse(occ.shape, e, t + S) & (sub >= 0)
    tapa &= occ | ~_mask_elipse(occ.shape, e, t - 0.5 * S)
    if tapa.sum() < (S ** 2) * 6:
        return []
    cod = np.where(tapa, sub, -1)
    cod[tapa & (sub < 0)] = -2
    vals, cnt = np.unique(cod[tapa], return_counts=True)
    buenos = [int(v) for v, nn in zip(vals, cnt) if v >= 0 and nn >= 6 * S * S]
    if not buenos:
        return []
    ok = np.isin(cod, buenos)
    _, (iy, ix) = ndi.distance_transform_edt(~ok, return_indices=True)
    cod = np.where(tapa, cod[iy, ix], -1)
    out = []
    orden = sorted(buenos, key=lambda v: -(cod == v).sum())
    for j, v in enumerate(orden):
        m = cod == v
        if j == 0:
            m = cod >= 0  # la pieza mayor es la base de todo lo tapado: las finas que potrace pierda no dejan hueco
            if crece:
                # v3: la base entra un poco en el ojo (sin uñas blancas en las puntas del corte tras potrace)
                m = ndi.binary_dilation(m, iterations=crece) & _mask_elipse(m.shape, e, t + S)
        elif j < len(orden) - 1:
            m = m | (ndi.binary_dilation(m, iterations=max(1, S // 2)) & np.isin(cod, orden[j + 1:]))
        full = np.zeros((H, W), bool)
        full[y0:y0 + sub.shape[0], x0:x0 + sub.shape[1]] = trazado.suavizar(m, 1.0)
        d = trazado.potrace_d(full, S, opttol=0.4)
        if d:
            out.append(f'<path class="parpado" d="{d}" fill="#{hex_codigo(v)}"/>')
    return out



# ============================================================================ ojos v3 (r2, flag ojos_v3)
def _circulo_pts(P, S, rmin, rmax, it=300):
    """Círculo RANSAC + mínimos cuadrados sobre puntos (x, y); el tramo que no es del círculo (mordida del
    brillo, cuerda tapada) queda fuera como atípico. Devuelve (cx, cy, r) o None."""
    if len(P) < 12:
        return None
    rng = np.random.default_rng(0)
    r0 = np.sqrt(((P - P.mean(0)) ** 2).sum(1)).mean()
    tol = max(0.6 * S, 0.04 * r0)
    best, bi = None, None
    for _ in range(it):
        a, b, c = P[rng.choice(len(P), 3, replace=False)]
        d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]))
        if abs(d) < 1e-6:
            continue
        ux = ((a @ a) * (b[1] - c[1]) + (b @ b) * (c[1] - a[1]) + (c @ c) * (a[1] - b[1])) / d
        uy = ((a @ a) * (c[0] - b[0]) + (b @ b) * (a[0] - c[0]) + (c @ c) * (b[0] - a[0])) / d
        r = np.hypot(a[0] - ux, a[1] - uy)
        if r < rmin or r > rmax:
            continue
        inl = np.abs(np.hypot(P[:, 0] - ux, P[:, 1] - uy) - r) < tol
        if best is None or inl.sum() > best:
            best, bi = inl.sum(), inl
    if best is None or best < 0.5 * len(P):
        return None
    Q = P[bi]
    A = np.c_[2 * Q[:, 0], 2 * Q[:, 1], np.ones(len(Q))]
    cx, cy, k = np.linalg.lstsq(A, (Q ** 2).sum(1), rcond=None)[0]
    return cx, cy, np.sqrt(k + cx ** 2 + cy ** 2)


def _brillos_v3(Lp, sub, sub_cls, claras, oscs, iris, E, icx, icy, ir, S, Lc_):
    """Brillos v3: componentes MUCHO más claras que el iris (L > L_iris + 35) dentro del círculo del iris,
    aunque toquen la esclera (la mordida clásica del brillo en el borde del iris). El brillo se emite como
    el círculo que ajusta su frontera con el iris (fuera del iris cae sobre la esclera, del mismo blanco).
    Devuelve [(cx, cy, rx, ry, ang, code)] en coordenadas del recorte."""
    L_iris = float(np.median(Lp[iris])) if iris.any() else 40.0
    claro = (((Lp > L_iris + 35) | np.isin(sub_cls, claras)) & (sub >= 0))
    circ = _mask_elipse(E.shape, (icx, icy, ir, ir, 0))
    dentro = _mask_elipse(E.shape, (icx, icy, max(S, ir - 0.75 * S), max(S, ir - 0.75 * S), 0))
    amin = (0.5 * S) ** 2 * 3
    lb, nb = ndi.label(claro & dentro)
    out = []
    for b in range(1, nb + 1):
        bm = lb == b
        a = bm.sum()
        if a < amin or a > 0.35 * circ.sum():
            continue
        # rodeado (dentro del círculo) sobre todo de iris/pupila, no de esclera
        ring = ndi.binary_dilation(bm, iterations=2) & ~bm & dentro
        if ring.sum() == 0 or (oscs & ring).sum() < 0.4 * ring.sum():
            continue
        # máscara completa del brillo dentro del círculo del iris (el componente cortado más su borde)
        bfull = claro & circ & ndi.binary_dilation(bm, iterations=max(1, S))
        cods, cnts = np.unique(sub[bm & (sub >= 0)], return_counts=True)
        # el más claro de los códigos con peso (la paleta a veces parte el brillo en blanco y crema)
        fuertes = [int(c_) for c_, n_ in zip(cods, cnts) if n_ >= 0.2 * cnts.sum() and c_ % 2 == 1]
        code = max(fuertes, key=lambda c_: Lc_[c_ // 2]) if fuertes else int(cods[np.argmax(cnts)])
        borde = np.argwhere(ndi.binary_dilation(bfull, iterations=1) & ~bfull & oscs)[:, ::-1].astype(float)
        res = None
        if len(borde) >= 10:
            A = np.c_[2 * borde[:, 0], 2 * borde[:, 1], np.ones(len(borde))]
            bx, by, kk = np.linalg.lstsq(A, (borde ** 2).sum(1), rcond=None)[0]
            rb = np.sqrt(max(0.0, kk + bx ** 2 + by ** 2)) - 0.5
            if 0.5 * S <= rb <= 0.6 * ir:
                mb = _mask_elipse(E.shape, (bx, by, rb, rb, 0))
                fuera_ojo = (mb & ~circ & ~E).sum()
                bien = (mb & circ & claro).sum() >= 0.6 * max(1, (mb & circ).sum())
                if fuera_ojo <= 0.05 * mb.sum() and bien:
                    res = (bx, by, rb, rb, 0.0, code)
        if res is None:
            be = _elipse(bfull) if bfull.sum() >= 6 else None
            if be:
                res = (*be, code)
        if res is not None and np.pi * res[2] * res[3] >= 5 * S * S:  # < ~4 px² de referencia: mota
            out.append(res)
    return out


def _candidatos_mini(blanco, Lfull, fig, S, pintura, rmax):
    """Ojos en miniatura (radio < rmax): la paleta suele convertir el iris diminuto en línea (código de borde
    de la piel) y los detectores normales no ven 'oscuro'. Aquí: círculo RANSAC del contorno del blanco
    (la media luna; su arco exterior es el del ojo) y el iris se mide en la LUMINANCIA de la referencia."""
    H, W = blanco.shape
    cc, n = ndi.label(blanco)
    out = []
    for i in range(1, n + 1):
        m = cc == i
        a = m.sum()
        if a < (1.2 * S) ** 2 * 3 or a > np.pi * rmax ** 2:
            continue
        ys, xs = np.nonzero(m)
        pad = int(rmax + 3 * S)
        y0, y1 = max(0, ys.min() - pad), min(H, ys.max() + 1 + pad)
        x0, x1 = max(0, xs.min() - pad), min(W, xs.max() + 1 + pad)
        sub = m[y0:y1, x0:x1]
        cont, _ = cv2.findContours(sub.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        P = max(cont, key=len)[:, 0].astype(float)
        rc = _circulo_pts(P, S, 1.5 * S, rmax)
        if rc is None:
            continue
        cx, cy, r = rc
        r += 0.5
        disco = _mask_elipse(sub.shape, (cx, cy, r, r, 0))
        if (sub & ~_mask_elipse(sub.shape, (cx, cy, r + S, r + S, 0))).sum() > 0.1 * a:
            continue
        if a < 0.2 * disco.sum():
            continue
        Lp = Lfull[y0:y1, x0:x1, 0].astype(np.float32)
        Lw = float(np.median(Lp[sub]))
        resto = disco & ~sub & (pintura[y0:y1, x0:x1] >= 0)
        if resto.sum() < 0.12 * disco.sum():
            continue
        osc = resto & (Lp < Lw - 30)
        if osc.sum() < 0.6 * resto.sum():
            continue
        out.append(dict(box=(y0, y1, x0, x1), E=disco, e=(cx, cy, r, r, 0.0), area=int(disco.sum()),
                        mini=True, osc=osc, blanco=sub))
    return out


def _mini_piezas(c, Lfull, C, S, hex_codigo, x0, y0, sub):
    """Modelo mínimo del ojo en miniatura: esclera + iris + pupila (sin aro ni brillo, que serían motas).
    Colores: la clase de la paleta más cercana a la media Lab de cada zona en la referencia."""
    e, E, osc = c['e'], c['E'], c['osc']
    y0b, y1b, x0b, x1b = c['box']
    Lab = Lfull[y0b:y1b, x0b:x1b].astype(np.float32)

    def code_de(mask):
        mlab = Lab[mask].mean(0)
        return 2 * int(np.argmin(((C - mlab) ** 2).sum(-1))) + 1

    blanco_c = c['blanco']
    esc_code = int(np.bincount(sub[blanco_c & (sub >= 0)]).argmax())
    piezas = [_prim((e[0] + x0, e[1] + y0, e[2], e[3], 0), S, hex_codigo(esc_code))]
    ys, xs = np.nonzero(osc)
    icx, icy = xs.mean(), ys.mean()
    ir = min(np.sqrt(osc.sum() / np.pi) + 0.25 * S, 0.85 * e[2])
    # el iris no sale del ojo
    dd = np.hypot(icx - e[0], icy - e[1])
    if dd + ir > e[2]:
        f = max(0.0, e[2] - ir) / max(dd, 1e-6)
        icx, icy = e[0] + (icx - e[0]) * f, e[1] + (icy - e[1]) * f
    piezas.append(_prim((icx + x0, icy + y0, ir, ir, 0), S, hex_codigo(code_de(osc))))
    Lp = Lab[..., 0]
    Li = float(np.median(Lp[osc]))
    pup = osc & (Lp < Li - 8)
    if pup.sum() >= 0.15 * osc.sum() and pup.sum() >= (0.8 * S) ** 2 * 3:
        ys, xs = np.nonzero(pup)
        pr = min(np.sqrt(pup.sum() / np.pi), 0.7 * ir)
        px, py = xs.mean(), ys.mean()
        d2 = np.hypot(px - icx, py - icy)
        if d2 + pr > ir:
            f = max(0.0, ir - pr) / max(d2, 1e-6)
            px, py = icx + (px - icx) * f, icy + (py - icy) * f
        piezas.append(_prim((px + x0, py + y0, pr, pr, 0), S, hex_codigo(code_de(pup))))
    # sin brillo: a este tamaño (≈1 px de referencia) el puntaje lo cuenta como mota (probado: S3 L 1 → 0.71)
    return piezas


def _iris_por_color(sub, E, semilla, oscs, claras, oscuras, Lc, croma, S, min_ext=1.3, Lsub=None, C=None):
    """H19 (3), pedido de paleta (N13 de R6): el iris no tiene por qué ser oscuro (dorado L 54–62).

    Iris = clases de relleno dentro de la esclera `E` con L ≥ 20 por debajo de la esclera o croma > 30, que no
    sean claras, ni oscuras (esas son la semilla: la pupila), ni dominen el anillo de fuera del ojo (piel,
    párpado), unidas a la semilla oscura. Solo cuenta si el iris así crece ≥ `min_ext` veces la semilla.
    Devuelve (iris, píxeles de iris de color, código del iris, código de la pupila = el dominante en la
    semilla) o None. El código del iris es el de la clase más cercana (Lab) a la mediana del original en el anillo
    de color (así los dos ojos salen del mismo tono aunque la paleta reparta el anillo en dos clases); sin `Lsub`,
    el dominante.
    """
    cls = np.where(sub >= 0, sub // 2, -1)
    esc = cls[E & np.isin(cls, claras)]
    if not len(esc):
        return None
    L_esc = Lc[np.bincount(esc).argmax()]
    fuera = ndi.binary_dilation(E, iterations=3 * S) & ~E & (sub >= 0)
    vals, cnt = np.unique(cls[fuera], return_counts=True)
    entorno = {int(v) for v, nn in zip(vals, cnt) if nn >= 0.1 * max(1, fuera.sum())}
    dentro = np.unique(cls[E & (sub >= 0)])
    cand = [int(c) for c in dentro if c >= 0 and c not in claras and c not in oscuras and c not in entorno
            and (Lc[c] <= L_esc - 20 or croma[c] > 30)]
    if not cand:
        return None
    q = np.isin(cls, cand) & E & (sub >= 0) & (sub % 2 == 1)
    if not q.any():
        return None
    disco = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * S + 1,) * 2)
    u = cv2.morphologyEx((q | semilla).astype(np.uint8), cv2.MORPH_CLOSE, disco) > 0
    u &= E
    lab_u, _ = ndi.label(u)
    ids = np.unique(lab_u[semilla])
    iris = ndi.binary_fill_holes(np.isin(lab_u, ids[ids > 0]))
    q &= iris
    if iris.sum() < min_ext * semilla.sum() or q.sum() < 0.25 * iris.sum():
        return None
    iris_code = int(np.bincount(sub[q]).argmax())
    if Lsub is not None and C is not None:
        med = np.median(Lsub[q].reshape(-1, 3), 0)
        cods = [int(c_) for c_ in np.unique(sub[q]) if (sub[q] == c_).sum() >= 0.1 * q.sum()]
        iris_code = min(cods, key=lambda c_: float(((C[c_ // 2] - med) ** 2).sum()))
    sem = semilla & oscs & (sub >= 0)
    pupila = int(np.bincount(sub[sem]).argmax()) if sem.any() else iris_code
    return iris, q, iris_code, pupila, (med, cods) if Lsub is not None and C is not None else None


def _cerca(a, b):
    ay, ax = a['box'][0] + a['e'][1], a['box'][2] + a['e'][0]
    by, bx = b['box'][0] + b['e'][1], b['box'][2] + b['e'][0]
    return np.hypot(ax - bx, ay - by) < 0.5 * max(a['e'][2], a['e'][3])


def detectar_ojos(k, cfg, pintura, hex_codigo, log):
    S, C, L = k.S, k.C, k.L
    H, W = pintura.shape
    Lc = C[:, 0]
    croma = np.hypot(C[:, 1], C[:, 2])
    claras = [c for c in range(len(C)) if Lc[c] > 85 and croma[c] < 14]
    oscuras = [c for c in range(len(C)) if Lc[c] < 52]
    zona = np.zeros((H, W), bool)
    if isinstance(cfg['ojos'], dict) and cfg['ojos'].get('zona'):
        x0, y0, x1, y1 = [int(v * S) for v in cfg['ojos']['zona']]
        zona[y0:y1, x0:x1] = True
    else:
        zona[:] = k.fig
    fill = pintura % 2 == 1
    cls = np.where(pintura >= 0, pintura // 2, -1)
    blanco = np.isin(cls, claras) & fill & zona
    oscuro = np.isin(cls, oscuras) & (pintura >= 0)
    cc, n = ndi.label(blanco)
    cands = []
    for i in range(1, n + 1):
        m = cc == i
        a = m.sum()
        if a < (3 * S) ** 2 * 3 or a > (40 * S) ** 2 * 3:
            continue
        ys, xs = np.nonzero(m)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        pad = int(6 * S)
        y0, x0 = max(0, y0 - pad), max(0, x0 - pad)
        y1, x1 = min(H, y1 + pad), min(W, x1 + pad)
        sub = m[y0:y1, x0:x1]
        hull = cv2.convexHull(np.argwhere(sub)[:, ::-1].astype(np.int32))
        E = np.zeros(sub.shape, np.uint8)
        cv2.fillConvexPoly(E, hull, 1)
        E = E > 0
        osc = oscuro[y0:y1, x0:x1] & E
        if osc.sum() < 0.08 * E.sum():
            continue
        e = _elipse(E)
        if e is None or _iou(_mask_elipse(E.shape, e), E) < 0.88:
            continue
        cands.append(dict(box=(y0, y1, x0, x1), E=E, e=e, area=E.sum()))
    exp = cfg.get('experimentos') or {}
    cg = exp.get('capas_geometricas')
    iris_on = bool(cg) and (not isinstance(cg, dict) or bool(cg.get('iris')))
    v2 = exp.get('compuertas_v2', True)
    v3 = bool(exp.get('ojos_v3'))
    if len(cands) < 2 and v2:
        c2 = _candidatos_v2(blanco, oscuro, fill, cls, oscuras, k.fig, S, pintura)
        log(f'ojos: v1 {len(cands)} candidatos, v2 {len(c2)}')
        if len(c2) >= 2:
            cands = c2
    elif v3 and len(cands) >= 2:
        # v3 (C5): un ojo de v1 cuya parte de abajo tapa la mejilla se ajustaba como elipse del casco convexo
        # (deformada). Si v2 ve el mismo ojo como círculo con una tapa importante, se usa v2 (círculo + tapa).
        c2 = _candidatos_v2(blanco, oscuro, fill, cls, oscuras, k.fig, S, pintura, rmax=40)
        nuevos = []
        for c in cands:
            alt = [o for o in c2 if _cerca(o, c)
                   and (o['occ'] & _mask_elipse(o['E'].shape, o['e'])).sum() >= 0.03 * o['area']]
            nuevos.append(alt[0] if alt else c)
        if any('occ' in c for c in nuevos):
            log(f'ojos v3: {sum("occ" in c for c in nuevos)} ojo(s) con tapa de mejilla')
        cands = nuevos
    if len(cands) < 2 and v3:
        cm = _candidatos_mini(blanco, k.L, k.fig, S, pintura, rmax=4 * S)
        # solo pares que parecen un par de ojos (misma altura, tamaño parecido, separados unos pocos radios):
        # sin esto, dos estrellas lejanas de una escena (R8) pasaban por ojos
        def _par_ok(a, b):
            ra, rb = a['e'][2], b['e'][2]
            dx = abs((a['box'][2] + a['e'][0]) - (b['box'][2] + b['e'][0]))
            dy = abs((a['box'][0] + a['e'][1]) - (b['box'][0] + b['e'][1]))
            return max(ra, rb) / min(ra, rb) < 1.5 and dy <= max(ra, rb) and 2.5 * max(ra, rb) <= dx <= 15 * max(ra, rb)
        ok = set()
        for i in range(len(cm)):
            for j in range(i + 1, len(cm)):
                if _par_ok(cm[i], cm[j]):
                    ok |= {i, j}
        cm = [cm[i] for i in sorted(ok)]
        log(f'ojos v3: miniatura {len(cm)} candidatos en par')
        if len(cm) >= 2:
            cands = cm
    if len(cands) < 2:
        log(f'ojos: {len(cands)} candidatos, se omiten')
        return [], pintura
    # el par más parecido (tamaño y altura)
    best = None
    for i in range(len(cands)):
        for j in range(i + 1, len(cands)):
            a, b = cands[i], cands[j]
            ya = a['box'][0] + a['e'][1]
            yb = b['box'][0] + b['e'][1]
            s = abs(np.log(a['area'] / b['area'])) + abs(ya - yb) / np.sqrt(a['area'])
            if best is None or s < best[0]:
                best = (s, a, b)
    par = sorted(best[1:], key=lambda c: c['box'][2] + c['e'][0])
    if v3 and all(c.get('mini') for c in par):
        # miniatura: el par comparte radio (el contorno de la media luna da radios ruidosos)
        rm = float(np.mean([c['e'][2] for c in par]))
        par = [{**c, 'e': (c['e'][0], c['e'][1], rm, rm, 0.0), 'E': _mask_elipse(c['E'].shape, (c['e'][0], c['e'][1], rm, rm, 0.0))}
               for c in par]
    grupos = []
    ojos_info = []   # v3: (lado, piezas, tapas, cx, cy, r, iris (icx, icy, ir), brillos, Lp, iris_L, x0, y0)
    tapas_fuera = []
    pint = pintura.copy()
    for lado, c in zip(('izq', 'der'), par):
        y0, y1, x0, x1 = c['box']
        E, e = c['E'], c['e']
        sub = pintura[y0:y1, x0:x1]
        if c.get('mini'):
            piezas = _mini_piezas(c, L, C, S, hex_codigo, x0, y0, sub)
            t = 0.0
            cx, cy = e[0] + x0, e[1] + y0
            ojos_info.append(dict(lado=lado, piezas=piezas, tapas=[], cx=cx, cy=cy, r=e[2], iris=None, brillos=[]))
        else:
            # aro: borde (código par) alrededor de la esclera
            anillo = ndi.binary_dilation(E, iterations=int(1.4 * k.ancho)) & ~E
            bordes = (sub >= 0) & (sub % 2 == 0) & anillo
            t = 0.0
            aro_code = None
            if bordes.sum() > 0.25 * anillo.sum() * 0.5:
                vals, cnt = np.unique(sub[bordes], return_counts=True)
                aro_code = int(vals[np.argmax(cnt)])
                perim = np.pi * (e[2] + e[3])
                t = min(bordes.sum() / perim, 1.3 * k.ancho)
            # iris: componente oscuro más grande dentro de la esclera
            oscs = np.isin(np.where(sub >= 0, sub // 2, -1), oscuras) & E
            lab_o, no = ndi.label(oscs)
            if not no:
                continue
            iris = lab_o == (np.argmax(ndi.sum(oscs, lab_o, range(1, no + 1))) + 1)
            iris = ndi.binary_fill_holes(iris)
            iris_color = (_iris_por_color(sub, E, iris, oscs, claras, oscuras, Lc, croma, S,
                                          Lsub=L[y0:y1, x0:x1], C=C) if iris_on else None)
            if iris_color is not None:
                # H19 (3): iris de color (dorado de R6) alrededor de la pupila oscura
                iris, q_iris, iris_code_c, pupila_code, iris_med = iris_color
                oscs = oscs | q_iris
            # ajuste de círculo al borde del iris que no toca el contorno de la esclera
            bi = iris & ~ndi.binary_erosion(iris)
            lejos = ~ndi.binary_dilation(~E, iterations=2 * S)
            pts = np.argwhere(bi & lejos)[:, ::-1].astype(float)
            if len(pts) < 12:
                pts = np.argwhere(bi)[:, ::-1].astype(float)
            A = np.c_[2 * pts[:, 0], 2 * pts[:, 1], np.ones(len(pts))]
            icx, icy, cc0 = np.linalg.lstsq(A, (pts ** 2).sum(1), rcond=None)[0]
            ir = np.sqrt(cc0 + icx ** 2 + icy ** 2) + 0.5
            if v3:
                # la mordida del brillo en el borde del iris tiraba del ajuste: RANSAC la deja fuera
                rc = _circulo_pts(pts, S, 1.5 * S, 1.2 * max(e[2], e[3]))
                if rc is not None:
                    icx, icy, ir = rc[0], rc[1], rc[2] + 0.5
            circ = _mask_elipse(E.shape, (icx, icy, ir, ir, 0))
            iris_code = int(np.bincount(sub[iris]).argmax()) if iris_color is None else iris_code_c
            piezas = []
            cx, cy = e[0] + x0, e[1] + y0
            ee = (cx, cy, e[2], e[3], e[4])
            if aro_code is not None and t > 0.3 * S:
                piezas.append(_prim((cx, cy, e[2] + t, e[3] + t, e[4]), S, hex_codigo(aro_code)))
            esc_code = int(np.bincount(sub[E & ~oscs & (sub >= 0)]).argmax()) if (E & ~oscs & (sub >= 0)).any() else 1
            piezas.append(_prim(ee, S, hex_codigo(esc_code)))
            i_iris = len(piezas)
            if (circ & ~E).sum() <= 0.01 * circ.sum():
                piezas.append(_prim((icx + x0, icy + y0, ir, ir, 0), S, hex_codigo(iris_code)))
            elif v3 and 'occ' in c and (circ & ~E & ~c['occ']).sum() <= 0.01 * circ.sum():
                # v3: lo que sale del ojo lo cubre la tapa (mejilla), que va encima: el iris sigue siendo círculo
                piezas.append(_prim((icx + x0, icy + y0, ir, ir, 0), S, hex_codigo(iris_code)))
            else:
                full = np.zeros((H, W), bool)
                full[y0:y1, x0:x1] = trazado.suavizar(circ & E, 1.0)
                d = trazado.potrace_d(full, S, opttol=0.4)
                piezas.append(f'<path d="{d}" fill="#{hex_codigo(iris_code)}"/>')
            # pupila: clase más oscura dentro del iris, si ocupa una parte clara de él
            sub_cls = np.where(sub >= 0, sub // 2, -1)
            dentro = iris & (sub >= 0)
            vals, cnt = np.unique(sub[dentro], return_counts=True)
            if iris_color is not None:
                # con iris de color, la pupila es solo la clase más oscura (no los anillos más oscuros del iris)
                vals, cnt = np.array([pupila_code]), np.array([int((sub[dentro] == pupila_code).sum())])
            for v, nn in zip(vals, cnt):
                if v != iris_code and nn > 0.12 * iris.sum() and C[v // 2, 0] < C[iris_code // 2, 0]:
                    pm = ndi.binary_fill_holes(sub == v) & iris
                    pe = _elipse(pm) if pm.sum() > 20 else None
                    if pe:
                        piezas.append(_prim((pe[0] + x0, pe[1] + y0, pe[2], pe[3], pe[4]), S, hex_codigo(int(v))))
            brillos = []
            Lp = None
            if v3:
                Lp = L[y0:y1, x0:x1, 0].astype(np.float32)
                for bx, by, brx, bry, ba, bcode in _brillos_v3(Lp, sub, sub_cls, claras, oscs, iris, E,
                                                                 icx, icy, ir, S, Lc):
                    piezas.append(_prim((bx + x0, by + y0, brx, bry, ba), S, hex_codigo(bcode)))
                    brillos.append(((bx - icx) / ir, (by - icy) / ir, brx / ir, bry / ir, ba, bcode))
            else:
                # brillos: componentes claros dentro del círculo del iris (ampliado)
                cerca = _mask_elipse(E.shape, (icx, icy, ir + S, ir + S, 0))
                claros = np.isin(sub_cls, claras) & cerca & ~ndi.binary_dilation(~E, iterations=S)
                v2c = 'occ' in c
                if v2c:
                    # v2 (ojos pequeños): el brillo suele tocar el borde del iris y unirse a la esclera; se corta
                    # con el círculo del iris y solo se mira el anillo dentro de él
                    claros = np.isin(sub_cls, claras) & circ & E
                lb, nb = ndi.label(claros)
                for b in range(1, nb + 1):
                    bm = lb == b
                    if bm.sum() < (0.8 * S) ** 2 * 3 or bm.sum() > 0.35 * iris.sum():
                        continue
                    if (bm & circ).sum() < 0.85 * bm.sum():
                        continue
                    # solo los que están (casi) rodeados de iris/pupila, no la esclera
                    ring = ndi.binary_dilation(bm, iterations=2) & ~bm
                    if v2c:
                        ring &= circ
                    if (oscs & ring).sum() < 0.4 * ring.sum():
                        continue
                    be = _elipse(bm)
                    if be and v2c and np.pi * be[2] * be[3] < 5 * S * S:
                        continue  # brillo de menos de ~4 px² en la referencia: sería una mota
                    if be:
                        piezas.append(_prim((be[0] + x0, be[1] + y0, be[2], be[3], be[4]), S,
                                            hex_codigo(int(np.bincount(sub[bm]).argmax()))))
            tapas = []
            if exp.get('parpado_v1') and c.get('occ') is None:
                # el óvalo ajustado a la media luna blanca sobresale de la abertura real del ojo (asomaba por
                # encima del párpado y por las esquinas). La esclera se traza con la forma real de la abertura
                # (casco del blanco, un poco crecida bajo el párpado para no dejar rendijas) y el párpado se queda
                # entero en la cabeza (no se repinta de piel, ver abajo).
                abre = ndi.binary_dilation(E, iterations=max(1, S // 2))
                full = np.zeros((H, W), bool)
                full[y0:y1, x0:x1] = trazado.suavizar(abre, 1.0)
                d = trazado.potrace_d(full, S, opttol=0.4)
                if d:
                    piezas[i_iris - 1] = f'<path d="{d}" fill="#{hex_codigo(esc_code)}"/>'
                    # el iris, recortado a la misma abertura (si no, asoma una línea blanca encima)
                    if (circ & ~abre).sum() > 0.01 * circ.sum():
                        full[:] = False
                        full[y0:y1, x0:x1] = trazado.suavizar(circ & ndi.binary_dilation(abre, iterations=S), 1.0)
                        d = trazado.potrace_d(full, S, opttol=0.4)
                        if d:
                            piezas[i_iris] = f'<path d="{d}" fill="#{hex_codigo(iris_code)}"/>'
            if c.get('occ') is not None and c['occ'].any():
                tapas = _parpado(sub, c['occ'], e, t, S, hex_codigo, y0, x0, H, W, crece=S // 2 if v3 else 0)
            ojos_info.append(dict(lado=lado, piezas=piezas, tapas=tapas, cx=cx, cy=cy, r=(e[2] + e[3]) / 2 + t,
                                  i_iris=i_iris, iris_code=iris_code,
                                  iris_med=iris_med if iris_color is not None else None,
                                  iris=(icx, icy, ir), brillos=brillos, Lp=Lp, oscs=oscs, circ=circ,
                                  L_iris=float(np.median(Lp[iris])) if Lp is not None and iris.any() else None,
                                  x0=x0, y0=y0, E=E))
        # debajo del ojo: piel (el relleno que rodea el aro)
        tapa = _mask_elipse(E.shape, e, t + 1.5 * S)
        afuera = ndi.binary_dilation(tapa, iterations=3 * S) & ~tapa
        vals = sub[afuera & (sub >= 0) & (sub % 2 == 1)]
        if len(vals):
            piel = int(np.bincount(vals).argmax())
            ps = pint[y0:y1, x0:x1]
            rep = tapa & (ps >= 0)
            if exp.get('parpado_v1'):
                # el párpado y las pestañas (oscuros) no se repintan de piel: siguen en la cabeza
                # (solo fuera de la abertura: el iris de la referencia sí se repinta, si no asoma al parpadear)
                rep &= ~(np.isin(np.where(ps >= 0, ps // 2, -1), oscuras) & ~ndi.binary_dilation(E, iterations=max(1, S // 2)))
            ps[rep] = piel
    if iris_on and len(ojos_info) == 2 and all(o.get('iris_med') for o in ojos_info):
        # H19 (3): el par comparte el tono del iris (la clase más cercana a la media de las dos medianas)
        med = np.mean([o['iris_med'][0] for o in ojos_info], 0)
        cods = sorted({c_ for o in ojos_info for c_ in o['iris_med'][1]})
        cod = min(cods, key=lambda c_: float(((C[c_ // 2] - med) ** 2).sum()))
        for o in ojos_info:
            if o['iris_code'] != cod:
                p_ = o['piezas'][o['i_iris']]
                o['piezas'][o['i_iris']] = p_.replace(f'fill="#{hex_codigo(o["iris_code"])}"', f'fill="#{hex_codigo(cod)}"')
                o['iris_code'] = cod
    if v3 and len(ojos_info) == 2:
        _simetria_brillos(ojos_info, S, hex_codigo, log)
    for o in ojos_info:
        piezas = o['piezas'] + ([] if v3 else o['tapas'])
        grupos.append(f'<g id="ojo-{o["lado"]}" class="ojo" data-centro="{fmt(o["cx"] / S)} {fmt(o["cy"] / S)}" '
                      f'data-radio="{fmt(o["r"] / S)}">' + ''.join(piezas) + '</g>')
        if v3:
            # C5: la tapa (párpado/mejilla) va ENCIMA del ojo pero fuera de su grupo: el ojo sigue siendo
            # primitivas (contrato) y el parpadeo escala el ojo por debajo de la mejilla
            tapas_fuera += o['tapas']
    log(f'ojos: {len(grupos)}')
    return grupos + tapas_fuera, pint


def _simetria_brillos(ojos_info, S, hex_codigo, log):
    """Si un ojo tiene brillo (> 2 px de referencia) y el otro no, se copia en la misma posición relativa al
    iris, solo si la referencia lo respalda (la zona es clara en el otro ojo): nunca se inventa."""
    a, b = ojos_info
    for src, dst in ((a, b), (b, a)):
        if not src['brillos'] or dst['brillos'] or dst['iris'] is None or dst.get('Lp') is None:
            continue
        rel = max(src['brillos'], key=lambda q: q[2] * q[3])
        if 2 * max(rel[2], rel[3]) * src['iris'][2] <= 2 * S:
            continue
        icx, icy, ir = dst['iris']
        bx, by = icx + rel[0] * ir, icy + rel[1] * ir
        brx, bry = rel[2] * ir, rel[3] * ir
        mb = _mask_elipse(dst['E'].shape, (bx, by, brx, bry, rel[4])) & dst['circ']
        if mb.sum() < 4:
            continue
        frac = (dst['Lp'][mb] > dst['L_iris'] + 20).mean()
        if frac < 0.3:
            log(f'ojos v3: simetría de brillo descartada (ojo-{dst["lado"]}: {frac:.2f} claro)')
            continue
        dst['piezas'].append(_prim((bx + dst['x0'], by + dst['y0'], brx, bry, rel[4]), S, hex_codigo(rel[5])))
        dst['brillos'].append(rel)
        log(f'ojos v3: brillo copiado al ojo-{dst["lado"]}')
