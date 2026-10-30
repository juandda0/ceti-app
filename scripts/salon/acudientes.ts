/**
 * Corre ahora el correo del domingo para acudientes (Fase 5) sobre el Salón
 * demo, como la Function programada `resumenAcudientesSemanal`. Los correos
 * quedan en la colección `mail` del emulador (no sale ninguno: no hay extensión
 * de correo). Los enlaces apuntan a la web del salón (puerto 8085).
 *
 *   npm run salon:acudientes
 */
import { correrResumenAcudientes } from '../../functions/src/educadores/acudientes';
import { planDeProfe } from '../../functions/src/educadores/plan';
import { auth, db } from './comun';

void (async () => {
  const cuenta = await correrResumenAcudientes(
    Date.now(),
    db,
    {
      plan: (uid, colegioId) => planDeProfe(uid, colegioId, Date.now(), db),
      nombreProfe: async (uid) => (await auth.getUser(uid).catch(() => null))?.displayName ?? null,
    },
    'http://localhost:8085'
  );
  console.log(
    `Listo: ${cuenta.enviados} correos en la cola (mail), ${cuenta.yaEnviados} ya enviados esta semana, ${cuenta.inactivos} sin enlace activo.`
  );
  process.exit(0);
})();
