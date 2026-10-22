/**
 * Adopción del colegio (pestaña Colegio): lo que el colegio mira para renovar.
 * Profes activos, estudiantes activos y su porcentaje frente a la meta del 70 %,
 * y cuántos cursos. Solo agregados. Cuando varios profes ya usan Ceti en serio,
 * una tarjeta suave sugiere Nave (todos los profes con Piloto).
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { GrowBar } from '@features/savings/charts/ChartParts';
import { META_ADOPCION } from '@/functions/src/educadores/dominio';
import { useMiPlan } from '@features/educadores/hooks/useMiPlan';
import { abrirWhatsApp } from '@features/educadores/components/abrirEnlace';
import { fechaLarga } from '@features/educadores/data/planUi';
import {
  Aviso,
  BotonChunky,
  Cifra,
  Esqueleto,
  Pill,
  Seccion,
  Tarjeta,
} from '@features/dashboard/components/profe/kit';
import { cargarAdopcion } from '../data/cargarAdopcion';
import type { AdopcionPanel } from '../data/adopcionCursos';
import { rutaPlanes } from './TarjetaBloqueada';

export default function AdopcionColegio() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const colegioId = useAuthStore((s) => s.colegioId);
  const uid = useAuthStore((s) => s.firebaseUid);
  const { plan } = useMiPlan();
  const [adopcion, setAdopcion] = useState<AdopcionPanel | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'lista' | 'error'>('cargando');

  useEffect(() => {
    if (!colegioId || !uid) return;
    let cancelado = false;
    setEstado('cargando');
    void cargarAdopcion(colegioId, uid, Date.now())
      .then((a) => {
        if (!cancelado) {
          setAdopcion(a);
          setEstado('lista');
        }
      })
      .catch(() => {
        if (!cancelado) setEstado('error');
      });
    return () => {
      cancelado = true;
    };
  }, [colegioId, uid]);

  if (estado === 'cargando') return <Esqueleto filas={1} alto={180} />;
  // Sin datos de adopción el resto de la pestaña sigue sirviendo: no estorba con un error.
  if (estado === 'error' || !adopcion || adopcion.cursos === 0) return null;

  const pct = Math.round(adopcion.adopcion * 100);
  const meta = Math.round(META_ADOPCION * 100);
  const tinta = adopcion.cumpleMeta ? colors.system.green : colors.system.orange;

  return (
    <View style={styles.bloque}>
      <Seccion texto={t('educadores.adopcion.titulo')} />
      <Tarjeta style={styles.hero}>
        <View style={styles.heroFila}>
          <Text style={[styles.heroNumero, { color: colors.text.primary }]}>{pct}%</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.heroEtiqueta, { color: colors.text.secondary }]}>
              {t('educadores.adopcion.estudiantesActivos', {
                activos: adopcion.estudiantesActivos,
                total: adopcion.estudiantes,
              })}
            </Text>
          </View>
          <Pill
            texto={
              adopcion.cumpleMeta
                ? t('educadores.adopcion.cumpleMeta')
                : t('educadores.adopcion.faltaMeta', { meta })
            }
            tono={adopcion.cumpleMeta ? 'verde' : 'naranja'}
            icono={adopcion.cumpleMeta ? 'checkmark-circle' : 'flag'}
          />
        </View>
        <View>
          <GrowBar pct={pct} color={tinta} trackColor={colors.materials.highlight} height={12} />
          {/* Marca de la meta sobre la barra. */}
          <View
            style={[styles.metaMarca, { left: `${meta}%`, backgroundColor: colors.text.primary }]}
            accessible
            accessibilityLabel={t('educadores.adopcion.meta', { meta })}
          />
        </View>
        <Text style={[styles.sub, { color: colors.text.tertiary }]}>
          {t('educadores.adopcion.meta', { meta })}
        </Text>
      </Tarjeta>

      <View style={styles.tiles}>
        <Cifra
          icono="school"
          valor={`${adopcion.profesActivos}/${adopcion.profes}`}
          etiqueta={t('educadores.adopcion.profesActivos')}
          tono="morado"
        />
        <Cifra
          icono="people"
          valor={String(adopcion.estudiantesActivos)}
          etiqueta={t('educadores.adopcion.estudiantesCorto')}
          tono="azul"
        />
        <Cifra
          icono="albums"
          valor={String(adopcion.cursos)}
          etiqueta={t('educadores.adopcion.cursos', { count: adopcion.cursos })}
          tono="marca"
        />
      </View>

      <Text style={[styles.sub, { color: colors.text.tertiary }]}>
        {t('educadores.adopcion.privacidad')}
        {adopcion.actualizadoAt !== null
          ? ` ${t('educadores.adopcion.actualizado', { fecha: fechaLarga(adopcion.actualizadoAt) })}`
          : ''}
      </Text>

      {adopcion.senalNave && plan !== 'nave' ? (
        <Aviso icono="rocket" tono="morado" texto={t('educadores.adopcion.nave')}>
          <View style={styles.botones}>
            <BotonChunky
              texto={t('educadores.adopcion.verNave')}
              variante="secundario"
              color={colors.system.purple}
              compacto
              onPress={() => router.push(rutaPlanes('panelCapitan'))}
              style={{ flex: 1 }}
            />
            <BotonChunky
              texto={t('educadores.adopcion.whatsapp')}
              icono="logo-whatsapp"
              variante="secundario"
              color={colors.system.green}
              compacto
              onPress={() => abrirWhatsApp(t('educadores.adopcion.whatsappTexto'))}
              style={{ flex: 1 }}
            />
          </View>
        </Aviso>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: { gap: 14 },
  hero: { gap: 12, padding: 20, borderRadius: 24 },
  heroFila: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  heroNumero: { fontSize: 44, lineHeight: 50, fontWeight: '900', letterSpacing: -1.5 },
  heroEtiqueta: { fontSize: 14, fontWeight: '700' },
  metaMarca: {
    position: 'absolute',
    top: -4,
    width: 3,
    height: 20,
    borderRadius: 2,
    marginLeft: -1.5,
  },
  sub: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  tiles: { flexDirection: 'row', gap: 8 },
  botones: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
