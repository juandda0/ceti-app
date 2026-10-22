"""Líneas de la referencia -> borde en tono más oscuro del relleno dueño.

1. Una clase de color es "línea" si la mayoría de sus píxeles forman trazos delgados (desaparecen con una
   apertura del ancho de la línea) y más oscuros que su entorno (black-hat), y su croma no es mucho mayor
   que el del vecino (una pulsera roja delgada no es una línea: es un objeto).
2. Para cada píxel de línea se buscan los dos rellenos más cercanos (uno por lado). Si el otro lado es
   fondo o no hay otro lado (pliegues, boca, dedos), el dueño es el único relleno.
3. Entre dos rellenos A y B el dueño se decide por par (coherente a lo largo de toda la línea):
   el que tenga su tono oscuro más parecido al color real de la línea (el pelo se delinea con marrón oscuro,
   la cara con rojizo); empate -> el más encerrado (los detalles van encima).
"""
import cv2
import numpy as np
from scipy import ndimage as ndi


def oscuro(c, dl=14.0, croma=1.15):
    c = np.array(c, np.float32)
    return np.array([max(0.0, c[0] - dl), c[1] * croma, c[2] * croma], np.float32)


KW_CALIBRADO = ('k_croma', 'giro', 'subir_croma', 'matiz_max', 'l_marron')


def kw_calibrado(bc):
    """Parámetros de `oscuro_calibrado` que vienen en el dict del flag `borde_calibrado`."""
    return {x: bc[x] for x in KW_CALIBRADO if x in bc} if isinstance(bc, dict) else {}


def oscuro_calibrado(c, lin, dl=14.0, k_croma=1.1, giro=0.0, subir_croma=False, matiz_max=None, croma_v1=1.15,
                     l_marron=None):
    """H2 (flag experimentos.borde_calibrado): tono oscuro del dueño calibrado contra el color real de su línea.
    L = min(L_dueño − dl, L_línea + 4) (si L_dueño − dl < 20, acotada a [L_línea − 4, L_dueño]); matiz del dueño;
    croma = min(croma_dueño, k_croma·croma_línea).
    Variantes (parámetros del flag): `subir_croma` -> croma = min(k_croma·croma_línea, max(croma_dueño,
    croma_línea)) (un dueño casi neutro no deja el borde gris); `giro` -> el matiz se gira hacia el de la línea
    hasta `giro` grados (sigue siendo un tono del dueño). Sin datos de línea (lin None) -> `oscuro` v1.
    `matiz_max` (grados): un contorno marrón (matiz 25–80°, croma ≥ 10: el contorno Gemini) sobre un dueño de
    otro matiz (|ΔH| > matiz_max y croma del dueño ≥ 10: traje crema, teal) no es "un tono del dueño": ahí
    manda la regla de marca v1 (`oscuro`), que es lo que dibuja el arte de marca (verdad de S1/S3).
    `l_marron` (H18): la puerta solo vale para el marrón MEDIO del contorno Gemini (L de la línea ≥ l_marron);
    un trazo oscuro tipo tinta (el borde #7A3E2B de S4, L≈25) es un trazo de marca y se calibra."""
    if lin is None:
        return oscuro(c, dl, croma_v1)
    c = np.asarray(c, np.float32)
    lin = np.asarray(lin, np.float32)
    if matiz_max is not None:
        cr_o0, cr_l0 = float(np.hypot(c[1], c[2])), float(np.hypot(lin[1], lin[2]))
        dh0 = abs((np.degrees(np.arctan2(lin[2], lin[1]) - np.arctan2(c[2], c[1])) + 180) % 360 - 180)
        h_l = np.degrees(np.arctan2(lin[2], lin[1])) % 360
        marron = cr_l0 >= 10 and 25 <= h_l <= 80 and (l_marron is None or lin[0] >= l_marron)
        if marron and not (cr_o0 < 10 or dh0 <= matiz_max):
            return oscuro(c, dl, croma_v1)
    l_ = min(c[0] - dl, lin[0] + 4.0)
    if c[0] - dl < 20:
        # dueño oscuro (cejas granate de Ceti): oscurecer 14 más lo vuelve negro -> no más oscuro que la propia
        # línea − 4 ni más claro que el dueño
        l_ = min(c[0], max(l_, lin[0] - 4.0))
    l_ = max(0.0, l_)
    cr_o = float(np.hypot(c[1], c[2]))
    cr_l = float(np.hypot(lin[1], lin[2]))
    cr = min(k_croma * cr_l, max(cr_o, cr_l)) if subir_croma else min(cr_o, k_croma * cr_l)
    if cr_o < 1e-6:
        return np.array([l_, 0.0, 0.0], np.float32)
    h = np.arctan2(c[2], c[1])
    if giro and cr_l > 1e-6:
        dh = (np.arctan2(lin[2], lin[1]) - h + np.pi) % (2 * np.pi) - np.pi
        h += float(np.clip(dh, -np.radians(giro), np.radians(giro)))
    return np.array([l_, cr * np.cos(h), cr * np.sin(h)], np.float32)


def tono_linea(L, linea, dueno, ancho, min_px=None):
    """H2: color real de la línea por dueño = mediana Lab del núcleo del trazo (dt > ancho/4) de los píxeles de
    línea de ese dueño. Devuelve {dueño: Lab} (solo dueños con ≥ min_px píxeles de núcleo)."""
    if min_px is None:
        min_px = max(4.0, ancho)
    dt = cv2.distanceTransform(linea.astype(np.uint8), cv2.DIST_L2, cv2.DIST_MASK_5)
    nuc = linea & (dt > ancho / 4) & (dueno >= 0)
    out = {}
    if not nuc.any():
        return out
    du, col = dueno[nuc], L[nuc]
    for o in np.unique(du):
        m = du == o
        if m.sum() >= min_px:
            out[int(o)] = np.median(col[m], axis=0).astype(np.float32)
    return out


