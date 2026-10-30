/**
 * Biblioteca de la entidad (Fase 6): mundos que publicaron sus profes. Cada
 * profe copia uno a su clase (queda en borrador hasta que lo active) o publica
 * uno de sus mundos propios. El autor o un admin lo retiran.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { rosterRepository, type CursoWithId } from '@features/dashboard/data/rosterRepository';
import { classConfigRepository } from '@features/dashboard/data/classConfigRepository';
import { competenciaLabel } from '@features/learning/data/competencias';
import { FadeIn } from '@features/savings/charts/ChartParts';
import {
  BotonChunky,
  Chip,
  Encabezado,
  Esqueleto,
  Pill,
  Seccion,
  Tarjeta,
  Vacio,
} from '@features/dashboard/components/profe/kit';
import { entidadRepository, type MundoBiblioteca } from '../data/entidadRepository';
import { useMiEntidad } from '../hooks/useMiEntidad';
import { fechaCorta } from '../components/EntidadTarjeta';

interface MundoMio {
  cursoId: string;
  curso: string;
  worldId: string;
  nombre: string;
}

export default function BibliotecaEntidadScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const uid = useAuthStore((s) => s.firebaseUid);
  const colegioId = useAuthStore((s) => s.colegioId);
  const { vista, conLicencia, soyAdmin, cargando: cargandoEntidad } = useMiEntidad();
  const [mundos, setMundos] = useState<MundoBiblioteca[]>([]);
  const [clases, setClases] = useState<CursoWithId[]>([]);
  const [mios, setMios] = useState<MundoMio[]>([]);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!colegioId || !uid) return;
    try {
      const [lista, cursos] = await Promise.all([
        entidadRepository.biblioteca(colegioId),
        rosterRepository.getCursosByProfesor(colegioId, uid),
      ]);
      const configs = await Promise.all(cursos.map((c) => classConfigRepository.get(colegioId, c.id).catch(() => null)));
      setMundos(lista);
      setClases(cursos);
      setMios(
        cursos.flatMap((c, i) =>
          (configs[i]?.mundos ?? [])
            .filter((m) => m.worldId.startsWith('cw_'))
            .map((m) => ({ cursoId: c.id, curso: c.nombre, worldId: m.worldId, nombre: m.nombre ?? m.worldId }))
        )
      );
      setEstado('listo');
    } catch {
      setEstado('error');
    }
  }, [colegioId, uid]);

  useEffect(() => {
    if (conLicencia) void cargar();
  }, [conLicencia, cargar]);

  const accion = async (clave: string, f: () => Promise<unknown>, ok: string) => {
    setOcupado(clave);
    try {
      await f();
      showMessage(ok, undefined, 'success');
      await cargar();
    } catch (e) {
      showMessage(t('entidad.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setOcupado(null);
    }
  };

  const publicados = new Set(mundos.map((m) => `${m.origen.cursoId}_${m.origen.worldId}`));

  return (
    <ScreenWrapper>
      <ContextScrollView contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]} showsVerticalScrollIndicator={false}>
        <Encabezado
          atras="/(staff)/colegio"
          sobretitulo={vista?.entidad?.nombre ?? t('entidad.sobre')}
          titulo={t('entidad.biblioteca.titulo')}
          subtitulo={t('entidad.biblioteca.subtitulo')}
        />
        {cargandoEntidad || (conLicencia && estado === 'cargando') ? <Esqueleto filas={3} alto={96} /> : null}
        {!cargandoEntidad && !conLicencia ? (
          <Vacio icono="library" titulo={t('entidad.biblioteca.sinPlan')} texto={t('entidad.biblioteca.sinPlanTexto')} />
        ) : null}
        {estado === 'error' ? (
          <Vacio icono="cloud-offline-outline" tono="rojo" titulo={t('profe.errorTitulo')} texto={t('entidad.biblioteca.error')} />
        ) : null}
        {conLicencia && estado === 'listo' ? (
          <FadeIn>
            <View style={{ gap: 14 }}>
              {mundos.length === 0 ? (
                <Vacio icono="library-outline" titulo={t('entidad.biblioteca.vacio')} texto={t('entidad.biblioteca.vacioTexto')} />
              ) : null}
              {mundos.map((m) => (
                <Tarjeta key={m.id} style={{ gap: 8 }}>
                  <View style={st.fila}>
                    {m.competencia ? <Pill tono="morado" texto={competenciaLabel(m.competencia)} /> : null}
                    {m.grado ? <Pill tono="neutro" texto={`${m.grado}°`} /> : null}
                    {m.usos > 0 ? <Pill tono="verde" texto={t('entidad.biblioteca.usos', { count: m.usos })} /> : null}
                  </View>
                  <Text style={[st.titulo, { color: colors.text.primary }]}>{m.titulo}</Text>
                  {m.descripcion ? <Text style={[st.texto, { color: colors.text.secondary }]}>{m.descripcion}</Text> : null}
                  <Text style={[st.sub, { color: colors.text.tertiary }]}>
                    {[
                      m.autorNombre,
                      m.lecciones > 0 ? t('entidad.biblioteca.lecciones', { count: m.lecciones }) : null,
                      t('entidad.biblioteca.preguntas', { count: m.preguntas }),
                      fechaCorta(m.publicadoAt),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {abierto === m.id ? (
                    <View style={{ gap: 8 }}>
                      <Text style={[st.sub, { color: colors.text.secondary }]}>{t('entidad.biblioteca.usarEn')}</Text>
                      {clases.length === 0 ? (
                        <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('entidad.biblioteca.sinClases')}</Text>
                      ) : null}
                      <View style={st.chips}>
                        {clases.map((c) => (
                          <Chip
                            key={c.id}
                            texto={ocupado === `${m.id}:${c.id}` ? t('entidad.guardando') : c.nombre}
                            icono="copy-outline"
                            seleccionado={false}
                            onPress={() =>
                              void accion(`${m.id}:${c.id}`, () => entidadRepository.usar(m.id, c.id), t('entidad.biblioteca.copiado', { clase: c.nombre }))
                            }
                          />
                        ))}
                      </View>
                      <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('entidad.biblioteca.copiaAyuda')}</Text>
                    </View>
                  ) : (
                    <BotonChunky texto={t('entidad.biblioteca.usar')} icono="download-outline" variante="secundario" compacto onPress={() => setAbierto(m.id)} />
                  )}
                  {m.autorUid === uid || soyAdmin ? (
                    <Chip
                      texto={t('entidad.biblioteca.retirar')}
                      icono="trash-outline"
                      seleccionado={false}
                      onPress={() => void accion(`r:${m.id}`, () => entidadRepository.retirar(m.id), t('entidad.biblioteca.retirado'))}
                    />
                  ) : null}
                </Tarjeta>
              ))}

              <Seccion texto={t('entidad.biblioteca.publicar')} />
              {mios.length === 0 ? (
                <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('entidad.biblioteca.sinMios')}</Text>
              ) : (
                <Tarjeta style={{ gap: 6 }}>
                  {mios.map((m) => {
                    const clave = `${m.cursoId}_${m.worldId}`;
                    return (
                      <View key={clave} style={[st.fila, { paddingVertical: 4 }]}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[st.nombre, { color: colors.text.primary }]} numberOfLines={1}>
                            {m.nombre}
                          </Text>
                          <Text style={[st.sub, { color: colors.text.tertiary }]}>{m.curso}</Text>
                        </View>
                        <Chip
                          texto={
                            ocupado === clave
                              ? t('entidad.guardando')
                              : publicados.has(clave)
                                ? t('entidad.biblioteca.actualizar')
                                : t('entidad.biblioteca.compartir')
                          }
                          icono="share-outline"
                          seleccionado={publicados.has(clave)}
                          onPress={() => void accion(clave, () => entidadRepository.publicar(m.cursoId, m.worldId), t('entidad.biblioteca.publicado', { mundo: m.nombre }))}
                        />
                      </View>
                    );
                  })}
                </Tarjeta>
              )}
            </View>
          </FadeIn>
        ) : null}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 80, gap: 14 },
  fila: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  titulo: { fontSize: 18, lineHeight: 23, fontWeight: '900' },
  texto: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  nombre: { fontSize: 15, fontWeight: '800' },
  sub: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
