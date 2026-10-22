# vectorizar — boceto raster → SVG por capas, limpio y animable

Paquete de la "Empresa Vectorizador" para convertir los bocetos de Ceti, Tato y Juan en SVG que
`scripts/lottie/lib.mjs` puede animar. Estado: **ronda 3 integrada** (2026-10-20), Precisión global 96.85
(peor caso S3 92.50) en el banco v1 (ver más abajo).

## Uso

Siempre con el venv `~/.venvs/mascot/bin/python`, desde `scripts/marca/`:

```bash
cd scripts/marca
~/.venvs/mascot/bin/python -m vectorizar tato -o /ruta/salida.svg          # personaje de personajes/
~/.venvs/mascot/bin/python -m vectorizar mi-config.json -o salida.svg       # config propia
~/.venvs/mascot/bin/python -m vectorizar juan-capitan -o s.svg --banco juan --png cmp.png   # métricas viejas (banco.py)
```

Sin `-o`, la salida va a la ruta `salida` del config, que está en `assets/brand/...`. Para pruebas pasa
siempre `-o` a `~/.cache/vectorizar/...` o a un scratchpad.

**Copias del paquete** (trabajo de los ingenieros): `python -m` pone el cwd primero en `sys.path`, así que si
corres desde `scripts/marca` importas el paquete CANÓNICO aunque `PYTHONPATH` apunte a la copia. Para
medir una copia hay que correr desde su carpeta:
`cd ~/.cache/vectorizar/rN/<rol> && VECTORIZAR_RAIZ=/home/juan/Desktop/Me/ceti ~/.venvs/mascot/bin/python -m vectorizar.puntaje ...`

## Pipeline (`pipeline._vectorizar`)

