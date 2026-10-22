"""Preproceso: recorte, superresolución (Real-ESRGAN anime) y espacio Lab.

La superresolución anime aplana el ruido del JPEG y deja los bordes nítidos: cada píxel de la
referencia pasa a ser un bloque de 4x4 donde el antialias ocupa ~1 px, así el borde entre colores
se localiza con precisión de subpíxel al volver a la escala original.
"""
import hashlib
import shutil
import subprocess
import tempfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ESRGAN = Path.home() / 'tools/esrgan/realesrgan-ncnn-vulkan'
CACHE = Path.home() / '.cache/vectorizar'


def lab(rgb):
    """RGB uint8 -> Lab float32 con L en 0..100 y a, b centrados (ΔE76 directo)."""
    out = cv2.cvtColor(np.ascontiguousarray(rgb, np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
    out[..., 0] *= 100 / 255
    out[..., 1:] -= 128
    return out


def rgb_de_lab(L):
    a = np.asarray(L, np.float32).reshape(-1, 1, 3).copy()
    a[..., 0] *= 255 / 100
    a[..., 1:] += 128
    return cv2.cvtColor(np.clip(a, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB).reshape(np.shape(L))


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.uint8)


def rgbhex(c):
    return ''.join(f'{int(v):02X}' for v in c)


def recorte(src, box):
    return np.asarray(Image.open(src).convert('RGB').crop(tuple(box)))


def superres(img, metodo='realesrgan-x4plus-anime', escala=4):
    """Escala x4. Con Real-ESRGAN (GPU, ncnn-vulkan) si está instalado; si no, Lanczos + filtro bilateral."""
    if metodo != 'lanczos' and ESRGAN.exists():
        clave = hashlib.sha1(img.tobytes() + f'{img.shape}{metodo}'.encode()).hexdigest()[:16]
        CACHE.mkdir(parents=True, exist_ok=True)
        dst = CACHE / f'{clave}.png'
        if not dst.exists():
            with tempfile.TemporaryDirectory() as td:
                a, b = Path(td) / 'in.png', Path(td) / 'out.png'
                Image.fromarray(img).save(a)
                from .recursos import gpu
                with gpu():
                    subprocess.run([str(ESRGAN), '-i', str(a), '-o', str(b), '-n', metodo, '-s', '4'],
                                   cwd=ESRGAN.parent, check=True, capture_output=True)
                shutil.move(str(b), dst)
        big = np.asarray(Image.open(dst).convert('RGB'))
        if escala != 4:
            big = cv2.resize(big, (img.shape[1] * escala, img.shape[0] * escala), interpolation=cv2.INTER_AREA)
        return big
    big = cv2.resize(img, None, fx=escala, fy=escala, interpolation=cv2.INTER_LANCZOS4)
    return cv2.bilateralFilter(big, 9, 30, 9)


def color_original(big, img, S, sigma=2.0, umbral=3.0, tope=10.0, min_peso=0.25):
    """H16b (flag experimentos.color_original): devuelve al resultado del ESRGAN el color de baja frecuencia
    de la imagen original. El ESRGAN anime aplana los escalones de bajo contraste (ΔE 3–6) y los convierte
    en degradados: las 5 bandas de tonos cercanos de S4 salen como una rampa continua y la paleta ya no
    puede separarlas. Corrección: big + desenfoque normalizado (σ = `sigma` px de referencia) de la
    diferencia (original bicúbica − ESRGAN), medida solo en píxeles planos en ambas (gradiente < `umbral`
    ΔE por px de referencia), para que los bordes nítidos (líneas) no dejen halos. Conserva el detalle fino
    del ESRGAN (escalas < σ) y el color del original a escalas mayores. |corrección| ≤ `tope` ΔE."""
    H, W = big.shape[:2]
    Lb = lab(big)
    Lc = lab(cv2.resize(img, (W, H), interpolation=cv2.INTER_CUBIC))

    def grad(Lx):
        g = np.zeros((H, W), np.float32)
        for c in range(3):
            x = cv2.GaussianBlur(np.ascontiguousarray(Lx[..., c]), (0, 0), max(0.5, S / 2))
            gx = cv2.Sobel(x, cv2.CV_32F, 1, 0, ksize=3) / 8
            gy = cv2.Sobel(x, cv2.CV_32F, 0, 1, ksize=3) / 8
            g += gx * gx + gy * gy
        return np.sqrt(g) * S                      # ΔE por px de referencia
    w = ((grad(Lb) < umbral) & (grad(Lc) < umbral)).astype(np.float32)
    s = sigma * S
    bw = cv2.GaussianBlur(w, (0, 0), s)
    corr = np.zeros_like(Lb)
    for c in range(3):
        corr[..., c] = cv2.GaussianBlur(w * (Lc[..., c] - Lb[..., c]), (0, 0), s) / np.maximum(bw, 1e-3)
    n = np.sqrt((corr ** 2).sum(-1, keepdims=True))
    corr *= np.minimum(1, tope / np.maximum(n, 1e-6))
    corr *= np.clip(bw / min_peso, 0, 1)[..., None]
    color_original.ultima = corr
    return rgb_de_lab(Lb + corr)


# ------------------------------------------------------------------ H17: ESRGAN selectivo (r3 paleta)
def _grad_ref(Lx, sigma):
    """Magnitud del gradiente Lab (ΔE76 por px) tras un desenfoque gaussiano `sigma` px."""
    g = np.zeros(Lx.shape[:2], np.float32)
    for c in range(3):
        x = cv2.GaussianBlur(np.ascontiguousarray(Lx[..., c]), (0, 0), sigma)
        gx = cv2.Sobel(x, cv2.CV_32F, 1, 0, ksize=3) / 8
        gy = cv2.Sobel(x, cv2.CV_32F, 0, 1, ksize=3) / 8
        g += gx * gx + gy * gy
    return np.sqrt(g)


def fidelidad(big, img, S, umbral=2.0, razon=0.5, largo=2.0, dilatar=1.0, sigma=0.7, color=None, extra=None,
              abrir=0, cerrar=None, area_min=0, textura=None):
    """H17 (flag experimentos.esrgan_selectivo): zona donde el ESRGAN borró estructura del original.

    Se compara a la escala de la REFERENCIA (el ESRGAN reducido con INTER_AREA contra el original), para
    que el afilado de un borde (mismo salto en menos píxeles) no cuente como pérdida: un píxel es
    "estructura perdida" si |∇orig| > `umbral` (ΔE76 por px de referencia, tras σ = `sigma` px) y
    |∇esrgan| < `razon`·|∇orig|. Solo cuentan los tramos de ≥ `largo` px de referencia (componentes
    8-conexas por su lado mayor), para que el grano del JPEG no entre. La zona se dilata `dilatar`·S a la
    escala de trabajo. `extra`: máscara (escala de trabajo) que se suma tal cual (miniaturas).
    `color` (ΔE76, None = apagado): también es estructura perdida el píxel donde el color del ESRGAN
    reducido se aparta del original (ambos con σ = `sigma`) más de `color`: el ESRGAN oscurece los núcleos
    de las franjas finas y cambia el tono de los detalles diminutos (S4 franjas ΔE 5.9 de media).
    `textura` (ventana px, densidad mínima[, área mínima px²]): el criterio de color solo vale en textura fina, donde casi
    todos los píxeles de la ventana son borde (|∇orig| > `umbral`): panel de franjas sí; contornos, ojos y
    accesorios no (ahí el ESRGAN solo afila, y sobre Lanczos el mapa sale en mosaico y con más nodos).
    Devuelve (imagen Lanczos ×S, zona bool a escala de trabajo)."""
    h, w = img.shape[:2]
    H, W = big.shape[:2]
    lz = cv2.resize(img, (W, H), interpolation=cv2.INTER_LANCZOS4)
    chico = cv2.resize(big, (w, h), interpolation=cv2.INTER_AREA)
    go = _grad_ref(lab(img), sigma)
    ge = _grad_ref(lab(chico), sigma)
    # máximo 3×3 del gradiente del ESRGAN: si solo afiló el borde (el salto se corre medio píxel y se
    # concentra), no es estructura perdida
    perdida = (go > umbral) & (cv2.dilate(ge, np.ones((3, 3), np.uint8)) < razon * go)
    if color:
        bo = cv2.GaussianBlur(lab(img), (0, 0), sigma)
        be = cv2.GaussianBlur(lab(chico), (0, 0), sigma)
        # mínimo en la vecindad 3×3 del original: un borde corrido medio píxel no es pérdida de color
        d = np.full(go.shape, np.inf, np.float32)
        bp = np.pad(bo, ((1, 1), (1, 1), (0, 0)), mode='edge')
        for dy in range(3):
            for dx in range(3):
                d = np.minimum(d, np.sqrt(((bp[dy:dy + h, dx:dx + w] - be) ** 2).sum(-1)))
        dc = d > color
        if textura:
            win, dmin = textura[:2]
            amin = textura[2] if len(textura) > 2 else 0
            den = (cv2.blur((go > umbral).astype(np.float32), (int(win), int(win))) >= dmin).astype(np.uint8)
            entero = textura[3] if len(textura) > 3 else None
            kd = cv2.getStructuringElement(cv2.MORPH_RECT, (int(win) // 2 * 2 + 1,) * 2)
            if amin:
                # solo paneles de textura (S4 franjas ≈ 170×170 px), no los accesorios diminutos de R2
                nd, ccd, std, _ = cv2.connectedComponentsWithStats(den, connectivity=8)
                okd = std[:, cv2.CC_STAT_AREA] >= amin
                okd[0] = False
                if entero:
                    # panel con ≥ `entero` de su área con color perdido: va entero a Lanczos (si no, la
                    # mitad ESRGAN del panel sigue partiendo las franjas en guiones)
                    frac = ndi.mean(dc, ccd, np.arange(nd)) if nd else []
                    for j in np.nonzero(okd)[0]:
                        if frac[j] >= entero:
                            dc |= cv2.dilate((ccd == j).astype(np.uint8), kd) > 0
                den = okd[ccd].astype(np.uint8)
            den = cv2.dilate(den.astype(np.uint8), kd) > 0
            dc &= den
        perdida |= dc
    perdida = perdida.astype(np.uint8)
    if abrir:
        # cierre + apertura (radio `abrir` px de referencia): junta las franjas de un panel y quita los trazos
        # sueltos de 1–2 px a lo largo de los contornos (el ESRGAN oscurece el núcleo de toda línea: no es
        # estructura perdida y sobre Lanczos el contorno saldría escalonado)
        cr = abrir if cerrar is None else cerrar
        kc = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * cr + 1,) * 2)
        kk = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * abrir + 1,) * 2)
        perdida = cv2.morphologyEx(cv2.morphologyEx(perdida, cv2.MORPH_CLOSE, kc), cv2.MORPH_OPEN, kk)
    n, cc, st, _ = cv2.connectedComponentsWithStats(perdida, connectivity=8)
    lado = np.maximum(st[:, cv2.CC_STAT_WIDTH], st[:, cv2.CC_STAT_HEIGHT])
    ok = (lado >= largo) & (st[:, cv2.CC_STAT_AREA] >= area_min)
    ok[0] = False
    perdida = ok[cc]
    zona = cv2.resize(perdida.astype(np.uint8), (W, H), interpolation=cv2.INTER_NEAREST)
    r = int(round(dilatar * S))
    if r > 0:
        zona = cv2.dilate(zona, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1,) * 2))
    zona = zona > 0
    if extra is not None:
        zona |= extra
    fidelidad.ultima = {'go': go, 'ge': ge, 'perdida': perdida}
    return lz, zona


