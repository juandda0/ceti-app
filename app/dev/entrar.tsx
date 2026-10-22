import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { signOut } from 'firebase/auth';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { getFirebaseClients, USA_EMULADORES } from '@shared/lib/firebase/app';
import { signInWithEmail } from '@shared/lib/firebase/emailAuth';
import { readCetiClaims } from '@shared/lib/firebase/claims';
import {
  buscarCuenta,
  destinoTrasEntrar,
  GRUPOS_CUENTAS,
  CUENTAS_SALON,
  type CuentaSalon,
} from '@features/salon/cuentas';

/**
 * Salón demo: entra a una cuenta del emulador con un toque
 * (`/dev/entrar?cuenta=profe-piloto`, opcional `&ir=/bitacora`). Sin `cuenta`,
 * lista las cuentas. Solo existe con __DEV__ y EXPO_PUBLIC_USE_EMULATORS=1: las
 * contraseñas de scripts/salon/cuentas.json no sirven en producción.
 */
export default function EntrarRoute() {
  const params = useLocalSearchParams<{ cuenta?: string; ir?: string }>();
  if (!__DEV__ || !USA_EMULADORES) {
    return (
      <Centro>
        <Text style={s.titulo}>Solo en el emulador</Text>
        <Text style={s.sub}>
          Arranca la app con npm run salon:web (EXPO_PUBLIC_USE_EMULATORS=1) en modo desarrollo.
        </Text>
      </Centro>
    );
  }
  if (!params.cuenta) return <ListaCuentas />;
  const cuenta = buscarCuenta(params.cuenta);
  if (!cuenta) return <ListaCuentas error={`No existe la cuenta "${params.cuenta}".`} />;
  return <Entrar cuenta={cuenta} ir={params.ir} />;
}

function Entrar({ cuenta, ir }: { cuenta: CuentaSalon; ir?: string }) {
  const authReady = useAuthStore((st) => st.authReady);
  const [destino, setDestino] = useState<Href | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady) return;
    let cancelado = false;
    void (async () => {
      try {
        const clients = getFirebaseClients();
        if (!clients) throw new Error('Firebase no está configurado.');
        await clients.auth.authStateReady();
        const actual = clients.auth.currentUser;
        if (actual?.email?.toLowerCase() !== cuenta.email.toLowerCase()) {
          if (actual) await signOut(clients.auth);
          await signInWithEmail(cuenta.email, CUENTAS_SALON.password);
        }
        const u = clients.auth.currentUser;
        if (!u) throw new Error('No se pudo iniciar sesión.');
        const ruta = destinoTrasEntrar(ir);
        if (ruta !== '/') {
          // Destino directo (p. ej. el tablero del profe): los claims y la sesión
          // quedan en el store como lo haría app/index.tsx antes de redirigir.
          const claims = await readCetiClaims(u, true);
          if (cancelado) return;
          useAuthStore.getState().setClaims(claims);
          useAuthStore.getState().login();
        }
        if (!cancelado) setDestino(ruta as Href);
      } catch (e) {
        if (!cancelado) {
          setError(
            `${e instanceof Error ? e.message : String(e)} ¿Están arriba los emuladores y corriste npm run salon:sembrar?`
          );
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [authReady, cuenta, ir]);

  if (destino) return <Redirect href={destino} />;
  return (
    <Centro>
      {error ? (
        <>
          <Text style={s.titulo}>No se pudo entrar como {cuenta.nombre}</Text>
          <Text style={s.sub}>{error}</Text>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color="#818cf8" />
          <Text style={s.sub}>Entrando como {cuenta.nombre}…</Text>
        </>
      )}
    </Centro>
  );
}

function ListaCuentas({ error }: { error?: string }) {
  const router = useRouter();
  return (
    <ScrollView style={s.fondo} contentContainerStyle={s.lista}>
      <Text style={s.titulo}>Cuentas del Salón demo</Text>
      <Text style={s.sub}>
        Solo existen en el emulador. Toca una para entrar; en otra pestaña o subdominio
        (e3.localhost, profe.localhost) cada sesión es independiente.
      </Text>
      {error ? <Text style={s.error}>{error}</Text> : null}
      {GRUPOS_CUENTAS.map((g) => (
        <View key={g.titulo} style={s.grupo}>
          <Text style={s.grupoTitulo}>{g.titulo}</Text>
          {g.cuentas.map((c) => (
            <Pressable
              key={c.id}
              accessibilityRole="link"
              onPress={() =>
                router.replace(
                  `/dev/entrar?cuenta=${c.id}${c.ir ? `&ir=${encodeURIComponent(c.ir)}` : ''}` as Href
                )
              }
              style={({ hovered }) => [s.fila, hovered && s.filaHover]}
            >
              <Text style={s.filaNombre}>
                {c.nombre} <Text style={s.filaId}>· {c.alias ?? c.id}</Text>
              </Text>
              {c.descripcion ? <Text style={s.filaDesc}>{c.descripcion}</Text> : null}
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return <View style={[s.fondo, s.centro]}>{children}</View>;
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#0f172a' },
  centro: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  lista: { padding: 20, gap: 12, maxWidth: 760, width: '100%', alignSelf: 'center' },
  titulo: { color: '#f8fafc', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  sub: { color: '#94a3b8', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  error: { color: '#fca5a5', fontSize: 14, textAlign: 'center' },
  grupo: { gap: 6, marginTop: 8 },
  grupoTitulo: { color: '#c7d2fe', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  fila: { backgroundColor: '#1e293b', borderRadius: 12, padding: 12, gap: 2 },
  filaHover: { backgroundColor: '#273449' },
  filaNombre: { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
  filaId: { color: '#64748b', fontWeight: '500' },
  filaDesc: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },
});
