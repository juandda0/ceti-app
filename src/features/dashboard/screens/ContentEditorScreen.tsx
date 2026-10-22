/**
 * ContentEditorScreen — per-world content editor for the profesor
 * (D-ORQ, RQ-PR11). Reached from "Personalizar" in ClassWorldsManager — an
 * advanced, secondary flow: a professor who never customizes never sees it.
 *
 * Tabs: Preguntas (MC / V-F / Ordenar) · Teoría · Info del mundo.
 * Saving a piece performs the copy-on-write (courseContentRepository): the
 * global default is never mutated; "Restaurar" deletes the course copy.
 * Quiz minimums (4/3/3, R9) are enforced on save so the class never breaks.
 *
 * Misma piel que el estudiante: cada pregunta es una tarjeta, las opciones se
 * marcan como en el quiz (V/F con dos botones grandes) y "Guardar" queda fijo
 * abajo, siempre a mano.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import Bounceable from '@shared/components/Bounceable';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import { listExit, listLayout } from '@shared/constants/motion';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { adminService } from '@features/dashboard/data/adminService';
import { classConfigRepository } from '@features/dashboard/data/classConfigRepository';
import {
  courseContentRepository,
  PIECE_TO_TIPO,
  type ContentPiece,
} from '@features/dashboard/data/courseContentRepository';
import {
  QUIZ_MINIMUMS,
  buildOrdenarElements,
  canonicalElements,
  microteoriaCardSchema,
  newMcItem,
  newOrdenarItem,
  newVfItem,
  validateQuizItem,
  type BorradorMcItem,
  type BorradorOrdenarItem,
  type BorradorTeoriaCard,
  type BorradorVfItem,
} from '@features/dashboard/data/courseContentSchemas';
import GenerateContentSheet from '@features/dashboard/components/GenerateContentSheet';
import { useMuro } from '@features/educadores/components/MuroPlan';
import { motivoDeError } from '@features/educadores/data/planUi';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { worldDefById } from '@features/learning/data/worldMeta';
import { planetaDeMundo } from '@features/learning/data/planetas';
import { CetiAnimation } from '@features/animations';
import {
  COMPETENCIA_PERSONALIZADA,
  competenciaForWorld,
} from '@features/learning/data/competencias';
import type {
  MultipleChoiceItem,
  OrdenarItem,
  QuizItem,
  TrueFalseItem,
  Grado,
} from '@features/learning/data/quiz.types';
import type { MicroteoriaCard } from '@features/learning/data/content.types';
import type { CursoConfigMundos } from '@shared/types/tenancy';
import type { ThemeColors } from '@shared/constants/colors';
import { FadeIn } from '@features/savings/charts/ChartParts';
import {
  BotonChunky,
  Campo,
  Chip,
  Encabezado,
  Esqueleto,
  Pill,
  Tarjeta,
  tapsConTeclado,
} from '@features/dashboard/components/profe/kit';

type QuizPiece = 'mc' | 'vf' | 'ordenar';
type Tab = QuizPiece | 'teoria' | 'info';
const TABS: Tab[] = ['mc', 'vf', 'ordenar', 'teoria', 'info'];

// Editing shape for ordenar: elements kept in CORRECT order while editing;
// shuffled deterministically on save (buildOrdenarElements).
type EditingItem = QuizItem & { elementosCanonicos?: string[] };

export default function ContentEditorScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ cursoId: string; worldId: string }>();
  const cursoId = params.cursoId ?? '';
  const worldId = params.worldId ?? '';
  const colegioId = useAuthStore((s) => s.colegioId) ?? '';
  const firebaseUid = useAuthStore((s) => s.firebaseUid) ?? '';

  const def = worldDefById(worldId);
  // Editar y generar dependen del plan; el muro se abre en vez de guardar (el servidor y
  // firestore.rules lo hacen cumplir igual).
  const muro = useMuro();

  const [config, setConfig] = useState<CursoConfigMundos | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [grado, setGrado] = useState<Grado | null>(null);
  const [tab, setTab] = useState<Tab>('mc');
  const [busy, setBusy] = useState(false);

  // Per-piece drafts (null = not loaded yet). Loaded lazily per tab.
  const [items, setItems] = useState<Partial<Record<QuizPiece, EditingItem[]>>>({});
  const [cards, setCards] = useState<MicroteoriaCard[] | null>(null);
  const [pieceSource, setPieceSource] = useState<
    Partial<Record<ContentPiece, 'custom' | 'default'>>
  >({});

  const entry = config?.mundos?.find((m) => m.worldId === worldId);
  // Competency stamped on new items: the default world's mapping, or the
  // custom world's assigned competency, or 'personalizada' (RQ-PR12 CA2).
  const competenciaId =
    competenciaForWorld(worldId)?.id ?? entry?.competencia ?? COMPETENCIA_PERSONALIZADA;
  const [metaDraft, setMetaDraft] = useState({ nombre: '', subtitle: '', descripcion: '' });

  useEffect(() => {
    if (!colegioId || !cursoId) return;
    return classConfigRepository.subscribe(colegioId, cursoId, (c) => {
      setConfig(c);
      setConfigLoaded(true);
    });
  }, [colegioId, cursoId]);

  useEffect(() => {
    if (!colegioId || !cursoId) return;
    void rosterRepository.getCursoGrado(colegioId, cursoId).then((g) => setGrado(g ?? '9'));
  }, [colegioId, cursoId]);

  // Seed the Info draft ONCE per world (not on every snapshot): a concurrent
  // config write must not wipe what the professor is typing (draft wins).
  const metaSeededRef = useRef<string | null>(null);
  useEffect(() => {
    if (!configLoaded || metaSeededRef.current === worldId) return;
    metaSeededRef.current = worldId;
    setMetaDraft({
      nombre: entry?.nombre ?? '',
      subtitle: entry?.subtitle ?? '',
      descripcion: entry?.descripcion ?? '',
    });
  }, [configLoaded, worldId, entry?.nombre, entry?.subtitle, entry?.descripcion]);

  const overrides = config?.overrides?.[worldId];

  const loadQuizPiece = useCallback(
    async (piece: QuizPiece) => {
      if (!grado || items[piece]) return;
      const isCustom = Boolean(overrides?.[piece]);
      const { doc, source } = await courseContentRepository.loadResolvedBanco(
        colegioId,
        cursoId,
        grado,
        worldId,
        piece,
        isCustom
      );
      const tipo = PIECE_TO_TIPO[piece];
      const loaded: EditingItem[] = (doc?.items ?? []).map((it) => {
        const item = { ...it, tipo } as EditingItem;
        if (item.tipo === 'ordenar') {
          item.elementosCanonicos = canonicalElements(item as OrdenarItem);
        }
        return item;
      });
      setItems((prev) => ({ ...prev, [piece]: loaded }));
      setPieceSource((prev) => ({ ...prev, [piece]: source }));
    },
    [grado, items, overrides, colegioId, cursoId, worldId]
  );

  const loadTeoria = useCallback(async () => {
    if (!grado || cards) return;
    const isCustom = Boolean(overrides?.teoria);
    const { doc, source } = await courseContentRepository.loadResolvedMicroteoria(
      colegioId,
      cursoId,
      grado,
      worldId,
      isCustom
    );
    setCards(doc?.cards?.map((c) => ({ ...c })) ?? []);
    setPieceSource((prev) => ({ ...prev, teoria: source }));
  }, [grado, cards, overrides, colegioId, cursoId, worldId]);

  useEffect(() => {
    if (!grado || !configLoaded) return;
    if (tab === 'teoria') void loadTeoria();
    else if (tab !== 'info') void loadQuizPiece(tab);
  }, [tab, grado, configLoaded, loadQuizPiece, loadTeoria]);

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      showMessage(t('admin.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  // ── Save / restore ──────────────────────────────────────────────────────────

  const saveQuizPiece = (piece: QuizPiece) =>
    guard(async () => {
      const draft = items[piece] ?? [];
      const min = QUIZ_MINIMUMS[piece];
      if (draft.length < min) {
        showMessage(t('contentEditor.minItems', { n: min }));
        return;
      }
      const finalItems: QuizItem[] = [];
      for (let i = 0; i < draft.length; i++) {
        let item = { ...draft[i] } as EditingItem;
        if (item.tipo === 'ordenar') {
          const canon = (item.elementosCanonicos ?? []).map((e) => e.trim()).filter(Boolean);
          const built = buildOrdenarElements(item.id, item.enunciado, canon);
          item = { ...item, elementos: built.elementos, ordenCanonico: built.ordenCanonico };
        }
        delete item.elementosCanonicos;
        const error = validateQuizItem(item as QuizItem);
        if (error) {
          showMessage(t('contentEditor.invalidItem', { n: i + 1 }), error, 'error');
          return;
        }
        finalItems.push(item as QuizItem);
      }
      const tipo = PIECE_TO_TIPO[piece];
      const ok = await courseContentRepository.savePiece({
        colegioId,
        cursoId,
        uid: firebaseUid,
        config,
        worldId,
        piece,
        doc: {
          bancoId: `banco_${worldId}_${tipo}`,
          grado: grado ?? '9',
          worldId,
          tipo,
          version: (config?.version ?? 0) + 1,
          generadoPor: 'profesor',
          pendiente_validacion_docente: false,
          items: finalItems,
        },
      });
      if (ok) {
        setPieceSource((prev) => ({ ...prev, [piece]: 'custom' }));
        showMessage(t('contentEditor.saved'), undefined, 'success');
      }
    });

  const saveTeoria = () =>
    guard(async () => {
      const draft = cards ?? [];
      if (draft.length < QUIZ_MINIMUMS.teoria) {
        showMessage(t('contentEditor.minCards'));
        return;
      }
      for (let i = 0; i < draft.length; i++) {
        const result = microteoriaCardSchema.safeParse(draft[i]);
        if (!result.success) {
          const issue = result.error.issues[0];
          showMessage(
            t('contentEditor.invalidCard', { n: i + 1 }),
            `${issue.path.join('.')}: ${issue.message}`,
            'error'
          );
          return;
        }
      }
      const ok = await courseContentRepository.savePiece({
        colegioId,
        cursoId,
        uid: firebaseUid,
        config,
        worldId,
        piece: 'teoria',
        doc: {
          grado: grado ?? '9',
          worldId,
          cards: draft,
          generadoPor: 'profesor',
          pendiente_validacion_docente: false,
        },
      });
      if (ok) {
        setPieceSource((prev) => ({ ...prev, teoria: 'custom' }));
        showMessage(t('contentEditor.saved'), undefined, 'success');
      }
    });

  const restorePiece = (piece: ContentPiece) => {
    if (!muro.exigir('editarContenido')) return;
    confirmAction({
      title: t('contentEditor.restoreConfirmTitle'),
      body: t('contentEditor.restoreConfirmBody'),
      confirmLabel: t('contentEditor.restore'),
      cancelLabel: t('admin.cancel'),
      destructive: true,
      onConfirm: () =>
        void guard(async () => {
          await courseContentRepository.restorePiece({
            colegioId,
            cursoId,
            uid: firebaseUid,
            config,
            worldId,
            piece,
          });
          // Drop the local draft so the tab reloads the default content.
          if (piece === 'teoria') setCards(null);
          else setItems((prev) => ({ ...prev, [piece]: undefined }));
          setPieceSource((prev) => ({ ...prev, [piece]: 'default' }));
        }),
    });
  };

  const saveMeta = () =>
    guard(async () => {
      await courseContentRepository.saveWorldMeta({
        colegioId,
        cursoId,
        uid: firebaseUid,
        config,
        worldId,
        meta: metaDraft,
      });
      showMessage(t('contentEditor.saved'));
    });

  // ── Item mutators ───────────────────────────────────────────────────────────

  const updateItem = (piece: QuizPiece, index: number, patch: Partial<EditingItem>) =>
    setItems((prev) => ({
      ...prev,
      [piece]: (prev[piece] ?? []).map((it, i) => (i === index ? { ...it, ...patch } : it)),
    }));

  const removeItem = (piece: QuizPiece, index: number) =>
    setItems((prev) => ({
      ...prev,
      [piece]: (prev[piece] ?? []).filter((_, i) => i !== index),
    }));

  const addItem = (piece: QuizPiece) => {
    const id = `p_${Date.now().toString(36)}`;
    const item: EditingItem =
      piece === 'mc'
        ? newMcItem(id, competenciaId)
        : piece === 'vf'
          ? newVfItem(id, competenciaId)
          : { ...newOrdenarItem(id, competenciaId), elementosCanonicos: ['', '', ''] };
    setItems((prev) => ({ ...prev, [piece]: [...(prev[piece] ?? []), item] }));
  };

  // ── Generar una pieza (RQ-CN06) ──────────────────────────────────────────────
  const [sheetOpen, setSheetOpen] = useState(false);
  const [genBusy, setGenBusy] = useState(false);

  const runGenerate = async (detalle: string) => {
    if (!grado || tab === 'info') return;
    setGenBusy(true);
    try {
      const nombre = (metaDraft.nombre || entry?.nombre || def?.name || worldId).trim();
      const descripcion = (
        metaDraft.descripcion ||
        entry?.descripcion ||
        def?.description ||
        nombre
      ).trim();

      // Teoría como contexto para las preguntas (no para generar teoría misma).
      let teoriaCtx: string[] | undefined;
      if (tab !== 'teoria') {
        let ctxCards = cards;
        if (!ctxCards) {
          const { doc } = await courseContentRepository.loadResolvedMicroteoria(
            colegioId,
            cursoId,
            grado,
            worldId,
            Boolean(overrides?.teoria)
          );
          ctxCards = doc?.cards ?? [];
        }
        teoriaCtx = ctxCards.map((c) => `${c.titulo}: ${c.cuerpo}`).filter(Boolean);
      }

      // Piezas ya escritas de esta sección → el modelo no las repite.
      const previas =
        tab === 'teoria'
          ? (cards ?? []).map((c) => c.titulo).filter(Boolean)
          : (items[tab] ?? []).map((i) => i.enunciado).filter(Boolean);
      const esPrimera = previas.length === 0;

      const generated = await adminService.generarItemContenido({
        colegioId,
        cursoId,
        tipo: tab,
        nombre,
        descripcion,
        grado,
        esPrimera,
        detalle: detalle.trim() || undefined,
        teoria: teoriaCtx,
        previas,
      });

      // Curva de dificultad suave: la primera arranca fácil (R7-friendly, sin ML).
      const dificultad = esPrimera ? 1 : Math.min(3, 1 + Math.floor(previas.length / 2));

      if (tab === 'teoria') {
        const card = generated as BorradorTeoriaCard;
        setCards((prev) => [
          ...(prev ?? []),
          {
            titulo: card.titulo,
            cuerpo: card.cuerpo,
            ...(card.ejemplo ? { ejemplo: card.ejemplo } : {}),
          },
        ]);
      } else {
        const id = `g_${Date.now().toString(36)}`;
        let item: EditingItem;
        if (tab === 'mc') {
          const g = generated as BorradorMcItem;
          item = {
            ...newMcItem(id, competenciaId),
            enunciado: g.enunciado,
            opciones: g.opciones,
            correctIndex: g.correctIndex,
            dificultad,
            explicacion: g.explicacion,
          };
        } else if (tab === 'vf') {
          const g = generated as BorradorVfItem;
          item = {
            ...newVfItem(id, competenciaId),
            enunciado: g.enunciado,
            respuesta: g.respuesta,
            dificultad,
            explicacion: g.explicacion,
          };
        } else {
          const g = generated as BorradorOrdenarItem;
          item = {
            ...newOrdenarItem(id, competenciaId),
            enunciado: g.enunciado,
            dificultad,
            explicacion: g.explicacion,
            elementosCanonicos: g.elementosCorrectos,
          };
        }
        setItems((prev) => ({ ...prev, [tab]: [...(prev[tab] ?? []), item] }));
      }
      setSheetOpen(false);
    } catch (e) {
      // Límite de plan o de ayudas del mes: lo muestra la hoja de generar (abre el muro).
      if (motivoDeError(e, 'iaAuthoring')) {
        setSheetOpen(false);
        throw e;
      }
      if (__DEV__) console.warn('[contentEditor] generate error', e);
      showMessage(t('contentEditor.generateError'), undefined, 'error');
    } finally {
      setGenBusy(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!colegioId || !cursoId || !worldId) {
    return null;
  }

  const displayName = entry?.nombre ?? def?.name ?? worldId;
  // Mismo planeta (y acento) que ve el estudiante para este mundo en Tu Galaxia.
  // (Mismo cálculo que la lista de Mundos: lugar entre los visibles, o en la lista si está oculto.)
  const mundosClase = config?.mundos ?? [];
  const posVisible = mundosClase
    .filter((m) => m.activo)
    .map((m) => m.worldId)
    .indexOf(worldId);
  const planeta = planetaDeMundo(
    worldId,
    posVisible >= 0
      ? posVisible
      : Math.max(
          0,
          mundosClase.findIndex((m) => m.worldId === worldId)
        )
  );
  const accent = planeta.acento;
  const currentSource = tab === 'info' ? null : (pieceSource[tab] ?? null);
  const cargando = !configLoaded || !grado;
  const tabListo =
    tab === 'info' ? true : tab === 'teoria' ? cards !== null : items[tab] !== undefined;

  const onSave = () => {
    if (!muro.exigir('editarContenido')) return;
    if (tab === 'info') void saveMeta();
    else if (tab === 'teoria') void saveTeoria();
    else void saveQuizPiece(tab);
  };

  const quizCount = tab !== 'info' && tab !== 'teoria' ? (items[tab]?.length ?? 0) : 0;

  let body: ReactNode;
  if (cargando || !tabListo) {
    body = <Esqueleto filas={3} alto={150} />;
  } else if (tab === 'info') {
    body = (
      <View style={styles.section}>
        <Tarjeta style={{ gap: 16 }}>
          <Campo
            etiqueta={t('contentEditor.metaNombre')}
            value={metaDraft.nombre}
            onChangeText={(v) => setMetaDraft((m) => ({ ...m, nombre: v }))}
            placeholder={def?.name}
            maxLength={60}
            acento={accent}
          />
          <Campo
            etiqueta={t('contentEditor.metaSubtitle')}
            value={metaDraft.subtitle}
            onChangeText={(v) => setMetaDraft((m) => ({ ...m, subtitle: v }))}
            placeholder={def?.subtitle}
            maxLength={80}
            acento={accent}
          />
          <Campo
            etiqueta={t('contentEditor.metaDescripcion')}
            value={metaDraft.descripcion}
            onChangeText={(v) => setMetaDraft((m) => ({ ...m, descripcion: v }))}
            placeholder={def?.description}
            multiline
            maxLength={200}
            acento={accent}
          />
        </Tarjeta>
        <Text style={[styles.helpText, { color: colors.text.tertiary }]}>
          {t('contentEditor.metaHint')}
        </Text>
      </View>
    );
  } else if (tab === 'teoria') {
    body = (
      <View style={styles.section}>
        {(cards ?? []).map((card, i) => (
          <Animated.View key={i} exiting={listExit} layout={listLayout}>
            <FadeIn delay={Math.min(i, 5) * 50}>
              <Tarjeta style={styles.itemCard}>
                <ItemHeader
                  label={t('contentEditor.cardN', { n: i + 1 })}
                  n={i + 1}
                  accent={accent}
                  colors={colors}
                  onRemove={() => setCards((prev) => (prev ?? []).filter((_, j) => j !== i))}
                  removeLabel={t('contentEditor.removeItem')}
                />
                <Campo
                  value={card.titulo}
                  onChangeText={(v) =>
                    setCards((prev) =>
                      (prev ?? []).map((c, j) => (j === i ? { ...c, titulo: v } : c))
                    )
                  }
                  placeholder={t('contentEditor.cardTitulo')}
                  maxLength={80}
                  acento={accent}
                />
                <Campo
                  value={card.cuerpo}
                  onChangeText={(v) =>
                    setCards((prev) =>
                      (prev ?? []).map((c, j) => (j === i ? { ...c, cuerpo: v } : c))
                    )
                  }
                  placeholder={t('contentEditor.cardCuerpo')}
                  multiline
                  maxLength={600}
                  acento={accent}
                />
                <Campo
                  value={card.ejemplo ?? ''}
                  onChangeText={(v) =>
                    setCards((prev) =>
                      (prev ?? []).map((c, j) => (j === i ? { ...c, ejemplo: v || undefined } : c))
                    )
                  }
                  placeholder={t('contentEditor.cardEjemplo')}
                  multiline
                  maxLength={400}
                  acento={accent}
                />
              </Tarjeta>
            </FadeIn>
          </Animated.View>
        ))}
        <AddButton
          label={t('contentEditor.addCard')}
          colors={colors}
          onPress={() => setCards((prev) => [...(prev ?? []), { titulo: '', cuerpo: '' }])}
        />
        <BotonChunky
          texto={t('contentEditor.generateCard')}
          icono="sparkles"
          variante="secundario"
          color={accent}
          onPress={() => muro.exigir('iaAuthoring') && setSheetOpen(true)}
        />
      </View>
    );
  } else {
    body = (
      <View style={styles.section}>
        <Pill
          texto={t('profe.minimoPreguntas', { n: quizCount, min: QUIZ_MINIMUMS[tab] })}
          tono={quizCount >= QUIZ_MINIMUMS[tab] ? 'verde' : 'naranja'}
          icono={quizCount >= QUIZ_MINIMUMS[tab] ? 'checkmark-circle' : 'alert-circle'}
        />
        {(items[tab] ?? []).map((item, i) => (
          <Animated.View key={item.id} exiting={listExit} layout={listLayout}>
            <FadeIn delay={Math.min(i, 5) * 50}>
              <Tarjeta style={styles.itemCard}>
                <ItemHeader
                  label={t('contentEditor.itemN', { n: i + 1 })}
                  n={i + 1}
                  accent={accent}
                  colors={colors}
                  onRemove={() => removeItem(tab, i)}
                  removeLabel={t('contentEditor.removeItem')}
                />
                <Campo
                  value={item.enunciado}
                  onChangeText={(v) => updateItem(tab, i, { enunciado: v })}
                  placeholder={t('contentEditor.enunciado')}
                  multiline
                  maxLength={400}
                  acento={accent}
                />
                {item.tipo === 'multiple_choice' && (
                  <McFields
                    item={item as MultipleChoiceItem}
                    colors={colors}
                    accent={accent}
                    t={t}
                    onChange={(patch) => updateItem(tab, i, patch)}
                  />
                )}
                {item.tipo === 'true_false' && (
                  <View style={{ gap: 8 }}>
                    <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
                      {t('profe.laRespuestaEs')}
                    </Text>
                    <View style={styles.vfRow}>
                      <Chip
                        grande
                        icono="checkmark-circle"
                        texto={t('profe.verdadero')}
                        color={colors.system.green}
                        seleccionado={(item as TrueFalseItem).respuesta === true}
                        onPress={() => updateItem(tab, i, { respuesta: true })}
                      />
                      <Chip
                        grande
                        icono="close-circle"
                        texto={t('profe.falso')}
                        color={colors.system.red}
                        seleccionado={(item as TrueFalseItem).respuesta === false}
                        onPress={() => updateItem(tab, i, { respuesta: false })}
                      />
                    </View>
                  </View>
                )}
                {item.tipo === 'ordenar' && (
                  <OrdenarFields
                    elements={item.elementosCanonicos ?? []}
                    colors={colors}
                    accent={accent}
                    t={t}
                    onChange={(elementosCanonicos) => updateItem(tab, i, { elementosCanonicos })}
                  />
                )}
                <Campo
                  value={item.explicacion ?? ''}
                  onChangeText={(v) => updateItem(tab, i, { explicacion: v || undefined })}
                  placeholder={t('contentEditor.explicacion')}
                  maxLength={400}
                  acento={accent}
                />
              </Tarjeta>
            </FadeIn>
          </Animated.View>
        ))}
        <Text style={[styles.helpText, { color: colors.text.tertiary }]}>
          {t('contentEditor.quizMinHint', { n: QUIZ_MINIMUMS[tab] })}
        </Text>
        <AddButton
          label={t('contentEditor.addItem')}
          colors={colors}
          onPress={() => addItem(tab)}
        />
        <BotonChunky
          texto={t('contentEditor.generateItem')}
          icono="sparkles"
          variante="secundario"
          color={accent}
          onPress={() => muro.exigir('iaAuthoring') && setSheetOpen(true)}
        />
      </View>
    );
  }

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[
          styles.page,
          { paddingTop: insets.top + 12, paddingBottom: 120 + insets.bottom },
        ]}
        keyboardShouldPersistTaps={tapsConTeclado}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado
          atras="/(staff)/clases"
          sobretitulo={t('profe.sobreEditor')}
          titulo={displayName}
          subtitulo={t('contentEditor.subtitle')}
          derecha={<CetiAnimation id={planeta.animacion} size={76} />}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
          style={styles.tabScroll}
        >
          {TABS.map((tb) => (
            <Chip
              key={tb}
              texto={t(`contentEditor.tab_${tb}`)}
              icono={TAB_ICON[tb]}
              color={accent}
              seleccionado={tab === tb}
              onPress={() => setTab(tb)}
            />
          ))}
        </ScrollView>

        {currentSource ? (
          <View style={styles.sourceRow}>
            <Pill
              texto={t(
                currentSource === 'custom'
                  ? 'contentEditor.sourceCustom'
                  : 'contentEditor.sourceDefault'
              )}
              tono={currentSource === 'custom' ? 'marca' : 'neutro'}
              icono={currentSource === 'custom' ? 'create' : 'library'}
            />
            {currentSource === 'custom' && tab !== 'info' ? (
              <Pressable
                onPress={() => restorePiece(tab)}
                accessibilityRole="button"
                hitSlop={8}
                style={styles.restore}
              >
                <Ionicons name="refresh" size={14} color={colors.system.red} />
                <Text style={[styles.restoreLink, { color: colors.system.red }]}>
                  {t('contentEditor.restore')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* key={tab}: al cambiar de sección el contenido entra suave. */}
        <FadeIn key={tab}>{body}</FadeIn>
      </ContextScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 12) + 4,
            backgroundColor: colors.background.base,
            borderTopColor: colors.materials.border,
          },
        ]}
      >
        <BotonChunky
          texto={t('contentEditor.save')}
          icono="checkmark"
          color={accent}
          colorOscuro={planeta.acentoOscuro}
          cargando={busy}
          deshabilitado={cargando || !tabListo}
          onPress={onSave}
        />
      </View>

      {tab !== 'info' && (
        <GenerateContentSheet
          visible={sheetOpen}
          kind={tab === 'teoria' ? 'teoria' : 'quiz'}
          accent={accent}
          generating={genBusy}
          onClose={() => !genBusy && setSheetOpen(false)}
          onGenerate={(detalle) => runGenerate(detalle)}
        />
      )}
      {muro.hoja}
    </ScreenWrapper>
  );
}

