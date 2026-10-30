/**
 * Fase 9 — las tareas abiertas del espacio de clase abierto, para el
 * estudiante (`/(app)/tareas-abiertas`, `?id=` abre una). Responde en texto,
 * puede corregir hasta que su profe califique, y ve la rúbrica, su nota y el
 * comentario.
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
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { MAX_RESPUESTA } from '@/functions/src/educadores/dominio';
import { BotonChunky, Campo, Encabezado, Esqueleto, Pill, Seccion, Tarjeta, Vacio, tapsConTeclado } from '@features/dashboard/components/profe/kit';
import Rubrica from '../components/Rubrica';
import { tareasAbiertasRepository, type EntregaGuardada, type TareaConId } from '../data/tareasAbiertasRepository';

const fecha = (ms: number) => new Date(ms).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
const nota = (n: number) => n.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function TareasAbiertasEstudianteScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const uid = useAuthStore((s) => s.firebaseUid);
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [tareas, setTareas] = useState<TareaConId[] | null>(null);
  const [mias, setMias] = useState<Record<string, EntregaGuardada | null>>({});
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    if (!uid || !colegioId || !cursoId) return;
    const lista = await tareasAbiertasRepository.listar(colegioId, cursoId).catch(() => []);
    const entregas = await Promise.all(lista.map((x) => tareasAbiertasRepository.miEntrega(colegioId, cursoId, x.id, uid).catch(() => null)));
    setTareas(lista);
    setMias(Object.fromEntries(lista.map((x, i) => [x.id, entregas[i]])));
  }, [uid, colegioId, cursoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const tarea = id ? tareas?.find((x) => x.id === id) ?? null : null;
  const mia = tarea ? mias[tarea.id] ?? null : null;
  useEffect(() => {
    setTexto(mia?.texto ?? '');
  }, [mia?.texto, tarea?.id]);

  const entregar = async () => {
    if (!tarea || !cursoId) return;
    setEnviando(true);
    try {
      await tareasAbiertasRepository.entregar(cursoId, tarea.id, texto);
      showMessage(t('rubricas.est.entregada'), undefined, 'success');
      await cargar();
    } catch (e) {
      showMessage(t('rubricas.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setEnviando(false);
    }
  };

  const estadoDe = (x: TareaConId) => {
    const e = mias[x.id];
    if (e?.calificacion) return { texto: t('rubricas.est.nota', { nota: nota(e.calificacion.nota) }), tono: 'verde' as const };
    if (e) return { texto: t('rubricas.est.enviada'), tono: 'azul' as const };
    if (x.estado === 'cerrada') return { texto: t('rubricas.cerrada'), tono: 'neutro' as const };
    return { texto: t('rubricas.est.pendiente'), tono: 'naranja' as const };
  };

  return (
    <ScreenWrapper>
      <ContextScrollView contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps={tapsConTeclado}>
        <Encabezado
          atras={tarea ? '/(app)/tareas-abiertas' : '/saga'}
          sobretitulo={t('rubricas.est.sobre')}
          titulo={tarea ? tarea.titulo : t('rubricas.est.titulo')}
          subtitulo={tarea ? undefined : t('rubricas.est.sub')}
        />
        {tareas === null ? <Esqueleto filas={3} alto={64} /> : null}
        {tareas?.length === 0 ? <Vacio icono="create-outline" titulo={t('rubricas.est.vacio')} texto={t('rubricas.est.vacioTexto')} /> : null}

        {!tarea
          ? tareas?.map((x) => {
              const e = estadoDe(x);
              return (
                <Tarjeta key={x.id} onPress={() => router.push(`/(app)/tareas-abiertas?id=${x.id}` as Href)} accessibilityLabel={x.titulo}>
                  <View style={st.fila}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[st.titulo, { color: colors.text.primary }]} numberOfLines={2}>
                        {x.titulo}
                      </Text>
                      <Text style={[st.sub, { color: colors.text.tertiary }]}>
                        {x.deadline ? t('rubricas.vence', { fecha: fecha(x.deadline) }) : t('rubricas.sinFecha')}
                      </Text>
                    </View>
                    <Pill texto={e.texto} tono={e.tono} />
                  </View>
                </Tarjeta>
              );
            })
          : null}

        {tarea ? (
          <>
            <Tarjeta style={{ gap: 8 }}>
              <Text style={[st.cuerpo, { color: colors.text.primary }]}>{tarea.consigna}</Text>
              <Text style={[st.sub, { color: colors.text.tertiary }]}>
                {tarea.deadline ? t('rubricas.vence', { fecha: fecha(tarea.deadline) }) : t('rubricas.sinFecha')}
              </Text>
            </Tarjeta>
            {mia?.calificacion ? (
              <Tarjeta style={{ gap: 8 }}>
                <Pill texto={t('rubricas.est.nota', { nota: nota(mia.calificacion.nota) })} tono="verde" icono="star" />
                {mia.calificacion.comentario ? (
                  <Text style={[st.cuerpo, { color: colors.text.primary }]}>{t('rubricas.est.comentario', { texto: mia.calificacion.comentario })}</Text>
                ) : null}
                <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('rubricas.est.tuRespuesta')}</Text>
                <Text style={[st.cuerpo, { color: colors.text.secondary }]}>{mia.texto}</Text>
              </Tarjeta>
            ) : tarea.estado === 'abierta' ? (
              <Tarjeta style={{ gap: 10 }}>
                <Campo
                  etiqueta={t('rubricas.est.respuesta')}
                  value={texto}
                  onChangeText={setTexto}
                  multiline
                  maxLength={MAX_RESPUESTA}
                  ayuda={t('rubricas.est.caracteres', { n: texto.length, max: MAX_RESPUESTA })}
                />
                <BotonChunky
                  texto={mia ? t('rubricas.est.actualizar') : t('rubricas.est.entregar')}
                  icono="paper-plane"
                  cargando={enviando}
                  deshabilitado={!texto.trim()}
                  onPress={() => void entregar()}
                />
                {mia ? <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('rubricas.est.puedesCorregir')}</Text> : null}
              </Tarjeta>
            ) : (
              <Vacio icono="lock-closed-outline" titulo={t('rubricas.cerrada')} texto={t('rubricas.est.cerradaTexto')} />
            )}
            <Seccion texto={t('rubricas.est.comoCalifica')} />
            <Rubrica rubrica={tarea.rubrica} elegidos={mia?.calificacion?.niveles} />
          </>
        ) : null}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 14 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titulo: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  cuerpo: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
});
