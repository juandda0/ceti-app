/**
 * Importar la lista del curso (E2): el profe pega desde Excel (o sube un CSV en
 * web) y ve en vivo quién entra, qué filas fallan y cuáles se repiten, antes de
 * invitar. El servidor crea un invitado por correo; cuando el estudiante entra
 * con ese correo queda en la clase. Debajo, los invitados que aún no han entrado.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { leerLista, MAX_INVITADOS } from '@/functions/src/educadores/dominio';
import { codigoLimite } from '@features/educadores/data/planUi';
import {
  invitadosRepository,
  type Invitado,
  type ResultadoInvitarLista,
} from '../data/invitadosRepository';
import {
  Avatar,
  Aviso,
  BotonChunky,
  Campo,
  Esqueleto,
  Pill,
  Seccion,
  Tarjeta,
} from '@features/dashboard/components/profe/kit';

/** Igual que `TEXTO_LISTA_MAX` del servidor (functions/src/educadores/invitaciones.ts). */
const TEXTO_MAX = 100_000;
const MUESTRA_VALIDOS = 5;
const MUESTRA_ERRORES = 5;
const MUESTRA_PENDIENTES = 8;

export default function ImportarLista({
  colegioId,
  cursoId,
}: {
  colegioId: string;
  cursoId: string;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoInvitarLista | null>(null);
  const [invitados, setInvitados] = useState<Invitado[] | null>(null);
  const [verTodos, setVerTodos] = useState(false);
  const vivo = useRef(true);

  const previa = useMemo(() => leerLista(texto), [texto]);
  const hayTexto = texto.trim().length > 0;
  const validos = previa.invitados.length;

  const cargar = useCallback(async () => {
    try {
      const lista = await invitadosRepository.listar(colegioId, cursoId);
      if (vivo.current) setInvitados(lista);
    } catch {
      if (vivo.current) setInvitados([]);
    }
  }, [colegioId, cursoId]);

  useEffect(() => {
    vivo.current = true;
    void cargar();
    return () => {
      vivo.current = false;
    };
  }, [cargar]);

  const cambiarTexto = (v: string) => {
    setTexto(v);
    // Al empezar una lista nueva, el resultado anterior ya no aplica.
    if (v.trim().length > 0) setResultado(null);
  };

  const subirCsv = () => {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv,.txt';
    input.style.display = 'none';
    input.onchange = () => {
      const archivo = input.files?.[0];
      input.remove();
      if (!archivo) return;
      if (archivo.size > TEXTO_MAX) {
        showMessage(
          t('educadores.lista.archivoGrandeTitulo'),
          t('educadores.lista.archivoGrande'),
          'error'
        );
        return;
      }
      archivo
        .text()
        .then((contenido) => {
          if (vivo.current) cambiarTexto(contenido);
        })
        .catch(() =>
          showMessage(
            t('educadores.lista.archivoErrorTitulo'),
            t('educadores.lista.archivoError'),
            'error'
          )
        );
    };
    document.body.appendChild(input);
    input.click();
  };

  const invitar = async () => {
    if (validos === 0 || enviando) return;
    setEnviando(true);
    try {
      const r = await invitadosRepository.invitarLista({ colegioId, cursoId, texto });
      if (!vivo.current) return;
      setResultado(r);
      setTexto('');
      void cargar();
    } catch (e) {
      const codigo = codigoLimite(e);
      const clave =
        codigo === 'limite_estudiantes'
          ? 'errorLimite'
          : codigo === 'requiere_plan'
            ? 'errorPlan'
            : 'error';
      showMessage(t(`educadores.lista.${clave}Titulo`), t(`educadores.lista.${clave}`), 'error');
    } finally {
      if (vivo.current) setEnviando(false);
    }
  };

  const pendientes = (invitados ?? []).filter((i) => i.estado === 'pendiente');
  const unidos = (invitados ?? []).length - pendientes.length;
  const pendientesVisibles = verTodos ? pendientes : pendientes.slice(0, MUESTRA_PENDIENTES);

  return (
    <View style={styles.raiz}>
      <Seccion texto={t('educadores.lista.titulo')} />
      <Tarjeta style={styles.tarjeta}>
        <Text style={[styles.intro, { color: colors.text.secondary }]}>
          {t('educadores.lista.intro')}
        </Text>
        <Campo
          value={texto}
          onChangeText={cambiarTexto}
          placeholder={t('educadores.lista.placeholder')}
          multiline
          maxLength={TEXTO_MAX}
          editable={!enviando}
          inputStyle={styles.area}
        />
        {Platform.OS === 'web' ? (
          <BotonChunky
            texto={t('educadores.lista.subirCsv')}
            icono="document-attach-outline"
            variante="secundario"
            compacto
            deshabilitado={enviando}
            onPress={subirCsv}
          />
        ) : null}

        {hayTexto ? (
          <View style={styles.previa}>
            <View style={styles.pills}>
              <Pill
                texto={t('educadores.lista.validos', { count: validos })}
                tono={validos > 0 ? 'verde' : 'neutro'}
                icono="checkmark-circle"
              />
              {previa.errores.length > 0 ? (
                <Pill
                  texto={t('educadores.lista.conErrores', { count: previa.errores.length })}
                  tono="rojo"
                  icono="alert-circle"
                />
              ) : null}
              {previa.duplicados > 0 ? (
                <Pill
                  texto={t('educadores.lista.repetidos', { count: previa.duplicados })}
                  tono="neutro"
                  icono="copy-outline"
                />
              ) : null}
            </View>

            {previa.invitados.slice(0, MUESTRA_VALIDOS).map((i) => (
              <View key={i.correo} style={styles.fila}>
                <Avatar nombre={i.nombre} tamano={34} />
                <View style={styles.filaTexto}>
                  <Text style={[styles.nombre, { color: colors.text.primary }]} numberOfLines={1}>
                    {i.nombre}
                  </Text>
                  <Text style={[styles.correo, { color: colors.text.tertiary }]} numberOfLines={1}>
                    {i.correo}
                  </Text>
                </View>
              </View>
            ))}
            {validos > MUESTRA_VALIDOS ? (
              <Text style={[styles.mas, { color: colors.text.tertiary }]}>
                {t('educadores.lista.masValidos', { count: validos - MUESTRA_VALIDOS })}
              </Text>
            ) : null}

            {previa.errores.length > 0 ? (
              <View style={[styles.errores, { backgroundColor: colors.fill.redSubtle }]}>
                {previa.errores.slice(0, MUESTRA_ERRORES).map((e) => (
                  <Text
                    key={`${e.linea}-${e.texto}`}
                    style={[styles.error, { color: colors.text.primary }]}
                    numberOfLines={1}
                  >
                    <Text style={{ color: colors.system.red, fontWeight: '900' }}>
                      {t('educadores.lista.linea', { linea: e.linea })}
                    </Text>
                    {'  '}
                    {t(
                      e.motivo === 'sin_correo'
                        ? 'educadores.lista.motivoSinCorreo'
                        : 'educadores.lista.motivoCorreoInvalido'
                    )}
                    <Text style={{ color: colors.text.tertiary }}> · {e.texto}</Text>
                  </Text>
                ))}
                {previa.errores.length > MUESTRA_ERRORES ? (
                  <Text style={[styles.mas, { color: colors.text.tertiary }]}>
                    {t('educadores.lista.masErrores', {
                      count: previa.errores.length - MUESTRA_ERRORES,
                    })}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {validos >= MAX_INVITADOS ? (
              <Aviso
                icono="hand-left-outline"
                tono="naranja"
                texto={t('educadores.lista.tope', { max: MAX_INVITADOS })}
              />
            ) : null}
          </View>
        ) : null}

        <BotonChunky
          texto={
            validos > 0
              ? t('educadores.lista.invitar', { count: validos })
              : t('educadores.lista.invitarVacio')
          }
          icono="paper-plane"
          cargando={enviando}
          deshabilitado={validos === 0}
          onPress={() => void invitar()}
        />
      </Tarjeta>

      {resultado ? (
        <>
          {resultado.invitados.length > 0 ? (
            <Aviso
              icono="checkmark-circle"
              tono="verde"
              texto={t('educadores.lista.listo', { count: resultado.invitados.length })}
            >
              {resultado.duplicados > 0 ? (
                <Text style={[styles.detalle, { color: colors.text.secondary }]}>
                  {t('educadores.lista.listoDuplicados', { count: resultado.duplicados })}
                </Text>
              ) : null}
            </Aviso>
          ) : resultado.sinCupo.length === 0 ? (
            <Aviso
              icono="information-circle"
              tono="neutro"
              texto={t('educadores.lista.nadaNuevo')}
            />
          ) : null}
          {resultado.sinCupo.length > 0 ? (
            <Aviso
              icono="people-circle-outline"
              tono="naranja"
              texto={t('educadores.lista.sinCupo', { count: resultado.sinCupo.length })}
            >
              <Text style={[styles.detalle, { color: colors.text.secondary }]} numberOfLines={3}>
                {resultado.sinCupo.map((i) => i.nombre).join(', ')}
              </Text>
            </Aviso>
          ) : null}
        </>
      ) : null}

      {invitados === null ? (
        <Esqueleto filas={2} alto={56} />
      ) : invitados.length > 0 ? (
        <View style={styles.pendientes}>
          <Seccion
            texto={t('educadores.lista.pendientesTitulo')}
            derecha={
              pendientes.length > 0 ? (
                <Pill texto={String(pendientes.length)} tono="naranja" />
              ) : undefined
            }
          />
          {unidos > 0 ? (
            <Text style={[styles.intro, { color: colors.text.secondary }]}>
              {t('educadores.lista.unidos', { count: unidos })}
            </Text>
          ) : null}
          {pendientes.length > 0 ? (
            <Tarjeta style={styles.tarjetaLista}>
              {pendientesVisibles.map((i, idx) => (
                <View
                  key={i.correo}
                  style={[
                    styles.fila,
                    styles.filaPendiente,
                    idx > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.materials.border,
                    },
                  ]}
                >
                  <Avatar nombre={i.nombre} tamano={36} />
                  <View style={styles.filaTexto}>
                    <Text style={[styles.nombre, { color: colors.text.primary }]} numberOfLines={1}>
                      {i.nombre}
                    </Text>
                    <Text
                      style={[styles.correo, { color: colors.text.tertiary }]}
                      numberOfLines={1}
                    >
                      {i.correo}
                    </Text>
                  </View>
                  <Pill
                    texto={t('educadores.lista.pendiente')}
                    tono="naranja"
                    icono="time-outline"
                  />
                </View>
              ))}
              {pendientes.length > MUESTRA_PENDIENTES ? (
                <Pressable
                  onPress={() => setVerTodos((v) => !v)}
                  accessibilityRole="button"
                  style={styles.verTodos}
                >
                  <Text style={[styles.verTodosTexto, { color: colors.brand.primary }]}>
                    {verTodos
                      ? t('educadores.lista.verMenos')
                      : t('educadores.lista.verTodos', { count: pendientes.length })}
                  </Text>
                </Pressable>
              ) : null}
            </Tarjeta>
          ) : (
            <Text style={[styles.intro, { color: colors.text.tertiary }]}>
              {t('educadores.lista.pendientesVacio')}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { gap: 14 },
  tarjeta: { gap: 14 },
  intro: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  area: { minHeight: 140, fontSize: 15, lineHeight: 21 },
  previa: { gap: 10 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  filaPendiente: { paddingVertical: 10 },
  filaTexto: { flex: 1, minWidth: 0 },
  nombre: { fontSize: 15, fontWeight: '800' },
  correo: { fontSize: 13, fontWeight: '600' },
  mas: { fontSize: 13, fontWeight: '800' },
  errores: { borderRadius: 14, padding: 12, gap: 6 },
  error: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  detalle: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  pendientes: { gap: 10 },
  tarjetaLista: { paddingVertical: 4 },
  verTodos: { paddingVertical: 12, alignItems: 'center' },
  verTodosTexto: { fontSize: 14, fontWeight: '900' },
});
