import { useState } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import BackButton from '@shared/components/BackButton';
import Bounceable from '@shared/components/Bounceable';
import CetiButton from '@shared/components/CetiButton';
import { Typography } from '@shared/constants/typography';
import { Spacing } from '@shared/constants/theme';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useCetiOverlayStore } from '@shared/store/useCetiOverlayStore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { useUserStore } from '@features/auth/store/useUserStore';
import { userRepository } from '@features/auth/data/userRepository';
import AvatarView from '@features/avatar/components/AvatarView';
import { iconoDeAccesorio, type AccesorioId } from '@features/avatar/domain/accesorios';
import {
  ACCESORIOS,
  AVATAR_POR_DEFECTO,
  PRENDAS,
  personajePorId,
  requisitoDe,
  type AvatarConfig,
  type ItemId,
} from '@features/avatar/domain/catalogo';
import { avanceDe, estaDisponible, type ProgresoAvatar } from '@features/avatar/domain/desbloqueos';
import { useProgresoAvatar } from '@features/avatar/hooks/useProgresoAvatar';

// El tripulante, su piel y su pelo se eligen una sola vez en el onboarding;
// aquí solo se cambia lo que se pone encima.
type Tab = 'ropa' | 'accesorios';
const TABS: readonly Tab[] = ['ropa', 'accesorios'];

type Colors = ReturnType<typeof useThemeColors>;

/** Texto del requisito de un ítem bloqueado, con avance si lo tiene (p. ej. "Racha de 7 días · 4/7"). */
function useTextoRequisito() {
  const { t } = useTranslation();
  return (id: ItemId, progreso: ProgresoAvatar): string => {
    const req = requisitoDe(id);
    if (req.tipo === 'libre') return '';
    const base = t(`avatar.requisito.${req.tipo}`, { dias: 'dias' in req ? req.dias : 0 });
    const avance = avanceDe(req, progreso);
    return avance ? `${base} · ${t('avatar.requisito.avance', avance)}` : base;
  };
}

function Ficha({
  activo,
  bloqueado,
  etiqueta,
  requisito,
  onPress,
  colors,
  children,
}: {
  activo: boolean;
  bloqueado: boolean;
  etiqueta: string;
  requisito: string;
  onPress: () => void;
  colors: Colors;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Bounceable
      accessibilityRole="button"
      accessibilityLabel={
        bloqueado ? `${etiqueta}. ${t('avatar.bloqueado', { requisito })}` : etiqueta
      }
      accessibilityState={{ selected: activo, disabled: bloqueado }}
      disabled={bloqueado}
      onPress={onPress}
      style={[
        styles.ficha,
        {
          backgroundColor: activo
            ? colors.fill.brandSubtle
            : bloqueado
              ? colors.background.secondary
              : colors.materials.base,
          borderColor: activo ? colors.brand.primary : colors.materials.border,
        },
      ]}
    >
      <View style={[styles.fichaArte, bloqueado && styles.apagado]}>{children}</View>
      <Text
        style={[
          styles.fichaNombre,
          { color: bloqueado ? colors.text.tertiary : colors.text.primary },
        ]}
        numberOfLines={1}
      >
        {etiqueta}
      </Text>
      {bloqueado ? (
        <>
          <Text style={[styles.fichaRequisito, { color: colors.gold.primary }]} numberOfLines={2}>
            {requisito}
          </Text>
          <Ionicons
            name="lock-closed"
            size={14}
            color={colors.text.tertiary}
            style={styles.candado}
          />
        </>
      ) : null}
    </Bounceable>
  );
}

