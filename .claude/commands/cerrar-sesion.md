---
description: Cierra la sesión de trabajo — actualiza docs/estado.md (y decisiones.md si hubo decisión), resume el avance y deja el punto de reanudación.
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

Cierra la sesión actual:

1. **Resume el avance** de esta sesión: qué se construyó/demolió, qué `RQ-id`(s) se
   tocaron, qué gates quedaron verdes/rojos.
2. **Actualiza `docs/estado.md`**: añade/ajusta la bitácora de la fase con el avance
   y el **punto de reanudación** (qué sigue exactamente).
3. **Si hubo una decisión nueva** (algo que cambia el "qué" o el "cómo" a nivel
   producto/arquitectura), regístrala en `docs/empresa/decisiones.md` citándola —
   ese archivo es de máxima autoridad y no se reabre a la ligera.
4. **No inventes estado**: refleja lo realmente verificado (si un gate falló, dilo
   con su salida; si un paso se saltó, dilo).

No toques código de la app en este comando: es solo bitácora.
