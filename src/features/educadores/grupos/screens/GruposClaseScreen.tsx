/**
 * Fase 8 — grupos dentro de la clase. El profe (o un co-docente) los arma al
 * azar o a mano, les cambia el nombre y mueve estudiantes; cada cambio se
 * guarda al momento y lo ven en vivo los demás profes de la clase. Por grupo:
 * asignarle un mundo o escribirle (AccionGrupo).
 */
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import Bounceable from '@shared/components/Bounceable';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { classConfigRepository } from '@features/dashboard/data/classConfigRepository';
import { mundosDeLaClase } from '@features/dashboard/data/cargarFichaEstudiante';
import type { MundoDeLaClase } from '@features/dashboard/data/fichaEstudiante';
import { useNombreCurso } from '@features/dashboard/hooks/useNombreCurso';
import AccionGrupo from '@features/dashboard/components/AccionGrupo';
import {
  BotonChunky,
  Campo,
  Chip,
  Encabezado,
  Esqueleto,
  Pill,
  Seccion,
  Tarjeta,
  Vacio,
} from '@features/dashboard/components/profe/kit';
import {
  MAX_GRUPOS,
  armarAlAzar,
  grupoNuevo,
  moverA,
  sinGrupo,
  validarGrupos,
  type Grupo,
} from '@/functions/src/educadores/dominio';
import { gruposRepository } from '../data/gruposRepository';

const TAMANOS = [2, 3, 4, 5, 6] as const;

