/**
 * Fase 5 — "Mensajes y comentarios" en la ficha del estudiante. El profe le
 * escribe un mensaje o un comentario de retroalimentación sobre un mundo o una
 * tarea, y ve todo lo que le ha mandado con su estado (visto o no). El
 * estudiante lo recibe en los mensajes de su clase y no puede responder.
 * Mensajes y comentarios son de Piloto; con Cadete se ve el adelanto.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useMiPlan } from '@features/educadores/hooks/useMiPlan';
import TarjetaBloqueada from '@features/educadores/retencion/components/TarjetaBloqueada';
import Segmented from '@features/savings/components/Segmented';
import { asignacionRepository } from '@features/dashboard/data/asignacionRepository';
import { comunicacionRepository } from '@features/dashboard/data/comunicacionRepository';
import {
  opcionesDeComentario,
  type MensajeBuzon,
  type OpcionComentario,
} from '@features/dashboard/data/comunicacion';
import type { MundoDeLaClase } from '@features/dashboard/data/fichaEstudiante';
import RedactarMensaje from '@features/dashboard/components/RedactarMensaje';
import { fechaHora } from '@features/dashboard/screens/ComunicacionClaseScreen';
import { Chip, Pill, Seccion, Tarjeta } from '@features/dashboard/components/profe/kit';

type Modo = 'mensaje' | 'retro';

const fechaCorta = (t: number) =>
  new Date(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

export default function MensajesFicha({
  colegioId,
  cursoId,
  uid,
  nombre,
  mundos,
}: {
  colegioId: string;
  cursoId: string;
  uid: string;
  nombre: string;
  mundos: MundoDeLaClase[];
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { puede, cargando: planCargando } = useMiPlan();
  const conMensajes = !planCargando && puede('mensajesProfe');
  const [modo, setModo] = useState<Modo>('retro');
  const [opciones, setOpciones] = useState<OpcionComentario[]>([]);
  const [elegida, setElegida] = useState<OpcionComentario | null>(null);
  const [historial, setHistorial] = useState<MensajeBuzon[]>([]);
  const primerNombre = nombre.trim().split(/\s+/)[0] || nombre;

  const cargarHistorial = useCallback(() => {
    void comunicacionRepository
      .buzon(colegioId, cursoId, uid)
      .then(setHistorial)
      .catch(() => setHistorial([]));
  }, [colegioId, cursoId, uid]);

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  useEffect(() => {
    let cancelado = false;
    void asignacionRepository
      .listByCurso(colegioId, cursoId)
      .catch(() => [])
      .then((tareas) => {
        if (!cancelado) setOpciones(opcionesDeComentario(mundos, tareas, uid));
      });
    return () => {
      cancelado = true;
    };
  }, [colegioId, cursoId, uid, mundos]);

  const modos = useMemo(
    () => [
      { key: 'retro' as const, label: t('ficha.mensajes.modoRetro') },
      { key: 'mensaje' as const, label: t('ficha.mensajes.modoMensaje') },
    ],
    [t]
  );

  return (
    <>
      <Seccion texto={t('ficha.mensajes.titulo')} />
      {!conMensajes && !planCargando ? (
        <TarjetaBloqueada
          titulo={t('ficha.mensajes.bloqueadoTitulo')}
          valor={t('ficha.mensajes.bloqueadoValor', { nombre: primerNombre })}
          motivo="mensajesProfe"
          icono="chatbubbles"
        />
      ) : null}
      {conMensajes ? (
        <Tarjeta style={st.tarjeta}>
          <Segmented options={modos} value={modo} onChange={setModo} />
          {modo === 'retro' ? (
            <>
              <Text style={[st.ayuda, { color: colors.text.secondary }]}>
                {t('ficha.mensajes.sobreQue')}
              </Text>
              <View style={st.chips}>
                {opciones.map((o) => (
                  <Chip
                    key={o.worldId}
                    texto={
                      o.deadline
                        ? t('ficha.mensajes.tarea', { nombre: o.nombre, fecha: fechaCorta(o.deadline) })
                        : o.nombre
                    }
                    icono={o.asignacionId ? 'flag' : 'planet'}
                    seleccionado={elegida?.worldId === o.worldId}
                    onPress={() => setElegida(o)}
                  />
                ))}
              </View>
            </>
          ) : null}
          <RedactarMensaje
            key={modo}
            colegioId={colegioId}
            cursoId={cursoId}
            tipo={modo}
            para={[uid]}
            contexto={
              modo === 'retro' && elegida
                ? {
                    worldId: elegida.worldId,
                    nombre: elegida.nombre,
                    ...(elegida.asignacionId ? { asignacionId: elegida.asignacionId } : null),
                  }
                : null
            }
            listo={modo === 'mensaje' || elegida !== null}
            placeholder={
              modo === 'retro'
                ? t('ficha.mensajes.placeholderRetro')
                : t('ficha.mensajes.placeholderMensaje')
            }
            textoBoton={t('ficha.mensajes.enviar', { nombre: primerNombre })}
            onEnviado={() => {
              setElegida(null);
              cargarHistorial();
            }}
          />
        </Tarjeta>
      ) : null}

      {historial.length > 0 ? (
        <Tarjeta style={{ gap: 0, paddingVertical: 4 }}>
          {historial.map((m, i) => (
            <View
              key={m.id}
              style={[
                st.fila,
                i > 0 && { borderTopWidth: 1, borderTopColor: colors.materials.border },
              ]}
            >
              <View style={st.cabeza}>
                <Text style={[st.quien, { color: colors.text.primary }]} numberOfLines={2}>
                  {m.tipo === 'retro'
                    ? m.contexto?.nombre
                      ? t('ficha.mensajes.comentarioSobre', { nombre: m.contexto.nombre })
                      : t('comunicacion.tipo.retro')
                    : t('comunicacion.tipo.mensaje')}
                </Text>
                <Pill
                  tono={m.leidoAt ? 'verde' : 'neutro'}
                  icono={m.leidoAt ? 'checkmark-done' : 'time-outline'}
                  texto={
                    m.leidoAt
                      ? t('ficha.mensajes.visto', { fecha: fechaCorta(m.leidoAt) })
                      : t('ficha.mensajes.sinVer')
                  }
                />
              </View>
              <Text style={[st.texto, { color: colors.text.primary }]}>{m.texto}</Text>
              <Text style={[st.mini, { color: colors.text.tertiary }]}>{fechaHora(m.creadoAt)}</Text>
            </View>
          ))}
        </Tarjeta>
      ) : null}
    </>
  );
}

const st = StyleSheet.create({
  tarjeta: { gap: 12 },
  ayuda: { fontSize: 14, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fila: { gap: 6, paddingVertical: 12 },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quien: { flex: 1, fontSize: 15, fontWeight: '800' },
  texto: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  mini: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
