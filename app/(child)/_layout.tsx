// app/(child)/_layout.tsx — Floating Pill Navbar (Theme Aware)
import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@shared/constants/typography';
import { useChildStore } from '@features/auth/store/useChildStore';
import { useEffect } from 'react';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useThemeStore } from '@shared/store/useThemeStore';

function TabBarBackground() {
  const colors = useThemeColors();
  const mode = useThemeStore(s => s.mode);
  
  return (
    <View style={[styles.tabBarBackgroundContainer, { borderColor: colors.materials.border }]}>
      <BlurView 
        intensity={Platform.OS === 'android' ? 60 : 80} 
        tint={mode === 'light' ? 'light' : 'dark'} 
        {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'none' } : {})}
        style={styles.tabBarBlur}
      >
        <View style={[styles.innerStroke, { borderTopColor: colors.materials.border }]} />
      </BlurView>
    </View>
  );
}

export default function ChildTabLayout() {
  const updateStreak = useChildStore((s) => s.updateStreak);
  const colors = useThemeColors();
  const mode = useThemeStore(s => s.mode);
  const dynamicStyles = getStyles(colors, mode);

  useEffect(() => {
    updateStreak();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: dynamicStyles.tabBar,
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
        tabBarBackground: TabBarBackground,
      }}
    >
      <Tabs.Screen
        name="world"
        options={{
          title: 'Mundo',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'planet' : 'planet-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: 'Metas',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'flag' : 'flag-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Aprender',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'book' : 'book-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Mi Alcancía',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const getStyles = (colors: any, mode: string) => StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    height: 72,
    borderRadius: 36,
    backgroundColor: mode === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(12, 12, 15, 0.98)', 
    borderTopWidth: 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: mode === 'light' ? 0.1 : 0.4,
    shadowRadius: 15,
    paddingBottom: 0,
  },
});

const styles = StyleSheet.create({
  tabBarItem: {
    justifyContent: 'center',
    paddingTop: Platform.OS === 'android' ? 10 : 15,
  },
  tabBarBackgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 1,
  },
  tabBarBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  innerStroke: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 36,
    borderTopWidth: 1,
  },
  tabBarLabel: {
    fontFamily: Typography.caption1.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
});
