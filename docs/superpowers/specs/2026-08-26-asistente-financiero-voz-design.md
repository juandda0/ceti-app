# Asistente financiero por voz

## Objetivo

CETI permitirá consultar y administrar movimientos, ahorros y metas mediante
lenguaje natural. La IA convertirá una frase en una o varias acciones editables;
nada se ejecutará hasta que el usuario confirme el resumen.

El mismo release corregirá los bloqueos de seguridad y privacidad detectados por
la auditoría pre-release. Producción seguirá bloqueada hasta que todos los gates
pasen.

## Flujo

1. El usuario dicta una frase y el dispositivo entrega únicamente el transcript.
2. La app envía a una Cloud Function autenticada el texto, un identificador de
   solicitud y el contexto financiero mínimo necesario para resolver referencias.
3. La función valida límites, llama al proveedor de IA y convierte su respuesta a
   un plan tipado. La función no escribe datos financieros.
4. La app valida nuevamente el plan y abre un único sheet con todas las acciones.
5. El usuario puede editar o quitar cada acción. Las acciones ambiguas requieren
   completar o escoger el dato faltante.
6. Al confirmar, la app revalida y ejecuta cada acción mediante los stores y
   repositorios existentes. Muestra el resultado individual de cada acción.

## Acciones soportadas

El plan admite varias acciones en una sola frase:

- Consultar movimientos, total ahorrado, ahorro disponible y metas.
- Crear un gasto, un ahorro o una meta.
- Editar monto, descripción, categoría o fecha de un movimiento.
- Editar nombre, objetivo o categoría de una meta.
- Eliminar un movimiento o una meta mediante los mecanismos existentes.
- Abonar o retirar ahorro, con o sin una meta asociada.

Referencias como “el último gasto”, “los dos de ayer” o “la meta de la bici” se
resuelven usando IDs opacos, nombres y valores actuales. Si hay varias
coincidencias, la acción queda bloqueada hasta que el usuario elija una.

## Contrato del plan

Cada acción contiene:

- Un ID idempotente derivado de la solicitud y su posición.
- El dominio (`movimiento`, `ahorro` o `meta`).
- La operación (`consultar`, `crear`, `editar` o `eliminar`).
- El ID del recurso cuando aplique.
- Un payload cerrado y validado para esa combinación de dominio y operación.
- Confianza y campos que requieren decisión del usuario.

La respuesta se valida con esquemas cerrados. Tipos desconocidos, montos no
positivos, categorías fuera del enum, IDs inexistentes y campos adicionales se
rechazan. El texto de entrada se limita a 300 caracteres y el lote a cinco
acciones.

## Interfaz

Se añadirá un sheet orquestador reutilizando controles y tokens existentes. Cada
acción aparece como una tarjeta compacta con resumen, estado y controles para
editar o quitar. Las ediciones usan los inputs, selectores de categoría, fecha y
meta ya presentes cuando existan; no se crearán formularios paralelos.

El botón de confirmación permanece deshabilitado mientras exista una acción
inválida o ambigua. Las consultas también aparecen en el resumen y muestran su
resultado después de confirmar. Un lote puede completarse parcialmente: el sheet
indica éxito o error por acción y nunca presenta el lote entero como exitoso si
una operación falló.

## Errores y fallback

- La IA no escribe ni elimina datos directamente.
- Un timeout, respuesta inválida o indisponibilidad usa el parser local existente
  solo para gastos y ahorros simples; el resultado se muestra como borrador.
- No se reintentan automáticamente operaciones financieras.
- La ejecución usa IDs estables para que repetir una confirmación no duplique una
  creación.
- Los errores esperados se muestran en la acción afectada; los inesperados se
  registran sin transcript, UID ni datos financieros.

## Privacidad y seguridad

- No se almacena audio, transcript ni salida completa del modelo.
- No se crea perfil, etiqueta o inferencia persistente del menor.
- El contexto del modelo excluye UID, email, nombre de la persona, colegio y
  curso. Los recursos se representan con IDs opacos y datos financieros mínimos.
- Analytics conserva únicamente parámetros expresamente permitidos. Se retiran
  categorías financieras, cantidades del lote y otros detalles financieros.
- Crashlytics deja de recibir el UID autenticado.
- Las reglas Firestore exigirán que un estudiante pertenezca al mismo colegio y
  curso activo para leer roster, progreso e impacto.
- `assignRole` no podrá otorgar `admin` ni claims de curso a profesores; el único
  alta de admin seguirá siendo el allowlist existente.

## Verificación

- Pruebas unitarias del contrato y parser de respuesta IA para cada acción.
- Pruebas de frases multiacción, referencias ambiguas, payloads inválidos y
  fallback local.
- Pruebas de ejecución: edición previa, eliminación, resultados parciales e
  idempotencia.
- Pruebas de reglas para el mismo UID en colegio o curso antiguo.
- Pruebas de claims para impedir escalamiento a admin.
- Pruebas de Analytics y Crashlytics que impidan PII y datos financieros.
- E2E del flujo audio → plan → edición → confirmación → resultado.
- Typecheck, lint, suite Jest, matriz Firestore, invariant-lint y auditoría npm.
- Repetición de las auditorías de privacidad y reglas antes de desplegar.

## Despliegue

Solo con todos los gates verdes:

1. Desplegar Cloud Functions y reglas Firestore.
2. Publicar la aplicación con el perfil EAS `production`.
3. Verificar en producción una consulta, una creación, una edición, una
   eliminación y un lote mixto.
4. Revertir Functions/reglas/app al release anterior si falla un flujo crítico o
   aparece acceso entre tenants.

## Fuera de alcance

- Acciones sobre aprendizaje, cursos, usuarios o contenido académico.
- Ejecución sin resumen y confirmación explícita.
- Persistir conversaciones o memoria personal del asistente.
- Añadir otro proveedor de IA o una nueva dependencia de formularios.
