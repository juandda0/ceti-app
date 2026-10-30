/**
 * Fase 9 — calendario de la clase, por semanas. Lo usan el profe
 * (`/(staff)/calendario/[cursoId]`, con las clases en vivo hechas y el .ics) y
 * el estudiante (`/(app)/calendario`, el espacio de clase abierto: solo sus
 * tareas, sin cifras de nadie).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TFunction } from 'i18next';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { guardarArchivo } from '@shared/lib/export/guardarArchivo';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useNombreCurso } from '@features/dashboard/hooks/useNombreCurso';
import { evaluacionDeColegio } from '@features/educadores/entidad/hooks/useEvaluacion';
import {
  icsDeEventos,
  porSemana,
  type EventoClase,
  type TipoEvento,
} from '@/functions/src/educadores/dominio';
import {
  BotonChunky,
  Encabezado,
  Esqueleto,
  Seccion,
  Tarjeta,
  Vacio,
  paletaTono,
  type Tono,
} from '@features/dashboard/components/profe/kit';
import { Ionicons } from '@expo/vector-icons';
import { cargarCalendario } from '../data/cargarCalendario';

const TONO: Record<TipoEvento, Tono> = {
  tarea: 'marca',
  tareaAbierta: 'azul',
  mundo: 'verde',
  prueba: 'morado',
  vivo: 'rojo',
  periodo: 'naranja',
};
const ICONO: Record<TipoEvento, keyof typeof Ionicons.glyphMap> = {
  tarea: 'flag',
  tareaAbierta: 'create',
  mundo: 'lock-open',
  prueba: 'clipboard',
  vivo: 'radio',
  periodo: 'calendar',
};

/** Título del evento en palabras del usuario (la prueba y el periodo se nombran aquí). */
export function tituloEvento(e: EventoClase, t: TFunction): string {
  if (e.tipo === 'prueba') {
    const [fase, que] = e.titulo.split(':');
    return t(`calendario.prueba.${fase}_${que}`);
  }
  return t(`calendario.tipo.${e.tipo}`, { titulo: e.titulo });
}

const fechaLarga = (ms: number) =>
  new Date(ms).toLocaleDateString('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Bogota',
  });

export default function CalendarioClaseScreen({ modo }: { modo: 'profe' | 'estudiante' }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const uid = useAuthStore((s) => s.firebaseUid);
  const colegioId = useAuthStore((s) => s.colegioId);
  const espacioCurso = useAuthStore((s) => s.cursoId);
  const params = useLocalSearchParams<{ cursoId?: string; nombre?: string }>();
  const cursoId = modo === 'profe' ? (params.cursoId ?? '') : (espacioCurso ?? '');
  const nombreCurso = useNombreCurso(cursoId, params.nombre);
  const [eventos, setEventos] = useState<EventoClase[] | null>(null);
  const [error, setError] = useState(false);
  const ahora = useMemo(() => Date.now(), []);

  const cargar = useCallback(async () => {
    // Sin sesión todavía (recién abierta la app): espera a que llegue.
    if (!colegioId || !cursoId || !uid) return;
    try {
      const evaluacion = modo === 'profe' ? await evaluacionDeColegio(colegioId) : null;
      setEventos(
        await cargarCalendario({
          colegioId,
          cursoId,
          estudianteUid: modo === 'profe' ? null : uid,
          evaluacion,
          ahora,
        })
      );
    } catch {
      setError(true);
    }
  }, [colegioId, cursoId, uid, modo, ahora]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const grupos = useMemo(() => (eventos ? porSemana(eventos, ahora) : []), [eventos, ahora]);

  const exportar = async () => {
    if (!eventos) return;
    const ics = icsDeEventos(
      eventos.filter((e) => e.en >= ahora).map((e) => ({ ...e, titulo: tituloEvento(e, t) })),
      nombreCurso,
      cursoId,
      Date.now()
    );
    const ok = await guardarArchivo(`ceti-${nombreCurso || 'clase'}.ics`, ics, 'text/calendar');
    if (!ok) showMessage(t('calendario.errorIcs'), undefined, 'error');
  };

  const abrir = (e: EventoClase): Href | null => {
    if (modo === 'profe') {
      if (e.tipo === 'tareaAbierta')
        return `/(staff)/tareas-abiertas/${cursoId}?tarea=${e.ref}` as Href;
      if (e.tipo === 'prueba') return `/(staff)/prueba/${cursoId}` as Href;
      return null;
    }
    if (e.tipo === 'tareaAbierta') return `/(app)/tarea-abierta?id=${e.ref}` as Href;
    if (e.tipo === 'tarea') return '/saga' as Href;
    return null;
  };

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado
          atras={modo === 'profe' ? `/(staff)/curso/${cursoId}` : '/saga'}
          sobretitulo={t('calendario.sobre')}
          titulo={nombreCurso || t('calendario.titulo')}
          subtitulo={t(modo === 'profe' ? 'calendario.subProfe' : 'calendario.subEstudiante')}
        />
        {error ? (
          <Vacio
            icono="cloud-offline-outline"
            tono="rojo"
            titulo={t('calendario.error')}
            texto={t('calendario.errorTexto')}
          />
        ) : null}
        {!error && eventos === null ? <Esqueleto filas={4} alto={64} /> : null}
        {eventos && eventos.length === 0 ? (
          <Vacio
            icono="calendar-outline"
            titulo={t('calendario.vacio')}
            texto={t('calendario.vacioTexto')}
          />
        ) : null}
        {grupos.map((g) => (
          <View key={g.grupo} style={{ gap: 10 }}>
            <Seccion texto={t(`calendario.grupo.${g.grupo}`)} />
            {g.eventos.map((e) => {
              const { fondo, tinta } = paletaTono(colors, TONO[e.tipo]);
              const destino = abrir(e);
              return (
                <Tarjeta key={e.id} onPress={destino ? () => router.push(destino) : undefined}>
                  <View style={st.fila}>
                    <View style={[st.icono, { backgroundColor: fondo }]}>
                      <Ionicons name={ICONO[e.tipo]} size={18} color={tinta} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[st.titulo, { color: colors.text.primary }]} numberOfLines={2}>
                        {tituloEvento(e, t)}
                      </Text>
                      <Text style={[st.sub, { color: colors.text.tertiary }]}>
                        {fechaLarga(e.en)}
                      </Text>
                    </View>
                    {destino ? (
                      <Ionicons name="chevron-forward" size={18} color={colors.text.quaternary} />
                    ) : null}
                  </View>
                </Tarjeta>
              );
            })}
          </View>
        ))}
        {modo === 'profe' && eventos && eventos.some((e) => e.en >= ahora) ? (
          <BotonChunky
            texto={t('calendario.ics')}
            icono="download-outline"
            variante="secundario"
            onPress={() => void exportar()}
          />
        ) : null}
        {modo === 'profe' ? (
          <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('calendario.icsAyuda')}</Text>
        ) : null}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 14 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icono: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { fontSize: 15, fontWeight: '800' },
  sub: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
