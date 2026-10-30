/**
 * Fase 5 — qué alertas recibe el profe de esta clase: no entra hace N días, no
 * hizo una tarea, bajó su promedio. Se guardan en `config/comunicacion.alertas`
 * y las calcula el servidor cada mañana (alertasProfe). Piloto o superior; con
 * Cadete se ve el adelanto. En el celular se puede activar el push.
 */
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useMiPlan } from '@features/educadores/hooks/useMiPlan';
import TarjetaBloqueada from '@features/educadores/retencion/components/TarjetaBloqueada';
import {
  CONFIG_ALERTAS_POR_DEFECTO,
  DIAS_INACTIVIDAD_OPCIONES,
  leerConfigAlertas,
  type ConfigAlertas,
} from '@/functions/src/educadores/dominio';
import { comunicacionRepository } from '@features/dashboard/data/comunicacionRepository';
import { pedirPushEnEsteCelular } from '@features/dashboard/hooks/usePushCeti';
import { BotonChunky, Chip, Esqueleto, Tarjeta } from '@features/dashboard/components/profe/kit';

export default function AjustesAlertas({
  colegioId,
  cursoId,
}: {
  colegioId: string;
  cursoId: string;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const uid = useAuthStore((s) => s.firebaseUid);
  const { puede, cargando: planCargando } = useMiPlan();
  const conAlertas = !planCargando && puede('alertasTempranas');
  const [config, setConfig] = useState<ConfigAlertas | null>(null);

  useEffect(() => {
    let cancelado = false;
    void comunicacionRepository
      .config(colegioId, cursoId)
      .catch(() => ({}) as { alertas?: unknown })
      .then((c) => {
        if (!cancelado) setConfig(leerConfigAlertas(c.alertas));
      });
    return () => {
      cancelado = true;
    };
  }, [colegioId, cursoId]);

  const cambiar = (nueva: ConfigAlertas) => {
    const antes = config;
    setConfig(nueva);
    if (!uid) return;
    void comunicacionRepository
      .guardarConfig(colegioId, cursoId, uid, { alertas: nueva })
      .catch((e) => {
        setConfig(antes);
        showMessage(t('admin.error'), e instanceof Error ? e.message : String(e), 'error');
      });
  };

  const activarPush = async () => {
    if (!uid) return;
    const ok = await pedirPushEnEsteCelular(uid);
    showMessage(
      ok ? t('comunicacion.alertas.pushOk') : t('comunicacion.alertas.pushNo'),
      undefined,
      ok ? 'success' : 'error'
    );
  };

  if (!planCargando && !conAlertas) {
    return (
      <TarjetaBloqueada
        titulo={t('comunicacion.alertas.bloqueadoTitulo')}
        valor={t('comunicacion.alertas.bloqueadoValor')}
        motivo="alertasTempranas"
        icono="notifications"
      />
    );
  }
  if (!config) return <Esqueleto filas={1} alto={180} />;

  const fila = (titulo: string, ayuda: string, valor: boolean, onChange: (v: boolean) => void) => (
    <View style={st.fila}>
      <View style={st.textos}>
        <Text style={[st.titulo, { color: colors.text.primary }]}>{titulo}</Text>
        <Text style={[st.ayuda, { color: colors.text.secondary }]}>{ayuda}</Text>
      </View>
      <Switch
        value={valor}
        onValueChange={onChange}
        trackColor={{ true: colors.brand.primary, false: colors.materials.border }}
        thumbColor="#FFFFFF"
        {...({ activeThumbColor: '#FFFFFF' } as object)}
        accessibilityLabel={titulo}
      />
    </View>
  );

  const c = config;
  return (
    <View style={st.vista}>
      <Tarjeta style={st.tarjeta}>
        {fila(
          t('comunicacion.alertas.inactividad'),
          t('comunicacion.alertas.inactividadAyuda', { count: c.inactividad.dias }),
          c.inactividad.activa,
          (v) => cambiar({ ...c, inactividad: { ...c.inactividad, activa: v } })
        )}
        {c.inactividad.activa ? (
          <View style={st.chips}>
            {DIAS_INACTIVIDAD_OPCIONES.map((d) => (
              <Chip
                key={d}
                texto={t('comunicacion.alertas.dias', { count: d })}
                seleccionado={c.inactividad.dias === d}
                onPress={() => cambiar({ ...c, inactividad: { ...c.inactividad, dias: d } })}
              />
            ))}
          </View>
        ) : null}
        <View style={[st.separador, { backgroundColor: colors.materials.border }]} />
        {fila(
          t('comunicacion.alertas.tarea'),
          t('comunicacion.alertas.tareaAyuda'),
          c.tarea.activa,
          (v) => cambiar({ ...c, tarea: { activa: v } })
        )}
        <View style={[st.separador, { backgroundColor: colors.materials.border }]} />
        {fila(
          t('comunicacion.alertas.promedio'),
          t('comunicacion.alertas.promedioAyuda'),
          c.promedio.activa,
          (v) => cambiar({ ...c, promedio: { activa: v } })
        )}
      </Tarjeta>
      <Text style={[st.ayuda, { color: colors.text.tertiary }]}>
        {t('comunicacion.alertas.cuando')}
      </Text>
      {Platform.OS !== 'web' ? (
        <BotonChunky
          texto={t('comunicacion.alertas.push')}
          icono="phone-portrait-outline"
          variante="secundario"
          onPress={() => void activarPush()}
        />
      ) : null}
      {JSON.stringify(c) !== JSON.stringify(CONFIG_ALERTAS_POR_DEFECTO) ? (
        <BotonChunky
          texto={t('comunicacion.alertas.restaurar')}
          icono="refresh"
          variante="secundario"
          compacto
          onPress={() => cambiar(CONFIG_ALERTAS_POR_DEFECTO)}
        />
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  vista: { gap: 12 },
  tarjeta: { gap: 12 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  textos: { flex: 1, gap: 2 },
  titulo: { fontSize: 16, fontWeight: '800' },
  ayuda: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  separador: { height: 1 },
});
