/**
 * Ceti comenta la Bóveda según el caso: celebra un CDT por vencer, avisa la
 * inflación si hay Cetis quietos, pide guardar lo del bolsillo… Sin miedo ni
 * urgencia falsa: solo dice lo que pasa.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CetiAnimation } from '@features/animations';
import { ESPACIO } from '@features/learning/components/galaxia/espacio';
import { TOPE_INTERES, totalCetis, type EstadoBoveda } from '@features/orbita/domain/boveda';
import { diasParaInflacion } from '@features/orbita/domain/economia';
import { diasEntre } from '@features/orbita/domain/tiempo';
import { formato } from './comun';

/** Un CDT "está por vencer" si le quedan estos días o menos. */
const DIAS_CDT_CERCA = 2;
/** La inflación "está cerca" si faltan estos días o menos. */
const DIAS_INFLACION_CERCA = 14;

export function fraseCeti(
  b: EstadoBoveda,
  hoy: string
): { clave: string; params?: Record<string, string | number> } {
  const porVencer = b.cdts
    .map((c) => ({ c, dias: diasEntre(hoy, c.vence) }))
    .filter((x) => x.dias <= DIAS_CDT_CERCA)
    .sort((a, b2) => a.dias - b2.dias)[0];
  if (porVencer) {
    return porVencer.dias <= 0
      ? { clave: 'orbita.boveda.ceti.cdtHoy' }
      : { clave: 'orbita.boveda.ceti.cdtCerca', params: { count: porVencer.dias } };
  }
  if (totalCetis(b) === 0) return { clave: 'orbita.boveda.ceti.vacia' };
  const dias = diasParaInflacion(hoy);
  if (b.bolsillo > b.boveda && dias <= DIAS_INFLACION_CERCA) {
    return { clave: 'orbita.boveda.ceti.inflacion', params: { count: dias } };
  }
  if (b.bolsillo > 0 && b.boveda === 0 && b.cdts.length === 0) {
    return { clave: 'orbita.boveda.ceti.todoBolsillo', params: { cetis: formato(b.bolsillo) } };
  }
  if (b.boveda > TOPE_INTERES) {
    return { clave: 'orbita.boveda.ceti.tope', params: { tope: formato(TOPE_INTERES) } };
  }
  if (b.bolsillo > b.boveda) return { clave: 'orbita.boveda.ceti.masBolsillo' };
  return { clave: 'orbita.boveda.ceti.bien' };
}

export default function BurbujaCeti({ boveda, hoy }: { boveda: EstadoBoveda; hoy: string }) {
  const { t } = useTranslation();
  const { clave, params } = fraseCeti(boveda, hoy);
  return (
    <View style={st.raiz}>
      <View style={st.ceti}>
        <CetiAnimation id="mascot.ceti-vuelo-reposo" size={76} />
      </View>
      <View style={st.burbuja} accessibilityRole="text">
        <View style={st.pico} />
        <Text style={st.texto}>{t(clave, params)}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  raiz: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ceti: { width: 76, height: 76 },
  burbuja: {
    flex: 1,
    backgroundColor: ESPACIO.superficie,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ESPACIO.lineaSuave,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  pico: {
    position: 'absolute',
    left: -7,
    top: '50%',
    marginTop: -6,
    width: 12,
    height: 12,
    backgroundColor: ESPACIO.superficie,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: ESPACIO.lineaSuave,
    transform: [{ rotate: '45deg' }],
  },
  texto: { color: ESPACIO.texto, fontSize: 14, fontWeight: '700', lineHeight: 20 },
});
