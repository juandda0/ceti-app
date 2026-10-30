/**
 * Panel de la entidad (Fase 6, solo admin): adopción por profesor, actividad
 * por clase y dominio por grado o programa, en cifras de grupo. El detalle de
 * cada estudiante sigue siendo del profe de su clase; de la comunicación solo
 * se cuentan envíos.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { competenciaLabel } from '@features/learning/data/competencias';
import { FadeIn, GrowBar } from '@features/savings/charts/ChartParts';
import { MIN_GRUPO, type EstadoAdopcionProfe, type PanelEntidad } from '@/functions/src/educadores/dominio';
import {
  Avatar,
  Chip,
  Cifra,
  Encabezado,
  Esqueleto,
  Pill,
  Seccion,
  Tarjeta,
  Vacio,
  paletaTono,
  tonoNivel,
  type Tono,
} from '@features/dashboard/components/profe/kit';
import { entidadRepository } from '../data/entidadRepository';
import { useMiEntidad } from '../hooks/useMiEntidad';
import { fechaCorta } from '../components/EntidadTarjeta';

const pct = (x: number) => Math.round(x * 100);
const TONO_ESTADO: Record<EstadoAdopcionProfe, Tono> = { activo: 'verde', bajo: 'naranja', sinEmpezar: 'rojo' };

export default function PanelEntidadScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { vista, soyAdmin, conLicencia, cargando: cargandoEntidad } = useMiEntidad();
  const [panel, setPanel] = useState<PanelEntidad | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [profeAbierto, setProfeAbierto] = useState<string | null>(null);

  const cargar = useCallback(async (forzar = false) => {
    setEstado('cargando');
    try {
      setPanel(await entidadRepository.panel(forzar));
      setEstado('listo');
    } catch {
      setEstado('error');
    }
  }, []);

  useEffect(() => {
    if (soyAdmin && conLicencia) void cargar();
  }, [soyAdmin, conLicencia, cargar]);

  const r = panel?.resumen;
  return (
    <ScreenWrapper>
      <ContextScrollView contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]} showsVerticalScrollIndicator={false}>
        <Encabezado
          atras="/(staff)/colegio"
          sobretitulo={t('entidad.panel.sobre')}
          titulo={vista?.entidad?.nombre ?? t('entidad.panel.titulo')}
          subtitulo={panel ? t('entidad.panel.calculado', { fecha: new Date(panel.calculadoAt).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) }) : null}
          derecha={
            panel ? (
              <Chip texto={t('entidad.panel.actualizar')} icono="refresh" seleccionado={false} onPress={() => void cargar(true)} />
            ) : undefined
          }
        />
        {cargandoEntidad || (soyAdmin && conLicencia && estado === 'cargando') ? <Esqueleto filas={4} alto={90} /> : null}
        {!cargandoEntidad && !soyAdmin ? (
          <Vacio icono="lock-closed-outline" titulo={t('entidad.soloAdmin')} texto={t('entidad.soloAdminTexto')} />
        ) : null}
        {!cargandoEntidad && soyAdmin && !conLicencia ? (
          <Vacio icono="business" titulo={t('entidad.panel.sinPlan')} texto={t('entidad.panel.sinPlanTexto')} />
        ) : null}
        {estado === 'error' && soyAdmin && conLicencia ? (
          <Vacio icono="cloud-offline-outline" tono="rojo" titulo={t('profe.errorTitulo')} texto={t('entidad.panel.error')} />
        ) : null}

        {estado === 'listo' && panel && r ? (
          <FadeIn>
            <View style={st.bloques}>
              <View style={st.cifras}>
                <Cifra icono="people" tono="azul" valor={`${r.profesActivos}/${r.profes}`} etiqueta={t('entidad.panel.profesActivos')} />
                <Cifra icono="flash" tono={r.cumpleMeta ? 'verde' : 'naranja'} valor={`${pct(r.adopcion)} %`} etiqueta={t('entidad.panel.estudiantesActivos', { activos: r.estudiantesActivos, total: r.estudiantes })} />
              </View>
              <View style={st.cifras}>
                <Cifra icono="school" tono="morado" valor={String(r.clases)} etiqueta={t('entidad.panel.clases')} />
                <Cifra icono="ribbon" tono={tonoNivel(pct(r.dominio ?? 0))} valor={r.dominio == null ? '—' : `${pct(r.dominio)} %`} etiqueta={t('entidad.panel.dominio')} />
              </View>

              <Seccion texto={t('entidad.panel.porProfe')} />
              <Tarjeta style={{ gap: 2 }}>
                {panel.profes.map((p) => (
                  <View key={p.uid} style={st.item}>
                    <View style={st.fila}>
                      <Avatar nombre={p.nombre} tamano={34} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[st.nombre, { color: colors.text.primary }]} numberOfLines={1} onPress={() => setProfeAbierto(profeAbierto === p.uid ? null : p.uid)}>
                          {p.nombre}
                        </Text>
                        <Text style={[st.sub, { color: colors.text.tertiary }]} numberOfLines={1}>
                          {p.clases === 0
                            ? t('entidad.panel.sinClases')
                            : t('entidad.panel.clasesEst', { count: p.clases, estudiantes: p.estudiantes })}
                          {p.ultimaActividad ? ` · ${t('entidad.panel.ultima', { fecha: fechaCorta(p.ultimaActividad) })}` : ''}
                        </Text>
                      </View>
                      <Pill
                        tono={TONO_ESTADO[p.estado]}
                        texto={p.estado === 'sinEmpezar' ? t('entidad.panel.sinEmpezar') : t('entidad.panel.activos', { pct: pct(p.adopcion) })}
                      />
                    </View>
                    {profeAbierto === p.uid
                      ? panel.clases
                          .filter((c) => c.profes.includes(p.nombre))
                          .map((c) => (
                            <Text key={c.id} style={[st.sub, st.sangria, { color: colors.text.secondary }]}>
                              {t('entidad.panel.claseLinea', { clase: c.nombre, activos: c.estudiantesActivos, total: c.estudiantes })}
                            </Text>
                          ))
                      : null}
                  </View>
                ))}
              </Tarjeta>

              <Seccion texto={t('entidad.panel.porClase')} />
              <Tarjeta style={{ gap: 10 }}>
                {panel.clases.length === 0 ? (
                  <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('entidad.panel.sinClasesEntidad')}</Text>
                ) : null}
                {panel.clases.map((c) => {
                  const tono = paletaTono(colors, tonoNivel(pct(c.adopcion)));
                  return (
                    <View key={c.id} style={{ gap: 4 }}>
                      <View style={st.fila}>
                        <Text style={[st.nombre, { flex: 1, color: colors.text.primary }]} numberOfLines={1}>
                          {c.nombre} <Text style={[st.sub, { color: colors.text.tertiary }]}>· {c.grupo}</Text>
                        </Text>
                        {c.sinProfe ? <Pill tono="rojo" texto={t('entidad.panel.sinProfe')} /> : null}
                        <Text style={[st.num, { color: colors.text.secondary }]}>
                          {c.estudiantesActivos}/{c.estudiantes}
                        </Text>
                      </View>
                      <GrowBar pct={pct(c.adopcion)} color={tono.tinta} trackColor={colors.materials.highlight} height={8} />
                      <Text style={[st.sub, { color: colors.text.tertiary }]} numberOfLines={1}>
                        {c.profes.join(', ') || t('entidad.panel.nadie')}
                      </Text>
                    </View>
                  );
                })}
              </Tarjeta>

              <Seccion texto={t(vista?.entidad?.tipo === 'universidad' ? 'entidad.panel.porPrograma' : 'entidad.panel.porGrado')} />
              <Tarjeta style={{ gap: 12 }}>
                {panel.grupos.map((g) => (
                  <View key={g.clave} style={{ gap: 6 }}>
                    <View style={st.fila}>
                      <Text style={[st.nombre, { flex: 1, color: colors.text.primary }]}>{g.etiqueta}</Text>
                      <Text style={[st.num, { color: colors.text.secondary }]}>
                        {g.dominio == null ? '—' : `${pct(g.dominio)} %`}
                      </Text>
                    </View>
                    {g.dominio == null ? (
                      <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('entidad.panel.grupoChico', { n: MIN_GRUPO })}</Text>
                    ) : (
                      Object.entries(g.competencias).map(([id, v]) => (
                        <View key={id} style={st.fila}>
                          <Text style={[st.sub, st.comp, { color: colors.text.secondary }]} numberOfLines={1}>
                            {competenciaLabel(id)}
                          </Text>
                          <View style={{ flex: 1 }}>
                            <GrowBar pct={pct(v)} color={paletaTono(colors, tonoNivel(pct(v))).tinta} trackColor={colors.materials.highlight} height={8} />
                          </View>
                          <Text style={[st.num, { color: colors.text.tertiary }]}>{pct(v)} %</Text>
                        </View>
                      ))
                    )}
                    {g.masDebil ? (
                      <Text style={[st.sub, { color: colors.text.tertiary }]}>
                        {t('entidad.panel.masDebil', { competencia: competenciaLabel(g.masDebil) })}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </Tarjeta>

              <Seccion texto={t('entidad.panel.comunicacion')} />
              <Tarjeta style={{ gap: 8 }}>
                <View style={st.fila}>
                  <Text style={[st.sub, { flex: 1, color: colors.text.secondary }]}>{t('entidad.panel.comunicados')}</Text>
                  <Text style={[st.num, { color: colors.text.primary }]}>{panel.comunicacion.comunicados7d}</Text>
                </View>
                <View style={st.fila}>
                  <Text style={[st.sub, { flex: 1, color: colors.text.secondary }]}>{t('entidad.panel.clasesEscriben')}</Text>
                  <Text style={[st.num, { color: colors.text.primary }]}>{panel.comunicacion.clasesQueEscriben}</Text>
                </View>
                <View style={st.fila}>
                  <Text style={[st.sub, { flex: 1, color: colors.text.secondary }]}>{t('entidad.panel.familias')}</Text>
                  <Text style={[st.num, { color: colors.text.primary }]}>{panel.comunicacion.familiasConResumen}</Text>
                </View>
              </Tarjeta>
              <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('entidad.panel.privacidad')}</Text>
            </View>
          </FadeIn>
        ) : null}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 80, gap: 14 },
  bloques: { gap: 14 },
  cifras: { flexDirection: 'row', gap: 10 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  item: { gap: 4, paddingVertical: 6 },
  nombre: { fontSize: 15, fontWeight: '800' },
  sub: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  num: { fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'] },
  sangria: { paddingLeft: 44 },
  comp: { width: 110 },
});
