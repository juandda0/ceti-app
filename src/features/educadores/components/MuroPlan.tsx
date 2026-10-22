/**
 * El muro de pago del profe: una hoja corta que dice de qué plan es la
 * herramienta, por qué, cuánto cuesta (Año escolar y Mensual) y deja ir a ver
 * los planes. Siempre con "Ahora no": nunca bloquea enseñar y nunca apura.
 *
 * Uso: `const muro = useMuro();` → `muro.abrir('clases')` y renderizar
 * `{muro.hoja}` una vez en la pantalla. `muro.exigir(funcion)` abre el muro y
 * devuelve false si el plan no la incluye (mientras carga el plan, deja pasar:
 * el servidor es quien de verdad hace cumplir el límite).
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import Bounceable from '@shared/components/Bounceable';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import {
  ahorroAnioEscolar,
  esPlanIndividual,
  formatoCop,
  precioPlan,
  type Ciclo,
  type Funcion,
  type PlanId,
} from '@/functions/src/educadores/dominio';
import { BotonChunky, Pill } from '@features/dashboard/components/profe/kit';
import { useMiPlan } from '../hooks/useMiPlan';
import { esFuncion, planParaMotivo, type Motivo } from '../data/planUi';
import { abrirWhatsApp } from './abrirEnlace';

/** Ruta de la pantalla de planes con su motivo (y, opcional, plan y ciclo elegidos). */
export function rutaPlanes(motivo?: Motivo | null, plan?: PlanId, ciclo?: Ciclo): Href {
  const q = new URLSearchParams();
  if (motivo) q.set('motivo', motivo);
  if (plan) q.set('plan', plan);
  if (ciclo) q.set('ciclo', ciclo);
  const s = q.toString();
  return `/(staff)/planes${s ? `?${s}` : ''}` as Href;
}

/** Razón de una línea del muro, en la voz de Ceti. */
export function useRazonMuro(motivo: Motivo | null): { plan: PlanId; razon: string } {
  const { t } = useTranslation();
  const { plan: actual, limites } = useMiPlan();
  if (!motivo) return { plan: 'piloto', razon: '' };
  const plan = planParaMotivo(motivo, actual);
  const nombre = t(`educadores.planes.nombre.${plan}`);
  let razon: string;
  if (esFuncion(motivo)) {
    razon = t('educadores.muro.razon.funcion', {
      funcion: t(`educadores.planes.funcion.${motivo}`),
      plan: nombre,
    });
  } else if (motivo === 'ia' && limites.iaGeneracionesMes > 0) {
    razon = t('educadores.muro.razon.iaAgotada', { plan: nombre });
  } else {
    razon = t(`educadores.muro.razon.${motivo}`, { plan: nombre });
  }
  return { plan, razon };
}

