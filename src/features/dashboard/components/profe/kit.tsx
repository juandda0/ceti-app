/**
 * Kit visual del profesor: las mismas piezas que ve el estudiante (títulos 900,
 * tarjetas planas con borde, botón "chunky" de Aprender, chips, barras que crecen)
 * para que el panel docente se sienta parte de la misma app. Todo lo que anima
 * usa transform/opacity (UI thread, también en web) y respeta "reducir movimiento".
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated as RNAnimated,
  Easing as RNEasing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Bounceable from '@shared/components/Bounceable';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import {
  pressInTiming,
  pressOutTiming,
  stateTiming,
  useReducedMotionSafe,
} from '@shared/constants/motion';
import { BrandColors, type ThemeColors } from '@shared/constants/colors';

type IconName = keyof typeof Ionicons.glyphMap;

// ─── Encabezado ──────────────────────────────────────────────────────────────

/**
 * Título de pantalla como en las pestañas del estudiante (34/900). Las pantallas
 * empujadas llevan `atras` (vuelve en el historial o va al fallback) y un título
 * un poco menor para nombres largos de clase o mundo.
 */
export function Encabezado({
  titulo,
  subtitulo,
  sobretitulo,
  atras,
  derecha,
}: {
  titulo: string;
  subtitulo?: string | null;
  sobretitulo?: string;
  /** Ruta a la que vuelve si no hay historial (enlace directo en web). */
  atras?: string;
  derecha?: ReactNode;
}) {
  const colors = useThemeColors();
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <View style={k.encabezado}>
      {atras ? (
        <Bounceable
          // Cast: la unión de typed-routes se regenera desde el sistema de archivos al compilar.
          onPress={() => (router.canGoBack() ? router.back() : router.replace(atras as Href))}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={8}
          activeScale={0.9}
          style={[k.atras, { backgroundColor: colors.materials.highlight }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text.primary} />
        </Bounceable>
      ) : null}
      <View style={k.encabezadoTexto}>
        <View style={k.encabezadoFila}>
          <View style={{ flex: 1, gap: 4 }}>
            {sobretitulo ? (
              <View style={k.sobretituloFila}>
                <View style={[k.sobretituloPunto, { backgroundColor: colors.brand.primary }]} />
                <Text style={[k.sobretitulo, { color: colors.brand.primary }]} numberOfLines={1}>
                  {sobretitulo.toUpperCase()}
                </Text>
              </View>
            ) : null}
            <Text
              accessibilityRole="header"
              style={[atras ? k.tituloDetalle : k.titulo, { color: colors.text.primary }]}
            >
              {titulo}
            </Text>
          </View>
          {derecha}
        </View>
        {subtitulo ? (
          <Text style={[k.subtitulo, { color: colors.text.secondary }]}>{subtitulo}</Text>
        ) : null}
      </View>
    </View>
  );
}

/** Rótulo de sección (mayúsculas, como las etiquetas de la tarjeta de mundo). */
export function Seccion({ texto, derecha }: { texto: string; derecha?: ReactNode }) {
  const colors = useThemeColors();
  return (
    <View style={k.seccion}>
      <Text style={[k.seccionTexto, { color: colors.text.tertiary }]}>{texto.toUpperCase()}</Text>
      {derecha}
    </View>
  );
}

// ─── Botón chunky ────────────────────────────────────────────────────────────

type Variante = 'primario' | 'secundario' | 'peligro';

const BORDE = 5;

/**
 * Botón con relieve de Aprender: una cara que se hunde sobre su borde inferior al
 * presionar (solo transform, así que también es fluido en web). `color` cambia el
 * acento del primario (p. ej. el color de un mundo).
 */