def estimar_ancho(idx, L, C, fig, S):
    """Ancho típico de las líneas (px a escala de trabajo): mediana del grosor (2 x distancia al borde sobre el
    esqueleto) de las clases oscuras respecto a su entorno, ponderada por tamaño."""
    from skimage.morphology import skeletonize
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (24 * S + 1,) * 2)
    bh = cv2.morphologyEx(L[..., 0], cv2.MORPH_BLACKHAT, k)
    anchos, pesos = [], []
    for i in range(len(C)):
        m = (idx == i) & fig
        n = m.sum()
        if n < 200 * S or np.median(bh[m]) < 10:
            continue
        dt = ndi.distance_transform_edt(m)
        sk = skeletonize(m)
        w = 2 * dt[sk]
        if len(w) > 50:
            anchos.append(np.median(w))
            pesos.append(n)
    if not anchos:
        return 4.0 * S
    o = np.argsort(anchos)
    c = np.cumsum(np.array(pesos)[o])
    return float(np.array(anchos)[o][np.searchsorted(c, c[-1] / 2)])


def detectar(idx, L, C, fig, ancho, excluir=(), incluir=()):
    """Devuelve (mascara_de_linea, clases_linea)."""
    r = max(2, int(round(ancho * 0.62)))
    disco = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1,) * 2)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (4 * r + 1,) * 2)
    bh = cv2.morphologyEx(L[..., 0], cv2.MORPH_BLACKHAT, k)
    oscuro_ = bh > 6
    croma = np.hypot(C[:, 1], C[:, 2])
    clases = []
    delgado = np.zeros(idx.shape, bool)
    for i in range(len(C)):
        m = (idx == i) & fig
        n = m.sum()
        if n < 50:
            continue
        nucleo = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, disco) > 0
        d = m & ~nucleo
        frac = (d & oscuro_).sum() / n
        # croma del vecino: rellenos alrededor
        anillo = ndi.binary_dilation(m, iterations=r) & ~m & fig
        vec = idx[anillo]
        vec_croma = np.median(croma[vec]) if len(vec) else 0
        es = (frac > 0.5 and croma[i] <= max(45.0, vec_croma + 18)) or i in incluir
        if es and i not in excluir:
            clases.append(i)
            delgado |= d
    linea = np.isin(idx, clases) & fig & delgado
    # partes gruesas de una clase de línea (cruces, remates) también son línea si tocan un trazo
    gruesas = np.isin(idx, clases) & fig & ~delgado
    cc, n = ndi.label(gruesas)
    if n:
        tam = ndi.sum(gruesas, cc, range(1, n + 1))
        chicas = np.where(tam < (3 * ancho) ** 2)[0] + 1
        linea |= np.isin(cc, chicas)
    return linea, clases


def manchas_a_relleno(idx, L, C, fig, linea, clases, ancho, fondo_ids, k_nucleo=0.75, k_borde=1.0, k_banda=0.5,
                      k_area=6.0, min_contacto=0.2):
    """H18 (1) (flag experimentos.linea_esqueleto): la línea como trazo de ancho constante, no como mancha.

    Las partes gruesas de una clase de línea (lo que `detectar` dejó fuera de `linea` por no ser delgado: dedos y
    asa de S1, donde el contorno marrón con desenfoque y JPEG se funde en una mancha) se pintaban con el color de
    la línea como si fueran relleno. Ahora, por mancha (componente de la parte gruesa con área ≤ (k_area·ancho)²;
    las regiones grandes de una clase de línea, como el panel oscuro de la bolsa de R1 o el halo del reloj de R2,
    son rellenos reales y no se tocan):
    - esqueleto de la clase de línea + distancia al esqueleto;
    - núcleo = píxel a más de k_nucleo·ancho del esqueleto y a más de k_borde·ancho del fondo/fuera de la figura;
    - cerca de la mancha (≤ ancho) la línea se re-emite con ancho constante: banda de k_banda·ancho a cada lado del
      esqueleto, más la banda de contorno pegada al fondo (≤ k_borde·ancho) para que la silueta no pierda su borde;
    - lo demás de la mancha pasa a la clase de relleno vecina más cercana entre las que rodean la mancha con
      ≥ min_contacto de su anillo (no astillas de antialias), sin contar fondo ni clases de línea.
    Las líneas normales no cambian. Devuelve (idx, linea) nuevos."""
    from skimage.morphology import skeletonize
    if not len(clases):
        return idx, linea
    M = np.isin(idx, clases) & fig
    grueso = M & ~linea
    if not grueso.any():
        return idx, linea
    idx, linea = idx.copy(), linea.copy()
    H, W = idx.shape
    r = max(1, int(round(ancho)))
    disco = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1,) * 2)
    cc, n = ndi.label(grueso, structure=np.ones((3, 3), bool))
    tam = np.bincount(cc.ravel(), minlength=n + 1)
    m_ = int(4 * ancho) + 4
    for j, sl0 in enumerate(ndi.find_objects(cc), 1):
        if sl0 is None or tam[j] > (k_area * ancho) ** 2 or tam[j] < ancho:
            continue
        y0, y1 = max(0, sl0[0].start - m_), min(H, sl0[0].stop + m_)
        x0, x1 = max(0, sl0[1].start - m_), min(W, sl0[1].stop + m_)
        sl = (slice(y0, y1), slice(x0, x1))
        mj = cc[sl] == j
        idc, fic, lic = idx[sl], fig[sl], linea[sl]
        zona = cv2.dilate(mj.astype(np.uint8), disco) > 0
        c_ = int(np.bincount(idc[mj]).argmax())
        Mc = (idc == c_) & fic
        # la pieza de línea conectada a la mancha (esqueleto de su clase, sin cruzar a otras clases)
        sk = skeletonize(Mc)
        dsk = cv2.distanceTransform((~sk).astype(np.uint8), cv2.DIST_L2, cv2.DIST_MASK_5)
        fuera = ~fic | np.isin(idc, fondo_ids)
        dfuera = cv2.distanceTransform((~fuera).astype(np.uint8), cv2.DIST_L2, cv2.DIST_MASK_5)
        en_zona = Mc & zona
        nucleo = en_zona & (dsk > k_nucleo * ancho) & (dfuera > k_borde * ancho)
        banda = en_zona & ~nucleo & ((dsk <= k_banda * ancho) | (dfuera <= k_borde * ancho))
        a_relleno = en_zona & ~banda
        if not a_relleno.any():
            continue
        # vecinos de relleno de la mancha (anillo exterior de la zona)
        anillo = (cv2.dilate(en_zona.astype(np.uint8), disco) > 0) & ~M[sl] & fic & ~np.isin(idc, fondo_ids)
        if not anillo.any():
            continue
        cls, cnt = np.unique(idc[anillo], return_counts=True)
        cand = cls[cnt >= min_contacto * cnt.sum()]
        if not len(cand):
            cand = cls[[cnt.argmax()]]
        rell = np.isin(idc, cand) & fic & ~M[sl]
        _, (iy, ix) = ndi.distance_transform_edt(~rell, return_indices=True)
        nuevo = idc.copy()
        nuevo[a_relleno] = idc[iy[a_relleno], ix[a_relleno]]
        idx[sl] = nuevo
        lic = lic.copy()
        lic[a_relleno] = False
        lic[banda] = True
        linea[sl] = lic
    return idx, linea


