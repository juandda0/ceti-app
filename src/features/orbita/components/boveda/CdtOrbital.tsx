/**
 * CDT orbital: encierra Cetis de la Bóveda 2, 4 u 8 semanas a una tasa mayor.
 * Al vencer vuelven solos con su interés; romperlo antes devuelve solo lo puesto.
 */
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ESPACIO } from '@features/learning/components/galaxia/espacio';
import { useOrbitaStore } from '@features/orbita/store/useOrbitaStore';
import {
  MAX_CDTS,
  MAX_MONTO_CDT,
  MIN_CDT,
  PLAZOS_CDT,
  TASAS_CDT,
  pagoCdt,
  type Cdt,
  type EstadoBoveda,
  type PlazoCdt,
} from '@features/orbita/domain/boveda';
import { diasEntre, sumarDias } from '@features/orbita/domain/tiempo';
import { eventos } from '@features/orbita/data/eventos';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import { MonedaCeti } from '@features/orbita/components/iconos';
import SelectorMonto from './SelectorMonto';
import { CIAN, Tarjeta, VERDE, comun, fechaCorta, formato, haptico } from './comun';

const pct = (p: PlazoCdt) => Math.round(TASAS_CDT[p] * 100);

export default function CdtOrbital({
  uid,
  boveda,
  hoy,
}: {
  uid: string;
  boveda: EstadoBoveda;
  hoy: string;
}) {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(false);
  const lleno = boveda.cdts.length >= MAX_CDTS;

  return (
    <Tarjeta
      titulo={t('orbita.boveda.cdtTitulo')}
      icono={<Ionicons name="lock-closed" size={17} color={CIAN} />}
      accion={
        <Text style={comun.nota}>
          {t('orbita.boveda.cdtCuenta', { n: boveda.cdts.length, max: MAX_CDTS })}
        </Text>
      }
    >
      <Text style={comun.sub}>{t('orbita.boveda.cdtExplica')}</Text>

      {boveda.cdts.map((c) => (
        <FilaCdt key={c.id} cdt={c} hoy={hoy} uid={uid} />
      ))}

      {lleno ? (
        <Text style={comun.nota}>{t('orbita.boveda.cdtLleno', { max: MAX_CDTS })}</Text>
      ) : abierto ? (
        <NuevoCdt uid={uid} boveda={boveda} hoy={hoy} onCerrar={() => setAbierto(false)} />
      ) : (
        <TouchableOpacity
          onPress={() => {
            haptico.toque();
            setAbierto(true);
          }}
          accessibilityRole="button"
          style={[comun.boton, st.botonCdt]}
        >
          <Ionicons name="add-circle" size={20} color={ESPACIO.fondo} />
          <Text style={[comun.botonTexto, { color: ESPACIO.fondo }]}>{t('orbita.boveda.cdtAbrir')}</Text>
        </TouchableOpacity>
      )}
    </Tarjeta>
  );
}

