/**
 * Comunicación de la clase (Fase 5). El profe publica anuncios para toda la
 * clase y ve lo que mandó: anuncios (con cuántos los vieron), mensajes a grupos
 * y comentarios. Los estudiantes no pueden responder (son menores). Los anuncios
 * son de todos los planes; los mensajes y comentarios, de Piloto. En Alertas
 * elige qué avisos de la clase le llegan.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { FadeIn } from '@features/savings/charts/ChartParts';
import Segmented from '@features/savings/components/Segmented';
import { useNombreCurso } from '@features/dashboard/hooks/useNombreCurso';
import RedactarMensaje from '@features/dashboard/components/RedactarMensaje';
import AjustesAlertas from '@features/dashboard/components/AjustesAlertas';
import { comunicacionRepository } from '@features/dashboard/data/comunicacionRepository';
import { resumenDestinatarios, type Comunicado } from '@features/dashboard/data/comunicacion';
import {
  Aviso,
  BotonChunky,
  Encabezado,
  Esqueleto,
  Pill,
  Seccion,
  Tarjeta,
  Vacio,
  tapsConTeclado,
  type Tono,
} from '@features/dashboard/components/profe/kit';

type Vista = 'anuncios' | 'alertas';
const VISTAS: readonly Vista[] = ['anuncios', 'alertas'];

const TONO_TIPO: Record<Comunicado['tipo'], Tono> = {
  anuncio: 'azul',
  mensaje: 'naranja',
  retro: 'verde',
};

export function fechaHora(ms: number): string {
  return new Date(ms).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ComunicacionClaseScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const colegioId = useAuthStore((s) => s.colegioId);
  const params = useLocalSearchParams<{ cursoId: string; nombre?: string; vista?: string }>();
  const cursoId = params.cursoId;
  const cursoNombre = useNombreCurso(cursoId, params.nombre);
  const [vista, setVista] = useState<Vista>(
    VISTAS.includes(params.vista as Vista) ? (params.vista as Vista) : 'anuncios'
  );

  const [enviados, setEnviados] = useState<Comunicado[]>([]);
  const [vistos, setVistos] = useState<Record<string, number>>({});
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');

  const cargar = useCallback(async () => {
    if (!colegioId || !cursoId) return;
    try {
      const lista = await comunicacionRepository.enviados(colegioId, cursoId);
      setEnviados(lista);
      setEstado('listo');
      const anuncios = lista.filter((c) => c.tipo === 'anuncio').slice(0, 10);
      const cuentas = await Promise.all(
        anuncios.map((a) =>
          comunicacionRepository.vistosDeAnuncio(colegioId, cursoId, a.id).catch(() => 0)
        )
      );
      setVistos(Object.fromEntries(anuncios.map((a, i) => [a.id, cuentas[i]])));
    } catch {
      setEstado('error');
    }
  }, [colegioId, cursoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const borrar = (c: Comunicado) =>
    confirmAction({
      title: t('comunicacion.borrarTitulo'),
      body: t('comunicacion.borrarTexto'),
      cancelLabel: t('admin.cancel'),
      confirmLabel: t('comunicacion.borrar'),
      destructive: true,
      onConfirm: () => {
        if (!colegioId || !cursoId) return;
        void comunicacionRepository
          .borrarAnuncio(colegioId, cursoId, c.id)
          .then(() => {
            setEnviados((l) => l.filter((x) => x.id !== c.id));
            showMessage(t('comunicacion.borrado'), undefined, 'success');
          })
          .catch((e) =>
            showMessage(t('admin.error'), e instanceof Error ? e.message : String(e), 'error')
          );
      },
    });

  const vistas = [
    { key: 'anuncios' as const, label: t('comunicacion.vistaAnuncios') },
    { key: 'alertas' as const, label: t('comunicacion.vistaAlertas') },
  ];

  const anuncios =
    colegioId && cursoId ? (
      <View style={st.vista}>
        <Tarjeta style={st.tarjeta}>
          <Text style={[st.titulo, { color: colors.text.primary }]}>
            {t('comunicacion.nuevoAnuncio')}
          </Text>
          <RedactarMensaje
            colegioId={colegioId}
            cursoId={cursoId}
            tipo="anuncio"
            placeholder={t('comunicacion.anuncioPlaceholder')}
            textoBoton={t('comunicacion.publicar')}
            onEnviado={() => void cargar()}
          />
        </Tarjeta>
        <Aviso icono="lock-closed" tono="azul" texto={t('comunicacion.soloIda')} />

        <Seccion texto={t('comunicacion.enviados')} />
        {estado === 'cargando' ? <Esqueleto filas={2} alto={72} /> : null}
        {estado === 'error' ? (
          <Vacio
            icono="cloud-offline-outline"
            tono="rojo"
            titulo={t('profe.errorTitulo')}
            texto={t('comunicacion.error')}
          />
        ) : null}
        {estado === 'listo' && enviados.length === 0 ? (
          <Vacio
            icono="megaphone-outline"
            titulo={t('comunicacion.sinEnviadosTitulo')}
            texto={t('comunicacion.sinEnviados')}
          />
        ) : null}
        {estado === 'listo' && enviados.length > 0 ? (
          <Tarjeta style={{ gap: 0, paddingVertical: 4 }}>
            {enviados.map((c, i) => (
              <View
                key={c.id}
                style={[
                  st.fila,
                  i > 0 && { borderTopWidth: 1, borderTopColor: colors.materials.border },
                ]}
              >
                <View style={st.cabeza}>
                  <Text style={[st.quien, { color: colors.text.primary }]} numberOfLines={1}>
                    {c.tipo === 'anuncio'
                      ? t('comunicacion.aTodaLaClase')
                      : resumenDestinatarios(c.nombres ?? [])}
                  </Text>
                  <Pill tono={TONO_TIPO[c.tipo]} texto={t(`comunicacion.tipo.${c.tipo}`)} />
                </View>
                {c.contexto?.nombre ? (
                  <Text style={[st.mini, { color: colors.text.secondary }]}>
                    {t('comunicacion.sobre', { nombre: c.contexto.nombre })}
                  </Text>
                ) : null}
                <Text style={[st.texto, { color: colors.text.primary }]}>{c.texto}</Text>
                <View style={st.cabeza}>
                  <Text style={[st.mini, { flex: 1, color: colors.text.tertiary }]}>
                    {fechaHora(c.creadoAt)}
                    {c.tipo === 'anuncio' && vistos[c.id] != null
                      ? ` · ${t('comunicacion.vieron', { count: vistos[c.id], total: c.destinatarios ?? 0 })}`
                      : ''}
                  </Text>
                  {c.tipo === 'anuncio' ? (
                    <BotonChunky
                      texto={t('comunicacion.borrar')}
                      icono="trash-outline"
                      variante="secundario"
                      compacto
                      onPress={() => borrar(c)}
                    />
                  ) : null}
                </View>
              </View>
            ))}
          </Tarjeta>
        ) : null}
      </View>
    ) : null;

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps={tapsConTeclado}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado
          atras={`/(staff)/curso/${cursoId}`}
          sobretitulo={cursoNombre}
          titulo={t('comunicacion.titulo')}
          subtitulo={t('comunicacion.subtitulo')}
        />
        {vistas.length > 1 ? <Segmented options={vistas} value={vista} onChange={setVista} /> : null}
        <FadeIn key={vista}>
          {vista === 'anuncios' ? anuncios : null}
          {vista === 'alertas' && colegioId && cursoId ? (
            <AjustesAlertas colegioId={colegioId} cursoId={cursoId} />
          ) : null}
        </FadeIn>
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 80, gap: 14 },
  vista: { gap: 14 },
  tarjeta: { gap: 12 },
  titulo: { fontSize: 16, fontWeight: '900' },
  fila: { gap: 6, paddingVertical: 12 },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quien: { flex: 1, fontSize: 15, fontWeight: '800' },
  texto: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  mini: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
