import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import Bounceable from '@shared/components/Bounceable';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { rosterRepository, type EstudianteWithId } from '@features/dashboard/data/rosterRepository';
import { adminService } from '@features/dashboard/data/adminService';
import ClassWorldsManager from '@features/dashboard/components/ClassWorldsManager';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import Segmented from '@features/savings/components/Segmented';
import { FadeIn } from '@features/savings/charts/ChartParts';
import {
  Aviso,
  Avatar,
  BotonChunky,
  Encabezado,
  Esqueleto,
  Pill,
  Seccion,
  Tarjeta,
  Vacio,
  type Tono,
} from '@features/dashboard/components/profe/kit';
import type { EstudianteEstado } from '@shared/types/tenancy';

const POLICY_VERSION = 'v1';

type Vista = 'invitar' | 'mundos' | 'estudiantes';

const TONO_ESTADO: Record<EstudianteEstado, Tono> = {
  activo: 'verde',
  pendiente_atestacion: 'naranja',
  suprimido: 'neutro',
};

/**
 * Per-course operations screen for the profesor (D-PIVOT): class code, class
 * worlds, roster with Ley 1581 attestation, and suppression. The profesor
 * operates ONLY their own course (firestore.rules + the Cloud Functions enforce
 * it). Assigning teachers / creating structure is Admin SDK only (backend).
 * Tres vistas con el control segmentado: Invitar · Mundos · Estudiantes.
 */
