# Biblia de personaje: Sofi (borrador)

> Personaje basado en Sofi, la pareja de Juan (creador de Ceti), con autorización de Juan para usar sus fotos. Borrador del 2026-10-21, abierto a cambios.
> Estilo: el de Ceti, Tato y Juan ([ceti-biblia.md](ceti-biblia.md), [tato-biblia.md](tato-biblia.md), [juan-biblia.md](juan-biblia.md)). Referencia: dos fotos que compartió Juan; a Gemini solo se subió el recorte de Sofi.

## Ficha

| Campo | Sofi |
|---|---|
| Quién es | Navegante de la nave de Ceti: traza las rutas y sabe cuánto falta para llegar |
| Edad | ~20 años |
| Tripulación | Trabaja con los capitanes Juan y Santiago; es la pareja de Juan |
| Rol en la app | Metas y progreso: muestra la ruta hacia una meta de ahorro, cuánto se ha avanzado y cuánto falta; celebra cuando el usuario llega a un hito |
| Accesorio | Mapa estelar enrollado (o carta de navegación) y su collar con dije de flor rosada |
| Frase | "Vamos bien. Si seguimos así, llegamos antes de lo que crees." |

## Historia

Sofi es la que mira el mapa cuando todos miran por la ventana. En la nave de Ceti se encarga de las rutas: cada meta del usuario es un destino y ella marca el camino en etapas pequeñas que sí se pueden cumplir. No le gustan los atajos que salen caros. Trajo a bordo un ramo de rosas rosadas que cuida en la cabina de navegación, y lo usa para recordar que las cosas buenas crecen con paciencia.

## Personalidad

| Rasgo | Cómo se ve | Cómo se mueve |
|---|---|---|
| Serena | Sonrisa suave con los labios cerrados | Movimientos suaves, nada brusco |
| Organizada | Siempre con su mapa estelar | Señala la ruta con el dedo |
| Cariñosa | Mira al usuario, rubor marcado | Saluda con la mano abierta y ladea la cabeza |
| Celebra en grande cuando se llega | Ojos felices, rosa en la mano | Salto con los brazos arriba |

- **Pasión:** las flores (rosas rosadas), las fotos y los planes bien hechos.
- **Meta:** que nadie de la tripulación se pierda en el camino a su meta.
- **Dato curioso:** le pone nombre de flor a cada ruta.

## Rasgos para el personaje (de las fotos)

- Cara redonda con mejillas llenas, piel clara con rubor rosado marcado.
- Pelo negro liso por los hombros, raya de lado y flequillo largo hacia un lado que le enmarca la cara (en la foto 2 lo lleva más largo; el personaje usa el largo de los hombros).
- Ojos oscuros castaños, un poco rasgados, con pestañas marcadas; cejas oscuras y finas-medias, rectas con arco suave.
- Labios rosados naturales (foto 1; Juan descartó los labios rojos), carnosos; sonrisa suave.
- **Lunar pequeño** debajo de los labios, hacia un costado (pedido de Juan).
- Collar de cordón negro con dije de flor rosada (foto 1).
- Rosas rosadas pálidas (foto 2) como motivo.

## Diseño (base aprobada 2026-10-21: `assets/brand/bocetos/sofi-01-hoja-modelo.jpg`, tal cual; `sofi-02` con labios rojos quedó descartada)

1. Mismo lenguaje que el elenco: sin contorno, relleno plano, bordes en un tono más oscuro, ojos redondos con pupila y brillo, cejas cortas y gruesas, rubor, nariz un poco más oscura que la piel. Ojos con dos o tres pestañas arriba (rasgo femenino simple, como en Duolingo).
2. Proporción de Tato y Juan (~3 cabezas): joven de ~20, no bebé.
3. Traje crema de la tripulación con paneles **rosa/lila** (color propio; no choca con turquesa de Tato, azul cielo de Juan ni naranja de Ceti) y un detalle naranja de la tripulación.
4. Collar con dije de flor rosada sobre el cuello del traje y una rosa rosada como parche del hombro.
5. Accesorio firma: mapa estelar enrollado (en una pose lo abre y señala la ruta).
6. Sin estereotipos: nada de maquillaje exagerado ni cintura irreal; misma silueta de traje que el resto del elenco.

## Movimiento

- **Reposo (loop):** respira y se mece suave; parpadea.
- **Saludo:** levanta la mano libre y saluda, ladeando la cabeza.
- **Espera (tipo B):** quieta en su pose, solo parpadea.
- **Celebración (tipo B):** salto suave con el brazo arriba y estrellas; vuelve a la pose inicial (~1,5 s).

## Sudadera (prenda del vestidor, 2026-10-22)

- SVG: `assets/brand/sofi/sofi-sudadera.svg` (viewBox `0 0 520 790`, la misma del traje). Grupos: `sombra-piso`, `cuerpo`, `cabeza` (con `ojo-izq` y `ojo-der`), `brazo-izq`, `brazo-der`, con los mismos pivotes que `sofi-frente.svg`.
- Hoja: `assets/brand/bocetos/sofi-sudadera-01.jpg` (Gemini 3.6 Flash, edición de la vista de frente de `sofi-01-hoja-modelo.jpg`); alineada en `sofi-sudadera-01-alineada.png`. Vector: `scripts/marca/vectorizar/personajes/sofi-sudadera.json`.
- Diseño: sudadera rosa/lila `#D5A2B1` con borde `#B77784` (sombras `#C18692`, `#A1636F`), capucha bajada (el pelo cae a los lados), escote en V con el collar de cordón negro y la flor rosada encima, bolsillo canguro, puños y elástico acanalados, cordones crema `#FFF1E0` con puntas `#FB6711` y la ballena de Ceti en el pecho (la de la insignia del traje de Juan; su traje no la tenía). Manos sin guante; el mapa estelar como en la hoja.
- La cabeza (con los ojos) y la sombra del piso se copian **idénticas** de `sofi-frente.svg` (retoque `grupo_de`).

### Paleta de piel (tal como está en el SVG)

| uso | hex |
|---|---|
| piel base (cara, orejas, cuello, manos) | `#F6B69C` |
| bordes (contorno de cara y mandíbula, orejas, manos) | `#C47F70` |
| nariz, interior de las orejas, sombra bajo el flequillo, cuello | `#DB947F` |
| sombras finas (boca, base de la nariz, orejas) | `#B56D61` |
| rubor | `#EE9683` |
| labios | sonrisa `#B56D61`, labio de abajo `#DB947F` |
| lunar | `#141414` |
| barba | no tiene |

### Ojos (coordenadas de la viewBox)

| ojo | centro (data-centro) | radio |
|---|---|---|
| `ojo-izq` | 193.9, 177.3 | 17.2 |
| `ojo-der` | 278.2, 177.2 | 17.2 |
