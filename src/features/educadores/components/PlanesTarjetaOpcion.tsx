/**
 * Una opción de la pantalla de planes: nombre, lema, precio del ciclo elegido,
 * lo que incluye (sacado de PLANES) y la acción. Piloto va destacado; el plan
 * que llegó por el muro se marca con un borde más grueso.
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import {
  esPlanIndividual,
  formatoCop,
  MESES_POR_CICLO,
  PLANES,
  type Ciclo,
  type Funcion,
  type LimitesPlan,
  type PlanId,
} from '@/functions/src/educadores/dominio';
import { Pill } from '@features/dashboard/components/profe/kit';
import type { Cotizacion } from './PlanesCotizacion';

/** Plan sobre el que se construye cada uno ("Todo lo de …, y además:"). */
const BASE_DE: Record<PlanId, PlanId | null> = {
  cadete: null,
  piloto: 'cadete',
  comandante: 'piloto',
  nave: 'piloto',
};

interface Linea {
  clave: string;
  opciones?: Record<string, unknown>;
}

function lineasLimites(l: LimitesPlan, base: LimitesPlan | null): Linea[] {
  const lineas: Linea[] = [];
  if (!base || base.clases !== l.clases) {
    lineas.push({
      clave:
        Number.isFinite(l.clases) && l.clases <= 1 ? 'base.clasesUna' : 'base.clasesIlimitadas',
    });
  }
  if (!base || base.estudiantesPorClase !== l.estudiantesPorClase) {
    lineas.push({ clave: 'base.estudiantes', opciones: { count: l.estudiantesPorClase } });
  }
  if (l.iaGeneracionesMes > 0 && (!base || base.iaGeneracionesMes !== l.iaGeneracionesMes)) {
    lineas.push({ clave: 'base.ia', opciones: { count: l.iaGeneracionesMes } });
  }
  return lineas;
}

/** Lo que incluye un plan, en claves de `educadores.planes.*`. */
export function incluyePlan(plan: PlanId): { encabezado: string | null; lineas: Linea[] } {
  const def = PLANES[plan];
  const baseId = BASE_DE[plan];
  if (!baseId) {
    return {
      encabezado: null,
      lineas: [
        ...lineasLimites(def.limites, null),
        { clave: 'base.mundosCeti' },
        { clave: 'base.asignaciones' },
      ],
    };
  }
  const base = PLANES[baseId];
  const extra = def.funciones.filter((f: Funcion) => !base.funciones.includes(f));
  return {
    encabezado: baseId === 'cadete' ? 'base.todoCadete' : 'base.todoPiloto',
    lineas: [
      ...lineasLimites(def.limites, base.limites),
      ...extra.map((f) => ({ clave: `funcion.${f}` })),
    ],
  };
}

export default function PlanesTarjetaOpcion({
  plan,
  ciclo,
  cotizacion,
  destacado = false,
  marcado = false,
  etiqueta,
  accion,
  onLayout,
}: {
  plan: PlanId;
  ciclo: Ciclo;
  /** Solo para Piloto y Comandante. */
  cotizacion?: Cotizacion;
  destacado?: boolean;
  /** Llegó elegido desde el muro. */
  marcado?: boolean;
  /** Pill opcional junto al nombre (p. ej. "Prueba gratis"). */
  etiqueta?: ReactNode;
  accion: ReactNode;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const p = (clave: string, opciones?: Record<string, unknown>) =>
    t(`educadores.planes.${clave}`, opciones);
  const nombre = p(`nombre.${plan}`);
  const { encabezado, lineas } = incluyePlan(plan);
  const resaltada = destacado || marcado;

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.tarjeta,
        {
          backgroundColor: marcado ? colors.fill.brandSubtle : colors.materials.base,
          borderColor: resaltada ? colors.brand.primary : colors.materials.border,
          borderWidth: resaltada ? 2 : 1,
          borderBottomWidth: marcado ? 5 : resaltada ? 2 : 1,
        },
      ]}
    >
      {destacado || etiqueta ? (
        <View style={styles.pills}>
          {destacado ? <Pill texto={p('destacado')} tono="marca" icono="star" /> : null}
          {etiqueta}
        </View>
      ) : null}

      <View style={{ gap: 2 }}>
        <Text accessibilityRole="header" style={[styles.nombre, { color: colors.text.primary }]}>
          {nombre}
        </Text>
        <Text style={[styles.lema, { color: colors.text.secondary }]}>{p(`lema.${plan}`)}</Text>
      </View>

      <Precio plan={plan} ciclo={ciclo} cotizacion={cotizacion} />

      <View style={[styles.separador, { backgroundColor: colors.materials.border }]} />

      <View style={styles.lista}>
        {encabezado ? (
          <Text style={[styles.encabezadoLista, { color: colors.text.primary }]}>
            {p(encabezado)}
          </Text>
        ) : null}
        {lineas.map((l) => (
          <View key={l.clave} style={styles.linea}>
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={colors.system.green}
              style={{ marginTop: 1 }}
            />
            <Text style={[styles.lineaTexto, { color: colors.text.secondary }]}>
              {p(l.clave, l.opciones)}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 4 }}>{accion}</View>
    </View>
  );
}

