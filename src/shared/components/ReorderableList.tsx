/**
 * ReorderableList — lista corta reordenable por "mantener presionado y arrastrar"
 * (long-press → drag). Construida sobre react-native-gesture-handler + reanimated
 * (ya instalados; el root monta GestureHandlerRootView). Filas posicionadas en
 * absoluto sobre slots de alto fijo `rowHeight`; sólo la fila activa sigue al
 * dedo, las demás se acomodan con spring. Al soltar, emite el nuevo orden de keys.
 *
 * ponytail: slots de alto fijo (rowHeight) — pensado para listas cortas de filas
 * de una línea; si el contenido de una fila crece a varias líneas, sube rowHeight.
 * Sin autoscroll (la lista corta cabe en el scroll padre).
 */
import { useEffect, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { objectMove, orderedKeys, type Positions } from '@shared/lib/reorder';

const SPRING = { damping: 22, stiffness: 220 } as const;

export type ReorderableListProps<T> = {
  data: T[];
  keyExtractor: (item: T) => string;
  rowHeight: number;
  onReorder: (orderedKeys: string[]) => void;
  renderItem: (item: T) => ReactNode;
  longPressMs?: number;
};

export default function ReorderableList<T>({
  data,
  keyExtractor,
  rowHeight,
  onReorder,
  renderItem,
  longPressMs = 220,
}: ReorderableListProps<T>) {
  const ids = data.map(keyExtractor);
  const idsKey = ids.join('|');
  const positions = useSharedValue<Positions>(Object.fromEntries(ids.map((id, i) => [id, i])));

  // Re-seed positions when the incoming order/keys change (e.g. a Firestore
  // snapshot after our own save, or an add/remove) so the animation matches data.
  useEffect(() => {
    positions.value = Object.fromEntries(idsKey.split('|').map((id, i) => [id, i]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const commit = (order: Positions) => {
    onReorder(orderedKeys(order));
  };

  return (
    <Animated.View style={[styles.container, { height: data.length * rowHeight }]}>
      {data.map((item) => {
        const id = keyExtractor(item);
        return (
          <Row
            key={id}
            id={id}
            count={data.length}
            rowHeight={rowHeight}
            positions={positions}
            longPressMs={longPressMs}
            onDrop={commit}
          >
            {renderItem(item)}
          </Row>
        );
      })}
    </Animated.View>
  );
}

function Row({
  id,
  count,
  rowHeight,
  positions,
  longPressMs,
  onDrop,
  children,
}: {
  id: string;
  count: number;
  rowHeight: number;
  positions: SharedValue<Positions>;
  longPressMs: number;
  onDrop: (p: Positions) => void;
  children: ReactNode;
}) {
  const top = useSharedValue((positions.value[id] ?? 0) * rowHeight);
  const active = useSharedValue(false);
  const offsetTop = useSharedValue(0); // finger baseline captured at drag start

  // Non-active rows follow their slot; the active row is driven by the gesture.
  useAnimatedReaction(
    () => positions.value[id],
    (slot) => {
      if (!active.value && slot !== undefined) top.value = withSpring(slot * rowHeight, SPRING);
    }
  );

  const pan = Gesture.Pan()
    .activateAfterLongPress(longPressMs)
    .onStart(() => {
      active.value = true;
      offsetTop.value = (positions.value[id] ?? 0) * rowHeight;
    })
    .onUpdate((e) => {
      const newTop = offsetTop.value + e.translationY;
      top.value = newTop;
      const newSlot = Math.max(0, Math.min(count - 1, Math.round(newTop / rowHeight)));
      const oldSlot = positions.value[id];
      if (newSlot !== oldSlot) positions.value = objectMove(positions.value, oldSlot, newSlot);
    })
    .onEnd(() => {
      top.value = withSpring((positions.value[id] ?? 0) * rowHeight, SPRING);
    })
    .onFinalize(() => {
      if (!active.value) return;
      active.value = false;
      runOnJS(onDrop)(positions.value);
    });

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: 0,
    right: 0,
    top: top.value,
    height: rowHeight,
    zIndex: active.value ? 10 : 0,
    transform: [{ scale: withSpring(active.value ? 1.03 : 1, SPRING) }],
    shadowColor: '#000',
    shadowOpacity: active.value ? 0.18 : 0,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', width: '100%' },
});
