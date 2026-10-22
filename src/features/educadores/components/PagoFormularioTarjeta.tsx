/**
 * Formulario de tarjeta. Los datos viven solo aquí (estado local) y van directo
 * a Wompi por `onPagar`; nunca se registran ni se guardan. Se limpian al pagar
 * bien, al salir de la pantalla y al desmontar. Los errores por campo aparecen
 * al salir del campo o después de intentar pagar, no mientras escribe.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { BotonChunky } from '@features/dashboard/components/profe/kit';
import {
  erroresTarjeta,
  formatoNumeroTarjeta,
  formatoVencimiento,
  marcaTarjeta,
  soloDigitos,
  type CampoTarjeta,
  type FormularioTarjeta,
} from '../data/pagoHelpers';
import PagoCampo from './PagoCampo';

const VACIO: FormularioTarjeta = { numero: '', vence: '', cvc: '', titular: '' };
const SIN_TOCAR: Record<CampoTarjeta, boolean> = {
  numero: false,
  vence: false,
  cvc: false,
  titular: false,
};

const CLAVE_ERROR: Record<CampoTarjeta, string> = {
  numero: 'educadores.pago.tarjeta.errorNumero',
  vence: 'educadores.pago.tarjeta.errorVence',
  cvc: 'educadores.pago.tarjeta.errorCvc',
  titular: 'educadores.pago.tarjeta.errorTitular',
};

export default function PagoFormularioTarjeta({
  monto,
  onPagar,
}: {
  /** Monto ya formateado ('$199.000'). */
  monto: string;
  /** Tokeniza y suscribe; true si salió bien (entonces se limpia el formulario). */
  onPagar: (f: FormularioTarjeta) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [form, setForm] = useState<FormularioTarjeta>(VACIO);
  const [tocado, setTocado] = useState<Record<CampoTarjeta, boolean>>(SIN_TOCAR);
  const [intento, setIntento] = useState(false);
  const [busy, setBusy] = useState(false);

  const limpiar = useCallback(() => {
    setForm(VACIO);
    setTocado(SIN_TOCAR);
    setIntento(false);
  }, []);

  // Al salir de la pantalla (otra encima, atrás) los datos no se quedan en memoria.
  useFocusEffect(useCallback(() => limpiar, [limpiar]));

  const errores = erroresTarjeta(form, Date.now());
  const errorDe = (c: CampoTarjeta) =>
    (intento || tocado[c]) && errores.includes(c) ? t(CLAVE_ERROR[c]) : null;
  const tocar = (c: CampoTarjeta) => () => setTocado((prev) => ({ ...prev, [c]: true }));
  const amex = marcaTarjeta(form.numero) === 'amex';

  const pagar = async () => {
    setIntento(true);
    if (errores.length > 0 || busy) return;
    setBusy(true);
    try {
      const ok = await onPagar(form);
      if (ok) limpiar();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.form}>
      <PagoCampo
        etiqueta={t('educadores.pago.tarjeta.numero')}
        value={form.numero}
        onChangeText={(v) => setForm((f) => ({ ...f, numero: formatoNumeroTarjeta(v) }))}
        onBlur={tocar('numero')}
        placeholder="4242 4242 4242 4242"
        teclado="number-pad"
        autoComplete="cc-number"
        textContentType="creditCardNumber"
        maxLength={23}
        error={errorDe('numero')}
        editable={!busy}
      />
      <View style={styles.fila}>
        <PagoCampo
          etiqueta={t('educadores.pago.tarjeta.vence')}
          value={form.vence}
          onChangeText={(v) => setForm((f) => ({ ...f, vence: formatoVencimiento(v) }))}
          onBlur={tocar('vence')}
          placeholder="MM/AA"
          teclado="number-pad"
          autoComplete="cc-exp"
          textContentType="creditCardExpiration"
          maxLength={5}
          error={errorDe('vence')}
          editable={!busy}
          style={styles.mitad}
        />
        <PagoCampo
          etiqueta={t('educadores.pago.tarjeta.cvc')}
          value={form.cvc}
          onChangeText={(v) => setForm((f) => ({ ...f, cvc: soloDigitos(v).slice(0, 4) }))}
          onBlur={tocar('cvc')}
          placeholder={amex ? '1234' : '123'}
          teclado="number-pad"
          autoComplete="cc-csc"
          textContentType="creditCardSecurityCode"
          secreto
          maxLength={4}
          error={errorDe('cvc')}
          editable={!busy}
          style={styles.mitad}
        />
      </View>
      <PagoCampo
        etiqueta={t('educadores.pago.tarjeta.titular')}
        value={form.titular}
        onChangeText={(v) => setForm((f) => ({ ...f, titular: v.slice(0, 60) }))}
        onBlur={tocar('titular')}
        autoComplete="cc-name"
        textContentType="creditCardName"
        autoCapitalize="words"
        maxLength={60}
        error={errorDe('titular')}
        editable={!busy}
      />

      <View style={styles.seguro}>
        <Ionicons
          name="lock-closed"
          size={16}
          color={colors.system.green}
          style={{ marginTop: 1 }}
        />
        <Text style={[styles.seguroTexto, { color: colors.text.secondary }]}>
          {t('educadores.pago.tarjeta.seguro')}
        </Text>
      </View>

      <BotonChunky
        texto={t('educadores.pago.tarjeta.suscribir', { monto })}
        icono="lock-closed"
        cargando={busy}
        onPress={() => void pagar()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  fila: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  mitad: { flex: 1, minWidth: 0 },
  seguro: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  seguroTexto: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
