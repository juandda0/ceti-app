/**
 * Fase 9 — hoja para que el profe diga cuándo se abre un mundo de su clase:
 * desde una fecha, después de otro mundo y con una nota mínima en ese mundo.
 * Se guarda en la entrada del mundo en `config/mundos` (`requisitos`).
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { fechaEnDias, leerRequisitos, type RequisitosMundo } from '@/functions/src/educadores/dominio';
import { BotonChunky, Campo, Chip, Seccion } from '@features/dashboard/components/profe/kit';

const NOTAS = [3, 3.5, 4] as const;
const ATAJOS = [
  { dias: 1, clave: 'manana' },
  { dias: 7, clave: 'semana' },
  { dias: 14, clave: 'dosSemanas' },
] as const;

export default function RequisitosMundoHoja({
  mundo,
  otros,
  onGuardar,
  onCerrar,
}: {
  /** null = cerrada. */
  mundo: { worldId: string; nombre: string; requisitos?: RequisitosMundo } | null;
  /** Mundos de la clase que pueden ir antes (encendidos, sin este). */
  otros: { worldId: string; nombre: string }[];
  onGuardar: (requisitos: RequisitosMundo | null) => void;
  onCerrar: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [desde, setDesde] = useState('');
  const [despuesDe, setDespuesDe] = useState<string | null>(null);
  const [nota, setNota] = useState<number | null>(null);

  useEffect(() => {
    setDesde(mundo?.requisitos?.desde ?? '');
    setDespuesDe(mundo?.requisitos?.despuesDe ?? null);
    setNota(mundo?.requisitos?.notaMinima ?? null);
  }, [mundo]);

  const fechaMal = desde.trim() !== '' && !leerRequisitos({ desde: desde.trim() });
  const guardar = () => {
    onGuardar(leerRequisitos({ desde: desde.trim() || null, despuesDe, notaMinima: despuesDe ? nota : null }));
  };

  return (
    <CetiBottomSheet
      visible={!!mundo}
      onClose={onCerrar}
      closeOnBackdropPress
      title={t('requisitos.titulo', { nombre: mundo?.nombre ?? '' })}
      subtitle={t('requisitos.subtitulo')}
    >
      <View style={{ gap: 12 }}>
        <Seccion texto={t('requisitos.fecha')} />
        <View style={st.chips}>
          <Chip texto={t('requisitos.sinFecha')} seleccionado={!desde} onPress={() => setDesde('')} />
          {ATAJOS.map((a) => {
            const f = fechaEnDias(Date.now(), a.dias);
            return <Chip key={a.clave} texto={t(`requisitos.${a.clave}`)} seleccionado={desde === f} onPress={() => setDesde(f)} />;
          })}
        </View>
        <Campo
          etiqueta={t('requisitos.fechaCampo')}
          value={desde}
          onChangeText={setDesde}
          placeholder="2026-11-10"
          maxLength={10}
          ayuda={fechaMal ? t('requisitos.fechaMal') : t('requisitos.fechaAyuda')}
        />

        <Seccion texto={t('requisitos.despues')} />
        <View style={st.chips}>
          <Chip texto={t('requisitos.ninguno')} seleccionado={!despuesDe} onPress={() => setDespuesDe(null)} />
          {otros.map((o) => (
            <Chip key={o.worldId} texto={o.nombre} seleccionado={despuesDe === o.worldId} onPress={() => setDespuesDe(o.worldId)} />
          ))}
        </View>

        {despuesDe ? (
          <>
            <Seccion texto={t('requisitos.nota')} />
            <View style={st.chips}>
              <Chip texto={t('requisitos.sinNota')} seleccionado={nota === null} onPress={() => setNota(null)} />
              {NOTAS.map((n) => (
                <Chip
                  key={n}
                  texto={n.toLocaleString('es-CO', { minimumFractionDigits: 1 })}
                  seleccionado={nota === n}
                  onPress={() => setNota(n)}
                />
              ))}
            </View>
          </>
        ) : null}

        <Text style={[st.nota, { color: colors.text.tertiary }]}>{t('requisitos.ayuda')}</Text>
        <BotonChunky texto={t('requisitos.guardar')} icono="lock-open" deshabilitado={fechaMal} onPress={guardar} />
        {mundo?.requisitos ? (
          <BotonChunky texto={t('requisitos.quitar')} icono="close-circle-outline" variante="secundario" onPress={() => onGuardar(null)} />
        ) : null}
      </View>
    </CetiBottomSheet>
  );
}

const st = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nota: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
