/**
 * Fase 9 — en Notas: la planilla para el sistema de notas del colegio
 * (Phidias u otro). El profe elige las columnas; sale en Excel o en CSV (;).
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { guardarArchivo } from '@shared/lib/export/guardarArchivo';
import { construirXlsx } from '@shared/lib/export/xlsx';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import {
  COLUMNAS_PLANILLA,
  COLUMNAS_POR_DEFECTO,
  ENCABEZADO_COLUMNA,
  armarPlanilla,
  planillaCsv,
  type ColumnaPlanilla,
  type FilaNota,
} from '@/functions/src/educadores/dominio';
import { BotonChunky, Chip, Seccion, Tarjeta } from '@features/dashboard/components/profe/kit';

export default function PlanillaNotas({
  colegioId,
  cursoId,
  filas,
  nombreArchivo,
}: {
  colegioId: string;
  cursoId: string;
  filas: FilaNota[];
  nombreArchivo: string;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [columnas, setColumnas] = useState<ColumnaPlanilla[]>(COLUMNAS_POR_DEFECTO);
  const [ocupado, setOcupado] = useState<'xlsx' | 'csv' | null>(null);

  const alternar = (c: ColumnaPlanilla) =>
    setColumnas((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : COLUMNAS_PLANILLA.filter((x) => x === c || cs.includes(x))));

  const exportar = async (formato: 'xlsx' | 'csv') => {
    setOcupado(formato);
    try {
      const correos = columnas.includes('correo')
        ? new Map((await rosterRepository.getRoster(colegioId, cursoId)).map((r) => [r.uid, r.email ?? null]))
        : new Map<string, string | null>();
      const planilla = armarPlanilla(
        filas.map((f) => ({ ...f, correo: (f.uid && correos.get(f.uid)) || null })),
        columnas
      );
      const ok =
        formato === 'xlsx'
          ? await guardarArchivo(`${nombreArchivo}.xlsx`, construirXlsx([{ nombre: 'Notas', filas: [planilla.encabezados, ...planilla.filas] }]), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
          : await guardarArchivo(`${nombreArchivo}.csv`, '﻿' + planillaCsv(planilla), 'text/csv');
      if (!ok) showMessage(t('planilla.error'), undefined, 'error');
    } catch (e) {
      showMessage(t('planilla.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setOcupado(null);
    }
  };

  return (
    <View style={{ gap: 10 }}>
      <Seccion texto={t('planilla.titulo')} />
      <Tarjeta style={{ gap: 10 }}>
        <Text style={[st.ayuda, { color: colors.text.secondary }]}>{t('planilla.ayuda')}</Text>
        <View style={st.chips}>
          {COLUMNAS_PLANILLA.map((c) => (
            <Chip key={c} texto={ENCABEZADO_COLUMNA[c]} seleccionado={columnas.includes(c)} onPress={() => alternar(c)} />
          ))}
        </View>
        <View style={st.botones}>
          <BotonChunky texto={t('planilla.excel')} icono="grid-outline" variante="secundario" compacto cargando={ocupado === 'xlsx'} deshabilitado={columnas.length === 0} onPress={() => void exportar('xlsx')} style={{ flex: 1 }} />
          <BotonChunky texto={t('planilla.csv')} icono="document-text-outline" variante="secundario" compacto cargando={ocupado === 'csv'} deshabilitado={columnas.length === 0} onPress={() => void exportar('csv')} style={{ flex: 1 }} />
        </View>
      </Tarjeta>
    </View>
  );
}

const st = StyleSheet.create({
  ayuda: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  botones: { flexDirection: 'row', gap: 8 },
});
