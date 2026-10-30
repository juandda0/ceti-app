/**
 * Corre ahora las alertas del profe (Fase 5) sobre el Salón demo, como lo haría
 * la Function programada `alertasProfe` cada mañana. Los avisos quedan en
 * Clases → Avisos de cada profe con plan Piloto o superior. Sin push: en el
 * emulador el enviador es nulo.
 *
 *   npm run salon:alertas
 *
 * Correrlo dos veces no repite alertas (el estado de lo avisado se guarda).
 */
import { db } from './comun';
import { correrAlertasProfe } from '../../functions/src/educadores/alertasProfe';

process.env.FUNCTIONS_EMULATOR = 'true';

void (async () => {
  const cuenta = await correrAlertasProfe(Date.now(), db);
  console.log(
    `Listo: ${cuenta.alertas} alertas para ${cuenta.revisados} profes (${cuenta.sinPlan} sin plan).`
  );
  process.exit(0);
})();
