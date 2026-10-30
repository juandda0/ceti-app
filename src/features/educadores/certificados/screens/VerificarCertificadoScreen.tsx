/**
 * Fase 8b — verificación pública de un certificado en `/certificado/{código}`,
 * sin cuenta: nombre, clase, institución, mundos y fechas, o que fue revocado.
 * Nada de contacto ni de notas.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Esqueleto, Pill, Tarjeta, Vacio } from '@features/dashboard/components/profe/kit';
import { textoNormas, type CertificadoPublico } from '@/functions/src/educadores/dominio';
import { certificadosRepository } from '../data/certificadosRepository';
import { fechaLarga, lista } from '../data/certificadoHtml';

export default function VerificarCertificadoScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const [c, setC] = useState<CertificadoPublico | null | undefined>(undefined);

  useEffect(() => {
    let cancelado = false;
    void certificadosRepository
      .verificar(String(codigo ?? ''))
      .then((x) => {
        if (!cancelado) setC(x);
      })
      .catch(() => {
        if (!cancelado) setC(null);
      });
    return () => {
      cancelado = true;
    };
  }, [codigo]);

  return (
    <ScreenWrapper>
      <ContextScrollView contentContainerStyle={[st.page, { paddingTop: insets.top + 24 }]}>
        <Text style={[st.sobre, { color: colors.brand.primary }]}>{t('diferenciales.certificados.verificarSobre')}</Text>
        <Text style={[st.codigo, { color: colors.text.primary }]}>{String(codigo ?? '')}</Text>
        {c === undefined ? <Esqueleto filas={2} alto={90} /> : null}
        {c === null ? (
          <Vacio icono="alert-circle-outline" tono="rojo" titulo={t('diferenciales.certificados.noExiste')} texto={t('diferenciales.certificados.noExisteTexto')} />
        ) : null}
        {c ? (
          <Tarjeta style={{ gap: 10 }}>
            {c.revocadoAt ? (
              <Pill texto={t('diferenciales.certificados.revocadoEl', { fecha: fechaLarga(c.revocadoAt) })} tono="rojo" icono="close-circle" />
            ) : (
              <Pill texto={t('diferenciales.certificados.valido')} tono="verde" icono="checkmark-circle" />
            )}
            <Text style={[st.nombre, { color: colors.text.primary }]}>{c.nombre}</Text>
            <Text style={[st.cuerpo, { color: colors.text.secondary }]}>
              {t('diferenciales.certificados.verificarTexto', {
                count: c.mundos.length,
                clase: c.clase,
                institucion: c.institucion,
                mundos: lista(c.mundos),
                desde: fechaLarga(c.desde),
                hasta: fechaLarga(c.hasta),
              })}
            </Text>
            <Text style={[st.cuerpo, { color: colors.text.secondary }]}>
              {t('diferenciales.certificados.emitidoPor', { profe: c.profe, fecha: fechaLarga(c.emitidoAt) })}
            </Text>
            <Text style={[st.nota, { color: colors.text.tertiary }]}>
              {t('diferenciales.certificados.marco', { normas: textoNormas(c.tipoEntidad) })}
            </Text>
          </Tarjeta>
        ) : null}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 14, maxWidth: 720, width: '100%', alignSelf: 'center' },
  sobre: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  codigo: { fontSize: 28, fontWeight: '900', letterSpacing: 1 },
  nombre: { fontSize: 24, fontWeight: '900' },
  cuerpo: { fontSize: 15, lineHeight: 22, fontWeight: '700' },
  nota: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
});
