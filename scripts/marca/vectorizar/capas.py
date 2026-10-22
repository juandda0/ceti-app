"""Figura, orden de apilado, capas sin rendijas, partes animables, ojos y piso.

Pintura: cada píxel de la figura tiene un código 2*c+1 (relleno de la clase c) o 2*c (borde oscuro de c).
Capas: de atrás hacia adelante; cada capa se extiende un poco por debajo de las que van encima y rellena
sus huecos con lo que está encima (la cara es un óvalo entero y los ojos van encima, como lo haría un
ilustrador). Así no hay rendijas entre colores y cada borde visible lo dibuja una sola forma.
"""
import cv2
import numpy as np
from scipy import ndimage as ndi


def poligono(pts, shape, S):
    m = np.zeros(shape, np.uint8)
    cv2.fillPoly(m, [np.array([[x * S, y * S] for x, y in pts], np.int32)], 1)
    return m.astype(bool)


def mayor(m):
    cc, n = ndi.label(m)
    if n <= 1:
        return m
    return cc == (np.argmax(ndi.sum(m, cc, range(1, n + 1))) + 1)


def _anillo_fondo(comp, fondo_d, r):
    """Fracción del anillo exterior (r px) de `comp` que toca el fondo (ya dilatado)."""
    ring = ndi.binary_dilation(comp, iterations=r) & ~comp
    return (ring & fondo_d).sum() / max(1, ring.sum())


def elegir_piso(idx, fondo, S):
    """Clase de la sombra del piso (compuertas v2) o None.

    La sombra es una mancha ancha y plana bajo los pies, casi toda en el 30 % inferior, que toca el fondo
    directamente (las botas o los zapatos, aunque tengan un color parecido, están rodeados por su contorno).
    Candidatas: clases con presencia en la franja inferior (14 %), por número de píxeles en la franja.
    """
    H, W = idx.shape
    y70, y86 = int(H * 0.7), int(H * 0.86)
    cnt = np.bincount(idx[y86:].ravel(), minlength=idx.max() + 1)
    cnt[fondo] = 0
    fondo_d = ndi.binary_dilation(idx == fondo, iterations=S)
    for c in np.argsort(-cnt):
        if cnt[c] < max(50 * S * S, 0.002 * cnt.sum() + 1):
            break
        m = idx == c
        if m[y70:].sum() < 0.6 * m.sum():
            continue
        cc, n = ndi.label(m[y70:])
        if not n:
            continue
        tam = ndi.sum(m[y70:], cc, range(1, n + 1))
        comp = cc == (np.argmax(tam) + 1)
        ys, xs = np.nonzero(comp)
        ancho, alto = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
        if ancho < 1.5 * alto or ancho < 0.15 * W:
            continue
        # recorte local para que el anillo sea barato
        y0, y1 = max(0, ys.min() - 2 * S), ys.max() + 2 * S + 1
        x0, x1 = max(0, xs.min() - 2 * S), xs.max() + 2 * S + 1
        if _anillo_fondo(comp[y0:y1, x0:x1], fondo_d[y70:][y0:y1, x0:x1], S) < 0.3:
            continue
        return int(c)
    return None


