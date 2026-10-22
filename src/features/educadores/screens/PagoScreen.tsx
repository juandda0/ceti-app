/**
 * Pago de un plan individual (Piloto o Comandante): resumen, medio (Nequi,
 * tarjeta o PSE/otro) y espera de la confirmación. El plan solo cambia cuando el
 * servidor lo confirma (webhook de Wompi → `suscripciones/{uid}`); aquí se
 * observa con useMiPlan y, al quedar activo, se va a Tu plan.
 *
 * Seguridad: los datos de la tarjeta van del formulario a Wompi (wompiTokens) y
 * Ceti solo recibe el token. Nada de esta pantalla registra el formulario ni el
 * error crudo de Wompi.
 */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import {
  esCiclo,
  esPlanIndividual,
  formatoCop,
  type Ciclo,
  type PlanIndividual,
} from '@/functions/src/educadores/dominio';
import {
  Aviso,
  BotonChunky,
  Encabezado,
  Vacio,
  tapsConTeclado,
} from '@features/dashboard/components/profe/kit';
import { useMiPlan } from '../hooks/useMiPlan';
import { esMotivo, type Motivo } from '../data/planUi';
import { suscripcionRepository } from '../data/suscripcionRepository';
import {
  esCelularValido,
  formatoCelular,
  normalizarCelular,
  type FormularioTarjeta,
} from '../data/pagoHelpers';
import { ErrorWompi, tokenizarTarjeta } from '../data/wompiTokens';
import { BotonFantasma, rutaPlanes } from '../components/MuroPlan';
import { abrirCheckout, urlRegresoPago } from '../components/abrirEnlace';
import { useCotizacion } from '../components/PlanesCotizacion';
import PagoSelectorMedio, { type MedioPago } from '../components/PagoSelectorMedio';
import PagoFormularioTarjeta from '../components/PagoFormularioTarjeta';
import PagoCampo from '../components/PagoCampo';
import PagoRetorno from '../components/PagoRetorno';

export default function PagoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    plan?: string;
    ciclo?: string;
    motivo?: string;
    /** Wompi vuelve a /pago?id=<transactionId> tras el pago único. */
    id?: string;
  }>();
  const motivo: Motivo | null = esMotivo(params.motivo) ? params.motivo : null;
  const valido = esPlanIndividual(params.plan) && esCiclo(params.ciclo);
  const retorno = !valido && typeof params.id === 'string' && params.id.length > 0;

  useEffect(() => {
    if (!valido && !retorno) router.replace(rutaPlanes(motivo));
  }, [valido, retorno, motivo, router]);

  if (retorno) return <PagoRetorno />;

  if (!esPlanIndividual(params.plan) || !esCiclo(params.ciclo))
    return <ScreenWrapper>{null}</ScreenWrapper>;
  return <ContenidoPago plan={params.plan} ciclo={params.ciclo} motivo={motivo} />;
}

/** Estado de espera tras iniciar la suscripción (el servidor confirma). */
interface Espera {
  medio: MedioPago;
  /** Si ya tenía este plan activo al empezar, se espera un periodo nuevo. */
  inicioAntes: number | null;
  yaActivoAntes: boolean;
}

