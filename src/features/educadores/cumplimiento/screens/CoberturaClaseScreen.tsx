/**
 * Informe de cobertura de UNA clase (Fase 7, `informeCobertura`, Piloto o más):
 * qué ámbitos, competencias y desempeños del MEN trabaja la clase, con PDF y
 * Excel. Es la puerta de entrada al plan Colegio: invita a pedir el de toda la
 * institución, salvo que la entidad ya tenga licencia.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { construirXlsx } from '@shared/lib/export/xlsx';
import { MIME_XLSX, compartirPdf, guardarArchivo } from '@shared/lib/export/guardarArchivo';
import { useMiPlan } from '@features/educadores/hooks/useMiPlan';
import TarjetaBloqueada from '@features/educadores/retencion/components/TarjetaBloqueada';
import { useNombreCurso } from '@features/dashboard/hooks/useNombreCurso';
import { BotonChunky, Chip, Encabezado, Esqueleto, Pill, Tarjeta, Vacio } from '@features/dashboard/components/profe/kit';
import { DIA_MS, fechaBogota, inicioDiaBogota, type PanelEntidad } from '@/functions/src/educadores/dominio';
import CoberturaCurricular from '@features/educadores/entidad/components/CoberturaCurricular';
import { useEvaluacion } from '@features/educadores/entidad/hooks/useEvaluacion';
import { useMiEntidad } from '@features/educadores/entidad/hooks/useMiEntidad';
import { hojasInformeCobertura, informeCoberturaHtml, nombrePeriodo } from '@features/educadores/entidad/data/informeCobertura';
import { cumplimientoRepository } from '../data/cumplimientoRepository';

export default function CoberturaClaseScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cursoId = '' } = useLocalSearchParams<{ cursoId: string }>();
  const nombreCurso = useNombreCurso(cursoId, undefined);
  const { puede, cargando: planCargando } = useMiPlan();
  const conInforme = !planCargando && puede('informeCobertura');
  const { vista, conLicencia } = useMiEntidad();
  const evaluacion = useEvaluacion();
  const anio = Number(fechaBogota(Date.now()).slice(0, 4));
  const periodos = evaluacion.periodosDe(anio);

  const [periodo, setPeriodo] = useState<number | null>(null);
  const [panel, setPanel] = useState<PanelEntidad | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [exportando, setExportando] = useState<'pdf' | 'xlsx' | null>(null);

  const cargar = useCallback(async () => {
    if (!cursoId || !conInforme) return;
    setEstado('cargando');
    try {
      const p = periodos.find((x) => x.numero === periodo) ?? null;
      setPanel(
        await cumplimientoRepository.coberturaClase(
          cursoId,
          p ? { desde: inicioDiaBogota(p.desde), hasta: inicioDiaBogota(p.hasta) + DIA_MS - 1 } : undefined
        )
      );
      setEstado('listo');
    } catch {
      setEstado('error');
    }
    // periodos cambia de identidad en cada render: basta con su número y la escala.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursoId, conInforme, periodo, evaluacion.config]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const exportar = async (formato: 'pdf' | 'xlsx') => {
    if (!panel) return;
    setExportando(formato);
    try {
      const ctx = {
        entidad: vista?.entidad?.nombre ?? '',
        tipo: t('cumplimiento.informe.tipoClase'),
        tipoId: vista?.entidad?.tipo ?? null,
        clase: nombreCurso ?? '',
        periodo: nombrePeriodo(periodos.find((x) => x.numero === periodo) ?? null),
        generado: Date.now(),
      };
      const archivo = `cobertura-eef-${(nombreCurso || 'clase').replace(/[^\p{L}\p{N}]+/gu, '-')}`;
      const ok =
        formato === 'pdf'
          ? await compartirPdf(`${archivo}.pdf`, informeCoberturaHtml(panel, ctx))
          : await guardarArchivo(`${archivo}.xlsx`, construirXlsx(hojasInformeCobertura(panel, ctx)), MIME_XLSX);
      if (!ok) showMessage(t('entidad.cobertura.exportarError'), undefined, 'error');
    } catch (e) {
      showMessage(t('entidad.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setExportando(null);
    }
  };

  return (
    <ScreenWrapper>
      <ContextScrollView contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]} showsVerticalScrollIndicator={false}>
        <Encabezado
          atras={`/(staff)/curso/${cursoId}`}
          sobretitulo={t('cumplimiento.informe.sobre')}
          titulo={t('cumplimiento.informe.titulo')}
          subtitulo={nombreCurso ?? undefined}
        />

        {!planCargando && !conInforme ? (
          <TarjetaBloqueada
            titulo={t('cumplimiento.informe.bloqueadoTitulo')}
            valor={t('cumplimiento.informe.bloqueadoValor')}
            motivo="informeCobertura"
            icono="ribbon-outline"
          />
        ) : null}

        {conInforme ? (
          <View style={st.chips}>
            {periodos.map((p) => (
              <Chip key={p.numero} texto={p.nombre} seleccionado={periodo === p.numero} onPress={() => setPeriodo(p.numero)} />
            ))}
            <Chip texto={t('entidad.cobertura.todo')} seleccionado={periodo === null} onPress={() => setPeriodo(null)} />
          </View>
        ) : null}

        {conInforme && estado === 'cargando' ? <Esqueleto filas={3} alto={120} /> : null}
        {conInforme && estado === 'error' ? (
          <Vacio icono="cloud-offline-outline" tono="rojo" titulo={t('profe.errorTitulo')} texto={t('dashboard.error')} />
        ) : null}

        {conInforme && estado === 'listo' && panel ? (
          <>
            <CoberturaCurricular
              cobertura={panel.cobertura}
              ambitosCubiertos={panel.ambitosCubiertos.length}
              fuente={t('cumplimiento.informe.fuente')}
              deUnaClase
            />
            <View style={st.fila}>
              <BotonChunky style={{ flex: 1 }} texto={t('entidad.cobertura.pdf')} icono="document-text" compacto cargando={exportando === 'pdf'} deshabilitado={exportando !== null} onPress={() => void exportar('pdf')} />
              <BotonChunky style={{ flex: 1 }} texto={t('entidad.cobertura.xlsx')} icono="grid" variante="secundario" compacto cargando={exportando === 'xlsx'} deshabilitado={exportando !== null} onPress={() => void exportar('xlsx')} />
            </View>
            {!conLicencia ? (
              <Tarjeta style={{ gap: 8 }}>
                <Pill tono="morado" icono="business" texto={t('cumplimiento.informe.colegioPill')} />
                <Text style={[st.titulo, { color: colors.text.primary }]}>{t('cumplimiento.informe.colegioTitulo')}</Text>
                <Text style={[st.sub, { color: colors.text.secondary }]}>{t('cumplimiento.informe.colegioTexto')}</Text>
                <BotonChunky
                  texto={t('cumplimiento.informe.colegioCta')}
                  icono="business"
                  variante="secundario"
                  compacto
                  onPress={() => router.push('/(staff)/colegio' as Href)}
                />
              </Tarjeta>
            ) : null}
          </>
        ) : null}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fila: { flexDirection: 'row', gap: 10 },
  titulo: { fontSize: 17, fontWeight: '900' },
  sub: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
});
