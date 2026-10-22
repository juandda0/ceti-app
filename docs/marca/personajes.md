# Sistema de personajes — Ceti

> Parte de la identidad visual (ver [estrategia.md](estrategia.md) e [identidad.md](identidad.md)). En definición desde el 2026-10-20.
> Diseño en Artifacts de Claude. Las animaciones se registran en `src/features/animations/catalog.ts`.

## Elenco

- **Protagonista:** Ceti, la ballena espacial (ver [estrategia.md](estrategia.md)).
- **Secundarios:** astronautas y aliens. Comparten el mundo espacial y el estilo line-art del logo.

## Regla de animación

Ningún personaje es una imagen estática: todos se entregan como animación (Lottie). Según dónde aparece, el personaje tiene uno de estos tres tipos de animación.

### Tipo A: acompañante de mundo

Acompaña los niveles en la interfaz del mundo.

- **Comportamiento:** movimiento sencillo y constante, en loop.
- **Carácter:** suave, nada brusco. Flotar, respirar, mecerse, parpadear.
- **Reglas de producción:**
  - Loop perfecto: el último fotograma empalma con el primero, sin saltos.
  - Ciclos lentos (entre 2 y 4 s) y siempre con curvas ease-in-out. Nada de golpes, rebotes fuertes ni cambios de pose bruscos.
  - Amplitud pequeña: el personaje no se sale de su caja ni distrae de los niveles.
- **Catálogo:** `loop: true`, sin háptico. Con "reducir movimiento" activo queda en la pose quieta.

### Tipo B: personaje de pregunta

Acompaña cada pregunta del quiz.

- **Comportamiento:**
  1. **Espera:** mientras el usuario responde, está quieto en su pose inicial.
  2. **Respuesta correcta:** hace una animación de celebración.
  3. **Respuesta incorrecta:** no reacciona y se queda en la pose inicial. Así el error no se castiga, que es coherente con los límites del humor de la marca.
- **Reglas de producción:**
  - El primer fotograma de la animación es la pose inicial: esa pose se muestra mientras el usuario responde.
  - La celebración arranca desde la pose inicial y termina de vuelta en ella, para que el personaje quede listo para la siguiente pregunta sin saltos.
  - Duración corta (alrededor de 1,5 s), para no frenar el ritmo del quiz.
- **Catálogo:** `loop: false` y háptico `success` al celebrar. Con "reducir movimiento" activo no celebra y se queda en la pose inicial.

### Tipo C: protagonista en pantallas de cierre

Solo para Ceti. Aparece en las pantallas de finalización o de hito: resumen del mundo recién terminado, registro completado e inicio de sesión.

- **Comportamiento:**
  1. **Entrada:** una animación vistosa que se reproduce una sola vez al abrir la pantalla.
  2. **Reposo:** al terminar la entrada, pasa a una animación sencilla y constante en loop, con las mismas reglas del tipo A.
- **Reglas de producción:**
  - Son dos tramos de una misma pieza: la entrada (una vez) y el reposo (en loop).
  - El último fotograma de la entrada es idéntico al primero del reposo, para que el paso de uno a otro no se note.
  - La entrada sí puede ser grande y expresiva (saltos, giros, destellos, estrellas), porque es el momento de celebrar. El reposo vuelve a ser suave.
  - Entrada de 2 a 3 s como máximo, para no bloquear el botón de continuar.
- **Catálogo:** háptico `success` al iniciar la entrada. Con "reducir movimiento" activo se salta la entrada y muestra el reposo quieto. Hoy el catálogo solo admite `loop: true/false` por pieza, así que habrá que extenderlo con los dos tramos (entrada y reposo) cuando se implemente.

## Pendiente

- Diseño de cada personaje (nombre, rol, personalidad, color, expresiones).
- Decidir si el personaje de pregunta lleva un parpadeo mínimo durante la espera o queda totalmente quieto.
- Asignar a cada personaje secundario su tipo (A, B o ambos). El tipo C es exclusivo de Ceti.
- Definir la entrada de Ceti para cada pantalla de cierre (¿una por pantalla o una compartida?).
