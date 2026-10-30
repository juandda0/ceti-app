/**
 * Fase 8a — clase en vivo, lado del estudiante (en el espacio de su clase).
 * Escucha la sesión, marca que entró, responde una vez cada pregunta y ve si
 * acertó, sus puntos y su puesto. Sin vidas ni XP: es la clase, no el juego.
 * Aplican sus adaptaciones: más tiempo, menos opciones, voz y letra grande.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import Bounceable from '@shared/components/Bounceable';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { GrowBar } from '@features/savings/charts/ChartParts';
import { Encabezado, Esqueleto, Pill, Tarjeta, Vacio } from '@features/dashboard/components/profe/kit';
import {
  FACTOR_MAS_TIEMPO,
  rankingVivo,
  type GrupoClase,
  type SesionVivo,
} from '@/functions/src/educadores/dominio';
import { useMisAdaptaciones } from '../../adaptaciones/hooks/useMisAdaptaciones';
import BotonEscuchar from '../../adaptaciones/components/BotonEscuchar';
import { textoPregunta } from '../../adaptaciones/data/voz';
import { vivoRepository } from '../data/vivoRepository';
import { COLORES_OPCION, LETRAS } from '../components/opciones';
import { useGrupoMio } from '../hooks/useGrupoMio';

export default function ClaseVivoEstudianteScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const uid = useAuthStore((s) => s.firebaseUid);
  const adapt = useMisAdaptaciones();
  const grupo: GrupoClase | null = useGrupoMio();

  const [sesion, setSesion] = useState<SesionVivo | null | undefined>(undefined);
  const [mias, setMias] = useState<Record<number, number>>({});
  const [enviando, setEnviando] = useState(false);
  const [ahora, setAhora] = useState(Date.now());

  useEffect(() => {
    if (!colegioId || !cursoId) return setSesion(null);
    return vivoRepository.escuchar(colegioId, cursoId, setSesion, () => setSesion(null));
  }, [colegioId, cursoId]);

  // Marca que entró, una vez por sesión.
  const entro = useRef<string | null>(null);
  useEffect(() => {
    if (!sesion || sesion.estado === 'terminada' || !colegioId || !cursoId || !uid || entro.current === sesion.id) return;
    entro.current = sesion.id;
    setMias({});
    void vivoRepository.entrar(colegioId, cursoId, uid, sesion.id).catch(() => {
      entro.current = null;
    });
  }, [sesion, colegioId, cursoId, uid]);

  useEffect(() => {
    if (sesion?.estado !== 'pregunta') return;
    const id = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(id);
  }, [sesion?.estado]);

  const p = sesion?.estado === 'pregunta' ? sesion.pregunta : null;
  const factor = adapt.masTiempo ? FACTOR_MAS_TIEMPO : 1;
  const limite = p ? p.segundos * 1000 * factor : 0;
  const restante = p ? Math.max(0, p.abiertaAt + limite - ahora) : 0;
  const yaRespondi = p ? mias[p.n] !== undefined : false;

  const responder = async (r: number) => {
    if (!p || !sesion || !colegioId || !cursoId || !uid || yaRespondi || enviando || restante <= 0) return;
    setEnviando(true);
    setMias((m) => ({ ...m, [p.n]: r }));
    try {
      await vivoRepository.responder(colegioId, cursoId, uid, sesion.id, p.n, r);
    } catch (e) {
      setMias((m) => {
        const { [p.n]: _quitar, ...resto } = m;
        return resto;
      });
      showMessage(t('diferenciales.vivo.errorResponder'), e instanceof Error ? e.message : undefined, 'error');
    } finally {
      setEnviando(false);
    }
  };

  const ranking = useMemo(() => rankingVivo(sesion?.puntajes ?? {}), [sesion?.puntajes]);
  const yo = ranking.find((r) => r.uid === uid);
  const grande = adapt.letraGrande;

  const opcionesVisibles = p
    ? p.opciones.map((o, i) => ({ o, i })).filter(({ i }) => !(adapt.menosOpciones && p.sinUna === i))
    : [];

  return (
    <ScreenWrapper>
      <ContextScrollView contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]} showsVerticalScrollIndicator={false}>
        <Encabezado
          atras="/(app)/saga"
          sobretitulo={t('diferenciales.vivo.sobre')}
          titulo={sesion?.titulo || t('diferenciales.vivo.titulo')}
          derecha={grupo ? <Pill texto={grupo.nombre} tono="azul" icono="people" /> : null}
        />

        {sesion === undefined ? <Esqueleto filas={3} alto={64} /> : null}
        {sesion === null ? (
          <Vacio icono="radio-outline" tono="neutro" titulo={t('diferenciales.vivo.noHayTitulo')} texto={t('diferenciales.vivo.noHayTexto')} />
        ) : null}

        {sesion?.estado === 'lobby' ? (
          <Vacio icono="hourglass-outline" titulo={t('diferenciales.vivo.esperaTitulo')} texto={t('diferenciales.vivo.esperaTexto')} />
        ) : null}

        {p ? (
          <>
            <View style={st.fila}>
              <Text style={[st.meta, { color: colors.text.secondary }]}>
                {t('diferenciales.vivo.progreso', { n: p.n + 1, total: sesion?.total ?? 0 })}
              </Text>
              <Text style={[st.meta, { color: colors.text.secondary }]}>{`${Math.ceil(restante / 1000)} s`}</Text>
            </View>
            <GrowBar pct={limite ? (restante / limite) * 100 : 0} color={colors.brand.primary} trackColor={colors.materials.highlight} height={10} />
            {adapt.masTiempo ? (
              <Text style={[st.nota, { color: colors.text.tertiary }]}>{t('diferenciales.vivo.masTiempo')}</Text>
            ) : null}
            <Text style={[st.enunciado, grande && st.enunciadoGrande, { color: colors.text.primary }]}>{p.enunciado}</Text>
            {adapt.leerEnVozAlta ? (
              <BotonEscuchar texto={textoPregunta(p.enunciado, opcionesVisibles.map((x) => x.o), opcionesVisibles.map((x) => LETRAS[x.i]).join(''))} />
            ) : null}
            {yaRespondi ? (
              <Tarjeta style={{ alignItems: 'center', gap: 6 }}>
                <Text style={[st.listo, { color: colors.text.primary }]}>{t('diferenciales.vivo.enviada')}</Text>
                <Text style={[st.nota, { color: colors.text.tertiary }]}>{t('diferenciales.vivo.esperaRevelar')}</Text>
              </Tarjeta>
            ) : restante <= 0 ? (
              <Tarjeta style={{ alignItems: 'center' }}>
                <Text style={[st.listo, { color: colors.text.primary }]}>{t('diferenciales.vivo.tiempo0')}</Text>
              </Tarjeta>
            ) : (
              <View style={{ gap: 10 }} accessibilityRole="radiogroup">
                {opcionesVisibles.map(({ o, i }) => (
                  <Bounceable
                    key={`${p.n}-${i}`}
                    onPress={() => void responder(i)}
                    activeScale={0.97}
                    accessibilityRole="radio"
                    accessibilityLabel={`${LETRAS[i]}: ${o}`}
                    style={[st.opcion, { backgroundColor: COLORES_OPCION[i % COLORES_OPCION.length] }]}
                  >
                    <Text style={[st.opcionTxt, grande && st.opcionGrande]}>{`${LETRAS[i]} · ${o}`}</Text>
                  </Bounceable>
                ))}
              </View>
            )}
          </>
        ) : null}

        {sesion?.estado === 'revelada' && sesion.revelada ? (
          <Resultado
            mia={mias[sesion.revelada.n]}
            correcta={sesion.revelada.correcta}
            puntos={sesion.puntajes[uid ?? '']?.ultimo ?? null}
            puesto={yo?.puesto ?? null}
            total={ranking.length}
            acumulado={yo?.puntos ?? 0}
            explicacion={sesion.revelada.explicacion}
          />
        ) : null}

        {sesion?.estado === 'terminada' ? (
          <Tarjeta style={{ alignItems: 'center', gap: 6 }}>
            <Text style={[st.puesto, { color: colors.brand.primary }]}>{yo ? `${yo.puesto}°` : '—'}</Text>
            <Text style={[st.listo, { color: colors.text.primary }]}>
              {yo ? t('diferenciales.vivo.finYo', { puntos: yo.puntos.toLocaleString('es-CO'), total: ranking.length }) : t('diferenciales.vivo.finSinMi')}
            </Text>
            {grupo && sesion.grupos.length ? (
              <Text style={[st.nota, { color: colors.text.tertiary }]}>
                {t('diferenciales.vivo.finGrupo', {
                  grupo: grupo.nombre,
                  puesto: sesion.grupos.findIndex((g) => g.id === grupo.id) + 1,
                })}
              </Text>
            ) : null}
          </Tarjeta>
        ) : null}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

function Resultado({
  mia,
  correcta,
  puntos,
  puesto,
  total,
  acumulado,
  explicacion,
}: {
  mia: number | undefined;
  correcta: number;
  puntos: number | null;
  puesto: number | null;
  total: number;
  acumulado: number;
  explicacion: string | null;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const acerto = mia === correcta;
  const sinResponder = mia === undefined;
  const fondo = sinResponder ? colors.materials.highlight : acerto ? colors.fill.greenSubtle : colors.fill.redSubtle;
  const tinta = sinResponder ? colors.text.secondary : acerto ? colors.system.green : colors.system.red;
  return (
    <View style={{ gap: 12 }}>
      <View style={[st.resultado, { backgroundColor: fondo }]}>
        <Text style={[st.resultadoTitulo, { color: tinta }]}>
          {sinResponder ? t('diferenciales.vivo.sinResponder') : acerto ? t('diferenciales.vivo.bien') : t('diferenciales.vivo.mal')}
        </Text>
        {!sinResponder ? <Text style={[st.listo, { color: tinta }]}>{t('diferenciales.vivo.puntos', { count: puntos ?? 0 })}</Text> : null}
        {!acerto ? <Text style={[st.nota, { color: colors.text.secondary }]}>{t('diferenciales.vivo.eraLa', { letra: LETRAS[correcta] })}</Text> : null}
      </View>
      {puesto ? (
        <Tarjeta style={{ alignItems: 'center', gap: 2 }}>
          <Text style={[st.puesto, { color: colors.text.primary }]}>{`${puesto}°`}</Text>
          <Text style={[st.nota, { color: colors.text.tertiary }]}>
            {t('diferenciales.vivo.vas', { total, puntos: acumulado.toLocaleString('es-CO') })}
          </Text>
        </Tarjeta>
      ) : null}
      {explicacion ? <Text style={[st.nota, { color: colors.text.secondary }]}>{explicacion}</Text> : null}
      <Text style={[st.nota, { color: colors.text.tertiary, textAlign: 'center' }]}>{t('diferenciales.vivo.esperaSiguiente')}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 14 },
  fila: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { fontSize: 14, fontWeight: '900' },
  nota: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  enunciado: { fontSize: 22, lineHeight: 28, fontWeight: '900' },
  enunciadoGrande: { fontSize: 28, lineHeight: 36 },
  opcion: { borderRadius: 18, padding: 16, borderBottomWidth: 5, borderBottomColor: '#00000033' },
  opcionTxt: { color: '#fff', fontSize: 17, lineHeight: 23, fontWeight: '800' },
  opcionGrande: { fontSize: 21, lineHeight: 28 },
  listo: { fontSize: 17, fontWeight: '900', textAlign: 'center' },
  resultado: { borderRadius: 20, padding: 18, alignItems: 'center', gap: 4 },
  resultadoTitulo: { fontSize: 26, fontWeight: '900' },
  puesto: { fontSize: 44, fontWeight: '900' },
});
