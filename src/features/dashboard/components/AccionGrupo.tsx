/**
 * "Los que…" (Fase 3): actuar sobre un grupo de estudiantes de una vez:
 * asignarles un mundo a cada uno (tarea individual de una semana), escribirles
 * un mensaje (Fase 5, plan Piloto; no pueden responder) y copiar sus nombres.
 */
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { asignacionRepository } from '@features/dashboard/data/asignacionRepository';
import type { MundoDeLaClase } from '@features/dashboard/data/fichaEstudiante';
import { BotonChunky, Chip, Tarjeta } from '@features/dashboard/components/profe/kit';
import RedactarMensaje from '@features/dashboard/components/RedactarMensaje';

const DIA_MS = 24 * 60 * 60 * 1000;

export default function AccionGrupo({
  colegioId,
  cursoId,
  titulo,
  estudiantes,
  mundos,
  mundoSugerido,
}: {
  colegioId: string;
  cursoId: string;
  titulo: string;
  estudiantes: { uid: string; nombre: string }[];
  mundos: MundoDeLaClase[];
  mundoSugerido?: string;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const profeUid = useAuthStore((s) => s.firebaseUid);
  const [abierto, setAbierto] = useState<'asignar' | 'escribir' | null>(null);
  const [mundo, setMundo] = useState<string | null>(mundoSugerido ?? null);
  const [ocupado, setOcupado] = useState(false);

  if (estudiantes.length === 0) return null;

  const asignar = async () => {
    if (!mundo || !profeUid) return;
    setOcupado(true);
    try {
      const ahora = Date.now();
      await Promise.all(
        estudiantes.map((e) =>
          asignacionRepository.create(colegioId, {
            worldId: mundo,
            target: { tipo: 'estudiante', cursoId, uid: e.uid },
            fechaInicio: ahora,
            deadline: ahora + 7 * DIA_MS,
            createdByUid: profeUid,
            createdAt: ahora,
          })
        )
      );
      showMessage(t('analisis.grupoAsignado', { count: estudiantes.length }), undefined, 'success');
      setAbierto(null);
    } catch (e) {
      showMessage(t('admin.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setOcupado(false);
    }
  };

  const copiar = () => {
    const texto = estudiantes.map((e) => e.nombre).join('\n');
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (Platform.OS === 'web' && nav?.clipboard) {
      void nav.clipboard.writeText(texto).then(
        () => showMessage(t('analisis.nombresCopiados'), undefined, 'success'),
        () => undefined
      );
    }
  };

  return (
    <Tarjeta style={st.tarjeta}>
      <Text style={[st.titulo, { color: colors.text.primary }]}>
        {titulo} ({estudiantes.length})
      </Text>
      <Text
        style={[st.nombres, { color: colors.text.secondary }]}
        numberOfLines={abierto ? undefined : 2}
      >
        {estudiantes.map((e) => e.nombre).join(' · ')}
      </Text>
      {abierto === 'escribir' ? (
        <>
          <RedactarMensaje
            colegioId={colegioId}
            cursoId={cursoId}
            tipo="mensaje"
            para={estudiantes.map((e) => e.uid)}
            placeholder={t('comunicacion.grupoPlaceholder')}
            textoBoton={t('comunicacion.grupoEnviar', { count: estudiantes.length })}
            onEnviado={() => setAbierto(null)}
          />
          <BotonChunky
            texto={t('admin.cancel')}
            variante="secundario"
            compacto
            onPress={() => setAbierto(null)}
          />
        </>
      ) : abierto === 'asignar' ? (
        <>
          <Text style={[st.ayuda, { color: colors.text.secondary }]}>
            {t('analisis.grupoAyuda')}
          </Text>
          <View style={st.chips}>
            {mundos.map((m) => (
              <Chip
                key={m.id}
                texto={m.nombre}
                icono="planet"
                seleccionado={mundo === m.id}
                onPress={() => setMundo(m.id)}
              />
            ))}
          </View>
          <BotonChunky
            texto={t('analisis.grupoAsignar', { count: estudiantes.length })}
            icono="paper-plane"
            cargando={ocupado}
            deshabilitado={!mundo}
            onPress={() => void asignar()}
          />
        </>
      ) : (
        <View style={st.botones}>
          <BotonChunky
            texto={t('analisis.grupoAccion')}
            icono="flag"
            variante="secundario"
            compacto
            onPress={() => setAbierto('asignar')}
          />
          <BotonChunky
            texto={t('comunicacion.grupoAccion')}
            icono="chatbubble-ellipses"
            variante="secundario"
            compacto
            onPress={() => setAbierto('escribir')}
          />
          {Platform.OS === 'web' ? (
            <BotonChunky
              texto={t('analisis.copiarNombres')}
              icono="copy-outline"
              variante="secundario"
              compacto
              onPress={copiar}
            />
          ) : null}
        </View>
      )}
    </Tarjeta>
  );
}

const st = StyleSheet.create({
  tarjeta: { gap: 10 },
  titulo: { fontSize: 16, fontWeight: '900' },
  nombres: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  ayuda: { fontSize: 14, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  botones: { gap: 8 },
});
