# Biblia de personaje: Juan (borrador)

> Personaje basado en Juan, creador de Ceti (con su autorización). Borrador del 2026-10-20, abierto a cambios.
> Estilo: el de Ceti y Tato. Referencia: foto que compartió Juan; con su autorización se usó un recorte de su cara en Gemini.

## Ficha

| Campo | Juan |
|---|---|
| Quién es | Uno de los dos capitanes de la nave de Ceti, junto a Santiago (cocreadores, misma importancia) |
| Rol en la app | Bienvenida, hitos grandes y momentos de la nave; accesorio: tablet de mando |

## Rasgos para el personaje (de las fotos)

- Cara redonda, piel clara con mejillas rosadas.
- Pelo rapado muy corto (corte de octubre de 2026), castaño claro tirando a mono; frente alta con entradas en "M" redondeada.
- Ojos verdes con centro ámbar y anillo oscuro; cejas rectas, castaño claro.
- Sonrisa grande mostrando los dientes (sin retenedor en el personaje).
- Detalles: pulsera roja de hilo y reloj dorado en la muñeca izquierda.

## Diseño (base aprobada 2026-10-20: `assets/brand/bocetos/juan-03-rapado-mono.jpg`; la hoja `juan-02-capitan.jpg`, con el pelo largo, quedó obsoleta)

1. Mismo lenguaje que Ceti y Tato: sin contorno, relleno plano, bordes en un tono más oscuro, ojos redondos con pupila y brillo, cejas cortas y gruesas, rubor, nariz un poco más oscura que la piel.
2. Proporción de Tato (~3 cabezas).
3. Traje de la tripulación con paneles azul cielo (`#7EC8F0`) e insignia de capitán: la ballena naranja de Ceti en el pecho. Lleva una tablet de mando de la nave.
4. Pulsera roja y reloj dorado como firma.
5. Ajustes del vector sobre la hoja (acordados con Juan): pelo intermedio `#BA8C5E` (menos amarillo que la hoja), iris verde con anillo y centro ámbar, mandíbula un poco más ovalada y entradas más redondeadas. Calco: `scripts/marca/calco-juan.py` → `assets/brand/juan/juan-frente.svg`.

## Sudadera (prenda del vestidor, 2026-10-22)

- SVG: `assets/brand/juan/juan-sudadera.svg` (viewBox `0 0 460 780`, la misma del traje). Grupos: `sombra-piso`, `cuerpo`, `cabeza` (con `ojo-izq` y `ojo-der`), `brazo-izq`, `brazo-der`, con los mismos pivotes que `juan-frente.svg`.
- Hoja: `assets/brand/bocetos/juan-sudadera-01.jpg` (Gemini 3.6 Flash, edición de la vista de frente de `juan-03-rapado-mono.jpg`); alineada a la hoja del traje en `juan-sudadera-01-alineada.png`. Vector: `scripts/marca/vectorizar/personajes/juan-sudadera.json`.
- Diseño: sudadera azul cielo `#7EC8F0` con borde `#4E9CC2` (sombras `#62ADD5`, `#3D8BB4`), capucha bajada detrás del cuello, escote en V, bolsillo canguro, puños y elástico acanalados, cordones crema `#FFF1E0` con puntas naranjas y la ballena de la insignia del traje en el pecho. Manos sin guante. Pantalón con rodilleras, botas, tablet, pulsera y reloj como en el traje.
- La cabeza (con los ojos) y la sombra del piso se copian **idénticas** de `juan-frente.svg` (retoque `grupo_de`): la cara no cambia al cambiar de ropa y los accesorios caen en el mismo sitio con las dos prendas.

### Paleta de piel (tal como está en el SVG)

| uso | hex |
|---|---|
| piel base (cara, orejas, cuello, manos) | `#F4B596` |
| bordes (contorno de cara y orejas, boca, manos, lados del cuello) | `#C46F5B` |
| interior de las orejas, sombra del cuello | `#E8977C` |
| nariz | `#E8977E` |
| rubor | `#EC917A` |
| contorno del ojo | `#D27F69` |
| párpados | `#9E5546` |
| labios | sin color propio: la boca abierta es el borde `#C46F5B` con dientes `#FFFFFF` |
| barba | no tiene |

### Ojos (coordenadas de la viewBox)

| ojo | centro (data-centro) | radio | centro del iris |
|---|---|---|---|
| `ojo-izq` | 176.32, 164.24 | 19.93 | 178.34, 162.76 |
| `ojo-der` | 259.57, 164.04 | 20.45 | 256.72, 162.43 |
