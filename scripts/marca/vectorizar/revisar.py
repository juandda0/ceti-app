"""Revisión crítica: hoja de zonas con zoom para que Claude MIRE el resultado como un ilustrador antes de entregar.

Uso (desde scripts/marca):
  ~/.venvs/mascot/bin/python -m vectorizar.revisar <personaje> <svg> [--salida DIR] [--zoom 4]

Genera en DIR (por defecto ~/.cache/vectorizar/revision/<personaje>/):
  - una imagen por zona: referencia | vector | superposición (bordes del vector en magenta sobre la
    referencia en gris), con rejilla de coordenadas del recorte (rayitas cada 10 px, número cada 50), para
    leer dónde va un retoque;
  - zonas: ojos (siempre), cabeza, cada mano (parte baja de cada brazo), las de `revision` del JSON
    ({nombre: [x, y, w, h]}) y las 6 zonas donde el vector más se aleja de la referencia (sospechosas);
  - LISTA.md con la lista de comprobación que hay que responder mirando cada imagen.

La métrica no ve todo (un ojo sin párpado puede sacar 99 %): esta hoja existe para que el juicio visual
decida. Defecto puntual -> retoque en el JSON (`retoques.py`); defecto que se repite -> el motor.
"""
import argparse
import io
import re
import sys
from pathlib import Path

import cairosvg
import cv2
import numpy as np
from PIL import Image, ImageDraw

from .pipeline import RAIZ, cargar
from .pre import lab, recorte

LISTA = """# Revisión crítica — {nombre}

Mira CADA imagen de esta carpeta (Read) y responde con sí/no + qué falla. Compara contra la referencia, no contra
lo que el motor "suele" hacer. Si algo se ve raro a zoom, ES un defecto aunque la métrica sea alta.

1. Ojos: ¿completos (esclera, iris, pupila, brillo, párpado/pestañas si la referencia los tiene)? ¿misma forma,
   tamaño, dirección de la mirada y expresión? ¿sin huecos blancos, muescas ni arcos sueltos?
2. Cejas, nariz, boca, lunares: ¿misma forma, grosor y posición? ¿la expresión es la misma?
3. Orejas, cuello, pelo: ¿silueta y mechones como la referencia? ¿sin motas ni manchas de otro tono?
4. Manos: ¿mismo número de dedos, separados igual, sin puntos claros ni huecos?
5. Accesorios (reloj, pulsera, collar, insignias, mapa, bolsa...): ¿se reconocen y conservan sus detalles?
6. Líneas/bordes: ¿continuos, de grosor parejo, del tono correcto (oscuro del relleno dueño), sin cambios de
   color a mitad de línea?
7. Limpieza: ¿sin rendijas entre colores, espigas, puntos sueltos ni dientes?
8. Silueta y proporciones generales: ¿se parece a la referencia de lejos?

Por cada defecto: zona, coordenadas (de la rejilla) y arreglo:
- PUNTUAL (un ojo, una raya, una mota) -> retoque en `personajes/<nombre>.json` (`"retoques"`: circulo, elipse,
  raya, forma, borrar, recolor, ojo) y `python -m vectorizar <nombre> --solo-retoques <svg-base>` para verlo.
- SISTEMÁTICO (se repite en varios personajes) -> cambio en el motor + banco (`-m vectorizar.puntaje --todos`).
Vuelve a correr esta revisión después de corregir. No se entrega hasta que todas las respuestas sean "sí".
"""


def render(svg, w, h, z, fondo):
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=int(w * z), output_height=int(h * z),
                           background_color=fondo)
    return np.asarray(Image.open(io.BytesIO(png)).convert('RGB'))


