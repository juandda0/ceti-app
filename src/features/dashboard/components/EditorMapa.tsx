/**
 * Editor del mapa de un mundo (Fase 4): el profe decide qué preguntas van en
 * cada lección, en qué orden, y cuáles en el jefe. Sin cambios, el mapa se arma
 * solo. Se guarda como `contenido/mapa_{worldId}` (copy-on-write, igual que las
 * preguntas) y los estudiantes lo ven en su próxima carga.
 */
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Bounceable from '@shared/components/Bounceable';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import { questionBankRepository } from '@features/learning/data/QuestionBankRepository';
import type { Grado, QuizItem } from '@features/learning/data/quiz.types';
import {
  JEFE_MC,
  JEFE_ORDENAR,
  JEFE_VF,
  MAX_LECCIONES_MAPA,
  armarNiveles,
  validarMapa,
  type MapaMundo,
  type PoolMundo,
} from '@features/orbita/domain/niveles';
import { courseContentRepository } from '@features/dashboard/data/courseContentRepository';
import type { CursoConfigMundos } from '@shared/types/tenancy';
import {
  Aviso,
  BotonChunky,
  Chip,
  Esqueleto,
  Pill,
  Tarjeta,
} from '@features/dashboard/components/profe/kit';

type Lugar = number | 'jefe' | 'libre';
const ICONO_TIPO: Record<string, keyof typeof Ionicons.glyphMap> = {
  multiple_choice: 'list',
  true_false: 'checkmark-done',
  ordenar: 'swap-vertical',
  emparejar: 'git-compare',
  completar: 'text',
  numerica: 'calculator',
};