def dos_vecinos(idx, rellenos, linea, clases_relleno, alcance):
    """Para cada píxel de línea: las dos clases de relleno más cercanas y sus distancias."""
    H, W = idx.shape
    ys, xs = np.nonzero(linea)
    d1 = np.full(len(ys), np.inf, np.float32)
    d2 = np.full(len(ys), np.inf, np.float32)
    c1 = np.full(len(ys), -1, np.int32)
    c2 = np.full(len(ys), -1, np.int32)
    # ventana alrededor de la línea para no calcular EDT en toda la imagen
    zona = ndi.binary_dilation(linea, iterations=int(alcance) + 2)
    # la EDT se calcula solo en la caja de la zona (mismo resultado: todo m cae dentro de ella)
    zy, zx = np.nonzero(zona)
    y0, y1, x0, x1 = zy.min(), zy.max() + 1, zx.min(), zx.max() + 1
    zona_c, rell_c, yc, xc = zona[y0:y1, x0:x1], rellenos[y0:y1, x0:x1], ys - y0, xs - x0
    for c in clases_relleno:
        m = (rell_c == c) & zona_c
        if not m.any():
            continue
        d = ndi.distance_transform_edt(~m)[yc, xc].astype(np.float32)
        mejor1 = d < d1
        mejor2 = ~mejor1 & (d < d2)
        d2 = np.where(mejor1, d1, np.where(mejor2, d, d2))
        c2 = np.where(mejor1, c1, np.where(mejor2, c, c2))
        d1 = np.where(mejor1, d, d1)
        c1 = np.where(mejor1, c, c1)
    return ys, xs, c1, d1, c2, d2


