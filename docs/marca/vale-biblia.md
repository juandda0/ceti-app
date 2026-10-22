# Biblia de personaje: Vale (borrador)

> Personaje basado en la novia de Santiago, con su autorización (confirmada por Juan el 2026-10-22). Borrador del 2026-10-22, abierto a cambios.
> Estilo: el de Ceti, Tato, Juan, Santiago y Sofi ([ceti-biblia.md](ceti-biblia.md), [tato-biblia.md](tato-biblia.md), [juan-biblia.md](juan-biblia.md), [santiago-biblia.md](santiago-biblia.md), [sofi-biblia.md](sofi-biblia.md)). Referencia: una foto que compartió Juan. La hoja aprobada se generó a partir de una descripción en texto de sus rasgos, en el chat de Gemini de Sofi y reutilizando el cuerpo de Sofi.

## Ficha

| Campo | Vale |
|---|---|
| Quién es | Ingeniera de la nave de Ceti: la mantiene andando con lo que hay |
| Edad | ~20 años |
| Tripulación | Trabaja con los capitanes Juan y Santiago; es la novia de Santiago. Sofi traza las rutas, Tato pilota y Ceti guía al usuario |
| Rol en la app | Presupuesto y gastos del día a día: reparar antes que reemplazar, separar los gastos fijos de los imprevistos y cuidar lo que ya se tiene |
| Accesorio | Llave inglesa grande (cabeza gris plateada, mango amarillo sol) y gafas de taller subidas sobre la cabeza |
| Frase | "Eso tiene arreglo, y sale más barato." |

## Historia

Vale es la que se mete debajo del tablero cuando algo suena raro. En la nave de Ceti se encarga de que todo siga funcionando sin gastar de más: antes de comprar una pieza nueva revisa si la vieja tiene arreglo, y lleva la cuenta de lo que cuesta mantener la nave cada mes. Guarda cada tornillo suelto en un frasco porque "algún día sirve": es su fondo de emergencia. Con Sofi hace buen equipo: Sofi planea la ruta y Vale se asegura de que la nave aguante el viaje.

## Personalidad

| Rasgo | Cómo se ve | Cómo se mueve |
|---|---|---|
| Práctica | Sonrisa tranquila con los labios cerrados | Movimientos seguros, sin rodeos |
| Ingeniosa | Siempre con la llave en la mano | Gira la llave entre los dedos mientras piensa |
| Cálida | Mirada directa, rubor suave | Saluda con la mano abierta |
| Se ríe fuerte cuando algo por fin funciona | Sonrisa amplia, ojos felices | Salto corto con el puño arriba |

- **Pasión:** arreglar cosas y entender cómo funcionan.
- **Meta:** que la nave nunca se quede varada por un gasto que se pudo prever.
- **Dato curioso:** le pone nombre a cada herramienta de su caja.

## Rasgos para el personaje (de la foto)

- Pelo negro (casi negro), largo y liso, con raya al medio y sin flequillo; cae por delante de los hombros.
- Piel trigueña cálida; cara ovalada de mejillas llenas.
- Ojos castaños oscuros, almendrados, con pestañas marcadas; cejas oscuras bien definidas, con arco suave.
- Labios llenos en un rosado suave; sonrisa cálida con los labios cerrados.

## Diseño (base aprobada 2026-10-22: `assets/brand/bocetos/vale-01-hoja-modelo.jpg`)

1. Mismo lenguaje que el elenco: sin contorno, relleno plano, bordes en un tono más oscuro, ojos redondos con pupila y brillo, cejas cortas y gruesas, rubor, nariz un poco más oscura que la piel. Dos pestañas en el ala del párpado, como Sofi.
2. **Mismo cuerpo que Sofi y el resto del elenco** (~3 cabezas, misma silueta de traje, guantes, rodilleras y botas). Un primer intento solo con texto salió más bajo y rellenito y se descartó.
3. Traje crema de la tripulación con paneles **amarillo sol** (color propio; no choca con el naranja de Ceti, el turquesa de Tato, el azul cielo de Juan, el verde menta de Santiago ni el rosa/lila de Sofi) y el parche naranja de la tripulación en el hombro.
4. Gafas de taller de lentes redondos y correa amarilla, subidas sobre la cabeza como diadema.
5. Accesorio firma: llave inglesa grande de formas redondeadas, en la mano del lado derecho de la imagen (la misma mano en la que Juan lleva la tablet, Santiago el radar y Sofi el mapa).
6. Ajustes del vector sobre la hoja: la ballena del panel del pecho (insignia de capitán de Juan y Santiago) se cambió por la lucecita naranja de la tripulación, igual a la de Sofi. El pelo va de un solo tono, los párpados un tono más claros que el iris, la boca se redibujó con los rosados de la hoja, y el traje, los guantes, las botas y la sombra usan exactamente los colores de Sofi.

