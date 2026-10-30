/**
 * Gestionar clase → Ajustes (Fase 6): los profes de la clase. En una entidad
 * con plan se suman co-docentes de la misma entidad; cada uno ve y gestiona
 * toda la clase y recibe sus propias alertas. La clase nunca queda sin profe.
 * Fase 9: cada co-docente edita o solo «ve y califica» (`soloCalificar`).
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { MAX_PROFES_POR_CLASE, permisoEnClase, type PermisoClase } from '@/functions/src/educadores/dominio';
import { olvidarPermisoClase } from '@features/educadores/permisos/usePermisoClase';
import { Avatar, Chip, Pill, Seccion, Tarjeta } from '@features/dashboard/components/profe/kit';
import { entidadRepository } from '../data/entidadRepository';
import { useMiEntidad } from '../hooks/useMiEntidad';

export default function CoDocentesClase({
  cursoId,
  profesorUids,
  soloCalificar = [],
  creador,
  onCambio,
}: {
  cursoId: string;
  profesorUids: string[];
  soloCalificar?: string[];
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
  const permiso = (u: string) => permisoEnClase({ profesorUids, soloCalificar }, u);
  const puedeGestionar = conLicencia && ((!!uid && permiso(uid) === 'edita') || soyAdmin);

  const cambiar = async (otro: string, accion: 'agregar' | 'quitar' | 'permiso', nuevo?: PermisoClase) => {
    setOcupado(otro);
    try {
      await entidadRepository.coDocente(cursoId, otro, accion, nuevo);
      olvidarPermisoClase(cursoId);
      showMessage(
        t(
          accion === 'agregar'
            ? 'entidad.coDocentes.agregado'
            : accion === 'quitar'
              ? 'entidad.coDocentes.quitado'
              : nuevo === 'califica'
                ? 'permisos.ahoraCalifica'
                : 'permisos.ahoraEdita'
        ),
        undefined,
        'success'
      );
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
                {u === creador || u === profesorUids[0]
                  ? t('entidad.coDocentes.creo')
                  : permiso(u) === 'califica'
                    ? t('permisos.veYCalifica')
                    : t('entidad.coDocentes.coDocente')}
              </Text>
            </View>
            {puedeGestionar && u !== profesorUids[0] ? (
              <Chip
                texto={ocupado === u ? t('entidad.guardando') : permiso(u) === 'califica' ? t('permisos.califica') : t('permisos.edita')}
                icono={permiso(u) === 'califica' ? 'eye-outline' : 'create-outline'}
                seleccionado={permiso(u) === 'edita'}
                onPress={() => void cambiar(u, 'permiso', permiso(u) === 'califica' ? 'edita' : 'califica')}
              />
            ) : null}
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
          <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('permisos.ayuda')}</Text>
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
