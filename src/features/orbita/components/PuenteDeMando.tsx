/**
 * Puente de mando: lo primero que se ve en Aprender. Racha con sus escudos,
 * meta del día y Cetis. Tocar la racha abre el detalle (escudos, reparación);
 * la meta abre el selector; los Cetis llevan a la Bóveda. `compacto` deja solo
 * los chips (para el mapa de un planeta).
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import { ESPACIO } from '@features/learning/components/galaxia/espacio';
import { useOrbita, refrescarAvisos } from '@features/orbita/hooks/useOrbita';
import { useOrbitaStore } from '@features/orbita/store/useOrbitaStore';
import { EscudoRacha, MonedaCeti } from '@features/orbita/components/iconos';
import { LECCIONES_POR_META, METAS, type MetaDiaria } from '@features/orbita/domain/progreso';
import { MAX_ESCUDOS, PRACTICAS_PARA_REPARAR, reparacionVigente } from '@features/orbita/domain/racha';
import { precioEscudo } from '@features/orbita/domain/economia';
import { eventos } from '@features/orbita/data/eventos';
import { useCetiOverlayStore } from '@shared/store/useCetiOverlayStore';
import { useThemeColors } from '@shared/hooks/useThemeColors';

function formato(n: number): string {
  return n.toLocaleString('es-CO');
}

function AnilloMeta({ hechas, meta, size = 30 }: { hechas: number; meta: number; size?: number }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, hechas / Math.max(1, meta));
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={ESPACIO.linea} strokeWidth={5} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={pct >= 1 ? ESPACIO.oro : ESPACIO.naranja}
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

export default function PuenteDeMando({ compacto = false }: { compacto?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { uid, estado, hoy, resumen } = useOrbita();
  const [hoja, setHoja] = useState<'racha' | 'meta' | null>(null);
  if (!estado || !resumen) return null;

  const rota = estado.racha.rota && reparacionVigente(estado.racha, hoy) ? estado.racha.rota : null;
  const metaHecha = resumen.leccionesHoy >= resumen.metaLecciones;

  return (
    <View style={st.raiz}>
      <View style={st.fila}>
        <Pressable
          onPress={() => setHoja('racha')}
          accessibilityRole="button"
          accessibilityLabel={t('orbita.puente.rachaA11y', {
            count: resumen.racha,
            escudos: resumen.escudos,
          })}
          style={[st.chip, { backgroundColor: resumen.practicoHoy ? '#241A12' : ESPACIO.boton }]}
        >
          <Ionicons name="flame" size={18} color={resumen.practicoHoy ? '#FF9F45' : ESPACIO.textoApagado} />
          <Text style={[st.chipTexto, { color: resumen.practicoHoy ? '#FF9F45' : '#C9C6E6' }]}>
            {resumen.racha}
          </Text>
          <View style={st.escudos}>
            {Array.from({ length: MAX_ESCUDOS }, (_, i) => (
              <EscudoRacha key={i} size={14} activo={i < resumen.escudos} />
            ))}
          </View>
        </Pressable>

        <Pressable
          onPress={() => setHoja('meta')}
          accessibilityRole="button"
          accessibilityLabel={t('orbita.puente.metaA11y', {
            hechas: resumen.leccionesHoy,
            meta: resumen.metaLecciones,
          })}
          style={[st.chip, { backgroundColor: ESPACIO.boton }]}
        >
          <AnilloMeta hechas={resumen.leccionesHoy} meta={resumen.metaLecciones} size={22} />
          <Text style={[st.chipTexto, { color: metaHecha ? ESPACIO.oro : ESPACIO.texto }]}>
            {Math.min(resumen.leccionesHoy, resumen.metaLecciones)}/{resumen.metaLecciones}
          </Text>
        </Pressable>

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={() => router.push('/boveda' as never)}
          accessibilityRole="button"
          accessibilityLabel={t('orbita.puente.cetisA11y', { cetis: resumen.cetis })}
          style={[st.chip, { backgroundColor: ESPACIO.boton }]}
        >
          <MonedaCeti size={18} />
          <Text style={[st.chipTexto, { color: ESPACIO.oro }]}>{formato(resumen.cetis)}</Text>
        </Pressable>
      </View>

      {!compacto && rota && (
        <Pressable
          onPress={() => setHoja('racha')}
          style={[st.banner, { borderColor: '#5FCFC8' }]}
          accessibilityRole="button"
        >
          <Ionicons name="build" size={18} color="#5FCFC8" />
          <Text style={st.bannerTexto}>
            {t('orbita.puente.reparar', {
              count: rota.valor,
              hechas: rota.practicas,
              meta: PRACTICAS_PARA_REPARAR,
            })}
          </Text>
        </Pressable>
      )}

      {!compacto && !rota && (
        <View style={st.metaCaja}>
          <AnilloMeta hechas={resumen.leccionesHoy} meta={resumen.metaLecciones} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={st.metaTitulo}>
              {t('orbita.puente.metaTitulo', { meta: t(`orbita.meta.${estado.ajustes.meta}`) })}
            </Text>
            <Text style={st.metaSub}>
              {metaHecha
                ? t('orbita.puente.metaHecha')
                : t('orbita.puente.metaFalta', { count: resumen.metaLecciones - resumen.leccionesHoy })}
            </Text>
          </View>
        </View>
      )}

      <HojaRacha visible={hoja === 'racha'} onClose={() => setHoja(null)} uid={uid} />
      <HojaMeta visible={hoja === 'meta'} onClose={() => setHoja(null)} uid={uid} />
    </View>
  );
}

function HojaRacha({ visible, onClose, uid }: { visible: boolean; onClose: () => void; uid: string }) {
  const { t } = useTranslation();
  const { estado, hoy, resumen } = useOrbita();
  const colors = useThemeColors();
  if (!estado || !resumen) return null;
  const tx = { color: colors.text.primary };
  const sub = { color: colors.text.secondary };
  const caja = { borderColor: colors.materials.border };
  const precio = precioEscudo(hoy);
  const lleno = resumen.escudos >= MAX_ESCUDOS;
  const rota = estado.racha.rota && reparacionVigente(estado.racha, hoy) ? estado.racha.rota : null;

  const comprar = () => {
    const r = useOrbitaStore.getState().comprarEscudo(uid);
    const toast = useCetiOverlayStore.getState().showToast;
    if (r.ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      eventos.escudoComprado({ precio: r.precio });
      eventos.cetisGastados({ cantidad: r.precio, destino: 'escudo' });
      toast({ variant: 'success', title: t('orbita.escudo.comprado'), message: t('orbita.escudo.compradoMsg') });
    } else {
      toast({
        variant: 'info',
        title: r.error === 'tope' ? t('orbita.escudo.tope') : t('orbita.escudo.sinCetis'),
        message: r.error === 'tope' ? '' : t('orbita.escudo.sinCetisMsg'),
      });
    }
  };

  return (
    <CetiBottomSheet visible={visible} onClose={onClose} closeOnBackdropPress title={t('orbita.racha.titulo')}>
      <View style={hoja.cuerpo}>
        <View style={hoja.grande}>
          <Ionicons name="flame" size={44} color="#FF8A1F" />
          <Text style={hoja.numero}>{resumen.racha}</Text>
        </View>
        <Text style={[hoja.texto, tx]}>
          {resumen.practicoHoy ? t('orbita.racha.hoyListo') : t('orbita.racha.hoyFalta')}
        </Text>
        <Text style={[hoja.sub, sub]}>{t('orbita.racha.mejor', { count: estado.racha.mejor })}</Text>

        {rota && (
          <View style={[hoja.caja, { borderColor: '#5FCFC8' }]}>
            <Text style={[hoja.cajaTitulo, tx]}>{t('orbita.racha.reparacionTitulo', { count: rota.valor })}</Text>
            <Text style={[hoja.sub, sub]}>
              {t('orbita.racha.reparacionTexto', { hechas: rota.practicas, meta: PRACTICAS_PARA_REPARAR })}
            </Text>
          </View>
        )}

        <View style={[hoja.caja, caja]}>
          <View style={hoja.filaEscudos}>
            {Array.from({ length: MAX_ESCUDOS }, (_, i) => (
              <EscudoRacha key={i} size={34} activo={i < resumen.escudos} />
            ))}
          </View>
          <Text style={[hoja.cajaTitulo, tx]}>
            {t('orbita.escudo.tienes', { count: resumen.escudos, max: MAX_ESCUDOS })}
          </Text>
          <Text style={[hoja.sub, sub]}>{t('orbita.escudo.explica')}</Text>
          <TouchableOpacity
            onPress={comprar}
            disabled={lleno}
            style={[hoja.boton, { opacity: lleno ? 0.5 : 1 }]}
            accessibilityRole="button"
          >
            <MonedaCeti size={18} />
            <Text style={hoja.botonTexto}>
              {lleno ? t('orbita.escudo.lleno') : t('orbita.escudo.comprar', { precio })}
            </Text>
          </TouchableOpacity>
          <Text style={hoja.nota}>{t('orbita.escudo.saldo', { cetis: resumen.cetis })}</Text>
        </View>
      </View>
    </CetiBottomSheet>
  );
}

function HojaMeta({ visible, onClose, uid }: { visible: boolean; onClose: () => void; uid: string }) {
  const { t } = useTranslation();
  const { estado } = useOrbita();
  if (!estado) return null;
  const elegir = (meta: MetaDiaria) => {
    useOrbitaStore.getState().configurar(uid, { meta });
    eventos.metaElegida({ meta });
    void Haptics.selectionAsync();
    refrescarAvisos(useOrbitaStore.getState().porUid[uid]);
    onClose();
  };
  return (
    <CetiBottomSheet visible={visible} onClose={onClose} closeOnBackdropPress title={t('orbita.meta.titulo')}>
      <SelectorMeta valor={estado.ajustes.meta} onElegir={elegir} />
    </CetiBottomSheet>
  );
}

/** Selector de meta diaria (también lo usa el onboarding). */
export function SelectorMeta({ valor, onElegir }: { valor: MetaDiaria; onElegir: (m: MetaDiaria) => void }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const tx = { color: colors.text.primary };
  const sub = { color: colors.text.secondary };
  return (
    <View style={hoja.metas}>
      {METAS.map((m) => {
        const activa = m === valor;
        return (
          <TouchableOpacity
            key={m}
            onPress={() => onElegir(m)}
            accessibilityRole="radio"
            accessibilityState={{ selected: activa }}
            style={[
              hoja.meta,
              {
                borderColor: activa ? colors.brand.primary : colors.materials.border,
                backgroundColor: activa ? colors.fill.brandSubtle : 'transparent',
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[hoja.metaNombre, tx]}>{t(`orbita.meta.${m}`)}</Text>
              <Text style={[hoja.metaDesc, sub]}>{t(`orbita.meta.${m}Desc`)}</Text>
            </View>
            <Text style={hoja.metaNum}>
              {t('orbita.meta.lecciones', { count: LECCIONES_POR_META[m] })}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  raiz: { gap: 10 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    minHeight: 36,
  },
  chipTexto: { fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  escudos: { flexDirection: 'row', gap: 1, marginLeft: 2 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#14262A',
  },
  bannerTexto: { flex: 1, color: ESPACIO.texto, fontSize: 14, fontWeight: '700' },
  metaCaja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    padding: 12,
    backgroundColor: ESPACIO.superficieBaja,
    borderWidth: 1,
    borderColor: ESPACIO.linea,
  },
  metaTitulo: { color: ESPACIO.texto, fontSize: 15, fontWeight: '900' },
  metaSub: { color: ESPACIO.textoSuave, fontSize: 13, fontWeight: '600' },
});

const hoja = StyleSheet.create({
  cuerpo: { gap: 12, paddingBottom: 8 },
  grande: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  numero: { fontSize: 48, fontWeight: '900', color: '#FF8A1F' },
  texto: { fontSize: 16, fontWeight: '700', textAlign: 'center', color: '#F2F2F4' },
  sub: { fontSize: 13, fontWeight: '600', color: '#A8A8B2', textAlign: 'center' },
  caja: { borderWidth: 1, borderColor: '#383842', borderRadius: 18, padding: 14, gap: 8, alignItems: 'center' },
  cajaTitulo: { fontSize: 16, fontWeight: '900', color: '#F2F2F4', textAlign: 'center' },
  filaEscudos: { flexDirection: 'row', gap: 6 },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF8A1F',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 4,
  },
  botonTexto: { fontSize: 15, fontWeight: '900', color: '#2B1407' },
  nota: { fontSize: 12, fontWeight: '600', color: '#74747E' },
  metas: { gap: 10, paddingBottom: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderRadius: 16, padding: 14 },
  metaNombre: { fontSize: 16, fontWeight: '900', color: '#F2F2F4' },
  metaDesc: { fontSize: 13, fontWeight: '600' },
  metaNum: { fontSize: 13, fontWeight: '800', color: '#FF8A1F' },
});
