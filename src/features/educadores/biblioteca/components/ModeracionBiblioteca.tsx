/**
 * Fase 9 — moderación de la biblioteca pública, para el admin de Ceti (panel
 * de admin). Lista los mundos ocultos por reportes, con los motivos, y deja
 * volver a mostrarlos (limpia los reportes) o retirarlos. Los mundos ya
 * copiados a clases no se tocan.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import type { OcultoModeracion } from '@/functions/src/educadores/dominio';
import { Chip, Esqueleto, Pill, Seccion, Tarjeta, Vacio } from '@features/dashboard/components/profe/kit';
import { bibliotecaPublicaRepository } from '../data/bibliotecaPublicaRepository';

const fecha = (ms: number) => new Date(ms).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

export default function ModeracionBiblioteca() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [ocultos, setOcultos] = useState<OcultoModeracion[] | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(() => {
    bibliotecaPublicaRepository
      .ocultos()
      .then((r) => setOcultos(r.ocultos))
      .catch((e: unknown) => {
        setOcultos([]);
        showMessage(t('moderacion.error'), e instanceof Error ? e.message : String(e), 'error');
      });
  }, [t]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const hacer = async (id: string, accion: 'mostrar' | 'retirar') => {
    setOcupado(id);
    try {
      if (accion === 'mostrar') await bibliotecaPublicaRepository.mostrar(id);
      else await bibliotecaPublicaRepository.retirar(id);
      showMessage(t(accion === 'mostrar' ? 'moderacion.mostrado' : 'moderacion.retirado'), undefined, 'success');
      cargar();
    } catch (e) {
      showMessage(t('moderacion.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setOcupado(null);
    }
  };

  return (
    <View style={{ gap: 10, marginTop: 12 }}>
      <Seccion texto={t('moderacion.titulo')} />
      <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('moderacion.ayuda')}</Text>
      {ocultos === null ? <Esqueleto filas={2} alto={72} /> : null}
      {ocultos?.length === 0 ? (
        <Vacio icono="checkmark-circle-outline" titulo={t('moderacion.vacioTitulo')} texto={t('moderacion.vacioTexto')} />
      ) : null}
      {ocultos?.map((o) => (
        <Tarjeta key={o.id} style={{ gap: 8 }}>
          <View style={st.fila}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[st.nombre, { color: colors.text.primary }]} numberOfLines={2}>
                {o.titulo}
              </Text>
              <Text style={[st.sub, { color: colors.text.tertiary }]}>
                {[o.autorNombre, o.institucion, t('moderacion.usos', { count: o.usos })].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Pill texto={t('moderacion.reportes', { count: o.reportes.length })} tono="rojo" icono="flag" />
          </View>
          {o.reportes.map((r, i) => (
            <Text key={i} style={[st.sub, { color: colors.text.secondary }]}>
              {`${fecha(r.reportadoAt)} · ${r.motivo ?? t('moderacion.sinMotivo')}`}
            </Text>
          ))}
          <View style={st.chips}>
            <Chip
              texto={ocupado === o.id ? t('moderacion.guardando') : t('moderacion.mostrar')}
              icono="eye-outline"
              seleccionado
              onPress={() => void hacer(o.id, 'mostrar')}
            />
            <Chip
              texto={t('moderacion.retirar')}
              icono="trash-outline"
              seleccionado={false}
              color={colors.system.red}
              onPress={() =>
                confirmAction({
                  title: t('moderacion.retirarTitulo', { titulo: o.titulo }),
                  body: t('moderacion.retirarTexto'),
                  confirmLabel: t('moderacion.retirar'),
                  cancelLabel: t('moderacion.cancelar'),
                  destructive: true,
                  onConfirm: () => void hacer(o.id, 'retirar'),
                })
              }
            />
          </View>
        </Tarjeta>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  nombre: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
