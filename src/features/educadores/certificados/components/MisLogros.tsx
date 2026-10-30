/**
 * Fase 8b — en el Perfil del estudiante, en el espacio de una clase: las
 * insignias que le dio su profe y sus certificados (con el PDF). En Mi galaxia
 * o sin nada todavía, nada.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { compartirPdf } from '@shared/lib/export/guardarArchivo';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { BotonChunky } from '@features/dashboard/components/profe/kit';
import type { CertificadoPublico } from '@/functions/src/educadores/dominio';
import { certificadosRepository, enlaceDeCertificado, type InsigniaGuardada } from '../data/certificadosRepository';
import { certificadoHtml } from '../data/certificadoHtml';
import { IconoInsignia } from './InsigniasFicha';

export default function MisLogros() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const role = useAuthStore((s) => s.role);
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const uid = useAuthStore((s) => s.firebaseUid);
  const [insignias, setInsignias] = useState<InsigniaGuardada[]>([]);
  const [certificados, setCertificados] = useState<CertificadoPublico[]>([]);
  const [bajando, setBajando] = useState<string | null>(null);

  useEffect(() => {
    if (role !== 'estudiante' || !colegioId || !cursoId || !uid) {
      setInsignias([]);
      setCertificados([]);
      return;
    }
    let cancelado = false;
    void Promise.all([
      certificadosRepository.insignias(colegioId, cursoId, uid).catch(() => []),
      certificadosRepository.deEstudiante(colegioId, cursoId, uid).catch(() => []),
    ]).then(([i, c]) => {
      if (cancelado) return;
      setInsignias(i);
      setCertificados(c.filter((x) => !x.revocadoAt));
    });
    return () => {
      cancelado = true;
    };
  }, [role, colegioId, cursoId, uid]);

  if (!insignias.length && !certificados.length) return null;

  const descargar = async (c: CertificadoPublico) => {
    setBajando(c.codigo);
    const ok = await compartirPdf(`certificado-${c.codigo}.pdf`, certificadoHtml(c, enlaceDeCertificado(c.codigo)));
    setBajando(null);
    if (!ok) showMessage(t('analisis.exportarError'), undefined, 'error');
  };

  return (
    <View style={[st.tarjeta, { backgroundColor: colors.materials.base, borderColor: colors.materials.border }]}>
      <Text style={[st.titulo, { color: colors.text.primary }]}>{t('diferenciales.insignias.misLogros')}</Text>
      {insignias.map((d) => (
        <View key={d.id} style={st.fila}>
          <IconoInsignia id={d.insignia} tamano={40} />
          <View style={{ flex: 1 }}>
            <Text style={[st.nombre, { color: colors.text.primary }]}>{t(`diferenciales.insignias.${d.insignia}`)}</Text>
            <Text style={[st.sub, { color: colors.text.secondary }]}>
              {d.motivo ? `«${d.motivo}» · ${d.dadaPorNombre}` : d.dadaPorNombre}
            </Text>
          </View>
        </View>
      ))}
      {certificados.map((c) => (
        <View key={c.codigo} style={st.fila}>
          <View style={{ flex: 1 }}>
            <Text style={[st.nombre, { color: colors.text.primary }]}>{t('diferenciales.certificados.tuCertificado')}</Text>
            <Text style={[st.sub, { color: colors.text.secondary }]}>{c.mundos.join(' · ')}</Text>
          </View>
          <BotonChunky
            texto={t('diferenciales.certificados.pdf')}
            icono="ribbon"
            variante="secundario"
            compacto
            cargando={bajando === c.codigo}
            onPress={() => void descargar(c)}
          />
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  tarjeta: { borderRadius: 24, borderWidth: 1, padding: 18, gap: 12 },
  titulo: { fontSize: 18, fontWeight: '900' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nombre: { fontSize: 15, fontWeight: '900' },
  sub: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
});