def fondo_y_figura(idx, S, piso_hex_id=None, bolsillo_min=400, v2=True):
    H, W = idx.shape
    borde = np.r_[idx[0], idx[-1], idx[:, 0], idx[:, -1]]
    fondo = int(np.bincount(borde).argmax())
    # piso: la clase (no fondo) más común en la franja inferior, fuera de la figura
    if piso_hex_id is None and v2:
        piso = elegir_piso(idx, fondo, S)
    elif piso_hex_id is None:
        banda = idx[int(H * 0.86):]
        cnt = np.bincount(banda.ravel(), minlength=idx.max() + 1)
        cnt[fondo] = 0
        piso = int(cnt.argmax())
        # debe tocar el borde lateral o inferior de la banda o ser ancho: si no, no hay piso
        m = idx == piso
        if m[int(H * 0.7):].sum() < 0.6 * m.sum():
            piso = None
    else:
        piso = piso_hex_id
    abierto = idx == fondo
    if piso is not None:
        abierto |= idx == piso
    cc, _ = ndi.label(abierto)
    tocan = set(np.unique(np.r_[cc[0], cc[-1], cc[:, 0], cc[:, -1]])) - {0}
    fig = ~np.isin(cc, list(tocan))
    fig = mayor(ndi.binary_opening(fig, iterations=S))
    # huecos grandes de fondo encerrados (entre las piernas) siguen siendo fondo
    bols = (idx == fondo) & fig
    cc, n = ndi.label(bols)
    if n:
        tam = ndi.sum(bols, cc, range(1, n + 1))
        grandes = np.where(tam > bolsillo_min * S * S)[0] + 1
        fig &= ~np.isin(cc, grandes)
    return fondo, piso, fig


