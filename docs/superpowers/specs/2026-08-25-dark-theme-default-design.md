# Modo oscuro por defecto

## Objetivo

CETI usará el modo oscuro como tema inicial en instalaciones nuevas, sin cambiar
la preferencia ya guardada de usuarios existentes.

## Diseño

- Cambiar el valor inicial de `useThemeStore` de `light` a `dark`.
- Mantener la clave persistida `ceti-theme-storage`, el selector de tema y la
  alternancia actual sin cambios.
- No añadir migraciones: el estado persistido actual no permite distinguir una
  elección explícita del antiguo valor predeterminado.
- No añadir dependencias ni modificar las paletas existentes.

## Verificación

- Una prueba pequeña comprobará que el estado inicial es oscuro cuando no hay una
  preferencia persistida y que la alternancia sigue cambiando entre ambos temas.
- Se ejecutarán la prueba afectada, el typecheck y el lint disponibles en el repo.

## Fuera de alcance

- Sobrescribir preferencias existentes.
- Rediseñar colores, componentes o pantallas.
- Seguir automáticamente el tema del sistema operativo.
