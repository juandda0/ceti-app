# Administrar ahorros, metas y gastos autodeclarados

Esta especificación define el cierre funcional de **Mi dinero** para el perfil estudiante. Ceti administra registros educativos autodeclarados. Ceti no consulta cuentas bancarias, custodia fondos ni presenta valores como saldos bancarios.

## Plan de la especificación

- **Objetivo**: completar los casos de uso de metas, operaciones de ahorro, gastos y presupuestos
- **Audiencia**: producto, diseño, desarrollo, seguridad, privacidad y pruebas
- **Contenido**: alcance, reglas de negocio, modelo, CRUD, experiencia, persistencia, seguridad, migración y aceptación
- **Decisiones abiertas**: ninguna
- **Tipo de contenido**: conceptual

## Objetivo y alcance

El estudiante puede administrar sus ahorros y analizar sus gastos sin mezclar ambos conceptos. Los gastos describen hábitos. Solo los aportes y retiros modifican el ahorro autodeclarado.

El alcance incluye:

- CRUD completo de metas
- CRUD completo de aportes y retiros
- CRUD completo de gastos
- CRUD completo de topes semanales por categoría
- Registro manual y por voz
- Historial combinado para presentación
- Cálculos derivados y consistentes
- Persistencia local y remota según el modo de ejecución
- Migración de los datos existentes
- Autorización, validación, privacidad, accesibilidad y pruebas

El alcance excluye:

- Bancolombia, finanzas abiertas y cualquier otra integración bancaria
- Custodia, transferencia o iniciación de pagos
- Un saldo editable o presentado como saldo bancario
- Acceso del profesor o admin a datos financieros individuales
- Perfiles, recomendaciones o etiquetas persistentes derivadas del comportamiento financiero
- Archivos SVG aportados por estudiantes

## Lenguaje del producto

La interfaz llama **ahorro total** a la suma neta autodeclarada. Nunca usa **saldo bancario**, **dinero disponible en tu cuenta** ni expresiones equivalentes.

La primera exposición del resumen indica que los valores provienen de registros del estudiante. La procedencia manual o por voz aparece en el detalle, no cambia la validez del registro y no puede editarse.

## Modelo de dominio

El modelo separa gastos y ahorro para impedir que un gasto reduzca una meta por accidente.

### Gasto

Un gasto contiene `id`, `monto`, `descripcion`, `categoria`, `origen`, `fecha`, `createdAt` y `updatedAt`. Su creación, edición o eliminación no modifica ahorros ni metas.

### Operación de ahorro

Una operación contiene `id`, `tipo`, `monto`, `descripcion`, `goalId`, `fecha`, `createdAt` y `updatedAt`. `tipo` admite `aporte` y `retiro`. `goalId` es opcional.

Un aporte aumenta el ahorro. Un retiro lo reduce. La aplicación rechaza una mutación que deje negativo el ahorro total, el ahorro sin asignar o el ahorro de una meta afectada.

### Meta

Una meta contiene `id`, `title`, `iconId`, `category`, `targetAmount`, `deadline`, `createdAt`, `updatedAt` y `deletedAt`. `deadline` y `deletedAt` son opcionales.

`iconId` referencia un catálogo cerrado de recursos SVG incluidos en la aplicación. El cliente no almacena markup SVG, rutas externas ni archivos enviados por estudiantes.

Una meta eliminada conserva su documento con `deletedAt`. La interfaz la oculta. Sus operaciones dejan de contar como asignadas y pasan al ahorro sin asignar. La referencia histórica permite explicar el origen sin actualizar cada operación.

### Presupuesto

Un presupuesto es un tope semanal entero positivo asociado a una categoría de gasto. Eliminarlo no modifica gastos históricos.

## Cálculos derivados

Los cálculos usan operaciones activas y nunca dependen de contadores editables:

- `ahorroTotal = suma(aportes) - suma(retiros)`
- `ahorroMeta = suma(aportes de la meta) - suma(retiros de la meta)`
- `ahorroSinAsignar = ahorroTotal - suma(ahorro de metas no eliminadas)`
- `progresoMeta = min(ahorroMeta / targetAmount, 1)`
- `estadoMeta = cumplida` cuando `ahorroMeta >= targetAmount`; en otro caso, `activa`

El sobreahorro permanece registrado. Reducir el objetivo por debajo del ahorro acumulado marca la meta como cumplida sin alterar operaciones. Un retiro o corrección puede devolverla al estado activo.

## Casos de uso y CRUD

Cada mutación valida el estado resultante antes de persistirlo.

### Administrar metas

- **Crear**: ingresar nombre, objetivo, icono, categoría y fecha límite opcional
- **Consultar**: ver metas activas, progreso, ahorro asignado, objetivo y estado derivado
- **Editar**: cambiar nombre, objetivo, icono, categoría o fecha límite
- **Eliminar**: confirmar el monto que quedará sin asignar y establecer `deletedAt`

