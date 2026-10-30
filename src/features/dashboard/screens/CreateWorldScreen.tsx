/**
 * CreateWorldScreen — one-screen custom-world wizard (D-ORQ, RQ-PR12/CN06).
 *
 * The professor gives a name + description; "Generar preguntas" asks the Function
 * for a DRAFT (never persisted server-side), and "Guardar como borrador" writes
 * the world in ONE batch as an inactive entry (invisible to students). The manual
 * path ("crear vacío") creates just the entry — content is authored later in
 * the editor. Activation is gated by content minimums in ClassWorldsManager.
 *
 * UI copy rule: never surface "IA" to the user — the generation is presented as
 * "Generar preguntas" (the model is an implementation detail).
 */
import { useState } from 'react';
import { elegirPdfBase64 } from '@shared/lib/export/leerArchivo';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { adminService } from '@features/dashboard/data/adminService';
import { classConfigRepository } from '@features/dashboard/data/classConfigRepository';
import { courseContentRepository } from '@features/dashboard/data/courseContentRepository';
import {
  buildPiecesFromDraft,
  type MundoBorrador,
} from '@features/dashboard/data/courseContentSchemas';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import {
  ALL_COMPETENCIAS,
  COMPETENCIA_PERSONALIZADA,
  competenciaAmbitosMen,
} from '@features/learning/data/competencias';
import { AMBITOS_MEN, ALINEACION_MEN, type AmbitoMen } from '@/functions/src/educadores/dominio';
import { CUSTOM_WORLD_COLOR } from '@features/learning/data/worldMeta';
import { FadeIn } from '@features/savings/charts/ChartParts';
import { useMuro } from '@features/educadores/components/MuroPlan';
import { motivoDeError } from '@features/educadores/data/planUi';
import {
  BotonChunky,
  Campo,
  Chip,
  Encabezado,
  Tarjeta,
  tapsConTeclado,
} from '@features/dashboard/components/profe/kit';