export default function VestidorScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const guardado = useUserStore((s) => s.avatar) ?? AVATAR_POR_DEFECTO;
  const setAvatarLocal = useUserStore((s) => s.setAvatar);
  const { progreso, ganados } = useProgresoAvatar();
  const textoRequisito = useTextoRequisito();

  const [avatar, setAvatar] = useState<AvatarConfig>(guardado);
  const [tab, setTab] = useState<Tab>('ropa');
  const [guardando, setGuardando] = useState(false);
  const cambiar = (parcial: Partial<AvatarConfig>) => setAvatar((a) => ({ ...a, ...parcial }));

  const personaje = personajePorId(avatar.personaje);
  const prendas = PRENDAS.filter((p) => personaje.prendas[p.id]);

  const guardar = async () => {
    setGuardando(true);
    setAvatarLocal(avatar);
    const uid = getFirebaseClients()?.auth.currentUser?.uid;
    let ok = true;
    if (uid) {
      try {
        await userRepository.updateAvatar(uid, avatar);
      } catch {
        ok = false;
      }
    }
    setGuardando(false);
    void Haptics.notificationAsync(
      ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
    );
    useCetiOverlayStore
      .getState()
      .showToast(
        ok
          ? { variant: 'success', title: t('avatar.vestidor.guardado') }
          : { variant: 'info', title: t('avatar.vestidor.errorGuardar') }
      );
    if (router.canGoBack()) router.back();
  };

  return (
    <ScreenWrapper style={[styles.root, { backgroundColor: colors.background.base }]}>
      <View
        style={[
          styles.cabecera,
          { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 12 : 8) + 8 },
        ]}
      >
        <BackButton fallback="/(app)/profile" />
        <Text style={[styles.titulo, { color: colors.text.primary }]}>
          {t('avatar.vestidor.titulo')}
        </Text>
        <View style={styles.cabeceraHueco} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.escenario, { backgroundColor: colors.materials.base }]}>
          <View style={[styles.halo, { backgroundColor: colors.fill.brandSubtle }]} />
          <AvatarView config={avatar} size={260} />
        </View>

        <View
          accessibilityRole="tablist"
          style={[
            styles.tabs,
            { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
          ]}
        >
          {TABS.map((id) => {
            const activo = id === tab;
            return (
              <Bounceable
                key={id}
                accessibilityRole="tab"
                accessibilityState={{ selected: activo }}
                onPress={() => setTab(id)}
                style={[styles.tab, activo && { backgroundColor: colors.brand.primary }]}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[
                    styles.tabTexto,
                    { color: activo ? colors.text.onBrand : colors.text.secondary },
                  ]}
                >
                  {t(`avatar.vestidor.tabs.${id}`)}
                </Text>
              </Bounceable>
            );
          })}
        </View>

        {tab === 'ropa' && (
          <View style={styles.rejilla}>
            {prendas.map((p) => {
              const bloqueado = !estaDisponible(p.id, ganados);
              return (
                <Ficha
                  key={p.id}
                  activo={avatar.prenda === p.id}
                  bloqueado={bloqueado}
                  etiqueta={t(`avatar.prenda.${p.id}`)}
                  requisito={textoRequisito(p.id, progreso)}
                  onPress={() => cambiar({ prenda: p.id })}
                  colors={colors}
                >
                  <AvatarView config={{ ...avatar, prenda: p.id, accesorio: null }} size={96} />
                </Ficha>
              );
            })}
          </View>
        )}

        {tab === 'accesorios' && (
          <View style={styles.rejilla}>
            <Ficha
              activo={avatar.accesorio === null}
              bloqueado={false}
              etiqueta={t('avatar.accesorio.ninguno')}
              requisito=""
              onPress={() => cambiar({ accesorio: null })}
              colors={colors}
            >
              <Ionicons name="ban-outline" size={36} color={colors.text.tertiary} />
            </Ficha>
            {ACCESORIOS.map((a) => {
              const bloqueado = !estaDisponible(a.id, ganados);
              return (
                <Ficha
                  key={a.id}
                  activo={avatar.accesorio === a.id}
                  bloqueado={bloqueado}
                  etiqueta={t(`avatar.accesorio.${a.id}`)}
                  requisito={textoRequisito(a.id, progreso)}
                  onPress={() => cambiar({ accesorio: a.id as AccesorioId })}
                  colors={colors}
                >
                  <SvgXml xml={iconoDeAccesorio(a.id)} width={72} height={44} />
                </Ficha>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={[styles.pie, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <CetiButton
          label={t('avatar.vestidor.guardar')}
          onPress={() => void guardar()}
          isLoading={guardando}
          disabled={guardando}
          variant="primary"
          size="large"
          style={{ width: '100%' }}
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  cabeceraHueco: { width: 44 },
  titulo: { ...Typography.title3, fontWeight: '900' },
  scroll: { paddingHorizontal: Spacing.base, paddingBottom: 24, gap: Spacing.lg },
  escenario: {
    height: 290,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
    overflow: 'hidden',
  },
  halo: { position: 'absolute', bottom: 18, width: 220, height: 220, borderRadius: 110 },
  tabs: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 16, borderWidth: 1 },
  tab: {
    flex: 1,
    height: 40,
    paddingHorizontal: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabTexto: { ...Typography.footnote, fontWeight: '800' },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ficha: {
    width: '48%',
    flexGrow: 1,
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 18,
    borderWidth: 2,
  },
  fichaArte: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  apagado: { opacity: 0.35 },
  fichaNombre: { ...Typography.footnote, fontWeight: '800' },
  fichaRequisito: { ...Typography.caption2, fontWeight: '700', textAlign: 'center' },
  candado: { position: 'absolute', top: 10, right: 10 },
  pie: { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm },
});