export default function GruposClaseScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ cursoId: string; nombre?: string }>();
  const cursoId = params.cursoId ?? '';
  const nombreCurso = useNombreCurso(cursoId, params.nombre);
  const colegioId = useAuthStore((s) => s.colegioId);
  const uid = useAuthStore((s) => s.firebaseUid);

  const [grupos, setGrupos] = useState<Grupo[] | null>(null);
  const [estudiantes, setEstudiantes] = useState<{ uid: string; nombre: string }[] | null>(null);
  const [mundos, setMundos] = useState<MundoDeLaClase[]>([]);
  const [n, setN] = useState(4);
  const [elegido, setElegido] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!colegioId || !cursoId) return;
    return gruposRepository.escuchar(colegioId, cursoId, setGrupos);
  }, [colegioId, cursoId]);

  useEffect(() => {
    if (!colegioId || !cursoId) return;
    let cancelado = false;
    void Promise.all([rosterRepository.getRoster(colegioId, cursoId), classConfigRepository.get(colegioId, cursoId)])
      .then(([roster, config]) => {
        if (cancelado) return;
        setEstudiantes(
          roster
            .filter((e) => e.estado === 'activo')
            .map((e) => ({ uid: e.uid, nombre: e.nombre || e.email }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        );
        setMundos(mundosDeLaClase(config));
      })
      .catch(() => {
        if (!cancelado) setEstudiantes([]);
      });
    return () => {
      cancelado = true;
    };
  }, [colegioId, cursoId]);

  const nombreDe = useMemo(() => new Map((estudiantes ?? []).map((e) => [e.uid, e.nombre])), [estudiantes]);
  // Solo cuentan los estudiantes activos: quien salió de la clase no aparece.
  const vigentes = useMemo(
    () => (grupos ?? []).map((g) => ({ ...g, uids: g.uids.filter((u) => nombreDe.has(u)) })),
    [grupos, nombreDe]
  );
  const libres = useMemo(() => sinGrupo((estudiantes ?? []).map((e) => e.uid), vigentes), [estudiantes, vigentes]);

  const guardar = async (siguiente: Grupo[]) => {
    if (!colegioId || !uid) return;
    const v = validarGrupos(siguiente);
    if (!v.ok) return showMessage(t(`diferenciales.grupos.error_${v.error}`), undefined, 'error');
    setGuardando(true);
    try {
      await gruposRepository.guardar(colegioId, cursoId, siguiente, uid);
    } catch (e) {
      showMessage(t('diferenciales.grupos.errorGuardar'), e instanceof Error ? e.message : undefined, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const alAzar = () => {
    if (!estudiantes?.length) return;
    const armar = () => void guardar(armarAlAzar(estudiantes.map((e) => e.uid), n, `${cursoId}:${Date.now()}`));
    if (!vigentes.length) return armar();
    confirmAction({
      title: t('diferenciales.grupos.rehacerTitulo'),
      body: t('diferenciales.grupos.rehacerTexto'),
      confirmLabel: t('diferenciales.grupos.alAzar'),
      cancelLabel: t('diferenciales.cancelar'),
      onConfirm: armar,
    });
  };

  const mover = (destino: string | null) => {
    if (!elegido) return;
    void guardar(moverA(vigentes, elegido, destino));
    setElegido(null);
  };

  const renombrar = (g: Grupo) => {
    const nombre = nombreNuevo.trim();
    setEditando(null);
    if (!nombre || nombre === g.nombre) return;
    void guardar(vigentes.map((x) => (x.id === g.id ? { ...x, nombre: nombre.slice(0, 30) } : x)));
  };

  const borrar = (g: Grupo) =>
    confirmAction({
      title: t('diferenciales.grupos.borrarTitulo', { nombre: g.nombre }),
      body: t('diferenciales.grupos.borrarTexto'),
      confirmLabel: t('diferenciales.grupos.borrar'),
      cancelLabel: t('diferenciales.cancelar'),
      destructive: true,
      onConfirm: () => void guardar(vigentes.filter((x) => x.id !== g.id)),
    });

  const chipEstudiante = (u: string) => (
    <Bounceable
      key={u}
      onPress={() => setElegido(elegido === u ? null : u)}
      activeScale={0.95}
      accessibilityRole="button"
      accessibilityState={{ selected: elegido === u }}
      accessibilityLabel={t('diferenciales.grupos.moverA11y', { nombre: nombreDe.get(u) ?? '' })}
      style={[
        st.est,
        {
          backgroundColor: elegido === u ? colors.fill.brandSubtle : colors.materials.highlight,
          borderColor: elegido === u ? colors.brand.primary : 'transparent',
        },
      ]}
    >
      <Text style={[st.estTxt, { color: colors.text.primary }]}>{nombreDe.get(u)}</Text>
    </Bounceable>
  );

  const destinos = elegido ? (
    <Tarjeta acento={colors.brand.primary} style={{ gap: 10 }}>
      <Text style={[st.cuerpo, { color: colors.text.primary }]}>
        {t('diferenciales.grupos.moverTitulo', { nombre: nombreDe.get(elegido) ?? '' })}
      </Text>
      <View style={st.chips}>
        {vigentes.map((g) => (
          <Chip key={g.id} texto={g.nombre} color={g.color} seleccionado={g.uids.includes(elegido)} onPress={() => mover(g.id)} />
        ))}
        <Chip texto={t('diferenciales.grupos.sinGrupo')} seleccionado={libres.includes(elegido)} onPress={() => mover(null)} />
      </View>
    </Tarjeta>
  ) : null;

  return (
    <ScreenWrapper>
      <ContextScrollView contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]} showsVerticalScrollIndicator={false}>
        <Encabezado
          atras={`/(staff)/curso/${cursoId}`}
          sobretitulo={t('diferenciales.grupos.sobre')}
          titulo={nombreCurso}
          derecha={guardando ? <Pill texto={t('diferenciales.grupos.guardando')} tono="neutro" /> : null}
        />

        {grupos === null || estudiantes === null ? <Esqueleto filas={3} alto={90} /> : null}

        {grupos !== null && estudiantes !== null ? (
          <>
            <Tarjeta style={{ gap: 10 }}>
              <Text style={[st.cuerpo, { color: colors.text.secondary }]}>{t('diferenciales.grupos.intro')}</Text>
              <Seccion texto={t('diferenciales.grupos.cuantos')} />
              <View style={st.chips}>
                {TAMANOS.map((x) => (
                  <Chip key={x} texto={String(x)} seleccionado={n === x} onPress={() => setN(x)} />
                ))}
              </View>
              <View style={st.fila}>
                <BotonChunky
                  texto={t('diferenciales.grupos.alAzar')}
                  icono="shuffle"
                  compacto
                  deshabilitado={!estudiantes.length}
                  onPress={alAzar}
                  style={{ flex: 1 }}
                />
                <BotonChunky
                  texto={t('diferenciales.grupos.nuevo')}
                  icono="add"
                  variante="secundario"
                  compacto
                  deshabilitado={vigentes.length >= MAX_GRUPOS}
                  onPress={() => void guardar([...vigentes, grupoNuevo(vigentes, `g${Date.now().toString(36)}`)])}
                  style={{ flex: 1 }}
                />
              </View>
            </Tarjeta>

            {estudiantes.length === 0 ? (
              <Vacio icono="people-outline" tono="neutro" titulo={t('diferenciales.grupos.sinEstudiantes')} />
            ) : null}

            {destinos}

            {vigentes.map((g) => (
              <Tarjeta key={g.id} style={{ gap: 10 }}>
                <View style={st.cabeza}>
                  <View style={[st.punto, { backgroundColor: g.color }]} />
                  {editando === g.id ? (
                    <Campo
                      value={nombreNuevo}
                      onChangeText={setNombreNuevo}
                      maxLength={30}
                      style={{ flex: 1 }}
                    />
                  ) : (
                    <Text style={[st.titulo, { color: colors.text.primary }]}>{g.nombre}</Text>
                  )}
                  <Pill texto={String(g.uids.length)} tono="neutro" icono="person" />
                </View>
                <View style={st.chips}>
                  {g.uids.length ? g.uids.map(chipEstudiante) : (
                    <Text style={[st.nota, { color: colors.text.tertiary }]}>{t('diferenciales.grupos.vacio')}</Text>
                  )}
                </View>
                <View style={st.fila}>
                  {editando === g.id ? (
                    <BotonChunky texto={t('diferenciales.grupos.listo')} icono="checkmark" compacto onPress={() => renombrar(g)} style={{ flex: 1 }} />
                  ) : (
                    <BotonChunky
                      texto={t('diferenciales.grupos.renombrar')}
                      icono="pencil"
                      variante="secundario"
                      compacto
                      onPress={() => {
                        setNombreNuevo(g.nombre);
                        setEditando(g.id);
                      }}
                      style={{ flex: 1 }}
                    />
                  )}
                  <BotonChunky texto={t('diferenciales.grupos.borrar')} icono="trash" variante="peligro" compacto onPress={() => borrar(g)} style={{ flex: 1 }} />
                </View>
                {colegioId && g.uids.length ? (
                  <AccionGrupo
                    colegioId={colegioId}
                    cursoId={cursoId}
                    titulo={t('diferenciales.grupos.accion', { nombre: g.nombre })}
                    estudiantes={g.uids.map((u) => ({ uid: u, nombre: nombreDe.get(u) ?? '' }))}
                    mundos={mundos}
                  />
                ) : null}
              </Tarjeta>
            ))}

            {vigentes.length && libres.length ? (
              <Tarjeta style={{ gap: 10 }}>
                <View style={st.cabeza}>
                  <View style={[st.punto, { backgroundColor: colors.text.quaternary }]} />
                  <Text style={[st.titulo, { color: colors.text.primary }]}>{t('diferenciales.grupos.sinGrupo')}</Text>
                  <Pill texto={String(libres.length)} tono="neutro" icono="person" />
                </View>
                <View style={st.chips}>{libres.map(chipEstudiante)}</View>
              </Tarjeta>
            ) : null}
            {vigentes.length ? (
              <Text style={[st.nota, { color: colors.text.tertiary }]}>{t('diferenciales.grupos.ayudaMover')}</Text>
            ) : null}
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
  fila: { flexDirection: 'row', gap: 10 },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  punto: { width: 14, height: 14, borderRadius: 7 },
  titulo: { flex: 1, fontSize: 18, fontWeight: '900' },
  est: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 2 },
  estTxt: { fontSize: 14, fontWeight: '800' },
});
