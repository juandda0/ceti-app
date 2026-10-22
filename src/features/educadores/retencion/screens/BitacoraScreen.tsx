/**
 * Bitácora del domingo completa: la semana de todas las clases del profe en una
 * sola pantalla. Ceti cuenta cómo le fue a la tripulación, quiénes llevan 14
 * días o más sin entrar, el mundo que más cuesta y el tiempo que se ahorró
 * (estimado). Un solo botón principal lleva al siguiente paso. Cualquier plan.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { CetiAnimation } from '@features/animations';
import { GrowBar } from '@features/savings/charts/ChartParts';
import {
  DIA_MS,
  DIAS_SIN_ENTRAR_ALERTA,
  MINUTOS_POR_QUIZ,
  MINUTOS_POR_REPORTE,
  formatoMinutos,
} from '@/functions/src/educadores/dominio';
import {
  Aviso,
  Avatar,
  BotonChunky,
  Cifra,
  Encabezado,
  Esqueleto,
  Pill,
  Seccion,
  Tarjeta,
  Vacio,
  paletaTono,
  tonoNivel,
  tapsConTeclado,
} from '@features/dashboard/components/profe/kit';
import { useBitacora } from '../hooks/useBitacora';
import { animacionDeTono, rangoSemana, vozCeti } from '../components/vozBitacora';
import { textoPaso } from '../components/textoPaso';

const ALERTAS_VISIBLES = 8;

export default function BitacoraScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { estado, resultado, recargar } = useBitacora();

  const b = resultado?.bitacora ?? null;
  const pctActivos = b ? Math.round(b.pctActivos * 100) : 0;

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[styles.page, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps={tapsConTeclado}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado
          atras="/(staff)/clases"
          sobretitulo={t('educadores.bitacora.sobretitulo')}
          titulo={t('educadores.bitacora.titulo')}
          subtitulo={
            b ? t('educadores.bitacora.semana', { rango: rangoSemana(b.generadaAt) }) : null
          }
        />

        {estado === 'cargando' ? <Esqueleto filas={4} alto={110} /> : null}

        {estado === 'error' ? (
          <Vacio
            icono="cloud-offline-outline"
            tono="rojo"
            titulo={t('profe.errorTitulo')}
            texto={t('educadores.bitacora.error')}
            accion={
              <BotonChunky
                texto={t('educadores.bitacora.reintentar')}
                icono="refresh"
                variante="secundario"
                compacto
                onPress={recargar}
              />
            }
          />
        ) : null}

        {b && resultado ? (
          <>
            {resultado.delServidor ? (
              <Aviso
                icono="cloud-offline-outline"
                tono="neutro"
                texto={t('educadores.bitacora.delServidor')}
              />
            ) : null}

            <Tarjeta style={styles.voz}>
              <CetiAnimation id={animacionDeTono(b.tono)} size={84} />
              <Text style={[styles.vozTexto, { color: colors.text.primary }]}>{vozCeti(t, b)}</Text>
            </Tarjeta>

            {b.estudiantes > 0 ? (
              <View style={styles.tiles}>
                <Cifra
                  icono="people"
                  valor={`${pctActivos}%`}
                  etiqueta={t('educadores.bitacora.activosDe', {
                    activos: b.activosSemana,
                    total: b.estudiantes,
                  })}
                  tono={tonoNivel(pctActivos)}
                />
                <Cifra
                  icono="checkmark-done"
                  valor={String(b.quicesSemana)}
                  etiqueta={t('educadores.bitacora.quices', { count: b.quicesSemana })}
                  tono="azul"
                />
                <Cifra
                  icono="alert-circle"
                  valor={String(b.alertas.length)}
                  etiqueta={t('educadores.bitacora.alertasCorto', { count: b.alertas.length })}
                  tono={b.alertas.length > 0 ? 'naranja' : 'verde'}
                />
              </View>
            ) : null}

            <BotonChunky
              texto={textoPaso(t, b, resultado.destino)}
              icono="arrow-forward"
              onPress={() => router.push(resultado.destino.ruta as Href)}
            />

            {b.estudiantes > 0 ? (
              <Tarjeta style={styles.ahorro}>
                <View style={styles.ahorroFila}>
                  <View style={[styles.ahorroIcono, { backgroundColor: colors.fill.blueSubtle }]}>
                    <Ionicons name="hourglass" size={20} color={colors.system.blue} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.ahorroValor, { color: colors.text.primary }]}>
                      {t('educadores.bitacora.ahorrado', {
                        tiempo: formatoMinutos(b.minutosAhorrados),
                      })}
                    </Text>
                    <Text style={[styles.sub, { color: colors.text.tertiary }]}>
                      {t('educadores.bitacora.estimacion', {
                        quiz: MINUTOS_POR_QUIZ,
                        reporte: MINUTOS_POR_REPORTE,
                      })}
                    </Text>
                  </View>
                </View>
              </Tarjeta>
            ) : null}

            {b.mundoMasDificil ? (
              <Aviso
                icono="planet"
                tono="naranja"
                texto={t('educadores.bitacora.mundoDificil', {
                  mundo: b.mundoMasDificil.nombre,
                  curso: b.mundoMasDificil.cursoNombre,
                  pct: Math.round(b.mundoMasDificil.maestria * 100),
                })}
              />
            ) : null}

            {b.alertas.length > 0 ? (
              <>
                <Seccion
                  texto={t('educadores.bitacora.alertasTitulo', { dias: DIAS_SIN_ENTRAR_ALERTA })}
                />
                <Tarjeta style={{ gap: 0, paddingVertical: 4 }}>
                  {b.alertas.slice(0, ALERTAS_VISIBLES).map((a, i) => (
                    <View
                      key={`${a.cursoId}-${a.nombre}-${i}`}
                      style={[
                        styles.fila,
                        i > 0 && { borderTopWidth: 1, borderTopColor: colors.materials.border },
                      ]}
                    >
                      <Avatar nombre={a.nombre} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text
                          style={[styles.nombre, { color: colors.text.primary }]}
                          numberOfLines={1}
                        >
                          {a.nombre}
                        </Text>
                        <Text
                          style={[styles.sub, { color: colors.text.tertiary }]}
                          numberOfLines={1}
                        >
                          {a.cursoNombre}
                        </Text>
                      </View>
                      <Pill
                        texto={
                          a.diasSinEntrar === null
                            ? t('educadores.bitacora.nuncaEntro')
                            : t('educadores.bitacora.diasSinEntrar', { count: a.diasSinEntrar })
                        }
                        tono={a.diasSinEntrar === null ? 'rojo' : 'naranja'}
                      />
                    </View>
                  ))}
                </Tarjeta>
                {b.alertas.length > ALERTAS_VISIBLES ? (
                  <Text style={[styles.sub, { color: colors.text.tertiary, textAlign: 'center' }]}>
                    {t('educadores.bitacora.alertasMas', {
                      count: b.alertas.length - ALERTAS_VISIBLES,
                    })}
                  </Text>
                ) : null}
              </>
            ) : b.estudiantes > 0 ? (
              <Aviso
                icono="checkmark-circle"
                tono="verde"
                texto={t('educadores.bitacora.sinAlertas')}
              />
            ) : null}

            {resultado.cursos.length > 1 ? (
              <>
                <Seccion texto={t('educadores.bitacora.porClase')} />
                <Tarjeta style={{ gap: 16 }}>
                  {resultado.cursos.map((c) => {
                    const activos = c.curso.estudiantes.filter((e) => e.activo);
                    const semana = activos.filter(
                      (e) =>
                        e.ultimaActividad !== null && e.ultimaActividad >= b.generadaAt - 7 * DIA_MS
                    ).length;
                    const p =
                      activos.length === 0 ? 0 : Math.round((semana / activos.length) * 100);
                    return (
                      <View key={c.id} style={{ gap: 6 }}>
                        <View style={styles.fila2}>
                          <Text
                            style={[styles.nombre, { flex: 1, color: colors.text.primary }]}
                            numberOfLines={1}
                          >
                            {c.nombre}
                          </Text>
                          <Text style={[styles.valor, { color: colors.text.primary }]}>
                            {t('educadores.bitacora.deTotal', {
                              activos: semana,
                              total: activos.length,
                            })}
                          </Text>
                        </View>
                        <GrowBar
                          pct={p}
                          color={paletaTono(colors, tonoNivel(p)).tinta}
                          trackColor={colors.materials.highlight}
                          height={8}
                          dimmed={activos.length === 0}
                        />
                      </View>
                    );
                  })}
                </Tarjeta>
              </>
            ) : null}

            <Text style={[styles.pie, { color: colors.text.tertiary }]}>
              {t('educadores.bitacora.pie')}
            </Text>
          </>
        ) : null}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 14 },
  voz: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vozTexto: { flex: 1, fontSize: 18, lineHeight: 25, fontWeight: '800' },
  tiles: { flexDirection: 'row', gap: 8 },
  ahorro: { gap: 8 },
  ahorroFila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ahorroIcono: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ahorroValor: { fontSize: 18, fontWeight: '900' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  fila2: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nombre: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  valor: { fontSize: 15, fontWeight: '900' },
  pie: { fontSize: 12, lineHeight: 17, fontWeight: '600', textAlign: 'center' },
});