def asignar(idx, L, C, fig, linea, fondo_ids, ancho, duenos=None, dl=14.0, croma=1.15, area=None, por_rama=False,
            regla_l=6.0, calibrado=False, esqueleto=False):
    """Devuelve dueño por píxel de línea (array idx-shaped, -1 fuera de línea).

    calibrado (flag experimentos.borde_calibrado, H2; solo con por_rama):
    - par falso: si el segundo vecino b no toca la línea cerca del píxel (hay otro relleno a entre la línea y
      b), el píxel no es del par (a, b) sino solo de a. Así la mitad de una línea que pasa cerca de una mancha
      (la sonrisa de Tato sobre la barbilla) no se parte a lo largo en dos dueños (N1).
    - líneas libres: una rama del esqueleto que en su mayoría no tiene relleno a ninguno de sus dos lados
      (solo fondo: el aro del casco de R4) no es contorno de nada; se pinta entera con su propio color de
      referencia (un solo tono). Se codifica como dueño = -2 - clase (ver `pipeline`: código 2·clase + 1).

    por_rama (flag experimentos.dueno_por_rama): el dueño se decide por tramo del esqueleto de la línea (ver
    `_por_rama`) en vez de por la moda en una ventana de 3·ancho, que dejaba que un accesorio cercano (pulsera)
    se comiera la línea vecina. regla_l: margen de la regla "el dueño no es más oscuro que su línea"."""
    if por_rama:
        # la clase "piso" que queda dentro de la figura no es fondo: es un relleno que se le parece (en juan la
        # piel de la mano sale como piso y su contorno se quedaba sin dueño -> lo tomaba la pulsera). Fuera de la
        # figura todo es ya la clase fondo (idx_fuera), así que solo cuenta como fondo la clase que está fuera.
        fondo_ids = [f for f in fondo_ids if ((idx == f) & ~fig).any()] or list(fondo_ids)[:1]
    cal_kw = kw_calibrado(calibrado)
    cal_kw_l = calibrado.get('umbral_oscura', 25.0) if isinstance(calibrado, dict) else 25.0
    rellenos = np.where(linea, -1, idx)
    if por_rama:
        # los píxeles de color fondo DENTRO de la figura son brillos o astillas de antialias, no fondo (los
        # huecos de fondo grandes ya quedan fuera de `fig`): no cuentan como vecino de la línea
        rellenos[np.isin(idx, fondo_ids) & fig] = -1
        # halos: partes delgadas de una clase casi del color del fondo (ΔE76 < 12) pegadas a la línea por
        # fuera (antialias/JPEG); tampoco son dueños. Las partes gruesas (escleras, brillos grandes) sí cuentan.
        r = max(2, int(round(ancho / 4)))
        disco = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1,) * 2)
        # Lo mismo para las astillas delgadas de cualquier clase pegadas al borde exterior de la figura (antialias
        # entre el contorno y el fondo/piso, p. ej. la punta de la cola de Ceti).
        cf = np.asarray(C[fondo_ids[0]], np.float32)
        borde_ext = cv2.dilate((~fig).astype(np.uint8), disco) > 0
        for c in range(len(C)):
            if c in fondo_ids:
                continue
            m = ((rellenos == c) & fig).astype(np.uint8)
            if not m.any():
                continue
            delgado = (m > 0) & (cv2.morphologyEx(m, cv2.MORPH_OPEN, disco) == 0)
            if np.linalg.norm(np.asarray(C[c], np.float32) - cf) >= 12:
                delgado &= borde_ext
            rellenos[delgado] = -1
    clases = [c for c in np.unique(rellenos) if c >= 0]
    alcance = ancho * 1.6
    ys, xs, c1, d1, c2, d2 = dos_vecinos(idx, rellenos, linea, clases, alcance + 4)
    fondo = np.isin(c1, fondo_ids) | ~fig[ys, xs]
    col = L[ys, xs]
    dueno = np.full(len(ys), -1, np.int32)
    lado2 = d2 <= alcance
    # fondo de un lado: dueño el otro
    f1 = np.isin(c1, fondo_ids)
    f2 = np.isin(c2, fondo_ids)
    dueno[~f1] = c1[~f1]
    m = f1 & lado2 & ~f2
    dueno[m] = c2[m]
    # entre dos rellenos: decisión por par
    par = lado2 & ~f1 & ~f2
    par_ok = par
    if calibrado and por_rama and par.any():
        par_ok = par & _par_toca(rellenos, linea, ys, xs, c2, par, ancho)
    if area is None:
        area = {c: int((idx == c).sum()) for c in clases}
    pares = {}
    for a, b in set(zip(c1[par].tolist(), c2[par].tolist())):
        k = (min(a, b), max(a, b))
        if k in pares:
            continue
        sel = par & (((c1 == a) & (c2 == b)) | ((c1 == b) & (c2 == a)))
        ref = np.median(col[sel], axis=0)
        ea = np.linalg.norm(ref - oscuro(C[k[0]], dl, croma))
        eb = np.linalg.norm(ref - oscuro(C[k[1]], dl, croma))
        if duenos and k in duenos:
            pares[k] = duenos[k]
        elif calibrado and ref[0] <= min(C[k[0]][0], C[k[1]][0]) - cal_kw_l:
            # H2 (tablet): la línea es mucho más oscura que los dos lados, así que `oscuro` (L−14) de cualquiera
            # da un borde claro y no sirve para elegir. Gana el lado cuyo tono calibrado se parece más a la línea.
            ea = np.linalg.norm(ref - oscuro_calibrado(C[k[0]], ref, dl, **cal_kw))
            eb = np.linalg.norm(ref - oscuro_calibrado(C[k[1]], ref, dl, **cal_kw))
            pares[k] = k[0] if ea <= eb else k[1]
        elif abs(ea - eb) > 4:
            pares[k] = k[0] if ea < eb else k[1]
        else:
            pares[k] = k[0] if area.get(k[0], 0) < area.get(k[1], 0) else k[1]
    for (a, b), o in pares.items():
        sel = par_ok & (((c1 == a) & (c2 == b)) | ((c1 == b) & (c2 == a)))
        dueno[sel] = o
    out = np.full(idx.shape, -1, np.int32)
    out[ys, xs] = dueno
    if por_rama:
        clave = np.where(par_ok, np.minimum(c1, c2) * 4096 + np.maximum(c1, c2), dueno + 4096 * 4096)
        # sin relleno a ningún lado: fondo (o nada) cerca y ningún segundo relleno al alcance
        libre = (f1 | (c1 < 0)) & ~(lado2 & ~f2) if calibrado else None
        return _por_rama(idx, L, C, linea, ancho, ys, xs, dueno, clave, par_ok, c1, c2, pares, dl, croma,
                         regla_l, libre=libre,
                         oscura=dict(umbral=cal_kw_l, kw=cal_kw) if calibrado else None,
                         esq=_opts_esqueleto(esqueleto)), pares
    return _suavizar_v1(out, linea, ancho), pares


def _suavizar_v1(out, linea, ancho):
    """Regla v1: moda del dueño en una ventana de 3·ancho; píxeles sin dueño -> el más cercano."""
    # suavizado: el dueño cambia solo en tramos largos (sin picos donde la línea cruza otra)
    win = int(ancho * 3) | 1
    validos = [c for c in np.unique(out) if c >= 0]
    votos = np.zeros(out.shape, np.float32)
    best = out.copy()
    for c in validos:
        v = cv2.blur((out == c).astype(np.float32), (win, win))
        m = (v > votos) & linea
        votos[m] = v[m]
        best[m] = c
    best[~linea] = -1
    # píxeles de línea sin dueño (rodeados solo de fondo): el relleno más cercano
    sin = linea & (best < 0)
    if sin.any():
        con = best >= 0
        if con.any():
            _, (iy, ix) = ndi.distance_transform_edt(~con, return_indices=True)
            best[sin] = best[iy[sin], ix[sin]]
    return best


def _opts_esqueleto(e):
    """Opciones de H18 (flag experimentos.linea_esqueleto) para el dueño: None si está apagado."""
    if not e:
        return None
    o = dict(por_clase=True, de_familia=12.0, contacto=3.0, k_propia=0.6, continuidad=True, k_largo=6.0, frac_dom=0.5, cadenas=True,
             angulo=30.0)
    if isinstance(e, dict):
        o.update({k: v for k, v in e.items() if k in o})
    return o


