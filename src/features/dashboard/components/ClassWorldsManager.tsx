/**
 * ClassWorldsManager — "Mundos de la clase" (D-ORQ, RQ-PR10).
 *
 * The professor curates their class here: show/hide worlds, reorder them, and
 * focus the class on a single world. Every interaction saves immediately (no
 * "save" button — least friction) and reaches students in real time via their
 * onSnapshot on the same doc. "Restaurar configuración" deletes the doc, which
 * IS the defaults, so it is always safe.
 */
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { classConfigRepository } from '@features/dashboard/data/classConfigRepository';
import { WORLD_DEFS, worldDefById } from '@features/learning/data/worldMeta';
import type { CursoConfigMundoEntry, CursoConfigMundos } from '@shared/types/tenancy';

export default function ClassWorldsManager({
  colegioId,
  cursoId,
}: {
  colegioId: string;
  cursoId: string;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const firebaseUid = useAuthStore((s) => s.firebaseUid);
  const [config, setConfig] = useState<CursoConfigMundos | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(
    () =>
      classConfigRepository.subscribe(colegioId, cursoId, (c) => {
        setConfig(c);
        setLoaded(true);
      }),
    [colegioId, cursoId]
  );

  const entries: CursoConfigMundoEntry[] = useMemo(
    () =>
      config?.mundos?.length
        ? config.mundos
        : WORLD_DEFS.map((d) => ({ worldId: d.id as string, activo: true })),
    [config]
  );
  const enfocadoId = config?.modoEnfocado?.activo ? (config.modoEnfocado.worldId ?? null) : null;

  const save = (
    mundos: CursoConfigMundoEntry[],
    modoEnfocado: { activo: boolean; worldId?: string }
  ) => {
    if (!firebaseUid) return;
    void classConfigRepository.upsert(colegioId, cursoId, {
      mundos,
      modoEnfocado,
      version: (config?.version ?? 0) + 1,
      updatedAt: Date.now(),
      updatedByUid: firebaseUid,
    });
  };

  const currentFoco = () => config?.modoEnfocado ?? { activo: false };

  const onToggle = (worldId: string) => {
    const next = entries.map((e) => (e.worldId === worldId ? { ...e, activo: !e.activo } : e));
    // Hiding the focused world also clears the focus (a class can't focus on
    // a world it can't see).
    const foco =
      enfocadoId === worldId && entries.find((e) => e.worldId === worldId)?.activo
        ? { activo: false }
        : currentFoco();
    save(next, foco);
  };

  const onMove = (worldId: string, dir: -1 | 1) => {
    const i = entries.findIndex((e) => e.worldId === worldId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= entries.length) return;
    const next = [...entries];
    [next[i], next[j]] = [next[j], next[i]];
    save(next, currentFoco());
  };

  const onFocus = (worldId: string) => {
    if (enfocadoId === worldId) {
      save(entries, { activo: false });
    } else {
      save(entries, { activo: true, worldId });
    }
  };

  const confirmReset = () => {
    const doReset = () => void classConfigRepository.reset(colegioId, cursoId);
    if (Platform.OS === 'web') {
      // RN-web's Alert has no button support; the browser confirm is the gate.
      if (
        typeof globalThis.confirm === 'function' &&
        globalThis.confirm(
          `${t('classWorlds.resetConfirmTitle')}\n\n${t('classWorlds.resetConfirmBody')}`
        )
      ) {
        doReset();
      }
      return;
    }
    Alert.alert(t('classWorlds.resetConfirmTitle'), t('classWorlds.resetConfirmBody'), [
      { text: t('admin.cancel'), style: 'cancel' },
      { text: t('classWorlds.resetConfirm'), onPress: doReset },
    ]);
  };

  if (!loaded) return null;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background.secondary }]}>
      <Text style={[styles.title, { color: colors.text.primary }]}>{t('classWorlds.title')}</Text>
      <Text style={[styles.hint, { color: colors.text.tertiary }]}>{t('classWorlds.hint')}</Text>

      {enfocadoId && (
        <View style={[styles.focusBanner, { borderColor: colors.brand.primary }]}>
          <Ionicons name="megaphone-outline" size={15} color={colors.brand.primary} />
          <Text style={[styles.focusBannerText, { color: colors.text.primary }]}>
            {t('classWorlds.focusedBanner', { name: worldDefById(enfocadoId)?.name ?? enfocadoId })}
          </Text>
          <TouchableOpacity onPress={() => onFocus(enfocadoId)} accessibilityRole="button">
            <Text style={[styles.unfocusText, { color: colors.brand.primary }]}>
              {t('classWorlds.unfocus')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {entries.map((entry, i) => {
        const def = worldDefById(entry.worldId);
        if (!def) return null;
        const isFoco = enfocadoId === entry.worldId;
        return (
          <View
            key={entry.worldId}
            style={[styles.row, { borderColor: colors.background.elevated }]}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: entry.activo ? def.color : colors.text.quaternary },
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.rowName,
                  { color: entry.activo ? colors.text.primary : colors.text.quaternary },
                ]}
                numberOfLines={1}
              >
                {def.name}
              </Text>
              {!entry.activo && (
                <Text style={[styles.rowSub, { color: colors.text.quaternary }]}>
                  {t('classWorlds.worldHidden')}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => onMove(entry.worldId, -1)}
              disabled={i === 0}
              style={[styles.iconBtn, { opacity: i === 0 ? 0.3 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={t('classWorlds.moveUp')}
            >
              <Ionicons name="chevron-up" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onMove(entry.worldId, 1)}
              disabled={i === entries.length - 1}
              style={[styles.iconBtn, { opacity: i === entries.length - 1 ? 0.3 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={t('classWorlds.moveDown')}
            >
              <Ionicons name="chevron-down" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onFocus(entry.worldId)}
              disabled={!entry.activo}
              style={[styles.iconBtn, { opacity: entry.activo ? 1 : 0.3 }]}
              accessibilityRole="button"
              accessibilityLabel={t('classWorlds.focus', { name: def.name })}
              accessibilityState={{ selected: isFoco }}
            >
              <Ionicons
                name={isFoco ? 'megaphone' : 'megaphone-outline'}
                size={17}
                color={isFoco ? colors.brand.primary : colors.text.secondary}
              />
            </TouchableOpacity>
            <Switch
              value={entry.activo}
              onValueChange={() => onToggle(entry.worldId)}
              accessibilityLabel={t('classWorlds.toggleWorld', { name: def.name })}
            />
          </View>
        );
      })}

      {config && (
        <TouchableOpacity onPress={confirmReset} accessibilityRole="button" style={styles.resetBtn}>
          <Ionicons name="refresh-outline" size={15} color={colors.text.tertiary} />
          <Text style={[styles.resetText, { color: colors.text.tertiary }]}>
            {t('classWorlds.reset')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 14, padding: 16, gap: 10, marginTop: 4 },
  title: { fontSize: 16, fontWeight: '800' },
  hint: { fontSize: 12, lineHeight: 16 },
  focusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  focusBannerText: { flex: 1, fontSize: 12, fontWeight: '600' },
  unfocusText: { fontSize: 12, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowName: { fontSize: 14, fontWeight: '600' },
  rowSub: { fontSize: 11, fontWeight: '600' },
  iconBtn: { padding: 4 },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  resetText: { fontSize: 12, fontWeight: '600' },
});
