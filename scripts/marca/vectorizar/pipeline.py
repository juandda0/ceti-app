"""Pipeline completo: referencia raster -> SVG por capas, limpio y animable."""
import json
import os
import time
from pathlib import Path

import cv2
import numpy as np
from scipy import ndimage as ndi

from . import capas, lineas, paleta, trazado
from .pre import color_original, esrgan_selectivo, hexrgb, lab, recorte, superres

# raíz del repo (los agentes trabajan con copias del paquete fuera del repo: VECTORIZAR_RAIZ)
RAIZ = Path(os.environ.get('VECTORIZAR_RAIZ', Path(__file__).resolve().parents[3]))

DEFECTOS = {
    'escala': 4,
    'superres': 'realesrgan-x4plus-anime',
    'paleta': 'auto',            # 'auto' o {nombre: HEX | [HEX, ...]}
    'paleta_fusion': 6.0,        # ΔE bajo el cual dos colores automáticos son el mismo
    'paleta_extra': [],          # colores que siempre deben existir (detalles diminutos)
    'nombres': {},               # {nombre: HEX de referencia}: nombra la clase automática más cercana
    'colores': {},               # {nombre | HEX: HEX final} recolor de marca
    'bordes': {},                # {nombre | HEX: HEX del borde} (si no: tono más oscuro automático)
    'lineas': {'modo': 'borde', 'ancho': 'auto', 'oscurecer': 14, 'croma': 1.15, 'excluir': [], 'incluir': []},
    'duenos': [],                # [[a, b, dueño], ...] por nombre/HEX
    'orden': [],                 # orden parcial forzado [atrás, ..., adelante]
    'solapa': 6,                 # px (referencia) que cada capa se mete debajo de las de encima
    'suavizado': 1.2,            # sigma (px a escala de trabajo) antes de trazar
    'tolerancia': 0.9,           # opttolerance de potrace (px a escala de trabajo)
    'min_area': 3,               # px² (referencia): islas menores se funden con el vecino
    'partes': {},                # {nombre: {poligono, pivote, excluir, solapa}}
    'ojos': 'auto',              # 'auto' | None | {'zona': [x0, y0, x1, y1]}
    'piso': 'auto',
    # HEX | None: huecos de fondo encerrados por la figura (bolsillos) que en realidad son relleno del mismo tono
    # que el fondo (traje crema de Sofi sobre la hoja crema). None = siguen siendo fondo (comportamiento anterior)
    'fondo_interior': None,
    # flags de cambios (ver README.md). Los aceptados por el Integrador quedan activos aquí; un personaje o
    # caso puede sobrescribir solo los que nombre ('experimentos' se fusiona clave a clave en `cargar`).
    'experimentos': {
        'compuertas_v2': True,        # r1 capas: piso plano bajo los pies + elipse de respaldo + ojos v2
        'dueno_por_rama': True,       # r1 líneas: dueño de línea por rama del esqueleto (H1')
        'suavizado_conjunto': True,   # r1 curvas: limpia astillas/cuñas/islas del campo de etiquetas (H5); dict = parámetros
        'proteger_detalle': False,    # r1 paleta: protege tinta fina y detalles compactos (H4); neutro, apagado
        'colores_detalle': False,     # r1 paleta: añade colores de manchitas oscuras compactas; apagado (mota en R2)
        # r1 integrador (I1): conserva elementos sueltos (destellos, objetos aparte). r2 (I2, N20): sin los que tocan la
        # clase piso ni los que son casi todo línea (restos del contorno); True = comportamiento r1
        'conservar_sueltos': {'evitar_piso': True, 'evitar_linea': True},
        'min_componente': 6,          # r1 integrador: px² (unidades del SVG) mínimos por componente de cada capa
        'trazado_adaptativo': True,   # r2 curvas (H13'): suavizado/tolerancia por tamaño, franjas rectas, ocultas lisas
        'fusion_espacial': True,      # r2 paleta (H16): tonos cercanos que forman una región propia conservan su color (dict = opciones)
        'color_original': False,      # r2 paleta (H16b): devuelve al ESRGAN el color de baja frecuencia del original
        'sin_piso_real': True,        # r2 paleta: con piso null no se borra ninguna clase como piso (N26 de S4, cuello de R6)
        # r2 líneas (H2): borde calibrado, par falso, líneas libres; False = r1. r3 (H18): l_marron = la puerta de
        # marca (matiz_max) solo para el contorno marrón medio (L ≥ 35), no para un trazo oscuro tipo tinta (S4)
        'borde_calibrado': {'giro': 15, 'subir_croma': True, 'umbral_oscura': 20, 'matiz_max': 15, 'l_marron': 35},
        # r3 líneas (H18): dueño por familia de clase de línea, continuidad del dueño por cadena y un tono por cadena
        # (N27, N6). False = r2. dict = opciones de lineas._opts_esqueleto; {'manchas': True} prueba el paso (1)
        'linea_esqueleto': True,
        'ojos_v3': True,              # r2 capas: brillos en el borde del iris, simetría, tapa de mejilla fuera del ojo, miniatura (H12')
        # r3 curvas (H20): barras/píldoras/discos/lentes (trazado.primitiva_v2), guiones colineales unidos, capas con
        # muchos huecos invertidas (trazado.invertir_agujereadas) y sueltos sin tope de tamaño si cuestan ≤ max_costo
        # × presupuesto de nodos. False = r2 byte a byte; dict = parámetros (claves de trazado.PRIMITIVAS_V2 + SUELTOS_V2).
        # r3 integrador: inv_huecos 0 = sin invertir_agujereadas, que choca con la contención de capas_geometricas
        # (S4: 2091 nodos y G = 0 con las dos; 877 nodos y 92.75 solo con la contención)
        'primitivas_v2': {'inv_huecos': 0},
        'capas_geometricas': True,    # r3 capas (H19): piso por geometría, orden z por contención, iris por color; dict {'piso','contencion','iris'}
        # r3 paleta (H17): Lanczos en paneles de textura fina donde el ESRGAN cambió el color, antialias a 2 clases ahí,
        # paleta del ESRGAN, meseta también sobre Lanczos y bordes de bandas tenues suavizados (dict = opciones, ver pre.esrgan_selectivo)
        'esrgan_selectivo': True,
        # r3 integrador (pedido de capas): IoU de las primitivas sin recortar la forma al componente (trazado.IOU_MARGEN);
        # lo necesita la contención de capas_geometricas (si no, la elipse falsa del surco de S2 sube encima)
        'iou_con_margen': True,
        # ojos v1 (sofi): lo oscuro de arriba del óvalo del ojo que no es iris (párpado) se redibuja encima como
        # tapa, en vez de quedar tapado por la esclera (rendija de piel/blanco bajo el párpado). Apagado = r3
        'parpado_v1': False,
    },
}

