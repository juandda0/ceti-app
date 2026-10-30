/**
 * Resumen semanal para el acudiente (Fase 5), en `/acudiente/{token}`: sin
 * cuenta y sin notas. Muestra cuánto entró y practicó el estudiante en su clase
 * esta semana, su constancia de las últimas semanas y cómo va en cada mundo. Con
 * `?baja=1` (enlace del correo) ofrece dejar de recibir el correo.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { FadeIn } from '@features/savings/charts/ChartParts';
import type { EstadoMundoAcudiente, ResumenAcudiente } from '@/functions/src/educadores/dominio';
import { acudienteRepository } from '@features/dashboard/data/acudienteRepository';
import {
  Aviso,
  BotonChunky,
  Cifra,
  Esqueleto,
  Pill,
  Seccion,
  Tarjeta,
  Vacio,
  paletaTono,
  type Tono,
} from '@features/dashboard/components/profe/kit';

const TONO_MUNDO: Record<EstadoMundoAcudiente, Tono> = {
  conquistado: 'verde',
  en_curso: 'naranja',
  sin_empezar: 'neutro',
};

/** '2027-01-13' → '13 ene'. */
function diaCorto(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d, 12)).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export default function ResumenAcudienteScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { token, baja } = useLocalSearchParams<{ token: string; baja?: string }>();
  const [resumen, setResumen] = useState<ResumenAcudiente | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [bajaHecha, setBajaHecha] = useState(false);
  const [dandoBaja, setDandoBaja] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelado = false;
    void acudienteRepository
      .ver(token)
      .then((r) => {
        if (cancelado) return;
        setResumen(r);
        setEstado('listo');
      })
      .catch(() => {
        if (!cancelado) setEstado('error');
      });
    return () => {
      cancelado = true;
    };
  }, [token]);

  const darDeBaja = async () => {
    if (!token) return;
    setDandoBaja(true);
    try {
      await acudienteRepository.baja(token);
      setBajaHecha(true);
    } catch {
      setBajaHecha(false);
    } finally {
      setDandoBaja(false);
    }
  };

  const tarjetaBaja = bajaHecha ? (
    <Aviso icono="checkmark-circle" tono="verde" texto={t('acudientes.publico.bajaHecha')} />
  ) : (
    <Tarjeta style={st.tarjeta}>
      <Text style={[st.texto, { color: colors.text.secondary }]}>
        {t('acudientes.publico.bajaTexto')}
      </Text>
      <BotonChunky
        texto={t('acudientes.publico.baja')}
        icono="mail-unread-outline"
        variante="secundario"
        compacto
        cargando={dandoBaja}
        onPress={() => void darDeBaja()}
      />
    </Tarjeta>
  );

  const r = resumen;
  const maxDias = 7;
  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[st.page, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[st.marca, { color: colors.brand.primary }]}>{t('acudientes.publico.marca')}</Text>

        {estado === 'cargando' ? <Esqueleto filas={3} alto={96} /> : null}
        {estado === 'error' ? (
          <Vacio
            icono="link-outline"
            tono="naranja"
            titulo={t('acudientes.publico.errorTitulo')}
            texto={t('acudientes.publico.error')}
          />
        ) : null}

        {estado === 'listo' && r ? (
          <FadeIn>
            <View style={st.vista}>
              <View style={st.cabeza}>
                <Text style={[st.titulo, { color: colors.text.primary }]}>
                  {t('acudientes.publico.titulo', { nombre: r.nombre })}
                </Text>
                <Text style={[st.sub, { color: colors.text.secondary }]}>
                  {r.profe
                    ? t('acudientes.publico.claseConProfe', { clase: r.clase, profe: r.profe })
                    : r.clase}
                  {' · '}
                  {t('acudientes.publico.semana', {
                    desde: diaCorto(r.semana.desde),
                    hasta: diaCorto(r.semana.hasta),
                  })}
                </Text>
              </View>

              {baja === '1' ? tarjetaBaja : null}

              <View style={st.cifras}>
                <View style={st.cifra}>
                  <Cifra
                    icono="calendar"
                    valor={`${r.semana.diasActivos} de 7`}
                    etiqueta={t('acudientes.publico.dias')}
                    tono={r.semana.diasActivos >= 3 ? 'verde' : r.semana.diasActivos > 0 ? 'naranja' : 'neutro'}
                  />
                </View>
                <View style={st.cifra}>
                  <Cifra
                    icono="time"
                    valor={String(r.semana.minutos)}
                    etiqueta={t('acudientes.publico.minutos')}
                    tono="azul"
                  />
                </View>
                <View style={st.cifra}>
                  <Cifra
                    icono="book"
                    valor={String(r.semana.lecciones)}
                    etiqueta={t('acudientes.publico.lecciones')}
                    tono="morado"
                  />
                </View>
                <View style={st.cifra}>
                  <Cifra
                    icono="planet"
                    valor={`${r.conquistados} de ${r.mundos.length}`}
                    etiqueta={t('acudientes.publico.mundos')}
                    tono="naranja"
                  />
                </View>
              </View>

              <Seccion texto={t('acudientes.publico.constancia')} />
              <Tarjeta style={st.tarjeta}>
                <View style={st.columnas} accessibilityLabel={t('acudientes.publico.constanciaA11y')}>
                  {r.constancia.map((c, i) => {
                    const actual = i === r.constancia.length - 1;
                    return (
                      <View key={c.desde} style={st.columna}>
                        <Text style={[st.columnaValor, { color: colors.text.secondary }]}>{c.dias}</Text>
                        <View style={[st.pista, { backgroundColor: colors.materials.highlight }]}>
                          <View
                            style={{
                              height: `${(c.dias / maxDias) * 100}%`,
                              borderRadius: 8,
                              backgroundColor: paletaTono(colors, actual ? 'naranja' : 'azul').tinta,
                            }}
                          />
                        </View>
                        <Text style={[st.columnaFecha, { color: colors.text.tertiary }]}>
                          {actual ? t('acudientes.publico.estaSemana') : diaCorto(c.desde)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={[st.mini, { color: colors.text.tertiary }]}>
                  {t('acudientes.publico.constanciaAyuda')}
                </Text>
              </Tarjeta>

              <Seccion texto={t('acudientes.publico.mundosTitulo')} />
              <Tarjeta style={{ gap: 0, paddingVertical: 4 }}>
                {r.mundos.map((m, i) => (
                  <View
                    key={`${m.nombre}-${i}`}
                    style={[
                      st.mundo,
                      i > 0 && { borderTopWidth: 1, borderTopColor: colors.materials.border },
                    ]}
                  >
                    <Text style={[st.mundoNombre, { color: colors.text.primary }]} numberOfLines={1}>
                      {m.nombre}
                    </Text>
                    <Pill tono={TONO_MUNDO[m.estado]} texto={t(`acudientes.publico.estado.${m.estado}`)} />
                  </View>
                ))}
              </Tarjeta>

              <Aviso icono="information-circle" tono="azul" texto={t('acudientes.publico.sinNotas')} />
              {baja !== '1' ? tarjetaBaja : null}
              <Text style={[st.mini, { color: colors.text.tertiary }]}>
                {t('acudientes.publico.privacidad')}
              </Text>
            </View>
          </FadeIn>
        ) : null}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 16, maxWidth: 640, width: '100%', alignSelf: 'center' },
  vista: { gap: 14 },
  marca: { fontSize: 13, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  cabeza: { gap: 6 },
  titulo: { fontSize: 32, lineHeight: 36, fontWeight: '900', letterSpacing: -0.5 },
  sub: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
  cifras: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cifra: { flexBasis: '47%', flexGrow: 1 },
  tarjeta: { gap: 12 },
  texto: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  mini: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  columnas: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, height: 140 },
  columna: { flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' },
  columnaValor: { fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  pista: { width: '60%', flex: 1, borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  columnaFecha: { fontSize: 11, fontWeight: '700' },
  mundo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  mundoNombre: { flex: 1, fontSize: 15, fontWeight: '800' },
});