def _familias(idx, lin, C, umbral, ancho=None, contacto=0.0):
    """Etiqueta de familia por píxel (las clases de línea a menos de `umbral` ΔE76 se unen, enlace simple)."""
    cl = [int(c) for c in np.unique(idx[lin]) if c >= 0]
    padre = {c: c for c in cl}

    def raiz(c):
        while padre[c] != c:
            padre[c] = padre[padre[c]]
            c = padre[c]
        return c
    for i, a in enumerate(cl):
        for b in cl[i + 1:]:
            if np.linalg.norm(np.asarray(C[a], np.float32) - np.asarray(C[b], np.float32)) < umbral:
                padre[raiz(a)] = raiz(b)
    lut = np.full(int(max(cl, default=0)) + 2, -1, np.int32)
    for c in cl:
        lut[c] = raiz(c)
    out = np.full(idx.shape, -1, np.int32)
    out[lin] = lut[np.clip(idx[lin], -1, len(lut) - 2)]
    if contacto and ancho:
        # dos familias que solo se tocan en un tramo corto (la punta de un surco que llega a la boca de Ceti: una
        # unión T) siguen siendo un solo trazo; solo se separan las que corren pegadas a lo largo (≥ contacto·ancho:
        # el contorno del antebrazo de juan junto al halo del indicador)
        fams = [f for f in np.unique(out[lin]) if f >= 0]
        k3 = np.ones((3, 3), np.uint8)
        dil = {f: cv2.dilate((out == f).astype(np.uint8), k3) > 0 for f in fams}
        for i, a in enumerate(fams):
            for b in fams[i + 1:]:
                n_ = int((dil[a] & (out == b)).sum())
                if 0 < n_ < contacto * ancho:
                    padre[raiz(a)] = raiz(b)
        for c in cl:
            lut[c] = raiz(c)
        out[lin] = lut[np.clip(idx[lin], -1, len(lut) - 2)]
    return out


def _ramas(linea, clase=None):
    """Esqueleto de la línea partido en ramas: se quitan las uniones T/Y (píxeles con ≥3 vecinos y su
    vecindad 3×3) y se etiquetan los tramos que quedan. Devuelve (etiquetas, n).
    clase (H18): esqueleto por clase de línea: dos trazos de color distinto que se tocan (contorno del antebrazo
    de juan y el halo del indicador, N27) no se funden en una mancha con un esqueleto de ramitas."""
    from skimage.morphology import skeletonize
    if clase is not None:
        lab = np.zeros(linea.shape, np.int32)
        union = np.zeros(linea.shape, bool)
        n = 0
        for c in np.unique(clase[linea]):
            m = linea & (clase == c)
            if m.sum() < 4:
                continue
            l_, k_, u_ = _ramas(m)
            lab[l_ > 0] = l_[l_ > 0] + n
            n += k_
            union |= u_
        return lab, n, union
    sk = skeletonize(linea)
    vec = cv2.filter2D(sk.astype(np.uint8), -1, np.ones((3, 3), np.float32), borderType=cv2.BORDER_CONSTANT)
    union = sk & (vec >= 4)
    union = ndi.binary_dilation(union, structure=np.ones((3, 3), bool))
    ramas = sk & ~union
    lab, n = ndi.label(ramas, structure=np.ones((3, 3), bool))
    return lab, n, union


def _cercano(fuente):
    """Para cada píxel: (distancia, índice plano del píxel de `fuente` más cercano). cv2 numera los píxeles
    fuente en orden de barrido, igual que np.flatnonzero."""
    d, lab = cv2.distanceTransformWithLabels((~fuente).astype(np.uint8), cv2.DIST_L2, cv2.DIST_MASK_5,
                                             labelType=cv2.DIST_LABEL_PIXEL)
    plano = np.r_[-1, np.flatnonzero(fuente)]
    return d, plano[lab]


def _unir(union, lab_r, plano_px, rama, res, resuelto, ancho, w):
    """Reasigna (en sitio) los píxeles de línea a menos de ancho/2 de una unión del esqueleto al dueño que
    comparten más ramas incidentes (al menos 2 y sin empate)."""
    h = union.shape[0]
    cu, nu = ndi.label(union, structure=np.ones((3, 3), bool))
    d_u, cerca_u = _cercano(union)
    cl = cu.ravel()[cerca_u.ravel()]               # unión más cercana a cada píxel
    dd = d_u.ravel()
    # dueño por píxel de esqueleto de rama (vía el píxel de línea que coincide con él)
    pos = np.full(h * w, -1, np.int64)
    pos[plano_px] = np.arange(len(plano_px))
    anillo = np.flatnonzero((lab_r > 0).ravel() & (dd <= 3))
    anillo = anillo[pos[anillo] >= 0]
    j = pos[anillo]
    ok = resuelto[j]
    tri = np.unique(np.stack([cl[anillo][ok], lab_r.ravel()[anillo][ok], res[j][ok]]), axis=1)
    if tri.shape[1] == 0:
        return
    # por (unión, dueño): cuántas ramas distintas lo traen
    par_, cnt = np.unique(tri[[0, 2]], axis=1, return_counts=True)
    mejor = np.full(nu + 1, -1, np.int64)
    top = np.zeros(nu + 1, np.int64)
    seg = np.zeros(nu + 1, np.int64)
    for (u, o), c in zip(par_.T, cnt):
        if c > top[u]:
            seg[u], top[u], mejor[u] = top[u], c, o
        elif c > seg[u]:
            seg[u] = c
    valido = (top >= 2) & (top > seg)
    zona = (dd[plano_px] <= 0.5 * ancho + 1)
    u_px = cl[plano_px]
    m = zona & valido[u_px]
    res[m] = mejor[u_px[m]]
    resuelto[m] = True


