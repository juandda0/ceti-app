/**
 * Fase 8c — biblioteca pública: mundos que comparten profes de todo el país.
 * Se busca por texto, grupo de grados y ámbito del MEN; cada mundo se copia a
 * una clase como borrador (Piloto o más) o se reporta. Con Comandante, Nave o
 * un plan de entidad, el profe publica sus mundos propios. Cadete la ve entera.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useMiPlan } from '@features/educadores/hooks/useMiPlan';
import { rutaPlanes } from '@features/educadores/retencion/components/TarjetaBloqueada';
import { rosterRepository, type CursoWithId } from '@features/dashboard/data/rosterRepository';
import { classConfigRepository } from '@features/dashboard/data/classConfigRepository';
import { competenciaLabel } from '@features/learning/data/competencias';
import {
  BotonChunky,
  Campo,
  Chip,
  Encabezado,
  Esqueleto,
  Pill,
  Seccion,
  Tarjeta,
  Vacio,
} from '@features/dashboard/components/profe/kit';
import {
  AMBITOS_MEN,
  GRUPOS_GRADO_MEN,
  filtrarBiblioteca,
  nombreAmbitoMen,
  type AmbitoMen,
  type GrupoGradoMen,
} from '@/functions/src/educadores/dominio';
import { bibliotecaPublicaRepository, type FichaConId } from '../data/bibliotecaPublicaRepository';

interface MundoMio {
  cursoId: string;
  curso: string;
  worldId: string;
  nombre: string;
}

export default function BibliotecaPublicaScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const uid = useAuthStore((s) => s.firebaseUid);
  const colegioId = useAuthStore((s) => s.colegioId);
  const { puede, cargando: planCargando } = useMiPlan();
  const puedePublicar = !planCargando && puede('bibliotecaPublicar');
  const puedeCopiar = !planCargando && puede('mundosPropios');

  const [fichas, setFichas] = useState<FichaConId[] | null>(null);
  const [clases, setClases] = useState<CursoWithId[]>([]);
  const [mios, setMios] = useState<MundoMio[]>([]);
  const [texto, setTexto] = useState('');
  const [grupo, setGrupo] = useState<GrupoGradoMen | null>(null);
  const [ambito, setAmbito] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [conInstitucion, setConInstitucion] = useState(true);
  const [error, setError] = useState(false);

  const cargar = useCallback(async () => {
    if (!uid || !colegioId) return;
    try {
      const [lista, cursos] = await Promise.all([
        bibliotecaPublicaRepository.listar(uid),
        rosterRepository.getCursosByProfesor(colegioId, uid),
      ]);
      const configs = await Promise.all(cursos.map((c) => classConfigRepository.get(colegioId, c.id).catch(() => null)));
      setFichas(lista);
      setClases(cursos);
      setMios(
        cursos.flatMap((c, i) =>
          (configs[i]?.mundos ?? [])
            .filter((m) => m.worldId.startsWith('cw_'))
            .map((m) => ({ cursoId: c.id, curso: c.nombre, worldId: m.worldId, nombre: m.nombre ?? m.worldId }))
        )
      );
      setError(false);
    } catch {
      setError(true);
      setFichas([]);
    }
  }, [uid, colegioId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const visibles = useMemo(() => filtrarBiblioteca(fichas ?? [], { texto, grupo, ambito }), [fichas, texto, grupo, ambito]);
  const enRevision = (fichas ?? []).filter((f) => f.oculto && f.autorUid === uid);
  const publicados = new Set((fichas ?? []).filter((f) => f.autorUid === uid).map((f) => `${f.origen.cursoId}_${f.origen.worldId}`));

  const accion = async (clave: string, f: () => Promise<unknown>, ok: string) => {
    setOcupado(clave);
    try {
      await f();
      showMessage(ok, undefined, 'success');
      await cargar();
    } catch (e) {
      showMessage(t('diferenciales.biblioteca.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setOcupado(null);
    }
  };

  const reportar = (f: FichaConId) =>
    confirmAction({
      title: t('diferenciales.biblioteca.reportarTitulo', { mundo: f.titulo }),
      body: t('diferenciales.biblioteca.reportarTexto'),
      confirmLabel: t('diferenciales.biblioteca.reportar'),
      cancelLabel: t('diferenciales.cancelar'),
      destructive: true,
      onConfirm: () => void accion(`rep:${f.id}`, () => bibliotecaPublicaRepository.reportar(f.id, ''), t('diferenciales.biblioteca.reportado')),
    });

  const tarjeta = (f: FichaConId) => (
    <Tarjeta key={f.id} style={{ gap: 8 }}>
      <View style={st.fila}>
        {f.grupoGrados ? <Pill tono="neutro" texto={t('diferenciales.biblioteca.grados', { grupo: f.grupoGrados })} /> : null}
        {(f.ambitosMen ?? []).slice(0, 2).map((a) => (
          <Pill key={a} tono="azul" texto={nombreAmbitoMen(a as AmbitoMen)} />
        ))}
        {!f.ambitosMen?.length && f.competencia ? <Pill tono="morado" texto={competenciaLabel(f.competencia)} /> : null}
        {f.oculto ? <Pill tono="rojo" texto={t('diferenciales.biblioteca.enRevision')} /> : null}
      </View>
      <Text style={[st.titulo, { color: colors.text.primary }]}>{f.titulo}</Text>
      {f.descripcion ? <Text style={[st.texto, { color: colors.text.secondary }]}>{f.descripcion}</Text> : null}
      <Text style={[st.sub, { color: colors.text.tertiary }]}>
        {[
          t('diferenciales.biblioteca.autor', { nombre: f.autorNombre }),
          f.institucion,
          f.lecciones > 0 ? t('entidad.biblioteca.lecciones', { count: f.lecciones }) : null,
          t('entidad.biblioteca.preguntas', { count: f.preguntas }),
          f.usos > 0 ? t('entidad.biblioteca.usos', { count: f.usos }) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {abierto === f.id ? (
        <View style={{ gap: 8 }}>
          <Text style={[st.sub, { color: colors.text.secondary }]}>{t('entidad.biblioteca.usarEn')}</Text>
          <View style={st.chips}>
            {clases.map((c) => (
              <Chip
                key={c.id}
                texto={ocupado === `${f.id}:${c.id}` ? t('entidad.guardando') : c.nombre}
                icono="copy-outline"
                seleccionado={false}
                onPress={() =>
                  void accion(`${f.id}:${c.id}`, () => bibliotecaPublicaRepository.usar(f.id, c.id), t('entidad.biblioteca.copiado', { clase: c.nombre }))
                }
              />
            ))}
          </View>
          <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('entidad.biblioteca.copiaAyuda')}</Text>
        </View>
      ) : (
        <View style={st.fila}>
          <BotonChunky
            texto={puedeCopiar ? t('diferenciales.biblioteca.copiar') : t('diferenciales.biblioteca.copiarPiloto')}
            icono={puedeCopiar ? 'download-outline' : 'lock-closed-outline'}
            variante="secundario"
            compacto
            onPress={() => (puedeCopiar ? setAbierto(f.id) : router.push(rutaPlanes('mundosPropios')))}
            style={{ flex: 1 }}
          />
          {f.autorUid === uid ? (
            <Chip
              texto={t('entidad.biblioteca.retirar')}
              icono="trash-outline"
              seleccionado={false}
              onPress={() => void accion(`r:${f.id}`, () => bibliotecaPublicaRepository.retirar(f.id), t('entidad.biblioteca.retirado'))}
            />
          ) : (
            <Chip texto={t('diferenciales.biblioteca.reportar')} icono="flag-outline" seleccionado={false} onPress={() => reportar(f)} />
          )}
        </View>
      )}
    </Tarjeta>
  );

  return (
    <ScreenWrapper>
      <ContextScrollView contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]} showsVerticalScrollIndicator={false}>
        <Encabezado
          atras="/(staff)/clases"
          sobretitulo={t('diferenciales.biblioteca.sobre')}
          titulo={t('diferenciales.biblioteca.titulo')}
          subtitulo={t('diferenciales.biblioteca.subtitulo')}
        />
        <Campo value={texto} onChangeText={setTexto} placeholder={t('diferenciales.biblioteca.buscar')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
          <Chip texto={t('diferenciales.biblioteca.todosLosGrados')} seleccionado={grupo === null} onPress={() => setGrupo(null)} />
          {GRUPOS_GRADO_MEN.map((g) => (
            <Chip key={g} texto={t('diferenciales.biblioteca.grados', { grupo: g })} seleccionado={grupo === g} onPress={() => setGrupo(grupo === g ? null : g)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
          <Chip texto={t('diferenciales.biblioteca.todosLosAmbitos')} seleccionado={ambito === null} onPress={() => setAmbito(null)} />
          {AMBITOS_MEN.map((a) => (
            <Chip key={a.id} texto={a.nombre} seleccionado={ambito === a.id} onPress={() => setAmbito(ambito === a.id ? null : a.id)} />
          ))}
        </ScrollView>

        {fichas === null ? <Esqueleto filas={3} alto={110} /> : null}
        {error ? <Vacio icono="cloud-offline-outline" tono="rojo" titulo={t('profe.errorTitulo')} texto={t('diferenciales.biblioteca.error')} /> : null}
        {fichas && !error && visibles.length === 0 ? (
          <Vacio icono="library-outline" titulo={t('diferenciales.biblioteca.vacio')} texto={t('diferenciales.biblioteca.vacioTexto')} />
        ) : null}
        {visibles.map(tarjeta)}
        {enRevision.map(tarjeta)}

        <Seccion texto={t('diferenciales.biblioteca.publicar')} />
        {!puedePublicar ? (
          <Tarjeta style={{ gap: 8 }}>
            <Text style={[st.texto, { color: colors.text.secondary }]}>{t('diferenciales.biblioteca.publicarPlan')}</Text>
            <BotonChunky texto={t('diferenciales.biblioteca.verPlanes')} icono="rocket-outline" variante="secundario" compacto onPress={() => router.push(rutaPlanes('bibliotecaPublicar'))} />
          </Tarjeta>
        ) : mios.length === 0 ? (
          <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('entidad.biblioteca.sinMios')}</Text>
        ) : (
          <Tarjeta style={{ gap: 8 }}>
            <View style={st.fila}>
              <Text style={[st.texto, { color: colors.text.primary, flex: 1 }]}>{t('diferenciales.biblioteca.mostrarInstitucion')}</Text>
              <Switch value={conInstitucion} onValueChange={setConInstitucion} trackColor={{ true: colors.brand.primary, false: colors.materials.border }} thumbColor="#FFFFFF" />
            </View>
            {mios.map((m) => {
              const clave = `${m.cursoId}_${m.worldId}`;
              return (
                <View key={clave} style={[st.fila, { paddingVertical: 4 }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[st.nombre, { color: colors.text.primary }]} numberOfLines={1}>{m.nombre}</Text>
                    <Text style={[st.sub, { color: colors.text.tertiary }]}>{m.curso}</Text>
                  </View>
                  <Chip
                    texto={ocupado === clave ? t('entidad.guardando') : publicados.has(clave) ? t('entidad.biblioteca.actualizar') : t('diferenciales.biblioteca.publicarUno')}
                    icono="globe-outline"
                    seleccionado={publicados.has(clave)}
                    onPress={() =>
                      void accion(clave, () => bibliotecaPublicaRepository.publicar(m.cursoId, m.worldId, conInstitucion), t('entidad.biblioteca.publicado', { mundo: m.nombre }))
                    }
                  />
                </View>
              );
            })}
            <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('diferenciales.biblioteca.publicarNota')}</Text>
          </Tarjeta>
        )}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 80, gap: 14 },
  fila: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  chips: { flexDirection: 'row', gap: 8 },
  titulo: { fontSize: 18, lineHeight: 23, fontWeight: '900' },
  texto: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  nombre: { fontSize: 15, fontWeight: '800' },
  sub: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
