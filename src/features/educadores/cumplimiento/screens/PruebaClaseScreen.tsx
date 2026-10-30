/**
 * Prueba de entrada y salida de una clase (Fase 7, `prePostTest`): el profe
 * abre la entrada al empezar y la salida al terminar, ve cuántos la
 * respondieron y el resultado de la clase (promedios solo con 5 o más
 * estudiantes con las dos pruebas) y el de cada estudiante.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useMiPlan } from '@features/educadores/hooks/useMiPlan';
import TarjetaBloqueada from '@features/educadores/retencion/components/TarjetaBloqueada';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { useNombreCurso } from '@features/dashboard/hooks/useNombreCurso';
import {
  BotonChunky,
  Cifra,
  Encabezado,
  Esqueleto,
  Pill,
  Seccion,
  Tarjeta,
  Vacio,
} from '@features/dashboard/components/profe/kit';
import {
  MIN_GRUPO,
  faseAbierta,
  impactoDe,
  nombreAmbitoMen,
  sumasImpacto,
  type ConfigPrueba,
  type FasePrueba,
} from '@/functions/src/educadores/dominio';
import { cumplimientoRepository, type ResultadoEstudiante } from '../data/cumplimientoRepository';

const pct = (x: number) => `${Math.round(x * 100)} %`;
const fecha = (ms: number) => new Date(ms).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

export default function PruebaClaseScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const colegioId = useAuthStore((s) => s.colegioId) ?? '';
  const { cursoId = '' } = useLocalSearchParams<{ cursoId: string }>();
  const nombreCurso = useNombreCurso(cursoId, undefined);
  const { puede, cargando: planCargando } = useMiPlan();
  const conPrueba = !planCargando && puede('prePostTest');

  const [config, setConfig] = useState<ConfigPrueba | null>(null);
  const [resultados, setResultados] = useState<ResultadoEstudiante[]>([]);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [cambiando, setCambiando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!colegioId || !cursoId || !conPrueba) return;
    setEstado('cargando');
    try {
      const [cfg, roster] = await Promise.all([
        cumplimientoRepository.configPrueba(colegioId, cursoId),
        rosterRepository.getRoster(colegioId, cursoId),
      ]);
      const activos = roster
        .filter((e) => e.estado === 'activo')
        .map((e) => ({ uid: e.uid, nombre: e.nombre || t('cumplimiento.prueba.sinNombre') }));
      setConfig(cfg);
      setResultados(await cumplimientoRepository.resultadosClase(colegioId, cursoId, activos));
      setEstado('listo');
    } catch {
      setEstado('error');
    }
  }, [colegioId, cursoId, conPrueba, t]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const impacto = useMemo(
    () => impactoDe(sumasImpacto(resultados, new Set(resultados.map((r) => r.uid))), MIN_GRUPO),
    [resultados]
  );

  const cambiar = (fase: FasePrueba, abrir: boolean) => {
    confirmAction({
      title: t(`cumplimiento.prueba.${abrir ? 'abrir' : 'cerrar'}_${fase}`),
      body: t(`cumplimiento.prueba.${abrir ? 'abrirTexto' : 'cerrarTexto'}_${fase}`),
      confirmLabel: t(`cumplimiento.prueba.${abrir ? 'abrirCta' : 'cerrarCta'}`),
      cancelLabel: t('admin.cancel'),
      onConfirm: () => {
        setCambiando(`${fase}${abrir}`);
        cumplimientoRepository
          .cambiarPrueba(cursoId, fase, abrir)
          .then((r) => setConfig(r.config))
          .catch((e) => showMessage(t('entidad.error'), e instanceof Error ? e.message : String(e), 'error'))
          .finally(() => setCambiando(null));
      },
    });
  };

  const fila = (fase: FasePrueba, numero: number) => {
    const f = config?.[fase];
    const abierta = faseAbierta(config, fase);
    const hechas = resultados.filter((r) => r[fase]).length;
    const sub = !f
      ? t('cumplimiento.prueba.sinAbrir')
      : abierta
        ? t('cumplimiento.prueba.abiertaDesde', { fecha: fecha(f.abiertaAt), n: hechas, total: resultados.length })
        : t('cumplimiento.prueba.cerradaEl', { fecha: fecha(f.cerradaAt ?? f.abiertaAt), n: hechas, total: resultados.length });
    const puedeAbrir = !f && (fase === 'pre' || !!config?.pre);
    return (
      <View style={{ gap: 10 }}>
        <View style={st.fila}>
          <View style={[st.numero, { backgroundColor: abierta ? colors.fill.orangeSubtle : colors.materials.highlight }]}>
            <Text style={[st.numeroTxt, { color: colors.text.primary }]}>{numero}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[st.nombre, { color: colors.text.primary }]}>{t(`cumplimiento.prueba.fase_${fase}`)}</Text>
            <Text style={[st.sub, { color: colors.text.tertiary }]}>{sub}</Text>
          </View>
          {f ? (
            <Pill tono={abierta ? 'naranja' : 'neutro'} texto={t(abierta ? 'cumplimiento.prueba.abierta' : 'cumplimiento.prueba.cerrada')} />
          ) : null}
        </View>
        {puedeAbrir || abierta ? (
          <BotonChunky
            texto={t(`cumplimiento.prueba.${abierta ? 'cerrar' : 'abrir'}_${fase}`)}
            icono={abierta ? 'stop-circle-outline' : 'play-circle-outline'}
            variante={abierta ? 'secundario' : 'primario'}
            compacto
            cargando={cambiando === `${fase}${!abierta}`}
            onPress={() => cambiar(fase, !abierta)}
          />
        ) : null}
      </View>
    );
  };

  return (
    <ScreenWrapper>
      <ContextScrollView contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]} showsVerticalScrollIndicator={false}>
        <Encabezado
          atras={`/(staff)/curso/${cursoId}`}
          sobretitulo={t('cumplimiento.prueba.sobre')}
          titulo={t('cumplimiento.prueba.titulo')}
          subtitulo={nombreCurso ? `${nombreCurso} · ${t('cumplimiento.prueba.subtitulo')}` : t('cumplimiento.prueba.subtitulo')}
        />

        {!planCargando && !conPrueba ? (
          <TarjetaBloqueada
            titulo={t('cumplimiento.prueba.bloqueadoTitulo')}
            valor={t('cumplimiento.prueba.bloqueadoValor')}
            motivo="prePostTest"
            icono="clipboard-outline"
          />
        ) : null}

        {conPrueba && estado === 'cargando' ? <Esqueleto filas={3} alto={96} /> : null}
        {conPrueba && estado === 'error' ? (
          <Vacio icono="cloud-offline-outline" tono="rojo" titulo={t('profe.errorTitulo')} texto={t('dashboard.error')} />
        ) : null}

        {conPrueba && estado === 'listo' ? (
          <>
            <Tarjeta style={{ gap: 14 }}>
              {fila('pre', 1)}
              <View style={[st.linea, { backgroundColor: colors.materials.border }]} />
              {fila('post', 2)}
            </Tarjeta>

            <Seccion texto={t('cumplimiento.prueba.resultado', { count: impacto.pares })} />
            {impacto.pares === 0 ? (
              <Vacio icono="hourglass-outline" titulo={t('cumplimiento.prueba.sinParesTitulo')} texto={t('cumplimiento.prueba.sinParesTexto')} />
            ) : (
              <Tarjeta style={{ gap: 12 }}>
                <View style={st.cifras}>
                  <Cifra icono="log-in-outline" valor={impacto.pre == null ? '—' : pct(impacto.pre)} etiqueta={t('cumplimiento.prueba.fase_pre')} tono="neutro" />
                  <Cifra icono="log-out-outline" valor={impacto.post == null ? '—' : pct(impacto.post)} etiqueta={t('cumplimiento.prueba.fase_post')} tono="neutro" />
                  <Cifra
                    icono="trending-up"
                    valor={impacto.cambio == null ? '—' : `${impacto.cambio >= 0 ? '+' : ''}${Math.round(impacto.cambio * 100)}`}
                    etiqueta={t('cumplimiento.prueba.puntos')}
                    tono={impacto.cambio != null && impacto.cambio >= 0 ? 'verde' : 'naranja'}
                  />
                </View>
                {impacto.mejoran == null ? (
                  <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('cumplimiento.prueba.pocos', { min: MIN_GRUPO })}</Text>
                ) : (
                  <Text style={[st.sub, { color: colors.text.secondary }]}>
                    {t('cumplimiento.prueba.mejoran', { n: Math.round(impacto.mejoran * impacto.pares), total: impacto.pares })}
                  </Text>
                )}
                {impacto.porAmbito.map((a) => (
                  <View key={a.ambito} style={st.fila}>
                    <Text style={[st.sub, { flex: 1, color: colors.text.primary }]}>{nombreAmbitoMen(a.ambito)}</Text>
                    <Text style={[st.sub, { color: colors.text.secondary }]}>
                      {a.pre == null || a.post == null ? t('entidad.cobertura.est', { count: a.n }) : `${pct(a.pre)} → ${pct(a.post)}`}
                    </Text>
                  </View>
                ))}
              </Tarjeta>
            )}

            {resultados.some((r) => r.pre || r.post) ? (
              <>
                <Seccion texto={t('cumplimiento.prueba.porEstudiante')} />
                <Tarjeta style={{ gap: 10 }}>
                  {resultados
                    .filter((r) => r.pre || r.post)
                    .map((r) => (
                      <View key={r.uid} style={st.fila}>
                        <Text style={[st.sub, { flex: 1, color: colors.text.primary }]} numberOfLines={1}>
                          {r.nombre}
                        </Text>
                        <Text style={[st.sub, { color: colors.text.secondary }]}>
                          {`${r.pre ? `${r.pre.score}/${r.pre.total}` : '—'} → ${r.post ? `${r.post.score}/${r.post.total}` : '—'}`}
                        </Text>
                      </View>
                    ))}
                </Tarjeta>
              </>
            ) : null}
            <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('cumplimiento.prueba.nota')}</Text>
          </>
        ) : null}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 14 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  numero: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  numeroTxt: { fontSize: 16, fontWeight: '900' },
  nombre: { fontSize: 16, fontWeight: '900' },
  sub: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  linea: { height: 1 },
  cifras: { flexDirection: 'row', gap: 8 },
});