function ContenidoPago({
  plan,
  ciclo,
  motivo,
}: {
  plan: PlanIndividual;
  ciclo: Ciclo;
  motivo: Motivo | null;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const miPlan = useMiPlan();
  const cotizacion = useCotizacion(plan, ciclo);

  const nombre = t(`educadores.planes.nombre.${plan}`);
  const monto = formatoCop(cotizacion.montoCop);
  const volverAPlanes = rutaPlanes(motivo, plan, ciclo);

  const [medio, setMedio] = useState<MedioPago>('nequi');
  const [espera, setEspera] = useState<Espera | null>(null);
  const [busy, setBusy] = useState(false);

  // Nequi
  const [celular, setCelular] = useState('');
  const [celularTocado, setCelularTocado] = useState(false);
  const [celularIntento, setCelularIntento] = useState(false);
  const celularValido = esCelularValido(celular);
  const errorCelular =
    (celularTocado || celularIntento) && !celularValido
      ? t('educadores.pago.nequi.invalido')
      : null;

  const empezarEspera = (m: MedioPago) => {
    const sub = miPlan.sub;
    setEspera({
      medio: m,
      inicioAntes: sub?.inicioPeriodo ?? null,
      yaActivoAntes: miPlan.plan === plan && sub?.estado === 'activa',
    });
  };

  // Cuando el servidor confirma el plan, se avisa una vez y se va a Tu plan.
  const avisado = useRef(false);
  useEffect(() => {
    if (!espera || avisado.current) return;
    const sub = miPlan.sub;
    const activo = miPlan.plan === plan && sub?.estado === 'activa';
    const nuevo = !espera.yaActivoAntes || (sub?.inicioPeriodo ?? null) !== espera.inicioAntes;
    if (activo && nuevo) {
      avisado.current = true;
      showMessage(t('educadores.pago.listo', { plan: nombre }), undefined, 'success');
      router.replace('/(staff)/suscripcion' as Href);
    }
  }, [espera, miPlan.plan, miPlan.sub, plan, nombre, router, t]);

  const errorPago = () => showMessage(t('educadores.pago.error'), undefined, 'error');

  const pagarNequi = async () => {
    setCelularIntento(true);
    if (!celularValido || busy) return;
    setBusy(true);
    try {
      await suscripcionRepository.suscribirConNequi(plan, ciclo, normalizarCelular(celular));
      empezarEspera('nequi');
    } catch {
      errorPago();
    } finally {
      setBusy(false);
    }
  };

  const pagarTarjeta = async (form: FormularioTarjeta): Promise<boolean> => {
    try {
      const token = await tokenizarTarjeta(form);
      await suscripcionRepository.suscribirConTarjeta(plan, ciclo, token.id);
      empezarEspera('tarjeta');
      return true;
    } catch (e) {
      if (e instanceof ErrorWompi && e.codigo === 'sin_llave') {
        showMessage(t('educadores.pago.tarjeta.sinLlave'), undefined, 'error');
      } else if (e instanceof ErrorWompi && (e.codigo === 'datos' || e.codigo === 'rechazada')) {
        showMessage(t('educadores.pago.tarjeta.rechazada'), undefined, 'error');
      } else {
        errorPago();
      }
      return false;
    }
  };

  const pagarOtro = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await suscripcionRepository.crearCheckout(plan, ciclo, urlRegresoPago());
      await abrirCheckout(res.url);
      // En web la pestaña ya se fue a Wompi; en nativo vuelve al cerrar el navegador.
      if (Platform.OS !== 'web') empezarEspera('otro');
    } catch {
      errorPago();
    } finally {
      setBusy(false);
    }
  };

  const salir = () => {
    if (router.canGoBack()) router.back();
    else router.replace(volverAPlanes);
  };

  const resumen = t('educadores.pago.resumen', {
    plan: nombre,
    ciclo: t(`educadores.planes.ciclo.${ciclo}`),
    monto,
  });

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[styles.page, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps={tapsConTeclado}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado
          atras={volverAPlanes as string}
          titulo={t('educadores.pago.titulo')}
          subtitulo={resumen}
        />

        {cotizacion.cargando ? (
          <Text style={[styles.legal, { color: colors.text.quaternary, textAlign: 'left' }]}>
            {t('educadores.planes.cargandoPrecio')}
          </Text>
        ) : null}

        {espera ? (
          <View style={styles.bloque}>
            {espera.medio === 'nequi' ? (
              <Vacio
                icono="notifications"
                titulo={t('educadores.pago.nequi.aprueba')}
                texto={t('educadores.pago.nequi.apruebaTexto')}
              />
            ) : null}
            <Aviso icono="time" texto={t('educadores.pago.pendiente')}>
              <ActivityIndicator color={colors.brand.primary} style={{ alignSelf: 'flex-start' }} />
            </Aviso>
            <BotonFantasma
              texto={t('educadores.pago.volver')}
              onPress={() => {
                avisado.current = false;
                setEspera(null);
              }}
            />
          </View>
        ) : (
          <View style={styles.bloque}>
            <PagoSelectorMedio medio={medio} onCambiar={setMedio} />

            {medio === 'nequi' ? (
              <View style={styles.bloque}>
                <PagoCampo
                  etiqueta={t('educadores.pago.nequi.celular')}
                  value={celular}
                  onChangeText={(v) => setCelular(formatoCelular(v))}
                  onBlur={() => setCelularTocado(true)}
                  placeholder={t('educadores.pago.nequi.placeholder')}
                  teclado="phone-pad"
                  autoComplete="tel-national"
                  textContentType="telephoneNumber"
                  maxLength={16}
                  error={errorCelular}
                  editable={!busy}
                />
                <BotonChunky
                  texto={t('educadores.pago.nequi.suscribir')}
                  icono="phone-portrait"
                  cargando={busy}
                  onPress={() => void pagarNequi()}
                />
              </View>
            ) : null}

            {medio === 'tarjeta' ? (
              <PagoFormularioTarjeta monto={monto} onPagar={pagarTarjeta} />
            ) : null}

            {medio === 'otro' ? (
              <View style={styles.bloque}>
                <Text style={[styles.texto, { color: colors.text.secondary }]}>
                  {t('educadores.pago.otro.texto')}
                </Text>
                <BotonChunky
                  texto={t('educadores.pago.otro.abrir', { monto })}
                  icono="open-outline"
                  cargando={busy}
                  onPress={() => void pagarOtro()}
                />
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.pie}>
          <Text style={[styles.legal, { color: colors.text.tertiary }]}>
            {t('educadores.pago.wompi')}
          </Text>
          <Text style={[styles.legal, { color: colors.text.tertiary }]}>
            {t('educadores.planes.legal')}
          </Text>
          <BotonFantasma texto={t('educadores.planes.ahoraNo')} onPress={salir} />
        </View>
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 18 },
  bloque: { gap: 14 },
  texto: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  pie: { gap: 8 },
  legal: { fontSize: 12, lineHeight: 17, fontWeight: '600', textAlign: 'center' },
});
