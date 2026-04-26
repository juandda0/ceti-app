// app/(auth)/select-profile.tsx — Selección de perfiles dinámica (Sin Mocks)
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Typography } from '@shared/constants/typography';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';
import { useChildStore } from '@features/auth/store/useChildStore';
import { useParentStore } from '@features/family/store/useParentStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useThemeStore } from '@shared/store/useThemeStore';
import { useAuthStore } from '@features/auth/store/useAuthStore';

export default function SelectProfileScreen() {
  const router = useRouter();
  const child = useChildStore();
  const { parentName, isPinSet } = useParentStore();
  const { loginAsParent, loginAsChild } = useAuthStore();
  const getTotalSaved = useSavingsStore(s => s.getTotalSaved);
  
  const colors = useThemeColors();
  const mode = useThemeStore(s => s.mode);
  const styles = getStyles(colors, mode);

  const selectChild = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    loginAsChild();
    router.replace('/(child)/world');
  };

  const selectParent = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (!isPinSet) {
      router.replace('/(auth)/onboarding/parent-setup');
    } else {
      // In a real app, we'd show a PIN prompt here. 
      // For now, we'll mark as logged in as parent and go to dashboard.
      loginAsParent();
      router.replace('/(parent)/dashboard');
    }
  };

  const createChild = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/(auth)/onboarding/child-setup');
  };


  return (
    <ScreenWrapper style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        <PageHeader 
          overline="Bienvenido"
          title="Ceti"
          subtitle="Selecciona un perfil para continuar"
          style={{ alignItems: 'center', marginBottom: 40 }}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hijos</Text>
          <View style={styles.cardGrid}>
            {child.isOnboarded ? (
              <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.cardItem}>
                <TouchableOpacity onPress={selectChild} activeOpacity={0.8} style={styles.childCard}>
                  <View style={styles.cardHeader}>
                    {child.avatarEmoji ? (
                      <Text style={styles.cardEmoji}>{child.avatarEmoji}</Text>
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Ionicons name="person" size={24} color={colors.brand.primary} />
                      </View>
                    )}
                    <Ionicons name="hardware-chip-outline" size={24} color={colors.text.tertiary + '30'} />
                  </View>
                  <View>
                    <Text style={styles.cardName}>{child.nickname}</Text>
                    <Text style={styles.cardRole}>{child.age} años • Nivel {child.level}</Text>
                  </View>
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardBalance}>${getTotalSaved(child.id).toLocaleString('es-CO')}</Text>
                    <Ionicons name="wifi-outline" size={16} color={colors.text.tertiary + '40'} style={{ transform: [{ rotate: '90deg' }] }} />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.cardItem}>
                <TouchableOpacity onPress={createChild} activeOpacity={0.8} style={[styles.childCard, styles.addCard]}>
                  <View style={styles.addIconCircle}>
                    <Ionicons name="add" size={32} color={colors.brand.primary} />
                  </View>
                  <Text style={styles.addText}>Crear perfil de hijo</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Padre</Text>
          <Animated.View entering={FadeInDown.delay(500).springify()}>
            <TouchableOpacity onPress={selectParent} activeOpacity={0.8} style={styles.parentCard}>
              <View style={styles.parentAvatar}>
                <Ionicons name="person" size={28} color={colors.system.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.parentName}>{parentName || 'Configurar Padre'}</Text>
                <Text style={styles.parentRole}>Control Parental • Administrador</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          </Animated.View>
        </View>

        <Text style={styles.footerNote}>Educación financiera para la nueva generación</Text>
      </ScrollView>
    </ScreenWrapper>
  );
}

const getStyles = (colors: any, mode: string) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background.base },
  scroll: { paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 80 : 60, paddingBottom: 60 },
  
  section: { marginBottom: 40 },
  sectionTitle: { ...Typography.caption1, color: colors.text.tertiary, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '700' },
  
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  cardItem: { width: '47%', height: 200 },
  
  childCard: { 
    flex: 1, 
    backgroundColor: colors.materials.base, 
    borderRadius: 24, 
    padding: 20, 
    justifyContent: 'space-between', 
    borderWidth: 1, 
    borderColor: colors.materials.border 
  },
  addCard: { justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', backgroundColor: colors.separator.transparent },
  addIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brand.primary + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  addText: { ...Typography.caption1, color: colors.text.secondary, textAlign: 'center', fontWeight: '600' },
  
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardEmoji: { fontSize: 28 },
  avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.separator.transparent, justifyContent: 'center', alignItems: 'center' },
  cardName: { ...Typography.headline, color: colors.text.primary, fontWeight: '700' },
  cardRole: { ...Typography.caption2, color: colors.text.tertiary, marginTop: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cardBalance: { ...Typography.caption1, color: colors.brand.primary, fontWeight: '800' },

  parentCard: { 
    backgroundColor: colors.materials.base, 
    borderRadius: 24, 
    padding: 20, 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: colors.materials.border, 
    gap: 16 
  },
  parentAvatar: { 
    width: 56, height: 56, 
    borderRadius: 28, 
    backgroundColor: colors.system.blue + '15', 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: colors.system.blue + '30' 
  },
  parentName: { ...Typography.title3, color: colors.text.primary, fontWeight: '700' },
  parentRole: { ...Typography.caption1, color: colors.text.secondary },

  footerNote: { ...Typography.caption2, color: colors.text.tertiary, textAlign: 'center', marginTop: 32 },
});
