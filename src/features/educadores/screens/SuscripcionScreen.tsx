/**
 * "Tu plan" del profe: lo que tiene, lo que paga y cómo cambiarlo. Cambiar de
 * plan, pausar en vacaciones (mensual), reanudar, cancelar en un paso y
 * deshacer una cancelación; historial de pagos, exportar sus datos, soporte
 * humano y los términos en corto.
 *
 * Las reglas de cada acción salen del dominio puro (pausar/cancelar/
 * revertirCancelacion/reanudar): aquí solo se decide qué botón mostrar. El
 * servidor (gestionarSuscripcion) es quien de verdad aplica el cambio; la
 * suscripción llega en vivo por useMiPlan.
 */
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { showMessage } from '@shared/lib/dialogs';
import {
  cancelar as simularCancelacion,
  claveEstado,
  enRetracto,
  esPlanIndividual,
  finPausaSugerido,
  PAUSAS_POR_ANIO,
  type PlanId,
  type Suscripcion,
} from '@/functions/src/educadores/dominio';
import {
  Aviso,
  BotonChunky,
  Encabezado,
  Esqueleto,
  Seccion,
} from '@features/dashboard/components/profe/kit';
import { useMiPlan } from '../hooks/useMiPlan';
import {
  suscripcionRepository,
  type AccionSuscripcion,
  type ResultadoGestion,
} from '../data/suscripcionRepository';
import { fechaLarga } from '../data/planUi';
import { rutaPlanes } from '../components/MuroPlan';
import SuscripcionResumen from '../components/SuscripcionResumen';
import SuscripcionPagos from '../components/SuscripcionPagos';
import SuscripcionExportar from '../components/SuscripcionExportar';
import SuscripcionTerminos from '../components/SuscripcionTerminos';
import SoporteWhatsApp from '../components/SoporteWhatsApp';
import HojaPausa from '../components/HojaPausa';
import HojaCancelar from '../components/HojaCancelar';

const ESTADOS_PAGADOS: readonly Suscripcion['estado'][] = [
  'activa',
  'en_mora',
  'pausada',
  'cancelada',
];

/** Hay un plan individual pagado (aunque esté en pausa, en mora o cancelado). */
function tienePlanPagado(sub: Suscripcion | null): sub is Suscripcion {
  return !!sub && esPlanIndividual(sub.plan) && ESTADOS_PAGADOS.includes(sub.estado);
}

/** Mismas condiciones que `pausar()` del dominio (sin la fecha). */
function puedePausar(sub: Suscripcion | null, ahora: number): boolean {
  if (!sub || sub.estado !== 'activa' || sub.ciclo !== 'mensual' || !esPlanIndividual(sub.plan)) {
    return false;
  }
  const anio = new Date(ahora).getUTCFullYear();
  const usadas = sub.anioPausas === anio ? sub.pausasEsteAnio : 0;
  return usadas < PAUSAS_POR_ANIO;
}

/** Mismas condiciones que `cancelar()` del dominio. */
function puedeCancelar(sub: Suscripcion | null, ahora: number): sub is Suscripcion {
  if (!sub) return false;
  if (sub.estado === 'prueba') return claveEstado(sub, ahora) === 'prueba';
  if (sub.estado === 'cancelada') return !sub.cancelarAlFinal;
  return sub.estado === 'activa' || sub.estado === 'en_mora' || sub.estado === 'pausada';
}

function puedeRevertir(sub: Suscripcion | null, ahora: number): sub is Suscripcion {
  return (
    !!sub &&
    sub.estado === 'cancelada' &&
    sub.cancelarAlFinal &&
    sub.finPeriodo !== null &&
    sub.finPeriodo > ahora
  );
}

/** Hasta cuándo conservaría el plan si cancela hoy (lo mismo que calcula el servidor). */
function accesoAlCancelar(sub: Suscripcion, ahora: number): number {
  try {
    return simularCancelacion(sub, ahora).accesoHasta;
  } catch {
    return sub.finPeriodo ?? ahora;
  }
}

type Hoja = 'pausa' | 'cancelar' | null;

