# Modo evento CANSiE

## Objetivo

Preparar la versión web pública de Ceti para visitantes de CANSiE. Cada visitante inicia sesión con Google, completa un perfil breve y puede explorar las herramientas de dinero y los cinco mundos básicos de aprendizaje.

## Alcance

- La pantalla inicial muestra únicamente `Entrar como invitado`.
- El acceso usa Google directamente; no ofrece Apple ni selector de rol.
- Todo nuevo inicio se declara como visitante, sin aprovisionar roles de profesor ni rutas de gestión.
- El onboarding conserva nombre y avatar, y elimina la unión mediante código de clase.
- Una persona visitante entra a los cinco mundos básicos, con contenido por defecto y grado base compatible con el banco disponible.
- La experiencia pública no muestra clases, profesores, tareas, competencias, asignaciones ni otro vocabulario académico.
- Finanzas, actividad, metas, perfil y aprendizaje siguen disponibles en las pestañas actuales.
- Las rutas y código de profesor permanecen en el repositorio, pero no están expuestos por el flujo público del evento.

## Flujo

1. Una persona abre Ceti y pulsa `Entrar como invitado`.
2. Inicia sesión con Google.
3. Completa nombre y avatar.
4. El enrutador central la lleva a Aprender, no a un código de clase ni a una ruta de profesor.
5. Aprender resuelve los mundos básicos locales y el contenido por defecto; finanzas conserva el progreso de la cuenta autenticada.

## Cambios técnicos mínimos

- Reemplazar el selector de proveedor y rol por un único inicio Google que guarda la intención de visitante.
- Hacer que el enrutamiento público ignore el aprovisionamiento de profesor y dirija a la aplicación visitante tras el onboarding.
- Hacer que las pantallas de aprendizaje usen los mundos básicos y un grado base fuera del contexto de clase.
- Ocultar componentes y textos dependientes de clase en el recorrido visitante.
- Conservar la persistencia autenticada actual para el perfil y el progreso financiero.

## Errores y seguridad

- Un error de autenticación se muestra en la misma pantalla y no crea una sesión parcial.
- Si falla el guardado del perfil, el onboarding no avanza.
- El acceso conserva Google/Firebase; no se crea una cuenta anónima ni se exponen rutas de gestión en la navegación pública.

## Pruebas y publicación

- Añadir pruebas de la decisión de ruta visitante y de la resolución de mundos básicos sin clase.
- Ejecutar pruebas, chequeo de tipos, lint y exportación web.
- Desplegar la exportación en Firebase Hosting de producción y publicar las funciones o reglas únicamente si el cambio las requiere.

## Fuera de alcance

- Eliminar o rediseñar la infraestructura de profesor.
- Crear una clase, colegio o contenido exclusivo del evento.
- Cambiar la aplicación móvil nativa más allá del código compartido con la web.