El objetivo usa pesos colombianos enteros y debe ser mayor que cero. El nombre se normaliza con `trim` y aplica un límite de longitud definido también en Firestore Rules. Una fecha límite no puede quedar antes de la fecha declarada de creación.

### Administrar operaciones de ahorro

- **Crear**: registrar un aporte o retiro, con meta opcional
- **Consultar**: ver tipo, monto, descripción, fecha y asignación
- **Editar**: cambiar tipo, monto, descripción, fecha o meta
- **Eliminar**: retirar la operación del cálculo tras confirmación

Una edición calcula primero el resultado como si reemplazara la operación anterior. El sistema rechaza el cambio completo cuando el resultado deja negativo el ahorro total, el ahorro sin asignar o el ahorro de una meta activa.

Una operación puede reasignarse entre una meta activa y el ahorro sin asignar. Las metas eliminadas no aparecen como destinos. Las operaciones asociadas a una meta eliminada se presentan como ahorro sin asignar.

### Administrar gastos

- **Crear**: registrar manualmente o dictar por voz
- **Consultar**: ver monto, descripción, categoría, fecha y origen
- **Editar**: corregir monto, descripción, categoría o fecha
- **Eliminar**: quitar el gasto tras confirmación

El origen `manual | voz` no cambia después de crear el gasto. La voz propone valores y abre el mismo formulario del registro manual. Ningún dato se guarda antes de la confirmación.

### Administrar presupuestos

- **Crear**: fijar un tope semanal para una categoría sin tope
- **Consultar**: ver topes, consumo del periodo y estado textual
- **Editar**: reemplazar el monto del tope
- **Eliminar**: quitar el tope sin modificar gastos

La interfaz comunica `ok`, `cerca` y `excedido` mediante texto e icono. El color nunca es la única señal.

## Validación común

Los formularios y Firestore Rules aplican estas reglas:

- Montos enteros en pesos colombianos, mayores que cero y dentro del máximo admitido por el modelo
- Descripciones normalizadas y con longitud acotada
- Categorías e iconos pertenecientes a catálogos cerrados
- Fechas declaradas no futuras
- Identificadores inmutables y creados por el cliente con suficiente entropía
- `createdAt` y `origen` inmutables después de crear
- `updatedAt` actualizado en cada modificación
- Campos adicionales rechazados

La capa de dominio repite las validaciones que protegen invariantes financieros. Firestore Rules protege el límite de confianza ante clientes manipulados.

## Experiencia de Mi dinero

La pantalla organiza las funciones en **Resumen**, **Actividad** y **Metas**.

### Resumen de ahorro y gastos

El resumen muestra ahorro total, ahorro sin asignar, distribución por metas y topes. Los gastos aparecen en análisis separados y nunca reducen el ahorro.

### Historial combinado

Actividad combina gastos y operaciones de ahorro solo para presentación. Los filtros son **Todos**, **Gastos** y **Ahorros**. Cada fila identifica gasto, aporte o retiro y abre acciones de detalle, edición y eliminación.

### Acciones de registro

La acción **Registrar** ofrece gasto, aporte y retiro. El estudiante elige entrada manual o voz. Ambos caminos usan el mismo formulario de confirmación.

Los formularios reutilizan el formateador de pesos colombianos instalado. Cada campo tiene label, error asociado, foco visible y orden de teclado. La aplicación deshabilita el doble envío mientras persiste la mutación.

Las eliminaciones explican el efecto concreto. Eliminar una meta muestra cuánto ahorro quedará sin asignar. Eliminar o editar una operación muestra un error sin cambiar datos cuando viola un saldo mínimo.

## Persistencia y sincronización

Las operaciones de ahorro permanecen en `users/{uid}/deposits`, los gastos en `users/{uid}/movimientos` y las metas en `users/{uid}/goals`. El documento `users/{uid}/config/presupuestos` conserva los topes.

Una sesión autenticada trata Firestore como fuente remota autoritativa. La interfaz puede aplicar una actualización optimista, pero no muestra éxito hasta recibir confirmación. Un error restaura el estado anterior, conserva los valores del formulario y ofrece reintento.

El modo local sin Firebase usa almacenamiento MMKV y no intenta sincronizar. Cada almacenamiento persistido incluye el ámbito del usuario o del modo local. El cierre o cambio de sesión limpia el estado en memoria antes de hidratar otro ámbito.

Las metas y operaciones ya no actualizan `currentAmount`. El store calcula las proyecciones desde las operaciones en una única transición. Se elimina el puente asíncrono que duplica un ahorro como movimiento y depósito.

## Seguridad y privacidad

