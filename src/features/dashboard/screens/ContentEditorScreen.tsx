/**
 * ContentEditorScreen — per-world content editor for the profesor
 * (D-ORQ, RQ-PR11). Reached from "Personalizar" in ClassWorldsManager — an
 * advanced, secondary flow: a professor who never customizes never sees it.
 *
 * Tabs: Preguntas (MC / V-F / Ordenar) · Teoría · Info del mundo.
 * Saving a piece performs the copy-on-write (courseContentRepository): the
 * global default is never mutated; "Restaurar" deletes the course copy.
 * Quiz minimums (4/3/3, R9) are enforced on save so the class never breaks.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
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
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { worldDefById } from '@features/learning/data/worldMeta';
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
  const router = useRouter();
  const params = useLocalSearchParams<{ cursoId: string; worldId: string }>();
  const cursoId = params.cursoId ?? '';
  const worldId = params.worldId ?? '';
  const colegioId = useAuthStore((s) => s.colegioId) ?? '';
  const authUid = useAuthStore((s) => s.uid) ?? '';

  const def = worldDefById(worldId);

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
        uid: authUid,
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
        uid: authUid,
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

  const restorePiece = (piece: ContentPiece) =>
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
            uid: authUid,
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

  const saveMeta = () =>
    guard(async () => {
      await courseContentRepository.saveWorldMeta({
        colegioId,
        cursoId,
        uid: authUid,
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
  const accent = def?.color ?? colors.brand.primary;
  const currentSource = tab === 'info' ? null : (pieceSource[tab] ?? null);

  const inputStyle = [
    styles.input,
    {
      color: colors.text.primary,
      backgroundColor: colors.background.secondary,
      borderColor: colors.materials.border,
    },
  ];

  return (
    <ScreenWrapper style={{ flex: 1, backgroundColor: colors.background.base }}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('quiz.back')}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text.secondary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text.primary }]}>
          {t('contentEditor.title', { name: displayName })}
        </Text>
        <Text style={[styles.subtitle, { color: colors.text.tertiary }]}>
          {t('contentEditor.subtitle')}
        </Text>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {TABS.map((tb) => (
            <TouchableOpacity
              key={tb}
              onPress={() => setTab(tb)}
              accessibilityRole="button"
              style={[
                styles.tabChip,
                {
                  backgroundColor: tab === tb ? accent : colors.background.secondary,
                },
              ]}
            >
              <Text
                style={[styles.tabChipText, { color: tab === tb ? '#fff' : colors.text.secondary }]}
              >
                {t(`contentEditor.tab_${tb}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {currentSource && (
          <View style={styles.sourceRow}>
            <Ionicons
              name={currentSource === 'custom' ? 'create-outline' : 'library-outline'}
              size={14}
              color={currentSource === 'custom' ? accent : colors.text.tertiary}
            />
            <Text
              style={[
                styles.sourceText,
                { color: currentSource === 'custom' ? accent : colors.text.tertiary },
              ]}
            >
              {t(
                currentSource === 'custom'
                  ? 'contentEditor.sourceCustom'
                  : 'contentEditor.sourceDefault'
              )}
            </Text>
            {currentSource === 'custom' && tab !== 'info' && (
              <TouchableOpacity onPress={() => restorePiece(tab)} accessibilityRole="button">
                <Text style={[styles.restoreLink, { color: colors.system.red }]}>
                  {t('contentEditor.restore')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {!configLoaded || !grado ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={accent} />
        ) : tab === 'info' ? (
          <View style={styles.section}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
              {t('contentEditor.metaNombre')}
            </Text>
            <TextInput
              style={inputStyle}
              value={metaDraft.nombre}
              onChangeText={(v) => setMetaDraft((m) => ({ ...m, nombre: v }))}
              placeholder={def?.name}
              placeholderTextColor={colors.text.quaternary}
              maxLength={60}
            />
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
              {t('contentEditor.metaSubtitle')}
            </Text>
            <TextInput
              style={inputStyle}
              value={metaDraft.subtitle}
              onChangeText={(v) => setMetaDraft((m) => ({ ...m, subtitle: v }))}
              placeholder={def?.subtitle}
              placeholderTextColor={colors.text.quaternary}
              maxLength={80}
            />
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
              {t('contentEditor.metaDescripcion')}
            </Text>
            <TextInput
              style={[...inputStyle, styles.multiline]}
              value={metaDraft.descripcion}
              onChangeText={(v) => setMetaDraft((m) => ({ ...m, descripcion: v }))}
              placeholder={def?.description}
              placeholderTextColor={colors.text.quaternary}
              multiline
              maxLength={200}
            />
            <Text style={[styles.helpText, { color: colors.text.quaternary }]}>
              {t('contentEditor.metaHint')}
            </Text>
            <PrimaryButton
              label={t('contentEditor.save')}
              color={accent}
              disabled={busy}
              onPress={() => void saveMeta()}
            />
          </View>
        ) : tab === 'teoria' ? (
          cards === null ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={accent} />
          ) : (
            <View style={styles.section}>
              {cards.map((card, i) => (
                <View key={i} style={[styles.itemCard, { borderColor: colors.materials.border }]}>
                  <ItemHeader
                    label={t('contentEditor.cardN', { n: i + 1 })}
                    colors={colors}
                    onRemove={() => setCards((prev) => (prev ?? []).filter((_, j) => j !== i))}
                    removeLabel={t('contentEditor.removeItem')}
                  />
                  <TextInput
                    style={inputStyle}
                    value={card.titulo}
                    onChangeText={(v) =>
                      setCards((prev) =>
                        (prev ?? []).map((c, j) => (j === i ? { ...c, titulo: v } : c))
                      )
                    }
                    placeholder={t('contentEditor.cardTitulo')}
                    placeholderTextColor={colors.text.quaternary}
                    maxLength={80}
                  />
                  <TextInput
                    style={[...inputStyle, styles.multiline]}
                    value={card.cuerpo}
                    onChangeText={(v) =>
                      setCards((prev) =>
                        (prev ?? []).map((c, j) => (j === i ? { ...c, cuerpo: v } : c))
                      )
                    }
                    placeholder={t('contentEditor.cardCuerpo')}
                    placeholderTextColor={colors.text.quaternary}
                    multiline
                    maxLength={600}
                  />
                  <TextInput
                    style={[...inputStyle, styles.multiline]}
                    value={card.ejemplo ?? ''}
                    onChangeText={(v) =>
                      setCards((prev) =>
                        (prev ?? []).map((c, j) =>
                          j === i ? { ...c, ejemplo: v || undefined } : c
                        )
                      )
                    }
                    placeholder={t('contentEditor.cardEjemplo')}
                    placeholderTextColor={colors.text.quaternary}
                    multiline
                    maxLength={400}
                  />
                </View>
              ))}
              <AddButton
                label={t('contentEditor.addCard')}
                colors={colors}
                onPress={() => setCards((prev) => [...(prev ?? []), { titulo: '', cuerpo: '' }])}
              />
              <GenerateButton
                label={t('contentEditor.generateCard')}
                accent={accent}
                onPress={() => setSheetOpen(true)}
              />
              <PrimaryButton
                label={t('contentEditor.save')}
                color={accent}
                disabled={busy}
                onPress={() => void saveTeoria()}
              />
            </View>
          )
        ) : items[tab] === undefined ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={accent} />
        ) : (
          <View style={styles.section}>
            {(items[tab] ?? []).map((item, i) => (
              <View
                key={item.id}
                style={[styles.itemCard, { borderColor: colors.materials.border }]}
              >
                <ItemHeader
                  label={t('contentEditor.itemN', { n: i + 1 })}
                  colors={colors}
                  onRemove={() => removeItem(tab, i)}
                  removeLabel={t('contentEditor.removeItem')}
                />
                <TextInput
                  style={[...inputStyle, styles.multiline]}
                  value={item.enunciado}
                  onChangeText={(v) => updateItem(tab, i, { enunciado: v })}
                  placeholder={t('contentEditor.enunciado')}
                  placeholderTextColor={colors.text.quaternary}
                  multiline
                  maxLength={400}
                />
                {item.tipo === 'multiple_choice' && (
                  <McFields
                    item={item as MultipleChoiceItem}
                    colors={colors}
                    accent={accent}
                    inputStyle={inputStyle}
                    t={t}
                    onChange={(patch) => updateItem(tab, i, patch)}
                  />
                )}
                {item.tipo === 'true_false' && (
                  <View style={styles.vfRow}>
                    <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
                      {t('contentEditor.respuestaVerdadera')}
                    </Text>
                    <Switch
                      value={(item as TrueFalseItem).respuesta}
                      onValueChange={(v) => updateItem(tab, i, { respuesta: v })}
                    />
                  </View>
                )}
                {item.tipo === 'ordenar' && (
                  <OrdenarFields
                    elements={item.elementosCanonicos ?? []}
                    colors={colors}
                    inputStyle={inputStyle}
                    t={t}
                    onChange={(elementosCanonicos) => updateItem(tab, i, { elementosCanonicos })}
                  />
                )}
                <TextInput
                  style={inputStyle}
                  value={item.explicacion ?? ''}
                  onChangeText={(v) => updateItem(tab, i, { explicacion: v || undefined })}
                  placeholder={t('contentEditor.explicacion')}
                  placeholderTextColor={colors.text.quaternary}
                  maxLength={400}
                />
              </View>
            ))}
            <Text style={[styles.helpText, { color: colors.text.quaternary }]}>
              {t('contentEditor.quizMinHint', { n: QUIZ_MINIMUMS[tab] })}
            </Text>
            <AddButton
              label={t('contentEditor.addItem')}
              colors={colors}
              onPress={() => addItem(tab)}
            />
            <GenerateButton
              label={t('contentEditor.generateItem')}
              accent={accent}
              onPress={() => setSheetOpen(true)}
            />
            <PrimaryButton
              label={t('contentEditor.save')}
              color={accent}
              disabled={busy}
              onPress={() => void saveQuizPiece(tab)}
            />
          </View>
        )}
      </ScrollView>
      {tab !== 'info' && (
        <GenerateContentSheet
          visible={sheetOpen}
          kind={tab === 'teoria' ? 'teoria' : 'quiz'}
          accent={accent}
          generating={genBusy}
          onClose={() => !genBusy && setSheetOpen(false)}
          onGenerate={(detalle) => void runGenerate(detalle)}
        />
      )}
    </ScreenWrapper>
  );
}

// ── Small building blocks ─────────────────────────────────────────────────────

function GenerateButton({
  label,
  accent,
  onPress,
}: {
  label: string;
  accent: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.generateBtn, { borderColor: accent }]}
    >
      <Ionicons name="sparkles-outline" size={16} color={accent} />
      <Text style={[styles.generateBtnText, { color: accent }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ItemHeader({
  label,
  colors,
  onRemove,
  removeLabel,
}: {
  label: string;
  colors: ThemeColors;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <View style={styles.itemHeader}>
      <Text style={[styles.itemLabel, { color: colors.text.tertiary }]}>{label}</Text>
      <TouchableOpacity
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={removeLabel}
      >
        <Ionicons name="trash-outline" size={16} color={colors.system.red} />
      </TouchableOpacity>
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
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.addBtn, { borderColor: colors.materials.border }]}
    >
      <Ionicons name="add" size={16} color={colors.text.secondary} />
      <Text style={[styles.addBtnText, { color: colors.text.secondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PrimaryButton({
  label,
  color,
  disabled,
  onPress,
}: {
  label: string;
  color: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[styles.saveBtn, { backgroundColor: color, opacity: disabled ? 0.6 : 1 }]}
    >
      <Text style={styles.saveBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function McFields({
  item,
  colors,
  accent,
  inputStyle,
  t,
  onChange,
}: {
  item: MultipleChoiceItem;
  colors: ThemeColors;
  accent: string;
  inputStyle: object[];
  t: (key: string, options?: Record<string, unknown>) => string;
  onChange: (patch: Partial<MultipleChoiceItem>) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      {item.opciones.map((op, j) => (
        <View key={j} style={styles.optionRow}>
          <TouchableOpacity
            onPress={() => onChange({ correctIndex: j })}
            accessibilityRole="radio"
            accessibilityState={{ selected: item.correctIndex === j }}
            accessibilityLabel={t('contentEditor.markCorrect', { n: j + 1 })}
          >
            <Ionicons
              name={item.correctIndex === j ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={item.correctIndex === j ? accent : colors.text.quaternary}
            />
          </TouchableOpacity>
          <TextInput
            style={[...inputStyle, { flex: 1 }]}
            value={op}
            onChangeText={(v) =>
              onChange({ opciones: item.opciones.map((o, k) => (k === j ? v : o)) })
            }
            placeholder={t('contentEditor.opcionN', { n: j + 1 })}
            placeholderTextColor={colors.text.quaternary}
            maxLength={160}
          />
        </View>
      ))}
    </View>
  );
}

function OrdenarFields({
  elements,
  colors,
  inputStyle,
  t,
  onChange,
}: {
  elements: string[];
  colors: ThemeColors;
  inputStyle: object[];
  t: (key: string, options?: Record<string, unknown>) => string;
  onChange: (elements: string[]) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.helpText, { color: colors.text.quaternary }]}>
        {t('contentEditor.ordenarHint')}
      </Text>
      {elements.map((el, j) => (
        <View key={j} style={styles.optionRow}>
          <Text style={[styles.ordenNum, { color: colors.text.tertiary }]}>{j + 1}.</Text>
          <TextInput
            style={[...inputStyle, { flex: 1 }]}
            value={el}
            onChangeText={(v) => onChange(elements.map((e, k) => (k === j ? v : e)))}
            placeholder={t('contentEditor.elementoN', { n: j + 1 })}
            placeholderTextColor={colors.text.quaternary}
            maxLength={160}
          />
          {elements.length > 3 && (
            <TouchableOpacity
              onPress={() => onChange(elements.filter((_, k) => k !== j))}
              accessibilityRole="button"
              accessibilityLabel={t('contentEditor.removeItem')}
            >
              <Ionicons name="close" size={16} color={colors.text.quaternary} />
            </TouchableOpacity>
          )}
        </View>
      ))}
      {elements.length < 6 && (
        <TouchableOpacity
          onPress={() => onChange([...elements, ''])}
          accessibilityRole="button"
          style={styles.addElementBtn}
        >
          <Text style={[styles.addBtnText, { color: colors.text.secondary }]}>
            {t('contentEditor.addElemento')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingBottom: 64, gap: 10 },
  backBtn: { alignSelf: 'flex-start', padding: 4 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13, lineHeight: 18 },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  tabChip: { borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  tabChipText: { fontSize: 12, fontWeight: '700' },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  sourceText: { fontSize: 12, fontWeight: '600', flex: 1 },
  restoreLink: { fontSize: 12, fontWeight: '700' },
  section: { gap: 12, marginTop: 8 },
  itemCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  fieldLabel: { fontSize: 12, fontWeight: '700' },
  helpText: { fontSize: 11, lineHeight: 15 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ordenNum: { fontSize: 13, fontWeight: '700', width: 18 },
  vfRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 10,
  },
  addElementBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  addBtnText: { fontSize: 13, fontWeight: '700' },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 12,
  },
  generateBtnText: { fontSize: 14, fontWeight: '800' },
  saveBtn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
