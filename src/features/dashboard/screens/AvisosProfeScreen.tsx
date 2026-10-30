/**
 * Avisos del profe (Fase 5): las alertas que el servidor calcula cada mañana en
 * sus clases (no entra hace N días, no hizo una tarea, bajó su promedio). Desde
 * cada una abre la ficha del estudiante o les escribe a todos de una vez. Al
 * abrirla quedan como leídas.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { FadeIn } from '@features/savings/charts/ChartParts';
import { avisosRepository, type Aviso } from '@features/dashboard/data/avisosRepository';
import RedactarMensaje from '@features/dashboard/components/RedactarMensaje';
import { fechaHora } from '@features/dashboard/screens/ComunicacionClaseScreen';
import {
  BotonChunky,
  Chip,
  Encabezado,
  Esqueleto,
  Pill,
  Tarjeta,
  Vacio,
  tapsConTeclado,
  type Tono,
} from '@features/dashboard/components/profe/kit';

const TONO_ALERTA: Record<string, Tono> = { inactividad: 'naranja', tarea: 'morado', promedio: 'rojo' };

function estudiantesDe(a: Aviso): { uid: string; nombre: string }[] {
  const lista = a.datos?.estudiantes;
  return Array.isArray(lista)
    ? lista.filter(
        (e): e is { uid: string; nombre: string } =>
          !!e && typeof e.uid === 'string' && typeof e.nombre === 'string'
      )
    : [];
}

export default function AvisosProfeScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const uid = useAuthStore((s) => s.firebaseUid);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [nuevos, setNuevos] = useState<Set<string>>(new Set());
  const [escribiendo, setEscribiendo] = useState<string | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');

  const cargar = useCallback(async () => {
    if (!uid) return;
    try {
      const todos = (await avisosRepository.mios(uid)).filter((a) => a.tipo === 'alerta');
      const sinLeer = todos.filter((a) => a.leidaAt == null).map((a) => a.id);
      setAvisos(todos);
      setNuevos(new Set(sinLeer));
      setEstado('listo');
      void avisosRepository.marcarLeidos(uid, sinLeer).catch(() => undefined);
    } catch {
      setEstado('error');
    }
  }, [uid]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps={tapsConTeclado}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado
          atras="/(staff)/clases"
          sobretitulo={t('avisos.sobre')}
          titulo={t('avisos.titulo')}
          subtitulo={t('avisos.subtitulo')}
        />
        {estado === 'cargando' ? <Esqueleto filas={3} alto={96} /> : null}
        {estado === 'error' ? (
          <Vacio
            icono="cloud-offline-outline"
            tono="rojo"
            titulo={t('profe.errorTitulo')}
            texto={t('avisos.error')}
          />
        ) : null}
        {estado === 'listo' && avisos.length === 0 ? (
          <Vacio icono="notifications-outline" titulo={t('avisos.vacioTitulo')} texto={t('avisos.vacio')} />
        ) : null}
        {estado === 'listo' && avisos.length > 0 ? (
          <FadeIn>
            <View style={st.lista}>
              {avisos.map((a) => {
                const estudiantes = estudiantesDe(a);
                const tipo = typeof a.datos?.alerta === 'string' ? a.datos.alerta : 'inactividad';
                const clase = typeof a.datos?.clase === 'string' ? a.datos.clase : '';
                return (
                  <Tarjeta key={a.id} style={st.tarjeta}>
                    <View style={st.cabeza}>
                      <Pill tono={TONO_ALERTA[tipo] ?? 'neutro'} texto={t(`avisos.tipo.${tipo}`)} />
                      <Text style={[st.mini, { flex: 1, color: colors.text.tertiary }]} numberOfLines={1}>
                        {[clase, fechaHora(a.creadoAt)].filter(Boolean).join(' · ')}
                      </Text>
                      {nuevos.has(a.id) ? <Pill tono="naranja" texto={t('avisos.nuevo')} /> : null}
                    </View>
                    <Text style={[st.titulo, { color: colors.text.primary }]}>{a.titulo}</Text>
                    <Text style={[st.cuerpo, { color: colors.text.secondary }]}>{a.cuerpo}</Text>
                    {estudiantes.length > 0 ? (
                      <View style={st.chips}>
                        {estudiantes.map((e) => (
                          <Chip
                            key={e.uid}
                            texto={e.nombre}
                            icono="person"
                            seleccionado={false}
                            onPress={() =>
                              router.push(
                                `/(staff)/estudiante/${a.cursoId}/${e.uid}?nombre=${encodeURIComponent(e.nombre)}` as Href
                              )
                            }
                          />
                        ))}
                      </View>
                    ) : null}
                    {escribiendo === a.id ? (
                      <RedactarMensaje
                        colegioId={a.colegioId}
                        cursoId={a.cursoId}
                        tipo="mensaje"
                        para={estudiantes.map((e) => e.uid)}
                        placeholder={t('comunicacion.grupoPlaceholder')}
                        textoBoton={t('comunicacion.grupoEnviar', { count: estudiantes.length })}
                        onEnviado={() => setEscribiendo(null)}
                      />
                    ) : estudiantes.length > 0 ? (
                      <BotonChunky
                        texto={
                          estudiantes.length === 1
                            ? t('avisos.escribirle')
                            : t('avisos.escribirles', { count: estudiantes.length })
                        }
                        icono="chatbubble-ellipses"
                        variante="secundario"
                        compacto
                        onPress={() => setEscribiendo(a.id)}
                      />
                    ) : null}
                  </Tarjeta>
                );
              })}
            </View>
          </FadeIn>
        ) : null}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 80, gap: 14 },
  lista: { gap: 12 },
  tarjeta: { gap: 10 },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  cuerpo: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  mini: { fontSize: 12, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
