import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DarkColors } from '@shared/constants/colors';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

/**
 * Captura errores de render y evita que tumbe toda la app sin feedback.
 * Crashlytics se engancha en `componentDidCatch` cuando Firebase esté configurado.
 */
export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (__DEV__) {
      // eslint-disable-next-line no-console -- útil en desarrollo
      console.error('[AppErrorBoundary]', error.message, info.componentStack);
    }
    try {
      // Lazy optional: evita hard dependency si el módulo no está enlazado aún
      const mod =
        require('../lib/analytics/crashlytics') as typeof import('../lib/analytics/crashlytics');
      void mod.recordBoundaryError(error, info.componentStack ?? '');
    } catch {
      /* Firebase no instalado o no listo */
    }
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      const c = DarkColors;
      return (
        <View style={[styles.wrap, { backgroundColor: c.background.base }]}>
          <Text style={[styles.title, { color: c.text.primary }]}>Algo salió mal</Text>
          <Text style={[styles.body, { color: c.text.secondary }]}>
            {__DEV__ ? this.state.error.message : 'Reinicia la aplicación o inténtalo de nuevo.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Intentar de nuevo"
            onPress={this.handleRetry}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: c.brand.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.btnLabel, { color: c.text.inverse }]}>Reintentar</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  body: { fontSize: 15, marginBottom: 20 },
  btn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, alignSelf: 'flex-start' },
  btnLabel: { fontSize: 16, fontWeight: '600' },
});