export default function MuroPlan({
  motivo,
  onClose,
}: {
  /** null = cerrado. */
  motivo: Motivo | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const { plan, razon } = useRazonMuro(motivo);
  const nombre = t(`educadores.planes.nombre.${plan}`);

  const ir = (ciclo?: Ciclo) => {
    onClose();
    router.push(rutaPlanes(motivo, plan, ciclo));
  };

  const mini = (ciclo: Ciclo) => {
    if (!esPlanIndividual(plan)) return null;
    const anio = ciclo === 'anioEscolar';
    const precio = formatoCop(precioPlan(plan, ciclo));
    return (
      <Bounceable
        key={ciclo}
        onPress={() => ir(ciclo)}
        activeScale={0.97}
        accessibilityRole="button"
        accessibilityLabel={`${t(anio ? 'educadores.muro.anio' : 'educadores.muro.mensual')}: ${precio}`}
        style={[
          styles.mini,
          {
            backgroundColor: anio ? colors.fill.brandSubtle : colors.materials.base,
            borderColor: anio ? colors.brand.primary : colors.materials.border,
          },
        ]}
      >
        <Text style={[styles.miniCiclo, { color: colors.text.secondary }]} numberOfLines={1}>
          {t(anio ? 'educadores.muro.anio' : 'educadores.muro.mensual')}
        </Text>
        <Text
          style={[styles.miniPrecio, { color: colors.text.primary }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {precio}
        </Text>
        <Text style={[styles.miniNota, { color: colors.text.tertiary }]} numberOfLines={1}>
          {anio ? t('educadores.planes.ciclo.porAnio') : t('educadores.planes.ciclo.porMes')}
        </Text>
        {anio ? (
          <Pill
            texto={t('educadores.muro.ahorras', { pct: ahorroAnioEscolar(plan) })}
            tono="verde"
            style={{ marginTop: 4 }}
          />
        ) : null}
      </Bounceable>
    );
  };

  return (
    <CetiBottomSheet visible={motivo !== null} onClose={onClose} closeOnBackdropPress contentOnly>
      <View style={styles.cabeza}>
        <View style={[styles.icono, { backgroundColor: colors.fill.brandSubtle }]}>
          <Ionicons name="rocket" size={24} color={colors.brand.primary} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text accessibilityRole="header" style={[styles.titulo, { color: colors.text.primary }]}>
            {t('educadores.muro.titulo', { plan: nombre })}
          </Text>
          <Text style={[styles.razon, { color: colors.text.secondary }]}>{razon}</Text>
        </View>
      </View>

      {esPlanIndividual(plan) ? (
        <View style={styles.minis}>{(['anioEscolar', 'mensual'] as const).map(mini)}</View>
      ) : null}

      <Text style={[styles.nota, { color: colors.text.tertiary }]}>
        {t('educadores.muro.ensenarGratis')}
      </Text>

      <BotonChunky
        texto={plan === 'nave' ? t('educadores.planes.nave.cta') : t('educadores.muro.verPlanes')}
        icono={plan === 'nave' ? 'logo-whatsapp' : 'sparkles'}
        onPress={() =>
          plan === 'nave' ? abrirWhatsApp(t('educadores.planes.nave.mensaje')) : ir()
        }
      />
      <BotonFantasma texto={t('educadores.muro.ahoraNo')} onPress={onClose} />
    </CetiBottomSheet>
  );
}

/** "Ahora no": texto sin relieve, siempre visible y del mismo peso visual que una salida. */
export function BotonFantasma({ texto, onPress }: { texto: string; onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <Bounceable
      onPress={onPress}
      activeScale={0.96}
      accessibilityRole="button"
      accessibilityLabel={texto}
      hitSlop={6}
      style={styles.fantasma}
    >
      <Text style={[styles.fantasmaTexto, { color: colors.text.secondary }]}>{texto}</Text>
    </Bounceable>
  );
}

export interface Muro {
  abrir: (motivo: Motivo) => void;
  cerrar: () => void;
  /** Devuelve true si puede usar la función; si no, abre el muro y devuelve false. */
  exigir: (funcion: Funcion) => boolean;
  /** Renderizar una vez en la pantalla. */
  hoja: ReactNode;
}

export function useMuro(): Muro {
  const [motivo, setMotivo] = useState<Motivo | null>(null);
  const { puede, cargando } = useMiPlan();
  const abrir = useCallback((m: Motivo) => setMotivo(m), []);
  const cerrar = useCallback(() => setMotivo(null), []);
  const exigir = useCallback(
    (f: Funcion) => {
      if (cargando || puede(f)) return true;
      setMotivo(f);
      return false;
    },
    [cargando, puede]
  );
  const hoja = useMemo(() => <MuroPlan motivo={motivo} onClose={cerrar} />, [motivo, cerrar]);
  return { abrir, cerrar, exigir, hoja };
}

const styles = StyleSheet.create({
  cabeza: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  icono: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.3 },
  razon: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  minis: { flexDirection: 'row', gap: 10, marginTop: 4 },
  mini: {
    flex: 1,
    minWidth: 0,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: 18,
    padding: 14,
    gap: 2,
  },
  miniCiclo: { fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },
  miniPrecio: { fontSize: 22, lineHeight: 27, fontWeight: '900' },
  miniNota: { fontSize: 12, fontWeight: '700' },
  nota: { fontSize: 13, lineHeight: 18, fontWeight: '600', textAlign: 'center' },
  fantasma: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 18 },
  fantasmaTexto: { fontSize: 15, fontWeight: '800' },
});
