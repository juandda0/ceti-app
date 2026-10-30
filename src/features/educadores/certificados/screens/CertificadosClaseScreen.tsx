/**
 * Fase 8b — certificados de una clase (plan Piloto o más). El profe elige los
 * mundos que hay que haber conquistado, ve quién cumple y emite los
 * certificados de una vez. Cada uno tiene un código público para verificarlo;
 * desde aquí se descarga en PDF o se revoca.
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
import { compartirPdf } from '@shared/lib/export/guardarArchivo';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useMiPlan } from '@features/educadores/hooks/useMiPlan';
import TarjetaBloqueada from '@features/educadores/retencion/components/TarjetaBloqueada';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { classConfigRepository } from '@features/dashboard/data/classConfigRepository';
import { worldProgressRepository } from '@features/dashboard/data/worldProgressRepository';
import { mundosDeLaClase } from '@features/dashboard/data/cargarFichaEstudiante';
import type { MundoDeLaClase } from '@features/dashboard/data/fichaEstudiante';
import { useNombreCurso } from '@features/dashboard/hooks/useNombreCurso';
import {
  Avatar,
  BotonChunky,
  Chip,
  Encabezado,
  Esqueleto,
  Pill,
  Seccion,
  Tarjeta,
  Vacio,
} from '@features/dashboard/components/profe/kit';
import { faltantes, type CertificadoPublico } from '@/functions/src/educadores/dominio';
import { certificadosRepository, enlaceDeCertificado } from '../data/certificadosRepository';
import { certificadoHtml } from '../data/certificadoHtml';

interface Fila {
  uid: string;
  nombre: string;
  conquistados: Set<string>;
  certificados: CertificadoPublico[];
}

export default function CertificadosClaseScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ cursoId: string; nombre?: string }>();
  const cursoId = params.cursoId ?? '';
  const nombreCurso = useNombreCurso(cursoId, params.nombre);
  const colegioId = useAuthStore((s) => s.colegioId);
  const { puede, cargando: planCargando } = useMiPlan();
  const conCertificados = !planCargando && puede('certificados');

  const [mundos, setMundos] = useState<MundoDeLaClase[]>([]);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!colegioId || !cursoId) return;
    try {
      const [roster, config] = await Promise.all([
        rosterRepository.getRoster(colegioId, cursoId),
        classConfigRepository.get(colegioId, cursoId),
      ]);
      const activos = roster.filter((e) => e.estado === 'activo');
      const lista = await Promise.all(
        activos.map(async (e) => {
          const [progreso, certificados] = await Promise.all([
            worldProgressRepository.getStudentProgress(colegioId, cursoId, e.uid).catch(() => []),
            certificadosRepository.deEstudiante(colegioId, cursoId, e.uid).catch(() => []),
          ]);
          return {
            uid: e.uid,
            nombre: e.nombre || e.email,
            conquistados: new Set(progreso.filter((p) => p.completed).map((p) => p.worldId)),
            certificados,
          };
        })
      );
      const ms = mundosDeLaClase(config);
      setMundos(ms);
      // Por defecto, los mundos que ya conquistó alguien.
      setElegidos((prev) => (prev.length ? prev : ms.filter((m) => lista.some((f) => f.conquistados.has(m.id))).map((m) => m.id)));
      setFilas(lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
    } catch {
      setFilas([]);
    }
  }, [colegioId, cursoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const nombreMundo = useMemo(() => Object.fromEntries(mundos.map((m) => [m.id, m.nombre])), [mundos]);
  const cumplen = (filas ?? []).filter((f) => elegidos.length > 0 && faltantes(f.conquistados, elegidos).length === 0);

  const emitir = async (uids: string[]) => {
    if (!uids.length || !elegidos.length) return;
    setOcupado('emitir');
    try {
      const r = await certificadosRepository.emitir(cursoId, uids, elegidos, nombreMundo);
      showMessage(
        t('diferenciales.certificados.emitidos', { count: r.emitidos.length }),
        r.omitidos.length ? t('diferenciales.certificados.omitidos', { count: r.omitidos.length }) : undefined,
        r.emitidos.length ? 'success' : 'info'
      );
      await cargar();
    } catch (e) {
      showMessage(t('diferenciales.certificados.error'), e instanceof Error ? e.message : undefined, 'error');
    } finally {
      setOcupado(null);
    }
  };

  const descargar = async (c: CertificadoPublico) => {
    setOcupado(c.codigo);
    const ok = await compartirPdf(`certificado-${c.codigo}.pdf`, certificadoHtml(c, enlaceDeCertificado(c.codigo)));
    setOcupado(null);
    if (!ok) showMessage(t('analisis.exportarError'), undefined, 'error');
  };

  const revocar = (c: CertificadoPublico) =>
    confirmAction({
      title: t('diferenciales.certificados.revocarTitulo', { nombre: c.nombre }),
      body: t('diferenciales.certificados.revocarTexto'),
      confirmLabel: t('diferenciales.certificados.revocar'),
      cancelLabel: t('diferenciales.cancelar'),
      destructive: true,
      onConfirm: () => {
        void (async () => {
          setOcupado(c.codigo);
          try {
            await certificadosRepository.revocar(cursoId, c.codigo);
            await cargar();
          } catch (e) {
            showMessage(t('diferenciales.certificados.error'), e instanceof Error ? e.message : undefined, 'error');
          } finally {
            setOcupado(null);
          }
        })();
      },
    });

  return (
    <ScreenWrapper>
      <ContextScrollView contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]} showsVerticalScrollIndicator={false}>
        <Encabezado atras={`/(staff)/curso/${cursoId}`} sobretitulo={t('diferenciales.certificados.sobre')} titulo={nombreCurso} />

        {!planCargando && !conCertificados ? (
          <TarjetaBloqueada
            titulo={t('diferenciales.certificados.bloqueadoTitulo')}
            valor={t('diferenciales.certificados.bloqueadoValor')}
            motivo="certificados"
            icono="ribbon"
          />
        ) : null}

        {conCertificados ? (
          <>
            <Tarjeta style={{ gap: 10 }}>
              <Text style={[st.cuerpo, { color: colors.text.secondary }]}>{t('diferenciales.certificados.intro')}</Text>
              <Seccion texto={t('diferenciales.certificados.mundos')} />
              <View style={st.chips}>
                {mundos.map((m) => (
                  <Chip
                    key={m.id}
                    texto={m.nombre}
                    seleccionado={elegidos.includes(m.id)}
                    onPress={() => setElegidos((xs) => (xs.includes(m.id) ? xs.filter((x) => x !== m.id) : [...xs, m.id]))}
                  />
                ))}
              </View>
              <BotonChunky
                texto={t('diferenciales.certificados.emitirTodos', { count: cumplen.length })}
                icono="ribbon"
                cargando={ocupado === 'emitir'}
                deshabilitado={!cumplen.length || ocupado !== null}
                onPress={() => void emitir(cumplen.map((f) => f.uid))}
              />
              <Text style={[st.nota, { color: colors.text.tertiary }]}>{t('diferenciales.certificados.nota')}</Text>
            </Tarjeta>

            {filas === null ? <Esqueleto filas={4} alto={64} /> : null}
            {filas && filas.length === 0 ? (
              <Vacio icono="people-outline" tono="neutro" titulo={t('diferenciales.grupos.sinEstudiantes')} />
            ) : null}
            {filas?.map((f) => {
              const falta = elegidos.length ? faltantes(f.conquistados, elegidos) : [];
              return (
                <Tarjeta key={f.uid} style={{ gap: 10 }}>
                  <View style={st.fila}>
                    <Avatar nombre={f.nombre} tamano={36} />
                    <Text style={[st.nombre, { color: colors.text.primary }]} numberOfLines={1}>{f.nombre}</Text>
                    {falta.length === 0 && elegidos.length ? (
                      <Pill texto={t('diferenciales.certificados.cumple')} tono="verde" icono="checkmark" />
                    ) : (
                      <Pill texto={t('diferenciales.certificados.faltan', { count: falta.length })} tono="neutro" />
                    )}
                  </View>
                  {f.certificados.map((c) => (
                    <View key={c.codigo} style={[st.cert, { borderColor: colors.materials.border }]}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[st.codigo, { color: colors.text.primary }]}>{c.codigo}</Text>
                        <Text style={[st.nota, { color: colors.text.tertiary }]} numberOfLines={2}>
                          {c.revocadoAt ? t('diferenciales.certificados.revocado') : c.mundos.join(' · ')}
                        </Text>
                      </View>
                      <BotonChunky texto={t('diferenciales.certificados.pdf')} icono="document-outline" variante="secundario" compacto cargando={ocupado === c.codigo} onPress={() => void descargar(c)} />
                      {!c.revocadoAt ? (
                        <BotonChunky texto={t('diferenciales.certificados.revocar')} icono="close" variante="peligro" compacto onPress={() => revocar(c)} />
                      ) : null}
                    </View>
                  ))}
                </Tarjeta>
              );
            })}
          </>
        ) : null}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 14 },
  cuerpo: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
  nota: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nombre: { flex: 1, fontSize: 16, fontWeight: '900' },
  cert: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingTop: 10, flexWrap: 'wrap' },
  codigo: { fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
});
