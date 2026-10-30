/**
 * Fase 9 — tareas abiertas de una clase, para el profe
 * (`/(staff)/tareas-abiertas/[cursoId]`, `?tarea=` abre una). Quien edita la
 * clase las crea (Piloto o más), las cierra o las borra; cualquier profe de
 * la clase califica con la rúbrica, con o sin la sugerencia de la IA.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { useNombreCurso } from '@features/dashboard/hooks/useNombreCurso';
import { useMuro } from '@features/educadores/components/MuroPlan';
import { motivoDeError } from '@features/educadores/data/planUi';
import AvisoSoloCalifica from '@features/educadores/permisos/AvisoSoloCalifica';
import { usePermisoClase } from '@features/educadores/permisos/usePermisoClase';
import {
  resumenTarea,
  type SugerenciaCriterio,
} from '@/functions/src/educadores/dominio';
import {
  Avatar,
  BotonChunky,
  Campo,
  Encabezado,
  Esqueleto,
  Pill,
  Seccion,
  Tarjeta,
  Vacio,
  tapsConTeclado,
} from '@features/dashboard/components/profe/kit';
import EditorTarea from '../components/EditorTarea';
import Rubrica from '../components/Rubrica';
import {
  tareasAbiertasRepository,
  type EntregaGuardada,
  type TareaConId,
  type TareaEditable,
} from '../data/tareasAbiertasRepository';

const fecha = (ms: number) => new Date(ms).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
const nota = (n: number) => n.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function TareasAbiertasProfeScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colegioId = useAuthStore((s) => s.colegioId);
  const params = useLocalSearchParams<{ cursoId: string; nombre?: string; tarea?: string }>();
  const cursoId = params.cursoId ?? '';
  const nombreCurso = useNombreCurso(cursoId, params.nombre);
  const { puede: puedeEnClase } = usePermisoClase(cursoId);
  const muro = useMuro();

  const [tareas, setTareas] = useState<TareaConId[] | null>(null);
  const [resumenes, setResumenes] = useState<Record<string, EntregaGuardada[]>>({});
  const [editando, setEditando] = useState<TareaConId | 'nueva' | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    if (!colegioId || !cursoId) return;
    const lista = await tareasAbiertasRepository.listar(colegioId, cursoId).catch(() => []);
    setTareas(lista);
    const entregas = await Promise.all(lista.map((x) => tareasAbiertasRepository.entregas(colegioId, cursoId, x.id).catch(() => [])));
    setResumenes(Object.fromEntries(lista.map((x, i) => [x.id, entregas[i]])));
  }, [colegioId, cursoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const guardar = async (datos: TareaEditable) => {
    setGuardando(true);
    try {
      if (editando && editando !== 'nueva') {
        const r = await tareasAbiertasRepository.editar(cursoId, editando.id, datos);
        if (r.rubricaFija) showMessage(t('rubricas.rubricaFija'));
      } else {
        await tareasAbiertasRepository.crear(cursoId, datos);
      }
      setEditando(null);
      showMessage(t('rubricas.guardada'), undefined, 'success');
      await cargar();
    } catch (e) {
      const motivo = motivoDeError(e, 'rubricas');
      if (motivo) muro.abrir(motivo);
      else showMessage(t('rubricas.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setGuardando(false);
    }
  };

  const abierta = params.tarea ? tareas?.find((x) => x.id === params.tarea) ?? null : null;

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps={tapsConTeclado}
      >
        <Encabezado
          atras={abierta ? `/(staff)/tareas-abiertas/${cursoId}` : `/(staff)/curso/${cursoId}`}
          sobretitulo={t('rubricas.sobre')}
          titulo={abierta ? abierta.titulo : nombreCurso}
          subtitulo={abierta ? undefined : t('rubricas.sub')}
        />
        <AvisoSoloCalifica cursoId={cursoId} />

        {tareas === null ? <Esqueleto filas={3} alto={72} /> : null}

        {abierta && colegioId ? (
          <Calificar
            colegioId={colegioId}
            cursoId={cursoId}
            tarea={abierta}
            puedeEditar={puedeEnClase('tareas')}
            onEditar={() => setEditando(abierta)}
            onCambio={cargar}
          />
        ) : null}

        {editando ? (
          <EditorTarea
            inicial={editando === 'nueva' ? null : editando}
            guardando={guardando}
            onGuardar={(d) => void guardar(d)}
            onCancelar={() => setEditando(null)}
          />
        ) : null}

        {!abierta && tareas ? (
          <>
            {puedeEnClase('tareas') && !editando ? (
              <BotonChunky
                texto={t('rubricas.nueva')}
                icono="add-circle"
                onPress={() => muro.exigir('rubricas') && setEditando('nueva')}
              />
            ) : null}
            {tareas.length === 0 && !editando ? (
              <Vacio icono="create-outline" titulo={t('rubricas.vacio')} texto={t('rubricas.vacioTexto')} />
            ) : null}
            {tareas.map((x) => {
              const r = resumenTarea(resumenes[x.id] ?? []);
              return (
                <Tarjeta
                  key={x.id}
                  onPress={() => router.push(`/(staff)/tareas-abiertas/${cursoId}?tarea=${x.id}` as Href)}
                  accessibilityLabel={x.titulo}
                  style={{ gap: 6 }}
                >
                  <View style={st.fila}>
                    <Text style={[st.titulo, { color: colors.text.primary, flex: 1 }]} numberOfLines={2}>
                      {x.titulo}
                    </Text>
                    <Pill
                      texto={x.estado === 'cerrada' ? t('rubricas.cerrada') : t('rubricas.abierta')}
                      tono={x.estado === 'cerrada' ? 'neutro' : 'verde'}
                    />
                  </View>
                  <Text style={[st.sub, { color: colors.text.tertiary }]}>
                    {[
                      x.deadline ? t('rubricas.vence', { fecha: fecha(x.deadline) }) : t('rubricas.sinFecha'),
                      t('rubricas.entregas', { count: r.entregas }),
                      r.sinCalificar ? t('rubricas.porCalificar', { count: r.sinCalificar }) : null,
                      r.promedio !== null ? t('rubricas.promedio', { nota: nota(r.promedio) }) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </Tarjeta>
              );
            })}
          </>
        ) : null}
      </ContextScrollView>
      {muro.hoja}
    </ScreenWrapper>
  );
}

function Calificar({
  colegioId,
  cursoId,
  tarea,
  puedeEditar,
  onEditar,
  onCambio,
}: {
  colegioId: string;
  cursoId: string;
  tarea: TareaConId;
  puedeEditar: boolean;
  onEditar: () => void;
  onCambio: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const [entregas, setEntregas] = useState<EntregaGuardada[] | null>(null);
  const [nombres, setNombres] = useState<Map<string, string>>(new Map());
  const [uid, setUid] = useState<string | null>(null);
  const [niveles, setNiveles] = useState<(number | null)[]>([]);
  const [comentario, setComentario] = useState('');
  const [sugerencia, setSugerencia] = useState<SugerenciaCriterio[] | null>(null);
  const [ocupado, setOcupado] = useState<'ia' | 'guardar' | null>(null);

  const cargar = useCallback(async () => {
    const [e, roster] = await Promise.all([
      tareasAbiertasRepository.entregas(colegioId, cursoId, tarea.id).catch(() => []),
      rosterRepository.getRoster(colegioId, cursoId).catch(() => []),
    ]);
    setNombres(new Map(roster.map((r) => [r.uid, r.nombre ?? ''])));
    // Sin calificar primero, luego por fecha de entrega.
    setEntregas([...e].sort((a, b) => Number(!!a.calificada) - Number(!!b.calificada) || a.entregadaAt - b.entregadaAt));
  }, [colegioId, cursoId, tarea.id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const actual = useMemo(() => entregas?.find((e) => e.uid === uid) ?? null, [entregas, uid]);
  const abrir = (e: EntregaGuardada) => {
    setUid(e.uid);
    setNiveles(e.calificacion?.niveles ?? tarea.rubrica.criterios.map(() => null));
    setComentario(e.calificacion?.comentario ?? '');
    setSugerencia(null);
  };

  const sugerir = async () => {
    if (!uid) return;
    setOcupado('ia');
    try {
      const r = await tareasAbiertasRepository.sugerir(cursoId, tarea.id, uid);
      setSugerencia(r.sugerencia);
      // La sugerencia llena solo lo que el profe no ha elegido.
      setNiveles((ns) => ns.map((n, i) => n ?? r.sugerencia[i]?.nivel ?? null));
    } catch (e) {
      showMessage(t('rubricas.iaError'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setOcupado(null);
    }
  };

  const guardar = async () => {
    if (!uid || !entregas) return;
    setOcupado('guardar');
    try {
      await tareasAbiertasRepository.calificar(cursoId, tarea.id, uid, niveles, comentario);
      showMessage(t('rubricas.calificada'), undefined, 'success');
      const siguiente = entregas.find((e) => !e.calificada && e.uid !== uid);
      await cargar();
      await onCambio();
      if (siguiente) abrir(siguiente);
      else setUid(null);
    } catch (e) {
      showMessage(t('rubricas.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setOcupado(null);
    }
  };

  const estado = async (accion: 'cerrar' | 'abrir' | 'borrar') => {
    try {
      await tareasAbiertasRepository.estado(cursoId, tarea.id, accion);
      await onCambio();
      if (accion === 'borrar') router.replace(`/(staff)/tareas-abiertas/${cursoId}` as Href);
    } catch (e) {
      showMessage(t('rubricas.error'), e instanceof Error ? e.message : String(e), 'error');
    }
  };

  const listas = niveles.length > 0 && niveles.every((n) => n !== null);

  return (
    <View style={{ gap: 14 }}>
      <Tarjeta style={{ gap: 8 }}>
        <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('rubricas.consigna')}</Text>
        <Text style={[st.cuerpo, { color: colors.text.primary }]}>{tarea.consigna}</Text>
        <Text style={[st.sub, { color: colors.text.tertiary }]}>
          {tarea.deadline ? t('rubricas.vence', { fecha: fecha(tarea.deadline) }) : t('rubricas.sinFecha')}
        </Text>
      </Tarjeta>

      {actual ? (
        <Tarjeta style={{ gap: 12 }}>
          <View style={st.fila}>
            <Avatar nombre={nombres.get(actual.uid) || '?'} tamano={34} />
            <Text style={[st.titulo, { color: colors.text.primary, flex: 1 }]}>{nombres.get(actual.uid) || t('rubricas.estudiante')}</Text>
            <Text style={[st.sub, { color: colors.text.tertiary }]}>{fecha(actual.entregadaAt)}</Text>
          </View>
          <Text style={[st.cuerpo, { color: colors.text.primary }]}>{actual.texto}</Text>
          <Rubrica
            rubrica={tarea.rubrica}
            elegidos={niveles}
            sugeridos={sugerencia}
            onElegir={(i, j) => setNiveles((ns) => ns.map((n, k) => (k === i ? j : n)))}
          />
          <BotonChunky
            texto={sugerencia ? t('rubricas.iaOtraVez') : t('rubricas.iaSugerir')}
            icono="sparkles"
            variante="secundario"
            compacto
            cargando={ocupado === 'ia'}
            onPress={() => void sugerir()}
          />
          <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('rubricas.iaAyuda')}</Text>
          <Campo etiqueta={t('rubricas.comentario')} value={comentario} onChangeText={setComentario} multiline maxLength={500} />
          <BotonChunky texto={t('rubricas.guardarYSiguiente')} icono="checkmark-circle" deshabilitado={!listas} cargando={ocupado === 'guardar'} onPress={() => void guardar()} />
          <BotonChunky texto={t('rubricas.volverLista')} variante="secundario" compacto onPress={() => setUid(null)} />
        </Tarjeta>
      ) : null}

      <Seccion texto={t('rubricas.entregasTitulo', { count: entregas?.length ?? 0 })} />
      {entregas === null ? <Esqueleto filas={2} alto={56} /> : null}
      {entregas?.length === 0 ? <Vacio icono="hourglass-outline" titulo={t('rubricas.sinEntregas')} texto={t('rubricas.sinEntregasTexto')} /> : null}
      {entregas?.map((e) => (
        <Tarjeta key={e.uid} onPress={() => abrir(e)} accessibilityLabel={nombres.get(e.uid) || e.uid}>
          <View style={st.fila}>
            <Avatar nombre={nombres.get(e.uid) || '?'} tamano={34} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[st.titulo, { color: colors.text.primary }]} numberOfLines={1}>
                {nombres.get(e.uid) || t('rubricas.estudiante')}
              </Text>
              <Text style={[st.sub, { color: colors.text.tertiary }]} numberOfLines={1}>
                {e.texto}
              </Text>
            </View>
            {e.calificacion ? (
              <Pill texto={nota(e.calificacion.nota)} tono="verde" icono="checkmark" />
            ) : (
              <Pill texto={t('rubricas.sinCalificar')} tono="naranja" />
            )}
          </View>
        </Tarjeta>
      ))}

      {puedeEditar ? (
        <View style={{ gap: 8 }}>
          <BotonChunky texto={t('rubricas.editar')} icono="create-outline" variante="secundario" compacto onPress={onEditar} />
          <BotonChunky
            texto={tarea.estado === 'cerrada' ? t('rubricas.reabrir') : t('rubricas.cerrar')}
            icono={tarea.estado === 'cerrada' ? 'lock-open-outline' : 'lock-closed-outline'}
            variante="secundario"
            compacto
            onPress={() => void estado(tarea.estado === 'cerrada' ? 'abrir' : 'cerrar')}
          />
          <BotonChunky
            texto={t('rubricas.borrar')}
            icono="trash-outline"
            variante="secundario"
            compacto
            onPress={() =>
              confirmAction({
                title: t('rubricas.borrarTitulo'),
                body: t('rubricas.borrarTexto'),
                confirmLabel: t('rubricas.borrar'),
                cancelLabel: t('rubricas.editor.cancelar'),
                destructive: true,
                onConfirm: () => void estado('borrar'),
              })
            }
          />
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 14 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titulo: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  cuerpo: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
});
