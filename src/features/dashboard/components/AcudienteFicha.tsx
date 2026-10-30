/**
 * Fase 5 — "Acudiente" en la ficha del estudiante: el enlace privado del
 * resumen semanal (compartir, ver como el acudiente, cortar) y, con la
 * autorización del acudiente, su correo para recibirlo cada domingo. Solo con
 * el resumen activado en la clase (Comunicación → Acudientes) y para
 * estudiantes con la autorización de datos confirmada.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import { useMiPlan } from '@features/educadores/hooks/useMiPlan';
import TarjetaBloqueada from '@features/educadores/retencion/components/TarjetaBloqueada';
import { comunicacionRepository } from '@features/dashboard/data/comunicacionRepository';
import {
  acudienteRepository,
  compartirTexto,
  enlaceDeAcudiente,
  type AccionAcudiente,
  type EstadoAcudiente,
} from '@features/dashboard/data/acudienteRepository';
import { acudientesActivos } from '@features/dashboard/components/AjustesAcudientes';
import {
  Aviso,
  BotonChunky,
  Campo,
  Seccion,
  Tarjeta,
} from '@features/dashboard/components/profe/kit';

export default function AcudienteFicha({
  colegioId,
  cursoId,
  uid,
  nombre,
  activoEnClase,
}: {
  colegioId: string;
  cursoId: string;
  uid: string;
  nombre: string;
  activoEnClase: boolean;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const { puede, cargando: planCargando } = useMiPlan();
  const conResumen = !planCargando && puede('resumenAcudientes');
  const [claseActiva, setClaseActiva] = useState<boolean | null>(null);
  const [estado, setEstado] = useState<EstadoAcudiente | null>(null);
  const [correo, setCorreo] = useState('');
  const [autorizado, setAutorizado] = useState(false);
  const [ocupado, setOcupado] = useState<AccionAcudiente | null>(null);
  const primerNombre = nombre.trim().split(/\s+/)[0] || nombre;

  const cargar = useCallback(async () => {
    const [config, e] = await Promise.all([
      comunicacionRepository.config(colegioId, cursoId).catch(() => ({})),
      acudienteRepository.estado(colegioId, cursoId, uid).catch(() => null),
    ]);
    setClaseActiva(acudientesActivos(config));
    setEstado(e);
  }, [colegioId, cursoId, uid]);

  useEffect(() => {
    if (conResumen) void cargar();
  }, [conResumen, cargar]);

  const pedir = async (accion: AccionAcudiente, extra: { correo?: string; autorizado?: boolean } = {}) => {
    setOcupado(accion);
    try {
      const r = await acudienteRepository.gestionar({ colegioId, cursoId, uid, accion, ...extra });
      setEstado(r);
      return r;
    } catch (e) {
      showMessage(t('admin.error'), e instanceof Error ? e.message : String(e), 'error');
      return null;
    } finally {
      setOcupado(null);
    }
  };

  const compartir = async () => {
    const r = estado?.token ? estado : await pedir('enlace');
    if (!r?.token) return;
    const resultado = await compartirTexto(
      t('acudientes.mensajeCompartir', { nombre: primerNombre, enlace: enlaceDeAcudiente(r.token) })
    ).catch(() => 'no' as const);
    if (resultado === 'copiado') showMessage(t('acudientes.copiado'), undefined, 'success');
  };

  const guardarCorreo = async () => {
    const r = await pedir('correo', { correo, autorizado });
    if (r) {
      setCorreo('');
      setAutorizado(false);
      showMessage(t('acudientes.correoGuardado'), undefined, 'success');
    }
  };

  const cortar = () =>
    confirmAction({
      title: t('acudientes.cortarTitulo'),
      body: t('acudientes.cortarTexto', { nombre: primerNombre }),
      cancelLabel: t('admin.cancel'),
      confirmLabel: t('acudientes.cortar'),
      destructive: true,
      onConfirm: () => void pedir('revocar'),
    });

  if (planCargando) return null;

  return (
    <>
      <Seccion texto={t('acudientes.fichaTitulo')} />
      {!conResumen ? (
        <TarjetaBloqueada
          titulo={t('acudientes.bloqueadoTitulo')}
          valor={t('acudientes.fichaBloqueado', { nombre: primerNombre })}
          motivo="resumenAcudientes"
          icono="people"
        />
      ) : claseActiva === false ? (
        <Tarjeta style={st.tarjeta}>
          <Text style={[st.texto, { color: colors.text.secondary }]}>{t('acudientes.claseApagada')}</Text>
          <BotonChunky
            texto={t('acudientes.irActivar')}
            icono="people"
            variante="secundario"
            compacto
            onPress={() => router.push(`/(staff)/comunicacion/${cursoId}?vista=acudientes` as Href)}
          />
        </Tarjeta>
      ) : !activoEnClase ? (
        <Aviso icono="time-outline" tono="naranja" texto={t('acudientes.faltaAutorizacion')} />
      ) : claseActiva && estado !== null ? (
        <Tarjeta style={st.tarjeta}>
          <Text style={[st.texto, { color: colors.text.secondary }]}>
            {t('acudientes.fichaAyuda', { nombre: primerNombre })}
          </Text>
          {estado.token ? (
            <Text style={[st.enlace, { color: colors.text.primary, backgroundColor: colors.materials.highlight }]} selectable>
              {enlaceDeAcudiente(estado.token)}
            </Text>
          ) : null}
          <BotonChunky
            texto={estado.token ? t('acudientes.compartir') : t('acudientes.crearCompartir')}
            icono="share-social"
            cargando={ocupado === 'enlace'}
            onPress={() => void compartir()}
          />
          {estado.token ? (
            <View style={st.botones}>
              <BotonChunky
                texto={t('acudientes.verComoAcudiente')}
                icono="eye-outline"
                variante="secundario"
                compacto
                onPress={() => router.push(`/acudiente/${estado.token}` as Href)}
                style={{ flex: 1 }}
              />
              <BotonChunky
                texto={t('acudientes.cortar')}
                icono="close-circle-outline"
                variante="secundario"
                compacto
                cargando={ocupado === 'revocar'}
                onPress={cortar}
                style={{ flex: 1 }}
              />
            </View>
          ) : null}

          <View style={[st.separador, { backgroundColor: colors.materials.border }]} />
          {estado.correoActivo && estado.correo ? (
            <>
              <Text style={[st.texto, { color: colors.text.primary }]}>
                {t('acudientes.llegaA', { correo: estado.correo })}
              </Text>
              <BotonChunky
                texto={t('acudientes.quitarCorreo')}
                icono="mail-unread-outline"
                variante="secundario"
                compacto
                cargando={ocupado === 'quitarCorreo'}
                onPress={() => void pedir('quitarCorreo')}
              />
            </>
          ) : (
            <>
              <Campo
                etiqueta={t('acudientes.correoEtiqueta')}
                value={correo}
                onChangeText={setCorreo}
                placeholder="acudiente@correo.com"
                tipo="correo"
                maxLength={120}
              />
              <Pressable
                onPress={() => setAutorizado((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: autorizado }}
                style={st.check}
              >
                <Ionicons
                  name={autorizado ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={autorizado ? colors.brand.primary : colors.text.tertiary}
                />
                <Text style={[st.texto, { flex: 1, color: colors.text.secondary }]}>
                  {t('acudientes.autorizo')}
                </Text>
              </Pressable>
              <BotonChunky
                texto={t('acudientes.guardarCorreo')}
                icono="mail"
                variante="secundario"
                cargando={ocupado === 'correo'}
                deshabilitado={!correo.trim() || !autorizado}
                onPress={() => void guardarCorreo()}
              />
            </>
          )}
        </Tarjeta>
      ) : null}
    </>
  );
}

const st = StyleSheet.create({
  tarjeta: { gap: 12 },
  texto: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  enlace: { fontSize: 13, fontWeight: '700', padding: 10, borderRadius: 10 },
  botones: { flexDirection: 'row', gap: 10 },
  separador: { height: 1 },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
});
