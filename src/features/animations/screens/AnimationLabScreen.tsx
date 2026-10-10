/**
 * Animation Lab: galería de revisión del catálogo (solo desarrollo). Aquí se aprueba
 * una animación antes de usarla: se reproduce con distintas velocidades/fondos y se ven
 * sus datos técnicos y su brief.
 */
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type LottieView from 'lottie-react-native';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { Typography } from '@shared/constants/typography';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import CetiAnimation, { playAnimationHaptic } from '../CetiAnimation';
import {
  animationIds,
  animations,
  categoryOf,
  type AnimationId,
  type AnimationStatus,
} from '../catalog';

const SPEEDS = [0.5, 1, 1.5, 2] as const;
const STATUSES: AnimationStatus[] = ['draft', 'approved', 'shipped', 'deprecated'];
const PREVIEW_BG = { light: '#FFFFFF', dark: '#111318' } as const;

function technicalSheet(id: AnimationId) {
  const { fr, ip, op, w, h } = animations[id].source;
  // ponytail: KB del JSON serializado ≈ peso en disco porque los archivos están minificados.
  const kb = Math.round(JSON.stringify(animations[id].source).length / 1024);
  return `${((op - ip) / fr).toFixed(1)} s · ${fr} fps · ${w}×${h} · ${kb} KB`;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        {
          borderColor: active ? colors.brand.primary : colors.materials.border,
          backgroundColor: active ? colors.materials.highlight : 'transparent',
        },
      ]}
    >
      <Text style={[styles.chipText, { color: colors.text.primary }]}>{label}</Text>
    </Pressable>
  );
}

function AnimationCard({ id }: { id: AnimationId }) {
  const colors = useThemeColors();
  const spec = animations[id];
  const ref = useRef<LottieView>(null);
  const [loop, setLoop] = useState<boolean>(spec.loop);
  const [speed, setSpeed] = useState<number>(spec.speed);
  const [bg, setBg] = useState<keyof typeof PREVIEW_BG>('light');
  const [playing, setPlaying] = useState(true);

  const replay = () => {
    ref.current?.reset();
    ref.current?.play();
    setPlaying(true);
    playAnimationHaptic(spec.haptic);
  };
  const togglePlay = () => {
    if (playing) ref.current?.pause();
    else ref.current?.resume();
    setPlaying(!playing);
  };

  return (
    <View
      style={[styles.card, { backgroundColor: colors.materials.base, borderColor: colors.materials.border }]}
    >
      <View style={[styles.stage, { backgroundColor: PREVIEW_BG[bg] }]}>
        {/* key: remontar al cambiar loop/velocidad es lo único fiable en native y web */}
        <CetiAnimation
          key={`${loop}-${speed}`}
          ref={ref}
          id={id}
          size={180}
          loop={loop}
          speed={speed}
          onFinish={() => setPlaying(false)}
        />
      </View>

      <Text style={[styles.id, { color: colors.text.primary }]}>{id}</Text>
      <Text style={[styles.meta, { color: colors.text.tertiary }]}>
        {spec.status} · {technicalSheet(id)}
        {spec.haptic ? ` · háptico ${spec.haptic}` : ''}
      </Text>
      <Text style={[styles.brief, { color: colors.text.secondary }]}>{spec.brief}</Text>
      <Text style={[styles.meta, { color: colors.text.tertiary }]}>
        Usada en: {spec.usedIn.length ? spec.usedIn.join(', ') : '—'}
      </Text>

      <View style={styles.row}>
        <Chip label="↺ Repetir" active={false} onPress={replay} />
        <Chip label={playing ? '❚❚ Pausa' : '▶ Play'} active={false} onPress={togglePlay} />
        <Chip label="Loop" active={loop} onPress={() => setLoop(!loop)} />
        <Chip
          label={bg === 'light' ? 'Fondo claro' : 'Fondo oscuro'}
          active={false}
          onPress={() => setBg(bg === 'light' ? 'dark' : 'light')}
        />
      </View>
      <View style={styles.row}>
        {SPEEDS.map((s) => (
          <Chip key={s} label={`${s}x`} active={speed === s} onPress={() => setSpeed(s)} />
        ))}
      </View>
    </View>
  );
}

export default function AnimationLabScreen() {
  const colors = useThemeColors();
  const [status, setStatus] = useState<AnimationStatus | null>(null);
  const visible = animationIds.filter((id) => !status || animations[id].status === status);
  const categories = [...new Set(visible.map(categoryOf))];

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={[styles.title, { color: colors.text.primary }]}>Animation Lab</Text>
        <Text style={{ color: colors.text.secondary }}>
          {animationIds.length} animaciones en el catálogo
        </Text>
        <View style={styles.row}>
          <Chip label="Todas" active={!status} onPress={() => setStatus(null)} />
          {STATUSES.map((s) => (
            <Chip key={s} label={s} active={status === s} onPress={() => setStatus(s)} />
          ))}
        </View>

        {categories.map((category) => (
          <View key={category} style={styles.section}>
            <Text style={[styles.category, { color: colors.text.secondary }]}>
              {category.toUpperCase()}
            </Text>
            {visible
              .filter((id) => categoryOf(id) === category)
              .map((id) => (
                <AnimationCard key={id} id={id} />
              ))}
          </View>
        ))}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 48 },
  title: { ...Typography.title1, fontWeight: '800' },
  section: { gap: 12 },
  category: { ...Typography.caption1, fontWeight: '700', letterSpacing: 1, marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 6 },
  stage: { alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 12 },
  id: { ...Typography.headline, fontWeight: '700' },
  meta: { ...Typography.caption1 },
  brief: { ...Typography.subheadline },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  chipText: { ...Typography.caption1, fontWeight: '600' },
});
