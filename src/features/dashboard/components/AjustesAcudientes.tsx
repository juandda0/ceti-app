/**
 * Fase 5 — resumen semanal para acudientes, por clase. El profe lo enciende
 * aquí y ve, estudiante por estudiante, si su acudiente ya tiene enlace o
 * correo; cada uno se maneja desde la ficha del estudiante. Sin notas: solo
 * avance y constancia. Plan Comandante (tutores) o Nave.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Bounceable from '@shared/components/Bounceable';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useMiPlan } from '@features/educadores/hooks/useMiPlan';
import TarjetaBloqueada from '@features/educadores/retencion/components/TarjetaBloqueada';
import { comunicacionRepository } from '@features/dashboard/data/comunicacionRepository';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import {
  acudienteRepository,
  type EstadoAcudiente,
} from '@features/dashboard/data/acudienteRepository';
import { Aviso, Esqueleto, Pill, Tarjeta } from '@features/dashboard/components/profe/kit';

interface Fila {
  uid: string;
  nombre: string;
  estado: EstadoAcudiente | null;
}

export function acudientesActivos(config: { acudientes?: unknown }): boolean {
  return (config.acudientes as { activo?: unknown } | undefined)?.activo === true;
}

export default function AjustesAcudientes({
  colegioId,
  cursoId,
}: {
  colegioId: string;
  cursoId: string;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const profeUid = useAuthStore((s) => s.firebaseUid);
  const { puede, cargando: planCargando } = useMiPlan();
  const conResumen = !planCargando && puede('resumenAcudientes');
  const [activo, setActivo] = useState<boolean | null>(null);
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [pendientes, setPendientes] = useState(0);

  const cargarFilas = useCallback(async () => {
    const roster = await rosterRepository.getRoster(colegioId, cursoId).catch(() => []);
    const activos = roster.filter((e) => e.estado === 'activo');
    setPendientes(roster.filter((e) => e.estado === 'pendiente_atestacion').length);
    const estados = await Promise.all(
      activos.map((e) => acudienteRepository.estado(colegioId, cursoId, e.uid).catch(() => null))
    );
    setFilas(
      activos
        .map((e, i) => ({ uid: e.uid, nombre: e.nombre ?? '', estado: estados[i] }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    );
  }, [colegioId, cursoId]);

  useEffect(() => {
    if (!conResumen) return;
    void comunicacionRepository
      .config(colegioId, cursoId)
      .catch(() => ({}))
      .then((c) => setActivo(acudientesActivos(c)));
  }, [colegioId, cursoId, conResumen]);

  useEffect(() => {
    if (activo) void cargarFilas();
  }, [activo, cargarFilas]);

  const cambiar = (v: boolean) => {
    if (!profeUid) return;
    setActivo(v);
    void comunicacionRepository
      .guardarConfig(colegioId, cursoId, profeUid, { acudientes: { activo: v } })
      .catch((e) => {
        setActivo(!v);
        showMessage(t('admin.error'), e instanceof Error ? e.message : String(e), 'error');
      });
  };

  if (!planCargando && !conResumen) {
    return (
      <View style={st.vista}>
        <TarjetaBloqueada
          titulo={t('acudientes.bloqueadoTitulo')}
          valor={t('acudientes.bloqueadoValor')}
          motivo="resumenAcudientes"
          icono="people"
        />
        <Aviso icono="information-circle" tono="azul" texto={t('acudientes.queVe')} />
      </View>
    );
  }
  if (activo === null) return <Esqueleto filas={1} alto={140} />;

  return (
    <View style={st.vista}>
      <Tarjeta style={st.tarjeta}>
        <View style={st.fila}>
          <View style={st.textos}>
            <Text style={[st.titulo, { color: colors.text.primary }]}>{t('acudientes.activar')}</Text>
            <Text style={[st.ayuda, { color: colors.text.secondary }]}>{t('acudientes.activarAyuda')}</Text>
          </View>
          <Switch
            value={activo}
            onValueChange={cambiar}
            trackColor={{ true: colors.brand.primary, false: colors.materials.border }}
            thumbColor="#FFFFFF"
            {...({ activeThumbColor: '#FFFFFF' } as object)}
            accessibilityLabel={t('acudientes.activar')}
          />
        </View>
      </Tarjeta>
      <Aviso icono="information-circle" tono="azul" texto={t('acudientes.queVe')} />
      <Aviso icono="shield-checkmark" tono="verde" texto={t('acudientes.ley')} />

      {activo ? (
        filas === null ? (
          <Esqueleto filas={3} alto={56} />
        ) : (
          <>
            <Text style={[st.ayuda, { color: colors.text.secondary }]}>{t('acudientes.listaAyuda')}</Text>
            {pendientes > 0 ? (
              <Aviso
                icono="time-outline"
                tono="naranja"
                texto={t('acudientes.pendientes', { count: pendientes })}
              />
            ) : null}
            <Tarjeta style={{ gap: 0, paddingVertical: 4 }}>
              {filas.map((f, i) => (
                <Bounceable
                  key={f.uid}
                  onPress={() =>
                    router.push(
                      `/(staff)/estudiante/${cursoId}/${f.uid}?nombre=${encodeURIComponent(f.nombre)}` as Href
                    )
                  }
                  activeScale={0.98}
                  accessibilityRole="button"
                  style={[
                    st.estudiante,
                    i > 0 && { borderTopWidth: 1, borderTopColor: colors.materials.border },
                  ]}
                >
                  <Text style={[st.nombre, { color: colors.text.primary }]} numberOfLines={1}>
                    {f.nombre}
                  </Text>
                  {f.estado?.correoActivo ? (
                    <Pill tono="verde" icono="mail" texto={t('acudientes.conCorreo')} />
                  ) : f.estado?.token ? (
                    <Pill tono="azul" icono="link" texto={t('acudientes.conEnlace')} />
                  ) : (
                    <Pill tono="neutro" texto={t('acudientes.sinEnlace')} />
                  )}
                  <Ionicons name="chevron-forward" size={16} color={colors.text.quaternary} />
                </Bounceable>
              ))}
            </Tarjeta>
          </>
        )
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
  estudiante: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  nombre: { flex: 1, fontSize: 15, fontWeight: '800' },
});
