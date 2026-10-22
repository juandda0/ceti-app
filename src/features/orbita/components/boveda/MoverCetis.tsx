/**
 * Mover Cetis entre el bolsillo (no rinde) y la Bóveda (rinde cada lunes).
 */
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ESPACIO } from '@features/learning/components/galaxia/espacio';
import { useOrbitaStore } from '@features/orbita/store/useOrbitaStore';
import type { EstadoBoveda } from '@features/orbita/domain/boveda';
import { eventos } from '@features/orbita/data/eventos';
import { showMessage } from '@shared/lib/dialogs';
import SelectorMonto from './SelectorMonto';
import { Tarjeta, comun, formato, haptico } from './comun';

type Modo = 'guardar' | 'sacar';

export default function MoverCetis({ uid, boveda }: { uid: string; boveda: EstadoBoveda }) {
  const { t } = useTranslation();
  const [modo, setModo] = useState<Modo>('guardar');
  const [monto, setMonto] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const disponible = modo === 'guardar' ? boveda.bolsillo : boveda.boveda;

  const elegirModo = (m: Modo) => {
    if (m === modo) return;
    haptico.toque();
    setModo(m);
    setMonto(0);
    setError(null);
  };

  const cambiarMonto = (n: number) => {
    setMonto(n);
    setError(null);
  };

  const mover = () => {
    const store = useOrbitaStore.getState();
    const r = modo === 'guardar' ? store.depositar(uid, monto) : store.retirar(uid, monto);
    if (!r.ok) {
      haptico.aviso();
      setError(
        r.error === 'sin_fondos'
          ? t(modo === 'guardar' ? 'orbita.boveda.errorBolsillo' : 'orbita.boveda.errorBoveda', {
              cetis: formato(disponible),
            })
          : t('orbita.boveda.errorMonto')
      );
      return;
    }
    haptico.exito();
    eventos.boveda({ accion: modo === 'guardar' ? 'deposito' : 'retiro', monto });
    showMessage(
      t(modo === 'guardar' ? 'orbita.boveda.guardado' : 'orbita.boveda.sacado', { cetis: formato(monto) }),
      t(modo === 'guardar' ? 'orbita.boveda.guardadoMsg' : 'orbita.boveda.sacadoMsg'),
      'success'
    );
    setMonto(0);
  };

  return (
    <Tarjeta
      titulo={t('orbita.boveda.moverTitulo')}
      icono={<Ionicons name="swap-vertical" size={18} color={ESPACIO.oro} />}
    >
      <View style={st.segmento} accessibilityRole="tablist">
        {(['guardar', 'sacar'] as const).map((m) => {
          const activo = m === modo;
          return (
            <TouchableOpacity
              key={m}
              onPress={() => elegirModo(m)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activo }}
              style={[st.opcion, activo && st.opcionActiva]}
            >
              <Ionicons
                name={m === 'guardar' ? 'arrow-down-circle' : 'arrow-up-circle'}
                size={18}
                color={activo ? ESPACIO.texto : ESPACIO.textoApagado}
              />
              <Text style={[st.opcionTexto, activo && { color: ESPACIO.texto }]}>
                {t(m === 'guardar' ? 'orbita.boveda.guardar' : 'orbita.boveda.sacar')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={comun.sub}>
        {t(modo === 'guardar' ? 'orbita.boveda.disponibleBolsillo' : 'orbita.boveda.disponibleBoveda', {
          cetis: formato(disponible),
        })}
      </Text>

      <SelectorMonto valor={monto} max={disponible} onCambiar={cambiarMonto} />

      {error ? (
        <Text style={comun.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <TouchableOpacity
        onPress={mover}
        disabled={monto <= 0}
        accessibilityRole="button"
        style={[comun.boton, monto <= 0 && { opacity: 0.45 }]}
      >
        <Text style={comun.botonTexto}>
          {monto > 0
            ? t(modo === 'guardar' ? 'orbita.boveda.guardarN' : 'orbita.boveda.sacarN', {
                cetis: formato(monto),
              })
            : t('orbita.boveda.eligeMonto')}
        </Text>
      </TouchableOpacity>

      {modo === 'sacar' ? <Text style={comun.nota}>{t('orbita.boveda.sacarNota')}</Text> : null}
    </Tarjeta>
  );
}

const st = StyleSheet.create({
  segmento: {
    flexDirection: 'row',
    backgroundColor: ESPACIO.fondoProfundo,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  opcion: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    borderRadius: 11,
  },
  opcionActiva: { backgroundColor: ESPACIO.boton },
  opcionTexto: { color: ESPACIO.textoApagado, fontSize: 14, fontWeight: '800' },
});