def _par_toca(rellenos, linea, ys, xs, c2, par, ancho):
    """H2: True donde el segundo vecino c2 toca la línea cerca del píxel (cerca de algún píxel de línea
    pegado a c2 (≤ 1.6·ancho, el alcance del segundo vecino), con ancho/4 de holgura para el antialias)."""
    H, W = linea.shape
    ok = np.zeros(len(ys), bool)
    r = max(2, int(round(ancho / 4)))
    disco = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1,) * 2)
    m_ = int(2 * ancho) + r + 2
    for b in np.unique(c2[par]):
        sel = par & (c2 == b)
        sy, sx = ys[sel], xs[sel]
        y0, y1 = max(0, sy.min() - m_), min(H, sy.max() + m_ + 1)
        x0, x1 = max(0, sx.min() - m_), min(W, sx.max() + m_ + 1)
        toca = (cv2.dilate((rellenos[y0:y1, x0:x1] == b).astype(np.uint8), disco) > 0) & linea[y0:y1, x0:x1]
        if not toca.any():
            continue
        d = cv2.distanceTransform((~toca).astype(np.uint8), cv2.DIST_L2, cv2.DIST_MASK_5)
        ok[np.nonzero(sel)[0]] = d[sy - y0, sx - x0] <= 1.6 * ancho
    return ok


