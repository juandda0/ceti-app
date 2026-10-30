/**
 * Profesores de la entidad (Fase 6, solo admin): cupos usados, invitar por
 * correo, invitaciones pendientes y, por profe, cambiar el rol o sacarlo de la
 * entidad (sus clases se quedan y pasan a quien el admin elija).
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import {
  cupoProfes,
  normalizarCorreo,
  type InvitacionProfe,
  type ProfeEntidad,
  type RolEntidad,
} from '@/functions/src/educadores/dominio';
import {
  Avatar,
  BotonChunky,
  Campo,
  Chip,
  Encabezado,
  Esqueleto,
  Pill,
  Seccion,
  Tarjeta,
  Vacio,
  tapsConTeclado,
} from '@features/dashboard/components/profe/kit';
import { entidadRepository } from '../data/entidadRepository';
import { useMiEntidad } from '../hooks/useMiEntidad';
import { fechaCorta } from '../components/EntidadTarjeta';

export default function ProfesEntidadScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const uid = useAuthStore((s) => s.firebaseUid);
  const colegioId = useAuthStore((s) => s.colegioId);
  const { vista, cargando, soyAdmin, recargar } = useMiEntidad();
  const [pendientes, setPendientes] = useState<InvitacionProfe[]>([]);
  const [correo, setCorreo] = useState('');
  const [rol, setRol] = useState<RolEntidad>('profe');
  const [enviando, setEnviando] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [pasarA, setPasarA] = useState<string | null>(null);

  const cargarPendientes = useCallback(async () => {
    if (!colegioId || !soyAdmin) return;
    setPendientes(await entidadRepository.invitaciones(colegioId).catch(() => []));
  }, [colegioId, soyAdmin]);

  useEffect(() => {
    void cargarPendientes();
  }, [cargarPendientes]);

  const error = (e: unknown) => showMessage(t('entidad.error'), e instanceof Error ? e.message : String(e), 'error');

  const invitar = async () => {
    setEnviando(true);
    try {
      await entidadRepository.invitar(correo, rol);
      showMessage(t('entidad.profesPantalla.invitado'), t('entidad.profesPantalla.invitadoTexto', { correo }), 'success');
      setCorreo('');
      await cargarPendientes();
    } catch (e) {
      error(e);
    } finally {
      setEnviando(false);
    }
  };

  const cambiarRol = async (p: ProfeEntidad) => {
    try {
      await entidadRepository.cambiarRol(p.uid, p.rol === 'admin' ? 'profe' : 'admin');
      await recargar();
    } catch (e) {
      error(e);
    }
  };

  const sacar = (p: ProfeEntidad) =>
    confirmAction({
      title: t('entidad.profesPantalla.sacarTitulo', { nombre: p.nombre }),
      body: pasarA
        ? t('entidad.profesPantalla.sacarTextoPasar', { nombre: vista?.profes.find((x) => x.uid === pasarA)?.nombre ?? '' })
        : t('entidad.profesPantalla.sacarTexto'),
      confirmLabel: t('entidad.profesPantalla.sacar'),
      cancelLabel: t('entidad.cancelar'),
      destructive: true,
      onConfirm: () => {
        void entidadRepository
          .sacar(p.uid, pasarA)
          .then(async (r) => {
            showMessage(t('entidad.profesPantalla.sacado', { nombre: p.nombre }), t('entidad.profesPantalla.sacadoTexto', { count: r.clases }), 'success');
            setAbierto(null);
            await recargar();
          })
          .catch(error);
      },
    });

  const cupo = vista ? cupoProfes(vista.licencia, Date.now()) : 0;
  const usados = (vista?.profes.length ?? 0) + pendientes.length;

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps={tapsConTeclado}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado atras="/(staff)/colegio" sobretitulo={vista?.entidad?.nombre ?? t('entidad.sobre')} titulo={t('entidad.profesPantalla.titulo')} />
        {cargando ? <Esqueleto filas={3} alto={72} /> : null}
        {!cargando && !soyAdmin ? (
          <Vacio icono="lock-closed-outline" titulo={t('entidad.soloAdmin')} texto={t('entidad.soloAdminTexto')} />
        ) : null}
        {!cargando && soyAdmin && vista ? (
          <>
            <Tarjeta style={{ gap: 4 }}>
              <View style={st.fila}>
                <Text style={[st.cupoTexto, { color: colors.text.primary }]}>{t('entidad.profesPantalla.cupos')}</Text>
                <Text style={[st.cupoNum, { color: colors.text.primary }]}>
                  {Number.isFinite(cupo)
                    ? t('entidad.profesPantalla.cuposDe', { usados, cupo })
                    : t('entidad.profesPantalla.cuposIlimitados', { usados })}
                </Text>
              </View>
              <Text style={[st.sub, { color: colors.text.tertiary }]}>
                {Number.isFinite(cupo) ? t('entidad.profesPantalla.cuposAyuda') : t('entidad.profesPantalla.cuposAyudaIlimitado')}
              </Text>
            </Tarjeta>

            <Seccion texto={t('entidad.profesPantalla.invitar')} />
            <Campo value={correo} onChangeText={setCorreo} tipo="correo" placeholder={t('entidad.profesPantalla.correoEjemplo')} />
            <View style={st.chips}>
              {(['profe', 'admin'] as const).map((r) => (
                <Chip key={r} texto={t(`entidad.rol.${r}`)} seleccionado={rol === r} onPress={() => setRol(r)} />
              ))}
            </View>
            <BotonChunky
              texto={t('entidad.profesPantalla.enviar')}
              icono="mail"
              cargando={enviando}
              deshabilitado={!normalizarCorreo(correo) || usados >= cupo}
              onPress={() => void invitar()}
            />

            <Seccion texto={t('entidad.profesPantalla.equipo', { count: vista.profes.length })} />
            <Tarjeta style={{ gap: 2 }}>
              {vista.profes.map((p) => (
                <View key={p.uid} style={st.miembro}>
                  <View style={st.fila}>
                    <Avatar nombre={p.nombre} tamano={36} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[st.nombre, { color: colors.text.primary }]} numberOfLines={1}>
                        {p.nombre}
                        {p.uid === uid ? ` · ${t('entidad.tu')}` : ''}
                      </Text>
                      <Text style={[st.sub, { color: colors.text.tertiary }]} numberOfLines={1}>
                        {[p.correo, t('entidad.profesPantalla.desde', { fecha: fechaCorta(p.unidoAt) })].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Pill tono={p.rol === 'admin' ? 'naranja' : 'azul'} texto={t(`entidad.rol.${p.rol}`)} />
                  </View>
                  {p.uid !== uid ? (
                    abierto === p.uid ? (
                      <View style={st.acciones}>
                        <BotonChunky
                          texto={t(p.rol === 'admin' ? 'entidad.profesPantalla.quitarAdmin' : 'entidad.profesPantalla.hacerAdmin')}
                          icono="shield-checkmark"
                          variante="secundario"
                          compacto
                          onPress={() => void cambiarRol(p)}
                        />
                        <Text style={[st.sub, { color: colors.text.secondary }]}>{t('entidad.profesPantalla.pasarA')}</Text>
                        <View style={st.chips}>
                          <Chip texto={t('entidad.profesPantalla.nadie')} seleccionado={pasarA === null} onPress={() => setPasarA(null)} />
                          {vista.profes
                            .filter((x) => x.uid !== p.uid)
                            .map((x) => (
                              <Chip key={x.uid} texto={x.nombre} seleccionado={pasarA === x.uid} onPress={() => setPasarA(x.uid)} />
                            ))}
                        </View>
                        <BotonChunky
                          texto={t('entidad.profesPantalla.sacar')}
                          icono="person-remove"
                          variante="secundario"
                          compacto
                          color={colors.system.red}
                          onPress={() => sacar(p)}
                        />
                      </View>
                    ) : (
                      <Chip
                        texto={t('entidad.profesPantalla.gestionar')}
                        icono="settings-outline"
                        seleccionado={false}
                        onPress={() => {
                          setAbierto(p.uid);
                          setPasarA(null);
                        }}
                      />
                    )
                  ) : null}
                </View>
              ))}
            </Tarjeta>

            {pendientes.length > 0 ? (
              <>
                <Seccion texto={t('entidad.profesPantalla.pendientes', { count: pendientes.length })} />
                <Tarjeta style={{ gap: 2 }}>
                  {pendientes.map((i) => (
                    <View key={i.correo} style={[st.fila, st.miembro]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[st.nombre, { color: colors.text.primary }]} numberOfLines={1}>
                          {i.correo}
                        </Text>
                        <Text style={[st.sub, { color: colors.text.tertiary }]}>
                          {t('entidad.profesPantalla.invitadoEl', { fecha: fechaCorta(i.creadaAt), rol: t(`entidad.rol.${i.rol}`) })}
                        </Text>
                      </View>
                      <Chip
                        texto={t('entidad.profesPantalla.retirar')}
                        seleccionado={false}
                        onPress={() =>
                          void entidadRepository
                            .cancelarInvitacion(i.correo)
                            .then(cargarPendientes)
                            .catch(error)
                        }
                      />
                    </View>
                  ))}
                </Tarjeta>
              </>
            ) : null}
          </>
        ) : null}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 80, gap: 14 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cupoTexto: { flex: 1, fontSize: 15, fontWeight: '800' },
  cupoNum: { fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  miembro: { gap: 8, paddingVertical: 8 },
  nombre: { fontSize: 15, fontWeight: '800' },
  sub: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  acciones: { gap: 8, paddingLeft: 46 },
});
