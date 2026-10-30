/**
 * Fase 9 — Colegio → Conexiones (solo admins de la entidad): los dominios de
 * correo de la institución, para que sus profes reciban la invitación al
 * entrar con Google Workspace o Microsoft 365, y las plataformas LTI 1.3
 * (Moodle, Canvas) con los datos que hay que pegar allá.
 */
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import type { RegistroPlataformaLti, SalidaGestionarPlataformaLti } from '@/functions/src/integraciones/dominio/lti';
import { Aviso, BotonChunky, Campo, Chip, Encabezado, Esqueleto, Pill, Seccion, Tarjeta, tapsConTeclado } from '@features/dashboard/components/profe/kit';
import { useMiEntidad } from '@features/educadores/entidad/hooks/useMiEntidad';
import { integracionesRepository } from '../data/integracionesRepository';

const VACIO: RegistroPlataformaLti = { nombre: '', issuer: '', clientId: '', deploymentId: '', authLoginUrl: '', keysetUrl: '' };
const CAMPOS: (keyof RegistroPlataformaLti)[] = ['nombre', 'issuer', 'clientId', 'deploymentId', 'authLoginUrl', 'keysetUrl'];

export default function ConexionesEntidadScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { soyAdmin } = useMiEntidad();
  const [dominios, setDominios] = useState<string[] | null>(null);
  const [nuevo, setNuevo] = useState('');
  const [lti, setLti] = useState<SalidaGestionarPlataformaLti | null>(null);
  const [registro, setRegistro] = useState<RegistroPlataformaLti | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(() => {
    void integracionesRepository.dominios().then((r) => setDominios(r.dominios)).catch(() => setDominios([]));
    void integracionesRepository.plataformas().then(setLti).catch(() => setLti(null));
  }, []);
  useEffect(() => {
    if (soyAdmin) cargar();
  }, [soyAdmin, cargar]);

  const hacer = async (clave: string, fn: () => Promise<void>) => {
    setOcupado(clave);
    try {
      await fn();
    } catch (e) {
      showMessage(t('conexiones.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setOcupado(null);
    }
  };

  // En web se copia; en el celular el texto se puede seleccionar.
  const copiar = (texto: string) => {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (!nav?.clipboard) return;
    void nav.clipboard.writeText(texto);
    showMessage(t('conexiones.copiado'), undefined, 'success');
  };

  const dato = (etiqueta: string, valor: string) => (
    <View style={{ gap: 4 }}>
      <Text style={[st.sub, { color: colors.text.tertiary }]}>{etiqueta}</Text>
      <View style={st.fila}>
        <Text selectable style={[st.mono, { color: colors.text.primary, flex: 1 }]}>
          {valor}
        </Text>
        {Platform.OS === 'web' ? (
          <Chip texto={t('conexiones.copiar')} icono="copy-outline" seleccionado={false} onPress={() => copiar(valor)} />
        ) : null}
      </View>
    </View>
  );

  return (
    <ScreenWrapper>
      <ContextScrollView contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps={tapsConTeclado}>
        <Encabezado atras="/(staff)/colegio" sobretitulo={t('conexiones.sobre')} titulo={t('conexiones.titulo')} subtitulo={t('conexiones.sub')} />
        {!soyAdmin ? <Aviso icono="lock-closed" tono="neutro" texto={t('conexiones.soloAdmin')} /> : null}

        {soyAdmin ? (
          <>
            <Seccion texto={t('conexiones.dominios')} />
            <Text style={[st.sub, { color: colors.text.secondary }]}>{t('conexiones.dominiosAyuda')}</Text>
            {dominios === null ? <Esqueleto filas={1} alto={56} /> : null}
            {dominios?.map((d) => (
              <Tarjeta key={d} style={st.fila}>
                <Text style={[st.titulo, { color: colors.text.primary, flex: 1 }]}>{d}</Text>
                <Pill texto={t('conexiones.activo')} tono="verde" />
                <Chip
                  texto={t('conexiones.quitar')}
                  icono="close-circle-outline"
                  seleccionado={false}
                  color={colors.system.red}
                  onPress={() => void hacer(`q${d}`, async () => setDominios((await integracionesRepository.quitarDominio(d)).dominios))}
                />
              </Tarjeta>
            ))}
            <Campo etiqueta={t('conexiones.nuevoDominio')} value={nuevo} onChangeText={setNuevo} placeholder="micolegio.edu.co" />
            <BotonChunky
              texto={t('conexiones.agregarDominio')}
              icono="add-circle"
              variante="secundario"
              compacto
              cargando={ocupado === 'dominio'}
              deshabilitado={!nuevo.trim()}
              onPress={() =>
                void hacer('dominio', async () => {
                  setDominios((await integracionesRepository.agregarDominio(nuevo)).dominios);
                  setNuevo('');
                  showMessage(t('conexiones.dominioAgregado'), undefined, 'success');
                })
              }
            />

            <Seccion texto={t('conexiones.lti')} />
            <Text style={[st.sub, { color: colors.text.secondary }]}>{t('conexiones.ltiAyuda')}</Text>
            {lti ? (
              <Tarjeta style={{ gap: 10 }}>
                <Text style={[st.titulo, { color: colors.text.primary }]}>{t('conexiones.pegaEnLms')}</Text>
                {dato(t('conexiones.urlInicio'), lti.herramienta.urlInicioSesion)}
                {dato(t('conexiones.urlRedireccion'), lti.herramienta.urlRedireccion)}
                {dato(t('conexiones.urlLanzamiento'), lti.herramienta.urlLanzamiento)}
                {dato(t('conexiones.parametro'), lti.herramienta.parametroPersonalizado)}
                <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('conexiones.parametroAyuda')}</Text>
              </Tarjeta>
            ) : (
              <Esqueleto filas={1} alto={120} />
            )}
            {lti?.plataformas.map((p) => (
              <Tarjeta key={p.plataformaId} style={{ gap: 6 }}>
                <View style={st.fila}>
                  <Text style={[st.titulo, { color: colors.text.primary, flex: 1 }]}>{p.nombre}</Text>
                  <Pill texto={t('conexiones.lanzamientos', { count: p.lanzamientos })} tono="azul" />
                </View>
                <Text style={[st.sub, { color: colors.text.tertiary }]}>{p.issuer}</Text>
                <Chip
                  texto={t('conexiones.quitar')}
                  icono="trash-outline"
                  seleccionado={false}
                  color={colors.system.red}
                  onPress={() =>
                    confirmAction({
                      title: t('conexiones.quitarLtiTitulo', { nombre: p.nombre }),
                      body: t('conexiones.quitarLtiTexto'),
                      confirmLabel: t('conexiones.quitar'),
                      cancelLabel: t('conexiones.cancelar'),
                      destructive: true,
                      onConfirm: () => void hacer(`l${p.plataformaId}`, async () => setLti(await integracionesRepository.quitarPlataforma(p.plataformaId))),
                    })
                  }
                />
              </Tarjeta>
            ))}
            {registro ? (
              <Tarjeta style={{ gap: 10 }}>
                {CAMPOS.map((c) => (
                  <Campo
                    key={c}
                    etiqueta={t(`conexiones.campo.${c}`)}
                    value={registro[c]}
                    onChangeText={(v) => setRegistro((r) => (r ? { ...r, [c]: v } : r))}
                    ayuda={t(`conexiones.campoAyuda.${c}`)}
                  />
                ))}
                <BotonChunky
                  texto={t('conexiones.registrar')}
                  icono="link"
                  cargando={ocupado === 'lti'}
                  deshabilitado={CAMPOS.some((c) => !registro[c].trim())}
                  onPress={() =>
                    void hacer('lti', async () => {
                      setLti(await integracionesRepository.registrarPlataforma(registro));
                      setRegistro(null);
                      showMessage(t('conexiones.registrada'), undefined, 'success');
                    })
                  }
                />
                <BotonChunky texto={t('conexiones.cancelar')} variante="secundario" compacto onPress={() => setRegistro(null)} />
              </Tarjeta>
            ) : (
              <BotonChunky texto={t('conexiones.nuevaPlataforma')} icono="add-circle" variante="secundario" compacto onPress={() => setRegistro(VACIO)} />
            )}
          </>
        ) : null}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 14 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titulo: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  mono: { fontSize: 13, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) },
});