export default function CreateWorldScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // Desde el análisis (repaso de lo que falla la clase) llegan nombre, tema y material.
  const params = useLocalSearchParams<{
    cursoId: string;
    nombre?: string;
    tema?: string;
    fuente?: string;
  }>();
  const cursoId = params.cursoId ?? '';
  const colegioId = useAuthStore((s) => s.colegioId) ?? '';
  const firebaseUid = useAuthStore((s) => s.firebaseUid) ?? '';

  const [nombre, setNombre] = useState(params.nombre ?? '');
  const [tema, setTema] = useState(params.tema ?? '');
  const [fuente, setFuente] = useState(params.fuente ?? '');
  const [leyendoPdf, setLeyendoPdf] = useState(false);
  const [competencia, setCompetencia] = useState<string | null>(null);
  // Ámbitos del MEN del mundo (Fase 7): arrancan con los de la competencia y el profe los ajusta.
  const [ambitos, setAmbitos] = useState<AmbitoMen[]>([]);
  const elegirCompetencia = (id: string | null) => {
    setCompetencia(id);
    setAmbitos(id ? [...(ALINEACION_MEN[id]?.ambitos ?? [])] : []);
  };
  const alternarAmbito = (id: AmbitoMen) =>
    setAmbitos((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const [draft, setDraft] = useState<MundoBorrador | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const accent = CUSTOM_WORLD_COLOR;
  // Mundos propios y borradores generados dependen del plan (el servidor lo hace cumplir).
  const muro = useMuro();

  const onGenerate = async () => {
    if (!nombre.trim()) {
      showMessage(t('createWorld.nombreRequired'));
      return;
    }
    setGenerating(true);
    try {
      const grado = (await rosterRepository.getCursoGrado(colegioId, cursoId)) ?? '9';
      const result = await adminService.generarBorradorMundo({
        colegioId,
        cursoId,
        nombre: nombre.trim(),
        tema: tema.trim() || nombre.trim(),
        grado,
        fuente: fuente.trim() || undefined,
      });
      setDraft(result);
    } catch (e) {
      const motivo = motivoDeError(e, 'iaAuthoring');
      if (motivo) {
        muro.abrir(motivo);
        return;
      }
      if (__DEV__) console.warn('[createWorld] generate error:', e);
      showMessage(t('createWorld.generateError'), undefined, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const subirPdf = async () => {
    if (!muro.exigir('iaAuthoring')) return;
    setLeyendoPdf(true);
    try {
      const pdf = await elegirPdfBase64();
      if (!pdf) return;
      const r = await adminService.extraerTextoPdf(pdf.base64);
      setFuente(r.texto);
      showMessage(
        t('createWorld.pdfListo', { nombre: pdf.nombre, paginas: r.paginas }),
        r.recortado ? t('createWorld.pdfRecortado') : undefined,
        'success'
      );
    } catch (e) {
      const motivo = motivoDeError(e, 'iaAuthoring');
      if (motivo) {
        muro.abrir(motivo);
        return;
      }
      showMessage(t('createWorld.pdfError'), e instanceof Error ? e.message : undefined, 'error');
    } finally {
      setLeyendoPdf(false);
    }
  };

  // Avisa que el borrador se crea a partir de la descripción del mundo (el tema).
  const onGeneratePress = () => {
    if (!nombre.trim()) {
      showMessage(t('createWorld.nombreRequired'));
      return;
    }
    if (!muro.exigir('iaAuthoring')) return;
    confirmAction({
      title: t('createWorld.generateConfirmTitle'),
      body: t('createWorld.generateConfirmBody'),
      confirmLabel: t('createWorld.generateConfirmCta'),
      cancelLabel: t('admin.cancel'),
      onConfirm: () => void onGenerate(),
    });
  };

  const onSave = async (withDraft: boolean) => {
    if (!nombre.trim()) {
      showMessage(t('createWorld.nombreRequired'));
      return;
    }
    if (!muro.exigir('mundosPropios')) return;
    setSaving(true);
    try {
      const [config, grado] = await Promise.all([
        classConfigRepository.get(colegioId, cursoId),
        rosterRepository.getCursoGrado(colegioId, cursoId).then((g) => g ?? '9'),
      ]);
      const worldId = `cw_${Date.now().toString(36)}`;
      const competenciaId = competencia ?? COMPETENCIA_PERSONALIZADA;
      const pieces =
        withDraft && draft ? buildPiecesFromDraft(draft, grado, worldId, competenciaId) : undefined;
      const created = await courseContentRepository.createCustomWorld({
        colegioId,
        cursoId,
        uid: firebaseUid,
        config,
        worldId,
        meta: {
          nombre: nombre.trim(),
          subtitle: draft?.subtitle,
          descripcion: draft?.descripcion || tema.trim() || undefined,
          competencia: competencia ?? undefined,
          ambitosMen: ambitos,
        },
        pieces,
      });
      if (created) {
        showMessage(t('createWorld.saved'), undefined, 'success');
        router.back();
      }
    } catch (e) {
      showMessage(t('admin.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const conteo = draft
    ? [
        { n: draft.teoria.length, label: t('profe.piezaTeoria'), icono: 'book' as const },
        { n: draft.mc.length, label: t('profe.piezaMc'), icono: 'list' as const },
        { n: draft.vf.length, label: t('profe.piezaVf'), icono: 'checkmark-done' as const },
        {
          n: draft.ordenar.length,
          label: t('profe.piezaOrdenar'),
          icono: 'swap-vertical' as const,
        },
        {
          n: draft.eligeCamino.length,
          label: t('profe.piezaSituaciones'),
          icono: 'git-branch' as const,
        },
      ]
    : [];

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[styles.page, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps={tapsConTeclado}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado
          atras="/(staff)/clases"
          sobretitulo={t('profe.sobreMundoNuevo')}
          titulo={t('createWorld.title')}
          subtitulo={t('createWorld.subtitle')}
        />

        <Campo
          etiqueta={t('createWorld.nombre')}
          value={nombre}
          onChangeText={setNombre}
          placeholder={t('createWorld.nombrePlaceholder')}
          maxLength={60}
          acento={accent}
        />
        <Campo
          etiqueta={t('createWorld.tema')}
          value={tema}
          onChangeText={setTema}
          placeholder={t('createWorld.temaPlaceholder')}
          multiline
          maxLength={200}
          acento={accent}
        />
        <Campo
          etiqueta={t('createWorld.fuente')}
          value={fuente}
          onChangeText={setFuente}
          placeholder={t('createWorld.fuentePlaceholder')}
          ayuda={t('createWorld.fuenteAyuda', { n: fuente.length.toLocaleString('es-CO') })}
          multiline
          maxLength={12000}
          acento={accent}
        />
        <BotonChunky
          texto={t('createWorld.subirPdf')}
          icono="document-attach-outline"
          variante="secundario"
          compacto
          color={accent}
          cargando={leyendoPdf}
          onPress={() => void subirPdf()}
        />

        <View style={{ gap: 10 }}>
          <Text style={[styles.etiqueta, { color: colors.text.secondary }]}>
            {t('createWorld.competencia')}
          </Text>
          <View style={styles.chips}>
            <Chip
              texto={t('createWorld.competenciaNinguna')}
              seleccionado={competencia === null}
              color={accent}
              onPress={() => elegirCompetencia(null)}
            />
            {ALL_COMPETENCIAS.map((c) => (
              <Chip
                key={c.id}
                texto={c.label}
                seleccionado={competencia === c.id}
                color={accent}
                onPress={() => elegirCompetencia(c.id)}
              />
            ))}
          </View>
          <Text style={[styles.ayuda, { color: colors.text.tertiary }]}>
            {competencia
              ? t('createWorld.ambitoMen', { ambitos: competenciaAmbitosMen(competencia) })
              : t('createWorld.competenciaHint')}
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={[styles.etiqueta, { color: colors.text.secondary }]}>
            {t('createWorld.ambitos')}
          </Text>
          <View style={styles.chips}>
            {AMBITOS_MEN.map((a) => (
              <Chip
                key={a.id}
                texto={a.nombre}
                seleccionado={ambitos.includes(a.id)}
                color={accent}
                onPress={() => alternarAmbito(a.id)}
              />
            ))}
          </View>
          <Text style={[styles.ayuda, { color: colors.text.tertiary }]}>
            {t('createWorld.ambitosHint')}
          </Text>
        </View>

        {/* Generar preguntas (borrador a partir de la descripción del mundo) */}
        <BotonChunky
          texto={generating ? t('createWorld.generating') : t('createWorld.generate')}
          icono="sparkles"
          variante="secundario"
          color={accent}
          cargando={generating}
          deshabilitado={saving}
          onPress={onGeneratePress}
        />

        {draft ? (
          <FadeIn>
            <Tarjeta style={{ gap: 14 }}>
              <View style={styles.listoFila}>
                <View style={[styles.listoIcono, { backgroundColor: accent + '22' }]}>
                  <Ionicons name="checkmark-circle" size={22} color={accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.listoTitulo, { color: colors.text.primary }]}>
                    {t('profe.borradorListo')}
                  </Text>
                  <Text style={[styles.ayuda, { color: colors.text.tertiary }]}>
                    {t('profe.borradorListoSub')}
                  </Text>
                </View>
              </View>
              <View style={styles.conteo}>
                {conteo.map((c, i) => (
                  <FadeIn key={c.label} delay={80 + i * 60}>
                    <View style={[styles.pieza, { backgroundColor: colors.materials.highlight }]}>
                      <Ionicons name={c.icono} size={16} color={accent} />
                      <Text style={[styles.piezaNum, { color: colors.text.primary }]}>{c.n}</Text>
                      <Text
                        style={[styles.piezaLabel, { color: colors.text.tertiary }]}
                        numberOfLines={1}
                      >
                        {c.label}
                      </Text>
                    </View>
                  </FadeIn>
                ))}
              </View>
            </Tarjeta>
          </FadeIn>
        ) : null}

        <View style={{ gap: 6 }}>
          <BotonChunky
            texto={draft ? t('createWorld.saveDraft') : t('createWorld.createEmpty')}
            icono={draft ? 'save' : 'rocket'}
            color={accent}
            cargando={saving}
            deshabilitado={!draft && generating}
            onPress={() => void onSave(true)}
          />
          {draft ? (
            <Pressable
              onPress={() => void onSave(false)}
              disabled={saving}
              accessibilityRole="button"
              style={styles.secundario}
            >
              <Text style={[styles.secundarioTexto, { color: colors.text.tertiary }]}>
                {t('createWorld.createEmptyDiscard')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ContextScrollView>
      {muro.hoja}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 18 },
  etiqueta: { fontSize: 14, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ayuda: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  listoFila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listoIcono: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listoTitulo: { fontSize: 18, fontWeight: '900' },
  conteo: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pieza: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  piezaNum: { fontSize: 16, fontWeight: '900' },
  piezaLabel: { fontSize: 13, fontWeight: '700' },
  secundario: { alignItems: 'center', paddingVertical: 10 },
  secundarioTexto: { fontSize: 14, fontWeight: '700' },
});