function NuevoCdt({
  uid,
  boveda,
  hoy,
  onCerrar,
}: {
  uid: string;
  boveda: EstadoBoveda;
  hoy: string;
  onCerrar: () => void;
}) {
  const { t } = useTranslation();
  const [plazo, setPlazo] = useState<PlazoCdt>(4);
  const max = Math.min(boveda.boveda, MAX_MONTO_CDT);
  const [monto, setMonto] = useState(() => (max >= MIN_CDT ? Math.max(MIN_CDT, Math.floor(max / 2)) : 0));
  const [error, setError] = useState<string | null>(null);
  const alcanza = boveda.boveda >= MIN_CDT;
  const vence = sumarDias(hoy, plazo * 7);
  const valido = monto >= MIN_CDT && monto <= MAX_MONTO_CDT;

  const abrir = () => {
    const r = useOrbitaStore.getState().abrirCdt(uid, monto, plazo);
    if (!r.ok) {
      haptico.aviso();
      setError(
        r.error === 'sin_fondos'
          ? t('orbita.boveda.errorBoveda', { cetis: formato(boveda.boveda) })
          : r.error === 'tope_cdts'
            ? t('orbita.boveda.cdtLleno', { max: MAX_CDTS })
            : t('orbita.boveda.cdtErrorMonto', { min: MIN_CDT, max: formato(MAX_MONTO_CDT) })
      );
      return;
    }
    haptico.exito();
    eventos.boveda({ accion: 'cdt_abierto', monto });
    showMessage(
      t('orbita.boveda.cdtAbierto'),
      t('orbita.boveda.cdtAbiertoMsg', { cetis: formato(pagoCdt({ monto, semanas: plazo })), fecha: fechaCorta(vence) }),
      'success'
    );
    onCerrar();
  };

  if (!alcanza) {
    return (
      <View style={st.nuevo}>
        <Text style={comun.sub}>
          {t('orbita.boveda.cdtSinFondos', { min: MIN_CDT, cetis: formato(boveda.boveda) })}
        </Text>
        <TouchableOpacity onPress={onCerrar} accessibilityRole="button" style={comun.botonFantasma}>
          <Text style={comun.botonFantasmaTexto}>{t('orbita.boveda.cerrar')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={st.nuevo}>
      <Text style={st.etiqueta}>{t('orbita.boveda.cdtPlazo')}</Text>
      <View style={st.plazos} accessibilityRole="radiogroup">
        {PLAZOS_CDT.map((p) => {
          const activo = p === plazo;
          return (
            <TouchableOpacity
              key={p}
              onPress={() => {
                haptico.toque();
                setPlazo(p);
                setError(null);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: activo }}
              style={[st.plazo, activo && st.plazoActivo]}
            >
              <Text style={[st.plazoSemanas, activo && { color: ESPACIO.texto }]}>
                {t('orbita.boveda.semanas', { count: p })}
              </Text>
              <Text style={[st.plazoTasa, activo && { color: CIAN }]}>+{pct(p)} %</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={st.etiqueta}>{t('orbita.boveda.cdtMonto', { min: MIN_CDT, max: formato(max) })}</Text>
      <SelectorMonto
        valor={monto}
        max={max}
        min={MIN_CDT}
        onCambiar={(n) => {
          setMonto(n);
          setError(null);
        }}
      />

      <View style={st.resumen}>
        <Ionicons name="sparkles" size={16} color={VERDE} />
        <Text style={st.resumenTexto}>
          {valido
            ? t('orbita.boveda.cdtResumen', {
                cetis: formato(pagoCdt({ monto, semanas: plazo })),
                ganas: formato(pagoCdt({ monto, semanas: plazo }) - monto),
                fecha: fechaCorta(vence),
              })
            : t('orbita.boveda.cdtErrorMonto', { min: MIN_CDT, max: formato(MAX_MONTO_CDT) })}
        </Text>
      </View>

      {error ? <Text style={comun.error}>{error}</Text> : null}

      <View style={st.acciones}>
        <TouchableOpacity
          onPress={onCerrar}
          accessibilityRole="button"
          style={[comun.botonFantasma, { minHeight: 48 }]}
        >
          <Text style={comun.botonFantasmaTexto}>{t('orbita.boveda.cancelar')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={abrir}
          disabled={monto <= 0}
          accessibilityRole="button"
          style={[comun.boton, st.botonCdt, { flex: 1 }, monto <= 0 && { opacity: 0.45 }]}
        >
          <Ionicons name="lock-closed" size={16} color={ESPACIO.fondo} />
          <Text style={[comun.botonTexto, { color: ESPACIO.fondo }]}>
            {t('orbita.boveda.cdtConfirmar', { semanas: plazo })}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FilaCdt({ cdt, hoy, uid }: { cdt: Cdt; hoy: string; uid: string }) {
  const { t } = useTranslation();
  const total = cdt.semanas * 7;
  const quedan = Math.max(0, diasEntre(hoy, cdt.vence));
  const avance = Math.min(1, Math.max(0, diasEntre(cdt.inicio, hoy) / total));
  const pago = pagoCdt(cdt);

  const romper = () => {
    haptico.toque();
    confirmAction({
      title: t('orbita.boveda.romperTitulo'),
      body: t('orbita.boveda.romperTexto', {
        monto: formato(cdt.monto),
        pierdes: formato(pago - cdt.monto),
        count: quedan,
      }),
      confirmLabel: t('orbita.boveda.romperSi'),
      cancelLabel: t('orbita.boveda.romperNo'),
      destructive: true,
      onConfirm: () => {
        const r = useOrbitaStore.getState().romperCdt(uid, cdt.id);
        if (!r.ok) return;
        haptico.aviso();
        eventos.boveda({ accion: 'cdt_roto', monto: cdt.monto });
        showMessage(t('orbita.boveda.roto'), t('orbita.boveda.rotoMsg', { monto: formato(cdt.monto) }));
      },
    });
  };

  return (
    <View style={st.fila}>
      <View style={st.filaArriba}>
        <MonedaCeti size={20} />
        <View style={{ flex: 1 }}>
          <Text style={st.filaTitulo}>
            {t('orbita.boveda.cdtFila', { monto: formato(cdt.monto), tasa: pct(cdt.semanas) })}
          </Text>
          <Text style={comun.nota}>
            {t('orbita.boveda.cdtFilaSub', {
              count: cdt.semanas,
              pago: formato(pago),
              fecha: fechaCorta(cdt.vence),
            })}
          </Text>
        </View>
        <Text style={st.quedan}>
          {quedan > 0 ? t('orbita.boveda.quedan', { count: quedan }) : t('orbita.boveda.venceHoy')}
        </Text>
      </View>
      <View
        style={st.barra}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(avance * 100) }}
      >
        <View style={[st.barraLlena, { width: `${Math.max(4, avance * 100)}%` }]} />
      </View>
      <TouchableOpacity
        onPress={romper}
        accessibilityRole="button"
        accessibilityLabel={t('orbita.boveda.romperA11y', { monto: formato(cdt.monto) })}
        style={st.romper}
        hitSlop={8}
      >
        <Ionicons name="hammer-outline" size={14} color={ESPACIO.textoApagado} />
        <Text style={st.romperTexto}>{t('orbita.boveda.romper')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  botonCdt: { backgroundColor: CIAN },
  nuevo: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: ESPACIO.linea,
    paddingTop: 12,
  },
  etiqueta: { color: ESPACIO.textoSuave, fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  plazos: { flexDirection: 'row', gap: 8 },
  plazo: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: ESPACIO.linea,
    backgroundColor: ESPACIO.fondoProfundo,
  },
  plazoActivo: { borderColor: CIAN, backgroundColor: '#14262A' },
  plazoSemanas: { color: ESPACIO.textoSuave, fontSize: 13, fontWeight: '800' },
  plazoTasa: { color: ESPACIO.textoApagado, fontSize: 16, fontWeight: '900' },
  resumen: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  resumenTexto: { flex: 1, color: ESPACIO.texto, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  acciones: { flexDirection: 'row', gap: 8 },
  fila: {
    gap: 8,
    backgroundColor: ESPACIO.fondoProfundo,
    borderRadius: 16,
    padding: 12,
  },
  filaArriba: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  filaTitulo: { color: ESPACIO.texto, fontSize: 15, fontWeight: '900' },
  quedan: { color: CIAN, fontSize: 13, fontWeight: '800' },
  barra: { height: 8, borderRadius: 4, backgroundColor: ESPACIO.linea, overflow: 'hidden' },
  barraLlena: { height: '100%', borderRadius: 4, backgroundColor: ESPACIO.oro },
  romper: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  romperTexto: { color: ESPACIO.textoApagado, fontSize: 12, fontWeight: '800' },
});
