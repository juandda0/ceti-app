// ScrollView para las pantallas de las pestañas con "cambio de contexto":
// cada hijo directo es un bloque. Al salir de la pestaña los bloques se desarman
// (se apagan subiendo apenas, todos juntos) y al entrar se arman en cascada desde
// abajo. La barra de pestañas y el fondo no se mueven. Un solo reloj por pantalla
// (UI thread) mueve todos los bloques; sin `entering`, así que funciona igual en web.
// La navegación de pestañas (mainTabBarOptions) corta de una escena a la otra justo
// cuando termina el desarme.
import { Children, isValidElement, useCallback, type ReactNode } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { contextMs, softEasing, useReducedMotionSafe } from '@shared/constants/motion';

/** Fin del armado (ms): el último bloque escalonado termina aquí. */
const BUILD_END = contextMs.staggerCap * contextMs.stagger + contextMs.enter;

function Bloque({
  order,
  build,
  out,
  reduced,
  children,
}: {
  order: number;
  build: SharedValue<number>;
  out: SharedValue<number>;
  reduced: boolean;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const local = Math.min(
      Math.max((build.get() - order * contextMs.stagger) / contextMs.enter, 0),
      1
    );
    // ease-out fuerte: arranca rápido y se asienta suave.
    const e = 1 - Math.pow(1 - local, 4);
    const o = out.get();
    const move = reduced ? 0 : 1;
    return {
      opacity: e * (1 - o),
      transform: [
        { translateY: move * ((1 - e) * contextMs.enterOffset - o * contextMs.outOffset) },
      ],
    };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

export default function ContextScrollView({ children, ...props }: ScrollViewProps) {
  const reduced = useReducedMotionSafe();
  const build = useSharedValue(0);
  const out = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      cancelAnimation(out);
      cancelAnimation(build);
      out.set(0);
      build.set(0);
      // Espera a que la pantalla anterior termine de desarmarse.
      build.set(
        withDelay(
          contextMs.out,
          withTiming(BUILD_END, { duration: BUILD_END, easing: Easing.linear })
        )
      );
      return () => {
        out.set(withTiming(1, { duration: contextMs.out, easing: softEasing }));
      };
    }, [build, out])
  );

  const blocks = Children.toArray(children);
  return (
    <ScrollView {...props}>
      {blocks.map((child, i) => (
        <Bloque
          key={isValidElement(child) && child.key != null ? child.key : i}
          order={Math.min(i, contextMs.staggerCap)}
          build={build}
          out={out}
          reduced={reduced}
        >
          {child}
        </Bloque>
      ))}
    </ScrollView>
  );
}