def _por_rama(idx, L, C, linea, ancho, ys, xs, dueno, clave, par, c1, c2, pares, dl, croma, regla_l,
              regla_de=12.0, libre=None, oscura=None, esq=None):
    """Dueño por tramo del esqueleto (hipótesis H1').

    1. El esqueleto se parte en ramas en las uniones T/Y; cada píxel de línea va a la rama más cercana.
    2. Dentro de una rama, los píxeles se agrupan por su par (c1, c2) (o su único relleno). Un grupo es un
       tramo propio si mide más de 2·ancho de largo (área > 2·ancho²): su dueño es la moda del dueño por
       píxel del grupo. Así la rama se parte donde cambia el par y en ningún otro sitio.
    3. Regla de luminancia (solo entre dos rellenos): un dueño más oscuro que su propia línea (L del dueño <
       mediana L del núcleo de la línea + regla_l) está mal elegido: gana el otro lado si él sí es más claro.
       No se aplica si el dueño tiene casi el color de la línea (ΔE76 < regla_de): ahí la línea es su borde.
    4. Los grupos cortos toman el dueño del tramo propio más cercano de su misma rama; las ramas sin ningún
       tramo propio toman el del grupo mayor; las ramas diminutas o lejanas usan la regla v1."""
    H, W = linea.shape
    # todo se calcula en la caja de la línea
    m_ = int(ancho * 2) + 2
    y0, y1 = max(0, ys.min() - m_), min(H, ys.max() + m_ + 1)
    x0, x1 = max(0, xs.min() - m_), min(W, xs.max() + m_ + 1)
    lin = linea[y0:y1, x0:x1]
    h, w = lin.shape
    yc, xc = ys - y0, xs - x0
    plano_px = yc * w + xc
    clase_l = None
    if esq and esq['por_clase']:
        # familias de clases de línea: tonos casi iguales del mismo trazo (el borde #7A3E2B de S4 sale en 3 clases
        # oscuras) son un solo trazo; colores distintos (antebrazo marrón / halo teal) no
        clase_l = _familias(idx[y0:y1, x0:x1], lin, C, esq['de_familia'], ancho, esq['contacto'])
    lab_r, n_r, union = _ramas(lin, clase_l)
    out = np.full((H, W), -1, np.int32)
    if n_r == 0:
        out[ys, xs] = dueno
        return _suavizar_v1(out, linea, ancho)
    dist, cerca = _cercano(lab_r > 0)
    if clase_l is not None:
        # cada píxel de línea va a la rama más cercana DE SU FAMILIA si está dentro de su trazo (≤ k_propia·ancho
        # de su esqueleto); un píxel más lejos (antialias de una línea que asoma en otra, las pestañas oscuras de
        # la boca de Ceti sobre los surcos) sigue yendo a la rama más cercana de cualquier clase
        for c in np.unique(clase_l[lin]):
            sk_c = (lab_r > 0) & (clase_l == c)
            if not sk_c.any():
                continue
            d_c, ce_c = _cercano(sk_c)
            m = lin & (clase_l == c) & (d_c <= esq['k_propia'] * ancho)
            dist[m], cerca[m] = d_c[m], ce_c[m]
    esq_px = cerca.ravel()[plano_px]                 # píxel de esqueleto más cercano a cada píxel de línea
    rama = lab_r.ravel()[esq_px]
    lejos = dist.ravel()[plano_px] > ancho
    # núcleo de la línea (lejos de los bordes) para la luminancia real del trazo
    dtl = cv2.distanceTransform(lin.astype(np.uint8), cv2.DIST_L2, cv2.DIST_MASK_5).ravel()[plano_px]
    nucleo = dtl > ancho / 4
    k = rama.astype(np.int64) * (1 << 26) + clave
    grupos, inv = np.unique(k, return_inverse=True)
    inv = inv.ravel()
    g_rama, g_clave = grupos >> 26, grupos & ((1 << 26) - 1)
    ng = len(grupos)
    cuenta = np.bincount(inv, minlength=ng)
    # largo del tramo = píxeles de esqueleto distintos que cubre el grupo (un remate o un grumo junto a una
    # unión es ancho pero corto, y no cuenta como tramo propio)
    u = np.unique(inv.astype(np.int64) * (h * w) + esq_px)
    largo = np.bincount((u // (h * w)).astype(np.int64), minlength=ng) > 2 * ancho
    # moda del dueño por grupo
    nc = len(C)
    tabla = np.bincount(inv * (nc + 1) + dueno + 1, minlength=ng * (nc + 1)).reshape(ng, nc + 1)
    dueno_g = tabla[:, 1:].argmax(1)
    dueno_g[tabla[:, 1:].sum(1) == 0] = -1
    # regla de luminancia por grupo de par
    if regla_l is not None:
        cand = np.nonzero(largo & (g_clave < 4096 * 4096) & (dueno_g >= 0))[0]
        if len(cand):
            sel = nucleo & np.isin(inv, cand)
            o_ = np.argsort(inv[sel], kind='stable')
            gi, Li = inv[sel][o_], L[ys[sel][o_], xs[sel][o_]]
            cortes = np.searchsorted(gi, cand)
            fin = np.searchsorted(gi, cand, side='right')
            for g, a_, b_ in zip(cand, cortes, fin):
                if b_ - a_ < ancho:
                    continue
                o = dueno_g[g]
                a, b = int(g_clave[g]) // 4096, int(g_clave[g]) % 4096
                if o not in (a, b):
                    continue
                otro = b if o == a else a
                lc = np.median(Li[a_:b_], axis=0)
                # si el dueño tiene casi el color de la línea, la "línea" es su propio borde (cejas, sombras
                # del cuello): no se toca
                propio = np.linalg.norm(np.asarray(C[o], np.float32) - lc) < regla_de
                if not propio and C[o][0] < lc[0] + regla_l and C[otro][0] >= lc[0] + regla_l:
                    dueno_g[g] = otro
                elif oscura is not None and lc[0] <= min(C[a][0], C[b][0]) - oscura['umbral']:
                    # H2 (tablet): línea mucho más oscura que los dos lados -> `oscuro` (L−14) de cualquiera da
                    # un borde claro; gana el lado cuyo tono calibrado se parece más a la línea de este tramo
                    ea = np.linalg.norm(lc - oscuro_calibrado(C[a], lc, dl, **oscura['kw']))
                    eb = np.linalg.norm(lc - oscuro_calibrado(C[b], lc, dl, **oscura['kw']))
                    if abs(ea - eb) > 4:
                        dueno_g[g] = a if ea < eb else b
    res = dueno_g[inv]
    resuelto = largo[inv] & (res >= 0)
    # ramas: grupo mayor y si tienen algún tramo propio
    tot_r = np.bincount(rama, minlength=n_r + 1)
    con_largo = np.zeros(n_r + 1, bool)
    con_largo[g_rama[largo]] = True
    mayor = np.full(n_r + 1, -1, np.int64)
    orden = np.argsort(cuenta, kind='stable')
    mayor[g_rama[orden]] = dueno_g[orden]  # el último escrito (mayor cuenta) gana
    # ramas sin tramo propio pero con datos suficientes: dueño del grupo mayor
    m = ~resuelto & ~con_largo[rama] & (tot_r[rama] >= ancho * ancho) & (mayor[rama] >= 0) & ~lejos
    res = np.where(m, mayor[rama], res)
    resuelto |= m
    # grupos cortos dentro de ramas con tramos propios: el tramo propio más cercano de su rama
    m = ~resuelto & con_largo[rama] & ~lejos
    sel = resuelto & largo[inv]
    if m.any() and sel.any():
        ok = np.zeros(h * w, bool)
        ok[plano_px[sel]] = True
        _, cerca2 = _cercano(ok.reshape(h, w))
        j = cerca2.ravel()[plano_px[m]]
        pos = np.full(h * w, -1, np.int64)
        pos[plano_px] = np.arange(len(plano_px))
        jj = pos[j]
        misma = (jj >= 0) & (rama[np.maximum(jj, 0)] == rama[m])
        mm = np.nonzero(m)[0][misma]
        res[mm] = res[jj[misma]]
        resuelto[mm] = True
    cadena = None
    if esq and esq['cadenas']:
        cad_r = _cadenas(lab_r, n_r, union, ancho, esq['angulo'])
        cadena = cad_r[rama]
    if esq and esq['continuidad']:
        if cadena is not None:
            _continuidad(res, resuelto, cadena, c1, c2, n_r, nc, np.bincount(cadena, minlength=n_r + 1), ancho, esq)
        else:
            _continuidad(res, resuelto, rama, c1, c2, n_r, nc, tot_r, ancho, esq)
    # uniones T/Y: el disco de la unión es del dueño que comparten más ramas (la línea que pasa de largo),
    # para que el tallo de la T no asome como una espiga dentro de la línea que cruza
    if union.any():
        _unir(union, lab_r, plano_px, rama, res, resuelto, ancho, w)
    out[ys[resuelto], xs[resuelto]] = res[resuelto]
    # resto (ramas diminutas, píxeles lejos del esqueleto, sin datos): regla v1 local
    if (~resuelto).any():
        tmp = np.full((h, w), -1, np.int32)
        tmp[yc, xc] = dueno
        v1 = _suavizar_v1(tmp, lin, ancho)
        nr = ~resuelto
        out[ys[nr], xs[nr]] = v1[yc[nr], xc[nr]]
    out[~linea] = -1
    sin = linea & (out < 0)
    if sin.any() and (out >= 0).any():
        _, (iy, ix) = ndi.distance_transform_edt(out < 0, return_indices=True)
        out[sin] = out[iy[sin], ix[sin]]
    _sin_retazos(out[y0:y1, x0:x1], 1.5 * ancho * ancho)
    if libre is not None and libre.any():
        # H2: ramas libres (> 60 % de sus píxeles sin relleno a ningún lado) -> su propio color, un solo tono
        lib_r = np.bincount(rama, weights=libre.astype(np.float64), minlength=n_r + 1)
        frac = lib_r / np.maximum(1, tot_r)
        frac[0] = 0
        for r_ in np.nonzero((frac > 0.6) & (tot_r >= 4 * ancho * ancho))[0]:
            sel = rama == r_
            cls = int(np.bincount(idx[ys[sel & nucleo], xs[sel & nucleo]] if (sel & nucleo).any()
                                  else idx[ys[sel], xs[sel]]).argmax())
            out[ys[sel], xs[sel]] = -2 - cls
        if cadena is not None:
            _cadena_un_tono(out, ys, xs, cadena)
    return out


def _cadena_un_tono(out, ys, xs, cadena):
    """H18 (3) N6: una cadena (trazo continuo a través de uniones) que mezcla tramos libres (su propio color) y
    tramos con dueño cambia de tono a mitad de la curva. Gana lo mayoritario en píxeles: si la mayoría tiene
    dueño, los tramos libres toman el dueño más frecuente; si no, toda la cadena es libre con su color. En sitio."""
    v = out[ys, xs]
    for k in np.unique(cadena[v <= -2]):
        sel = cadena == k
        vk = v[sel]
        lib = vk <= -2
        con = vk >= 0
        if not con.any():
            continue
        if con.sum() >= lib.sum():
            nuevo = int(np.bincount(vk[con]).argmax())
            vk = np.where(lib, nuevo, vk)
        else:
            nuevo = int(-2 - np.bincount(-2 - vk[lib]).argmax())
            vk = np.where(con, nuevo, vk)
        v[sel] = vk
    out[ys, xs] = v


def _cadenas(lab_r, n_r, union, ancho, angulo=30.0):
    """H18 (3): une en cadenas las ramas que siguen de largo por una unión T/Y (las dos direcciones de llegada
    forman < `angulo` grados con la recta): el aro del casco de R4 sigue siendo un solo trazo aunque el arco del
    visor lo toque. Devuelve un array rama -> cadena (la rama 0 = nada)."""
    padre = np.arange(n_r + 1)

    def raiz(a):
        while padre[a] != a:
            padre[a] = padre[padre[a]]
            a = padre[a]
        return a
    if not union.any() or n_r < 2:
        return padre
    cu, nu = ndi.label(union, structure=np.ones((3, 3), bool))
    d_u, cerca_u = _cercano(union)
    cl = cu.ravel()[cerca_u.ravel()].reshape(union.shape)
    ys, xs = np.nonzero(lab_r > 0)
    rr = lab_r[ys, xs]
    orden = np.argsort(rr, kind='stable')
    ys, xs, rr = ys[orden], xs[orden], rr[orden]
    ini = np.searchsorted(rr, np.arange(n_r + 2))
    extremos = {}
    cerca = d_u[ys, xs] <= 2.5
    for r in np.unique(rr[cerca]):
        a_, b_ = ini[r], ini[r + 1]
        py, px = ys[a_:b_].astype(np.float32), xs[a_:b_].astype(np.float32)
        ce = cerca[a_:b_]
        for u in np.unique(cl[ys[a_:b_][ce], xs[a_:b_][ce]]):
            sel = ce & (cl[ys[a_:b_], xs[a_:b_]] == u)
            ey, ex = py[sel].mean(), px[sel].mean()
            dd = np.hypot(py - ey, px - ex)
            anillo = (dd >= ancho) & (dd <= 2 * ancho)
            if not anillo.any():
                anillo = dd >= dd.max() * 0.5
                if not anillo.any() or dd.max() < 2:
                    continue
            v = np.array([ey - py[anillo].mean(), ex - px[anillo].mean()])
            nv = np.linalg.norm(v)
            if nv < 1e-6:
                continue
            extremos.setdefault(int(u), []).append((int(r), v / nv))
    cmax = np.cos(np.radians(angulo))
    for u, lst in extremos.items():
        cand = []
        for i in range(len(lst)):
            for j in range(i + 1, len(lst)):
                (r1, v1), (r2, v2) = lst[i], lst[j]
                if r1 == r2:
                    continue
                c = -float(np.dot(v1, v2))
                if c >= cmax:
                    cand.append((c, r1, r2))
        usados = set()
        for c, r1, r2 in sorted(cand, reverse=True):
            if r1 in usados or r2 in usados:
                continue
            usados |= {r1, r2}
            padre[raiz(r1)] = raiz(r2)
    return np.array([raiz(a) for a in range(n_r + 1)])


def _continuidad(res, resuelto, rama, c1, c2, n_r, nc, tot_r, ancho, esq):
    """H18 (3) (en sitio): un dueño por rama larga. Si en una rama (≥ k_largo·ancho de largo) un dueño cubre
    ≥ frac_dom de sus píxeles, los tramos con otro dueño cuyo par todavía incluye al dominante (el dominante sigue
    a un lado de la línea) vuelven al dominante: el contorno del antebrazo sigue siendo del antebrazo aunque al
    otro lado pase una astilla cian del halo (N27). Los tramos cuyo par ya no incluye al dominante (la línea
    cambia de verdad de vecinos) no se tocan."""
    ok = resuelto & (res >= 0)
    if not ok.any():
        return
    tabla = np.bincount(rama[ok].astype(np.int64) * (nc + 1) + res[ok], minlength=(n_r + 1) * (nc + 1))
    tabla = tabla.reshape(n_r + 1, nc + 1)
    dom = tabla.argmax(1)
    frac = tabla.max(1) / np.maximum(1, tabla.sum(1))
    larga = tot_r >= esq['k_largo'] * ancho * ancho
    larga[0] = False
    d = dom[rama]
    m = ok & (res != d) & (frac[rama] >= esq['frac_dom']) & larga[rama] & ((c1 == d) | (c2 == d))
    res[m] = d[m]


def _sin_retazos(o, area_min):
    """Retazos de dueño (componente de un mismo dueño con área < area_min) pegados a otro tramo de línea:
    toman el dueño vecino más frecuente (cada cambio de dueño a mitad de un trazo cuesta nodos y se ve como
    un parche). Los retazos aislados (líneas cortas sueltas: pliegues, dedos) no se tocan. En sitio."""
    k3 = np.ones((3, 3), bool)
    cambios = []
    for d in [c for c in np.unique(o) if c >= 0]:
        cc, n = ndi.label(o == d, structure=k3)
        if n == 0:
            continue
        tam = np.bincount(cc.ravel(), minlength=n + 1)
        for i, sl in enumerate(ndi.find_objects(cc), 1):
            if tam[i] >= area_min:
                continue
            sl = tuple(slice(max(0, a.start - 2), a.stop + 2) for a in sl)
            m = cc[sl] == i
            anillo = ndi.binary_dilation(m, structure=k3, iterations=2) & ~m
            vec = o[sl][anillo]
            vec = vec[(vec >= 0) & (vec != d)]
            if len(vec) >= 3:
                cambios.append((sl, m, int(np.bincount(vec).argmax())))
    for sl, m, nuevo in cambios:
        o[sl][m] = nuevo
