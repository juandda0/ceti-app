# Biblia de personaje: Santiago (borrador)

> Personaje basado en Santiago, cocreador de Ceti junto a Juan (con autorización de Juan para usar su foto y subirla a Gemini). Borrador del 2026-10-21, abierto a cambios.
> Estilo: el de Ceti, Tato, Juan y Sofi ([ceti-biblia.md](ceti-biblia.md), [tato-biblia.md](tato-biblia.md), [juan-biblia.md](juan-biblia.md), [sofi-biblia.md](sofi-biblia.md)). Referencia: foto de Santiago compartida por Juan.

## Ficha

| Campo | Santiago |
|---|---|
| Quién es | Uno de los dos capitanes de la nave de Ceti, junto a Juan (cocreadores, misma importancia) |
| Edad | ~20 años (como Juan) |
| Tripulación | Cocapitán con Juan; Sofi traza las rutas, Tato pilota y Ceti guía al usuario |
| Rol en la app | Bienvenida, hitos grandes y momentos de la nave, en pareja con Juan; accesorio: radar de mano |
| Accesorio | Radar de mano de capitán (equivalente a la tablet de Juan): pantalla redonda con barrido y paneles verde menta |
| Frase | "Tranquilo, ya lo tengo en el radar." |

## Historia

Juan y Santiago armaron la nave de Ceti juntos y la mandan juntos: ninguno es el segundo del otro. Juan lleva la tablet con el plan del viaje; Santiago lleva el radar y mira lo que viene: un gasto que se acerca, una meta que queda a la vista, una oportunidad de ahorrar. Habla poco y con calma, y cuando habla es porque ya lo pensó.

## Personalidad

| Rasgo | Cómo se ve | Cómo se mueve |
|---|---|---|
| Tranquilo | Mirada serena detrás de sus gafas, media sonrisa | Movimientos pausados, nada brusco |
| Previsor | Siempre con el radar en la mano | Mira el radar y luego al usuario |
| Leal | Al lado de Juan en las escenas de la nave | Saluda con la mano abierta, sin exagerar |
| Se alegra de verdad cuando algo sale bien | Sonrisa amplia, ojos felices | Puño arriba y salto corto |

- **Meta:** que ninguna sorpresa agarre desprevenida a la tripulación.
- **Dato curioso:** se sube las gafas con un dedo antes de dar una buena noticia.

## Rasgos para el personaje (de la foto)

- Pelo oscuro (casi negro) corto y texturizado, con algo de volumen arriba.
- Gafas negras gruesas de montura rectangular (en el personaje, grandes para que se lean los ojos).
- Piel clara/trigueña.
- Barba incipiente en la mandíbula y bigote (en el personaje, una sombra suave de tono, sin rayitas).
- Labios gruesos; mirada tranquila/seria.
- Camiseta crema (encaja con el traje crema de la tripulación).

## Diseño (base aprobada 2026-10-21: `assets/brand/bocetos/santiago-01-hoja-modelo.jpg`; la `santiago-02` quedó descartada porque la barba salió en puntitos)

1. Mismo lenguaje que el elenco: sin contorno, relleno plano, bordes en un tono más oscuro, ojos redondos con pupila y brillo, cejas cortas y gruesas, rubor, nariz un poco más oscura que la piel.
2. Proporción de Tato, Juan y Sofi (~3 cabezas): joven de ~20, no bebé.
3. Traje crema de la tripulación con paneles **verde menta** (color propio; no choca con el turquesa de Tato, el azul cielo de Juan, el rosa/lila de Sofi ni el naranja de Ceti) e **insignia de capitán igual a la de Juan**: la ballena naranja de Ceti en el pecho.
4. Gafas negras rectangulares grandes como firma; la barba como sombra plana un tono más oscuro que la piel.
5. Accesorio de mando: radar de mano con pantalla verde menta.
6. Ajustes del vector sobre la hoja: pelo casi negro (`#2B211E`, el tono de la `santiago-02`), sin el aparato verde de la muñeca (puño menta liso) y labio de abajo un poco más lleno.

## Movimiento

- **Reposo (loop):** respira y se mece suave; parpadea.
- **Saludo:** levanta la mano libre y saluda con calma.
- **Espera (tipo B):** quieto en su pose, solo parpadea.
- **Celebración (tipo B):** salto corto con el brazo arriba y estrellas; vuelve a la pose inicial (~1,5 s).

## Sudadera (prenda del vestidor, 2026-10-22)

- SVG: `assets/brand/santiago/santiago-sudadera.svg` (viewBox `0 0 520 790`, la misma del traje). Grupos: `sombra-piso`, `cuerpo`, `gafas` (vacío, como en el traje), `cabeza` (con `ojo-izq` y `ojo-der`), `brazo-izq`, `brazo-der`, con los mismos pivotes que `santiago-frente.svg`.
- Hoja: `assets/brand/bocetos/santiago-sudadera-01.jpg` (Gemini 3.6 Flash, edición de la vista de frente de `santiago-01-hoja-modelo.jpg`); alineada en `santiago-sudadera-01-alineada.png`. Vector: `scripts/marca/vectorizar/personajes/santiago-sudadera.json`.
- Diseño: sudadera verde menta `#95DAB1` con borde `#5F9E86` (sombras `#77B393`, `#58947C`), capucha bajada, escote en V, bolsillo canguro, puños y elástico acanalados, cordones crema `#FFF1E0` con puntas `#FA8636` y la ballena de su insignia del traje en el pecho. Manos sin guante. Sin el aparato de la muñeca (como en el traje): en su lugar va el puño acanalado.
- La cabeza (con ojos y gafas), el radar y la sombra del piso se copian **idénticos** de `santiago-frente.svg` (retoques `grupo_de` y `copiar_de`). A la cabeza se le quita el collar crema del traje; el cuello va dibujado en el cuerpo, detrás de la capucha.

### Paleta de piel (tal como está en el SVG)

| uso | hex |
|---|---|
| piel base (cara, orejas, cuello, manos) | `#EEAD8F` |
| bordes (orejas, manos, lados del cuello) | `#B5705F` |
| borde de la mandíbula | `#A96B59` |
| nariz, mejillas bajo las gafas, sombra del cuello | `#DB9A7F` |
| sombras de la frente bajo el pelo, interior de las orejas, base de la nariz | `#B67463`, `#CD8D74`, `#B17363`, `#B06A5C` |
| labios | sonrisa `#B27361`, labio de abajo `#D58F7B` |
| barba (sombra plana) | `#C39580` |
| rubor | sin color propio (lo hace `#DB9A7F`) |
| párpados | `#6B3326` |

### Ojos (coordenadas de la viewBox)

| ojo | centro (data-centro) | radio | centro del iris |
|---|---|---|---|
| `ojo-izq` | 196, 187.5 | 20 | 198.5, 188 |
| `ojo-der` | 276.5, 187.5 | 20.5 | 275, 188 |