def rejilla(img, x0, y0, z):
    """Rayitas cada 10 px del recorte y número cada 50, en los cuatro bordes."""
    im = Image.fromarray(img).convert('RGB')
    pad = 22
    out = Image.new('RGB', (im.width + 2 * pad, im.height + 2 * pad), (255, 255, 255))
    out.paste(im, (pad, pad))
    d = ImageDraw.Draw(out)
    w, h = im.width / z, im.height / z
    for X in range(int(np.ceil(x0 / 10) * 10), int(x0 + w) + 1, 10):
        px = pad + (X - x0) * z
        L = 9 if X % 50 == 0 else 4
        d.line([(px, pad - L), (px, pad)], fill=(0, 0, 0))
        d.line([(px, pad + im.height), (px, pad + im.height + L)], fill=(0, 0, 0))
        if X % 50 == 0:
            d.text((px + 2, 1), str(X), fill=(200, 0, 120))
    for Y in range(int(np.ceil(y0 / 10) * 10), int(y0 + h) + 1, 10):
        py = pad + (Y - y0) * z
        L = 9 if Y % 50 == 0 else 4
        d.line([(pad - L, py), (pad, py)], fill=(0, 0, 0))
        d.line([(pad + im.width, py), (pad + im.width + L, py)], fill=(0, 0, 0))
        if Y % 50 == 0:
            d.text((1, py + 2), str(Y), fill=(200, 0, 120))
    return out


def bordes(rgb):
    g = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    return cv2.Canny(cv2.GaussianBlur(g, (3, 3), 0.8), 30, 80) > 0


def zonas_auto(svg, W, H):
    z = {}
    for m in re.finditer(r'<g id="(ojo-(?:izq|der))"[^>]*data-centro="([\d.]+) ([\d.]+)"[^>]*data-radio="([\d.]+)"', svg):
        cx, cy, r = float(m.group(2)), float(m.group(3)), float(m.group(4))
        z[m.group(1)] = [cx - 2.6 * r, cy - 2.2 * r, 5.2 * r, 4.4 * r]
    for gid in re.findall(r'<g id="([^"]+)"', svg):
        if gid.startswith('ojo'):
            continue
        b = bbox_grupo(svg, gid)
        if not b:
            continue
        x0, y0, x1, y1 = b
        if gid == 'cabeza':
            z['cabeza'] = [x0, y0, x1 - x0, y1 - y0]
        elif gid.startswith('brazo'):
            hh = min(y1 - y0, max(60, 0.3 * (y1 - y0)))
            z[f'mano-{gid[6:]}'] = [x0, y1 - hh, x1 - x0, hh]
    return z


def bbox_grupo(svg, gid):
    from .retoques import _grupo
    try:
        _, e, c, _ = _grupo(svg, gid)
    except ValueError:
        return None
    nums = []
    for d in re.findall(r'\sd="([^"]*)"', svg[e:c]):
        nums += [float(x) for x in re.findall(r'-?\d*\.?\d+(?:e-?\d+)?', d)]
    if len(nums) < 4:
        return None
    xs, ys = nums[0::2], nums[1::2]
    return min(xs), min(ys), max(xs), max(ys)


