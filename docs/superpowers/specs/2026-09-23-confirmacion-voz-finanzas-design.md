# Confirmación clara después de registrar por voz

## Objetivo

Después de escuchar una frase, CETI organiza la acción propuesta antes de guardar
cualquier dato. La persona puede confirmar el resultado o corregirlo manualmente.

## Flujo

1. La persona graba o escribe una frase y solicita organizarla.
2. La IA devuelve una o varias acciones financieras estructuradas.
3. La aplicación muestra un resumen por acción, sin terminología técnica:
   - gasto: monto, descripción y categoría;
   - ahorro: monto, descripción y meta seleccionada, si existe;
   - meta nueva: nombre y monto objetivo.
4. El único resultado posible antes de guardar es elegir **Confirmar** o
   **Corregir**.
5. **Corregir** revela los campos editables adecuados:
   - gasto: monto, descripción y categoría (comida, transporte, viaje,
     entretenimiento y las demás categorías disponibles);
   - ahorro: monto, descripción y la meta opcional a la que se aporta;
   - meta nueva: nombre y monto objetivo.
6. **Confirmar** persiste exclusivamente las acciones completas. Cancelar no
   persiste ninguna.

## Reglas de clasificación

- Un pago o una compra es un gasto y debe tener categoría.
- Dinero recibido, encontrado o apartado es ahorro; puede quedar sin meta o
  aportar a una meta existente.
- Una petición de nueva meta crea la meta solo tras la confirmación.
- Una petición de aportar a una meta exige seleccionar una meta si la IA no
  pudo identificarla.

## Implementación acotada

La hoja `FinancialAssistantSheet` ya recibe el plan de la IA, permite editar
campos y ejecuta las operaciones existentes. Se ajustará para presentar las
acciones con estos nombres y controles, ocultando operación/dominio y mostrando
el botón explícito **Corregir** antes del formulario. No se crearán rutas,
almacenamiento ni flujos alternos.

## Manejo de errores y pruebas

- Si la IA no puede producir un plan válido, no se guarda nada y se mantiene el
  texto para corrección manual.
- Si falta una meta para un aporte, la confirmación queda deshabilitada hasta
  elegirla.
- Las pruebas cubrirán el resumen, la apertura de Corregir, gasto con categoría,
  ahorro con meta y creación de meta; además de confirmar que no se ejecuta nada
  antes de confirmar.
