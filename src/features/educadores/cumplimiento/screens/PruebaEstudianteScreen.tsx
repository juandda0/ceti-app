/**
 * Fase 7 — la prueba de entrada o de salida, del lado del estudiante. Las
 * preguntas apartadas (2 por mundo de Ceti de su clase, del banco de su grado),
 * una a la vez, sin vidas, sin XP y sin decir si acertó: es un diagnóstico. Se
 * responde una sola vez por fase (las reglas lo exigen) y solo con la fase
 * abierta por el profe.
 */
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import Bounceable from '@shared/components/Bounceable';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { classConfigRepository } from '@features/dashboard/data/classConfigRepository';
import { questionBankRepository } from '@features/learning/data/QuestionBankRepository';
import { WORLD_ORDER } from '@features/learning/data/competencias';
import type { Grado, MultipleChoiceItem } from '@features/learning/data/quiz.types';
import { GrowBar } from '@features/savings/charts/ChartParts';
import { BotonChunky, Encabezado, Esqueleto, Tarjeta, Vacio } from '@features/dashboard/components/profe/kit';
import {
  armarPrueba,
  esFasePrueba,
  faseAbierta,
  resultadoPrueba,
  type FasePrueba,
} from '@/functions/src/educadores/dominio';
import { cumplimientoRepository } from '../data/cumplimientoRepository';

type Estado = 'cargando' | 'cerrada' | 'hecha' | 'sinPreguntas' | 'respondiendo' | 'guardando' | 'lista' | 'error';

