/**
 * Tarjeta del mundo activo bajo el carrusel de Tu Galaxia y su ficha (hoja que sube al tocar el
 * planeta). El estado del mundo decide la etiqueta y el botón: empezar, continuar, repasar o bloqueado.
 */
import { Modal, Pressable, StyleSheet, Text, View, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CetiAnimation } from '@features/animations';
import type { WorldStatus } from '@features/learning/data/worldStatus';
import type { Planeta } from '@features/learning/data/planetas';
import { ESPACIO } from './espacio';

export interface MundoGalaxia {
  id: string;
  numero: number;
  nombre: string;
  descripcion: string;
  planeta: Planeta;
  estado: WorldStatus;
  /** Preguntas logradas y total del mundo. */
  hechas: number;
  total: number;
  /** Mundo anterior en la clase (nota de bloqueo) y siguiente (lo que abre al conquistarlo). */
  anterior?: string;
  siguiente?: string;
}

function useTextos(m: MundoGalaxia) {
  const { t } = useTranslation();
  const estado = {
    bloqueado: t('galaxia.estadoBloqueado'),
    disponible: t('galaxia.estadoNuevo'),
    en_progreso: t('galaxia.estadoEnCurso'),
    dominado: t('galaxia.estadoConquistado'),
  }[m.estado];
  const boton = {
    bloqueado: '',
    disponible: t('galaxia.empezar'),
    en_progreso: t('galaxia.continuar'),
    dominado: t('galaxia.repasar'),
  }[m.estado];
  const notaBloqueo = m.anterior
    ? t('galaxia.bloqueadoNombre', { nombre: m.anterior })
    : t('galaxia.bloqueado');
  return { t, estado, boton, notaBloqueo };
}

/** Barra segmentada: un segmento por pregunta del mundo. */
export function BarraMundo({ hechas, total, color }: { hechas: number; total: number; color: string }) {
  return (
    <View style={estilos.barra}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[estilos.segmento, { backgroundColor: i < hechas ? color : ESPACIO.linea }]} />
      ))}
    </View>
  );
}

function BotonPrincipal({ texto, onPress }: { texto: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        estilos.boton,
        pressed && { transform: [{ translateY: 3 }], borderBottomWidth: 2 },
      ]}
    >
      <Text style={estilos.botonTexto}>{texto}</Text>
    </Pressable>
  );
}

export function TarjetaMundo({
  mundo,
  onEntrar,
  onVer,
}: {
  mundo: MundoGalaxia;
  onEntrar: () => void;
  onVer: () => void;
}) {
  const { t, estado, boton, notaBloqueo } = useTextos(mundo);
  const { acento } = mundo.planeta;
  const bloqueado = mundo.estado === 'bloqueado';
  return (
    <View
      style={[
        estilos.tarjeta,
        { borderColor: bloqueado ? ESPACIO.linea : acento },
      ]}
    >
      <Pressable onPress={onVer} accessibilityRole="button" accessibilityLabel={t('galaxia.verMundo', { nombre: mundo.nombre })} style={{ gap: 6 }}>
        <Text style={[estilos.etiqueta, { color: bloqueado ? ESPACIO.textoApagado : acento }]}>
          {t('galaxia.mundoN', { n: mundo.numero })} · {estado}
        </Text>
        <Text style={estilos.nombre}>{mundo.nombre}</Text>
        {mundo.descripcion ? <Text style={estilos.descripcion}>{mundo.descripcion}</Text> : null}
      </Pressable>
      {bloqueado ? (
        <View style={estilos.notaBloqueo}>
          <Ionicons name="lock-closed" size={16} color={ESPACIO.textoApagado} />
          <Text style={estilos.notaBloqueoTexto}>{notaBloqueo}</Text>
        </View>
      ) : (
        <>
          <View style={{ gap: 6, marginTop: 4 }}>
            <BarraMundo hechas={mundo.hechas} total={mundo.total} color={mundo.estado === 'dominado' ? ESPACIO.oro : acento} />
            <Text style={estilos.progreso}>
              {t('galaxia.preguntas', { hechas: mundo.hechas, total: mundo.total })}
            </Text>
          </View>
          <BotonPrincipal texto={boton} onPress={onEntrar} />
        </>
      )}
    </View>
  );
}

export function FichaMundo({
  mundo,
  visible,
  onCerrar,
  onEntrar,
  onGuia,
}: {
  mundo: MundoGalaxia | null;
  visible: boolean;
  onCerrar: () => void;
  onEntrar: () => void;
  onGuia: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!mundo) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <FichaContenido mundo={mundo} onCerrar={onCerrar} onEntrar={onEntrar} onGuia={onGuia} abajo={insets.bottom} />
    </Modal>
  );
}