def orden_z(pintura, n_clases, pares, forzar=None):
    """Orden de atrás hacia adelante de las clases de relleno.

    - si A es dueño de la línea A|B, A va delante de B (su borde debe verse);
    - si se tocan sin línea, va delante la que está más rodeada por la otra (detalle encima);
    - `forzar`: lista parcial [atrás, ..., adelante] que manda.
    """
    rel = np.where(pintura >= 0, pintura // 2, -1)
    presentes = [c for c in np.unique(rel) if c >= 0]
    area = {c: int((rel == c).sum()) for c in presentes}
    gana = {}  # (a, b) -> peso de "a delante de b"
    for (a, b), o in pares.items():
        if a in area and b in area:
            gana[(o, b if o == a else a)] = gana.get((o, b if o == a else a), 0) + 1e6
    # contactos directos entre rellenos
    h = (rel[:, :-1], rel[:, 1:])
    v = (rel[:-1], rel[1:])
    contacto = {}
    perim = {c: 0 for c in presentes}
    for x, y in (h, v):
        m = (x != y) & (x >= 0) & (y >= 0)
        pa, pb = x[m], y[m]
        k = pa.astype(np.int64) * 10000 + pb
        u, cnt = np.unique(k, return_counts=True)
        for kk, cc in zip(u, cnt):
            a, b = int(kk // 10000), int(kk % 10000)
            contacto[(a, b)] = contacto.get((a, b), 0) + cc
            contacto[(b, a)] = contacto.get((b, a), 0) + cc
    for c in presentes:
        perim[c] = sum(v_ for (a, _), v_ in contacto.items() if a == c) + 1
    for (a, b), cnt in contacto.items():
        if a < b and (a, b) not in pares and (b, a) not in pares:
            fa, fb = cnt / perim[a], cnt / perim[b]
            front, back = (a, b) if fa > fb else (b, a)
            gana[(front, back)] = gana.get((front, back), 0) + cnt
    # orden: Kahn con desempate por área (lo grande atrás); los ciclos se rompen por la arista más débil
    orden = []
    resto = set(presentes)
    while resto:
        # candidatos: los que no tienen a nadie detrás pendiente... (nadie en resto debe ir detrás de él)
        libres = [c for c in resto if not any((d, c) in gana for d in resto if d != c and gana.get((d, c), 0) > gana.get((c, d), 0))]
        if not libres:
            # ciclo: el que menos peso tiene en contra
            libres = [min(resto, key=lambda c: sum(gana.get((d, c), 0) for d in resto if d != c))]
        c = max(libres, key=lambda c: area[c])
        orden.append(c)
        resto.remove(c)
    if forzar:
        f = [c for c in forzar if c in orden]
        pos = sorted(orden.index(c) for c in f)
        for p, c in zip(pos, f):
            orden[p] = c
    return orden


def ordenar_por_contencion(pintura, codigos, umbral=0.8, min_px=0, cierre=0, chico=0):
    """H19 (2): si el código A tiene ≥ `umbral` de sus píxeles dentro de agujeros del código B y A va debajo de
    B, A pasa justo encima de B. Así B (p. ej. el panel claro de S4, un anillo del degradado radial o una piel
    con una arruga) se rellena entero bajo A en vez de trazarse con un agujero por cada pieza de A.
    `cierre` (px): los agujeros se miden sobre B cerrado con ese radio (franjas que llegan al borde del panel).
    Tamaños de A: si sube, A se traza solo con sus píxeles (sin la extensión bajo las capas de encima), así que
    se mueve si es < `chico` px en total (la limpieza de motas lo quita y B tapa el hueco: una isla menos) o si
    es ≥ `min_px` px con ≥ 95 % de sus píxeles en piezas ≥ `chico` (no se pierden puntitos); entre medias, no
    (quedaría un path diminuto)."""
    codigos = list(codigos)
    if len(codigos) < 2:
        return codigos
    pos = {k: i for i, k in enumerate(codigos)}
    rango = np.full(pintura.shape, -1, np.int32)
    for k in codigos:
        rango[pintura == k] = pos[k]
    tot = np.bincount(rango[rango >= 0].ravel(), minlength=len(codigos))
    movible = {}
    for k in codigos:
        t = tot[pos[k]]
        if t < chico:
            movible[k] = True
        elif t < max(min_px, 1):
            movible[k] = False
        elif chico:
            n_, cc_, st, _ = cv2.connectedComponentsWithStats((rango == pos[k]).astype(np.uint8), connectivity=8)
            a_ = st[1:, cv2.CC_STAT_AREA]
            movible[k] = a_[a_ >= chico].sum() >= 0.95 * t
        else:
            movible[k] = True
    restr = []   # (a, b): a debe ir encima de b
    H, W = pintura.shape
    disco = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * cierre + 1,) * 2) if cierre else None
    for b in codigos:
        mb = rango == pos[b]
        if not mb.any():
            continue
        ys, xs = np.nonzero(mb)
        y0, y1 = max(0, ys.min() - 1), min(H, ys.max() + 2)
        x0, x1 = max(0, xs.min() - 1), min(W, xs.max() + 2)
        sb = mb[y0:y1, x0:x1]
        if disco is not None:
            sb = cv2.morphologyEx(np.pad(sb, cierre + 1).astype(np.uint8), cv2.MORPH_CLOSE, disco)[
                cierre + 1:-cierre - 1, cierre + 1:-cierre - 1] > 0
        hol = ndi.binary_fill_holes(sb) & ~mb[y0:y1, x0:x1]
        if not hol.any():
            continue
        rs = rango[y0:y1, x0:x1]
        dentro = np.bincount(rs[hol & (rs >= 0)].ravel(), minlength=len(codigos))
        for a in codigos:
            ia = pos[a]
            if a != b and movible[a] and tot[ia] and dentro[ia] >= umbral * tot[ia]:
                restr.append((a, b))
    if not restr:
        return codigos
    for _ in range(4 * len(restr)):
        malo = [(a, b) for a, b in restr if codigos.index(a) < codigos.index(b)]
        if not malo:
            break
        a, b = malo[0]
        codigos.remove(a)
        codigos.insert(codigos.index(b) + 1, a)
    return codigos


