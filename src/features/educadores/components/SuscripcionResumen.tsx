/**
 * Tarjeta del plan actual en "Tu plan": nombre grande, estado, precio y la
 * fecha que importa (renueva, termina o vuelve de la pausa). En prueba, la
 * cuenta regresiva; con Nave del colegio, de quién viene. Y el uso de las
 * ayudas de escritura (IA) del mes frente al límite del plan.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { claveEstado, formatoCop, type PlanId } from '@/functions/src/educadores/dominio';
import { Pill, Tarjeta, type Tono } from '@features/dashboard/components/profe/kit';
import { suscripcionRepository } from '../data/suscripcionRepository';
import { fechaLarga, mesBogota } from '../data/planUi';
import type { MiPlan } from '../hooks/useMiPlan';

export const TONO_ESTADO: Record<string, Tono> = {
  activa: 'verde',
  prueba: 'marca',
  en_mora: 'naranja',
  pausada: 'azul',
  cancelada: 'neutro',
  gratis: 'neutro',
};

export default function SuscripcionResumen({
  miPlan,
  planMostrado,
  subPagada,
  ahora,
}: {
  miPlan: MiPlan;
  /** Plan que se nombra: el contratado si hay uno pagado (aunque esté en pausa), si no el vigente. */
  planMostrado: PlanId;
  /** Hay una suscripción individual pagada (activa, en mora, en pausa o cancelada). */
  subPagada: boolean;
  ahora: number;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const uid = useAuthStore((s) => s.firebaseUid);
  const { sub, licencia, porColegio, diasPrueba, limites } = miPlan;
  const limiteIa = limites.iaGeneracionesMes;
  const [usoIa, setUsoIa] = useState<number | null>(null);

  useEffect(() => {
    if (!uid || limiteIa <= 0) return;
    let vivo = true;
    suscripcionRepository
      .usoIaDelMes(uid, mesBogota(Date.now()))
      .then((n) => {
        if (vivo) setUsoIa(n);
      })
      .catch(() => {
        if (vivo) setUsoIa(0);
      });
    return () => {
      vivo = false;
    };
  }, [uid, limiteIa]);

  const soloColegio = porColegio && !subPagada;
  const estado = claveEstado(sub, ahora);
  const enPrueba = !soloColegio && estado === 'prueba' && diasPrueba > 0;

  let fecha: string | null = null;
  if (sub && subPagada) {
    if (sub.estado === 'activa' && sub.finPeriodo) {
      fecha = t('educadores.suscripcion.renueva', { fecha: fechaLarga(sub.finPeriodo, ahora) });
    } else if (sub.estado === 'cancelada' && sub.finPeriodo) {
      fecha = t('educadores.suscripcion.termina', { fecha: fechaLarga(sub.finPeriodo, ahora) });
    } else if (sub.estado === 'pausada' && sub.pausadaHasta) {
      fecha = t('educadores.suscripcion.pausadaHasta', {
        fecha: fechaLarga(sub.pausadaHasta, ahora),
      });
    }
  }

  const precio =
    sub && subPagada && sub.precioCop !== null && sub.ciclo
      ? {
          monto: formatoCop(sub.precioCop),
          por: t(
            sub.ciclo === 'mensual'
              ? 'educadores.planes.ciclo.porMes'
              : sub.ciclo === 'semestral'
                ? 'educadores.planes.ciclo.porSemestre'
                : 'educadores.planes.ciclo.porAnio'
          ),
          ciclo: t(`educadores.planes.ciclo.${sub.ciclo}`),
        }
      : null;

  const usadas = usoIa ?? 0;
  const fraccion = limiteIa > 0 ? Math.min(1, usadas / limiteIa) : 0;

  return (
    <Tarjeta style={styles.tarjeta}>
      <View style={styles.cabeza}>
        <Text
          style={[styles.plan, { color: colors.text.primary }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {t(`educadores.planes.nombre.${planMostrado}`)}
        </Text>
        {soloColegio ? null : (
          <Pill texto={t(`educadores.estado.${estado}`)} tono={TONO_ESTADO[estado] ?? 'neutro'} />
        )}
      </View>

      {precio ? (
        <View style={styles.precioFila}>
          <Text style={[styles.precio, { color: colors.text.primary }]}>{precio.monto}</Text>
          <Text style={[styles.precioPor, { color: colors.text.secondary }]}>
            {precio.por} · {precio.ciclo}
          </Text>
        </View>
      ) : null}

      {fecha ? <Text style={[styles.fecha, { color: colors.text.secondary }]}>{fecha}</Text> : null}

      {enPrueba ? (
        <View style={[styles.prueba, { backgroundColor: colors.fill.brandSubtle }]}>
          <Text style={[styles.pruebaCuenta, { color: colors.brand.primary }]}>
            {t('educadores.suscripcion.pruebaQueda', { count: diasPrueba })}
          </Text>
          {sub?.pruebaHasta ? (
            <Text style={[styles.pruebaFin, { color: colors.text.secondary }]}>
              {t('educadores.suscripcion.pruebaFin', { fecha: fechaLarga(sub.pruebaHasta, ahora) })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {(sub?.fundador && subPagada) || porColegio ? (
        <View style={styles.pills}>
          {sub?.fundador && subPagada ? (
            <Pill texto={t('educadores.suscripcion.fundadora')} tono="morado" icono="star" />
          ) : null}
          {porColegio ? (
            <Pill texto={t('educadores.suscripcion.porColegio')} tono="azul" icono="business" />
          ) : null}
        </View>
      ) : null}
      {porColegio && licencia?.padrino ? (
        <Text style={[styles.padrino, { color: colors.text.secondary }]}>
          {t('educadores.suscripcion.padrino', { padrino: licencia.padrino })}
        </Text>
      ) : null}

      {limiteIa > 0 ? (
        <View
          style={[styles.ia, { borderTopColor: colors.materials.border }]}
          accessible
          accessibilityLabel={`${t('educadores.suscripcion.iaUso')}: ${t(
            'educadores.suscripcion.iaUsoValor',
            { usadas, total: limiteIa }
          )}`}
        >
          <View style={styles.iaFila}>
            <Text style={[styles.iaEtiqueta, { color: colors.text.secondary }]}>
              {t('educadores.suscripcion.iaUso')}
            </Text>
            <Text style={[styles.iaValor, { color: colors.text.primary }]}>
              {usoIa === null
                ? '…'
                : t('educadores.suscripcion.iaUsoValor', { usadas, total: limiteIa })}
            </Text>
          </View>
          <View style={[styles.barra, { backgroundColor: colors.materials.highlight }]}>
            <View
              style={[
                styles.barraLlena,
                {
                  width: `${Math.round(fraccion * 100)}%`,
                  backgroundColor: fraccion >= 1 ? colors.system.orange : colors.brand.primary,
                },
              ]}
            />
          </View>
        </View>
      ) : null}
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  tarjeta: { padding: 20, gap: 12, borderRadius: 28 },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  plan: { flex: 1, fontSize: 34, lineHeight: 40, fontWeight: '900', letterSpacing: -0.5 },
  precioFila: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  precio: { fontSize: 24, lineHeight: 29, fontWeight: '900' },
  precioPor: { fontSize: 14, fontWeight: '700' },
  fecha: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
  prueba: { borderRadius: 18, padding: 16, gap: 6 },
  pruebaCuenta: { fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.3 },
  pruebaFin: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  padrino: { fontSize: 14, fontWeight: '700' },
  ia: { borderTopWidth: 1, paddingTop: 12, gap: 8 },
  iaFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  iaEtiqueta: { flex: 1, fontSize: 14, fontWeight: '800' },
  iaValor: { fontSize: 15, fontWeight: '900' },
  barra: { height: 10, borderRadius: 5, overflow: 'hidden' },
  barraLlena: { height: 10, borderRadius: 5 },
});
