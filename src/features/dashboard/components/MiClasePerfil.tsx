/**
 * "Mi clase" en el Perfil del estudiante. Unirse a un profe es opcional: sin
 * clase, Ceti funciona igual y gratis. Con clase, muestra cuál es, si falta la
 * autorización, y deja cambiarse o salir.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { BotonChunky, Pill } from '@features/dashboard/components/profe/kit';
import { leaveClass } from '@features/dashboard/data/joinClass';
import { useMiClase } from '@features/dashboard/hooks/useMiClase';

export const RUTA_UNIRME = '/(app)/unirme' as Href;

export default function MiClasePerfil() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const { clase, cargando } = useMiClase();
  const [saliendo, setSaliendo] = useState(false);

  // Sin clase el token no trae colegio, así que el rol queda en null: también
  // es estudiante. Solo el profe y el admin no ven esta tarjeta.
  if (role === 'profesor' || role === 'admin' || cargando) return null;

  const salir = () =>
    confirmAction({
      title: t('miClase.salirTitulo', { nombre: clase?.nombre || t('miClase.tuClase') }),
      body: t('miClase.salirTexto'),
      cancelLabel: t('admin.cancel'),
      confirmLabel: t('miClase.salir'),
      destructive: true,
      onConfirm: () => {
        void (async () => {
          setSaliendo(true);
          try {
            await leaveClass();
            showMessage(t('miClase.salirOk'), undefined, 'success');
          } catch (e) {
            showMessage(t('admin.error'), e instanceof Error ? e.message : String(e), 'error');
          } finally {
            setSaliendo(false);
          }
        })();
      },
    });

  const pendiente = clase?.estado === 'pendiente_atestacion';

  return (
    <View
      style={[
        st.tarjeta,
        { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
      ]}
    >
      <Text style={[st.titulo, { color: colors.text.primary }]}>{t('miClase.titulo')}</Text>

      {clase ? (
        <>
          <View style={st.fila}>
            <View style={[st.icono, { backgroundColor: colors.fill.brandSubtle }]}>
              <Ionicons name="school" size={20} color={colors.brand.primary} />
            </View>
            <View style={st.flex}>
              <Text style={[st.nombre, { color: colors.text.primary }]} numberOfLines={1}>
                {clase.nombre || t('miClase.tuClase')}
              </Text>
              {clase.grado ? (
                <Text style={[st.sub, { color: colors.text.secondary }]}>
                  {t('miClase.grado', { grado: clase.grado })}
                </Text>
              ) : null}
            </View>
            <Pill
              texto={pendiente ? t('miClase.pendiente') : t('miClase.activo')}
              tono={pendiente ? 'naranja' : 'verde'}
            />
          </View>
          {pendiente ? (
            <Text style={[st.sub, { color: colors.text.secondary }]}>{t('join.pendingBody')}</Text>
          ) : null}
          <View style={st.botones}>
            <BotonChunky
              texto={t('miClase.cambiar')}
              icono="swap-horizontal"
              variante="secundario"
              compacto
              onPress={() => router.push(RUTA_UNIRME)}
            />
            <BotonChunky
              texto={t('miClase.salir')}
              icono="exit-outline"
              variante="peligro"
              compacto
              cargando={saliendo}
              onPress={salir}
            />
          </View>
        </>
      ) : (
        <>
          <Text style={[st.sub, { color: colors.text.secondary }]}>
            {t('miClase.sinClaseTexto')}
          </Text>
          <BotonChunky
            texto={t('miClase.unirme')}
            icono="enter-outline"
            onPress={() => router.push(RUTA_UNIRME)}
          />
        </>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  tarjeta: { borderRadius: 24, borderWidth: 1, padding: 18, gap: 14 },
  titulo: { fontSize: 18, fontWeight: '900' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icono: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2 },
  nombre: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  botones: { gap: 10 },
});
