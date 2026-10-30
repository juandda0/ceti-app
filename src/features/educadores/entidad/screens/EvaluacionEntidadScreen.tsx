/**
 * Escala de notas y periodos de la entidad (Fase 6): el SIEE del colegio o el
 * calendario semestral de la universidad. Un admin la edita; los profes la ven.
 * Notas, Análisis, la ficha y la exportación la usan en todas las clases.
 */
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import {
  DESEMPENOS,
  ETIQUETA_DESEMPENO,
  MAX_PERIODOS,
  MENSAJES_ERROR_EVALUACION,
  evaluacionPorDefecto,
  leerEvaluacion,
  type Calendario,
  type ConfigEvaluacion,
} from '@/functions/src/educadores/dominio';
import {
  Aviso,
  BotonChunky,
  Campo,
  Chip,
  Encabezado,
  Esqueleto,
  Pill,
  Seccion,
  Tarjeta,
  tapsConTeclado,
  type Tono,
} from '@features/dashboard/components/profe/kit';
import { entidadRepository } from '../data/entidadRepository';
import { useMiEntidad } from '../hooks/useMiEntidad';
import { evaluacionDeColegio, olvidarEvaluacion } from '../hooks/useEvaluacion';

const TONO: Record<string, Tono> = { bajo: 'rojo', basico: 'naranja', alto: 'azul', superior: 'verde' };