def apilar(pintura, orden, solapa, region=None, contencion=False):
    """Máscaras de cada capa (código, máscara) de atrás hacia adelante, sin rendijas."""
    codigos = []
    for c in orden:
        for k in (2 * c, 2 * c + 1):
            if (pintura == k).any():
                codigos.append(k)
    if region is not None:
        pintura = np.where(region, pintura, -1)
    if contencion:
        codigos = ordenar_por_contencion(pintura, codigos, **(contencion if isinstance(contencion, dict) else {}))
    rango = np.full(pintura.shape, -1, np.int32)
    for r, k in enumerate(codigos):
        rango[pintura == k] = r
    disco = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * solapa + 1,) * 2)
    capas = []
    for r, k in enumerate(codigos):
        propio = rango == r
        if not propio.any():
            continue
        encima = rango > r
        ext = (cv2.dilate(propio.astype(np.uint8), disco) > 0) & encima
        m = propio | ext
        huecos = ndi.binary_fill_holes(m) & ~m & encima
        m |= huecos
        capas.append((k, m))
    return capas


def rellenar_debajo(pintura, parte, cuerpo, solapa):
    """Debajo de una parte animable el cuerpo continúa (vecino más cercano) en una franja de `solapa` px."""
    franja = parte & ndi.binary_dilation(cuerpo, iterations=solapa)
    if not franja.any():
        return pintura, cuerpo
    _, (iy, ix) = ndi.distance_transform_edt(~cuerpo, return_indices=True)
    out = pintura.copy()
    out[franja] = pintura[iy[franja], ix[franja]]
    return out, cuerpo | franja


def elipse_piso(idx, piso, fig, S, v2=True):
    m = (idx == piso) & ~ndi.binary_dilation(fig, iterations=2 * S)
    m = mayor(ndi.binary_opening(m, iterations=2 * S))
    if m.sum() < 100 * S * S:
        if not v2:
            return None
        # respaldo: la franja de la clase piso bajo los pies (sin apertura; la figura la tapa casi entera)
        H = idx.shape[0]
        m = (idx == piso) & ~fig
        m[:int(H * 0.7)] = False
        m = mayor(m)
        if m.sum() < 20 * S * S:
            return None  # sin clase piso visible: nunca se inventa una sombra
    # puntos del contorno exterior que no tocan la figura (la figura tapa parte de la sombra)
    cont, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    pts = max(cont, key=len)[:, 0]
    cerca = ndi.binary_dilation(fig, iterations=4 * S)
    lejos = pts[~cerca[pts[:, 1], pts[:, 0]]]
    if len(lejos) >= 5:
        pts = lejos
    elif not v2:
        pts = lejos  # v1: fitEllipse falla igual que antes
    if len(pts) < 5 or (v2 and len(lejos) < 5):
        if not v2:
            return None
        # respaldo: elipse inscrita en la caja de la franja visible (todas sus piezas, a ambos lados de los pies)
        franja = (idx == piso) & ~fig
        franja[:int(idx.shape[0] * 0.7)] = False
        franja = ndi.binary_opening(franja, iterations=S)
        ys, xs = np.nonzero(franja if franja.sum() >= m.sum() else m)
        return ((xs.min() + xs.max() + 1) / 2 / S, (ys.min() + ys.max() + 1) / 2 / S,
                (xs.max() - xs.min() + 1) / 2 / S, (ys.max() - ys.min() + 1) / 2 / S)
    (cx, cy), (w, h), ang = cv2.fitEllipse(pts.astype(np.float32))
    if abs(((ang + 45) % 180) - 45) > 10:  # eje mayor vertical: se rota
        w, h = h, w
    return cx / S, cy / S, w / 2 / S, h / 2 / S


