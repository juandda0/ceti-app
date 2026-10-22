"""Paleta y clasificación de píxeles.

- Paleta automática: k-means en Lab sobre píxeles planos (sin gradiente), fusión de colores casi iguales y
  búsqueda de colores pequeños que el k-means ignora (pulseras, brillos, botones): se agregan los
  grupos de píxeles planos que quedan lejos de toda la paleta.
- Clasificación: color más cercano en Lab. El antialias crea franjas de 1-2 px de colores intermedios
  (p. ej. entre la línea y el traje aparece un tono que se parece a otro color): se eliminan las franjas
  delgadas que no tienen un núcleo grueso y se reasignan al vecino más cercano.
"""
import cv2
import numpy as np
from scipy import ndimage as ndi

from .pre import hexrgb, lab, rgbhex, rgb_de_lab


def pixeles_planos(L, umbral=4.0):
    g = np.zeros(L.shape[:2], np.float32)
    for c in range(3):
        gx = cv2.Sobel(L[..., c], cv2.CV_32F, 1, 0, ksize=3) / 8
        gy = cv2.Sobel(L[..., c], cv2.CV_32F, 0, 1, ksize=3) / 8
        g += gx * gx + gy * gy
    return np.sqrt(g) < umbral


def paleta_auto(L, mascara, k=28, fusion=6.0, min_px=600, residuo=11.0, semilla=0, detalle=False, S=4,
                espacial=None, L_meseta=None):
    """Devuelve una lista de colores Lab (float32) representativos de la región `mascara`.

    `espacial` (flag experimentos.fusion_espacial, H16): True o dict de opciones. La fusión deja de decidir
    solo por ΔE entre centros: dos clusters cercanos no se funden si el menor forma una región sólida con
    borde nítido que contrasta con su anillo (nariz, iris, bandas de tonos cercanos; ver `_region_propia`),
    y después se buscan residuos locales por ventanas (ver `_residuos_locales`).
    `L_meseta` (H17): imagen sobre la que se mide la prueba de meseta (la mezcla con Lanczos en la zona
    donde el ESRGAN perdió estructura, para no fundir tonos de ΔE 4–8 que el ESRGAN volvió rampa).
    """
    opts = espacial if isinstance(espacial, dict) else {}
    paleta_auto.diag = diag = {'bloqueos': [], 'locales': []}
    paleta_auto.zonas = None
    plano = pixeles_planos(L) & mascara
    px = L[plano]
    rng = np.random.default_rng(semilla)
    s = px[rng.choice(len(px), min(150000, len(px)), replace=False)].astype(np.float32)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 60, 0.1)
    cv2.setRNGSeed(int(semilla))  # k-means++ de OpenCV usa el RNG global: sin esto el resultado depende del proceso
    _, lab_k, cen = cv2.kmeans(s, k, None, crit, 2, cv2.KMEANS_PP_CENTERS)
    cnt = np.bincount(lab_k.ravel(), minlength=k).astype(float) * len(px) / len(s)
    cen = [c for c in cen]
    cnt = list(cnt)
    grupos = [[i] for i in range(len(cen))]       # clusters originales de cada centro (para H16)
    if espacial:
        ctx = _ctx_espacial(L, mascara, np.array(cen, np.float32), S, opts)
        # H17: segunda opinión sobre Lanczos (solo AÑADE regiones propias: la nariz de R5 pasa sobre el
        # ESRGAN y no sobre Lanczos; las bandas de ΔE 4–5 de S4, al revés)
        ctx2 = _ctx_espacial(L_meseta, mascara, np.array(cen, np.float32), S, opts) if L_meseta is not None else None
        opts1 = {k: v for k, v in opts.items() if k != 'de_plano'}
        bloqueado = set()                          # pares (frozenset de clusters originales) que no se funden
        extras = []                                # colores de regiones propias (modo escindir)
    # fusión jerárquica de los centros más parecidos
    while True:
        best = None
        for i in range(len(cen)):
            for j in range(i + 1, len(cen)):
                d = np.linalg.norm(cen[i] - cen[j])
                if d < fusion and (best is None or d < best[0]):
                    if espacial and frozenset((frozenset(grupos[i]), frozenset(grupos[j]))) in bloqueado:
                        continue
                    best = (d, i, j)
        if best is None:
            break
        d, i, j = best
        if espacial:
            menor, mayor = (i, j) if cnt[i] < cnt[j] else (j, i)
            r = _region_propia(ctx, grupos[menor], grupos[mayor], opts1)
            if r is None and ctx2 is not None:
                r = _region_propia(ctx2, grupos[menor], grupos[mayor], opts)
            # el cluster menor ES la región (banda de S4): no se funde; si la región es solo una parte de él
            # (nariz dentro de un cluster de piel sombreada): se funde y la región conserva su color aparte
            if r and (opts.get('modo') == 'bloquear' or (opts.get('modo') != 'escindir' and r['frac'] >= 0.5)):
                r.pop('color'), r.pop('_zona')
                bloqueado.add(frozenset((frozenset(grupos[i]), frozenset(grupos[j]))))
                diag['bloqueos'].append((hex_de_lab(cen[menor]), hex_de_lab(cen[mayor]), round(float(d), 2), r))
                continue
            if r and r['solidez'] < opts.get('solidez_escindir', 0.9):
                r = None    # escindir exige una región compacta (nariz .98); en R8 partía un tramo del borde (.81)
            if r:
                # escindir: los dos clusters se funden (suelen ser el mismo relleno partido por un sombreado),
                # pero la región propia conserva su color como centro aparte (nariz, banda de tono)
                extras.append((r.pop('color'), r['area'], r.pop('_zona')))
                diag['bloqueos'].append((hex_de_lab(cen[menor]), hex_de_lab(cen[mayor]), round(float(d), 2), r))
        w = cnt[i] + cnt[j]
        cen[i] = (cen[i] * cnt[i] + cen[j] * cnt[j]) / w
        cnt[i] = w
        grupos[i] = grupos[i] + grupos[j]
        del cen[j], cnt[j], grupos[j]
    cen = [c for c, n in zip(cen, cnt) if n >= min_px]
    zonas = {}
    if espacial:
        # cada color escindido solo puede ganar píxeles cerca de su región (dilatada 2·S): si no, el tono de
        # la nariz aparece en cualquier sombra de la piel y suma capas y nodos
        H, W = L.shape[:2]
        kz = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (4 * S + 1,) * 2)
        for c, _, (cm, sl) in sorted(extras, key=lambda x: -x[1]):
            z = np.zeros((H, W), bool)
            z[sl] = cv2.dilate(cm.astype(np.uint8), kz) > 0
            for zi, zm in zonas.items():
                if np.linalg.norm(c - cen[zi]) < opts.get('de_extra', 2.5) and (zm & z).any():
                    zonas[zi] = zm | z
                    break
            else:
                if min(np.linalg.norm(c - x) for x in cen) > opts.get('de_extra', 2.5) or not opts.get('zonas', True):
                    zonas[len(cen)] = z
                    cen.append(np.asarray(c, np.float32))
        if not opts.get('zonas', True):
            zonas = {}
    # colores pequeños: grupos espaciales de píxeles planos lejos de la paleta
    for _ in range(6):
        C = np.array(cen)
        d = distancia_min(L, C)
        lejos = plano & (d > residuo)
        lejos = ndi.binary_opening(lejos, iterations=1)
        cc, n = ndi.label(lejos)
        if n == 0:
            break
        tam = ndi.sum(lejos, cc, range(1, n + 1))
        nuevos = []
        for i in np.argsort(-tam):
            if tam[i] < min_px // 4:
                break
            c = np.median(L[cc == i + 1], axis=0)
            if all(np.linalg.norm(c - x) > residuo for x in cen + nuevos):
                nuevos.append(c)
        if not nuevos:
            break
        cen += nuevos
    if espacial and opts.get('locales', False):
        cen += _residuos_locales(L, plano, np.array(cen, np.float32), S, opts, diag)
    # refinamiento: cada centro pasa a ser la mediana de los píxeles planos que le tocan
    C = np.array(cen, np.float32)
    paleta_auto.zonas = zonas or None
    idx = clasificar(L, C, zonas or None)
    for i in range(len(C)):
        m = plano & (idx == i)
        if m.sum() > 20:
            C[i] = np.median(L[m], axis=0)
    if detalle:
        C = colores_detalle(L, C, S, mascara)
    return C