const TAB_ICON: Record<Tab, keyof typeof Ionicons.glyphMap> = {
  mc: 'list',
  vf: 'checkmark-done',
  ordenar: 'swap-vertical',
  teoria: 'book',
  info: 'information-circle',
};

// ── Small building blocks ─────────────────────────────────────────────────────

function ItemHeader({
  label,
  n,
  accent,
  colors,
  onRemove,
  removeLabel,
}: {
  label: string;
  n: number;
  accent: string;
  colors: ThemeColors;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <View style={styles.itemHeader}>
      <View style={[styles.itemNum, { backgroundColor: accent + '26' }]}>
        <Text style={[styles.itemNumText, { color: colors.text.primary }]}>{n}</Text>
      </View>
      <Text style={[styles.itemLabel, { color: colors.text.tertiary }]}>{label.toUpperCase()}</Text>
      <Bounceable
        onPress={onRemove}
        activeScale={0.9}
        accessibilityRole="button"
        accessibilityLabel={removeLabel}
        style={[styles.removeBtn, { backgroundColor: colors.fill.redSubtle }]}
      >
        <Ionicons name="trash-outline" size={16} color={colors.system.red} />
      </Bounceable>
    </View>
  );
}

function AddButton({
  label,
  colors,
  onPress,
}: {
  label: string;
  colors: ThemeColors;
  onPress: () => void;
}) {
  return (
    <Bounceable
      onPress={onPress}
      activeScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.addBtn, { borderColor: colors.materials.border }]}
    >
      <Ionicons name="add-circle" size={20} color={colors.text.secondary} />
      <Text style={[styles.addBtnText, { color: colors.text.secondary }]}>{label}</Text>
    </Bounceable>
  );
}

