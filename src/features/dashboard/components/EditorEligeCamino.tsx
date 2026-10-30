/**
 * Editor de "Elige camino" (Fase 4): las situaciones con dos opciones y la
 * consecuencia de cada una. Copy-on-write como el resto del contenido: la
 * copia de la clase vive en `contenido/eligeCamino_{worldId}`.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Bounceable from '@shared/components/Bounceable';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import { eligeCaminoRepository } from '@features/learning/data/eligeCaminoRepository';
import type { Situacion } from '@features/learning/data/content.types';
import type { Grado } from '@features/learning/data/quiz.types';
import { courseContentRepository } from '@features/dashboard/data/courseContentRepository';
import type { CursoConfigMundos } from '@shared/types/tenancy';
import {
  Aviso,
  BotonChunky,
  Campo,
  Esqueleto,
  Pill,
  Tarjeta,
} from '@features/dashboard/components/profe/kit';

export const MAX_SITUACIONES = 30;
const MAX_TEXTO = 300;

/** null si la situación está completa; si no, la clave del error. */
export function errorSituacion(s: Situacion): string | null {
  const textos = [
    s.enunciado,
    s.opcionA.texto,
    s.opcionA.consecuencia,
    s.opcionB.texto,
    s.opcionB.consecuencia,
  ];
  if (textos.some((x) => !x.trim())) return 'incompleta';
  if (textos.some((x) => x.length > MAX_TEXTO)) return 'larga';
  return null;
}

const nueva = (): Situacion => ({
  id: `sit_${Date.now().toString(36)}`,
  enunciado: '',
  opcionA: { texto: '', consecuencia: '' },
  opcionB: { texto: '', consecuencia: '' },
});

