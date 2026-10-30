/**
 * Fase 9 — en la ficha del estudiante: sus tareas abiertas, con la nota o si
 * falta calificar. Tocar una abre la tarea para calificarla.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Pill, Seccion, Tarjeta } from '@features/dashboard/components/profe/kit';
import { tareasAbiertasRepository, type EntregaGuardada, type TareaConId } from '../data/tareasAbiertasRepository';

const nota = (n: number) => n.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function TareasAbiertasFicha({ colegioId, cursoId, uid }: { colegioId: string; cursoId: string; uid: string }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const [filas, setFilas] = useState<{ tarea: TareaConId; entrega: EntregaGuardada | null }[] | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const tareas = await tareasAbiertasRepository.listar(colegioId, cursoId).catch(() => []);
      const entregas = await Promise.all(tareas.map((x) => tareasAbiertasRepository.miEntrega(colegioId, cursoId, x.id, uid).catch(() => null)));
      if (vivo) setFilas(tareas.map((tarea, i) => ({ tarea, entrega: entregas[i] })));
    })();
    return () => {
      vivo = false;
    };
  }, [colegioId, cursoId, uid]);

  if (!filas || filas.length === 0) return null;
  return (
    <>
      <Seccion texto={t('rubricas.ficha')} />
      <Tarjeta style={{ gap: 0, paddingVertical: 4 }}>
        {filas.map(({ tarea, entrega }, i) => (
          <View key={tarea.id} style={[st.fila, i > 0 && { borderTopWidth: 1, borderTopColor: colors.materials.border }]}>
            <Text
              style={[st.titulo, { color: colors.text.primary }]}
              numberOfLines={1}
              onPress={() => router.push(`/(staff)/tareas-abiertas/${cursoId}?tarea=${tarea.id}` as Href)}
            >
              {tarea.titulo}
            </Text>
            {entrega?.calificacion ? (
              <Pill texto={nota(entrega.calificacion.nota)} tono="verde" />
            ) : entrega ? (
              <Pill texto={t('rubricas.sinCalificar')} tono="naranja" />
            ) : (
              <Pill texto={t('rubricas.noEntrego')} tono="neutro" />
            )}
          </View>
        ))}
      </Tarjeta>
    </>
  );
}

const st = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  titulo: { flex: 1, fontSize: 15, fontWeight: '800' },
});
