/**
 * One-shot backfill: writes `agregados/resumen` (the shape read by
 * `agregadosRepository`) for every course in `demo-colegio`, computed from the
 * already-seeded progress docs.
 *
 * Why this exists: the live aggregator trigger (`onProgressWriteAggregate`)
 * EXCLUDES demo-colegio by design (the demo student is reset on each login and
 * must not churn real aggregates). So the rector's demo report — which reads
 * `agregados/resumen` — would be empty unless we compute it here. This replicates
 * the trigger's `recomputeCursoAgregado` logic for the demo tenant only.
 *
 * Idempotent. demo-estudiante has no progress docs, so it is naturally excluded
 * (RQ-DM06). Run with the same creds as the other seeds:
 *   $env:GOOGLE_CLOUD_PROJECT = "ceti-d3769"
 *   npx ts-node --project tsconfig.scripts.json scripts/backfillDemoAgregados.ts
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

if (!admin.apps.length) {
  const saPath = path.resolve(__dirname, '../serviceAccount.json');
  try {
    admin.initializeApp({ credential: admin.credential.cert(require(saPath)) });
  } catch {
    admin.initializeApp(); // ADC + GOOGLE_CLOUD_PROJECT
  }
}

const db = admin.firestore();
const COLEGIO = 'demo-colegio';
const RESUMEN_ID = 'resumen';

function promedio(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a: number, b: number) => a + b, 0) / values.length;
}

async function recompute(cursoId: string): Promise<number> {
  const snap = await db
    .collectionGroup('progress')
    .where('colegioId', '==', COLEGIO)
    .where('cursoId', '==', cursoId)
    .get();

  const agregadoRef = db.doc(`colegios/${COLEGIO}/cursos/${cursoId}/agregados/${RESUMEN_ID}`);
  if (snap.empty) {
    await agregadoRef.delete().catch(() => undefined);
    return 0;
  }

  type Bucket = { masteries: number[]; uids: Set<string>; done: Set<string> };
  const porCompetencia: Record<string, Bucket> = {};
  const porMundo: Record<string, Bucket> = {};
  const allMasteries: number[] = [];
  const activeUids = new Set<string>();
  let completedSlots = 0;

  for (const d of snap.docs) {
    const p = d.data() as {
      uid?: string;
      competencia?: string;
      mastery?: number;
      completed?: boolean;
    };
    const uid = typeof p.uid === 'string' ? p.uid : d.id;
    const mastery = typeof p.mastery === 'number' ? p.mastery : 0;
    const completed = p.completed === true;
    const worldId = d.id;
    const comp = typeof p.competencia === 'string' ? p.competencia : 'desconocida';

    activeUids.add(uid);
    allMasteries.push(mastery);
    if (completed) completedSlots += 1;

    const c = (porCompetencia[comp] ??= { masteries: [], uids: new Set(), done: new Set() });
    c.masteries.push(mastery);
    c.uids.add(uid);
    if (completed) c.done.add(uid);

    const m = (porMundo[worldId] ??= { masteries: [], uids: new Set(), done: new Set() });
    m.masteries.push(mastery);
    m.uids.add(uid);
    if (completed) m.done.add(uid);
  }

  const mapOut = (rec: Record<string, Bucket>) =>
    Object.fromEntries(
      Object.entries(rec).map(([k, v]) => [
        k,
        {
          masteryPromedio: Math.round(promedio(v.masteries) * 100) / 100,
          estudiantes: v.uids.size,
          completados: v.done.size,
        },
      ])
    );

  const estudiantesActivos = activeUids.size;
  const resumen = {
    colegioId: COLEGIO,
    cursoId,
    porCompetencia: mapOut(porCompetencia),
    porMundo: mapOut(porMundo),
    estudiantesActivos,
    masteryPromedio: Math.round(promedio(allMasteries) * 100) / 100,
    porcentajeCompletado:
      estudiantesActivos === 0
        ? 0
        : Math.round((completedSlots / (estudiantesActivos * 5)) * 100) / 100,
    actualizadoAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await agregadoRef.set(resumen, { merge: false });
  return estudiantesActivos;
}

async function main() {
  const cursos = await db.collection(`colegios/${COLEGIO}/cursos`).get();
  if (cursos.empty) {
    console.error(`✗ No hay cursos bajo colegios/${COLEGIO}. ¿Corriste el seed del demo?`);
    process.exit(1);
  }
  let total = 0;
  for (const c of cursos.docs) {
    const n = await recompute(c.id);
    total += n;
    console.log(`  ✓ ${c.id}: agregados/resumen escrito (${n} estudiantes activos)`);
  }
  console.log(
    `\n✅ Backfill demo agregados: ${cursos.size} curso(s), ${total} estudiantes activos en total.`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error('✗ backfill falló:', e);
  process.exit(1);
});