# ------------------------------------------------------------------ H16: fusión consciente del espacio
def _ctx_espacial(L, mascara, cen0, S, opts):
    """Mapa de clusters originales del k-means (antes de fundir) y magnitud del gradiente (ΔE/px, suavizado
    σ = S/2) para juzgar si una región tiene borde nítido (región propia) o es una banda de un degradado."""
    idx0 = clasificar(L, cen0).astype(np.int16)
    idx0[~mascara] = -1
    return {'idx0': idx0, 'G': _gradiente(L, S), 'L': L, 'S': S, 'mascara': mascara,
            'escala': float(opts.get('escala', 1.0))}


def _gradiente(L, S):
    sig = max(0.5, S / 2)
    g = np.zeros(L.shape[:2], np.float32)
    for c in range(3):
        x = cv2.GaussianBlur(np.ascontiguousarray(L[..., c]), (0, 0), sig)
        gx = cv2.Sobel(x, cv2.CV_32F, 1, 0, ksize=3) / 8
        gy = cv2.Sobel(x, cv2.CV_32F, 0, 1, ksize=3) / 8
        g += gx * gx + gy * gy
    return np.sqrt(g)


def _juzgar_region(ctx, m, sl, opts, otra=None):
    """¿La componente `m` (recorte `sl` del mapa completo) es una región propia? Sólida (> `solidez`) y
    separada de la clase vecina por un ESCALÓN de color: el salto medido lejos de la frontera (7–8 px de
    referencia a cada lado) supera `de_anillo` y no es mayor que `meseta` veces el salto a 4–5 px. En una banda de un
    degradado el salto crece con la distancia (la frontera del cluster es arbitraria) y la prueba falla.
    `otra`: máscara (completa) de la clase con la que se fundiría; su parte en el anillo debe ser ≥ `anillo_otra`.
    Devuelve un dict con las medidas si pasa, si no None."""
    S, L, G = ctx['S'], ctx['L'], ctx['G']
    a = int(m.sum())
    pts = np.argwhere(m)[:, ::-1].astype(np.int32)
    hull = cv2.convexHull(pts)
    sol = a / (cv2.contourArea(hull) + 0.5 * cv2.arcLength(hull, True) + 1)
    # H17: con la meseta medida sobre Lanczos, una banda ancha y ondulada (solidez baja) con un escalón
    # pequeño pero perfectamente plano (ΔE 4–5, razón lejos/cerca en ±`meseta_plano`) también es región propia
    plano = opts.get('de_plano')
    sol_baja = sol < opts.get('solidez', 0.75)
    if sol_baja and not (plano and sol >= opts.get('solidez_plano', 0.35)):
        return None
    k1 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * S + 1,) * 2)
    mu = m.astype(np.uint8)
    an = (cv2.dilate(mu, k1) > 0) & ~m & ctx['mascara'][sl]
    if an.sum() < 4 * S:
        return None
    if otra is not None:
        o = otra[sl]
        if o[an].mean() < opts.get('anillo_otra', 0.25):
            return None
        an = an & o          # contraste y nitidez se miden solo en la frontera con la clase que la absorbería
    # meseta: el salto de color a través de la frontera con la otra clase es el mismo cerca (S..2S) y
    # lejos (3S..4S) de ella. En una banda de un degradado el salto crece con la distancia (pendiente).
    Ls = L[sl]
    din = ndi.distance_transform_edt(m)
    o = otra[sl] if otra is not None else ~m
    dout = ndi.distance_transform_edt(~o)          # distancia a la otra clase (para el lado de dentro)
    dfuera = ndi.distance_transform_edt(~m)
    lado = dout <= din + 2 * S                      # parte de la región que mira hacia la otra clase

    def salto(d1, d2):
        a_in = m & lado & (din >= d1) & (din < d2)
        a_out = o & (dfuera >= d1) & (dfuera < d2)
        if a_in.sum() < 4 * S or a_out.sum() < 4 * S:
            return None
        return float(np.linalg.norm(np.median(Ls[a_in], axis=0) - np.median(Ls[a_out], axis=0)))
    # a 4–5 y 7–8 px de referencia (el borde del ESRGAN/corrección de color ocupa ~2–3 px). Una región más
    # delgada (radio inscrito < 7 px: bandas de borde, trazos) no se escinde: en R8 partía el borde naranja
    cerca, lejos = salto(4 * S, 5 * S), salto(7 * S, 8 * S)
    if cerca is None or lejos is None:
        return {'falta': True} if opts.get('_medir') else None
    nit = lejos / max(cerca, 0.5)
    if opts.get('_medir'):
        return {'sol': round(float(sol), 2), 'cerca': round(cerca, 2), 'lejos': round(lejos, 2)}
    if sol_baja or lejos <= opts.get('de_anillo', 5.0):
        mp = opts.get('meseta_plano', 0.1)
        if not (plano and lejos > plano and abs(nit - 1) <= mp):
            return None
    if nit > opts.get('meseta', 1.3):
        return None
    de = lejos
    return {'color': np.median(Ls[m], axis=0), 'area': round(a / S / S, 1), 'solidez': round(float(sol), 2), 'de_anillo': round(de, 2),
            'meseta': round(nit, 2), 'cerca': round(cerca, 2)}


