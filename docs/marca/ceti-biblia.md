# Biblia de personaje: Ceti

> Quién es Ceti antes de dibujarla. Base para bocetos, ilustración final y animación.
> Fuentes: [estrategia.md](estrategia.md) (voz y personalidad aprobadas), [investigacion-duolingo.md](investigacion-duolingo.md) y [referencias-ceti.md](referencias-ceti.md). Borrador del 2026-10-20, abierto a cambios.

## Ficha

| Campo | Ceti |
|---|---|
| Especie | Ballena jorobada espacial |
| Edad | Unos 300 años de ballena, actitud de hermana mayor de 25 |
| Hogar | Tau Ceti, en la constelación de Cetus (la Ballena) |
| Rol en la app | Coach: enseña, celebra y persigue con cariño a quien desaparece |
| Frase | "Nadie te enseñó plata. Yo sí." |

**¿Por qué jorobada?** Es la ballena de las aletas pectorales larguísimas (las usa como brazos para gesticular, como las alas de Duo), la de los surcos en la garganta (la panza del logo), la que **salta fuera del agua** (sus celebraciones) y la que **canta** (tararea cuando está feliz).

## Historia

Ceti lleva siglos nadando entre estrellas. Hace unos años empezó a captar las señales de la Tierra y se obsesionó con un misterio: por qué los humanos, una especie que llegó a la Luna, no entienden su propia plata. Vio gente pagando cuotas de manejo "por existir", pidiendo el tercer domicilio de la semana y firmando créditos sin leer. Decidió bajar a enseñarles.

El problema: Ceti es experta en plata, pero pésima con la tecnología humana. Escribe con las aletas y le salen mensajes llenos de errores, le tiene miedo al datáfono y una vez compró 40 pares de medias por un clic sin querer. Por eso se ríe de sí misma tanto como del sistema.

## Personalidad

| Rasgo | Cómo se ve | Cómo se mueve |
|---|---|---|
| Dramática | Cejas enormes y muy móviles, poses teatrales con las aletas | Exagera: todo empieza con anticipación y termina con rebote |
| Leal | Siempre mira al usuario; nunca le da la espalda | Vuelve a la pose de "te estoy esperando" |
| Un poco engreída | Párpados a media asta, sonrisa ladeada, aleta en el pecho | Pausas largas antes de la frase ganadora |
| Torpe con la tecnología | Accesorios humanos que no le quedan (celular diminuto, gafas) | Rebota contra las cosas, se le resbalan los objetos |

- **Opuesto que genera tensión:** un personaje calmado y paciente del elenco (por definir: Brotico, el alien del ahorro, es el candidato).
- **Pasión:** que nadie aprenda plata a las malas.
- **Meta:** que el usuario llegue al último mundo sin deudas tontas.
- **Obstáculo:** los humanos desaparecen cuando más los necesita (la racha).
- **Miedo:** que el usuario la cambie por una app de préstamos rápidos.
- **Dato curioso:** lleva 300 años intentando entender el 4x1000. Todavía no.

## Diseño aprobado (2026-10-20)

- **Dirección elegida:** A, naranja sin contorno (estilo Duolingo: forma sobre forma, relleno plano y un solo tono de sombra).
- **Silueta:** V3 de la exploración, gota erguida que se apoya en la cola, de frente, con las aletas como brazos.
- **Concepto de marca:** Ceti sale de un portal oscuro e inclinado lleno de estrellas (el agujero negro del logo).
- **Archivo maestro:** `assets/brand/ceti/ceti-frente.svg`, redibujado a mano desde la hoja de modelo de Gemini y separado por capas.
- **Animaciones:** `scripts/lottie/ceti-personaje.mjs` genera `mascot.ceti-reposo` (tipo A) y `mascot.ceti-celebra` (tipo B) desde la misma geometría.

| Color | Hex | Uso |
|---|---|---|
| Cuerpo | `#FB6711` | Cuerpo, aletas y cola (medido de la ilustración validada; el naranja de marca es `#FF8A1F`, por decidir) |
| Sombra | `#C24C10` | Delineado de aletas y cola, sonrisa, espiráculo |
| Aro del ojo | `#D9581A` | Delineado fino alrededor de la esclera |
| Panza | `#F7E0AD` | Panza |
| Surcos | `#E6B17E` | 3 surcos en S |
| Ojos y cejas | `#732C30` | Pupilas y cejas |
| Piso | `#EDC795` | Sombra elíptica bajo Ceti |

- **Archivo maestro validado (2026-10-20):** `assets/brand/ceti/ceti-frente.svg`, calcado de la vista de frente de la hoja de modelo (`assets/brand/bocetos/ceti-05-hoja-modelo.jpg`) con `scripts/marca/calco-ceti/`.
- **Animaciones:** `scripts/lottie/ceti-personaje.mjs` lee ese SVG y genera `assets/brand/ceti/lottie/` (reposo, espera, celebra). Se revisan en el artifact "Ceti Character System"; no se integran a la app hasta el final.

## Rasgos de diseño

Basados en la investigación de Duolingo y en las referencias humanas.

1. **Silueta:** cabeza de rectángulo redondeado que fluye a un cuerpo de frijol; la cabeza ocupa ~60 % de la figura. Reconocible en negro, sin puntas.
2. **Postura:** puede nadar en horizontal (reposo) o "sentarse" erguida sobre la cola, como coach que te habla de frente.
3. **Ojos:** dos ojos grandes, bajos y adelante, con pupila descentrada y brillo arriba a la izquierda. Cejas como formas separadas: son su herramienta de drama.
4. **Aletas pectorales largas:** funcionan como manos. Señalan, aplauden, se tapan la cara, sostienen objetos humanos.
5. **Panza crema con 3 surcos en S** que nacen bajo la sonrisa (la boca es el borde de la panza, como la mandíbula de una ballena).
6. **Espiráculo emocional (gesto firma):** suelta estrellas al celebrar, un corazón cuando te extraña, una nubecita gris cuando se indigna, zetas al dormir. Es el equivalente del fuego de la racha de Duo.
7. **Firma espacial:** pecas en el lomo con la forma de la constelación de Cetus. Discreta, pero única.
8. **Color:** naranja de marca `#FF8A1F`, como Duo lleva el verde de Duolingo (ver tabla arriba).

## Lo que Ceti no debe parecer

- **Moby Dock (Docker):** ballena azul de perfil con carga en el lomo.
- **Fail Whale (Twitter):** beluga blanca levantada por pájaros.
- **Wailmer / Wailord y Cetitan (Pokémon):** esfera azul con panza crema; ballena blanca de ojos grandes (y nombre parecido).
- **Ballenas femeninas cliché:** moño, pestañas, labial (Perlita de Bob Esponja).
- **Monstruo de Pinocho:** boca gigante amenazante.
- **Ballena épica con armadura de ciencia ficción.**

## Movimiento (base para Lottie)

- **Reposo:** flota con un ciclo lento de 3–4 s, la cola se mece desfasada del cuerpo (superposición) y parpadea cada 3–5 s con variación.
- **Celebración:** anticipación (se encoge), salto con estiramiento, giro, estrellas por el espiráculo y caída con aplastamiento y rebote.
- **Drama:** primero se congela un instante y después exagera. El timing es el chiste.
- **Capas separadas:** cuerpo, cola, aleta izquierda, aleta derecha, panza, ojos, pupilas, párpados, cejas, boca y espiráculo, para animar por partes y poder migrar a Rive si un día hace falta lip-sync.
