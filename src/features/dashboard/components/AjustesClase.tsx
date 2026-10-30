/**
 * Pestaña "Clase" de Gestionar: renombrar, cambiar el grado, apagar o renovar
 * el código de unión, archivar y borrar. Todo pasa por Cloud Functions
 * (editarMiCurso / generateClassCode / borrarMiCurso): las reglas no dejan al
 * cliente escribir la clase.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import { adminService } from '@features/dashboard/data/adminService';
import type { CursoWithId } from '@features/dashboard/data/rosterRepository';
import {
  Aviso,
  BotonChunky,
  Campo,
  Chip,
  Seccion,
  Tarjeta,
} from '@features/dashboard/components/profe/kit';

const GRADOS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'] as const;
const NOMBRE_MAX = 60;

export default function AjustesClase({
  colegioId,
  curso,
  estudiantesEnClase,
  soloLectura,
  onCambio,
}: {
  colegioId: string;
  curso: CursoWithId;
  /** Activos + pendientes. Con alguien en la clase no se puede borrar. */
  estudiantesEnClase: number;
  /** El plan bajó y esta clase quedó de solo lectura (se puede archivar igual). */
  soloLectura: boolean;
  onCambio: () => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const [nombre, setNombre] = useState(curso.nombre);
  const [grado, setGrado] = useState<string>(curso.grado);
  const [ocupado, setOcupado] = useState<string | null>(null);

  useEffect(() => {
    setNombre(curso.nombre);
    setGrado(curso.grado);
  }, [curso.nombre, curso.grado]);

  const archivada = curso.archivada === true;
  const codigoActivo = curso.codigoActivo !== false;
  const cambioDatos = nombre.trim() !== curso.nombre || grado !== curso.grado;
  const bloqueado = soloLectura || archivada;

  const correr = async (clave: string, fn: () => Promise<void>, ok?: string) => {
    setOcupado(clave);
    try {
      await fn();
      await onCambio();
      if (ok) showMessage(ok, undefined, 'success');
    } catch (e) {
      showMessage(t('admin.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setOcupado(null);
    }
  };

  const editar = (
    clave: string,
    cambios: Parameters<typeof adminService.editarMiCurso>[0]['cambios'],
    ok?: string
  ) =>
    correr(
      clave,
      async () => {
        await adminService.editarMiCurso({ colegioId, cursoId: curso.id, cambios });
      },
      ok
    );

  const guardarDatos = () => {
    const limpio = nombre.trim();
    if (!limpio) {
      showMessage(t('profe.clase.nombreVacio'), undefined, 'error');
      return;
    }
    void editar('datos', { nombre: limpio, grado }, t('profe.clase.guardado'));
  };

  const nuevoCodigo = () =>
    confirmAction({
      title: t('profe.clase.nuevoCodigoTitulo'),
      body: t('profe.clase.nuevoCodigoTexto'),
      cancelLabel: t('admin.cancel'),
      confirmLabel: t('profe.clase.nuevoCodigo'),
      onConfirm: () =>
        void correr(
          'codigo',
          async () => {
            await adminService.generateClassCode(colegioId, curso.id, true);
          },
          t('profe.clase.nuevoCodigoOk')
        ),
    });

  const archivar = () =>
    archivada
      ? void editar('archivar', { archivada: false }, t('profe.clase.desarchivadaOk'))
      : confirmAction({
          title: t('profe.clase.archivarTitulo'),
          body: t('profe.clase.archivarTexto'),
          cancelLabel: t('admin.cancel'),
          confirmLabel: t('profe.clase.archivar'),
          onConfirm: () =>
            void editar('archivar', { archivada: true }, t('profe.clase.archivadaOk')),
        });

  const borrar = () =>
    confirmAction({
      title: t('profe.clase.borrarTitulo', { nombre: curso.nombre }),
      body: t('profe.clase.borrarTexto'),
      cancelLabel: t('admin.cancel'),
      confirmLabel: t('profe.clase.borrar'),
      destructive: true,
      onConfirm: () => {
        void (async () => {
          setOcupado('borrar');
          try {
            await adminService.borrarMiCurso({ colegioId, cursoId: curso.id });
            showMessage(t('profe.clase.borradaOk'), undefined, 'success');
            router.replace('/(staff)/clases' as Href);
          } catch (e) {
            showMessage(t('admin.error'), e instanceof Error ? e.message : String(e), 'error');
            setOcupado(null);
          }
        })();
      },
    });

  return (
    <View style={st.vista}>
      {archivada ? (
        <Aviso icono="archive" tono="neutro" texto={t('profe.clase.archivadaAviso')} />
      ) : null}

      <Seccion texto={t('profe.clase.datos')} />
      <Tarjeta style={st.tarjeta}>
        <Campo
          etiqueta={t('profe.clase.nombre')}
          value={nombre}
          onChangeText={setNombre}
          maxLength={NOMBRE_MAX}
          editable={!bloqueado}
        />
        <Text style={[st.etiqueta, { color: colors.text.secondary }]}>
          {t('profe.clase.grado')}
        </Text>
        <View style={st.chips}>
          {GRADOS.map((g) => (
            <Chip
              key={g}
              texto={`${g}°`}
              seleccionado={g === grado}
              onPress={() => !bloqueado && setGrado(g)}
            />
          ))}
        </View>
        <BotonChunky
          texto={t('profe.clase.guardar')}
          icono="checkmark"
          cargando={ocupado === 'datos'}
          deshabilitado={bloqueado || !cambioDatos || ocupado !== null}
          onPress={guardarDatos}
        />
      </Tarjeta>

      <Seccion texto={t('profe.clase.codigoTitulo')} />
      <Tarjeta style={st.tarjeta}>
        <Text style={[st.texto, { color: colors.text.secondary }]}>
          {archivada
            ? t('profe.clase.codigoArchivada')
            : codigoActivo
              ? t('profe.clase.codigoEncendido', { codigo: curso.codigo ?? '—' })
              : t('profe.clase.codigoApagado')}
        </Text>
        <View style={st.botones}>
          <BotonChunky
            texto={codigoActivo ? t('profe.clase.apagarCodigo') : t('profe.clase.encenderCodigo')}
            icono={codigoActivo ? 'pause-circle-outline' : 'play-circle-outline'}
            variante="secundario"
            compacto
            cargando={ocupado === 'activo'}
            deshabilitado={bloqueado || ocupado !== null}
            onPress={() =>
              void editar(
                'activo',
                { codigoActivo: !codigoActivo },
                codigoActivo ? t('profe.clase.codigoApagadoOk') : t('profe.clase.codigoEncendidoOk')
              )
            }
          />
          <BotonChunky
            texto={t('profe.clase.nuevoCodigo')}
            icono="refresh"
            variante="secundario"
            compacto
            cargando={ocupado === 'codigo'}
            deshabilitado={bloqueado || !codigoActivo || ocupado !== null}
            onPress={nuevoCodigo}
          />
        </View>
      </Tarjeta>

      <Seccion texto={t('profe.clase.finTitulo')} />
      <Tarjeta style={st.tarjeta}>
        <Text style={[st.texto, { color: colors.text.secondary }]}>
          {archivada ? t('profe.clase.desarchivarTexto') : t('profe.clase.archivarAyuda')}
        </Text>
        <BotonChunky
          texto={archivada ? t('profe.clase.desarchivar') : t('profe.clase.archivar')}
          icono={archivada ? 'arrow-undo' : 'archive-outline'}
          variante="secundario"
          cargando={ocupado === 'archivar'}
          deshabilitado={ocupado !== null}
          onPress={archivar}
        />
        <Text style={[st.texto, { color: colors.text.secondary }]}>
          {estudiantesEnClase > 0
            ? t('profe.clase.borrarConEstudiantes', { count: estudiantesEnClase })
            : t('profe.clase.borrarAyuda')}
        </Text>
        <BotonChunky
          texto={t('profe.clase.borrar')}
          icono="trash-outline"
          variante="peligro"
          cargando={ocupado === 'borrar'}
          deshabilitado={estudiantesEnClase > 0 || ocupado !== null}
          onPress={borrar}
        />
      </Tarjeta>
    </View>
  );
}

const st = StyleSheet.create({
  vista: { gap: 14 },
  tarjeta: { gap: 12 },
  etiqueta: { fontSize: 14, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  texto: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  botones: { gap: 10 },
});