export default function EditorMapa({
  colegioId,
  cursoId,
  uid,
  config,
  grado,
  worldId,
  acento,
  puedeEditar,
}: {
  colegioId: string;
  cursoId: string;
  uid: string;
  config: CursoConfigMundos | null;
  grado: Grado;
  worldId: string;
  acento: string;
  /** Abre el muro del plan si no puede editar; devuelve si sigue. */
  puedeEditar: () => boolean;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [pool, setPool] = useState<PoolMundo | null>(null);
  const [lecciones, setLecciones] = useState<string[][]>([]);
  const [jefe, setJefe] = useState<string[]>([]);
  const [propio, setPropio] = useState(false);
  const [moviendo, setMoviendo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [cargado, setCargado] = useState(false);

  const overrides = config?.overrides?.[worldId];
  const contenido = useMemo(
    () => ({ colegioId, cursoId, overrides, version: config?.version ?? 0 }),
    [colegioId, cursoId, overrides, config?.version]
  );

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const [p, mapa] = await Promise.all([
        questionBankRepository.fetchPool(grado, worldId, contenido).catch(() => null),
        questionBankRepository.fetchMapa(worldId, contenido).catch(() => null),
      ]);
      if (cancelado) return;
      setPool(p);
      if (p) {
        // Sin mapa propio, se parte del armado automático (igual para todos).
        const base = mapa && validarMapa(mapa, p) === null ? mapa : null;
        const auto = armarNiveles(p, 'mapa');
        setLecciones(
          base
            ? base.lecciones.map((l) => [...l.preguntas])
            : auto.lecciones.map((l) => l.map((q) => q.id))
        );
        setJefe(base ? [...base.jefe] : auto.jefe.map((q) => q.id));
        setPropio(Boolean(base));
      }
      setCargado(true);
    })();
    return () => {
      cancelado = true;
    };
    // Solo al abrir el mundo: lo que el profe está moviendo no se pisa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grado, worldId]);

  const porId = useMemo(
    () =>
      new Map<string, QuizItem>(
        pool
          ? [...pool.mc, ...pool.vf, ...pool.ordenar, ...(pool.otros ?? [])].map((q) => [q.id, q])
          : []
      ),
    [pool]
  );
  const usados = new Set([...lecciones.flat(), ...jefe]);
  const libres = [...porId.keys()].filter((id) => !usados.has(id));
  const mapa: MapaMundo = { lecciones: lecciones.map((p) => ({ preguntas: p })), jefe };
  const error = pool ? validarMapa(mapa, pool) : null;
  const conteoJefe = (tipo: string) => jefe.filter((id) => porId.get(id)?.tipo === tipo).length;

  const quitarDeTodo = (id: string) => {
    setLecciones((ls) => ls.map((l) => l.filter((x) => x !== id)));
    setJefe((j) => j.filter((x) => x !== id));
  };
  const mover = (id: string, destino: Lugar) => {
    quitarDeTodo(id);
    if (destino === 'jefe') setJefe((j) => [...j, id]);
    else if (typeof destino === 'number')
      setLecciones((ls) => ls.map((l, i) => (i === destino ? [...l, id] : l)));
    setMoviendo(null);
  };
  const subir = (lista: number | 'jefe', id: string, delta: -1 | 1) => {
    const cambiar = (l: string[]) => {
      const i = l.indexOf(id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= l.length) return l;
      const copia = [...l];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    };
    if (lista === 'jefe') setJefe(cambiar);
    else setLecciones((ls) => ls.map((l, i) => (i === lista ? cambiar(l) : l)));
  };

  const guardar = async () => {
    if (!puedeEditar() || error) return;
    setOcupado(true);
    try {
      await courseContentRepository.savePiece({
        colegioId,
        cursoId,
        uid,
        config,
        worldId,
        piece: 'mapa',
        doc: { worldId, lecciones: mapa.lecciones, jefe, actualizadoAt: Date.now() },
      });
      setPropio(true);
      showMessage(t('editorMapa.guardado'), undefined, 'success');
    } catch (e) {
      showMessage(t('admin.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setOcupado(false);
    }
  };

  const restaurar = () =>
    confirmAction({
      title: t('editorMapa.restaurarTitulo'),
      body: t('editorMapa.restaurarTexto'),
      cancelLabel: t('admin.cancel'),
      confirmLabel: t('editorMapa.restaurar'),
      onConfirm: () => {
        void (async () => {
          setOcupado(true);
          try {
            await courseContentRepository.restorePiece({
              colegioId,
              cursoId,
              uid,
              config,
              worldId,
              piece: 'mapa',
            });
            if (pool) {
              const auto = armarNiveles(pool, 'mapa');
              setLecciones(auto.lecciones.map((l) => l.map((q) => q.id)));
              setJefe(auto.jefe.map((q) => q.id));
            }
            setPropio(false);
          } finally {
            setOcupado(false);
          }
        })();
      },
    });

  if (!cargado) return <Esqueleto filas={3} alto={120} />;
  if (!pool) return <Aviso icono="alert-circle" tono="naranja" texto={t('editorMapa.sinBanco')} />;

  const destinos: { lugar: Lugar; texto: string }[] = [
    ...lecciones.map((_, i) => ({
      lugar: i as Lugar,
      texto: t('editorMapa.leccionN', { n: i + 1 }),
    })),
    { lugar: 'jefe', texto: t('editorMapa.jefe') },
    { lugar: 'libre', texto: t('editorMapa.sinUsar') },
  ];

  const fila = (id: string, lista: number | 'jefe' | 'libre', i: number, total: number) => {
    const q = porId.get(id);
    if (!q) return null;
    return (
      <View
        key={id}
        style={[st.fila, i > 0 && { borderTopWidth: 1, borderTopColor: colors.materials.border }]}
      >
        <View style={st.filaArriba}>
          <Ionicons name={ICONO_TIPO[q.tipo] ?? 'help'} size={16} color={colors.text.tertiary} />
          <Text style={[st.enunciado, { color: colors.text.primary }]} numberOfLines={2}>
            {q.enunciado}
          </Text>
          {lista !== 'libre' ? (
            <>
              <Bounceable
                onPress={() => subir(lista, id, -1)}
                disabled={i === 0}
                accessibilityRole="button"
                accessibilityLabel={t('editorMapa.subir')}
                style={st.icono}
              >
                <Ionicons
                  name="chevron-up"
                  size={18}
                  color={i === 0 ? colors.text.quaternary : colors.text.secondary}
                />
              </Bounceable>
              <Bounceable
                onPress={() => subir(lista, id, 1)}
                disabled={i === total - 1}
                accessibilityRole="button"
                accessibilityLabel={t('editorMapa.bajar')}
                style={st.icono}
              >
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={i === total - 1 ? colors.text.quaternary : colors.text.secondary}
                />
              </Bounceable>
            </>
          ) : null}
          <Bounceable
            onPress={() => setMoviendo(moviendo === id ? null : id)}
            accessibilityRole="button"
            accessibilityLabel={t('editorMapa.mover')}
            style={[
              st.icono,
              { backgroundColor: moviendo === id ? acento + '33' : colors.materials.highlight },
            ]}
          >
            <Ionicons name="arrow-redo" size={16} color={colors.text.secondary} />
          </Bounceable>
        </View>
        {moviendo === id ? (
          <View style={st.chips}>
            {destinos
              .filter((d) => d.lugar !== lista)
              .map((d) => (
                <Chip
                  key={String(d.lugar)}
                  texto={d.texto}
                  color={acento}
                  seleccionado={false}
                  onPress={() => mover(id, d.lugar)}
                />
              ))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={st.vista}>
      <Aviso icono="map" tono="azul" texto={t('editorMapa.ayuda')} />
      <View style={st.chips}>
        <Pill
          tono={propio ? 'marca' : 'neutro'}
          icono={propio ? 'create' : 'shuffle'}
          texto={propio ? t('editorMapa.propio') : t('editorMapa.automatico')}
        />
      </View>

      {lecciones.map((l, n) => (
        <Tarjeta key={n} style={st.tarjeta}>
          <View style={st.cabeza}>
            <Text style={[st.titulo, { color: colors.text.primary }]}>
              {t('editorMapa.leccionN', { n: n + 1 })} ·{' '}
              {t('editorMapa.preguntasN', { count: l.length })}
            </Text>
            <Bounceable
              onPress={() => setLecciones((ls) => ls.filter((_, i) => i !== n))}
              disabled={lecciones.length <= 1}
              accessibilityRole="button"
              accessibilityLabel={t('editorMapa.quitarLeccion')}
              style={st.icono}
            >
              <Ionicons
                name="trash-outline"
                size={17}
                color={lecciones.length <= 1 ? colors.text.quaternary : colors.system.red}
              />
            </Bounceable>
          </View>
          {l.length === 0 ? (
            <Text style={[st.vacio, { color: colors.text.tertiary }]}>
              {t('editorMapa.leccionVacia')}
            </Text>
          ) : (
            l.map((id, i) => fila(id, n, i, l.length))
          )}
        </Tarjeta>
      ))}

      <BotonChunky
        texto={t('editorMapa.agregarLeccion')}
        icono="add"
        variante="secundario"
        compacto
        deshabilitado={lecciones.length >= MAX_LECCIONES_MAPA}
        onPress={() => setLecciones((ls) => [...ls, []])}
      />

      <Tarjeta style={st.tarjeta}>
        <View style={st.cabeza}>
          <Text style={[st.titulo, { color: colors.text.primary }]}>{t('editorMapa.jefe')}</Text>
          <Text style={[st.mini, { color: colors.text.secondary }]}>
            {t('editorMapa.conteoJefe', {
              mc: conteoJefe('multiple_choice'),
              vf: conteoJefe('true_false'),
              or: conteoJefe('ordenar'),
              mcN: JEFE_MC,
              vfN: JEFE_VF,
              orN: JEFE_ORDENAR,
            })}
          </Text>
        </View>
        {jefe.map((id, i) => fila(id, 'jefe', i, jefe.length))}
      </Tarjeta>

      {libres.length > 0 ? (
        <Tarjeta style={st.tarjeta}>
          <Text style={[st.titulo, { color: colors.text.primary }]}>
            {t('editorMapa.sinUsar')} ({libres.length})
          </Text>
          {libres.map((id, i) => fila(id, 'libre', i, libres.length))}
        </Tarjeta>
      ) : null}

      {error ? (
        <Aviso icono="alert-circle" tono="naranja" texto={t(`editorMapa.error_${error}`)} />
      ) : null}
      <BotonChunky
        texto={t('editorMapa.guardar')}
        icono="checkmark"
        color={acento}
        cargando={ocupado}
        deshabilitado={Boolean(error) || ocupado}
        onPress={() => void guardar()}
      />
      {propio ? (
        <BotonChunky
          texto={t('editorMapa.restaurar')}
          icono="shuffle"
          variante="secundario"
          compacto
          deshabilitado={ocupado}
          onPress={restaurar}
        />
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  vista: { gap: 12 },
  tarjeta: { gap: 6 },
  cabeza: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  titulo: { fontSize: 16, fontWeight: '900' },
  mini: { fontSize: 12, fontWeight: '700' },
  vacio: { fontSize: 14, fontWeight: '600', paddingVertical: 8 },
  fila: { gap: 8, paddingVertical: 8 },
  filaArriba: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  enunciado: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  icono: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
