/**
 * Ajustes de Órbita en el Perfil: meta diaria (hoja con SelectorMeta), avisos
 * de Ceti (pide permiso al encender) y la hora del aviso (7 a. m. a 8 p. m.).
 * Cada cambio se guarda, se registra y reprograma los avisos.
 */
import { useState } from 'react';
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Bounceable from '@shared/components/Bounceable';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import { Typography } from '@shared/constants/typography';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useOrbita, refrescarAvisos } from '@features/orbita/hooks/useOrbita';
import { useOrbitaStore } from '@features/orbita/store/useOrbitaStore';
import { SelectorMeta } from '@features/orbita/components/PuenteDeMando';
import { HORA_MAX, HORA_MIN } from '@features/orbita/domain/avisos';
import type { MetaDiaria } from '@features/orbita/domain/progreso';
import type { AjustesOrbita } from '@features/orbita/domain/orbita';
import { pedirPermisoAvisos } from '@features/orbita/data/avisosCeti';
import { eventos } from '@features/orbita/data/eventos';

export default function AjustesOrbitaPerfil() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { uid, estado } = useOrbita();
  const [hojaMeta, setHojaMeta] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);
  const [negado, setNegado] = useState(false);
  if (!estado) return null;

  const { meta, avisos, horaAviso } = estado.ajustes;
  const tx = { color: colors.text.primary };
  const sub = { color: colors.text.secondary };
  const separador = { backgroundColor: colors.separator.opaque };

  const guardar = (cambios: Partial<AjustesOrbita>) => {
    useOrbitaStore.getState().configurar(uid, cambios);
    const nuevo = useOrbitaStore.getState().porUid[uid];
    refrescarAvisos(nuevo);
    return nuevo;
  };

  const elegirMeta = (m: MetaDiaria) => {
    guardar({ meta: m });
    eventos.metaElegida({ meta: m });
    void Haptics.selectionAsync();
    setHojaMeta(false);
  };

  const cambiarAvisos = async (activos: boolean) => {
    if (activos) {
      setPidiendo(true);
      const permitido = await pedirPermisoAvisos();
      setPidiendo(false);
      if (!permitido) {
        setNegado(true);
        return;
      }
    }
    setNegado(false);
    const nuevo = guardar({ avisos: activos });
    eventos.avisosConfigurados({ activos, hora: nuevo?.ajustes.horaAviso ?? horaAviso });
    void Haptics.selectionAsync();
  };

  const moverHora = (paso: number) => {
    const hora = Math.min(HORA_MAX, Math.max(HORA_MIN, horaAviso + paso));
    if (hora === horaAviso) return;
    guardar({ horaAviso: hora });
    eventos.avisosConfigurados({ activos: avisos, hora });
    void Haptics.selectionAsync();
  };

  const textoHora = (h: number) =>
    t(h < 12 ? 'orbita.perfil.horaAm' : 'orbita.perfil.horaPm', { h: h > 12 ? h - 12 : h });

  const botonHora = (paso: number, deshabilitado: boolean) => (
    <Bounceable
      onPress={() => moverHora(paso)}
      disabled={deshabilitado}
      activeScale={0.9}
      accessibilityRole="button"
      accessibilityLabel={t(paso < 0 ? 'orbita.perfil.horaAntes' : 'orbita.perfil.horaDespues')}
      accessibilityState={{ disabled: deshabilitado }}
      style={[st.botonHora, { backgroundColor: colors.materials.highlight, opacity: deshabilitado ? 0.4 : 1 }]}
    >
      <Ionicons name={paso < 0 ? 'remove' : 'add'} size={20} color={colors.text.primary} />
    </Bounceable>
  );

  return (
    <View
      style={[st.tarjeta, { backgroundColor: colors.materials.base, borderColor: colors.materials.border }]}
    >
      <Text style={[st.titulo, tx]}>{t('orbita.perfil.ajustes')}</Text>

      <Bounceable
        onPress={() => setHojaMeta(true)}
        activeScale={0.98}
        accessibilityRole="button"
        accessibilityLabel={t('orbita.perfil.metaA11y', { meta: t(`orbita.meta.${meta}`) })}
        style={st.fila}
      >
        <View style={[st.icono, { backgroundColor: colors.fill.brandSubtle }]}>
          <Ionicons name="flag" size={18} color={colors.brand.primary} />
        </View>
        <View style={st.flex}>
          <Text style={[st.filaTitulo, tx]}>{t('orbita.perfil.meta')}</Text>
          <Text style={[st.filaSub, sub]}>{t(`orbita.meta.${meta}`)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.quaternary} />
      </Bounceable>

      <View style={[st.separador, separador]} />

      <View style={st.fila}>
        <View style={[st.icono, { backgroundColor: colors.fill.blueSubtle }]}>
          <Ionicons name="notifications" size={18} color={colors.system.blue} />
        </View>
        <View style={st.flex}>
          <Text style={[st.filaTitulo, tx]}>{t('orbita.perfil.avisos')}</Text>
          <Text style={[st.filaSub, sub]}>
            {avisos ? t('orbita.perfil.avisosSi') : t('orbita.perfil.avisosNo')}
          </Text>
        </View>
        <Switch
          value={avisos}
          disabled={pidiendo}
          onValueChange={(v) => void cambiarAvisos(v)}
          trackColor={{ true: colors.brand.primary, false: colors.materials.border }}
          thumbColor="#FFFFFF"
          {...({ activeThumbColor: '#FFFFFF' } as object)}
          accessibilityLabel={t('orbita.perfil.avisos')}
        />
      </View>

      {negado ? (
        <View style={[st.aviso, { backgroundColor: colors.fill.redSubtle }]}>
          <Ionicons name="information-circle" size={18} color={colors.system.red} />
          <Text style={[st.avisoTexto, tx]}>
            {Platform.OS === 'web' ? t('orbita.perfil.avisosWeb') : t('orbita.perfil.avisosNegados')}
          </Text>
        </View>
      ) : null}

      {avisos ? (
        <>
          <View style={[st.separador, separador]} />
          <View style={st.fila}>
            <View style={[st.icono, { backgroundColor: colors.fill.purpleSubtle }]}>
              <Ionicons name="time" size={18} color={colors.system.purple} />
            </View>
            <Text style={[st.filaTitulo, st.flex, tx]}>{t('orbita.perfil.hora')}</Text>
            {botonHora(-1, horaAviso <= HORA_MIN)}
            <Text
              style={[st.hora, tx]}
              accessibilityLiveRegion="polite"
              accessibilityLabel={t('orbita.perfil.horaA11y', { hora: textoHora(horaAviso) })}
            >
              {textoHora(horaAviso)}
            </Text>
            {botonHora(1, horaAviso >= HORA_MAX)}
          </View>
        </>
      ) : null}

      <Text style={[st.nota, { color: colors.text.tertiary }]}>{t('orbita.perfil.avisosNota')}</Text>

      <CetiBottomSheet
        visible={hojaMeta}
        onClose={() => setHojaMeta(false)}
        closeOnBackdropPress
        title={t('orbita.meta.titulo')}
      >
        <SelectorMeta valor={meta} onElegir={elegirMeta} />
      </CetiBottomSheet>
    </View>
  );
}

const st = StyleSheet.create({
  tarjeta: { borderRadius: 28, borderWidth: 1, padding: 20, gap: 12 },
  titulo: { ...Typography.title3, fontWeight: '900' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  flex: { flex: 1 },
  icono: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  filaTitulo: { ...Typography.headline, fontWeight: '800' },
  filaSub: { ...Typography.footnote, fontWeight: '600' },
  separador: { height: StyleSheet.hairlineWidth, marginLeft: 48 },
  botonHora: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  hora: { ...Typography.headline, fontWeight: '900', fontVariant: ['tabular-nums'], minWidth: 92, textAlign: 'center' },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, padding: 12 },
  avisoTexto: { ...Typography.footnote, fontWeight: '600', flex: 1 },
  nota: { ...Typography.caption1, fontWeight: '600' },
});