export default function CourseManageScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const colegioId = useAuthStore((s) => s.colegioId);
  const params = useLocalSearchParams<{ cursoId: string; nombre?: string }>();
  const cursoId = params.cursoId;
  const cursoNombre = params.nombre ?? cursoId;

  const [vista, setVista] = useState<Vista>('invitar');
  const [roster, setRoster] = useState<EstudianteWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!colegioId || !cursoId) return;
    setLoading(true);
    const r = await rosterRepository.getRoster(colegioId, cursoId);
    setRoster(r);
    setLoading(false);
  }, [colegioId, cursoId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (e) {
      showMessage(t('admin.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const onToggleAuth = (uid: string, activo: boolean) =>
    guard(async () => {
      if (!colegioId || !cursoId) return;
      await adminService.atestar({
        colegioId,
        cursoId,
        uid,
        atestado: !activo,
        politicaVersion: POLICY_VERSION,
      });
    });

  const onSuppress = (uid: string) =>
    confirmAction({
      title: t('admin.suppressConfirmTitle'),
      body: t('admin.suppressConfirmBody'),
      cancelLabel: t('admin.cancel'),
      confirmLabel: t('admin.suppressConfirm'),
      destructive: true,
      onConfirm: () =>
        guard(async () => {
          if (!colegioId || !cursoId) return;
          await adminService.suppressStudent({ colegioId, cursoId, uid });
          showMessage(t('admin.suppressOkTitle'), t('admin.suppressOk'), 'success');
        }),
    });

  // Invite link (RQ-FN13): /join/{code} auto-joins the student after login.
  const inviteBase =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : 'https://ceti-d3769.web.app';
  const inviteUrl = code ? `${inviteBase}/join/${code}` : '';

  const copyToClipboard = (value: string, toast: string) => {
    if (!value || Platform.OS !== 'web') return;
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.clipboard) {
      void nav.clipboard.writeText(value);
      showMessage(toast, undefined, 'success');
    }
  };

  const onCopyCode = () => copyToClipboard(code ?? '', t('admin.codeCopied'));
  const onCopyLink = () => copyToClipboard(inviteUrl, t('admin.linkCopied'));

  const onGenerateCode = async () => {
    if (!colegioId || !cursoId) return;
    setCodeBusy(true);
    try {
      const res = await adminService.generateClassCode(colegioId, cursoId);
      setCode(res.code);
    } catch (e) {
      showMessage(t('admin.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setCodeBusy(false);
    }
  };

  const vistas = useMemo(
    () => [
      { key: 'invitar' as const, label: t('profe.vistaInvitar') },
      { key: 'mundos' as const, label: t('profe.vistaMundos') },
      { key: 'estudiantes' as const, label: t('profe.vistaEstudiantes') },
    ],
    [t]
  );

  const invitar = (
    <View style={styles.vista}>
      <Tarjeta style={styles.codigoTarjeta}>
        <Text style={[styles.codigoEtiqueta, { color: colors.text.tertiary }]}>
          {t('admin.classCode').toUpperCase()}
        </Text>
        {code ? (
          <>
            {/* key={code}: al regenerar, las fichas vuelven a caer en cascada. */}
            <View key={code} style={styles.fichas} accessible accessibilityLabel={code}>
              {code.split('').map((letra, i) => (
                <FadeIn key={i} delay={i * 60}>
                  <View
                    style={[
                      styles.ficha,
                      {
                        backgroundColor: colors.fill.brandSubtle,
                        borderColor: colors.brand.primary,
                      },
                    ]}
                  >
                    <Text style={[styles.fichaTexto, { color: colors.brand.primary }]}>
                      {letra}
                    </Text>
                  </View>
                </FadeIn>
              ))}
            </View>
            <FadeIn delay={code.length * 60}>
              <View style={styles.qr}>
                <QRCode
                  value={inviteUrl || code}
                  size={164}
                  backgroundColor="#FFFFFF"
                  color="#16161A"
                />
              </View>
            </FadeIn>
            <Text style={[styles.codigoAyuda, { color: colors.text.secondary }]}>
              {t('admin.classCodeScan')}
            </Text>
            {Platform.OS === 'web' ? (
              <View style={styles.dosBotones}>
                <BotonChunky
                  texto={t('profe.copiarCodigo')}
                  icono="copy-outline"
                  variante="secundario"
                  compacto
                  onPress={onCopyCode}
                />
                <BotonChunky
                  texto={t('profe.copiarEnlace')}
                  icono="link-outline"
                  variante="secundario"
                  compacto
                  onPress={onCopyLink}
                />
              </View>
            ) : null}
          </>
        ) : (
          <>
            <View style={[styles.llave, { backgroundColor: colors.fill.brandSubtle }]}>
              <Ionicons name="qr-code" size={40} color={colors.brand.primary} />
            </View>
            <Text style={[styles.codigoAyuda, { color: colors.text.secondary }]}>
              {t('admin.classCodeHint')}
            </Text>
          </>
        )}
        <BotonChunky
          texto={code ? t('admin.classCodeShow') : t('admin.classCodeGen')}
          icono="key-outline"
          variante={code ? 'secundario' : 'primario'}
          cargando={codeBusy}
          onPress={() => void onGenerateCode()}
        />
      </Tarjeta>
      <Aviso icono="people" tono="azul" texto={t('admin.rosterSelfJoinHint')} />
    </View>
  );

  const estudiantes = (
    <View style={styles.vista}>
      <Seccion texto={t('dashboard.students', { count: roster.length })} />
      {loading ? (
        <Esqueleto filas={3} alto={64} />
      ) : roster.length === 0 ? (
        <Vacio
          icono="people-outline"
          titulo={t('admin.emptyRoster')}
          texto={t('profe.invitaTexto')}
        />
      ) : (
        <Tarjeta style={{ gap: 0, paddingVertical: 4 }}>
          {roster.map((s, i) => {
            const activo = s.estado === 'activo';
            const suprimido = s.estado === 'suprimido';
            return (
              <View
                key={s.uid}
                style={[
                  styles.alumno,
                  i > 0 && { borderTopWidth: 1, borderTopColor: colors.materials.border },
                ]}
              >
                <Avatar nombre={s.nombre} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    style={[styles.alumnoNombre, { color: colors.text.primary }]}
                    numberOfLines={1}
                  >
                    {s.nombre}
                  </Text>
                  <Pill texto={t(`estados.${s.estado}`)} tono={TONO_ESTADO[s.estado]} />
                </View>
                {!suprimido ? (
                  <View style={styles.acciones}>
                    <Bounceable
                      onPress={() => onToggleAuth(s.uid, activo)}
                      disabled={busy}
                      activeScale={0.94}
                      accessibilityRole="button"
                      accessibilityLabel={activo ? t('admin.revoke') : t('admin.authorize')}
                      style={[
                        styles.accion,
                        {
                          borderColor: activo ? colors.materials.border : colors.system.green,
                          backgroundColor: activo ? colors.materials.base : colors.fill.greenSubtle,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.accionTexto,
                          { color: activo ? colors.text.secondary : colors.system.green },
                        ]}
                      >
                        {activo ? t('admin.revoke') : t('admin.authorize')}
                      </Text>
                    </Bounceable>
                    <Bounceable
                      onPress={() => onSuppress(s.uid)}
                      disabled={busy}
                      activeScale={0.9}
                      accessibilityRole="button"
                      accessibilityLabel={t('admin.suppress')}
                      style={[styles.icono, { backgroundColor: colors.fill.redSubtle }]}
                    >
                      <Ionicons name="trash-outline" size={17} color={colors.system.red} />
                    </Bounceable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </Tarjeta>
      )}
    </View>
  );

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[styles.page, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado
          atras="/(staff)/clases"
          sobretitulo={t('profe.sobreGestionar')}
          titulo={cursoNombre}
          subtitulo={t('profe.gestionarSub')}
        />

        <Segmented options={vistas} value={vista} onChange={setVista} />

        <FadeIn key={vista}>
          {vista === 'invitar' ? (
            invitar
          ) : vista === 'mundos' ? (
            colegioId && cursoId ? (
              <ClassWorldsManager colegioId={colegioId} cursoId={cursoId} />
            ) : null
          ) : (
            estudiantes
          )}
        </FadeIn>
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 14 },
  vista: { gap: 14 },
  codigoTarjeta: { alignItems: 'center', padding: 20, gap: 16 },
  codigoEtiqueta: { fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  fichas: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  ficha: {
    width: 40,
    height: 50,
    borderRadius: 12,
    borderWidth: 2,
    borderBottomWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fichaTexto: { fontSize: 24, fontWeight: '900' },
  qr: { padding: 14, borderRadius: 22, backgroundColor: '#FFFFFF' },
  codigoAyuda: { fontSize: 15, lineHeight: 21, fontWeight: '600', textAlign: 'center' },
  dosBotones: { gap: 10, alignSelf: 'stretch' },
  llave: {
    width: 84,
    height: 84,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alumno: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  alumnoNombre: { fontSize: 16, fontWeight: '800' },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accion: {
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  accionTexto: { fontSize: 13, fontWeight: '900' },
  icono: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