export default function SuscripcionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const miPlan = useMiPlan();
  const { plan, sub, cargando, porColegio } = miPlan;
  const { pago } = useLocalSearchParams<{ pago?: string }>();

  const [hoja, setHoja] = useState<Hoja>(null);
  const [ocupado, setOcupado] = useState<AccionSuscripcion | null>(null);
  const [pausaHasta, setPausaHasta] = useState(() => finPausaSugerido(Date.now()));
  const [recargarPagos, setRecargarPagos] = useState(0);
  const [ofrecerPausa, setOfrecerPausa] = useState(false);
  // Lo que dice la hoja de cancelar se fija al abrirla: al confirmar, el plan cambia
  // antes de que la hoja termine de deslizarse y no debe leerse "¿Cancelar Cadete?".
  const [hojaCancelar, setHojaCancelar] = useState({ nombrePlan: '', texto: '', pausa: false });
  /** La pausa se ofrece una sola vez al cancelar (no insistimos). */
  const pausaYaOfrecida = useRef(false);
  const regresoAvisado = useRef(false);

  useEffect(() => {
    if (pago !== 'regreso' || regresoAvisado.current) return;
    regresoAvisado.current = true;
    showMessage(t('educadores.pago.pendiente'));
    router.setParams({ pago: undefined });
  }, [pago, router, t]);

  const ahora = Date.now();
  const subPagada = tienePlanPagado(sub);
  const soloColegio = porColegio && !subPagada;
  const planMostrado: PlanId = soloColegio ? plan : subPagada ? sub.plan : plan;
  const nombrePlan = t(`educadores.planes.nombre.${planMostrado}`);

  const pausable = !soloColegio && puedePausar(sub, ahora);
  const cancelable = !soloColegio && puedeCancelar(sub, ahora);
  const revertible = !soloColegio && puedeRevertir(sub, ahora);
  const enMora = !soloColegio && sub?.estado === 'en_mora';
  const pausada = !soloColegio && sub?.estado === 'pausada';
  const enPrueba = sub?.estado === 'prueba';

  const gestionar = async (
    accion: AccionSuscripcion,
    hasta?: number
  ): Promise<ResultadoGestion | null> => {
    setOcupado(accion);
    try {
      return await suscripcionRepository.gestionar(accion, hasta);
    } catch {
      showMessage(t('educadores.suscripcion.error'), undefined, 'error');
      return null;
    } finally {
      setOcupado(null);
    }
  };

  const abrirPausa = () => {
    setPausaHasta(finPausaSugerido(Date.now()));
    setHoja('pausa');
  };

  const abrirCancelar = () => {
    const ofrecer = pausable && !pausaYaOfrecida.current;
    setOfrecerPausa(ofrecer);
    if (pausable) pausaYaOfrecida.current = true;
    setHojaCancelar({ nombrePlan, texto: textoCancelar, pausa: ofrecer });
    setHoja('cancelar');
  };

  const pausarEnVez = () => {
    setHoja(null);
    // En nativo, un Modal no debe abrirse mientras el otro todavía se cierra.
    setTimeout(abrirPausa, Platform.OS === 'web' ? 0 : 400);
  };

  const confirmarPausa = async () => {
    const res = await gestionar('pausar', pausaHasta);
    if (!res) return;
    setHoja(null);
    showMessage(
      t('educadores.suscripcion.pausa.listo', { fecha: fechaLarga(pausaHasta) }),
      undefined,
      'success'
    );
  };

  const confirmarCancelar = async () => {
    const res = await gestionar('cancelar');
    if (!res) return;
    setHoja(null);
    setRecargarPagos((n) => n + 1);
    if (res.reembolso) {
      showMessage(t('educadores.suscripcion.cancelacion.listoReembolso'), undefined, 'success');
    } else {
      showMessage(
        t('educadores.suscripcion.cancelacion.listo', {
          fecha: fechaLarga(res.accesoHasta ?? Date.now()),
        }),
        undefined,
        'success'
      );
    }
  };

  const reanudar = async () => {
    const res = await gestionar('reanudar');
    if (res) showMessage(t('educadores.suscripcion.reanudado'), undefined, 'success');
  };

  const revertir = async () => {
    const res = await gestionar('revertirCancelacion');
    if (res) {
      showMessage(
        t('educadores.suscripcion.revertido', { plan: nombrePlan }),
        undefined,
        'success'
      );
    }
  };

  let textoCancelar = '';
  if (cancelable) {
    if (sub.estado === 'prueba') {
      textoCancelar = t('educadores.suscripcion.cancelacion.textoPrueba');
    } else if (enRetracto(sub, ahora)) {
      textoCancelar = t('educadores.suscripcion.cancelacion.textoRetracto');
    } else {
      const acceso = accesoAlCancelar(sub, ahora);
      textoCancelar =
        acceso > ahora
          ? t('educadores.suscripcion.cancelacion.textoPeriodo', {
              plan: nombrePlan,
              fecha: fechaLarga(acceso),
            })
          : t('educadores.suscripcion.cancelacion.textoHoy');
    }
  }

  const rutaPago =
    sub && esPlanIndividual(sub.plan) && sub.ciclo
      ? rutaPlanes(null, sub.plan, sub.ciclo)
      : rutaPlanes();
  const mostrarCambiar = !soloColegio && !enMora;
  const hayAcciones = mostrarCambiar || pausable || pausada || cancelable;

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[styles.page, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado
          titulo={t('educadores.suscripcion.titulo')}
          subtitulo={t('educadores.suscripcion.subtitulo')}
          atras="/(staff)/perfil"
        />

        {cargando ? (
          <Esqueleto filas={3} alto={96} />
        ) : (
          <>
            <SuscripcionResumen
              miPlan={miPlan}
              planMostrado={planMostrado}
              subPagada={subPagada}
              ahora={ahora}
            />

            {enMora && sub ? (
              <Aviso
                icono="card-outline"
                tono="naranja"
                texto={
                  sub.proximoReintento
                    ? t('educadores.estado.bannerMora', { fecha: fechaLarga(sub.proximoReintento) })
                    : t('educadores.estado.bannerMoraSinFecha', { plan: nombrePlan })
                }
              >
                <BotonChunky
                  texto={t('educadores.estado.actualizarPago')}
                  icono="card"
                  compacto
                  onPress={() => router.push(rutaPago)}
                />
              </Aviso>
            ) : null}

            {revertible && sub?.finPeriodo ? (
              <Aviso
                icono="arrow-undo"
                tono="marca"
                texto={t('educadores.suscripcion.revertirTexto', {
                  plan: nombrePlan,
                  fecha: fechaLarga(sub.finPeriodo),
                })}
              >
                <BotonChunky
                  texto={t('educadores.suscripcion.revertir', { plan: nombrePlan })}
                  icono="heart"
                  compacto
                  cargando={ocupado === 'revertirCancelacion'}
                  deshabilitado={ocupado !== null && ocupado !== 'revertirCancelacion'}
                  onPress={() => void revertir()}
                />
              </Aviso>
            ) : null}

            {hayAcciones ? (
              <View style={styles.bloque}>
                <Seccion texto={t('educadores.suscripcion.acciones')} />
                {mostrarCambiar ? (
                  <BotonChunky
                    texto={
                      subPagada || enPrueba
                        ? t('educadores.suscripcion.cambiarPlan')
                        : t('educadores.suscripcion.verPlanes')
                    }
                    icono="swap-horizontal"
                    variante="secundario"
                    deshabilitado={ocupado !== null}
                    onPress={() => router.push(rutaPlanes())}
                  />
                ) : null}
                {pausada ? (
                  <BotonChunky
                    texto={t('educadores.suscripcion.reanudar')}
                    icono="play"
                    cargando={ocupado === 'reanudar'}
                    deshabilitado={ocupado !== null && ocupado !== 'reanudar'}
                    onPress={() => void reanudar()}
                  />
                ) : null}
                {pausable ? (
                  <BotonChunky
                    texto={t('educadores.suscripcion.pausar')}
                    icono="pause"
                    variante="secundario"
                    deshabilitado={ocupado !== null}
                    onPress={abrirPausa}
                  />
                ) : null}
                {cancelable ? (
                  <BotonChunky
                    texto={t('educadores.suscripcion.cancelar')}
                    icono="close-circle-outline"
                    variante="peligro"
                    deshabilitado={ocupado !== null}
                    onPress={abrirCancelar}
                  />
                ) : null}
              </View>
            ) : null}

            <SuscripcionPagos recargar={recargarPagos} />
          </>
        )}

        <SuscripcionExportar plan={plan} />
        <SoporteWhatsApp />
        <SuscripcionTerminos />
      </ContextScrollView>

      <HojaPausa
        visible={hoja === 'pausa'}
        hasta={pausaHasta}
        cargando={ocupado === 'pausar'}
        onConfirmar={() => void confirmarPausa()}
        onClose={() => setHoja(null)}
      />
      <HojaCancelar
        visible={hoja === 'cancelar'}
        nombrePlan={hojaCancelar.nombrePlan}
        texto={hojaCancelar.texto}
        ofrecerPausa={hojaCancelar.pausa && ofrecerPausa}
        cargando={ocupado === 'cancelar'}
        onPausarEnVez={pausarEnVez}
        onConfirmar={() => void confirmarCancelar()}
        onClose={() => setHoja(null)}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 16 },
  bloque: { gap: 12 },
});