def esrgan_selectivo(big, img, S, cfg, opts=True):
    """H17: devuelve (imagen de trabajo, zona, Lanczos ×S). En la zona de estructura perdida (`fidelidad`) la imagen de
    trabajo es la Lanczos ×S del original; fuera, el ESRGAN. Miniaturas (alto del recorte ≤ `mini_alto` px
    de origen, como S3): además la cabeza (polígono `partes.cabeza` de la config) o, sin cabeza, todo el
    recorte (`miniatura`: 'cabeza' | 'todo' | False)."""
    o = opts if isinstance(opts, dict) else {}
    H, W = big.shape[:2]
    extra = None
    modo = o.get('miniatura', False)   # 'cabeza' probado en S3: F sube pero la cara sale en manchas y sin ojos
    if modo and img.shape[0] <= o.get('mini_alto', 256):
        cab = (cfg.get('partes') or {}).get('cabeza')
        if modo == 'cabeza' and cab:
            m = np.zeros((H, W), np.uint8)
            cv2.fillPoly(m, [np.array([[x * S, y * S] for x, y in cab['poligono']], np.int32)], 1)
            extra = m > 0
        else:
            extra = np.ones((H, W), bool)
    kw = {k: o[k] for k in ('umbral', 'razon', 'largo', 'dilatar', 'sigma', 'abrir', 'cerrar', 'area_min') if k in o}
    # criterio de gradiente (H17 (1)): medido en los 12 casos, a escala de referencia el ESRGAN casi nunca
    # pierde un borde (solo lo afila); solo añadía vetas (ceja de R3) y nodos -> apagado por defecto (razon 0)
    kw.setdefault('razon', 0.0)
    kw['color'] = o.get('color', 5.0)
    kw['textura'] = o.get('textura', (16, 0.9, 1600, 0.15))
    lz, zona = fidelidad(big, img, S, extra=extra, **kw)
    bil = o.get('bilateral', None)
    if bil:
        # Lanczos trae el grano del JPEG: un bilateral (σ color `bil` ΔE-ish, σ espacio 1·S) lo aplana sin
        # mover los bordes, para que la clasificación no salga en mosaico (iris de R6)
        lz = cv2.bilateralFilter(lz, 2 * S + 1, float(bil), float(S))
    out = big.copy()
    out[zona] = lz[zona]
    return out, zona, lz