# parámetros por defecto de `trazado_adaptativo` (px de referencia; los sigma se escalan con el tamaño del personaje)
TRAZADO_ADAPTATIVO = {
    'rectas': True, 'ancho': 3.0, 'eps': 0.75, 'max_v': 8, 'min_iou': 0.95,   # franjas finas y rectas -> polígono
    'grande': 40, 'f_grande': 1.6, 'pequena': 8, 'f_pequena': 0.6,           # opttolerance según el área
    'alpha_relleno': 1.1, 'alpha_borde': 1.0,                                # alphamax de potrace
    'sigma_g': 1.0, 'sigma_n': 0.5,                                          # suavizado extra (grandes / medianas)
    'ocultas': {},                                                           # simplificar_ocultas (False = no)
}

# H20 (r3): regla general de `conservar_sueltos` con primitivas_v2: sin tope de tamaño (max_frac), pero una componente
# suelta grande (> frac_libre de la figura) solo se conserva si su coste estimado (nodos, trazada con las primitivas)
# es ≤ max_costo × presupuesto de nodos (cfg['presupuesto_nodos'] o, si no hay, 0.15 nodos por px de frontera entre
# clases de la referencia, la regla del banco para los casos reales)
SUELTOS_V2 = {'max_frac': 1.0, 'frac_libre': 0.1, 'max_costo': 0.25, 'nodos_por_px': 0.15}


def presupuesto_estimado(idx, S, zona=None, nodos_por_px=0.15):
    """Nodos de presupuesto ≈ nodos_por_px × largo (px de referencia) de las fronteras entre clases dentro de `zona`."""
    fr = np.zeros(idx.shape, bool)
    fr[:, 1:] |= idx[:, 1:] != idx[:, :-1]
    fr[1:, :] |= idx[1:, :] != idx[:-1, :]
    if zona is not None:
        fr &= zona
    return nodos_por_px * fr.sum() / S