def _componentes(m, S, amin, amax, max_n=25):
    """Componentes de `m` (tras una apertura de S/2 que quita las franjas de antialias) entre amin y amax
    px, de mayor a menor: [(máscara recortada, slice con margen), ...]."""
    r = max(1, S // 2)
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN,
                         cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1,) * 2))
    n, cc, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    H, W = m.shape
    out = []
    for j in np.argsort(-st[1:, cv2.CC_STAT_AREA])[:max_n] + 1:
        a = st[j, cv2.CC_STAT_AREA]
        if a < amin:
            break
        if a > amax:
            continue
        x, y, w, h = st[j, :4]
        g = 9 * S + 2
        sl = (slice(max(0, y - g), min(H, y + h + g)), slice(max(0, x - g), min(W, x + w + g)))
        out.append((cc[sl] == j, sl))
    return out


def _region_propia(ctx, g_menor, g_mayor, opts):
    """H16: el cluster menor forma al menos una región propia que se perdería al fundirlo con el mayor."""
    S, idx0 = ctx['S'], ctx['idx0']
    m = np.isin(idx0, g_menor)
    otra = np.isin(idx0, g_mayor)
    amin = opts.get('area_min', 9.0) * S * S * ctx['escala'] ** 2      # px² de referencia
    amax = opts.get('area_max', 0.25) * ctx['mascara'].sum()
    total = max(1, int(m.sum()))
    for cm, sl in _componentes(m, S, amin, amax):
        r = _juzgar_region(ctx, cm, sl, opts, otra)
        if r:
            r['frac'] = round(cm.sum() / total, 2)
            r['_zona'] = (cm, sl)
            return r
    return None