Vector: `scripts/marca/vectorizar/personajes/vale.json` (motor + retoques) → `assets/brand/vale/vale-frente.svg` (viewBox `0 0 520 790`, el mismo de Sofi y Santiago).

## Grupos del SVG

| Grupo | Contiene | Pivote |
|---|---|---|
| `sombra-piso` | Elipse de la sombra | — |
| `cuerpo` | Traje, panel del pecho, rodilleras, botas, pelo largo detrás de los hombros | — |
| `cabeza` | Cara, orejas, pelo de la cabeza, gafas de taller, cejas, nariz, rubor, boca | `240 262` |
| `ojo-izq`, `ojo-der` | Esclera, iris, brillo y párpado (dentro de `cabeza`) | centro `194 178.8` / `277.8 178.6`, radio 22 |
| `brazo-izq` | Brazo y guante del lado izquierdo de la imagen | `128 328` |
| `brazo-der` | Brazo, guante y llave inglesa | `340 320` |

## Paleta para personalizar

Hex exactos de `vale-frente.svg`. El sistema de avatar los reemplaza por color: cada hex se usa solo para lo que dice su fila, salvo las excepciones de las notas. Algunos aparecen como `stroke` y no como `fill`: la línea de la sonrisa, el párpado de los ojos y algunos tramos de las líneas del traje y de la bota. Por eso hay que reemplazar los dos atributos.

### Piel

| Uso | Hex | Dónde |
|---|---|---|
| Base | `#F0B095` | Cara, cuello y orejas |
| Borde y sombra | `#B97567` | Contorno de la cara, orejas y sombra del cuello |
| Sombra suave de la oreja | `#CD886C` | Pliegue interior de la oreja izquierda |
| Sombra de la oreja | `#93504F` | Detalle interior de la oreja derecha |
| Nariz, rubor y pliegue del párpado | `#D99780` | Nariz, mejillas, pliegue sobre los ojos e interior de las orejas |
| Labio de arriba | `#C77672` | |
| Labio de abajo | `#D4837B` | |
| Línea de la sonrisa | `#A5615A` | Línea entre los labios con los hoyuelos |

### Pelo, cejas y ojos

| Uso | Hex | Dónde |
|---|---|---|
| Pelo | `#2B2B2B` | Todo el pelo (cabeza y mechones largos de `cuerpo`) |
| Cejas | `#51423F` | |
| Iris | `#693734` | `ojo-izq`, `ojo-der` |
| Párpado y pestañas | `#8A4B44` | Párpado y ala con pestañas (en `cabeza` y en los grupos de ojo) |
| Esclera | `#FEFDFB` | |
| Brillo | `#FFFFFF` | |

### Traje crema (igual a Sofi)

| Uso | Hex | Dónde |
|---|---|---|
| Traje | `#FEE9C9` | Traje y cuello acolchado |
| Borde del traje | `#C08A6A` | Contorno del traje, del cuello y de las piernas |
| Guantes, botas y sombras del traje | `#E2C3A7` | Guantes, botas, interior del cuello y pliegue de la entrepierna |
| Borde de guantes y botas | `#CD9575` | |
| Sombra de piso | `#EABC91` | `sombra-piso` |
| Parche de la tripulación | `#F4832D` | Hombro izquierdo de la imagen |
| Luz del panel | `#F98022` | Lucecita del panel del pecho (la misma de Sofi) |

### Paneles de color (amarillo sol)

| Uso | Hex | Dónde |
|---|---|---|
| Panel | `#FDC253` | Hombreras, panel del pecho, franja central, puños, rodilleras, correas y mango de la llave |
| Borde del panel | `#B8772B` | Bordes de todo lo anterior y de la parte de abajo del mango |