export default function EditorEligeCamino({
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
  puedeEditar: () => boolean;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [situaciones, setSituaciones] = useState<Situacion[] | null>(null);
  const [propio, setPropio] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const custom = Boolean(config?.overrides?.[worldId]?.eligeCamino);

  useEffect(() => {
    let cancelado = false;
    void eligeCaminoRepository
      .fetch(grado, worldId, custom ? { colegioId, cursoId } : null)
      .then((banco) => {
        if (cancelado) return;
        setSituaciones(
          banco?.situaciones?.map((s) => ({
            ...s,
            opcionA: { ...s.opcionA },
            opcionB: { ...s.opcionB },
          })) ?? []
        );
        setPropio(custom);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grado, worldId]);

  if (situaciones == null) return <Esqueleto filas={2} alto={160} />;

  const cambiar = (i: number, f: (s: Situacion) => Situacion) =>
    setSituaciones((ss) => (ss ?? []).map((s, k) => (k === i ? f(s) : s)));
  const errores = situaciones.map(errorSituacion);
  const listo = situaciones.length > 0 && errores.every((e) => e === null);

  const guardar = async () => {
    if (!puedeEditar() || !listo) return;
    setOcupado(true);
    try {
      await courseContentRepository.savePiece({
        colegioId,
        cursoId,
        uid,
        config,
        worldId,
        piece: 'eligeCamino',
        doc: {
          bancoId: `eligeCamino_${worldId}`,
          grado,
          worldId,
          situaciones: situaciones.map((s) => ({
            ...s,
            enunciado: s.enunciado.trim(),
            opcionA: { texto: s.opcionA.texto.trim(), consecuencia: s.opcionA.consecuencia.trim() },
            opcionB: { texto: s.opcionB.texto.trim(), consecuencia: s.opcionB.consecuencia.trim() },
          })),
          pendiente_validacion_docente: false,
        },
      });
      setPropio(true);
      showMessage(t('editorCamino.guardado'), undefined, 'success');
    } catch (e) {
      showMessage(t('admin.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setOcupado(false);
    }
  };

  const restaurar = () =>
    confirmAction({
      title: t('editorCamino.restaurarTitulo'),
      body: t('editorCamino.restaurarTexto'),
      cancelLabel: t('admin.cancel'),
      confirmLabel: t('contentEditor.restore'),
      destructive: true,
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
              piece: 'eligeCamino',
            });
            const banco = await eligeCaminoRepository.fetch(grado, worldId, null);
            setSituaciones(banco?.situaciones ?? []);
            setPropio(false);
          } finally {
            setOcupado(false);
          }
        })();
      },
    });

  const opcion = (i: number, lado: 'opcionA' | 'opcionB', s: Situacion) => (
    <View style={[st.opcion, { borderColor: colors.materials.border }]}>
      <Text style={[st.letra, { color: acento }]}>{lado === 'opcionA' ? 'A' : 'B'}</Text>
      <View style={st.flex}>
        <Campo
          etiqueta={t('editorCamino.opcion')}
          value={s[lado].texto}
          onChangeText={(v) => cambiar(i, (x) => ({ ...x, [lado]: { ...x[lado], texto: v } }))}
          maxLength={MAX_TEXTO}
          acento={acento}
        />
        <Campo
          etiqueta={t('editorCamino.consecuencia')}
          value={s[lado].consecuencia}
          onChangeText={(v) =>
            cambiar(i, (x) => ({ ...x, [lado]: { ...x[lado], consecuencia: v } }))
          }
          multiline
          maxLength={MAX_TEXTO}
          acento={acento}
        />
      </View>
    </View>
  );

  return (
    <View style={st.vista}>
      <Aviso icono="git-branch" tono="azul" texto={t('editorCamino.ayuda')} />
      <View style={st.fila}>
        <Pill
          tono={propio ? 'marca' : 'neutro'}
          icono={propio ? 'create' : 'library'}
          texto={t(propio ? 'contentEditor.sourceCustom' : 'contentEditor.sourceDefault')}
        />
      </View>
      {situaciones.length === 0 ? (
        <Text style={[st.vacio, { color: colors.text.tertiary }]}>{t('editorCamino.vacio')}</Text>
      ) : null}
      {situaciones.map((s, i) => (
        <Tarjeta key={s.id} style={st.tarjeta}>
          <View style={st.cabeza}>
            <Text style={[st.titulo, { color: colors.text.primary }]}>
              {t('editorCamino.situacionN', { n: i + 1 })}
            </Text>
            <Bounceable
              onPress={() => setSituaciones((ss) => (ss ?? []).filter((_, k) => k !== i))}
              accessibilityRole="button"
              accessibilityLabel={t('editorCamino.quitar')}
              style={st.icono}
            >
              <Ionicons name="trash-outline" size={17} color={colors.system.red} />
            </Bounceable>
          </View>
          <Campo
            etiqueta={t('editorCamino.enunciado')}
            value={s.enunciado}
            onChangeText={(v) => cambiar(i, (x) => ({ ...x, enunciado: v }))}
            multiline
            maxLength={MAX_TEXTO}
            acento={acento}
          />
          {opcion(i, 'opcionA', s)}
          {opcion(i, 'opcionB', s)}
          {errores[i] ? (
            <Text style={[st.error, { color: colors.system.red }]}>
              {t(`editorCamino.error_${errores[i]}`)}
            </Text>
          ) : null}
        </Tarjeta>
      ))}
      <BotonChunky
        texto={t('editorCamino.agregar')}
        icono="add"
        variante="secundario"
        compacto
        deshabilitado={situaciones.length >= MAX_SITUACIONES}
        onPress={() => setSituaciones((ss) => [...(ss ?? []), nueva()])}
      />
      <BotonChunky
        texto={t('editorCamino.guardar')}
        icono="checkmark"
        color={acento}
        cargando={ocupado}
        deshabilitado={!listo || ocupado}
        onPress={() => void guardar()}
      />
      {propio ? (
        <BotonChunky
          texto={t('contentEditor.restore')}
          icono="refresh"
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
  fila: { flexDirection: 'row', gap: 8 },
  tarjeta: { gap: 12 },
  cabeza: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { fontSize: 16, fontWeight: '900' },
  icono: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opcion: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 14, padding: 10 },
  letra: { fontSize: 18, fontWeight: '900', width: 18 },
  flex: { flex: 1, gap: 8 },
  vacio: { fontSize: 14, fontWeight: '600' },
  error: { fontSize: 13, fontWeight: '700' },
});