export default function PruebaEstudianteScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ fase?: string }>();
  const fase: FasePrueba = esFasePrueba(params.fase) ? params.fase : 'pre';
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const uid = useAuthStore((s) => s.firebaseUid);

  const [estado, setEstado] = useState<Estado>('cargando');
  const [preguntas, setPreguntas] = useState<MultipleChoiceItem[]>([]);
  const [actual, setActual] = useState(0);
  const [elegida, setElegida] = useState<number | null>(null);
  const [respuestas, setRespuestas] = useState<{ ambito?: string; ok: boolean }[]>([]);

  useEffect(() => {
    let cancelado = false;
    if (!colegioId || !cursoId || !uid) {
      setEstado('cerrada');
      return;
    }
    void (async () => {
      try {
        const [config, hecha] = await Promise.all([
          cumplimientoRepository.configPrueba(colegioId, cursoId),
          cumplimientoRepository.miResultado(colegioId, cursoId, uid, fase),
        ]);
        if (cancelado) return;
        if (hecha) return setEstado('hecha');
        if (!faseAbierta(config, fase)) return setEstado('cerrada');
        const [grado, clase] = await Promise.all([
          rosterRepository.getCursoGrado(colegioId, cursoId),
          classConfigRepository.get(colegioId, cursoId),
        ]);
        // Los mundos de Ceti que la clase tiene encendidos (todos, sin configuración).
        const encendidos = clase?.mundos?.length
          ? clase.mundos.filter((m) => m.activo).map((m) => m.worldId)
          : [...WORLD_ORDER];
        const mundos = WORLD_ORDER.filter((w) => encendidos.includes(w));
        const porMundo = Object.fromEntries(
          await Promise.all(
            mundos.map(async (w) => [w, await questionBankRepository.fetchPrueba((grado ?? '9') as Grado, w)] as const)
          )
        );
        if (cancelado) return;
        const lista = armarPrueba(mundos, porMundo);
        setPreguntas(lista);
        setEstado(lista.length ? 'respondiendo' : 'sinPreguntas');
      } catch {
        if (!cancelado) setEstado('error');
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [colegioId, cursoId, uid, fase]);

  const pregunta = preguntas[actual];
  const avance = useMemo(() => (preguntas.length ? Math.round((actual / preguntas.length) * 100) : 0), [actual, preguntas.length]);

  const siguiente = async () => {
    if (!pregunta || elegida === null || !colegioId || !cursoId || !uid) return;
    const todas = [...respuestas, { ambito: pregunta.ambito, ok: elegida === pregunta.correctIndex }];
    setRespuestas(todas);
    setElegida(null);
    if (actual + 1 < preguntas.length) {
      setActual(actual + 1);
      return;
    }
    setEstado('guardando');
    try {
      await cumplimientoRepository.guardarResultado(colegioId, cursoId, uid, fase, resultadoPrueba(todas, Date.now()));
      setEstado('lista');
    } catch (e) {
      setEstado('respondiendo');
      showMessage(t('cumplimiento.estudiante.errorGuardar'), e instanceof Error ? e.message : undefined, 'error');
    }
  };

  const volver = () => router.replace('/(app)/saga' as Href);

  return (
    <ScreenWrapper>
      <ContextScrollView contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]} showsVerticalScrollIndicator={false}>
        <Encabezado
          atras="/(app)/saga"
          sobretitulo={t('cumplimiento.estudiante.sobre')}
          titulo={t(`cumplimiento.estudiante.titulo_${fase}`)}
        />

        {estado === 'cargando' ? <Esqueleto filas={4} alto={64} /> : null}
        {estado === 'error' ? (
          <Vacio icono="cloud-offline-outline" tono="rojo" titulo={t('profe.errorTitulo')} texto={t('dashboard.error')} />
        ) : null}
        {estado === 'cerrada' || estado === 'hecha' || estado === 'sinPreguntas' || estado === 'lista' ? (
          <>
            <Vacio
              icono={estado === 'lista' || estado === 'hecha' ? 'checkmark-circle' : 'lock-closed-outline'}
              tono={estado === 'lista' || estado === 'hecha' ? 'verde' : 'neutro'}
              titulo={t(`cumplimiento.estudiante.${estado}Titulo`)}
              texto={t(`cumplimiento.estudiante.${estado}Texto`)}
            />
            <BotonChunky texto={t('cumplimiento.estudiante.volver')} icono="planet" onPress={volver} />
          </>
        ) : null}

        {(estado === 'respondiendo' || estado === 'guardando') && pregunta ? (
          <>
            <View style={st.progreso}>
              <View style={{ flex: 1 }}>
                <GrowBar pct={avance} color={colors.brand.primary} trackColor={colors.materials.highlight} height={12} />
              </View>
              <Text style={[st.cuenta, { color: colors.text.secondary }]}>{`${actual + 1}/${preguntas.length}`}</Text>
            </View>
            <Tarjeta style={{ gap: 6 }}>
              <Text style={[st.nota, { color: colors.text.tertiary }]}>{t('cumplimiento.estudiante.sinVidas')}</Text>
            </Tarjeta>
            <Text style={[st.enunciado, { color: colors.text.primary }]}>{pregunta.enunciado}</Text>
            <View style={{ gap: 10 }} accessibilityRole="radiogroup">
              {pregunta.opciones.map((o, i) => {
                const sel = elegida === i;
                return (
                  <Bounceable
                    key={`${pregunta.id}-${i}`}
                    onPress={() => setElegida(i)}
                    activeScale={0.98}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: sel }}
                    accessibilityLabel={o}
                    style={[
                      st.opcion,
                      {
                        borderColor: sel ? colors.brand.primary : colors.materials.border,
                        backgroundColor: sel ? colors.fill.orangeSubtle : colors.materials.base,
                      },
                    ]}
                  >
                    <Text style={[st.opcionTxt, { color: colors.text.primary }]}>{o}</Text>
                  </Bounceable>
                );
              })}
            </View>
            <BotonChunky
              texto={actual + 1 < preguntas.length ? t('cumplimiento.estudiante.siguiente') : t('cumplimiento.estudiante.terminar')}
              icono={actual + 1 < preguntas.length ? 'arrow-forward' : 'checkmark'}
              deshabilitado={elegida === null}
              cargando={estado === 'guardando'}
              onPress={() => void siguiente()}
            />
            <Text style={[st.nota, { color: colors.text.tertiary, textAlign: 'center' }]}>{t('cumplimiento.estudiante.sinFeedback')}</Text>
          </>
        ) : null}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 16 },
  progreso: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cuenta: { fontSize: 14, fontWeight: '900' },
  enunciado: { fontSize: 22, lineHeight: 28, fontWeight: '900' },
  opcion: { borderWidth: 2, borderRadius: 18, padding: 16 },
  opcionTxt: { fontSize: 16, lineHeight: 22, fontWeight: '800' },
  nota: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
});