def sospechosas(ref, mine, n=6, win=40, ya=()):
    """Ventanas donde más difiere: bordes que no coinciden + color (ΔE alto lejos de líneas)."""
    er, em = bordes(ref), bordes(mine)
    dr = cv2.distanceTransform((~er).astype(np.uint8), cv2.DIST_L2, 3)
    dm = cv2.distanceTransform((~em).astype(np.uint8), cv2.DIST_L2, 3)
    falta = er & (dm > 2)      # borde de la referencia sin equivalente en el vector
    sobra = em & (dr > 2)      # borde del vector que la referencia no tiene
    de = np.sqrt(((lab(ref) - lab(mine)) ** 2).sum(-1))
    cerca_linea = cv2.dilate(er.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    color = (de > 18) & ~cerca_linea
    mapa = falta.astype(np.float32) * 2 + sobra * 2 + color
    s = cv2.boxFilter(mapa, -1, (win, win), normalize=False)
    out = []
    H, W = s.shape
    s = s.copy()
    for x, y, w, h in ya:
        s[max(0, int(y)):int(y + h), max(0, int(x)):int(x + w)] *= 0.3
    for _ in range(n):
        y, x = np.unravel_index(np.argmax(s), s.shape)
        if s[y, x] <= 4:
            break
        out.append([max(0, x - win), max(0, y - win), 2 * win, 2 * win, float(s[y, x])])
        s[max(0, y - 2 * win):y + 2 * win, max(0, x - 2 * win):x + 2 * win] = 0
    return out


def revisar(nombre, svg_path, salida=None, zoom=4):
    cfg = cargar(nombre)
    svg = Path(svg_path).read_text()
    ref = recorte(RAIZ / cfg['src'], cfg['box'])
    H, W = ref.shape[:2]
    fondo = '#%02X%02X%02X' % tuple(int(v) for v in np.median(np.r_[ref[0], ref[-1], ref[:, 0], ref[:, -1]], 0))
    mine1 = render(svg, W, H, 1, fondo)
    out = Path(salida or Path.home() / f'.cache/vectorizar/revision/{cfg["_nombre"]}')
    out.mkdir(parents=True, exist_ok=True)
    for p in out.glob('*.png'):
        p.unlink()
    zonas = zonas_auto(svg, W, H)
    zonas.update(cfg.get('revision', {}))
    for i, (x, y, w, h, sc) in enumerate(sospechosas(ref, mine1, ya=list(zonas.values()))):
        zonas[f'sospechosa-{i + 1}'] = [x, y, w, h]
    mineZ = render(svg, W, H, zoom, fondo)
    refZ = cv2.resize(ref, (W * zoom, H * zoom), interpolation=cv2.INTER_CUBIC)
    lista = []
    for nombre_z, (x, y, w, h) in zonas.items():
        x0, y0 = max(0, int(x)), max(0, int(y))
        x1, y1 = min(W, int(x + w)), min(H, int(y + h))
        if x1 - x0 < 8 or y1 - y0 < 8:
            continue
        z = max(zoom, int(np.ceil(360 / max(1, min(x1 - x0, y1 - y0)))))
        z = min(z, 12)
        if z != zoom:
            a = cv2.resize(ref[y0:y1, x0:x1], ((x1 - x0) * z, (y1 - y0) * z), interpolation=cv2.INTER_CUBIC)
            b = render(svg, W, H, z, fondo)[y0 * z:y1 * z, x0 * z:x1 * z]
        else:
            a = refZ[y0 * z:y1 * z, x0 * z:x1 * z]
            b = mineZ[y0 * z:y1 * z, x0 * z:x1 * z]
        gris = cv2.cvtColor(cv2.cvtColor(a, cv2.COLOR_RGB2GRAY), cv2.COLOR_GRAY2RGB)
        sup = (gris * 0.55 + 115).astype(np.uint8)
        sup[bordes(b)] = (230, 0, 140)
        paneles = [rejilla(p, x0, y0, z) for p in (a, b, sup)]
        hoja = Image.new('RGB', (sum(p.width for p in paneles) + 20, paneles[0].height + 26), (255, 255, 255))
        d = ImageDraw.Draw(hoja)
        xx = 0
        for p, t in zip(paneles, ('referencia', 'vector', 'superposición: bordes del vector')):
            hoja.paste(p, (xx, 26))
            d.text((xx + 24, 6), f'{nombre_z} · {t}', fill=(0, 0, 0))
            xx += p.width + 10
        f = out / f'{nombre_z}.png'
        hoja.save(f)
        lista.append(f'- `{f}` — {nombre_z} [{x0}, {y0}, {x1 - x0}, {y1 - y0}] (zoom {z}×)')
    (out / 'LISTA.md').write_text(LISTA.format(nombre=cfg['_nombre']) + '\n## Imágenes\n' + '\n'.join(lista) + '\n')
    print(out / 'LISTA.md')
    print('\n'.join(lista))
    return out


def main():
    ap = argparse.ArgumentParser(prog='vectorizar.revisar')
    ap.add_argument('personaje')
    ap.add_argument('svg')
    ap.add_argument('--salida')
    ap.add_argument('--zoom', type=int, default=4)
    a = ap.parse_args()
    revisar(a.personaje, a.svg, a.salida, a.zoom)


if __name__ == '__main__':
    sys.exit(main())