| paso | módulo | qué hace |
|---|---|---|
| 1. recorte + superres | `pre.py` | recorta `box`, Real-ESRGAN anime ×4 (caché por hash en `~/.cache/vectorizar`, candado de GPU) y pasa a Lab; opcional `color_original` (apagado). H17 (`esrgan_selectivo`): en paneles de textura fina donde el ESRGAN cambió el color (franjas de S4) se usa Lanczos ×4 (`pre.fidelidad`/`pre.esrgan_selectivo`) |
| 2. paleta | `paleta.py` | k-means Lab (semilla fija: `cv2.setRNGSeed`), fusión ΔE < `paleta_fusion` con prueba de meseta espacial (H16: un tono cercano que forma región propia no se funde, o conserva su color en su zona), residuos; clasifica (con zonas) y limpia franjas de antialias y motas (`limpiar`). H17: la paleta se calcula sobre el ESRGAN y la meseta también sobre Lanczos (`de_plano`); en la zona Lanczos el antialias va a la más cercana de 2 clases (`dos_clases`, exenta de `limpiar`) y las fronteras entre bandas tenues se suavizan (`suavizar_tenues`) |
| 3. figura y piso | `capas.fondo_y_figura` | fondo = clase del borde; piso = sombra plana bajo los pies que toca el fondo (`elegir_piso`, v2); con `piso: null` no se borra ninguna clase como piso (`sin_piso_real`); figura = lo no alcanzable desde el borde, componente mayor. H19 (`capas.piso_geometrico`): lo de la clase piso que está fuera de la elipse ajustada al borde inferior de la sombra, o pegado a la figura, vuelve a ser figura (guantes y botas de S3) con el color mediano del original |
| 3b. sueltos | `pipeline.conservar_sueltos` | devuelve a la figura los destellos y adornos sueltos que tiró `mayor` (I1), salvo los que tocan la clase piso o son casi todo línea (I2: restos del contorno). H20: sin tope de tamaño, pero una componente > 10 % de la figura solo entra si su coste estimado (trazada con primitivas) es ≤ 0.25 × presupuesto de nodos (0.15 nodos por px de frontera entre clases) |
| 4. líneas | `lineas.py` | ancho automático, clases-línea, dueño de cada tramo de línea por rama del esqueleto (H1'), par falso; color del borde calibrado con el tono real de la línea (H2, `oscuro_calibrado`), líneas libres con su propio color. H18 (`linea_esqueleto`): dueño por familia de clase de línea, cadenas unidas en uniones < 30°, continuidad del dueño por cadena y un tono por cadena |
| 5. ojos | `ojos.py` | ojos como primitivas (aro, esclera, iris, pupila, brillos); v2: círculo RANSAC y párpado redibujado encima; v3: brillos por luminancia en el borde del iris, simetría, tapa de mejilla fuera del grupo del ojo, modelo mínimo en miniatura; H19: iris de color (no solo oscuro: L ≤ L_esclera − 20 o croma > 30), pupila = la clase más oscura |
| 6. orden z y partes | `capas.orden_z`, `capas.poligono`, `rellenar_debajo` | orden de apilado y partes animables (`cabeza`, `brazo-*`, `aleta-*`, `cola`...), con el cuerpo continuado debajo |
| 7. limpieza del campo | `trazado.suavizar_conjunto` | astillas de fondo, cuñas y mini islas pasan al vecino antes de apilar (H5) |
| 8. capas + trazado | `capas.apilar`, `pipeline.sin_motas`, `trazado.anidar_radiales`, `trazado.simplificar_ocultas`, `trazado.trazar_capa` | capas con sub-extensión (cero rendijas) y orden z por contención (H19: un código con ≥ 80 % de sus px en agujeros de otro sube encima y el de abajo se rellena), sin componentes < `min_componente`, anillos de degradado radial → discos/lentes apilados (H20), geometría tapada alisada (lo visible no cambia), potrace adaptativo (H13') + primitivas v2 por componente (H20: barra recta, píldora, disco/elipse, lente; guiones colineales fusionados) + polígonos para franjas finas y rectas. El IoU de las primitivas se mide sin recortar la forma al componente (`iou_con_margen`) |
| 9. piso + ensamblado | `capas.elipse_piso` | `<ellipse id="sombra-piso">` (con H19, la elipse del borde inferior) y grupos `<g id>` con `data-pivote`; nunca se emite un `<path d="">` (rompería lib.mjs) |

Contrato de salida: solo `svg/g/path/circle/ellipse`, sin `transform`, `image`, `data:`, `url()`, filtros
ni clip; `d` solo con `M L C Q Z` absolutos; color `#RRGGBB` en cada forma. Ids: `cuerpo`, las partes del
config (la `cabeza` con `data-pivote="x y"`), `ojo-izq`/`ojo-der` (grupos con círculos/elipses) y
`sombra-piso` (elipse).

## Flags (`cfg['experimentos']`)

Los valores por defecto están en `pipeline.DEFECTOS['experimentos']`. Un personaje o caso puede sobrescribir
solo los que nombre: `cargar` los fusiona clave a clave.

| flag | defecto | ronda / dueño | efecto |
|---|---|---|---|
| `compuertas_v2` | `True` | r1 capas | piso plano bajo los pies que toca el fondo, elipse de respaldo (franja bajo los pies o caja), ojos v2 (r ≤ 25 px) |
| `dueno_por_rama` | `True` | r1 líneas | dueño de la línea por rama del esqueleto con uniones T/Y; un dueño más oscuro que su línea se descarta |
| `suavizado_conjunto` | `True` | r1 curvas | limpia el campo de etiquetas antes de apilar; un dict ajusta `astillas` (1.5), `cunas` (40), `minimo` (2) y `sigma` (0 = sin argmax conjunto) |
| `conservar_sueltos` | `{'evitar_piso': True, 'evitar_linea': True}` | r1 integrador (I1), r2 (I2) | conserva componentes sueltas ≥ 20 px², ≤ 10 % de la figura, con ΔE76 > 15 contra el fondo y que no son astillas pegadas; un dict ajusta `area`, `max_frac`, `contraste` y `pegado`. I2: `evitar_piso` descarta las que tocan la clase piso y `evitar_linea` las que son > 50 % línea tras `lineas.detectar` (N20 de S2). `True` = comportamiento r1 |
| `min_componente` | `6` | r1 integrador | px² (unidades del SVG): quita de cada capa las componentes menores (motas que potrace deja < 4 px²); `0` lo apaga |
| `proteger_detalle` | `False` | r1 paleta (H4) | protege la tinta fina y los detalles compactos en `limpiar`; en la métrica es neutro, por eso queda apagado; un dict pasa opciones (`contornos`, `manchas`) |
| `colores_detalle` | `False` | r1 paleta | añade a la paleta el color de manchitas oscuras compactas; queda apagado porque crea una mota en R2 |
| `trazado_adaptativo` | `True` | r2 curvas (H13') | suavizado extra y `opttolerance`/`alphamax` según el área de cada componente (escalado con el tamaño del personaje), huecos chicos protegidos, polígonos para franjas rectas y `simplificar_ocultas`. Un dict sobrescribe `pipeline.TRAZADO_ADAPTATIVO` (`'ocultas': False` apaga el alisado de lo tapado) y `sueltos_max_frac` sube el tope de `conservar_sueltos` (NO usar aún: S4 pasa de 1107 nodos). `False` = r1 byte a byte |
| `fusion_espacial` | `True` | r2 paleta (H16) | antes de fundir dos clusters cercanos aplica la prueba de meseta; una región sólida ≥ 50 % del cluster no se funde y una parte conserva su color en su zona (`clasificar` con zonas). Un dict pasa opciones |
| `color_original` | `False` | r2 paleta (H16b) | devuelve al ESRGAN los escalones de bajo contraste del original; apagado: también trae grano (S4 y R6 suben de nodos) |
| `sin_piso_real` | `True` | r2 paleta | con `piso: null` no se elige ninguna clase como piso (antes la rama v1 borraba la franja inferior: N26 de S4, cuello de R6) |
| `borde_calibrado` | `{'giro': 15, 'subir_croma': True, 'umbral_oscura': 20, 'matiz_max': 15}` | r2 líneas (H2) | borde = `oscuro_calibrado` (L = min(L_dueño − 14, L_línea + 4), matiz del dueño girado ≤ 15° hacia la línea, croma acotada); puerta de marca `matiz_max` (contorno marrón Gemini → oscuro v1); línea ≥ 20 L más oscura que ambos lados → lado más parecido; par falso; líneas libres con su color. `False` = r1 byte a byte |
| `ojos_v3` | `True` | r2 capas (H12') | iris RANSAC, brillos por luminancia (L > L_iris + 35) en el círculo del iris, simetría con respaldo en la referencia, tapa de mejilla en `cabeza` fuera de `ojo-*`, modelo mínimo para radio < 4·S. `False` = ojos v2 |
| `borde_calibrado.l_marron` | `35` | r3 líneas (H18) | la puerta de marca `matiz_max` solo aplica al contorno marrón medio (L ≥ 35), no a un trazo oscuro tipo tinta (borde de S4) |
| `linea_esqueleto` | `True` | r3 líneas (H18) | dueño por familia de clase de línea (ΔE < 12 o contacto solo en una punta), cadenas por uniones < 30°, continuidad del dueño y un tono por cadena (N6, N27). Un dict pasa opciones de `lineas._opts_esqueleto`; `{'manchas': True}` prueba manchas → relleno (apagado: borra regiones reales). `False` = r2 |
| `primitivas_v2` | `{'inv_huecos': 0}` | r3 curvas (H20) | `trazado.primitiva_v2` (barra, píldora, disco grande, lente), `fusionar_barras`, `anidar_radiales` y la regla de sueltos por coste (`pipeline.SUELTOS_V2`). Claves de `trazado.PRIMITIVAS_V2` y `SUELTOS_V2`. **`inv_huecos` 0** (integrador): `invertir_agujereadas` queda apagado porque choca con la contención de `capas_geometricas` (S4: 2091 nodos, G = 0). `False` = r2 byte a byte |
| `capas_geometricas` | `True` | r3 capas (H19) | piso geométrico, orden z por contención e iris de color; dict `{'piso', 'contencion', 'iris'}` para apagarlos por separado. La contención necesita `iou_con_margen` |
| `esrgan_selectivo` | `True` | r3 paleta (H17) | Lanczos en paneles de textura fina con color perdido, `dos_clases`, `limpiar` exento en la zona, meseta también sobre Lanczos (`de_plano` 4) y `suavizar_tenues`. Hoy solo cambia S4 (11/12 casos idénticos a r2). Dict = opciones (ver `pre.esrgan_selectivo`) |
| `parpado_v1` | `False` | sofi (2026-10-21) | ojos v1 (óvalo del casco del blanco): la esclera se traza con la forma real de la abertura (no el óvalo, que tapaba el borde de abajo del párpado y asomaba por las esquinas), el iris se recorta a esa abertura pasando un poco bajo el párpado, y los oscuros fuera de la abertura (párpado, pestañas) no se repintan de piel. Arregla la rendija de piel/blanco entre párpado e iris |
| `iou_con_margen` | `True` | r3 integrador (pedido de capas) | `trazado.IOU_MARGEN`: el IoU de `primitiva`/`primitiva_v2` cuenta la forma candidata entera (antes, una barra fina se aceptaba como elipse enorme recortada: espiga de S2 con la contención, −2.53) |

Con los flags de r3 apagados (`primitivas_v2`, `capas_geometricas`, `esrgan_selectivo`, `linea_esqueleto` e
`iou_con_margen` en `False`, y `borde_calibrado` sin `l_marron`) la salida es la de r2 byte a byte (comprobado en
R1, R6 y S4). Con los flags de r2 apagados (`trazado_adaptativo`, `fusion_espacial`, `sin_piso_real`, `borde_calibrado`,
`ojos_v3` en `False` y `conservar_sueltos` en `True`) la salida es la de r1. Con además los de r1 apagados
(`compuertas_v2`, `dueno_por_rama`, `suavizado_conjunto` y `conservar_sueltos` en `False`, `min_componente`
en `0`), la salida es la v1 más la semilla fija del k-means.

Para probar una combinación de flags sin tocar el canónico: copia el paquete a `~/.cache/vectorizar/rN/<dir>/`,
cambia `DEFECTOS['experimentos']` en la copia y corre el banco desde esa carpeta (ver "Copias del paquete"). El arnés
del Integrador r3 sobrescribe flags sin editar la copia: `~/.cache/vectorizar/r3/integ/trabajo/var.sh ETQ '{"flag": valor}' [CASOS]`.

## Config por personaje (`personajes/*.json`)

Claves (defectos en `pipeline.DEFECTOS`):
- `src`, `box`, `salida`: boceto (relativo a la raíz del repo), caja `[x0,y0,x1,y1]` en px de la hoja y SVG por defecto.
- `escala` (4), `superres`: factor y modelo de trabajo.
- `paleta` (`'auto'` o `{nombre: HEX}`), `paleta_fusion`, `paleta_extra`, `nombres`, `colores` (recolor de marca), `bordes`.
- `lineas`: `{modo: 'borde'|'ninguna', ancho: 'auto'|px, oscurecer, croma, excluir, incluir}`; `duenos` `[[a, b, dueño]]`; `orden` (orden z parcial forzado).
- `solapa` (6), `suavizado` (1.2), `tolerancia` (0.9, opttolerance de potrace), `min_area` (3).
- `partes`: `{nombre: {poligono, pivote, excluir, solapa}}` en px del recorte; `cara_en` (grupo que recibe los ojos).
- `ojos`: `'auto'`, `null` o `{zona: [...]}`; `piso`: `'auto'`, `null` o un color.
- `fondo_interior` (`null`): HEX. Los huecos de fondo encerrados por la figura pasan a una clase propia de ese color en vez de recortarse como fondo. Sirve cuando un relleno tiene casi el tono del fondo (traje crema de Sofi sobre la hoja crema). Con `null` la salida es la de antes byte a byte.
- `experimentos`: ver la tabla de flags.

| personaje | boceto | partes |
|---|---|---|
| `tato` | tato-03-hoja-modelo | cabeza, brazo-izq, brazo-der |
| `juan-capitan` | juan-02-capitan | cabeza, brazo-izq, brazo-der |
| `sofi` | sofi-01-hoja-modelo | cabeza (con `excluir` del traje: el pelo largo cruza el cuello), brazo-izq, brazo-der; `fondo_interior` #FEE9CA, bordes y `lineas.excluir` para pelo, cordón y lunar; `parpado_v1` |
| `ceti` | ceti-05-hoja-modelo | aleta-izq, aleta-der, cola (ojos en `cuerpo`); `capas_geometricas.contencion: false` (la contención deformaba las cejas: N37; mismo puntaje) |
| `<p>-sudadera` | <p>-sudadera-01-alineada (juan, santiago, sofi) | prenda del vestidor: misma viewBox y partes que el traje; `grupo_de` copia la cabeza (y la sombra) del `<p>-frente.svg` y `copiar_de` la ballena (y el radar de Santiago), así la cara y los accesorios no cambian al cambiar de ropa |

## Revisión crítica y retoques (obligatorio antes de entregar)

El motor vectoriza; **Claude revisa como ilustrador**. La métrica no lo ve todo: un ojo sin párpado puede sacar 99 %.

1. `~/.venvs/mascot/bin/python -m vectorizar <personaje> --revisar` (o `-m vectorizar.revisar <personaje> <svg>`)
   genera en `~/.cache/vectorizar/revision/<personaje>/` una imagen por zona: referencia | vector | superposición,
   con rejilla de coordenadas. Las zonas son los ojos, la cabeza, las manos, las de `"revision"` del JSON y las
   6 "sospechosas" donde más difiere de la referencia. Trae también `LISTA.md` con la lista de comprobación:
   ojos completos, rasgos, manos, accesorios, líneas, limpieza y silueta.
2. **Mirar cada imagen** y responder la lista. Si algo se ve raro a zoom, es un defecto.
3. Arreglar:
   - **Puntual** (un ojo, una raya que falta, una mota, un color): retoque en el JSON del personaje (`"retoques"`, ver
     `retoques.py`: `circulo`, `elipse`, `raya`, `forma`, `borrar`, `recolor`, `ojo`, `grupo_de`, `copiar_de`). Se prueba en segundos con
     `-m vectorizar <personaje> --solo-retoques` (sin volver a correr el motor; usa el SVG base guardado en
     `~/.cache/vectorizar/base/`). Es lo que haría una persona en un editor: dibujar el círculo o la raya.
   - **Sistemático** (se repite en varios personajes): cambio en el motor detrás de un flag + banco completo.
4. Repetir la revisión hasta que todas las respuestas sean "sí". Recién ahí se entrega.

**Pulido lógico** (`pulido.py`, mismas `"retoques"`): `trazo` (una línea -> trazo de grosor parejo),
`silueta` (contorno continuo sin motas ni bultos), `elipse_de` (rubor, nariz, lunar -> elipse exacta), `aplanar`
(zona de un tono sin manchas). `python -m vectorizar.pulido <svg> <grupo> x0,y0,x1,y1` lista los colores de una
zona. El procedimiento completo (inventario de piezas -> pulido -> revisión) está en la skill del proyecto
`.claude/skills/vectorizar-personaje/SKILL.md`.

Ejemplo de retoque de ojo (coordenadas del recorte, leídas de la rejilla):

```json
"retoques": [
  {"op": "borrar", "grupo": "cabeza", "zona": [168, 150, 218, 176], "colores": ["#FDFDFD"], "nota": "cuña blanca"},
  {"op": "ojo", "lado": "izq", "cx": 193.5, "cy": 177, "rx": 19.5, "ry": 12.5, "giro": -4,
   "iris": {"r": 13.5, "dx": 6, "dy": -2.5, "color": "#5A2A28"}, "brillos": [{"r": 3.2, "dx": -4.5, "dy": -4.5}],
   "parpado": {"color": "#5A2A28", "ancho": 5.5, "desde": -178, "hasta": -8},
   "pestanas": [{"angulo": -160, "largo": 6, "ancho": 3, "color": "#5A2A28"}]}
]
```

## Banco de retos y Precisión % (QA: `puntaje.py`, `banco/`; métrica v1 CONGELADA)

12 casos en `banco/casos.json`: R1–R8 reales (contra el recorte del boceto) y S1–S4 sintéticos
(`banco/sinteticos.py`, semilla fija, verdad vectorial). La fórmula es
`Precisión = 100·G·(0.30C + 0.25F + 0.20D + 0.15L + 0.10E)`, con G las compuertas: contrato, ids, lib.mjs,
nodos ≤ 3× presupuesto y paths ≤ 400. El docstring de `puntaje.py` la explica con detalle.

```bash
cd scripts/marca
~/.venvs/mascot/bin/python -m vectorizar.puntaje --todos --paralelo 3 \
    --salida ~/.cache/vectorizar/<dir> --json res.json --png ~/.cache/vectorizar/<dir>-png   # banco completo
~/.venvs/mascot/bin/python -m vectorizar.puntaje --todos --casos R2,S1                     # algunos casos
~/.venvs/mascot/bin/python -m vectorizar.puntaje --svg-dir DIR                              # puntuar SVG hechos
~/.venvs/mascot/bin/python -m vectorizar.puntaje --antitrampa
```

`recursos.py` limita las corridas: un solo Real-ESRGAN a la vez (candado de GPU) y hasta
`VECTORIZAR_CUPOS` corridas pesadas simultáneas (3 por defecto, unos 600 MB cada una).

### Histórico

| ronda | global | peor | notas |
|---|---|---|---|
| 0 (v1) | 58.83 | 0 (R1) | R1, R2, S1 y S2 en 0 por compuertas; S4 53.02 sin semilla, no se reproduce (v1 con semilla: 44.73) |
| 1 | **91.19** | 44.61 (S4) | todos los casos pasan las compuertas; ver `integracion-r1.md` |
| 2 | **92.81** | 54.78 (S4) | curvas H13', paleta H16 + `sin_piso_real`, líneas H2, capas ojos v3, integrador I2; ver `integracion-r2.md`. r0 re-baseline aprobado: 58.21 (S4 44.73) |
| 3 | **96.85** | 92.50 (S3) | curvas H20 (sin `invertir_agujereadas`), capas H19, paleta H17, líneas H18, integrador `iou_con_margen` y filtro de `d` vacío; S4 54.78 → 92.75; ver `integracion-r3.md` |
| 3 + ajuste | **96.85** | 92.50 (S3) | sesión líder: `ceti.json` con `contencion: false` (cejas redondas otra vez); R3 99.32, R7 98.83, R8 99.23, S2 99.36 |

### vtracer 1.0 (comparación)

`vtracer==1.0.0a4` está instalado aparte en `~/tools/vtracer1` (`sys.path.insert(0, '/home/juan/tools/vtracer1')`), para no tocar el 0.6 del venv que usa `puntaje --vtracer`. Directo sobre el boceto saca 94.3 sin compuertas de media (no es animable: comandos relativos, `transform`, sin ids, contorno marrón). Con nuestra segmentación traza casi igual que potrace con menos nodos. Detalle: notas de la empresa, `vtracer1-experimento.md`.
