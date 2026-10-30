/**
 * Pestaña Clases (Fase 6): invitaciones de una entidad para el correo del
 * profe. Al aceptar, sus clases pasan a la entidad y la app relee sus claims.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { BotonChunky, Pill, Tarjeta } from '@features/dashboard/components/profe/kit';
import { entidadRepository, type InvitacionParaMi } from '../data/entidadRepository';
import { refrescarClaimsProfe } from '../hooks/useMiEntidad';

export default function InvitacionEntidadTarjeta({ onUnido }: { onUnido?: () => void }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const colegioId = useAuthStore((s) => s.colegioId);
  const [invitaciones, setInvitaciones] = useState<InvitacionParaMi[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setInvitaciones((await entidadRepository.misInvitaciones()).invitaciones);
    } catch {
      setInvitaciones([]);
    }
  }, []);

  useEffect(() => {
    if (colegioId) void cargar();
  }, [colegioId, cargar]);

  const responder = async (inv: InvitacionParaMi, aceptar: boolean) => {
    setOcupado(inv.colegioId);
    try {
      const r = await entidadRepository.responder(inv.colegioId, aceptar);
      if (aceptar) {
        await refrescarClaimsProfe();
        showMessage(
          t('entidad.invitacion.unido', { entidad: inv.entidad }),
          t('entidad.invitacion.unidoTexto', { count: r.clases ?? 0 }),
          'success'
        );
        onUnido?.();
      }
      setInvitaciones((l) => l.filter((x) => x.colegioId !== inv.colegioId));
    } catch (e) {
      showMessage(t('entidad.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setOcupado(null);
    }
  };

  if (invitaciones.length === 0) return null;
  return (
    <View style={{ gap: 10 }}>
      {invitaciones.map((inv) => (
        <Tarjeta key={inv.colegioId} style={st.tarjeta} acento={colors.system.purple}>
          <Pill tono="morado" icono="business" texto={t('entidad.invitacion.pill')} />
          <Text style={[st.titulo, { color: colors.text.primary }]}>
            {t('entidad.invitacion.titulo', { entidad: inv.entidad })}
          </Text>
          <Text style={[st.texto, { color: colors.text.secondary }]}>
            {t(inv.rol === 'admin' ? 'entidad.invitacion.textoAdmin' : 'entidad.invitacion.texto', {
              quien: inv.invitadoPorNombre ?? t('entidad.invitacion.alguien'),
            })}{' '}
            {t('entidad.invitacion.clases', { count: inv.clases })}
          </Text>
          <View style={st.botones}>
            <BotonChunky
              texto={t('entidad.invitacion.unirme')}
              icono="checkmark-circle"
              cargando={ocupado === inv.colegioId}
              onPress={() =>
                confirmAction({
                  title: t('entidad.invitacion.confirmarTitulo', { entidad: inv.entidad }),
                  body: t('entidad.invitacion.confirmarTexto', { count: inv.clases }),
                  confirmLabel: t('entidad.invitacion.unirme'),
                  cancelLabel: t('entidad.cancelar'),
                  onConfirm: () => void responder(inv, true),
                })
              }
            />
            <BotonChunky
              texto={t('entidad.invitacion.ahoraNo')}
              variante="secundario"
              deshabilitado={ocupado !== null}
              onPress={() => void responder(inv, false)}
            />
          </View>
        </Tarjeta>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  tarjeta: { gap: 10 },
  titulo: { fontSize: 19, lineHeight: 24, fontWeight: '900' },
  texto: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  botones: { gap: 8 },
});
