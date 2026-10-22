"""CLI: python -m vectorizar <personaje|config.json> [-o salida.svg] [--solo-retoques [BASE.svg]] [--revisar]

Ejecutar desde scripts/marca (o con PYTHONPATH=scripts/marca) usando ~/.venvs/mascot/bin/python.

- Corrida completa: vectoriza, guarda el SVG del motor en ~/.cache/vectorizar/base/<personaje>.svg, aplica
  los `retoques` del JSON y escribe la salida.
- --solo-retoques: no vuelve a correr el motor; toma el SVG base (el último guardado o el que se indique)
  y aplica los retoques (segundos). Para iterar correcciones puntuales.
- --revisar: al terminar genera la hoja de revisión crítica (vectorizar.revisar) y la imprime.
"""
import argparse
import json
import sys
from pathlib import Path

from .pipeline import RAIZ, cargar, vectorizar


def main():
    ap = argparse.ArgumentParser(prog='vectorizar')
    ap.add_argument('personaje', help='nombre en vectorizar/personajes/ o ruta a un .json')
    ap.add_argument('-o', '--salida', help='SVG de salida (por defecto la del config)')
    ap.add_argument('--solo-retoques', nargs='?', const='', default=None, metavar='BASE.svg',
                    help='aplicar solo los retoques sobre el SVG base (sin correr el motor)')
    ap.add_argument('--revisar', action='store_true', help='generar la hoja de revisión crítica al terminar')
    ap.add_argument('--banco', help='caso del banco para medir (tato, juan, ceti, ...)')
    ap.add_argument('--png', help='comparativa lado a lado con zoom')
    ap.add_argument('-q', '--silencio', action='store_true')
    a = ap.parse_args()
    log = (lambda *x: None) if a.silencio else (lambda *x: print(*x, file=sys.stderr))
    cfg = cargar(a.personaje)
    base_p = Path.home() / f'.cache/vectorizar/base/{cfg["_nombre"]}.svg'
    if a.solo_retoques is not None:
        base_p = Path(a.solo_retoques) if a.solo_retoques else base_p
        svg = base_p.read_text()
        log(f'base: {base_p}')
    else:
        svg, _ = vectorizar(cfg, log=log)
        base_p.parent.mkdir(parents=True, exist_ok=True)
        base_p.write_text(svg)
    if cfg.get('retoques'):
        from .retoques import aplicar
        svg = aplicar(svg, cfg['retoques'], log=log)
    from .puntaje import contrato
    fallos, _ = contrato(svg)
    if fallos:
        log('AVISO contrato animable: ' + '; '.join(fallos))
    out = Path(a.salida or (RAIZ / cfg['salida']))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(svg)
    print(f'{out}', file=sys.stderr)
    if a.revisar:
        from .revisar import revisar
        revisar(a.personaje, out)
    if a.banco:
        from . import banco
        m, ref, mine = banco.metricas(out, a.banco)
        print(json.dumps(m))
        if a.png:
            banco.comparativa(ref, mine, a.banco, a.png)


if __name__ == '__main__':
    sys.exit(main())