### Accesorios

| Uso | Hex | Dónde |
|---|---|---|
| Gafas: aro oscuro | `#AE6730` | Aro exterior de los lentes |
| Gafas: aro | `#D09242` | |
| Gafas: reflejo | `#FFDB9B` | Raya de brillo en los lentes |
| Gafas: lente y correa | `#FDC253` / `#B8772B` | Los mismos hex que los paneles, pero dentro de `cabeza` |
| Llave: metal | `#BFBEBA` | |
| Llave: borde | `#828180` | |

**Notas para el avatar:**
- `#FDC253` y `#B8772B` son el color propio de Vale en todo el cuerpo: paneles, puños, correas y mango de la llave (que va en `brazo-der` junto con el puño y la hombrera). Las gafas de `cabeza` usan los mismos dos hex. Para cambiar el color del traje sin tocar las gafas, recolorea esos hex en `cuerpo`, `brazo-izq` y `brazo-der`, y deja `cabeza` como está.
- El pelo largo que cae detrás de los hombros también está en `cuerpo`, `brazo-izq` y `brazo-der`. Para cambiar el color del pelo, cambia `#2B2B2B` en todos los grupos.
- El traje, los guantes, las botas, sus bordes y la sombra de piso usan los mismos hex que Sofi, así que una prenda que reemplace el traje sirve para las dos.

## Movimiento

- **Reposo (loop):** respira y se mece suave; parpadea.
- **Saludo:** levanta la mano libre y saluda.
- **Espera (tipo B):** quieta en su pose, solo parpadea.
- **Celebración (tipo B):** salto corto con el puño arriba y estrellas; vuelve a la pose inicial (~1,5 s).
- Las animaciones Lottie quedan fuera del alcance de esta entrega.

## Sudadera (prenda del vestidor, 2026-10-22)

- SVG: `assets/brand/vale/vale-sudadera.svg` (viewBox `0 0 520 790`, la misma del traje). Grupos: `sombra-piso`, `cuerpo`, `cabeza` (con `ojo-izq` y `ojo-der`), `brazo-izq`, `brazo-der`, con los mismos pivotes que `vale-frente.svg`.
- Hoja: `assets/brand/bocetos/vale-sudadera-01.png` (Gemini 3.6 Flash, edición de la vista de frente de `vale-01-hoja-modelo.jpg`; 765×1024, capturada sin pérdida porque la descarga de Chrome estaba bloqueada); alineada en `vale-sudadera-01-alineada.png`. Vector: `scripts/marca/vectorizar/personajes/vale-sudadera.json`.
- Diseño: sudadera amarillo sol `#FDC253` con borde `#B8772B` (sombras `#DB9E41`, `#CB913F`, `#B77429`, `#AA6A23`), capucha bajada (el pelo largo cae detrás), escote en V, bolsillo canguro, puños y elástico acanalados, cordones crema `#FFF1E0` con puntas `#F98022` y la ballena de Ceti en el pecho (la de la insignia del traje de Juan). Manos sin guante; gafas de taller y llave como en el traje.
- La cabeza (con ojos y gafas de taller), las rodilleras y la sombra del piso se copian **idénticas** de `vale-frente.svg` (retoques `grupo_de` y `copiar_de`). Si cambia la cabeza del traje, basta `python -m vectorizar vale-sudadera --solo-retoques` para volver a copiarla.

### Paleta de piel (tal como está en el SVG)

| uso | hex |
|---|---|
| piel base (cara, orejas, cuello, manos) | `#F0B095` |
| bordes (contorno de cara y orejas, manos, sombra del cuello) | `#B97567` |
| nariz, rubor, pliegue del párpado, sombra del cuello | `#D99780` |
| sombras de las orejas | `#CD886C`, `#93504F` |
| labios | arriba `#C77672`, abajo `#D4837B`, línea de la sonrisa `#A5615A` |
| barba | no tiene |

### Ojos (coordenadas de la viewBox)

| ojo | centro (data-centro) | radio | centro del iris |
|---|---|---|---|
| `ojo-izq` | 194, 178.8 | 22 | 196.5, 177.5 |
| `ojo-der` | 277.8, 178.6 | 22 | 276.5, 177.5 |
