/**
 * Regreso de Wompi (`/pago?id=<transactionId>`): espera la confirmación del
 * servidor (webhook → `pagos/*` y `suscripciones/{uid}`) y muestra el resultado.
 * Lee los pagos cada pocos segundos y también reacciona a la suscripción en
 * vivo. Pasado ~1 minuto deja de esperar en pantalla y promete el correo.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { CetiAnimation } from '@features/animations';
import { BotonChunky, Vacio } from '@features/dashboard/components/profe/kit';
import { useMiPlan } from '../hooks/useMiPlan';
import { suscripcionRepository, type PagoDoc } from '../data/suscripcionRepository';
import { ESPERA_RETORNO_MS, estadoRetorno } from '../data/retornoPago';
import { rutaPlanes } from './MuroPlan';

const CADA_MS = 4000;

export default function PagoRetorno() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const uid = useAuthStore((s) => s.firebaseUid);
  const { sub } = useMiPlan();
  const [pagos, setPagos] = useState<PagoDoc[]>([]);
  const [agotado, setAgotado] = useState(false);
  const inicio = useRef(Date.now());

  const resultado = estadoRetorno(pagos, sub, Date.now());
  const resuelto = resultado.estado !== 'pendiente';

  // Lee los pagos al llegar, cada pocos segundos y cuando cambia la suscripción.
  useEffect(() => {
    if (!uid || resuelto) return;
    let cancelled = false;
    const leer = () =>
      void suscripcionRepository
        .pagos(uid)
        .then((p) => {
          if (!cancelled) setPagos(p);
        })
        .catch(() => undefined);
    leer();
    const id = setInterval(() => {
      if (Date.now() - inicio.current >= ESPERA_RETORNO_MS) setAgotado(true);
      leer();
    }, CADA_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [uid, resuelto, sub]);

  const irClases = () => router.replace('/(staff)/clases' as Href);

  let contenido;
  if (resultado.estado === 'aprobado') {
    const plan = t(`educadores.planes.nombre.${resultado.plan ?? sub?.plan ?? 'piloto'}`);
    contenido = (
      <>
        <View style={styles.ceti}>
          <CetiAnimation id="celebration.rocket-launch" size={160} />
        </View>
        <Vacio
          icono="rocket"
          tono="verde"
          titulo={t('educadores.pago.retorno.aprobado', { plan })}
          texto={t('educadores.pago.retorno.aprobadoTexto')}
          accion={
            <BotonChunky
              texto={t('educadores.pago.retorno.irClases')}
              icono="people"
              onPress={irClases}
            />
          }
        />
      </>
    );
  } else if (resultado.estado === 'rechazado') {
    contenido = (
      <Vacio
        icono="card-outline"
        tono="naranja"
        titulo={t('educadores.pago.retorno.rechazado')}
        texto={t('educadores.pago.retorno.rechazadoTexto')}
        accion={
          <BotonChunky
            texto={t('educadores.pago.retorno.reintentar')}
            icono="refresh"
            onPress={() => router.replace(rutaPlanes())}
          />
        }
      />
    );
  } else if (agotado) {
    contenido = (
      <Vacio
        icono="mail-outline"
        tono="azul"
        titulo={t('educadores.pago.retorno.demora')}
        texto={t('educadores.pago.retorno.demoraTexto')}
        accion={
          <View style={{ gap: 10 }}>
            <BotonChunky
              texto={t('educadores.pago.retorno.irClases')}
              icono="people"
              onPress={irClases}
            />
            <BotonChunky
              texto={t('educadores.pago.retorno.verPlan')}
              icono="rocket-outline"
              variante="secundario"
              onPress={() => router.replace('/(staff)/suscripcion' as Href)}
            />
          </View>
        }
      />
    );
  } else {
    contenido = (
      <>
        <View style={styles.ceti}>
          <CetiAnimation id="mascot.ceti-vuelo-reposo" size={140} />
        </View>
        <Vacio
          icono="hourglass-outline"
          titulo={t('educadores.pago.retorno.confirmando')}
          texto={t('educadores.pago.retorno.confirmandoTexto')}
        />
      </>
    );
  }

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[styles.page, { paddingTop: insets.top + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View accessibilityLiveRegion="polite" style={{ gap: 16 }}>
          {contenido}
        </View>
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 16 },
  ceti: { alignItems: 'center' },
});