def costo_nodos(elems):
    """Nodos de una lista de elementos SVG, contados como el banco (cada M/L/C = 1; círculo/elipse = 4)."""
    import re
    n = 0
    for e in elems:
        m = re.search(r' d="([^"]+)"', e)
        n += len(re.findall(r'[MLC]', m.group(1))) if m else 4
    return n


def cargar(nombre_o_ruta):
    p = Path(nombre_o_ruta)
    if not p.exists():
        p = Path(__file__).parent / 'personajes' / f'{nombre_o_ruta}.json'
    cfg = json.loads(p.read_text())
    out = {**DEFECTOS, **cfg}
    out['lineas'] = {**DEFECTOS['lineas'], **cfg.get('lineas', {})}
    out['experimentos'] = {**DEFECTOS['experimentos'], **(cfg.get('experimentos') or {})}
    out['_nombre'] = p.stem
    return out


def conservar_sueltos(idx, L, C, fondo, piso, fig, S, opts=True, costo=None):
    """I1: `capas.fondo_y_figura` se queda con la componente mayor y tira lo que está aparte (destellos,
    objetos sueltos). Devuelve `fig` más las componentes no fondo/no piso que no tocan el borde, miden
    ≥ `area` px² (de referencia), no pasan de `max_frac` del área de la figura y contrastan con el fondo (ΔE76 medio > `contraste`). Las astillas pegadas a
    la figura (lo que quitó la apertura) no se recuperan: el anillo debe tocar la figura < `pegado`."""
    o = opts if isinstance(opts, dict) else {}
    area, contraste, pegado = o.get('area', 20), o.get('contraste', 15.0), o.get('pegado', 0.5)
    # I2 (r2): no rescatar restos del contorno pegados a la sombra del piso (N20 de S2)
    evitar_piso = bool(o.get('evitar_piso')) and piso is not None
    piso_d = ndi.binary_dilation(idx == piso, iterations=S) if evitar_piso else None
    max_frac = o.get('max_frac', 0.1)  # más grande que esto (fracción de la figura) es otro objeto, no un adorno
    # H20 (r3): con `costo` (función máscara -> nodos estimados) y 'max_costo', las componentes de más de
    # 'frac_libre' de la figura se aceptan hasta max_frac solo si cuestan ≤ max_costo × 'presupuesto'
    frac_libre, max_costo, pres = o.get('frac_libre'), o.get('max_costo'), o.get('presupuesto')
    area_fig = fig.sum()
    if costo is not None:
        o['_costos'] = []
    abierto = idx == fondo
    if piso is not None:
        abierto |= idx == piso
    cc, _ = ndi.label(abierto)
    tocan = set(np.unique(np.r_[cc[0], cc[-1], cc[:, 0], cc[:, -1]])) - {0}
    fig0 = ~np.isin(cc, list(tocan))
    resto = fig0 & ~fig
    cc, n = ndi.label(resto)
    if not n:
        return fig
    tam = ndi.sum(resto, cc, range(1, n + 1))
    fig_d = ndi.binary_dilation(fig, iterations=S)
    out = fig.copy()
    for j, sl in enumerate(ndi.find_objects(cc), start=1):
        if sl is None or tam[j - 1] < area * S * S or tam[j - 1] > max_frac * fig.sum():
            continue
        y0, y1 = max(0, sl[0].start - S), sl[0].stop + S
        x0, x1 = max(0, sl[1].start - S), sl[1].stop + S
        m = cc[y0:y1, x0:x1] == j
        ring = ndi.binary_dilation(m, iterations=S) & ~m
        if (ring & fig_d[y0:y1, x0:x1]).sum() > pegado * max(1, ring.sum()):
            continue
        if evitar_piso and (m & piso_d[y0:y1, x0:x1]).any():
            continue
        de = np.sqrt(((L[y0:y1, x0:x1][m] - C[fondo]) ** 2).sum(-1)).mean()
        if de <= contraste:
            continue
        if costo is not None and max_costo and pres and frac_libre is not None and tam[j - 1] > frac_libre * area_fig:
            cn = costo(m, idx[y0:y1, x0:x1])
            o['_costos'].append((int(tam[j - 1]), int(cn), round(max_costo * pres)))
            if cn > max_costo * pres:
                continue
        out[y0:y1, x0:x1] |= m
    return out


