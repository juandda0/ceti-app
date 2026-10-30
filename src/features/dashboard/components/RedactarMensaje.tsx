/**
 * Fase 5 — caja para escribirle a la clase: un anuncio a todos, un mensaje a un
 * grupo ("Escribirle a los que…") o un comentario a un estudiante. Envía con el
 * callable `enviarComunicado`; los mensajes y comentarios piden Piloto y, si el
 * plan no alcanza, abre el muro. No hay respuesta del estudiante.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { useMuro } from '@features/educadores/components/MuroPlan';
import { motivoDeError } from '@features/educadores/data/planUi';
import {
  TEXTO_COMUNICADO_MAX,
  type ContextoComunicado,
  type TipoComunicado,
} from '@/functions/src/educadores/dominio';
import {
  comunicacionRepository,
  type ResultadoEnvio,
} from '@features/dashboard/data/comunicacionRepository';
import { BotonChunky, Campo } from '@features/dashboard/components/profe/kit';

export default function RedactarMensaje({
  colegioId,
  cursoId,
  tipo,
  para = [],
  contexto = null,
  etiqueta,
  placeholder,
  textoBoton,
  listo = true,
  onEnviado,
}: {
  colegioId: string;
  cursoId: string;
  tipo: TipoComunicado;
  para?: string[];
  contexto?: ContextoComunicado | null;
  etiqueta?: string;
  placeholder?: string;
  textoBoton: string;
  /** false mientras falte algo fuera de la caja (p. ej. elegir el mundo). */
  listo?: boolean;
  onEnviado?: (r: ResultadoEnvio) => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const muro = useMuro();
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const enviar = async () => {
    if (!texto.trim() || !listo) return;
    if (tipo !== 'anuncio' && !muro.exigir('mensajesProfe')) return;
    setOcupado(true);
    try {
      const r = await comunicacionRepository.enviar({
        colegioId,
        cursoId,
        tipo,
        texto,
        para,
        contexto,
      });
      showMessage(
        t(tipo === 'anuncio' ? 'comunicacion.anuncioEnviado' : 'comunicacion.enviado', {
          count: r.enviados,
        }),
        r.omitidos > 0 ? t('comunicacion.omitidos', { count: r.omitidos }) : undefined,
        'success'
      );
      setTexto('');
      onEnviado?.(r);
    } catch (e) {
      const motivo = motivoDeError(e, 'mensajesProfe');
      if (motivo) muro.abrir(motivo);
      else showMessage(t('admin.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <View style={st.caja}>
      <Campo
        etiqueta={etiqueta}
        value={texto}
        onChangeText={setTexto}
        placeholder={placeholder}
        multiline
        maxLength={TEXTO_COMUNICADO_MAX}
      />
      {tipo !== 'anuncio' ? (
        <Text style={[st.nota, { color: colors.text.tertiary }]}>{t('comunicacion.sinRespuesta')}</Text>
      ) : null}
      <BotonChunky
        texto={textoBoton}
        icono="paper-plane"
        cargando={ocupado}
        deshabilitado={!texto.trim() || !listo}
        onPress={() => void enviar()}
      />
      {muro.hoja}
    </View>
  );
}

const st = StyleSheet.create({
  caja: { gap: 10 },
  nota: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
