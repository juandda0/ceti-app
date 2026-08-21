# Rediseño progresivo de Mundos

## Alcance

Esta iteración rediseña exclusivamente la pantalla `Mundos`, interfaz principal
del estudiante. Conserva rutas, carga de contenido, orden del curso, estados de
desbloqueo, progreso, dominio, avisos y accesibilidad existentes.

La pantalla `Bienvenida` recibirá un ajuste suave en un ciclo posterior. No forma
parte de esta implementación.

## Objetivo

Convertir la experiencia oscura y temática actual en una interfaz móvil sobria,
clara y profesional. La identidad espacial deja de ser decoración dominante y se
expresa mediante una trayectoria discreta que comunica el orden real de los
mundos.

Prioridad de decisión: usabilidad, claridad, jerarquía, consistencia, estética y,
por último, identidad espacial.

## Dirección visual aprobada

### Composición

- Una sola columna, optimizada para teléfonos.
- Encabezado compacto con título y avance total.
- Avisos existentes entre el encabezado y el recorrido, sin cambiar su orden ni
  comportamiento.
- Lista vertical conectada por una línea fina. Cada mundo ocupa un nodo del
  recorrido.
- El siguiente mundo disponible recibe la mayor jerarquía. Los completados se
  muestran resueltos y los bloqueados, atenuados pero legibles.
- Las tarjetas mantienen un área táctil mínima de 44 puntos y todo su cuerpo sigue
  siendo accionable cuando el mundo está desbloqueado.

### Sistema visual emergente

Se reutilizan los tokens y componentes existentes. Esta pantalla establece estos
criterios para iteraciones posteriores:

- Fondo claro mineral: `LightColors.background.base` (`#F4F4F6`).
- Superficie principal: `LightColors.background.primary` (`#FFFFFF`).
- Texto principal grafito: `LightColors.text.primary` (`#16161A`).
- Texto secundario: `LightColors.text.secondary` (`#5A5A64`).
- Borde neutro: `LightColors.materials.border` (`#D4D4DC`).
- Acento CETI: `LightColors.brand.primary` (`#FF8A1F`).
- Los colores propios de cada mundo se limitan al nodo, progreso y estado; no
  colorean el borde completo de cada tarjeta.
- Tipografía nativa y escala `Typography` existentes.
- Espaciado basado en `Spacing`; radios `md` o `lg`, sin sombras decorativas.

El modo oscuro se conserva. Para nuevas instalaciones, el modo claro pasa a ser
el valor inicial; una preferencia ya persistida no se sobrescribe.

### Firma espacial

Una línea orbital vertical y sus nodos representan el recorrido curricular. Es el
único gesto espacial permanente de la pantalla. No se añaden estrellas, galaxias,
fondos ilustrados ni efectos luminosos.

### Movimiento

Se conserva una entrada escalonada breve para los nodos y la respuesta táctil
existente. No se añaden animaciones ambientales ni una capa nueva de movimiento.

## Componentes y cambios

- `WorldsScreen`: reorganiza encabezado, recorrido, estados vacío/carga y lista.
- `WorldCard`: evoluciona visualmente dentro del mismo archivo; no se crea una
  abstracción nueva mientras tenga un solo consumidor.
- `useThemeStore`: cambia únicamente el valor inicial de `dark` a `light`.
- Tokens compartidos: solo se modificarán si un valor aprobado no puede expresarse
  con los tokens existentes. No se creará una segunda paleta paralela.

No cambian repositorios, stores de aprendizaje, hooks, rutas, traducciones
funcionales ni cálculos de progreso.

## Estados

- **Carga:** indicador discreto con espacio estable para evitar saltos.
- **Sin mundos:** mensaje e icono actuales con mayor jerarquía y contraste.
- **Disponible:** tarjeta completa accionable, nodo acentuado y progreso visible.
- **Dominado:** confirmación inequívoca sin depender solo del color.
- **Bloqueado:** opacidad moderada, icono de candado y explicación legible; no es
  accionable.
- **Avisos:** se mantienen `JoinClassBanner`, `AuthorizationPendingBanner` y
  `StudentAssignmentsBanner` sin alterar su lógica.

## Responsive y accesibilidad

- Una columna en móvil y web estrecha; ancho máximo centrado en web ancha para
  impedir líneas y tarjetas excesivamente largas.
- Safe areas y barra inferior permanecen intactas.
- Contraste WCAG AA, foco visible en web, etiquetas y estados accesibles actuales.
- El bloqueo y el dominio se comunican con icono y texto además del color.

## Verificación

1. Ejecutar typecheck y lint sobre los archivos modificados.
2. Ejecutar los tests existentes de `worldStatus`, `worldProgress` y
   `useWorldFlow`; la lógica no debe cambiar.
3. Verificar manualmente en un viewport de teléfono: carga, lista, progreso,
   dominado, bloqueado, estado vacío, avisos y navegación a un mundo.
4. Verificar un viewport web ancho y ambos temas.
5. Confirmar que una preferencia oscura persistida continúa respetándose.

## Fuera de alcance

- Rediseñar otras pantallas o la navegación inferior.
- Ajustar `Bienvenida` en este ciclo.
- Crear ilustraciones, cargar fuentes o agregar dependencias.
- Cambiar textos, reglas de desbloqueo, progreso o flujos funcionales.
