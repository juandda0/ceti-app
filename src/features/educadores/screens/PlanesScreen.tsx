/**
 * Planes del profe: Cadete (gratis), Piloto, Comandante y Nave, con el ciclo
 * (Año escolar por defecto) y el precio que vería hoy. Llega desde el muro con
 * `?motivo=&plan=&ciclo=`: dice por qué en el subtítulo y marca el plan que lo
 * resuelve, pero nunca abre el pago solo. "Ahora no" siempre está a la vista.
 */
import { useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import { ScrollView, StyleSheet, Text, View, type ScrollViewProps } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import {
  esCiclo,
  esPlanId,
  esPlanIndividual,
  PLAN_IDS,
  PLANES,
  type Ciclo,
  type PlanId,
} from '@/functions/src/educadores/dominio';
import { BotonChunky, Encabezado, Pill } from '@features/dashboard/components/profe/kit';
import { useMiPlan } from '../hooks/useMiPlan';
import { esFuncion, esMotivo, planParaMotivo, type Motivo } from '../data/planUi';
import { BotonFantasma } from '../components/MuroPlan';
import { abrirWhatsApp } from '../components/abrirEnlace';
import PlanesSelectorCiclo from '../components/PlanesSelectorCiclo';
import PlanesTarjetaOpcion from '../components/PlanesTarjetaOpcion';
import { useCotizaciones } from '../components/PlanesCotizacion';

// React 19 pasa `ref` como prop y ContextScrollView reparte sus props al ScrollView.
const ScrollConRef = ContextScrollView as unknown as ComponentType<
  ScrollViewProps & { ref?: Ref<ScrollView> }
>;

/** Ruta del pago de un plan individual. */
export function rutaPago(plan: PlanId, ciclo: Ciclo, motivo?: Motivo | null): Href {
  const q = new URLSearchParams({ plan, ciclo });
  if (motivo) q.set('motivo', motivo);
  return `/(staff)/pago?${q.toString()}` as Href;
}

export default function PlanesScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ motivo?: string; plan?: string; ciclo?: string }>();

  const motivo: Motivo | null = esMotivo(params.motivo) ? params.motivo : null;
  const planQuery: PlanId | null = esPlanId(params.plan) ? params.plan : null;
  const [ciclo, setCiclo] = useState<Ciclo>(esCiclo(params.ciclo) ? params.ciclo : 'anioEscolar');

  const { plan: actual, sub, limites } = useMiPlan();
  const enPrueba = sub?.estado === 'prueba';
  const cotizaciones = useCotizaciones(ciclo);

  const nombre = (p: PlanId) => t(`educadores.planes.nombre.${p}`);

  // "Ya tienes N clases": el número real (tras bajar de plan puede pasar del límite).
  const colegioId = useAuthStore((s) => s.colegioId);
  const uid = useAuthStore((s) => s.firebaseUid);
  const [numClases, setNumClases] = useState<number | null>(null);
  useEffect(() => {
    if (motivo !== 'clases' || !colegioId || !uid) return;
    let cancelled = false;
    void rosterRepository
      .getCursosByProfesor(colegioId, uid)
      .then((l) => {
        if (!cancelled) setNumClases(l.length);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [motivo, colegioId, uid]);

  const subtitulo = (() => {
    if (!motivo) return t('educadores.planes.subtitulo');
    const plan = nombre(planParaMotivo(motivo, actual));
    if (esFuncion(motivo)) {
      return t('educadores.planes.motivo.funcion', {
        funcion: t(`educadores.planes.funcion.${motivo}`),
        plan,
      });
    }
    if (motivo === 'clases') {
      const count = numClases ?? (Number.isFinite(limites.clases) ? limites.clases : 1);
      return t('educadores.planes.motivo.clases', { count, plan });
    }
    if (motivo === 'ia') {
      return limites.iaGeneracionesMes > 0
        ? t('educadores.planes.motivo.iaAgotada', { count: limites.iaGeneracionesMes, plan })
        : t('educadores.planes.motivo.ia', { plan });
    }
    return t('educadores.planes.motivo.estudiantes', { count: limites.estudiantesPorClase, plan });
  })();

  // Scroll suave hasta el plan que llegó por el muro (una sola vez).
  const scrollRef = useRef<ScrollView>(null);
  const posiciones = useRef<{ lista: number | null; tarjeta: number | null }>({
    lista: null,
    tarjeta: null,
  });
  const yaBajo = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentarScroll = () => {
    const { lista, tarjeta } = posiciones.current;
    if (yaBajo.current || !planQuery || lista === null || tarjeta === null) return;
    yaBajo.current = true;
    // Deja que los bloques terminen de armarse antes de bajar.
    timer.current = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, lista + tarjeta - 16), animated: true });
    }, 450);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const salir = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(staff)/clases' as Href);
  };

  const accionDe = (p: PlanId) => {
    const esActual = p === actual && !(enPrueba && p === 'piloto');
    if (esActual) {
      return (
        <View style={styles.actual}>
          <Pill texto={t('educadores.planes.actual')} tono="marca" icono="checkmark-circle" />
          {p === 'cadete' ? (
            <Text style={[styles.actualNota, { color: colors.text.secondary }]}>
              {t('educadores.planes.seguirCadete')}
            </Text>
          ) : null}
        </View>
      );
    }
    if (p === 'nave') {
      return (
        <BotonChunky
          texto={t('educadores.planes.nave.cta')}
          icono="logo-whatsapp"
          variante={planQuery === 'nave' ? 'primario' : 'secundario'}
          onPress={() => abrirWhatsApp(t('educadores.planes.nave.mensaje'))}
        />
      );
    }
    // Cadete no se "elige": se vuelve a él cancelando desde Tu plan. Tampoco se
    // ofrece un plan menor que el vigente (p. ej. con la licencia Nave del colegio).
    if (!esPlanIndividual(p) || PLANES[p].rango < PLANES[actual].rango) return null;
    return (
      <BotonChunky
        texto={t('educadores.planes.elegir', { plan: nombre(p) })}
        icono="sparkles"
        variante={p === 'piloto' || planQuery === p ? 'primario' : 'secundario'}
        onPress={() => router.push(rutaPago(p, ciclo, motivo))}
      />
    );
  };

  return (
    <ScreenWrapper>
      <ScrollConRef
        ref={scrollRef}
        contentContainerStyle={[styles.page, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado
          atras="/(staff)/clases"
          titulo={t('educadores.planes.titulo')}
          subtitulo={subtitulo}
          // "Ahora no" a la vista desde el primer momento (y otra vez al final de la lista).
          derecha={<BotonFantasma texto={t('educadores.planes.ahoraNo')} onPress={salir} />}
        />

        <PlanesSelectorCiclo ciclo={ciclo} onCambiar={setCiclo} />

        <View
          style={styles.lista}
          onLayout={(e) => {
            posiciones.current.lista = e.nativeEvent.layout.y;
            intentarScroll();
          }}
        >
          {PLAN_IDS.map((p) => (
            <PlanesTarjetaOpcion
              key={p}
              plan={p}
              ciclo={ciclo}
              cotizacion={esPlanIndividual(p) ? cotizaciones[p] : undefined}
              destacado={p === 'piloto'}
              marcado={p === planQuery}
              etiqueta={
                enPrueba && p === 'piloto' ? (
                  <Pill texto={t('educadores.estado.prueba')} tono="verde" icono="time" />
                ) : undefined
              }
              accion={accionDe(p)}
              onLayout={
                p === planQuery
                  ? (e) => {
                      posiciones.current.tarjeta = e.nativeEvent.layout.y;
                      intentarScroll();
                    }
                  : undefined
              }
            />
          ))}
        </View>

        <View style={styles.pie}>
          <Text style={[styles.legal, { color: colors.text.tertiary }]}>
            {t('educadores.planes.legal')}
          </Text>
          <BotonFantasma texto={t('educadores.planes.ahoraNo')} onPress={salir} />
        </View>
      </ScrollConRef>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 18 },
  lista: { gap: 14 },
  actual: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  actualNota: { fontSize: 14, fontWeight: '700' },
  pie: { gap: 8 },
  legal: { fontSize: 12, lineHeight: 17, fontWeight: '600', textAlign: 'center' },
});
