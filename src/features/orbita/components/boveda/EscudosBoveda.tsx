/**
 * Escudos de racha comprados con Cetis: primero del bolsillo y, si no alcanza,
 * el resto de la Bóveda. La Bóveda como fondo de emergencia de la racha.
 */
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ESPACIO } from '@features/learning/components/galaxia/espacio';
import { useOrbitaStore } from '@features/orbita/store/useOrbitaStore';
import { EscudoRacha, MonedaCeti } from '@features/orbita/components/iconos';
import { MAX_ESCUDOS } from '@features/orbita/domain/racha';
import { precioEscudo } from '@features/orbita/domain/economia';
import { eventos } from '@features/orbita/data/eventos';
import { showMessage } from '@shared/lib/dialogs';
import { CIAN, Tarjeta, comun, formato, haptico } from './comun';

export default function EscudosBoveda({
  uid,
  escudos,
  bolsillo,
  boveda,
  hoy,
}: {
  uid: string;
  escudos: number;
  bolsillo: number;
  boveda: number;
  hoy: string;
}) {
  const { t } = useTranslation();
  const precio = precioEscudo(hoy);
  const lleno = escudos >= MAX_ESCUDOS;
  const alcanza = bolsillo + boveda >= precio;
  const deBoveda = Math.max(0, precio - bolsillo);

  const comprar = () => {
    const r = useOrbitaStore.getState().comprarEscudo(uid);
    if (r.ok) {
      haptico.exito();
      eventos.escudoComprado({ precio: r.precio });
      eventos.cetisGastados({ cantidad: r.precio, destino: 'escudo' });
      showMessage(t('orbita.boveda.escudoComprado'), t('orbita.boveda.escudoCompradoMsg'), 'success');
    } else {
      haptico.aviso();
      showMessage(
        r.error === 'tope' ? t('orbita.boveda.escudoLleno', { max: MAX_ESCUDOS }) : t('orbita.boveda.escudoSinCetis'),
        r.error === 'tope' ? undefined : t('orbita.boveda.escudoSinCetisMsg', { precio: formato(r.precio) })
      );
    }
  };

  return (
    <Tarjeta titulo={t('orbita.boveda.escudosTitulo')} icono={<EscudoRacha size={18} />}>
      <View style={st.fila}>
        <View style={st.escudos}>
          {Array.from({ length: MAX_ESCUDOS }, (_, i) => (
            <EscudoRacha key={i} size={40} activo={i < escudos} />
          ))}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={st.cuenta}>{t('orbita.boveda.escudosTienes', { count: escudos, max: MAX_ESCUDOS })}</Text>
          <Text style={comun.sub}>{t('orbita.boveda.escudosExplica')}</Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={comprar}
        disabled={lleno}
        accessibilityRole="button"
        style={[comun.boton, st.boton, lleno && { opacity: 0.45 }]}
      >
        <MonedaCeti size={18} />
        <Text style={[comun.botonTexto, { color: ESPACIO.fondo }]}>
          {lleno ? t('orbita.boveda.escudoLleno', { max: MAX_ESCUDOS }) : t('orbita.boveda.escudoComprar', { precio: formato(precio) })}
        </Text>
      </TouchableOpacity>
      {!lleno ? (
        <Text style={[comun.nota, !alcanza && { color: ESPACIO.textoSuave }]}>
          {!alcanza
            ? t('orbita.boveda.escudoFalta', { cetis: formato(precio - bolsillo - boveda) })
            : deBoveda === 0
              ? t('orbita.boveda.escudoDesdeBolsillo', { cetis: formato(bolsillo) })
              : bolsillo > 0
                ? t('orbita.boveda.escudoMixto', { bolsillo: formato(bolsillo), boveda: formato(deBoveda) })
                : t('orbita.boveda.escudoDesdeBoveda', { cetis: formato(precio) })}
        </Text>
      ) : null}
    </Tarjeta>
  );
}

const st = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  escudos: { flexDirection: 'row', gap: 4 },
  cuenta: { color: ESPACIO.texto, fontSize: 15, fontWeight: '900' },
  boton: { backgroundColor: CIAN },
});
