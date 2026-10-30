/**
 * Plan y facturación de la entidad (Fase 6, solo admin): cotización con el
 * precio de lista (Equipo, Colegio o Universidad; semestral o anual), orden de
 * compra y datos para la factura electrónica. El pago se hace por
 * transferencia o PSE: Ceti lo confirma, activa la licencia y factura.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { compartirPdf } from '@shared/lib/export/guardarArchivo';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import {
  CICLOS_ENTIDAD,
  MENSAJES_ERROR_FACTURACION,
  PLANES_ENTIDAD,
  RESPONSABILIDADES_FISCALES,
  cotizarEntidad,
  digitoVerificacionNit,
  formatoCop,
  itemFacturaEntidad,
  leerDatosFacturacion,
  licenciaVigente,
  planEntidadDe,
  type CicloEntidad,
  type Cotizacion,
  type DatosFacturacion,
  type EstadoCotizacion,
  type PlanEntidad,
  type ResponsabilidadFiscal,
} from '@/functions/src/educadores/dominio';
import {
  Aviso,
  BotonChunky,
  Campo,
  Chip,
  Encabezado,
  Esqueleto,
  Pill,
  Seccion,
  Tarjeta,
  Vacio,
  tapsConTeclado,
  type Tono,
} from '@features/dashboard/components/profe/kit';
import { entidadRepository } from '../data/entidadRepository';
import { NOMBRE_RESPONSABILIDAD, cotizacionHtml } from '../data/cotizacionPdf';
import { useMiEntidad } from '../hooks/useMiEntidad';
import { fechaCorta } from '../components/EntidadTarjeta';

const TONO_ESTADO: Record<EstadoCotizacion, Tono> = { cotizada: 'azul', orden_recibida: 'naranja', pagada: 'verde', anulada: 'neutro' };

type Formulario = Record<'razonSocial' | 'nit' | 'dv' | 'direccion' | 'ciudad' | 'correoFactura' | 'telefono', string> & {
  responsabilidad: ResponsabilidadFiscal | '';
};

const VACIO: Formulario = { razonSocial: '', nit: '', dv: '', direccion: '', ciudad: '', correoFactura: '', telefono: '', responsabilidad: '' };

export default function FacturacionEntidadScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const colegioId = useAuthStore((s) => s.colegioId);
  const { vista, soyAdmin, cargando } = useMiEntidad();
  const [plan, setPlan] = useState<PlanEntidad>('colegio');
  const [ciclo, setCiclo] = useState<CicloEntidad>('anual');
  const [cantidad, setCantidad] = useState('150');
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [datos, setDatos] = useState<DatosFacturacion | null>(null);
  const [form, setForm] = useState<Formulario>(VACIO);
  const [ordenes, setOrdenes] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!colegioId || !soyAdmin) return;
    const [c, d] = await Promise.all([
      entidadRepository.cotizaciones(colegioId).catch(() => []),
      entidadRepository.datosFacturacion(colegioId).catch(() => null),
    ]);
    setCotizaciones(c);
    setDatos(d);
    if (d) setForm({ ...d, telefono: d.telefono ?? '' });
  }, [colegioId, soyAdmin]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // El tipo de entidad propone el plan.
  useEffect(() => {
    const tipo = vista?.entidad?.tipo;
    if (tipo === 'universidad') {
      setPlan('universidad');
      setCiclo('semestral');
      setCantidad('300');
    } else if (tipo === 'academia') {
      setPlan('equipo');
      setCantidad(String(Math.max(3, vista?.profes.length ?? 3)));
    }
  }, [vista?.entidad?.tipo, vista?.profes.length]);

  const n = Number(cantidad.replace(/\D/g, '')) || 0;
  const cot = useMemo(() => cotizarEntidad(plan, ciclo, n), [plan, ciclo, n]);
  const validacion = useMemo(() => leerDatosFacturacion(form), [form]);
  const dvSugerido = /^\d{6,15}$/.test(form.nit.replace(/[.\s-]/g, '')) ? digitoVerificacionNit(form.nit) : null;

  const correr = async (clave: string, f: () => Promise<unknown>, ok: string) => {
    setOcupado(clave);
    try {
      await f();
      showMessage(ok, undefined, 'success');
      await cargar();
    } catch (e) {
      showMessage(t('entidad.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setOcupado(null);
    }
  };

  const vigente = licenciaVigente(vista?.licencia, Date.now());
  const campo = (k: keyof Omit<Formulario, 'responsabilidad'>) => ({
    value: form[k],
    onChangeText: (v: string) => setForm((f) => ({ ...f, [k]: v })),
  });

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps={tapsConTeclado}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado atras="/(staff)/colegio" sobretitulo={vista?.entidad?.nombre ?? t('entidad.sobre')} titulo={t('entidad.factura.titulo')} />
        {cargando ? <Esqueleto filas={3} alto={90} /> : null}
        {!cargando && !soyAdmin ? (
          <Vacio icono="lock-closed-outline" titulo={t('entidad.soloAdmin')} texto={t('entidad.soloAdminTexto')} />
        ) : null}
        {!cargando && soyAdmin ? (
          <>
            {vigente ? (
              <Aviso
                icono="checkmark-circle"
                tono="verde"
                texto={t('entidad.factura.vigente', {
                  plan: t(`entidad.plan.${planEntidadDe(vigente) ?? 'colegio'}`),
                  fecha: fechaCorta(vigente.hasta),
                })}
              />
            ) : null}

            <Aviso icono="time-outline" tono="naranja" texto={t(vista?.entidad?.tipo === 'universidad' ? 'entidad.factura.porQue_universidad' : 'entidad.factura.porQue')} />
            <Seccion texto={t('entidad.factura.cotizar')} />
            <View style={st.chips}>
              {PLANES_ENTIDAD.map((p) => (
                <Chip key={p} texto={t(`entidad.plan.${p}`)} seleccionado={plan === p} onPress={() => setPlan(p)} />
              ))}
            </View>
            <Text style={[st.sub, { color: colors.text.tertiary }]}>{t(`entidad.factura.plan_${plan}`)}</Text>
            <View style={st.chips}>
              {CICLOS_ENTIDAD.map((c) => (
                <Chip key={c} texto={t(`entidad.factura.ciclo_${c}`)} seleccionado={ciclo === c} onPress={() => setCiclo(c)} />
              ))}
            </View>
            <Campo etiqueta={t(`entidad.factura.cantidad_${cot.unidad}`)} value={cantidad} onChangeText={setCantidad} />
            <Tarjeta style={{ gap: 6 }}>
              <View style={st.fila}>
                <Text style={[st.sub, { flex: 1, color: colors.text.secondary }]}>
                  {t('entidad.factura.linea', { cantidad: cot.cantidad, unitario: formatoCop(cot.unitario) })}
                </Text>
                <Text style={[st.num, { color: colors.text.primary }]}>{formatoCop(cot.base)}</Text>
              </View>
              <View style={st.fila}>
                <Text style={[st.sub, { flex: 1, color: colors.text.secondary }]}>{t('entidad.factura.iva')}</Text>
                <Text style={[st.num, { color: colors.text.primary }]}>{formatoCop(cot.iva)}</Text>
              </View>
              <View style={st.fila}>
                <Text style={[st.total, { flex: 1, color: colors.text.primary }]}>{t(`entidad.factura.total_${ciclo}`)}</Text>
                <Text style={[st.total, { color: colors.text.primary }]}>{formatoCop(cot.total)}</Text>
              </View>
              {cot.solicitada < cot.cantidad ? (
                <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('entidad.factura.minimo', { n: cot.cantidad })}</Text>
              ) : null}
            </Tarjeta>
            <BotonChunky
              texto={t('entidad.factura.pedir')}
              icono="document-text"
              cargando={ocupado === 'cotizar'}
              deshabilitado={n < 1}
              onPress={() => void correr('cotizar', () => entidadRepository.cotizar(plan, ciclo, n), t('entidad.factura.pedida'))}
            />

            {cotizaciones.length > 0 ? <Seccion texto={t('entidad.factura.cotizaciones')} /> : null}
            {cotizaciones.map((c) => (
              <Tarjeta key={c.id} style={{ gap: 8 }}>
                <View style={st.fila}>
                  <Text style={[st.nombre, { flex: 1, color: colors.text.primary }]}>{c.numero}</Text>
                  <Pill tono={TONO_ESTADO[c.estado]} texto={t(`entidad.factura.estado_${c.estado}`)} />
                </View>
                <Text style={[st.sub, { color: colors.text.secondary }]}>
                  {itemFacturaEntidad(c)} · {formatoCop(c.total)}
                </Text>
                <Text style={[st.sub, { color: colors.text.tertiary }]}>
                  {c.ordenCompra
                    ? t('entidad.factura.conOrden', { orden: c.ordenCompra })
                    : t('entidad.factura.validaHasta', { fecha: fechaCorta(c.validaHasta) })}
                </Text>
                {c.estado === 'cotizada' || c.estado === 'orden_recibida' ? (
                  <View style={{ gap: 8 }}>
                    <Campo
                      etiqueta={t('entidad.factura.orden')}
                      value={ordenes[c.id] ?? c.ordenCompra ?? ''}
                      onChangeText={(v) => setOrdenes((o) => ({ ...o, [c.id]: v }))}
                      placeholder="OC-2026-118"
                    />
                    <BotonChunky
                      texto={t('entidad.factura.registrarOrden')}
                      icono="send"
                      variante="secundario"
                      compacto
                      cargando={ocupado === `o:${c.id}`}
                      onPress={() =>
                        void correr(`o:${c.id}`, () => entidadRepository.registrarOrden(c.id, ordenes[c.id] ?? ''), t('entidad.factura.ordenRegistrada'))
                      }
                    />
                  </View>
                ) : null}
                <Chip
                  texto={t('entidad.factura.pdf')}
                  icono="download-outline"
                  seleccionado={false}
                  onPress={() => void compartirPdf(`${c.numero}.pdf`, cotizacionHtml(c, vista?.entidad?.nombre ?? '', datos))}
                />
              </Tarjeta>
            ))}

            <Seccion texto={t('entidad.factura.datos')} />
            <Tarjeta style={{ gap: 10 }}>
              <Campo etiqueta={t('entidad.factura.razonSocial')} {...campo('razonSocial')} />
              <View style={st.fila}>
                <Campo style={{ flex: 1 }} etiqueta={t('entidad.factura.nit')} placeholder="890903938" {...campo('nit')} />
                <Campo style={{ width: 70 }} etiqueta={t('entidad.factura.dv')} {...campo('dv')} />
              </View>
              {dvSugerido && form.dv !== dvSugerido ? (
                <Text style={[st.sub, { color: colors.text.tertiary }]}>{t('entidad.factura.dvSugerido', { dv: dvSugerido })}</Text>
              ) : null}
              <Campo etiqueta={t('entidad.factura.direccion')} {...campo('direccion')} />
              <Campo etiqueta={t('entidad.factura.ciudad')} {...campo('ciudad')} />
              <Campo etiqueta={t('entidad.factura.correo')} tipo="correo" {...campo('correoFactura')} />
              <Campo etiqueta={t('entidad.factura.telefono')} {...campo('telefono')} />
              <Text style={[st.sub, { color: colors.text.secondary }]}>{t('entidad.factura.responsabilidad')}</Text>
              <View style={st.chips}>
                {RESPONSABILIDADES_FISCALES.map((r) => (
                  <Chip key={r} texto={NOMBRE_RESPONSABILIDAD[r]} seleccionado={form.responsabilidad === r} onPress={() => setForm((f) => ({ ...f, responsabilidad: r }))} />
                ))}
              </View>
              {!validacion.ok && form.razonSocial ? (
                <Text style={[st.sub, { color: colors.system.orange }]}>{MENSAJES_ERROR_FACTURACION[validacion.error]}</Text>
              ) : null}
              <BotonChunky
                texto={t('entidad.factura.guardarDatos')}
                icono="checkmark-circle"
                variante="secundario"
                cargando={ocupado === 'datos'}
                deshabilitado={!validacion.ok}
                onPress={() => void correr('datos', () => entidadRepository.guardarFacturacion(form as Partial<DatosFacturacion>), t('entidad.factura.datosGuardados'))}
              />
            </Tarjeta>
            <Aviso icono="information-circle" tono="azul" texto={t('entidad.factura.comoPagar')} />
          </>
        ) : null}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 80, gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nombre: { fontSize: 16, fontWeight: '900' },
  sub: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  num: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  total: { fontSize: 17, fontWeight: '900', fontVariant: ['tabular-nums'] },
});
