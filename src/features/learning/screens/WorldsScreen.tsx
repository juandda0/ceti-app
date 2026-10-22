/**
 * Tu Galaxia — pestaña Aprender. Carrusel orbital de mundos: cada mundo es un planeta animado, el
 * activo va grande en el centro y debajo su tarjeta con el progreso y el botón para entrar. Tocar el
 * planeta abre su ficha. Fondo espacial en los dos temas (diseño: canvas "Ceti · Aprender", A1).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useQuestionBankStore } from '@features/learning/store/useQuestionBankStore';
import { useNivelesStore } from '@features/learning/store/useNivelesStore';
import { useOrbitaStore } from '@features/orbita/store/useOrbitaStore';
import PuenteDeMando from '@features/orbita/components/PuenteDeMando';
import type { WorldId } from '@features/learning/data/quiz.types';
import { worldProgressRepository } from '@features/dashboard/data/worldProgressRepository';
import { useStudentGrado } from '@features/learning/hooks/useStudentGrado';
import { useClassConfig } from '@features/learning/hooks/useClassConfig';
import { resolveClassWorlds } from '@features/learning/data/classConfig';
import { worldStatus } from '@features/learning/data/worldStatus';
import { hasClassAccess } from '@features/learning/data/classAccess';
import { displayWorldDef } from '@features/learning/data/worldMeta';
import { planetaDeMundo } from '@features/learning/data/planetas';
import { ESPACIO, FondoEstrellas } from '@features/learning/components/galaxia/espacio';
import CarruselPlanetas, {
  PuntosCarrusel,
} from '@features/learning/components/galaxia/CarruselPlanetas';
import {
  FichaMundo,
  TarjetaMundo,
  type MundoGalaxia,
} from '@features/learning/components/galaxia/TarjetaMundo';

const ANCHO_MAX = 680;

export default function WorldsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: anchoVentana, height: altoVentana } = useWindowDimensions();
  // Per-account key (Firebase uid); fallback to local profile id only offline.
  // Both hooks must run every render (no conditional hook calls).
  const firebaseUid = useAuthStore((s) => s.firebaseUid);
  const localProfileId = useUserStore((s) => s.id);
  const userId = firebaseUid ?? localProfileId;
  // Tenant identity (provisioned students only) — used to rehydrate progress.
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const hasAccess = hasClassAccess(colegioId, cursoId);
  const cargarNiveles = useNivelesStore((s) => s.cargar);
  const nivelesPorMundo = useNivelesStore((s) => s.porMundo);
  const isWorldComplete = useQuestionBankStore((s) => s.isWorldComplete);
  const setRemoteProgress = useQuestionBankStore((s) => s.setRemoteProgress);
  // Subscribe to answers so progress/unlock recompute right after a quiz, without
  // waiting for a remount (the getters above are stable and don't trigger renders).
  const answers = useQuestionBankStore((s) => s.answers);
  // Subscribe to remoteProgress so the cards re-render once hydration resolves.
  const remoteProgress = useQuestionBankStore((s) => s.remoteProgress);

  // Grado comes from the course doc (R4 — never stored on the student). null
  // while resolving so we never prefetch the wrong grade's banco.
  const grado = useStudentGrado();

  // seedKey = Firebase uid (stable per-account); fallback to local id in demo/offline.
  const seedKey = userId ?? 'demo';
  const uid = userId ?? '';
  const leccionesHechas = useOrbitaStore((s) => s.porUid[uid]?.niveles);

  // Class config (D-ORQ, RQ-PR10): which worlds this class sees and in which
  // order. Live via onSnapshot; null → defaults.
  const { config: classConfig, loaded: classConfigLoaded } = useClassConfig();
  const { worlds: classWorlds } = useMemo(
    () => resolveClassWorlds(classConfig, (w) => isWorldComplete(uid, w as WorldId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classConfig, uid, answers, remoteProgress, isWorldComplete]
  );

  // Per-world pointer to the course's custom content (RQ-PR11); null without a
  // tenant (demo/offline) → default banks, as always.
  const courseContentFor = (worldId: string) =>
    colegioId && cursoId
      ? {
          colegioId,
          cursoId,
          overrides: classConfig?.overrides?.[worldId],
          version: classConfig?.version ?? 0,
        }
      : null;

  // Visible worlds joined with their display metadata, planet and progress.
  const mundos = useMemo<MundoGalaxia[]>(() => {
    const base = classWorlds
      .map((cw, index) => {
        const entry = classConfig?.mundos?.find((m) => m.worldId === cw.worldId);
        const disp = displayWorldDef(cw.worldId, entry);
        if (!disp) return null;
        // Progreso por niveles del mapa: lecciones hechas + el jefe (que conquista el mundo).
        const conquistado = isWorldComplete(uid, cw.worldId as WorldId);
        const lecciones = nivelesPorMundo[cw.worldId]?.niveles?.lecciones.length ?? 4;
        const total = lecciones + 1;
        const hechas = conquistado
          ? total
          : Math.min(leccionesHechas?.[cw.worldId] ?? 0, lecciones);
        return {
          id: cw.worldId,
          numero: index + 1,
          nombre: disp.name,
          descripcion: disp.description,
          planeta: planetaDeMundo(cw.worldId, index),
          estado: worldStatus(cw.unlocked, conquistado ? 1 : hechas / total),
          hechas,
          total,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return base.map((m, i) => ({
      ...m,
      numero: i + 1,
      anterior: i > 0 ? base[i - 1].nombre : undefined,
      siguiente: i < base.length - 1 ? base[i + 1].nombre : undefined,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classWorlds, classConfig, uid, answers, remoteProgress, isWorldComplete, nivelesPorMundo, leccionesHechas]);

  // Prefetch the class's worlds once the real grado AND the class config are
  // known (avoids fetching worlds the class doesn't serve). The store guard
  // keys on (grado, seedKey), so this correctly re-fetches if grade resolves later.
  useEffect(() => {
    if (!grado || !classConfigLoaded) return;
    for (const m of mundos) {
      void cargarNiveles(grado, m.id as WorldId, seedKey, courseContentFor(m.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, grado, seedKey, classConfigLoaded, mundos.length]);

  // Rehydrate per-world mastery from the tenant tree so unlock/progress survive
  // logout and new devices (the local answers cache is empty there).
  useEffect(() => {
    if (!hasAccess || !colegioId || !cursoId || !firebaseUid) return;
    let cancelled = false;
    void (async () => {
      const docs = await worldProgressRepository.getStudentProgress(
        colegioId,
        cursoId,
        firebaseUid
      );
      if (cancelled) return;
      const byWorld: Partial<Record<WorldId, number>> = {};
      for (const d of docs) byWorld[d.worldId as WorldId] = d.mastery;
      setRemoteProgress(byWorld);
    })();
    return () => {
      cancelled = true;
    };
  }, [hasAccess, colegioId, cursoId, firebaseUid, setRemoteProgress]);

  // Mundo activo: arranca en el que toca (el primero abierto sin conquistar) y luego lo mueve el usuario.
  const [activo, setActivo] = useState(0);
  const [fichaAbierta, setFichaAbierta] = useState(false);
  const iniciado = useRef(false);
  useEffect(() => {
    if (mundos.length === 0) return;
    if (!iniciado.current) {
      iniciado.current = true;
      const actual = mundos.findIndex((m) => m.estado === 'disponible' || m.estado === 'en_progreso');
      const ultimoAbierto = mundos.map((m) => m.estado !== 'bloqueado').lastIndexOf(true);
      setActivo(actual >= 0 ? actual : Math.max(0, ultimoAbierto));
    } else if (activo > mundos.length - 1) {
      setActivo(mundos.length - 1);
    }
  }, [mundos, activo]);

  const ancho = Math.min(anchoVentana, ANCHO_MAX);
  const altoCarrusel = Math.round(Math.min(320, Math.max(240, altoVentana * 0.36)));
  const mundo = mundos[activo];
  const entrar = (m: MundoGalaxia) => {
    setFichaAbierta(false);
    router.push(`/saga/${m.id}` as never);
  };

  return (
    <View style={[estilos.raiz, { width: anchoVentana }]}>
      <FondoEstrellas ancho={anchoVentana} alto={altoVentana} />
      <ScrollView
        contentContainerStyle={[
          estilos.scroll,
          {
            width: ancho,
            paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 12 : 8) + 12,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={estilos.cabecera}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={estilos.titulo} accessibilityRole="header">
              {t('worlds.pageTitle')}
            </Text>
            <Text style={estilos.subtitulo}>{t('galaxia.desliza')}</Text>
          </View>
        </View>
        <View style={estilos.puente}>
          <PuenteDeMando />
        </View>

        {!classConfigLoaded ? (
          <View style={estilos.vacio}>
            <ActivityIndicator size="large" color={ESPACIO.textoSuave} />
          </View>
        ) : mundos.length === 0 || !mundo ? (
          <View style={estilos.vacio}>
            <Ionicons name="planet-outline" size={44} color={ESPACIO.textoApagado} />
            <Text style={estilos.vacioTexto}>{t('worlds.emptyClass')}</Text>
          </View>
        ) : (
          <>
            <CarruselPlanetas
              mundos={mundos.map((m) => ({
                id: m.id,
                nombre: m.nombre,
                planeta: m.planeta,
                bloqueado: m.estado === 'bloqueado',
              }))}
              activo={activo}
              onCambio={setActivo}
              onTocar={() => setFichaAbierta(true)}
              ancho={ancho}
              alto={altoCarrusel}
            />
            <PuntosCarrusel
              total={mundos.length}
              activo={activo}
              conquistados={mundos.map((m) => m.estado === 'dominado')}
              acento={mundo.planeta.acento}
            />
            <View style={estilos.tarjetaZona}>
              <TarjetaMundo
                mundo={mundo}
                onEntrar={() => entrar(mundo)}
                onVer={() => setFichaAbierta(true)}
              />
            </View>
          </>
        )}
      </ScrollView>

      <FichaMundo
        mundo={mundo ?? null}
        visible={fichaAbierta}
        onCerrar={() => setFichaAbierta(false)}
        onEntrar={() => mundo && entrar(mundo)}
        onGuia={() => {
          if (!mundo) return;
          setFichaAbierta(false);
          router.push(`/saga/guia/${mundo.id}` as never);
        }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: ESPACIO.fondo, overflow: 'hidden' },
  scroll: { alignSelf: 'center', paddingBottom: 140, gap: 14 },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
  },
  titulo: { fontSize: 36, lineHeight: 40, fontWeight: '900', color: ESPACIO.texto },
  subtitulo: { fontSize: 16, fontWeight: '700', color: ESPACIO.textoSuave },
  tarjetaZona: { paddingHorizontal: 20, marginTop: 8 },
  puente: { paddingHorizontal: 20 },
  vacio: { alignItems: 'center', gap: 12, paddingVertical: 64, paddingHorizontal: 32 },
  vacioTexto: { fontSize: 15, fontWeight: '700', textAlign: 'center', color: ESPACIO.textoSuave },
});
