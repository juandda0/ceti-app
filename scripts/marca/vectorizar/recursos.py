"""Límites compartidos entre procesos (varios agentes corren el banco a la vez).

- `gpu()`: candado exclusivo para Real-ESRGAN (una sola GPU de 4 GB).
- `cupo()`: semáforo de N corridas pesadas simultáneas (memoria), N = VECTORIZAR_CUPOS (3 por defecto).
"""
import contextlib
import fcntl
import os
import time
from pathlib import Path

DIR = Path.home() / '.cache/vectorizar/candados'


@contextlib.contextmanager
def gpu():
    DIR.mkdir(parents=True, exist_ok=True)
    with open(DIR / 'gpu.lock', 'w') as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(f, fcntl.LOCK_UN)


@contextlib.contextmanager
def cupo():
    DIR.mkdir(parents=True, exist_ok=True)
    n = int(os.environ.get('VECTORIZAR_CUPOS', '3'))
    while True:
        for i in range(n):
            f = open(DIR / f'cupo-{i}.lock', 'w')
            try:
                fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                f.close()
                continue
            try:
                yield
            finally:
                fcntl.flock(f, fcntl.LOCK_UN)
                f.close()
            return
        time.sleep(0.5)
