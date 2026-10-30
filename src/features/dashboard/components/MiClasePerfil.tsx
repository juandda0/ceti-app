/**
 * "Mis clases" en el Perfil del estudiante. Unirse a un profe es opcional: sin
 * clases, Ceti funciona igual y gratis. Puede estar en hasta 5 clases (el
 * colegio y un tutor, por ejemplo); de cada una ve si falta la autorización y
 * puede salirse. Salir no toca su galaxia, su racha ni sus XP.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Bounceable from '@shared/components/Bounceable';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { BotonChunky, Pill } from '@features/dashboard/components/profe/kit';
import { leaveClass } from '@features/dashboard/data/joinClass';
import {
  MAX_CLASES_ESTUDIANTE,
  useMisClases,
  type MiClase,
} from '@features/dashboard/hooks/useMiClase';

export const RUTA_UNIRME = '/(app)/unirme' as Href;

export default function MiClasePerfil() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const { clases, cargando } = useMisClases();
  const [saliendo, setSaliendo] = useState<string | null>(null);

  // Sin clase el rol puede venir en null (tokens de antes): también es estudiante.
  // Solo el profe y el admin no ven esta tarjeta.
  if (role === 'profesor' || role === 'admin' || cargando) return null;

  const salir = (c: MiClase) =>
    confirmAction({
      title: t('miClase.salirTitulo', { nombre: c.nombre || t('miClase.tuClase') }),
      body: t('miClase.salirTexto'),
      cancelLabel: t('admin.cancel'),
      confirmLabel: t('miClase.salir'),
      destructive: true,
      onConfirm: () => {
        void (async () => {
          setSaliendo(c.cursoId);
          try {
            await leaveClass(c.cursoId);
            showMessage(t('miClase.salirOk'), undefined, 'success');
          } catch (e) {
            showMessage(t('admin.error'), e instanceof Error ? e.message : String(e), 'error');
          } finally {
            setSaliendo(null);
          }
        })();
      },
    });

  const lleno = clases.length >= MAX_CLASES_ESTUDIANTE;

  return (
    <View
      style={[
        st.tarjeta,
        { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
      ]}
    >
      <View style={st.cabeza}>
        <Text style={[st.titulo, { color: colors.text.primary }]}>{t('miClase.titulo')}</Text>
        {clases.length > 0 ? (
          <Text style={[st.cuenta, { color: colors.text.tertiary }]}>
            {t('miClase.cuenta', { n: clases.length, max: MAX_CLASES_ESTUDIANTE })}
          </Text>
        ) : null}
      </View>

      {clases.length === 0 ? (
        <Text style={[st.sub, { color: colors.text.secondary }]}>{t('miClase.sinClaseTexto')}</Text>
      ) : (
        clases.map((c, i) => {
          const pendiente = c.estado === 'pendiente_atestacion';
          return (
            <View
              key={c.cursoId}
              style={[
                st.fila,
                i > 0 && { borderTopWidth: 1, borderTopColor: colors.materials.border },
              ]}
            >
              <View style={[st.icono, { backgroundColor: colors.fill.brandSubtle }]}>
                <Ionicons name="school" size={20} color={colors.brand.primary} />
              </View>
              <View style={st.flex}>
                <Text style={[st.nombre, { color: colors.text.primary }]} numberOfLines={1}>
                  {c.nombre || t('miClase.tuClase')}
                </Text>
                <View style={st.meta}>
                  {c.grado ? (
                    <Text style={[st.sub, { color: colors.text.secondary }]}>
                      {t('miClase.grado', { grado: c.grado })}
                    </Text>
                  ) : null}
                  <Pill
                    texto={pendiente ? t('miClase.pendiente') : t('miClase.activo')}
                    tono={pendiente ? 'naranja' : 'verde'}
                  />
                </View>
              </View>
              <Bounceable
                onPress={() => salir(c)}
                disabled={saliendo !== null}
                activeScale={0.9}
                accessibilityRole="button"
                accessibilityLabel={t('miClase.salirDe', { nombre: c.nombre })}
                style={[st.salir, { backgroundColor: colors.materials.highlight }]}
              >
                <Ionicons
                  name={saliendo === c.cursoId ? 'hourglass-outline' : 'exit-outline'}
                  size={18}
                  color={colors.text.secondary}
                />
              </Bounceable>
            </View>
          );
        })
      )}

      {clases.some((c) => c.estado === 'pendiente_atestacion') ? (
        <Text style={[st.nota, { color: colors.text.tertiary }]}>{t('join.pendingBody')}</Text>
      ) : null}

      <BotonChunky
        texto={clases.length === 0 ? t('miClase.unirme') : t('miClase.unirmeOtra')}
        icono="enter-outline"
        variante={clases.length === 0 ? 'primario' : 'secundario'}
        deshabilitado={lleno}
        onPress={() => router.push(RUTA_UNIRME)}
      />
      {lleno ? (
        <Text style={[st.nota, { color: colors.text.tertiary }]}>
          {t('miClase.lleno', { max: MAX_CLASES_ESTUDIANTE })}
        </Text>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  tarjeta: { borderRadius: 24, borderWidth: 1, padding: 18, gap: 12 },
  cabeza: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  titulo: { fontSize: 18, fontWeight: '900' },
  cuenta: { fontSize: 13, fontWeight: '800' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10 },
  icono: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  nombre: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  nota: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  salir: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