def sin_motas(mask, min_px):
    """Quita de una capa las componentes de menos de `min_px` px (escala de trabajo): motas que, ya
    suavizadas por potrace, quedan por debajo del tamaño visible; la capa de abajo las cubre (solapa)."""
    n, cc, st, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), connectivity=8)
    chicos = np.where(st[1:, cv2.CC_STAT_AREA] < min_px)[0] + 1
    if not len(chicos):
        return mask
    return mask & ~np.isin(cc, chicos)


class Ctx:
    """Estado del pipeline (para depurar y para el banco)."""


def vectorizar(cfg, log=print):
    from .recursos import cupo
    with cupo():
        return _vectorizar(cfg, log)


def _vectorizar(cfg, log=print):
    t0 = time.time()
    k = Ctx()
    S = k.S = cfg['escala']
    img = k.img = recorte(RAIZ / cfg['src'], cfg['box'])
    big = superres(img, cfg['superres'], S)
    exp = {**DEFECTOS['experimentos'], **(cfg.get('experimentos') or {})}
    trazado.IOU_MARGEN = bool(exp.get('iou_con_margen'))
    if exp.get('color_original'):
        co = exp['color_original']
        big = color_original(big, img, S, **(co if isinstance(co, dict) else {}))
    e17 = exp.get('esrgan_selectivo')
    o17 = e17 if isinstance(e17, dict) else {}
    zona17 = L_esr = L_mes = None
    if e17:
        L_esr = lab(big)
        big, zona17, lz = esrgan_selectivo(big, img, S, cfg, o17)
        L_mes = lab(lz) if o17.get('meseta', 'lanczos') == 'lanczos' else lab(big)
    k.zona17 = zona17
    L = k.L = lab(big)
    H, W = L.shape[:2]
    log(f'superres {time.time() - t0:.1f}s {W}x{H}')

    # ---------------------------------------------------------------- paleta y clasificación
    k.experimentos = exp
    if cfg['paleta'] == 'auto':
        esp = exp.get('fusion_espacial')
        if e17 and esp and o17.get('de_plano', 4.0):
            esp = {**(esp if isinstance(esp, dict) else {}), 'de_plano': o17.get('de_plano', 4.0)}
        L_pal = L_esr if (e17 and o17.get('fuente', 'esrgan') == 'esrgan') else L
        C = paleta.paleta_auto(L_pal, np.ones((H, W), bool), fusion=cfg['paleta_fusion'], min_px=40 * S * S,
                               detalle=bool(exp.get('colores_detalle')), S=S, espacial=esp, L_meseta=L_mes)
        for h in cfg['paleta_extra']:
            C = np.vstack([C, lab(hexrgb(h)[None, None])[0, 0][None]])
        idx = paleta.clasificar(L, C, paleta.paleta_auto.zonas if exp.get('fusion_espacial') else None)
    else:
        nombres_p, cen, de = paleta.paleta_de_config(cfg['paleta'])
        idx = de[paleta.clasificar(L, cen)].astype(np.int16)
        C = np.array([cen[de == i].mean(0) for i in range(len(nombres_p))], np.float32)
    n = len(C)
    if zona17 is not None and o17.get('dos_clases', True):
        idx = paleta.dos_clases(idx, L, C, zona17, S, **o17.get('dos_clases_opts', {}))
    prot = exp.get('proteger_detalle', False)
    exento = zona17 if (zona17 is not None and o17.get('dos_clases', True) and o17.get('exento', True)) else None
    idx = paleta.limpiar(idx, n, radio_franja=max(1, S // 2), min_area=cfg['min_area'] * S * S, moda=S + 1,
                         L=L, C=C, S=S, proteger=bool(prot), exento=exento, **(prot if isinstance(prot, dict) else {}))
    if e17 and o17.get('tenues', True):
        ot = dict(o17['tenues']) if isinstance(o17.get('tenues'), dict) else {}
        if ot.pop('pares', 'bloqueos') == 'bloqueos':
            ot['pares'] = paleta.pares_bloqueados(C) if cfg['paleta'] == 'auto' else []
        idx = paleta.suavizar_tenues(idx, C, S, **{'sigma': 4.0, **ot})
    k.C = C
    log(f'paleta {n} colores {time.time() - t0:.1f}s')

    # nombres -> clase
    def clase(ref):
        if isinstance(ref, int):
            return ref
        h = cfg['nombres'].get(ref, ref)
        c = lab(hexrgb(h)[None, None])[0, 0]
        return int(np.argmin(((C - c) ** 2).sum(-1)))
    k.clase = clase

    # ---------------------------------------------------------------- figura y piso
    piso_id = None if cfg['piso'] in ('auto', None) else clase(cfg['piso'])
    if cfg['piso'] is None and exp.get('sin_piso_real'):
        piso_id = -1  # r2 paleta: con piso null, capas.fondo_y_figura (rama v1) igual elegía una clase de la
        #                franja inferior como piso y la borraba de la figura (N26: bandas de S4 hechas fondo)
    v2 = bool(exp.get('compuertas_v2'))
    # v2 solo elige piso cuando el caso lo pide en automático (piso None conserva la figura v1)
    fondo, piso, fig = capas.fondo_y_figura(idx, S, piso_id, v2=v2 and cfg['piso'] == 'auto')
    if cfg['piso'] is None:
        piso = None
    cg = exp.get('capas_geometricas')
    cg = (cg if isinstance(cg, dict) else {'piso': True, 'contencion': True, 'iris': True}) if cg else {}
    elipse_geo = None
    if cg.get('piso') and piso is not None:
        # H19 (r3 capas): guantes/botas del color de la sombra vuelven a la figura (N23 de S3)
        idx, C, cambio, elipse_geo = capas.piso_geometrico(idx, L, C, fondo, piso, fig, S)
        if not cambio:
            elipse_geo = None
        if cambio:
            n = len(C)
            k.C = C
            fondo, piso, fig = capas.fondo_y_figura(idx, S, piso, v2=v2)
    if cfg.get('fondo_interior'):
        # los bolsillos de fondo encerrados pasan a una clase propia con el color dado (no se recortan de la figura)
        fondo, piso, fig = capas.fondo_y_figura(idx, S, piso, v2=v2, bolsillo_min=np.inf)
        bols = (idx == fondo) & fig
        if bols.any():
            C = np.vstack([C, lab(hexrgb(cfg['fondo_interior'])[None, None])[0, 0][None]])
            n = len(C)
            k.C = C
            idx = idx.copy()
            idx[bols] = n - 1
            log(f'fondo interior: {int(bols.sum() / S / S)} px -> {cfg["fondo_interior"]}')
    pv2 = exp.get('primitivas_v2') if exp.get('trazado_adaptativo') else None
    pv2 = ({} if pv2 is True else dict(pv2)) if pv2 else None
    if exp.get('conservar_sueltos'):
        cs = exp['conservar_sueltos']
        ta0 = exp.get('trazado_adaptativo')
        if isinstance(ta0, dict) and ta0.get('sueltos_max_frac') is not None:
            # H13' (3): con el trazado adaptativo se puede subir el tope (por defecto NO: ver ing-r2-curvas.md)
            cs = {**(cs if isinstance(cs, dict) else {}), 'max_frac': ta0['sueltos_max_frac']}
        costo = None
        if pv2 is not None:
            # H20 (r3): sin tope de tamaño, con tope de coste (ver SUELTOS_V2)
            sv = {**SUELTOS_V2, **{x: pv2[x] for x in SUELTOS_V2 if x in pv2}}
            cs = {**(cs if isinstance(cs, dict) else {}), **sv}
            if cfg.get('presupuesto_nodos'):
                cs['presupuesto'] = float(cfg['presupuesto_nodos'])
            else:
                cs['presupuesto'] = presupuesto_estimado(idx, S, ndi.binary_dilation(~(idx == fondo), iterations=S),
                                                         sv['nodos_por_px'])
            ta_c = {**TRAZADO_ADAPTATIVO, **(ta0 if isinstance(ta0, dict) else {})}
            for x in ('ocultas', 'sueltos_max_frac'):
                ta_c.pop(x, None)
            ta_c['prim_v2'] = {x: v for x, v in pv2.items() if x not in SUELTOS_V2}
            ta_c['esc'] = float(np.clip(np.sqrt(fig.sum()) / S / 400, 0.3, 1.0))

            def costo(m, sub_idx):
                # la clase mayor ocupa la componente entera (debajo); las demás encima, tal cual
                cls, cnt = np.unique(sub_idx[m], return_counts=True)
                n_ = 0
                for c_, k_ in sorted(zip(cls, cnt), key=lambda z: -z[1]):
                    mk = ndi.binary_fill_holes(m) if c_ == cls[cnt.argmax()] else (m & (sub_idx == c_))
                    if mk.sum() < cfg['min_area'] * S * S:
                        continue
                    n_ += costo_nodos(trazado.trazar_capa(mk, S, '000000', cfg['suavizado'], cfg['tolerancia'],
                                                          max_prim=(60 * S) ** 2, adaptativo=ta_c))
                return n_
        fig_base = fig
        fig = conservar_sueltos(idx, L, C, fondo, piso, fig, S, cs, costo=costo)
        if pv2 is not None:
            log(f"sueltos v2: presupuesto≈{cs['presupuesto']:.0f} nodos; grandes (px, nodos, tope): {cs.get('_costos')}")
        rescatados = fig & ~fig_base if isinstance(cs, dict) and cs.get('evitar_linea') else None
    else:
        rescatados = None
    k.fondo, k.piso, k.fig = fondo, piso, fig
    idx = idx.copy()

    # ---------------------------------------------------------------- líneas
    lc = cfg['lineas']
    ancho = lineas.estimar_ancho(idx, L, C, fig, S) if lc['ancho'] == 'auto' else lc['ancho'] * S
    k.ancho = ancho
    log(f'ancho de línea {ancho / S:.1f} px')
    fondo_ids = [fondo] + ([piso] if piso is not None else [])
    if lc['modo'] != 'ninguna':
        linea, clases_linea = lineas.detectar(idx, L, C, fig, ancho, excluir=[clase(x) for x in lc['excluir']],
                                              incluir=[clase(x) for x in lc['incluir']])
        if rescatados is not None and rescatados.any():
            # I2: un elemento suelto que es casi todo línea es un resto del contorno, no un destello
            cc, nr = ndi.label(rescatados)
            if nr:
                frac = ndi.mean(linea, cc, range(1, nr + 1))
                quitar = np.isin(cc, np.nonzero(np.asarray(frac) > 0.5)[0] + 1)
                if quitar.any():
                    fig = fig & ~quitar
                    linea = linea & ~quitar
                    k.fig = fig
        le = exp.get('linea_esqueleto')
        if isinstance(le, dict) and le.get('manchas'):
            # r3 líneas (H18 (1), apagado: borra regiones reales de color de línea, ver ing-r3-lineas.md)
            mk = {x: le[x] for x in ('k_nucleo', 'k_borde', 'k_banda') if x in le} if isinstance(le, dict) else {}
            idx, linea = lineas.manchas_a_relleno(idx, L, C, fig, linea, clases_linea, ancho, fondo_ids, **mk)
        # el contorno de la silueta (línea que toca el fondo) también es línea aunque su color no lo sea
        duenos = {}
        for a, b, o in cfg['duenos']:
            a, b, o = clase(a), clase(b), clase(o)
            duenos[(min(a, b), max(a, b))] = o
        idx_fuera = idx.copy()
        idx_fuera[~fig] = fondo
        dueno, pares = lineas.asignar(idx_fuera, L, C, fig, linea, fondo_ids, ancho, duenos,
                                      lc['oscurecer'], lc['croma'],
                                      por_rama=bool(exp.get('dueno_por_rama')),
                                      calibrado=exp.get('borde_calibrado') or False,
                                      esqueleto=exp.get('linea_esqueleto') or False)
    else:
        linea, clases_linea, pares = np.zeros((H, W), bool), [], {}
        dueno = np.full((H, W), -1)
    k.linea, k.clases_linea, k.pares = linea, clases_linea, pares
    log(f'líneas: {len(clases_linea)} clases, {len(pares)} pares {time.time() - t0:.1f}s')

    pintura = np.where(linea, 2 * dueno, 2 * idx.astype(np.int32) + 1)
    tonos = None
    if exp.get('borde_calibrado') and lc['modo'] != 'ninguna':
        # H2: líneas libres (dueño -2 - clase) se pintan con su propio color; tono real de la línea por dueño
        libre = linea & (dueno <= -2)
        pintura[libre] = 2 * (-2 - dueno[libre]) + 1
        tonos = lineas.tono_linea(L, linea, dueno, ancho)
    k.tonos = tonos
    bc = exp.get('borde_calibrado')
    bc_kw = lineas.kw_calibrado(bc)
    pintura[~fig] = -1
    # una clase de línea que quedó como relleno (partes gruesas) pinta con su propio color
    k.pintura = pintura

    # ---------------------------------------------------------------- colores finales
    def hex_final(c):
        hc = paleta.hex_de_lab(C[c])
        for nombre, v in cfg['colores'].items():
            if clase(nombre) == c:
                return v.lstrip('#').upper()
        return hc

    def hex_borde(c):
        for nombre, v in cfg['bordes'].items():
            if clase(nombre) == c:
                return v.lstrip('#').upper()
        base = lab(hexrgb(hex_final(c))[None, None])[0, 0]
        if tonos is not None:
            return paleta.hex_de_lab(lineas.oscuro_calibrado(base, tonos.get(c), lc['oscurecer'], croma_v1=lc['croma'], **bc_kw))
        return paleta.hex_de_lab(lineas.oscuro(base, lc['oscurecer'], lc['croma']))

    def hex_codigo(code):
        return hex_borde(code // 2) if code % 2 == 0 else hex_final(code // 2)

    # ---------------------------------------------------------------- ojos (primitivas)
    ojos_svg = []
    if cfg['ojos']:
        from .ojos import detectar_ojos
        ojos_svg, pintura = detectar_ojos(k, cfg, pintura, hex_codigo, log)

    # ---------------------------------------------------------------- orden y partes
    orden = capas.orden_z(pintura, n, pares, [clase(x) for x in cfg['orden']])
    k.orden = orden
    grupos = []
    tomado = np.zeros((H, W), bool)
    partes_m = {}
    for nombre, pd in cfg['partes'].items():
        m = capas.poligono(pd['poligono'], (H, W), S) & fig & ~tomado
        if pd.get('excluir'):
            ex = np.isin(pintura // 2, [clase(x) for x in pd['excluir']]) & (pintura >= 0)
            m &= ~ex
            m = capas.mayor(ndi.binary_opening(m, iterations=S))
            m = ndi.binary_fill_holes(m)
        partes_m[nombre] = m
        tomado |= m
    cuerpo = fig & ~tomado
    pint_cuerpo = pintura
    region_cuerpo = cuerpo
    for nombre, pd in cfg['partes'].items():
        sol = int(pd.get('solapa', 7) * S)
        pint_cuerpo, region_cuerpo = capas.rellenar_debajo(pint_cuerpo, partes_m[nombre], region_cuerpo, sol)
    grupos.append(('cuerpo', pint_cuerpo, region_cuerpo, None))
    for nombre, pd in cfg['partes'].items():
        grupos.append((nombre, pintura, partes_m[nombre], pd.get('pivote')))
    k.partes = partes_m

    # ---------------------------------------------------------------- capas y trazado
    sol = max(1, int(cfg['solapa'] * S / 2))
    sig = cfg['suavizado']
    # H5 (r1): limpieza del campo de etiquetas antes de apilar (halos de fondo, cuñas, islas). Activo por
    # defecto; `experimentos.suavizado_conjunto = False` vuelve a la v1 byte a byte. Un dict ajusta los
    # parámetros (px de referencia de un boceto a tamaño completo; se escalan con el tamaño del personaje).
    sc = exp.get('suavizado_conjunto')
    if sc:
        o = sc if isinstance(sc, dict) else {}
        esc = float(np.clip(np.sqrt(fig.sum()) / S / 400, 0.3, 1.0))
        sc_sigma = o.get('sigma', 0.0) * S * esc     # > 0: argmax conjunto y trazado sin suavizado por capa
        sc_kw = dict(fondo=fondo, astillas=o.get('astillas', 1.5) * S * esc, cunas=o.get('cunas', 40) * (S * esc) ** 2,
                     minimo=o.get('minimo', 2) * (S * esc) ** 2)
    min_comp = float(exp.get('min_componente') or 0) * S * S
    # H13' (r2 curvas): trazado adaptativo. False = r1 byte a byte. True o dict de parámetros de
    # `trazado.trazar_capa_adaptativa` (+ 'ocultas': dict de `trazado.simplificar_ocultas` o False).
    ta = exp.get('trazado_adaptativo')
    ta_kw, ta_ocultas = None, None
    if ta:
        ta_kw = {**TRAZADO_ADAPTATIVO, **(ta if isinstance(ta, dict) else {})}
        ta_kw.pop('sueltos_max_frac', None)
        ta_ocultas = ta_kw.pop('ocultas', {})
        if ta_ocultas is True:
            ta_ocultas = {}
        elif ta_ocultas is False or ta_ocultas is None:
            ta_ocultas = None
        ta_kw['esc'] = float(np.clip(np.sqrt(fig.sum()) / S / 400, 0.3, 1.0))
        if pv2 is not None:
            ta_kw['prim_v2'] = {x: v for x, v in pv2.items() if x not in SUELTOS_V2}
    # H19 (2): orden z por contención (los agujeros se miden con B cerrado 2·S: franjas que tocan el borde)
    cont = cg.get('contencion')
    if cont:
        cont = {'cierre': 2 * S, 'min_px': 16 * S * S, 'chico': int(min_comp),
                **(cont if isinstance(cont, dict) else {})}
    piezas = {}
    for nombre, pint, region, piv in grupos:
        ys, xs = np.nonzero(region)
        if not len(ys):
            continue
        m = 4 * S
        y0, y1, x0, x1 = max(0, ys.min() - m), min(H, ys.max() + m), max(0, xs.min() - m), min(W, xs.max() + m)
        sub = pint[y0:y1, x0:x1]
        reg = region[y0:y1, x0:x1]
        sig_capa = sig
        if sc:
            sub = trazado.suavizar_conjunto(np.where(reg, sub, -1), sc_sigma, **sc_kw)
            reg = sub >= 0
            if sc_sigma > 0:
                sig_capa = 0
        elems = []
        lista = []
        for code, mask in capas.apilar(sub, orden, sol, reg, contencion=cont):
            if min_comp:
                mask = sin_motas(mask, min_comp)
                if not mask.any():
                    continue
            lista.append((code, mask))
        if ta_kw and ta_kw.get('prim_v2') is not None:
            inv = {**trazado.PRIMITIVAS_V2, **ta_kw['prim_v2']}.get('inv_huecos')
            if inv:
                # H20b: capas con muchos huecos llenados por las de debajo -> rellenas, con copias encima (mismo raster)
                nueva = trazado.invertir_agujereadas([mk for _, mk in lista], S, min_huecos=inv)
                lista = [(lista[i][0], mk) for i, mk in nueva]
            if {**trazado.PRIMITIVAS_V2, **ta_kw['prim_v2']}.get('radiales', True):
                # H20c: anillos de un degradado radial -> discos / lentes apilados de mayor a menor
                nueva = trazado.anidar_radiales([mk for _, mk in lista], S, area_max=(60 * S) ** 2, o=ta_kw['prim_v2'])
                lista = [(lista[i][0], mk) for i, mk in nueva]
        if ta and ta_ocultas is not None:
            nuevas = trazado.simplificar_ocultas([mk for _, mk in lista], S, **ta_ocultas)
            lista = [(code, mk) for (code, _), mk in zip(lista, nuevas)]
        for code, mask in lista:
            full = np.zeros((H, W), bool)
            full[y0:y1, x0:x1] = mask
            elems += trazado.trazar_capa(full, S, hex_codigo(code), sig_capa, cfg['tolerancia'],
                                         max_prim=(60 * S) ** 2, adaptativo=ta_kw, borde=code % 2 == 0)
        piezas[nombre] = (elems, piv)
        log(f'  {nombre}: {len(elems)} elementos {time.time() - t0:.1f}s')

    # ---------------------------------------------------------------- piso
    piso_svg = ''
    if piso is not None:
        # H19: si el piso geométrico separó botas/guantes de la sombra, su elipse (ajustada al borde inferior)
        e = elipse_geo or capas.elipse_piso(idx, piso, fig, S, v2=v2)
        if e:
            cx, cy, rx, ry = e
            f = trazado.fmt
            piso_svg = (f'<ellipse id="sombra-piso" cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" '
                        f'fill="#{hex_final(piso)}"/>')

    # ---------------------------------------------------------------- ensamblado
    w0, h0 = cfg['box'][2] - cfg['box'][0], cfg['box'][3] - cfg['box'][1]
    cara_en = cfg.get('cara_en', 'cabeza' if 'cabeza' in piezas else 'cuerpo')
    partes_svg = []
    for nombre in ['cuerpo'] + list(cfg['partes']):
        if nombre not in piezas:
            continue
        elems, piv = piezas[nombre]
        at = f' data-pivote="{trazado.fmt(piv[0])} {trazado.fmt(piv[1])}"' if piv else ''
        extra = ojos_svg if nombre == cara_en else []
        # r3 integrador (pedido de paleta): un path con d vacío rompe lib.mjs (G = 0); nunca se emite
        partes_svg.append(f'<g id="{nombre}"{at}>' + ''.join(e for e in elems + extra if ' d=""' not in e) + '</g>')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w0} {h0}">' + piso_svg + ''.join(partes_svg)
           + '</svg>')
    log(f'listo {time.time() - t0:.1f}s, {len(svg) / 1024:.0f} KB')
    k.svg = svg
    return svg, k
