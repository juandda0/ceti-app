/**
 * Fase 7 — lo que el panel de la entidad suma como evidencia: el impacto de la
 * prueba de entrada y salida, el borrador del proyecto pedagógico para el PEI
 * (no en universidades: las orientaciones son para la básica y la media) y los
 * cierres de periodo (copia fija del informe, con su huella).
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import { construirXlsx } from '@shared/lib/export/xlsx';
import { MIME_XLSX, compartirPdf, guardarArchivo } from '@shared/lib/export/guardarArchivo';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { BotonChunky, Cifra, Seccion, Tarjeta } from '@features/dashboard/components/profe/kit';
import {
  MIN_GRUPO,
  fechaBogota,
  nombreAmbitoMen,
  type Impacto,
  type PanelEntidad,
  type PeriodoConNombre,
} from '@/functions/src/educadores/dominio';
import { cumplimientoRepository, type CierrePeriodo } from '@features/educadores/cumplimiento/data/cumplimientoRepository';
import { hojasInformeCobertura, informeCoberturaHtml, nombrePeriodo } from '../data/informeCobertura';
import { proyectoPeiHtml } from '../data/proyectoPei';

const pct = (x: number | null) => (x == null ? '—' : `${Math.round(x * 100)} %`);
const archivoDe = (s: string) => (s || 'entidad').replace(/[^\p{L}\p{N}]+/gu, '-');

export function ImpactoEntidad({ panel }: { panel: PanelEntidad }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const imp = panel.impacto;
  const total: Impacto | undefined = imp?.total;
  return (
    <>
      <Seccion texto={t('cumplimiento.panel.impacto')} />
      <Tarjeta style={{ gap: 10 }}>
        {!total || total.conEntrada === 0 ? (
          <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('cumplimiento.panel.sinPrueba')}</Text>
        ) : (
          <>
            <View style={st.cifras}>
              <Cifra icono="log-in-outline" valor={pct(total.pre)} etiqueta={t('cumplimiento.prueba.fase_pre')} tono="neutro" />
              <Cifra icono="log-out-outline" valor={pct(total.post)} etiqueta={t('cumplimiento.prueba.fase_post')} tono="neutro" />
              <Cifra
                icono="trending-up"
                valor={total.cambio == null ? '—' : `${total.cambio >= 0 ? '+' : ''}${Math.round(total.cambio * 100)}`}
                etiqueta={t('cumplimiento.prueba.puntos')}
                tono={total.cambio != null && total.cambio >= 0 ? 'verde' : 'naranja'}
              />
            </View>
            <Text style={[st.sub, { color: colors.text.secondary }]}>
              {total.mejoran == null
                ? t('cumplimiento.prueba.pocos', { min: MIN_GRUPO })
                : t('cumplimiento.panel.conLasDos', { count: total.pares, pct: pct(total.mejoran) })}
            </Text>
            {imp!.grupos.map((g) => (
              <View key={g.clave} style={st.fila}>
                <Text style={[st.sub, { flex: 1, color: colors.text.primary }]}>{g.etiqueta}</Text>
                <Text style={[st.sub, { color: g.pre == null ? colors.text.quaternary : colors.text.secondary }]}>
                  {g.pre == null
                    ? t('cumplimiento.panel.pocosGrupo', { count: g.pares })
                    : `${pct(g.pre)} → ${pct(g.post)} · ${t('entidad.cobertura.est', { count: g.pares })}`}
                </Text>
              </View>
            ))}
            {total.porAmbito.filter((a) => a.pre != null).length ? (
              <Text style={[st.sub, { color: colors.text.tertiary }]}>
                {total.porAmbito
                  .filter((a) => a.pre != null)
                  .map((a) => `${nombreAmbitoMen(a.ambito)}: ${pct(a.pre)} → ${pct(a.post)}`)
                  .join(' · ')}
              </Text>
            ) : null}
          </>
        )}
      </Tarjeta>
    </>
  );
}

export function PeiYCierres({
  panel,
  entidad,
  tipoId,
  tipoNombre,
  periodos,
  anio,
}: {
  panel: PanelEntidad;
  entidad: string;
  tipoId: string | null;
  tipoNombre: string;
  periodos: PeriodoConNombre[];
  anio: number;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const colegioId = useAuthStore((s) => s.colegioId);
  const [cierres, setCierres] = useState<CierrePeriodo[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!colegioId) return;
    try {
      setCierres(await cumplimientoRepository.cierres(colegioId));
    } catch {
      setCierres([]);
    }
  }, [colegioId]);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const pei = async (formato: 'doc' | 'pdf') => {
    setOcupado(`pei-${formato}`);
    try {
      const html = proyectoPeiHtml(panel, { entidad, tipoId, anio, periodos, generado: Date.now() });
      const nombre = `proyecto-eef-${archivoDe(entidad)}`;
      const ok =
        formato === 'pdf'
          ? await compartirPdf(`${nombre}.pdf`, html)
          : await guardarArchivo(`${nombre}.doc`, html, 'application/msword');
      if (!ok) showMessage(t('entidad.cobertura.exportarError'), undefined, 'error');
    } finally {
      setOcupado(null);
    }
  };

  const descargar = async (c: CierrePeriodo, formato: 'pdf' | 'xlsx') => {
    setOcupado(`${c.id}-${formato}`);
    try {
      const ctx = {
        entidad: c.entidad.nombre,
        tipo: tipoNombre,
        tipoId: c.entidad.tipo,
        periodo: nombrePeriodo(c.periodo),
        generado: c.cerradoAt,
        sello: { cerradoAt: c.cerradoAt, cerradoPorNombre: c.cerradoPorNombre, huella: c.huella },
      };
      const nombre = `cierre-${c.id}-${archivoDe(c.entidad.nombre)}`;
      const ok =
        formato === 'pdf'
          ? await compartirPdf(`${nombre}.pdf`, informeCoberturaHtml(c.panel, ctx))
          : await guardarArchivo(`${nombre}.xlsx`, construirXlsx(hojasInformeCobertura(c.panel, ctx)), MIME_XLSX);
      if (!ok) showMessage(t('entidad.cobertura.exportarError'), undefined, 'error');
    } finally {
      setOcupado(null);
    }
  };

  const cerrar = (p: PeriodoConNombre) =>
    confirmAction({
      title: t('cumplimiento.cierre.confirmarTitulo', { periodo: p.nombre }),
      body: t('cumplimiento.cierre.confirmarTexto'),
      confirmLabel: t('cumplimiento.cierre.cerrar'),
      cancelLabel: t('admin.cancel'),
      onConfirm: () => {
        setOcupado(`cerrar-${p.numero}`);
        cumplimientoRepository
          .cerrarPeriodo(anio, p.numero)
          .then(() => cargar())
          .then(() => showMessage(t('cumplimiento.cierre.listo', { periodo: p.nombre }), undefined, 'success'))
          .catch((e) => showMessage(t('entidad.error'), e instanceof Error ? e.message : String(e), 'error'))
          .finally(() => setOcupado(null));
      },
    });

  const hoy = fechaBogota(Date.now());
  const cerradoDe = (p: PeriodoConNombre) => cierres.find((c) => c.anio === anio && c.periodo.numero === p.numero);
  // Solo los periodos que ya terminaron se pueden cerrar.
  const terminados = periodos.filter((p) => p.hasta < hoy);

  return (
    <>
      {tipoId !== 'universidad' ? (
        <>
          <Seccion texto={t('cumplimiento.pei.titulo')} />
          <Tarjeta style={{ gap: 10 }}>
            <Text style={[st.sub, { color: colors.text.secondary }]}>{t('cumplimiento.pei.texto')}</Text>
            <View style={st.fila}>
              <BotonChunky style={{ flex: 1 }} texto={t('cumplimiento.pei.word')} icono="document-outline" compacto cargando={ocupado === 'pei-doc'} deshabilitado={ocupado !== null} onPress={() => void pei('doc')} />
              <BotonChunky style={{ flex: 1 }} texto={t('entidad.cobertura.pdf')} icono="document-text" variante="secundario" compacto cargando={ocupado === 'pei-pdf'} deshabilitado={ocupado !== null} onPress={() => void pei('pdf')} />
            </View>
          </Tarjeta>
        </>
      ) : null}

      <Seccion texto={t('cumplimiento.cierre.titulo')} />
      <Tarjeta style={{ gap: 12 }}>
        {cierres.map((c) => (
          <View key={c.id} style={st.fila}>
            <View style={{ flex: 1 }}>
              <Text style={[st.nombre, { color: colors.text.primary }]}>{`${c.periodo.nombre} ${c.anio}`}</Text>
              <Text style={[st.sub, { color: colors.text.tertiary }]}>
                {t('cumplimiento.cierre.cerradoPor', {
                  fecha: new Date(c.cerradoAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
                  nombre: c.cerradoPorNombre,
                  huella: `${c.huella.slice(0, 4)}…${c.huella.slice(-4)}`,
                })}
              </Text>
            </View>
            <BotonChunky texto={t('entidad.cobertura.pdf')} variante="secundario" compacto cargando={ocupado === `${c.id}-pdf`} deshabilitado={ocupado !== null} onPress={() => void descargar(c, 'pdf')} />
            <BotonChunky texto={t('entidad.cobertura.xlsx')} variante="secundario" compacto cargando={ocupado === `${c.id}-xlsx`} deshabilitado={ocupado !== null} onPress={() => void descargar(c, 'xlsx')} />
          </View>
        ))}
        {terminados
          .filter((p) => !cerradoDe(p))
          .map((p) => (
            <BotonChunky
              key={p.numero}
              texto={t('cumplimiento.cierre.cerrarPeriodo', { periodo: p.nombre })}
              icono="lock-closed-outline"
              variante="secundario"
              compacto
              cargando={ocupado === `cerrar-${p.numero}`}
              deshabilitado={ocupado !== null}
              onPress={() => cerrar(p)}
            />
          ))}
        {cierres.length === 0 && terminados.length === 0 ? (
          <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('cumplimiento.cierre.ninguno')}</Text>
        ) : null}
        <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('cumplimiento.cierre.nota')}</Text>
      </Tarjeta>
    </>
  );
}

const st = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cifras: { flexDirection: 'row', gap: 8 },
  nombre: { fontSize: 15, fontWeight: '900' },
  sub: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
