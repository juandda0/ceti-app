/**
 * Mapa de un planeta: ya estamos en él, y cada nivel conquista una zona. Los
 * niveles van en zigzag de abajo hacia arriba, lecciones primero y el jefe al
 * final: vencerlo deja el planeta conquistado. Estilo minimalista: planetitas
 * planos (NodoPlaneta) unidos por puntos, con lo conquistado en el color del
 * planeta y una banderita en el nivel por el que vas. Los hechos se pueden repetir.
 *
 * Alrededor de los niveles hay algunos puntitos y estrellas de 4 puntas, grises, en los
 * huecos que dejan el camino, los cofres y los avisos; titilan despacio.
 *
 * La primera lección y el jefe llevan su cofre al lado libre: cerrado y en blanco y negro
 * hasta ganarlo, abierto (reclamado) y a color después. También se marcan el nivel que
 * cumple la meta del día y, si hoy no ha practicado, que el siguiente nivel suma racha.
 */
import { useEffect, useMemo } from 'react';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { FontAwesome6, Ionicons } from '@expo/vector-icons';
import { ICONOS_NODO, type IconoNodo } from '@features/learning/components/galaxia/iconosNodo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ESPACIO } from '@features/learning/components/galaxia/espacio';
import type { Planeta } from '@features/learning/data/planetas';
import { tieneCofre, type NodoMapa } from '@features/orbita/domain/niveles';
import PuenteDeMando from '@features/orbita/components/PuenteDeMando';
import Cofre from '@features/orbita/components/cofre/Cofre';
import { useReducedMotionSafe } from '@shared/constants/motion';
import NodoPlaneta, {
  CRATER_BANDERA,
  alcanceNodo,
  mezclar,
  type FormaNodo,
} from '@features/learning/components/galaxia/NodoPlaneta';
import { useOrbita } from '@features/orbita/hooks/useOrbita';

const NODO = 72;
const NODO_JEFE = 92;
const PASO = 132;
/** Alto extra bajo el jefe para su etiqueta. */
const ETIQUETA_JEFE = 30;
const AMPLITUD = 72;
/** Arriba cabe la bandera del jefe cuando es el nivel actual. */
const MARGEN_ARRIBA = 52;

// El mapa va sobre casi negro (el fondo base de la app; el negro puro cansa la vista) y sin
// estrellas: los niveles son lo único que resalta.
const FONDO = '#0E0E11';
const NARANJA_CETI = ESPACIO.naranja;
const BLOQUEADO_ICONO = '#4A4A52';
const PUNTO_PENDIENTE = '#3A3A42';

const COFRE = 64;
const COFRE_JEFE = 74;
const SEPARACION = 6;
const PILDORA = '#1A1A22';

// Puntos entre dos niveles: el del medio un poco más grande.
const PUNTOS = [6, 9, 6];

// Íconos de aventura espacial, gorditos y tiernos (calcados de Gemini en iconosNodo.ts): el profe
// elige el contenido, así que el ícono no dice el tema del nivel. Cada planeta los baraja con su semilla.
const ICONOS = Object.keys(ICONOS_NODO) as IconoNodo[];
const ICONO = 40;