/** 'MM-DD' ↔ 'dd/mm' para escribir fechas como en Colombia. */
const aPantalla = (md: string) => (/^\d{2}-\d{2}$/.test(md) ? `${md.slice(3)}/${md.slice(0, 2)}` : md);
const deFormulario = (v: string) => {
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(v.trim());
  return m ? `${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : v.trim();
};
const num = (v: string) => Number(v.replace(',', '.'));
const coma = (n: number) => String(n).replace('.', ',');

interface Formulario {
  calendario: Calendario;
  notaMin: string;
  notaMax: string;
  rangos: string[];
  periodos: { nombre: string; desde: string; hasta: string }[];
}

function aFormulario(c: ConfigEvaluacion): Formulario {
  return {
    calendario: c.calendario,
    notaMin: coma(c.escala.notaMin),
    notaMax: coma(c.escala.notaMax),
    rangos: c.escala.rangos.map((r) => coma(r.min)),
    periodos: c.periodos.map((p) => ({ nombre: p.nombre, desde: aPantalla(p.desde), hasta: aPantalla(p.hasta) })),
  };
}

function deFormularioAConfig(f: Formulario): unknown {
  return {
    calendario: f.calendario,
    escala: {
      notaMin: num(f.notaMin),
      notaMax: num(f.notaMax),
      rangos: DESEMPENOS.map((d, i) => ({ desempeno: d, min: num(f.rangos[i] ?? '') })),
    },
    periodos: f.periodos.map((p) => ({ nombre: p.nombre, desde: deFormulario(p.desde), hasta: deFormulario(p.hasta) })),
  };
}

export default function EvaluacionEntidadScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const colegioId = useAuthStore((s) => s.colegioId);
  const { vista, soyAdmin, cargando } = useMiEntidad();
  const [form, setForm] = useState<Formulario | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!colegioId || cargando) return;
    void evaluacionDeColegio(colegioId).then((c) =>
      setForm(aFormulario(c ?? evaluacionPorDefecto(vista?.entidad?.tipo === 'universidad' ? 'semestres' : 'periodos')))
    );
  }, [colegioId, cargando, vista?.entidad?.tipo]);

  const validacion = useMemo(() => (form ? leerEvaluacion(deFormularioAConfig(form)) : null), [form]);
  const editable = soyAdmin;

  const cambiar = (f: (x: Formulario) => Formulario) => setForm((x) => (x ? f(x) : x));

  const guardar = async () => {
    if (!validacion?.ok || !colegioId) return;
    setGuardando(true);
    try {
      await entidadRepository.guardarEvaluacion(validacion.config);
      olvidarEvaluacion(colegioId);
      showMessage(t('entidad.evaluacion.guardada'), t('entidad.evaluacion.guardadaTexto'), 'success');
    } catch (e) {
      showMessage(t('entidad.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setGuardando(false);
    }
  };

  const usarCalendario = (c: Calendario) =>
    cambiar((x) => ({ ...x, calendario: c, periodos: aFormulario(evaluacionPorDefecto(c)).periodos }));

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps={tapsConTeclado}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado
          atras="/(staff)/colegio"
          sobretitulo={vista?.entidad?.nombre ?? t('entidad.sobre')}
          titulo={t('entidad.evaluacion.titulo')}
          subtitulo={t(editable ? 'entidad.evaluacion.subAdmin' : 'entidad.evaluacion.subProfe')}
        />
        {!form ? <Esqueleto filas={3} alto={90} /> : null}
        {form ? (
          <>
            <Seccion texto={t('entidad.evaluacion.calendario')} />
            <View style={st.chips}>
              {(['periodos', 'semestres'] as const).map((c) => (
                <Chip
                  key={c}
                  texto={t(`entidad.evaluacion.cal_${c}`)}
                  seleccionado={form.calendario === c}
                  onPress={() => (editable ? usarCalendario(c) : undefined)}
                />
              ))}
            </View>

            <Seccion texto={t('entidad.evaluacion.escala')} />
            <Tarjeta style={{ gap: 10 }}>
              <View style={st.fila}>
                <Campo style={st.mitad} etiqueta={t('entidad.evaluacion.notaMin')} value={form.notaMin} editable={editable} onChangeText={(v) => cambiar((x) => ({ ...x, notaMin: v }))} />
                <Campo style={st.mitad} etiqueta={t('entidad.evaluacion.notaMax')} value={form.notaMax} editable={editable} onChangeText={(v) => cambiar((x) => ({ ...x, notaMax: v }))} />
              </View>
              {DESEMPENOS.map((d, i) => (
                <View key={d} style={st.fila}>
                  <View style={st.etiquetaDesempeno}>
                    <Pill tono={TONO[d]} texto={ETIQUETA_DESEMPENO[d]} />
                  </View>
                  <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('entidad.evaluacion.desde')}</Text>
                  <Campo
                    style={st.corto}
                    value={form.rangos[i] ?? ''}
                    editable={editable && i > 0}
                    onChangeText={(v) => cambiar((x) => ({ ...x, rangos: x.rangos.map((r, j) => (j === i ? v : r)) }))}
                  />
                </View>
              ))}
              <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('entidad.evaluacion.escalaAyuda')}</Text>
            </Tarjeta>

            <Seccion texto={t(form.calendario === 'semestres' ? 'entidad.evaluacion.semestres' : 'entidad.evaluacion.periodos')} />
            <Tarjeta style={{ gap: 12 }}>
              {form.periodos.map((p, i) => (
                <View key={i} style={{ gap: 6 }}>
                  <Campo value={p.nombre} editable={editable} etiqueta={t('entidad.evaluacion.nombrePeriodo')} onChangeText={(v) => cambiar((x) => ({ ...x, periodos: x.periodos.map((q, j) => (j === i ? { ...q, nombre: v } : q)) }))} />
                  <View style={st.fila}>
                    <Campo style={st.mitad} etiqueta={t('entidad.evaluacion.inicia')} placeholder="26/01" value={p.desde} editable={editable} onChangeText={(v) => cambiar((x) => ({ ...x, periodos: x.periodos.map((q, j) => (j === i ? { ...q, desde: v } : q)) }))} />
                    <Campo style={st.mitad} etiqueta={t('entidad.evaluacion.termina')} placeholder="10/04" value={p.hasta} editable={editable} onChangeText={(v) => cambiar((x) => ({ ...x, periodos: x.periodos.map((q, j) => (j === i ? { ...q, hasta: v } : q)) }))} />
                  </View>
                  {editable && form.periodos.length > 1 ? (
                    <Chip texto={t('entidad.evaluacion.quitarPeriodo')} icono="trash-outline" seleccionado={false} onPress={() => cambiar((x) => ({ ...x, periodos: x.periodos.filter((_, j) => j !== i) }))} />
                  ) : null}
                </View>
              ))}
              {editable && form.periodos.length < MAX_PERIODOS ? (
                <Chip
                  texto={t('entidad.evaluacion.agregarPeriodo')}
                  icono="add"
                  seleccionado={false}
                  onPress={() => cambiar((x) => ({ ...x, periodos: [...x.periodos, { nombre: t('entidad.evaluacion.periodoN', { n: x.periodos.length + 1 }), desde: '', hasta: '' }] }))}
                />
              ) : null}
            </Tarjeta>

            {editable ? (
              <>
                {validacion && !validacion.ok ? (
                  <Aviso icono="alert-circle" tono="naranja" texto={MENSAJES_ERROR_EVALUACION[validacion.error]} />
                ) : null}
                <BotonChunky texto={t('entidad.evaluacion.guardar')} icono="checkmark-circle" cargando={guardando} deshabilitado={!validacion?.ok} onPress={() => void guardar()} />
              </>
            ) : (
              <Aviso icono="information-circle" tono="azul" texto={t('entidad.evaluacion.soloAdmin')} />
            )}
          </>
        ) : null}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 80, gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mitad: { flex: 1, minWidth: 0 },
  corto: { width: 90 },
  etiquetaDesempeno: { width: 96 },
  sub: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