# ============================================================================ H19 (r3): capas geométricas
def _elipse_sombra(pm, fig, S):
    """Elipse de la sombra (cx, cy, rx, ry, en px de trabajo) ajustada SOLO a su borde inferior y sus puntas.

    Las botas o guantes del mismo color que la sombra se pegan a ella por arriba, así que el borde de arriba no
    sirve; el de abajo (donde la sombra toca el fondo) es solo sombra. y_inf(x) = cy + ry·sqrt(1 − u²).
    """
    H, W = pm.shape
    y70 = int(H * 0.7)
    cc, n = ndi.label(pm[y70:])
    if not n:
        return None
    tam = ndi.sum(pm[y70:], cc, range(1, n + 1))
    comp = np.zeros_like(pm)
    comp[y70:] = cc == (np.argmax(tam) + 1)
    if comp.sum() < 50 * S * S:
        return None
    ys, xs = np.nonzero(comp)
    x0, x1 = xs.min(), xs.max()
    cx, rx = (x0 + x1) / 2, (x1 - x0 + 1) / 2
    if rx < 4 * S:
        return None
    # borde inferior por columna, solo donde lo que sigue debajo no es figura (la figura no lo tapa)
    inf = np.full(W, -1)
    np.maximum.at(inf, xs, ys)
    cols = np.nonzero(inf >= 0)[0]
    bajo = np.clip(inf[cols] + S, 0, H - 1)
    cols = cols[~fig[bajo, cols]]
    u = (cols - cx) / rx
    ok = np.abs(u) < 0.85
    cols, u = cols[ok], u[ok]
    if len(cols) < 8:
        return None
    y = inf[cols].astype(float)
    s = np.sqrt(1 - u ** 2)
    A = np.c_[np.ones(len(s)), s]
    for _ in range(3):
        (cy, ry), *_ = np.linalg.lstsq(A, y, rcond=None)
        r = np.abs(A @ np.array([cy, ry]) - y)
        keep = r < max(2 * S, 2.5 * np.median(r) + 1)
        if keep.all():
            break
        A, y = A[keep], y[keep]
        if len(y) < 8:
            return None
    if not (0 < ry <= rx):
        return None
    return float(cx), float(cy), float(rx), float(ry)


