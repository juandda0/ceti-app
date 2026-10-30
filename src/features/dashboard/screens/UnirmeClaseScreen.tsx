/**
 * Ajustes → Mi clase → Unirme a una clase. El estudiante escribe el código de
 * su profe, o llega aquí desde el enlace /join/{código} con el código ya puesto.
 * Puede estar en hasta 5 clases a la vez; unirse a otra no lo saca de ninguna.
 */
import { useCallback } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { showMessage } from '@shared/lib/dialogs';
import ClassCodeForm from '@features/dashboard/components/ClassCodeForm';
import {
  Aviso,
  Encabezado,
  Tarjeta,
  tapsConTeclado,
} from '@features/dashboard/components/profe/kit';
import { joinClass } from '@features/dashboard/data/joinClass';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { MAX_CLASES_ESTUDIANTE } from '@features/dashboard/hooks/useMiClase';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { pendingInvite } from '@features/dashboard/data/pendingInvite';
import { useUserStore } from '@features/auth/store/useUserStore';

export default function UnirmeClaseScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ codigo?: string; auto?: string }>();
  const enClases = useAuthStore((s) => Object.keys(s.clases).length);
  const lleno = enClases >= MAX_CLASES_ESTUDIANTE;

  const nombreInicial = useUserStore((s) => s.fullName || s.nickname);

  const onJoin = useCallback(
    async (code: string, nombreCompleto: string) => {
      // Ya consumido: que useInvitacionPendiente no vuelva a abrir esta pantalla.
      pendingInvite.consume();
      const { colegioId, cursoId } = await joinClass(code, nombreCompleto);
      const curso = await rosterRepository.getCurso(colegioId, cursoId).catch(() => null);
      showMessage(
        curso?.nombre ? t('miClase.unidoTitulo', { nombre: curso.nombre }) : t('join.okTitle'),
        t('miClase.unidoTexto'),
        'success'
      );
      router.replace('/(app)/saga' as Href);
    },
    [router, t]
  );

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[
          st.page,
          { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 12 : 8) + 12 },
        ]}
        keyboardShouldPersistTaps={tapsConTeclado}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado
          atras="/(app)/profile"
          titulo={t('miClase.unirmeTitulo')}
          subtitulo={t('miClase.unirmeTexto')}
        />
        {lleno ? (
          <Aviso
            icono="alert-circle"
            tono="naranja"
            texto={t('miClase.lleno', { max: MAX_CLASES_ESTUDIANTE })}
          />
        ) : (
          <Tarjeta style={st.tarjeta}>
            <ClassCodeForm
              initialCode={params.codigo ?? ''}
              nombreInicial={nombreInicial}
              // Con el enlace se une solo si ya tiene su nombre completo.
              autoSubmit={params.auto === '1'}
              sinEncabezado
              onJoin={onJoin}
            />
          </Tarjeta>
        )}
        <View style={st.pie}>
          <Aviso icono="sparkles" tono="azul" texto={t('miClase.gratis')} />
        </View>
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 14 },
  tarjeta: { padding: 20 },
  pie: { marginTop: 4 },
});