def _residuos_locales(L, plano, C, S, opts, diag):
    """H16, residuos por región: ventanas de `ventana` px de referencia (paso la mitad). En cada una, los
    píxeles planos con ΔE76 > `de_local` contra toda la paleta se agrupan con un k-means local (k ≤ 3); un
    centro se añade si cubre ≥ `frac` de la ventana en una región propia (sólida, borde nítido) y queda a
    > `de_local` de la paleta y de los ya añadidos."""
    de_local = opts.get('de_local', 6.0)
    frac = opts.get('frac', 0.003)
    win = int(opts.get('ventana', 48) * S)
    paso = max(1, win // 2)
    H, W = L.shape[:2]
    d = distancia_min(L, C)
    cand = plano & (d > de_local)
    cand = ndi.binary_opening(cand, iterations=1)
    if not cand.any():
        return []
    G = _gradiente(L, S)
    nuevos, vistos = [], set()
    amin_w = frac * win * win
    for y in range(0, max(1, H - win // 2), paso):
        for x in range(0, max(1, W - win // 2), paso):
            sub = cand[y:y + win, x:x + win]
            n = int(sub.sum())
            if n < amin_w:
                continue
            px = L[y:y + win, x:x + win][sub].astype(np.float32)
            k = int(min(3, max(1, n // 200)))
            cv2.setRNGSeed(0)
            crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.2)
            _, lk, cen = cv2.kmeans(px, k, None, crit, 1, cv2.KMEANS_PP_CENTERS)
            for c in range(k):
                sel = lk.ravel() == c
                if sel.sum() < amin_w:
                    continue
                med = np.median(px[sel], axis=0)
                todos = list(C) + nuevos
                if min(np.linalg.norm(med - t) for t in todos) <= de_local:
                    continue
                # región propia: píxeles (de toda la ventana ampliada) a < de_local/2 de este color
                y0, y1, x0, x1 = max(0, y - win // 2), min(H, y + win + win // 2), max(0, x - win // 2), min(W, x + win + win // 2)
                Lw = L[y0:y1, x0:x1]
                cerca = np.sqrt(((Lw - med) ** 2).sum(-1)) < de_local / 2
                ctx = {'S': S, 'L': Lw, 'G': G[y0:y1, x0:x1], 'mascara': np.ones(cerca.shape, bool)}
                ok = None
                for cm, sl in _componentes(cerca, S, amin_w, 0.5 * cerca.size, max_n=3):
                    ok = _juzgar_region(ctx, cm, sl, opts)
                    if ok:
                        break
                if not ok:
                    continue
                nuevos.append(med)
                ok.pop('color', None)
                diag['locales'].append((hex_de_lab(med), (x // S, y // S), ok))
                if len(nuevos) >= opts.get('max_locales', 6):
                    return nuevos
    return nuevos


def colores_detalle(L, C, S, mascara=None, umbral_tinta=12.0, lejos=12.0, juntar=10.0, max_nuevos=4,
                    oscuros_max=0.15):
    """Añade a la paleta el color de las manchitas oscuras compactas (ojo de la insignia, botones) que el
    k-means ignora por pequeñas: mínimos locales de L (blackhat, disco 4·S), de 0.5 a 200 px² de referencia,
    cuyo núcleo está a ΔE76 > `lejos` de toda la paleta. Sin esto se clasifican con el color oscuro más
    cercano (azul marino de la pantalla, marrón de línea) y quedan como motas de color equivocado."""
    Lc = np.ascontiguousarray(L[..., 0], np.float32)
    r = max(2, 2 * S)
    bh = cv2.morphologyEx(Lc, cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1,) * 2))
    t0 = bh > umbral_tinta
    if mascara is not None:
        t0 &= mascara
    cc, k = ndi.label(t0)
    if not k:
        return C
    pico = ndi.maximum(bh, cc, np.arange(1, k + 1))
    t = t0 & (bh >= 0.45 * np.concatenate([[0], pico])[cc])
    cc, k = ndi.label(t)
    tam = np.bincount(cc.ravel(), minlength=k + 1)
    a_min, a_max = max(2, int(0.5 * S * S)), int(200 * S * S)
    k_an = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * max(1, S // 2) + 1,) * 2)
    H, W = Lc.shape
    cands = []
    for j, sl in enumerate(ndi.find_objects(cc), start=1):
        if sl is None or not (a_min <= tam[j] <= a_max):
            continue
        y0, y1 = max(0, sl[0].start - S), min(H, sl[0].stop + S)
        x0, x1 = max(0, sl[1].start - S), min(W, sl[1].stop + S)
        m = cc[y0:y1, x0:x1] == j
        an = cv2.dilate(m.astype(np.uint8), k_an).astype(bool) & ~m & ~t[y0:y1, x0:x1]
        if not an.any():
            continue
        lm = Lc[y0:y1, x0:x1]
        lt = np.median(lm[m])
        la = lm[an]
        if (la < lt + 2).mean() > oscuros_max or la.mean() - lt < umbral_tinta:
            continue
        # compacta (no una rayita larga): el ancho máximo es al menos 1/3 del lado mayor de la caja
        ancho = 2 * ndi.distance_transform_edt(np.pad(m, 1))[1:-1, 1:-1].max()
        if ancho < max(m.shape) / 3 - 2 * S:
            continue
        # suelta sobre UN relleno (no un halo entre dos colores)
        ia = np.argmin(((L[y0:y1, x0:x1][an][:, None, :] - C[None]) ** 2).sum(-1), axis=1)
        if np.bincount(ia).max() < 0.7 * len(ia):
            continue
        # color de toda la mancha (el núcleo del ESRGAN sale más oscuro que la referencia)
        c = np.median(L[y0:y1, x0:x1][m], axis=0)
        if np.sqrt(((C - c) ** 2).sum(-1)).min() > lejos:
            cands.append((c, int(tam[j])))
    nuevos = []
    for c, a in sorted(cands, key=lambda x: -x[1]):
        for nv in nuevos:
            if np.linalg.norm(nv[0] / nv[1] - c) < juntar:
                nv[0] += c * a
                nv[1] += a
                break
        else:
            nuevos.append([c * a, a])
    nuevos = [nv[0] / nv[1] for nv in sorted(nuevos, key=lambda x: -x[1])[:max_nuevos]]
    if nuevos:
        C = np.vstack([C, np.array(nuevos, np.float32)])
    colores_detalle.ultimos = nuevos
    return C


def distancia_min(L, C):
    d = np.full(L.shape[:2], np.inf, np.float32)
    for c in C:
        d = np.minimum(d, np.sqrt(((L - c) ** 2).sum(-1)))
    return d


def clasificar(L, C, zonas=None):
    """Color más cercano en Lab. `zonas` {índice: máscara}: ese centro solo compite dentro de su máscara
    (colores escindidos de una región propia, H16)."""
    best = np.full(L.shape[:2], np.inf, np.float32)
    idx = np.zeros(L.shape[:2], np.int16)
    for i, c in enumerate(C):
        d = ((L - c) ** 2).sum(-1)
        if zonas and i in zonas:
            d[~zonas[i]] = np.inf
        m = d < best
        best[m] = d[m]
        idx[m] = i
    return idx


def reasignar(idx, malos):
    """Los píxeles `malos` toman la clase del píxel bueno más cercano."""
    if not malos.any():
        return idx
    _, (iy, ix) = ndi.distance_transform_edt(malos, return_indices=True)
    out = idx.copy()
    out[malos] = idx[iy[malos], ix[malos]]
    return out


_ultima_proteccion = None  # depuración: última máscara de protección (1 tinta, 2 compacto)


def proteccion(idx, n, L, C, S, escala=1.0, umbral_tinta=12.0, de_compacto=25.0, solidez_min=0.8,
               oscuros_max=0.15, dominante_min=0.75, media_altura=0.45, homogeneo_min=0.7,
               de_homogeneo=12.0, ancho_franja=5, contornos=False, ancho_min=0.75,
               de_color=20.0, manchas=False):
    """Detalle que la limpieza no debe borrar (H4).

    Devuelve (prot int8: 0 nada, 1 tinta fina, 2 compacto; idx con la tinta unificada en una clase).
    - tinta: píxeles con blackhat(L, disco de diámetro 4·S) > umbral, agrupados sin mirar la clase (el
      antialias reparte una rayita fina entre varias clases). Cada grupo se recorta a media altura de su
      pico y es candidato si es un mínimo local de luminancia (casi ningún vecino más oscuro: así las
      franjas de antialias junto a una línea, que tienen la línea al lado, no pasan). Se protege si es una
      rayita suelta sobre UN relleno (pliegue, ceja, boca, ojo de la insignia) o, en modo miniatura, también
      si es contorno entre dos rellenos. Modo miniatura (contornos='auto'): la mediana del ancho de la tinta
      es menor que la apertura de la limpieza de franjas, que si no borraría todas las líneas (S3 al 30 %).
      Los grupos grandes solo se protegen si son finos (los gruesos ya sobreviven). Todo el grupo toma la
      clase mayoritaria de su núcleo, para que no quede partido.
    - compacto: componentes de una clase, macizos (solidez > 0.8), rodeados casi por completo de una sola
      clase con ΔE > 25 contra ella: brillos, botones, puntos.
    """
    Lc = np.ascontiguousarray(L[..., 0], np.float32)
    r = max(2, int(round(2 * S * escala)))
    disco = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1,) * 2)
    bh = cv2.morphologyEx(Lc, cv2.MORPH_BLACKHAT, disco)
    a_min = max(2, int(round(0.5 * S * S)))                 # 0.5 px² de referencia
    a_max = int((14 * S * escala) ** 2)                     # más grande solo si es fino
    anillo_r = max(1, S // 2)
    k_an = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * anillo_r + 1,) * 2)
    H, W = idx.shape
    prot = np.zeros(idx.shape, np.int8)
    idx = idx.copy()

    def caja(sl, m=anillo_r + 1):
        return (max(0, sl[0].start - m), min(H, sl[0].stop + m), max(0, sl[1].start - m), min(W, sl[1].stop + m))

    # ---- tinta fina
    t0 = bh > umbral_tinta
    cc, k = ndi.label(t0)
    cands = []
    if k:
        pico = ndi.maximum(bh, cc, np.arange(1, k + 1))
        t = t0 & (bh >= media_altura * np.concatenate([[0], pico])[cc])
        cc, k = ndi.label(t)
        tam = np.bincount(cc.ravel(), minlength=k + 1)
        for j, sl in enumerate(ndi.find_objects(cc), start=1):
            if sl is None or tam[j] < a_min:
                continue
            y0, y1, x0, x1 = caja(sl)
            m = cc[y0:y1, x0:x1] == j
            ancho = 2 * ndi.distance_transform_edt(np.pad(m, 1))[1:-1, 1:-1].max()
            if tam[j] > a_max and ancho > ancho_franja + 1:
                continue
            an = cv2.dilate(m.astype(np.uint8), k_an).astype(bool) & ~m & ~t[y0:y1, x0:x1]
            if not an.any():
                continue
            lm = Lc[y0:y1, x0:x1]
            lt = np.median(lm[m])
            la = lm[an]
            if (la < lt + 2).mean() > oscuros_max or la.mean() - lt < umbral_tinta:
                continue
            cnt = np.bincount(idx[y0:y1, x0:x1][an], minlength=n)
            dom = int(cnt.argmax())
            cerca = np.linalg.norm(C - C[dom], axis=1) < de_homogeneo
            suelta = cnt[cerca].sum() >= homogeneo_min * cnt.sum()
            # mancha compacta (ojo de la insignia): hoy lineas.detectar la toma por línea y la recolorea con
            # el tono del dueño, así que protegerla deja una mota de color equivocado -> solo con `manchas`
            largo = max(sl[0].stop - sl[0].start, sl[1].stop - sl[1].start)
            if largo < 3 * ancho and not manchas:
                continue
            cands.append(((y0, y1, x0, x1), m, suelta, ancho, int(tam[j])))
    if contornos == 'auto':
        # ancho típico de la tinta: mediana de 2·distancia al borde sobre el esqueleto de toda la tinta
        contornos = False
        if k:
            from skimage.morphology import skeletonize
            sk = skeletonize(t)
            if sk.sum() > 50:
                w = 2 * ndi.distance_transform_edt(t)[sk]
                proteccion.ancho_tinta = float(np.median(w))
                contornos = proteccion.ancho_tinta < ancho_franja
    proteccion.modo_miniatura = bool(contornos)
    for (y0, y1, x0, x1), m, suelta, ancho, _ in cands:
        # un contorno entre dos rellenos solo en modo `contornos`, y con ancho ≥ 0.75 px de referencia
        # (los halos oscuros del ESRGAN/JPEG pegados a un borde son más finos)
        if not (suelta or (contornos and ancho >= ancho_min * S)):
            continue
        nucleo = m & (bh[y0:y1, x0:x1] >= 0.8 * bh[y0:y1, x0:x1][m].max())
        ci = int(np.bincount(idx[y0:y1, x0:x1][nucleo], minlength=n).argmax())
        # sin un color de la paleta parecido, protegerla solo deja una mota de color equivocado
        if de_color and np.linalg.norm(np.median(L[y0:y1, x0:x1][m], axis=0) - C[ci]) > de_color:
            continue
        idx[y0:y1, x0:x1][m] = ci
        prot[y0:y1, x0:x1][m] = 1
    # ---- detalles compactos
    for i in range(n):
        cc, k = ndi.label((idx == i) & (prot == 0))
        if not k:
            continue
        tam = np.bincount(cc.ravel(), minlength=k + 1)
        for j, sl in enumerate(ndi.find_objects(cc), start=1):
            a = tam[j]
            if sl is None or a < a_min or a > a_max:
                continue
            y0, y1, x0, x1 = caja(sl)
            m = cc[y0:y1, x0:x1] == j
            an = cv2.dilate(m.astype(np.uint8), k_an).astype(bool) & ~m
            if not an.any():
                continue
            vec = idx[y0:y1, x0:x1][an]
            cnt = np.bincount(vec, minlength=n)
            dom = int(cnt.argmax())
            if dom == i or cnt[dom] < dominante_min * len(vec) or np.linalg.norm(C[i] - C[dom]) <= de_compacto:
                continue
            pts = np.argwhere(m)[:, ::-1].astype(np.int32)
            if len(pts) < 3:
                continue
            hull = cv2.convexHull(pts)
            ah = cv2.contourArea(hull) + 0.5 * cv2.arcLength(hull, True) + 1
            if a / ah >= solidez_min:
                prot[y0:y1, x0:x1][m] = 2
    return prot, idx


def limpiar(idx, n, radio_franja=2, min_area=48, moda=5, L=None, C=None, S=4, proteger=False, escala=1.0,
            exento=None, **kw_prot):
    """Quita franjas de antialias, motas y dientes del mapa de clases.

    Con `proteger` (flag experimentos.proteger_detalle) la tinta fina y los detalles compactos
    (ver `proteccion`) no cuentan como franja, no votan ni se pisan en el filtro de moda y solo caen por
    área si miden menos de 0.5 px² de referencia.
    `exento` (H17): máscara donde no se quitan franjas ni corre el filtro de moda (la zona Lanczos ya quedó
    en 2 clases con `dos_clases`; ahí la apertura cortaba en guiones las franjas de 1.5 px de S4).
    """
    global _ultima_proteccion
    prot = None
    _ultima_proteccion = None
    if proteger and L is not None and C is not None:
        tipo, idx = proteccion(idx, n, L, C, S, escala, ancho_franja=2 * radio_franja + 1, **kw_prot)
        _ultima_proteccion = tipo
        prot = tipo > 0
        if not prot.any():
            prot = None
    disco = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * radio_franja + 1,) * 2)
    malos = np.zeros(idx.shape, bool)
    for i in range(n):
        m = (idx == i).astype(np.uint8)
        if not m.any():
            continue
        nucleo = cv2.morphologyEx(m, cv2.MORPH_OPEN, disco)
        cerca = cv2.dilate(nucleo, disco)
        malos |= (m > 0) & (cerca == 0)
    if prot is not None:
        malos &= ~prot
    if exento is not None:
        malos &= ~exento
    idx = reasignar(idx, malos)
    # filtro de moda: cada píxel toma la clase mayoritaria en su vecindario
    if moda:
        votos = np.zeros(idx.shape, np.float32)
        out = idx.copy()
        for i in range(n):
            v = cv2.blur((idx == i).astype(np.float32), (moda, moda))
            m = v > votos
            votos[m] = v[m]
            out[m] = i
        if prot is not None:
            out[prot] = idx[prot]
        if exento is not None:
            out[exento] = idx[exento]
        idx = out
    # motas: componentes diminutos
    malos = np.zeros(idx.shape, bool)
    a_prot = max(2, int(round(0.5 * S * S)))
    for i in range(n):
        cc, k = ndi.label(idx == i)
        if k:
            tam = ndi.sum(np.ones_like(cc), cc, range(1, k + 1))
            chicos = np.where(tam < min_area)[0] + 1
            if prot is not None and len(chicos):
                # un componente con detalle protegido solo cae si es menor que 0.5 px² de referencia
                protegidos = ndi.maximum(prot, cc, chicos) > 0
                chicos = chicos[~protegidos | (tam[chicos - 1] < a_prot)]
            if len(chicos):
                malos |= np.isin(cc, chicos)
    return reasignar(idx, malos)


def paleta_de_config(cfg_paleta):
    """{'nombre': 'HEX' | ['HEX', ...]} -> (nombres, centros Lab, índice de color por centro)."""
    nombres, cen, de = [], [], []
    for k, (nombre, v) in enumerate(cfg_paleta.items()):
        nombres.append(nombre)
        for h in ([v] if isinstance(v, str) else v):
            cen.append(lab(hexrgb(h)[None, None])[0, 0])
            de.append(k)
    return nombres, np.array(cen, np.float32), np.array(de)


def hex_de_lab(c):
    return rgbhex(rgb_de_lab(np.asarray(c)[None, None])[0, 0])


# ------------------------------------------------------------------ H17: antialias a 2 clases (r3 paleta)
def dos_clases(idx, L, C, zona, S, ventana=3.0, perp_abs=6.0, perp_rel=0.25, de_variante=20.0, t_max=1.5,
               de_distinta=15.0, dominio=0.8):
    """H17 (3): dentro de `zona` (estructura que el ESRGAN perdió, clasificada sobre Lanczos), cada píxel
    de una clase que no es una de las 2 mayoritarias de su ventana (`ventana`·S de lado) pasa a la más
    cercana de esas 2 (en Lab, por el color del propio píxel) si su clase es antialias entre ellas o una
    variante de una de ellas:
    - entre: la proyección de su color sobre el segmento a→b cae en (0, 1) a menos de
      max(`perp_abs`, `perp_rel`·|ab|) del segmento (franja intermedia de borde);
    - variante: queda a < `de_variante` del extremo más cercano, del lado de afuera del segmento
      (t < `t_max`, mismo eje): núcleos más oscuros de una franja fina, brillo del ESRGAN.
    Una clase que no es ni una cosa ni la otra (línea oscura entre dos rellenos claros) se conserva.
    La segunda mayoritaria es la más frecuente a ΔE > `de_distinta` de la primera (dos tonos de la misma
    franja no cuentan como las 2 clases). Solo donde esas 2 clases dominan la ventana (≥ `dominio` de sus
    píxeles): donde se juntan 3 o más clases reales (ojo: esclera, iris, pupila, piel, línea) no se toca.
    Así el panel de franjas queda en 2 clases sin clases intermedias de borde."""
    if zona is None or not zona.any():
        return idx
    ys, xs = np.nonzero(zona)
    r = int(round(ventana * S))
    H, W = idx.shape
    y0, y1, x0, x1 = max(0, ys.min() - r), min(H, ys.max() + r + 1), max(0, xs.min() - r), min(W, xs.max() + r + 1)
    sub = idx[y0:y1, x0:x1]
    z = zona[y0:y1, x0:x1]
    cl = np.unique(sub)
    if len(cl) < 3:
        return idx
    k = 2 * r + 1
    zy, zx = np.nonzero(z)
    cnt = np.empty((len(cl), len(zy)), np.float32)
    for j, c in enumerate(cl):
        cnt[j] = cv2.boxFilter((sub == c).astype(np.float32), -1, (k, k), normalize=False)[zy, zx]
    ia = cnt.argmax(0)
    Dc = np.sqrt(((C[cl][:, None] - C[cl][None]) ** 2).sum(-1))
    cnt2 = np.where(Dc[ia].T > de_distinta, cnt, -1)
    ib = cnt2.argmax(0)
    ar = np.arange(len(ib))
    valido = (cnt2[ib, ar] > 0) & (cnt[ia, ar] + cnt2[ib, ar] >= dominio * k * k)
    a, b = cl[ia], cl[ib]
    cur = sub[zy, zx]
    otra = (cur != a) & (cur != b) & valido
    if not otra.any():
        return idx
    Ca, Cb, Cc = C[a[otra]], C[b[otra]], C[cur[otra]]
    ab = Cb - Ca
    nab = np.maximum((ab ** 2).sum(-1), 1e-6)
    t = ((Cc - Ca) * ab).sum(-1) / nab
    perp = np.sqrt(((Cc - (Ca + t[:, None] * ab)) ** 2).sum(-1))
    lim = np.maximum(perp_abs, perp_rel * np.sqrt(nab))
    entre = (t > 0) & (t < 1) & (perp < lim)
    da, db = np.sqrt(((Cc - Ca) ** 2).sum(-1)), np.sqrt(((Cc - Cb) ** 2).sum(-1))
    variante = ((t >= 1) & (t < t_max) & (db < de_variante)) | ((t <= 0) & (t > 1 - t_max) & (da < de_variante))
    ok = entre | variante
    if not ok.any():
        return idx
    sel = np.nonzero(otra)[0][ok]
    py, px = zy[sel], zx[sel]
    Lp = L[y0:y1, x0:x1][py, px]
    ga, gb = a[sel], b[sel]
    nuevo = np.where(((Lp - C[ga]) ** 2).sum(-1) <= ((Lp - C[gb]) ** 2).sum(-1), ga, gb)
    out = idx.copy()
    out[y0 + py, x0 + px] = nuevo
    dos_clases.ultimo = int(len(sel))
    return out


def pares_bloqueados(C, tol=4.0):
    """Pares de clases finales que la fusión espacial NO fundió (bandas de tonos cercanos, H16/H17), según
    `paleta_auto.diag['bloqueos']` (colores al momento del bloqueo -> clase final más cercana a < `tol`)."""
    diag = getattr(paleta_auto, 'diag', None) or {}
    out = []
    for a, b, *_ in diag.get('bloqueos', []):
        ia, ib = (int(np.argmin(np.linalg.norm(C - lab(hexrgb(h)[None, None])[0, 0], axis=1))) for h in (a, b))
        da = np.linalg.norm(C[ia] - lab(hexrgb(a)[None, None])[0, 0])
        db = np.linalg.norm(C[ib] - lab(hexrgb(b)[None, None])[0, 0])
        if ia != ib and da < tol and db < tol:
            out.append((ia, ib))
    return out


def suavizar_tenues(idx, C, S, de_max=8.0, sigma=1.5, zona=None, pares=None):
    """H17: las fronteras entre clases de bajo contraste (ΔE76 < `de_max`: bandas de tonos cercanos, sombras
    de piel) salen onduladas y con muescas, porque el escalón es apenas mayor que el ruido; potrace las
    traza con muchos nodos. Cada píxel de un grupo de clases tenues (unidas por pares con ΔE < `de_max`)
    pasa a la clase del grupo con más peso en un entorno gaussiano (σ = `sigma` px de referencia). Solo se
    mueven píxeles entre clases del mismo grupo; las demás clases no se tocan. `zona` limita dónde.
    `pares`: solo esos pares de clases (p. ej. `pares_bloqueados`) forman grupos; None = todos los cercanos
    (ojo: con todos, la ceja granate de Ceti se funde con el contorno, ΔE < 8)."""
    n = len(C)
    D = np.sqrt(((C[:, None] - C[None]) ** 2).sum(-1))
    padre = list(range(n))

    def raiz(i):
        while padre[i] != i:
            padre[i] = padre[padre[i]]
            i = padre[i]
        return i
    presentes = np.bincount(idx.ravel(), minlength=n) > 0
    todos = [(i, j) for i in range(n) for j in range(i + 1, n)]
    if pares is not None:
        # las clases de un par bloqueado y sus vecinas tenues (la banda 3–4 de S4 nunca llegó a bloquearse
        # porque su ΔE ya pasaba la fusión)
        B = {c for p in pares for c in p}
        cand = [(i, j) for i, j in todos if i in B or j in B]
    else:
        cand = todos
    for i, j in cand:
        if presentes[i] and presentes[j] and D[i, j] < de_max:
            padre[raiz(i)] = raiz(j)
    grupos = {}
    for i in range(n):
        if presentes[i]:
            grupos.setdefault(raiz(i), []).append(i)
    out = idx.copy()
    s = sigma * S
    for g in grupos.values():
        if len(g) < 2:
            continue
        mg = np.isin(idx, g)
        if zona is not None:
            mg &= zona
        if not mg.any():
            continue
        ys, xs = np.nonzero(mg)
        m = int(3 * s) + 1
        y0, y1, x0, x1 = max(0, ys.min() - m), ys.max() + m + 1, max(0, xs.min() - m), xs.max() + m + 1
        sub = idx[y0:y1, x0:x1]
        sel = mg[y0:y1, x0:x1]
        best = np.full(sub.shape, -1.0, np.float32)
        arg = sub.copy()
        for c in g:
            v = cv2.GaussianBlur((sub == c).astype(np.float32), (0, 0), s)
            mk = v > best
            best[mk] = v[mk]
            arg[mk] = c
        o = out[y0:y1, x0:x1]
        o[sel] = arg[sel]
    return out