function McFields({
  item,
  colors,
  accent,
  t,
  onChange,
}: {
  item: MultipleChoiceItem;
  colors: ThemeColors;
  accent: string;
  t: (key: string, options?: Record<string, unknown>) => string;
  onChange: (patch: Partial<MultipleChoiceItem>) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      {item.opciones.map((op, j) => {
        const correcta = item.correctIndex === j;
        return (
          <View key={j} style={styles.optionRow}>
            <Bounceable
              onPress={() => onChange({ correctIndex: j })}
              activeScale={0.88}
              accessibilityRole="radio"
              accessibilityState={{ selected: correcta }}
              accessibilityLabel={t('contentEditor.markCorrect', { n: j + 1 })}
              style={[
                styles.radio,
                correcta
                  ? { backgroundColor: colors.system.green, borderColor: colors.system.green }
                  : { borderColor: colors.materials.border },
              ]}
            >
              {correcta ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
            </Bounceable>
            <Campo
              value={op}
              onChangeText={(v) =>
                onChange({ opciones: item.opciones.map((o, k) => (k === j ? v : o)) })
              }
              placeholder={t('contentEditor.opcionN', { n: j + 1 })}
              maxLength={160}
              acento={accent}
              style={{ flex: 1 }}
              inputStyle={correcta ? { borderColor: colors.system.green } : undefined}
            />
          </View>
        );
      })}
    </View>
  );
}

function OrdenarFields({
  elements,
  colors,
  accent,
  t,
  onChange,
}: {
  elements: string[];
  colors: ThemeColors;
  accent: string;
  t: (key: string, options?: Record<string, unknown>) => string;
  onChange: (elements: string[]) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.helpText, { color: colors.text.tertiary }]}>
        {t('contentEditor.ordenarHint')}
      </Text>
      {elements.map((el, j) => (
        <View key={j} style={styles.optionRow}>
          <View style={[styles.ordenNum, { backgroundColor: accent + '26' }]}>
            <Text style={[styles.ordenNumText, { color: colors.text.primary }]}>{j + 1}</Text>
          </View>
          <Campo
            value={el}
            onChangeText={(v) => onChange(elements.map((e, k) => (k === j ? v : e)))}
            placeholder={t('contentEditor.elementoN', { n: j + 1 })}
            maxLength={160}
            acento={accent}
            style={{ flex: 1 }}
          />
          {elements.length > 3 && (
            <Bounceable
              onPress={() => onChange(elements.filter((_, k) => k !== j))}
              activeScale={0.9}
              accessibilityRole="button"
              accessibilityLabel={t('contentEditor.removeItem')}
              style={[styles.removeBtn, { backgroundColor: colors.materials.highlight }]}
            >
              <Ionicons name="close" size={16} color={colors.text.secondary} />
            </Bounceable>
          )}
        </View>
      ))}
      {elements.length < 6 && (
        <Pressable
          onPress={() => onChange([...elements, ''])}
          accessibilityRole="button"
          style={styles.addElementBtn}
        >
          <Text style={[styles.addBtnText, { color: colors.text.secondary }]}>
            {t('contentEditor.addElemento')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, gap: 14 },
  tabScroll: { marginHorizontal: -20 },
  tabRow: { gap: 8, paddingHorizontal: 20 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  restore: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  restoreLink: { fontSize: 13, fontWeight: '800' },
  section: { gap: 14 },
  itemCard: { gap: 12 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemNum: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemNumText: { fontSize: 14, fontWeight: '900' },
  itemLabel: { flex: 1, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  removeBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: { fontSize: 14, fontWeight: '800' },
  helpText: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  radio: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ordenNum: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ordenNumText: { fontSize: 14, fontWeight: '900' },
  vfRow: { flexDirection: 'row', gap: 10 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 18,
    paddingVertical: 14,
  },
  addElementBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  addBtnText: { fontSize: 15, fontWeight: '800' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
