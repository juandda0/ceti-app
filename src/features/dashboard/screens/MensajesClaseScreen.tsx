/**
 * Mensajes de una clase para el estudiante (Fase 5): los anuncios del profe y lo
 * que le escribió a él (mensajes y comentarios sobre un mundo). No hay caja de
 * respuesta: los mensajes solo van del profe al estudiante. Al abrirla, todo
 * queda como visto (el profe ve que lo vio).
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { FadeIn } from '@features/savings/charts/ChartParts';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { avisosRepository, sinLeer } from '@features/dashboard/data/avisosRepository';
import { comunicacionRepository } from '@features/dashboard/data/comunicacionRepository';
import {
  mensajesDeClase,
  profeDeLaClase,
  type MensajeDeClase,
} from '@features/dashboard/data/comunicacion';
import { fechaHora } from '@features/dashboard/screens/ComunicacionClaseScreen';
import {
  Aviso,
  BotonChunky,
  Encabezado,
  Esqueleto,
  Pill,
  Tarjeta,
  Vacio,
} from '@features/dashboard/components/profe/kit';

export default function MensajesClaseScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const uid = useAuthStore((s) => s.firebaseUid);
  const espacioColegio = useAuthStore((s) => s.colegioId);
  const espacioCurso = useAuthStore((s) => s.cursoId);
  const params = useLocalSearchParams<{ colegioId?: string; cursoId?: string }>();
  const colegioId = params.colegioId || espacioColegio;
  const cursoId = params.cursoId || espacioCurso;
  // "Abrir el mundo" solo sirve si el espacio abierto en Aprender es esta clase.
  const enSuEspacio = espacioCurso === cursoId;

  const [clase, setClase] = useState('');
  const [mensajes, setMensajes] = useState<MensajeDeClase[]>([]);
  const [nuevos, setNuevos] = useState<Set<string>>(new Set());
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');

  const cargar = useCallback(async () => {
    if (!uid || !colegioId || !cursoId) {
      setEstado('error');
      return;
    }
    try {
      const [curso, anuncios, buzon, avisos] = await Promise.all([
        rosterRepository.getCurso(colegioId, cursoId).catch(() => null),
        comunicacionRepository.anuncios(colegioId, cursoId),
        comunicacionRepository.buzon(colegioId, cursoId, uid),
        avisosRepository.mios(uid).catch(() => []),
      ]);
      setClase(curso?.nombre ?? '');
      setMensajes(mensajesDeClase(anuncios, buzon));
      const avisosNuevos = sinLeer(avisos, cursoId).filter((a) => a.tipo !== 'alerta');
      const anunciosNuevos = avisosNuevos
        .filter((a) => a.tipo === 'anuncio')
        .map((a) => a.datos?.comunicadoId)
        .filter((id): id is string => typeof id === 'string');
      const buzonNuevo = buzon.filter((m) => m.leidoAt == null).map((m) => m.id);
      setNuevos(new Set([...anunciosNuevos, ...buzonNuevo]));
      setEstado('listo');

      // Queda como visto. Si algo falla no pasa nada: se marca la próxima vez.
      void Promise.all([
        avisosRepository.marcarLeidos(
          uid,
          avisosNuevos.map((a) => a.id)
        ),
        ...buzonNuevo.map((id) => comunicacionRepository.marcarLeido(colegioId, cursoId, uid, id)),
        ...anunciosNuevos.map((id) =>
          comunicacionRepository.marcarAnuncioVisto(colegioId, cursoId, uid, id)
        ),
      ]).catch(() => undefined);
    } catch {
      setEstado('error');
    }
  }, [uid, colegioId, cursoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const profe = profeDeLaClase(mensajes);

  const etiqueta = (m: MensajeDeClase) => {
    if (m.tipo === 'anuncio') return t('comunicacion.alumno.anuncio');
    if (m.tipo === 'retro') {
      return m.contexto?.nombre
        ? t('comunicacion.alumno.retroSobre', { nombre: m.contexto.nombre })
        : t('comunicacion.alumno.retro');
    }
    return t('comunicacion.alumno.paraTi');
  };

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado
          atras="/(app)/saga"
          sobretitulo={
            profe && clase ? t('comunicacion.alumno.claseConProfe', { clase, profe }) : clase
          }
          titulo={t('comunicacion.alumno.titulo')}
        />

        {estado === 'cargando' ? <Esqueleto filas={3} alto={80} /> : null}
        {estado === 'error' ? (
          <Vacio
            icono="time-outline"
            tono="naranja"
            titulo={t('comunicacion.alumno.errorTitulo')}
            texto={t('comunicacion.alumno.error')}
          />
        ) : null}
        {estado === 'listo' && mensajes.length === 0 ? (
          <Vacio
            icono="chatbubbles-outline"
            titulo={t('comunicacion.alumno.vacioTitulo')}
            texto={t('comunicacion.alumno.vacio')}
          />
        ) : null}

        {estado === 'listo' && mensajes.length > 0 ? (
          <FadeIn>
            <View style={st.lista}>
              {mensajes.map((m) => (
                <Tarjeta key={`${m.tipo}-${m.id}`} style={st.tarjeta}>
                  <View style={st.cabeza}>
                    <Text style={[st.etiqueta, { color: colors.text.secondary }]} numberOfLines={1}>
                      {etiqueta(m)}
                    </Text>
                    {nuevos.has(m.id) ? (
                      <Pill tono="naranja" texto={t('comunicacion.alumno.nuevo')} />
                    ) : null}
                  </View>
                  <Text style={[st.texto, { color: colors.text.primary }]}>{m.texto}</Text>
                  <Text style={[st.fecha, { color: colors.text.tertiary }]}>
                    {fechaHora(m.creadoAt)}
                  </Text>
                  {m.contexto?.worldId && enSuEspacio ? (
                    <BotonChunky
                      texto={t('comunicacion.alumno.abrirMundo')}
                      icono="planet"
                      variante="secundario"
                      compacto
                      onPress={() => router.push(`/saga/${m.contexto?.worldId}` as Href)}
                    />
                  ) : null}
                </Tarjeta>
              ))}
              <Aviso icono="lock-closed" tono="azul" texto={t('comunicacion.alumno.soloLectura')} />
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
  tarjeta: { gap: 8 },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  etiqueta: { flex: 1, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  texto: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  fecha: { fontSize: 13, fontWeight: '600' },
});
