import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import Bounceable from '@shared/components/Bounceable';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { rosterRepository, type CursoWithId } from '@features/dashboard/data/rosterRepository';
import {
  BotonChunky,
  Encabezado,
  Esqueleto,
  InsigniaGrado,
  Pill,
  Tarjeta,
  Vacio,
  tonoDeClase,
} from '@features/dashboard/components/profe/kit';

/**
 * Pestaña Clases del profesor: sus clases como tarjetas (grado, nombre, código)
 * que llevan al tablero de cada una, y la tarjeta para crear otra. El reporte del
 * colegio y la sesión viven en sus propias pestañas (Colegio · Perfil).
 */
export default function StaffHomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const colegioId = useAuthStore((s) => s.colegioId);
  const uid = useAuthStore((s) => s.firebaseUid);

  const [cursos, setCursos] = useState<CursoWithId[]>([]);
  const [colegioNombre, setColegioNombre] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!colegioId) return;
    let cancelled = false;
    void rosterRepository.getColegioNombre(colegioId).then((n) => {
      if (!cancelled) setColegioNombre(n);
    });
    return () => {
      cancelled = true;
    };
  }, [colegioId]);

  useEffect(() => {
    let cancelled = false;
    if (!colegioId || !uid) {
      setStatus('ready');
      return;
    }
    setStatus('loading');
    void rosterRepository
      .getCursosByProfesor(colegioId, uid)
      .then((list) => {
        if (!cancelled) {
          setCursos(list);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [colegioId, uid]);

  const abrirClase = (c: CursoWithId) =>
    router.push(`/(staff)/curso/${c.id}?nombre=${encodeURIComponent(c.nombre)}` as Href);
  const crearClase = () => router.push('/(staff)/crear-clase' as Href);

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[styles.page, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado
          titulo={t('profe.clasesTitulo')}
          subtitulo={
            colegioNombre ? t('profe.saludoColegio', { colegio: colegioNombre }) : t('profe.saludo')
          }
        />

        {status === 'loading' ? <Esqueleto filas={3} alto={96} /> : null}

        {status === 'error' ? (
          <Vacio
            icono="cloud-offline-outline"
            tono="rojo"
            titulo={t('profe.errorTitulo')}
            texto={t('dashboard.error')}
          />
        ) : null}

        {status === 'ready' && cursos.length === 0 ? (
          <Vacio
            icono="school-outline"
            titulo={t('profe.sinClasesTitulo')}
            texto={t('profe.sinClasesTexto')}
            accion={
              <BotonChunky texto={t('createClass.create')} icono="add" onPress={crearClase} />
            }
          />
        ) : null}

        {cursos.map((c, i) => {
          const tono = tonoDeClase(i);
          return (
            <Tarjeta
              key={c.id}
              onPress={() => abrirClase(c)}
              accessibilityLabel={t('profe.abrirClase', { nombre: c.nombre })}
            >
              <View style={styles.claseFila}>
                <InsigniaGrado grado={c.grado} tono={tono} />
                <View style={styles.claseTexto}>
                  <Text
                    style={[styles.claseNombre, { color: colors.text.primary }]}
                    numberOfLines={2}
                  >
                    {c.nombre}
                  </Text>
                  <View style={styles.claseMeta}>
                    <Text style={[styles.claseSub, { color: colors.text.tertiary }]}>
                      {t('profe.grado', { grado: c.grado })}
                    </Text>
                    {c.codigo ? <Pill texto={c.codigo} icono="key" tono="neutro" /> : null}
                  </View>
                </View>
                <View style={[styles.flecha, { backgroundColor: colors.materials.highlight }]}>
                  <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />
                </View>
              </View>
            </Tarjeta>
          );
        })}

        {status === 'ready' && cursos.length > 0 ? (
          <Bounceable
            onPress={crearClase}
            activeScale={0.98}
            accessibilityRole="button"
            accessibilityLabel={t('createClass.create')}
            style={[styles.crear, { borderColor: colors.brand.primary }]}
          >
            <View style={[styles.crearIcono, { backgroundColor: colors.fill.brandSubtle }]}>
              <Ionicons name="add" size={22} color={colors.brand.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.crearTitulo, { color: colors.brand.primary }]}>
                {t('createClass.create')}
              </Text>
              <Text style={[styles.claseSub, { color: colors.text.tertiary }]}>
                {t('profe.crearClaseSub')}
              </Text>
            </View>
          </Bounceable>
        ) : null}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 130, gap: 14 },
  claseFila: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  claseTexto: { flex: 1, gap: 3 },
  claseNombre: { fontSize: 20, lineHeight: 24, fontWeight: '900' },
  claseMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  claseSub: { fontSize: 14, fontWeight: '700' },
  flecha: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 24,
    padding: 16,
  },
  crearIcono: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crearTitulo: { fontSize: 17, fontWeight: '900' },
});
