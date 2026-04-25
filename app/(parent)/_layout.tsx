// app/(parent)/_layout.tsx — Navegación de Pestañas para el Panel de Control Parental (Theme Aware)
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
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
        style={styles.tabBarBlur}
      />
    </View>
  );
}

export default function ParentLayout() {
  const colors = useThemeColors();
  const mode = useThemeStore(s => s.mode);
  const dynamicStyles = getStyles(colors, mode);

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
        name="dashboard"
        options={{
          title: 'Resumen',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Análisis',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tareas',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'checkbox' : 'checkbox-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="assign-reward"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="savings-dashboard"
        options={{
          href: null,
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
    backgroundColor: mode === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(18, 18, 22, 0.98)', 
    borderTopWidth: 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: mode === 'light' ? 0.1 : 0.5,
    shadowRadius: 15,
    paddingBottom: 0,
  },
});

const styles = StyleSheet.create({
  tabBarItem: {
    justifyContent: 'center',
    paddingTop: Platform.OS === 'android' ? 10 : 12,
  },
  tabBarBackgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 1,
  },
  tabBarBlur: { ...StyleSheet.absoluteFillObject },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 0.3
  },
});