Solo el `uid` autenticado puede leer o escribir sus metas, operaciones, gastos y presupuestos. Profesor y admin reciben denegación por defecto. Las rutas no aceptan un `uid` suministrado por la interfaz como prueba de autorización.

Analytics puede registrar nombres de eventos técnicos y propiedades no financieras. No recibe montos, textos, categorías, fechas, metas, saldos, identificadores de registros ni resultados derivados. Crash reporting elimina el contenido financiero y usa contexto constante.

La aplicación no persiste rachas, insights, perfiles, etiquetas ni recomendaciones financieras individuales. Los cálculos permitidos se derivan en memoria para la vista del propio estudiante. La supresión de un estudiante elimina metas, operaciones de ahorro, movimientos y presupuestos.

El tratamiento conserva el modelo vigente de atestación y acceso del menor. Esta especificación no autoriza integraciones externas ni amplía el acceso docente.

## Migración de datos existentes

La migración conserva los registros del estudiante y elimina la duplicación futura.

1. Convierte cada depósito existente en una operación `aporte`
2. Conserva `id`, `goalId`, `amount`, `description`, `note` y `createdAt`
3. Usa `createdAt` como `fecha` y `updatedAt` cuando falten
4. Elimina `currentAmount` como fuente de verdad y lo ignora durante lecturas compatibles
5. Mantiene gastos existentes con `tipo: gasto`
6. Detecta movimientos `ahorro` cuyo `id` coincide con un depósito y conserva solo la operación de ahorro para los cálculos
7. Convierte ahorros antiguos sin depósito correspondiente en operaciones `aporte` una sola vez
8. Asigna el icono SVG predeterminado a metas antiguas que solo tengan `emoji`

La migración es idempotente. Una marca de versión por store evita duplicar operaciones al rehidratar varias veces. Los lectores aceptan temporalmente el formato anterior durante una versión de transición; las escrituras usan únicamente el formato nuevo.

## Manejo de errores

Los errores esperados usan mensajes específicos:

- Monto o texto inválido: señalar el campo
- Retiro o edición que deja un saldo negativo: explicar el saldo máximo disponible
- Meta eliminada durante una edición: conservar datos y pedir otro destino
- Fallo de red: conservar formulario y ofrecer reintento
- Permiso denegado: cancelar la mutación y cerrar la sesión si la identidad dejó de ser válida
- Documento remoto inválido: ignorarlo, registrar contexto no sensible y no incorporarlo a cálculos

Los errores inesperados muestran un mensaje genérico con un identificador técnico. El log asociado no contiene información financiera.

## Estrategia de pruebas

Las pruebas protegen comportamiento y límites de confianza:

- Unitarias para ahorro total, ahorro sin asignar, progreso, cumplimiento y sobreahorro
- Unitarias para crear, editar, reasignar y eliminar cada entidad
- Regresiones para retiros inválidos, reemplazo de operaciones y metas eliminadas
- Migración para datos antiguos, rehidratación repetida y deduplicación por `id`
- Repositorios para escrituras completas y eliminación efectiva de topes
- Firestore Rules para propietario, roles ajenos, campos extra, tipos, catálogos, fechas y montos
- Privacidad para impedir propiedades financieras en analytics y crash reporting
- Accesibilidad para labels, foco, teclado, contraste y estados no basados solo en color
- E2E para crear meta, aportar, editar aporte, retirar, eliminar meta y comprobar ahorro sin asignar
- E2E para crear gasto manual, editarlo, eliminarlo y comprobar que el ahorro no cambia

Cada cambio de lógica sigue prueba fallida, implementación mínima y suite verde. La verificación final ejecuta TypeScript, lint, Jest, reglas en emulador y los flujos E2E críticos.

## Criterios de aceptación

El módulo queda completo cuando se cumplen todos estos resultados:

1. El estudiante completa el CRUD de metas, operaciones, gastos y presupuestos
2. Un gasto nunca modifica el ahorro
3. Los totales siempre se derivan del historial de ahorro
4. Ninguna mutación deja negativo el ahorro total, el ahorro sin asignar o el ahorro de una meta
5. Eliminar una meta conserva su dinero como ahorro sin asignar
6. Editar o eliminar una operación recalcula todas las proyecciones afectadas
7. El registro manual funciona sin micrófono y la voz requiere confirmación
8. Los iconos usan un catálogo SVG cerrado y no emojis
9. Una falla remota no muestra éxito ni deja el estado local confirmado
10. Cambiar de estudiante no expone datos persistidos de otra cuenta
11. Profesor y admin no pueden leer información financiera individual
12. Analytics y logs no reciben información financiera
13. La migración conserva datos y no duplica ahorros
14. Las pruebas automáticas cubren los flujos críticos y límites de seguridad
