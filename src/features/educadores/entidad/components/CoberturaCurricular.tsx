/**
 * Cobertura curricular de la EEF (Fase 6, desempeños en la Fase 7): por grado o
 * programa, qué ámbitos y competencias de las orientaciones del MEN se trabajan
 * y qué porcentaje logra cada desempeño. La usan el panel de la entidad y el
 * informe de la clase del profe.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import {
  AMBITOS_MEN,
  COMPETENCIAS_MEN,
  EJES_MEN,
  NOMBRE_COMPETENCIA_MEN,
  NOMBRE_EJE_MEN,
  nombreAmbitoMen,
  type CeldaCobertura,
  type FilaCobertura,
  type FilaDesempeno,
} from '@/functions/src/educadores/dominio';
import { Pill, Seccion, Tarjeta } from '@features/dashboard/components/profe/kit';

const pct = (x: number) => Math.round(x * 100);

export default function CoberturaCurricular({
  cobertura,
  ambitosCubiertos,
  fuente,
  deUnaClase = false,
}: {
  cobertura: readonly FilaCobertura[];
  ambitosCubiertos: number;
  fuente: string;
  /** El informe de una sola clase (profe con Piloto) en vez de toda la entidad. */
  deUnaClase?: boolean;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  const textoCelda = (c: CeldaCobertura) =>
    c.estudiantes === 0
      ? t('entidad.cobertura.sinTrabajar')
      : c.dominio == null
        ? t('entidad.cobertura.est', { count: c.estudiantes })
        : t('entidad.cobertura.estDominio', { count: c.estudiantes, pct: pct(c.dominio) });

  const textoDesempeno = (d: FilaDesempeno) =>
    d.logro == null
      ? t('entidad.cobertura.est', { count: d.estudiantes })
      : t('entidad.cobertura.logran', { n: d.logran, total: d.estudiantes, pct: pct(d.logro) });

  return (
    <>
      <Seccion texto={t('entidad.cobertura.titulo')} />
      <Tarjeta style={{ gap: 8 }}>
        <Text style={[st.nombre, { color: colors.text.primary }]}>
          {t(deUnaClase ? 'cumplimiento.informe.resumen' : 'entidad.cobertura.resumen', { n: ambitosCubiertos, total: AMBITOS_MEN.length })}
        </Text>
        <Text style={[st.sub, { color: colors.text.tertiary }]}>{fuente}</Text>
      </Tarjeta>
      {cobertura.map((f) => (
        <Tarjeta key={f.clave} style={{ gap: 8 }}>
          <View style={st.fila}>
            <Text style={[st.nombre, { flex: 1, color: colors.text.primary }]}>{f.etiqueta}</Text>
            {f.grupoMen ? <Pill tono="neutro" texto={t('entidad.cobertura.grupo', { g: f.grupoMen })} /> : null}
            <Pill
              tono={f.cubiertos > 0 ? 'verde' : 'rojo'}
              texto={t('entidad.cobertura.cubiertos', { n: f.cubiertos, total: AMBITOS_MEN.length })}
            />
          </View>
          {EJES_MEN.map((eje) => (
            <View key={eje} style={{ gap: 4 }}>
              <Text style={[st.eje, { color: colors.text.tertiary }]}>{NOMBRE_EJE_MEN[eje].toUpperCase()}</Text>
              {AMBITOS_MEN.filter((a) => a.eje === eje).map((a) => {
                const c = f.ambitos[a.id];
                return (
                  <View key={a.id} style={st.fila}>
                    <Text
                      style={[st.sub, { flex: 1, color: c.estudiantes > 0 ? colors.text.primary : colors.text.quaternary }]}
                      numberOfLines={1}
                    >
                      {a.nombre}
                    </Text>
                    <Text style={[st.sub, { color: c.estudiantes > 0 ? colors.text.secondary : colors.text.quaternary }]}>
                      {textoCelda(c)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
          <Text style={[st.eje, { color: colors.text.tertiary }]}>{t('entidad.cobertura.competencias').toUpperCase()}</Text>
          <View style={st.chipsFila}>
            {COMPETENCIAS_MEN.map((c) => (
              <Pill
                key={c}
                tono={f.competencias[c].estudiantes > 0 ? 'azul' : 'neutro'}
                texto={`${NOMBRE_COMPETENCIA_MEN[c]} · ${textoCelda(f.competencias[c])}`}
              />
            ))}
          </View>
          <Text style={[st.eje, { color: colors.text.tertiary }]}>{t('entidad.cobertura.desempenos').toUpperCase()}</Text>
          {f.desempenos.length === 0 ? (
            <Text style={[st.sub, { color: colors.text.quaternary }]}>{t('entidad.cobertura.sinDesempenos')}</Text>
          ) : (
            f.desempenos.map((d) => (
              <View key={d.id} style={st.desempeno}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[st.sub, { color: colors.text.primary }]} numberOfLines={2}>
                    {d.resumen}
                  </Text>
                  <Text style={[st.ref, { color: colors.text.quaternary }]} numberOfLines={1}>
                    {`${nombreAmbitoMen(d.ambito)} · ${d.id} · ${d.ref}`}
                  </Text>
                </View>
                <Text style={[st.sub, { color: colors.text.secondary }]}>{textoDesempeno(d)}</Text>
              </View>
            ))
          )}
        </Tarjeta>
      ))}
    </>
  );
}

const st = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  desempeno: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  nombre: { fontSize: 15, fontWeight: '800' },
  sub: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  ref: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
  eje: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  chipsFila: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