def piso_geometrico(idx, L, C, fondo, piso, fig, S, toca=0.3, fusion=5.0, crecer=2.0):
    """H19 (1): la clase piso solo es piso FUERA de la silueta de la figura y DENTRO de la elipse de la sombra.

    Guantes y botas con un color casi igual al de la sombra (ΔE ≈ 4, S3) caían en la clase piso y se borraban.
    - silueta = figura (sin la clase piso) cerrada con radio 2·S y sin huecos;
    - sombra = elipse ajustada al borde inferior de la mancha de piso (`_elipse_sombra`), crecida 1·S;
    - el resto de la clase piso (abierto 1·S para no tomar halos de antialias) se reparte por componentes:
      pasa a figura si toca la figura en ≥ `toca` de su perímetro o está por encima de la línea de los pies
      (borde superior de la elipse), salvo que su mediana quede bajo el centro de la sombra (resto de sombra);
    - dentro de la elipse, una componente que pasa a figura (bota) crece sobre los píxeles de la clase piso cuyo
      color (original suavizado σ = S) se parece más al de ella que al de la sombra pura (bajo el centro), si
      los dos colores difieren ΔE76 ≥ `crecer`: así vuelven las punteras que pisan la sombra;
    - cada componente que pasa a figura toma el color (mediana) del original en ella: la clase existente más
      cercana si está a ΔE76 < `fusion` (sin contar fondo ni piso), si no una clase nueva.
    Devuelve (idx, C, cambió, elipse de la sombra en px de referencia o None).
    """
    H, W = idx.shape
    pm = (idx == piso) & ~fig
    if not pm.any():
        return idx, C, False, None
    e = _elipse_sombra(pm, fig, S)
    if e is None:
        return idx, C, False, None
    cx, cy, rx, ry = e
    disco = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (4 * S + 1,) * 2)
    sil = ndi.binary_fill_holes(cv2.morphologyEx(fig.astype(np.uint8), cv2.MORPH_CLOSE, disco) > 0)
    sombra = np.zeros((H, W), np.uint8)
    cv2.ellipse(sombra, ((cx, cy), (2 * (rx + S), 2 * (ry + S)), 0), 1, -1)
    sombra = sombra > 0
    y_pies = cy - ry
    en_sombra = pm & sombra & ~sil
    resto = pm & ~en_sombra
    abierto = ndi.binary_opening(resto, iterations=S)
    cc, n = ndi.label(abierto)
    if not n:
        return idx, C, False, None
    amin = max(30 * S * S, 0.002 * fig.sum())
    tam = ndi.sum(abierto, cc, range(1, n + 1))
    # color de la sombra pura (bajo su centro) y original suavizado en la caja de la elipse, para crecer
    ys = np.arange(H)[:, None]
    pura = en_sombra & (ys > cy + 0.3 * ry)
    c_sombra = np.median(L[pura].reshape(-1, 3), 0) if pura.sum() > 20 * S * S else None
    ey0, ey1 = max(0, int(cy - 2 * ry - 4 * S)), min(H, int(cy + ry + 2 * S) + 1)
    ex0, ex1 = max(0, int(cx - rx - 2 * S)), min(W, int(cx + rx + 2 * S) + 1)
    Lb = None
    idx = idx.copy()
    C = np.asarray(C, np.float32)
    excl = {int(fondo), int(piso)}
    cambio = False
    libre = en_sombra.copy()
    for j, sl in enumerate(ndi.find_objects(cc), start=1):
        if sl is None or tam[j - 1] < amin:
            continue
        y0, y1 = max(0, sl[0].start - 2 * S), min(H, sl[0].stop + 2 * S)
        x0, x1 = max(0, sl[1].start - 2 * S), min(W, sl[1].stop + 2 * S)
        m = cc[y0:y1, x0:x1] == j
        ring = ndi.binary_dilation(m, iterations=S) & ~m
        frac = (ring & fig[y0:y1, x0:x1]).sum() / max(1, ring.sum())
        ymed = float(np.median(np.nonzero(m)[0])) + y0
        if ymed > cy:
            continue  # resto de la sombra (bajo su centro): sigue siendo piso
        if frac < toca and ymed >= y_pies:
            continue
        # la componente con su borde (lo que quitó la apertura, sin pasar de 1·S)
        mm = np.zeros((H, W), bool)
        mm[y0:y1, x0:x1] = resto[y0:y1, x0:x1] & ndi.binary_dilation(m, iterations=S)
        col = np.median(L[mm].reshape(-1, 3), 0).astype(np.float32)
        if c_sombra is not None and np.sqrt(((col - c_sombra) ** 2).sum()) >= crecer \
                and (ndi.binary_dilation(mm, iterations=S) & libre).any():
            if Lb is None:
                Lb = np.zeros((H, W, 3), np.float32)
                Lb[ey0:ey1, ex0:ex1] = cv2.GaussianBlur(L[ey0:ey1, ex0:ex1].astype(np.float32), (0, 0), S)
            caja = np.zeros((H, W), bool)
            caja[ey0:ey1, ex0:ex1] = True
            d_c = ((Lb - col) ** 2).sum(-1)
            d_s = ((Lb - c_sombra) ** 2).sum(-1)
            gana = libre & caja & (d_c < d_s)
            lab_g, _ = ndi.label(gana | mm)
            ids = np.unique(lab_g[mm])
            crece = np.isin(lab_g, ids[ids > 0]) & gana
            crece = ndi.binary_opening(crece, iterations=max(1, S // 2)) & crece
            # solo lo que sigue pegado a la componente tras la apertura
            lab_g, _ = ndi.label(crece | mm)
            ids = np.unique(lab_g[mm])
            crece = np.isin(lab_g, ids[ids > 0]) & crece
            libre &= ~crece
            mm |= crece
        cand = [(float(np.sqrt(((C[c] - col) ** 2).sum())), c) for c in range(len(C)) if c not in excl]
        de, c = min(cand)
        if de >= fusion:
            C = np.vstack([C, col[None]])
            c = len(C) - 1
        idx[mm] = c
        cambio = True
    return idx, C, cambio, (cx / S, cy / S, rx / S, ry / S)
