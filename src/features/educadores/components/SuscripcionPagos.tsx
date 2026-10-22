/**
 * Historial de pagos del profe: fecha, plan y ciclo, monto, estado y la factura
 * cuando el servidor ya la tiene. `recargar` cambia cuando una acción (p. ej. un
 * retracto con reembolso) puede haber creado un pago nuevo.
 */
import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Bounceable from '@shared/components/Bounceable';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { formatoCop } from '@/functions/src/educadores/dominio';
import {
  Esqueleto,
  Pill,
  Seccion,
  Tarjeta,
  type Tono,
} from '@features/dashboard/components/profe/kit';
import {
  suscripcionRepository,
  type EstadoPago,
  type PagoDoc,
} from '../data/suscripcionRepository';
import { fechaLarga } from '../data/planUi';

const TONO_PAGO: Record<EstadoPago, Tono> = {
  aprobado: 'verde',
  pendiente: 'naranja',
  rechazado: 'rojo',
  reembolso_pendiente: 'azul',
  reembolsado: 'neutro',
};

function abrirFactura(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  void Linking.openURL(url);
}

export default function SuscripcionPagos({ recargar = 0 }: { recargar?: number }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const uid = useAuthStore((s) => s.firebaseUid);
  const [pagos, setPagos] = useState<PagoDoc[] | null>(null);

  useEffect(() => {
    if (!uid) {
      setPagos([]);
      return;
    }
    let vivo = true;
    suscripcionRepository
      .pagos(uid)
      .then((p) => {
        if (vivo) setPagos(p);
      })
      .catch(() => {
        if (vivo) setPagos([]);
      });
    return () => {
      vivo = false;
    };
  }, [uid, recargar]);

  return (
    <View style={styles.bloque}>
      <Seccion texto={t('educadores.suscripcion.historial')} />
      {pagos === null ? (
        <Esqueleto filas={2} alto={64} />
      ) : pagos.length === 0 ? (
        <Tarjeta>
          <Text style={[styles.vacio, { color: colors.text.secondary }]}>
            {t('educadores.suscripcion.sinPagos')}
          </Text>
        </Tarjeta>
      ) : (
        <Tarjeta style={{ gap: 0, paddingVertical: 4 }}>
          {pagos.map((p, i) => (
            <View
              key={p.id}
              style={[
                styles.fila,
                i > 0 && { borderTopWidth: 1, borderTopColor: colors.materials.border },
              ]}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.fecha, { color: colors.text.primary }]} numberOfLines={1}>
                  {fechaLarga(p.creadoAt)}
                </Text>
                <Text style={[styles.detalle, { color: colors.text.secondary }]} numberOfLines={1}>
                  {t(`educadores.planes.nombre.${p.plan}`)} ·{' '}
                  {t(`educadores.planes.ciclo.${p.ciclo}`)}
                </Text>
                {p.facturaUrl ? (
                  <Bounceable
                    onPress={() => abrirFactura(p.facturaUrl as string)}
                    accessibilityRole="link"
                    accessibilityLabel={t('educadores.suscripcion.pago.factura')}
                    hitSlop={8}
                    activeScale={0.96}
                    style={styles.factura}
                  >
                    <Ionicons name="document-text-outline" size={14} color={colors.brand.primary} />
                    <Text style={[styles.facturaTexto, { color: colors.brand.primary }]}>
                      {t('educadores.suscripcion.pago.factura')}
                    </Text>
                  </Bounceable>
                ) : null}
              </View>
              <View style={styles.derecha}>
                <Text style={[styles.monto, { color: colors.text.primary }]}>
                  {formatoCop(p.montoCop)}
                </Text>
                <Pill
                  texto={t(`educadores.suscripcion.pago.${p.estado}`)}
                  tono={TONO_PAGO[p.estado] ?? 'neutro'}
                  style={{ alignSelf: 'flex-end' }}
                />
              </View>
            </View>
          ))}
        </Tarjeta>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: { gap: 10 },
  vacio: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  fecha: { fontSize: 15, fontWeight: '800' },
  detalle: { fontSize: 13, fontWeight: '700' },
  factura: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  facturaTexto: { fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },
  derecha: { alignItems: 'flex-end', gap: 6 },
  monto: { fontSize: 16, fontWeight: '900' },
});
