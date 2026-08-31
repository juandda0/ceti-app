# Acceso financiero sin clase y cuestionarios bloqueados

## Objetivo

Un estudiante autenticado puede usar siempre Mi dinero (metas, ahorro, gastos y presupuestos), aun sin estar vinculado a una clase. Los mundos y cuestionarios requieren una clase.

## Flujo

1. El onboarding mantiene nombre y avatar y agrega la solicitud opcional del código de clase.
2. Si el estudiante omite el código, termina en Mi dinero.
3. Si escribe un código válido, o llega por `/join/{codigo}`, se une a la clase al terminar el onboarding y conserva el flujo actual de refresco de claims.
4. La pestaña Aprender no carga ni muestra mundos cuando faltan `colegioId` o `cursoId`; muestra el formulario de código.
5. La ruta de un mundo aplica el mismo gate y vuelve a Aprender si no hay clase, para impedir enlaces internos directos.

## Diseño técnico

- Un helper puro concentra la condición de acceso a aprendizaje y evita que el router, la pantalla de mundos y la ruta de mundo discrepen.
- El formulario existente de unión se extrae o adapta como pieza reutilizable para onboarding y Aprender, conservando el uso de `joinByCode`, el refresco de token y el manejo de errores.
- El router raíz deja de enviar a `/(auth)/unirse` al estudiante sin clase y lo dirige a `/(app)/dinero`.
- No se cambia la autorización de Firestore ni el modelo de datos: los datos financieros siguen aislados por UID y los datos de clase permanecen protegidos por claims/reglas.

## Límites

- No se modifica el cambio concurrente de modo oscuro, incluidas sus traducciones y estilos.
- No se altera la atestación de autorización del curso: al unirse, se mantiene su estado actual.
- No se agrega dependencia.

## Pruebas

- Prueba unitaria del helper de acceso: solo una pareja completa de IDs de colegio y curso habilita el aprendizaje.
- Verificación de tipos, lint y pruebas pertinentes tras el cambio.
