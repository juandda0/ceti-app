import { Platform, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import SalonScreen from '@features/salon/screens/SalonScreen';

// Herramienta interna: el Salón demo (profe + N estudiantes, cada uno en su
// propio origen con su sesión). En builds de producción la ruta no lleva a
// ningún sitio.
export default function SalonDevRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.centro}>
        <Text style={styles.texto}>
          El Salón demo solo funciona en web: ábrelo en el navegador con /dev/salon.
        </Text>
      </View>
    );
  }
  return <SalonScreen />;
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  texto: { color: '#A8A8B2', fontSize: 15, textAlign: 'center' },
});
