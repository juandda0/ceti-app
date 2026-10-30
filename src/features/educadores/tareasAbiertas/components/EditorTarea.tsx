/**
 * Fase 9 — crear o editar una tarea abierta: título, consigna, fecha de entrega
 * y la rúbrica (2 a 6 criterios; cuatro niveles con puntos 1 a 4 y un
 * descriptor corto). La validación final la hace el servidor (leerTarea).
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import {
  DIA_MS,
  MAX_CONSIGNA,
  MAX_CRITERIOS,
  MAX_DESCRIPTOR,
  MAX_NOMBRE_CRITERIO,
  MAX_TITULO_TAREA,
  MIN_CRITERIOS,
  criterioVacio,
  rubricaInicial,
  type CriterioRubrica,
} from '@/functions/src/educadores/dominio';
import { BotonChunky, Campo, Chip, Seccion, Tarjeta } from '@features/dashboard/components/profe/kit';
import type { TareaEditable } from '../data/tareasAbiertasRepository';

const PLAZOS = [null, 3, 7, 14] as const;

export default function EditorTarea({
  inicial,
  guardando,
  onGuardar,
  onCancelar,
}: {
  inicial?: TareaEditable | null;
  guardando: boolean;
  onGuardar: (t: TareaEditable) => void;
  onCancelar: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '');
  const [consigna, setConsigna] = useState(inicial?.consigna ?? '');
  const [plazo, setPlazo] = useState<number | null>(inicial ? null : 7);
  const [deadline] = useState<number | null>(inicial?.deadline ?? null);
  const [criterios, setCriterios] = useState<CriterioRubrica[]>(inicial?.rubrica.criterios ?? rubricaInicial().criterios);

  const cambiar = (i: number, f: (c: CriterioRubrica) => CriterioRubrica) =>
    setCriterios((cs) => cs.map((c, j) => (j === i ? f(c) : c)));

  const guardar = () => {
    // Al editar sin tocar el plazo se conserva la fecha que tenía.
    const fin = plazo === null ? (inicial && plazo === null ? deadline : null) : Date.now() + plazo * DIA_MS;
    onGuardar({ titulo: titulo.trim(), consigna: consigna.trim(), rubrica: { criterios }, deadline: fin, worldId: inicial?.worldId ?? null });
  };

  return (
    <Tarjeta style={{ gap: 12 }}>
      <Campo etiqueta={t('rubricas.editor.titulo')} value={titulo} onChangeText={setTitulo} maxLength={MAX_TITULO_TAREA} placeholder={t('rubricas.editor.tituloEj')} />
      <Campo
        etiqueta={t('rubricas.editor.consigna')}
        value={consigna}
        onChangeText={setConsigna}
        multiline
        maxLength={MAX_CONSIGNA}
        placeholder={t('rubricas.editor.consignaEj')}
      />
      <Seccion texto={t('rubricas.editor.plazo')} />
      <View style={st.chips}>
        {PLAZOS.map((p) => (
          <Chip
            key={String(p)}
            texto={p === null ? (inicial && deadline ? t('rubricas.editor.mismaFecha') : t('rubricas.editor.sinFecha')) : t('rubricas.editor.enDias', { count: p })}
            seleccionado={plazo === p}
            onPress={() => setPlazo(p)}
          />
        ))}
      </View>

      <Seccion texto={t('rubricas.editor.rubrica')} />
      <Text style={[st.ayuda, { color: colors.text.tertiary }]}>{t('rubricas.editor.rubricaAyuda')}</Text>
      {criterios.map((c, i) => (
        <View key={i} style={[st.criterio, { borderColor: colors.materials.border }]}>
          <View style={st.cabeza}>
            <Campo
              etiqueta={t('rubricas.editor.criterio', { n: i + 1 })}
              value={c.nombre}
              onChangeText={(v) => cambiar(i, (x) => ({ ...x, nombre: v }))}
              maxLength={MAX_NOMBRE_CRITERIO}
              style={{ flex: 1 }}
            />
          </View>
          {c.niveles.map((n, j) => (
            <Campo
              key={j}
              etiqueta={`${n.nombre} · ${t('rubricas.puntos', { count: n.puntos })}`}
              value={n.descriptor}
              onChangeText={(v) => cambiar(i, (x) => ({ ...x, niveles: x.niveles.map((y, k) => (k === j ? { ...y, descriptor: v } : y)) }))}
              maxLength={MAX_DESCRIPTOR}
              placeholder={t('rubricas.editor.descriptorEj')}
            />
          ))}
          {criterios.length > MIN_CRITERIOS ? (
            <Chip
              texto={t('rubricas.editor.quitarCriterio')}
              icono="remove-circle-outline"
              seleccionado={false}
              color={colors.system.red}
              onPress={() => setCriterios((cs) => cs.filter((_, k) => k !== i))}
            />
          ) : null}
        </View>
      ))}
      {criterios.length < MAX_CRITERIOS ? (
        <Chip texto={t('rubricas.editor.agregarCriterio')} icono="add-circle-outline" seleccionado={false} onPress={() => setCriterios((cs) => [...cs, criterioVacio('')])} />
      ) : null}

      <BotonChunky texto={t('rubricas.editor.guardar')} icono="checkmark" cargando={guardando} deshabilitado={!titulo.trim() || !consigna.trim()} onPress={guardar} />
      <BotonChunky texto={t('rubricas.editor.cancelar')} variante="secundario" onPress={onCancelar} />
    </Tarjeta>
  );
}

const st = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ayuda: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  criterio: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 8 },
  cabeza: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
});