function Precio({
  plan,
  ciclo,
  cotizacion,
}: {
  plan: PlanId;
  ciclo: Ciclo;
  cotizacion?: Cotizacion;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const p = (clave: string, opciones?: Record<string, unknown>) =>
    t(`educadores.planes.${clave}`, opciones);

  if (plan === 'cadete') {
    return <Text style={[styles.precio, { color: colors.text.primary }]}>{p('gratis')}</Text>;
  }

  if (!esPlanIndividual(plan) || !cotizacion) {
    return (
      <View style={{ gap: 4 }}>
        <Text style={[styles.precioNave, { color: colors.text.primary }]}>{p('nave.precio')}</Text>
        <Text style={[styles.nota, { color: colors.text.secondary }]}>{p('nave.texto')}</Text>
      </View>
    );
  }

  const meses = MESES_POR_CICLO[ciclo];
  const { montoCop, listaCop, fundador, cuposFundador, cargando } = cotizacion;
  return (
    <View style={{ gap: 6 }}>
      {fundador ? <Pill texto={p('fundador.titulo')} tono="morado" icono="sparkles" /> : null}
      <View style={styles.precioFila}>
        <Text
          style={[styles.precio, { color: colors.text.primary }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {formatoCop(montoCop)}
        </Text>
        <Text style={[styles.porCiclo, { color: colors.text.secondary }]}>
          {p(meses === 12 ? 'ciclo.porAnio' : meses === 6 ? 'ciclo.porSemestre' : 'ciclo.porMes')}
        </Text>
      </View>
      {fundador && listaCop > montoCop ? (
        <Text style={[styles.antes, { color: colors.text.tertiary }]}>
          {p('fundador.antes', { monto: formatoCop(listaCop) })}
        </Text>
      ) : null}
      <Text style={[styles.nota, { color: colors.text.tertiary }]}>
        {meses > 1
          ? `${p('ciclo.equivale', { monto: formatoCop(Math.round(montoCop / meses)) })} · ${p('ivaIncluido')}`
          : p('ivaIncluido')}
      </Text>
      {fundador ? (
        <Text style={[styles.nota, { color: colors.system.purple }]}>
          {p('fundador.cupos', { count: cuposFundador })}
        </Text>
      ) : null}
      {cargando ? (
        <Text style={[styles.nota, { color: colors.text.quaternary }]}>{p('cargandoPrecio')}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { borderRadius: 22, padding: 18, gap: 14 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  nombre: { fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.3 },
  lema: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  precioFila: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  precio: { fontSize: 32, lineHeight: 38, fontWeight: '900', letterSpacing: -0.5 },
  precioNave: { fontSize: 20, lineHeight: 25, fontWeight: '900' },
  porCiclo: { fontSize: 15, fontWeight: '800' },
  antes: { fontSize: 14, fontWeight: '700', textDecorationLine: 'line-through' },
  nota: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  separador: { height: 1, alignSelf: 'stretch' },
  lista: { gap: 9 },
  encabezadoLista: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  linea: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  lineaTexto: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: '600' },
});