function FichaContenido({
  mundo,
  onCerrar,
  onEntrar,
  onGuia,
  abajo,
}: {
  mundo: MundoGalaxia;
  onCerrar: () => void;
  onEntrar: () => void;
  onGuia: () => void;
  abajo: number;
}) {
  const { t, estado, boton, notaBloqueo } = useTextos(mundo);
  const { acento } = mundo.planeta;
  const bloqueado = mundo.estado === 'bloqueado';
  return (
    <View style={estilos.velo}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} accessibilityLabel={t('galaxia.cerrar')} />
      <View style={estilos.hojaZona} pointerEvents="box-none">
        <View style={[estilos.hoja, { paddingBottom: Math.max(abajo, 16) + 10 }]}>
          <View style={estilos.agarre} />
          <Pressable
            onPress={onCerrar}
            accessibilityRole="button"
            accessibilityLabel={t('galaxia.cerrar')}
            style={estilos.cerrar}
          >
            <Ionicons name="close" size={20} color={ESPACIO.texto} />
          </Pressable>
          <ScrollView contentContainerStyle={{ gap: 14, paddingTop: 116 }} showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Text style={[estilos.etiqueta, { color: bloqueado ? ESPACIO.textoApagado : acento }]}>
                {t('galaxia.mundoN', { n: mundo.numero })} · {estado}
              </Text>
              <Text style={[estilos.nombre, { fontSize: 28, textAlign: 'center' }]}>{mundo.nombre}</Text>
              {mundo.descripcion ? (
                <Text style={[estilos.descripcion, { textAlign: 'center' }]}>{mundo.descripcion}</Text>
              ) : null}
            </View>

            {bloqueado ? (
              <View style={estilos.notaBloqueo}>
                <Ionicons name="lock-closed" size={16} color={ESPACIO.textoApagado} />
                <Text style={estilos.notaBloqueoTexto}>{notaBloqueo}</Text>
              </View>
            ) : (
              <View style={estilos.cajaProgreso}>
                <View style={estilos.filaProgreso}>
                  <Text style={estilos.cajaTitulo}>{t('galaxia.tuProgreso')}</Text>
                  <Text style={[estilos.cajaValor, { color: acento }]}>
                    {t('galaxia.preguntas', { hechas: mundo.hechas, total: mundo.total })}
                  </Text>
                </View>
                <BarraMundo hechas={mundo.hechas} total={mundo.total} color={mundo.estado === 'dominado' ? ESPACIO.oro : acento} />
              </View>
            )}

            {mundo.siguiente && mundo.estado !== 'dominado' ? (
              <View style={estilos.desbloquea}>
                <Ionicons name="planet-outline" size={22} color={ESPACIO.oro} />
                <Text style={estilos.desbloqueaTexto}>
                  {t('galaxia.alConquistar')}
                  <Text style={{ color: ESPACIO.texto, fontWeight: '900' }}>{mundo.siguiente}</Text>.
                </Text>
              </View>
            ) : null}

            {!bloqueado ? (
              <View style={{ gap: 12, marginTop: 6 }}>
                <BotonPrincipal texto={boton} onPress={onEntrar} />
                <Pressable onPress={onGuia} accessibilityRole="button" style={estilos.botonSecundario}>
                  <Ionicons name="book-outline" size={18} color={ESPACIO.texto} />
                  <Text style={estilos.botonSecundarioTexto}>{t('galaxia.leerGuia')}</Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
          <View style={estilos.planetaFicha} pointerEvents="none">
            <View style={{ opacity: bloqueado ? 0.32 : 1 }}>
              <CetiAnimation id={mundo.planeta.animacion} size={210} autoPlay={!bloqueado} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    borderRadius: 24,
    borderWidth: 2,
    backgroundColor: ESPACIO.superficie,
    padding: 18,
    gap: 8,
    borderBottomWidth: 6,
  },
  etiqueta: { fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  nombre: { fontSize: 24, lineHeight: 26, fontWeight: '900', color: ESPACIO.texto },
  descripcion: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: ESPACIO.textoSuave },
  barra: { flexDirection: 'row', gap: 4 },
  segmento: { flex: 1, height: 8, borderRadius: 4 },
  progreso: { fontSize: 13, fontWeight: '800', color: ESPACIO.textoSuave },
  boton: {
    marginTop: 6,
    height: 52,
    borderRadius: 16,
    backgroundColor: ESPACIO.naranja,
    borderBottomWidth: 5,
    borderBottomColor: ESPACIO.naranjaOscuro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonTexto: { color: ESPACIO.textoSobreNaranja, fontSize: 17, fontWeight: '900', letterSpacing: 1 },
  botonSecundario: {
    height: 50,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#3A3A66',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonSecundarioTexto: { color: ESPACIO.texto, fontSize: 15, fontWeight: '900', letterSpacing: 0.6 },
  notaBloqueo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: ESPACIO.superficieBaja,
  },
  notaBloqueoTexto: { flex: 1, fontSize: 14, fontWeight: '700', color: ESPACIO.textoSuave },
  velo: { flex: 1, backgroundColor: 'rgba(6, 6, 18, 0.62)' },
  hojaZona: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  hoja: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '82%',
    backgroundColor: ESPACIO.superficie,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
  },
  agarre: {
    alignSelf: 'center',
    marginTop: 10,
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#3A3A66',
  },
  cerrar: {
    position: 'absolute',
    right: 16,
    top: 18,
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: '#26264A',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  planetaFicha: { position: 'absolute', top: -110, left: 0, right: 0, alignItems: 'center' },
  cajaProgreso: { gap: 10, padding: 14, borderRadius: 18, backgroundColor: ESPACIO.superficieBaja },
  filaProgreso: { flexDirection: 'row', justifyContent: 'space-between' },
  cajaTitulo: { fontSize: 13, fontWeight: '900', letterSpacing: 1, color: ESPACIO.textoSuave },
  cajaValor: { fontSize: 13, fontWeight: '900' },
  desbloquea: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    padding: 12,
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#34345E',
  },
  desbloqueaTexto: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: '700', color: '#C9C6E6' },
});
