/**
 * Fase 9 — muro de preguntas de la clase. El profe (`/(staff)/muro/[cursoId]`)
 * lo enciende (quien edita), y revisa: responder (publica), publicar, ocultar
 * o borrar. El estudiante (`/(app)/muro`) pregunta y ve las publicadas y las
 * suyas; nada suyo se ve en la clase hasta que su profe lo publica.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useNombreCurso } from '@features/dashboard/hooks/useNombreCurso';
import AvisoSoloCalifica from '@features/educadores/permisos/AvisoSoloCalifica';
import { usePermisoClase } from '@features/educadores/permisos/usePermisoClase';
import { MAX_PREGUNTA_MURO, MAX_RESPUESTA_MURO } from '@/functions/src/educadores/dominio';
import { BotonChunky, Campo, Chip, Encabezado, Esqueleto, Pill, Seccion, Tarjeta, Vacio, tapsConTeclado } from '@features/dashboard/components/profe/kit';
import { muroRepository, type PreguntaConId } from '../data/muroRepository';

const cuando = (ms: number) => new Date(ms).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

export default function MuroClaseScreen({ modo }: { modo: 'profe' | 'estudiante' }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const uid = useAuthStore((s) => s.firebaseUid);
  const colegioId = useAuthStore((s) => s.colegioId);
  const espacioCurso = useAuthStore((s) => s.cursoId);
  const params = useLocalSearchParams<{ cursoId?: string; nombre?: string }>();
  const cursoId = modo === 'profe' ? (params.cursoId ?? '') : (espacioCurso ?? '');
  const nombreCurso = useNombreCurso(cursoId, params.nombre);
  const { puede: puedeEnClase } = usePermisoClase(modo === 'profe' ? cursoId : null);

  const [activo, setActivo] = useState<boolean | null>(null);
  const [preguntas, setPreguntas] = useState<PreguntaConId[] | null>(null);
  const [texto, setTexto] = useState('');
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!colegioId || !cursoId || !uid) return;
    const [a, p] = await Promise.all([
      muroRepository.activo(colegioId, cursoId).catch(() => false),
      (modo === 'profe' ? muroRepository.todas(colegioId, cursoId) : muroRepository.paraEstudiante(colegioId, cursoId, uid)).catch(
        () => [] as PreguntaConId[]
      ),
    ]);
    setActivo(a);
    setPreguntas(p);
  }, [colegioId, cursoId, uid, modo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const hacer = async (clave: string, fn: () => Promise<unknown>, ok?: string) => {
    setOcupado(clave);
    try {
      await fn();
      if (ok) showMessage(ok, undefined, 'success');
      await cargar();
    } catch (e) {
      showMessage(t('muro.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setOcupado(null);
    }
  };

  const pendientes = preguntas?.filter((p) => p.estado === 'pendiente') ?? [];
  const resto = preguntas?.filter((p) => p.estado !== 'pendiente') ?? [];

  const tarjeta = (p: PreguntaConId) => (
    <Tarjeta key={p.id} style={{ gap: 8 }}>
      <View style={st.fila}>
        <Text style={[st.quien, { color: colors.text.tertiary, flex: 1 }]}>
          {`${p.uid === uid ? t('muro.tu') : p.nombre} · ${cuando(p.creadoAt)}`}
        </Text>
        {p.estado === 'pendiente' ? (
          <Pill texto={modo === 'profe' ? t('muro.pendiente') : t('muro.esperando')} tono="naranja" />
        ) : p.estado === 'oculta' ? (
          <Pill texto={t('muro.oculta')} tono="neutro" icono="eye-off" />
        ) : null}
      </View>
      <Text style={[st.cuerpo, { color: colors.text.primary }]}>{p.texto}</Text>
      {p.respuesta ? (
        <View style={[st.respuesta, { backgroundColor: colors.materials.highlight }]}>
          <Text style={[st.quien, { color: colors.text.tertiary }]}>{p.respondidaPorNombre ?? t('muro.profe')}</Text>
          <Text style={[st.cuerpo, { color: colors.text.primary }]}>{p.respuesta}</Text>
        </View>
      ) : null}
      {modo === 'profe' && puedeEnClase('responderMuro') ? (
        <View style={{ gap: 8 }}>
          {p.estado !== 'oculta' ? (
            <Campo
              etiqueta={p.respuesta ? t('muro.cambiarRespuesta') : t('muro.responder')}
              value={respuestas[p.id] ?? ''}
              onChangeText={(v) => setRespuestas((r) => ({ ...r, [p.id]: v }))}
              multiline
              maxLength={MAX_RESPUESTA_MURO}
            />
          ) : null}
          <View style={st.chips}>
            {(respuestas[p.id] ?? '').trim() ? (
              <Chip
                texto={ocupado === `r${p.id}` ? t('muro.guardando') : t('muro.responderYPublicar')}
                icono="chatbubble-ellipses"
                seleccionado
                onPress={() => void hacer(`r${p.id}`, () => muroRepository.responder(cursoId, p.id, respuestas[p.id]), t('muro.respondida'))}
              />
            ) : null}
            {p.estado !== 'publicada' ? (
              <Chip texto={t('muro.publicar')} icono="eye" seleccionado={false} onPress={() => void hacer(`p${p.id}`, () => muroRepository.moderar(cursoId, p.id, 'publicar'))} />
            ) : null}
            {p.estado !== 'oculta' ? (
              <Chip texto={t('muro.ocultar')} icono="eye-off" seleccionado={false} onPress={() => void hacer(`o${p.id}`, () => muroRepository.moderar(cursoId, p.id, 'ocultar'))} />
            ) : null}
            <Chip
              texto={t('muro.borrar')}
              icono="trash-outline"
              seleccionado={false}
              color={colors.system.red}
              onPress={() => void hacer(`b${p.id}`, () => muroRepository.moderar(cursoId, p.id, 'borrar'))}
            />
          </View>
        </View>
      ) : null}
    </Tarjeta>
  );

  return (
    <ScreenWrapper>
      <ContextScrollView contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps={tapsConTeclado}>
        <Encabezado
          atras={modo === 'profe' ? `/(staff)/curso/${cursoId}` : '/saga'}
          sobretitulo={t('muro.sobre')}
          titulo={nombreCurso || t('muro.titulo')}
          subtitulo={t(modo === 'profe' ? 'muro.subProfe' : 'muro.subEstudiante')}
        />
        {modo === 'profe' ? <AvisoSoloCalifica cursoId={cursoId} /> : null}
        {activo === null ? <Esqueleto filas={3} alto={64} /> : null}

        {modo === 'profe' && activo !== null ? (
          <Tarjeta style={st.fila}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[st.titulo, { color: colors.text.primary }]}>{t('muro.encendido')}</Text>
              <Text style={[st.quien, { color: colors.text.tertiary }]}>{t('muro.encendidoAyuda')}</Text>
            </View>
            <Switch
              value={activo}
              disabled={!puedeEnClase('ajustes') || ocupado === 'cfg'}
              onValueChange={(v) => void hacer('cfg', () => muroRepository.configurar(cursoId, v))}
              trackColor={{ true: colors.brand.primary, false: colors.materials.border }}
              thumbColor="#FFFFFF"
              accessibilityLabel={t('muro.encendido')}
            />
          </Tarjeta>
        ) : null}

        {modo === 'estudiante' && activo === false ? (
          <Vacio icono="chatbubbles-outline" titulo={t('muro.apagadoTitulo')} texto={t('muro.apagadoTexto')} />
        ) : null}

        {modo === 'estudiante' && activo ? (
          <Tarjeta style={{ gap: 10 }}>
            <Campo etiqueta={t('muro.tuPregunta')} value={texto} onChangeText={setTexto} multiline maxLength={MAX_PREGUNTA_MURO} placeholder={t('muro.ejemplo')} />
            <BotonChunky
              texto={t('muro.preguntar')}
              icono="help-circle"
              cargando={ocupado === 'preguntar'}
              deshabilitado={!texto.trim()}
              onPress={() =>
                void hacer('preguntar', async () => {
                  await muroRepository.preguntar(cursoId, texto);
                  setTexto('');
                }, t('muro.enviada'))
              }
            />
            <Text style={[st.quien, { color: colors.text.tertiary }]}>{t('muro.reglas')}</Text>
          </Tarjeta>
        ) : null}

        {modo === 'profe' && pendientes.length > 0 ? <Seccion texto={t('muro.porRevisar', { count: pendientes.length })} /> : null}
        {modo === 'profe' ? pendientes.map(tarjeta) : null}
        {modo === 'profe' && resto.length > 0 ? <Seccion texto={t('muro.revisadas')} /> : null}
        {modo === 'profe' ? resto.map(tarjeta) : preguntas?.map(tarjeta)}
        {preguntas?.length === 0 && activo ? <Vacio icono="chatbubbles-outline" titulo={t('muro.vacio')} texto={t(modo === 'profe' ? 'muro.vacioProfe' : 'muro.vacioEstudiante')} /> : null}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 14 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titulo: { fontSize: 16, fontWeight: '800' },
  quien: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  cuerpo: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  respuesta: { borderRadius: 12, padding: 10, gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
