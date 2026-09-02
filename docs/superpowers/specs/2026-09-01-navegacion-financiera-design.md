# Navegación financiera de cinco pestañas

## Objetivo

Sustituir la pestaña única «Mi dinero» por tres destinos financieros claros en
la navegación inferior: Resumen, Actividad y Metas. Junto con Saga y Perfil,
la aplicación tendrá cinco pestañas visibles.

## Navegación

La barra inferior mostrará, en este orden: Saga, Resumen, Actividad, Metas y
Perfil. Cada destino financiero tendrá su propia ruta para que los enlaces,
el historial del navegador y el botón Atrás representen la pantalla abierta.

## Pantallas financieras

- Resumen muestra ahorro total, ahorro sin asignar, topes y las tarjetas de
  análisis actuales.
- Actividad muestra el filtro y el historial combinado de gastos y operaciones
  de ahorro.
- Metas muestra las metas y sus acciones de crear, editar, aportar y eliminar.

Los formularios existentes se reutilizan. No cambia el modelo de datos, la
sincronización ni las reglas de Firestore.

## Registro por voz

Un botón flotante de micrófono estará disponible en Resumen, Actividad y
Metas. Al tocarlo abrirá el flujo existente de registro por voz. No se añade
un sexto destino ni se duplica la lógica de captura.

## Errores y pruebas

La navegación debe permanecer estable con datos financieros vacíos. Se
actualizará la prueba de render de las pantallas financieras para asegurar que
sus selectores Zustand no produzcan ciclos de actualización. También se
verificará el tipado y la exportación web antes del despliegue.