export function BotonChunky({
  texto,
  onPress,
  variante = 'primario',
  icono,
  cargando = false,
  deshabilitado = false,
  color,
  colorOscuro,
  compacto = false,
  style,
}: {
  texto: string;
  onPress: () => void;
  variante?: Variante;
  icono?: IconName;
  cargando?: boolean;
  deshabilitado?: boolean;
  color?: string;
  colorOscuro?: string;
  compacto?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  const hundido = useSharedValue(0);
  const apagado = deshabilitado || cargando;
  const {
    cara,
    borde,
    tinta,
    icono: tintaIcono,
    linea,
  } = paletaBoton(colors, variante, color, colorOscuro);
  const alto = compacto ? 44 : 52;

  const caraStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hundido.value * (BORDE - 1) }],
  }));

  return (
    <Pressable
      onPress={() => {
        if (apagado) return;
        if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      onPressIn={() => {
        if (!apagado) hundido.value = withTiming(1, pressInTiming);
      }}
      onPressOut={() => {
        hundido.value = withTiming(0, pressOutTiming);
      }}
      disabled={apagado}
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityState={{ disabled: apagado, busy: cargando }}
      style={[
        k.botonBase,
        { height: alto + BORDE, backgroundColor: borde, opacity: deshabilitado ? 0.45 : 1 },
        style,
      ]}
    >
      <Animated.View
        style={[
          k.botonCara,
          { height: alto, backgroundColor: cara },
          compacto && k.botonCaraCompacta,
          linea ? { borderWidth: 2, borderColor: linea } : null,
          caraStyle,
        ]}
      >
        {cargando ? (
          <ActivityIndicator color={tinta} />
        ) : (
          <>
            {icono ? <Ionicons name={icono} size={compacto ? 17 : 19} color={tintaIcono} /> : null}
            <Text
              style={[k.botonTexto, { color: tinta, fontSize: compacto ? 15 : 16 }]}
              numberOfLines={1}
            >
              {texto}
            </Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

function paletaBoton(
  colors: ThemeColors,
  variante: Variante,
  color?: string,
  colorOscuro?: string
): { cara: string; borde: string; tinta: string; icono: string; linea?: string } {
  if (variante === 'secundario') {
    // El texto queda en el color de texto (contraste); el acento va solo en el ícono.
    return {
      cara: colors.materials.base,
      borde: colors.materials.border,
      tinta: colors.text.primary,
      icono: color ?? colors.text.primary,
      linea: colors.materials.border,
    };
  }
  if (variante === 'peligro') {
    return {
      cara: colors.materials.base,
      borde: colors.materials.border,
      tinta: colors.system.red,
      icono: colors.system.red,
      linea: colors.materials.border,
    };
  }
  return {
    cara: color ?? colors.brand.primary,
    borde: colorOscuro ?? (color ? oscurecer(color) : colors.brand.primaryDark),
    tinta: colors.text.onBrand,
    icono: colors.text.onBrand,
  };
}

/** Sombra del mismo tono para el borde del botón (hex #RRGGBB → ~25 % más oscuro). */
export function oscurecer(hex: string, factor = 0.75): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const c = (s: number) =>
    Math.round(((n >> s) & 255) * factor)
      .toString(16)
      .padStart(2, '0');
  return `#${c(16)}${c(8)}${c(0)}`;
}

// ─── Tarjetas ────────────────────────────────────────────────────────────────

/**
 * Tarjeta plana con borde (como las de Gráficas). Con `onPress` se encoge
 * apenas al tocarla.
 */
export function Tarjeta({
  children,
  acento,
  onPress,
  accessibilityLabel,
  style,
}: {
  children: ReactNode;
  acento?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  const base: StyleProp<ViewStyle> = [
    k.tarjeta,
    { backgroundColor: colors.materials.base, borderColor: acento ?? colors.materials.border },
    style,
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Bounceable
      onPress={onPress}
      activeScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={base}
    >
      {children}
    </Bounceable>
  );
}

/** Caja de mensaje con fondo suave (insight de Gráficas): avisos, diagnósticos. */
export function Aviso({
  icono,
  texto,
  tono = 'marca',
  children,
}: {
  icono: IconName;
  texto?: string;
  tono?: Tono;
  children?: ReactNode;
}) {
  const colors = useThemeColors();
  const { fondo, tinta } = paletaTono(colors, tono);
  return (
    <View style={[k.aviso, { backgroundColor: fondo }]}>
      <View style={[k.avisoIcono, { backgroundColor: colors.materials.base }]}>
        <Ionicons name={icono} size={18} color={tinta} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        {texto ? <Text style={[k.avisoTexto, { color: colors.text.primary }]}>{texto}</Text> : null}
        {children}
      </View>
    </View>
  );
}

/** Estado vacío / error: icono grande en cuadro + título + texto + acción opcional. */
export function Vacio({
  icono,
  titulo,
  texto,
  tono = 'marca',
  accion,
}: {
  icono: IconName;
  titulo: string;
  texto?: string;
  tono?: Tono;
  accion?: ReactNode;
}) {
  const colors = useThemeColors();
  const { fondo, tinta } = paletaTono(colors, tono);
  return (
    <View style={[k.vacio, { backgroundColor: fondo, borderColor: colors.materials.border }]}>
      <View style={[k.vacioIcono, { backgroundColor: colors.materials.base }]}>
        <Ionicons name={icono} size={28} color={tinta} />
      </View>
      <Text style={[k.vacioTitulo, { color: colors.text.primary }]}>{titulo}</Text>
      {texto ? <Text style={[k.vacioTexto, { color: colors.text.secondary }]}>{texto}</Text> : null}
      {accion ? <View style={{ alignSelf: 'stretch', marginTop: 6 }}>{accion}</View> : null}
    </View>
  );
}

// ─── Chips, pills, avatar ────────────────────────────────────────────────────

/** Chip de opción con relieve: elegido toma el color (borde + fondo tenue + texto). */
export function Chip({
  texto,
  seleccionado,
  onPress,
  color,
  icono,
  grande = false,
}: {
  texto: string;
  seleccionado: boolean;
  onPress: () => void;
  color?: string;
  icono?: IconName;
  grande?: boolean;
}) {
  const colors = useThemeColors();
  const acento = color ?? colors.brand.primary;
  return (
    <Bounceable
      onPress={() => {
        if (Platform.OS !== 'web') void Haptics.selectionAsync();
        onPress();
      }}
      activeScale={0.94}
      accessibilityRole="button"
      accessibilityState={{ selected: seleccionado }}
      accessibilityLabel={texto}
      style={[
        k.chip,
        grande && k.chipGrande,
        {
          backgroundColor: seleccionado ? acento + '22' : colors.materials.base,
          borderColor: seleccionado ? acento : colors.materials.border,
        },
      ]}
    >
      {icono ? (
        <Ionicons name={icono} size={16} color={seleccionado ? acento : colors.text.tertiary} />
      ) : null}
      <Text
        style={[
          k.chipTexto,
          grande && k.chipTextoGrande,
          // Elegido: borde y fondo en el acento, texto en color de texto (contraste AA).
          { color: seleccionado ? colors.text.primary : colors.text.secondary },
        ]}
      >
        {texto}
      </Text>
    </Bounceable>
  );
}

export type Tono = 'marca' | 'verde' | 'naranja' | 'rojo' | 'azul' | 'morado' | 'neutro';

export function paletaTono(colors: ThemeColors, tono: Tono): { fondo: string; tinta: string } {
  switch (tono) {
    case 'verde':
      return { fondo: colors.fill.greenSubtle, tinta: colors.system.green };
    case 'naranja':
      return { fondo: colors.fill.orangeSubtle, tinta: colors.system.orange };
    case 'rojo':
      return { fondo: colors.fill.redSubtle, tinta: colors.system.red };
    case 'azul':
      return { fondo: colors.fill.blueSubtle, tinta: colors.system.blue };
    case 'morado':
      return { fondo: colors.fill.purpleSubtle, tinta: colors.system.purple };
    case 'neutro':
      return { fondo: colors.materials.highlight, tinta: colors.text.secondary };
    default:
      return { fondo: colors.fill.brandSubtle, tinta: colors.brand.primary };
  }
}

/** Etiqueta de estado pequeña (activo, vencida, riesgo…): color + texto, nunca solo color. */
export function Pill({
  texto,
  tono = 'neutro',
  icono,
  style,
}: {
  texto: string;
  tono?: Tono;
  icono?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  const { fondo, tinta } = paletaTono(colors, tono);
  return (
    <View style={[k.pill, { backgroundColor: fondo }, style]}>
      {icono ? <Ionicons name={icono} size={12} color={tinta} /> : null}
      <Text style={[k.pillTexto, { color: tinta }]} numberOfLines={1}>
        {texto}
      </Text>
    </View>
  );
}

const TONOS_AVATAR: Tono[] = ['marca', 'azul', 'verde', 'morado', 'naranja', 'rojo'];

/** Círculo con iniciales; el color sale del nombre (estable entre visitas). */
export function Avatar({ nombre, tamano = 40 }: { nombre: string; tamano?: number }) {
  const colors = useThemeColors();
  const iniciales =
    nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?';
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) >>> 0;
  const { fondo, tinta } = paletaTono(colors, TONOS_AVATAR[h % TONOS_AVATAR.length]);
  return (
    <View
      style={[
        k.avatar,
        { width: tamano, height: tamano, borderRadius: tamano / 2, backgroundColor: fondo },
      ]}
    >
      <Text style={[k.avatarTexto, { color: tinta, fontSize: tamano * 0.38 }]}>{iniciales}</Text>
    </View>
  );
}

const TONOS_CLASE: Tono[] = ['marca', 'azul', 'verde', 'morado', 'rojo'];

/** Color de cada clase según su posición en la lista (fondo de su insignia de grado). */
export function tonoDeClase(indice: number): Tono {
  return TONOS_CLASE[indice % TONOS_CLASE.length];
}

/**
 * Insignia cuadrada con el grado de la clase ("9°"): fondo sólido del color de
 * la clase y el número siempre en tinta, igual en todas (contraste sobre el sólido).
 */
export function InsigniaGrado({
  grado,
  tono,
  tamano = 52,
}: {
  grado: string;
  tono: Tono;
  tamano?: number;
}) {
  const colors = useThemeColors();
  const { tinta } = paletaTono(colors, tono);
  return (
    <View
      style={[
        k.insignia,
        { width: tamano, height: tamano, borderRadius: tamano * 0.32, backgroundColor: tinta },
      ]}
    >
      <Text style={[k.insigniaTexto, { color: BrandColors.ink, fontSize: tamano * 0.4 }]}>
        {grado}°
      </Text>
    </View>
  );
}

/**
 * Cifra para filas de 3 (como los stat-tile del estudiante, pero vertical para
 * que la etiqueta no se corte en pantallas angostas): ícono, número, etiqueta.
 */
export function Cifra({
  icono,
  valor,
  etiqueta,
  tono = 'marca',
}: {
  icono: IconName;
  valor: string;
  etiqueta: string;
  tono?: Tono;
}) {
  const colors = useThemeColors();
  const { fondo, tinta } = paletaTono(colors, tono);
  return (
    <View
      style={[
        k.cifra,
        { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
      ]}
      accessible
      accessibilityLabel={`${etiqueta}: ${valor}`}
    >
      <View style={[k.cifraIcono, { backgroundColor: fondo }]}>
        <Ionicons name={icono} size={16} color={tinta} />
      </View>
      <Text
        style={[k.cifraValor, { color: colors.text.primary }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {valor}
      </Text>
      <Text style={[k.cifraEtiqueta, { color: colors.text.tertiary }]} numberOfLines={2}>
        {etiqueta}
      </Text>
    </View>
  );
}

// ─── Campo de texto ──────────────────────────────────────────────────────────

/** Input con etiqueta; el borde toma el color de marca al enfocar. */
export function Campo({
  etiqueta,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  maxLength,
  ayuda,
  editable = true,
  acento,
  tipo = 'texto',
  style,
  inputStyle,
}: {
  etiqueta?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  ayuda?: string;
  editable?: boolean;
  acento?: string;
  /** 'correo' y 'clave' ajustan teclado, autocompletado y ocultan la clave. */
  tipo?: 'texto' | 'correo' | 'clave';
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}) {
  const colors = useThemeColors();
  const [foco, setFoco] = useState(false);
  return (
    <View style={[{ gap: 8 }, style]}>
      {etiqueta ? (
        <View style={k.campoCabeza}>
          <Text style={[k.campoEtiqueta, { color: colors.text.secondary }]}>{etiqueta}</Text>
          {foco && maxLength ? (
            <Text style={[k.campoContador, { color: colors.text.tertiary }]}>
              {value.length}/{maxLength}
            </Text>
          ) : null}
        </View>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.quaternary}
        multiline={multiline}
        maxLength={maxLength}
        editable={editable}
        {...(tipo === 'correo'
          ? {
              keyboardType: 'email-address' as const,
              autoCapitalize: 'none' as const,
              autoCorrect: false,
              autoComplete: 'email' as const,
            }
          : tipo === 'clave'
            ? {
                secureTextEntry: true,
                autoCapitalize: 'none' as const,
                autoCorrect: false,
                autoComplete: 'password' as const,
              }
            : null)}
        onFocus={() => setFoco(true)}
        onBlur={() => setFoco(false)}
        accessibilityLabel={etiqueta ?? placeholder}
        style={[
          k.campo,
          multiline && k.campoMulti,
          {
            color: colors.text.primary,
            backgroundColor: colors.background.primary,
            borderColor: foco ? (acento ?? colors.brand.primary) : colors.materials.border,
          },
          // El borde ya marca el foco: sin el anillo extra del navegador.
          Platform.OS === 'web' && ({ outlineWidth: 0 } as object),
          inputStyle,
        ]}
      />
      {ayuda ? <Text style={[k.campoAyuda, { color: colors.text.tertiary }]}>{ayuda}</Text> : null}
    </View>
  );
}

/**
 * Para los ScrollView con formularios: en web el scroll se traga el primer toque
 * mientras un campo tiene el foco salvo con 'always'; en nativo, 'handled'
 * (tocar fuera cierra el teclado).
 */
export const tapsConTeclado = Platform.OS === 'web' ? 'always' : 'handled';

// ─── Números y progreso ──────────────────────────────────────────────────────

/** Cuenta desde 0 hasta `valor` al montar o cambiar (se lee el avance, ~0,7 s). */
export function NumeroAnimado({
  valor,
  sufijo = '',
  style,
}: {
  valor: number;
  sufijo?: string;
  style?: StyleProp<TextStyle>;
}) {
  const reducido = useReducedMotionSafe();
  const v = useRef(new RNAnimated.Value(0)).current;
  const [mostrado, setMostrado] = useState(reducido ? valor : 0);
  useEffect(() => {
    if (reducido) {
      setMostrado(valor);
      return;
    }
    const id = v.addListener(({ value }) => setMostrado(Math.round(value)));
    const anim = RNAnimated.timing(v, {
      toValue: valor,
      duration: 700,
      easing: RNEasing.out(RNEasing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => {
      anim.stop();
      v.removeListener(id);
    };
  }, [v, valor, reducido]);
  return (
    <Text style={style}>
      {mostrado}
      {sufijo}
    </Text>
  );
}

/** Color por nivel de dominio: verde desde 80 %, naranja 50–79 %, rojo debajo. */
export function tonoNivel(pct: number): Tono {
  if (pct >= 80) return 'verde';
  if (pct >= 50) return 'naranja';
  return 'rojo';
}

// ─── Carga ───────────────────────────────────────────────────────────────────

/** Bloques que laten mientras carga (en vez de un spinner suelto). */
export function Esqueleto({ filas = 3, alto = 72 }: { filas?: number; alto?: number }) {
  const colors = useThemeColors();
  const reducido = useReducedMotionSafe();
  const pulso = useSharedValue(0);
  useEffect(() => {
    if (reducido) return;
    pulso.value = withRepeat(withTiming(1, { ...stateTiming, duration: 700 }), -1, true);
    return () => cancelAnimation(pulso);
  }, [pulso, reducido]);
  const estilo = useAnimatedStyle(() => ({ opacity: 0.55 + pulso.value * 0.45 }));
  return (
    <Animated.View style={[{ gap: 12 }, estilo]} accessibilityLabel="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <View
          key={i}
          style={{
            height: alto,
            borderRadius: 20,
            backgroundColor: colors.materials.highlight,
            opacity: 1 - i * 0.18,
          }}
        />
      ))}
    </Animated.View>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const k = StyleSheet.create({
  encabezado: { gap: 14 },
  encabezadoTexto: { gap: 6 },
  encabezadoFila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  atras: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sobretituloFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sobretituloPunto: { width: 6, height: 6, borderRadius: 3 },
  sobretitulo: { fontSize: 12, fontWeight: '900', letterSpacing: 1.4, flexShrink: 1 },
  titulo: { fontSize: 34, lineHeight: 40, fontWeight: '900', letterSpacing: -0.5 },
  tituloDetalle: { fontSize: 30, lineHeight: 35, fontWeight: '900', letterSpacing: -0.5 },
  subtitulo: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  seccion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  seccionTexto: { fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },

  botonBase: { borderRadius: 16, alignSelf: 'stretch' },
  botonCara: {
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
  },
  botonCaraCompacta: { paddingHorizontal: 10, gap: 6 },
  botonTexto: { fontWeight: '900', letterSpacing: 0.4, flexShrink: 1 },

  tarjeta: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 12 },

  aviso: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 18, padding: 14 },
  avisoIcono: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avisoTexto: { fontSize: 15, lineHeight: 21, fontWeight: '700', paddingTop: 6 },

  vacio: { borderWidth: 1, borderRadius: 24, padding: 20, gap: 8, alignItems: 'flex-start' },
  vacioIcono: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  vacioTitulo: { fontSize: 20, lineHeight: 25, fontWeight: '900' },
  vacioTexto: { fontSize: 15, lineHeight: 21, fontWeight: '500' },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipGrande: { minWidth: 58, justifyContent: 'center', paddingVertical: 11 },
  chipTexto: { fontSize: 14, fontWeight: '800' },
  chipTextoGrande: { fontSize: 16, fontWeight: '900' },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  pillTexto: { fontSize: 12, fontWeight: '800' },

  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { fontWeight: '900' },
  insignia: { alignItems: 'center', justifyContent: 'center' },
  insigniaTexto: { fontWeight: '900', letterSpacing: -0.5 },

  cifra: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 20, padding: 14, gap: 6 },
  cifraIcono: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cifraValor: { fontSize: 24, lineHeight: 28, fontWeight: '900', marginTop: 4 },
  cifraEtiqueta: { fontSize: 13, lineHeight: 16, fontWeight: '800' },

  campoCabeza: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  campoEtiqueta: { fontSize: 14, fontWeight: '800' },
  campoContador: { fontSize: 12, fontWeight: '700' },
  campo: {
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    fontWeight: '600',
  },
  campoMulti: { minHeight: 92, textAlignVertical: 'top' },
  campoAyuda: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
});
