/**
 * Gestionar clase → Ajustes (Fase 6): los profes de la clase. En una entidad
 * con plan se suman co-docentes de la misma entidad; cada uno ve y gestiona
 * toda la clase y recibe sus propias alertas. La clase nunca queda sin profe.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { MAX_PROFES_POR_CLASE } from '@/functions/src/educadores/dominio';
import { Avatar, Chip, Pill, Seccion, Tarjeta } from '@features/dashboard/components/profe/kit';
import { entidadRepository } from '../data/entidadRepository';
import { useMiEntidad } from '../hooks/useMiEntidad';

export default function CoDocentesClase({
  cursoId,
  profesorUids,
  creador,
  onCambio,
}: {
  cursoId: string;
  profesorUids: string[];
  creador?: string;
  onCambio: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const uid = useAuthStore((s) => s.firebaseUid);
  const { vista, conLicencia, soyAdmin } = useMiEntidad();
  const [ocupado, setOcupado] = useState<string | null>(null);

  if (!vista?.entidad) return null;
  const nombre = new Map(vista.profes.map((p) => [p.uid, p.nombre]));
  const otros = vista.profes.filter((p) => !profesorUids.includes(p.uid));
  const puedeGestionar = conLicencia && (profesorUids.includes(uid ?? '') || soyAdmin);

  const cambiar = async (otro: string, accion: 'agregar' | 'quitar') => {
    setOcupado(otro);
    try {
      await entidadRepository.coDocente(cursoId, otro, accion);
      showMessage(t(accion === 'agregar' ? 'entidad.coDocentes.agregado' : 'entidad.coDocentes.quitado'), undefined, 'success');
      onCambio();
    } catch (e) {
      showMessage(t('entidad.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setOcupado(null);
    }
  };

  return (
    <View style={{ gap: 10 }}>
      <Seccion texto={t('entidad.coDocentes.titulo')} />
      <Tarjeta style={{ gap: 4 }}>
        {profesorUids.map((u) => (
          <View key={u} style={st.fila}>
            <Avatar nombre={nombre.get(u) ?? '?'} tamano={34} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[st.nombre, { color: colors.text.primary }]} numberOfLines={1}>
                {nombre.get(u) ?? t('entidad.coDocentes.exProfe')}
                {u === uid ? ` · ${t('entidad.tu')}` : ''}
              </Text>
              <Text style={[st.sub, { color: colors.text.tertiary }]}>
                {u === creador ? t('entidad.coDocentes.creo') : t('entidad.coDocentes.coDocente')}
              </Text>
            </View>
            {puedeGestionar && profesorUids.length > 1 ? (
              <Chip
                texto={t('entidad.coDocentes.quitar')}
                icono="remove-circle-outline"
                seleccionado={false}
                color={colors.system.red}
                onPress={() =>
                  confirmAction({
                    title: t('entidad.coDocentes.quitarTitulo', { nombre: nombre.get(u) ?? '' }),
                    body: t('entidad.coDocentes.quitarTexto'),
                    confirmLabel: t('entidad.coDocentes.quitar'),
                    cancelLabel: t('entidad.cancelar'),
                    destructive: true,
                    onConfirm: () => void cambiar(u, 'quitar'),
                  })
                }
              />
            ) : null}
          </View>
        ))}
        {profesorUids.length === 0 ? (
          <Pill tono="rojo" icono="alert-circle" texto={t('entidad.coDocentes.sinProfe')} />
        ) : null}
      </Tarjeta>
      {!conLicencia ? (
        <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('entidad.coDocentes.requierePlan')}</Text>
      ) : puedeGestionar && otros.length > 0 && profesorUids.length < MAX_PROFES_POR_CLASE ? (
        <View style={{ gap: 8 }}>
          <Text style={[st.sub, { color: colors.text.secondary }]}>{t('entidad.coDocentes.agregar')}</Text>
          <View style={st.chips}>
            {otros.map((p) => (
              <Chip
                key={p.uid}
                texto={ocupado === p.uid ? t('entidad.guardando') : p.nombre}
                icono="person-add"
                seleccionado={false}
                onPress={() => void cambiar(p.uid, 'agregar')}
              />
            ))}
          </View>
          <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('entidad.coDocentes.ayuda')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  nombre: { fontSize: 15, fontWeight: '800' },
  sub: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