function barajar<T>(items: readonly T[], semilla: string) {
  let h = 2166136261;
  for (const c of semilla) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const lista = [...items];
  for (let i = lista.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

/** Zigzag suave: el camino sigue una onda; vale también entre niveles (índice fraccionario). */
const onda = (indice: number) => Math.sin(indice * 1.1) * AMPLITUD;
const tamDe = (n: NodoMapa) => (n.tipo === 'jefe' ? NODO_JEFE : NODO);
// Unas lecciones llevan anillo y otras no, barajado por planeta (el nivel actual nunca: va iluminado).
const ANILLOS = [true, false, true, true, false, true];
/** La corona del jefe baja más que el círculo: su etiqueta va debajo de los picos. */
const BAJO_JEFE = NODO_JEFE * 0.62;

// Estrellitas del fondo: pocas, grises y planas.
const ESTRELLA = '#6A7194';
const PUNTITO = '#535873';
const POR_NIVEL = 3;
// Titileo: tres grupos desfasados que se apagan y se vuelven a iluminar.
const TITILEO_MS = [2600, 3400, 4200];
const TITILEO_MIN = 0.35;

interface Hueco {
  x: number;
  y: number;
  /** Radio libre alrededor del dibujo del nivel. */
  r: number;
}
interface Caja {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
interface Estrella {
  x: number;
  y: number;
  tam: number;
  punta: boolean;
}

/** Estrella de 4 puntas con los lados curvos hacia dentro. */
function puntas(x: number, y: number, s: number) {
  const k = s * 0.18;
  return (
    `M${x} ${y - s} C${x + k} ${y - k} ${x + k} ${y - k} ${x + s} ${y} ` +
    `C${x + k} ${y + k} ${x + k} ${y + k} ${x} ${y + s} ` +
    `C${x - k} ${y + k} ${x - k} ${y + k} ${x - s} ${y} ` +
    `C${x - k} ${y - k} ${x - k} ${y - k} ${x} ${y - s} Z`
  );
}

/**
 * Reparte unas estrellitas cerca de cada nivel (deterministas por planeta) sin pisar los
 * niveles, el camino de puntos ni las cajas de cofres, avisos y bandera.
 */
function sembrarEstrellas(
  semilla: string,
  ancho: number,
  alto: number,
  niveles: readonly Hueco[],
  camino: readonly { x: number; y: number }[],
  cajas: readonly Caja[]
): Estrella[] {
  let h = 2166136261;
  for (const c of semilla) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const azar = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
    return (h >>> 0) / 4294967296;
  };
  const libre = (x: number, y: number, holgura: number, puestas: readonly Estrella[]) =>
    x > 10 &&
    x < ancho - 10 &&
    y > 6 &&
    y < alto - 6 &&
    niveles.every((n) => Math.hypot(x - n.x, y - n.y) > n.r + holgura) &&
    camino.every((p) => Math.hypot(x - p.x, y - p.y) > 16 + holgura) &&
    cajas.every((c) => x < c.x1 - holgura || x > c.x2 + holgura || y < c.y1 - holgura || y > c.y2 + holgura) &&
    puestas.every((e) => Math.hypot(x - e.x, y - e.y) > 34);
  const out: Estrella[] = [];
  for (const n of niveles) {
    let puestas = 0;
    for (let intento = 0; intento < 30 && puestas < POR_NIVEL; intento++) {
      const a = azar() * Math.PI * 2;
      const d = n.r + 14 + azar() * 52;
      const x = n.x + Math.cos(a) * d;
      const y = n.y + Math.sin(a) * d;
      const punta = azar() < 0.4;
      const tam = punta ? 5 + azar() * 3 : 1.6 + azar() * 1.2;
      if (!libre(x, y, tam + 4, out)) continue;
      out.push({ x, y, tam, punta });
      puestas++;
    }
  }
  return out;
}

/** Un grupo de estrellitas que titila junto (opacidad de la capa, así anda igual en web). */
function CapaEstrellas({
  estrellas,
  ancho,
  alto,
  ms,
}: {
  estrellas: readonly Estrella[];
  ancho: number;
  alto: number;
  ms: number;
}) {
  const reducido = useReducedMotionSafe();
  const brillo = useSharedValue(1);
  useEffect(() => {
    if (reducido) return;
    brillo.value = withRepeat(
      withTiming(TITILEO_MIN, { duration: ms, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    return () => cancelAnimation(brillo);
  }, [reducido, ms, brillo]);
  const estilo = useAnimatedStyle(() => ({ opacity: brillo.value }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, estilo]}>
      <Svg width={ancho} height={alto}>
        {estrellas.map((e, i) =>
          e.punta ? (
            <Path key={i} d={puntas(e.x, e.y, e.tam)} fill={ESTRELLA} />
          ) : (
            <Circle key={i} cx={e.x} cy={e.y} r={e.tam} fill={PUNTITO} />
          )
        )}
      </Svg>
    </Animated.View>
  );
}

const ANCHO_BANDERA = 36;
const ALTO_BANDERA = 46;
const ASTA = 4;

/** Bandera grande con el asta derecha; (x, y) es el pie del asta, clavado en el cráter. */
function Bandera({ x, y }: { x: number; y: number }) {
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: x - ASTA / 2, top: y - ALTO_BANDERA + 1 }}
    >
      <Svg width={ANCHO_BANDERA} height={ALTO_BANDERA}>
        <Rect x={0} y={0} width={ASTA} height={ALTO_BANDERA} rx={ASTA / 2} fill="#ECEAF4" />
        <Path d="M4 3 C12 0 20 7 34 3 L34 21 C20 25 12 18 4 21 Z" fill={NARANJA_CETI} />
      </Svg>
    </View>
  );
}

export default function MapaPlaneta({
  nombre,
  planeta,
  nodos,
  totalLecciones,
  onNodo,
  onVolver,
  onGuia,
}: {
  nombre: string;
  planeta: Planeta;
  nodos: NodoMapa[];
  totalLecciones: number;
  onNodo: (nodo: NodoMapa) => void;
  onVolver: () => void;
  onGuia: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const hechos = nodos.filter((n) => n.estado === 'hecho').length;
  const conquistado = nodos.some((n) => n.tipo === 'jefe' && n.estado === 'hecho');
  const iconos = useMemo(() => barajar(ICONOS, planeta.animacion), [planeta.animacion]);
  // Lo conquistado va en el color del planeta, un poco más hondo que el nivel actual.
  const colorHecho = mezclar(planeta.acento, planeta.acentoOscuro, 0.3);
  const anillos = useMemo(() => barajar(ANILLOS, `${planeta.animacion}:anillos`), [planeta.animacion]);
  const formaDe = (n: NodoMapa): FormaNodo =>
    n.tipo === 'jefe' ? 'jefe' : n.estado !== 'actual' && anillos[n.indice % anillos.length] ? 'anillo' : 'liso';
  /** Media anchura del dibujo del nivel (anillo, halo u órbita se salen del círculo). */
  const alcanceDe = (n: NodoMapa) => tamDe(n) * alcanceNodo(formaDe(n));
  // La bandera va clavada arriba, corrida al lado contrario del siguiente nivel (no tapa los puntos).
  const ladoBandera = (n: NodoMapa) => (onda(n.indice + 1) > onda(n.indice) ? -1 : 1);
  const { resumen } = useOrbita();
  const actual = nodos.find((n) => n.estado === 'actual');
  // La meta del día se cumple en el nivel que hace la lección que falta (si cae en este planeta).
  const faltanMeta = resumen ? resumen.metaLecciones - resumen.leccionesHoy : 0;
  const metaEn = actual && faltanMeta > 0 ? actual.indice + faltanMeta - 1 : -1;
  const sumaRacha = !!resumen && !resumen.practicoHoy;

  // De abajo hacia arriba: el primer nivel queda al fondo, cerca del pulgar. Se calcula el
  // centro de cada nivel de arriba hacia abajo para ubicar nodos, puntos y bandera.
  const enOrden = useMemo(() => [...nodos].reverse(), [nodos]);
  const centros = useMemo(() => {
    const ys: number[] = [];
    enOrden.forEach((n, k) => {
      const previo = enOrden[k - 1];
      ys.push(
        previo
          ? ys[k - 1] + PASO + (previo.tipo === 'jefe' ? ETIQUETA_JEFE : 0)
          : MARGEN_ARRIBA + tamDe(n) / 2
      );
    });
    return ys;
  }, [enOrden]);
  const ultimo = enOrden[enOrden.length - 1];
  const altoCamino = (centros[centros.length - 1] ?? 0) + (ultimo ? tamDe(ultimo) / 2 : 0);
  const cx = (indice: number) => width / 2 + onda(indice);

  // Dónde van los cofres y avisos de cada nivel (lo usan el dibujo y las estrellitas).
  const lados = enOrden.map((n, k) => {
    const x = cx(n.indice);
    const tam = tamDe(n);
    const izq = x > width / 2 + 1;
    const alcance = alcanceDe(n);
    const left = izq ? 16 : x + alcance + SEPARACION;
    const ancho = izq ? x - alcance - SEPARACION - 16 : width - 16 - left;
    const jefe = n.tipo === 'jefe';
    const meta = n.indice === metaEn;
    const racha = n.estado === 'actual' && sumaRacha;
    const conCofre = tieneCofre(n.tipo, n.indice);
    const cofre = jefe ? COFRE_JEFE : COFRE;
    return { n, k, x, tam, izq, left, ancho, jefe, meta, racha, conCofre, cofre };
  });

  const estrellas = useMemo(() => {
    const niveles = lados.map((l) => ({ x: l.x, y: centros[l.k], r: alcanceDe(l.n) }));
    const camino: { x: number; y: number }[] = [];
    enOrden.forEach((n, k) => {
      const arriba = enOrden[k - 1];
      if (!arriba) return;
      for (let i = 0; i <= 8; i++) {
        const y = centros[k] + ((centros[k - 1] - centros[k]) * i) / 8;
        camino.push({ x: cx(n.indice + i / 8), y });
      }
    });
    const cajas: Caja[] = [];
    for (const l of lados) {
      const y = centros[l.k];
      if (l.conCofre || l.meta || l.racha) {
        const avisos = (l.meta ? 30 : 0) + (l.racha ? 30 : 0);
        const arriba = l.conCofre ? y - l.cofre / 2 : y - 30;
        cajas.push({ x1: l.left, y1: arriba, x2: l.left + l.ancho, y2: arriba + (l.conCofre ? l.cofre : 0) + avisos + 6 });
      }
      if (l.jefe) cajas.push({ x1: l.x - 60, y1: y, x2: l.x + 60, y2: y + BAJO_JEFE + 20 });
      if (l.n.estado === 'actual') cajas.push({ x1: l.x - 70, y1: y - l.tam / 2 - 44, x2: l.x + 70, y2: y - l.tam / 2 });
    }
    return sembrarEstrellas(planeta.animacion, width, altoCamino, niveles, camino, cajas);
    // lados y formaDe se recalculan en cada render, pero dependen solo de estas entradas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planeta.animacion, width, altoCamino, enOrden, centros, metaEn, sumaRacha, anillos]);

  const etiquetaDe = (n: NodoMapa) =>
    n.tipo === 'jefe'
      ? t('orbita.mapa.jefe')
      : t('orbita.mapa.leccion', { n: n.indice + 1, total: totalLecciones });

  return (
    <View style={[st.raiz, { width }]}>
      <View
        style={[st.cabecera, { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 12 : 8) + 8 }]}
      >
        <TouchableOpacity
          onPress={onVolver}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('galaxia.volver')}
          style={st.icono}
        >
          <Ionicons name="chevron-back" size={24} color={ESPACIO.texto} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[st.titulo]} numberOfLines={1} accessibilityRole="header">
            {nombre}
          </Text>
          <Text style={[st.sub, { color: planeta.acento }]}>
            {conquistado ? t('orbita.fin.conquistado') : t('orbita.mapa.progreso', { hechos, total: nodos.length })}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onGuia}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('galaxia.leerGuia')}
          style={st.icono}
        >
          <Ionicons name="book-outline" size={22} color={ESPACIO.texto} />
        </TouchableOpacity>
      </View>
      <View style={st.puente}>
        <PuenteDeMando compacto />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 96 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width, height: altoCamino }}>
          {TITILEO_MS.map((ms, g) => (
            <CapaEstrellas
              key={g}
              estrellas={estrellas.filter((_, i) => i % TITILEO_MS.length === g)}
              ancho={width}
              alto={altoCamino}
              ms={ms}
            />
          ))}
          {/* Puntos entre cada nivel y el de arriba, en el hueco libre entre los dos. */}
          {enOrden.map((n, k) => {
            const arriba = enOrden[k - 1];
            if (!arriba) return null;
            const yAbajo = centros[k];
            const yArriba = centros[k - 1];
            const desde = yAbajo - (tamDe(n) / 2 + 14);
            const hasta = yArriba + tamDe(arriba) / 2 + (arriba.tipo === 'jefe' ? ETIQUETA_JEFE : 0) + 14;
            const color = n.estado === 'hecho' ? colorHecho : PUNTO_PENDIENTE;
            return PUNTOS.map((tam, i) => {
              const y = desde + ((hasta - desde) * i) / (PUNTOS.length - 1);
              const x = cx(n.indice + (yAbajo - y) / (yAbajo - yArriba));
              return (
                <View
                  key={`p-${n.tipo}-${n.indice}-${i}`}
                  pointerEvents="none"
                  style={[st.punto, { left: x - tam / 2, top: y - tam / 2, width: tam, height: tam, backgroundColor: color }]}
                />
              );
            });
          })}

          {enOrden.map((n, k) => {
            const tam = tamDe(n);
            const x = cx(n.indice);
            const y = centros[k];
            const jefe = n.tipo === 'jefe';
            const hecho = n.estado === 'hecho';
            const bloqueado = n.estado === 'bloqueado';
            const bola = hecho ? colorHecho : planeta.acento;
            const icono = iconos[n.indice % iconos.length];
            return (
              <TouchableOpacity
                key={`${n.tipo}-${n.indice}`}
                onPress={() => {
                  void Haptics.selectionAsync();
                  onNodo(n);
                }}
                disabled={bloqueado}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={etiquetaDe(n)}
                accessibilityState={{ disabled: bloqueado, selected: n.estado === 'actual' }}
                style={[
                  st.nodo,
                  { left: x - tam / 2, top: y - tam / 2, width: tam, height: tam, borderRadius: tam / 2 },
                ]}
              >
                <NodoPlaneta
                  tam={tam}
                  forma={formaDe(n)}
                  color={bola}
                  bloqueado={bloqueado}
                  bandera={n.estado === 'actual' ? ladoBandera(n) : undefined}
                  calavera={jefe && !hecho}
                />
                {/* El jefe lleva su calavera dibujada en el nodo; vencido, el trofeo. */}
                {jefe && hecho && <FontAwesome6 name="trophy" solid size={42} color="#FFFFFF" />}
                {!jefe && (
                  // En un View para que quede encima del planeta (en web un <svg> suelto queda debajo).
                  <View pointerEvents="none">
                    <Svg width={ICONO} height={ICONO} viewBox="0 0 100 100">
                      <Path d={ICONOS_NODO[icono]} fill={bloqueado ? BLOQUEADO_ICONO : '#FFFFFF'} fillRule="evenodd" />
                    </Svg>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {enOrden.map((n, k) => {
            if (n.tipo !== 'jefe') return null;
            return (
              <Text
                key="etiqueta-jefe"
                style={[
                  st.jefeTexto,
                  {
                    left: cx(n.indice) - 60,
                    top: centros[k] + BAJO_JEFE + 2,
                    color: n.estado === 'bloqueado' ? BLOQUEADO_ICONO : colorHecho,
                  },
                ]}
              >
                {t('orbita.mapa.jefeCorto')}
              </Text>
            );
          })}

          {/* Cofre y avisos al lado libre del nivel (el contrario al que mira la onda). */}
          {lados.map(({ n, k, tam, izq, left, ancho, meta, racha, conCofre, cofre }) => {
            if (!conCofre && !meta && !racha) return null;
            return (
              <View
                key={`lado-${n.tipo}-${n.indice}`}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[
                  st.lado,
                  { left, width: ancho, alignItems: izq ? 'flex-end' : 'flex-start' },
                  // El cofre queda a la altura del nivel y los avisos debajo; sin cofre, los
                  // avisos se centran en el nivel.
                  conCofre
                    ? { top: centros[k] - cofre / 2 }
                    : { top: centros[k] - tam / 2, height: tam, justifyContent: 'center' },
                ]}
              >
                {conCofre && (
                  <Cofre
                    estado={n.estado === 'hecho' ? 'reclamado' : 'cerrado'}
                    gris={n.estado !== 'hecho'}
                    size={cofre}
                  />
                )}
                {meta && (
                  <View style={st.pildora}>
                    <Svg width={14} height={14}>
                      <Circle cx={7} cy={7} r={5} stroke={ESPACIO.oro} strokeWidth={3} fill="none" />
                    </Svg>
                    <Text style={st.pildoraTexto}>{t('orbita.mapa.metaDia')}</Text>
                  </View>
                )}
                {racha && (
                  <View style={st.pildora}>
                    <Ionicons name="flame" size={13} color="#FF9F45" />
                    <Text style={[st.pildoraTexto, { color: '#FF9F45' }]}>{t('orbita.mapa.racha')}</Text>
                  </View>
                )}
              </View>
            );
          })}

          {enOrden.map((n, k) => {
            if (n.estado !== 'actual') return null;
            const tam = tamDe(n);
            const lado = ladoBandera(n);
            return (
              <Bandera
                key="bandera"
                x={cx(n.indice) + (lado * CRATER_BANDERA.x * tam) / 100}
                y={centros[k] + (CRATER_BANDERA.y * tam) / 100}
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: FONDO, overflow: 'hidden' },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 6 },
  icono: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 22, fontWeight: '900', color: ESPACIO.texto },
  sub: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  puente: { paddingHorizontal: 16, paddingBottom: 4 },
  nodo: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  punto: { position: 'absolute', borderRadius: 999 },
  lado: { position: 'absolute', gap: 4 },
  pildora: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: PILDORA,
  },
  pildoraTexto: { fontSize: 12, fontWeight: '800', color: ESPACIO.texto },
  jefeTexto: { position: 'absolute', width: 120, textAlign: 'center', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
});
